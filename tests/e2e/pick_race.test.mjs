// e2e 回归：挑字候选在 pointerdown 与 pointerup 之间被重绘（innerHTML 重建），
// 浏览器会因「按下与抬起的节点不是同一个」而不合成 click——真实玩家的点选被吞掉。
// 根因：afterAction() 的 650ms setTimeout → render() → renderPick() 无条件 el.innerHTML 重建候选。
// 这里用确定性手法复现：mouse.down → 强制 window.__zz.render() → mouse.up，
// 修复后 renderPick 在 HTML 未变时不再替换节点，点击必须照常入格。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";
import { toPickDesktop } from "./helpers/flow.mjs";

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

// 在候选按钮上按下指针、中途强制整屏重绘、再抬起。
async function downRenderUp(page, selector) {
  const box = await page.locator(selector).boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.evaluate(() => window.__zz.render());   // 模拟 afterAction 的 650ms render 落在 down/up 之间
  await page.mouse.up();
}

for (const [engine] of Object.entries(ENGINES)) {
  test(`${engine} 1280: pointerdown/pointerup 之间重绘，挑字点击不能丢`, async () => {
    const ctx = await browsers[engine].newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz);
      await toPickDesktop(page);

      // 两步里的第一步：点「木」只看说明（进入「再点一次带上」态）。
      await page.locator("#pick .cand[data-char='木']").click();
      await page.waitForFunction(() => !!document.querySelector("#pick-desc .pi-h"));

      // 第二步的 down/up 之间强制重绘：节点若被替换，这次点击就会丢。
      await downRenderUp(page, "#pick .cand[data-char='木']");
      await page.waitForFunction(() => (window.__zz.st.picks || []).length === 1);
      assert.deepEqual(await page.evaluate(() => window.__zz.st.picks), ["木"], "down/up 之间重绘后点击不能丢");

      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });
}
