// e2e 矮屏边界扫描：1280×720（A）/ 1024×600（B）/ 1366×768（N）× 三引擎，
// 在「卡局」（教学走完、进普通卡）与「挑字页」两个状态各扫一遍：
//   1. 所有可见元素（渲染出来的、有非零盒子）的 getBoundingClientRect 必须落在
//      0..innerWidth / 0..innerHeight（±1px）内；
//   2. document.scrollingElement.scrollHeight ≤ innerHeight（页面整体不滚动）。
// 「可见」判定见 scan()：display:none / visibility:hidden / [hidden]（全局 display:none!important）
// 与「透明且不吃指针」的纯装饰都不算；故意关掉/收起的浮层因此在扫描前就被排除。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";
import { clearTutorial, toPickDesktop } from "./helpers/flow.mjs";

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

async function open(engine, { width, height }) {
  const ctx = await browsers[engine].newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  const errs = [];
  collectErrors(page, errs);
  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__zz);
  await page.waitForFunction(() => !window.__zz.animating, null, { timeout: 5000 });
  return { ctx, page, errs };
}

// 扫描视口内所有可见元素的边界盒，返回越界清单与整页滚动量。
const scan = (page) =>
  page.evaluate(() => {
    const VW = innerWidth, VH = innerHeight, TOL = 1;
    const label = (e) => {
      const cls = e.className && e.className.toString ? e.className.toString().split(/\s+/).filter(Boolean).slice(0, 2).join(".") : "";
      const id = e.id ? "#" + e.id : "";
      return `${e.tagName.toLowerCase()}${id}${cls ? "." + cls : ""}`;
    };
    const bad = [];
    let count = 0;
    for (const el of document.body.querySelectorAll("*")) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;              // 含 [hidden]（全局 display:none!important）
      if (parseFloat(cs.opacity) === 0 && cs.pointerEvents === "none") continue;      // 纯装饰（预览圆点、闲置 toast 等）
      // offsetParent 对 position:fixed 元素恒为 null（本应用整屏浮层 #pick/#elder/#winter/#sidebar-tab 等都是 fixed），
      // 照搬会把它们连子元素一起漏掉，故 fixed/sticky 用「有布局盒」代替。
      if (el.offsetParent === null && cs.position !== "fixed" && cs.position !== "sticky") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      count++;
      if (r.left < -TOL || r.top < -TOL || r.right > VW + TOL || r.bottom > VH + TOL) {
        bad.push({
          el: label(el),
          text: (el.textContent || "").trim().slice(0, 24),
          rect: [r.left, r.top, r.right, r.bottom].map((n) => Math.round(n * 10) / 10),
        });
      }
    }
    const se = document.scrollingElement;
    return {
      view: document.body.dataset.view, short: document.body.dataset.short || "",
      vp: `${VW}×${VH}`, phase: window.__zz.st.phase, count,
      bad, scrollH: se.scrollHeight - innerHeight, scrollW: se.scrollWidth - innerWidth,
    };
  });

const report = (g) => `视口内越界 ${g.bad.length} 处：\n` + g.bad.map((b) => `  ${b.el} [${b.rect.join(",")}] 视口 ${g.vp} text=${JSON.stringify(b.text)}`).join("\n");

const VPS = [{ w: 1280, h: 720, short: "A" }, { w: 1024, h: 600, short: "B" }, { w: 1366, h: 768, short: "" }];

for (const engine of Object.keys(ENGINES)) {
  for (const vp of VPS) {
    test(`${engine} 卡局边界 ${vp.w}×${vp.h}: 可见元素都在视口内 + 页面不滚动`, async () => {
      const { ctx, page, errs } = await open(engine, { width: vp.w, height: vp.h });
      try {
        await clearTutorial(page);                       // 教学走完 → 普通卡
        await page.waitForFunction(() => !window.__zz.animating, null, { timeout: 5000 });
        await page.waitForTimeout(200);
        const g = await scan(page);
        assert.equal(g.view, "desktop", "应在桌面档");
        assert.equal(g.short, vp.short, `矮屏档应为 ${vp.short || "N"}，实际 ${g.short}`);
        assert.equal(g.phase, "card", "应处于普通卡（card）阶段");
        assert.ok(g.count >= 30, `扫描到的可见元素太少（${g.count}），判定可能失效，扫描本身有问题`);
        assert.deepEqual(g.bad, [], report(g));
        assert.ok(g.scrollH <= 1, `页面不应纵向滚动，实际溢出 ${g.scrollH}px（${g.vp}，${report(g)}）`);
        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });

    test(`${engine} 挑字页边界 ${vp.w}×${vp.h}: 可见元素都在视口内 + 页面不滚动`, async () => {
      const { ctx, page, errs } = await open(engine, { width: vp.w, height: vp.h });
      try {
        await toPickDesktop(page);                       // 教学 → 冬夜 → 天亮了 → 先人 → 交给第 2 代 → 挑字
        await page.waitForTimeout(200);
        const g = await scan(page);
        assert.equal(await page.locator("#pick").isVisible(), true, "挑字页应可见");
        assert.ok(g.count >= 30, `扫描到的可见元素太少（${g.count}），判定可能失效，扫描本身有问题`);
        assert.deepEqual(g.bad, [], report(g));
        assert.ok(g.scrollH <= 1, `页面不应纵向滚动，实际溢出 ${g.scrollH}px（${g.vp}，${report(g)}）`);
        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}
