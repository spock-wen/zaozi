// e2e：清队后触屏在飞出中点卡片排队与锁定提示回归（P9-1）。
// 复现与规格：
//   1) T01 left, T02 left → T03。
//   2) 触点卡片中心下方 30px 触发拦截提示。
//   3) 按 S，40ms 内按 ←←→→，再触点 #opt-left，此时 queued=4。
//   4) 立即 菜单 →「重新开局」（或 菜单 →「导入」T01 存档码）。
//   5) ~1.8s 后导入 T02 存档码，触点 #opt-left 起飞，50ms 后触点卡片中心。
// 断言：
//   - 点卡后 queued ≥ 1。
//   - 刻字卡 T03 落定后，拦截提示「先点卡角骨片刻下这件事」在独立落定时间 ≥ +245ms 后显形。
// 对照：
//   - [guard] 清队前队列为空。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, buildDist, startServer, collectErrors } from "./helpers/env.mjs";

buildDist();

const SEED = 20261016;
const VP_TOUCH = { width: 375, height: 667 };
const MARGIN = 245;

let server, browsers = {};

before(async () => {
  server = await startServer();
  for (const [name, type] of Object.entries(ENGINES)) {
    browsers[name] = await type.launch();
  }
});

after(async () => {
  for (const b of Object.values(browsers)) await b.close();
  server?.close();
});

