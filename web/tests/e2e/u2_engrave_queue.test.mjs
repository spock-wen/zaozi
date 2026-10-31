// e2e: U2/R08 engrave queue behavior & ui.engraveHinted lifecycle
// 1. Queue K, S across an engrave card: both execute in order after settle >= 250ms; queue not cleared.
// 2. Queue non-executable items (arrows only): lock hint shows exactly ONCE; ui.engraveHinted tracks lifecycle and resets properly.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";
import { passCutscene } from "./helpers/flow.mjs";

buildDist();

const VP = { width: 1280, height: 800 };
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

async function setupPage(engine) {
  const ctx = await browsers[engine].newContext({ viewport: VP, hasTouch: false });
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

async function startRecorder(page) {
  await page.evaluate(() => {
    if (window.__raf) cancelAnimationFrame(window.__raf);
    window.__settles = {};
    window.__actLog = [];
    window.__toastOns = [];

    const arr = window.__zz.actions;
    if (!arr.__clockPatched) {
      const orig = arr.push;
      arr.push = function (...items) {
        const t = performance.now();
        for (const a of items) window.__actLog.push({ t, type: a.type, side: a.side, trace: a.trace });
        return orig.apply(this, items);
      };
      arr.__clockPatched = true;
    }

    const toastEl = document.getElementById("toast");
    if (toastEl) {
      new MutationObserver(() => {
        if (toastEl.classList.contains("on")) {
          window.__toastOns.push({ t: performance.now(), text: toastEl.textContent || "" });
        }
      }).observe(toastEl, { attributes: true, attributeFilter: ["class"] });
    }

    let prevN = window.__zz.actions.length;
    let prevCur = window.__zz.st.current;

    const loop = () => {
      const z = window.__zz;
      const card = document.getElementById("card");
      const n = z ? z.actions.length : 0;
      const cur = z?.st?.current;
      const t = performance.now();

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

      prevN = n;
      prevCur = cur;
      window.__raf = requestAnimationFrame(loop);
    };
    window.__raf = requestAnimationFrame(loop);
  });
}

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

async function gotoT02(page) {
  await press(page, ["ArrowLeft", "ArrowLeft"]);
  await page.waitForFunction(() => window.__zz.st.current === "T02" && !window.__zz.animating, null, { timeout: 5000 });
  await passCutscene(page);
  await settle(page);
}

for (const [engine] of Object.entries(ENGINES)) {
  test(`${engine}: U2 queue K, S across consecutive engrave cards -> both run in order after settle+250ms, queue not cleared`, async () => {
    const { ctx, page, errs } = await setupPage(engine);
    try {
      await gotoT02(page);

      // Arrange deck so after the first T03, another T03 enters (consecutive engrave cards)
      await page.evaluate(() => {
        window.__zz.st.deck.unshift("T03");
      });

      const n0 = await page.evaluate(() => window.__zz.actions.length);

      // Commit T02 to right -> fly-out to first T03 starts
      await press(page, ["ArrowRight", "ArrowRight"]);
      await page.waitForFunction(() => !!window.__zz.animating, null, { timeout: 2000 });

      // While entering / flying to T03, queue K and S
      // Once T03 is entered, st.phase is 'engrave', carveBusy() queues K and S
      await page.waitForFunction(() => window.__zz.st.phase === "engrave", null, { timeout: 3000 });
      await page.keyboard.press("k");
      await page.keyboard.press("s");

      // Verify both K and S were queued (queued >= 2)
      const qLen = await page.evaluate(() => window.__zz.queued);
      assert.ok(qLen >= 2, `Both K and S should be queued, got ${qLen}`);

      // First T03: settleKey is "T03|" + n0 + 1
      const key1 = `T03|${n0 + 1}`;
      await page.waitForFunction((k) => window.__settles?.[k] != null, key1, { timeout: 8000 });

      // Wait for second action (skip_engrave) to complete
      await page.waitForFunction(
        () => window.__zz.actions.some((a) => a.type === "skip_engrave"),
        null,
        { timeout: 10000 }
      );

      const log = await page.evaluate(() => ({
        settles: window.__settles,
        actLog: window.__actLog,
        tallies: window.__zz.st.tallies.map((t) => t.target),
        actions: window.__zz.actions.map((a) => a.type || a.side),
      }));

      // Find the engrave action and skip_engrave action
      const engraveAct = log.actLog.find((a) => a.type === "engrave");
      const skipAct = log.actLog.find((a) => a.type === "skip_engrave");
      assert.ok(engraveAct, "First engrave card should execute engrave (K)");
      assert.ok(skipAct, "Second engrave card should execute skip_engrave (S)");

      // Both must run in order: engraveAct.t < skipAct.t
      assert.ok(engraveAct.t < skipAct.t, "K and S must run in order");

      // Engrave occurred after first T03 settle >= 245ms
      const tSettle1 = log.settles[key1];
      assert.ok(tSettle1, "First T03 settle timestamp recorded");
      assert.ok(engraveAct.t >= tSettle1 + MARGIN, `First K must execute >= settle1+245ms, diff: ${engraveAct.t - tSettle1}`);

      // Second T03 settle: settleKey is "T03|" + (n0 + 2)
      const key2 = `T03|${n0 + 2}`;
      const tSettle2 = log.settles[key2];
      assert.ok(tSettle2, "Second T03 settle timestamp recorded");
      assert.ok(skipAct.t >= tSettle2 + MARGIN, `Second S must execute >= settle2+245ms, diff: ${skipAct.t - tSettle2}`);

      // Verify tallies: only the first T03 carved "休", second was skipped
      assert.deepEqual(log.tallies, ["休"], "Only the first card should be carved into tallies");

      assert.deepEqual(errs, []);
    } finally {
      await ctx.close();
    }
  });

  test(`${engine}: U2 arrows-only in engrave phase -> exactly one lock hint & ui.engraveHinted resets properly`, async () => {
    const { ctx, page, errs } = await setupPage(engine);
    try {
      await gotoT02(page);

      // At T02, assert ui.engraveHinted is false
      const hintedBefore = await page.evaluate(() => window.__zz.engraveHinted);
      assert.equal(hintedBefore, false, "engraveHinted must be false before engrave phase");

      // Commit T02 to enter T03
      await press(page, ["ArrowRight", "ArrowRight"]);
      await page.waitForFunction(() => window.__zz.st.phase === "engrave", null, { timeout: 3000 });

      // While T03 is entering, queue arrows only
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("ArrowRight");

      // Wait for T03 settle + dwell
      await page.waitForFunction(() => window.__settles?.T03 != null, null, { timeout: 8000 });
      await page.waitForFunction(
        () => (window.__toastOns || []).filter((t) => /骨片/.test(t.text)).length >= 1,
        null,
        { timeout: 8000 }
      );

      // Exactly one lock hint shown for all queued arrows.
      // T01 的左右答句也会记进 __toastOns，不计入刻字锁提示。
      const toastCount1 = await page.evaluate(() => window.__toastOns.filter((t) => /骨片/.test(t.text)).length);
      assert.equal(toastCount1, 1, "Exactly one lock hint must be shown for queued arrows");
      const hintedAfter = await page.evaluate(() => window.__zz.engraveHinted);
      assert.equal(hintedAfter, true, "ui.engraveHinted must be true after lock hint was shown");

      // Now carve T03 with K
      await page.keyboard.press("k");
      await page.waitForFunction(() => window.__zz.st.current === "T04", null, { timeout: 5000 });

      // Upon entering T04, ui.engraveHinted should reset
      // Test reset on next card or phase transition
      const hintedOnT04 = await page.evaluate(() => window.__zz.engraveHinted);
      assert.equal(hintedOnT04, false, "ui.engraveHinted must reset to false upon card/phase change");

      // Test reset on newGame
      await page.evaluate(() => {
        window.__zz.ui.engraveHinted = true;
        window.__zz.newGame(20261016);
      });
      const hintedAfterNewGame = await page.evaluate(() => window.__zz.engraveHinted);
      assert.equal(hintedAfterNewGame, false, "ui.engraveHinted must reset to false on newGame");

      assert.deepEqual(errs, []);
    } finally {
      await ctx.close();
    }
  });
}
