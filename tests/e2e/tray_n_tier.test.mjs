// e2e 常规 N 档字匣（design/v3_mobile/BREAKPOINTS.md §矮屏 表 / 第 35、40、54 行）。
// 视口高 >760 落常规 N 档（只适用宽 ≥1024 的桌面档，手机/平板不变）：字匣 64（格 52），
// 点击区 ≥44，字匣不得压顶栏/卡。A/B 档尺寸（A 60 / B 56）保持不变。
// 1366×768 是 N 档代表视口（BREAKPOINTS 第 40 行：768 − 280 = 488 → 卡 340×488）。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";
import { clearTutorial } from "./helpers/flow.mjs";

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

async function open(engine, { width, height }) {
  const ctx = await browsers[engine].newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  const errs = [];
  collectErrors(page, errs);
  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__zz);
  await clearTutorial(page);                       // 教学走完 → 普通卡（字匣内有可落字的格）
  await page.waitForFunction(() => !window.__zz.animating, null, { timeout: 5000 });
  return { ctx, page, errs };
}

const tray = (page) =>
  page.evaluate(() => {
    const R = (e) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
    };
    const Q = (s) => { const e = document.querySelector(s); return e ? R(e) : null; };
    const slots = [...document.querySelectorAll("#wordbox .slot")].map((e) => {
      const r = R(e);
      const t = document.elementFromPoint(r.x + r.w / 2, r.y + r.h / 2);
      return { ...r, covered: !(t && t.closest(".slot") === e) };
    });
    return {
      view: document.body.dataset.view, short: document.body.dataset.short || "",
      vw: innerWidth, vh: innerHeight,
      bar: Q("#wordbox-bar"), topbar: Q("#topbar"), card: Q("#card"), handle: Q("#wb-handle"),
      slots,
    };
  });

function intersect(a, b) {
  const ix = Math.min(a.right, b.right) - Math.max(a.x, b.x);
  const iy = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
  return ix > 0 && iy > 0;
}
const box = (o) => `x${Math.round(o.x)}..${Math.round(o.right)} y${Math.round(o.y)}..${Math.round(o.bottom)}`;

// ---------- 常规 N 档 1366×768：字匣 64（格 52），格点击区 ≥44，字匣不压顶栏/卡 ----------
for (const engine of Object.keys(ENGINES)) {
  test(`${engine} N 档 1366×768: 字匣 64（格 52）+ 点击区 ≥44 + 不压顶栏/卡`, async () => {
    const { ctx, page, errs } = await open(engine, { width: 1366, height: 768 });
    try {
      const g = await tray(page);
      assert.equal(g.view, "desktop");
      assert.equal(g.short, "", ">760 应落常规 N 档");

      assert.ok(Math.abs(g.bar.h - 64) <= 1, `N 档字匣应 ≈64（格 52 + 上下内边距 12），实际 ${g.bar.h}`);

      assert.ok(g.slots.length >= 1, "字匣内应至少有一个可落字的格");
      for (const s of g.slots) {
        assert.ok(Math.abs(s.w - 52) <= 1, `格宽应 ≈52，实际 ${s.w}`);
        assert.ok(Math.abs(s.h - 52) <= 1, `格高应 ≈52，实际 ${s.h}`);
        assert.ok(s.w >= 44 && s.h >= 44, `格点击区应 ≥44，实际 ${s.w}×${s.h}`);
        assert.equal(s.covered, false, "格应可点到（未被别的元素盖住）");
      }

      assert.ok(g.bar.y >= 0 && g.bar.bottom <= g.vh + 1, "字匣应在视口内");
      assert.ok(!intersect(g.bar, g.topbar), `字匣不得压顶栏：bar=${box(g.bar)} top=${box(g.topbar)}`);
      assert.ok(!intersect(g.bar, g.card), `字匣不得压卡：bar=${box(g.bar)} card=${box(g.card)}`);

      // 设计稿桌面字匣无把手（把手只服务手机/平板上拉抽屉）
      assert.equal(g.handle.h, 0, "N 档字匣不应显示把手");
      assert.equal(g.handle.w, 0, "N 档字匣不应显示把手");

      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });
}

// ---------- A/B 档字匣尺寸不变：1280×720 → A 60，1024×600 → B 56 ----------
for (const engine of Object.keys(ENGINES)) {
  for (const vp of [{ w: 1280, h: 720, tier: "A", bh: 60 }, { w: 1024, h: 600, tier: "B", bh: 56 }]) {
    test(`${engine} ${vp.tier} 档 ${vp.w}×${vp.h}: 字匣 ${vp.bh} 不变`, async () => {
      const { ctx, page, errs } = await open(engine, { width: vp.w, height: vp.h });
      try {
        const g = await tray(page);
        assert.equal(g.short, vp.tier, `应落 ${vp.tier} 档`);
        assert.ok(Math.abs(g.bar.h - vp.bh) <= 1, `${vp.tier} 档字匣应 ≈${vp.bh}，实际 ${g.bar.h}`);
        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}
