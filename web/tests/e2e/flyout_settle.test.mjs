// e2e：排队输入的重放时机——每个排队项必须等「当前卡落定、并已画出至少一帧」之后才生效。
//
// 旧模型是飞出结束时同步重放，重放发生在下一张卡刚渲染、还没绘制的那一帧：排队的 Digit1 落在
// 一张没上过屏的卡上，排队的 →→ 隔 0ms 就提交下一张。新模型一项一放，放之前先等 whenCardEntryDone()
// 落定、再走两帧 rAF，所以「预览先于提交、入场无动画（落字）的卡也先画出来」。
//
// 每页装一个 rAF 帧记录器：每帧记 {t, cur, title, busy, n(=actions.length), onL, onR}。
// 通用断言 appliedOnSettled：动作 k 生效的那一帧之前，它作用的那张卡必须有 ≥2 帧「已落定(!busy)、
// 且此时还没有任何新动作(n===k)」，即卡先停稳并画出来，输入才生效。
//
// 第 2 代存档（prevCode = 带落字位的卡的前一张，okCode = 那张卡）在 before() 里用 chromium 算一次；
// 每个用例：新上下文 → ?seed → importCode → 等稳。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";
import { clearTutorial, playToWinter, commit, passCutscene } from "./helpers/flow.mjs";

buildDist();

let server, browsers = {}, codes = null;

before(async () => {
  server = await startServer();
  for (const [name, type] of Object.entries(ENGINES)) browsers[name] = await type.launch();
  codes = await buildGen2Codes();
});
after(async () => {
  for (const b of Object.values(browsers)) await b.close();
  server?.close();
});

const VP = { width: 1280, height: 800 };

// 第 2 代：教学 → 冬夜 → 天亮了 → 先人 → 交给第 2 代 → 挑「水/日/人」（各点两下才选中）→ 出发。
// 然后一直 ←←，找到第一张带 #wordbox .slot.ok 的卡：它前一张的 code = prevCode，它的 code = okCode。
async function buildGen2Codes() {
  const own = !browsers.chromium;
  const browser = browsers.chromium || (await chromium.launch());
  const ctx = await browser.newContext({ viewport: VP });
  const page = await ctx.newPage();
  try {
    await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
    await page.waitForFunction(() => !!window.__zz);
    await clearTutorial(page);
    await playToWinter(page);
    await page.locator("#winter-end").click();
    await page.locator("#endseq").waitFor({ state: "visible", timeout: 15000 });
    await page.locator('#endseq [data-do="elder"]').click();
    await page.locator("#elder").waitFor({ state: "visible" });
    await page.locator('#elder [data-do="heir"]').click();
    await page.locator("#pick").waitFor({ state: "visible" });
    for (const ch of ["水", "日", "人"]) {
      const cand = page.locator(`#pick .cand[data-char="${ch}"]`);
      await cand.click();               // 第一下只看说明
      await cand.click();               // 第二下才选中
    }
    await page.locator("#pick .go").click();
    await page.waitForTimeout(2500);

    let prevCode = null, okCode = null;
    for (let i = 0; i < 80 && !okCode; i++) {
      const code = await page.evaluate(() => window.__zz.code());
      const hasOk = (await page.locator("#wordbox .slot.ok").count()) > 0;
      if (hasOk && prevCode) { okCode = code; break; }
      prevCode = code;
      await commit(page, "left");
    }
    assert.ok(prevCode && okCode, `没找到带落字位的卡（prevCode=${prevCode}, okCode=${okCode}）`);
    return { prevCode, okCode };
  } finally {
    await ctx.close();
    if (own) await browser.close();
  }
}

async function setup(engine, opts = {}) {
  const ctx = await browsers[engine].newContext({
    viewport: opts.viewport || VP,
    hasTouch: !!opts.touch,
    isMobile: !!opts.touch && engine !== "firefox",   // Firefox 不支持 isMobile
  });
  const page = await ctx.newPage();
  const errs = [];
  collectErrors(page, errs);
  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__zz);
  await page.evaluate((c) => window.__zz.importCode(c), opts.code);
  await page.waitForTimeout(1500);
  await startRecorder(page);
  await settle(page);
  return { ctx, page, errs };
}

// F4 用例用：全新一局（教学走完、第一张普通卡），不导入存档码。
async function setupFresh(engine) {
  const ctx = await browsers[engine].newContext({ viewport: VP });
  const page = await ctx.newPage();
  const errs = [];
  collectErrors(page, errs);
  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__zz);
  await clearTutorial(page);
  await page.waitForFunction(() => window.__zz.st.phase === "card" && !window.__zz.animating, null, { timeout: 5000 });
  await settle(page);
  return { ctx, page, errs };
}

