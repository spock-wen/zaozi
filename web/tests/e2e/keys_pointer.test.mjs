// e2e W6：768×1024 平板竖屏，按键鼠（pointer:fine）分两态。
// 规格 design/v3_mobile/BREAKPOINTS.md 第 8 行：平板竖屏「触控；接了键盘（pointer:fine）才显键位行」。
//   - 键鼠（无 hasTouch）：#keys 键位行可见、手势提示用键盘文案、不出现触控文案；
//   - 触控（hasTouch，chromium/webkit 带 isMobile）：#keys 隐藏、手势提示用触控文案、不出现键盘文案；
//   - 手机档（390，即便 pointer:fine）也按设计「不显键位」保持触控文案，手机不改。
// 三引擎各跑一遍。Playwright 的 hasTouch:true 会把 (hover:hover) and (pointer:fine) 判为 false，
// 正好用来模拟「没接键鼠的平板」。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";

buildDist();

const VP = { width: 768, height: 1024 };
const FINE = "(hover:hover) and (pointer:fine)";
const KB_COPY = "←/→ 预览";
const TOUCH_COPY = "左右拖卡做选择";

let server, browsers = {};
before(async () => {
  server = await startServer();
  for (const [name, type] of Object.entries(ENGINES)) browsers[name] = await type.launch();
});
after(async () => {
  for (const b of Object.values(browsers)) await b.close();
  server?.close();
});

async function open(ctx, errs, view = "tablet-portrait") {
  const page = await ctx.newPage();
  collectErrors(page, errs);
  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__zz);
  assert.equal(await page.evaluate(() => document.body.dataset.view), view, `档位应为 ${view}`);
  return page;
}

for (const [engine] of Object.entries(ENGINES)) {
  test(`${engine} 768 pointer:fine: 显键位行 + 键盘手势文案`, async () => {
    const ctx = await browsers[engine].newContext({ viewport: VP });
    const errs = [];
    const page = await open(ctx, errs);
    try {
      assert.equal(await page.evaluate((q) => matchMedia(q).matches, FINE), true, "无 hasTouch 应为 pointer:fine");

      assert.ok(await page.locator("#keys").isVisible(), "pointer:fine 应显示 #keys 键位行");
      assert.ok((await page.locator("#keys").textContent()).trim().length > 0, "#keys 键位行应有内容");

      const hint = (await page.locator("#gesture-hint").textContent()).trim();
      assert.ok(hint.includes(KB_COPY), `手势提示应为键盘文案，得到：${hint}`);
      assert.ok(!hint.includes(TOUCH_COPY), `pointer:fine 不应出现触控文案，得到：${hint}`);

      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });

  test(`${engine} 768 touch: 隐键位行 + 触控手势文案`, async () => {
    const opts = { viewport: VP, hasTouch: true };
    if (engine !== "firefox") opts.isMobile = true;         // Firefox 不支持 isMobile
    const ctx = await browsers[engine].newContext(opts);
    const errs = [];
    const page = await open(ctx, errs);
    try {
      assert.equal(await page.evaluate((q) => matchMedia(q).matches, FINE), false, "hasTouch 应为非 pointer:fine");

      assert.ok(!(await page.locator("#keys").isVisible()), "触控应隐藏 #keys 键位行");

      const hint = (await page.locator("#gesture-hint").textContent()).trim();
      assert.ok(hint.includes(TOUCH_COPY), `手势提示应为触控文案，得到：${hint}`);
      assert.ok(!hint.includes(KB_COPY), `触控不应出现键盘文案，得到：${hint}`);

      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });

  test(`${engine} 390 pointer:fine: 手机档保持触控（不显键位行）`, async () => {
    const ctx = await browsers[engine].newContext({ viewport: { width: 390, height: 844 } });
    const errs = [];
    const page = await open(ctx, errs, "mobile");
    try {
      assert.equal(await page.evaluate((q) => matchMedia(q).matches, FINE), true, "无 hasTouch 应为 pointer:fine");

      assert.ok(!(await page.locator("#keys").isVisible()), "手机档即便 pointer:fine 也不显 #keys（BREAKPOINTS 手机「不显键位」）");

      const hint = (await page.locator("#gesture-hint").textContent()).trim();
      assert.ok(hint.includes(TOUCH_COPY), `手机档应保持触控文案，得到：${hint}`);
      assert.ok(!hint.includes(KB_COPY), `手机档不应出现键盘文案，得到：${hint}`);

      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });
}
