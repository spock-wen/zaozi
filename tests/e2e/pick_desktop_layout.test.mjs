// e2e P2-1 回归：电脑端挑字按 gf5 §11 排版——说明卡在网格右侧（不是网格下方），
// 且挑字格里的「1·火」标签不被字形图盖住。1280 / 1440，三引擎，用 bounding box 断言。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";
import { toPickDesktop } from "./helpers/flow.mjs";

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

const VIEWPORTS = [
  { name: "1280", width: 1280, height: 800 },
  { name: "1440", width: 1440, height: 900 },
];

// 页面坐标系里的矩形。
const rect = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s); if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, w: r.width, h: r.height };
}, sel);
const overlaps = (a, b) => a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;

for (const [engine] of Object.entries(ENGINES)) {
  for (const vp of VIEWPORTS) {
    test(`${engine} ${vp.name}: 说明卡在网格右侧 + 挑字格标签不被字形图盖住`, async () => {
      const ctx = await browsers[engine].newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);
      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz);
        await toPickDesktop(page);

        // 悬停「木」让说明卡出现；它必须在字池网格的右侧。
        await page.locator("#pick .cand[data-char='木']").hover();
        await page.waitForTimeout(60);
        const info = await rect(page, "#pick-desc .pickinfo");
        const pool = await rect(page, "#pick .pool");
        assert.ok(info && pool, "说明卡和字池网格都应存在");
        assert.ok(info.x >= pool.right - 1, `说明卡应在网格右侧：info.x=${info.x} pool.right=${pool.right}`);

        // 选「火」进第 1 格（电脑两步：点两下）。
        await page.locator("#pick .cand[data-char='火']").click();
        await page.locator("#pick .cand[data-char='火']").click();
        await page.waitForTimeout(80);
        assert.equal(await page.locator("#pick .pickslot[data-char='火']").count(), 1, "应已把「火」放进第 1 格");

        const glyph = await rect(page, "#pick .pickslot[data-char='火'] img");
        const label = await rect(page, "#pick .pickslot[data-char='火'] span");
        assert.ok(glyph && label, "格子里应有字形图和「1·火」标签");
        assert.equal((await page.locator("#pick .pickslot[data-char='火'] span").textContent()).trim(), "1·火", "标签应为「1·火」");
        assert.ok(!overlaps(glyph, label), `标签不能被字形图盖住：glyph=${JSON.stringify(glyph)} label=${JSON.stringify(label)}`);

        // 标签中心点必须命中标签本身（没被字形图压在下面）。
        const covered = await page.evaluate(() => {
          const s = document.querySelector("#pick .pickslot[data-char='火'] span");
          const r = s.getBoundingClientRect();
          const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return !(el === s || s.contains(el));
        });
        assert.ok(!covered, "标签中心点不应被字形图盖住");

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}
