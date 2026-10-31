// e2e N1 验证（R05 / PM U1 裁定 + P1、P1 补）：
//   飞卡途中，在**同一个**选项按钮（#opt-left / #opt-right）上、落点离「启动这次飞卡的那一下」
//   ≤10px 的点按整次吞掉——不提交、不入队，**没有时间窗**（70ms 已删；150ms / 250ms 同点也必须吞，
//   就是防 70ms 窗回来）。
//   参照点只由「用户直接点选项按钮、当下起飞」的那一下设置：键盘（←/→/Enter/1–3）、拖拽松手、
//   点字格启动的飞卡都不设参照点，途中点选项一律按 R06 走（PM P1 / P1 补）。
//
// 观测手段（都与 window.__zz.actions 分开，用来区分「这一下是谁处理的」）：
//   window.__zz.n1Swallowed / n1Reason —— N1 自己的计数器与原因；
//   window.__zz.n1Ref —— 当前这次飞卡的 N1 参照点（null = N1 不生效）；
//   window.__zz.animating / busy —— rAF 飞出阶段 / 飞出+落定回位（cardEntryBusy）阶段，
//     用来证明「第二下真的落在这次飞卡还没结束的时候」。
//
// 本分支没有输入队列（PR9 才有，R20）：飞出过程中的第二下若没被 N1 吞掉，就由 inputBusy()
// 的飞出闭锁挡下——所以「不吞」的用例只能验到「n1Swallowed 不变 + 只交一张」，
// 「排队作用到下一张」要等 PR9 合进来才能验（见 n1r_summary.md）。
//
// 触屏用例全部用真实 page.touchscreen.tap(x, y)（390×844 + hasTouch），桌面用 page.mouse.click
// （1280×800）；坐标一律取 #opt-left / #opt-right 的实测 boundingBox() 中心。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";
import { passCutscene } from "./helpers/flow.mjs";

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
const tap = (page, x, y, touch) => (touch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));

// 新开一局（清存档 → 重载 → 等卡稳住 → T01），并装点按记录器：每次真的落在选项按钮上的
// pointerdown / pointerup 都记一条（坐标 + performance.now() + 那一刻的 animating / busy / n1Ref），
// 用例据此量出两次点按的真实间距，并证明第二下确实落在这次飞卡还没结束的时候。
async function fresh(page) {
  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  // 卡稳住。本分支看 data-card-ready / __zz.busy；base b0c7b5d 两个钩子都没有（没有入场闭锁），
  // 退化到 `!animating`——同一条用例要能在 base 上跑出「过 / 不过」的结论（R24）。
  await page.waitForFunction(
    () => !!window.__zz && window.__zz.st.current === "T01" && !window.__zz.animating
      && (window.__zz.st.phase !== "card" || window.__zz.busy !== true),
    null, { timeout: 10000 },
  );
  await page.evaluate(() => {
    window.__taps = [];
    for (const sel of ["#opt-left", "#opt-right"]) {
      const el = document.querySelector(sel);
      for (const ev of ["pointerdown", "pointerup"]) {
        el.addEventListener(ev, (e) => window.__taps.push({
          ev: ev === "pointerdown" ? "down" : "up", sel, x: e.clientX, y: e.clientY, t: performance.now(),
          anim: window.__zz.animating, busy: window.__zz.busy, n1: window.__zz.n1Ref ? 1 : 0,
        }));
      }
    }
  });
  assert.equal(await page.evaluate(() => window.__zz.st.current), "T01", "开局应为 T01");
}

// 只取按下事件（点按的「落点」）
const downs = (page) => page.evaluate(() => window.__taps.filter((t) => t.ev === "down"));
const gapOf = (ds) => {
  // base b0c7b5d 的 1280×800 上，交卡后 #card 会盖住选项按钮（elementFromPoint 命中 #card），
  // 第二下根本落不到选项上——这时也要给出能看懂的失败原因。
  assert.ok(ds.length >= 2, `应有两次选项按下，实际 ${ds.length} 次：${JSON.stringify(ds)}`);
  return { dt: ds[1].t - ds[0].t, d: Math.hypot(ds[1].x - ds[0].x, ds[1].y - ds[0].y) };
};
const sinceStart = (ds) => performance.now() - ds[0].t;   // 仅用于日志，页面内已由 waitForFunction 判定

// 等这一次提交走完（卡稳住），再多等一会儿让可能迟到的合成 click 也落地，
// 再读计数——避免「恰好 1 次」被一个晚到的 click 打脸。
// 不要求 phase==="card"：T03 是「开局即进刻字阶段」的卡，落到它上面时 phase 是 engrave。
async function settle(page, cur) {
  await page.waitForFunction(
    (c) => window.__zz.st.current === c && !window.__zz.animating
      && (window.__zz.st.phase !== "card" || window.__zz.busy !== true),
    cur,
    { timeout: 10000 },
  );
  await page.waitForTimeout(400);
  await passCutscene(page);
}

const readState = (page) => page.evaluate(() => ({
  actions: window.__zz.actions.length,
  cur: window.__zz.st.current,
  n1: window.__zz.n1Swallowed,
  reason: window.__zz.n1Reason,
  ref: window.__zz.n1Ref,
  queued: window.__zz.queued,
}));

