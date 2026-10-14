// W2 回归：教学气泡不能挡住卡角「刻」。
// 缺陷：1024×768 桌面侧栏收起时 #coachcol 按卡右浮（right:60 top:48 宽 320），
// 正好压在卡右上角的 #bonecorner（刻）上，鼠标点不到。修法：桌面上把气泡沉到卡区底部右下。
// 断言：三引擎 × 五个视口，T03 时 #coachcol 与 #bonecorner 的包围盒不相交；
//       并且卡角中心点确实能被点到（elementFromPoint 命中刻字按钮）。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, VIEWPORTS, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";
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

function intersect(a, b) {
  const ix = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const iy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return ix > 0 && iy > 0;
}

for (const engine of Object.keys(ENGINES)) {
  for (const vp of VIEWPORTS) {
    test(`${engine} ${vp.name}: coach bubble does not cover the engrave button at T03`, async () => {
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

        const coach = await page.locator("#coachcol").boundingBox();
        const bone = await page.locator("#bonecorner").boundingBox();
        assert.ok(coach, "#coachcol 应有包围盒");
        assert.ok(bone, "#bonecorner 应有包围盒");
        assert.ok(await page.locator("#bonecorner").isVisible(), "刻字按钮应可见");

        assert.ok(
          !intersect(coach, bone),
          `#coachcol 与 #bonecorner 不能相交：coach=${JSON.stringify(coach)} bone=${JSON.stringify(bone)}`,
        );

        // 卡角中心必须被「刻」按钮接住，而不是被气泡接住
        const hit = await page.evaluate(() => {
          const el = document.querySelector("#bonecorner");
          const r = el.getBoundingClientRect();
          const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return top ? (top.closest("#bonecorner") ? "bonecorner" : top.id || top.className) : "none";
        });
        assert.equal(hit, "bonecorner", `卡角中心应命中 #bonecorner，实际命中：${hit}`);

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}
