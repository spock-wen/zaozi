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
import { clearTutorial, gen2Codes } from "./helpers/flow.mjs";

buildDist();

let server, browsers = {}, codes = null;
before(async () => {
  server = await startServer();
  for (const [name, type] of Object.entries(ENGINES)) browsers[name] = await type.launch();
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
        for (let i = 1; i <= 6; i++) await p.move(box.cx + box.w * 0.1 * i, box.cy);
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
        const lag = Math.round(frames[fDrag].t - frames[fStart].t);
        t.diagnostic(`起拖滞后 ${lag}ms`);
        assert.ok(lag <= 320, `起拖应在飞出开始后 ≤320ms（实际 ${lag}ms）`);

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

    test(`${engine} ${label}: 落定前松手但未到阈值，该项被丢弃`, async (t) => {
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

        await settle(page);
        assert.equal(await actionsLen(page) - n0, 1, "未到阈值的按下应被丢弃，只留下起飞那一次提交");
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

  test(`${engine} 390 touch: 飞出期间开抽屉，队列整体作废`, async (t) => {
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
}
