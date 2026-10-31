// e2e E2 回归：render() 若落在「按下」与「抬起」之间，点击不能被静默吞掉。
//
// 根因（见 ROOTCAUSE_E2.md）：renderWinter / renderEnded / renderElder，以及字匣、卡上落字框、
// 目标小签/面板、菜单、键位浮层、侧栏、卡面图、四维条等每次 render 都重设 innerHTML，即便生成结果
// 没变。若这次重绘恰落在 mousedown 与 mouseup 之间，被点的节点被换掉，浏览器把 click 派发给两目标
// 的最近公共祖先（如 #card / #wordbox 而非按钮），closest('[data-do]') / closest('[data-slot]')
// 找不到按钮，那次点击就丢了。
//
// 复现（任务给出的确定性步骤）：移到按钮中心 → mouse.down → page.evaluate(() => window.__zz.render())
// → mouse.up。修复后生成结果没变就不会换节点，click 正常合成。
//
// 本套件：
//   ① （原 E2）冬夜「天亮了」/「先人」/「交给第 n 代」用「按下→Escape(内部 render)→抬起」复现；
//   ② （全类）三引擎 × 1280×800 鼠标：把整局里所有可点元素都用「按下→render()→抬起」复现一遍，
//      逐项断言状态确实推进；
//   ③ 三引擎 × 1024×600（矮屏 B）：「?」键位浮层的开/关；
//   ④ chromium × 390×844 触屏（CDP touchStart/touchEnd 之间 render()）：字匣落字 / 天亮了 / 先人 / 交棒。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";
import { commit, clearTutorial, playToWinter, passCutscene } from "./helpers/flow.mjs";

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

const phase = (page) => page.evaluate(() => window.__zz.st.phase);
const current = (page) => page.evaluate(() => window.__zz.st.current);
const picksOf = (page) => page.evaluate(() => window.__zz.st.picks || []);
const render = (page) => page.evaluate(() => window.__zz.render());

// 按之前先等卡停稳：切卡/入场时 #card 在飞入或回位，目标按钮跟着移动，按下与抬起会落在
// 不同位置——那是「移动的目标」而不是 E2（重绘换节点）。本套件只验后者，故先把基线静下来。
async function settle(page) {
  await page.waitForFunction(() => {
    const c = document.getElementById("card");
    return !window.__zz.animating && (!c || c.getAnimations().every((a) => a.playState !== "running"));
  }, null, { timeout: 5000 });
}

// 按下 →（触发一次 render）→ 抬起：render 恰好落在 down 与 up 之间（Escape 会调用 render()）。
async function pressWithRenderBetween(page, sel) {
  await settle(page);
  await passCutscene(page);
  const box = await page.locator(sel).first().boundingBox();
  if (!box) throw new Error(`找不到 ${sel}`);
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.keyboard.press("Escape");   // keydown Escape 会调用 render()（见 app.js）
  await page.mouse.up();
}

// 任务给出的确定性复现：按下 → 直接强制 window.__zz.render() → 抬起。
async function pressBetween(page, sel) {
  await settle(page);
  await passCutscene(page);
  const box = await page.locator(sel).first().boundingBox();
  if (!box) throw new Error(`找不到 ${sel}`);
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await render(page);
  await page.mouse.up();
}

async function expectPhase(page, want, detail) {
  try {
    await page.waitForFunction((w) => window.__zz.st.phase === w, want, { timeout: 3000 });
  } catch { /* 由下面的断言给出可读失败信息 */ }
  assert.equal(await phase(page), want, detail);
}
async function expectCurrent(page, want, detail) {
  try {
    await page.waitForFunction((w) => window.__zz.st.current === w, want, { timeout: 3000 });
  } catch { /* 由下面的断言给出可读失败信息 */ }
  assert.equal(await current(page), want, detail);
}
async function expectVisible(page, sel, detail) {
  let ok = false;
  try { await page.locator(sel).first().waitFor({ state: "visible", timeout: 8000 }); ok = true; } catch {}
  assert.ok(ok, `${detail}（${sel} 应可见）`);
}
const winterText = async (page) => (await page.locator("#winter").innerText()).replace(/\s+/g, "");

