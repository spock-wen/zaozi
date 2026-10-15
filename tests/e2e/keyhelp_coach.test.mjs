// T03 教学「刻」：手动打开「?」键位浮层（#keyhelp-pop）时，不得压住教学气泡 #coach（PM 决定，产品改动）。
//
// 现象（B 档 1024×600 / 513 / 491）：走到 T03「刻」后 #coach 会落到卡上方/右侧
// （≈640–678,74 起，320×40），而「?」浮层默认右上贴边（1024 起 x 672、y 52、344×100），
// 两者在 y 74–114 一叠就互相压住。
//
// 修法（web/app.js）：
//   placeKeyhelp() 把 #coach 也列进「要避让的框」（连同 #bonecorner 与当前教学目标，以及
//   左右选项/矮屏提示这些硬规则点击目标），按 右上→右下方→左下方→右上/左上→上方 挑第一个
//   整块在视口内、且不与任何框相交的位置；整屏都放不下时才隐去 #coach（visibility:hidden），
//   浮层收起时还原（visibility 不改布局，位置原样恢复）。
//
// 本用例完全确定、不采样、不重试：
//   1) 走教学 T01→T02→T03（commit），确认首进自动弹的「?」浮层已关；
//   2) 等卡入场跑完（getAnimations().finished）并等 #coach 落稳（跨过提交后 650ms 的
//      floats 清空重绘），记下 #coach 的矩形；
//   3) 手点「?」打开浮层，断言：#coach 可见且与 #keyhelp-pop 交集为 0，或 #coach 已隐去；
//      卡角「刻」#bonecorner（=T03 教学目标）在「卡角∩视口」内缩点用 elementFromPoint 仍命中自身；
//   4) Esc 关闭，断言 #coach 可见且矩形与打开前一致。
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

// 卡入场（JS 飞出/回弹的 rAF 阶段 + 随后 CSS 回位过渡）跑完：先等 ui.animating=false，
// 再等 getAnimations() 全部 finished。幂等——入场早已结束时立即返回。
async function waitEntryDone(page) {
  await page.waitForFunction(() => !window.__zz.animating, null, { timeout: 5000 });
  await page.evaluate(() => Promise.all(document.querySelector("#card").getAnimations().map((a) => a.finished)));
  await page.waitForFunction(() => {
    const card = document.querySelector("#card");
    return !window.__zz.animating && !card.getAnimations().some((a) => a.playState === "running");
  }, null, { timeout: 5000 });
}

// 等 #coach 位置稳定：提交进 T03 后 650ms 有一次 floats 清空重绘会把气泡挪到最终位。
// 连续 700ms 矩形不变才算稳（跨过那次重绘），否则一直等（上限 6s）。
const waitCoachSettled = (page) =>
  page.evaluate(async () => {
    const rect = () => {
      const r = document.querySelector("#coach").getBoundingClientRect();
      return [r.left, r.top, r.width, r.height].join(",");
    };
    let last = null, since = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < 6000) {
      await new Promise((res) => setTimeout(res, 100));
      const cur = rect();
      if (cur === last) { if (performance.now() - since >= 700) return; }
      else { last = cur; since = performance.now(); }
    }
    throw new Error("coach 位置在 6s 内未稳定");
  });

// 几何快照：#coach / #keyhelp-pop / #bonecorner 的视口矩形、可见性、是否相交，
// 以及卡角「∩ 视口内缩 1px」中心点的 elementFromPoint 命中。
const geom = (page) =>
  page.evaluate(() => {
    const vis = (e) => !!e && !e.hidden && getComputedStyle(e).display !== "none"
      && getComputedStyle(e).visibility !== "hidden" && e.getBoundingClientRect().width > 0;
    const R = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
    const inter = (a, b) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > 0 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 0;
    const coach = document.querySelector("#coach"), pop = document.querySelector("#keyhelp-pop"), bc = document.querySelector("#bonecorner");
    const cr = R(coach), pr = R(pop), br = R(bc);
    // 卡角矩形 ∩ 视口，内缩 1px，取中心：Chromium 的 elementFromPoint 把坐标取整，
    // 内缩 1px 才不会落到边缘外。
    const k = 1;
    const L = Math.max(br.l, 0) + k, Rr = Math.min(br.r, innerWidth) - k, T = Math.max(br.t, 0) + k, B = Math.min(br.b, innerHeight) - k;
    const onScreen = Rr > L && B > T;
    const pt = onScreen ? [(L + Rr) / 2, (T + B) / 2] : null;
    const hit = pt ? document.elementFromPoint(pt[0], pt[1]) : null;
    return {
      current: window.__zz.st.current, phase: window.__zz.st.phase,
      coachVisible: vis(coach), popVisible: vis(pop),
      cr, pr, bone: br,
      popCoachOverlap: vis(coach) && vis(pop) && inter(cr, pr),
      boneOnScreen: onScreen,
      boneHitSelf: !!(hit && hit.closest("#bonecorner")),
      boneHit: hit ? (hit.id || hit.className || hit.tagName) : "none",
    };
  });

