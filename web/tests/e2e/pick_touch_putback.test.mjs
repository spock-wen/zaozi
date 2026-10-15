// e2e 回归 P1-1（触屏放回一次放回两个字）+ P2-1（多点触控）。
//
// 根因：挑字屏原来用 innerHTML 整块重建候选/格子/出发键。触屏 tap 已选格子时，pointerup 放回「水」
// 后立刻重绘，同一格补进「日」；浏览器随后合成的 click 按坐标命中「日」，旧的吞点击逻辑比较字
// （日≠水）没吞，于是又放回一次。修法：渲染改成就地补丁（节点只建一次、只改 class/文本），
// 指针按 pointerId + 每次按下的 token 区分与去重，不再比较字。
//
// 覆盖（390 触屏、三引擎）：
//   1. 填满三格 → 点第 1 格 → 恰好放回一个字；
//   2. 点已选候选 → 恰好放回一个字；
//   3. 选满后点「出发」→ begin_generation 恰好一次；
//   4.（chromium，CDP 双指）两指同时按两个已选候选 → 各放回一个、互不取消/劫持；其它引擎跳过。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";
import { toPick } from "./helpers/flow.mjs";

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

const touchCtx = (engine) => browsers[engine].newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
const picksOf = (page) => page.evaluate(() => window.__zz.st.picks || []);
const genCount = (page) => page.evaluate(() => (window.__zz.actions || []).filter((a) => a.type === "begin_generation").length);
const toggleCount = (page) => page.evaluate(() => (window.__zz.actions || []).filter((a) => a.type === "pick_toggle").length);
const tapChar = (page, ch) => page.locator(`#pick .cand[data-char='${ch}']`).tap();
// 两步挑字：同一字点两下才入格（第一下看说明、第二下带上）。
async function addChar(page, ch) { await tapChar(page, ch); await tapChar(page, ch); }

async function openPick(engine) {
  const ctx = await touchCtx(engine);
  const page = await ctx.newPage();
  const errs = [];
  collectErrors(page, errs);
  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__zz);
  await toPick(page);
  assert.equal(await page.evaluate(() => document.body.dataset.view), "mobile", "390 应为手机档");
  return { ctx, page, errs };
}

// ---------- 1/2/3：放回只放回一个；出发键只触发一次 ----------

for (const [engine] of Object.entries(ENGINES)) {
  test(`${engine} 390 touch: 点格子/候选各只放回一个字，出发键只触发一次`, async () => {
    const { ctx, page, errs } = await openPick(engine);
    try {
      await addChar(page, "水");
      await addChar(page, "日");
      await addChar(page, "人");
      const full = await picksOf(page);
      assert.deepEqual(full, ["水", "日", "人"], "应已填满三格");
      assert.ok(await page.locator("#pick .go").isEnabled(), "选满后出发键应可用");

      // 点第 1 格（水）→ 恰好放回一个字（修复前会连「日」一起放回）。
      await page.locator("#pick .pickslot[data-char='水']").tap();
      const afterSlot = await picksOf(page);
      assert.equal(full.length - afterSlot.length, 1, `点格子应恰好放回一个字：${JSON.stringify(full)} → ${JSON.stringify(afterSlot)}`);
      assert.deepEqual(afterSlot, ["日", "人"], "点格子后应只剩 日、人");

      // 点已选候选（日）→ 恰好再放回一个字。
      await page.locator("#pick .cand.sel[data-char='日']").tap();
      const afterCand = await picksOf(page);
      assert.equal(afterSlot.length - afterCand.length, 1, `点已选候选应恰好放回一个字：${JSON.stringify(afterSlot)} → ${JSON.stringify(afterCand)}`);
      assert.deepEqual(afterCand, ["人"], "点已选候选后应只剩 人");

      // 重新填满，点出发键 → begin_generation 恰好一次。
      await addChar(page, "日");
      await addChar(page, "木");
      assert.equal((await picksOf(page)).length, 3, "应重新填满三格");
      assert.equal(await genCount(page), 0, "点出发前不应有 begin_generation");
      await page.locator("#pick .go").tap();
      await page.waitForFunction(() => window.__zz.st.generation === 2, null, { timeout: 5000 });
      assert.equal(await genCount(page), 1, "出发键应恰好触发一次 begin_generation");
      assert.equal(await page.evaluate(() => window.__zz.st.phase), "card", "出发后应进入卡面阶段");

      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });
}

// ---------- 4/5：多点触控（仅 chromium 有 CDP 多点触控） ----------

// 两指同时按下 → 稍候 → 两指同时抬起（CDP Input.dispatchTouchEvent）。
// 按下时记下的字在抬起时才动作；同时抬起会先后触发两指的 pointerup。
async function twoFingerTapAt(page, selectors) {
  const pts = [];
  for (const sel of selectors) {
    const box = await page.locator(sel).boundingBox();
    if (!box) throw new Error(`找不到 ${sel}`);
    pts.push({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
  }
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: i + 1, radiusX: 1, radiusY: 1, force: 1 })),
    });
    await page.waitForTimeout(50);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(50);
  } finally {
    await cdp.detach();
  }
}
const cand = (ch) => `#pick .cand[data-char='${ch}']`;
const slot = (i) => `#pick .pickslot[data-slot='${i}']`;

