// e2e：飞出（fly-out）期间的拖拽也走同一条输入队列（round 4）。
//
// 缺陷：onDown 一上来就 `if (inputBusy()) return`，飞出/入场期间的按下被静静吞掉；而点字匣、左右选项、
// 方向键都会入队。于是「飞出刚开始就按住卡」这段窗口里，手指怎么拖都没反应。
//
// 期望（本用例编码）：飞出期间在 #cardwrap 上按下 → 当作排队的一次 press；期间的 pointermove 更新位置，
// 松手时按位移决定「在队列原位变成一次 side 提交」还是「整项丢弃」；一直按住不松，等当前卡落定后由重放
// 起拖，之后跟随手指。队列里的 press 与键/tap 一样按先进先出、一项一项地生效。
//
// 三引擎；1280×800 用鼠标，390×844 用触屏（chromium 走 CDP Input.dispatchTouchEvent，
// firefox/webkit 用合成 PointerEvent，pointerType "touch"，pointerId 7）。
// 每页一个 rAF 帧记录器（含 .dragging 与 #card 的 translateX），settle 也等 __zz.queued === 0。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";
import { clearTutorial, gen2Codes, passCutscene, releaseBridge } from "./helpers/flow.mjs";

buildDist();

let server, browsers = {}, codes = null;
before(async () => {
  server = await startServer();
  await Promise.all(Object.entries(ENGINES).map(async ([name, type]) => { browsers[name] = await type.launch(); }));
  codes = await gen2Codes(Object.values(browsers)[0], server.origin, SEED);   // 抽屉例要一张下一张能落字的卡
});
after(async () => {
  for (const b of Object.values(browsers)) await b.close();
  server?.close();
});

const VP_DESK = { width: 1280, height: 800 };
const VP_TOUCH = { width: 390, height: 844 };
const press = async (page, keys) => { for (const k of keys) await page.keyboard.press(k); };

// 全新一局：走完教学，停在第一张普通卡并稳住。
async function setup(engine, opts = {}) {
  const touch = !!opts.touch;
  const ctx = await browsers[engine].newContext({
    viewport: touch ? VP_TOUCH : VP_DESK,
    hasTouch: touch,
    isMobile: touch && engine !== "firefox",
  });
  const page = await ctx.newPage();
  const errs = [];
  collectErrors(page, errs);
  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__zz);
  if (opts.code) { await page.evaluate((c) => window.__zz.importCode(c), opts.code); await page.waitForTimeout(1500); }
  else await clearTutorial(page);
  await page.waitForFunction(() => window.__zz.st.phase === "card" && !window.__zz.animating, null, { timeout: 5000 });
  await startRecorder(page);
  await settle(page);
  return { ctx, page, errs };
}

async function startRecorder(page) {
  await page.evaluate(() => {
    if (window.__raf) cancelAnimationFrame(window.__raf);
    window.__frames = [];
    const loop = () => {
      const z = window.__zz, card = document.getElementById("card");
      const m = /translateX\((-?[\d.]+)px\)/.exec(card ? card.style.transform : "");
      window.__frames.push({
        t: performance.now(),
        cur: z.st.current,
        busy: !!z.animating || (card ? card.getAnimations().some((a) => a.playState === "running") : false),
        dx: m ? Number(m[1]) : 0,
        dragging: !!(card && card.classList.contains("dragging")),
        n: z.actions.length,
      });
      window.__raf = requestAnimationFrame(loop);
    };
    window.__raf = requestAnimationFrame(loop);
  });
}

// 独立落定记录器（P2-2）：不读被测代码自己写的 __zz.settledAt，而在 rAF 里自己判「这一帧卡真落定了」：
// 没有 __zz.animating、没有在跑的卡动画、#card 的 transform 为空、且不带 .dragging。
// 按「卡|动作数」记下第一帧的时刻（window.__settles），与 flyout_qa.test.mjs 同一套判据。
async function startSettleRecorder(page) {
  await page.evaluate(() => {
    if (window.__settleRaf) cancelAnimationFrame(window.__settleRaf);
    window.__settles = {};
    const loop = () => {
      const z = window.__zz, card = document.getElementById("card");
      const settled = !!z && !z.animating
        && (card ? !card.getAnimations().some((a) => a.playState === "running") : true)
        && (card ? (card.style.transform === "" || card.style.transform === "none") : true)
        && (card ? !card.classList.contains("dragging") : true);
      const key = (z?.st?.current ?? "?") + "|" + (z?.actions?.length ?? 0);
      if (settled && window.__settles[key] == null) window.__settles[key] = performance.now();
      window.__settleRaf = requestAnimationFrame(loop);
    };
    window.__settleRaf = requestAnimationFrame(loop);
  });
}
const settlesOf = (page) => page.evaluate(() => window.__settles || {});

