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
//   1) 入场动画进行中（提交进「刻」后按 rAF 采样，卡还在回位过渡里）；
//   2) 入场动画结束后（同一次采样里 transform 已归位、且跨过 650ms 重绘）；
//   3) 教学态（重载回到 T03，即「load 之后立刻」）。
// 用元素包围盒中心点，不依赖 Playwright 的点击重试（node:test 无 retry）。
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

// 页面内按 rAF 采样：卡角显形后每帧记一次 elementFromPoint（含该帧是否还在入场过渡里）。
// 只记「卡角中心落在视口内」的帧——飞出/回位途中卡角可能短暂在屏外，那不是命中缺陷。
async function startSampler(page) {
  await page.evaluate(() => {
    window.__bone = { samples: [] };
    const tick = () => {
      const bc = document.querySelector("#bonecorner");
      const r = bc.getBoundingClientRect();
      const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
      if (r.width >= 1 && cx >= 0 && cx < innerWidth && cy >= 0 && cy < innerHeight) {
        const el = document.elementFromPoint(cx, cy);
        const card = document.querySelector("#card");
        const moving =
          card.getAnimations().some((a) => a.playState === "running") ||
          getComputedStyle(card).transform !== "none";
        window.__bone.samples.push({
          current: window.__zz.st.current,
          phase: window.__zz.st.phase,
          moving,
          hitSelf: !!(el && el.closest("#bonecorner")),
          hit: el ? el.id || el.className || el.tagName : "none",
        });
      }
      window.__bone.raf = requestAnimationFrame(tick);
    };
    tick();
  });
}

// B 档（1024×600）首次进入会自动弹「?」键位浮层（z-index 61，独立浮层，合法盖住下方）。
// 它是首进一次的提示、3 秒自收——真人读到 T03 前早收了。这里先按 Esc 收掉，
// 好让下面的断言只盯「卡角 vs 卡内正文 .card-head」这一条。
async function dismissKeyhelp(page) {
  if (await page.evaluate(() => !document.querySelector("#keyhelp-pop").hidden)) {
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.querySelector("#keyhelp-pop").hidden);
  }
}

const centreHit = (page) =>
  page.evaluate(() => {
    const bc = document.querySelector("#bonecorner");
    const r = bc.getBoundingClientRect();
    const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return {
      current: window.__zz.st.current, phase: window.__zz.st.phase, w: r.width,
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

        await startSampler(page);                   // 从「提交进 T03」这一帧起采样
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowRight");    // T02 → T03（锁拖，一进来就是「刻」）
        await page.waitForTimeout(1400);            // 覆盖 240ms 飞出 + 160ms 回位 + 650ms 重绘

        const samples = await page.evaluate(() => {
          cancelAnimationFrame(window.__bone.raf);
          return window.__bone.samples;
        });
        assert.ok(samples.length > 0, "进入「刻」后应采样到卡角（四视口都应显形）");
        for (const s of samples) {
          assert.equal(s.current, "T03", "采样期间应停在 T03");
          assert.equal(s.phase, "engrave", "采样期间应处于「刻」阶段");
          assert.ok(s.hitSelf, `卡角中心应命中 #bonecorner，实际命中：${s.hit}（入场动画中=${s.moving}）`);
        }
        assert.ok(samples.some((s) => s.moving), "应采到入场动画进行中的帧");
        assert.ok(samples.some((s) => !s.moving), "应采到入场动画结束（已回位）的帧");

        // 入场动画结束后的稳态
        await page.waitForTimeout(800);
        const settled = await centreHit(page);
        assert.equal(settled.current, "T03");
        assert.ok(settled.hitSelf, `动画结束后卡角中心应命中 #bonecorner，实际命中：${settled.hit}`);

        // 教学态：同存档重载，load 之后立刻查（此时应已回到 T03「刻」）
        await page.reload({ waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz);
        const afterLoad = await centreHit(page);
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
