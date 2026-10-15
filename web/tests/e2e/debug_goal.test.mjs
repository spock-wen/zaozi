// ?debug=1&debug_goal=… 的端到端验收：目标被硬塞进这一局的目标里，页面上能看到。
// 不带 param 时是正常目标集（不含 G_FOOD_65），带上才有——证明确实是 param 起的作用。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";

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

async function goals(page) {
  return page.evaluate(() => window.__zz.st.goals.map((g) => g.id));
}

for (const [engine] of Object.entries(ENGINES)) {
  test(`${engine} 1280: ?debug=1&debug_goal=G_FOOD_65 forces the goal into this generation`, async () => {
    const ctx = await browsers[engine].newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      // 先看正常开局：目标集不该含 G_FOOD_65（第 1 代固定为 DROP1 / MEM_70 / FAITH_65）
      await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz);
      assert.ok(!(await goals(page)).includes("G_FOOD_65"), "正常第 1 代不该有 G_FOOD_65");
      assert.equal(await page.evaluate(() => window.__zz.debugGoal), null);

      // 带上调试 param：G_FOOD_65 必须出现在这一代的目标里
      await page.goto(`${server.origin}/?debug=1&debug_goal=G_FOOD_65&seed=${SEED}`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz);
      assert.equal(await page.evaluate(() => window.__zz.debugGoal), "G_FOOD_65");
      const ids = await goals(page);
      assert.equal(ids.length, 3);
      assert.ok(ids.includes("G_FOOD_65"), `调试目标应在本代目标里，实际 ${ids.join(",")}`);

      // 目标 UI 能看到它：展开目标清单，文本包含 goals.json 的文案
      await page.locator("#goals-slip").click();
      const panel = page.locator("#goals-panel");
      await panel.waitFor({ state: "visible", timeout: 3000 });
      assert.ok((await panel.innerText()).includes("代末「粮」够六十五"), "目标清单应显示该目标的文案");

      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });
}
