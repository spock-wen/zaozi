// e2e 视口覆盖：三引擎 × 五个视口（390×844 / 768×1024 / 1024×768 / 1280×800 / 1440×900）。
// 每个视口都验证：菜单可点（≥44×44）、存档导出弹层能开（含 1024，B10）、静音一次点击只切一次（D1）、
// 字源版权页可达且带 Richard Sears 署名。全程不允许有页面报错。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, VIEWPORTS, SEED, buildDist, startServer, collectErrors, firePointerThenClick } from "./helpers/env.mjs";

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

for (const [engine, type] of Object.entries(ENGINES)) {
  for (const vp of VIEWPORTS) {
    test(`${engine} ${vp.name}: menu / save / mute / credits`, async () => {
      const ctx = await browsers[engine].newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);
      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz);
        assert.equal(await page.evaluate(() => window.__zz.st.phase), "card", "开局应在 card 阶段");
        assert.equal(await page.evaluate(() => document.body.dataset.view), vp.view, "布局档位");

        // 菜单按钮必须可见、点击区 ≥44×44（B1）
        const mb = page.locator("#menubtn");
        assert.ok(await mb.isVisible(), "☰ 菜单必须可见");
        const box = await mb.boundingBox();
        assert.ok(box.width >= 44 && box.height >= 44, `菜单点击区 ${box.width}×${box.height} < 44`);

        // 菜单打开
        await mb.click();
        await page.locator("#menu-pop").waitFor({ state: "visible", timeout: 3000 });
        assert.ok(await page.locator("#menu-pop [data-menu='export']").isVisible());
        const credHref = await page.locator("#menu-pop a").getAttribute("href");
        assert.equal(credHref, "credits.html");

        // 静音一次点击只切一次（D1）
        const m0 = await page.evaluate(() => window.__zz.isMuted());
        await firePointerThenClick(page, "#menu-pop [data-menu='mute']");
        const m1 = await page.evaluate(() => window.__zz.isMuted());
        assert.notEqual(m1, m0, "静音必须切换且只切一次（双触发会切回原状）");
        assert.equal(await page.evaluate(() => localStorage.getItem("zaozi.mute")), m1 ? "1" : "0");

        // 打开菜单再导出：存档弹层能开，且在视口内（B10）
        await mb.click();
        await page.locator("#menu-pop").waitFor({ state: "visible" });
        await page.locator("#menu-pop [data-menu='export']").click();
        await page.locator("#savedlg").waitFor({ state: "visible", timeout: 3000 });
        const code = await page.locator("#dlgtext").inputValue();
        assert.match(code, /^ZZ1\./, "导出码格式应为 ZZ1.<校验>.<载荷>");
        const dlg = await page.locator("#dlgbox").boundingBox();
        assert.ok(dlg.x >= -1 && dlg.x + dlg.width <= vp.width + 1, "存档弹层必须在视口内");
        await page.locator("#dlgclose").click();
        await page.locator("#savedlg").waitFor({ state: "hidden" });

        // 字源版权页（每个视口都可达）
        await page.goto(`${server.origin}/credits`, { waitUntil: "load" });
        const rows = await page.locator("#credits tbody tr, table tr").count();
        assert.ok(rows > 50, `版权表行数 ${rows} 太少`);
        assert.ok((await page.locator("body").innerText()).includes("Richard Sears"), "版权页要带 Richard Sears 署名");

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}
