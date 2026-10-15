// e2e P1-2 回归：键盘光标、金色焦点框和鼠标悬停是同一个状态，说明卡跟着它走。
// 桌面 1280，三引擎：悬停「木」→ 按 →（光标移到池里的下一个字「田」）→ Space。
// 焦点框、说明卡标题、已挑的字必须都是「田」。
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

// 金色焦点框落在哪个字上（.cand.focus）。
const focusChar = (page) => page.evaluate(() => document.querySelector("#pick .cand.focus")?.dataset.char || null);
// 说明卡标题的第一个字（pi-h 形如「田 田地」，取首字）。
const infoChar = (page) => page.evaluate(() => (document.querySelector("#pick-desc .pi-h")?.textContent || "").trim().slice(0, 1));

for (const [engine] of Object.entries(ENGINES)) {
  test(`${engine} 1280: 悬停→方向键→Space，焦点框/说明卡/已挑的字一致`, async () => {
    const ctx = await browsers[engine].newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz);
      await toPickDesktop(page);

      // 悬停「木」：金框和说明卡都落在木
      await page.locator("#pick .cand[data-char='木']").hover();
      await page.waitForTimeout(60);
      assert.equal(await focusChar(page), "木", "悬停后金框应落在木");
      assert.equal(await infoChar(page), "木", "悬停后说明卡应显示木");

      // →：光标（金框 + 说明卡）移到池里的下一个字「田」
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(60);
      assert.equal(await focusChar(page), "田", "按 → 后金框应移到田");
      assert.equal(await infoChar(page), "田", "按 → 后说明卡应显示田");

      // Space：选中的必须是框里的「田」
      await page.keyboard.press("Space");
      await page.waitForTimeout(60);
      assert.equal(await focusChar(page), "田", "Space 后金框应仍在田");
      assert.equal(await infoChar(page), "田", "Space 后说明卡应仍是田");
      assert.deepEqual(await page.evaluate(() => window.__zz.st.picks), ["田"], "Space 应选中框里的田");
      assert.equal((await page.locator("#pick .pickslot[data-char='田'] span").textContent()).trim(), "1·田", "第 1 格应填田");

      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });
}
