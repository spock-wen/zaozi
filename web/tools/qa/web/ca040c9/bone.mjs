// 卡角「刻」命中（elementFromPoint 逐帧采样）。node bone.mjs <engine> <port> <outdir> [N=20]
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

const N = +(process.argv[5] || 20);
const VP = [{ n: "1280x720", w: 1280, h: 720 }, { n: "1024x600", w: 1024, h: 600 }, { n: "1366x768", w: 1366, h: 768 }, { n: "390x844", w: 390, h: 844, t: 1 }];
const arm = p => p.evaluate(() => { window.__bs = []; window.__bsOn = true; let t0 = null;
  const tick = () => { if (!window.__bsOn) return; const st = window.__zz.st; const bc = document.querySelector("#bonecorner");
    if (st.phase === "engrave" && bc) { const r = bc.getBoundingClientRect(); const cs = getComputedStyle(bc);
      if (r.width > 0 && cs.display !== "none" && cs.visibility !== "hidden") { if (t0 == null) t0 = performance.now();
        const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        window.__bs.push({ t: Math.round(performance.now() - t0), hit: e === bc || bc.contains(e) ? "bc" : (e ? ((e.closest("[id]")?.id || "") + ">" + (e.className || e.tagName) + ":" + (e.textContent || "").trim().slice(0, 6)).toString().slice(0, 40) : (r.x + r.width / 2 > innerWidth || r.y + r.height / 2 > innerHeight || r.x < 0 ? "屏外" : "none")), cls: bc.className, pe: cs.pointerEvents, cur: st.current }); } }
    else t0 = null;
    requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
const collect = async p => { const s = await p.evaluate(() => { window.__bsOn = false; return window.__bs; }); return s; };
const R = {}; const tal = k => (R[k] ||= { n: 0, bad: [] });
const judge = (k, s, i) => { const t = tal(k); t.n++; const enter = s.filter(x => x.t < 400), after = s.filter(x => x.t >= 400);
  const miss = s.filter(x => x.hit !== "bc");
  const te = tal(k + "|入场中"), ta = tal(k + "|入场后"); te.n++; ta.n++;
  if (!s.length) { t.bad.push(`${i}:无样本`); return; }
  const me = enter.filter(x => x.hit !== "bc"), ma = after.filter(x => x.hit !== "bc");
  const meReal = me.filter(x => x.hit !== "屏外"); const meOff = me.length - meReal.length; if (meOff) (te.off ||= []).push(`${i}:${meOff}帧屏外`);
  if (meReal.length && meReal.every(x => x.hit.startsWith("keyhelp-pop"))) (te.pop ||= []).push(`${i}:${meReal.length}/${enter.length}帧在键位浮层下(t=${meReal[0].t}–${meReal.at(-1).t}ms)`);
  else if (meReal.length) te.bad.push(`${i}:${me.length}/${enter.length}帧→${me[0].hit}(${me[0].cls},pe=${me[0].pe},t=${me[0].t})`);
  if (ma.length) ta.bad.push(`${i}:${ma.length}/${after.length}帧→${ma[0].hit}(${ma[0].cls},pe=${ma[0].pe},t=${ma[0].t})`);
  const realMiss = miss.filter(x => x.hit !== "屏外" && !x.hit.startsWith("keyhelp-pop")); if (realMiss.length) t.bad.push(`${i}:${realMiss.length}/${s.length}`); else if (miss.some(x => x.hit.startsWith("keyhelp-pop"))) (t.pop ||= []).push(`${i}:${miss.filter(x => x.hit.startsWith("keyhelp-pop")).length}帧在键位浮层下`); else if (miss.length) (t.off ||= []).push(`${i}`); };
const press = async (p, v, loc) => { if (v.t) await loc.tap(); else await loc.click(); };
for (const v of VP) { let samplesTotal = 0;
  for (let i = 0; i < N; i++) { const c = await ctxOf(v); try { const p = await boot(c);
      // 教学态：T01 左 → T02 右 → T03 刻（入场中/入场后），采样 1500ms
      await step(p, v, "left"); await arm(p); await step(p, v, "right"); await p.waitForTimeout(1500);
      const s1 = await collect(p); samplesTotal += s1.length; judge("教学态 T03", s1, i);
      const ph0 = await ph(p); const bcLoc = p.locator("#bonecorner"); const b = await bcLoc.boundingBox();
      if (v.t) await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); else await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await p.waitForTimeout(400); const okClick = ph0 === "engrave" && (await ph(p)) !== "engrave"; const tc = tal("教学态 T03 在中心实点一次即刻成"); tc.n++; if (!okClick) tc.bad.push(`${i}:phase ${ph0}→${await ph(p)}`);
      // T04 落字 → T05 → 普通卡，直到下一张「刻」卡
      if (v.t) { const sl = p.locator("#wordbox .slot.ok").first(); if (await sl.count()) await sl.tap(); } else await p.keyboard.press("1");
      await p.waitForTimeout(400); await step(p, v, "left");
      let found = false; await arm(p);
      for (let k = 0; k < 40; k++) { const s = await ph(p); if (s === "engrave") { found = true; break; } if (s !== "card") break; await step(p, v, k % 2 ? "right" : "left"); }
      if (found) { await p.waitForTimeout(1500); const s2 = await collect(p); samplesTotal += s2.length; judge("刻过后下一张带迹卡", s2, i);
        const b2 = await bcLoc.boundingBox(); if (v.t) await p.touchscreen.tap(b2.x + b2.width / 2, b2.y + b2.height / 2); else await p.mouse.click(b2.x + b2.width / 2, b2.y + b2.height / 2);
        await p.waitForTimeout(400); const t2 = tal("刻过后下一张带迹卡 实点一次即刻成"); t2.n++; if ((await ph(p)) === "engrave") t2.bad.push(`${i}:未刻成`); }
      else { const t = tal("刻过后下一张带迹卡"); t.n++; t.bad.push(`${i}:40步内未遇到刻卡(phase=${await ph(p)})`); }
      if (i === 0) await shot(p, `${v.n}_bone`);
    } catch (e) { const t = tal("组异常"); t.n++; t.bad.push(`${i}:${e.message.split("\n")[0].slice(0, 80)}`); }
    await c.close(); }
  for (const [k, t] of Object.entries(R)) { if (!t.n) continue; const notFound = t.bad.filter(x => /未遇到|无样本/.test(x)).length === t.bad.length && t.bad.length;
    const res = t.bad.length ? (notFound ? "部分验证" : "FAIL") : (t.pop && t.pop.length && t.pop.some(x => /浮层/.test(x)) ? "部分验证" : "PASS");
    rec("刻命中", `${k} ×${t.n}`, v.n, res, `失败=${t.bad.length}/${t.n} ${t.bad.slice(0, 6).join(" ")}${t.pop ? " 首进键位浮层/屏外:" + t.pop.slice(0, 4).join(" ") : ""}${t.off ? " 入场滑入时卡角在屏外(不计):" + t.off.length + "遍" : ""}`, `shots/${engine}_${v.n}_bone.png`); }
  console.log("samples", v.n, samplesTotal); for (const k of Object.keys(R)) delete R[k];
  fs.writeFileSync(`${OUT}/matrix_bone_${engine}.csv`, "block,item,engine,viewport,result,note,shot\n" + rows.map(r => r.join(",")).join("\n") + "\n"); }
await B.close(); srv.kill(); process.exit(0);
