// e2e：QA (PR10 报告 FINAL_REPORT_zaozi_pr10_b81125d.md 行 O2/F1、O1/F2) 回归测试套件。
//
// 背景缺陷（main@438124f）：
// - F1：飞出期间快速按键，同一帧提交 2–4 张卡；长按方向键（auto-repeat）连续提交 6 张卡；
// - F2：←← 起飞后约 60ms 点击字匣格子，旧版因未检查 ui.animating，直接对当前卡调用 dispatch("drop")，
//       导致当前卡提前切换，而 240ms 飞出回调到达时又对下一张卡执行 left 提交，产生 actions=[drop0, left]。
//
// 期望行为（本分支 fix/web-flyout-keys 队列模型）：
// - F1a：飞出期间快按 3 次方向键，每项必须入队，等下一张卡落定并经历 ≥250ms 最短停留（window.__zz.settledAt）
//        后再依序重放；单帧内绝对不得发生多次提交；总提交数严格符合队列模型（第一张提交，第二张预览+提交，第三张预览，共2次提交）。
// - F1b：长按方向键时，Playwright 触发的 auto-repeat（repeat:true）事件一律被过滤不入队，
//        第一张卡提交后，后续按住仅作为下一张卡的预览，不产生额外提交，单帧无多重提交。
// - F2：飞出期间点/触字匣格子，动作必须入队等待下一张卡落定并等待 ≥250ms；绝不会在 2s 内产生第二次方向提交，
//       actions 只能是 [<first commit>] 或紧跟在下一张卡停稳 ≥250ms 后生效的 drop。
//
// 矩阵：3 引擎（chromium, firefox, webkit） × {1280x800 键鼠, 390x844 触屏 (F2)}，真实输入（无合成事件）。

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, buildDist, startServer, collectErrors } from "./helpers/env.mjs";
import { clearTutorial } from "./helpers/flow.mjs";

buildDist();

const SEED = 20261016;
const VP_DESK = { width: 1280, height: 800 };
const VP_TOUCH = { width: 390, height: 844 };

// seed=20261016 下第 2 代 C04 卡（字匣 slot 0 含「1·水」且为 .slot.ok）的直达存档码
const C04_CODE = "ZZ1.1dw0bxd.eyJ2IjoxLCJzZWVkIjoyMDI2MTAxNiwiYWN0aW9ucyI6W3sidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6InJpZ2h0In0seyJ0eXBlIjoiZW5ncmF2ZSIsInRyYWNlIjoi5LyRIn0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImRyb3AiLCJzbG90IjowfSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoic2tpcF9lbmdyYXZlIn0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJza2lwX2VuZ3JhdmUifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoid2ludGVyX2VuZCJ9LHsidHlwZSI6ImhlaXIifSx7InR5cGUiOiJwaWNrX3RvZ2dsZSIsImNoYXIiOiLmsLQifSx7InR5cGUiOiJwaWNrX3RvZ2dsZSIsImNoYXIiOiLml6UifSx7InR5cGUiOiJwaWNrX3RvZ2dsZSIsImNoYXIiOiLkuroifSx7InR5cGUiOiJiZWdpbl9nZW5lcmF0aW9uIiwicGlja3MiOlsi5rC0Iiwi5pelIiwi5Lq6Il19LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJza2lwX2VuZ3JhdmUifV19";
// seed=20261010 下 C06 卡（slot 0 含「水」；左出下一张卡为 C04，C04 具有「水」落字槽）的直达存档码
const C06_CODE = "ZZ1.gsw3u1.eyJ2IjoxLCJzZWVkIjoyMDI2MTAxMCwiYWN0aW9ucyI6W3sidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJlbmdyYXZlIiwidHJhY2UiOiLkvJEifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In1dfQ";

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

async function setup(engine, opts = {}) {
  const touch = !!opts.touch;
  const ctx = await browsers[engine].newContext({
    viewport: opts.viewport || (touch ? VP_TOUCH : VP_DESK),
    hasTouch: touch,
    isMobile: touch && engine !== "firefox",
    reducedMotion: opts.reducedMotion,
  });
  const page = await ctx.newPage();
  const errs = [];
  collectErrors(page, errs);
  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__zz);

  if (opts.code) {
    await page.evaluate((c) => window.__zz.importCode(c), opts.code);
    await page.waitForTimeout(1000);
  } else {
    await clearTutorial(page);
  }

  await page.waitForFunction(
    () => window.__zz.st.phase === "card" && !window.__zz.animating,
    null,
    { timeout: 8000 }
  );
  await page.waitForTimeout(300);
  return { ctx, page, errs };
}

