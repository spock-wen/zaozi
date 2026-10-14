// W1 回归：菜单里的「字源与版权」是真实链接，必须能导航到字源页。
// 缺陷：on() 对每次 click 都 preventDefault，把 <a href="credits.html"> 的默认跳转也拦掉了，
// 游戏里没有任何入口能进字源页。修好后，真链接（带 href 的 <a>）应照常跳转。
// 390 用 hasTouch + tap（触控），1280 用 click（鼠标），三引擎各跑一遍。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";

buildDist();

const CASES = [
  { name: "390 tap", width: 390, height: 844, touch: true, view: "mobile" },
  { name: "1280 click", width: 1280, height: 800, touch: false, view: "desktop" },
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

for (const [engine] of Object.entries(ENGINES)) {
  for (const c of CASES) {
    test(`${engine} ${c.name}: menu 「字源与版权」 navigates to /credits`, async () => {
      const ctx = await browsers[engine].newContext({
        viewport: { width: c.width, height: c.height },
        hasTouch: c.touch,
      });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);
      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz);
        assert.equal(await page.evaluate(() => document.body.dataset.view), c.view, "布局档位");

        // 打开菜单
        const menubtn = page.locator("#menubtn");
        if (c.touch) await menubtn.tap(); else await menubtn.click();
        await page.locator("#menu-pop").waitFor({ state: "visible", timeout: 3000 });

        // 里的字源链接
        const link = page.locator("#menu-pop a[href]");
        assert.ok(await link.isVisible(), "菜单里应有「字源与版权」链接");
        assert.equal(await link.getAttribute("href"), "credits.html");

        // 点它：必须离开游戏页，落到 /credits
        if (c.touch) await link.tap(); else await link.click();
        await page.waitForURL(/\/credits$/, { timeout: 5000 });
        assert.equal(new URL(page.url()).pathname, "/credits", `应停在 /credits，实际 ${page.url()}`);

        // 字源页的版权表要出来
        await page.locator("table tr").first().waitFor({ state: "visible", timeout: 5000 });
        const rows = await page.locator("table tr").count();
        assert.ok(rows > 50, `版权表行数 ${rows} 太少`);
        assert.ok((await page.locator("body").innerText()).includes("Richard Sears"), "版权页要带 Richard Sears 署名");

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}
