// e2e 离线：Service Worker 装好后（预缓存全部发布文件），断网刷新仍能起局。
// 三引擎各跑一遍。dist/app.js 的 BUILD_DIST=true 才会注册 SW，所以跑的是发布产物。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer } from "./helpers/env.mjs";

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

for (const engine of Object.keys(ENGINES)) {
  test(`${engine}: offline reload works after the SW installs`, async () => {
    const ctx = await browsers[engine].newContext();
    const page = await ctx.newPage();
    try {
      await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz);
      assert.ok(await page.evaluate(() => "serviceWorker" in navigator), "浏览器应支持 SW");

      // 等 SW 激活、接管页面（install 会预缓存全部发布文件）
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 });

      await ctx.setOffline(true);
      await page.reload({ waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz, null, { timeout: 15000 });
      assert.equal(await page.evaluate(() => window.__zz.st.phase), "card", "断网后仍应能起局");
      assert.ok((await page.locator("#card-title").textContent()).length > 0, "断网后卡面文案仍在");
    } finally {
      await ctx.setOffline(false).catch(() => {});
      await ctx.close();
    }
  });
}
