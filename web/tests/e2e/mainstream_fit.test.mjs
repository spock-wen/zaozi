// e2e 主流视口适配与交叠回归（TASK B / C / D / E / F / R1 / R2 / R3）。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ENGINES, SEED, DIST, buildDist, startServer, collectErrors } from "./helpers/env.mjs";
import { commit, passCutscene } from "./helpers/flow.mjs";

buildDist();

const CARDS_DATA = JSON.parse(
  fs.readFileSync(path.join(DIST, "data", "year1_cards.json"), "utf8"),
).cards;
const cardById = (id) => CARDS_DATA.find((c) => c.id === id);

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

const IN_SCOPE_EXTRA = [
  { name: "900x600", width: 900, height: 600 },
  { name: "960x600", width: 960, height: 600 },
];

const ALL_17_IN_SCOPE = [...MAINSTREAM_VIEWPORTS, ...IN_SCOPE_EXTRA];

const OUT_OF_SCOPE_VIEWPORTS = [
  { name: "320x568", width: 320, height: 568 },
  { name: "375x553", width: 375, height: 553 },
  { name: "375x500", width: 375, height: 500 },
  { name: "359x700", width: 359, height: 700 },
  { name: "1280x599", width: 1280, height: 599 },
  { name: "1024x560", width: 1024, height: 560 },
  { name: "667x375", width: 667, height: 375 },
  { name: "844x390", width: 844, height: 390 },
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
// 1. 主流尺寸卡片适配与不交叠检查（T01→T05 + 普通卡）
// ==========================================
for (const [engine] of Object.entries(ENGINES)) {
  for (const vp of MAINSTREAM_VIEWPORTS) {
    const isDesktop = vp.view === "desktop";
    const testTitle = isDesktop
      ? `${engine} ${vp.name} [regression guard]: walk tutorial & normal cards, non-overlap & card width`
      : `${engine} ${vp.name}: walk tutorial & normal cards, non-overlap & card width`;

    test(testTitle, async () => {
      const ctx = await browsers[engine].newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);

      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz && window.__zz.st?.current === "T01");

        // T01 检查
        await assertStepFit(page, "T01");
        const cardBoxT01 = await page.evaluate(() => {
          const c = document.querySelector("#card").getBoundingClientRect();
          const w = document.querySelector("#cardwrap").getBoundingClientRect();
          return { cardW: c.width, cardH: c.height, wrapW: w.width, wrapH: w.height };
        });

        // 验证设计师 authoritative 规则: 卡片为 328:468 纵横比，受舞台盒约束
        if (vp.view === "mobile" || vp.view === "tablet-portrait") {
          const expWidth = Math.min(cardBoxT01.wrapW, cardBoxT01.wrapH * 328 / 468);
          assert.ok(
            Math.abs(cardBoxT01.cardW - expWidth) <= 1.5,
            `${vp.name} T01 容器查询卡宽应为 ${expWidth.toFixed(2)} ±1.5，实际 ${cardBoxT01.cardW.toFixed(2)}`,
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
        await passCutscene(page);
        await assertStepFit(page, "T04 drop");

        // 落水 → T05
        await page.locator("#wordbox .slot.ok").first().click();
        await page.waitForFunction(() => window.__zz.st?.current === "T05");
        await page.waitForTimeout(200);
        await passCutscene(page);
        await assertStepFit(page, "T05");

        // T05 提交 → 进入普通卡
        await commit(page, "left");
        await page.waitForFunction(() => window.__zz.st?.phase === "card" && !window.__zz.isTutorialCard?.(window.__zz.st.current));
        await page.waitForTimeout(200);

        // 连续走 3 张普通卡
        for (let i = 0; i < 3; i++) {
          const curId = await page.evaluate(() => window.__zz.st.current);
          await assertStepFit(page, `Normal card ${curId}`);
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

// ==========================================
// 2. Requirement 2: 对比度 e2e (390×844, 768×1024, 1280×800, 1280×720)
// ==========================================
for (const [engine] of Object.entries(ENGINES)) {
  for (const vp of [{ w: 390, h: 844 }, { w: 768, h: 1024 }, { w: 1280, h: 800 }, { w: 1280, h: 720 }]) {
    const isDesktop = vp.w >= 1024;
    const testTitle = isDesktop
      ? `${engine} ${vp.w}x${vp.h} [regression guard]: rest, highlight, disabled option buttons WCAG contrast`
      : `${engine} ${vp.w}x${vp.h}: rest, highlight, disabled option buttons WCAG contrast`;

    test(testTitle, async () => {
      const ctx = await browsers[engine].newContext({ viewport: { width: vp.w, height: vp.h } });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);
      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz && window.__zz.st?.phase === "card");

        const contrastFn = `
          (() => {
            const parseRgb = (c) => {
              const m = c.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
              if (!m) return [0, 0, 0, 1];
              return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] != null ? Number(m[4]) : 1];
            };
            const composite = (fg, bg) => {
              const [r1, g1, b1, a1] = parseRgb(fg);
              const [r2, g2, b2] = parseRgb(bg);
              const r = Math.round(r1 * a1 + r2 * (1 - a1));
              const g = Math.round(g1 * a1 + g2 * (1 - a1));
              const b = Math.round(b1 * a1 + b2 * (1 - a1));
              return \`rgb(\${r}, \${g}, \${b})\`;
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

            const check = (selector) => {
              const el = document.querySelector(selector);
              const cs = getComputedStyle(el);
              const bg = cs.backgroundColor === "rgba(0, 0, 0, 0)" ? stageBg : composite(cs.backgroundColor, stageBg);
              return {
                textCr: cr(cs.color, bg),
                borderCr: cr(cs.borderColor, stageBg),
              };
            };
            return {
              left: check("#opt-left"),
              right: check("#opt-right"),
            };
          })()
        `;

        // 1. 常态 (rest)
        const restContrast = await page.evaluate(contrastFn);
        assert.ok(restContrast.left.textCr >= 4.5, `#opt-left rest 文字对比度 ${restContrast.left.textCr.toFixed(2)} < 4.5`);
        assert.ok(restContrast.left.borderCr >= 3.0, `#opt-left rest 边框对比度 ${restContrast.left.borderCr.toFixed(2)} < 3.0`);
        assert.ok(restContrast.right.textCr >= 4.5, `#opt-right rest 文字对比度 ${restContrast.right.textCr.toFixed(2)} < 4.5`);
        assert.ok(restContrast.right.borderCr >= 3.0, `#opt-right rest 边框对比度 ${restContrast.right.borderCr.toFixed(2)} < 3.0`);

        // 2. 高亮态 (highlight: .on while dragging or preview)
        await page.evaluate(() => {
          document.querySelector("#opt-left").classList.add("on");
          document.querySelector("#opt-right").classList.add("on");
        });
        const onContrast = await page.evaluate(contrastFn);
        assert.ok(onContrast.left.textCr >= 4.5, `#opt-left highlight 文字对比度 ${onContrast.left.textCr.toFixed(2)} < 4.5`);
        assert.ok(onContrast.right.textCr >= 4.5, `#opt-right highlight 文字对比度 ${onContrast.right.textCr.toFixed(2)} < 4.5`);

        // 3. 禁用态 (disabled: T03 engrave phase)
        await page.evaluate(() => {
          document.querySelector("#opt-left").classList.remove("on");
          document.querySelector("#opt-right").classList.remove("on");
        });
        await commit(page, "left"); // T01 -> T02
        await commit(page, "right"); // T02 -> T03 (engrave)
        await page.waitForFunction(() => window.__zz.st?.phase === "engrave");

        const disabledContrast = await page.evaluate(contrastFn);
        assert.ok(disabledContrast.left.textCr >= 4.5, `#opt-left disabled 文字对比度 ${disabledContrast.left.textCr.toFixed(2)} < 4.5`);
        assert.ok(disabledContrast.left.borderCr >= 3.0, `#opt-left disabled 边框对比度 ${disabledContrast.left.borderCr.toFixed(2)} < 3.0`);
        assert.ok(disabledContrast.right.textCr >= 4.5, `#opt-right disabled 文字对比度 ${disabledContrast.right.textCr.toFixed(2)} < 4.5`);
        assert.ok(disabledContrast.right.borderCr >= 3.0, `#opt-right disabled 边框对比度 ${disabledContrast.right.borderCr.toFixed(2)} < 3.0`);

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}

// ==========================================
// 3. Requirement 3: 刻字阶段禁用选项 (T03 engrave)
// ==========================================
for (const [engine] of Object.entries(ENGINES)) {
  for (const vp of [{ w: 390, h: 844 }, { w: 1280, h: 800 }]) {
    const isDesktop = vp.w >= 1024;
    const testTitle = isDesktop
      ? `${engine} ${vp.w}x${vp.h} [regression guard]: T03 engrave phase options disabled & no-op`
      : `${engine} ${vp.w}x${vp.h}: T03 engrave phase options disabled & no-op`;

    test(testTitle, async () => {
      const ctx = await browsers[engine].newContext({ viewport: { width: vp.w, height: vp.h } });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);
      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz && window.__zz.st?.current === "T01");
        await commit(page, "left"); // T02
        await commit(page, "right"); // T03 (engrave)
        await page.waitForFunction(() => window.__zz.st?.phase === "engrave");

        const optL = page.locator("#opt-left");
        const optR = page.locator("#opt-right");
        assert.ok(await optL.isDisabled(), "T03 #opt-left 必须 disabled");
        assert.ok(await optR.isDisabled(), "T03 #opt-right 必须 disabled");

        // 点击 disabled 按钮不产生 toast，st.phase 仍为 engrave
        await optL.click({ force: true });
        await page.waitForTimeout(100);
        assert.equal(await page.locator("#toast.on").count(), 0, "点击 disabled #opt-left 不产生 toast");
        assert.equal(await page.evaluate(() => window.__zz.st.phase), "engrave", "phase 保持 engrave");

        await optR.click({ force: true });
        await page.waitForTimeout(100);
        assert.equal(await page.locator("#toast.on").count(), 0, "点击 disabled #opt-right 不产生 toast");
        assert.equal(await page.evaluate(() => window.__zz.st.phase), "engrave", "phase 保持 engrave");

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}

// ==========================================
// 4. Requirement 4: 卡片内容不溢出与不交叠 (375x667, 390x664, 390x844)
// ==========================================
for (const [engine] of Object.entries(ENGINES)) {
  for (const vp of [{ w: 375, h: 667 }, { w: 390, h: 664 }, { w: 390, h: 844 }]) {
    test(`${engine} ${vp.w}x${vp.h}: card children inside card box & internal non-overlap`, async () => {
      const ctx = await browsers[engine].newContext({ viewport: { width: vp.w, height: vp.h } });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);
      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz && window.__zz.st?.current === "T01");

        const checkCardFit = async (label) => {
          const res = await page.evaluate(({ label }) => {
            const card = document.querySelector("#card");
            const cr = card.getBoundingClientRect();
            const children = Array.from(card.children).filter(c => !c.hidden && getComputedStyle(c).display !== "none");
            for (const ch of children) {
              const r = ch.getBoundingClientRect();
              if (r.width <= 0 || r.height <= 0) continue;
              if (r.left < cr.left - 1.5 || r.top < cr.top - 1.5 || r.right > cr.right + 1.5 || r.bottom > cr.bottom + 1.5) {
                return { ok: false, msg: `${label}: 子元素 ${ch.id || ch.className} 溢出卡片盒 [left:${r.left.toFixed(1)}, right:${r.right.toFixed(1)}, top:${r.top.toFixed(1)}, bottom:${r.bottom.toFixed(1)}] vs [left:${cr.left.toFixed(1)}, right:${cr.right.toFixed(1)}, top:${cr.top.toFixed(1)}, bottom:${cr.bottom.toFixed(1)}]` };
              }
            }

            // #card-title / #card-text / #card-drops 互不交叠
            const title = document.querySelector("#card-title");
            const text = document.querySelector("#card-text");
            const drops = document.querySelector("#card-drops");
            const parts = [title, text, !drops.hidden && getComputedStyle(drops).display !== "none" ? drops : null].filter(Boolean);
            for (let i = 0; i < parts.length; i++) {
              for (let j = i + 1; j < parts.length; j++) {
                const r1 = parts[i].getBoundingClientRect();
                const r2 = parts[j].getBoundingClientRect();
                const interY = Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top);
                const interX = Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left);
                if (interY > 0.5 && interX > 0.5) {
                  return { ok: false, msg: `${label}: ${parts[i].id} 与 ${parts[j].id} 垂直交叠 ${interY.toFixed(1)}px` };
                }
              }
            }

            // 卡片不盖住 #dims, #menubtn, #opt-left, #opt-right, #coach, #gesture-hint, #wordbox-bar
            const avoidSels = ["#dims", "#menubtn", "#opt-left", "#opt-right", "#coach", "#gesture-hint", "#wordbox-bar"];
            for (const s of avoidSels) {
              const el = document.querySelector(s);
              if (!el || el.hidden || getComputedStyle(el).display === "none") continue;
              const r = el.getBoundingClientRect();
              if (r.width <= 0 || r.height <= 0) continue;
              const interY = Math.min(cr.bottom, r.bottom) - Math.max(cr.top, r.top);
              const interX = Math.min(cr.right, r.right) - Math.max(cr.left, r.left);
              if (interY > 0.5 && interX > 0.5) {
                return { ok: false, msg: `${label}: 卡片与 ${s} 交叠 (x:${interX.toFixed(1)}, y:${interY.toFixed(1)})` };
              }
            }

            return { ok: true };
          }, { label });
          assert.ok(res.ok, res.msg);
        };

        // 走 T01..T05 + 普通卡 C01..C05
        await checkCardFit("T01");
        await commit(page, "left");
        await page.waitForFunction(() => window.__zz.st?.current === "T02");
        await checkCardFit("T02");

        await commit(page, "right");
        await page.waitForFunction(() => window.__zz.st?.phase === "engrave");
        await checkCardFit("T03 engrave");

        await page.locator("#bonecorner").click();
        await page.waitForFunction(() => window.__zz.st?.current === "T04");
        await page.waitForTimeout(200);
        await passCutscene(page);
        await checkCardFit("T04 drop");

        await page.locator("#wordbox .slot.ok").first().click();
        await page.waitForFunction(() => window.__zz.st?.current === "T05");
        await page.waitForTimeout(200);
        await passCutscene(page);
        await checkCardFit("T05");

        await commit(page, "left");
        await page.waitForFunction(() => window.__zz.st?.phase === "card" && !window.__zz.isTutorialCard?.(window.__zz.st.current));
        await page.waitForTimeout(200);

        for (let i = 0; i < 5; i++) {
          const cid = await page.evaluate(() => window.__zz.st.current);
          await checkCardFit(`Normal card ${cid}`);
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

// ==========================================
// 5. Requirement 5: 拖卡阈值反馈 (Item A)
// ==========================================
for (const [engine] of Object.entries(ENGINES)) {
  for (const vp of [{ w: 390, h: 844 }, { w: 1280, h: 800 }]) {
    const isDesktop = vp.w >= 1024;
    const testTitle = isDesktop
      ? `${engine} ${vp.w}x${vp.h} [regression guard]: drag threshold feedback label, color & fill`
      : `${engine} ${vp.w}x${vp.h}: drag threshold feedback label, color & fill`;

    test(testTitle, async () => {
      const ctx = await browsers[engine].newContext({ viewport: { width: vp.w, height: vp.h } });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);
      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz && window.__zz.st?.current === "T01");

        const cardBox = await page.locator("#card").boundingBox();
        assert.ok(cardBox, "#card 必须有包围盒");
        const cx = cardBox.x + cardBox.width / 2;
        const cy = cardBox.y + cardBox.height / 2;

        await page.mouse.move(cx, cy);
        await page.mouse.down();

        // 拖拽 20% 卡宽 (未达 35% 阈值)
        await page.mouse.move(cx + cardBox.width * 0.20, cy, { steps: 5 });
        await page.waitForFunction(() => {
          const el = document.querySelector("#card-drag-hint");
          return el && !el.hidden && getComputedStyle(el).display !== "none";
        });

        const state20 = await page.evaluate(() => {
          const lbl = document.querySelector("#card-drag-label");
          const bar = document.querySelector("#card-drag-bar");
          const fill = document.querySelector("#card-drag-fill");
          const lblCs = getComputedStyle(lbl);
          const barR = bar.getBoundingClientRect();
          const fillR = fill.getBoundingClientRect();
          return {
            labelText: lbl.textContent.trim(),
            color: lblCs.color,
            isHot: lbl.classList.contains("hot"),
            fillRatio: fillR.width / barR.width,
          };
        });

        assert.equal(state20.labelText, cardById("T01").right.label, "拖拽方向标签文案正确");
        assert.equal(state20.isHot, false, "未达阈值时 hot 为 false");
        assert.equal(state20.color, "rgb(107, 90, 62)", "未达阈值标签颜色为 #6b5a3e");
        assert.ok(
          Math.abs(state20.fillRatio - (20 / 35)) < 0.08,
          `进度填充比例应 ≈ 20/35 (0.571)，实际 ${state20.fillRatio.toFixed(3)}`,
        );

        // 拖拽 40% 卡宽 (超过 35% 阈值)
        await page.mouse.move(cx + cardBox.width * 0.40, cy, { steps: 5 });
        const state40 = await page.evaluate(() => {
          const lbl = document.querySelector("#card-drag-label");
          const bar = document.querySelector("#card-drag-bar");
          const fill = document.querySelector("#card-drag-fill");
          const lblCs = getComputedStyle(lbl);
          const barR = bar.getBoundingClientRect();
          const fillR = fill.getBoundingClientRect();
          return {
            color: lblCs.color,
            isHot: lbl.classList.contains("hot"),
            fillRatio: fillR.width / barR.width,
          };
        });

        assert.equal(state40.isHot, true, "达到阈值时 hot 为 true");
        assert.equal(state40.color, "rgb(122, 47, 47)", "达到阈值标签颜色为 #7a2f2f");
        assert.ok(
          Math.abs(state40.fillRatio - 1.0) < 0.05,
          `达到阈值进度填充比例应为 100%，实际 ${(state40.fillRatio * 100).toFixed(1)}%`,
        );

        // 松手释放
        await page.mouse.up();
        await page.waitForFunction(() => !window.__zz.animating, null, { timeout: 3000 });
        const isHidden = await page.evaluate(() => {
          const el = document.querySelector("#card-drag-hint");
          return !el || el.hidden || getComputedStyle(el).display === "none";
        });
        assert.ok(isHidden, "释放后 #card-drag-hint 必须隐藏");

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}

// ==========================================
// 6. Requirement 6: 飞出防重点击保护 (Item C)
// ==========================================
for (const [engine] of Object.entries(ENGINES)) {
  for (const vp of [{ w: 390, h: 844 }, { w: 1280, h: 800 }]) {
    const isDesktop = vp.w >= 1024;
    const testTitle = isDesktop
      ? `${engine} ${vp.w}x${vp.h} [regression guard]: fly-out guard ignores rapid double option click`
      : `${engine} ${vp.w}x${vp.h}: fly-out guard ignores rapid double option click / tap`;

    test(testTitle, async () => {
      const ctx = await browsers[engine].newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: !isDesktop });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);
      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz && window.__zz.st?.current === "T01");

        const initialLogLen = await page.evaluate(() => window.__zz.st.log.length);

        if (!isDesktop) {
          // 移动端：快速 tap #opt-left 并在 ~30ms 后 tap #opt-right
          await page.locator("#opt-left").tap();
          await page.waitForTimeout(30);
          await page.locator("#opt-right").tap();
        } else {
          // 桌面端：快速 click #opt-left 并在 ~30ms 后 click #opt-right
          await page.locator("#opt-left").click();
          await page.waitForTimeout(30);
          await page.locator("#opt-right").click();
        }

        await page.waitForFunction(() => !window.__zz.animating && window.__zz.st.current === "T02", null, { timeout: 5000 });
        await page.waitForTimeout(300);

        const curId = await page.evaluate(() => window.__zz.st.current);
        const curLogLen = await page.evaluate(() => window.__zz.st.log.length);
        assert.equal(curId, "T02", "飞出防重只提交一次，当前卡片应为 T02");
        assert.equal(curLogLen, initialLogLen + 1, `日志记录数应仅增加 1 条，实际为 ${curLogLen - initialLogLen}`);

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}

// ==========================================
// 7. Requirement 7: 移动端与平板竖屏 Toast 避让 (Item B & R1)
// ==========================================
const TOAST_VIEWPORTS = [
  { name: "375x667", width: 375, height: 667 },
  { name: "360x800", width: 360, height: 800 },
  { name: "390x844", width: 390, height: 844 },
  { name: "393x852", width: 393, height: 852 },
  { name: "412x915", width: 412, height: 915 },
  { name: "430x932", width: 430, height: 932 },
  { name: "390x664", width: 390, height: 664 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "820x1180", width: 820, height: 1180 },
];

for (const [engine] of Object.entries(ENGINES)) {
  for (const vp of TOAST_VIEWPORTS) {
    test(`${engine} ${vp.name}: toast avoidance does not intersect options, coach, wordbox, dims`, async () => {
      const ctx = await browsers[engine].newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);
      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz && window.__zz.st?.current === "T01");
        await commit(page, "left"); // T02
        await commit(page, "right"); // T03 (engrave)
        await page.waitForFunction(() => window.__zz.st?.phase === "engrave");

        // 触发 T03 锁定 toast (拖动锁定的 T03 卡)
        await page.evaluate(() => {
          const card = document.querySelector("#card");
          card.dispatchEvent(new PointerEvent("pointerdown", { clientX: 200, clientY: 300, bubbles: true }));
        });
        await page.waitForSelector("#toast.on", { timeout: 3000 });

        const checkToast = await page.evaluate(() => {
          const toast = document.querySelector("#toast");
          const optL = document.querySelector("#opt-left");
          const optR = document.querySelector("#opt-right");
          const coach = document.querySelector("#coach");
          const menubtn = document.querySelector("#menubtn");
          const wordbox = document.querySelector("#wordbox-bar");
          const dims = document.querySelector("#dims");
          const dimsD = document.querySelector("#dims-desktop");
          const topbar = document.querySelector("#topbar");
          const bc = document.querySelector("#bonecorner");
          const skipBtn = document.querySelector("#card-drops button.act[data-do=skip]");

          const tr = toast.getBoundingClientRect();
          const vw = window.innerWidth, vh = window.innerHeight;

          const inter = (a, b) => {
            if (!b || b.width <= 0 || b.height <= 0) return false;
            return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 &&
                   Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
          };

          const avoids = [
            { name: "#opt-left", el: optL },
            { name: "#opt-right", el: optR },
            { name: "#bonecorner", el: bc },
            { name: "skip button", el: skipBtn },
            { name: "#coach", el: coach },
            { name: "#menubtn", el: menubtn },
            { name: "#topbar", el: topbar },
            { name: "#wordbox-bar", el: wordbox },
            { name: "#dims", el: dims },
            { name: "#dims-desktop", el: dimsD },
          ];

          // Any other button or link inside #card
          const cardInteractive = Array.from(document.querySelectorAll("#card button, #card a, #card-drops .act, #card-drops .chiplink"));
          for (const ci of cardInteractive) {
            if (ci !== bc && ci !== skipBtn) avoids.push({ name: "card-" + (ci.id || ci.className || ci.innerText), el: ci });
          }

          const conflicts = [];
          for (const a of avoids) {
            if (!a.el || a.el.hidden || getComputedStyle(a.el).display === "none") continue;
            const r = a.el.getBoundingClientRect();
            if (inter(tr, r)) conflicts.push(a.name);
          }

          return {
            inViewport: tr.left >= -0.5 && tr.right <= vw + 0.5 && tr.top >= -0.5 && tr.bottom <= vh + 0.5,
            conflicts,
          };
        });

        assert.ok(checkToast.inViewport, "Toast 应完全在视口内");
        assert.deepEqual(checkToast.conflicts, [], "Toast 不得与避让控件重叠: " + checkToast.conflicts.join(", "));

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}

// ==========================================
// 8. Requirement 8 & 10: 侧栏自适应 (Item F & R2) + 1280x720 先不刻 (Item E) + 桌面拖拽重叠 (Item D)
// ==========================================
for (const [engine] of Object.entries(ENGINES)) {
  // 8a. 1024x768 侧栏展开与自适应收缩
  test(`${engine} 1024x768 [regression guard]: sidebar open option shrink (R2 authoritative)`, async () => {
    const ctx = await browsers[engine].newContext({ viewport: { width: 1024, height: 768 } });
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz && window.__zz.st?.current === "T01");

      // 打开侧栏
      await page.evaluate(() => document.querySelector("#sidebar").classList.remove("collapsed"));
      await page.waitForTimeout(200);

      const m = await page.evaluate(() => {
        const l = document.querySelector("#opt-left").getBoundingClientRect();
        const r = document.querySelector("#opt-right").getBoundingClientRect();
        const c = document.querySelector("#card").getBoundingClientRect();
        const s = document.querySelector("#sidebar").getBoundingClientRect();

        const hit5x3 = (el) => {
          const rect = el.getBoundingClientRect();
          for (let xi = 0; xi < 5; xi++) {
            for (let yi = 0; yi < 3; yi++) {
              const px = rect.left + (rect.width * (xi + 0.5)) / 5;
              const py = rect.top + (rect.height * (yi + 0.5)) / 3;
              const top = document.elementFromPoint(px, py);
              if (!top || (top !== el && !el.contains(top))) return false;
            }
          }
          return true;
        };

        return {
          left: { x: l.x, width: l.width, right: l.right, hit: hit5x3(document.querySelector("#opt-left")) },
          card: { x: c.x, width: c.width, right: c.right },
          right: { x: r.x, width: r.width, right: r.right, hit: hit5x3(document.querySelector("#opt-right")) },
          sidebar: { x: s.x, width: s.width },
        };
      });

      // 验证 DESIGNER RULE R2
      assert.ok(m.left.hit, "#opt-left 5x3 采样点必须命中自身");
      assert.ok(m.right.hit, "#opt-right 5x3 采样点必须命中自身");
      assert.ok(Math.abs(m.left.width - 145) <= 2, `左选项宽度应 ≈ 145px，实际 ${m.left.width.toFixed(1)}`);
      assert.ok(Math.abs(m.right.width - 145) <= 2, `右选项宽度应 ≈ 145px，实际 ${m.right.width.toFixed(1)}`);
      assert.ok(Math.abs(m.left.x - 16) <= 2, `左选项起始 x 应 ≈ 16，实际 ${m.left.x.toFixed(1)}`);
      assert.ok(Math.abs(m.left.right - 161) <= 2, `左选项右边 x 应 ≈ 161，实际 ${m.left.right.toFixed(1)}`);
      assert.ok(Math.abs(m.right.x - 527) <= 2, `右选项起始 x 应 ≈ 527，实际 ${m.right.x.toFixed(1)}`);
      assert.ok(Math.abs(m.right.right - 672) <= 2, `右选项右边 x 应 ≈ 672，实际 ${m.right.right.toFixed(1)}`);
      assert.ok(m.sidebar.x >= 686, `侧栏起始 x 应 ≥ 686，实际 ${m.sidebar.x.toFixed(1)}`);
      assert.ok(m.right.right < m.sidebar.x, "右选项不得伸入侧栏下方");

      // 收起侧栏还原
      await page.evaluate(() => document.querySelector("#sidebar").classList.add("collapsed"));
      await page.waitForTimeout(200);
      const restoredW = await page.evaluate(() => document.querySelector("#opt-left").getBoundingClientRect().width);
      assert.equal(Math.round(restoredW), 192, "收起侧栏后选项宽度还原为 192px");

      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });

  // 8b. 1280x720 先不刻 (Item E) 5x3 点全部可命中
  test(`${engine} 1280x720 [regression guard]: skip engrave button not covered`, async () => {
    const ctx = await browsers[engine].newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz && window.__zz.st?.current === "T01");
      await commit(page, "left"); // T02
      await commit(page, "right"); // T03 (engrave)
      await page.waitForFunction(() => window.__zz.st?.phase === "engrave");

      const skipHits = await page.evaluate(() => {
        const btn = document.querySelector("#card-drops button.act[data-do=skip]");
        if (!btn) return { exists: false };
        const r = btn.getBoundingClientRect();
        const hits = [];
        for (let xi = 0; xi < 5; xi++) {
          for (let yi = 0; yi < 3; yi++) {
            const px = r.left + (r.width * (xi + 0.5)) / 5;
            const py = r.top + (r.height * (yi + 0.5)) / 3;
            const top = document.elementFromPoint(px, py);
            hits.push(top === btn || btn.contains(top));
          }
        }
        return { exists: true, allHit: hits.every(Boolean), count: hits.length };
      });

      assert.ok(skipHits.exists, "先不刻按钮必须存在");
      assert.ok(skipHits.allHit, "1280x720 先不刻按钮 5x3 采样点必须全部命中自身（未被 #stage 遮挡）");

      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });

  // 8c. 桌面拖拽重叠 (Item D): 1280x720, 1440x900, 1920x1080 拖动 25% 不盖住选项
  for (const vp of [{ w: 1280, h: 720 }, { w: 1440, h: 900 }, { w: 1920, h: 1080 }]) {
    test(`${engine} ${vp.w}x${vp.h} [regression guard]: drag card 25% does not cover option buttons`, async () => {
      const ctx = await browsers[engine].newContext({ viewport: { width: vp.w, height: vp.h } });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);
      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz && window.__zz.st?.phase === "card");

        const cardBox = await page.locator("#card").boundingBox();
        const cx = cardBox.x + cardBox.width / 2;
        const cy = cardBox.y + cardBox.height / 2;
        const dragDist = cardBox.width * 0.25;

        // 向右拖 25% -> 采样 #opt-right
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
          return hits.every(Boolean);
        });
        assert.ok(rightHits, "向右拖拽 25% 时 #opt-right 不得被卡片遮挡");

        await page.mouse.up();
        await page.waitForFunction(() => !window.__zz.animating, null, { timeout: 3000 });

        // 向左拖 25% -> 采样 #opt-left
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
          return hits.every(Boolean);
        });
        assert.ok(leftHits, "向左拖拽 25% 时 #opt-left 不得被卡片遮挡");

        await page.mouse.up();
        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}

// ==========================================
// 9. Requirement 9: 太小提示 #too-short 规则 (DESIGNER RULE R3)
// ==========================================
for (const [engine] of Object.entries(ENGINES)) {
  for (const vp of OUT_OF_SCOPE_VIEWPORTS) {
    test(`${engine} ${vp.name}: too-short hint visible, exact text, no crash & does not cover #menubtn`, async () => {
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

        // 在视口内且 pointer-events: none
        const box = await ts.boundingBox();
        assert.ok(box.x >= 0 && box.x + box.width <= vp.width + 1, "提示水平方向在视口内");
        assert.ok(box.y >= 0 && box.y + box.height <= vp.height + 1, "提示垂直方向在视口内");

        const pe = await page.evaluate(() => {
          const cs = getComputedStyle(document.querySelector("#too-short"));
          return {
            pointerEvents: cs.pointerEvents,
            fontSize: cs.fontSize,
            lineHeight: cs.lineHeight,
            paddingTop: cs.paddingTop,
            paddingBottom: cs.paddingBottom,
            paddingLeft: cs.paddingLeft,
            paddingRight: cs.paddingRight,
          };
        });
        assert.equal(pe.pointerEvents, "none", "提示 pointer-events 必须为 none");
        assert.equal(pe.fontSize, "15px", "提示 font-size 应为 15px");
        assert.equal(pe.lineHeight, "22px", "提示 line-height 应为 22px");
        assert.equal(pe.paddingTop, "6px", "提示 paddingTop 应为 6px");
        assert.equal(pe.paddingBottom, "6px", "提示 paddingBottom 应为 6px");
        assert.equal(pe.paddingLeft, "14px", "提示 paddingLeft 应为 14px");
        assert.equal(pe.paddingRight, "14px", "提示 paddingRight 应为 14px");

        // 5x3 elementFromPoint 采样 #menubtn 必须全部命中菜单按钮
        const mbHits = await page.evaluate(() => {
          const mb = document.querySelector("#menubtn");
          if (!mb) return false;
          const r = mb.getBoundingClientRect();
          for (let xi = 0; xi < 5; xi++) {
            for (let yi = 0; yi < 3; yi++) {
              const px = r.left + (r.width * (xi + 0.5)) / 5;
              const py = r.top + (r.height * (yi + 0.5)) / 3;
              const top = document.elementFromPoint(px, py);
              if (!top || (top !== mb && !mb.contains(top))) return false;
            }
          }
          return true;
        });
        assert.ok(mbHits, "提示不得覆盖 #menubtn，菜单按钮采样点必须命中自身");

        assert.deepEqual(errs, [], "超纲尺寸加载不应有控制台/页面错误：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }

  for (const vp of ALL_17_IN_SCOPE) {
    const isDesktop = vp.width >= 1024 || vp.view === "desktop";
    const testTitle = isDesktop
      ? `${engine} ${vp.name} [regression guard]: too-short hint hidden on in-scope viewport`
      : `${engine} ${vp.name}: too-short hint hidden on in-scope viewport`;

    test(testTitle, async () => {
      const ctx = await browsers[engine].newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);
      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz);
        const ts = page.locator("#too-short");
        assert.equal(await ts.isHidden(), true, `${vp.name} 为在纲尺寸，#too-short 必须隐藏`);
        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}