// ---------- ① 原 E2：冬夜 / 结局 / 先人（Escape 触发 render） ----------

for (const [engine] of Object.entries(ENGINES)) {
  test(`${engine} 1280: render() 落在 down/up 之间也不丢点击`, async () => {
    const ctx = await browsers[engine].newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz);
      await clearTutorial(page);
      await playToWinter(page);
      assert.equal(await phase(page), "winter", "应已到冬夜");

      // ① 「天亮了」：静置等定时器跑完，再在 down 与 up 之间插入一次 render。
      await page.waitForTimeout(2500);
      await pressWithRenderBetween(page, "#winter-end");
      await expectPhase(page, "ended", "按下与抬起之间的 render 不应吞掉「天亮了」点击");
      await expectVisible(page, "#endseq", "天亮了之后应显示 #endseq");

      // ② #endseq 的「先人」：同样静置后插入 render。
      await page.waitForTimeout(2500);
      await pressWithRenderBetween(page, "#endseq [data-do=elder]");
      await expectVisible(page, "#elder", "点先人之后应显示 #elder");

      // ③ #elder 的「交给下一代」：同样插入 render。
      await page.waitForTimeout(2500);
      await pressWithRenderBetween(page, "#elder [data-do=heir]");
      await expectVisible(page, "#pick", "交棒之后应显示 #pick");

      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });
}

// ---------- ② 全类：1280×800 鼠标，整局每个可点元素都复现一遍 ----------

