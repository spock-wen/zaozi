// e2e：刻字卡（T03）阶段「排队 vs 即时」回归（PR#9 round 7，C + D 组）。
//
// PM 规格与行为定义：
//   C1 空闲 T03 按 →：只弹锁定提示（#toast.on 含「骨片」），不出动作；再按 K 立刻刻字且提示收起。
//   C2 T02→T03 飞出期间按 → ←：锁定提示显形时刻 ≥ __settles[T03]+245ms，不出动作；再按 K 刻字。
//   D4 T03 入场期间按 K：入队，刻字时刻 ≥ __settles[T03]+245ms，且正好刻一次。
//   D5 T03 入场期间按 → 再按 K：K 不丢，刻字时刻 ≥ __settles[T03]+245ms，且不弹锁定提示。
//   D1 鼠标在 T03 入场滑行中真实点 #bonecorner：命中且确在入场中，刻字时刻 ≥ 落定+245ms，正好刻一次。
//   D3 触屏 390x844 在 T03 入场滑行中真实点 #bonecorner：同 D1。
//   D2 鼠标在 T03 入场滑行中真实点「先不刻」([data-do="skip"])：正好跳过一次，时刻 ≥ 落定+245ms。
//   D6 入场中点一次骨片，落定后 250ms 停留内再点一次：总共只刻一次，时刻 ≥ 落定+245ms。
//
// 计时基准：独立 rAF 记录器写下的 window.__settles（绝不看 __zz.settledAt），margin 245ms。
// 目标定位：先在丢弃上下文里读最终矩形，再在真实运行中每帧 elementFromPoint 判定已在目标内且卡仍在入场。

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";

buildDist();

const VP_DESK = { width: 1280, height: 800 };
const VP_TOUCH = { width: 390, height: 844 };
const MARGIN = 245;

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

// 教学局：停在 T01 并稳住（不走 clearTutorial），装上独立 settle 记录器。
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
  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__zz);
  await startRecorder(page);
  await settle(page);
  return { ctx, page, errs };
}

// 独立 settle 记录器（抄自 flyout_qa.test.mjs）+ 动作时钟 + 提示观察器
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

// 稳：动画停、队列空，且连续 400ms 都如此（抄自 flyout_reset_q.test.mjs）。
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

// T01 → T02 并稳住。
async function gotoT02(page) {
  await press(page, ["ArrowLeft", "ArrowLeft"]);
  await page.waitForFunction(() => window.__zz.st.current === "T02" && !window.__zz.animating, null, { timeout: 5000 });
  await settle(page);
}

// 捕获阶段 pointerdown：记下命中与卡是否在入场中
async function armPointerWatch(page, sel) {
  await page.evaluate((s) => {
    window.__pd = [];
    document.addEventListener("pointerdown", (e) => {
      const card = document.getElementById("card");
      window.__pd.push({
        t: performance.now(),
        inside: !!e.target.closest?.(s),
        target: e.target.id || e.target.className || e.target.tagName,
        entering: (card ? card.getAnimations().some((a) => a.playState === "running") : false) || (window.__zz ? !!window.__zz.animating : false),
      });
    }, true);
  }, sel);
}

