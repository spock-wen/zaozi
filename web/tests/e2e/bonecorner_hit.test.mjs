// 卡角「刻」#bonecorner 命中回归。
// 缺陷（Firefox 随机复现）：点 T03 卡角「刻」被 .card-head 接住 30s 超时。
// 根因见 ROOTCAUSE_bonecorner.md：`.bonecorner.done{pointer-events:none}` 的 done 类由
// `classList.toggle("done", st.phase === "engrave" && ui.engraved)` 切换，而 ui.engraved
// 从未初始化（undefined）→ `true && undefined` = undefined，`toggle(name, undefined)`
// 按规范等同「不带 force」→ 每次重绘都把 done 类翻转一次。赶上「开着」的那几帧，
// 卡角 pointer-events:none，卡角中心就落到下面的 .card-head 上，元素点不到。
//
// 断言：在卡角中心用 document.elementFromPoint，必须命中 #bonecorner 本身或其子节点。
// 四个视口（1280×720 / 1024×600 / 1366×768 / 390×844）各查三处：
//   1) 入场动画中途：提交进「刻」后，等卡出现正在跑的入场过渡（飞出是 rAF JS，
//      随后 CSS 160ms 把卡从右侧滑回），暂停所有卡动画、currentTime 拨到时长一半，
//      查卡角中心（中心在屏外则该处跳过——飞出/滑回途中卡角可能短暂在屏外，不是缺陷）；
//   2) 入场动画结束后：finish() 掉卡动画、等卡归位并跨过 650ms 重绘后再查；
//   3) 教学态：同存档重载，load 之后立刻查（此时应已回到 T03「刻」）。
// 全部为「定住某一帧再查」的确定性探针，不用 rAF 逐帧采样、不依赖任何一种点击重试。
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
  { w: 1280, h: 720 },
  { w: 1024, h: 600 },
  { w: 1366, h: 768 },
  { w: 390, h: 844 },
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

// B 档（1024×600）首次进入会自动弹「?」键位浮层（z-index 61，独立浮层）。
// 它是首进一次的提示、3 秒自收——先按 Esc 收掉，好让断言只盯「卡角 vs 卡内正文 .card-head」。
async function dismissKeyhelp(page) {
  if (await page.evaluate(() => !document.querySelector("#keyhelp-pop").hidden)) {
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.querySelector("#keyhelp-pop").hidden);
  }
}

// 卡角中心命中探针：命中 #bonecorner 或其子节点才算过；中心在屏外则标 onScreen=false（跳过）。
const boneProbe = (page) =>
  page.evaluate(() => {
    const bc = document.querySelector("#bonecorner");
    const r = bc.getBoundingClientRect();
    // 探针点取「卡角矩形 ∩ 视口」内缩 1px 的中心：Chromium 的 elementFromPoint 会把 x 取整，
    // 卡角中心落在 [innerWidth-0.5, innerWidth) 时返回 null（见 QA ec61666 efp_probe）。
    const k = 1 + 2 * Math.max(0, r.width - bc.offsetWidth, r.height - bc.offsetHeight); // 入场中卡带旋转：包围盒比卡角本体宽出 ≈s·sinθ，内缩这么多才保证落在卡角本体内
    const safePt = (r) => { const L = Math.max(r.left, 0) + k, R = Math.min(r.right, innerWidth) - k, T = Math.max(r.top, 0) + k, B = Math.min(r.bottom, innerHeight) - k; return R > L && B > T ? [(L + R) / 2, (T + B) / 2] : null; };
    const pt = r.width >= 1 ? safePt(r) : null;
    const onScreen = !!pt;
    const el = pt ? document.elementFromPoint(pt[0], pt[1]) : null;
    return {
      current: window.__zz.st.current, phase: window.__zz.st.phase, w: r.width, onScreen,
      hitSelf: !!(el && el.closest("#bonecorner")),
      hit: el ? el.id || el.className || el.tagName : "none",
    };
  });

