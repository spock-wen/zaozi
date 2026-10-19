// e2e：M04 / M05 突变守卫测试（round 7 A1）。
// 验证在 newGame / restore 重置游戏后，遇到相同的 settleKey (st.current|actions.length)，
// 排队的输入依然会等下一张卡片真正独立落定后 ≥250ms 才生效，而不是误用上一局遗留的 settledAt。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";
import { clearTutorial } from "./helpers/flow.mjs";

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

const VP_DESK = { width: 1280, height: 800 };
const press = async (page, keys) => { for (const k of keys) await page.keyboard.press(k); };
const cardBox = (page) => page.evaluate(() => {
  const r = document.getElementById("card").getBoundingClientRect();
  return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, w: r.width };
});
const actionsLen = (page) => page.evaluate(() => window.__zz.actions.length);
const framesOf = (page) => page.evaluate(() => window.__frames);

async function setup(engine, opts = {}) {
  const ctx = await browsers[engine].newContext({
    viewport: VP_DESK,
    hasTouch: false,
  });
  const page = await ctx.newPage();
  const errs = [];
  collectErrors(page, errs);
  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__zz);
  if (!opts.keepTutorial) {
    await clearTutorial(page);
    await page.waitForFunction(() => window.__zz.st.phase === "card" && !window.__zz.animating, null, { timeout: 5000 });
  } else {
    await page.waitForFunction(() => !!window.__zz && !window.__zz.animating, null, { timeout: 5000 });
  }
  await startRecorder(page);
  await settle(page);
  return { ctx, page, errs };
}

async function startRecorder(page) {
  await page.evaluate(() => {
    if (window.__raf) cancelAnimationFrame(window.__raf);
    window.__frames = [];
    window.__settles = {};
    window.__indActions = [];
    window.__previews = [];
    let prevN = window.__zz ? window.__zz.actions.length : 0;
    const loop = () => {
      const t = performance.now();
      const z = window.__zz, card = document.getElementById("card");
      const m = /translateX\((-?[\d.]+)px\)/.exec(card ? card.style.transform : "");
      const n = z ? z.actions.length : 0;
      const cur = z?.st?.current;
      const cardKey = cur + "|" + n;

      if (n > prevN) {
        window.__indActions.push({
          t: performance.now(),
          n,
          delta: n - prevN,
          keyBefore: cur + "|" + prevN,
          acts: z.actions.slice(prevN).map((a) => a.side === "drop" ? `drop${a.slot}` : (a.side || a.type)),
        });
        prevN = n;
      }

      const noAnim = !z.animating;
      const noRunningAnim = card ? !card.getAnimations().some((a) => a.playState === "running") : true;
      const noTransform = card ? (card.style.transform === "" || card.style.transform === "none") : true;
      const notDragging = card ? !card.classList.contains("dragging") : true;
      const settled = noAnim && noRunningAnim && noTransform && notDragging;

      if (settled && window.__settles[cardKey] == null) {
        window.__settles[cardKey] = performance.now();
      }

      if (document.getElementById("opt-right")?.classList.contains("on") || document.getElementById("opt-left")?.classList.contains("on")) {
        window.__previews.push({
          t,
          cur: z?.st?.current,
          n,
          right: !!document.getElementById("opt-right")?.classList.contains("on"),
          left: !!document.getElementById("opt-left")?.classList.contains("on"),
        });
      }

      window.__frames.push({
        t: performance.now(),
        cur: z?.st?.current,
        anim: !!z?.animating,
        busy: !!z?.animating || (card ? card.getAnimations().some((a) => a.playState === "running") : false),
        dx: m ? Number(m[1]) : 0,
        dragging: !!(card && card.classList.contains("dragging")),
        n: z ? z.actions.length : 0,
      });
      window.__raf = requestAnimationFrame(loop);
    };
    window.__raf = requestAnimationFrame(loop);
  });
}

