// e2e 回归（工程审核 0759c65 P1）：鼠标从卡面图片（#card-art <img>）上起拖，卡必须真的被拖动。
//
// 根因：<img> 默认可原生拖拽（draggable 默认 true）。鼠标在图上按下并移动时，浏览器启动原生
// 图片拖拽（dragstart），随后发 pointercancel，不再给页面 pointermove/pointerup；卡不跟手、
// 松手也不判左右（键盘、触屏不受影响，所以以前的用例没抓到）。
// 修法：卡内 <img> 加 draggable="false"，CSS 再加 -webkit-user-drag:none; user-select:none。
// 不用 pointer-events:none：onDown 靠命中目标在 #card 内起拖（5a72257），img 本身就在 #card 内。
//
// 本用例：三引擎 × 1280×800 / 390×844 鼠标。过教学后找一张带卡面图的卡，从图片中心
// mouse.down → 分步横移半张卡宽（中途断言卡跟手：transform 有位移）→ mouse.up，
// 断言这次拖拽被判定（卡换了 / 阶段推进）。另断言命中测试：图片中心 elementFromPoint 落在 #card 内。
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

const state = (page) => page.evaluate(() => ({ phase: window.__zz.st.phase, current: window.__zz.st.current }));
const artVisible = (page) => page.evaluate(() => {
  const a = document.getElementById("card-art");
  const img = a && a.querySelector("img");
  return !!(img && !a.hidden && img.getBoundingClientRect().width > 20);
});

for (const [engine] of Object.entries(ENGINES)) {
  for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    test(`${engine} ${vp.width} mouse: drag starting on card <img> moves the card and commits`, async () => {
      const ctx = await browsers[engine].newContext({ viewport: vp });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);
      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz);
        await clearTutorial(page);
        // 找一张带卡面图的普通卡
        for (let i = 0; i < 40; i++) {
          const s = await state(page);
          if (s.phase === "card" && (await artVisible(page))) break;
          if (s.phase === "engrave") { await page.keyboard.press("s"); await page.waitForTimeout(260); continue; }
          assert.equal(s.phase, "card", `应仍在出卡阶段（实际 ${s.phase}）`);
          await commit(page, "left");
        }
        assert.ok(await artVisible(page), "应找到一张带卡面图的卡");
        await page.waitForFunction(() => !window.__zz.animating, null, { timeout: 5000 });
        await page.waitForTimeout(400);  // 入场过渡停稳

        const img = page.locator("#card-art img");
        const b = await img.boundingBox();
        const x = b.x + b.width / 2, y = b.y + b.height / 2;
        assert.ok(await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest("#card"), [x, y]),
          "图片中心的命中目标应在 #card 内（不能用 pointer-events 把卡吞掉）");

        const before = await state(page);
        const cardW = (await page.locator("#card").boundingBox()).width;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + cardW * 0.25, y, { steps: 5 });
        const midDx = await page.evaluate(() => {
          const t = getComputedStyle(document.getElementById("card")).transform;
          return t && t !== "none" ? new DOMMatrix(t).m41 : 0;
        });
        await page.mouse.move(x + cardW * 0.5, y, { steps: 5 });
        await page.mouse.up();
        assert.ok(midDx > 20, `拖到一半卡应跟手（translateX=${midDx}）`);
        await page.waitForFunction((b) => {
          const s = window.__zz.st;
          return !window.__zz.animating && (s.phase !== b.phase || s.current !== b.current);
        }, before, { timeout: 3000 });
        // 行为断言之后再查属性（在旧代码上先由行为断言失败，证明用例抓得到问题本身）
        assert.equal(await img.getAttribute("draggable"), "false", "卡面 <img> 应 draggable=false");
        assert.deepEqual(errs, []);
      } finally {
        await ctx.close();
      }
    });
  }
}
