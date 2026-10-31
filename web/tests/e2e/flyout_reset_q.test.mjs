// e2e：新局/读档/导入清空队列（Q3）与刻字阶段锁定提示显形时按 K/S 即时响应（Q9）。
// PM decisions (10/19):
//   Q3=A — new game / load(restore) / import clear the input queue.
//   Q9=A — in the carve (engrave) phase, while the lock hint is showing, K or S still take effect immediately and the hint disappears.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";
import { clearTutorial, passCutscene, releaseBridge } from "./helpers/flow.mjs";

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

// 全新一局：走完教学，停在第一张普通卡并稳住。
async function setup(engine) {
  const ctx = await browsers[engine].newContext({ viewport: VP_DESK });
  const page = await ctx.newPage();
  const errs = [];
  collectErrors(page, errs);
  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__zz);
  await clearTutorial(page);
  await page.waitForFunction(() => window.__zz.st.phase === "card" && !window.__zz.animating, null, { timeout: 5000 });
  await startRecorder(page);
  await settle(page);
  return { ctx, page, errs };
}

// 教学局：停在 T01 并稳住（不走 clearTutorial）。
async function setupTutorial(engine) {
  const ctx = await browsers[engine].newContext({ viewport: VP_DESK });
  const page = await ctx.newPage();
  const errs = [];
  collectErrors(page, errs);
  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__zz);
  await startRecorder(page);
  await settle(page);
  return { ctx, page, errs };
}

async function startRecorder(page) {
  await page.evaluate(() => {
    if (window.__raf) cancelAnimationFrame(window.__raf);
    window.__frames = [];
    const loop = () => {
      const z = window.__zz;
      window.__frames.push({
        t: performance.now(),
        cur: z.st?.current,
        anim: !!z.animating,
        n: z.actions?.length ?? 0,
        queued: z.queued ?? 0,
        onR: !!document.getElementById("opt-right")?.classList.contains("on"),
      });
      window.__raf = requestAnimationFrame(loop);
    };
    window.__raf = requestAnimationFrame(loop);
  });
}

// 稳：动画停、队列空，且连续 400ms 都如此。
async function settle(page) {
  await page.evaluate(() => { window.__settleFrom = 0; });
  await page.waitForFunction(() => {
    const card = document.getElementById("card");
    const busy = window.__zz.animating
      || (card ? card.getAnimations().some((a) => a.playState === "running") : false)
      || (window.__zz.queued ?? 0) !== 0;
    if (busy) { window.__settleFrom = 0; return false; }
    const now = performance.now();
    if (!window.__settleFrom) window.__settleFrom = now;
    return now - window.__settleFrom >= 400;
  }, null, { timeout: 10000, polling: 60 });
}

const cardBox = (page) => page.evaluate(() => {
  const r = document.getElementById("card").getBoundingClientRect();
  return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, w: r.width };
});