async function runScenario(engine, variant) {
  const ctx = await browsers[engine].newContext({
    viewport: VP_TOUCH,
    hasTouch: true,
    isMobile: engine !== "firefox",
    deviceScaleFactor: 3,
  });
  const page = await ctx.newPage();
  const errs = [];
  collectErrors(page, errs);

  const clk = async (x, y) => { await page.touchscreen.tap(x, y); };
  const ctr = (s) => page.evaluate((sel) => {
    const r = document.querySelector(sel).getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }, s);
  const still = async () => {
    await page.waitForFunction(() => !__zz.animating && !(__zz.queued > 0), null, { timeout: 9000, polling: 30 }).catch(() => {});
    await page.waitForTimeout(400);
  };
  const imp = async (c) => {
    await page.evaluate((code) => __zz.importCode(code), c);
    await page.waitForTimeout(300);
    await still();
  };

  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__zz);
  await page.waitForTimeout(900);

  // 1) 记录 T01, T02, T03 存档码
  const codes = {};
  for (let i = 0; i < 3; i++) {
    await still();
    const z = await page.evaluate(() => ({ cur: __zz.st.current, c: __zz.code() }));
    codes[z.cur] = z.c;
    if (z.cur === "T03") break;
    const L = await ctr("#opt-left");
    await clk(L[0], L[1]);
  }
  const c0 = codes.T01;

  if (variant !== "guard") {
    // 2) T03: 触点卡片下方 30px 出拦截提示
    await imp(codes.T03);
    const K = async (k) => { await page.keyboard.press(k); };
    const CC = await ctr("#card");
    await clk(CC[0], CC[1] + 30);
    await page.waitForTimeout(150);

    // 3) 按 S，40ms 内按 ←←→→，再触点 #opt-left，使 queued ≥ 1 (实测 queued=4)
    await K("s");
    await page.waitForTimeout(40);
    await K("ArrowLeft");
    await K("ArrowLeft");
    await K("ArrowRight");
    await K("ArrowRight");
    const O = await ctr("#opt-left");
    await clk(O[0], O[1]);

    const qBefore = await page.evaluate(() => __zz.queued);
    assert.ok(qBefore >= 1, `清队前队列应有排队项 (queued >= 1)，实为 ${qBefore}`);

    // 4) 立即 重新开局 或 导入 T01
    if (variant === "导入T01") {
      await page.evaluate((c) => {
        document.getElementById("menubtn").click();
        document.querySelector("#menu-pop [data-menu=import]")?.click();
        document.getElementById("dlgtext").value = c;
        document.getElementById("dlgapply").click();
      }, c0);
    } else {
      await page.evaluate(() => {
        document.getElementById("menubtn").click();
        document.querySelector("#menu-pop [data-menu=new]")?.click();
      });
    }
  } else {
    // [guard] 对照：队列为空时重新开局
    await imp(codes.T03);
    const qBefore = await page.evaluate(() => __zz.queued);
    assert.equal(qBefore, 0, `对照组清队前队列应为空，实为 ${qBefore}`);
    await page.evaluate(() => {
      document.getElementById("menubtn").click();
      document.querySelector("#menu-pop [data-menu=new]")?.click();
    });
  }

  // 4) 约 1.8s 后继续
  await page.waitForTimeout(1600);
  await still();
  await page.waitForTimeout(200);

  // 5) 导入 T02 存档码，装配独立落定时间与 toast 观察器
  await imp(codes.T02);

  await page.evaluate(() => {
    if (window.__raf) cancelAnimationFrame(window.__raf);
    window.__settles = {};
    window.__toastOns = [];

    const toastEl = document.getElementById("toast");
    if (toastEl) {
      new MutationObserver(() => {
        if (toastEl.classList.contains("on")) {
          window.__toastOns.push({ t: performance.now(), text: toastEl.textContent || "" });
        }
      }).observe(toastEl, { attributes: true, attributeFilter: ["class"] });
    }

    let prevN = window.__zz.actions.length;
    let prevCur = window.__zz.st.current;

    const loop = () => {
      const z = window.__zz;
      const card = document.getElementById("card");
      const n = z ? z.actions.length : 0;
      const cur = z?.st?.current;
      const t = performance.now();

      const noAnim = !z?.animating;
      const noRunningAnim = card ? !card.getAnimations().some((a) => a.playState === "running") : true;
      const noTransform = card ? (card.style.transform === "" || card.style.transform === "none") : true;
      const notDragging = card ? !card.classList.contains("dragging") : true;
      const settled = noAnim && noRunningAnim && noTransform && notDragging;

      const cardKey = cur + "|" + n;
      if (settled && window.__settles[cardKey] == null) {
        window.__settles[cardKey] = t;
        if (window.__settles[cur] == null) window.__settles[cur] = t;
      }

      prevN = n;
      prevCur = cur;
      window.__raf = requestAnimationFrame(loop);
    };
    window.__raf = requestAnimationFrame(loop);
  });

  // 触点 #opt-left 起飞，50ms 后触点卡片中心
  const L = await ctr("#opt-left");
  await clk(L[0], L[1]);
  await page.waitForTimeout(50);
  const C = await ctr("#card");
  await clk(C[0], C[1]);

  // 断言：点卡后入队 (queued >= 1)
  const qAfter = await page.evaluate(() => __zz.queued);
  assert.ok(qAfter >= 1, `点卡后应入队 (queued >= 1)，实为 ${qAfter}`);

  // 等待拦截提示显形
  await page.waitForFunction(() => {
    const t = document.getElementById("toast");
    return t && t.classList.contains("on") && /骨片/.test(t.textContent);
  }, null, { timeout: 4000 });

  // 独立落定计时断言：≥ settle + 245ms
  const timing = await page.evaluate(() => {
    const lockToasts = (window.__toastOns || []).filter((it) => /骨片/.test(it.text));
    return {
      settleT: window.__settles?.T03 ?? window.__settles?.["T03|2"],
      toastT: lockToasts[0]?.t,
      toastText: lockToasts[0]?.text,
    };
  });

  assert.ok(timing.settleT != null, "必须记录到 T03 独立落定时间 (window.__settles)");
  assert.ok(timing.toastT != null, "必须记录到锁定提示显形时刻 (window.__toastOns)");
  assert.match(timing.toastText, /骨片/, "提示文案应包含「骨片」");
  const delta = timing.toastT - timing.settleT;
  assert.ok(
    delta >= MARGIN,
    `锁定提示显形时刻 (${timing.toastT.toFixed(1)}) 应 ≥ 落定+245ms (${(timing.settleT + MARGIN).toFixed(1)})，实际差值为 ${delta.toFixed(1)}ms`
  );

  assert.deepEqual(errs, [], "页面不应有未捕获报错：" + errs.join(" | "));
  await ctx.close();
}

for (const [engine] of Object.entries(ENGINES)) {
  test(`${engine} 375 touch: 清队(重新开局)后飞出中触点卡片正常入队且T03停稳250ms后出拦截提示`, async () => {
    await runScenario(engine, "重新开局");
  });

  test(`${engine} 375 touch: 清队(导入T01)后飞出中触点卡片正常入队且T03停稳250ms后出拦截提示`, async () => {
    await runScenario(engine, "导入T01");
  });

  test(`${engine} 375 touch: [guard] 空队列清队对照组飞出中触点卡片正常入队`, async () => {
    await runScenario(engine, "guard");
  });
}
