// e2e：清队后触屏在飞出中点卡片排队与锁定提示回归（P9-1）及飞出中途重置运动态覆盖（M1/M2）。
// 复现与规格：
//   1) T01 left, T02 left → T03。
//   2) 触点卡片中心下方 30px 触发拦截提示。
//   3) 按 S，40ms 内按 ←←→→，再触点 #opt-left，此时 queued=4。
//   4) 立即 菜单 →「重新开局」（或 菜单 →「导入」T01 存档码）。
//   5) ~1.8s 后导入 T02 存档码，触点 #opt-left 起飞，50ms 后触点卡片中心。
// 断言：
//   - 点卡后 queued ≥ 1。
//   - 刻字卡 T03 落定后，拦截提示「先点卡角骨片刻下这件事」在独立落定时间 ≥ +245ms 后显形。
// 对照与飞出中途覆盖：
//   - 清队前队列为空。
//   - M1 "飞出中途重新开局"：触点 #opt-left 起飞，~50ms 内真实触点打开 ☰ 并点「重新开局」
//     （断言重置发生瞬间 __zz.animating 仍为 true）；落定后断言 __zz.animating 为 false、
//     #card transform/opacity 为空、卡片中心在屏幕内；下一次起飞中触点卡片正常入队 (queued ≥ 1) 且 action log 无多余记录。
//   - M2 "飞出中途导入存档"：触点 #opt-left 起飞，~50ms 内真实触点打开 ☰ →「导入存档码」→「导入」按钮，规格同 M1。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, buildDist, startServer, collectErrors } from "./helpers/env.mjs";

buildDist();

const SEED = 20261016;
const VP_TOUCH = { width: 375, height: 667 };
const MARGIN = 245;

let server, browsers = {};

before(async () => {
  server = await startServer();
  for (const [name, type] of Object.entries(ENGINES)) {
    browsers[name] = await type.launch();
  }
});

after(async () => {
  for (const b of Object.values(browsers)) await b.close();
  server?.close();
});

