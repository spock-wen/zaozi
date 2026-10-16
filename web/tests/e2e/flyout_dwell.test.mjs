// e2e：飞出（fly-out）期间入队的输入，必须等下一张卡「落定并画出」后，再多留 DWELL_MS = 250ms 才生效（round 5 A）。
//
// 缺陷：队列项在卡落定并绘制后只等两帧 rAF（约 16–30ms）就立即回放，预览/提交在玩家还没看清时就被吃掉了。
//
// 期望（本用例编码）：每一个排队效果（预览、提交、落字）作用前，目标卡「停稳且在屏上」的时长 ≥ 250ms；
// 点右选项的提交、松手早于落定的拖拽提交同样如此；一直按住的拖拽由重放起实拖后跟随手指，但其提交
// 也要等到那张卡落定并绘制 250ms 之后。Esc 清空整个队列（含仍按住的 press），之后松手不再生效。
//
// 三引擎；1280×800 用鼠标，390×844 用触屏（chromium 走 CDP Input.dispatchTouchEvent，
// firefox/webkit 用合成 PointerEvent，pointerType "touch"，pointerId 7）。
// 每页一个 rAF 帧记录器（含 z.animating、.dragging、#card 的 translateX、以及 #opt-left/#opt-right 的 "on"）。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";
import { clearTutorial } from "./helpers/flow.mjs";

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
  await clearTutorial(page);
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
        anim: !!z.animating,
        busy: !!z.animating || (card ? card.getAnimations().some((a) => a.playState === "running") : false),
        dx: m ? Number(m[1]) : 0,
        dragging: !!(card && card.classList.contains("dragging")),
        n: z.actions.length,
        onL: !!document.getElementById("opt-left")?.classList.contains("on"),
        onR: !!document.getElementById("opt-right")?.classList.contains("on"),
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

const firstFlyout = (frames) => frames.findIndex((f) => f.anim);

// 排队效果的时刻（第 4 轮口径）：飞出开始 = animating 上升；无飞出的动作 = 动作数增长；预览 = 左右选项 "on" 的上升沿。
// 现场按下的第一次飞出（flights = 1）不算，之后每一次 animating 上升都算一次排队提交。
function effectFrames(frames, n0) {
  const evs = [];
  let flights = 0;
  for (let f = 1; f < frames.length; f++) {
    if (frames[f].anim && !frames[f - 1].anim) { flights++; if (flights >= 2) evs.push({ f, kind: "commit" }); }
    else if (frames[f].n > frames[f - 1].n && !frames[f - 1].anim && !frames[f].anim && frames[f].n - n0 >= 2) evs.push({ f, kind: "drop" });
    else if ((frames[f].onL && !frames[f - 1].onL) || (frames[f].onR && !frames[f - 1].onR)) evs.push({ f, kind: "preview" });
  }
  return evs;
}

// 目标卡 = 时刻前一帧的当前卡；first = 该卡「同一张且非忙」的连续帧的起始下标。
function settleRun(frames, f) {
  const card = frames[f - 1].cur;
  let j = f - 1, count = 0;
  while (j >= 0 && frames[j].cur === card && !frames[j].busy) { count++; j--; }
  return { card, first: j + 1, count };
}

function assertDwell(t, frames, evs, label) {
  const notes = [];
  for (const { f, kind } of evs) {
    const { card, first, count } = settleRun(frames, f);
    const ms = Math.round(frames[f].t - frames[first].t);
    notes.push(`${kind} #${f} @${card} settled=${count} delta=${ms}ms`);
    assert.ok(
      ms >= 250,
      `[${label}] 排队输入（${kind}）必须等目标卡 ${card} 落定并绘制后 ≥250ms 才生效：实测 ${ms}ms（落定 ${count} 帧）`,
    );
  }
  t.diagnostic(`${label} 重放时机：${notes.join(" | ") || "（无排队效果）"}`);
}

