// e2e 回归（工程审核 c7fdcfc P1-1′）：从卡外开始的文字选区不得让下一次拖卡失败、粘卡或误提交。
//
// 根因：0f2516b 只让 #card 内不可选，但从卡外开始的选区（卡下提示行划进卡、顶栏拖选进卡、Ctrl+A）
// 仍会把整张卡（含 IMG）包进选区。之后在卡上按下并移动，浏览器当成「拖动选中内容」起原生 dragstart：
// webkit 丢 pointerup，卡粘在鼠标上（.dragging 残留），下一次随便一点就替玩家提交一个选择；
// chromium / firefox 发 pointercancel，那一次拖不动。
// 修法：① #card 上 dragstart 一律 preventDefault；② 鼠标在卡上按下且确实起拖时，先清空现有选区。
// 只在真正起拖时清选区，按钮点击与别处（如致谢页）的文字选择不受影响。
//
// 本用例：三引擎 × 1280×800 / 390×844 鼠标，每个场景用新页面（导入同一存档：过教学后的第一张带图卡）：
//   (a) 从卡下提示行 #gesture-hint 按下，斜划进卡里松手，再从卡面图片向左拖卡；
//   (b) 从顶栏 #gen-line 按下，拖选进卡里松手，再从卡中心向左拖卡；
//   (c) Ctrl+A 全选（Linux/Windows 的全选键；webkit 在 Linux 上 Meta+A 不是全选），再从卡面图片向左拖卡。
// 每个场景断言（拖卡这一下）：无原生 dragstart、无 pointercancel、拖到一半卡跟手、松手恰好提交一次且为「选左」、无 .dragging 残留、无选区残留，
// 之后在卡外空白点一下不多出提交。另：按钮仍能点（#opt-left/#opt-right 各提交一次、菜单能开），
// 致谢页文字仍可选（三击标题、拖选段落、Ctrl+A 全选都有选区）。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";
import { clearTutorial } from "./helpers/flow.mjs";

buildDist();

let server, browsers = {}, CODE;
before(async () => {
  server = await startServer();
  for (const [name, type] of Object.entries(ENGINES)) browsers[name] = await type.launch();
  // 过教学后的存档（第一张普通卡，带卡面图）
  const b = Object.values(browsers)[0];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  await p.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await p.waitForFunction(() => !!window.__zz);
  await clearTutorial(p);
  CODE = await p.evaluate(() => window.__zz.code());
  await ctx.close();
});
after(async () => {
  for (const b of Object.values(browsers)) await b.close();
  server?.close();
});

const nActs = (page) => page.evaluate(() => window.__zz.actions.length);
const lastAct = (page) => page.evaluate(() => window.__zz.actions.at(-1) || null);
const cardDx = (page) => page.evaluate(() => {
  const t = getComputedStyle(document.getElementById("card")).transform;
  return t && t !== "none" ? new DOMMatrix(t).m41 : 0;
});
const rectOf = (page, sel) => page.locator(sel).first().evaluate((el) => {
  const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height };
});

async function openAtCard(engine, vp) {
  const ctx = await browsers[engine].newContext({ viewport: vp, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errs = [];
  collectErrors(page, errs);
  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__zz);
  await page.evaluate((c) => window.__zz.importCode(c), CODE);
  await page.waitForFunction(() => window.__zz.st.phase === "card" && !window.__zz.animating);
  await page.waitForTimeout(600);
  // 记录原生 dragstart（含是否被阻止）与 pointercancel
  await page.evaluate(() => {
    window.__ev = { dragstart: [], cancel: 0 };
    addEventListener("dragstart", (e) => window.__ev.dragstart.push({ tag: e.target.nodeName, prevented: e.defaultPrevented }));
    addEventListener("pointercancel", () => { window.__ev.cancel++; });
  });
  return { ctx, page, errs };
}

async function slide(page, x0, y0, x1, y1, steps = 12) {
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let k = 1; k <= steps; k++) { await page.mouse.move(x0 + (x1 - x0) * k / steps, y0 + (y1 - y0) * k / steps); await page.waitForTimeout(16); }
  await page.mouse.up();
}

// 场景准备完之后：从 from（"image"/"centre"）向左拖卡，断言跟手、提交一次选左、不粘、点空白不多提交。
async function dragLeftAndCheck(page, label, from) {
  await page.waitForTimeout(300);
  const card = await rectOf(page, "#card");
  let x, y;
  if (from === "image") { const r = await rectOf(page, "#card-art img"); x = r.x + r.w / 2; y = r.y + r.h / 2; }
  else { x = card.x + card.w / 2; y = card.y + card.h / 2; }
  const n0 = await nActs(page);
  await page.evaluate(() => { window.__ev.dragstart = []; window.__ev.cancel = 0; });  // 只看拖卡这一下
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let k = 1; k <= 6; k++) { await page.mouse.move(x - card.w * 0.27 * k / 6, y); await page.waitForTimeout(16); }
  const mid = await cardDx(page);
  for (let k = 1; k <= 6; k++) { await page.mouse.move(x - card.w * 0.27 - card.w * 0.28 * k / 6, y); await page.waitForTimeout(16); }
  await page.mouse.up();
  await page.waitForFunction((n) => !window.__zz.animating && window.__zz.actions.length > n, n0, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);
  const stuck = await page.locator("#card").evaluate((el) => el.classList.contains("dragging"));
  const n1 = await nActs(page), last = await lastAct(page);
  const ev = await page.evaluate(() => window.__ev);
  const sel = await page.evaluate(() => { const s = getSelection(); return s && s.rangeCount && !s.isCollapsed ? (String(s).slice(0, 30) || "<非文本选区>") : ""; });
  // 卡外空白点一下（顶栏代数行）：粘卡时这一下会误提交
  await page.locator("#gen-line").click();
  await page.waitForTimeout(600);
  const n2 = await nActs(page);
  assert.deepEqual(ev.dragstart, [], `${label}：拖卡时不应触发原生 dragstart`);
  assert.equal(ev.cancel, 0, `${label}：拖卡时不应有 pointercancel`);
  assert.ok(mid < -20, `${label}：拖到一半卡应跟手（translateX=${mid}）`);
  assert.equal(n1, n0 + 1, `${label}：松手应恰好提交一次（${n0}→${n1}）`);
  assert.equal(last?.side, "left", `${label}：应提交「选左」（实际 ${JSON.stringify(last)}）`);
  assert.ok(!stuck, `${label}：松手后不应残留 .dragging`);
  assert.equal(sel, "", `${label}：拖卡后不应残留选区（${JSON.stringify(sel)}）`);
  assert.equal(n2, n1, `${label}：之后点空白不应多出提交（误提交 ${JSON.stringify(await lastAct(page))}）`);
}

