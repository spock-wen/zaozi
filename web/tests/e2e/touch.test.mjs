// e2e 触控回归：390 手机用 hasTouch + tap()（真 touch 事件），并在 1024 桌面视口复验。
// 覆盖 QA D1/D2/D4：
//   D1 tap「天亮了」不能穿透点到新翻出的「先人 / 交给第 2 代」，代末总结必须先出；
//   D2 目标弹层一次点击不秒关；静音每次点击只切一次（390 与 1024）；导出弹层在 1024 能开；
//   D4 拖锁定的第 3 张卡出专属提示「先点卡角骨片刻下这件事」，且 toast 不遮字匣；
//   挑字界面只出 14 字切片、以现代字呈现、季节标签非空；全 UI 可见文本不含「占位」。
// 三引擎各跑一遍。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";
import { phase, clearTutorial, playToWinter, dragCard, visibleText, toPick } from "./helpers/flow.mjs";

buildDist();

const SLICE = ["水", "日", "人", "木", "田", "火", "力", "月", "休", "林", "从", "男", "明", "本"];

let server, browsers = {};
before(async () => {
  server = await startServer();
  for (const [name, type] of Object.entries(ENGINES)) browsers[name] = await type.launch();
});
after(async () => {
  for (const b of Object.values(browsers)) await b.close();
  server?.close();
});

// 手机 390：hasTouch 真触控。
function touchCtx(engine, vp = { width: 390, height: 844 }) {
  return browsers[engine].newContext({ viewport: vp, hasTouch: true });
}