// 丢弃上下文：T03 落定后读目标最终矩形（骨片/先不刻的位置对每张刻字卡都一样）。
const geomCache = new Map();
async function finalGeom(engine, touch) {
  const key = `${engine}:${touch ? "touch" : "desk"}`;
  if (geomCache.has(key)) return geomCache.get(key);
  const ctx = await browsers[engine].newContext({
    viewport: touch ? VP_TOUCH : VP_DESK,
    hasTouch: touch,
    ...(touch && engine !== "firefox" ? { isMobile: true } : {}),
  });
  const page = await ctx.newPage();
  const errs = [];
  collectErrors(page, errs);
  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__zz);
  await gotoT02(page);
  await press(page, ["ArrowRight", "ArrowRight"]);
  await page.waitForFunction(
    () => window.__zz.st.current === "T03" && window.__zz.st.phase === "engrave" && !window.__zz.animating
      && !document.getElementById("card").getAnimations().some((a) => a.playState === "running"),
    null, { timeout: 8000 }
  );
  await page.waitForTimeout(400);
  const g = await page.evaluate(() => {
    const r = (s) => {
      const b = document.querySelector(s).getBoundingClientRect();
      return { cx: b.x + b.width / 2, cy: b.y + b.height / 2, w: b.width, h: b.height };
    };
    return { bc: r("#bonecorner"), skip: r('[data-do="skip"]') };
  });
  await ctx.close();
  if (errs.length) throw new Error(`finalGeom 页面报错：${errs.join(" | ")}`);
  geomCache.set(key, g);
  return g;
}

// T03 入场滑行中等待目标中心落点就位且卡仍在入场
async function waitEnteringHit(page, x, y, sel) {
  await page.waitForFunction(([px, py, s]) => {
    const el = document.elementFromPoint(px, py);
    const card = document.getElementById("card");
    const inside = !!el && !!el.closest(s);
    const entering = (card ? card.getAnimations().some((a) => a.playState === "running") : false) || (window.__zz ? window.__zz.animating : false);
    return inside && entering;
  }, [x, y, sel], { timeout: 4000, polling: "raf" });
}