// 稳：动画停、入场过渡停、队列空，且连续 400ms 都如此。
async function settle(page) {
  await page.evaluate(() => { window.__settleFrom = 0; });
  await page.waitForFunction(() => {
    const card = document.getElementById("card");
    const busy = window.__zz.animating
      || card.getAnimations().some((a) => a.playState === "running")
      || (window.__zz.queued ?? 0) !== 0;
    if (busy) { window.__settleFrom = 0; return false; }
    const now = performance.now();
    if (!window.__settleFrom) window.__settleFrom = now;
    return now - window.__settleFrom >= 400;
  }, null, { timeout: 10000, polling: 60 });
  await passCutscene(page);
}

// 卡中心与卡宽：在飞出之前（已稳）量一次。
const cardBox = (page) => page.evaluate(() => {
  const r = document.getElementById("card").getBoundingClientRect();
  return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, w: r.width };
});

// 指针抽象：鼠标 / chromium CDP 触屏 / 其余引擎合成触屏 PointerEvent（pointerup 落在 window 上）。
async function makePointer(page, engine, touch) {
  if (!touch) return {
    down: async (x, y) => { await page.mouse.move(x, y); await page.mouse.down(); },
    move: (x, y) => page.mouse.move(x, y),
    up: () => page.mouse.up(),
  };
  if (engine === "chromium") {
    const cdp = await page.context().newCDPSession(page);
    const pt = (x, y) => [{ x, y, radiusX: 2, radiusY: 2, force: 1, id: 1 }];
    return {
      down: (x, y) => cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(x, y) }),
      move: (x, y) => cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(x, y) }),
      up: () => cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }),
    };
  }
  let last = { x: 0, y: 0 };
  const fire = (type, x, y) => page.evaluate(({ type, x, y }) => {
    const target = type === "pointerdown" ? (document.elementFromPoint(x, y) || document.documentElement) : window;
    target.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, composed: true,
      pointerId: 7, pointerType: "touch", isPrimary: true, button: 0,
      buttons: type === "pointerup" ? 0 : 1, clientX: x, clientY: y,
    }));
  }, { type, x, y });
  return {
    down: (x, y) => { last = { x, y }; return fire("pointerdown", x, y); },
    move: (x, y) => { last = { x, y }; return fire("pointermove", x, y); },
    up: (x, y) => fire("pointerup", x ?? last.x, y ?? last.y),
  };
}

const framesOf = (page) => page.evaluate(() => window.__frames);
const actionsLen = (page) => page.evaluate(() => window.__zz.actions.length);
const sidesFrom = (page, n0) => page.evaluate((n) => window.__zz.actions.slice(n).map((a) => a.side), n0);

const firstFrameAfter = (frames, k) => {
  for (let i = 1; i < frames.length; i++) if (frames[i].n > k) return i;
  return -1;
};
function appliedOnSettled(t, frames, n0, total, label) {
  const problems = [], notes = [];
  for (let k = n0; k < total; k++) {
    const f = firstFrameAfter(frames, k);
    if (f < 0) { problems.push(`动作 #${k} 在录制帧里找不到落点（frames=${frames.length}）`); continue; }
    const card = frames[f - 1].cur;
    let first = -1, count = 0;
    for (let j = 0; j < f; j++) {
      if (frames[j].cur === card && !frames[j].busy && frames[j].n === k) { if (first < 0) first = j; count++; }
    }
    const ms = first >= 0 ? Math.round(frames[f].t - frames[first].t) : -1;
    notes.push(`#${k}→${card} settledFrames=${count} settleToApply=${ms}ms`);
    if (count < 2) problems.push(`动作 #${k} 落在卡 ${card}，但该卡落定并绘制的帧只有 ${count} 帧（settleToApply=${ms}ms）`);
  }
  t.diagnostic(`${label} 重放时机：${notes.join(" | ")}`);
  assert.deepEqual(problems, [], `[${label}] 排队输入必须先等当前卡落定并绘制才生效：${problems.join(" ; ")}`);
}

