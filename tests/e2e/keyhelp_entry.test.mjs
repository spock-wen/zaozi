// 键位浮层「入场」回归（PM 决定）：B 档（1024×600 等矮屏）首进自动弹的「?」浮层
// （#keyhelp-pop，右上贴边）原本在卡入场（提交后 240ms 飞出 + 160ms CSS 回位）时还开着，
// 卡从右侧滑回正好从它下面经过，压住卡角「刻」#bonecorner 约 84–100ms。
//
// 修法（web/app.js）：入场动画（ui.animating 的 rAF 阶段 + 其后 CSS 过渡）期间浮层隐去；
// 卡稳住（getAnimations() 跑完、ui.animating=false）后再显形（自动弹等待入场结束），
// 且显形前用 placeKeyhelp() 核对最终位置，避开 #bonecorner 与当前教学目标。
//
// 本用例完全确定、不采样、不重试：
//   1) 走教学 T01→T02，再提交进 T03（锁拖，一进来就是「刻」）；
//   2) 等卡有一帧正在跑的入场过渡，暂停所有卡动画并把 currentTime 拨到时长一半（卡停在滑回中途）；
//   3) 断言「?」浮层此时隐去，或不与 #bonecorner / 教学目标相交；
//   4) finish() 掉卡动画，断言浮层自动显形，且不与 #bonecorner / 教学目标相交。
// 三引擎 × 1024×600、1024×513、1024×491。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";
import { commit } from "./helpers/flow.mjs";

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

const VPS = [
  { w: 1024, h: 600 },
  { w: 1024, h: 513 },
  { w: 1024, h: 491 },
];

async function open(engine, { w, h }) {
  const ctx = await browsers[engine].newContext({ viewport: { width: w, height: h }, hasTouch: w < 600 });
  const page = await ctx.newPage();
  const errs = [];
  collectErrors(page, errs);
  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__zz);
  return { ctx, page, errs };
}

// 浮层与「卡角 + 当前教学目标」（落字→字匣、刻→卡角）的几何：是否隐去、是否相交。
const keyhelpGeom = (page) =>
  page.evaluate(() => {
    const pop = document.querySelector("#keyhelp-pop");
    const vis = (e) => e && !e.hidden && getComputedStyle(e).display !== "none" && e.getBoundingClientRect().width > 0;
    const R = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width }; };
    const sel = ["#bonecorner", "#wordbox-bar"];
    const targets = sel.map((s) => document.querySelector(s)).filter(vis).map(R);
    const pr = R(pop);
    const inter = (a, b) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > 0 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 0;
    return {
      hidden: pop.hidden,
      pop: pr,
      targetCount: targets.length,
      boneTarget: targets.some((t) => t.w > 0),
      covers: !pop.hidden && targets.some((t) => inter(pr, t)),
      current: window.__zz.st.current,
      phase: window.__zz.st.phase,
    };
  });

for (const engine of Object.keys(ENGINES)) {
  for (const vp of VPS) {
    test(`${engine} 键位浮层 ${vp.w}×${vp.h}: 入场中不盖卡角/目标，入场后自动弹且不盖`, async () => {
      const { ctx, page, errs } = await open(engine, vp);
      try {
        // 首进自动弹「?」（空 context → 进来就开着）。等它出现，确认是自动弹而非手点。
        await page.waitForFunction(() => !document.querySelector("#keyhelp-pop").hidden, null, { timeout: 5000 });

        await commit(page, "left");                 // T01 → T02
        await page.waitForFunction(() => !window.__zz.animating, null, { timeout: 5000 });

        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowRight");    // T02 → T03（锁拖，一进来就是「刻」）

        // 等「飞出 rAF」结束、CSS 回位过渡正在跑（此时才真正进入入场滑回中途）。
        await page.waitForFunction(() => {
          if (window.__zz.animating) return false;
          if (window.__zz.st.phase !== "engrave") return false;
          const card = document.querySelector("#card");
          return card.getAnimations().some((a) => a.playState === "running") || getComputedStyle(card).transform !== "none";
        }, null, { timeout: 5000 });

        // 暂停所有卡动画并把 currentTime 拨到一半：卡定格在滑回途中。
        const paused = await page.evaluate(() => {
          const card = document.querySelector("#card");
          const anims = card.getAnimations();
          for (const a of anims) { a.pause(); a.currentTime = Number(a.effect.getTiming().duration) / 2; }
          return { count: anims.length };
        });
        assert.ok(paused.count > 0, "入场滑回应有正在跑的卡动画（transform/opacity 过渡）");

        const mid = await keyhelpGeom(page);
        assert.equal(mid.current, "T03", "入场中途应已到 T03");
        assert.equal(mid.phase, "engrave", "入场中途应处于「刻」阶段");
        assert.ok(mid.boneTarget, "入场中途卡角「刻」应在屏内（作为目标可被断言）");
        assert.ok(mid.hidden || !mid.covers, `入场滑回中途「?」浮层必须隐去、或不与卡角/目标相交（hidden=${mid.hidden} covers=${mid.covers}）`);

        // finish() 掉卡动画 → 卡归位；浮层应自动显形且让开目标。
        await page.evaluate(() => { for (const a of document.querySelector("#card").getAnimations()) a.finish(); });
        await page.waitForFunction(() => {
          const card = document.querySelector("#card");
          return !window.__zz.animating && !card.getAnimations().some((a) => a.playState === "running");
        }, null, { timeout: 5000 });
        await page.waitForFunction(() => !document.querySelector("#keyhelp-pop").hidden, null, { timeout: 5000 });

        const post = await keyhelpGeom(page);
        assert.equal(post.current, "T03");
        assert.equal(post.phase, "engrave");
        assert.ok(post.boneTarget, "入场结束后卡角「刻」应在屏内");
        assert.equal(post.hidden, false, "入场结束后「?」浮层应自动显形（本次未手点「?」）");
        assert.ok(!post.covers, `入场结束后「?」浮层不得与卡角/目标相交（covers=${post.covers}, pop=${JSON.stringify(post.pop)}）`);

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}
