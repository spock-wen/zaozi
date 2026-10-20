// e2e 矮屏分档（design/v3_mobile/BREAKPOINTS.md §矮屏（高度 ≤ 760））。
// 只适用于宽 ≥1024 的桌面档；按视口高（innerHeight）分：N >760 · A 601–760 · B ≤600 · 视口高 <600 出提示。
// 数值全部对照 BREAKPOINTS §矮屏 表与 `short_screen_720.png` / `short_screen_600.png` 示意页。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";
import { commit, toPickDesktop } from "./helpers/flow.mjs";

buildDist();

let server, browsers = {};
before(async () => {
  server = await startServer();
  for (const [name, type] of Object.entries(ENGINES)) browsers[name] = await type.launch();
});
after(async () => {
  for (const b of Object.values(browsers)) await b.close();
  server?.close();
});

async function open(engine, { width, height }, { touch = false } = {}) {
  const opts = { viewport: { width, height } };
  if (touch) { opts.hasTouch = true; if (engine !== "firefox") opts.isMobile = true; }  // Firefox 不支持 isMobile
  const ctx = await browsers[engine].newContext(opts);
  const page = await ctx.newPage();
  const errs = [];
  collectErrors(page, errs);
  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__zz);
  return { ctx, page, errs };
}

const box = (page) =>
  page.evaluate(() => {
    const R = (s) => {
      const e = document.querySelector(s);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, bottom: r.bottom, right: r.right };
    };
    const disp = (s) => getComputedStyle(document.querySelector(s)).display;
    return {
      view: document.body.dataset.view,
      short: document.body.dataset.short || "",
      vh: innerHeight, vw: innerWidth,
      card: R("#card"), wb: R("#wordbox-bar"), keys: R("#keys"),
      hintDisplay: disp("#gesture-hint"),
      keysText: document.querySelector("#keys").textContent.trim(),
      keysDisplay: disp("#keys"),
      scroll: document.documentElement.scrollHeight - innerHeight,
    };
  });

const clamp = (lo, v, hi) => Math.min(hi, Math.max(lo, v));
function intersect(a, b) {
  const ix = Math.min(a.right, b.right) - Math.max(a.x, b.x);
  const iy = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
  return ix > 0 && iy > 0;
}