for (const [engine] of Object.entries(ENGINES)) {
  test(`${engine} 1280: 每个可点元素在 down/up 间 render() 都不丢点击`, async () => {
    const ctx = await browsers[engine].newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz);

      // ① T01 左选项键 #opt-left
      await pressBetween(page, "#opt-left");
      await expectCurrent(page, "T02", "「接过骨刀」(#opt-left) 应推进到 T02");

      // ② T02 右选项键 #opt-right → T03（锁拖，一进来就是「刻」）
      await pressBetween(page, "#opt-right");
      await expectPhase(page, "engrave", "#opt-right 应推进到 T03 的「刻」");

      // ③ 卡角「刻」#bonecorner
      const bones0 = await page.evaluate(() => window.__zz.st.bones);
      await pressBetween(page, "#bonecorner");
      await expectCurrent(page, "T04", "点卡角「刻」应推进到 T04");
      assert.equal(await page.evaluate(() => window.__zz.st.bones), bones0 - 1, "刻应扣一片骨片");
      assert.ok((await page.evaluate(() => window.__zz.st.tallies.map((t) => t.target))).includes("休"), "刻应记下一张事签");

      // ④ 字匣落字 #wordbox .slot.ok（T04 的「水」）
      await pressBetween(page, "#wordbox .slot.ok");
      await expectCurrent(page, "T05", "字匣落字应推进到 T05");
      assert.ok(await page.evaluate(() => window.__zz.st.dropped.includes("水")), "应落下「水」");

      // ⑤ 普通牌堆里遇到一张「刻」卡：先不刻 #card-drops [data-do=skip]
      await commit(page, "left");
      let engraveCard = false;
      for (let i = 0; i < 40 && !engraveCard; i++) {
        const ph = await phase(page);
        if (ph === "engrave") { engraveCard = true; break; }
        if (ph !== "card") break;
        await commit(page, "left");
      }
      assert.ok(engraveCard, "普通牌堆里应能遇到一张带迹的「刻」卡");
      await pressBetween(page, "#card-drops [data-do=skip]");
      try { await page.waitForFunction(() => window.__zz.st.phase !== "engrave", null, { timeout: 3000 }); } catch {}
      assert.notEqual(await phase(page), "engrave", "「先不刻」应离开「刻」阶段");

      // ⑥ 打到冬夜
      for (let i = 0; i < 40; i++) {
        const ph = await phase(page);
        if (ph === "winter") break;
        if (ph === "engrave") { await page.keyboard.press("s"); await page.waitForTimeout(260); continue; }
        if (ph !== "card") break;
        await commit(page, "left");
      }
      await expectPhase(page, "winter", "应打到冬夜");

      // ⑦ 冬夜：事签 → 造法输入（用哪套由这一代的事签决定）→ 清空 → 留到明年 → 刻
      await pressBetween(page, "#winter [data-tally]");
      assert.ok(await page.locator("#winter [data-comp],#winter [data-base]").count() > 0, "选事签后应出现造法输入");
      if (await page.locator("#winter [data-comp]").count()) {
        await pressBetween(page, '#winter [data-comp="人"]');
        await pressBetween(page, '#winter [data-comp="木"]');
        assert.ok((await winterText(page)).includes("已选人+木"), "两个部件应记入「已选」");
      }
      if (await page.locator("#winter [data-base]").count()) {
        await pressBetween(page, "#winter [data-base]");
        assert.equal(await page.locator("#winter [data-base].sel").count(), 1, "指事：底字应被选中");
      }
      if (await page.locator("#winter [data-pos]").count()) {
        await pressBetween(page, "#winter [data-pos]");
        assert.equal(await page.locator("#winter [data-pos].sel").count(), 1, "指事：位置应被选中");
      }
      if (await page.locator("#winter [data-do=clear]").count()) {
        await pressBetween(page, "#winter [data-do=clear]");
        assert.ok((await winterText(page)).includes("已选—"), "清空应抹掉已选");
      }
      await pressBetween(page, "#winter [data-do=defer]");
      await page.waitForTimeout(50);
      assert.equal(await page.locator("#winter [data-tally].sel").count(), 0, "「留到明年」应清掉当前选择");

      // 会意：重新选签、选部件、刻对 → 字录多一个「休」
      if (await page.locator("#winter [data-comp]").count()) {
        await pressBetween(page, "#winter [data-tally]");
        await pressBetween(page, '#winter [data-comp="人"]');
        await pressBetween(page, '#winter [data-comp="木"]');
        await pressBetween(page, "#winter [data-do=carve]");
        try { await page.waitForFunction(() => window.__zz.st.zilu.includes("休"), null, { timeout: 3000 }); } catch {}
        assert.ok(await page.evaluate(() => window.__zz.st.zilu.includes("休")), "会意刻对（人+木）应刻成「休」");
      }

      // ⑧ 天亮了 #winter-end
      await pressBetween(page, "#winter-end");
      await expectPhase(page, "ended", "「天亮了」应进入代末");
      await expectVisible(page, "#endseq", "天亮了之后应显示 #endseq");

      // ⑨ 先人 #endseq [data-do=elder]
      await pressBetween(page, "#endseq [data-do=elder]");
      await expectVisible(page, "#elder", "点先人应显示 #elder");

      // ⑩ 交给第 n 代 #elder [data-do=heir]
      await pressBetween(page, "#elder [data-do=heir]");
      await expectPhase(page, "pick", "交棒应进入挑字");

      // ⑪ 挑字：候选 / 格子 / 出发
      await pressBetween(page, "#pick .cand[data-char='水']");
      assert.deepEqual(await picksOf(page), [], "候选第一下只看说明，不应入格");
      await pressBetween(page, "#pick .cand[data-char='水']");
      assert.deepEqual(await picksOf(page), ["水"], "候选第二下应选中「水」");
      await pressBetween(page, "#pick .pickslot[data-char='水']");
      assert.deepEqual(await picksOf(page), [], "点格子应把「水」放回");
      for (const ch of ["水", "休", "木"]) {
        if (!(await picksOf(page)).includes(ch)) {
          await pressBetween(page, `#pick .cand[data-char='${ch}']`);
          await pressBetween(page, `#pick .cand[data-char='${ch}']`);
        }
      }
      assert.equal((await picksOf(page)).length, 3, "应凑够三个字");
      await pressBetween(page, "#pick .go");
      await expectPhase(page, "card", "「出发」应开始下一代");
      assert.equal(await page.evaluate(() => window.__zz.st.generation), 2, "应进入第 2 代");

      // ⑫ 菜单按钮 + 菜单项（静音切换）
      await pressBetween(page, "#menubtn");
      await expectVisible(page, "#menu-pop", "点菜单按钮应展开菜单");
      const muted0 = await page.evaluate(() => window.__zz.isMuted());
      await pressBetween(page, '#menu-pop [data-menu="mute"]');
      assert.notEqual(await page.evaluate(() => window.__zz.isMuted()), muted0, "菜单「静音」应切换一次");

      // ⑬ 目标小签 #goals-slip → 目标清单
      assert.ok(await page.locator("#goals-slip").isVisible(), "第 2 代开局应有目标小签");
      await pressBetween(page, "#goals-slip");
      await expectVisible(page, "#goals-panel", "点目标小签应打开目标清单");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(50);

      // ⑭ 存档弹层按钮：#dlgclose / #dlgcopy / #dlgapply
      await pressBetween(page, "#menubtn");
      await expectVisible(page, "#menu-pop", "点菜单按钮应展开菜单");
      await page.locator('#menu-pop [data-menu="export"]').click();
      await expectVisible(page, "#savedlg", "导出应打开存档弹层");
      const code = await page.locator("#dlgtext").inputValue();
      assert.match(code, /^ZZ1\./, "导出码格式应为 ZZ1.<校验>.<载荷>");
      await pressBetween(page, "#dlgclose");
      await page.locator("#savedlg").waitFor({ state: "hidden", timeout: 2000 });
      await pressBetween(page, "#menubtn");
      await expectVisible(page, "#menu-pop", "点菜单按钮应展开菜单");
      await page.locator('#menu-pop [data-menu="export"]').click();
      await expectVisible(page, "#savedlg", "导出应打开存档弹层");
      await pressBetween(page, "#dlgcopy");
      assert.ok(await page.locator("#savedlg").isVisible(), "复制后存档弹层应仍在");
      await pressBetween(page, "#dlgapply");
      await page.locator("#savedlg").waitFor({ state: "hidden", timeout: 3000 });

      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });
}

