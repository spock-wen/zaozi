// 92cf10a 矮屏分档独立核对。用法 node short.mjs <engine> <port> <outdir>
import { chromium, firefox, webkit } from "playwright"; import { spawn } from "node:child_process"; import fs from "node:fs"; import path from "node:path";
const [engine, PORT, OUT] = [process.argv[2], +process.argv[3], process.argv[4]]; const DIST = process.env.DIST;
const HERE = path.dirname(new URL(import.meta.url).pathname); fs.mkdirSync(OUT + "/shots", { recursive: true });
const rf = `${OUT}/root_${engine}.txt`; fs.writeFileSync(rf, DIST);
const srv = spawn("python3", [[HERE, HERE + "/.."].map(d => d + "/pages_server.py").find(f => fs.existsSync(f)), String(PORT), rf], { stdio: "ignore" }); await new Promise(r => setTimeout(r, 700));
const O = `http://localhost:${PORT}`; const B = await { chromium, firefox, webkit }[engine].launch(); const rows = [];
const rec = (b, i, v, r, n = "", s = "") => { rows.push([b, i, engine, v, r, String(n).replace(/[\n,]/g, " ").slice(0, 250), s]); console.log(r, b, i, engine, v, n); };
const shot = async (p, n) => { const f = `shots/${engine}_${n}.png`; await p.screenshot({ path: `${OUT}/${f}`, fullPage: true }).catch(() => {}); return f; };
const VPS = [{ n: "768t", w: 768, h: 1024, t: 1 },{ n: "390", w: 390, h: 844, t: 1 }, { n: "768m", w: 768, h: 1024 }, { n: "1024", w: 1024, h: 768 }, { n: "1280", w: 1280, h: 800 }, { n: "1440", w: 1440, h: 900 }];
const ctxOf = (v, x = {}) => B.newContext({ viewport: { width: v.w, height: v.h }, hasTouch: !!v.t, ...(v.t && engine !== "firefox" ? { isMobile: true } : {}), ...x });
const ph = p => p.evaluate(() => window.__zz.st.phase);
async function step(p, v, d) { if (v.t && await p.locator(d === "left" ? "#opt-left" : "#opt-right").isVisible().catch(() => false)) await p.locator(d === "left" ? "#opt-left" : "#opt-right").tap(); else { const k = d === "left" ? "ArrowLeft" : "ArrowRight"; await p.keyboard.press(k); await p.keyboard.press(k); } await p.waitForTimeout(560); }
async function toPick(p, v) {
  for (let i = 0; i < 120; i++) { const s = await ph(p);
    if (s === "engrave") { await p.evaluate(() => document.querySelector("#bonecorner").click()); await p.waitForTimeout(300); continue; }
    if (s === "card") { await step(p, v, i % 2 ? "right" : "left"); continue; }
    if (s === "winter") { await p.locator("#winter [data-do=end]").click(); await p.locator("#endseq").waitFor({ state: "visible", timeout: 12000 }); continue; }
    if (await p.locator("#pick").isVisible()) return true;
    if (await p.locator("#endseq [data-do=elder]").isVisible().catch(() => false)) { await p.locator("#endseq [data-do=elder]").click(); await p.waitForTimeout(300); continue; }
    if (await p.locator("#elder [data-do=heir]").isVisible().catch(() => false)) { await p.locator("#elder [data-do=heir]").click(); await p.waitForTimeout(300); continue; }
    await p.waitForTimeout(300); }
  return false; }
const boot = async (c, u = "/?seed=7") => { const p = await c.newPage(); await p.goto(O + u, { waitUntil: "load" }); await p.waitForFunction(() => !!window.__zz); return p; };

