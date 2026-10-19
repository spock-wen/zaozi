// e2e：浮层（存档框 / ☰ 菜单 / 目标面板 / 移动抽屉）打开时的键盘归属（round 5 part 2）。
//
// 期望（本用例编码）：浮层打开时，键盘事件属于浮层——Esc 只关浮层，且「关浮层」不清空输入队列；
// 出卡阶段浮层打开时按下的方向键既不排队也不处理（它们属于浮层，原生行为如存档框里打字 / 菜单按钮上的
// Enter 不受影响）。只有没有浮层时，Esc 才清空整个队列（clearQueue）。
//
// 缺陷（38fc511 基线）：菜单开着时飞出期间按的方向键照常入队，Esc 关菜单又清空整个队列；
// 抽屉打开时 Esc 根本不关抽屉。
//
// 三引擎；1280×800 用鼠标，390×844 用触屏。每页一个 rAF 帧记录器（含 animating、#opt-left/#opt-right 的 "on"）。
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
      window.__frames.push({
        t: performance.now(),
        cur: z.st.current,
        anim: !!z.animating,
        n: z.actions.length,
        onL: !!document.getElementById("opt-left")?.classList.contains("on"),
        onR: !!document.getElementById("opt-right")?.classList.contains("on"),
      });
      window.__raf = requestAnimationFrame(loop);
    };
    window.__raf = requestAnimationFrame(loop);
  });
}

// 稳：动画停、队列空，且连续 400ms 都如此。
async function settle(page) {
  await page.evaluate(() => { window.__settleFrom = 0; });
  await page.waitForFunction(() => {
    const busy = window.__zz.animating || (window.__zz.queued ?? 0) !== 0;
    if (busy) { window.__settleFrom = 0; return false; }
    const now = performance.now();
    if (!window.__settleFrom) window.__settleFrom = now;
    return now - window.__settleFrom >= 400;
  }, null, { timeout: 10000, polling: 60 });
}

const framesOf = (page) => page.evaluate(() => window.__frames);
const actionsLen = (page) => page.evaluate(() => window.__zz.actions.length);
const sidesFrom = (page, n0) => page.evaluate((n) => window.__zz.actions.slice(n).map((a) => a.side), n0);
const hiddenEl = (page, id) => page.evaluate((i) => document.getElementById(i).hidden, id);
const firstFlyout = (frames) => frames.findIndex((f) => f.anim);