async function startRecorder(page) {
  await page.evaluate(() => {
    if (window.__raf) cancelAnimationFrame(window.__raf);
    window.__frames = [];
    const on = (id) => { const e = document.getElementById(id); return !!e && e.classList.contains("on"); };
    const loop = () => {
      const z = window.__zz, card = document.getElementById("card");
      window.__frames.push({
        t: performance.now(),
        cur: z.st.current,
        title: (document.getElementById("card-title") || {}).textContent,
        busy: !!z.animating || (card ? card.getAnimations().some((a) => a.playState === "running") : false),
        n: z.actions.length,
        onL: on("opt-left"),
        onR: on("opt-right"),
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

async function press(page, keys) { for (const k of keys) await page.keyboard.press(k); }
const framesOf = (page) => page.evaluate(() => window.__frames);
const actionsLen = (page) => page.evaluate(() => window.__zz.actions.length);
const sidesFrom = (page, n0) => page.evaluate((n) => window.__zz.actions.slice(n).map((a) => a.side), n0);
const actsFrom = (page, n0) => page.evaluate((n) => window.__zz.actions.slice(n), n0);
const optOn = (page, id) => page.evaluate((i) => document.getElementById(i).classList.contains("on"), id);
const menuVisible = (page) => page.evaluate(() => !document.getElementById("menu-pop").hidden);
const dlgVisible = (page) => page.evaluate(() => !document.getElementById("savedlg").hidden);

const firstFrameAfter = (frames, k) => {
  for (let i = 1; i < frames.length; i++) if (frames[i].n > k) return i;
  return -1;
};
// 动作 k 作用在哪张卡：生效前最后一帧的 cur。
function appliedCard(frames, k) {
  const f = firstFrameAfter(frames, k);
  return f < 0 ? null : frames[f - 1].cur;
}

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
    if (count < 2) problems.push(`动作 #${k} 落在卡 ${card}，但该卡落定并绘制的帧只有 ${count} 帧（需 ≥2 个采样 = ≥1 个已绘制出来的落定帧；settleToApply=${ms}ms）`);
  }
  t.diagnostic(`${label} 重放时机：${notes.join(" | ")}`);
  assert.deepEqual(problems, [], `[${label}] 排队输入必须先等当前卡落定并绘制才生效：${problems.join(" ; ")}`);
}

for (const [engine] of Object.entries(ENGINES)) {
  test(`${engine} 1280: →→ 后飞出期间再 →→，第二次提交的卡先落定再生效`, async (t) => {
    const { ctx, page, errs } = await setup(engine, { code: codes.okCode });
    try {
      const n0 = await actionsLen(page);
      await press(page, ["ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight"]);
      await settle(page);
      const total = await actionsLen(page);
      assert.equal(total - n0, 2, `应恰好两次提交，实为 ${total - n0}`);
      assert.deepEqual(await sidesFrom(page, n0), ["right", "right"], "两次 → 依次提交");
      const frames = await framesOf(page);
      appliedOnSettled(t, frames, n0, total, "例1");

      const f1 = firstFrameAfter(frames, n0);
      const card1 = frames[f1].cur;                       // 第一次提交翻出的卡
      let g = -1;
      for (let i = 0; i < frames.length; i++) if (frames[i].onR && frames[i].cur === card1) { g = i; break; }
      assert.ok(g > 0, "应在第二张卡上看到右侧预览");
      let settled = -1, count = 0;
      for (let j = 0; j < g; j++) if (frames[j].cur === card1 && !frames[j].busy && frames[j].n === n0 + 1) { if (settled < 0) settled = j; count++; }
      assert.ok(count >= 2, `第二张卡的右侧预览必须出现在该卡落定并绘制之后（落定帧 ${count}）`);
      t.diagnostic(`例1：第二张卡 ${card1} 落定到出现预览 ${Math.round(frames[g].t - frames[settled].t)}ms`);
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  test(`${engine} 1280: 飞出期间 Digit1 落到下一张（已落定的落字卡）`, async (t) => {
    const { ctx, page, errs } = await setup(engine, { code: codes.prevCode });
    try {
      const n0 = await actionsLen(page);
      await press(page, ["ArrowLeft", "ArrowLeft", "Digit1"]);
      await settle(page);
      const total = await actionsLen(page);
      const acts = await actsFrom(page, n0);
      assert.equal(acts.length, 2, `应为 2 个动作（left 提交 + 落字），实为 ${JSON.stringify(acts)}`);
      assert.equal(acts[0].type, "choose");
      assert.equal(acts[0].side, "left", "第一个动作应是 left 提交");
      assert.equal(acts[1].side, "drop", `第二个动作应是落字：${JSON.stringify(acts[1])}`);
      const frames = await framesOf(page);
      appliedOnSettled(t, frames, n0, total, "例2");
      assert.equal(appliedCard(frames, n0 + 1), frames[firstFrameAfter(frames, n0)].cur, "落字必须落在 left 提交后翻出的那张卡上，而不是正飞走的旧卡");
      assert.notEqual(appliedCard(frames, n0 + 1), appliedCard(frames, n0), "落字不能落在正飞走的旧卡上");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  test(`${engine} 1280: 飞出期间点字匣，落字不落在正飞走的卡上`, async (t) => {
    const { ctx, page, errs } = await setup(engine, { code: codes.okCode });
    try {
      const n0 = await actionsLen(page);
      await press(page, ["ArrowRight", "ArrowRight"]);
      await page.locator("#wordbox .slot").first().click();
      await settle(page);
      const total = await actionsLen(page);
      const acts = await actsFrom(page, n0);
      assert.equal(acts[0].type, "choose");
      assert.equal(acts[0].side, "right", `第一个动作必须是 right 提交（落字没落在正飞走的卡上）：${JSON.stringify(acts)}`);
      appliedOnSettled(t, await framesOf(page), n0 + 1, total, "例3");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  test(`${engine} 390 touch: 飞出期间点字匣，落字不落在正飞走的卡上`, async (t) => {
    const { ctx, page, errs } = await setup(engine, { code: codes.okCode, touch: true, viewport: { width: 390, height: 844 } });
    try {
      const n0 = await actionsLen(page);
      const box = await page.locator("#wordbox .slot").first().boundingBox();
      assert.ok(box, "字匣格子应有可点区域");
      await press(page, ["ArrowRight", "ArrowRight"]);
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await settle(page);
      const total = await actionsLen(page);
      const acts = await actsFrom(page, n0);
      assert.equal(acts[0].type, "choose");
      assert.equal(acts[0].side, "right", `触屏下第一个动作也必须是 right 提交：${JSON.stringify(acts)}`);
      appliedOnSettled(t, await framesOf(page), n0 + 1, total, "例3-touch");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  test(`${engine} 1280: 飞出期间点左侧选项，第二次提交先落定再生效`, async (t) => {
    const { ctx, page, errs } = await setup(engine, { code: codes.okCode });
    try {
      const n0 = await actionsLen(page);
      await press(page, ["ArrowLeft", "ArrowLeft"]);
      await page.locator("#opt-left").click();
      await settle(page);
      const total = await actionsLen(page);
      assert.equal(total - n0, 2, `应恰好两次提交，实为 ${total - n0}`);
      assert.deepEqual(await sidesFrom(page, n0), ["left", "left"], "两次都应提交左侧");
      appliedOnSettled(t, await framesOf(page), n0 + 1, total, "例4");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  test(`${engine} 1280: 菜单开着按键不动卡`, async (t) => {
    const { ctx, page, errs } = await setup(engine, { code: codes.okCode });
    try {
      const n0 = await actionsLen(page);
      await page.locator("#menubtn").click();
      assert.equal(await menuVisible(page), true, "菜单应已打开");
      await press(page, ["ArrowLeft", "ArrowLeft"]);
      await settle(page);
      assert.equal(await actionsLen(page), n0, "菜单开着时 ←← 不得动卡");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  test(`${engine} 1280: 存档对话框开着按键不动卡`, async (t) => {
    const { ctx, page, errs } = await setup(engine, { code: codes.okCode });
    try {
      const n0 = await actionsLen(page);
      await page.evaluate(() => { window.__zz.openMenu(); document.querySelector('[data-menu="export"]').click(); });
      assert.equal(await dlgVisible(page), true, "导出对话框应已打开");
      await press(page, ["ArrowLeft", "ArrowLeft"]);
      await settle(page);
      assert.equal(await actionsLen(page), n0, "对话框开着时 ←← 不得动卡");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  test(`${engine} 1280: 飞出期间按键后开对话框，队列被整体丢弃`, async (t) => {
    const { ctx, page, errs } = await setup(engine, { code: codes.okCode });
    try {
      const n0 = await actionsLen(page);
      await press(page, ["ArrowRight", "ArrowRight"]);
      await press(page, ["ArrowLeft", "ArrowLeft"]);
      await page.evaluate(() => { window.__zz.openMenu(); document.querySelector('[data-menu="export"]').click(); });
      assert.equal(await dlgVisible(page), true, "导出对话框应已打开");
      await settle(page);
      assert.equal(await actionsLen(page), n0 + 1, "对话框打开后队列应被清空，只留下飞出开始时那一次提交");
      assert.deepEqual(await sidesFrom(page, n0), ["right"], "只应有第一次 → 的提交");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  test(`${engine} 1280: 焦点在菜单按钮上时 Enter 归按钮`, async (t) => {
    const { ctx, page, errs } = await setup(engine, { code: codes.okCode });
    try {
      const n0 = await actionsLen(page);
      await press(page, ["ArrowLeft"]);                 // 先在卡上预览
      assert.equal(await optOn(page, "opt-left"), true, "← 应先预览左侧");
      await page.locator("#menubtn").focus();
      await press(page, ["Enter"]);
      await settle(page);
      assert.equal(await actionsLen(page), n0, "焦点在按钮上时 Enter 不得动卡");
      assert.equal(await menuVisible(page), true, "Enter 应交由按钮，打开菜单");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  test(`${engine} 1280: 飞出期间焦点移到菜单按钮按 Enter，键不排队`, async (t) => {
    const { ctx, page, errs } = await setup(engine, { code: codes.okCode });
    try {
      const n0 = await actionsLen(page);
      await press(page, ["ArrowRight", "ArrowRight"]);
      await page.locator("#menubtn").focus();
      await press(page, ["Enter"]);
      await settle(page);
      await page.waitForTimeout(200);
      assert.equal(await menuVisible(page), true, "Enter 应交由按钮，打开菜单");
      assert.equal(await actionsLen(page), n0 + 1, `应恰好一次提交，Enter 不得入队：${(await sidesFrom(page, n0)).join(",")}`);
      assert.deepEqual(await sidesFrom(page, n0), ["right"], "只有飞出开始时那次 → 提交");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  test(`${engine} 1280: 按住方向键自动重复只预览一次，不提交`, async (t) => {
    const { ctx, page, errs } = await setup(engine, { code: codes.okCode });
    try {
      const n0 = await actionsLen(page);
      await page.keyboard.down("ArrowLeft");
      for (let i = 0; i < 5; i++) { await page.waitForTimeout(250); await page.keyboard.down("ArrowLeft"); }
      await page.keyboard.up("ArrowLeft");
      await settle(page);
      assert.equal(await actionsLen(page), n0, `自动重复不得提交，实为 ${JSON.stringify(await actsFrom(page, n0))}`);
      assert.equal(await optOn(page, "opt-left"), true, "按住 ← 应只留下一次左侧预览");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  // F4：handleKey 的 Escape 分支只把 ui.menuOpen 置 false，没调 renderMenu()，☰ 菜单不收起。
  test(`[guard] ${engine} 1280: 飞出期间点卡角「刻」不替玩家刻字（飞出后进入刻字也一样）`, async () => {
    const { ctx, page, errs } = await setupFresh(engine);
    try {
      let reached = false;
      for (let i = 0; i < 40 && !reached; i++) {
        const ph = await page.evaluate(() => window.__zz.st.phase);
        if (ph === "engrave") { await press(page, ["s"]); await settle(page); continue; }
        assert.equal(ph, "card", `应在出卡阶段（实为 ${ph}）`);
        const n0 = await actionsLen(page);
        await press(page, ["ArrowLeft", "ArrowLeft"]);
        await page.evaluate(() => document.getElementById("bonecorner").click());   // 飞出中点「刻」（不论是否可见）
        await settle(page);
        const r = await page.evaluate((n) => ({ phase: window.__zz.st.phase, types: window.__zz.actions.slice(n).map((a) => a.type) }), n0);
        assert.ok(!r.types.includes("engrave"), `飞出期间点「刻」不得刻字：${JSON.stringify(r)}`);
        if (r.phase === "engrave") reached = true;
        await passCutscene(page);
      }
      assert.ok(reached, "应走到一次「飞出后进入刻字」并停在刻字界面");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  test(`${engine} 1280: Esc 关掉 ☰ 菜单`, async () => {
    const { ctx, page, errs } = await setupFresh(engine);
    try {
      await page.locator("#menubtn").click();
      assert.equal(await menuVisible(page), true, "点 ☰ 应先打开菜单");
      await press(page, ["Escape"]);
      await page.waitForFunction(() => document.getElementById("menu-pop").hidden, null, { timeout: 2000 });
      assert.equal(await menuVisible(page), false, "Esc 应把菜单收起（#menu-pop 隐藏）");
      assert.equal(
        await page.evaluate(() => document.getElementById("menubtn").getAttribute("aria-expanded")),
        "false",
        "Esc 后 ☰ 的 aria-expanded 应为 false",
      );
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });
}