const clamp = (lo, x, hi) => Math.min(hi, Math.max(lo, x));
const G = (p) => p.evaluate(() => {
  const vis = e => { if (!e) return false; const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return cs.display !== "none" && cs.visibility !== "hidden" && !e.hidden && r.width > 0 && r.height > 0; };
  const R = s => { const e = document.querySelector(s); if (!vis(e)) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; };
  const vw = document.documentElement.clientWidth, vh = innerHeight;
  const ids = ["#topbar", "#card", "#wordbox-bar", "#keys", "#opt-left", "#opt-right", "#bonecorner", "#card-drops", "#keyhelp-btn", "#keyhelp-pop", "#too-short", "#coachcol", "#pick"];
  const out = [], clip = [], small = [];
  for (const s of ids) { const e = document.querySelector(s); if (!vis(e)) continue; const r = e.getBoundingClientRect();
    if (r.left < -0.5 || r.top < -0.5 || r.right > vw + 0.5 || r.bottom > vh + 0.5) out.push(`${s}[${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}]`);
    for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.overflowX !== "visible" || cs.overflowY !== "visible") { const ar = a.getBoundingClientRect(); if (r.right > ar.right + 0.5 || r.left < ar.left - 0.5 || r.bottom > ar.bottom + 0.5 || r.top < ar.top - 0.5) clip.push(`${s}⊄${a.id || a.className}`); break; } } }
  for (const b of document.querySelectorAll("#app button, #topbar button")) { if (!vis(b) || b.disabled || b.closest("#pick,#sidebar")) continue; const r = b.getBoundingClientRect(); if (r.right < 0 || r.bottom < 0 || r.left > vw || r.top > vh) continue; if (r.width < 43.5 || r.height < 43.5) small.push(`${b.id || b.className || b.textContent.trim().slice(0, 6)} ${Math.round(r.width)}×${Math.round(r.height)}`); }
  const ov = []; const blk = { card: R("#card"), wb: R("#wordbox-bar"), keys: R("#keys"), top: R("#topbar"), tooshort: R("#too-short"), pop: R("#keyhelp-pop"), optL: R("#opt-left"), optR: R("#opt-right") }; const ks = Object.keys(blk);
  for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) { const a = blk[ks[i]], b = blk[ks[j]]; if (a && b && a.x < b.r - 0.5 && b.x < a.r - 0.5 && a.y < b.b - 0.5 && b.y < a.b - 0.5) ov.push(ks[i] + "×" + ks[j] + `(${Math.round(Math.min(a.r, b.r) - Math.max(a.x, b.x))}×${Math.round(Math.min(a.b, b.b) - Math.max(a.y, b.y))}px)`); }
  const se = document.scrollingElement; const keys = document.querySelector("#keys"); const drops = document.querySelector("#card-drops");
  return { vw, vh, short: document.body.dataset.short || "", view: document.body.dataset.view, ...blk, out, clip, small, ov,
    scroll: { h: se.scrollHeight - se.clientHeight, w: se.scrollWidth - se.clientWidth },
    keysText: keys ? keys.textContent.trim() : null, keysLines: keys && vis(keys) ? Math.round(keys.getBoundingClientRect().height / parseFloat(getComputedStyle(keys).lineHeight || 16)) : 0, keysFont: keys ? getComputedStyle(keys).fontSize : null,
    keysOverflow: keys && vis(keys) ? keys.scrollWidth - keys.clientWidth : 0,
    drops: drops && vis(drops) ? { h: drops.getBoundingClientRect().height, cut: drops.scrollWidth - drops.clientWidth, txt: drops.textContent.trim().slice(0, 40), ws: getComputedStyle(drops).whiteSpace } : null,
    side: document.body.classList.contains("side-collapsed"), keyhelp: vis(document.querySelector("#keyhelp-btn")), pop: vis(document.querySelector("#keyhelp-pop")), too: vis(document.querySelector("#too-short")) }; });
