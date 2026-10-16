// e2e 回归（工程审核 P2-12）：字匣（#wordbox .slot）里的字形小图不许触发原生拖拽。
//
// 根因：<img> 默认可原生拖拽（draggable 默认 true）。鼠标在字匣小图上按下并移动时，浏览器会
// 启动原生图片拖拽（dragstart），随后发 pointercancel，把页面自己的指针交互打断，还会拖出
// 一张半透明的“图片幽灵”。
// 修法：gimg 渲染的 <img> 加 draggable="false"，CSS 再加 -webkit-user-drag:none; user-select:none。
//
// 本用例：三引擎 × 1280×800。开局字匣第一格是「水」且带字形小图；在其中心 mouse.down 后
// 分 8 步向右 60px、向上 20px，再 mouse.up。全程监听 window 的 dragstart，
// 断言不存在「未被 preventDefault 的 dragstart」（即没有原生拖拽被启动）；
// 行为断言之后再查该 <img> 的 draggable 属性；并断言无页面报错。
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

// 取第一个可见的字匣字形小图（返回其视口矩形），没有则返回 null。
const firstVisibleWordboxImg = () => {
  const imgs = document.querySelectorAll("#wordbox .slot img");
  for (const im of imgs) {
    const r = im.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && getComputedStyle(im).visibility !== "hidden") {
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }
  }
  return null;
};

for (const [engine] of Object.entries(ENGINES)) {
  test(`${engine} 1280 mouse: drag starting on #wordbox glyph <img> must not native-drag`, async () => {
    const ctx = await browsers[engine].newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz);
      await page.evaluate(() => {
        window.__ev = { dragstart: [] };
        window.addEventListener("dragstart", (e) => window.__ev.dragstart.push({ tag: e.target.nodeName, prevented: e.defaultPrevented }));
      });
      // 开局第一格是「水」，字形包加载完成后才会把 <span> 换成字形 <img>。
      const rect = await page
        .waitForFunction(firstVisibleWordboxImg, null, { timeout: 5000 })
        .then((h) => h.jsonValue())
        .catch(() => null);
      assert.ok(rect, "等不到可见的字匣字形小图（#wordbox .slot img）——开局第一格「水」应带字形图");

      const x = rect.x + rect.w / 2, y = rect.y + rect.h / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 60, y - 20, { steps: 8 });
      await page.mouse.up();

      const ev = await page.evaluate(() => window.__ev.dragstart);
      assert.deepEqual(
        ev.filter((e) => e.prevented === false),
        [],
        `字匣字形小图不应启动原生拖拽，实际 dragstart=${JSON.stringify(ev)}`,
      );
      // 行为断言之后再查属性（在旧代码上先由行为断言失败，证明用例抓得到问题本身）
      const draggable = await page.evaluate(() => {
        const imgs = document.querySelectorAll("#wordbox .slot img");
        for (const im of imgs) {
          const b = im.getBoundingClientRect();
          if (b.width > 0 && b.height > 0) return im.getAttribute("draggable");
        }
        return null;
      });
      assert.equal(draggable, "false", "字匣字形小图应 draggable=false");
      assert.deepEqual(errs, []);
    } finally {
      await ctx.close();
    }
  });
}