// 「N1 吞了第 2 下」：计数器、原因、只交一张，三件套一起验。
function assertSwallowedOnce(s, msg) {
  assert.equal(s.n1, 1, `${msg}：N1 应吞掉第 2 下（n1Swallowed=1），实际为 ${s.n1}`);
  assert.match(String(s.reason), /^n1:same-option d=/, `${msg}：原因应标明是 N1 吞的，实际为 ${s.reason}`);
  assert.equal(s.ref, null, `${msg}：飞卡结束后参照点应失效（n1Ref=null），实际为 ${JSON.stringify(s.ref)}`);
}

// 「N1 没管这一下」：计数器必须是 0（base b0c7b5d 上没有这个调试钩子，typeof 不是 number，
// 那时跳过计数器只验行为）。但 base 上这些用例仍然失败——base 既没有 N1 也没有飞出闭锁
// （inputBusy），第二下会真的多交一张卡；只有 (h)「点字格不启动 N1」在 base 上也过得去，
// 所以全文件只有 (h) 带 [regression guard]（R24）。
function assertNotSwallowed(s, msg) {
  if (typeof s.n1 === "number") {
    assert.equal(s.n1, 0, `${msg}：N1 不应吞（n1Swallowed=0），实际为 ${s.n1}`);
    assert.equal(s.reason, null, `${msg}：N1 不应留下原因，实际为 ${s.reason}`);
  }
}

// 「没有 N1 参照点」：本分支一定有这个钩子；base b0c7b5d 上没有（undefined），那时跳过。
function assertNoN1Ref(s, msg) {
  if (typeof s.ref !== "undefined") {
    assert.equal(s.ref, null, `${msg}：不应有 N1 参照点（n1Ref=null），实际为 ${JSON.stringify(s.ref)}`);
  }
}

// 第二下必须真的落在「这次飞卡还没结束」的时候，否则用例造不出条件。
// busy = animating || 落定回位（cardEntryBusy）；base b0c7b5d 上没有这个钩子，那时只验 animating
// （want.anim 给了就验），好让 base 上的失败落在真正的行为差异上（base 会多交一张卡）。
function assertInsideFlyout(t2, msg, want = {}) {
  if (typeof t2.busy === "boolean") {
    assert.equal(t2.busy, true,
      `${msg}：第 2 下应落在这次飞卡还没结束的时候（busy=true），实际 anim=${t2.anim} busy=${t2.busy}`);
  }
  if (want.anim !== undefined) {
    assert.equal(t2.anim, want.anim,
      `${msg}：第 2 下应${want.anim ? "在 rAF 飞出阶段" : "在落定回位阶段"}（animating=${want.anim}），实际 anim=${t2.anim}`);
  }
}