for (const [engine] of Object.entries(ENGINES)) {
  test(`${engine} 1280 mouse: 菜单开着时按的键不入队（Esc 关菜单）`, async (t) => {
    const { ctx, page, errs } = await setup(engine);
    try {
      const n0 = await actionsLen(page);
      await press(page, ["ArrowLeft", "ArrowLeft"]);                          // 起飞（现场提交）
      await page.locator("#menubtn").click({ force: true });                  // 飞出期间打开 ☰ 菜单
      await page.waitForFunction(() => !document.getElementById("menu-pop").hidden);
      await press(page, ["ArrowRight", "ArrowRight"]);                        // 菜单开着时按的键：不入队、不处理
      await press(page, ["Escape"]);                                          // Esc 关菜单（不清队列）
      await page.waitForFunction(() => document.getElementById("menu-pop").hidden, null, { timeout: 1500 }).catch(() => {});
      t.diagnostic(`菜单已关：${await hiddenEl(page, "menu-pop")}`);
      assert.equal(await hiddenEl(page, "menu-pop"), true, "Esc 应关闭菜单（#menu-pop hidden）");
      await settle(page);
      await page.waitForTimeout(1000);

      assert.equal(await actionsLen(page) - n0, 1, "菜单开着时按的键不应入队，Esc 后应只剩起飞那一次提交");

      const frames = await framesOf(page);
      const fly = firstFlyout(frames);
      assert.ok(fly >= 0, "应记录到飞出开始的帧");
      const flyEnd = frames.findIndex((f, i) => i > fly && !f.anim);
      assert.ok(flyEnd > fly, "应记录到第一次飞出结束的帧");
      assert.ok(!frames.slice(flyEnd).some((f) => f.onL || f.onR), "第一次飞出之后不应再出现左右选项的 on");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  test(`${engine} 1280 mouse: Esc 关浮层保留更早入队的输入`, async (t) => {
    const { ctx, page, errs } = await setup(engine);
    try {
      const n0 = await actionsLen(page);
      await press(page, ["ArrowLeft", "ArrowLeft"]);                          // 起飞
      await press(page, ["ArrowRight", "ArrowRight"]);                        // 飞出期间入队（此刻还没有浮层）
      await page.locator("#menubtn").click({ force: true });                  // 再打开菜单
      await page.waitForFunction(() => !document.getElementById("menu-pop").hidden);
      await press(page, ["Escape"]);                                          // Esc 只关菜单，不清队列
      await page.waitForFunction(() => document.getElementById("menu-pop").hidden, null, { timeout: 1500 }).catch(() => {});
      assert.equal(await hiddenEl(page, "menu-pop"), true, "Esc 应关闭菜单（#menu-pop hidden）");
      await settle(page);

      assert.equal(await actionsLen(page) - n0, 2, `Esc 关浮层不应清掉更早入队的输入，实为 ${await actionsLen(page) - n0}`);
      assert.deepEqual(await sidesFrom(page, n0), ["left", "right"], "先入队的 → 应依次落实为 left、right");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  test(`${engine} 390 touch: Esc 关抽屉`, async (t) => {
    const { ctx, page, errs } = await setup(engine, { touch: true });
    try {
      await press(page, ["ArrowLeft", "ArrowLeft"]);                          // 起飞
      await page.locator("#wb-handle").click({ force: true });                // 飞出期间打开抽屉
      await page.waitForFunction(() => !document.getElementById("drawer").hidden);
      await press(page, ["Escape"]);                                          // Esc 关抽屉
      await page.waitForFunction(() => document.getElementById("drawer").hidden, null, { timeout: 1500 }).catch(() => {});
      t.diagnostic(`抽屉 hidden=${await hiddenEl(page, "drawer")}`);
      assert.equal(await hiddenEl(page, "drawer"), true, "Esc 应关闭移动抽屉（#drawer 置 hidden）");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  test(`${engine} 1280 mouse: 菜单开着时方向键不预览（键先归浮层）`, async (t) => {
    const { ctx, page, errs } = await setup(engine);
    try {
      await page.locator("#menubtn").click({ force: true });                  // 空闲时打开菜单
      await page.waitForFunction(() => !document.getElementById("menu-pop").hidden);
      const n0 = await actionsLen(page);
      await page.locator("#menu-pop button").first().focus();                 // 焦点落在菜单里第一个按钮
      await press(page, ["ArrowRight"]);
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(() => document.getElementById("opt-right").classList.contains("on")), false,
        "菜单开着时按 → 不应在卡上留下预览（#opt-right 不带 on）");
      assert.equal(await actionsLen(page) - n0, 0, "菜单开着时按 → 不应产生任何动作");
      await press(page, ["Escape"]);
      await page.waitForFunction(() => document.getElementById("menu-pop").hidden, null, { timeout: 1500 }).catch(() => {});
      assert.equal(await hiddenEl(page, "menu-pop"), true, "Esc 应关闭菜单");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  test(`${engine} 1280 mouse: 最短停留内提前松手的拖拽，松手后打开菜单不应在菜单下提交（P2-1）`, async (t) => {
    const { ctx, page, errs } = await setup(engine);
    try {
      const n0 = await actionsLen(page);
      const box = await page.evaluate(() => {
        const r = document.getElementById("card").getBoundingClientRect();
        return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, w: r.width };
      });
      await press(page, ["ArrowLeft", "ArrowLeft"]);
      await page.waitForTimeout(40);
      await page.mouse.move(box.cx, box.cy);
      await page.mouse.down();
      // 等卡落定起拖（进入 dragging），此时处于 dwell 窗口内
      await page.waitForFunction(() => {
        const c = document.getElementById("card");
        return !window.__zz.animating && c.classList.contains("dragging");
      }, null, { timeout: 3000 });
      // 在 dwell 窗口内迅速移动超过阈值并立即松手
      await page.mouse.move(box.cx + box.w * 0.6, box.cy, { steps: 2 });
      await page.mouse.up();
      // 立即点开菜单
      await page.locator("#menubtn").click({ force: true });
      await page.waitForFunction(() => !document.getElementById("menu-pop").hidden, null, { timeout: 1500 });
      assert.equal(await hiddenEl(page, "menu-pop"), false, "菜单应已打开");
      const aAtMenu = await actionsLen(page);
      // 等待 600ms（heldCommitT 延时约 200ms，600ms 足以触发）
      await page.waitForTimeout(600);
      const aAfter = await actionsLen(page);
      assert.equal(aAfter, aAtMenu, "菜单打开期间不应发生提交（actions 不变）");
      assert.equal(aAfter - n0, 1, "只应有起飞那一次提交，拖拽不应在菜单下提交");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  test(`[guard] ${engine} 1024x600: 键位说明浮层开着时按 Esc 只关浮层并保留队列（P2-4）`, async (t) => {
    const ctx = await browsers[engine].newContext({ viewport: { width: 1024, height: 600 } });
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
    await page.waitForFunction(() => !!window.__zz);
    await clearTutorial(page);
    await page.waitForFunction(() => window.__zz.st.phase === "card" && !window.__zz.animating, null, { timeout: 5000 });
    try {
      const isKh = await page.evaluate(() => !document.getElementById("keyhelp-pop").hidden);
      if (!isKh) {
        await page.locator("#keyhelp-btn").click();
        await page.waitForFunction(() => !document.getElementById("keyhelp-pop").hidden);
      }
      const n0 = await actionsLen(page);
      await press(page, ["ArrowLeft", "ArrowLeft"]);
      await page.waitForTimeout(40);
      await press(page, ["ArrowRight", "ArrowRight"]);
      // 卡入场完成、落定后，键位说明浮层重新显形
      await page.waitForFunction(() => {
        const c = document.getElementById("card");
        return !window.__zz.animating && !c.getAnimations().some((a) => a.playState === "running") && !document.getElementById("keyhelp-pop").hidden;
      }, null, { timeout: 3000 });
      assert.equal(await page.evaluate(() => !document.getElementById("keyhelp-pop").hidden), true, "按 Esc 前 keyhelp 应开着");
      await press(page, ["Escape"]);
      await page.waitForFunction(() => document.getElementById("keyhelp-pop").hidden, null, { timeout: 1500 });
      assert.equal(await page.evaluate(() => document.getElementById("keyhelp-pop").hidden), true, "Esc 应关闭 keyhelp 浮层");
      await page.waitForTimeout(1000);
      assert.equal(await actionsLen(page) - n0, 2, "Esc 关 keyhelp 后，排队的 →→ 仍应正常执行");
      assert.deepEqual(await sidesFrom(page, n0), ["left", "right"], "提交顺序应为 left, right");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  test(`${engine} 1280 mouse: 飞出期间开菜单重新开局，新局停在T01且为0动作（P3-1/P3-5）`, async (t) => {
    const { ctx, page, errs } = await setup(engine);
    try {
      await press(page, ["ArrowLeft", "ArrowLeft"]);
      await page.waitForTimeout(20);
      await page.locator("#menubtn").click({ force: true });
      await page.waitForFunction(() => !document.getElementById("menu-pop").hidden, null, { timeout: 1500 });
      await page.locator('#menu-pop [data-menu="new"]').click({ force: true });
      await page.waitForTimeout(1000);
      const st = await page.evaluate(() => ({
        cur: window.__zz.st.current,
        actions: window.__zz.actions.length,
        anim: window.__zz.animating,
        queued: window.__zz.queued,
      }));
      assert.equal(st.cur, "T01", `新局应留在 T01，实为 ${st.cur}`);
      assert.equal(st.actions, 0, `新局 actions 应为 0，实为 ${st.actions}`);
      assert.equal(st.queued, 0, `新局队列应为空，实为 ${st.queued}`);
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });
}

