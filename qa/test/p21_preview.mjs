// R号: R10（飞出途中重置不得带入旧局 ← 预览）— A-R7 P2-1
// P2-1 复测：飞出中途 重新开局/导入/读档 后，旧局 ← 预览（kbDir / 选项高亮）不得带入新局。
// node p21_preview.mjs <engine> <WxH> <input:kbd|mouse|touch> <baseURL> <outdir> [reps=2]
// 序列（seed 20261016）：T01 真实输入点 #opt-left 进 T02（产生存档）；在 T02 上：
//   kbd   = 按 ← 预览，再按 ← 提交 → 飞出；
//   mouse = 按 ← 预览，鼠标点 #opt-left 提交 → 飞出（kbDir 仍为 left）；
//   touch = 按 ← 预览，触点 #opt-left 提交 → 飞出（移动仿真 + 真触屏）。
// 飞出中途重置：重新开局 = 真实点击/触点 ☰ → 「重新开局」；导入 = ☰ → 「导入存档码」→（码已预填 T01 码）点「导入」；
//   读档 = 页内 __zz.restore()（restore() 代码路径，不手动 render；UI 上读档是整页重载）。重置那一下页内捕获阶段记录 __zz.animating。
// 新局停稳后断言：①#opt-left/#opt-right 无 .on；②按一次 ← 动作数不变且 #opt-left 出 .on（只预览）；③再按 ← 动作数 +1。
// 重置时 animating=false 的轮次判无效重试（最多 4 次）。每步全屏截图。
import { chromium, firefox, webkit } from "playwright"; import fs from "node:fs";
const [engine, VP, INP, BASE, OUT, REPS] = process.argv.slice(2); const reps = /^\d+$/.test(REPS || "") ? +REPS : 2;
const [W, H] = VP.split("x").map(Number); const cfg = `${engine}_${VP}_${INP}`; fs.mkdirSync(`${OUT}/shots/${cfg}`, { recursive: true });
const touch = INP === "touch"; const opt = { viewport: { width: W, height: H }, hasTouch: touch };
if (touch) Object.assign(opt, engine === "firefox" ? { deviceScaleFactor: 3 } : { isMobile: true, deviceScaleFactor: 3 });
const B = await { chromium, firefox, webkit }[engine].launch(); const res = []; let seq = 0;
const hard = setTimeout(() => { fs.writeFileSync(`${OUT}/p21_${cfg}.json`, JSON.stringify({ timeout: true, res }, null, 1)); process.exit(3); }, 560000);
for (const path of ["重新开局", "导入", "读档"]) for (let k = 0; k < reps; k++) {
  let r = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const ctx = await B.newContext(opt); const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message.slice(0, 120)));
    const shot = async (n) => { const f = `shots/${cfg}/${String(++seq).padStart(3, "0")}_${path}_${k}_a${attempt}_${n}.png`; await p.screenshot({ path: `${OUT}/${f}`, fullPage: true }).catch(() => {}); return f; };
    const clk = async (x, y) => { if (touch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y); };
    const ctr = (s) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, s);
    const clkSel = async (s) => { const c = await ctr(s); if (c) await clk(c[0], c[1]); return !!c; };
    const still = async () => { await p.waitForFunction(() => !__zz.animating && !(__zz.queued > 0), null, { timeout: 9000, polling: 30 }).catch(() => {}); await p.waitForTimeout(400);
      const cut = await p.evaluate(() => { const e = document.getElementById("cutscene"); return !!e && !e.hidden; }).catch(() => false);
      if (cut) { await p.locator("#cut-continue").click(); await p.waitForFunction(() => document.getElementById("cutscene").hidden, null, { timeout: 2000 }).catch(() => {}); } };
    const snap = () => p.evaluate(() => ({ cur: __zz.st.current, ph: __zz.st.phase, n: __zz.actions.length, anim: __zz.animating, L: document.getElementById("opt-left").classList.contains("on"), R: document.getElementById("opt-right").classList.contains("on") }));
    await p.goto(`${BASE}/?seed=20261016`, { waitUntil: "load" }); await p.evaluate(() => localStorage.clear()); await p.goto(`${BASE}/?seed=20261016`, { waitUntil: "load" }); await p.waitForFunction(() => !!window.__zz); await p.waitForTimeout(900);
    const version = await p.evaluate(async () => { try { const t = await (await fetch("sw.js", { cache: "no-store" })).text(); return (t.match(/VERSION = "([^"]+)"/) || [])[1]; } catch { return null; } });
    await still(); const codeT01 = await p.evaluate(() => __zz.code());
    await clkSel("#opt-left"); await still();
    const atT02 = await snap(); const codeT02 = await p.evaluate(() => __zz.code());
    // 页内记录重置瞬间的 animating（捕获阶段，先于应用自身监听）
    await p.evaluate((c) => { window.__rst = []; const rec = (tag) => window.__rst.push({ tag, anim: __zz.animating, n: __zz.actions.length, t: performance.now() });
      document.addEventListener("click", (e) => { if (e.target.closest('[data-menu="new"]')) rec("new"); if (e.target.closest("#dlgapply")) rec("import"); }, true);
      window.__recRestore = () => { rec("restore"); return __zz.restore(); }; document.getElementById("dlgtext").value = c; }, codeT01);
    await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(60); const pv = await snap();
    const ev = [await shot("T02按←预览")];
    if (INP === "kbd") await p.keyboard.press("ArrowLeft"); else await clkSel("#opt-left");
    await p.waitForTimeout(20);
    const fly = await snap();
    if (path === "重新开局") { await clkSel("#menubtn"); await clkSel('#menu-pop [data-menu="new"]'); }
    else if (path === "导入") { await clkSel("#menubtn"); await clkSel('#menu-pop [data-menu="import"]'); await p.evaluate((c) => { const t = document.getElementById("dlgtext"); if (t.value !== c) t.value = c; }, codeT01); await clkSel("#dlgapply"); }
    else await p.evaluate(() => window.__recRestore());
    const rst = await p.evaluate(() => window.__rst.slice());
    await p.waitForTimeout(700); await still();
    const after = await snap(); ev.push(await shot("重置后静止"));
    await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(500);
    const one = await snap(); ev.push(await shot("新局按一次←"));
    await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(300); await still();
    const two = await snap(); ev.push(await shot("新局再按←"));
    const valid = rst.length > 0 && rst[rst.length - 1].anim === true && fly.anim === true && pv.L === true;
    const expectCur = path === "读档" ? "T02" : "T01";
    const c1 = !after.L && !after.R, c2 = one.n === after.n && one.L === true, c3 = two.n === after.n + 1;
    const pass = valid && c1 && c2 && c3 && after.cur === expectCur && errs.length === 0;
    r = { path, k, attempt, version, valid, atT02, preview: pv, flying: fly, reset: rst, after, oneLeft: one, twoLeft: two, checks: { noStaleHighlight: c1, firstLeftOnlyPreview: c2, secondLeftCommits: c3, cur: after.cur, expectCur }, errs, pass, shots: ev };
    console.log((valid ? (pass ? "PASS" : "FAIL") : "INVAL").padEnd(5), cfg, path, "#" + k, "a" + attempt, "| 重置瞬间", JSON.stringify(rst), "| 重置后", JSON.stringify(after), "| 按1次←", JSON.stringify(one), "| 再按←", JSON.stringify(two), errs.length ? "ERR " + errs.join(";") : "");
    await ctx.close(); if (valid) break;
  }
  res.push(r);
}
fs.writeFileSync(`${OUT}/p21_${cfg}.json`, JSON.stringify({ cfg, res }, null, 1)); clearTimeout(hard); await B.close();