test("chromium 390 touch: 双指同时按两个已选候选，各自只放回一个字", {
  skip: ENGINES.chromium ? false : "仅 chromium 支持 CDP 多点触控（其它引擎跳过）",
}, async () => {
  const { ctx, page, errs } = await openPick("chromium");
  try {
    await addChar(page, "水");
    await addChar(page, "木");
    assert.deepEqual(await picksOf(page), ["水", "木"], "应已选中 水、木");

    const before = await toggleCount(page);
    await twoFingerTapAt(page, [cand("水"), cand("木")]);
    // 两指各自 pointerup 各放回一个：最终为空。（修复前 pickPtr 只留后一指，两指都会丢。）
    try {
      await page.waitForFunction(() => (window.__zz.st.picks || []).length === 0, null, { timeout: 2000 });
    } catch { /* 下面的断言给出细节 */ }
    const after = await picksOf(page);
    const toggles = (await toggleCount(page)) - before;
    assert.deepEqual(after, [], `双指各放回一个后应为空，实际 ${JSON.stringify(after)}`);
    assert.equal(toggles, 2, `应恰好两次放回（每指一次），实际 ${toggles}`);

    assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
  } finally {
    await ctx.close();
  }
});

// D1：两指同时按第 1、3 格（水、人），同时松开。头一指放回「水」后格子就地补位
// （日→第 1 格、人→第 2 格、第 3 格变空），后一指的 pointerup 命中同一个已空的第 3 格节点。
// 修复前读抬起时节点内容 → 第 3 格没 data-char → 漏放回，剩「日,人」；修后应按按下时记下的「人」放回，剩「日」。
test("chromium 390 touch: 双指同时按第 1、3 格再同时松开，各放回一个字（D1）", {
  skip: ENGINES.chromium ? false : "仅 chromium 支持 CDP 多点触控（其它引擎跳过）",
}, async () => {
  const { ctx, page, errs } = await openPick("chromium");
  try {
    await addChar(page, "水");
    await addChar(page, "日");
    await addChar(page, "人");
    assert.deepEqual(await picksOf(page), ["水", "日", "人"], "应已填满三格");

    const before = await toggleCount(page);
    await twoFingerTapAt(page, [slot(0), slot(2)]);
    try {
      await page.waitForFunction(() => (window.__zz.st.picks || []).length === 1, null, { timeout: 2000 });
    } catch { /* 下面的断言给出细节 */ }
    const after = await picksOf(page);
    const toggles = (await toggleCount(page)) - before;
    assert.deepEqual(after, ["日"], `两指各放回自己那个字后应只剩 日，实际 ${JSON.stringify(after)}`);
    assert.equal(toggles, 2, `应恰好两次放回（每指一次），实际 ${toggles}`);

    assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
  } finally {
    await ctx.close();
  }
});
