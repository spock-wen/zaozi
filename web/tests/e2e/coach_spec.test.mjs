// 桌面教学气泡摆位规格回归（设计师 bug）。
// 缺陷（29933da / bee8865）：桌面常规档（非矮屏）#coachcol 由 CSS 钉在舞台右下
// （right:16;bottom:8;width:320），1440×900 左缘压住卡 1px、1024×768 只离卡 5px。
// 规格（所有桌面尺寸同一条规则，不按视口微调）：
//   1) 气泡左缘 = 卡（#card）右缘 + 24；
//   2) 气泡右缘 ≤ 侧栏左缘 − 16（侧栏收起/没有时 ≤ 视口右缘 − 16）；
//   3) 气泡宽 ≤ 320（放不下就收宽，文字仍 ≥14px、不裁切）；
//   4) 气泡底缘 = 卡底 − 8（±1）；
//   5) 不压 #bonecorner / 左右选项 / #keys / 顶栏 / 字匣 / 四维行。
// 实现：app.js placeCoach() 按 #cardwrap（卡槽，不受 transform 影响）的视口矩形算，
// 桌面 N/A/B 三档都走它（原来只有矮屏档走，常规档交给 CSS 钉右下）。
// 断言：三引擎 × 1024×768 / 1280×720 / 1440×900 / 1920×1080，走完 T01→T05，
// 每一步都量上述四个数并打印。
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