for (const [engine] of Object.entries(ENGINES)) {
  test(`${engine} 1280 mouse: 排队键在卡落定并绘制后 ≥250ms 才生效`, async (t) => {
    const { ctx, page, errs } = await setup(engine);
    try {
      const n0 = await actionsLen(page);
      await press(page, ["ArrowLeft", "ArrowLeft"]);                          // 起飞（现场提交）
      await press(page, ["ArrowRight", "ArrowRight", "ArrowLeft", "ArrowLeft"]);  // 飞出期间入队
      await settle(page);

      const frames = await framesOf(page);
      const fly = firstFlyout(frames);
      assert.ok(fly >= 0, "应记录到飞出开始的帧");
      const evs = effectFrames(frames, n0).filter((e) => e.f > fly);
      const commits = evs.filter((e) => e.kind === "commit").length;
      const previews = evs.filter((e) => e.kind === "preview").length;
      t.diagnostic(`识别到排队效果 ${evs.length} 个（提交 ${commits}、预览 ${previews}）`);
      assert.ok(evs.length >= 4, `应识别出两次预览 + 两次提交，实为 ${evs.length}`);
      assertDwell(t, frames, evs, "例1");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  test(`${engine} 1280 mouse: 飞出期间点右选项，提交也 ≥250ms 后生效`, async (t) => {
    const { ctx, page, errs } = await setup(engine);
    try {
      const n0 = await actionsLen(page);
      await press(page, ["ArrowLeft", "ArrowLeft"]);                          // 起飞
      await page.locator("#opt-right").click({ force: true });                // 飞出期间点右选项 → 入队
      await settle(page);

      const total = await actionsLen(page);
      assert.equal(total - n0, 2, `起飞 + 点右选项应是两次提交，实为 ${total - n0}`);
      assert.deepEqual(await sidesFrom(page, n0), ["left", "right"], "第二次应是右选项的 right");

      const frames = await framesOf(page);
      const commit = effectFrames(frames, n0).find((e) => e.kind === "commit");
      assert.ok(commit, "应识别到点选项的那次提交（animating 上升沿）");
      assertDwell(t, frames, [commit], "例2");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  test(`${engine} 390 touch: 松手早于落定的拖拽提交 ≥250ms 后生效`, async (t) => {
    const { ctx, page, errs } = await setup(engine, { touch: true });
    try {
      const n0 = await actionsLen(page);
      const box = await cardBox(page);
      const p = await makePointer(page, engine, true);
      await press(page, ["ArrowLeft", "ArrowLeft"]);                          // 起飞
      await p.down(box.cx, box.cy);                                          // 飞出期间按下
      for (let i = 1; i <= 6; i++) { await p.move(box.cx + box.w * 0.1 * i, box.cy); await page.waitForTimeout(20); }
      await p.up(box.cx + box.w * 0.6, box.cy);                              // 落定前松手，超过阈值 → 队列里变成一次 right 提交
      await settle(page);

      const total = await actionsLen(page);
      assert.equal(total - n0, 2, `起飞 + 拖拽应是两次提交，实为 ${total - n0}`);
      assert.deepEqual(await sidesFrom(page, n0), ["left", "right"], "第二次应是拖拽提交的 right");

      const frames = await framesOf(page);
      const commit = effectFrames(frames, n0).find((e) => e.kind === "commit");
      assert.ok(commit, "应识别到拖拽那次提交");
      assertDwell(t, frames, [commit], "例3");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  test(`${engine} 390 touch: 一直按住的拖拽先跟随手指，其提交在落定 ≥250ms 后`, async (t) => {
    const { ctx, page, errs } = await setup(engine, { touch: true });
    try {
      const n0 = await actionsLen(page);
      const box = await cardBox(page);
      const p = await makePointer(page, engine, true);
      await press(page, ["ArrowLeft", "ArrowLeft"]);                          // 起飞
      await p.down(box.cx, box.cy);                                          // 飞出期间按下，之后一直按住不动
      await page.waitForFunction(() => {
        const c = document.getElementById("card");
        return !window.__zz.animating && c.classList.contains("dragging");
      }, null, { timeout: 3000 });                                           // 等重放把这次 press 起成实拖
      // 每步隔 20ms（真手指跨多帧；否则 webkit 里 move 挤进同一帧录不到 .dragging），6 步约 120ms，仍早于 250ms 停留
      for (let i = 1; i <= 6; i++) { await p.move(box.cx + box.w * 0.1 * i, box.cy); await page.waitForTimeout(20); }
      await p.up(box.cx + box.w * 0.6, box.cy);                              // 立即松手（早于 commitNotBefore）
      await settle(page);

      const total = await actionsLen(page);
      assert.equal(total - n0, 2, `起飞 + 拖拽应是两次提交，实为 ${total - n0}`);
      assert.deepEqual(await sidesFrom(page, n0), ["left", "right"], "第二次应是拖拽提交的 right");

      const frames = await framesOf(page);
      const fly = firstFlyout(frames);
      const firstDrag = frames.findIndex((f) => f.dragging);
      const lastDrag = frames.map((f) => f.dragging).lastIndexOf(true);
      assert.ok(fly >= 0, "应记录到飞出开始的帧");
      assert.ok(firstDrag > fly, "应记录到起拖跟随（.dragging）的帧");
      const lag = Math.round(frames[firstDrag].t - frames[fly].t);
      t.diagnostic(`触摸「拖不动」窗口（飞出开始→起拖跟随）${lag}ms`);
      assert.ok(lag <= 320, `起拖应在飞出开始后 ≤320ms（实际 ${lag}ms）`);

      // 提交的飞出（卡开始往外飞）应在该卡落定并绘制 ≥250ms 之后：松手保持原位，等 commitNotBefore 才飞。
      // 注意：等提交的这段 ui.animating = true（输入继续排队），所以「已落定」的判定要从实拖前回溯，别被这段 busy 截断。
      const release = lastDrag + 1;
      const relDx = frames[release].dx;
      let fCommit = -1;
      for (let i = release + 1; i < frames.length; i++) if (Math.abs(frames[i].dx - relDx) > 5) { fCommit = i; break; }
      assert.ok(fCommit > 0, "应记录到提交飞出的开始帧");
      assert.ok(frames.slice(release + 1, fCommit).some((f) => Math.abs(f.dx - relDx) <= 5),
        "松手后卡应先保持原位一段（说明提交被推迟到 250ms 之后），而不是立刻飞出");
      const held = settleRun(frames, lastDrag);
      const commitMs = Math.round(frames[fCommit].t - frames[held.first].t);
      t.diagnostic(`例4 提交飞出时机：@${held.card} settled=${held.count} delta=${commitMs}ms`);
      assert.ok(commitMs >= 250,
        `[例4] 拖拽提交的飞出应在目标卡 ${held.card} 落定并绘制后 ≥250ms：实测 ${commitMs}ms（落定 ${held.count} 帧）`);
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  test(`${engine} 1280 mouse: Esc 清空整个队列（含按住的 press）`, async (t) => {
    const { ctx, page, errs } = await setup(engine);
    try {
      const n0 = await actionsLen(page);
      const box = await cardBox(page);
      await press(page, ["ArrowLeft", "ArrowLeft"]);                          // 起飞
      await press(page, ["ArrowRight", "ArrowRight"]);                        // 飞出期间入队
      await page.locator("#opt-left").click({ force: true });                 // 出卡期的点选项也入队
      await page.mouse.move(box.cx, box.cy);
      const qBefore = await page.evaluate(() => window.__zz.queued);
      await page.mouse.down();                                                // 出卡期在卡上按下并按住 → 入队 press
      await page.waitForFunction((q) => window.__zz.queued > q, qBefore, { timeout: 2000 }).catch(() => {});   // 旧代码不收 press：不在这里失败，交给下面的断言
      await page.keyboard.press("Escape");                                    // Esc 清空整个队列
      await page.mouse.move(box.cx + box.w * 0.6, box.cy);
      await page.mouse.up();                                                  // 被清掉的 press 松手不再生效
      await page.waitForTimeout(1500);

      const frames = await framesOf(page);
      const fly = firstFlyout(frames);
      assert.ok(fly >= 0, "应记录到飞出开始的帧");
      const flyEnd = frames.findIndex((f, i) => i > fly && !f.anim);
      assert.ok(flyEnd > fly, "应记录到第一次飞出结束的帧");
      assert.ok(!frames.slice(flyEnd).some((f) => f.onL || f.onR), "第一次飞出之后不应再出现左右选项的 on");
      assert.ok(!frames.slice(flyEnd).some((f) => f.dragging), "Esc 之后不应再起实拖");
      assert.equal(await actionsLen(page) - n0, 1, "Esc 后应只剩起飞那一次提交");
      assert.equal(await page.evaluate(() => window.__zz.queued), 0, "Esc 后队列应为空");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  test(`${engine} 390 touch: Esc 清空仍按住的触摸 press`, async (t) => {
    const { ctx, page, errs } = await setup(engine, { touch: true });
    try {
      const n0 = await actionsLen(page);
      const box = await cardBox(page);
      const p = await makePointer(page, engine, true);
      await press(page, ["ArrowLeft", "ArrowLeft"]);                          // 起飞
      await press(page, ["ArrowRight", "ArrowRight"]);                        // 飞出期间再排两个键
      await p.down(box.cx, box.cy);                                          // 飞出期间按下并按住
      await page.waitForFunction(() => window.__zz.queued > 2, null, { timeout: 2000 }).catch(() => {});
      await page.keyboard.press("Escape");                                    // Esc 清空
      await p.move(box.cx + box.w * 0.6, box.cy);
      await p.up(box.cx + box.w * 0.6, box.cy);                              // 被清掉的 press 松手不再生效
      await page.waitForTimeout(1500);

      assert.equal(await actionsLen(page) - n0, 1, "Esc 后应只剩起飞那一次提交");
      assert.equal(await page.evaluate(() => window.__zz.queued), 0, "Esc 后队列应为空");
      const frames = await framesOf(page);
      assert.ok(!frames.some((f) => f.dragging), "Esc 之后不应起实拖");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });
}
