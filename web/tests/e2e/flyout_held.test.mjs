// e2e: 飞出期间按下并移动、落定时按住不动，仍需带上先前的位移并在落定后跟随手指，松手后提交（P1-1）。
// 3 引擎 × 2 种模式（1280×800 鼠标 + 390×844 触屏）。
// 真实鼠标（page.mouse）；chromium 触屏用 CDP Input.dispatchTouchEvent；firefox/webkit 触屏用合成 PointerEvent。
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
const VP_TOUCH = { width: 390, height: 844 };
const press = async (page, keys) => { for (const k of keys) await page.keyboard.press(k); };

async function setup(engine, opts = {}) {
  const touch = !!opts.touch;
  const ctx = await browsers[engine].newContext({
    viewport: touch ? VP_TOUCH : VP_DESK,
    hasTouch: touch,
    isMobile: touch && engine !== "firefox",
  });
  const page = await ctx.newPage();
  const errs = [];
  collectErrors(page, errs);
  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__zz);
  await clearTutorial(page);
  await page.waitForFunction(() => window.__zz.st.phase === "card" && !window.__zz.animating, null, { timeout: 5000 });
  await settle(page);
  return { ctx, page, errs };
}

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

async function makePointer(page, engine, touch) {
  if (!touch) return {
    down: async (x, y) => { await page.mouse.move(x, y); await page.mouse.down(); },
    move: (x, y) => page.mouse.move(x, y),
    up: () => page.mouse.up(),
  };
  if (engine === "chromium") {
    const cdp = await page.context().newCDPSession(page);
    const pt = (x, y) => [{ x, y, radiusX: 2, radiusY: 2, force: 1, id: 1 }];
    return {
      down: (x, y) => cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(x, y) }),
      move: (x, y) => cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(x, y) }),
      up: () => cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }),
    };
  }
  let last = { x: 0, y: 0 };
  const fire = (type, x, y) => page.evaluate(({ type, x, y }) => {
    const target = type === "pointerdown" ? (document.elementFromPoint(x, y) || document.documentElement) : window;
    target.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, composed: true,
      pointerId: 7, pointerType: "touch", isPrimary: true, button: 0,
      buttons: type === "pointerup" ? 0 : 1, clientX: x, clientY: y,
    }));
  }, { type, x, y });
  return {
    down: (x, y) => { last = { x, y }; return fire("pointerdown", x, y); },
    move: (x, y) => { last = { x, y }; return fire("pointermove", x, y); },
    up: (x, y) => fire("pointerup", x ?? last.x, y ?? last.y),
  };
}

const actionsLen = (page) => page.evaluate(() => window.__zz.actions.length);
const sidesFrom = (page, n0) => page.evaluate((n) => window.__zz.actions.slice(n).map((a) => a.side), n0);
const cardTx = (page) => page.evaluate(() => {
  const card = document.getElementById("card");
  if (!card) return 0;
  const m = /translateX\((-?[\d.]+)px\)/.exec(card.style.transform || "");
  return m ? Number(m[1]) : 0;
});

for (const [engine] of Object.entries(ENGINES)) {
  for (const mode of ["mouse", "touch"]) {
    const touch = mode === "touch";
    const label = touch ? "390 touch" : "1280 mouse";

    test(`${engine} ${label}: 飞出期间滑动0.6卡宽并按住不动，落定后跟手并在松手时提交`, async (t) => {
      const { ctx, page, errs } = await setup(engine, { touch });
      try {
        const n0 = await actionsLen(page);
        const box = await cardBox(page);
        const p = await makePointer(page, engine, touch);

        // 提交卡 A
        await press(page, ["ArrowLeft", "ArrowLeft"]);
        await page.waitForTimeout(40);

        // 飞出期间按下并移动 0.6 卡宽
        await p.down(box.cx, box.cy);
        for (let i = 1; i <= 6; i++) {
          await p.move(box.cx + box.w * 0.1 * i, box.cy);
          await page.waitForTimeout(16);
        }

        // 之后一直按住不动（HOLD STILL）直到落定
        await page.waitForFunction(() => {
          const c = document.getElementById("card");
          return !window.__zz.animating && c.classList.contains("dragging");
        }, null, { timeout: 4000 });

        // 断言：落定起拖后，无需额外移动，卡片即跟随手指呈现位移（transform translateX ≈ displacement）
        const tx = await cardTx(page);
        t.diagnostic(`落定后无位移时的 translateX=${tx} (期望 ≈ ${box.w * 0.6})`);
        assert.ok(
          tx >= box.w * 0.45,
          `落定后卡片应跟随先前移动的位置（实为 ${tx}px，期望 ≥ ${box.w * 0.45}px）`
        );

        // 持续按住超过 settle + 250ms
        await page.waitForTimeout(350);

        // 松手
        await p.up();
        await settle(page);

        // 校验：提交了 2 次，第二张为拖拽方向 (right)
        const total = await actionsLen(page);
        assert.equal(total - n0, 2, `应有两次提交（←← 与按住滑动的松手提交），实为 ${total - n0}`);
        assert.deepEqual(await sidesFrom(page, n0), ["left", "right"], "第二次提交应为向右拖拽的 right");
        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}
