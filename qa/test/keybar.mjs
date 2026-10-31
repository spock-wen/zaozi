// R号: R12（刻字阶段键位行/浮层不出现「左右/← →」，D1）+ A-R7 P3-3（无「Enter 刻」）+ R14/R15（不溢出视口）
// 刻字卡键位条/键位列表（? 浮层）：R12/D1 刻字阶段不出现「左右 / ← → / ←→」；无「Enter 刻」（A-R7 P3-3）；有 K 刻字（浮层还要有 S 先不刻）；键位条/浮层不溢出视口。
// node keybar.mjs <engine> <WxH> <mode:desk|touch|emuA|phone|tab> <baseURL> <outdir>
// 序列 seed 20261016：T01 点左 → T02 点左 → T03（engrave）。在 T02（card）与 T03（engrave）各取：#keys 文字/几何、body.dataset.short/view、
//   ? 浮层（可见时点开）文字/几何；整页 innerText 不含「Enter 刻 / Enter刻 / K/Enter」。每步全屏截图。
import { chromium, firefox, webkit } from "playwright"; import fs from "node:fs";
const [engine, VP, MODE, BASE, OUT] = process.argv.slice(2);
const [W, H] = VP.split("x").map(Number); const cfg = `${engine}_${VP}_${MODE}`; fs.mkdirSync(`${OUT}/shots/${cfg}`, { recursive: true });
const UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const touch = MODE !== "desk"; const opt = { viewport: { width: W, height: H }, hasTouch: touch };
if (MODE === "emuA") Object.assign(opt, { isMobile: true, deviceScaleFactor: 3, userAgent: UA });
if (MODE === "phone") Object.assign(opt, engine === "firefox" ? { deviceScaleFactor: 3 } : { isMobile: true, deviceScaleFactor: 3 });
if (MODE === "tab") opt.deviceScaleFactor = 2;
const B = await { chromium, firefox, webkit }[engine].launch(); const ctx = await B.newContext(opt); const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message.slice(0, 120)));
let seq = 0; const shot = async (n) => { const f = `shots/${cfg}/${String(++seq).padStart(2, "0")}_${n}.png`; await p.screenshot({ path: `${OUT}/${f}`, fullPage: true }).catch(() => {}); return f; };
const clk = async (x, y) => { if (touch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y); };
const ctr = (s) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? [r.left + r.width / 2, r.top + r.height / 2] : null; }, s);
const still = async () => { await p.waitForFunction(() => !__zz.animating && !(__zz.queued > 0), null, { timeout: 9000, polling: 30 }).catch(() => {}); await p.waitForTimeout(500);
  const cut = await p.evaluate(() => { const e = document.getElementById("cutscene"); return !!e && !e.hidden; }).catch(() => false);
  if (cut) { await p.locator("#cut-continue").click(); await p.waitForFunction(() => document.getElementById("cutscene").hidden, null, { timeout: 2000 }).catch(() => {}); } };
const geo = (sel) => p.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
  const vis = !e.hidden && cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0;
  return { vis, text: e.innerText.trim(), l: +r.left.toFixed(1), r: +r.right.toFixed(1), t: +r.top.toFixed(1), b: +r.bottom.toFixed(1), sw: e.scrollWidth, cw: e.clientWidth, sh: e.scrollHeight, ch: e.clientHeight, ws: cs.whiteSpace, ov: cs.overflow }; }, sel);
const inVP = (g) => !g || !g.vis || (g.l >= -0.5 && g.r <= W + 0.5 && g.t >= -0.5 && g.b <= H + 0.5 && g.sw <= g.cw + 1 && g.sh <= g.ch + 1);
await p.goto(`${BASE}/?seed=20261016`, { waitUntil: "load" }); await p.evaluate(() => localStorage.clear()); await p.goto(`${BASE}/?seed=20261016`, { waitUntil: "load" }); await p.waitForFunction(() => !!window.__zz); await p.waitForTimeout(900);
const version = await p.evaluate(async () => { try { const t = await (await fetch("sw.js", { cache: "no-store" })).text(); return (t.match(/VERSION = "([^"]+)"/) || [])[1]; } catch { return null; } });
const res = [];
const BAD = /Enter\s*刻|K\/Enter/;
await still(); { const L = await ctr("#opt-left"); if (L) await clk(L[0], L[1]); }
for (const stage of ["T02-card", "T03-engrave"]) {
  if (stage === "T03-engrave") { await still(); const L = await ctr("#opt-left"); if (L) await clk(L[0], L[1]); }
  await still();
  const st = await p.evaluate(() => ({ cur: __zz.st.current, ph: __zz.st.phase, view: document.body.dataset.view, short: document.body.dataset.short || "" }));
  const keys = await geo("#keys"); const btn = await geo("#keyhelp-btn");
  let pop = null; const f1 = await shot(`${stage}_键位条`); let f2 = null;
  if (btn && btn.vis) { await p.evaluate(() => { const pp = document.getElementById("keyhelp-pop"); if (pp.hidden) document.getElementById("keyhelp-btn").click(); }); await p.waitForTimeout(400); pop = await geo("#keyhelp-pop"); f2 = await shot(`${stage}_键位浮层`);
    await p.evaluate(() => { const pp = document.getElementById("keyhelp-pop"); if (!pp.hidden) document.getElementById("keyhelp-btn").click(); }); await p.waitForTimeout(200); }
  const bodyText = await p.evaluate(() => document.body.innerText);
  const kbMode = await p.evaluate(() => matchMedia("(pointer:fine)").matches && document.body.dataset.view !== "mobile");
  const eng = st.ph === "engrave"; const chk = {};
  chk.noEnterCarve = !BAD.test(bodyText) && !BAD.test(keys?.text || "") && !BAD.test(pop?.text || "");
  const ARROWS = /←\s*→|←→|左右/;
  if (eng && kbMode && st.short !== "B") chk.barK = /K\s*刻/.test(keys.text);
  if (eng) chk.noArrowsEngrave = !ARROWS.test(keys?.text || "") && !ARROWS.test(pop?.text || "");
  if (eng && pop && pop.vis) chk.popRows = /S\s*先不刻/.test(pop.text) && /K\s*刻/.test(pop.text);
  if (!kbMode || st.short === "B") chk.barEmpty = !keys.text;
  chk.keysInVP = inVP(keys); chk.popInVP = inVP(pop);
  const pass = Object.values(chk).every(Boolean) && errs.length === 0;
  res.push({ stage, version, st, kbMode, keys, btn, pop, chk, errs: errs.slice(), pass, shots: [f1, f2].filter(Boolean) });
  console.log((pass ? "PASS" : "FAIL").padEnd(5), cfg, stage, JSON.stringify(st), "kb=" + kbMode, "| keys", JSON.stringify(keys), "| pop", JSON.stringify(pop), "| chk", JSON.stringify(chk), errs.length ? "ERR " + errs.join(";") : "");
}
fs.writeFileSync(`${OUT}/keybar_${cfg}.json`, JSON.stringify({ cfg, version, res }, null, 1)); await B.close();
