// e2e 主流程公共动作：键盘提交、打到冬夜、拖卡。给 flow / touch 两个套件复用。
export const phase = (page) => page.evaluate(() => window.__zz.st.phase);
export const current = (page) => page.evaluate(() => window.__zz.st.current);

// T01 飞出后会停在对话卡。已经打开才点「继续」；没开就立刻返回，不把后面的按键拖进过场。
export async function passCutscene(page) {
  const open = await page.evaluate(() => {
    const el = document.getElementById("cutscene");
    return !!el && !el.hidden;
  }).catch(() => false);
  if (!open) return false;
  await page.locator("#cut-continue").click();
  await page.waitForFunction(() => {
    const el = document.getElementById("cutscene");
    return !el || el.hidden;
  }, null, { timeout: 3000 });
  return true;
}

export async function commit(page, dir) {
  const k = dir === "left" ? "ArrowLeft" : "ArrowRight";
  // 先等上一张的飞出动画结束再按（动画中按键会被提交后的状态重置吞掉），再留原有的结算/重绘时间。
  await page.waitForFunction(() => !window.__zz.animating, null, { timeout: 5000 });
  await page.keyboard.press(k);
  await page.keyboard.press(k);
  await page.waitForTimeout(520);
  await passCutscene(page);
}

export async function playToWinter(page) {
  for (let i = 0; i < 80; i++) {
    const ph = await phase(page);
    if (ph === "winter") return;
    if (ph === "engrave") { await page.keyboard.press("s"); await page.waitForTimeout(260); continue; }
    if (ph !== "card") return;
    await commit(page, "left");
  }
}

// 失败现场：点「天亮了」后 #endseq 没出现时，存截图 + 状态（E2 偶发诊断，不重试、不加长等待）。
import fs from "node:fs";
import path from "node:path";
export async function endseqDiag(page, label) {
  const dir = path.resolve("test-results", "endseq-diag");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = `${label}-${Date.now()}`;
  try { await page.screenshot({ path: path.join(dir, stamp + ".png"), fullPage: true }); } catch {}
  let state = {};
  try {
    state = await page.evaluate(() => {
      const z = window.__zz, st = z?.st || {};
      const vis = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { hidden: e.hidden, display: getComputedStyle(e).display, pe: getComputedStyle(e).pointerEvents, r: [r.x, r.y, r.width, r.height].map(Math.round) }; };
      const we = document.querySelector("#winter-end");
      let hit = null;
      if (we) { const r = we.getBoundingClientRect(); const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); hit = t ? (t.closest("#winter-end") ? "self" : t.id || t.className || t.tagName) : "none"; }
      return {
        phase: st.phase, current: st.current, yearsLeft: st.yearsLeft, ending: st.ending, dims: st.dims, generation: st.generation,
        animating: z?.animating, ui: z?.ui ? { bannerOn: z.ui.bannerOn, bannerQueue: z.ui.bannerQueue?.length, elderShown: z.ui.elderShown } : null,
        winterEndHit: hit,
        els: Object.fromEntries(["#winter", "#winter-end", "#endseq", "#elder", "#banner", "#savedlg", "#keyhelp-pop", "#coach", "#too-short"].map((s) => [s, vis(s)])),
        anims: document.getAnimations().filter((a) => a.playState === "running").map((a) => (a.effect?.target?.id || a.effect?.target?.className || "?") + ":" + (a.animationName || a.transitionProperty || a.constructor.name)),
        log: (st.log || []).slice(-8), lastActions: (z?.actions || []).slice?.(-6),
        sw: !!navigator.serviceWorker?.controller, visibility: document.visibilityState,
      };
    });
  } catch (e) { state = { evalError: String(e) }; }
  fs.writeFileSync(path.join(dir, stamp + ".json"), JSON.stringify(state, null, 2));
  return `${path.join(dir, stamp)}.{png,json} ${JSON.stringify(state)}`;
}
async function clickEndAndWait(page, how, label) {
  const errs = [];
  const onErr = (m) => { if (m.type?.() === "error") errs.push(m.text()); };
  const onPage = (e) => errs.push(String(e));
  page.on("console", onErr); page.on("pageerror", onPage);
  try {
    await page.locator("#winter-end")[how]();
    await page.locator("#endseq").waitFor({ state: "visible", timeout: 12000 });
  } catch (e) {
    const d = await endseqDiag(page, label);
    throw new Error(`${e.message}\n[endseq-diag] ${d}\nconsole/page errors: ${JSON.stringify(errs)}`);
  } finally { page.off("console", onErr); page.off("pageerror", onPage); }
}