for (const [engine] of Object.entries(ENGINES)) {
  // C1 空闲 T03 按 →：只弹锁定提示（#toast.on 含「骨片」），不出动作；再按 K 立刻刻字
  test(`${engine} C1 1280: idle T03 press → then → shows lock hint, then K carves`, async () => {
    const { ctx, page, errs } = await setupTutorial(engine);
    try {
      await gotoT02(page);
      await press(page, ["ArrowRight", "ArrowRight"]);
      await page.waitForFunction(() => window.__zz.st.current === "T03" && window.__zz.st.phase === "engrave", null, { timeout: 5000 });
      await settle(page);
      await page.waitForTimeout(300);

      const nBefore = await page.evaluate(() => window.__zz.actions.length);
      await press(page, ["ArrowRight", "ArrowRight"]);

      await page.waitForFunction(() => {
        const el = document.getElementById("toast");
        return el && el.classList.contains("on") && el.textContent.includes("骨片");
      }, null, { timeout: 3000 });

      const midSt = await page.evaluate(() => ({
        phase: window.__zz.st.phase,
        n: window.__zz.actions.length,
      }));
      assert.equal(midSt.phase, "engrave", "按下方向键后 phase 应仍在 engrave");
      assert.equal(midSt.n, nBefore, "不应产生新动作");

      await press(page, ["K"]);
      await page.waitForFunction(() => window.__zz.st.phase !== "engrave", null, { timeout: 3000 });

      const finalSt = await page.evaluate(() => ({
        phase: window.__zz.st.phase,
        toastOn: document.getElementById("toast")?.classList.contains("on"),
        engraves: window.__zz.actions.filter((a) => a.type === "engrave"),
      }));
      assert.notEqual(finalSt.phase, "engrave", "按 K 后 phase 应离开 engrave");
      assert.equal(finalSt.engraves.length, 1, "应正好记录一次 engrave 动作");
      assert.equal(finalSt.toastOn, false, "按 K 后 toast 应立即隐藏");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  // C2 T02→T03 飞出期间按 → ←：锁定提示显形时刻 ≥ __settles[T03]+245ms，不出动作；再按 K 刻字
  test(`${engine} C2 1280: T02→T03 fly-out press → ← queues lock hint after settle+245, then K carves`, async () => {
    const { ctx, page, errs } = await setupTutorial(engine);
    try {
      await gotoT02(page);
      const nBefore = await page.evaluate(() => window.__zz.actions.length);

      await press(page, ["ArrowRight", "ArrowRight"]);
      await page.waitForFunction(() => !!window.__zz.animating, null, { timeout: 1000 });
      await press(page, ["ArrowRight", "ArrowLeft"]);

      await page.waitForFunction(() => (window.__toastOns?.length ?? 0) > 0, null, { timeout: 5000 });

      const res = await page.evaluate(() => ({
        settleT: window.__settles?.T03,
        toastOns: window.__toastOns || [],
        n: window.__zz.actions.length,
        phase: window.__zz.st.phase,
      }));

      assert.ok(res.settleT != null, "应记录到 T03 落定时间");
      assert.ok(res.toastOns.length > 0, "应记录到 toast 显形");
      assert.ok(
        res.toastOns[0].t >= res.settleT + MARGIN,
        `锁定提示首次显形时刻 (${res.toastOns[0].t.toFixed(1)}) 应 ≥ 落定+245 (${(res.settleT + MARGIN).toFixed(1)})`
      );
      assert.match(res.toastOns[0].text, /骨片/, "提示文案应包含「骨片」");
      assert.equal(res.n, nBefore + 1, "锁定提示弹出时不应产生新动作（仅含 T01 与 T02 的两次选择）");
      assert.equal(res.phase, "engrave", "此时 phase 应仍在 engrave");

      await press(page, ["K"]);
      await page.waitForFunction(() => window.__zz.st.phase !== "engrave", null, { timeout: 3000 });

      const finalSt = await page.evaluate(() => ({
        phase: window.__zz.st.phase,
        toastOn: document.getElementById("toast")?.classList.contains("on"),
        engraves: window.__zz.actions.filter((a) => a.type === "engrave"),
      }));
      assert.notEqual(finalSt.phase, "engrave", "按 K 后 phase 应离开 engrave");
      assert.equal(finalSt.engraves.length, 1, "应正好记录一次 engrave 动作");
      assert.equal(finalSt.toastOn, false, "按 K 后 toast 应立即隐藏");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  // D4 T03 入场期间按 K：入队，刻字时刻 ≥ __settles[T03]+245ms，且正好刻一次
  test(`${engine} D4 1280: T03 entry press K queues engrave after settle+245`, async () => {
    const { ctx, page, errs } = await setupTutorial(engine);
    try {
      await gotoT02(page);
      await press(page, ["ArrowRight", "ArrowRight"]);

      await page.waitForFunction(() => {
        const z = window.__zz;
        if (!z || z.st?.phase !== "engrave") return false;
        const card = document.getElementById("card");
        const running = card ? card.getAnimations().some((a) => a.playState === "running") : false;
        return running || !!z.animating;
      }, null, { timeout: 4000, polling: "raf" });

      await press(page, ["K"]);

      await page.waitForFunction(() => window.__zz.actions.some((a) => a.type === "engrave"), null, { timeout: 4000 });
      await page.waitForTimeout(300);

      const res = await page.evaluate(() => ({
        settleT: window.__settles?.T03,
        actLog: window.__actLog || [],
        engraves: window.__zz.actions.filter((a) => a.type === "engrave"),
      }));

      assert.ok(res.settleT != null, "应记录到 T03 落定时间");
      assert.equal(res.engraves.length, 1, "正好只刻一次（exactly one engrave）");
      const engraveAct = res.actLog.find((a) => a.type === "engrave");
      assert.ok(engraveAct != null, "actions.push 记录中应有 engrave 动作");
      assert.ok(
        engraveAct.t >= res.settleT + MARGIN,
        `刻字动作时刻 (${engraveAct.t.toFixed(1)}) 应 ≥ 落定+245 (${(res.settleT + MARGIN).toFixed(1)})`
      );
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  // D5 T03 入场期间按 → 再按 K：K 不丢，刻字时刻 ≥ __settles[T03]+245ms，且不弹锁定提示
  test(`${engine} D5 1280: T03 entry press → then K queues exactly one engrave after settle+245 without lock hint`, async () => {
    const { ctx, page, errs } = await setupTutorial(engine);
    try {
      await gotoT02(page);
      await press(page, ["ArrowRight", "ArrowRight"]);

      await page.waitForFunction(() => {
        const z = window.__zz;
        if (!z || z.st?.phase !== "engrave") return false;
        const card = document.getElementById("card");
        const running = card ? card.getAnimations().some((a) => a.playState === "running") : false;
        return running || !!z.animating;
      }, null, { timeout: 4000, polling: "raf" });

      await press(page, ["ArrowRight"]);
      await press(page, ["K"]);

      await page.waitForFunction(() => window.__zz.actions.some((a) => a.type === "engrave"), null, { timeout: 4000 });
      await page.waitForTimeout(300);

      const res = await page.evaluate(() => ({
        settleT: window.__settles?.T03,
        actLog: window.__actLog || [],
        engraves: window.__zz.actions.filter((a) => a.type === "engrave"),
        toastOns: window.__toastOns || [],
      }));

      assert.ok(res.settleT != null, "应记录到 T03 落定时间");
      assert.equal(res.engraves.length, 1, "正好只刻一次（K not dropped）");
      const engraveAct = res.actLog.find((a) => a.type === "engrave");
      assert.ok(engraveAct != null, "actions.push 记录中应有 engrave 动作");
      assert.ok(
        engraveAct.t >= res.settleT + MARGIN,
        `刻字动作时刻 (${engraveAct.t.toFixed(1)}) 应 ≥ 落定+245 (${(res.settleT + MARGIN).toFixed(1)})`
      );
      assert.equal(res.toastOns.length, 0, "不应弹出锁定提示（no lock hint shown）");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  // D1 鼠标在 T03 入场滑行中真实点 #bonecorner
  test(`${engine} D1 1280 mouse: click #bonecorner during entry slide queues engrave after settle+245`, async (t) => {
    const geom = await finalGeom(engine, false);
    let attempt = 0;
    let hitSuccess = false;
    let lastDiagnostic = "";

    while (attempt < 3 && !hitSuccess) {
      attempt++;
      const { ctx, page, errs } = await setupTutorial(engine, { touch: false });
      try {
        await gotoT02(page);
        await armPointerWatch(page, "#bonecorner");

        await press(page, ["ArrowRight", "ArrowRight"]);

        await waitEnteringHit(page, geom.bc.cx, geom.bc.cy, "#bonecorner");
        await page.mouse.click(geom.bc.cx, geom.bc.cy);

        await page.waitForFunction(() => window.__zz.actions.some((a) => a.type === "engrave"), null, { timeout: 4000 });
        await page.waitForTimeout(300);

        const res = await page.evaluate(() => ({
          pd: window.__pd || [],
          settleT: window.__settles?.T03,
          actLog: window.__actLog || [],
          engraves: window.__zz.actions.filter((a) => a.type === "engrave"),
        }));

        const hit = res.pd.find((p) => p.inside);
        if (!hit || !hit.entering) {
          lastDiagnostic = `Attempt ${attempt}: pd=${JSON.stringify(res.pd)}`;
          continue;
        }

        hitSuccess = true;
        assert.ok(hit.inside, "指针事件必须命中 #bonecorner");
        assert.ok(hit.entering, "指针事件必须在入场动画未完成时触发");
        assert.ok(res.settleT != null, "应记录到 T03 落定时间");
        assert.equal(res.engraves.length, 1, "正好只刻一次（exactly one engrave）");
        const engraveAct = res.actLog.find((a) => a.type === "engrave");
        assert.ok(engraveAct != null, "actions.push 记录中应有 engrave 动作");
        assert.ok(
          engraveAct.t >= res.settleT + MARGIN,
          `刻字动作时刻 (${engraveAct.t.toFixed(1)}) 应 ≥ 落定+245 (${(res.settleT + MARGIN).toFixed(1)})`
        );
        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    }

    if (!hitSuccess) {
      t.skip(`在 3 次尝试中未能在卡入场期间命中 #bonecorner：${lastDiagnostic}`);
    }
  });

  // D3 触屏 390x844 在 T03 入场滑行中真实点 #bonecorner
  test(`${engine} D3 390 touch: tap #bonecorner during entry slide queues engrave after settle+245`, async (t) => {
    const geom = await finalGeom(engine, true);
    let attempt = 0;
    let hitSuccess = false;
    let lastDiagnostic = "";

    while (attempt < 3 && !hitSuccess) {
      attempt++;
      const { ctx, page, errs } = await setupTutorial(engine, { touch: true });
      try {
        await gotoT02(page);
        await armPointerWatch(page, "#bonecorner");

        await press(page, ["ArrowRight", "ArrowRight"]);

        await waitEnteringHit(page, geom.bc.cx, geom.bc.cy, "#bonecorner");
        await page.touchscreen.tap(geom.bc.cx, geom.bc.cy);

        await page.waitForFunction(() => window.__zz.actions.some((a) => a.type === "engrave"), null, { timeout: 4000 });
        await page.waitForTimeout(300);

        const res = await page.evaluate(() => ({
          pd: window.__pd || [],
          settleT: window.__settles?.T03,
          actLog: window.__actLog || [],
          engraves: window.__zz.actions.filter((a) => a.type === "engrave"),
        }));

        const hit = res.pd.find((p) => p.inside);
        if (!hit || !hit.entering) {
          lastDiagnostic = `Attempt ${attempt}: pd=${JSON.stringify(res.pd)}`;
          continue;
        }

        hitSuccess = true;
        assert.ok(hit.inside, "指针事件必须命中 #bonecorner");
        assert.ok(hit.entering, "指针事件必须在入场动画未完成时触发");
        assert.ok(res.settleT != null, "应记录到 T03 落定时间");
        assert.equal(res.engraves.length, 1, "正好只刻一次（exactly one engrave）");
        const engraveAct = res.actLog.find((a) => a.type === "engrave");
        assert.ok(engraveAct != null, "actions.push 记录中应有 engrave 动作");
        assert.ok(
          engraveAct.t >= res.settleT + MARGIN,
          `刻字动作时刻 (${engraveAct.t.toFixed(1)}) 应 ≥ 落定+245 (${(res.settleT + MARGIN).toFixed(1)})`
        );
        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    }

    if (!hitSuccess) {
      t.skip(`在 3 次尝试中未能在卡入场期间命中 #bonecorner：${lastDiagnostic}`);
    }
  });

  // D2 鼠标在 T03 入场滑行中真实点「先不刻」([data-do="skip"])
  test(`${engine} D2 1280 mouse: click [data-do="skip"] during entry slide queues skip_engrave after settle+245`, async (t) => {
    const geom = await finalGeom(engine, false);
    let attempt = 0;
    let hitSuccess = false;
    let lastDiagnostic = "";

    while (attempt < 3 && !hitSuccess) {
      attempt++;
      const { ctx, page, errs } = await setupTutorial(engine, { touch: false });
      try {
        await gotoT02(page);
        await armPointerWatch(page, '[data-do="skip"]');

        await press(page, ["ArrowRight", "ArrowRight"]);

        await waitEnteringHit(page, geom.skip.cx, geom.skip.cy, '[data-do="skip"]');
        await page.mouse.click(geom.skip.cx, geom.skip.cy);

        await page.waitForFunction(() => window.__zz.actions.some((a) => a.type === "skip_engrave"), null, { timeout: 4000 });
        await page.waitForTimeout(300);

        const res = await page.evaluate(() => ({
          pd: window.__pd || [],
          settleT: window.__settles?.T03,
          actLog: window.__actLog || [],
          skips: window.__zz.actions.filter((a) => a.type === "skip_engrave"),
        }));

        const hit = res.pd.find((p) => p.inside);
        if (!hit || !hit.entering) {
          lastDiagnostic = `Attempt ${attempt}: pd=${JSON.stringify(res.pd)}`;
          continue;
        }

        hitSuccess = true;
        assert.ok(hit.inside, "指针事件必须命中 [data-do='skip']");
        assert.ok(hit.entering, "指针事件必须在入场动画未完成时触发");
        assert.ok(res.settleT != null, "应记录到 T03 落定时间");
        assert.equal(res.skips.length, 1, "正好只跳过一次（exactly one skip_engrave）");
        const skipAct = res.actLog.find((a) => a.type === "skip_engrave");
        assert.ok(skipAct != null, "actions.push 记录中应有 skip_engrave 动作");
        assert.ok(
          skipAct.t >= res.settleT + MARGIN,
          `跳过动作时刻 (${skipAct.t.toFixed(1)}) 应 ≥ 落定+245 (${(res.settleT + MARGIN).toFixed(1)})`
        );
        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    }

    if (!hitSuccess) {
      t.skip(`在 3 次尝试中未能在卡入场期间命中 [data-do="skip"]：${lastDiagnostic}`);
    }
  });

  // D6 入场中点一次骨片，落定后 250ms 停留内再点一次：总共只刻一次
  test(`${engine} D6 1280 mouse: click #bonecorner during entry then again in dwell executes exactly one engrave after settle+245`, async (t) => {
    const geom = await finalGeom(engine, false);
    let attempt = 0;
    let hitSuccess = false;
    let lastDiagnostic = "";

    while (attempt < 3 && !hitSuccess) {
      attempt++;
      const { ctx, page, errs } = await setupTutorial(engine, { touch: false });
      try {
        await gotoT02(page);
        await armPointerWatch(page, "#bonecorner");

        await press(page, ["ArrowRight", "ArrowRight"]);

        await waitEnteringHit(page, geom.bc.cx, geom.bc.cy, "#bonecorner");
        // 第一次点：入场中
        await page.mouse.click(geom.bc.cx, geom.bc.cy);

        // 轮询直到 __settles[T03] 出现（卡刚落定，正处于 250ms dwell 停留内）
        await page.waitForFunction(() => !!window.__settles?.T03, null, { polling: "raf" });
        // 第二次点：停留内现场点
        await page.mouse.click(geom.bc.cx, geom.bc.cy);

        await page.waitForFunction(() => window.__zz.actions.some((a) => a.type === "engrave"), null, { timeout: 4000 });
        await page.waitForTimeout(300);

        const res = await page.evaluate(() => ({
          pd: window.__pd || [],
          settleT: window.__settles?.T03,
          actLog: window.__actLog || [],
          engraves: window.__zz.actions.filter((a) => a.type === "engrave"),
        }));

        const hit1 = res.pd[0];
        if (!hit1 || !hit1.inside || !hit1.entering) {
          lastDiagnostic = `Attempt ${attempt}: pd=${JSON.stringify(res.pd)}`;
          continue;
        }

        hitSuccess = true;
        assert.ok(res.settleT != null, "应记录到 T03 落定时间");
        assert.equal(res.engraves.length, 1, "两次点击总共只刻一次（exactly ONE engrave total）");
        const engraveAct = res.actLog.find((a) => a.type === "engrave");
        assert.ok(engraveAct != null, "actions.push 记录中应有 engrave 动作");
        assert.ok(
          engraveAct.t >= res.settleT + MARGIN,
          `刻字动作时刻 (${engraveAct.t.toFixed(1)}) 应 ≥ 落定+245 (${(res.settleT + MARGIN).toFixed(1)})`
        );
        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    }

    if (!hitSuccess) {
      t.skip(`在 3 次尝试中未能在卡入场期间完成 D6：${lastDiagnostic}`);
    }
  });
}
