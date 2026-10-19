// e2e：飞出中途重开局/导入，重置方向预览态回归（PR#9 round 8，P2-1）。
//
// 规格与断言：
//   - 桌面 1280x800 键鼠真实输入 (pointer:fine, no touch)。
//   - 在 T01 按 ← 触发预览，再按 ← 确认提交进入飞出。
//   - 飞出进行中通过真实鼠标点击 ☰ 菜单并触发「重新开局」或「导入存档码」（验证重置时刻 __zz.animating 为 true）。
//   - 新局 T01 停稳后：
//       1) #opt-left 必须不含 "on" 类（旧局的 ← 预览不得残留）。
//       2) 按一次 ← 动作数不变（actions.length 保持为 0，只触发预览高亮）。
//       3) 再按一次 ← 才确认提交（actions.length 变为 1）。
//
// 覆盖：重新开局 / 导入 T01 存档码两种重置路径 × 3 浏览器引擎。

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, buildDist, startServer, collectErrors } from "./helpers/env.mjs";

buildDist();

const SEED = 20261016;
const VP_DESK = { width: 1280, height: 800 };

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

async function runScenario(engine, mode) {
  const ctx = await browsers[engine].newContext({
    viewport: VP_DESK,
    hasTouch: false,
  });
  const page = await ctx.newPage();
  const errs = [];
  collectErrors(page, errs);

  const ctr = (s) => page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }, s);

  const still = async () => {
    await page.waitForFunction(() => window.__zz && !__zz.animating && !(__zz.queued > 0), null, { timeout: 9000, polling: 30 }).catch(() => {});
    await page.waitForTimeout(300);
  };

  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__zz && window.__zz.st?.phase === "card");
  await page.waitForTimeout(500);
  await still();

  const code = await page.evaluate(() => __zz.code());
  const menuBtnPos = await ctr("#menubtn");

  let newBtnPos = null;
  let importBtnPos = null;
  let applyBtnPos = null;

  if (mode === "重新开局") {
    await page.mouse.click(menuBtnPos[0], menuBtnPos[1]);
    await page.waitForTimeout(60);
    newBtnPos = await ctr("#menu-pop [data-menu=new]");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
  } else {
    await page.mouse.click(menuBtnPos[0], menuBtnPos[1]);
    await page.waitForTimeout(60);
    importBtnPos = await ctr("#menu-pop [data-menu=import]");
    await page.mouse.click(importBtnPos[0], importBtnPos[1]);
    await page.waitForTimeout(60);
    applyBtnPos = await ctr("#dlgapply");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
  }

  // 挂载重置时机监听，验证重置落在飞出进行中 (__zz.animating 仍为 true)
  await page.evaluate(({ mode, code }) => {
    if (mode === "导入") {
      document.getElementById("dlgtext").value = code;
    }
    window.__midReset = null;
    window.__flyStartT = 0;
    const targetSel = mode === "重新开局" ? "[data-menu=new]" : "#dlgapply";
    document.addEventListener("click", (e) => {
      if (e.target.closest?.(targetSel)) {
        window.__midReset = {
          t: performance.now(),
          animating: window.__zz.animating,
        };
      }
    }, true);
  }, { mode, code });

  // 真实按键：按一次 ← 触发预览
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(80);
  const optLeftPreview = await page.evaluate(() => document.getElementById("opt-left").classList.contains("on"));
  assert.equal(optLeftPreview, true, "初次按 ← 应出现选项预览高亮");

  // 再按一次 ← 确认提交，进入飞出
  await page.keyboard.press("ArrowLeft");
  // 飞出时间 240ms：等待 40ms 进入飞出滑行
  await page.waitForTimeout(40);

  // 飞出中途通过真实鼠标点击打开菜单并触发重置
  if (mode === "重新开局") {
    await page.mouse.click(menuBtnPos[0], menuBtnPos[1]);
    await page.mouse.click(newBtnPos[0], newBtnPos[1]);
  } else {
    await page.mouse.click(menuBtnPos[0], menuBtnPos[1]);
    await page.mouse.click(importBtnPos[0], importBtnPos[1]);
    await page.mouse.click(applyBtnPos[0], applyBtnPos[1]);
  }

  const mid = await page.evaluate(() => window.__midReset);
  assert.ok(mid != null, `${mode}: 真实鼠标点击必须命中重置项并触发事件`);
  assert.equal(mid.animating, true, `${mode}: 重置发生瞬间 __zz.animating 必须仍为 true`);

  // 等待新局 T01 完全落定
  await still();

  // 断言 1：落定后 #opt-left 必须不含 "on" 类
  const leftOnAfterReset = await page.evaluate(() => document.getElementById("opt-left").classList.contains("on"));
  assert.equal(leftOnAfterReset, false, `${mode}: 新局 T01 落定后 #opt-left 绝不能残留 "on" 高亮类`);

  // 断言 2：新局按一次 ← 必须只预览，绝不能直接提交 action
  const actionsBefore = await page.evaluate(() => window.__zz.actions.length);
  assert.equal(actionsBefore, 0, `${mode}: 新局初始行动数必须为 0`);

  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(100);

  const actionsAfterFirstLeft = await page.evaluate(() => window.__zz.actions.length);
  assert.equal(actionsAfterFirstLeft, 0, `${mode}: 新局第一次按 ← 只能预览，不能增加 action`);

  const leftOnAfterFirstLeft = await page.evaluate(() => document.getElementById("opt-left").classList.contains("on"));
  assert.equal(leftOnAfterFirstLeft, true, `${mode}: 新局第一次按 ← 后 #opt-left 应该进入预览高亮`);

  // 断言 3：再按一次 ← 才提交 action 并飞出
  await page.keyboard.press("ArrowLeft");
  await still();

  const actionsAfterSecondLeft = await page.evaluate(() => window.__zz.actions.length);
  assert.equal(actionsAfterSecondLeft, 1, `${mode}: 新局第二次按 ← 必须提交 action`);

  assert.deepEqual(errs, [], "页面不应有未捕获报错：" + errs.join(" | "));
  await ctx.close();
}

for (const [engine] of Object.entries(ENGINES)) {
  test(`${engine} 1280 desktop: 飞出中途重新开局不残留方向预览且新局第一次←只预览`, async () => {
    await runScenario(engine, "重新开局");
  });

  test(`${engine} 1280 desktop: 飞出中途导入存档不残留方向预览且新局第一次←只预览`, async () => {
    await runScenario(engine, "导入");
  });
}