// 第 1 代教学：T01→T02→T03（锁定，一进来就是刻）→刻→落水→T05→第一张普通卡。
export async function clearTutorial(page) {
  await commit(page, "left");                 // T01 → T02
  await commit(page, "right");                // T02 → T03（engrave）
  await page.locator("#bonecorner").click();  // 刻 → T04
  await page.waitForTimeout(300);
  await page.locator("#wordbox .slot.ok").first().click();  // 落「水」→ T05
  await page.waitForTimeout(300);
  await commit(page, "left");                 // → 第一张普通卡
}

// 从开局一路点到挑字阶段（触控用 tap）：教学 → 冬夜 → 天亮了 → 先人 → 交给第 2 代 → 挑字。
export async function toPick(page) {
  await clearTutorial(page);
  await playToWinter(page);
  await clickEndAndWait(page, "tap", "toPick");
  await page.locator("#endseq [data-do=elder]").tap();
  await page.locator("#elder").waitFor({ state: "visible" });
  await page.locator("#elder [data-do=heir]").tap();
  await page.locator("#pick").waitFor({ state: "visible" });
}

// 桌面/键鼠：从开局点到挑字阶段（pointer/键盘用 click，不用 tap）。
export async function toPickDesktop(page) {
  await clearTutorial(page);
  await playToWinter(page);
  await clickEndAndWait(page, "click", "toPickDesktop");
  await page.locator("#endseq [data-do=elder]").click();
  await page.locator("#elder").waitFor({ state: "visible" });
  await page.locator("#elder [data-do=heir]").click();
  await page.locator("#pick").waitFor({ state: "visible" });
}

export async function dragCard(page) {
  const c = await page.locator("#card").boundingBox();
  const cx = c.x + c.width / 2, cy = c.y + c.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + c.width * 0.5, cy, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(120);
}

// 当前可见文本（[hidden] 走 display:none，innerText 会自动排除）。
export const visibleText = (page) => page.evaluate(() => document.body.innerText);

// 第 2 代存档码：教学 → 冬夜 → 天亮了 → 先人 → 交给第 2 代 → 挑「水/日/人」各两下 → 出发；
// 然后一直 ←←，找到第一张有可落字格（#wordbox .slot.ok）的卡：返回它前一张的码 prevCode 和它自己的码 okCode。
export async function gen2Codes(browser, origin, seed) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  try {
    await page.goto(`${origin}/?seed=${seed}`, { waitUntil: "load" });
    await page.waitForFunction(() => !!window.__zz);
    await clearTutorial(page);
    await playToWinter(page);
    await page.locator("#winter-end").click();
    await page.locator("#endseq").waitFor({ state: "visible", timeout: 15000 });
    await page.locator('#endseq [data-do="elder"]').click();
    await page.locator("#elder").waitFor({ state: "visible" });
    await page.locator('#elder [data-do="heir"]').click();
    await page.locator("#pick").waitFor({ state: "visible" });
    for (const ch of ["水", "日", "人"]) { const c = page.locator(`#pick .cand[data-char="${ch}"]`); await c.click(); await c.click(); }
    await page.locator("#pick .go").click();
    await page.waitForTimeout(2500);
    let prevCode = null;
    for (let i = 0; i < 80; i++) {
      const code = await page.evaluate(() => window.__zz.code());
      if (prevCode && (await page.locator("#wordbox .slot.ok").count()) > 0) return { prevCode, okCode: code };
      prevCode = code;
      await commit(page, "left");
      await page.waitForFunction(() => !window.__zz.animating && (window.__zz.queued ?? 0) === 0, null, { timeout: 5000 });
    }
    throw new Error("没找到带落字位的卡");
  } finally { await ctx.close(); }
}