async function runScenario(engine, variant) {
  const ctx = await browsers[engine].newContext({
    viewport: VP_TOUCH,
    hasTouch: true,
    isMobile: engine !== "firefox",
    deviceScaleFactor: 3,
  });
  const page = await ctx.newPage();
  const errs = [];
  collectErrors(page, errs);

  const clk = async (x, y) => { await page.touchscreen.tap(x, y); };
  const ctr = (s) => page.evaluate((sel) => {
    const r = document.querySelector(sel).getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }, s);
  const still = async () => {
    await page.waitForFunction(() => !__zz.animating && !(__zz.queued > 0), null, { timeout: 9000, polling: 30 }).catch(() => {});
    await page.waitForTimeout(400);
  };
  const imp = async (c) => {
    await page.evaluate((code) => __zz.importCode(code), c);
    await page.waitForTimeout(300);
    await still();
  };

  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__zz);
  await page.waitForTimeout(900);

  // 1) 记录 T01, T02, T03 存档码
  const codes = {};
  for (let i = 0; i < 3; i++) {
    await still();
    const z = await page.evaluate(() => ({ cur: __zz.st.current, c: __zz.code() }));
    codes[z.cur] = z.c;
    if (z.cur === "T03") break;
    const L = await ctr("#opt-left");
    await clk(L[0], L[1]);
  }
  const c0 = codes.T01;

  if (variant !== "guard") {
    // 2) T03: 触点卡片下方 30px 出拦截提示
    await imp(codes.T03);
    const K = async (k) => { await page.keyboard.press(k); };
    const CC = await ctr("#card");
    await clk(CC[0], CC[1] + 30);
    await page.waitForTimeout(150);

    // 3) 按 S，40ms 内按 ←←→→，再触点 #opt-left，使 queued ≥ 1 (实测 queued=4)
    await K("s");
    await page.waitForTimeout(40);
    await K("ArrowLeft");
    await K("ArrowLeft");
    await K("ArrowRight");
    await K("ArrowRight");
    const O = await ctr("#opt-left");
    await clk(O[0], O[1]);

    const qBefore = await page.evaluate(() => __zz.queued);
    assert.ok(qBefore >= 1, `清队前队列应有排队项 (queued >= 1)，实为 ${qBefore}`);

    // 4) 立即 重新开局 或 导入 T01
    if (variant === "导入T01") {
      await page.evaluate((c) => {
        document.getElementById("menubtn").click();
        document.querySelector("#menu-pop [data-menu=import]")?.click();
        document.getElementById("dlgtext").value = c;
        document.getElementById("dlgapply").click();
      }, c0);
    } else {
      await page.evaluate(() => {
        document.getElementById("menubtn").click();
        document.querySelector("#menu-pop [data-menu=new]")?.click();
      });
    }
  } else {
    // 对照：队列为空时重新开局
    await imp(codes.T03);
    const qBefore = await page.evaluate(() => __zz.queued);
    assert.equal(qBefore, 0, `对照组清队前队列应为空，实为 ${qBefore}`);
    await page.evaluate(() => {
      document.getElementById("menubtn").click();
      document.querySelector("#menu-pop [data-menu=new]")?.click();
    });
  }

  // 4) 约 1.8s 后继续
  await page.waitForTimeout(1600);
  await still();
  await page.waitForTimeout(200);

  // 5) 导入 T02 存档码，装配独立落定时间与 toast 观察器
  await imp(codes.T02);

  await page.evaluate(() => {
    if (window.__raf) cancelAnimationFrame(window.__raf);
    window.__settles = {};
    window.__toastOns = [];

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

  // 触点 #opt-left 起飞，50ms 后触点卡片中心
  const L = await ctr("#opt-left");
  await clk(L[0], L[1]);
  await page.waitForTimeout(50);
  const C = await ctr("#card");
  await clk(C[0], C[1]);

  // 断言：点卡后入队 (queued >= 1)
  const qAfter = await page.evaluate(() => __zz.queued);
  assert.ok(qAfter >= 1, `点卡后应入队 (queued >= 1)，实为 ${qAfter}`);

  // 等待拦截提示显形
  await page.waitForFunction(() => {
    const t = document.getElementById("toast");
    return t && t.classList.contains("on") && /骨片/.test(t.textContent);
  }, null, { timeout: 4000 });

  // 独立落定计时断言：≥ settle + 245ms
  const timing = await page.evaluate(() => {
    const lockToasts = (window.__toastOns || []).filter((it) => /骨片/.test(it.text));
    return {
      settleT: window.__settles?.T03 ?? window.__settles?.["T03|2"],
      toastT: lockToasts[0]?.t,
      toastText: lockToasts[0]?.text,
    };
  });

  assert.ok(timing.settleT != null, "必须记录到 T03 独立落定时间 (window.__settles)");
  assert.ok(timing.toastT != null, "必须记录到锁定提示显形时刻 (window.__toastOns)");
  assert.match(timing.toastText, /骨片/, "提示文案应包含「骨片」");
  const delta = timing.toastT - timing.settleT;
  assert.ok(
    delta >= MARGIN,
    `锁定提示显形时刻 (${timing.toastT.toFixed(1)}) 应 ≥ 落定+245ms (${(timing.settleT + MARGIN).toFixed(1)})，实际差值为 ${delta.toFixed(1)}ms`
  );

  assert.deepEqual(errs, [], "页面不应有未捕获报错：" + errs.join(" | "));
  await ctx.close();
}

async function runMidFlyoutReset(engine, mode) {
  const ctx = await browsers[engine].newContext({
    viewport: VP_TOUCH,
    hasTouch: true,
    isMobile: engine !== "firefox",
    deviceScaleFactor: 3,
  });
  const page = await ctx.newPage();
  const errs = [];
  collectErrors(page, errs);

  const clk = async (x, y) => { await page.touchscreen.tap(x, y); };
  const ctr = (s) => page.evaluate((sel) => {
    const r = document.querySelector(sel).getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }, s);
  const still = async () => {
    await page.waitForFunction(() => !__zz.animating && !(__zz.queued > 0), null, { timeout: 9000, polling: 30 }).catch(() => {});
    await page.waitForTimeout(400);
  };

  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__zz);
  await page.waitForTimeout(500);
  await still();

  const code = await page.evaluate(() => __zz.code());
  const menuBtnPos = await ctr("#menubtn");

  let newBtnPos = null;
  let importBtnPos = null;
  let applyBtnPos = null;

  if (mode === "重新开局") {
    await clk(menuBtnPos[0], menuBtnPos[1]);
    await page.waitForTimeout(50);
    newBtnPos = await ctr("#menu-pop [data-menu=new]");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
  } else {
    await clk(menuBtnPos[0], menuBtnPos[1]);
    await page.waitForTimeout(50);
    importBtnPos = await ctr("#menu-pop [data-menu=import]");
    await clk(importBtnPos[0], importBtnPos[1]);
    await page.waitForTimeout(50);
    applyBtnPos = await ctr("#dlgapply");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
  }

  // 挂载飞出起飞与重置时机监听，验证重置落在飞出进行中 (__zz.animating 仍为 true)
  await page.evaluate(({ mode, code }) => {
    if (mode === "导入") {
      document.getElementById("dlgtext").value = code;
    }
    window.__midReset = null;
    document.getElementById("opt-left").addEventListener("click", () => {
      window.__flyStartT = performance.now();
    }, true);
    const targetSel = mode === "重新开局" ? "[data-menu=new]" : "#dlgapply";
    document.addEventListener("click", (e) => {
      if (e.target.closest?.(targetSel)) {
        window.__midReset = {
          t: performance.now(),
          animating: window.__zz.animating,
          dx: window.__zz.dx,
        };
        window.__postResetTransforms = [];
        window.__sampleActive = true;
        const sample = () => {
          const c = document.getElementById("card");
          if (c) {
            window.__postResetTransforms.push({
              t: performance.now(),
              transform: c.style.transform,
            });
          }
          if (window.__sampleActive) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }
    }, true);
  }, { mode, code });

  // 真实输入：触点 #opt-left 起飞，在飞出中途 (~50-80ms 内) 触发菜单重置
  const optLeftPos = await ctr("#opt-left");
  await clk(optLeftPos[0], optLeftPos[1]);
  await page.waitForTimeout(50);

  if (mode === "重新开局") {
    await clk(menuBtnPos[0], menuBtnPos[1]);
    await clk(newBtnPos[0], newBtnPos[1]);
  } else {
    await clk(menuBtnPos[0], menuBtnPos[1]);
    await clk(importBtnPos[0], importBtnPos[1]);
    await clk(applyBtnPos[0], applyBtnPos[1]);
  }

  await page.waitForTimeout(100);
  const mid = await page.evaluate(() => {
    if (!window.__midReset) return null;
    return {
      ...window.__midReset,
      dt: window.__midReset.t - (window.__flyStartT || window.__midReset.t),
    };
  });

  assert.ok(mid != null, `${mode}: 真实输入必须命中重置按钮并触发事件`);
  assert.equal(mid.animating, true, `${mode}: 重置发生瞬间 __zz.animating 必须仍为 true (dt=${mid.dt.toFixed(1)}ms)`);
  assert.ok(mid.dt < 240, `${mode}: 重置必须在飞出进行中完成 (<240ms)，实为 ${mid.dt.toFixed(1)}ms`);

  // 等待新局 T01 完全落定
  await still();

  // 断言：从重置到落定期间采样到的每一帧，#card transform 绝不能再次出现旧飞出的位移（杀 P9_tick）
  const postResetTransforms = await page.evaluate(() => {
    window.__sampleActive = false;
    return window.__postResetTransforms || [];
  });
  assert.ok(postResetTransforms.length >= 2, `${mode}: 重置后落定前必须采样到至少 2 帧 rAF，实为 ${postResetTransforms.length}`);
  const staleFrames = postResetTransforms.filter((f) => f.transform !== "");
  assert.equal(
    staleFrames.length,
    0,
    `${mode}: 重置后 #card transform 绝不能再次出现旧飞出的位移，采样到 ${staleFrames.length} 帧残留: ${JSON.stringify(staleFrames.slice(0, 3))}`
  );

  // 断言：落定后 __zz.animating false, #card transform "" and opacity "", card centre on-screen
  const cardSettle = await page.evaluate(() => {
    const c = document.getElementById("card");
    const r = c.getBoundingClientRect();
    return {
      animating: window.__zz.animating,
      transform: c.style.transform,
      opacity: c.style.opacity,
      cx: r.left + r.width / 2,
      cy: r.top + r.height / 2,
    };
  });

  assert.equal(cardSettle.animating, false, `${mode}: 落定后 __zz.animating 必须为 false`);
  assert.equal(cardSettle.transform, "", `${mode}: 落定后 #card transform 必须重置为空字符串，实为 "${cardSettle.transform}"`);
  assert.equal(cardSettle.opacity, "", `${mode}: 落定后 #card opacity 必须重置为空字符串，实为 "${cardSettle.opacity}"`);
  assert.ok(cardSettle.cx > 100 && cardSettle.cx < 275, `${mode}: 卡片中心应在屏幕正中 (100..275)，实为 ${cardSettle.cx}`);
  assert.ok(cardSettle.cy > 100 && cardSettle.cy < 500, `${mode}: 卡片中心纵坐标应在屏幕内，实为 ${cardSettle.cy}`);

  // 断言：在下一次飞出中触点卡片正常入队 (queued >= 1)，且行动日志保持一致 (无多余 action)
  const actionsBefore = await page.evaluate(() => window.__zz.actions.length);
  const L_next = await ctr("#opt-left");
  await clk(L_next[0], L_next[1]);
  await page.waitForTimeout(50);
  const C_next = await ctr("#card");
  await clk(C_next[0], C_next[1]);

  const qAfter = await page.evaluate(() => window.__zz.queued);
  assert.ok(qAfter >= 1, `${mode}: 下一次飞出中触点卡片应正常入队 (queued >= 1)，实为 ${qAfter}`);

  await still();
  const actionsAfter = await page.evaluate(() => window.__zz.actions.length);
  assert.equal(
    actionsAfter,
    actionsBefore + 1,
    `${mode}: 行动日志应保持一致 (仅增加 1 次选项提交，入队触点不应产生多余 action)，之前 ${actionsBefore}，现在 ${actionsAfter}`
  );

  assert.deepEqual(errs, [], "页面不应有未捕获报错：" + errs.join(" | "));
  await ctx.close();
}

async function runMidReboundReset(engine) {
  const ctx = await browsers[engine].newContext({
    viewport: VP_TOUCH,
    hasTouch: true,
    isMobile: engine !== "firefox",
    deviceScaleFactor: 3,
  });
  const page = await ctx.newPage();
  const errs = [];
  collectErrors(page, errs);

  const clk = async (x, y) => { await page.touchscreen.tap(x, y); };
  const ctr = (s) => page.evaluate((sel) => {
    const r = document.querySelector(sel).getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }, s);
  const still = async () => {
    await page.waitForFunction(() => !__zz.animating && !(__zz.queued > 0), null, { timeout: 9000, polling: 30 }).catch(() => {});
    await page.waitForTimeout(400);
  };

  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__zz);
  await page.waitForTimeout(500);
  await still();

  const menuBtnPos = await ctr("#menubtn");
  await clk(menuBtnPos[0], menuBtnPos[1]);
  await page.waitForTimeout(50);
  const newBtnPos = await ctr("#menu-pop [data-menu=new]");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);

  // 挂载重置监听与 rAF 采样
  await page.evaluate(() => {
    window.__midReset = null;
    document.addEventListener("click", (e) => {
      if (e.target.closest?.("[data-menu=new]")) {
        window.__midReset = {
          t: performance.now(),
          animating: window.__zz.animating,
        };
        window.__postResetTransforms = [];
        window.__sampleActive = true;
        const sample = () => {
          const c = document.getElementById("card");
          if (c) {
            window.__postResetTransforms.push({
              t: performance.now(),
              transform: c.style.transform,
            });
          }
          if (window.__sampleActive) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }
    }, true);
  });

  // 在卡片上小幅度拖拽（40px < threshold 80px），松手触发 rebound (dur 320ms)
  await page.evaluate(() => {
    const c = document.getElementById("card");
    const r = c.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    c.dispatchEvent(new PointerEvent("pointerdown", { clientX: cx, clientY: cy, pointerId: 1, isPrimary: true, bubbles: true }));
    window.dispatchEvent(new PointerEvent("pointermove", { clientX: cx + 40, clientY: cy, pointerId: 1, isPrimary: true, bubbles: true }));
    window.dispatchEvent(new PointerEvent("pointerup", { clientX: cx + 40, clientY: cy, pointerId: 1, isPrimary: true, bubbles: true }));
  });

  // 回弹 dur=320ms：在 40ms 内触发 重新开局
  await page.waitForTimeout(40);
  await clk(menuBtnPos[0], menuBtnPos[1]);
  await clk(newBtnPos[0], newBtnPos[1]);

  await page.waitForTimeout(100);
  const mid = await page.evaluate(() => window.__midReset);
  assert.ok(mid != null, "回弹中途重置必须命中重置项并触发事件");
  assert.equal(mid.animating, true, "重置发生瞬间 __zz.animating 必须仍为 true (回弹动画中)");

  await still();

  const postReset = await page.evaluate(() => {
    window.__sampleActive = false;
    return window.__postResetTransforms || [];
  });
  assert.ok(postReset.length >= 2, `回弹重置后必须采样到至少 2 帧 rAF，实为 ${postReset.length}`);
  const staleFrames = postReset.filter((f) => f.transform !== "");
  assert.equal(staleFrames.length, 0, `回弹重置后 #card transform 绝不能残留回弹位移，发现 ${staleFrames.length} 帧残留`);

  const cardSettle = await page.evaluate(() => ({
    animating: window.__zz.animating,
    transform: document.getElementById("card").style.transform,
  }));
  assert.equal(cardSettle.animating, false, "落定后 animating 必须为 false");
  assert.equal(cardSettle.transform, "", "落定后 card transform 必须为空");

  assert.deepEqual(errs, [], "页面不应有未捕获报错：" + errs.join(" | "));
  await ctx.close();
}

