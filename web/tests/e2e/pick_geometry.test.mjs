// e2e 几何回归：电脑端挑字按 design/v4_gamefeel/gf5_pick.html §11「电脑端」的 1280 设计稿摆放。
//
// 坐标帧 = getBoundingClientRect() 原始视口坐标（与 QA logs/pick_geo.log 的 qa/ov.mjs 取法一致）。
// 桌面下 #pick 是 position:fixed;inset:0，故视口坐标 == 相对 #pick 边框盒左上（QA 文档口径）。
// 设计稿是 1280 宽（其 56px 顶栏含在 y=0 起的坐标里）：
//   h2 (96,96)、挑字格行 (96,160)、字池 (96,256) 宽 560、说明卡 (820,160) 宽 360、
//   出发键 (96,640) 宽 320、键位提示 (96,720)。
// ≥1280 时整块水平居中：offset=(vw-1280)/2，x 全体 +offset，y 不变（1440 → +80）。
// 每项 x/y 允许 ±4px。
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

// QA ov.mjs 的取法：getBoundingClientRect() 原始视口坐标，四舍五入到整数 [x,y,w,h]。
const rect = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s); if (!el) return null;
  const b = el.getBoundingClientRect();
  return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)];
}, sel);

// 1280 设计稿目标 [x, y]；1440 时 x 全体 +80。
const TARGETS = {
  h2:    { sel: "#pick h2",           x: 96,  y: 96  },
  slots: { sel: "#pick .pickslots",   x: 96,  y: 160 },
  pool:  { sel: "#pick .pool",        x: 96,  y: 256 },
  desc:  { sel: "#pick-desc",         x: 820, y: 160 },
  go:    { sel: "#pick .go",          x: 96,  y: 640 },
  hint:  { sel: "#pick .season-note", x: 96,  y: 720 },
};
const TOL = 4;

const VIEWPORTS = [
  { name: "1280", width: 1280, height: 800 },
  { name: "1440", width: 1440, height: 900 },
];

for (const [engine] of Object.entries(ENGINES)) {
  for (const vp of VIEWPORTS) {
    test(`${engine} ${vp.name}: 电脑端挑字几何对齐 gf5 §11（±${TOL}px）`, async () => {
      const ctx = await browsers[engine].newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);
      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz);
        await toPickDesktop(page);
        assert.equal(await page.evaluate(() => document.body.dataset.view), "desktop", "应为桌面档");

        const off = Math.max(0, (vp.width - 1280) / 2);
        for (const [key, t] of Object.entries(TARGETS)) {
          const r = await rect(page, t.sel);
          assert.ok(r, `${key}（${t.sel}）应存在`);
          assert.ok(Math.abs(r[0] - (t.x + off)) <= TOL,
            `${key}.x 应 ≈${t.x + off}，得到 ${r[0]}（rect=${JSON.stringify(r)}）`);
          assert.ok(Math.abs(r[1] - t.y) <= TOL,
            `${key}.y 应 ≈${t.y}，得到 ${r[1]}（rect=${JSON.stringify(r)}）`);
        }

        // 设计稿同时规定宽度：字池 560、说明卡 360、出发键 320。
        assert.ok(Math.abs((await rect(page, "#pick .pool"))[2] - 560) <= TOL, "字池网格宽应 ≈560");
        assert.ok(Math.abs((await rect(page, "#pick-desc"))[2] - 360) <= TOL, "说明卡宽应 ≈360");
        assert.ok(Math.abs((await rect(page, "#pick .go"))[2] - 320) <= TOL, "出发键宽应 ≈320");

        // gf5 §11：说明卡必须在字池右侧（不是下方）。
        const pool = await rect(page, "#pick .pool");
        const desc = await rect(page, "#pick-desc");
        assert.ok(desc[0] >= pool[0] + pool[2],
          `说明卡应在字池右侧：desc.x=${desc[0]} pool.right=${pool[0] + pool[2]}`);

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}

// W7 回归（1024 视口溢出）：桌面档下沿 1024–1279 时，整块（含右侧说明卡）必须落在视口内。
// 逐一量 #pick 的每个后代：rect.right ≤ window.innerWidth、rect.left ≥ 0；
// 说明卡（.pickinfo）完整可见（四边都在视口内），且与字池网格不重叠。
const FIT_VIEWPORTS = [
  { name: "1024", width: 1024, height: 768 },
  { name: "1100", width: 1100, height: 800 },
  { name: "1279", width: 1279, height: 800 },
];

for (const [engine] of Object.entries(ENGINES)) {
  for (const vp of FIT_VIEWPORTS) {
    test(`${engine} ${vp.name}: 电脑端挑字整块落在视口内（W7）`, async () => {
      const ctx = await browsers[engine].newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);
      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz);
        await toPickDesktop(page);
        assert.equal(await page.evaluate(() => document.body.dataset.view), "desktop", "应为桌面档");

        // 悬停「木」让说明卡出现后再量。
        await page.locator("#pick .cand[data-char='木']").hover();
        await page.waitForTimeout(60);

        const { iw, ih, boxes } = await page.evaluate(() => ({
          iw: window.innerWidth, ih: window.innerHeight,
          boxes: [...document.querySelectorAll("#pick *")].map((el) => {
            const r = el.getBoundingClientRect();
            return { tag: el.tagName.toLowerCase(), cls: el.className || "", x: r.x, right: r.right };
          }),
        }));

        // 每个后代的左右缘都在视口内。
        for (const b of boxes) {
          assert.ok(b.right <= iw + 0.5, `${b.tag}.${b.cls} 右缘 ${b.right} 应 ≤ 视口宽 ${iw}`);
          assert.ok(b.x >= -0.5, `${b.tag}.${b.cls} 左缘 ${b.x} 应 ≥ 0`);
        }

        // 说明卡完整可见（四边都在视口内）。
        const info = await rect(page, "#pick-desc .pickinfo");
        assert.ok(info, "说明卡应存在");
        assert.ok(info[0] >= 0 && info[0] + info[2] <= iw + 0.5,
          `说明卡应水平完整可见：x=${info[0]} w=${info[2]} iw=${iw}`);
        assert.ok(info[1] >= 0 && info[1] + info[3] <= ih + 0.5,
          `说明卡应竖直完整可见：y=${info[1]} h=${info[3]} ih=${ih}`);

        // 说明卡不与字池网格重叠。
        const pool = await rect(page, "#pick .pool");
        assert.ok(pool, "字池网格应存在");
        const overlap = info[0] < pool[0] + pool[2] && pool[0] < info[0] + info[2] &&
                        info[1] < pool[1] + pool[3] && pool[1] < info[1] + info[3];
        assert.ok(!overlap, `说明卡不应与字池重叠：info=${JSON.stringify(info)} pool=${JSON.stringify(pool)}`);

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}
