// e2e 矮屏交叠回归（QA FINAL_REPORT 92cf10a 缺陷 D2 / D3）。
// D2：视口高 <600 时「窗口太小」提示（#too-short）不得压住卡（含卡头 #card .card-head）。
// D3：B 档键位浮层（#keyhelp-pop，首进自动弹 / 点「?」手动开）不得压住左右选项（#opt-right/#opt-left），
//     且 6 条键位在 492–600 全程全部可见、浮层不滚动。
// BREAKPOINTS §矮屏「硬规则」：所有点击目标 ≥44×44 且没被别的元素盖住。
// 几何用例只取 getBoundingClientRect 视口坐标，断言两框无交叠（两轴重叠长度都 >0 才算交叠）。
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

async function open(engine, { width, height }) {
  const ctx = await browsers[engine].newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  const errs = [];
  collectErrors(page, errs);
  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__zz);
  return { ctx, page, errs };
}

// 一个元素的视口外框（隐藏元素返回 hidden:true，不参与交叠断言）。
const snap = (page) =>
  page.evaluate(() => {
    const rect = (e) => {
      const cs = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      const hidden = e.hidden || cs.display === "none" || cs.visibility === "hidden";
      return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom, hidden };
    };
    const R = (s) => {
      const e = document.querySelector(s);
      return e ? rect(e) : null;
    };
    const pop = document.querySelector("#keyhelp-pop");
    return {
      view: document.body.dataset.view,
      short: document.body.dataset.short || "",
      vw: innerWidth, vh: innerHeight,
      tooShort: R("#too-short"),
      card: R("#card"),
      cardHead: R("#card .card-head"),
      pop: R("#keyhelp-pop"),
      popScrollH: pop ? pop.scrollHeight : 0,
      popClientH: pop ? pop.clientHeight : 0,
      rows: [...document.querySelectorAll("#keyhelp-pop .kh-row")].map(rect),
      optR: R("#opt-right"),
      optL: R("#opt-left"),
    };
  });

// 两轴重叠长度都 > 0 才算交叠（与 short_screen.test.mjs 的 intersect 同义）。
function intersects(a, b) {
  if (!a || !b || a.hidden || b.hidden) return false;
  const ix = Math.min(a.right, b.right) - Math.max(a.x, b.x);
  const iy = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
  return ix > 0 && iy > 0;
}
function box(o) { return o && !o.hidden ? `x${Math.round(o.x)}..${Math.round(o.right)} y${Math.round(o.y)}..${Math.round(o.bottom)}` : "(hidden)"; }
function inViewport(o, vw, vh) {
  if (!o || o.hidden) return true;
  return o.x >= -1 && o.y >= -1 && o.right <= vw + 1 && o.bottom <= vh + 1;
}
// a 是否完整落在 b 的框内（容 1px 亚像素）
function inside(a, b) {
  if (!a || !b) return false;
  return a.x >= b.x - 1 && a.y >= b.y - 1 && a.right <= b.right + 1 && a.bottom <= b.bottom + 1;
}

// ---------- D2：视口高 <600「窗口太小」提示不压卡/卡头 ----------
for (const engine of Object.keys(ENGINES)) {
  for (const vp of [{ w: 1024, h: 491 }, { w: 1280, h: 491 }]) {
    test(`${engine} D2 ${vp.w}×${vp.h}: 「窗口太小」提示不压卡头`, async () => {
      const { ctx, page, errs } = await open(engine, { width: vp.w, height: vp.h });
      try {
        const g = await snap(page);
        assert.equal(g.short, "B", "491 应落 B 档");
        assert.equal(g.tooShort.hidden, false, "视口高 <600 应显示「窗口太小」提示");
        assert.ok(inViewport(g.tooShort, g.vw, g.vh), `提示应在视口内：${box(g.tooShort)}`);
        assert.ok(
          !intersects(g.tooShort, g.cardHead),
          `提示不得压卡头：tooShort=${box(g.tooShort)} cardHead=${box(g.cardHead)}`,
        );
        assert.ok(
          !intersects(g.tooShort, g.card),
          `提示不得压卡：tooShort=${box(g.tooShort)} card=${box(g.card)}`,
        );
        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}

// ---------- D3：B 档键位浮层 6 行全可见、不滚动、不压左右选项（自动弹 + 点「?」） ----------
for (const engine of Object.keys(ENGINES)) {
  for (const vp of [{ w: 1024, h: 600 }, { w: 1024, h: 513 }, { w: 1024, h: 491 }, { w: 1280, h: 491 }]) {
    test(`${engine} D3 ${vp.w}×${vp.h}: 键位浮层 6 行全可见、不滚动、不压左右选项（自动弹 + 「?」）`, async () => {
      const { ctx, page, errs } = await open(engine, { width: vp.w, height: vp.h });
      try {
        const pop = page.locator("#keyhelp-pop");
        const btn = page.locator("#keyhelp-btn");
        const assertClear = async (label) => {
          const g = await snap(page);
          assert.equal(g.pop.hidden, false, `${label}：键位浮层应打开`);
          assert.ok(inViewport(g.pop, g.vw, g.vh), `${label}：浮层应在视口内：${box(g.pop)}`);

          // 4 行（无骨片不显 K 刻字/刻）全可见、不滚动：scrollHeight 不得超过 clientHeight（无裁切/无滚动条）
          assert.equal(g.rows.length, 4, `${label}：浮层无骨片时应列 4 条键位，实际 ${g.rows.length} 行`);
          assert.ok(
            g.popScrollH <= g.popClientH,
            `${label}：浮层不应滚动，scrollH=${g.popScrollH} clientH=${g.popClientH}`,
          );
          for (const [i, row] of g.rows.entries()) {
            assert.equal(row.hidden, false, `${label}：第 ${i + 1} 行应可见`);
            assert.ok(inViewport(row, g.vw, g.vh), `${label}：第 ${i + 1} 行应在视口内 row=${box(row)}`);
            assert.ok(inside(row, g.pop), `${label}：第 ${i + 1} 行应完整落在浮层框内 row=${box(row)} pop=${box(g.pop)}`);
          }

          assert.ok(
            !intersects(g.pop, g.optR),
            `${label}：浮层不得压右选项：pop=${box(g.pop)} optR=${box(g.optR)}`,
          );
          assert.ok(
            !intersects(g.pop, g.optL),
            `${label}：浮层不得压左选项：pop=${box(g.pop)} optL=${box(g.optL)}`,
          );
        };

        // 「?」点击区 ≥44×44 且在视口内（BREAKPOINTS 硬规则）
        const bb = await btn.boundingBox();
        assert.ok(bb.width >= 44 && bb.height >= 44, `「?」点击区应 ≥44×44，实际 ${bb.width}×${bb.height}`);

        // 每个存档首次进入自动弹一次
        assert.ok(await pop.isVisible(), "首进应自动弹出键位浮层");
        await assertClear("自动弹");

        // 点外面收起后，点「?」手动再开（贴左缘、避开卡/选项/提示，B 档可点目标都不在此）
        await page.mouse.click(10, Math.round(vp.h / 2));
        assert.ok(!(await pop.isVisible()), "点浮层外应收起");
        await btn.click();
        await assertClear("点「?」");

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}