async function runMidFlyoutRestore(engine) {
  const ctx = await browsers[engine].newContext({
    viewport: VP_TOUCH,
    hasTouch: true,
    isMobile: engine !== "firefox",
    deviceScaleFactor: 3,
  });
  const page = await ctx.newPage();
  const errs = [];
  collectErrors(page, errs);

  const clk = async (x, y) => { await page.touchscreen.tap(x, y); };
  const ctr = (s) => page.evaluate((sel) => {
    const r = document.querySelector(sel).getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }, s);
  const still = async () => {
    await page.waitForFunction(() => !__zz.animating && !(__zz.queued > 0), null, { timeout: 9000, polling: 30 }).catch(() => {});
    await page.waitForTimeout(400);
  };

  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__zz);
  await page.evaluate((s) => window.__zz.newGame(s), SEED);
  await page.waitForTimeout(500);
  await still();

  // 触点 #opt-left 起飞
  const optLeftPos = await ctr("#opt-left");
  await clk(optLeftPos[0], optLeftPos[1]);
  // 50ms 后处于飞出动画中
  await page.waitForTimeout(50);

  const beforeRestore = await page.evaluate(() => ({
    animating: window.__zz.animating,
    transform: document.getElementById("card").style.transform,
  }));
  assert.equal(beforeRestore.animating, true, "调用 restore 前卡片必须处于飞出动画中");

  // 调用 [hook] window.__zz.restore 调试钩子
  const restored = await page.evaluate(() => window.__zz.restore());
  assert.ok(restored, "window.__zz.restore() 必须成功读回存档");

  // 断言：卡片运动态与动画标志立即被重置
  const afterRestore = await page.evaluate(() => {
    const c = document.getElementById("card");
    return {
      animating: window.__zz.animating,
      transform: c.style.transform,
      opacity: c.style.opacity,
    };
  });
  assert.equal(afterRestore.animating, false, "restore 后 __zz.animating 必须被 resetCardMotion 重置为 false");
  assert.equal(afterRestore.transform, "", "restore 后 #card transform 必须被 resetCardMotion 重置为空字符串");
  assert.equal(afterRestore.opacity, "", "restore 后 #card opacity 必须被 resetCardMotion 重置为空字符串");

  // 断言：卡片可触控 (tappable)，再次触点选项可正常响应并起飞
  await clk(optLeftPos[0], optLeftPos[1]);
  await page.waitForTimeout(50);
  const retriggered = await page.evaluate(() => window.__zz.animating || window.__zz.queued > 0);
  assert.ok(retriggered, "restore 后卡片必须立即可被触控并触发动作");

  await still();
  assert.deepEqual(errs, [], "页面不应有未捕获报错：" + errs.join(" | "));
  await ctx.close();
}

