// e2e E3 回归：连着玩 ≥3 代，「先人」交棒会复位每代一次的 ui.elderShown。
//
// 根因：web/app.js 的 #elder「交给第 n 代」原先只 dispatch heir，没有复位 ui.elderShown。
// 于是第 1 代交棒后 elderShown 一直为 true，第 2 代结束时 renderEnded 被跳过（show = ended &&
// !elderShown …），结局 #endseq 不出现，直接弹出 #elder——玩家看不到这一代的结局。
// 修复（交棒处）：ui.elderShown = false; ui.winter = freshWinter(); 再 dispatch heir。
//
// 本套件：三引擎 × 1280×800 鼠标，连玩 3 代。每一代：
//   1. （仅第 1 代）clearTutorial；然后 playToWinter 打到冬夜；
//   2. 点 #winter-end（天亮了）；
//   3. 断言先出 #endseq、此刻 #elder 仍隐藏（若 elderShown 没复位，这里会直接弹 #elder）；
//   4. 点「先人」→ #elder 的标题含「第 n 代结束」；
//   5. 点「交给第 n 代」→ phase === pick；
//   6. 挑 3 个候选 + 点出发 → 进入第 n+1 代（phase card）。
// 循环跑完 gen 1..3，最后应落在第 4 代。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";
import { clearTutorial, playToWinter } from "./helpers/flow.mjs";

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

const phase = (page) => page.evaluate(() => window.__zz.st.phase);
const genNo = (page) => page.evaluate(() => window.__zz.st.generation);
const picksOf = (page) => page.evaluate(() => window.__zz.st.picks || []);

// 挑字：候选是两段式点选（第一下看说明、第二下选中）。挑前 3 个候选，各连点两下，再点出发。
async function pickThree(page) {
  const chars = await page.evaluate(() =>
    Array.from(document.querySelectorAll("#pick .cand")).slice(0, 3).map((c) => c.dataset.char));
  assert.equal(chars.length, 3, "挑字屏应至少有 3 个候选");
  for (const ch of chars) {
    await page.locator(`#pick .cand[data-char='${ch}']`).click();
    await page.locator(`#pick .cand[data-char='${ch}']`).click();
  }
  assert.equal((await picksOf(page)).length, 3, "应凑够三个字");
  await page.locator("#pick .go").click();
}

for (const [engine] of Object.entries(ENGINES)) {
  test(`${engine} 1280: 连玩 3 代，交棒后每代都先出 #endseq 再出 #elder`, async () => {
    const ctx = await browsers[engine].newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz);

      for (let gen = 1; gen <= 3; gen++) {
        assert.equal(await genNo(page), gen, `应处于第 ${gen} 代`);
        if (gen === 1) await clearTutorial(page);          // 教学只在第 1 代
        await playToWinter(page);
        assert.equal(await phase(page), "winter", `第 ${gen} 代应到冬夜`);

        // 天亮了 → 结局。先出 #endseq，此时 #elder 必须仍隐藏。
        await page.locator("#winter-end").click();
        await page.waitForFunction(() => window.__zz.st.phase === "ended", null, { timeout: 5000 });
        assert.ok(!(await page.locator("#elder").isVisible()), `第 ${gen} 代：结局时应先出 #endseq，#elder 还不能出现`);
        await page.locator("#endseq").waitFor({ state: "visible", timeout: 12000 });
        assert.ok(!(await page.locator("#elder").isVisible()), `第 ${gen} 代：#endseq 出现的这一刻 #elder 仍应隐藏`);

        // 先人 → #elder 标题含「第 n 代结束」。
        await page.locator("#endseq [data-do=elder]").click();
        await page.locator("#elder").waitFor({ state: "visible", timeout: 5000 });
        const head = (await page.locator("#elder h1").innerText()).replace(/\s+/g, "");
        assert.ok(head.includes(`第${gen}代结束`), `第 ${gen} 代：#elder 标题应含「第 ${gen} 代结束」，实为「${head}」`);

        // 交给第 n 代 → 挑字。
        await page.locator("#elder [data-do=heir]").click();
        await page.waitForFunction(() => window.__zz.st.phase === "pick", null, { timeout: 5000 });
        assert.ok(await page.locator("#pick").isVisible(), `第 ${gen} 代：交棒后应显示 #pick`);

        // 挑 3 个 + 出发 → 第 n+1 代（phase card）。
        await pickThree(page);
        await page.waitForFunction((g) => window.__zz.st.generation === g, gen + 1, { timeout: 5000 });
        assert.equal(await phase(page), "card", `第 ${gen} 代出发后应开始第 ${gen + 1} 代`);
      }

      assert.equal(await genNo(page), 4, "连玩 3 代后应进入第 4 代");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });
}
