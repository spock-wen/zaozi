// e2e N1 verification: 同一选项按钮上的重复点按必须被吞掉（N1 / Q5=B）。
//
// 规则（PM 决定，用户 Q5 选项 B；设计师措辞）：
//   卡飞出过程中，在**同一个**选项按钮（#opt-left / #opt-right）上、离该选项上一次点按
//   ≤10px 且间隔 ≤70ms 的第二次点按是重复点击 → 整次吞掉，不提交、不入队。
// 窄护栏：点在**另一个**选项上、同选项但偏离 >10px、或间隔 >70ms，都不归 N1 管，
// 照原路走（本分支上由 inputBusy() 的飞出闭锁挡下）。
//
// 观测手段：window.__zz.n1Swallowed / window.__zz.n1Reason（N1 自己的计数器与原因），
// 与 window.__zz.actions（真实提交）分开——这样能区分「这一下是 N1 吞的」还是「inputBusy 挡的」。
//
// 触屏用例全部用真实 page.touchscreen.tap(x, y)（按 #opt-left / #opt-right 的实测坐标），
// 另加一个 1280x800 桌面鼠标用例。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";

buildDist();

let server;
const browsers = {};

before(async () => {
  server = await startServer();
  for (const [name, type] of Object.entries(ENGINES)) browsers[name] = await type.launch();
});

after(async () => {
  for (const b of Object.values(browsers)) await b.close();
  server?.close();
});

const box = (page, sel) => page.locator(sel).boundingBox();
const ctr = (b, dx = 0, dy = 0) => [b.x + b.width / 2 + dx, b.y + b.height / 2 + dy];

// 新开一局（清存档 → 重载 → 等卡稳住 → T01），并装上点按记录器：
// 记下每次真的落在选项按钮上的 pointerdown/pointerup（坐标 + performance.now()），
// 用来量出两次点按的真实间距/时差，证明用例真的落在 N1 的判定窗口里。
async function fresh(page) {
  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__zz && document.body.dataset.cardReady === "1", null, { timeout: 10000 });
  await page.evaluate(() => {
    window.__taps = [];
    for (const sel of ["#opt-left", "#opt-right"]) {
      const el = document.querySelector(sel);
      el.addEventListener("pointerdown", (e) => window.__taps.push({ ev: "down", sel, x: e.clientX, y: e.clientY, t: performance.now() }));
      el.addEventListener("pointerup", (e) => window.__taps.push({ ev: "up", sel, x: e.clientX, y: e.clientY, t: performance.now() }));
    }
  });
  assert.equal(await page.evaluate(() => window.__zz.st.current), "T01", "开局应为 T01");
}

// 等这一次提交走完（卡稳住、推进到目标卡），再多等一会儿让可能迟到的合成 click 也落地，
// 再读计数——避免「恰好 1 次」被一个晚到的 click 打脸。
async function settleAt(page, cur) {
  await page.waitForFunction(
    (c) => document.body.dataset.cardReady === "1" && window.__zz.st.current === c && !window.__zz.animating,
    cur,
    { timeout: 8000 },
  );
  await page.waitForTimeout(400);
}

// 两次点按之间只隔一个 waitForTimeout，尽量贴近真实时差；用页面里记下的时间算真实 dt/d。
async function tapGap(page) {
  const taps = await page.evaluate(() => window.__taps.filter((t) => t.ev === "up"));
  assert.ok(taps.length >= 2, `应至少有两次选项 pointerup，实际 ${JSON.stringify(taps)}`);
  const [a, b] = taps;
  const dt = b.t - a.t;
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  return { dt, d, taps };
}

const readState = (page) => page.evaluate(() => ({
  actions: window.__zz.actions.length,
  cur: window.__zz.st.current,
  n1: window.__zz.n1Swallowed,
  reason: window.__zz.n1Reason,
}));

// 触屏（390×844，hasTouch）下的四类点按 + 桌面鼠标（1280×800）的一类。