async function settle(page) {
  await page.evaluate(() => { window.__settleFrom = 0; });
  await page.waitForFunction(() => {
    const card = document.getElementById("card");
    const busy = window.__zz.animating
      || card.getAnimations().some((a) => a.playState === "running")
      || (window.__zz.queued ?? 0) !== 0;
    if (busy) { window.__settleFrom = 0; return false; }
    const now = performance.now();
    if (!window.__settleFrom) window.__settleFrom = now;
    return now - window.__settleFrom >= 80;
  }, null, { timeout: 10000, polling: 20 });
}

for (const [engine] of Object.entries(ENGINES)) {
  test(`${engine} 1280 mouse: 倾斜状态下按卡片布局宽度（offsetWidth）计算阈值，0.36 提交而 0.34 不提交（P3-4）`, async (t) => {
    const { ctx, page, errs } = await setup(engine);
    try {
      const box = await cardBox(page);
      const layoutW = await page.evaluate(() => document.getElementById("card").offsetWidth);

      const n0 = await actionsLen(page);
      await page.mouse.move(box.cx, box.cy);
      await page.mouse.down();
      await page.mouse.move(box.cx + layoutW * 0.34, box.cy, { steps: 5 });
      await page.mouse.up();
      await settle(page);
      assert.equal(await actionsLen(page) - n0, 0, "0.34 布局宽度未达 0.35 阈值，应弹回不提交");

      await page.mouse.move(box.cx, box.cy);
      await page.mouse.down();
      await page.mouse.move(box.cx + layoutW * 0.36, box.cy, { steps: 5 });
      await page.mouse.up();
      await settle(page);
      assert.equal(await actionsLen(page) - n0, 1, "0.36 布局宽度超过 0.35 阈值，应提交成功");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  test(`${engine} 1280 mouse: 鼠标拖拽在落定后提前松手（<250ms），停在松手处等满250ms才飞出提交（M6 守卫）`, async (t) => {
    const { ctx, page, errs } = await setup(engine);
    try {
      const n0 = await actionsLen(page);
      const box = await cardBox(page);
      await press(page, ["ArrowLeft", "ArrowLeft"]);
      await page.mouse.move(box.cx, box.cy);
      await page.mouse.down();
      await page.waitForFunction(() => {
        const c = document.getElementById("card");
        return !window.__zz.animating && c.classList.contains("dragging");
      }, null, { timeout: 3000 });
      for (let i = 1; i <= 4; i++) { await page.mouse.move(box.cx + box.w * 0.15 * i, box.cy); await page.waitForTimeout(15); }
      await page.mouse.up();
      await settle(page);

      assert.equal(await actionsLen(page) - n0, 2, "起飞 + 拖拽应提交两次");
      const frames = await framesOf(page);
      const lastDrag = frames.map((f) => f.dragging).lastIndexOf(true);
      const release = lastDrag + 1;
      const relDx = frames[release].dx;
      let fCommit = -1;
      for (let i = release + 1; i < frames.length; i++) if (Math.abs(frames[i].dx - relDx) > 5) { fCommit = i; break; }
      assert.ok(fCommit > 0, "应记录到提交飞出的开始帧");
      const commitT = frames[fCommit].t;

      const targetCard = frames[lastDrag].cur;
      const targetKey = `${targetCard}|${n0 + 1}`;
      const indSettle = await page.evaluate((k) => window.__settles[k], targetKey);
      assert.ok(indSettle > 0, `目标卡 ${targetKey} 必须记录有独立落定时刻`);
      const delta = Math.round(commitT - indSettle);
      t.diagnostic(`commitT=${Math.round(commitT)} indSettle=${Math.round(indSettle)} delta=${delta}ms`);
      assert.ok(commitT >= indSettle + 245, `commit time 必须在独立落定时刻 + 250ms 之后生效：实测差值 ${delta}ms`);
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  test(`${engine} 1280 mouse: newGame后遇到相同settleKey，排队输入仍等满独立落定≥250ms才生效（M04）`, async (t) => {
    const { ctx, page, errs } = await setup(engine, { keepTutorial: true });
    try {
      // 1. 在 T01 上起飞进入 T02，排队一个预览，使 T02|1 经历落定并把 settleKey 记为 T02|1
      await press(page, ["ArrowLeft", "ArrowLeft"]);
      await page.waitForTimeout(30);
      await press(page, ["ArrowRight"]);
      await page.waitForFunction(() => document.getElementById("opt-right")?.classList.contains("on"), null, { timeout: 3000 });
      const targetKey = "T02|1";
      await page.waitForTimeout(500);

      // 2. 调用 newGame 重置回开局 T01
      await page.evaluate((s) => window.__zz.newGame(s), SEED);
      await settle(page);
      await startRecorder(page);

      // 3. 再次在 T01 上起飞进入 T02，飞出期间排队同一个预览键
      await press(page, ["ArrowLeft", "ArrowLeft"]);
      await page.waitForTimeout(30);
      await press(page, ["ArrowRight"]);

      await page.waitForFunction(() => document.getElementById("opt-right")?.classList.contains("on"), null, { timeout: 3000 });
      const indSettle = await page.evaluate((k) => window.__settles[k], targetKey);
      assert.ok(indSettle > 0, `重开局后卡片 ${targetKey} 必须记录有独立落定时刻`);
      const prevT = await page.evaluate(() => window.__previews.find((p) => p.cur === "T02" && p.right)?.t || window.__previews.find((p) => p.cur === "T02")?.t);
      assert.ok(prevT > 0, "必须记录到右侧选项预览高亮的时刻");
      const delta = Math.round(prevT - indSettle);
      t.diagnostic(`newGame相同key: indSettle=${Math.round(indSettle)} prevT=${Math.round(prevT)} delta=${delta}ms`);
      assert.ok(
        delta >= 245,
        `newGame后复现相同settleKey时，排队预览必须在独立落定 ≥250ms 后执行（实测 ${delta}ms）`
      );
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  test(`${engine} 1280 mouse: restore后遇到相同settleKey，排队输入仍等满独立落定≥250ms才生效（M05）`, async (t) => {
    const { ctx, page, errs } = await setup(engine, { keepTutorial: true });
    try {
      await page.evaluate((s) => window.__zz.newGame(s), SEED);
      await settle(page);
      const saveSnap = await page.evaluate(() => localStorage.getItem("zaozi.save.year1"));

      // 1. 在 T01 上起飞进入 T02，排队一个预览，使 T02|1 经历落定并把 settleKey 记为 T02|1
      await press(page, ["ArrowLeft", "ArrowLeft"]);
      await page.waitForTimeout(30);
      await press(page, ["ArrowRight"]);
      await page.waitForFunction(() => document.getElementById("opt-right")?.classList.contains("on"), null, { timeout: 3000 });
      const targetKey = "T02|1";
      await page.waitForTimeout(500);

      // 2. 调用 restore 重置回开局 T01
      await page.evaluate((snap) => {
        localStorage.setItem("zaozi.save.year1", snap);
        return window.__zz.restore();
      }, saveSnap);
      await settle(page);
      await startRecorder(page);

      // 3. 再次在 T01 上起飞进入 T02，飞出期间排队同一个预览键
      await press(page, ["ArrowLeft", "ArrowLeft"]);
      await page.waitForTimeout(30);
      await press(page, ["ArrowRight"]);

      await page.waitForFunction(() => document.getElementById("opt-right")?.classList.contains("on"), null, { timeout: 3000 });
      const indSettle = await page.evaluate((k) => window.__settles[k], targetKey);
      assert.ok(indSettle > 0, `restore后卡片 ${targetKey} 必须记录有独立落定时刻`);
      const prevT = await page.evaluate(() => window.__previews.find((p) => p.cur === "T02" && p.right)?.t || window.__previews.find((p) => p.cur === "T02")?.t);
      assert.ok(prevT > 0, "必须记录到右侧选项预览高亮的时刻");
      const delta = Math.round(prevT - indSettle);
      t.diagnostic(`restore相同key: indSettle=${Math.round(indSettle)} prevT=${Math.round(prevT)} delta=${delta}ms`);
      assert.ok(
        delta >= 245,
        `restore后复现相同settleKey时，排队预览必须在独立落定 ≥250ms 后执行（实测 ${delta}ms）`
      );
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });
}
