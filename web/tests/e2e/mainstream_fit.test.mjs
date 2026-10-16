// e2e 主流视口适配与交叠回归（TASK B / C / D / E）。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";
import { commit, clearTutorial } from "./helpers/flow.mjs";

buildDist();

const MAINSTREAM_VIEWPORTS = [
  { name: "375x667", width: 375, height: 667, view: "mobile" },
  { name: "360x800", width: 360, height: 800, view: "mobile" },
  { name: "390x844", width: 390, height: 844, view: "mobile" },
  { name: "393x852", width: 393, height: 852, view: "mobile" },
  { name: "412x915", width: 412, height: 915, view: "mobile" },
  { name: "430x932", width: 430, height: 932, view: "mobile" },
  { name: "390x664", width: 390, height: 664, view: "mobile" },
  { name: "768x1024", width: 768, height: 1024, view: "tablet-portrait" },
  { name: "820x1180", width: 820, height: 1180, view: "tablet-portrait" },
  { name: "1024x768", width: 1024, height: 768, view: "desktop" },
  { name: "1280x720", width: 1280, height: 720, view: "desktop" },
  { name: "1280x800", width: 1280, height: 800, view: "desktop" },
  { name: "1366x768", width: 1366, height: 768, view: "desktop" },
  { name: "1440x900", width: 1440, height: 900, view: "desktop" },
  { name: "1920x1080", width: 1920, height: 1080, view: "desktop" },
];

const OUT_OF_SCOPE_VIEWPORTS = [
  { name: "320x568", width: 320, height: 568 },
  { name: "375x553", width: 375, height: 553 },
  { name: "359x800", width: 359, height: 800 },
  { name: "1024x599", width: 1024, height: 599 },
];

let server, browsers = {};
before(async () => {
  server = await startServer();
  for (const [name, type] of Object.entries(ENGINES)) browsers[name] = await type.launch();
});
after(async () => {
  for (const b of Object.values(browsers)) await b.close();
  server?.close();
});

async function checkSampleCoverage(page, selector, label) {
  const res = await page.evaluate(({ selector, label }) => {
    const el = document.querySelector(selector);
    if (!el || el.hidden || getComputedStyle(el).display === "none" || getComputedStyle(el).visibility === "hidden") {
      return { ok: true, msg: "hidden" };
    }
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return { ok: true, msg: "empty" };
    const vw = window.innerWidth, vh = window.innerHeight;
    if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1) {
      return { ok: false, msg: `${label} 超出视口: [${r.left}, ${r.top}, ${r.right}, ${r.bottom}] (视口 ${vw}×${vh})` };
    }
    const card = document.querySelector("#card");
    const wrap = document.querySelector("#cardwrap");
    const gest = document.querySelector("#gesture-hint");
    const forbidden = [card, wrap, gest].filter(Boolean);

    for (let xi = 0; xi < 5; xi++) {
      for (let yi = 0; yi < 3; yi++) {
        const px = r.left + (r.width * (xi + 0.5)) / 5;
        const py = r.top + (r.height * (yi + 0.5)) / 3;
        if (px < 0 || py < 0 || px >= vw || py >= vh) continue;
        const top = document.elementFromPoint(px, py);
        if (!top) continue;
        for (const f of forbidden) {
          if (top === f || f.contains(top)) {
            return { ok: false, msg: `${label} 在坐标 (${px.toFixed(1)}, ${py.toFixed(1)}) 被 ${top.id || top.className || top.tagName} 遮挡` };
          }
        }
      }
    }
    return { ok: true, msg: "clear" };
  }, { selector, label });
  assert.ok(res.ok, res.msg);
}

async function assertStepFit(page, stepLabel) {
  const targets = ["#menubtn", "#dims", "#opt-left", "#opt-right", "#wordbox-bar", "#coach"];
  for (const t of targets) {
    await checkSampleCoverage(page, t, `${stepLabel} ${t}`);
  }

  // 断言 #gesture-hint 不压 #wordbox-bar
  const interGestWb = await page.evaluate(() => {
    const g = document.querySelector("#gesture-hint");
    const w = document.querySelector("#wordbox-bar");
    if (!g || !w || g.hidden || w.hidden || getComputedStyle(g).display === "none") return false;
    const gr = g.getBoundingClientRect(), wr = w.getBoundingClientRect();
    return Math.min(gr.bottom, wr.bottom) - Math.max(gr.top, wr.top) > 0 &&
           Math.min(gr.right, wr.right) - Math.max(gr.left, wr.left) > 0;
  });
  assert.equal(interGestWb, false, `${stepLabel}: #gesture-hint 不得与 #wordbox-bar 交叠`);
}