async function settle(page) {
  await page.evaluate(() => { window.__settleFrom = 0; });
  await page.waitForFunction(() => {
    if (window.__zz.animating || (window.__zz.queued ?? 0) !== 0) {
      window.__settleFrom = 0;
      return false;
    }
    const now = performance.now();
    if (!window.__settleFrom) window.__settleFrom = now;
    return now - window.__settleFrom >= 200;
  }, null, { timeout: 8000, polling: 40 }).catch(() => {});
}

async function startRecorder(page) {
  await page.evaluate(() => {
    if (window.__raf) cancelAnimationFrame(window.__raf);
    window.__frames = [];
    window.__commits = [];
    window.__settleEvents = [];
    window.__keyEvents = [];
    window.__settles = {};

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
    let prevSettledAt = 0;

    const loop = () => {
      const z = window.__zz;
      const card = document.getElementById("card");
      const n = z ? z.actions.length : 0;
      const cur = z?.st?.current;
      const settledAt = z?.settledAt ?? 0;
      const t = performance.now();
      const delta = n - prevN;

      const noAnim = !z?.animating;
      const noRunningAnim = card ? !card.getAnimations().some((a) => a.playState === "running") : true;
      const noTransform = card ? (card.style.transform === "" || card.style.transform === "none") : true;
      const notDragging = card ? !card.classList.contains("dragging") : true;
      const settled = noAnim && noRunningAnim && noTransform && notDragging;

      const cardKey = cur + "|" + n;
      if (settled && window.__settles[cardKey] == null) {
        window.__settles[cardKey] = performance.now();
      }

      if (delta > 0) {
        window.__commits.push({
          t,
          delta,
          n,
          cur,
          prevCur,
          settledAt,
          cardKeyBefore: prevCur + "|" + prevN,
          acts: z.actions.slice(prevN).map((a) =>
            a.side === "drop" ? `drop${a.slot}` : (a.side || a.type)
          ),
        });
      }

      if (settledAt !== prevSettledAt && settledAt > 0) {
        window.__settleEvents.push({ t, settledAt, cur });
        prevSettledAt = settledAt;
      }

      window.__frames.push({ t, n, delta, cur, settledAt });
      prevN = n;
      prevCur = cur;
      window.__raf = requestAnimationFrame(loop);
    };
    window.__raf = requestAnimationFrame(loop);
  });
}

async function stopRecorder(page, startN) {
  return await page.evaluate((n0) => {
    if (window.__raf) cancelAnimationFrame(window.__raf);
    const z = window.__zz;
    const finalN = z ? z.actions.length : 0;
    const maxDelta = Math.max(0, ...window.__frames.map((f) => f.delta));
    return {
      n0,
      finalN,
      totalCommits: finalN - n0,
      maxDelta,
      frames: window.__frames,
      commits: window.__commits,
      settleEvents: window.__settleEvents,
      settles: window.__settles,
      keyEvents: window.__keyEvents,
      actions: z ? z.actions.slice(n0).map((a) =>
        a.side === "drop" ? `drop${a.slot}` : (a.side || a.type)
      ) : [],
      optLeftOn: !!document.getElementById("opt-left")?.classList.contains("on"),
      optRightOn: !!document.getElementById("opt-right")?.classList.contains("on"),
      queued: z?.queued ?? 0,
      finalCard: z?.st?.current,
    };
  }, startN);
}

