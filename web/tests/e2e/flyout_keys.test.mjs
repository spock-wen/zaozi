// e2e：卡飞出（fly-out）期间按下的方向键该怎么算。
//
// 键盘模型（phase "card"，桌面）：第一下 ←/→ 只是预览（对应 #opt-left / #opt-right 获得 class "on"），
// 同向再按一下才提交——卡飞出约 240ms，期间 window.__zz.animating 为 true，落定后 window.__zz.actions
// 里压入一条 {type:"choose", side}，st.current 翻到下一张卡。
//
// 缺陷：web/app.js 的 keydown 里，phase "card" 的方向键分支没有像 onDown 那样判断 ui.animating，
// 飞出期间按键照单全收；而提交时把 ui.kbDir 设成的方向要等 dispatch()（飞出结束）才清零，
// 于是飞出期间：
//   - 再按同向 ←/← 会在旧方向未清零时再次 commitSide → 多出一次提交（←←← 变成两次 left）；
//   - 按反向 → 只是改了 ui.kbDir，随即被飞出结束的 dispatch 清零 → 预览被吞掉、下一张上没有预览。
//
// 期望行为（本用例所编码的）：飞出期间按下的每一个键，都要「当作玩家在下一张卡刚出现时按下」，
// 按顺序、恰好一次地作用到依次出现的卡上。所以飞出期间单按一个 ←/→ 只会在下一张上预览，绝不提交；
// 而 ←← →→ 这样的连按，前面的 → 先预览下一张，接下来的 → 才在下一张上提交，两次飞出不得重叠。
//
// 三引擎 × 1280×800；第 4 例用 reducedMotion:"reduce"（减弱动画）。
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

const VP = { width: 1280, height: 800 };

async function setup(engine, opts = {}) {
  const ctx = await browsers[engine].newContext({ viewport: VP, reducedMotion: opts.reducedMotion });
  const page = await ctx.newPage();
  const errs = [];
  collectErrors(page, errs);
  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__zz);
  await clearTutorial(page);
  await page.waitForFunction(() => window.__zz.st.phase === "card" && !window.__zz.animating, null, { timeout: 5000 });
  await page.waitForTimeout(300);
  return { ctx, page, errs };
}

async function press(page, keys) {
  for (const k of keys) await page.keyboard.press(k);
}

async function settle(page) {
  await page.evaluate(() => { window.__settleFrom = 0; });
  await page.waitForFunction(() => {
    if (window.__zz.animating) { window.__settleFrom = 0; return false; }
    const now = performance.now();
    if (!window.__settleFrom) window.__settleFrom = now;
    return now - window.__settleFrom >= 400;
  }, null, { timeout: 5000, polling: 60 });
}

const actionsLen = (page) => page.evaluate(() => window.__zz.actions.length);
const currentCard = (page) => page.evaluate(() => window.__zz.st.current);
const sidesFrom = (page, n0) => page.evaluate((n) => window.__zz.actions.slice(n).map((a) => a.side), n0);
const optOn = (page, id) => page.evaluate((i) => document.getElementById(i).classList.contains("on"), id);