for (const engine of Object.keys(ENGINES)) {
  for (const vp of VPS) {
    test(`${engine} 卡角「刻」命中 ${vp.w}×${vp.h}: 入场动画中/动画后/教学态都命中 #bonecorner`, async () => {
      const { ctx, page, errs } = await open(engine, vp);
      try {
        await dismissKeyhelp(page);
        await commit(page, "left");                 // T01 → T02
        await page.waitForFunction(() => !window.__zz.animating, null, { timeout: 5000 });

        // 提交进 T03：先等飞出 rAF 结束、CSS 回位过渡正在跑（此刻卡定格在滑回途中）。
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowRight");    // T02 → T03（锁拖，一进来就是「刻」）
        await page.waitForFunction(() => {
          if (window.__zz.animating) return false;
          if (window.__zz.st.phase !== "engrave") return false;
          const card = document.querySelector("#card");
          return card.getAnimations().some((a) => a.playState === "running") || getComputedStyle(card).transform !== "none";
        }, null, { timeout: 5000 });

        // 暂停所有卡动画、currentTime 拨到一半 → 卡定在滑回中途，查卡角中心。
        const mid = await page.evaluate(() => {
          const card = document.querySelector("#card");
          const anims = card.getAnimations();
          for (const a of anims) { a.pause(); a.currentTime = Number(a.effect.getTiming().duration) / 2; }
          const bc = document.querySelector("#bonecorner");
          const r = bc.getBoundingClientRect();
          // 探针点取「卡角矩形 ∩ 视口」内缩 1px 的中心：Chromium 的 elementFromPoint 会把 x 取整，
          // 卡角中心落在 [innerWidth-0.5, innerWidth) 时返回 null（见 QA ec61666 efp_probe）。
          const k = 1 + 2 * Math.max(0, r.width - bc.offsetWidth, r.height - bc.offsetHeight); // 入场中卡带旋转：包围盒比卡角本体宽出 ≈s·sinθ，内缩这么多才保证落在卡角本体内
    const safePt = (r) => { const L = Math.max(r.left, 0) + k, R = Math.min(r.right, innerWidth) - k, T = Math.max(r.top, 0) + k, B = Math.min(r.bottom, innerHeight) - k; return R > L && B > T ? [(L + R) / 2, (T + B) / 2] : null; };
          const pt = r.width >= 1 ? safePt(r) : null;
          const onScreen = !!pt;
          const el = pt ? document.elementFromPoint(pt[0], pt[1]) : null;
          return {
            anims: anims.length, current: window.__zz.st.current, phase: window.__zz.st.phase,
            w: r.width, onScreen, offRight: r.left >= innerWidth - 2 * k, diag: JSON.stringify({ r: [r.left, r.top, r.width, r.height].map((v) => +v.toFixed(2)), ow: bc.offsetWidth, k: +k.toFixed(2), pt, iw: innerWidth }), hitSelf: !!(el && el.closest("#bonecorner")),
            hit: el ? el.id || el.className || el.tagName : "none",
          };
        });
        assert.ok(mid.anims > 0, "入场滑回应有正在跑的卡动画（transform/opacity 过渡）");
        assert.equal(mid.current, "T03", "入场中途应已到 T03");
        assert.equal(mid.phase, "engrave", "入场中途应处于「刻」阶段");
        assert.ok(mid.w >= 1, "入场中途卡角应显形");
        if (!mid.onScreen) assert.ok(mid.offRight, `入场中途卡角（内缩后）与视口交集为空时，只应是卡角几乎整块在屏右外：${mid.diag}`);
        if (mid.onScreen) assert.ok(mid.hitSelf, `入场动画中卡角探针点应命中 #bonecorner，实际命中：${mid.hit} ${mid.diag}`);

        // finish() 掉卡动画 → 卡归位；跨过 650ms 重绘后再查稳态。
        await page.evaluate(() => { for (const a of document.querySelector("#card").getAnimations()) a.finish(); });
        await page.waitForFunction(() => {
          const card = document.querySelector("#card");
          return !window.__zz.animating && !card.getAnimations().some((a) => a.playState === "running");
        }, null, { timeout: 5000 });
        await page.waitForTimeout(800);
        const settled = await boneProbe(page);
        assert.equal(settled.current, "T03");
        assert.equal(settled.phase, "engrave");
        assert.ok(settled.w >= 1, "入场动画结束后卡角应显形");
        assert.ok(settled.onScreen, "入场动画结束后卡角中心应在屏内");
        assert.ok(settled.hitSelf, `入场动画结束后卡角中心应命中 #bonecorner，实际命中：${settled.hit}`);

        // 教学态：同存档重载，load 之后立刻查（此时应已回到 T03「刻」）。
        await page.reload({ waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz);
        const afterLoad = await boneProbe(page);
        assert.equal(afterLoad.current, "T03", "重载后应回到教学「刻」这一张");
        assert.equal(afterLoad.phase, "engrave");
        assert.ok(afterLoad.w >= 1, "重载后卡角应显形");
        assert.ok(afterLoad.hitSelf, `重载（load）后卡角中心应命中 #bonecorner，实际命中：${afterLoad.hit}`);

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}