// (a) 同一选项、同一点（以及 +6px），30ms 间隔 → 只提交 1 次，卡只推进一次，N1 吞 1 次
for (const [engine] of Object.entries(ENGINES)) {
  for (const off of [0, 6]) {
    test(`${engine} 390x844 touch: (a) two taps on #opt-left, same point${off ? ` +${off}px` : ""}, 30ms apart → 1 action, n1Swallowed 1`, async () => {
      const ctx = await browsers[engine].newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);

      try {
        await fresh(page);
        const L = await box(page, "#opt-left");
        const [x, y] = ctr(L, off);

        await page.touchscreen.tap(x, y);
        await page.waitForTimeout(30);
        await page.touchscreen.tap(x, y);

        const { dt, d } = await tapGap(page);
        assert.ok(dt <= 70, `两次点按的真实时差应 ≤70ms（N1 窗口），实际 ${dt.toFixed(1)}ms`);
        assert.ok(d <= 10, `两次点按的真实间距应 ≤10px（N1 窗口），实际 ${d.toFixed(1)}px`);

        await settleAt(page, "T02");

        const s = await readState(page);
        assert.equal(s.actions, 1, `应恰好提交 1 次动作，实际为 ${s.actions}`);
        assert.equal(s.cur, "T02", `卡面应推进到 T02，实际为 ${s.cur}`);
        assert.equal(s.n1, 1, `N1 应吞掉第 2 下（n1Swallowed=1），实际为 ${s.n1}`);
        assert.match(String(s.reason), /^n1:same-option /, `原因应标明是 N1 吞的，实际为 ${s.reason}`);
        assert.deepEqual(errs, [], "页面不应有未捕获异常");
      } finally {
        await ctx.close();
      }
    });
  }

  // (b) 先点左、30ms 内再点右 → 不是同一个选项，N1 不管
  test(`${engine} 390x844 touch: (b) tap #opt-left then #opt-right within 30ms → n1Swallowed unchanged`, async () => {
    const ctx = await browsers[engine].newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);

    try {
      await fresh(page);
      const L = await box(page, "#opt-left");
      const R = await box(page, "#opt-right");

      await page.touchscreen.tap(ctr(L)[0], ctr(L)[1]);
      await page.waitForTimeout(30);
      await page.touchscreen.tap(ctr(R)[0], ctr(R)[1]);

      const { dt } = await tapGap(page);
      assert.ok(dt <= 70, `两次点按的真实时差应 ≤70ms，实际 ${dt.toFixed(1)}ms`);

      await settleAt(page, "T02");

      const s = await readState(page);
      assert.equal(s.actions, 1, `应只提交 1 次动作（右侧那一下由 inputBusy 挡下），实际为 ${s.actions}`);
      assert.equal(s.cur, "T02", `卡面应推进到 T02，实际为 ${s.cur}`);
      assert.equal(s.n1, 0, `点在另一个选项上，N1 不应吞（n1Swallowed=0），实际为 ${s.n1}`);
      assert.equal(s.reason, null, `N1 不应留下原因，实际为 ${s.reason}`);
      assert.deepEqual(errs, [], "页面不应有未捕获异常");
    } finally {
      await ctx.close();
    }
  });

  // (c) 同一选项但偏 14px（>10px），30ms 间隔 → N1 不管
  test(`${engine} 390x844 touch: (c) two taps on #opt-left 14px apart within 30ms → n1Swallowed unchanged`, async () => {
    const ctx = await browsers[engine].newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);

    try {
      await fresh(page);
      const L = await box(page, "#opt-left");
      const [x, y] = ctr(L);

      await page.touchscreen.tap(x, y);
      await page.waitForTimeout(30);
      await page.touchscreen.tap(x + 14, y);

      const { dt, d } = await tapGap(page);
      assert.ok(dt <= 70, `两次点按的真实时差应 ≤70ms，实际 ${dt.toFixed(1)}ms`);
      assert.ok(d > 10, `两次点按的真实间距应 >10px（跳出 N1 窗口），实际 ${d.toFixed(1)}px`);

      await settleAt(page, "T02");

      const s = await readState(page);
      assert.equal(s.actions, 1, `应只提交 1 次动作，实际为 ${s.actions}`);
      assert.equal(s.cur, "T02", `卡面应推进到 T02，实际为 ${s.cur}`);
      assert.equal(s.n1, 0, `偏 14px 超出 N1 的 10px，不应吞（n1Swallowed=0），实际为 ${s.n1}`);
      assert.equal(s.reason, null, `N1 不应留下原因，实际为 ${s.reason}`);
      assert.deepEqual(errs, [], "页面不应有未捕获异常");
    } finally {
      await ctx.close();
    }
  });

  // (d) 同一选项、同一点，但隔 150ms（>70ms）→ N1 不管
  test(`${engine} 390x844 touch: (d) two taps on #opt-left, same point, 150ms apart → n1Swallowed unchanged`, async () => {
    const ctx = await browsers[engine].newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);

    try {
      await fresh(page);
      const L = await box(page, "#opt-left");
      const [x, y] = ctr(L);

      await page.touchscreen.tap(x, y);
      await page.waitForTimeout(150);
      await page.touchscreen.tap(x, y);

      const { dt } = await tapGap(page);
      assert.ok(dt > 70, `两次点按的真实时差应 >70ms（跳出 N1 窗口），实际 ${dt.toFixed(1)}ms`);

      await settleAt(page, "T02");

      const s = await readState(page);
      assert.equal(s.actions, 1, `应只提交 1 次动作（第 2 下仍由 inputBusy 挡下），实际为 ${s.actions}`);
      assert.equal(s.cur, "T02", `卡面应推进到 T02，实际为 ${s.cur}`);
      assert.equal(s.n1, 0, `隔 150ms 超出 N1 的 70ms，不应吞（n1Swallowed=0），实际为 ${s.n1}`);
      assert.equal(s.reason, null, `N1 不应留下原因，实际为 ${s.reason}`);
      assert.deepEqual(errs, [], "页面不应有未捕获异常");
    } finally {
      await ctx.close();
    }
  });
}