const open = async (w, h, ctx0) => { const c = ctx0 || await B.newContext({ viewport: { width: w, height: h } }); const p = await boot(c); await p.waitForTimeout(400); return { c, p }; };
const tgt44 = (blk, n, g, sh) => rec(blk, "点击目标≥44×44（屏内可见按钮）", n, g.small.length ? "FAIL" : "PASS", g.small.join(" ") || "全部≥44", sh);
const generic = (g) => [!g.out.length && !g.clip.length && !g.ov.length && g.scroll.h <= 0 && g.scroll.w <= 0, `出屏:${g.out.join(" ") || "无"} 裁:${g.clip.join(" ") || "无"} 叠:${g.ov.join(" ") || "无"} 滚:${g.scroll.h}/${g.scroll.w} 小于44:${g.small.join(" ") || "无"}`];
let normalKeys = null, normalWb = null;
{ const { c, p } = await open(1440, 900); const g0 = await G(p); normalKeys = g0.keysText; normalWb = g0.wb.h; await c.close(); }
// A 档
for (const [w, h] of [[1280, 720], [1280, 633]]) { const n = `${w}x${h}`; try { const { c, p } = await open(w, h); const g = await G(p); const sh = await shot(p, `${n}_short`);
  const exp = clamp(380, g.vh - 188, 468);
  rec("矮屏A", "落 A 档", n, g.short === "A" ? "PASS" : "FAIL", `short=${g.short} view=${g.view}`, sh);
  rec("矮屏A", "卡高=clamp(380,vh−188,468)±1，卡宽≈高×0.7", n, Math.abs(g.card.h - exp) <= 1 && Math.abs(g.card.w - g.card.h * 0.7) <= 4 ? "PASS" : "FAIL", `vh=${g.vh} 卡=${g.card.w.toFixed(1)}×${g.card.h.toFixed(1)} 期望高${exp}`, sh);
  rec("矮屏A", "字匣60", n, Math.round(g.wb.h) === 60 ? "PASS" : "FAIL", `wb.h=${g.wb.h} y=${Math.round(g.wb.y)}–${Math.round(g.wb.b)}`, sh);
  rec("矮屏A", "键位一行28px、12号、在视口内、不截断", n, g.keys && Math.round(g.keys.h) === 28 && g.keys.b <= g.vh + 0.5 && g.keysOverflow <= 0 && g.keysFont === "12px" ? "PASS" : "FAIL", `keys=${g.keys && `${Math.round(g.keys.y)}–${Math.round(g.keys.b)} h${g.keys.h}`} font=${g.keysFont} 溢出=${g.keysOverflow} 「${g.keysText}」`, sh);
  const [ok, note] = generic(g); rec("矮屏A", "元素不出视口/不叠压/不裁切/不滚动", n, ok ? "PASS" : "FAIL", note, sh); tgt44("矮屏A", n, g, sh);
  rec("矮屏A", "卡上「落」字框一行不截断", n, !g.drops ? "PASS" : (g.drops.ws === "nowrap" && g.drops.cut <= 0 ? "PASS" : "FAIL"), g.drops ? `h=${g.drops.h} cut=${g.drops.cut} ws=${g.drops.ws} 「${g.drops.txt}」` : "本屏无落字框", sh);
  await c.close(); } catch (e) { rec("矮屏A", "组", n, "FAIL", "异常:" + e.message.split("\n")[0]); } }
// B 档
for (const [w, h] of [[1024, 600], [1024, 513]]) { const n = `${w}x${h}`; try { const { c, p } = await open(w, h); const g = await G(p); const sh = await shot(p, `${n}_short`);
  const exp = clamp(320, g.vh - 172, 428);
  rec("矮屏B", "落 B 档", n, g.short === "B" ? "PASS" : "FAIL", `short=${g.short}`, sh);
  rec("矮屏B", "卡高=clamp(320,vh−172,428)±1", n, Math.abs(g.card.h - exp) <= 1 ? "PASS" : "FAIL", `vh=${g.vh} 卡=${g.card.w.toFixed(1)}×${g.card.h.toFixed(1)} 期望高${exp}`, sh);
  rec("矮屏B", "字匣56", n, Math.round(g.wb.h) === 56 ? "PASS" : "FAIL", `wb.h=${g.wb.h} y=${Math.round(g.wb.y)}–${Math.round(g.wb.b)}`, sh);
  rec("矮屏B", "键位不占行、进顶栏「?」、首进自动弹一次", n, !g.keys && g.keyhelp && g.pop ? "PASS" : "FAIL", `keys行=${!!g.keys} ?=${g.keyhelp} 首进弹=${g.pop}`, sh);
  const [ok, note] = generic(g); rec("矮屏B", "元素不出视口/不叠压/不裁切/不滚动（首进浮层开着）", n, ok ? "PASS" : "FAIL", note, sh); tgt44("矮屏B", n, g, sh);
  await p.waitForTimeout(3300); const g2 = await G(p); rec("矮屏B", "浮层约3秒后自动收起", n, !g2.pop ? "PASS" : "FAIL", `3.7s后 pop=${g2.pop}`, await shot(p, `${n}_short_after3s`));
  await p.reload({ waitUntil: "load" }); await p.waitForFunction(() => !!window.__zz); await p.waitForTimeout(400); const g3 = await G(p);
  rec("矮屏B", "同存档再进不再自动弹", n, !g3.pop ? "PASS" : "FAIL", `pop=${g3.pop}`);
  await p.locator("#keyhelp-btn").click(); await p.waitForTimeout(200); const g4 = await G(p); const [ok4, note4] = generic(g4);
  rec("矮屏B", "点「?」开浮层，浮层在视口内不出界", n, g4.pop && ok4 ? "PASS" : "FAIL", note4, await shot(p, `${n}_short_pop`));
  await p.keyboard.press("Escape"); await p.waitForTimeout(200); rec("矮屏B", "Esc 关浮层", n, !(await G(p)).pop ? "PASS" : "FAIL", "");
  rec("矮屏B", "卡上「落」字框一行不截断", n, !g.drops ? "PASS" : (g.drops.ws === "nowrap" && g.drops.cut <= 0 ? "PASS" : "FAIL"), g.drops ? `h=${g.drops.h} cut=${g.drops.cut} 「${g.drops.txt}」` : "本屏无落字框", sh);
  await c.close(); } catch (e) { rec("矮屏B", "组", n, "FAIL", "异常:" + e.message.split("\n")[0]); } }