// ---------- 1. 矮 A 档（601–760）：卡高 clamp(380,vh−188,468)、键位行一行 28、字匣 60 ----------
const A_VPS = [{ w: 1280, h: 720 }, { w: 1280, h: 633 }];
for (const engine of Object.keys(ENGINES)) {
  for (const vp of A_VPS) {
    test(`${engine} A 档 ${vp.w}×${vp.h}: 卡高/键位行/字匣 60/不显手势行`, async () => {
      const { ctx, page, errs } = await open(engine, { width: vp.w, height: vp.h });
      try {
        const g = await box(page);
        assert.equal(g.view, "desktop");
        assert.equal(g.short, "A", "601–760 应落 A 档");

        const expH = clamp(380, g.vh - 188, 468);
        assert.ok(Math.abs(g.card.h - expH) <= 1, `卡高应 ≈${expH}，实际 ${g.card.h}`);
        assert.ok(Math.abs(g.card.w - g.card.h * 0.7) <= 4, `卡宽应 ≈卡高×0.7，实际 ${g.card.w}`);

        assert.equal(Math.round(g.wb.h), 60, "字匣应为 60（格 48 + 上下内边距 12）");
        assert.ok(g.wb.bottom <= g.vh + 1, "字匣应在视口内");
        assert.ok(Math.abs((g.wb.x + g.wb.w / 2) - (g.card.x + g.card.w / 2)) <= 1, "字匣应水平居中在卡下");

        assert.notEqual(g.keysDisplay, "none", "A 档应显示键位行");
        assert.equal(Math.round(g.keys.h), 28, "A 档键位行应为一行 28");
        assert.equal(g.keysText, "←→选 1–3落字 Space分量", "A 档键位行文案");
        assert.ok(g.keys.bottom <= g.vh + 1, "键位行应在视口内");
        assert.ok(!intersect(g.card, g.wb) && !intersect(g.wb, g.keys) && !intersect(g.card, g.keys), "卡/字匣/键位行互不交叠");

        assert.equal(g.hintDisplay, "none", "矮屏不显旧手势行（设计稿卡下只有卡→字匣→键位）");
        assert.ok(g.scroll <= 1, `矮屏不应滚动，溢出 ${g.scroll}`);

        // 刻字阶段（T03）：键位行展示刻字文案（R12/D1：刻字阶段去除选卡键，文案为「K 刻字 · S 先不刻 · 卡已定住」），几何依然满足一行 28、在屏内、卡/字匣/键位互不交叠
        await commit(page, "left");   // T01 → T02
        await commit(page, "right");  // T02 → T03
        const gEngrave = await box(page);
        assert.notEqual(gEngrave.keysDisplay, "none", "刻字阶段 A 档应显示键位行");
        assert.equal(Math.round(gEngrave.keys.h), 28, "刻字阶段 A 档键位行应为一行 28");
        // R12/D1: 刻字阶段无左右选字与落字键，显示定住与 K/S
        assert.equal(gEngrave.keysText, "K 刻字 · S 先不刻 · 卡已定住", "刻字阶段 A 档键位行文案");
        assert.ok(gEngrave.keys.bottom <= gEngrave.vh + 1, "刻字阶段键位行应在视口内");
        assert.ok(
          !intersect(gEngrave.card, gEngrave.wb) &&
          !intersect(gEngrave.wb, gEngrave.keys) &&
          !intersect(gEngrave.card, gEngrave.keys),
          "刻字阶段卡/字匣/键位行互不交叠",
        );
        assert.ok(gEngrave.scroll <= 1, `刻字阶段矮屏不应滚动，溢出 ${gEngrave.scroll}`);

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}

// ---------- 2. 很矮 B 档（≤600）：卡高 clamp(320,vh−172,428)、字匣 56、键位收进顶栏「?」（首进自动弹一次） ----------
const B_VPS = [{ w: 1024, h: 600 }, { w: 1024, h: 513 }];
for (const engine of Object.keys(ENGINES)) {
  for (const vp of B_VPS) {
    test(`${engine} B 档 ${vp.w}×${vp.h}: 卡高/字匣 56/键位收进「?」（自动弹一次）`, async () => {
      const { ctx, page, errs } = await open(engine, { width: vp.w, height: vp.h });
      try {
        const g = await box(page);
        assert.equal(g.view, "desktop");
        assert.equal(g.short, "B", "≤600 应落 B 档");

        const expH = clamp(320, g.vh - 172, 428);
        assert.ok(Math.abs(g.card.h - expH) <= 1, `卡高应 ≈${expH}，实际 ${g.card.h}`);
        assert.equal(Math.round(g.wb.h), 56, "字匣应为 56（格 48 + 上下内边距 8）");
        assert.ok(g.wb.bottom <= g.vh + 1, "字匣应在视口内");
        assert.ok(!intersect(g.card, g.wb), "卡与字匣不交叠");
        assert.equal(g.keysDisplay, "none", "B 档不显示键位行");
        assert.equal(g.hintDisplay, "none", "矮屏不显旧手势行");
        assert.ok(g.scroll <= 1, `矮屏不应滚动，溢出 ${g.scroll}`);

        // 顶栏「?」：44×44，点击区在屏内
        const btn = await page.locator("#keyhelp-btn");
        assert.ok(await btn.isVisible(), "B 档应显示顶栏「?」按钮");
        const b = await btn.boundingBox();
        assert.ok(b.width >= 44 && b.height >= 44, `「?」点击区应 ≥44×44，实际 ${b.width}×${b.height}`);
        assert.ok(b.y >= 0 && b.y + b.height <= g.vh + 1, "「?」按钮应在视口内");

        // 每个存档首次进入自动弹一次：本次 context 是空的 → 进来就该开着
        const pop = page.locator("#keyhelp-pop");
        assert.ok(await pop.isVisible(), "首次进入应自动弹出键位浮层");
        const pb = await pop.boundingBox();
        assert.ok(pb.y >= 0 && pb.y + pb.height <= g.vh + 1, "键位浮层应在视口内");
        const rows = await pop.locator(".kh-row").count();
        assert.equal(rows, 4, `普通阶段浮层应列出 4 条键位，实际 ${rows} 行`);

        // 同一存档再进入不再自动弹（只弹一次）
        await page.reload({ waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz);
        assert.ok(!(await pop.isVisible()), "同一存档再次进入不应自动弹（只弹一次）");

        // 点「?」手动开，点外面关
        await page.locator("#keyhelp-btn").click();
        assert.ok(await pop.isVisible(), "点「?」应打开键位浮层");
        await page.mouse.click(10, g.vh / 2);
        assert.ok(!(await pop.isVisible()), "点浮层外应收起");

        // 刻字阶段（T03）：展示全部 6 条键位，几何依然满足浮层在视口内、卡与字匣不交叠、不滚动
        await commit(page, "left");   // T01 → T02
        await commit(page, "right");  // T02 → T03
        if (await pop.isHidden()) {
          await btn.click();
        }
        await pop.waitFor({ state: "visible" });
        const pbEngrave = await pop.boundingBox();
        assert.ok(pbEngrave.y >= 0 && pbEngrave.y + pbEngrave.height <= g.vh + 1, "刻字阶段键位浮层应在视口内");
        const rowsEngrave = await pop.locator(".kh-row").count();
        // R12/D1: 刻字阶段浮层去除选卡键位，只含 K/S/Esc 3 行
        assert.equal(rowsEngrave, 3, `刻字阶段浮层应列出全部 3 条键位，实际 ${rowsEngrave} 行`);
        const gEngrave = await box(page);
        assert.ok(!intersect(gEngrave.card, gEngrave.wb), "刻字阶段卡与字匣不交叠");
        assert.equal(gEngrave.keysDisplay, "none", "B 档刻字阶段不显示键位行");
        assert.ok(gEngrave.scroll <= 1, `刻字阶段矮屏不应滚动，溢出 ${gEngrave.scroll}`);

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}

// ---------- 3. 视口高 <600：顶栏下出「窗口太小…」提示，侧栏强制收起（600 不出） ----------
for (const engine of Object.keys(ENGINES)) {
  test(`${engine} 视口高 599: 出「窗口太小」提示 + 侧栏强制收起（600 不出）`, async () => {
    const short = await open(engine, { width: 1024, height: 599 });
    try {
      const s = await short.page.evaluate(() => {
        const el = document.querySelector("#too-short");
        const r = el.getBoundingClientRect();
        return {
          hidden: el.hidden, text: el.textContent.trim(),
          y: r.y, bottom: r.bottom, vh: innerHeight,
          cardH: document.querySelector("#card").getBoundingClientRect().height,
          sideCollapsed: document.body.classList.contains("side-collapsed"),
        };
      });
      assert.equal(s.hidden, false, "视口高 <600 应显示「窗口太小」提示");
      assert.equal(s.text, "窗口太小，放大窗口更好玩", `提示文案应精确为「窗口太小，放大窗口更好玩」，实际：${s.text}`);
      assert.ok(s.y >= 0 && s.bottom <= s.vh + 1, "提示应在视口内");
      assert.equal(Math.round(s.cardH), 427, "视口高 599 卡高 clamp(320, 599-172, 428) 为 427");
      assert.equal(s.sideCollapsed, true, "视口高 599 侧栏强制收起");
      assert.deepEqual(short.errs, [], "页面不应有报错：" + short.errs.join(" | "));
    } finally {
      await short.ctx.close();
    }

    const just = await open(engine, { width: 1024, height: 600 });
    try {
      assert.equal(await just.page.locator("#too-short").isHidden(), true, "视口高 600 不应出提示（<600 才出）");
      assert.deepEqual(just.errs, [], "页面不应有报错：" + just.errs.join(" | "));
    } finally {
      await just.ctx.close();
    }
  });

  test(`${engine} 视口宽 359: 出「窗口太小」提示（360 不出）`, async () => {
    const narrow = await open(engine, { width: 359, height: 700 });
    try {
      const s = await narrow.page.evaluate(() => {
        const el = document.querySelector("#too-short");
        const r = el.getBoundingClientRect();
        return {
          hidden: el.hidden, text: el.textContent.trim(),
          y: r.y, bottom: r.bottom, vh: innerHeight,
        };
      });
      assert.equal(s.hidden, false, "视口宽 <360 应显示「窗口太小」提示");
      assert.equal(s.text, "窗口太小，放大窗口更好玩", `提示文案应精确为「窗口太小，放大窗口更好玩」，实际：${s.text}`);
      assert.ok(s.y >= 0 && s.bottom <= s.vh + 1, "提示应在视口内");
      assert.deepEqual(narrow.errs, [], "页面不应有报错：" + narrow.errs.join(" | "));
    } finally {
      await narrow.ctx.close();
    }

    const just = await open(engine, { width: 360, height: 700 });
    try {
      assert.equal(await just.page.locator("#too-short").isHidden(), true, "视口宽 360 不应出提示（<360 才出）");
      assert.deepEqual(just.errs, [], "页面不应有报错：" + just.errs.join(" | "));
    } finally {
      await just.ctx.close();
    }
  });
}

// ---------- 4. 教学气泡不得盖住目标：不压卡/不压字匣/不压落字框/不压卡角刻，目标可点、可按 1 落字 ----------
const COACH_VPS = [{ w: 1024, h: 600 }, { w: 1280, h: 720 }];
for (const engine of Object.keys(ENGINES)) {
  for (const vp of COACH_VPS) {
    test(`${engine} 教学气泡 ${vp.w}×${vp.h}: 不盖目标 + 第 4 张字匣可点/按 1 落字`, async () => {
      const { ctx, page, errs } = await open(engine, { width: vp.w, height: vp.h });
      try {
        const snap = () =>
          page.evaluate(() => {
            const R = (s) => {
              const e = document.querySelector(s);
              if (!e) return null;
              const r = e.getBoundingClientRect();
              return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
            };
            const coach = R("#coachcol");
            const hit = (s) => {
              const e = document.querySelector(s);
              if (!e) return null;
              const r = e.getBoundingClientRect();
              const safePt = (r) => { const L = Math.max(r.left, 0) + 1, R = Math.min(r.right, innerWidth) - 1, T = Math.max(r.top, 0) + 1, B = Math.min(r.bottom, innerHeight) - 1; return R > L && B > T ? [(L + R) / 2, (T + B) / 2] : null; };
              const p = safePt(r);
              const t = p ? document.elementFromPoint(p[0], p[1]) : null;
              return t ? (t.closest(s.split(" ").pop()) ? "self" : t.id || t.className) : "none";
            };
            return {
              short: document.body.dataset.short,
              coach, card: R("#card"), wb: R("#wordbox-bar"), drops: R("#card-drops"),
              slot: R("#wordbox .slot.ok"), bone: R("#bonecorner"),
              optL: R("#opt-left"), optR: R("#opt-right"),
              coachH: document.querySelector("#coach").getBoundingClientRect().height,
              vh: innerHeight, vw: innerWidth,
              pe: getComputedStyle(document.querySelector("#coachcol")).pointerEvents,
              slotHit: hit("#wordbox .slot.ok"), boneHit: hit("#bonecorner"),
              phase: window.__zz.st.phase, current: window.__zz.st.current,
            };
          });
        const noOverlap = (g, key, label) => {
          const a = g.coach, b = g[key];
          if (!a || !b) return;
          assert.ok(!intersect(a, b), `气泡与${label}不得交叠：coach=${JSON.stringify(a)} ${key}=${JSON.stringify(b)}`);
        };

        // T01/T02：气泡在卡外空沟，不压卡、不压左右选项
        for (const stepIdx of [0, 1]) {
          if (stepIdx === 1) await commit(page, "left");   // T01 → T02
          const g = await snap();
          assert.ok(g.coach, "教学气泡应有包围盒");
          assert.ok(g.coach.y >= 0 && g.coach.bottom <= g.vh + 1, "气泡应在视口内");
          assert.equal(g.pe, "none", "气泡应 pointer-events:none（纯提示不挡点击）");
          noOverlap(g, "card", "卡本体");
          noOverlap(g, "optL", "左选项");
          noOverlap(g, "optR", "右选项");
        }
        await commit(page, "right");                       // T02 → T03（刻）
        const t3 = await snap();
        assert.equal(t3.phase, "engrave");
        noOverlap(t3, "bone", "卡角「刻」");
        assert.equal(t3.boneHit, "self", `卡角「刻」应可点到，实际命中：${t3.boneHit}`);

        await page.locator("#bonecorner").click();          // 刻 → T04
        await page.waitForTimeout(300);
        const t4 = await snap();
        assert.equal(t4.current, "T04");
        noOverlap(t4, "card", "卡本体");
        noOverlap(t4, "wb", "字匣");
        noOverlap(t4, "drops", "卡上落字框");
        noOverlap(t4, "slot", "字匣格");
        assert.equal(t4.slotHit, "self", `第 4 张字匣格应可点到，实际命中：${t4.slotHit}`);
        assert.ok(t4.drops.y >= 0 && t4.drops.bottom <= t4.vh + 1, "落字框应在屏内");

        await page.keyboard.press("1");                     // 按 1 落字
        await page.waitForTimeout(300);
        assert.equal(await page.evaluate(() => window.__zz.st.current), "T05", "按 1 应落字进入 T05");
        assert.equal(await page.evaluate(() => window.__zz.st.phase), "card");

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}

// ---------- 5. 挑字页固定 7×2、不滚动（A 1280×720 · B 1024×600 · N 1366×768） ----------
// BREAKPOINTS §矮屏「挑字页」：14 字 7 列 × 2 行，三档都不滚动（示意页 mock 逐档核过）。
const PICK_VPS = [{ w: 1280, h: 720 }, { w: 1024, h: 600 }, { w: 1366, h: 768 }];
for (const engine of Object.keys(ENGINES)) {
  for (const vp of PICK_VPS) {
    test(`${engine} 挑字 ${vp.w}×${vp.h}: 7 列 × 2 行 14 字，页面与 #pick 均不滚动`, async () => {
      const { ctx, page, errs } = await open(engine, { width: vp.w, height: vp.h });
      try {
        await toPickDesktop(page);
        const g = await page.evaluate(() => {
          const el = document.querySelector("#pick");
          const cands = [...el.querySelectorAll(".cand")].map((c) => c.getBoundingClientRect());
          const cols = new Set(cands.map((r) => Math.round(r.x))).size;
          const rows = new Set(cands.map((r) => Math.round(r.y))).size;
          const tracks = getComputedStyle(el.querySelector(".pool")).gridTemplateColumns.split(" ").filter(Boolean).length;
          const se = document.scrollingElement;
          return {
            count: cands.length, cols, rows, tracks,
            pickScroll: { h: el.scrollHeight - el.clientHeight, w: el.scrollWidth - el.clientWidth },
            docScroll: { h: se.scrollHeight - se.clientHeight, w: se.scrollWidth - se.clientWidth },
          };
        });
        assert.equal(g.count, 14, "字池应为 14 字");
        assert.equal(g.tracks, 7, "字池应为 7 列网格");
        assert.equal(g.cols, 7, "候选应排成 7 列");
        assert.equal(g.rows, 2, "候选应排成 2 行");
        assert.ok(g.pickScroll.h <= 0 && g.pickScroll.w <= 0, `#pick 不应滚动，实际 ${JSON.stringify(g.pickScroll)}`);
        assert.ok(g.docScroll.h <= 0 && g.docScroll.w <= 0, `页面不应滚动，实际 ${JSON.stringify(g.docScroll)}`);
        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}

// ---------- 6. 跳档不加过渡：切档瞬间过渡被禁用，同档 resize 不动 ----------
// BREAKPOINTS §矮屏「跳档直接换尺寸、不加过渡（避免拖动中抖）」：切档时 body 挂 no-anim，
// 期间 #card 等 transition 为 none；同档 resize 不挂。切完恢复原过渡。
for (const engine of Object.keys(ENGINES)) {
  test(`${engine} 跳档禁用过渡：N→A 切档瞬间 #card transition=none，同档 resize 不触发，之后恢复`, async () => {
    const { ctx, page, errs } = await open(engine, { width: 1280, height: 800 });
    try {
      assert.equal(await page.evaluate(() => document.body.dataset.short || ""), "", "1280×800 应为常规 N 档");
      // 记录每次 body 出现 no-anim 时的 #card 过渡状态
      await page.evaluate(() => {
        window.__tier = { events: [] };
        new MutationObserver(() => {
          if (!document.body.classList.contains("no-anim")) return;
          const cs = getComputedStyle(document.querySelector("#card"));
          window.__tier.events.push({ dur: cs.transitionDuration, prop: cs.transitionProperty });
        }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
      });

      // 同档 resize（800 → 780，都 N）：不应挂 no-anim
      await page.setViewportSize({ width: 1280, height: 780 });
      await page.waitForTimeout(320);
      assert.equal(await page.evaluate(() => window.__tier.events.length), 0, "同档 resize 不应挂 no-anim");

      // 切档 resize（N → A）
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.waitForFunction(() => document.body.dataset.short === "A", null, { timeout: 5000 });
      await page.waitForTimeout(120);
      const ev = await page.evaluate(() => window.__tier.events);
      assert.ok(ev.length >= 1, "切档时应临时给 body 挂 no-anim");
      assert.ok(ev.every((e) => e.prop === "none"), `切档期间 transition-property 应为 none，实际 ${JSON.stringify(ev)}`);
      assert.ok(ev.every((e) => !/0\.16|0\.12|0\.4|120ms/.test(e.dur)), `切档期间过渡应被禁用，实际 ${JSON.stringify(ev)}`);

      // 收尾后 #card 过渡恢复原样（transform/opacity 各 0.16s）
      const after = await page.evaluate(() => {
        const cs = getComputedStyle(document.querySelector("#card"));
        return { prop: cs.transitionProperty, dur: cs.transitionDuration };
      });
      assert.ok(after.prop.includes("transform") && after.prop.includes("opacity"), `跳档后过渡应恢复，实际 ${JSON.stringify(after)}`);
      assert.ok(after.dur.includes("0.16s"), `跳档后过渡时长应恢复 0.16s，实际 ${after.dur}`);

      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });
}