for (const [engine] of Object.entries(ENGINES)) {
  // --------------------------------------------------------------------------
  // F1a: 飞出期间快速按键
  // --------------------------------------------------------------------------
  test(`${engine} 1280: F1a 飞出期间快按 ← 3次，同帧最多提1张且总提交数符合队列模型`, async () => {
    const { ctx, page, errs } = await setup(engine);
    try {
      await settle(page);
      const n0 = await page.evaluate(() => window.__zz.actions.length);
      await startRecorder(page);

      // ←← 起飞
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("ArrowLeft");

      // 飞出期间（~100ms 内）快速连按 3 次 ←
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("ArrowLeft");

      await settle(page);
      const rec = await stopRecorder(page, n0);

      // 断言 1：同一 rAF 帧内绝对不能提交超过 1 张卡
      assert.ok(
        rec.maxDelta <= 1,
        `单帧内提交数绝不能超过 1 张（实测最大单帧提交: ${rec.maxDelta}）`
      );

      // 断言 2：总提交数必须严格等于队列模型预测（2 次提交：第一张 ←← 提交，第二张 ← 预览 + ← 提交，第三张 ← 预览）
      assert.equal(
        rec.totalCommits,
        2,
        `总提交数必须符合队列模型预测（2次提交），实测为 ${rec.totalCommits} 次。全部提交记录: ${JSON.stringify(rec.commits)}`
      );
      assert.deepEqual(
        rec.actions,
        ["left", "left"],
        `提交动作必须为 ["left", "left"]，实测: ${JSON.stringify(rec.actions)}`
      );
      assert.equal(
        rec.optLeftOn,
        true,
        "第 3 张卡上应保持排队的第 3 次 ← 产生的左侧预览（#opt-left 带 on）"
      );

      // 断言 3：排队的提交必须在目标卡独立落定 ≥250ms 之后发生（独立测得）
      assert.ok(rec.commits.length >= 2, "应至少记录到 2 次提交");
      const queuedCommit = rec.commits[1];
      const targetKey = queuedCommit.cardKeyBefore;
      const indSettle = rec.settles[targetKey];
      assert.ok(
        indSettle > 0,
        `排队提交时目标卡必须已有独立落定时间戳（${targetKey}）`
      );
      const gap = queuedCommit.t - indSettle;
      assert.ok(
        gap >= 245,
        `排队提交必须在目标卡独立落定 ≥250ms 后发生（实测 gap: ${Math.round(gap)}ms, commit.t=${Math.round(queuedCommit.t)}, indSettle=${Math.round(indSettle)}）`
      );

      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });

  // --------------------------------------------------------------------------
  // F1b: 长按自动重复
  // --------------------------------------------------------------------------
  test(`${engine} 1280: F1b 飞出期间长按 ← 自动重复不入队，只预览不额外提交`, async () => {
    const { ctx, page, errs } = await setup(engine);
    try {
      await settle(page);
      const n0 = await page.evaluate(() => window.__zz.actions.length);
      await startRecorder(page);

      // ←← 起飞
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("ArrowLeft");

      // 飞出期间长按 ←（Playwright 在无底层操作系统键盘重复驱动时，对已 down 的键再次调用
      // page.keyboard.down 会真实派发带有 repeat:true 的 keydown 事件，以此测试浏览器的 auto-repeat 行为）
      await page.keyboard.down("ArrowLeft");
      for (let i = 0; i < 7; i++) {
        await page.waitForTimeout(100);
        await page.keyboard.down("ArrowLeft");
      }
      await page.waitForTimeout(100);
      await page.keyboard.up("ArrowLeft");

      await settle(page);
      const rec = await stopRecorder(page, n0);

      // 断言 1：同一帧绝不提交 2 张卡
      assert.ok(
        rec.maxDelta <= 1,
        `单帧内提交数绝不能超过 1 张（实测最大单帧提交: ${rec.maxDelta}）`
      );

      // 断言 2：第一张卡之后额外提交数 ≤ 1（预期为 0 额外提交，仅预览下一张卡）
      const extraCommits = rec.totalCommits - 1;
      assert.ok(
        extraCommits <= 1,
        `第一张卡之后额外提交数必须 ≤ 1（实测额外提交: ${extraCommits}）`
      );
      assert.equal(
        rec.totalCommits,
        1,
        `长按 ← 只应在第一张卡提交后预览第二张卡，不产生额外提交（实测总提交: ${rec.totalCommits}，动作: ${JSON.stringify(rec.actions)}）`
      );
      assert.deepEqual(
        rec.actions,
        ["left"],
        `提交动作应只保留起飞那一次 ["left"]，实为: ${JSON.stringify(rec.actions)}`
      );
      assert.equal(
        rec.optLeftOn,
        true,
        "长按后第二张卡应停在左侧预览状态（#opt-left 带 on）"
      );

      // 验证重复事件确实被派发且标记为 repeat:true
      const repeats = rec.keyEvents.filter((k) => k.repeat);
      assert.ok(
        repeats.length >= 5,
        `必须派发足够数量的 auto-repeat 事件（实测 repeat 事件数: ${repeats.length}）`
      );

      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });

  // --------------------------------------------------------------------------
  // F2 (1280 键鼠): 飞出期间点字匣格子
  // --------------------------------------------------------------------------
  test(`${engine} 1280: F2 飞出期间点击字匣格子，不提交下一张卡且落字在落定≥250ms后`, async () => {
    const { ctx, page, errs } = await setup(engine, { code: C04_CODE });
    try {
      await settle(page);
      const slotLocator = page.locator("#wordbox .slot.ok:not([disabled])").first();
      assert.ok((await slotLocator.count()) > 0, "当前卡必须具有可落字的字匣格子");
      const box = await slotLocator.boundingBox();
      assert.ok(box, "字匣格子必须具有可见布局区域");

      const n0 = await page.evaluate(() => window.__zz.actions.length);
      await startRecorder(page);

      // ←← 起飞
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("ArrowLeft");

      // 起飞后约 60ms 点击字匣格子
      await page.waitForTimeout(60);
      const animatingAtClick = await page.evaluate(() => !!window.__zz.animating);
      assert.equal(animatingAtClick, true, "点击时卡片必须正在飞出中（ui.animating === true）");

      // 真实鼠标点击字匣格子
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

      // 观察 2 秒，确保没有发生第二次方向提交
      await page.waitForTimeout(2000);
      await settle(page);
      const rec = await stopRecorder(page, n0);

      // 断言 1：2s 内绝对不应出现第二次方向提交（不能出现第二个 'left' 或 'right'）
      const sideCommits = rec.actions.filter((a) => a === "left" || a === "right");
      assert.equal(
        sideCommits.length,
        1,
        `2s 内绝不应出现第二次方向提交（实测方向提交数: ${sideCommits.length}, 动作序列: ${JSON.stringify(rec.actions)}）`
      );

      // 断言 2：动作序列必须为 [<first commit>] 或 [<first commit>, <drop applied to next card>]
      assert.ok(
        rec.actions.length === 1 || (rec.actions.length === 2 && rec.actions[1].startsWith("drop")),
        `动作序列只能为 [<first commit>] 或 [<first commit>, drop*]，实为: ${JSON.stringify(rec.actions)}`
      );
      assert.equal(rec.actions[0], "left", "第一个提交动作必须为起飞的 left");

      // 断言 3：如果落字被应用到下一张卡，必须在下一张卡独立落定 ≥250ms 之后（独立测得）
      if (rec.actions.length === 2) {
        const dropCommit = rec.commits.find((c) => c.acts.some((a) => a.startsWith("drop")));
        assert.ok(dropCommit, "必须存在落字提交记录");
        const targetKey = dropCommit.cardKeyBefore;
        const indSettle = rec.settles[targetKey];
        assert.ok(indSettle > 0, `落字提交时目标卡必须已有独立落定时刻（${targetKey}）`);
        const gap = dropCommit.t - indSettle;
        assert.ok(
          gap >= 245,
          `落字动作必须在下一张卡停稳 ≥250ms 后发生（实测 gap: ${Math.round(gap)}ms）`
        );
      }

      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });

  // --------------------------------------------------------------------------
  // F2 变体 (下一张卡存在落字槽): 飞出期间排队的落字必须在下一张卡独立落定 ≥250ms 后被应用（A3）
  // --------------------------------------------------------------------------
  test(`${engine} 1280: F2变体 下一张卡存在匹配落字槽时，飞出期间排队的落字必须生效（A3）`, async () => {
    const { ctx, page, errs } = await setup(engine, { code: C06_CODE });
    try {
      await settle(page);
      const slotLocator = page.locator("#wordbox [data-slot=\"0\"]");
      assert.ok((await slotLocator.count()) > 0, "字匣必须具有 slot 0（水）");
      const box = await slotLocator.boundingBox();
      assert.ok(box, "字匣格子必须具有可见布局区域");

      const n0 = await page.evaluate(() => window.__zz.actions.length);
      await startRecorder(page);

      // ←← 起飞
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("ArrowLeft");

      // 起飞后约 60ms 点击字匣格子 slot 0
      await page.waitForTimeout(60);
      const animatingAtClick = await page.evaluate(() => !!window.__zz.animating);
      assert.equal(animatingAtClick, true, "点击时卡片必须正在飞出中（ui.animating === true）");

      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

      await page.waitForTimeout(2000);
      await settle(page);
      const rec = await stopRecorder(page, n0);

      // 断言 1：方向提交只有起飞那一次
      const sideCommits = rec.actions.filter((a) => a === "left" || a === "right");
      assert.equal(sideCommits.length, 1, `方向提交必须仅有 1 次（实测 ${sideCommits.length}，动作: ${JSON.stringify(rec.actions)}）`);

      // 断言 2：动作序列必须严格包含落字，即 ["left", "drop0"]
      assert.deepEqual(
        rec.actions,
        ["left", "drop0"],
        `排队的落字必须被下一张卡（C04）执行，动作序列应为 ["left", "drop0"]，实测为: ${JSON.stringify(rec.actions)}`
      );

      // 断言 3：落字动作必须在下一张卡独立落定 ≥250ms 后发生
      const dropCommit = rec.commits.find((c) => c.acts.some((a) => a.startsWith("drop")));
      assert.ok(dropCommit, "必须存在落字提交记录");
      const targetKey = dropCommit.cardKeyBefore;
      const indSettle = rec.settles[targetKey];
      assert.ok(indSettle > 0, `落字提交时目标卡必须已有独立落定时刻（${targetKey}）`);
      const gap = dropCommit.t - indSettle;
      assert.ok(
        gap >= 245,
        `落字动作必须在下一张卡停稳 ≥250ms 后发生（实测 gap: ${Math.round(gap)}ms）`
      );

      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });

  // --------------------------------------------------------------------------
  // F2 (390 触屏): 飞出期间触屏轻点字匣格子
  // --------------------------------------------------------------------------
  test(`${engine} 390 touch: F2 飞出期间触屏轻点字匣格子，不提交下一张卡且落字在落定≥250ms后`, async () => {
    const { ctx, page, errs } = await setup(engine, {
      code: C04_CODE,
      touch: true,
      viewport: VP_TOUCH,
    });
    try {
      await settle(page);
      const slotLocator = page.locator("#wordbox .slot.ok:not([disabled])").first();
      assert.ok((await slotLocator.count()) > 0, "当前卡必须具有可落字的字匣格子");
      const box = await slotLocator.boundingBox();
      assert.ok(box, "字匣格子必须具有可见布局区域");

      const n0 = await page.evaluate(() => window.__zz.actions.length);
      await startRecorder(page);

      // 触屏起飞：若选项按钮可见则 tap 右选项，否则用真实键盘 ←←
      const optRight = page.locator("#opt-right");
      const optVisible = await optRight.isVisible().catch(() => false);
      let expectedSide = "left";
      if (optVisible) {
        await optRight.tap();
        expectedSide = "right";
      } else {
        await page.keyboard.press("ArrowLeft");
        await page.keyboard.press("ArrowLeft");
      }

      // 起飞后约 60ms 触屏轻点字匣格子
      await page.waitForTimeout(60);
      const animatingAtTap = await page.evaluate(() => !!window.__zz.animating);
      assert.equal(animatingAtTap, true, "轻点时卡片必须正在飞出中（ui.animating === true）");

      // 真实触屏点击（page.touchscreen.tap，无合成事件）
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);

      // 观察 2 秒，确保没有发生第二次方向提交
      await page.waitForTimeout(2000);
      await settle(page);
      const rec = await stopRecorder(page, n0);

      // 断言 1：2s 内绝对不应出现第二次方向提交
      const sideCommits = rec.actions.filter((a) => a === "left" || a === "right");
      assert.equal(
        sideCommits.length,
        1,
        `2s 内绝不应出现第二次方向提交（实测方向提交数: ${sideCommits.length}, 动作序列: ${JSON.stringify(rec.actions)}）`
      );

      // 断言 2：动作序列必须为 [<first commit>] 或 [<first commit>, <drop applied to next card>]
      assert.ok(
        rec.actions.length === 1 || (rec.actions.length === 2 && rec.actions[1].startsWith("drop")),
        `动作序列只能为 [<first commit>] 或 [<first commit>, drop*]，实为: ${JSON.stringify(rec.actions)}`
      );
      assert.equal(rec.actions[0], expectedSide, `第一个提交动作必须为起飞的 ${expectedSide}`);

      // 断言 3：如果落字被应用到下一张卡，必须在下一张卡独立落定 ≥250ms 之后（独立测得）
      if (rec.actions.length === 2) {
        const dropCommit = rec.commits.find((c) => c.acts.some((a) => a.startsWith("drop")));
        assert.ok(dropCommit, "必须存在落字提交记录");
        const targetKey = dropCommit.cardKeyBefore;
        const indSettle = rec.settles[targetKey];
        assert.ok(indSettle > 0, `落字提交时目标卡必须已有独立落定时刻（${targetKey}）`);
        const gap = dropCommit.t - indSettle;
        assert.ok(
          gap >= 245,
          `落字动作必须在下一张卡停稳 ≥250ms 后发生（实测 gap: ${Math.round(gap)}ms）`
        );
      }

      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });
}