// N 档 1366×768 与普通桌面一致
try { const n = "1366x768"; const { c, p } = await open(1366, 768); const g = await G(p); const sh = await shot(p, "1366x768_short"); const exp = clamp(468, g.vh - 280, 640);
  rec("常规N", "1366×768 与普通桌面一致（N档、卡高clamp(468,vh−280,640)、字匣64、整句键位同1440）", "1366x768", g.short === "" && Math.abs(g.card.h - exp) <= 1 && Math.abs(g.wb.h - normalWb) <= 1 && g.keysText === normalKeys ? "PASS" : "FAIL", `short="${g.short}" vh=${g.vh} 卡=${g.card.w.toFixed(0)}×${g.card.h.toFixed(1)}(期望${exp}) wb=${g.wb.h}(1440为${normalWb}；稿N档字匣64) keys同1440=${g.keysText === normalKeys}`, sh);
  const [ok, note] = generic(g); rec("常规N", "元素不出视口/不叠压/不裁切/不滚动", "1366x768", ok ? "PASS" : "FAIL", note, sh); tgt44("常规N", n, g, sh); await c.close(); } catch (e) { rec("常规N", "组", "1366x768", "FAIL", "异常:" + e.message); }
// <492 提示边界
for (const [w, h] of [[1024, 491], [1024, 492], [1280, 491], [1280, 492]]) { const n = `${w}x${h}`; try { const { c, p } = await open(w, h); const g = await G(p); const sh = await shot(p, `${n}_tooshort`);
  const txt = await p.locator("#too-short").textContent().catch(() => "");
  if (h < 492) { rec("矮屏<492", "出「窗口太矮」提示、卡320、侧栏收起、提示在视口内", n, g.too && /窗口太矮/.test(txt) && Math.round(g.card.h) === 320 && g.side && !g.out.includes("#too-short") ? "PASS" : "FAIL", `提示=${g.too} 「${txt.trim().slice(0, 30)}」 卡高=${g.card.h} 侧栏收=${g.side}`, sh);
    const [ok, note] = generic(g); rec("矮屏<492", "元素不叠压/不裁切（出屏如实记录）", n, ok ? "PASS" : "FAIL", note, sh); tgt44("矮屏<492", n, g, sh); }
  else rec("矮屏<492", "492 不出提示", n, !g.too ? "PASS" : "FAIL", `提示=${g.too} 卡高=${g.card.h}`, sh);
  await c.close(); } catch (e) { rec("矮屏<492", "组", n, "FAIL", "异常:" + e.message.split("\n")[0]); } }
