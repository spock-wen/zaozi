// P2-5 回归：按阶段区分键盘文案（无骨片不提 K/刻字/骨片）。
// 缺陷（9462842）：普通卡阶段（卡角无骨片）的 #keys、#gesture-hint 与 keyhelp 浮层中依然出现
//                  「K 刻字」、「K/Enter」、「刻字（或点卡角骨片）」、「骨片」等文案。
// 三引擎 × {1280×800 mouse (tier N), 1280×700 mouse (tier A), 1280×600 mouse (tier B)}。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";
import { phase, current, commit } from "./helpers/flow.mjs";

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

const VIEWPORTS = [
  { name: "1280x800", width: 1280, height: 800, tier: "N" },
  { name: "1280x700", width: 1280, height: 700, tier: "A" },
  { name: "1280x600", width: 1280, height: 600, tier: "B" },
];

for (const engine of Object.keys(ENGINES)) {
  for (const vp of VIEWPORTS) {
    test(`${engine} ${vp.name} (tier ${vp.tier}): 键盘文案仅在刻字阶段（有骨片）出现 K/刻/骨片`, async () => {
      const ctx = await browsers[engine].newContext({
        viewport: { width: vp.width, height: vp.height },
        hasTouch: false,
      });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);
      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz);

        // 1) 检查普通卡阶段（T01，phase="card"，卡角骨片不可见）
        assert.equal(await current(page), "T01");
        assert.equal(await phase(page), "card");
        const bonecornerHidden = await page.evaluate(() => {
          const bc = document.getElementById("bonecorner");
          return !bc || getComputedStyle(bc).display === "none";
        });
        assert.ok(bonecornerHidden, "普通卡阶段 #bonecorner 应不可见");

        const keysTextNormal = (await page.locator("#keys").textContent()) || "";
        const gestureTextNormal = (await page.locator("#gesture-hint").textContent()) || "";

        // 针对普通卡阶段，断言 #keys、#gesture-hint 不含 K/刻字/骨片
        for (const forbidden of ["K 刻字", "K/Enter", "骨片"]) {
          assert.ok(!keysTextNormal.includes(forbidden), `普通阶段 #keys 不应包含「${forbidden}」，实际为：${keysTextNormal}`);
        }
        assert.ok(!gestureTextNormal.includes("K 刻字"), `普通阶段 #gesture-hint 不应包含「K 刻字」，实际为：${gestureTextNormal}`);
        assert.ok(!gestureTextNormal.includes("骨片"), `普通阶段 #gesture-hint 不应包含「骨片」，实际为：${gestureTextNormal}`);

        // 在 tier B 下打开「?」浮层检查
        if (vp.tier === "B") {
          if (await page.locator("#keyhelp-pop").isHidden()) {
            await page.locator("#keyhelp-btn").click();
          }
          await page.locator("#keyhelp-pop").waitFor({ state: "visible" });
          const popText = (await page.locator("#keyhelp-pop").innerText()) || "";
          const popRows = await page.$$eval("#keyhelp-pop .kh-row", (els) =>
            els.map((e) => ({ key: e.querySelector("b")?.textContent?.trim() || "", desc: e.querySelector("span")?.textContent?.trim() || "" }))
          );

          for (const forbidden of ["K 刻字", "K/Enter", "刻字（或点卡角骨片）", "骨片"]) {
            assert.ok(!popText.includes(forbidden), `普通阶段 keyhelp 浮层不应包含「${forbidden}」，实际为：${popText}`);
          }
          const hasKRow = popRows.some((r) => r.key === "K");
          assert.ok(!hasKRow, "普通阶段 keyhelp 浮层不应包含按键为 K 的行");
        }

        // 2) 前进到 T03（刻字阶段，骨片可见）
        await commit(page, "left");               // T01 → T02
        await commit(page, "right");              // T02 → T03
        assert.equal(await current(page), "T03");
        assert.equal(await phase(page), "engrave");

        const bonecornerVisible = await page.evaluate(() => {
          const bc = document.getElementById("bonecorner");
          return bc && getComputedStyle(bc).display !== "none";
        });
        assert.ok(bonecornerVisible, "T03 刻字阶段 #bonecorner 应可见");

        const keysTextEngrave = (await page.locator("#keys").textContent()) || "";
        const gestureTextEngrave = (await page.locator("#gesture-hint").textContent()) || "";

        if (vp.tier === "N") {
          assert.ok(keysTextEngrave.includes("K 刻字"), `刻字阶段 tier N #keys 应包含「K 刻字」，实际为：${keysTextEngrave}`);
          assert.ok(gestureTextEngrave.includes("K 刻字"), `刻字阶段 tier N #gesture-hint 应包含「K 刻字」，实际为：${gestureTextEngrave}`);
        } else if (vp.tier === "A") {
          assert.ok(keysTextEngrave.includes("K/Enter"), `刻字阶段 tier A #keys 应包含「K/Enter」，实际为：${keysTextEngrave}`);
          assert.ok(gestureTextEngrave.includes("K 刻字"), `刻字阶段 tier A #gesture-hint 应包含「K 刻字」，实际为：${gestureTextEngrave}`);
        } else if (vp.tier === "B") {
          if (await page.locator("#keyhelp-pop").isHidden()) {
            await page.locator("#keyhelp-btn").click();
          }
          await page.locator("#keyhelp-pop").waitFor({ state: "visible" });
          const popRows = await page.$$eval("#keyhelp-pop .kh-row", (els) =>
            els.map((e) => ({ key: e.querySelector("b")?.textContent?.trim() || "", desc: e.querySelector("span")?.textContent?.trim() || "" }))
          );
          const hasKRow = popRows.some((r) => r.key === "K" && r.desc.includes("刻"));
          assert.ok(hasKRow, "刻字阶段 keyhelp 浮层应包含按键为 K 的刻字行");
          const hasEnterRow = popRows.some((r) => r.key === "Enter" && r.desc.includes("刻"));
          assert.ok(hasEnterRow, "刻字阶段 keyhelp 浮层应包含按键为 Enter 的刻字行");
        }

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}
