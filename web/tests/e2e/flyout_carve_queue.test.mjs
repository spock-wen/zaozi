// e2e：刻字卡（T03）排队按键保持 dwell 门禁回归（PR#9 round 8，TP34q）。
//
// 验证目标：
//   在 T02 飞出进 T03（刻字卡）期间排队的按键（→ →），在 T03 落定后进入 250ms dwell 停留门禁。
//   在 dwell 停留中段（落定后 100ms，2-rAF drainArmed 已过），输入 K（桌面）或点击骨片（触屏）
//   必须排在已有队列之后（由 carveBusy 中的 ui.keyQueue.length > 0 守卫），
//   直到 dwell 门禁放行（时刻 ≥ __settles[T03]+245ms）才执行刻字。
//   突变 TP34q（移除了 || ui.keyQueue.length > 0）会导致此时 carveBusy() 返回 false，
//   使刻字在 ~+115ms 抢先触发，从而打破 engrave 时刻 ≥ 落定+245ms 断言。

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, buildDist, startServer, collectErrors } from "./helpers/env.mjs";

buildDist();

const VP_DESK = { width: 1280, height: 800 };
const VP_TOUCH = { width: 390, height: 844 };
const MARGIN = 245;
const SEED = 20261016;

const press = async (page, keys) => {
  for (const k of keys) await page.keyboard.press(k);
};

let server, browsers = {};
before(async () => {
  server = await startServer();
  for (const [name, type] of Object.entries(ENGINES)) browsers[name] = await type.launch();
});
after(async () => {
  for (const b of Object.values(browsers)) await b.close();
  server?.close();
});

// 教学局：清除 localStorage，停在 T01 并稳住，装上独立 settle 记录器。
async function setupTutorial(engine, opts = {}) {
  const touch = !!opts.touch;
  const ctx = await browsers[engine].newContext({
    viewport: touch ? VP_TOUCH : VP_DESK,
    hasTouch: touch,
    ...(touch && engine !== "firefox" ? { isMobile: true } : {}),
  });
  const page = await ctx.newPage();
  const errs = [];
  collectErrors(page, errs);
  await page.addInitScript(() => { localStorage.clear(); });
  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.evaluate(() => localStorage.clear());
  await page.waitForFunction(() => !!window.__zz);
  await startRecorder(page);
  await settle(page);
  return { ctx, page, errs };
}

// 独立 settle 记录器（镜像自 flyout_carve.test.mjs）+ 动作时钟 + 提示观察器
async function startRecorder(page) {
  await page.evaluate(() => {
    if (window.__raf) cancelAnimationFrame(window.__raf);
    window.__frames = [];
    window.__commits = [];
    window.__keyEvents = [];
    window.__settles = {};
    window.__actLog = [];

    // 动作时钟：劫持 actions.push 精确记录 dispatch 触发的时间戳
    const arr = window.__zz.actions;
    if (!arr.__clockPatched) {
      const orig = arr.push;
      arr.push = function (...items) {
        const t = performance.now();
        for (const a of items) window.__actLog.push({ t, type: a.type, side: a.side });
        return orig.apply(this, items);
      };
      arr.__clockPatched = true;
    }

    // 提示观察器：MutationObserver 记录 toast 首次变 .on 的时间
    const toastEl = document.getElementById("toast");
    window.__toastOns = [];
    if (toastEl) {
      new MutationObserver(() => {
        if (toastEl.classList.contains("on")) {
          window.__toastOns.push({ t: performance.now(), text: toastEl.textContent || "" });
        }
      }).observe(toastEl, { attributes: true, attributeFilter: ["class"] });
    }

    document.addEventListener("keydown", (e) => {
      window.__keyEvents.push({
        key: e.key,
        repeat: e.repeat,
        animating: !!window.__zz?.animating,
        t: performance.now(),
      });
    }, true);

    let prevN = window.__zz.actions.length;
    let prevCur = window.__zz.st.current;

    const loop = () => {
      const z = window.__zz;
      const card = document.getElementById("card");
      const n = z ? z.actions.length : 0;
      const cur = z?.st?.current;
      const t = performance.now();
      const delta = n - prevN;

      const noAnim = !z?.animating;
      const noRunningAnim = card ? !card.getAnimations().some((a) => a.playState === "running") : true;
      const noTransform = card ? (card.style.transform === "" || card.style.transform === "none") : true;
      const notDragging = card ? !card.classList.contains("dragging") : true;
      const settled = noAnim && noRunningAnim && noTransform && notDragging;

      const cardKey = cur + "|" + n;
      if (settled && window.__settles[cardKey] == null) {
        window.__settles[cardKey] = t;
        if (window.__settles[cur] == null) window.__settles[cur] = t;
      }

      if (delta > 0) {
        window.__commits.push({
          t,
          delta,
          n,
          cur,
          prevCur,
          acts: z.actions.slice(prevN).map((a) => a.type || a.side),
        });
      }

      window.__frames.push({ t, n, cur });
      prevN = n;
      prevCur = cur;
      window.__raf = requestAnimationFrame(loop);
    };
    window.__raf = requestAnimationFrame(loop);
  });
}