// 桌面鼠标 1280×800：同样只验证核心的 (a)——同一点双击 30ms 内只提交一次、N1 吞一次。
for (const [engine] of Object.entries(ENGINES)) {
  test(`${engine} 1280x800 mouse: (a) two clicks on #opt-left, same point, 30ms apart → 1 action, n1Swallowed 1`, async () => {
    const ctx = await browsers[engine].newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);

    try {
      await fresh(page);
      const L = await box(page, "#opt-left");
      const [x, y] = ctr(L);

      await page.mouse.click(x, y);
      await page.waitForTimeout(30);
      await page.mouse.click(x, y);

      const { dt, d } = await tapGap(page);
      assert.ok(dt <= 70, `两次点按的真实时差应 ≤70ms（N1 窗口），实际 ${dt.toFixed(1)}ms`);
      assert.ok(d <= 10, `两次点按的真实间距应 ≤10px（N1 窗口），实际 ${d.toFixed(1)}px`);

      await settleAt(page, "T02");

      const s = await readState(page);
      assert.equal(s.actions, 1, `应恰好提交 1 次动作，实际为 ${s.actions}`);
      assert.equal(s.cur, "T02", `卡面应推进到 T02，实际为 ${s.cur}`);
      assert.equal(s.n1, 1, `N1 应吞掉第 2 下（n1Swallowed=1），实际为 ${s.n1}`);
      assert.match(String(s.reason), /^n1:same-option /, `原因应标明是 N1 吞的，实际为 ${s.reason}`);
      assert.deepEqual(errs, [], "页面不应有未捕获异常");
    } finally {
      await ctx.close();
    }
  });
}