for (const [engine] of Object.entries(ENGINES)) {
  test(`${engine} 1280: 飞出期间按→→排队后开新局，新局清空队列停在T01且无动作/预览（Q3a）`, async (t) => {
    const { ctx, page, errs } = await setup(engine);
    try {
      await press(page, ["ArrowLeft", "ArrowLeft"]);                          // 起飞
      await press(page, ["ArrowRight", "ArrowRight"]);                        // 飞出期间排队按键
      const queued = await page.evaluate(() => window.__zz.queued);
      assert.ok(queued > 0, `飞出期间按键应入队（queued > 0），实为 ${queued}`);

      await page.evaluate(() => window.__zz.newGame(window.__zz.seed));
      await page.waitForTimeout(1500);

      const st = await page.evaluate(() => ({
        cur: window.__zz.st.current,
        actionsLen: window.__zz.actions.length,
        queued: window.__zz.queued,
        previewRight: !!document.getElementById("opt-right")?.classList.contains("on"),
      }));

      assert.equal(st.cur, "T01", `新局当前卡应为 T01，实为 ${st.cur}`);
      assert.equal(st.actionsLen, 0, `新局动作数应清零，实为 ${st.actionsLen}`);
      assert.equal(st.queued, 0, `新局队列应清零，实为 ${st.queued}`);
      assert.equal(st.previewRight, false, "新局不应有向右预览残留（#opt-right not .on）");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  test(`${engine} 1280: 飞出期间按→→排队后导入存档，清空队列且动作数不变（Q3b）`, async (t) => {
    const { ctx, page, errs } = await setup(engine);
    try {
      const code = await page.evaluate(() => window.__zz.code());
      const expectedLen = await page.evaluate(() => window.__zz.actions.length);

      await press(page, ["ArrowLeft", "ArrowLeft"]);                          // 起飞
      await press(page, ["ArrowRight", "ArrowRight"]);                        // 飞出期间排队按键
      const queued = await page.evaluate(() => window.__zz.queued);
      assert.ok(queued > 0, `飞出期间按键应入队（queued > 0），实为 ${queued}`);

      await page.evaluate((c) => window.__zz.importCode(c), code);
      await page.waitForTimeout(1500);

      const st = await page.evaluate(() => ({
        actionsLen: window.__zz.actions.length,
        queued: window.__zz.queued,
      }));

      assert.equal(st.actionsLen, expectedLen, `导入后动作数应等于导入时的长度（无排队键生效），实为 ${st.actionsLen}（期望 ${expectedLen}）`);
      assert.equal(st.queued, 0, `导入后队列应清零，实为 ${st.queued}`);
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  test(`${engine} 1280: 飞出期间按→→排队后restore读档，清空队列且动作数不变（Q3c）`, async (t) => {
    const { ctx, page, errs } = await setup(engine);
    try {
      const expectedLen = await page.evaluate(() => window.__zz.actions.length);

      await press(page, ["ArrowLeft", "ArrowLeft"]);                          // 起飞
      await press(page, ["ArrowRight", "ArrowRight"]);                        // 飞出期间排队按键
      const queued = await page.evaluate(() => window.__zz.queued);
      assert.ok(queued > 0, `飞出期间按键应入队（queued > 0），实为 ${queued}`);

      await page.evaluate(() => window.__zz.restore());
      await page.waitForTimeout(1500);

      const st = await page.evaluate(() => ({
        actionsLen: window.__zz.actions.length,
        queued: window.__zz.queued,
      }));

      assert.equal(st.actionsLen, expectedLen, `restore 后动作数应等于保存时的长度（无排队键生效），实为 ${st.actionsLen}（期望 ${expectedLen}）`);
      assert.equal(st.queued, 0, `restore 后队列应清零，实为 ${st.queued}`);
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  test(`${engine} 1280 mouse: 飞出排队进T03弹出锁定提示时按K立刻刻字且提示消失（Q9 K）`, async (t) => {
    const { ctx, page, errs } = await setupTutorial(engine);
    try {
      await press(page, ["ArrowLeft", "ArrowLeft"]);                          // T01 → T02
      await page.waitForFunction(() => window.__zz.st.current === "T02" && !window.__zz.animating, null, { timeout: 3000 });
      await passCutscene(page);
      await settle(page);

      const box = await cardBox(page);
      await press(page, ["ArrowRight", "ArrowRight"]);                        // T02 → T03（起飞进刻字卡）
      await page.waitForTimeout(30);

      await page.mouse.move(box.cx, box.cy);
      await page.mouse.down();
      await page.mouse.move(box.cx + box.w * 0.6, box.cy);                    // 超过阈值，松手入队
      await page.mouse.up();
      await releaseBridge(page);

      await page.waitForFunction(() => {
        const el = document.getElementById("toast");
        return !!el && el.classList.contains("on") && /骨片/.test(el.textContent || "");
      }, null, { timeout: 4000 });

      await page.keyboard.press("K");

      await page.waitForFunction(() => {
        const z = window.__zz;
        const carved = z.st.phase !== "engrave" || z.actions.some((a) => a.type === "engrave");
        const toastHidden = !document.getElementById("toast")?.classList.contains("on");
        return carved && toastHidden;
      }, null, { timeout: 500 });

      const finalSt = await page.evaluate(() => ({
        phase: window.__zz.st.phase,
        toastOn: !!document.getElementById("toast")?.classList.contains("on"),
        hasEngrave: window.__zz.actions.some((a) => a.type === "engrave"),
      }));
      assert.notEqual(finalSt.phase, "engrave", "刻字后 phase 应离开 engrave");
      assert.equal(finalSt.hasEngrave, true, "actions 中应记录 engrave 动作");
      assert.equal(finalSt.toastOn, false, "#toast 应立即隐藏（无 .on）");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });

  test(`${engine} 1280 mouse: 飞出排队进T03弹出锁定提示时按S立刻跳过且提示消失（Q9 S）`, async (t) => {
    const { ctx, page, errs } = await setupTutorial(engine);
    try {
      await press(page, ["ArrowLeft", "ArrowLeft"]);                          // T01 → T02
      await page.waitForFunction(() => window.__zz.st.current === "T02" && !window.__zz.animating, null, { timeout: 3000 });
      await passCutscene(page);
      await settle(page);

      const box = await cardBox(page);
      await press(page, ["ArrowRight", "ArrowRight"]);                        // T02 → T03（起飞进刻字卡）
      await page.waitForTimeout(30);

      await page.mouse.move(box.cx, box.cy);
      await page.mouse.down();
      await page.mouse.move(box.cx + box.w * 0.6, box.cy);                    // 超过阈值，松手入队
      await page.mouse.up();
      await releaseBridge(page);

      await page.waitForFunction(() => {
        const el = document.getElementById("toast");
        return !!el && el.classList.contains("on") && /骨片/.test(el.textContent || "");
      }, null, { timeout: 4000 });

      await page.keyboard.press("S");

      await page.waitForFunction(() => {
        const z = window.__zz;
        const skipped = z.st.phase !== "engrave" || z.actions.some((a) => a.type === "skip_engrave");
        const toastHidden = !document.getElementById("toast")?.classList.contains("on");
        return skipped && toastHidden;
      }, null, { timeout: 500 });

      const finalSt = await page.evaluate(() => ({
        phase: window.__zz.st.phase,
        toastOn: !!document.getElementById("toast")?.classList.contains("on"),
        hasSkip: window.__zz.actions.some((a) => a.type === "skip_engrave"),
      }));
      assert.notEqual(finalSt.phase, "engrave", "跳过后 phase 应离开 engrave");
      assert.equal(finalSt.hasSkip, true, "actions 中应记录 skip_engrave 动作");
      assert.equal(finalSt.toastOn, false, "#toast 应立即隐藏（无 .on）");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });
}