// ---------- ③ 矮屏 B：顶栏「?」键位浮层的开/关 ----------

for (const [engine] of Object.entries(ENGINES)) {
  test(`${engine} 1024×600(B): 「?」键位浮层在 down/up 间 render() 仍能开关`, async () => {
    const ctx = await browsers[engine].newContext({ viewport: { width: 1024, height: 600 } });
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);
    try {
      await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz);
      assert.equal(await page.evaluate(() => document.body.dataset.short), "B", "1024×600 应落矮屏 B 档");

      // 先关掉首进自动弹的浮层（Escape → render）。
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.querySelector("#keyhelp-pop").hidden, null, { timeout: 3000 });

      await pressBetween(page, "#keyhelp-btn");
      await page.waitForFunction(() => !document.querySelector("#keyhelp-pop").hidden, null, { timeout: 3000 });
      assert.ok(await page.locator("#keyhelp-pop").isVisible(), "点「?」应打开键位浮层");

      await pressBetween(page, "#keyhelp-btn");
      await page.waitForFunction(() => document.querySelector("#keyhelp-pop").hidden, null, { timeout: 3000 });
      assert.ok(!(await page.locator("#keyhelp-pop").isVisible()), "再点「?」应收起键位浮层");

      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally {
      await ctx.close();
    }
  });
}

// ---------- ④ chromium 触屏（CDP）：touchStart 与 touchEnd 之间 render() ----------

