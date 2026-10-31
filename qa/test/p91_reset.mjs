// R号: R10（新局/读档/导入清队）+ R01（清队后飞出中输入仍缓冲）— P9-1
// P9-1 复测：清队（重新开局/导入/读档 时队列里有排队输入、且正逢飞出）之后，飞出中触点卡片应入队，落到 T03 停稳后出「先点卡角骨片刻下这件事」。
// node p91_reset.mjs <engine> <WxH> <mode:emuA|phone|tab|desk> <baseURL> <outdir> [reps=2]
// 序列 = 测试上一轮 q3_stale 的 QA 序列（seed 20261016）：T01左→T02左→T03；T03 点卡出拦截提示；按 S，40ms 内 ←←→→，再触点 #opt-left（queued≈4）；
//   立即 菜单→重新开局 / 菜单→导入 T01 码 / 读档（页内 __zz.restore()+render()，即 restore() 代码路径；UI 上读档是整页重载，见注）；
//   1.6s 后导入 T02 码，触点 #opt-left 起飞，50ms 后触点卡片中心 → 期望 queued≥1、T03 落定后出拦截提示。
// 每条路径：清队变体 reps 次 + 对照（不先堆队列）1 次；每次全新 context；每步全屏截图（fullPage）。
import { chromium, firefox, webkit } from "playwright"; import fs from "node:fs";
const [engine, VP, MODE, BASE, OUT, REPS] = process.argv.slice(2); const reps = /^\d+$/.test(REPS || "") ? +REPS : 2;
const [W, H] = VP.split("x").map(Number); const cfg = `${engine}_${VP}_${MODE}`; fs.mkdirSync(`${OUT}/shots/${cfg}`, { recursive: true });
const UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const opt = { viewport: { width: W, height: H }, hasTouch: MODE !== "desk" };
if (MODE === "emuA") Object.assign(opt, { isMobile: true, deviceScaleFactor: 3, userAgent: UA });
if (MODE === "phone") Object.assign(opt, engine === "firefox" ? { deviceScaleFactor: 3 } : { isMobile: true, deviceScaleFactor: 3 });
if (MODE === "tab") opt.deviceScaleFactor = 2;
const touch = MODE !== "desk"; const B = await { chromium, firefox, webkit }[engine].launch(); const res = []; let seq = 0;
const hard = setTimeout(() => { fs.writeFileSync(`${OUT}/p91_${cfg}.json`, JSON.stringify({ timeout: true, res }, null, 1)); process.exit(3); }, 540000);
for (const path of ["重新开局", "导入", "读档"]) for (let k = 0; k <= reps; k++) {
  const variant = k < reps ? "清队后" : "对照（不先堆队列）";
  const ctx = await B.newContext(opt); const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message.slice(0, 120)));
  const shot = async (n) => { const f = `shots/${cfg}/${String(++seq).padStart(3, "0")}_${path}_${k}_${n}.png`; await p.screenshot({ path: `${OUT}/${f}`, fullPage: true }).catch(() => {}); return f; };
  const clk = async (x, y) => { if (touch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y); };
  const ctr = (s) => p.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, s);
  const still = async () => { await p.waitForFunction(() => !__zz.animating && !(__zz.queued > 0), null, { timeout: 9000, polling: 30 }).catch(() => {}); await p.waitForTimeout(400); };
  const imp = async (c) => { await p.evaluate((c) => __zz.importCode(c), c); await p.waitForTimeout(300); await still(); };
  const cardBox = () => p.evaluate(() => { const c = document.getElementById("card"); const r = c.getBoundingClientRect(); return { l: Math.round(r.left), w: Math.round(r.width), tf: c.style.transform || "", op: c.style.opacity || "" }; });
  await p.goto(`${BASE}/?seed=20261016`, { waitUntil: "load" }); await p.evaluate(() => localStorage.clear()); await p.goto(`${BASE}/?seed=20261016`, { waitUntil: "load" }); await p.waitForFunction(() => !!window.__zz); await p.waitForTimeout(900);
  const version = await p.evaluate(async () => { try { const t = await (await fetch("sw.js", { cache: "no-store" })).text(); return (t.match(/VERSION = "([^"]+)"/) || [])[1]; } catch { return null; } });
  const codes = {}; for (let i = 0; i < 3; i++) { await p.waitForFunction(() => !__zz.animating, null, { timeout: 4000 }).catch(() => {}); const z = await p.evaluate(() => ({ cur: __zz.st.current, c: __zz.code() })); codes[z.cur] = z.c; if (z.cur === "T03") break;
    const cut = await p.evaluate(() => { const e = document.getElementById("cutscene"); return !!e && !e.hidden; }); if (cut) await p.locator("#cut-continue").click();
    const L = await ctr("#opt-left"); await clk(L[0], L[1]); }
  let pre = null, afterReset = null; const ev = [];
  if (variant === "清队后") {
    await imp(codes.T03); const CC = await ctr("#card"); await clk(CC[0], CC[1] + 30); await p.waitForTimeout(150); ev.push(await shot("T03拦截提示"));
    await p.keyboard.press("s"); await p.waitForTimeout(40); for (const kk of ["ArrowLeft", "ArrowLeft", "ArrowRight", "ArrowRight"]) await p.keyboard.press(kk);
    const O = await ctr("#opt-left"); await clk(O[0], O[1]);
    pre = await p.evaluate(() => ({ q: __zz.queued, anim: __zz.animating }));
  }
  if (path === "导入") await p.evaluate((c) => { document.getElementById("menubtn").click(); document.querySelector("#menu-pop [data-menu=import]")?.click(); document.getElementById("dlgtext").value = c; document.getElementById("dlgapply").click(); }, codes.T01);
  else if (path === "重新开局") await p.evaluate(() => { document.getElementById("menubtn").click(); document.querySelector("#menu-pop [data-menu=new]")?.click(); });
  else await p.evaluate(() => { __zz.restore(); __zz.render(); });
  await p.waitForTimeout(1600); await still(); await p.waitForTimeout(200);
  afterReset = { ...(await cardBox()), cur: await p.evaluate(() => __zz.st.current), q: await p.evaluate(() => __zz.queued) }; ev.push(await shot("清队后静止"));
  await imp(codes.T02); const L = await ctr("#opt-left"); await clk(L[0], L[1]); await p.waitForTimeout(50);
  const midBox = await cardBox(); const C = await ctr("#card"); await clk(C[0], C[1]);
  const qAfter = await p.evaluate(() => __zz.queued); ev.push(await shot("飞出中点卡后"));
  const t0 = Date.now();
  const hint = await p.waitForFunction(() => { const t = document.getElementById("toast"); return t && t.classList.contains("on") && /先点卡角骨片刻下这件事/.test(t.textContent); }, null, { timeout: 3000, polling: 30 }).then(() => true).catch(() => false);
  const hintMs = Date.now() - t0; ev.push(await shot(hint ? "拦截提示出现" : "等3s无拦截提示"));
  await still(); const z = await p.evaluate(() => ({ cur: __zz.st.current, ph: __zz.st.phase, q: __zz.queued, n: __zz.actions.length, toast: document.getElementById("toast")?.textContent.trim(), live: document.getElementById("toast-live")?.textContent || null }));
  const pass = qAfter >= 1 && hint && z.cur === "T03";
  res.push({ path, variant, k, version, preQueue: pre, afterReset, midFlyCard: midBox, queuedAfterTap: qAfter, lockHint: hint, hintWaitMs: hintMs, state: z, errs, pass, shots: ev });
  console.log((pass ? "PASS" : "FAIL").padEnd(5), cfg, path, variant, "#" + k, "pre", JSON.stringify(pre), "| reset后卡", JSON.stringify(afterReset), "| 飞出50ms卡", JSON.stringify(midBox), "| 点卡后 queued=" + qAfter, "| 提示=" + hint, JSON.stringify(z), errs.length ? "ERR " + errs.join(";") : "");
  await ctx.close();
}
fs.writeFileSync(`${OUT}/p91_${cfg}.json`, JSON.stringify({ cfg, res }, null, 1)); clearTimeout(hard); await B.close();
