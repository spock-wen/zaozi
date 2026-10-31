// W3 回归（e2e）：教学全程可见文字里不能出现 "undefined"。
// 缺陷：T03 刻字卡显示「卡上出现一道迹：undefined」——app.js 读了 st.pendingTrace.text，
// 数据里只有 target / tally_text。修好后卡上必须显示那道迹的真实文案。
// 三引擎各走一遍：T01 → T02 → T03（刻）→ T04（落水）→ T05。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ENGINES, SEED, ROOT, buildDist, startServer, collectErrors } from "./helpers/env.mjs";
import { phase, current, commit, passCutscene } from "./helpers/flow.mjs";

buildDist();

const CARDS = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "year1_cards.json"), "utf8")).cards;
const T03_TRACE = CARDS.find((c) => c.id === "T03").trace.tally_text;

let server, browsers = {};
before(async () => {
  server = await startServer();
  for (const [name, type] of Object.entries(ENGINES)) browsers[name] = await type.launch();
});
after(async () => {
  for (const b of Object.values(browsers)) await b.close();
  server?.close();
});

const visibleText = (page) => page.evaluate(() => document.body.innerText);
async function assertNoUndefined(page, where) {
  const txt = await visibleText(page);
  assert.ok(!txt.includes("undefined"), `${where}: 可见文字里出现了 undefined：${txt.slice(0, 200)}`);
}

for (const engine of Object.keys(ENGINES)) {
  test(`${engine} 1280: no visible "undefined" anywhere in the tutorial; T03 shows the real trace text`, async () => {
    const ctx = await browsers[engine].newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz);

      assert.equal(await current(page), "T01");
      await assertNoUndefined(page, "T01");

      await commit(page, "left");                 // T01 → T02
      assert.equal(await current(page), "T02");
      await assertNoUndefined(page, "T02");

      await commit(page, "right");                // T02 → T03（锁拖，进刻）
      assert.equal(await current(page), "T03");
      assert.equal(await phase(page), "engrave");

      // 刻字卡上的迹必须显示真实文案（W3 的核心断言）
      const drops = page.locator("#card-drops");
      await drops.waitFor({ state: "visible", timeout: 3000 });
      const dropText = (await drops.textContent()).trim();
      assert.ok(dropText.includes(T03_TRACE), `T03 卡上应显示这道迹的文案，实际：「${dropText}」`);
      assert.ok(!dropText.includes("undefined"), `T03 卡上不能出现 undefined：「${dropText}」`);
      await assertNoUndefined(page, "T03");

      await page.locator("#bonecorner").click();  // 刻 → T04
      await page.waitForTimeout(350);
      await passCutscene(page);
      assert.equal(await current(page), "T04");
      await assertNoUndefined(page, "T04");

      await page.locator("#wordbox .slot.ok").first().click();  // 落「水」→ T05
      await page.waitForTimeout(350);
      await passCutscene(page);
      assert.equal(await current(page), "T05");
      await assertNoUndefined(page, "T05");

      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });
}