// P3-2：锁定提示何时出现，不能靠固定 sleep 猜。装上 MutationObserver，记录 #toast 变 on 的那一刻的
// performance.now() 与当时是哪张卡（「卡|动作数」，独立落定记录器的键）。落定时刻不取 __zz.settledAt
// ——那是被测代码自己记的（P2-2），改用 startSettleRecorder 独立记下的 window.__settles。
const watchToast = (page) => page.evaluate(() => {
  window.__toastHits = [];
  const el = document.getElementById("toast");
  const rec = () => {
    if (el.classList.contains("on") && /骨片/.test(el.textContent || "")) {
      const z = window.__zz;
      window.__toastHits.push({
        t: performance.now(),
        cardKey: (z?.st?.current ?? "?") + "|" + (z?.actions?.length ?? 0),
        text: el.textContent,
      });
    }
  };
  new MutationObserver(rec).observe(el, { attributes: true, attributeFilter: ["class"], childList: true, characterData: true, subtree: true });
});
const toastHits = (page) => page.evaluate(() => window.__toastHits || []);

// 锁定骨片提示必须等目标卡「独立落定并绘制」满 DWELL_MS（250ms）才出现：落定时刻取自页内独立记录器，
// 所以证明的是「卡真的落定了 250ms」，而不是「代码以为自己落定了 250ms」。留 5ms 判据余量（≥245ms）。
function assertHintAfterSettle(t, hits, settles, label) {
  t.diagnostic(`${label} 锁定提示：${JSON.stringify(hits)}｜独立落定：${JSON.stringify(settles)}`);
  assert.ok(hits.length >= 1, `排队输入进入刻字卡应弹出包含「骨片」的锁定提示（${label}）`);
  const hit = hits[0];
  const indSettle = settles[hit.cardKey];
  assert.ok(indSettle > 0, `提示出现时的那张卡必须已有独立落定时间戳（${hit.cardKey}），否则证明不了等满了最短停留`);
  const gap = hit.t - indSettle;
  assert.ok(gap >= 245, `锁定提示必须等卡独立落定 ≥250ms 才出现（${hit.cardKey}：落定=${indSettle.toFixed(1)}，提示=${hit.t.toFixed(1)}，实测 ${gap.toFixed(1)}ms）`);
  assert.ok(gap < 2500, `锁定提示不该拖到落定 2.5s 以后（实测 ${gap.toFixed(1)}ms，独立落定记录可能没被更新）`);
}

