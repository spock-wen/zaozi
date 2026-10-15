// e2e E2 回归：render() 若落在「按下」与「抬起」之间，点击不能被静默吞掉。
//
// 根因（见任务 E2 说明）：renderWinter / renderEnded / renderElder 每次 render 都重设 innerHTML，
// 即便生成结果没变。若这次重绘恰落在 mousedown 与 mouseup 之间，「天亮了」等按钮的节点被换掉，
// 浏览器把 click 派发给两目标的最近公共祖先（#winter 而非按钮），closest('[data-do]') 找不到按钮，
// 那次点击就丢了：phase 停在 winter，#endseq 永不出现。
//
// 复现（与任务给出的确定性步骤一致）：到冬夜后静置 2.5s（让 650ms 飘字 / 1800ms 横幅 / 400ms defer
// 都跑完，保证「按下与抬起之间」只发生一次我们手动触发的 render）→ 移到 #winter-end 中心按下 →
// 按 Escape（触发一次 render()）→ 抬起。修复后节点不被换掉，click 正常合成，phase 到 ended。
// 对 #endseq[data-do=elder]（→ #elder 可见）与 #elder[data-do=heir]（→ #pick 可见）用同一手法复现。
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

// 按下 →（触发一次 render）→ 抬起：render 恰好落在 down 与 up 之间。
async function pressWithRenderBetween(page, sel) {
  const box = await page.locator(sel).boundingBox();
  if (!box) throw new Error(`找不到 ${sel}`);
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.keyboard.press("Escape");   // keydown Escape 会调用 render()（见 app.js）
  await page.mouse.up();
}

async function expectPhase(page, want, detail) {
  try {
    await page.waitForFunction((w) => window.__zz.st.phase === w, want, { timeout: 2000 });
  } catch { /* 由下面的断言给出可读失败信息 */ }
  assert.equal(await phase(page), want, detail);
}
async function expectVisible(page, sel, detail) {
  let ok = false;
  try { await page.locator(sel).waitFor({ state: "visible", timeout: 5000 }); ok = true; } catch {}
  assert.ok(ok, `${detail}（${sel} 应可见）`);
}

for (const [engine] of Object.entries(ENGINES)) {
  test(`${engine} 1280: render() 落在 down/up 之间也不丢点击`, async () => {
    const ctx = await browsers[engine].newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz);
      await clearTutorial(page);
      await playToWinter(page);
      assert.equal(await phase(page), "winter", "应已到冬夜");

      // ① 「天亮了」：静置等定时器跑完，再在 down 与 up 之间插入一次 render。
      await page.waitForTimeout(2500);
      await pressWithRenderBetween(page, "#winter-end");
      await expectPhase(page, "ended", "按下与抬起之间的 render 不应吞掉「天亮了」点击");
      await expectVisible(page, "#endseq", "天亮了之后应显示 #endseq");

      // ② #endseq 的「先人」：同样静置后插入 render。
      await page.waitForTimeout(2500);
      await pressWithRenderBetween(page, "#endseq [data-do=elder]");
      await expectVisible(page, "#elder", "点先人之后应显示 #elder");

      // ③ #elder 的「交给下一代」：同样插入 render。
      await page.waitForTimeout(2500);
      await pressWithRenderBetween(page, "#elder [data-do=heir]");
      await expectVisible(page, "#pick", "交棒之后应显示 #pick");

      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });
}