const sameRect = (a, b) =>
  Math.abs(a.l - b.l) <= 0.5 && Math.abs(a.t - b.t) <= 0.5 && Math.abs(a.w - b.w) <= 0.5 && Math.abs(a.h - b.h) <= 0.5;

for (const engine of Object.keys(ENGINES)) {
  for (const vp of VPS) {
    test(`${engine} T03「刻」 ${vp.w}×${vp.h}: 「?」浮层不压 #coach，卡角仍可点，关掉后 #coach 原位还原`, async () => {
      const { ctx, page, errs } = await open(engine, vp);
      try {
        // 首进自动弹的「?」浮层先关掉，保证这次断言的是「手点」打开。
        if (await page.evaluate(() => !document.querySelector("#keyhelp-pop").hidden)) {
          await page.keyboard.press("Escape");
          await page.waitForFunction(() => document.querySelector("#keyhelp-pop").hidden, null, { timeout: 5000 });
        }
        await waitEntryDone(page);

        await commit(page, "left");                 // T01 → T02
        await commit(page, "right");                // T02 → T03（锁拖，一进来就是「刻」）
        await page.waitForFunction(() => window.__zz.st.phase === "engrave", null, { timeout: 5000 });
        await waitEntryDone(page);
        await waitCoachSettled(page);               // 跨过 650ms 重绘，#coach 落到最终位

        const before = await geom(page);
        assert.equal(before.current, "T03", "应到教学 T03");
        assert.equal(before.phase, "engrave", "T03 应处于「刻」阶段");
        assert.ok(before.coachVisible, "打开「?」浮层前 #coach 教学气泡应可见");

        // 手点「?」打开键位浮层。
        await page.click("#keyhelp-btn");
        await page.waitForFunction(() => !document.querySelector("#keyhelp-pop").hidden, null, { timeout: 5000 });
        await waitEntryDone(page);
        await page.waitForTimeout(100);

        const open = await geom(page);
        assert.equal(open.popVisible, true, "手点「?」后键位浮层应打开");
        assert.ok(
          !open.coachVisible || !open.popCoachOverlap,
          `「?」浮层不得压住 #coach（coachVisible=${open.coachVisible} overlap=${open.popCoachOverlap} coach=${JSON.stringify(open.cr)} pop=${JSON.stringify(open.pr)}）`,
        );
        // 卡角「刻」= T03 教学目标，浮层开着时也必须可点。
        assert.ok(open.boneOnScreen, `卡角「刻」应在屏内：${JSON.stringify(open.bone)}`);
        assert.ok(open.boneHitSelf, `卡角「刻」内缩点应命中 #bonecorner，实际命中：${open.boneHit}`);

        // Esc 关闭浮层，#coach 应可见并还原到打开前的同一位置。
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => document.querySelector("#keyhelp-pop").hidden, null, { timeout: 5000 });
        await waitCoachSettled(page);
        const after = await geom(page);
        assert.ok(after.coachVisible, "关闭浮层后 #coach 应可见");
        assert.ok(sameRect(after.cr, before.cr), `关闭后 #coach 应回到打开前的同一位置：before=${JSON.stringify(before.cr)} after=${JSON.stringify(after.cr)}`);
        assert.ok(after.boneHitSelf, `关闭浮层后卡角「刻」仍应可点，实际命中：${after.boneHit}`);

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}

// ---------- 追加：T03「刻」#coach 不被卡入场过渡带偏，「?」开/关 5 次也不挪位 ----------
//
// 根因（任务 FIX 2）：placeCoach 用 #bonecorner.getBoundingClientRect() 当刻字步的参考。#bonecorner
// 在被 transform 的 #card 内，卡还在入场过渡（rotate/translate）时读到的是位移中的盒，#coach 会算到
// ~190px 外（例：1024×513 下 top 265 而非 74），直到下一次 render（如关「?」）才被纠正——看起来像
// 浮层把 #coach 挪了。修法：卡内目标改用 #cardwrap 视口盒 + 目标相对卡的 offset*（targetRect）。
//
// 用例：走到 T03「刻」并静置；起一段与入场同构的 #card transform 过渡，pause+currentTime 定格在
// 中点，跑 render()，断言 #coach 矩形与稳定位一致（修复前会偏 ~190px）；让过渡 finish 后再断言
// 一次。随后点「?」（#keyhelp-btn）开/关 ≥5 次，每次循环前后 #coach 矩形一致（±0.5px）。

const render = (page) => page.evaluate(() => window.__zz.render());

for (const engine of Object.keys(ENGINES)) {
  for (const vp of VPS) {
    test(`${engine} T03「刻」 ${vp.w}×${vp.h}: 卡入场过渡中点 #coach 仍在正确位，「?」开/关 5 次不挪位`, async () => {
      const { ctx, page, errs } = await open(engine, vp);
      try {
        if (await page.evaluate(() => !document.querySelector("#keyhelp-pop").hidden)) {
          await page.keyboard.press("Escape");
          await page.waitForFunction(() => document.querySelector("#keyhelp-pop").hidden, null, { timeout: 5000 });
        }
        await waitEntryDone(page);
        await commit(page, "left");                 // T01 → T02
        await commit(page, "right");                // T02 → T03（锁拖，一进来就是「刻」）
        await page.waitForFunction(() => window.__zz.st.phase === "engrave", null, { timeout: 5000 });
        await waitEntryDone(page);
        await waitCoachSettled(page);
        const settled = (await geom(page)).cr;

        // 起一段与入场同构的 #card transform 过渡，暂停并定格在中点。
        await page.evaluate(() => { document.getElementById("card").style.transform = "translateX(190px) rotate(10deg)"; });
        await page.waitForFunction(() => document.getElementById("card").getAnimations().some((a) => a.playState === "running"), null, { timeout: 5000 });
        await page.evaluate(() => {
          const card = document.getElementById("card");
          for (const a of card.getAnimations()) { a.pause(); a.currentTime = (a.effect.getTiming().duration || 0) / 2; }
        });
        // 卡被 transform 定格在中点时跑 render()：#coach 必须仍落在稳定位（不得被位移中的 #bonecorner 带偏）。
        await render(page);
        const frozen = (await geom(page)).cr;
        assert.ok(sameRect(frozen, settled), `卡入场过渡中点时 #coach 应与稳定位一致：settled=${JSON.stringify(settled)} frozen=${JSON.stringify(frozen)}`);

        // 过渡跑到终点（#card 仍处变换终值）：#coach 仍应一致。
        await page.evaluate(() => { document.getElementById("card").getAnimations().forEach((a) => a.finish()); });
        await render(page);
        const finished = (await geom(page)).cr;
        assert.ok(sameRect(finished, settled), `入场过渡跑完时 #coach 应与稳定位一致：settled=${JSON.stringify(settled)} finished=${JSON.stringify(finished)}`);

        // 复原卡（清掉内联 transform）回到稳定态。
        await page.evaluate(() => {
          const card = document.getElementById("card");
          card.getAnimations().forEach((a) => a.cancel());
          card.style.transform = "";
        });
        await waitEntryDone(page);
        await waitCoachSettled(page);
        const restored = (await geom(page)).cr;
        assert.ok(sameRect(restored, settled), `复原后 #coach 应回到稳定位：settled=${JSON.stringify(settled)} restored=${JSON.stringify(restored)}`);

        // 「?」开/关 ≥5 次：#coach 矩形每次循环前后一致（±0.5px）。
        for (let i = 0; i < 5; i++) {
          const before = (await geom(page)).cr;
          await page.click("#keyhelp-btn");
          await page.waitForFunction(() => !document.querySelector("#keyhelp-pop").hidden, null, { timeout: 5000 });
          await page.waitForTimeout(60);
          await page.click("#keyhelp-btn");
          await page.waitForFunction(() => document.querySelector("#keyhelp-pop").hidden, null, { timeout: 5000 });
          await page.waitForTimeout(60);
          const after = (await geom(page)).cr;
          assert.ok(sameRect(after, before), `第 ${i + 1} 次「?」开/关后 #coach 不应挪位：before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
        }

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}