// ==========================================
// b) 主流尺寸卡片适配与不交叠检查（T01→T05 + 普通卡）
// ==========================================
for (const [engine] of Object.entries(ENGINES)) {
  for (const vp of MAINSTREAM_VIEWPORTS) {
    test(`${engine} ${vp.name}: walk tutorial & normal cards, non-overlap & card width`, async () => {
      const ctx = await browsers[engine].newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);

      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz && window.__zz.st?.current === "T01");

        // T01 检查
        await assertStepFit(page, "T01");
        const cardWidthT01 = await page.evaluate(() => document.querySelector("#card").getBoundingClientRect().width);

        // 390x844, 412x915, 430x932, 768x1024 卡宽必须等于 main (min(vw-32, 480) ±1)
        if (["390x844", "412x915", "430x932", "768x1024"].includes(vp.name)) {
          const expWidth = Math.min(vp.width - 32, 480);
          assert.ok(
            Math.abs(cardWidthT01 - expWidth) <= 1,
            `${vp.name} T01 卡宽应为 ${expWidth} ±1，实际 ${cardWidthT01}`,
          );
        }

        // T01 → T02
        await commit(page, "left");
        await page.waitForFunction(() => window.__zz.st?.current === "T02");
        await assertStepFit(page, "T02");

        // T02 → T03 (engrave 阶段)
        await commit(page, "right");
        await page.waitForFunction(() => window.__zz.st?.phase === "engrave");
        await assertStepFit(page, "T03 engrave");

        // 刻 → T04
        await page.locator("#bonecorner").click();
        await page.waitForFunction(() => window.__zz.st?.current === "T04");
        await page.waitForTimeout(200);
        await assertStepFit(page, "T04 drop");

        // 落水 → T05
        await page.locator("#wordbox .slot.ok").first().click();
        await page.waitForFunction(() => window.__zz.st?.current === "T05");
        await page.waitForTimeout(200);
        await assertStepFit(page, "T05");

        // T05 提交 → 进入普通卡 C01
        await commit(page, "left");
        await page.waitForFunction(() => window.__zz.st?.phase === "card" && !window.__zz.isTutorialCard?.(window.__zz.st.current));
        await page.waitForTimeout(200);

        // 连续走几张普通卡（C01, C02, C03）
        for (let i = 0; i < 3; i++) {
          const curId = await page.evaluate(() => window.__zz.st.current);
          await assertStepFit(page, `Normal card ${curId}`);
          const cardWidthNorm = await page.evaluate(() => document.querySelector("#card").getBoundingClientRect().width);
          if (["390x844", "412x915", "430x932", "768x1024"].includes(vp.name)) {
            const expWidth = Math.min(vp.width - 32, 480);
            assert.ok(
              Math.abs(cardWidthNorm - expWidth) <= 1,
              `${vp.name} 普通卡 ${curId} 卡宽应为 ${expWidth} ±1，实际 ${cardWidthNorm}`,
            );
          }
          await commit(page, "left");
          await page.waitForTimeout(200);
        }

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}

// ☰ 菜单触控打开检查（375×667 与 390×664，hasTouch: true）
for (const [engine] of Object.entries(ENGINES)) {
  for (const vp of [{ w: 375, h: 667 }, { w: 390, h: 664 }]) {
    test(`${engine} ${vp.w}x${vp.h} touch tap menubtn opens menu`, async () => {
      const ctx = await browsers[engine].newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: true });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);
      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz && window.__zz.st?.phase === "card");

        const mb = page.locator("#menubtn");
        await mb.tap();
        const menuPop = page.locator("#menu-pop");
        await menuPop.waitFor({ state: "visible", timeout: 3000 });
        assert.ok(await menuPop.isVisible(), "菜单点击后应打开可见");

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}

