// e2e：挑字页标题的代号必须与「交棒」按钮一致。
//
// PM 裁定：挑字页标题显示「即将开始的那一代」，与 #elder 里的交棒按钮
// （button_next，文本「交给第 {n+1} 代」）保持一致；首局仍显示第 1 代。
//
// 根因：web/app.js 的 renderPick 原先写 `第 ${st.generation ?? 2} 代`。挑字阶段 st.generation
// 还是刚结束的那一代（begin_generation 之后才 +1；?? 2 兜底从来用不上），所以标题比交棒按钮少一：
// 第 1 代结束时按钮「交给第 2 代」、标题却是「第 1 代」，第 2 代结束时按钮「交给第 3 代」、标题「第 2 代」。
// 修复：改为 `(st.generation ?? 1) + 1`，即即将开始的代。
//
// 本套件：三引擎 × 1280×800，连玩 2 代。首局断言顶栏 #gen-line 为「第 1 代」且 st.generation === 1；
// 每一代「先人 → 交棒 → 挑字」后断言 #pick 标题含「第 {n+1} 代」、标题里的数字与交棒按钮里的数字相同，
// 出发进入第 n+1 代后 #gen-line 也含「第 {n+1} 代」。
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
const genLineText = async (page) => (await page.locator("#gen-line").innerText()).replace(/\s+/g, "");
const numOf = (s) => (s.match(/\d+/g) || []).map(Number);

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
  test(`${engine} 1280: 挑字页标题的代号 = 即将开始的代，与交棒按钮一致`, async () => {
    const ctx = await browsers[engine].newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz);

      // 首局：顶栏就是第 1 代。
      assert.equal(await genNo(page), 1, "首局应处于第 1 代");
      const first = await genLineText(page);
      assert.ok(first.includes("第1代"), `首局 #gen-line 应含「第1代」，实为「${first}」`);

      for (let gen = 1; gen <= 2; gen++) {
        assert.equal(await genNo(page), gen, `应处于第 ${gen} 代`);
        if (gen === 1) await clearTutorial(page);          // 教学只在第 1 代
        await playToWinter(page);

        // 天亮了 → 结局 → 先人 → 交棒。
        await page.locator("#winter-end").click();
        await page.locator("#endseq").waitFor({ state: "visible", timeout: 12000 });
        await page.locator("#endseq [data-do=elder]").click();
        await page.locator("#elder").waitFor({ state: "visible", timeout: 5000 });

        const heir = (await page.locator("#elder [data-do=heir]").innerText()).replace(/\s+/g, "");
        assert.ok(heir.includes(`交给第${gen + 1}代`), `第 ${gen} 代：交棒按钮应含「交给第${gen + 1}代」，实为「${heir}」`);
        await page.locator("#elder [data-do=heir]").click();
        await page.waitForFunction(() => window.__zz.st.phase === "pick", null, { timeout: 5000 });

        // 挑字页标题：应是即将开始的第 gen+1 代，且数字与交棒按钮相同。
        const title = (await page.locator("#pick h2").innerText()).replace(/\s+/g, "");
        assert.ok(title.includes(`第${gen + 1}代`), `第 ${gen} 代：挑字页标题应含「第${gen + 1}代」，实为「${title}」`);
        assert.deepEqual(numOf(title), numOf(heir), `第 ${gen} 代：挑字页标题的数字应等于交棒按钮的数字（标题「${title}」/按钮「${heir}」）`);

        // 挑 3 个 + 出发 → 第 gen+1 代，顶栏同步。
        await pickThree(page);
        await page.waitForFunction((g) => window.__zz.st.generation === g, gen + 1, { timeout: 5000 });
        assert.equal(await phase(page), "card", `第 ${gen} 代出发后应开始第 ${gen + 1} 代`);
        const line = await genLineText(page);
        assert.ok(line.includes(`第${gen + 1}代`), `第 ${gen + 1} 代开局 #gen-line 应含「第${gen + 1}代」，实为「${line}」`);
      }

      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });
}