const VPS = [{ width: 1280, height: 800 }, { width: 390, height: 844 }];

for (const [engine] of Object.entries(ENGINES)) {
  for (const vp of VPS) {
    test(`${engine} ${vp.width} (a) select from #gesture-hint into the card, then drag from the image`, async () => {
      const { ctx, page, errs } = await openAtCard(engine, vp);
      try {
        const c = await rectOf(page, "#card"), h = await rectOf(page, "#gesture-hint");
        assert.ok(h.w > 0 && h.h > 0, "提示行应可见");
        await slide(page, c.x + c.w * 0.2, h.y + h.h / 2, c.x + c.w * 0.8, c.y + c.h * 0.45);
        await page.waitForTimeout(500);
        await dragLeftAndCheck(page, "(a) 提示行划进卡后从图片拖", "image");
        assert.deepEqual(errs, []);
      } finally { await ctx.close(); }
    });

    test(`${engine} ${vp.width} (b) select from the top bar into the card, then drag from the centre`, async () => {
      const { ctx, page, errs } = await openAtCard(engine, vp);
      try {
        const c = await rectOf(page, "#card"), g = await rectOf(page, "#gen-line");
        await slide(page, g.x + 2, g.y + g.h / 2, c.x + c.w * 0.6, c.y + c.h * 0.4);
        await page.waitForTimeout(500);
        await dragLeftAndCheck(page, "(b) 顶栏拖选进卡后从中心拖", "centre");
        assert.deepEqual(errs, []);
      } finally { await ctx.close(); }
    });

    test(`${engine} ${vp.width} (c) Ctrl+A, then drag from the image`, async () => {
      const { ctx, page, errs } = await openAtCard(engine, vp);
      try {
        await page.keyboard.press("Control+A");
        await page.waitForTimeout(200);
        assert.ok(await page.evaluate(() => { const s = getSelection(); return !!s && !s.isCollapsed; }), "Ctrl+A 应产生选区（前提）");
        await dragLeftAndCheck(page, "(c) Ctrl+A 后从图片拖", "image");
        assert.deepEqual(errs, []);
      } finally { await ctx.close(); }
    });
  }

  test(`${engine} 1280 buttons still click: #opt-left / #opt-right commit once each, menu opens`, async () => {
    const { ctx, page, errs } = await openAtCard(engine, { width: 1280, height: 800 });
    try {
      for (const side of ["left", "right"]) {
        await page.waitForFunction(() => window.__zz.st.phase === "card" && !window.__zz.animating);
        await page.waitForTimeout(400);
        const n0 = await nActs(page);
        await page.locator(`#opt-${side}`).click();
        await page.waitForFunction((n) => !window.__zz.animating && window.__zz.actions.length > n, n0, { timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(300);
        assert.equal(await nActs(page), n0 + 1, `#opt-${side} 点一次应提交一次`);
        assert.equal((await lastAct(page))?.side, side);
      }
      await page.locator("#menubtn").click();
      await page.waitForTimeout(200);
      assert.ok(await page.locator("#menu-pop").isVisible(), "菜单按钮应能打开菜单");
      assert.deepEqual(errs, []);
    } finally { await ctx.close(); }
  });

  test(`${engine} credits page text is still selectable (triple-click title, drag-select, Ctrl+A)`, async () => {
    const ctx = await browsers[engine].newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    try {
      await page.goto(`${server.origin}/credits`, { waitUntil: "load" });
      const h = page.locator("h1").first();
      await h.click({ clickCount: 3 });
      const s1 = await page.evaluate(() => String(getSelection()).trim());
      assert.ok(s1.length > 0, "三击标题应选中文字");
      await page.evaluate(() => getSelection().removeAllRanges());
      const p = await page.locator("p").first().evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
      await slide(page, p.x + 2, p.y + p.h / 2, p.x + Math.min(p.w, 300) - 2, p.y + p.h / 2, 8);
      const s2 = await page.evaluate(() => String(getSelection()).trim());
      assert.ok(s2.length > 0, "拖选段落应选中文字");
      await page.evaluate(() => getSelection().removeAllRanges());
      await page.mouse.click(5, 5);
      await page.keyboard.press("Control+A");
      const s3 = await page.evaluate(() => String(getSelection()).trim().length);
      assert.ok(s3 > s2.length, `Ctrl+A 应全选致谢页（选中 ${s3} 字）`);
    } finally { await ctx.close(); }
  });
}
