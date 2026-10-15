// e2e 回归（工程审核 f96632f P1-1）：残留文字选区不得干扰下一次拖卡。
//
// 根因：#card 内文字可选。鼠标拖卡的起点若落在卡高约 47%–60% 的带上（卡头/图片与标题之间的空隙，
// 1280 与 390 下卡的几何中心正在其中），这一拖会顺手选中「卡头 → 图片」一段内容。选区还在时
// 再从选区内（图片/空隙）按下拖动，浏览器把它当成「拖动选中内容」：chromium 发 pointercancel，
// 卡不动不提交；webkit 不发 cancel 也丢了 pointerup，卡粘在鼠标上，下一次随便一点就替玩家提交
// 「选右」。修法：#card{user-select:none;-webkit-user-select:none}（卡内本来就没有需要选的文字）。
//
// 本用例：三引擎 × 1280×800 / 390×844 鼠标，在同一局里连拖三次：
//   ① 从卡几何中心向左；② 再从卡几何中心向右；③ 从卡面图片中心向左。
// 每次断言：拖到一半卡跟手、松手只提交一次且方向正确、松手后无 .dragging、
// 拖与拖之间不点空白（保留可能的选区）；三拖后点一下卡外空白（#gen-line）不会多出提交
// （无误提交「选右」）；最后断言每次拖完都没有残留选区。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";
import { commit, clearTutorial } from "./helpers/flow.mjs";

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

const snap = (page) => page.evaluate(() => ({
  phase: window.__zz.st.phase, n: window.__zz.actions.length,
  last: window.__zz.actions[window.__zz.actions.length - 1] || null,
}));
const artVisible = (page) => page.evaluate(() => {
  const a = document.getElementById("card-art");
  const img = a && a.querySelector("img");
  return !!(img && !a.hidden && img.getBoundingClientRect().width > 20);
});
const cardDx = (page) => page.evaluate(() => {
  const t = getComputedStyle(document.getElementById("card")).transform;
  return t && t !== "none" ? new DOMMatrix(t).m41 : 0;
});
const selection = (page) => page.evaluate(() => {
  const s = getSelection();
  return s && s.rangeCount && !s.isCollapsed ? (s.toString() || "<非文本选区>").slice(0, 40) : "";
});

// 用键盘（不碰选区）把局面推进到一张可拖的普通卡；needArt 时要带卡面图。
async function prep(page, needArt) {
  for (let i = 0; i < 40; i++) {
    await page.waitForFunction(() => !window.__zz.animating, null, { timeout: 5000 });
    const s = await snap(page);
    if (s.phase === "engrave") { await page.keyboard.press("s"); await page.waitForTimeout(260); continue; }
    assert.equal(s.phase, "card", `应仍在出卡阶段（实际 ${s.phase}）`);
    if (!needArt || (await artVisible(page))) { await page.waitForTimeout(400); return; }
    await commit(page, "left");
  }
  assert.fail("找不到可拖的卡");
}

for (const [engine] of Object.entries(ENGINES)) {
  for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    test(`${engine} ${vp.width} mouse: centre→centre→image drags each commit once, no stuck drag, no selection`, async () => {
      const ctx = await browsers[engine].newContext({ viewport: vp });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);
      const sels = [];
      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz);
        await clearTutorial(page);
        const plan = [["centre", "left"], ["centre", "right"], ["image", "left"]];
        for (const [i, [from, side]] of plan.entries()) {
          const label = `第 ${i + 1} 拖（${from}→${side}）`;
          await prep(page, from === "image");
          const card = await page.locator("#card").boundingBox();
          let x, y;
          if (from === "image") {
            const b = await page.locator("#card-art img").boundingBox();
            x = b.x + b.width / 2; y = b.y + b.height / 2;
          } else { x = card.x + card.width / 2; y = card.y + card.height / 2; }
          const dir = side === "left" ? -1 : 1;
          const before = await snap(page);
          await page.mouse.move(x, y);
          await page.mouse.down();
          await page.mouse.move(x + dir * card.width * 0.25, y, { steps: 5 });
          const mid = await cardDx(page);
          await page.mouse.move(x + dir * card.width * 0.5, y, { steps: 5 });
          await page.mouse.up();
          assert.ok(mid * dir > 20, `${label}：拖到一半卡应跟手（translateX=${mid}）`);
          await page.waitForFunction((n) => !window.__zz.animating && window.__zz.actions.length > n, before.n, { timeout: 3000 })
            .catch(() => {});
          const after1 = await snap(page);
          assert.equal(after1.n, before.n + 1, `${label}：松手应恰好提交一次（${before.n}→${after1.n}）`);
          assert.equal(after1.last?.side, side, `${label}：提交方向应为 ${side}（实际 ${JSON.stringify(after1.last)}）`);
          assert.ok(!(await page.locator("#card").evaluate((el) => el.classList.contains("dragging"))), `${label}：松手后不应残留 .dragging`);
          sels.push(await selection(page));
        }
        // 三拖之后在卡外空白点一下：不能多出提交（webkit 粘手时这一下会误提交「选右」）。
        // 拖与拖之间故意不点空白——点空白会清掉选区，复现不了「选区残留→下一拖」。
        const n0 = (await snap(page)).n;
        await page.locator("#gen-line").click();
        await page.waitForTimeout(500);
        const end = await snap(page);
        assert.equal(end.n, n0, `三拖后点空白不应多出提交（误提交 ${JSON.stringify(end.last)}）`);
        assert.deepEqual(sels, ["", "", ""], `每次拖完都不应留下选区：${JSON.stringify(sels)}`);
        assert.deepEqual(errs, []);
      } finally {
        await ctx.close();
      }
    });
  }
}