// 桌面视口清单：两个常规档（N）、一个矮屏档（A = 1280×720）、一个大屏。
const VPS = [
  { name: "1024x768", width: 1024, height: 768 },
  { name: "1280x720", width: 1280, height: 720 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1920x1080", width: 1920, height: 1080 },
];
// 每一步教学目标所在的框：气泡都不许压（卡本体每步都算）。
const NO_COVER = ["#bonecorner", "#opt-left", "#opt-right", "#keys", "#topbar", "#wordbox-bar", "#dims-desktop"];

// 等卡入场过渡跑完、气泡落稳（提交后有 floats 清空重绘会把气泡挪到最终位），
// 否则读到的是被 transform 挪动中的卡/气泡。
async function settle(page) {
  await page.waitForFunction(() => !window.__zz.animating, null, { timeout: 5000 });
  await page.evaluate(() => Promise.allSettled(document.querySelector("#card").getAnimations().map((a) => a.finished)));
  await page.waitForFunction(() => {
    const card = document.querySelector("#card");
    return !window.__zz.animating && !card.getAnimations().some((a) => a.playState === "running");
  }, null, { timeout: 5000 });
  await page.evaluate(async () => {
    const rect = () => { const r = document.querySelector("#coach").getBoundingClientRect(); return [r.left, r.top, r.width, r.height].join(","); };
    let last = null, since = performance.now();
    const t0 = performance.now();
    while (performance.now() - t0 < 6000) {
      await new Promise((res) => setTimeout(res, 100));
      const cur = rect();
      if (cur !== last) { last = cur; since = performance.now(); }
      else if (performance.now() - since >= 500) return;
    }
  });
}

// 几何快照：气泡 / 卡 / 侧栏的视口矩形 + 气泡字号与是否横向溢出。
const geom = (page) =>
  page.evaluate(() => {
    const R = (s) => {
      const e = document.querySelector(s);
      if (!e || e.hidden || getComputedStyle(e).display === "none") return null;
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
    };
    const coach = document.querySelector("#coach"), col = document.querySelector("#coachcol");
    const cs = getComputedStyle(coach);
    return {
      current: window.__zz.st.current, phase: window.__zz.st.phase, vw: innerWidth,
      coach: R("#coach"), col: R("#coachcol"), card: R("#card"), sidebar: R("#sidebar"),
      coachVisible: !coach.hidden && cs.visibility !== "hidden" && R("#coach").w > 0,
      fontSize: parseFloat(cs.fontSize), overflowX: coach.scrollWidth - coach.clientWidth,
      rects: Object.fromEntries(["#bonecorner", "#opt-left", "#opt-right", "#keys", "#topbar", "#wordbox-bar", "#dims-desktop"].map((s) => [s, R(s)])),
    };
  });

function checkSpec(g, label) {
  assert.ok(g.coachVisible, `${label}: 教学气泡应可见`);
  assert.ok(g.coach && g.card, `${label}: 气泡与卡都应有包围盒`);
  const gap = g.coach.x - g.card.right;                    // 1) 气泡左缘 − 卡右缘 = 24
  const bar = g.sidebar;
  const limit = bar && bar.w > 0 ? bar.x : g.vw;            // 2) 侧栏开着按侧栏左缘，收起按视口右缘
  const side = limit - g.coach.right;                       //    气泡右缘到该缘的距离
  const width = g.coach.w;                                  // 3) 气泡宽 ≤ 320
  const botDiff = g.card.bottom - g.coach.bottom;           // 4) 卡底 − 气泡底 = 8（气泡底 = 卡底 − 8）
  console.log(`[coach_spec] ${label}: 气泡左缘−卡右缘=${gap.toFixed(2)}  气泡右缘→${bar && bar.w > 0 ? "侧栏左缘" : "视口右缘"}=${side.toFixed(2)}  气泡宽=${width.toFixed(2)}  卡底−气泡底=${botDiff.toFixed(2)}`);
  assert.ok(Math.abs(gap - 24) <= 1, `${label}: 气泡左缘应 = 卡右缘 + 24（±1），实际 ${gap.toFixed(2)}`);
  assert.ok(side >= 16 - 1, `${label}: 气泡右缘应距侧栏/视口右缘 ≥16px，实际 ${side.toFixed(2)}`);
  assert.ok(width <= 320.5, `${label}: 气泡宽应 ≤320，实际 ${width.toFixed(2)}`);
  assert.ok(Math.abs(botDiff - 8) <= 1, `${label}: 气泡底应 = 卡底 − 8（±1），实际 卡底=${g.card.bottom.toFixed(2)} 气泡底=${g.coach.bottom.toFixed(2)} 差=${botDiff.toFixed(2)}`);
  assert.ok(g.fontSize >= 14, `${label}: 气泡字号应 ≥14px，实际 ${g.fontSize}px`);
  assert.ok(g.overflowX <= 1, `${label}: 气泡不应横向溢出/裁切，实际溢出 ${g.overflowX}px`);
  for (const sel of NO_COVER) {                            // 5) 不压卡角/选项/键位/顶栏/字匣/四维行
    const r = g.rects[sel];
    if (!r) continue;
    const ix = Math.min(g.coach.right, r.right) - Math.max(g.coach.x, r.x);
    const iy = Math.min(g.coach.bottom, r.bottom) - Math.max(g.coach.y, r.y);
    assert.ok(!(ix > 0 && iy > 0), `${label}: 气泡不得压住 ${sel}：coach=${JSON.stringify(g.coach)} target=${JSON.stringify(r)}`);
  }
}

for (const engine of Object.keys(ENGINES)) {
  for (const vp of VPS) {
    test(`${engine} ${vp.name}: 教学气泡贴卡右缘 +24、距侧栏 ≥16、宽 ≤320、底 = 卡底 − 8（T01→T05）`, async () => {
      const ctx = await browsers[engine].newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);
      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz);
        await settle(page);
        const g = await geom(page);
        assert.equal(g.current, "T01", `应停在教学第一步 T01，实际 ${g.current}/${g.phase}`);
        assert.equal(await page.evaluate(() => document.body.dataset.view), "desktop", `${vp.name} 应落桌面档`);
        checkSpec(g, `${engine} ${vp.name} T01`);

        await commit(page, "left");                          // T01 → T02
        await settle(page);
        const g2 = await geom(page);
        assert.equal(g2.current, "T02", `应进 T02，实际 ${g2.current}/${g2.phase}`);
        checkSpec(g2, `${engine} ${vp.name} T02`);

        await commit(page, "right");                         // T02 → T03（刻）
        await settle(page);
        const g3 = await geom(page);
        assert.equal(g3.current, "T03", `应进 T03，实际 ${g3.current}/${g3.phase}`);
        assert.equal(g3.phase, "engrave", "T03 应处于刻字阶段");
        checkSpec(g3, `${engine} ${vp.name} T03`);

        await page.locator("#bonecorner").click();           // T03 → T04（落字）
        await page.waitForTimeout(300);
        await settle(page);
        const g4 = await geom(page);
        assert.equal(g4.current, "T04", `应进 T04，实际 ${g4.current}/${g4.phase}`);
        checkSpec(g4, `${engine} ${vp.name} T04`);

        await page.keyboard.press("1");                      // T04 → T05（取舍）
        await page.waitForTimeout(300);
        await settle(page);
        const g5 = await geom(page);
        assert.equal(g5.current, "T05", `应进 T05，实际 ${g5.current}/${g5.phase}`);
        checkSpec(g5, `${engine} ${vp.name} T05`);

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}