test("chromium 390 touch(CDP): down/up 间 render() 不丢点击（字匣落字/天亮了/先人/交棒）", { skip: !ENGINES.chromium }, async () => {
  const ctx = await browsers.chromium.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  collectErrors(page, errs);
  const cdp = await ctx.newCDPSession(page);
  const touchBetween = async (sel) => {
    await settle(page);
    const box = await page.locator(sel).first().boundingBox();
    if (!box) throw new Error(`找不到 ${sel}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
    await render(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  try {
    await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
    await page.waitForFunction(() => !!window.__zz);
    assert.equal(await page.evaluate(() => document.body.dataset.view), "mobile");

    await commit(page, "left");                 // T01 → T02
    await commit(page, "right");                // T02 → T03（刻）
    assert.equal(await phase(page), "engrave");
    await page.locator("#bonecorner").click();  // 刻 → T04
    await page.waitForTimeout(300);
    await expectCurrent(page, "T04", "刻后应到 T04");

    // 字匣落字（触屏）
    await touchBetween("#wordbox .slot.ok");
    try { await page.waitForFunction(() => window.__zz.st.current === "T05", null, { timeout: 3000 }); } catch {}
    assert.ok(await page.evaluate(() => window.__zz.st.dropped.includes("水")), "触屏落字不应被 render 吞掉");

    // 打到冬夜
    await commit(page, "left");
    for (let i = 0; i < 60; i++) {
      const ph = await phase(page);
      if (ph === "winter") break;
      if (ph === "engrave") { await page.keyboard.press("s"); await page.waitForTimeout(260); continue; }
      if (ph !== "card") break;
      await commit(page, "left");
    }
    await expectPhase(page, "winter", "应打到冬夜");

    // 天亮了
    await touchBetween("#winter-end");
    await expectPhase(page, "ended", "触屏点「天亮了」不应被吞");
    await expectVisible(page, "#endseq", "触屏点天亮了应显示 #endseq");

    // 先人
    await touchBetween("#endseq [data-do=elder]");
    await expectVisible(page, "#elder", "触屏点先人应显示 #elder");

    // 交给下一代
    await touchBetween("#elder [data-do=heir]");
    await expectPhase(page, "pick", "触屏交棒不应被吞");

    assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
  } finally {
    await ctx.close();
  }
});

// ---------- ⑤ 浮层盖在卡上时，点浮层的关闭点击不能被「按坐标起拖」吞掉 ----------
//
// 根因（任务 FIX 1）：全局 pointerdown 用 inCard(clientX,clientY) 判定是否起拖。#drawer-mask /
// #savedlg 背景 / 菜单 / 目标面板这些盖住卡的浮层，点它们（坐标仍落在卡矩形内）会被当成拖卡：
// onDown 里 cardEl().setPointerCapture 把随后的 click 重定向到 #card，浮层自身的关闭永不触发
// （Firefox 390 触屏遮罩中心 6/6 失效）。修法：仅当 e.target.closest("#card") 时才起拖。
//
// 覆盖：390×844 触屏 与 390×844 鼠标，各三引擎。抽屉经 #wb-handle 打开，点遮罩中心（卡正上方）
// 与 (10,10)，各测 plain 与「down/up 之间 render()」；触屏的 down/up 间 render 用 chromium
// CDP（touchStart→render→touchEnd），其余引擎无 CDP，用一次鼠标等价复核。另覆盖其它「点浮层/
// 点外面」关闭的浮层：存档弹层背景、菜单外点、目标面板「点暗处关」。

async function pressAt(page, cdp, how, x, y, between = false) {
  if (how === "mouse") {
    await page.mouse.move(x, y);
    await page.mouse.down();
    if (between) await render(page);
    await page.mouse.up();
  } else if (how === "cdp") {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
    if (between) await render(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else if (how === "tap") {
    if (between) throw new Error("tap 无法在 down/up 间插入 render");
    await page.touchscreen.tap(x, y);
  } else throw new Error("unknown how " + how);
}

const waitHidden = async (page, id) => {
  try { await page.waitForFunction((i) => document.getElementById(i).hidden, id, { timeout: 3000 }); return true; }
  catch { return false; }
};

// 抽屉：每种按法 × 两个点（中心=卡正上方、左上角）都要能关掉。
async function checkDrawerCloses(page, presses) {
  for (const [px, py] of [[195, 422], [10, 10]]) {
    for (const p of presses) {
      await page.evaluate(() => { document.getElementById("drawer").hidden = true; });
      await page.locator("#wb-handle").click();
      await page.waitForFunction(() => !document.getElementById("drawer").hidden, null, { timeout: 3000 });
      await pressAt(page, p.cdp || null, p.how, px, py, !!p.between);
      assert.ok(await waitHidden(page, "drawer"), `抽屉遮罩 (${px},${py}) how=${p.how} between=${!!p.between} 应被关闭`);
    }
  }
}

// 其余「点浮层/点外面」关闭：菜单外点、目标面板暗处、存档弹层背景（e.target === #savedlg）。
async function checkOtherOverlaysClose(page, how, cdp) {
  const press = (x, y) => pressAt(page, cdp || null, how, x, y, false);

  await page.locator("#menubtn").click();
  await page.waitForFunction(() => !document.getElementById("menu-pop").hidden, null, { timeout: 3000 });
  await press(195, 422);                              // 卡上（菜单之外）
  assert.ok(await waitHidden(page, "menu-pop"), "菜单应被「点外面」关闭");
  await settle(page);

  await page.locator("#goals-slip").click();
  await page.waitForFunction(() => !document.getElementById("goals-panel").hidden, null, { timeout: 3000 });
  await page.waitForTimeout(50);                      // closer 在 setTimeout(0) 里挂上
  await press(195, 520);                              // 面板下方，仍在卡上
  assert.ok(await waitHidden(page, "goals-panel"), "目标面板应被「点暗处」关闭");
  await settle(page);

  await page.locator("#menubtn").click();
  await page.waitForFunction(() => !document.getElementById("menu-pop").hidden, null, { timeout: 3000 });
  await page.locator('#menu-pop [data-menu="export"]').click();
  await page.waitForFunction(() => !document.getElementById("savedlg").hidden, null, { timeout: 3000 });
  const bp = await page.evaluate(() => {              // 卡矩形内、只命中 #savedlg 背景的点
    const dl = document.getElementById("savedlg");
    const c = document.getElementById("card").getBoundingClientRect();
    for (let y = Math.round(Math.max(2, c.top + 2)); y < Math.min(innerHeight - 2, c.bottom - 2); y += 5)
      for (let x = Math.round(Math.max(2, c.left + 2)); x < Math.min(innerWidth - 2, c.right - 2); x += 5)
        if (document.elementFromPoint(x, y) === dl) return { x, y };
    return null;
  });
  assert.ok(bp, "应在卡矩形内找到只命中 #savedlg 背景的点");
  await press(bp.x, bp.y);
  assert.ok(await waitHidden(page, "savedlg"), "存档弹层应被「点背景」关闭");
}

for (const engine of Object.keys(ENGINES)) {
  test(`${engine} 390 鼠标：浮层盖住卡时「点浮层/点外面」不被起拖吞掉`, async () => {
    const ctx = await browsers[engine].newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const errs = []; collectErrors(page, errs);
    try {
      await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz);
      await settle(page);
      await checkDrawerCloses(page, [{ how: "mouse" }, { how: "mouse", between: true }]);
      await checkOtherOverlaysClose(page, "mouse", null);
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });
}

for (const engine of Object.keys(ENGINES)) {
  test(`${engine} 390 触屏：浮层盖住卡时「点浮层/点外面」不被起拖吞掉`, async () => {
    const ctx = await browsers[engine].newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await ctx.newPage();
    const errs = []; collectErrors(page, errs);
    const isChromium = engine === "chromium";
    const cdp = isChromium ? await ctx.newCDPSession(page) : null;
    try {
      await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz);
      await settle(page);
      // chromium：真触屏（CDP 可插 render）；其余引擎：合成 tap + 一次鼠标的 down/up 间 render 等价复核。
      const presses = isChromium
        ? [{ how: "cdp", cdp }, { how: "cdp", cdp, between: true }]
        : [{ how: "tap" }, { how: "mouse", between: true }];
      await checkDrawerCloses(page, presses);
      await checkOtherOverlaysClose(page, "tap", null);
      assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
    } finally { await ctx.close(); }
  });
}