for (const [engine] of Object.entries(ENGINES)) {
  test(`${engine} 1280: 飞出期间按 → 只预览下一张，再按 → 才提交`, async () => {
    const { ctx, page, errs } = await setup(engine);
    try {
      const n0 = await actionsLen(page);
      await press(page, ["ArrowLeft", "ArrowLeft", "ArrowRight"]);
      await settle(page);
      assert.deepEqual(
        await sidesFrom(page, n0),
        ["left"],
        "飞出期间按的 → 应落到下一张上、且不能提交：这一段只该有一次 left 提交",
      );
      assert.equal(await optOn(page, "opt-right"), true, "飞出期间的 → 应预览下一张的右侧（#opt-right 带 on）");
      assert.equal(await optOn(page, "opt-left"), false, "预览已切到右侧，下一张的 #opt-left 不应再带 on");

      await press(page, ["ArrowRight"]);
      await settle(page);
      assert.deepEqual(
        await sidesFrom(page, n0),
        ["left", "right"],
        "下一张上再按一次 →，把它的右侧预览落实为第二次提交",
      );

      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });

  test(`${engine} 1280: 飞出期间按 ← 只预览下一张，不提交`, async () => {
    const { ctx, page, errs } = await setup(engine);
    try {
      const n0 = await actionsLen(page);
      await press(page, ["ArrowLeft", "ArrowLeft", "ArrowLeft"]);
      await settle(page);
      assert.deepEqual(
        await sidesFrom(page, n0),
        ["left"],
        "飞出期间按的 ← 只能预览下一张，绝不能再提交：←←← 应只留下一次 left 提交",
      );
      assert.equal(await optOn(page, "opt-left"), true, "飞出期间的 ← 应让下一张的 #opt-left 带 on");

      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });

  test(`${engine} 1280: 飞出期间按 →→ 依次落在下一张，两次提交不重叠`, async () => {
    const { ctx, page, errs } = await setup(engine);
    try {
      const n0 = await actionsLen(page);
      const c0 = await currentCard(page);
      await page.evaluate(() => {
        const z = window.__zz;
        const r = (window.__rec = { commits: [], cur: z.st.current, len: z.actions.length });
        const loop = () => {
          const zz = window.__zz;
          const n = zz.actions.length, cur = zz.st.current;
          if (n !== r.len) { r.commits.push({ before: r.cur, after: cur, t: performance.now() }); r.len = n; }
          r.cur = cur;
          r.raf = requestAnimationFrame(loop);
        };
        r.raf = requestAnimationFrame(loop);
      });

      await press(page, ["ArrowLeft", "ArrowLeft", "ArrowRight", "ArrowRight"]);
      await settle(page);

      const rec = await page.evaluate(() => ({ commits: window.__rec.commits }));
      assert.deepEqual(
        await sidesFrom(page, n0),
        ["left", "right"],
        "两次 → 应依次落实为 left、right 两次提交（先预览下一张，再在下一张提交）",
      );
      assert.equal(rec.commits.length, 2, "应恰好记录到两次提交，实为 " + JSON.stringify(rec.commits));
      assert.equal(
        rec.commits[0].after,
        rec.commits[1].before,
        "第二次提交必须发生在第一次提交刚翻出的那张卡上（commit1.after === commit2.before）：" + JSON.stringify(rec.commits),
      );
      const ids = [c0, rec.commits[0].after, rec.commits[1].after];
      assert.equal(new Set(ids).size, 3, "卡应依次翻到三张互不相同的卡，实为 " + ids.join(" -> "));
      const gap = rec.commits[1].t - rec.commits[0].t;
      assert.ok(gap >= 200, `第二张必须在第一次飞出落定后才开始飞出（一次飞出约 240ms），两次提交只隔了 ${Math.round(gap)}ms`);

      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });

  test(`${engine} 1280: 飞出期间轻点 Space 不留下按住状态`, async () => {
    const { ctx, page, errs } = await setup(engine);
    try {
      const n0 = await actionsLen(page);
      await press(page, ["ArrowLeft", "ArrowLeft", "Space"]);
      await settle(page);
      assert.deepEqual(await sidesFrom(page, n0), ["left"], "←← 只提交一次");
      assert.equal(await optOn(page, "opt-left"), false, "Space 已松开，下一张不应停在按住预览（#opt-left 不带 on）");
      assert.equal(await optOn(page, "opt-right"), false, "下一张不应有任何预览（#opt-right 不带 on）");
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });

  test(`${engine} 1280 reduce: 飞出期间按 ← 只预览下一张，不提交`, async () => {
    const { ctx, page, errs } = await setup(engine, { reducedMotion: "reduce" });
    try {
      const n0 = await actionsLen(page);
      await press(page, ["ArrowLeft", "ArrowLeft", "ArrowLeft"]);
      await settle(page);
      assert.deepEqual(
        await sidesFrom(page, n0),
        ["left"],
        "减弱动画下，飞出期间按的 ← 也只能预览下一张、不能再提交：←←← 应只留下一次 left 提交",
      );
      assert.equal(await optOn(page, "opt-left"), true, "减弱动画下，飞出期间的 ← 应让下一张的 #opt-left 带 on");

      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });
}
