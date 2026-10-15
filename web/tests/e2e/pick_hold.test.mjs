// e2e W8 回归：挑字「按住不放」点选不能被静默吞掉（见 ROOTCAUSE_W8.md）。
//
// 根因：候选节点在 pointerdown 与 pointerup 之间被 renderPick 的 innerHTML 重建替换，
// 浏览器因此不合成 click，玩家的一次点选丢失。修复把点选改到 pointerup 上、并针对
// pointerdown 时捕获的候选执行。
//
// 本套件用真人式「按下 → 按住 N 毫秒 → 抬起」验证：
//   A. 3 引擎 × 1280×800，按住 0/300/650/1000ms，两步挑字都成立（第一下看说明、第二下选中、再按放回）。
//   B. 50 次混合按住（0/120/300/650/900 循环）打在变化的候选上，含放回；用模型逐次比对
//      window.__zz.st.picks，零丢失。
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

// ---------- 公共动作 ----------

// 候选字中心（视口坐标）。
async function center(page, ch) {
  const box = await page.locator(`#pick .cand[data-char='${ch}']`).boundingBox();
  if (!box) throw new Error(`找不到候选「${ch}」`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// 真人式一次点选：按下 →（原地按住 hold ms）→ 抬起。按住期间可能有 render() 重建候选节点。
async function holdPress(page, ch, hold) {
  const { x, y } = await center(page, ch);
  await page.mouse.move(x, y);
  await page.mouse.down();
  if (hold > 0) await page.waitForTimeout(hold);
  await page.mouse.up();
}

const picksOf = (page) => page.evaluate(() => window.__zz.st.picks || []);
const focusChar = (page) => page.evaluate(() => document.querySelector("#pick .cand.focus")?.dataset.char || null);
const infoChar = (page) => page.evaluate(() => (document.querySelector("#pick-desc .pi-h")?.textContent || "").trim().slice(0, 1));

// 等真实状态（window.__zz.st.picks）变成期望值，而不是 sleep。
// 若超时，落到下面的 deepEqual 给出「丢了几次、丢在哪」的细节。
async function expectPicks(page, expected, detail) {
  try {
    await page.waitForFunction(
      (exp) => JSON.stringify(window.__zz.st.picks || []) === JSON.stringify(exp),
      expected,
      { timeout: 1500 },
    );
  } catch { /* 由下面的断言给出可读失败信息 */ }
  const got = await picksOf(page);
  assert.deepEqual(got, expected, `${detail}（期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(got)}）`);
}

// ---------- A. 按住时长不影响两步挑字 ----------

const HOLDS = [
  { hold: 0, ch: "水" },
  { hold: 300, ch: "日" },
  { hold: 650, ch: "木" },
  { hold: 1000, ch: "火" },
];

for (const [engine] of Object.entries(ENGINES)) {
  test(`${engine} 1280: 按住 0/300/650/1000ms 两步挑字都成立`, async () => {
    const ctx = await browsers[engine].newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz);
      await toPickDesktop(page);

      for (const { hold, ch } of HOLDS) {
        const tag = `按住 ${hold}ms ·「${ch}」`;

        // 第一下：只看说明，不入格。
        await holdPress(page, ch, hold);
        await expectPicks(page, [], `${tag} 的第一下不应入格`);
        assert.equal(await focusChar(page), ch, `${tag} 第一下后金框应落在「${ch}」`);
        assert.equal(await infoChar(page), ch, `${tag} 第一下后说明卡应显示「${ch}」`);

        // 第二下：选中。
        await holdPress(page, ch, hold);
        await expectPicks(page, [ch], `${tag} 的第二下应选中「${ch}」`);

        // 再按一下：放回，复位（给下一个时长用干净的 picks）。
        await holdPress(page, ch, hold);
        await expectPicks(page, [], `${tag} 再按一下应把「${ch}」放回`);
      }

      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });
}

// ---------- B. 50 次混合按住 + 放回的模型比对 ----------

// 候选字池（14 字）里的下标；打散到 4 个不同候选，且每个循环里出现两次放回。
const PATTERN = [1, 1, 4, 4, 7, 7, 1, 10, 10, 4];   // 日 日 田 田 月 月 日 从 从 田
const MIX_HOLDS = [0, 120, 300, 650, 900];
const SLOTS = 3;
const PRESSES = 50;

// 与引擎 pick_toggle 语义一致的模型：
//   - 已选中的字再点 → 放回（tapped 清空）；
//   - 同一字连着点两下 → 第二下选中（满 3 个则只是提示、不入格）；
//   - 否则只是「看过一下」（tapped 记它）。
function applyPress(model, ch) {
  if (model.picks.includes(ch)) {
    model.picks = model.picks.filter((c) => c !== ch);
    model.tapped = null;
  } else if (model.tapped === ch) {
    model.tapped = null;
    if (model.picks.length < SLOTS) model.picks.push(ch);
  } else {
    model.tapped = ch;
  }
}

for (const [engine] of Object.entries(ENGINES)) {
  test(`${engine} 1280: 50 次混合按住点选，逐次对齐模型，零丢失`, async () => {
    const ctx = await browsers[engine].newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz);
      await toPickDesktop(page);

      const chars = await page.evaluate(() =>
        [...document.querySelectorAll("#pick .cand[data-char]")].map((c) => c.dataset.char));
      assert.equal(chars.length, 14, "字池应为 14 字");

      const model = { picks: [], tapped: null };
      let putBacks = 0, maxPicks = 0;

      for (let i = 0; i < PRESSES; i++) {
        const ch = chars[PATTERN[i % PATTERN.length]];
        const hold = MIX_HOLDS[i % MIX_HOLDS.length];
        const before = model.picks.slice();
        await holdPress(page, ch, hold);
        applyPress(model, ch);
        if (before.length === SLOTS) maxPicks = Math.max(maxPicks, before.length);
        if (before.includes(ch) && model.picks.length === before.length - 1) putBacks++;
        await expectPicks(page, model.picks, `第 ${i + 1} 次（「${ch}」，按住 ${hold}ms）`);
        assert.ok(model.picks.length <= SLOTS, "模型自身不应超过 3 个");
      }

      assert.ok(putBacks >= 5, `序列里应包含多次放回，实际 ${putBacks}`);
      assert.ok(maxPicks > 0, "序列里应出现过「选满 3 个」的情形");
      // 最终以真实状态再核对一次。
      await expectPicks(page, model.picks, "50 次循环后的最终 picks");
      assert.deepEqual(await picksOf(page), model.picks, "最终 picks 应与模型一致");

      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });
}
