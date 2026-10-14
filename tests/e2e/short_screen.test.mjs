// e2e 矮屏分档（design/v3_mobile/BREAKPOINTS.md §矮屏（高度 ≤ 760））。
// 只适用于宽 ≥1024 的桌面档；按视口高（innerHeight）分：N >760 · A 601–760 · B ≤600 · 视口高 <492 出提示。
// 数值全部对照 BREAKPOINTS §矮屏 表与 `short_screen_720.png` / `short_screen_600.png` 示意页。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";
import { commit } from "./helpers/flow.mjs";

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
        assert.equal(g.keysText, "←→选 1–3落字 Space分量 K/Enter刻", "A 档键位行文案");
        assert.ok(g.keys.bottom <= g.vh + 1, "键位行应在视口内");
        assert.ok(!intersect(g.card, g.wb) && !intersect(g.wb, g.keys) && !intersect(g.card, g.keys), "卡/字匣/键位行互不交叠");

        assert.equal(g.hintDisplay, "none", "矮屏不显旧手势行（设计稿卡下只有卡→字匣→键位）");
        assert.ok(g.scroll <= 1, `矮屏不应滚动，溢出 ${g.scroll}`);

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
        assert.ok(rows >= 5, `浮层应列出全部键位，实际 ${rows} 行`);

        // 同一存档再进入不再自动弹（只弹一次）
        await page.reload({ waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz);
        assert.ok(!(await pop.isVisible()), "同一存档再次进入不应自动弹（只弹一次）");

        // 点「?」手动开，点外面关
        await page.locator("#keyhelp-btn").click();
        assert.ok(await pop.isVisible(), "点「?」应打开键位浮层");
        await page.mouse.click(10, g.vh / 2);
        assert.ok(!(await pop.isVisible()), "点浮层外应收起");

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}

// ---------- 3. 视口高 <492：卡到 320 下限不再缩，顶栏下出「窗口太矮…」提示，侧栏强制收起 ----------
for (const engine of Object.keys(ENGINES)) {
  test(`${engine} 视口高 488: 出「窗口太矮」提示 + 侧栏强制收起（492 不出）`, async () => {
    const short = await open(engine, { width: 1024, height: 488 });
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
      assert.equal(s.hidden, false, "视口高 <492 应显示「窗口太矮」提示");
      assert.ok(s.text.includes("窗口太矮"), `提示文案应为「窗口太矮…」，实际：${s.text}`);
      assert.ok(s.y >= 0 && s.bottom <= s.vh + 1, "提示应在视口内");
      assert.equal(Math.round(s.cardH), 320, "视口高 <492 卡到 320 下限，不再缩");
      assert.equal(s.sideCollapsed, true, "视口高 <492 侧栏强制收起");
      assert.deepEqual(short.errs, [], "页面不应有报错：" + short.errs.join(" | "));
    } finally {
      await short.ctx.close();
    }

    const just = await open(engine, { width: 1024, height: 492 });
    try {
      assert.equal(await just.page.locator("#too-short").isHidden(), true, "视口高 492 不应出提示（<492 才出）");
      assert.deepEqual(just.errs, [], "页面不应有报错：" + just.errs.join(" | "));
    } finally {
      await just.ctx.close();
    }
  });
}