for (const [engine] of Object.entries(ENGINES)) {
  for (const mode of ["mouse", "touch"]) {
    const touch = mode === "touch";
    const label = touch ? "390 touch" : "1280 mouse";

    test(`${engine} ${label}: 飞出期间按住不松，卡落定后拖起来跟随手指并提交`, async (t) => {
      const { ctx, page, errs } = await setup(engine, { touch });
      try {
        const n0 = await actionsLen(page);
        const box = await cardBox(page);
        const p = await makePointer(page, engine, touch);
        await press(page, ["ArrowLeft", "ArrowLeft"]);      // 起飞
        await page.waitForTimeout(60);
        await p.down(box.cx, box.cy);                        // 飞出期间按下，之后一直按住不动
        await page.waitForFunction(() => {
          const c = document.getElementById("card");
          return !window.__zz.animating && c.classList.contains("dragging");
        }, null, { timeout: 3000 });                         // 等重放把这次 press 起成实拖
        // 每步隔一帧以上：真手指的移动跨越多帧；否则 webkit/firefox 里 6 次 move+up 会挤进同一帧，录帧器看不到 .dragging。
        for (let i = 1; i <= 6; i++) { await p.move(box.cx + box.w * 0.1 * i, box.cy); await page.waitForTimeout(20); }
        await p.up(box.cx + box.w * 0.6, box.cy);
        await settle(page);

        const total = await actionsLen(page);
        assert.equal(total - n0, 2, `应两次提交（起飞那次 ←← + 拖动），实为 ${total - n0}`);
        assert.deepEqual(await sidesFrom(page, n0), ["left", "right"], "第二次应是拖动提交的 right");

        const frames = await framesOf(page);
        const fStart = frames.findIndex((f) => f.busy);
        let fDrag = frames.findIndex((f) => f.dragging);
        if (fDrag < 0) fDrag = frames.findIndex((f) => !f.busy && Math.abs(f.dx) > 0.5);
        assert.ok(fStart >= 0, "应记录到飞出开始的帧");
        assert.ok(fDrag > fStart, "应记录到起拖的帧（.dragging 或松手前 translateX≠0）");

        // P3-5（r8）：设计预算 320ms 基于标称 16.7ms 帧率。在 CPU 负载或低配环境下 rAF 间隔被拉长，
        // 飞出后两帧 rAF + 入场过渡 finish 会随帧率放缩。因此测量页面自身的帧时钟：
        // 计算实测窗口内的中位 rAF 间隔，预算仅按帧间隔膨胀系数等比放缩 (320 × max(1, median/16.7))；
        // 同时保留结构性 ≤3 帧断言，确保起拖紧跟飞出/入场结束。
        let fFlyEnd = -1;
        for (let i = fStart; i < fDrag; i++) if (frames[i].busy) fFlyEnd = i;
        const rawLag = Math.round(frames[fDrag].t - frames[fStart].t);
        const gapFrames = fFlyEnd >= 0 ? fDrag - fFlyEnd : -1;

        const intervals = [];
        for (let i = fStart + 1; i <= fDrag; i++) {
          const dt = frames[i].t - frames[i - 1].t;
          if (dt > 0) intervals.push(dt);
        }
        intervals.sort((a, b) => a - b);
        const midIdx = Math.floor(intervals.length / 2);
        const medianInterval = intervals.length
          ? (intervals.length % 2 === 1 ? intervals[midIdx] : (intervals[midIdx - 1] + intervals[midIdx]) / 2)
          : 16.6667;
        // E1-D2: 帧间隔放缩系数必须设上限 (MAX_INFLATION = 1.25，放缩预算上限 400ms)，
        // 防止慢机或 CI 负载下中位帧间隔过大导致预算被无限放大，从而让延迟 150ms 的变异平凡通过。
        const MAX_INFLATION = 1.25;
        const rawInflation = Math.max(1, medianInterval / 16.6667);
        const inflation = Math.min(MAX_INFLATION, rawInflation);
        const scaledBudget = Math.round(320 * inflation);

        t.diagnostic(`起拖滞后：原始 ${rawLag}ms｜中位帧间隔 ${medianInterval.toFixed(2)}ms（标称 16.7ms，原始放大 ${rawInflation.toFixed(2)}x，封顶放大 ${inflation.toFixed(2)}x）｜放缩预算 ${scaledBudget}ms｜起拖距飞出结束 ${gapFrames} 帧`);
        assert.ok(fFlyEnd >= 0, "应记录到飞出/入场结束的帧（起拖前的最后一个 busy 帧）");
        assert.ok(gapFrames <= 3, `起拖应在飞出/入场结束后 ≤3 帧内开始（实测 ${gapFrames} 帧）`);
        assert.ok(rawLag <= scaledBudget, `起拖应在放缩预算内开始（原始 ${rawLag}ms ≤ 预算 ${scaledBudget}ms，按中位帧间隔 ${medianInterval.toFixed(1)}ms 放缩封顶）`);

        const fCommit = frames.findIndex((f) => f.n >= n0 + 2);
        assert.ok(fCommit > 0, "应记录到第二次提交");
        assert.ok(frames.slice(fDrag, fCommit).some((f) => f.dragging && Math.abs(f.dx) > 30), "提交前应看到卡在拖动中跟随手指（.dragging 且 translateX |x|>30；飞出动画的位移不算）");
        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally { await ctx.close(); }
    });

    test(`${engine} ${label}: 落定前松手且超过阈值，会跟键一起按顺序入队`, async (t) => {
      const { ctx, page, errs } = await setup(engine, { touch });
      try {
        const n0 = await actionsLen(page);
        const box = await cardBox(page);
        const p = await makePointer(page, engine, touch);
        await press(page, ["ArrowLeft", "ArrowLeft"]);       // 起飞
        await page.waitForTimeout(30);
        await p.down(box.cx, box.cy);
        await p.move(box.cx - box.w * 0.6, box.cy);
        await p.up(box.cx - box.w * 0.6, box.cy);            // 落定前松手，超过阈值 → 队列里变成一次 left 提交
        await press(page, ["ArrowRight", "ArrowRight"]);

        await settle(page);
        const total = await actionsLen(page);
        assert.equal(total - n0, 3, `起飞 + 拖动 + →→ 应是三次，实为 ${total - n0}`);
        assert.deepEqual(await sidesFrom(page, n0), ["left", "left", "right"], "顺序应是 [left(起飞), left(拖动), right(→→)]");
        appliedOnSettled(t, await framesOf(page), n0 + 1, total, "例2");
        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally { await ctx.close(); }
    });

    test(`[guard] ${engine} ${label}: 落定前松手但未到阈值，该项被丢弃`, async (t) => {
      const { ctx, page, errs } = await setup(engine, { touch });
      try {
        const n0 = await actionsLen(page);
        const box = await cardBox(page);
        const p = await makePointer(page, engine, touch);
        await press(page, ["ArrowLeft", "ArrowLeft"]);       // 起飞
        await page.waitForTimeout(30);
        await p.down(box.cx, box.cy);
        await p.move(box.cx + 10, box.cy);
        await p.up(box.cx + 10, box.cy);                     // 落定前松手，未到阈值 → 整项丢弃
        await press(page, ["ArrowRight", "ArrowRight"]);     // 随后的排队键应正常生效

        await settle(page);
        const total = await actionsLen(page);
        assert.equal(total - n0, 2, "未到阈值的按下应被丢弃，随后的排队键正常提交（共2次提交）");
        assert.deepEqual(await sidesFrom(page, n0), ["left", "right"], "提交应为起飞的 left 与随后的 right");
        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally { await ctx.close(); }
    });
  }

  test(`${engine} 1280: 飞出期间开目标面板，队列整体作废`, async (t) => {
    const { ctx, page, errs } = await setup(engine);
    try {
      const n0 = await actionsLen(page);
      await press(page, ["ArrowRight", "ArrowRight"]);      // 起飞
      await press(page, ["ArrowLeft", "ArrowLeft"]);        // 飞出期间两只 ← 入队
      await page.evaluate(() => document.getElementById("goals-slip").click());   // 飞出期间打开目标面板
      assert.equal(await page.evaluate(() => !document.getElementById("goals-panel").hidden), true, "目标面板应已打开");
      await settle(page);
      assert.equal(await actionsLen(page) - n0, 1, "面板打开后队列应整体作废，只剩起飞那一次 → 提交");
      assert.deepEqual(await sidesFrom(page, n0), ["right"], "只应有第一次 → 的提交");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  test(`[guard] ${engine} 390 touch: 飞出期间开抽屉，队列整体作废`, async (t) => {
    // prevCode：←← 后翻出的下一张有可落字格，排队的落字若不作废就会真的落在抽屉底下（审核 r3 P2-2 复现）。
    const { ctx, page, errs } = await setup(engine, { touch: true, code: codes.prevCode });
    try {
      const n0 = await actionsLen(page);
      const slot = await page.locator("#wordbox .slot").first().boundingBox();
      assert.ok(slot, "字匣格子应有可点区域");
      const handle = await page.locator("#wb-handle").boundingBox();   // 起飞前先量好，飞出期间只补点位（别让排队项先重放）
      await press(page, ["ArrowLeft", "ArrowLeft"]);        // 起飞
      await page.touchscreen.tap(slot.x + slot.width / 2, slot.y + slot.height / 2);   // 飞出期间点字匣格 → 入队
      if (handle) await page.mouse.click(handle.x + handle.width / 2, handle.y + handle.height / 2);
      else await page.evaluate(() => { document.getElementById("drawer").hidden = false; });   // 窄屏可能没有把手
      assert.equal(await page.evaluate(() => !document.getElementById("drawer").hidden), true, "抽屉应已打开");
      await settle(page);
      assert.equal(await actionsLen(page) - n0, 1, "抽屉打开后队列应整体作废，只剩起飞那一次 ← 提交");
      assert.deepEqual(await sidesFrom(page, n0), ["left"], "只应有第一次 ← 的提交");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  // P3-2：飞出期间排队进 T03（phase "engrave"）的输入不能再被静默丢弃：press/side 弹锁定骨片提示，
  // 提示必须等目标卡「落定并绘制」再满 DWELL_MS 才出现，用独立落定记录器（window.__settles）量它离落定有多久。
  test(`${engine} 1280 mouse: 飞出进教学T03（刻字卡）时排队的拖拽，落定后满 250ms 才弹出锁定骨片提示（P3-2）`, async (t) => {
    const ctx = await browsers[engine].newContext({ viewport: VP_DESK });
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz);

      await press(page, ["ArrowLeft", "ArrowLeft"]);
      await page.waitForFunction(() => window.__zz.st.current === "T02" && !window.__zz.animating, null, { timeout: 3000 });
      await passCutscene(page);
      await settle(page);

      const box = await cardBox(page);
      await startSettleRecorder(page);              // 独立落定记录：要量的是「卡真落定 → 提示」这段
      await watchToast(page);                       // 起飞前装好：要量的是「落定 → 提示」这段
      await press(page, ["ArrowRight", "ArrowRight"]);
      await page.waitForTimeout(30);

      await page.mouse.move(box.cx, box.cy);
      await page.mouse.down();
      await page.mouse.move(box.cx + 60, box.cy);   // 未到阈值，整项作为「松过手的 press」留在队列里
      await page.mouse.up();
      await releaseBridge(page);

      await page.waitForFunction(() => window.__zz.st.current === "T03", null, { timeout: 3000 });
      await page.waitForFunction(() => {
        const el = document.getElementById("toast");
        return !!el && el.classList.contains("on") && /骨片/.test(el.textContent || "");
      }, null, { timeout: 3000 });
      await settle(page);

      const hits = await toastHits(page);
      assertHintAfterSettle(t, hits, await settlesOf(page), "T03 排队拖拽");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });

  // P3-2 键位变体：飞出期间能入队的只有方向/Enter/字匣键（input_map 的 card.keys），它们在刻字阶段都没有
  // 对应行为。drainStep 的刻字分支把它们和 press/side 同等对待：只弹一次锁定骨片提示（04123a2/cddd03d：
  // 「排队攒下的 ←/→/Enter/拖拽到这里只弹一次锁定提示」），不报错、不推进教学、不多一个动作。
  // 提示同样必须等 T03 独立落定满 250ms 才出现（下面用独立落定记录器量，不读 __zz.settledAt）。
  test(`${engine} 1280 mouse: 飞出进教学T03（刻字卡）时排队的按键只弹一次锁定骨片提示，不报错也不推进（P3-2 键位变体）`, async (t) => {
    const ctx = await browsers[engine].newContext({ viewport: VP_DESK });
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz);

      await press(page, ["ArrowLeft", "ArrowLeft"]);
      await page.waitForFunction(() => window.__zz.st.current === "T02" && !window.__zz.animating, null, { timeout: 3000 });
      await passCutscene(page);
      await settle(page);

      const n0 = await actionsLen(page);
      await startSettleRecorder(page);              // 独立落定记录：要量的是「卡真落定 → 提示」这段
      await watchToast(page);
      await press(page, ["ArrowRight", "ArrowRight", "ArrowRight"]);   // 第 3 次按在飞出期间 → 入队
      await releaseBridge(page);
      const queued = await page.evaluate(() => window.__zz.queued);
      t.diagnostic(`飞出期间排队项：${queued}`);

      await page.waitForFunction(() => window.__zz.st.current === "T03", null, { timeout: 3000 });
      await page.waitForFunction(() => {
        const el = document.getElementById("toast");
        return !!el && el.classList.contains("on") && /骨片/.test(el.textContent || "");
      }, null, { timeout: 3000 });
      await settle(page);

      const st = await page.evaluate(() => ({ cur: window.__zz.st.current, phase: window.__zz.st.phase, n: window.__zz.actions.length }));
      t.diagnostic(`T03 落定后：current=${st.cur} phase=${st.phase} 新增动作=${st.n - n0}`);
      assert.equal(st.cur, "T03", "排队的 → 在刻字阶段没有对应行为，教学应停在 T03");
      assert.equal(st.phase, "engrave", "T03 应仍是刻字阶段");
      assert.equal(st.n - n0, 1, "除起飞提交T02外，排队的第3次→在刻字阶段不应产生任何额外动作");
      assert.deepEqual(await sidesFrom(page, n0), ["right"], "只应有起飞提交 T02 的那一次 right");
      assertHintAfterSettle(t, await toastHits(page), await settlesOf(page), "T03 排队按键");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });
}