// 教学走完（B/A 档）：第4步字匣格可点、按1落字、气泡在屏内且不盖目标
const commitK = async (p, d) => { const k = d === "left" ? "ArrowLeft" : "ArrowRight"; await p.keyboard.press(k); await p.keyboard.press(k); await p.waitForTimeout(600); };
for (const [w, h] of [[1024, 600], [1024, 513], [1280, 633]]) { const n = `${w}x${h}`; try { const { c, p } = await open(w, h); const notes = []; let okAll = true;
  const coachChk = async (lab, tgt) => { const r = await p.evaluate((tgt) => { const R = s => { const e = document.querySelector(s); if (!e) return null; const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return cs.display === "none" || !r.width ? null : r; };
      const co = R("#coachcol") || R("#coach"); const t = tgt ? R(tgt) : null; const inter = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      let hit = null; if (t) { const e = document.elementFromPoint(t.left + t.width / 2, t.top + t.height / 2); hit = e && e.closest(tgt) ? "self" : (e ? e.id || e.className : "none"); }
      return { co: co && [Math.round(co.left), Math.round(co.top), Math.round(co.right), Math.round(co.bottom)], inView: !co || (co.top >= -0.5 && co.bottom <= innerHeight + 0.5 && co.left >= -0.5 && co.right <= innerWidth + 0.5), cover: inter(co, t), hit, cur: window.__zz.st.current, phase: window.__zz.st.phase }; }, tgt);
    notes.push(`${lab}:${r.cur} 气泡${r.co} 屏内${r.inView} 盖目标${!!r.cover} 命中${r.hit}`); if (!r.inView || r.cover || (tgt && r.hit !== "self")) okAll = false; return r; };
  await coachChk("T01", "#opt-left"); await commitK(p, "left"); await coachChk("T02", "#opt-right"); await commitK(p, "right");
  const t3 = await coachChk("T03", "#bonecorner"); await p.locator("#bonecorner").click(); await p.waitForTimeout(400);
  const t4 = await coachChk("T04", "#wordbox .slot.ok"); const s4 = await shot(p, `${n}_tut_T04`);
  await p.keyboard.press("1"); await p.waitForTimeout(500); const cur5 = await p.evaluate(() => window.__zz.st.current);
  rec("教学", "第4步字匣格可点（命中自身）且气泡不盖", n, t4.cur === "T04" && t4.hit === "self" && !t4.cover ? "PASS" : "FAIL", notes.slice(-1)[0], s4);
  rec("教学", "第4步按 1 落字 → T05", n, cur5 === "T05" ? "PASS" : "FAIL", `按1后 current=${cur5}`, s4);
  await coachChk("T05", null); await commitK(p, "left"); const end = await p.evaluate(() => ({ cur: window.__zz.st.current, coach: (() => { const e = document.querySelector("#coach"); if (!e) return false; const r = e.getBoundingClientRect(); return getComputedStyle(e).display !== "none" && getComputedStyle(e).visibility !== "hidden" && !e.hidden && r.width > 0 && r.height > 0 && e.textContent.trim().length > 0; })() }));
  const sE = await shot(p, `${n}_tut_end`);
  rec("教学", "教学能走完（T01→T05→普通卡、气泡消失）", n, !/^T0/.test(end.cur || "") && !end.coach ? "PASS" : "FAIL", `结束 current=${end.cur} 气泡=${end.coach}`, sE);
  rec("教学", "全程气泡在屏内、不盖当步目标", n, okAll ? "PASS" : "FAIL", notes.join(" | "), sE);
  await c.close(); } catch (e) { rec("教学", "组", n, "FAIL", "异常:" + e.message.split("\n")[0]); } }