// ==========================================
// c) 桌面拖拽重叠检查（1280×720, 1366×768, 1280×800）
// ==========================================
for (const [engine] of Object.entries(ENGINES)) {
  for (const vp of [{ w: 1280, h: 720 }, { w: 1366, h: 768 }, { w: 1280, h: 800 }]) {
    test(`${engine} ${vp.w}x${vp.h}: drag right 25% / left 25% does not cover option button`, async () => {
      const ctx = await browsers[engine].newContext({ viewport: { width: vp.w, height: vp.h } });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);
      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz && window.__zz.st?.phase === "card");

        const cardBox = await page.locator("#card").boundingBox();
        assert.ok(cardBox, "#card 必须有包围盒");
        const cx = cardBox.x + cardBox.width / 2;
        const cy = cardBox.y + cardBox.height / 2;
        const dragDist = cardBox.width * 0.25;

        // 向右拖拽 25% -> 采样 #opt-right 的 15 个点
        await page.mouse.move(cx, cy);
        await page.mouse.down();
        await page.mouse.move(cx + dragDist, cy, { steps: 5 });

        const rightHits = await page.evaluate(() => {
          const el = document.querySelector("#opt-right");
          const r = el.getBoundingClientRect();
          const hits = [];
          for (let xi = 0; xi < 5; xi++) {
            for (let yi = 0; yi < 3; yi++) {
              const px = r.left + (r.width * (xi + 0.5)) / 5;
              const py = r.top + (r.height * (yi + 0.5)) / 3;
              const top = document.elementFromPoint(px, py);
              hits.push(top === el || el.contains(top));
            }
          }
          return hits;
        });
        assert.equal(rightHits.length, 15, "应采 15 个点");
        assert.ok(rightHits.every(Boolean), "向右拖拽 25% 时，#opt-right 15 个采样点命中自身");

        await page.mouse.up();
        await page.waitForFunction(() => !window.__zz.animating, null, { timeout: 3000 });

        // 向左拖拽 25% -> 采样 #opt-left 的 15 个点
        await page.mouse.move(cx, cy);
        await page.mouse.down();
        await page.mouse.move(cx - dragDist, cy, { steps: 5 });

        const leftHits = await page.evaluate(() => {
          const el = document.querySelector("#opt-left");
          const r = el.getBoundingClientRect();
          const hits = [];
          for (let xi = 0; xi < 5; xi++) {
            for (let yi = 0; yi < 3; yi++) {
              const px = r.left + (r.width * (xi + 0.5)) / 5;
              const py = r.top + (r.height * (yi + 0.5)) / 3;
              const top = document.elementFromPoint(px, py);
              hits.push(top === el || el.contains(top));
            }
          }
          return hits;
        });
        assert.equal(leftHits.length, 15, "应采 15 个点");
        assert.ok(leftHits.every(Boolean), "向左拖拽 25% 时，#opt-left 15 个采样点命中自身");

        await page.mouse.up();
        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}

// ==========================================
// d) Item 4: 太小提示 #too-short 规则与文案
// ==========================================
for (const [engine] of Object.entries(ENGINES)) {
  for (const vp of OUT_OF_SCOPE_VIEWPORTS) {
    test(`${engine} ${vp.name}: too-short hint visible with exact text & no crash`, async () => {
      const ctx = await browsers[engine].newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);
      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz);

        const ts = page.locator("#too-short");
        assert.equal(await ts.isVisible(), true, `${vp.name} 属于超纲小视口，应显示 #too-short`);
        const text = (await ts.innerText()).trim();
        assert.equal(text, "窗口太小，放大窗口更好玩", `文案应精确为「窗口太小，放大窗口更好玩」，实际: ${text}`);

        // 在视口内
        const box = await ts.boundingBox();
        assert.ok(box.x >= 0 && box.x + box.width <= vp.width + 1, "提示水平方向在视口内");
        assert.ok(box.y >= 0 && box.y + box.height <= vp.height + 1, "提示垂直方向在视口内");

        assert.deepEqual(errs, [], "超纲尺寸加载不应有控制台/页面错误：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }

  for (const vp of MAINSTREAM_VIEWPORTS) {
    test(`${engine} ${vp.name}: too-short hint hidden on mainstream viewport`, async () => {
      const ctx = await browsers[engine].newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);
      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz);
        const ts = page.locator("#too-short");
        assert.equal(await ts.isHidden(), true, `${vp.name} 为主流尺寸，#too-short 必须隐藏`);
        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}

// ==========================================
// e) Item 5: WCAG 对比度（390×844, 768×1024, 1280×800）
// ==========================================
for (const [engine] of Object.entries(ENGINES)) {
  for (const vp of [{ w: 390, h: 844 }, { w: 768, h: 1024 }, { w: 1280, h: 800 }]) {
    test(`${engine} ${vp.w}x${vp.h}: resting option buttons WCAG contrast (text >= 4.5, border >= 3)`, async () => {
      const ctx = await browsers[engine].newContext({ viewport: { width: vp.w, height: vp.h } });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);
      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz && window.__zz.st?.phase === "card");

        const contrastData = await page.evaluate(() => {
          const parseRgb = (c) => {
            const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
          };
          const lum = ([r, g, b]) => {
            const a = [r, g, b].map((v) => {
              v /= 255;
              return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
            });
            return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
          };
          const cr = (c1, c2) => {
            const l1 = lum(parseRgb(c1)), l2 = lum(parseRgb(c2));
            return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
          };

          const stage = document.querySelector("#stage");
          const stageBg = getComputedStyle(stage).backgroundColor === "rgba(0, 0, 0, 0)"
            ? getComputedStyle(document.body).backgroundColor
            : getComputedStyle(stage).backgroundColor;

          const checkBtn = (id) => {
            const el = document.querySelector(id);
            const cs = getComputedStyle(el);
            const textCr = cr(cs.color, cs.backgroundColor);
            const borderCr = cr(cs.borderColor, stageBg);
            return { textCr, borderCr };
          };

          return {
            left: checkBtn("#opt-left"),
            right: checkBtn("#opt-right"),
          };
        });

        assert.ok(contrastData.left.textCr >= 4.5, `#opt-left 文字对比度 ${contrastData.left.textCr.toFixed(2)} < 4.5`);
        assert.ok(contrastData.left.borderCr >= 3.0, `#opt-left 边框对比度 ${contrastData.left.borderCr.toFixed(2)} < 3.0`);
        assert.ok(contrastData.right.textCr >= 4.5, `#opt-right 文字对比度 ${contrastData.right.textCr.toFixed(2)} < 4.5`);
        assert.ok(contrastData.right.borderCr >= 3.0, `#opt-right 边框对比度 ${contrastData.right.borderCr.toFixed(2)} < 3.0`);

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}