for (const [engine] of Object.entries(ENGINES)) {
  test(`${engine} 375 touch: 清队(重新开局)后飞出中触点卡片正常入队且T03停稳250ms后出拦截提示`, async () => {
    await runScenario(engine, "重新开局");
  });

  test(`${engine} 375 touch: 清队(导入T01)后飞出中触点卡片正常入队且T03停稳250ms后出拦截提示`, async () => {
    await runScenario(engine, "导入T01");
  });

  test(`${engine} 375 touch: 空队列清队对照组飞出中触点卡片正常入队`, async () => {
    await runScenario(engine, "guard");
  });

  test(`${engine} 375 touch: M1 飞出中途重新开局重置卡片运动态且新局触点正常入队`, async () => {
    await runMidFlyoutReset(engine, "重新开局");
  });

  test(`${engine} 375 touch: M2 飞出中途导入存档重置卡片运动态且新局触点正常入队`, async () => {
    await runMidFlyoutReset(engine, "导入");
  });

  test(`${engine} 375 touch: M3 回弹中途重新开局重置卡片运动态且不再写回位移`, async () => {
    await runMidReboundReset(engine);
  });

  test(`${engine} 375 touch: M4 [hook] window.__zz.restore 飞出中途调用重置卡片运动态且卡片可触控`, async () => {
    await runMidFlyoutRestore(engine);
  });
}