// ============================================================ 触屏 390×844（hasTouch）
for (const [engine] of Object.entries(ENGINES)) {
  const VP = { viewport: { width: 390, height: 844 }, hasTouch: true };

  // (a) 点选项起飞 → 同选项 +4px 第二下：只交 1 张，N1 吞 1 次
  test(`${engine} 390x844 touch: (a) option-started fly-out, 2nd tap same option +4px → 1 action, n1Swallowed 1`, async () => {
    const ctx = await browsers[engine].newContext(VP);
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await fresh(page);
      const L = await box(page, "#opt-left");
      const [x, y] = ctr(L);

      await tap(page, x, y, true);
      await page.waitForTimeout(60);
      await tap(page, x + 4, y, true);

      const ds = await downs(page);
      assert.equal(ds.length, 2, `应有两次选项按下，实际 ${ds.length}`);
      const { dt, d } = gapOf(ds);
      assert.ok(d > 3 && d <= 10, `两次点按的真实间距应 >3 且 ≤10px（N1 窗口），实际 ${d.toFixed(1)}px`);
      assertInsideFlyout(ds[1], "(a)", { anim: true });   // ~100ms：还在 rAF 飞出阶段

      await settle(page, "T02");
      const s = await readState(page);
      assert.equal(s.actions, 1, `应恰好提交 1 次动作，实际为 ${s.actions}`);
      assert.equal(s.cur, "T02", `卡面应推进到 T02，实际为 ${s.cur}`);
      assertSwallowedOnce(s, "(a)");
      assert.deepEqual(errs, [], "页面不应有未捕获异常");
    } finally {
      await ctx.close();
    }
  });

  // (b) 同一落点、隔 150ms（>任何时间窗）→ 仍吞
  test(`${engine} 390x844 touch: (b) same point 150ms after the start tap (still flying) → swallowed`, async () => {
    const ctx = await browsers[engine].newContext(VP);
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await fresh(page);
      const L = await box(page, "#opt-left");
      const [x, y] = ctr(L);

      await tap(page, x, y, true);
      // 等「起飞已过 150ms 且仍在 rAF 飞出阶段」再点——150ms 远超任何 70ms 窗
      await page.waitForFunction(
        () => window.__zz.animating && performance.now() - window.__taps.filter((t) => t.ev === "down")[0].t >= 150,
        null, { timeout: 8000 },
      );
      await tap(page, x, y, true);

      const ds = await downs(page);
      const { dt, d } = gapOf(ds);
      assert.ok(dt >= 150, `两次点按的真实时差应 ≥150ms（没有时间窗），实际 ${dt.toFixed(1)}ms`);
      assert.ok(d <= 10, `两次点按的真实间距应 ≤10px，实际 ${d.toFixed(1)}px`);
      assertInsideFlyout(ds[1], "(b)150", { anim: true });
      console.log(`    [n1] ${engine} (b)150ms: dt=${dt.toFixed(0)}ms d=${d.toFixed(1)}px anim=${ds[1].anim} busy=${ds[1].busy}`);

      await settle(page, "T02");
      const s = await readState(page);
      assert.equal(s.actions, 1, `应恰好提交 1 次动作，实际为 ${s.actions}`);
      assert.equal(s.cur, "T02", `卡面应推进到 T02，实际为 ${s.cur}`);
      assertSwallowedOnce(s, "(b)150");
      assert.deepEqual(errs, [], "页面不应有未捕获异常");
    } finally {
      await ctx.close();
    }
  });

  // (b) 同一落点、rAF 飞出已结束但卡还在落定回位（cardEntryBusy）时 → 仍吞
  test(`${engine} 390x844 touch: (b) same point ~250ms after the start tap (fly-out done, card still settling) → swallowed`, async () => {
    const ctx = await browsers[engine].newContext(VP);
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await fresh(page);
      const L = await box(page, "#opt-left");
      const [x, y] = ctr(L);

      await tap(page, x, y, true);
      // 等 rAF 飞出结束、卡还在回位的那一段再点（实测飞卡总长约 380–400ms：rAF 240ms + 回位 160ms）。
      // base 上没有回位这一段，退化到「已交卡且 animating 结束」。
      await page.waitForFunction(
        () => window.__zz.actions.length >= 1 && !window.__zz.animating && (window.__zz.busy ?? true) === true,
        null, { timeout: 8000 },
      );
      await tap(page, x, y, true);

      const ds = await downs(page);
      const { dt, d } = gapOf(ds);
      // ~250ms：rAF 飞出（240ms）已结束、卡还在回位。下界只卡「远超任何 70ms 窗」，
      // 「rAF 已结束」由下面 assertInsideFlyout 的 anim===false 精确证明（引擎间有一两 ms 抖动）。
      assert.ok(dt > 150, `两次点按的真实时差应 >150ms（实测约 250ms），实际 ${dt.toFixed(1)}ms`);
      assert.ok(d <= 10, `两次点按的真实间距应 ≤10px，实际 ${d.toFixed(1)}px`);
      assertInsideFlyout(ds[1], "(b)250", { anim: false });
      console.log(`    [n1] ${engine} (b)250ms: dt=${dt.toFixed(0)}ms d=${d.toFixed(1)}px anim=${ds[1].anim} busy=${ds[1].busy}`);

      await settle(page, "T02");
      const s = await readState(page);
      assert.equal(s.actions, 1, `应恰好提交 1 次动作，实际为 ${s.actions}`);
      assert.equal(s.cur, "T02", `卡面应推进到 T02，实际为 ${s.cur}`);
      assertSwallowedOnce(s, "(b)250");
      assert.deepEqual(errs, [], "页面不应有未捕获异常");
    } finally {
      await ctx.close();
    }
  });

  // (b) 这次飞卡的最后时刻（回位即将结束）→ 仍吞
  test(`${engine} 390x844 touch: (b) same point at the last moment still inside the fly-out → swallowed`, async () => {
    const ctx = await browsers[engine].newContext(VP);
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await fresh(page);
      const L = await box(page, "#opt-left");
      const [x, y] = ctr(L);

      await tap(page, x, y, true);
      // 飞到 ~330ms 以后再点：已过 rAF 阶段、也逼近回位结束，只要 busy 还挂着就吞
      await page.waitForFunction(
        () => (window.__zz.busy ?? true) === true
          && performance.now() - window.__taps.filter((t) => t.ev === "down")[0].t > 330,
        null, { timeout: 8000 },
      );
      await tap(page, x, y, true);

      const ds = await downs(page);
      const { d } = gapOf(ds);
      assert.ok(d <= 10, `两次点按的真实间距应 ≤10px，实际 ${d.toFixed(1)}px`);
      assertInsideFlyout(ds[1], "(b)last");
      console.log(`    [n1] ${engine} (b)last: dt=${(ds[1].t - ds[0].t).toFixed(0)}ms d=${d.toFixed(1)}px anim=${ds[1].anim} busy=${ds[1].busy}`);

      await settle(page, "T02");
      const s = await readState(page);
      assert.equal(s.actions, 1, `应恰好提交 1 次动作，实际为 ${s.actions}`);
      assert.equal(s.cur, "T02", `卡面应推进到 T02，实际为 ${s.cur}`);
      assertSwallowedOnce(s, "(b)last");
      assert.deepEqual(errs, [], "页面不应有未捕获异常");
    } finally {
      await ctx.close();
    }
  });

  // (c) 飞卡途中点另一个选项 → N1 不管（R06）；排队并在落定后作用到下一张（T02 → T03，2 actions）
  test(`${engine} 390x844 touch: (c) tap the OTHER option during the fly-out → n1Swallowed unchanged, 2 actions queued`, async () => {
    const ctx = await browsers[engine].newContext(VP);
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await fresh(page);
      const L = await box(page, "#opt-left");
      const R = await box(page, "#opt-right");
      const [lx, ly] = ctr(L);
      const [rx, ry] = ctr(R);

      await tap(page, lx, ly, true);
      await page.waitForTimeout(150);
      await tap(page, rx, ry, true);

      const ds = await downs(page);
      assert.equal(ds[1].sel, "#opt-right", `第 2 下应落在右选项上，实际 ${ds[1].sel}`);
      assertInsideFlyout(ds[1], "(c)");

      await settle(page, "T03");
      const s = await readState(page);
      assert.equal(s.actions, 2, `应提交 2 次动作（第 2 下入队后作用到下一张），实际为 ${s.actions}`);
      assert.equal(s.cur, "T03", `卡面应推进到 T03，实际为 ${s.cur}`);
      assertNotSwallowed(s, "(c)");
      assert.deepEqual(errs, [], "页面不应有未捕获异常");
    } finally {
      await ctx.close();
    }
  });

  // (d) 飞卡途中同选项但偏 14px（>10px）→ N1 不管（R06）；排队作用到下一张（T02 → T03，2 actions）
  test(`${engine} 390x844 touch: (d) 2nd tap same option 14px away during the fly-out → n1Swallowed unchanged, 2 actions queued`, async () => {
    const ctx = await browsers[engine].newContext(VP);
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await fresh(page);
      const L = await box(page, "#opt-left");
      const [x, y] = ctr(L);

      await tap(page, x, y, true);
      await page.waitForTimeout(60);
      await tap(page, x + 14, y, true);

      const ds = await downs(page);
      const { d } = gapOf(ds);
      assert.ok(d > 10, `两次点按的真实间距应 >10px（跳出 N1 窗口），实际 ${d.toFixed(1)}px`);
      assertInsideFlyout(ds[1], "(d)", { anim: true });

      await settle(page, "T03");
      const s = await readState(page);
      assert.equal(s.actions, 2, `应提交 2 次动作（第 2 下入队后作用到下一张），实际为 ${s.actions}`);
      assert.equal(s.cur, "T03", `卡面应推进到 T03，实际为 ${s.cur}`);
      assertNotSwallowed(s, "(d)");
      assert.deepEqual(errs, [], "页面不应有未捕获异常");
    } finally {
      await ctx.close();
    }
  });

  // (e) 键盘（ArrowLeft ×2：预览 → 提交）起飞的飞卡 → N1 没有参照点，途中点选项不吞（P1）；排队作用到下一张
  test(`${engine} 390x844 touch: (e) keyboard-started fly-out (ArrowLeft x2) then tap the option → n1Swallowed unchanged, 2 actions queued`, async () => {
    const ctx = await browsers[engine].newContext(VP);
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await fresh(page);
      await page.keyboard.press("ArrowLeft");          // 第一次：只预览
      await page.waitForTimeout(50);
      await page.keyboard.press("ArrowLeft");          // 第二次：提交 → 起飞
      await page.waitForFunction(
        () => window.__zz.busy === true || window.__zz.animating === true, null, { timeout: 8000 },
      );
      assert.equal(await page.evaluate(() => window.__zz.n1Ref ?? null), null,
        "键盘起飞的飞卡不应设 N1 参照点（P1）");

      const L = await box(page, "#opt-left");
      const [x, y] = ctr(L);
      await tap(page, x, y, true);

      const ds = await downs(page);
      assertInsideFlyout(ds[0], "(e)");

      await settle(page, "T03");
      const s = await readState(page);
      assert.equal(s.actions, 2, `应提交 2 次动作（途中点选项入队后作用到下一张），实际为 ${s.actions}`);
      assert.equal(s.cur, "T03", `卡面应推进到 T03，实际为 ${s.cur}`);
      assertNotSwallowed(s, "(e)");
      assert.deepEqual(errs, [], "页面不应有未捕获异常");
    } finally {
      await ctx.close();
    }
  });

  // (f) 拖拽松手起飞的飞卡 → N1 没有参照点，途中点选项不吞（P1）；排队作用到下一张
  test(`${engine} 390x844 touch: (f) drag-release-started fly-out then tap the option → n1Swallowed unchanged, 2 actions queued`, async () => {
    const ctx = await browsers[engine].newContext(VP);
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await fresh(page);
      const card = await box(page, "#card");
      const cx = card.x + card.width / 2, cy = card.y + card.height / 2;
      const thr = 0.35 * card.width;                   // DRAG_RATIO = 0.35
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      for (let k = 1; k <= 6; k++) { await page.mouse.move(cx - thr * 1.2 * k / 6, cy); await page.waitForTimeout(16); }
      await page.mouse.up();
      await page.waitForFunction(
        () => window.__zz.busy === true || window.__zz.animating === true, null, { timeout: 8000 },
      );
      assert.equal(await page.evaluate(() => window.__zz.n1Ref ?? null), null,
        "拖拽松手起飞的飞卡不应设 N1 参照点（P1）");

      const L = await box(page, "#opt-left");
      const [x, y] = ctr(L);
      await tap(page, x, y, true);

      const ds = await downs(page);
      assertInsideFlyout(ds[0], "(f)");

      await settle(page, "T03");
      const s = await readState(page);
      assert.equal(s.actions, 2, `应提交 2 次动作（途中点选项入队后作用到下一张），实际为 ${s.actions}`);
      assert.equal(s.cur, "T03", `卡面应推进到 T03，实际为 ${s.cur}`);
      assertNotSwallowed(s, "(f)");
      assert.deepEqual(errs, [], "页面不应有未捕获异常");
    } finally {
      await ctx.close();
    }
  });

  // (g) RULES L444 四档（`/workspace/zaozi-formal/v6_hint_audit/RULES_fix2_v2.md` L447/L444 §10.4）：
  //     A 左→途中右→途中左 30px = LRL｜C 同一选项 30px = LL｜D 左→途中右→Esc = L｜
  //     E 键盘 →→ 途中 ← Enter = RL。全部作为「一次点选项启动的飞卡途中」的点按来跑，
  //     断言 N1 吞了哪些（只有同选项 ≤10px 才吞）和排队在下一张的表现。
  for (const [key, name] of [["A", "LRL"], ["C", "LL"], ["D", "L"], ["E", "RL"]]) {
    test(`${engine} 390x844 touch: (g) RULES L444 ${key} (${name}) taps inside one option-started fly-out → n1Swallowed 0, queue drains`, async () => {
      const ctx = await browsers[engine].newContext(VP);
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);
      try {
        await fresh(page);
        const L = await box(page, "#opt-left");
        const R = await box(page, "#opt-right");
        const [lx, ly] = ctr(L);
        const [rx, ry] = ctr(R);
        const inside = () => page.waitForFunction(
          () => window.__zz.busy === true || window.__zz.animating === true, null, { timeout: 8000 },
        );

        if (key === "E") {
          // RL：键盘 →→ 起飞，途中点左选项，再按 Enter
          await page.keyboard.press("ArrowRight");
          await page.waitForTimeout(40);
          await page.keyboard.press("ArrowRight");
          await inside();
          await tap(page, lx, ly, true);
          await page.keyboard.press("Enter");
        } else {
          await tap(page, lx, ly, true);                 // 第 1 下：点选项起飞（N1 参照点在这一下）
          await inside();
          if (key === "D") {
            await tap(page, rx, ry, true);               // 第 2 下：另一个选项
            await page.keyboard.press("Escape");         // Esc：清空队列
          } else if (key === "A") {
            await tap(page, rx, ry, true);               // 第 2 下：另一个选项
            await inside();
            await tap(page, lx - 30, ly, true);          // 第 3 下：同选项但远 30px（>10px）
          } else {
            await tap(page, lx + 30, ly, true);          // 第 2 下：同选项但远 30px（>10px）
          }
        }

        if (key === "D") {
          await settle(page, "T02");
          const s = await readState(page);
          assert.equal(s.actions, 1, `${key}(${name})：Esc 应清空队列，只提交 1 次动作，实际为 ${s.actions}`);
          assert.equal(s.cur, "T02", `${key}(${name})：卡面应停在 T02，实际为 ${s.cur}`);
          assertNotSwallowed(s, `(g)${key}`);
        } else {
          await settle(page, "T03");
          const s = await readState(page);
          assert.equal(s.actions, 2, `${key}(${name})：排队动作应在下一张执行，提交 2 次动作，实际为 ${s.actions}`);
          assert.equal(s.cur, "T03", `${key}(${name})：卡面应推进到 T03，实际为 ${s.cur}`);
          assertNotSwallowed(s, `(g)${key}`);
        }
        assert.deepEqual(errs, [], "页面不应有未捕获异常");
      } finally {
        await ctx.close();
      }
    });
  }

  // (i) 排队起飞的飞卡不设 N1 参照点：排队执行起飞途中，同一选项 +4px 仍入队，不被 N1 吞
  test(`${engine} 390x844 touch: (i) fly-out started by queued option item does not arm N1 → same-option +4px tap is QUEUED, not swallowed`, async () => {
    const ctx = await browsers[engine].newContext(VP);
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await fresh(page);
      const L = await box(page, "#opt-left");
      const R = await box(page, "#opt-right");
      const [lx, ly] = ctr(L);
      const [rx, ry] = ctr(R);

      // T01：点左选项起飞
      await tap(page, lx, ly, true);
      await page.waitForFunction(() => window.__zz.animating === true, null, { timeout: 8000 });

      // 飞卡途中点右选项：右选项入队
      await tap(page, rx, ry, true);
      assert.ok((await page.evaluate(() => window.__zz.queued)) >= 1, "右选项应已入队");

      // 等 T01 飞完、排队的右选项在 T02 触发起飞（当前卡推进到 T02 且正在飞出动画中）
      await page.waitForFunction(
        () => window.__zz.st.current === "T02" && window.__zz.animating === true,
        null, { timeout: 8000 },
      );

      // 排队起飞的飞卡不应设 N1 参照点（P1 / R06）
      assert.equal(await page.evaluate(() => window.__zz.n1Ref ?? null), null,
        "排队项执行起飞不应设 N1 参照点");

      // 在 T02 飞卡途中，再次点击右选项 +4px（同选项且 ≤10px）
      await tap(page, rx + 4, ry, true);

      // 因为没有 N1 参照点，不应被吞，应该入队
      const sMid = await readState(page);
      assert.equal(sMid.n1, 0, "N1 不应吞掉此点按（n1Swallowed 仍为 0）");
      assert.ok(sMid.queued >= 1, `该点按应入队（queued >= 1），实得 ${sMid.queued}`);

      // 等全部落定到 T03
      await settle(page, "T03");
      const sEnd = await readState(page);
      assert.equal(sEnd.actions, 2, `T01与T02各提交1次，共2次，实际为 ${sEnd.actions}`);
      assert.equal(sEnd.cur, "T03", `卡面应推进到 T03，实际为 ${sEnd.cur}`);
      assert.equal(sEnd.n1, 0, "N1 计数应保持为 0");
      assert.deepEqual(errs, [], "页面不应有未捕获异常");
    } finally {
      await ctx.close();
    }
  });

  // (j) N1 选择性验证：直接点选项起飞后，同选项 ≤10px 不入队（被吞），另一选项正常入队
  test(`${engine} 390x844 touch: (j) same-option <=10px tap during option-started fly-out is NOT enqueued while other-option tap IS enqueued`, async () => {
    const ctx = await browsers[engine].newContext(VP);
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await fresh(page);
      const L = await box(page, "#opt-left");
      const R = await box(page, "#opt-right");
      const [lx, ly] = ctr(L);
      const [rx, ry] = ctr(R);

      // T01：直接点左选项起飞
      await tap(page, lx, ly, true);
      await page.waitForFunction(() => window.__zz.animating === true, null, { timeout: 8000 });
      assert.ok(await page.evaluate(() => window.__zz.n1Ref !== null), "直接点选项起飞应武装 N1");
      assert.equal(await page.evaluate(() => window.__zz.queued), 0, "起飞初队列应为空");

      // 1. 同选项 +4px：应被 N1 吞掉，不得入队
      await tap(page, lx + 4, ly, true);
      const s1 = await readState(page);
      assert.equal(s1.n1, 1, "同选项 ≤10px 应被 N1 吞掉（n1Swallowed=1）");
      assert.equal(s1.queued, 0, "被 N1 吞掉的点按不得入队（queued 仍为 0）");

      // 2. 另一选项（右选项）：不被 N1 吞掉，应正常入队
      await tap(page, rx, ry, true);
      const s2 = await readState(page);
      assert.equal(s2.n1, 1, "另一选项不应被 N1 吞掉（n1Swallowed 保持为 1）");
      assert.ok(s2.queued >= 1, `另一选项点按应正常入队（queued >= 1），实得 ${s2.queued}`);

      // 等落定推进到 T03
      await settle(page, "T03");
      const s3 = await readState(page);
      assert.equal(s3.actions, 2, `应提交 2 次动作（T01左 + T02右），实际为 ${s3.actions}`);
      assert.equal(s3.cur, "T03", `卡面应推进到 T03，实际为 ${s3.cur}`);
      assert.equal(s3.n1, 1, "N1 吞点计数应保持为 1");
      assert.deepEqual(errs, [], "页面不应有未捕获异常");
    } finally {
      await ctx.close();
    }
  });

  // (h) PM P1 补：点**字格**（字匣格子）不启动 N1。本分支里点字格是 dispatch(choose drop)，
  //     走 render() 换卡、根本不走 flyOut——所以没有任何「字格启动的飞卡」，N1 参照点也不会被设上。
  //     走到教学落字卡 T04（T01→左、T02→左、T03 直接进刻字阶段→点卡角骨片刻下），
  //     点字格落「水」到 T05，再点同一个选项 +4px：不吞、照常交一张。
  test(`[regression guard] ${engine} 390x844 touch: (h) glyph-cell tap (T04 drop) then same option +4px → not swallowed, commits normally`, async () => {
    const ctx = await browsers[engine].newContext(VP);
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await fresh(page);
      const L0 = await box(page, "#opt-left");
      await tap(page, ...ctr(L0), true);                        // T01 →左→ T02
      await settle(page, "T02");
      const L1 = await box(page, "#opt-left");
      await tap(page, ...ctr(L1), true);                        // T02 →左→ T03（进刻字阶段）
      await settle(page, "T03");
      const bc = await box(page, "#bonecorner");
      await tap(page, ...ctr(bc), true);                        // T03 卡角骨片「刻」→ T04
      await settle(page, "T04");

      // 点字格（字匣第 1 格「水」）——T04 正是教学落字卡
      const slot = await box(page, "#wordbox [data-slot]");
      const cls = await page.evaluate(() => document.querySelector("#wordbox [data-slot]").className);
      assert.match(cls, /\bok\b/, `T04 上字匣第 1 格应是可落字状态（class 含 ok），实际 "${cls}"`);
      await tap(page, ...ctr(slot), true);
      await settle(page, "T05");

      const afterDrop = await readState(page);
      assert.equal(afterDrop.cur, "T05", `点字格后应到 T05，实际为 ${afterDrop.cur}`);
      assert.equal(afterDrop.actions, 4, `点字格前应有 3 次提交（左/左/刻）+ 落字 1 次 = 4，实际为 ${afterDrop.actions}`);
      assertNoN1Ref(afterDrop, "(h)");   // 点字格不应设 N1 参照点（P1 补）
      assert.equal(await page.evaluate(() => window.__zz.animating), false,
        "本分支点字格走 render() 换卡，不飞卡：animating 应为 false");

      // 再点同一个选项（+4px，正是 N1 会吞的偏移）→ 不吞，照常提交
      const L2 = await box(page, "#opt-left");
      await tap(page, ...ctr(L2, 4), true);
      await page.waitForFunction(() => window.__zz.actions.length === 5 && window.__zz.st.current !== "T05", null, { timeout: 8000 });
      await page.waitForTimeout(400);
      const afterTap = await readState(page);
      assert.equal(afterTap.actions, 5, `同选项 +4px 这一下应照常提交（actions=5），实际为 ${afterTap.actions}`);
      assert.notEqual(afterTap.cur, "T05", `卡面应已推进，实际为 ${afterTap.cur}`);
      assertNotSwallowed(afterTap, "(h)");
      assert.deepEqual(errs, [], "页面不应有未捕获异常");
    } finally {
      await ctx.close();
    }
  });
}