// 挑字页 7×2 不滚动 + 说明卡（落一行/解锁隐藏/无？）
for (const [w, h] of [[1280, 720], [1280, 633], [1024, 600], [1024, 513], [1366, 768]]) { const n = `${w}x${h}`; try { const v = { n, w, h }; const c = await ctxOf(v); const p = await boot(c); if (!(await toPick(p, v))) throw new Error("没到挑字");
  let worst = { bad: [] }, info = [];
  for (const ch of ["水", "木", "明", "本"]) { await p.locator(`#pick .cand[data-char='${ch}']`).hover(); await p.waitForTimeout(150);
    const r = await p.evaluate(() => { const el = document.querySelector("#pick"); const cands = [...el.querySelectorAll(".cand")].map(c => c.getBoundingClientRect()); const se = document.scrollingElement; const vw = document.documentElement.clientWidth, vh = innerHeight;
      const bad = []; for (const e of el.querySelectorAll("*")) { const r = e.getBoundingClientRect(); if (!r.width || getComputedStyle(e).display === "none") continue; if (r.right > vw + 0.5 || r.bottom > vh + 0.5 || r.left < -0.5 || r.top < -0.5) bad.push(`${e.className || e.tagName}[${Math.round(r.right)},${Math.round(r.bottom)}]`); }
      const blocks = ["h2", ".pickslots", ".pool", "#pick-desc", ".go", ".season-note"].map(s => [s, el.querySelector(s)?.getBoundingClientRect()]).filter(([, r]) => r && r.width); const ov = [];
      for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) { const [ka, a] = blocks[i], [kb, b] = blocks[j]; if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) ov.push(ka + "×" + kb); }
      const d = el.querySelector("#pick-desc"); const txt = d ? d.innerText : ""; const rows = d ? [...d.children].map(x => x.innerText.trim()).filter(Boolean) : [];
      const luo = d ? [...d.querySelectorAll("*")].filter(x => /^落/.test(x.textContent.trim()) && x.children.length <= 2) : []; const luoLines = luo.map(x => Math.round(x.getBoundingClientRect().height / (parseFloat(getComputedStyle(x).lineHeight) || 18)));
      return { cols: new Set(cands.map(r => Math.round(r.x))).size, rows: new Set(cands.map(r => Math.round(r.y))).size, n: cands.length, sc: [se.scrollHeight - se.clientHeight, se.scrollWidth - se.clientWidth, el.scrollHeight - el.clientHeight], bad, ov, q: /[？?]/.test(txt), unlock: /解锁/.test(txt), luo: luo.length, luoLines, descRows: rows.slice(0, 4) }; });
    if (r.bad.length + r.ov.length >= worst.bad.length + (worst.ov || []).length) worst = { ...r, ch }; info.push(`${ch}:落行=${r.luo}${r.luoLines.length ? "(" + r.luoLines + "行)" : ""} 解锁=${r.unlock} ？=${r.q}`); }
  const sh = await shot(p, `${n}_pick`);
  rec("矮屏挑字", "7×2 共14字、页面与#pick不滚动", n, worst.n === 14 && worst.cols === 7 && worst.rows === 2 && worst.sc.every(x => x <= 0) ? "PASS" : "FAIL", `${worst.cols}列×${worst.rows}行 n=${worst.n} 滚=${worst.sc}`, sh);
  rec("矮屏挑字", "元素不出视口/块不叠压（悬停水木明本）", n, !worst.bad.length && !worst.ov.length ? "PASS" : "FAIL", `最差=${worst.ch} 出屏:${worst.bad.slice(0, 5).join(" ") || "无"} 叠:${worst.ov.join(" ") || "无"}`, sh);
  rec("矮屏挑字", "说明卡「落」最多一行、「解锁」隐藏、无「？」", n, !info.some(x => /解锁=true|？=true/.test(x)) && !info.some(x => /\((?:[2-9]|\d\d)/.test(x)) ? "PASS" : "FAIL", info.join(" "), sh);
  await c.close(); } catch (e) { rec("矮屏挑字", "组", n, "FAIL", "异常:" + e.message.split("\n")[0]); } }
// 换档无动画：1280×800→720（N→A）、720→600（A→B）期间 #card 无运行中的过渡/动画
try { const { c, p } = await open(1280, 800); const res = [];
  for (const [w, h] of [[1280, 720], [1024, 600], [1280, 800]]) {
    await p.evaluate(() => { window.__an = []; const t0 = performance.now(); const tick = () => { const card = document.querySelector("#card"); const a = (card?.getAnimations?.({ subtree: true }) || []).filter(x => x.playState === "running"); if (a.length) window.__an.push(a.map(x => x.transitionProperty || x.animationName || "anim").join("+")); if (performance.now() - t0 < 600) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(700);
    const r = await p.evaluate(() => ({ an: [...new Set(window.__an)], short: document.body.dataset.short || "N" })); res.push(`→${w}x${h}(${r.short}) 动画:${r.an.join(",") || "无"}`); }
  rec("矮屏", "换档无动画（N→A→B→N，#card 内无运行中的过渡/动画）", "resize", res.every(x => /动画:无/.test(x)) ? "PASS" : "FAIL", res.join(" | "), await shot(p, "resize_end")); await c.close(); } catch (e) { rec("矮屏", "换档无动画", "resize", "FAIL", "异常:" + e.message.split("\n")[0]); }
await B.close(); srv.kill();
fs.writeFileSync(`${OUT}/matrix_short_${engine}.csv`, "block,item,engine,viewport,result,note,shot\n" + rows.map(r => r.join(",")).join("\n") + "\n"); process.exit(0);
