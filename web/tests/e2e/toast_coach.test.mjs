// D1 回归：刻字切卡后，锁拖提示 toast 必须立刻收起，不能盖在下一张卡的 #coach 上。
// 缺陷：T03（刻）按下卡会弹「先点卡角骨片刻下这件事」，只有 1800ms 的 setTimeout 会关掉它；
//       此时点 #bonecorner 刻字切到 T04，toast 无人清理，仍浮在 T04 的教学气泡上（且 .3s 淡出还留着影）。
// 断言：toast 按下后立刻刻字——远早于 1800ms——#toast 已无 .on 且 opacity≈0；#coach 可见且其中心可被点到。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";
import { phase, current, commit } from "./helpers/flow.mjs";

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

// 本用例自己的视口：两个手机（带触控）+ 两个桌面。
const VIEWPORTS = [
  { name: "360x640", width: 360, height: 640, view: "mobile" },
  { name: "390x664", width: 390, height: 664, view: "mobile" },
  { name: "390x844", width: 390, height: 844, view: "mobile" },
  { name: "1280x800", width: 1280, height: 800, view: "desktop" },
  { name: "1280x600", width: 1280, height: 600, view: "desktop" },
];

for (const engine of Object.keys(ENGINES)) {
  for (const vp of VIEWPORTS) {
    test(`${engine} ${vp.name}: 刻字切到 T04 后 toast 立刻收起、不压住 #coach`, async () => {
      const ctx = await browsers[engine].newContext({
        viewport: { width: vp.width, height: vp.height },
        hasTouch: vp.view === "mobile",
      });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);
      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz);

        await commit(page, "left");               // T01 → T02
        await commit(page, "right");              // T02 → T03（锁拖，进刻）
        assert.equal(await current(page), "T03");
        assert.equal(await phase(page), "engrave");

        // 真实「按一下卡」触发锁拖 toast（移动端走触控 tap，桌面端走鼠标）
        const box = await page.locator("#card").boundingBox();
        const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
        const t0 = Date.now();
        if (vp.view === "mobile") {
          await page.touchscreen.tap(cx, cy);
        } else {
          await page.mouse.move(cx, cy);
          await page.mouse.down();
          await page.mouse.up();
        }
        assert.ok(
          await page.locator("#toast").evaluate((e) => e.classList.contains("on")),
          "按下卡后 #toast 应显示（锁拖提示）",
        );

        // 立刻刻字（不做长等待）：切到 T04，toast 必须马上收起（移动端 tap，桌面端 click）
        if (vp.view === "mobile") {
          await page.locator("#bonecorner").tap();
        } else {
          await page.locator("#bonecorner").click();
        }

        await page.waitForFunction(() => window.__zz.st.current !== "T03", null, { timeout: 5000 });
        await page.waitForFunction(() => !window.__zz.animating, null, { timeout: 5000 });
        await page.waitForTimeout(350);           // 卡落定，但远早于 toast 的 1800ms 自动收

        const elapsed = Date.now() - t0;
        assert.ok(elapsed < 1500, `刻字后检查得太晚（${elapsed}ms），测试失去意义`);

        const toast = await page.locator("#toast").evaluate((e) => ({
          on: e.classList.contains("on"),
          opacity: getComputedStyle(e).opacity,
        }));
        assert.equal(toast.on, false, "#toast 不应还带 .on");
        assert.ok(Number(toast.opacity) < 0.05, `#toast 应已隐藏，opacity=${toast.opacity}`);

        const cur = await current(page);
        const coachVisible = await page.locator("#coach").isVisible();
        if (coachVisible) {
          // 临时让 toast 和 #coach 都参与命中测试（两者平时 pointer-events:none），
          // 气泡中心最上面一层必须是 #coach 自己或其后代，不能是 toast。
          const probe = await page.evaluate(() => {
            const coach = document.querySelector("#coach");
            const toastEl = document.querySelector("#toast");
            const r = coach.getBoundingClientRect();
            const cx = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1);
            const cy = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1);
            const style = document.createElement("style");
            style.textContent = "#toast,#toast *{pointer-events:auto !important}#coach,#coach *{pointer-events:auto !important}";
            document.head.appendChild(style);
            const stack = document.elementsFromPoint(cx, cy);
            style.remove();
            const label = (e) => e.id || (typeof e.className === "string" && e.className) || e.tagName;
            const top = stack[0] || null;
            return { topId: top ? label(top) : "none", hitCoach: !!top && !!top.closest("#coach"), toastVis: getComputedStyle(toastEl).visibility };
          });
          assert.equal(probe.toastVis, "hidden", "收起后的 #toast 应 visibility:hidden（不再参与绘制和命中）");
          assert.ok(probe.hitCoach, `#coach 中心应命中气泡自身（toast 也临时参与命中），实际命中：${probe.topId}`);
        }
        assert.ok(coachVisible, `T04 应显示教学气泡 #coach（当前卡 = ${cur}）`);

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}