// ============================================================ 桌面鼠标 1280×800
for (const [engine] of Object.entries(ENGINES)) {
  const VP = { viewport: { width: 1280, height: 800 } };

  // (a) 鼠标：同选项 +4px → 只交 1 张，N1 吞 1 次
  test(`${engine} 1280x800 mouse: (a) option-started fly-out, 2nd click same option +4px → 1 action, n1Swallowed 1`, async () => {
    const ctx = await browsers[engine].newContext(VP);
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await fresh(page);
      const L = await box(page, "#opt-left");
      const [x, y] = ctr(L);

      await tap(page, x, y, false);
      await page.waitForTimeout(60);
      await tap(page, x + 4, y, false);

      const ds = await downs(page);
      assert.equal(ds.length, 2, `应有两次选项按下，实际 ${ds.length}`);
      const { d } = gapOf(ds);
      assert.ok(d > 3 && d <= 10, `两次点按的真实间距应 >3 且 ≤10px（N1 窗口），实际 ${d.toFixed(1)}px`);
      assertInsideFlyout(ds[1], "(a)mouse", { anim: true });

      await settle(page, "T02");
      const s = await readState(page);
      assert.equal(s.actions, 1, `应恰好提交 1 次动作，实际为 ${s.actions}`);
      assert.equal(s.cur, "T02", `卡面应推进到 T02，实际为 ${s.cur}`);
      assertSwallowedOnce(s, "(a)mouse");
      assert.deepEqual(errs, [], "页面不应有未捕获异常");
    } finally {
      await ctx.close();
    }
  });

  // (b) 鼠标：同一落点、rAF 飞出已结束但卡还在落定回位时 → 仍吞（没有 70ms 窗）
  test(`${engine} 1280x800 mouse: (b) same point ~250ms after the start click (card still settling) → swallowed`, async () => {
    const ctx = await browsers[engine].newContext(VP);
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await fresh(page);
      const L = await box(page, "#opt-left");
      const [x, y] = ctr(L);

      await tap(page, x, y, false);
      await page.waitForFunction(
        () => window.__zz.actions.length >= 1 && !window.__zz.animating && (window.__zz.busy ?? true) === true,
        null, { timeout: 8000 },
      );
      await tap(page, x, y, false);

      const ds = await downs(page);
      const { dt, d } = gapOf(ds);
      // ~250ms：rAF 飞出（240ms）已结束、卡还在回位。下界只卡「远超任何 70ms 窗」，
      // 「rAF 已结束」由下面 assertInsideFlyout 的 anim===false 精确证明（引擎间有一两 ms 抖动）。
      assert.ok(dt > 150, `两次点按的真实时差应 >150ms（实测约 250ms），实际 ${dt.toFixed(1)}ms`);
      assert.ok(d <= 10, `两次点按的真实间距应 ≤10px，实际 ${d.toFixed(1)}px`);
      assertInsideFlyout(ds[1], "(b)mouse", { anim: false });
      console.log(`    [n1] ${engine} (b)mouse 250ms: dt=${dt.toFixed(0)}ms d=${d.toFixed(1)}px anim=${ds[1].anim} busy=${ds[1].busy}`);

      await settle(page, "T02");
      const s = await readState(page);
      assert.equal(s.actions, 1, `应恰好提交 1 次动作，实际为 ${s.actions}`);
      assert.equal(s.cur, "T02", `卡面应推进到 T02，实际为 ${s.cur}`);
      assertSwallowedOnce(s, "(b)mouse");
      assert.deepEqual(errs, [], "页面不应有未捕获异常");
    } finally {
      await ctx.close();
    }
  });

  // (c) 鼠标：飞卡途中点另一个选项 → 不吞；排队作用到下一张（T02 → T03，2 actions）
  test(`${engine} 1280x800 mouse: (c) click the OTHER option during the fly-out → n1Swallowed unchanged, 2 actions queued`, async () => {
    const ctx = await browsers[engine].newContext(VP);
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await fresh(page);
      const L = await box(page, "#opt-left");
      const R = await box(page, "#opt-right");
      await tap(page, ...ctr(L), false);
      await page.waitForTimeout(150);
      await tap(page, ...ctr(R), false);

      const ds = await downs(page);
      assert.equal(ds[1].sel, "#opt-right", `第 2 下应落在右选项上，实际 ${ds[1].sel}`);
      assertInsideFlyout(ds[1], "(c)mouse");

      await settle(page, "T03");
      const s = await readState(page);
      assert.equal(s.actions, 2, `应提交 2 次动作（第 2 下入队后作用到下一张），实际为 ${s.actions}`);
      assert.equal(s.cur, "T03", `卡面应推进到 T03，实际为 ${s.cur}`);
      assertNotSwallowed(s, "(c)mouse");
      assert.deepEqual(errs, [], "页面不应有未捕获异常");
    } finally {
      await ctx.close();
    }
  });

  // (d) 鼠标：飞卡途中同选项偏 14px → 不吞；排队作用到下一张（T02 → T03，2 actions）
  test(`${engine} 1280x800 mouse: (d) 2nd click same option 14px away during the fly-out → n1Swallowed unchanged, 2 actions queued`, async () => {
    const ctx = await browsers[engine].newContext(VP);
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await fresh(page);
      const L = await box(page, "#opt-left");
      const [x, y] = ctr(L);
      await tap(page, x, y, false);
      await page.waitForTimeout(60);
      await tap(page, x + 14, y, false);

      const ds = await downs(page);
      const { d } = gapOf(ds);
      assert.ok(d > 10, `两次点按的真实间距应 >10px（跳出 N1 窗口），实际 ${d.toFixed(1)}px`);
      assertInsideFlyout(ds[1], "(d)mouse", { anim: true });

      await settle(page, "T03");
      const s = await readState(page);
      assert.equal(s.actions, 2, `应提交 2 次动作（第 2 下入队后作用到下一张），实际为 ${s.actions}`);
      assert.equal(s.cur, "T03", `卡面应推进到 T03，实际为 ${s.cur}`);
      assertNotSwallowed(s, "(d)mouse");
      assert.deepEqual(errs, [], "页面不应有未捕获异常");
    } finally {
      await ctx.close();
    }
  });

  // (e) 鼠标：键盘起飞的飞卡 → 不吞；排队作用到下一张
  test(`${engine} 1280x800 mouse: (e) keyboard-started fly-out (ArrowLeft x2) then click the option → n1Swallowed unchanged, 2 actions queued`, async () => {
    const ctx = await browsers[engine].newContext(VP);
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await fresh(page);
      await page.keyboard.press("ArrowLeft");
      await page.waitForTimeout(50);
      await page.keyboard.press("ArrowLeft");
      await page.waitForFunction(
        () => window.__zz.busy === true || window.__zz.animating === true, null, { timeout: 8000 },
      );
      assert.equal(await page.evaluate(() => window.__zz.n1Ref ?? null), null,
        "键盘起飞的飞卡不应设 N1 参照点（P1）");

      const L = await box(page, "#opt-left");
      await tap(page, ...ctr(L), false);
      const ds = await downs(page);
      assertInsideFlyout(ds[0], "(e)mouse");

      await settle(page, "T03");
      const s = await readState(page);
      assert.equal(s.actions, 2, `应提交 2 次动作（途中点选项入队后作用到下一张），实际为 ${s.actions}`);
      assert.equal(s.cur, "T03", `卡面应推进到 T03，实际为 ${s.cur}`);
      assertNotSwallowed(s, "(e)mouse");
      assert.deepEqual(errs, [], "页面不应有未捕获异常");
    } finally {
      await ctx.close();
    }
  });

  // (f) 鼠标：拖拽松手起飞的飞卡 → 不吞；排队作用到下一张
  test(`${engine} 1280x800 mouse: (f) drag-release-started fly-out then click the option → n1Swallowed unchanged, 2 actions queued`, async () => {
    const ctx = await browsers[engine].newContext(VP);
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await fresh(page);
      const card = await box(page, "#card");
      const cx = card.x + card.width / 2, cy = card.y + card.height / 2;
      const thr = 0.35 * card.width;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      for (let k = 1; k <= 6; k++) { await page.mouse.move(cx - thr * 1.2 * k / 6, cy); await page.waitForTimeout(16); }
      await page.mouse.up();
      await page.waitForFunction(
        () => window.__zz.busy === true || window.__zz.animating === true, null, { timeout: 8000 },
      );
      assert.equal(await page.evaluate(() => window.__zz.n1Ref ?? null), null,
        "拖拽松手起飞的飞卡不应设 N1 参照点（P1）");

      const L = await box(page, "#opt-left");
      await tap(page, ...ctr(L), false);
      const ds = await downs(page);
      assertInsideFlyout(ds[0], "(f)mouse");

      await settle(page, "T03");
      const s = await readState(page);
      assert.equal(s.actions, 2, `应提交 2 次动作（途中点选项入队后作用到下一张），实际为 ${s.actions}`);
      assert.equal(s.cur, "T03", `卡面应推进到 T03，实际为 ${s.cur}`);
      assertNotSwallowed(s, "(f)mouse");
      assert.deepEqual(errs, [], "页面不应有未捕获异常");
    } finally {
      await ctx.close();
    }
  });
}
