// 矮屏整段教学回归：1024×600 / 1280×720 × 三引擎，用真实输入（← → / 点骨片 / 按 1）
// 走完 T01→T05，每一步都断言教学气泡（#coachcol）不与该步的「目标」相交，
// 目标本身可点（elementFromPoint 命中自己），最后进到普通卡（正常play）。
// 起因：切卡瞬间气泡按移动中的 #card 定位，会算到卡/字匣上（1024×600 第 4 步字匣点不到、按 1 不落）。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";
import { commit, passCutscene } from "./helpers/flow.mjs";

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

// 每一步的「目标」：气泡都不许压。卡本体每步都算；选择步再算左右选项；
// 刻字步算卡角骨片；落字步算字匣 / 卡上落字框 / 字匣里被高亮的那格。
const TARGETS = {
  T01: ["#cardwrap", "#opt-left", "#opt-right"],
  T02: ["#cardwrap", "#opt-left", "#opt-right"],
  T03: ["#cardwrap", "#bonecorner"],
  T04: ["#cardwrap", "#wordbox-bar", "#card-drops", "#wordbox .slot.ok"],
  T05: ["#cardwrap", "#opt-left", "#opt-right"],
};
// 每步要「真实输入」去完成时点的那个目标（T03 骨片 / T04 字匣格）。
const PRIMARY = { T03: "#bonecorner", T04: "#wordbox .slot.ok" };

function intersect(a, b) {
  return Math.min(a.right, b.right) - Math.max(a.x, b.x) > 0 && Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 0;
}

const snap = (page) =>
  page.evaluate(() => {
    const R = (s) => {
      const e = document.querySelector(s);
      if (!e || e.hidden || getComputedStyle(e).display === "none") return null;
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
    };
    const hit = (s) => {
      const e = document.querySelector(s);
      if (!e) return "none";
      const r = e.getBoundingClientRect();
      const safePt = (r) => { const L = Math.max(r.left, 0) + 1, R = Math.min(r.right, innerWidth) - 1, T = Math.max(r.top, 0) + 1, B = Math.min(r.bottom, innerHeight) - 1; return R > L && B > T ? [(L + R) / 2, (T + B) / 2] : null; };
      const p = safePt(r);
      const t = p ? document.elementFromPoint(p[0], p[1]) : null;
      return t ? (t.closest(s) ? "self" : t.id || t.className) : "none";
    };
    return {
      current: window.__zz.st.current, phase: window.__zz.st.phase, vh: innerHeight,
      coach: R("#coachcol"), pe: getComputedStyle(document.querySelector("#coachcol")).pointerEvents,
      hits: { "#cardwrap": hit("#cardwrap"), "#bonecorner": hit("#bonecorner"), "#wordbox .slot.ok": hit("#wordbox .slot.ok") },
      rects: Object.fromEntries(["#cardwrap", "#opt-left", "#opt-right", "#bonecorner", "#wordbox-bar", "#card-drops", "#wordbox .slot.ok"].map((s) => [s, R(s)])),
    };
  });

function checkStep(g, label) {
  assert.ok(g.coach, `${label}: 教学气泡应有包围盒`);
  assert.ok(g.coach.y >= 0 && g.coach.bottom <= g.vh + 1, `${label}: 气泡应在视口内，实际 ${JSON.stringify(g.coach)}`);
  assert.equal(g.pe, "none", `${label}: 气泡应 pointer-events:none（纯提示不挡点击）`);
  const targets = TARGETS[g.current] || TARGETS.T01;
  for (const sel of targets) {
    const b = g.rects[sel];
    if (!b) continue;
    assert.ok(!intersect(g.coach, b), `${label}: 气泡不得压目标 ${sel}：coach=${JSON.stringify(g.coach)} target=${JSON.stringify(b)}`);
  }
  const primary = PRIMARY[g.current];
  if (primary) assert.equal(g.hits[primary], "self", `${label}: 目标 ${primary} 应可点到，实际命中 ${g.hits[primary]}`);
}

const VPS = [{ w: 1024, h: 600 }, { w: 1280, h: 720 }];
for (const engine of Object.keys(ENGINES)) {
  for (const vp of VPS) {
    test(`${engine} ${vp.w}×${vp.h}: 走完教学，气泡全程不压目标，进普通卡`, async () => {
      const ctx = await browsers[engine].newContext({ viewport: { width: vp.w, height: vp.h } });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);
      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz);
        const tier = await page.evaluate(() => window.__zz.short);
        assert.ok(["A", "B"].includes(tier), `1024×600 = B / 1280×720 = A 应落矮屏档，实际 ${tier}`);

        // T01：左右拖卡选择（真实按 ← 两下提交）
        assert.equal((await snap(page)).current, "T01");
        checkStep(await snap(page), "T01");
        await commit(page, "left");

        // T02：按住预览（真实按 → 两下提交）
        assert.equal((await snap(page)).current, "T02");
        checkStep(await snap(page), "T02");
        await commit(page, "right");

        // T03：刻字（点卡角骨片）
        const t3 = await snap(page);
        assert.equal(t3.current, "T03");
        assert.equal(t3.phase, "engrave");
        checkStep(t3, "T03");
        await page.locator("#bonecorner").click();
        await page.waitForTimeout(300);
        await passCutscene(page);

        // T04：落字（真实按 1）
        const t4 = await snap(page);
        assert.equal(t4.current, "T04");
        checkStep(t4, "T04");
        await page.keyboard.press("1");
        await page.waitForTimeout(300);
        await passCutscene(page);

        // T05：代价取舍
        const t5 = await snap(page);
        assert.equal(t5.current, "T05", `按 1 应落字进 T05，实际 ${t5.current}/${t5.phase}`);
        assert.equal(t5.phase, "card");
        checkStep(t5, "T05");
        await commit(page, "left");

        // 正常play：教学结束，进到普通卡
        const g = await snap(page);
        assert.ok(!["T01", "T02", "T03", "T04", "T05"].includes(g.current), `应进普通卡，实际 ${g.current}`);
        assert.equal(g.phase, "card", "普通卡应处于 card 阶段");

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}
