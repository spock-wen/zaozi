// e2e 回归 D4（QA 92cf10a）：矮屏 A/B 档顶栏「目标」按钮点击区 ≥44×44。
//
// 根因：`#goals-slip` 矮屏为省高度写成 min-height:32px，实测 81×32，违反 BREAKPOINTS
// 「所有点击目标 ≥44×44」硬规则。修法不改视觉——按钮自身抬到 44 高、透明无边框，
// 可见胶囊改由 `::before` 居中画出（高 32），与原来 81×32 的胶囊逐像素一致。
//
// 覆盖（三引擎 × 1280×720 A / 1024×600 B）：
//   1. 按钮 boundingBox 宽高都 ≥44；
//   2. 44×44 区域内四角 + 中心 elementFromPoint 都命中按钮（扩展区真的可点）；
//   3. 视觉未变：按钮自身透明无边框，胶囊由 ::before 画（32 高、1px 边、10 圆角、上下 6）；
//   4. 在胶囊上方的透明条里真点一下仍能打开目标清单。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";

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

async function open(engine, w, h) {
  const ctx = await browsers[engine].newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const errs = [];
  collectErrors(page, errs);
  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__zz);
  return { ctx, page, errs };
}

const VPS = [
  { tier: "A", w: 1280, h: 720 },
  { tier: "B", w: 1024, h: 600 },
];

for (const engine of Object.keys(ENGINES)) {
  for (const vp of VPS) {
    test(`${engine} ${vp.tier} 档 ${vp.w}×${vp.h}: 「目标」点击区 ≥44×44 且视觉不变`, async () => {
      const { ctx, page, errs } = await open(engine, vp.w, vp.h);
      try {
        assert.equal(await page.evaluate(() => document.body.dataset.view), "desktop");
        assert.equal(await page.evaluate(() => document.body.dataset.short), vp.tier, `${vp.h} 应落 ${vp.tier} 档`);

        const slip = page.locator("#goals-slip");
        assert.ok(await slip.isVisible(), "矮屏「目标」小签应可见");

        // 1. 命中区 ≥44×44（用按钮自身盒）
        const b = await slip.boundingBox();
        assert.ok(b.width >= 44 && b.height >= 44, `「目标」点击区应 ≥44×44，实际 ${b.width}×${b.height}`);
        assert.ok(b.y >= 0 && b.y + b.height <= vp.h + 1, "点击区应在视口内");

        // 2. 44×44 区域四角 + 中心都命中按钮（不是被胶囊/顶栏挡住的假点击区）
        const hits = await page.evaluate(() => {
          const el = document.querySelector("#goals-slip");
          const r = el.getBoundingClientRect();
          const at = (x, y) => {
            const t = document.elementFromPoint(x, y);
            return !!t && (t === el || el.contains(t));
          };
          const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
          return {
            center: at(cx, cy),
            top: at(cx, r.y + 1),
            bottom: at(cx, r.bottom - 1),
            left: at(r.x + 1, cy),
            right: at(r.right - 1, cy),
          };
        });
        assert.deepEqual(hits, { center: true, top: true, bottom: true, left: true, right: true },
          `44×44 区域应整块命中「目标」按钮，实际 ${JSON.stringify(hits)}`);

        // 3. 视觉不变：按钮自身不画背景/边框；胶囊由 ::before 画，与原来 81×32 一致
        const vis = await page.evaluate(() => {
          const el = document.querySelector("#goals-slip");
          const cs = getComputedStyle(el);
          const pb = getComputedStyle(el, "::before");
          const probe = document.createElement("div");
          probe.style.background = "var(--night-700)";
          document.body.appendChild(probe);
          const token = getComputedStyle(probe).backgroundColor;
          probe.remove();
          return {
            elBg: cs.backgroundColor, elBorder: cs.borderTopWidth,
            content: pb.content, pillH: pb.height, pillTop: pb.top, pillBottom: pb.bottom,
            pillBg: pb.backgroundColor, pillBorder: pb.borderTopWidth, pillRadius: pb.borderTopLeftRadius,
            token,
          };
        });
        assert.equal(vis.elBg, "rgba(0, 0, 0, 0)", "按钮自身不应再画胶囊背景");
        assert.equal(vis.elBorder, "0px", "按钮自身不应保留 1px 边框");
        assert.notEqual(vis.content, "none", "应由 ::before 画胶囊");
        assert.ok(Math.abs(parseFloat(vis.pillH) + 2 * parseFloat(vis.pillBorder) - 32) <= 1,
          `胶囊外框高应为 32（视觉不变），实际 ${vis.pillH}+2×${vis.pillBorder}`);
        assert.equal(vis.pillTop, "6px", "胶囊上内缩 6（44−6−6=32）");
        assert.equal(vis.pillBottom, "6px", "胶囊下内缩 6（44−6−6=32）");
        assert.equal(vis.pillBg, vis.token, `胶囊底色应为 --night-700，实际 ${vis.pillBg}`);
        assert.equal(vis.pillBorder, "1px", "胶囊应保留 1px 边框");
        assert.equal(vis.pillRadius, "10px", "胶囊圆角应为 10");

        // 4. 胶囊上方的透明条里真点一下 → 目标清单应打开（证明扩展区可用）
        const before = await page.locator("#goals-panel").isVisible();
        assert.equal(before, false, "点之前清单应关着");
        await page.mouse.click(b.x + b.width / 2, b.y + 2);
        await page.locator("#goals-panel").waitFor({ state: "visible", timeout: 2000 });

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}