for (const [engine] of Object.entries(ENGINES)) {
  test(`${engine} 390 touch: D1 天亮了 doesn't click through + goals popup + pick pool + no 占位`, async () => {
    const ctx = await touchCtx(engine);
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz);
      assert.equal(await page.evaluate(() => document.body.dataset.view), "mobile");

      // 全 UI 可见文本不含占位文案
      assert.ok(!(await visibleText(page)).includes("占位"), "UI 不应出现「占位」");

      // D2：目标弹层一次 tap 打开后不能秒关；点外面才收起
      const slip = page.locator("#goals-slip");
      assert.ok(await slip.isVisible(), "手机开头目标小签应可见");
      await slip.tap();
      await page.locator("#goals-panel").waitFor({ state: "visible", timeout: 2000 });
      await page.waitForTimeout(500);
      assert.ok(await page.locator("#goals-panel").isVisible(), "目标弹层一次点击后不能立刻收起");
      await page.locator("#gen-line").tap();
      await page.waitForTimeout(120);
      assert.ok(!(await page.locator("#goals-panel").isVisible()), "点外面应收起目标弹层");

      // 打到冬夜（教学 + 普通卡）
      await clearTutorial(page);
      await playToWinter(page);
      assert.equal(await phase(page), "winter");

      // D1：tap「天亮了」不能穿透到新翻出的「先人 / 交给第 2 代」
      await page.locator("#winter-end").tap();
      await page.waitForTimeout(80);
      assert.equal(await phase(page), "ended", "点天亮了应进入代末");
      assert.ok(!(await page.locator("#elder").isVisible()), "不应立刻跳进先人（穿透）");
      await page.locator("#endseq").waitFor({ state: "visible", timeout: 12000 });
      assert.ok((await page.locator("#endseq h1").textContent()).trim().length > 0, "代末总结应先显示");

      // 先人 → 交给第 2 代 → 挑字
      await page.locator("#endseq [data-do=elder]").tap();
      await page.locator("#elder").waitFor({ state: "visible" });
      await page.locator("#elder [data-do=heir]").tap();
      await page.locator("#pick").waitFor({ state: "visible" });

      // 挑字：只出 14 字切片、以现代字呈现、季节标签非空
      const cands = await page.$$eval("#pick .cand", (els) => els.map((e) => e.dataset.char));
      assert.deepEqual([...cands].sort(), [...SLICE].sort(), "挑字候选应恰为 14 字切片");
      for (const ch of SLICE) {
        assert.ok((await page.locator(`#pick .cand[data-char="${ch}"]`).innerText()).includes(ch), `候选 ${ch} 应显示现代字`);
      }
      assert.ok((await page.locator("#season-chip").textContent()).trim().length > 0, "挑字阶段季节标签应非空");

      // gf5：手机挑字用点选引导（点一下看说明、再点一次带上），出发键文案为 gf5 两态之一
      const pickHint = (await page.locator("#pick .season-note").textContent()).trim();
      assert.ok(pickHint.includes("再点一次带上"), `手机挑字提示应为点选引导，得到：${pickHint}`);
      const goLabel = (await page.locator("#pick .go").textContent()).trim();
      assert.ok(["还差字", "带这三个字出发"].includes(goLabel), `出发键文案应为 gf5 两态之一，得到：${goLabel}`);
      assert.ok(!(await visibleText(page)).includes("占位"), "挑字界面不应出现「占位」");

      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });

  test(`${engine} 390 touch: gf5 两步挑字（tap1 看说明 / tap2 选中 / tap3 放回）`, async () => {
    const ctx = await touchCtx(engine);
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz);
      await toPick(page);
      const picks = () => page.evaluate(() => window.__zz.st.picks);

      // ① tap1：只出说明卡（只画有数据的行；「水」无部件数据 → 无说明行、无「？」占位），不填格、不选中。
      await page.locator("#pick .cand[data-char='水']").tap();
      await page.waitForTimeout(80);
      assert.deepEqual(await picks(), [], "tap1 不应填格");
      assert.ok(await page.locator("#pick-desc .pickinfo").isVisible(), "tap1 应出说明卡");
      assert.equal(await page.locator("#pick-desc .pi-row").count(), 0, "水 没有部件数据，说明卡不应有说明行");
      assert.ok(!(await page.locator("#pick-desc").innerText()).includes("？"), "说明卡不应出现「？」占位");
      assert.equal(await page.locator("#pick .pickslot[data-char]").count(), 0, "tap1 不应填格");
      assert.equal(await page.locator("#pick .cand.sel").count(), 0, "tap1 不应选中");

      // ② tap2：同一字再点一次 → 朱底 + 序号角标 + 填第 1 格。
      await page.locator("#pick .cand[data-char='水']").tap();
      await page.waitForTimeout(80);
      assert.deepEqual(await picks(), ["水"], "tap2 应选中");
      assert.equal(await page.locator("#pick .cand.sel[data-char='水'] .badge").textContent(), "1", "选中字应带顺序角标 1");
      assert.equal(await page.locator("#pick .pickslot").first().getAttribute("data-char"), "水", "tap2 应填第 1 格");

      // ③ tap3：点已选字 → 放回（格子清空、角标消失）。
      await page.locator("#pick .cand.sel[data-char='水']").tap();
      await page.waitForTimeout(80);
      assert.deepEqual(await picks(), [], "tap3 应放回");
      assert.equal(await page.locator("#pick .cand.sel").count(), 0, "放回后不应有已选字");
      assert.equal(await page.locator("#pick .pickslot[data-char]").count(), 0, "放回后格子应空");

      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });

  test(`${engine} 390 touch: D4 locked card drag shows hint, toast clear of 字匣`, async () => {
    const ctx = await touchCtx(engine);
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz);
      // T01 → T02 → T03（锁定，一进来就是刻）
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("ArrowLeft");
      await page.waitForTimeout(520);
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(520);
      assert.equal(await phase(page), "engrave", "第 3 张应停在刻阶段");

      // D4：拖动锁定的卡出专属提示
      await dragCard(page);
      const toastTxt = await page.locator("#toast").textContent();
      assert.ok(toastTxt.includes("先点卡角骨片刻下这件事"), `锁卡提示应含专属文案，得到：${toastTxt}`);
      const toast = await page.locator("#toast").boundingBox();
      const wb = await page.locator("#wordbox-bar").boundingBox();
      assert.ok(toast.y + toast.height <= wb.y + 2, "toast 不能盖住字匣");

      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });

  test(`${engine} 390 touch: mute toggles exactly once per tap`, async () => {
    const ctx = await touchCtx(engine);
    const page = await ctx.newPage();
    try {
      await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz);
      await page.locator("#menubtn").tap();
      await page.locator("#menu-pop").waitFor({ state: "visible" });
      const m0 = await page.evaluate(() => window.__zz.isMuted());
      await page.locator("#menu-pop [data-menu='mute']").tap();
      const m1 = await page.evaluate(() => window.__zz.isMuted());
      assert.notEqual(m1, m0, "静音必须切换且只切一次（双触发会切回原状）");
      assert.equal(await page.evaluate(() => localStorage.getItem("zaozi.mute")), m1 ? "1" : "0");
      // 再点一次回到原状
      await page.locator("#menubtn").tap();
      await page.locator("#menu-pop").waitFor({ state: "visible" });
      await page.locator("#menu-pop [data-menu='mute']").tap();
      assert.equal(await page.evaluate(() => window.__zz.isMuted()), m0, "第二次点应回到原状");
    } finally {
      await ctx.close();
    }
  });

  test(`${engine} 1024 touch: mute once + export dialog opens`, async () => {
    const ctx = await touchCtx(engine, { width: 1024, height: 768 });
    const page = await ctx.newPage();
    try {
      await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz);
      assert.equal(await page.evaluate(() => document.body.dataset.view), "desktop");
      await page.locator("#menubtn").tap();
      await page.locator("#menu-pop").waitFor({ state: "visible" });
      const m0 = await page.evaluate(() => window.__zz.isMuted());
      await page.locator("#menu-pop [data-menu='mute']").tap();
      assert.notEqual(await page.evaluate(() => window.__zz.isMuted()), m0, "1024 静音应只切一次");
      // 导出弹层在 1024 能开
      await page.locator("#menubtn").tap();
      await page.locator("#menu-pop").waitFor({ state: "visible" });
      await page.locator("#menu-pop [data-menu='export']").tap();
      await page.locator("#savedlg").waitFor({ state: "visible", timeout: 3000 });
      assert.match(await page.locator("#dlgtext").inputValue(), /^ZZ1\./, "导出码格式应为 ZZ1.<校验>.<载荷>");
      await page.locator("#dlgclose").tap();
      await page.locator("#savedlg").waitFor({ state: "hidden" });
    } finally {
      await ctx.close();
    }
  });
}