// 稳：动画停、队列空，且连续 400ms 都如此（镜像自 flyout_carve.test.mjs）。
async function settle(page) {
  await page.evaluate(() => { window.__settleFrom = 0; });
  await page.waitForFunction(() => {
    const card = document.getElementById("card");
    const busy = window.__zz.animating
      || (card ? card.getAnimations().some((a) => a.playState === "running") : false)
      || (window.__zz.queued ?? 0) !== 0;
    if (busy) { window.__settleFrom = 0; return false; }
    const now = performance.now();
    if (!window.__settleFrom) window.__settleFrom = now;
    return now - window.__settleFrom >= 400;
  }, null, { timeout: 10000, polling: 60 });
}

// T01 → T02 并稳住（T01 提交向左，镜像自 flyout_carve.test.mjs）。
async function gotoT02(page) {
  await press(page, ["ArrowLeft", "ArrowLeft"]);
  await page.waitForFunction(() => window.__zz.st.current === "T02" && !window.__zz.animating, null, { timeout: 5000 });
  await settle(page);
}

for (const [engine] of Object.entries(ENGINES)) {
  // case K: desktop 1280x800 context
  test(`${engine} K 1280 mouse/keys: queued arrows hold dwell gate, K executes engrave after settle+245`, { timeout: 30000 }, async () => {
    const { ctx, page, errs } = await setupTutorial(engine, { touch: false });
    try {
      await gotoT02(page);
      const nBeforeT02 = await page.evaluate(() => window.__zz.actions.length);

      // At T02 press → → (commits T02, fly-out to T03 starts)
      await press(page, ["ArrowRight", "ArrowRight"]);
      await page.waitForFunction(() => !!window.__zz.animating, null, { timeout: 2000 });

      // DURING that fly-out press → → again (queued)
      await press(page, ["ArrowRight", "ArrowRight"]);

      // At T03: wait for window.__settles.T03, then wait until performance.now() >= __settles.T03 + 100
      await page.waitForFunction(() => !!window.__settles?.T03, null, { timeout: 8000, polling: "raf" });
      await page.waitForFunction(() => performance.now() >= window.__settles.T03 + 100, null, { timeout: 8000, polling: "raf" });

      // Assert window.__zz.queued >= 1 right before input
      const queuedBefore = await page.evaluate(() => window.__zz.queued);
      assert.ok(queuedBefore >= 1, `window.__zz.queued right before input must be >= 1, got ${queuedBefore}`);

      // case K: page.keyboard.press("k")
      await page.keyboard.press("k");

      // Record __zz.queued just after the input
      const queuedAfter = await page.evaluate(() => window.__zz.queued);

      // Wait for engrave action to be recorded and phase to leave engrave
      await page.waitForFunction(
        () => window.__zz.actions.some((a) => a.type === "engrave") && window.__zz.st.phase !== "engrave",
        null,
        { timeout: 8000 }
      );

      const res = await page.evaluate((n0) => ({
        settleT: window.__settles?.T03,
        actLog: window.__actLog || [],
        actionsAfterT02: (window.__zz.actions || []).slice(n0),
        phase: window.__zz.st.phase,
        queued: window.__zz.queued,
      }), nBeforeT02);

      // Assertion 1:
      // Exactly one action of type "engrave" after T02's commit, and the only "choose" after the T02 starting point is T02's own right commit
      const engraves = res.actionsAfterT02.filter((a) => a.type === "engrave");
      assert.equal(engraves.length, 1, `T02 提交后应正好记录一次 engrave 动作，实得 ${engraves.length}`);

      const chooses = res.actionsAfterT02.filter((a) => a.type === "choose");
      assert.equal(chooses.length, 1, `T02 起点之后唯一的 choose 应为 T02 本身的向右提交，实得 ${chooses.length}`);
      assert.equal(chooses[0].side, "right", `T02 提交方向应为 right，实得 ${chooses[0].side}`);

      // Assertion 2:
      // The engrave action time ≥ __settles.T03 + 245
      const engraveAct = res.actLog.find((a) => a.type === "engrave");
      assert.ok(engraveAct != null, "actions.push 记录中应有 engrave 动作");
      const diffMs = engraveAct.t - res.settleT;
      console.log(`[${engine} K 1280] queuedBefore=${queuedBefore}, queuedAfter=${queuedAfter}, engrave-after-settle=${diffMs.toFixed(1)}ms`);
      assert.ok(
        engraveAct.t >= res.settleT + MARGIN,
        `刻字动作时刻 (${engraveAct.t.toFixed(1)}) 应 ≥ 落定+245 (${(res.settleT + MARGIN).toFixed(1)}), 差值 ${diffMs.toFixed(1)}ms`
      );

      // Assertion 3:
      // After it: phase left engrave, __zz.queued === 0, no page errors.
      assert.notEqual(res.phase, "engrave", "刻字后 phase 应离开 engrave");
      assert.equal(res.queued, 0, `刻字后 __zz.queued 应清零，实得 ${res.queued}`);
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });

  // case tap: touch tap on the centre of #bonecorner — 390x844 context with hasTouch/isMobile
  test(`${engine} tap 390 touch: queued arrows hold dwell gate, tap #bonecorner executes engrave after settle+245`, { timeout: 30000 }, async () => {
    const { ctx, page, errs } = await setupTutorial(engine, { touch: true });
    try {
      await gotoT02(page);
      const nBeforeT02 = await page.evaluate(() => window.__zz.actions.length);

      // At T02 press → → (commits T02, fly-out to T03 starts)
      await press(page, ["ArrowRight", "ArrowRight"]);
      await page.waitForFunction(() => !!window.__zz.animating, null, { timeout: 2000 });

      // DURING that fly-out press → → again (queued)
      await press(page, ["ArrowRight", "ArrowRight"]);

      // At T03: wait for window.__settles.T03
      await page.waitForFunction(() => !!window.__settles?.T03, null, { timeout: 8000, polling: "raf" });

      // Locate #bonecorner center on settled card
      const bc = await page.evaluate(() => {
        const el = document.getElementById("bonecorner");
        if (!el) throw new Error("#bonecorner not found");
        const b = el.getBoundingClientRect();
        return { cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
      });

      // Wait until performance.now() >= __settles.T03 + 100
      await page.waitForFunction(() => performance.now() >= window.__settles.T03 + 100, null, { timeout: 8000, polling: "raf" });

      // Assert window.__zz.queued >= 1 right before input
      const queuedBefore = await page.evaluate(() => window.__zz.queued);
      assert.ok(queuedBefore >= 1, `window.__zz.queued right before input must be >= 1, got ${queuedBefore}`);

      // case tap: touch tap on the centre of #bonecorner
      await page.touchscreen.tap(bc.cx, bc.cy);

      // Record __zz.queued just after the input
      const queuedAfter = await page.evaluate(() => window.__zz.queued);

      // Wait for engrave action to be recorded and phase to leave engrave
      await page.waitForFunction(
        () => window.__zz.actions.some((a) => a.type === "engrave") && window.__zz.st.phase !== "engrave",
        null,
        { timeout: 8000 }
      );

      const res = await page.evaluate((n0) => ({
        settleT: window.__settles?.T03,
        actLog: window.__actLog || [],
        actionsAfterT02: (window.__zz.actions || []).slice(n0),
        phase: window.__zz.st.phase,
        queued: window.__zz.queued,
      }), nBeforeT02);

      // Assertion 1:
      // Exactly one action of type "engrave" after T02's commit, and the only "choose" after the T02 starting point is T02's own right commit
      const engraves = res.actionsAfterT02.filter((a) => a.type === "engrave");
      assert.equal(engraves.length, 1, `T02 提交后应正好记录一次 engrave 动作，实得 ${engraves.length}`);

      const chooses = res.actionsAfterT02.filter((a) => a.type === "choose");
      assert.equal(chooses.length, 1, `T02 起点之后唯一的 choose 应为 T02 本身的向右提交，实得 ${chooses.length}`);
      assert.equal(chooses[0].side, "right", `T02 提交方向应为 right，实得 ${chooses[0].side}`);

      // Assertion 2:
      // The engrave action time ≥ __settles.T03 + 245
      const engraveAct = res.actLog.find((a) => a.type === "engrave");
      assert.ok(engraveAct != null, "actions.push 记录中应有 engrave 动作");
      const diffMs = engraveAct.t - res.settleT;
      console.log(`[${engine} tap 390] queuedBefore=${queuedBefore}, queuedAfter=${queuedAfter}, engrave-after-settle=${diffMs.toFixed(1)}ms`);
      assert.ok(
        engraveAct.t >= res.settleT + MARGIN,
        `刻字动作时刻 (${engraveAct.t.toFixed(1)}) 应 ≥ 落定+245 (${(res.settleT + MARGIN).toFixed(1)}), 差值 ${diffMs.toFixed(1)}ms`
      );

      // Assertion 3:
      // After it: phase left engrave, __zz.queued === 0, no page errors.
      assert.notEqual(res.phase, "engrave", "刻字后 phase 应离开 engrave");
      assert.equal(res.queued, 0, `刻字后 __zz.queued 应清零，实得 ${res.queued}`);
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });
}
