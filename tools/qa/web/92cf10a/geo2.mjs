// W7 回归 b12d7f1：1024/1100/1200/1279 不溢出/不裁/不叠压；1280 PM；1440 居中。用法 node geo2.mjs <engine> <port> <outdir>
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


const SPEC = { padL: 96, h2y: 96, slotsy: 160, pooly: 256, descx: 820, descy: 160, goy: 640 };
for (const [n,w,h] of [["1024",1024,768],["1100",1100,800],["1200",1200,800],["1279",1279,800],["1280",1280,800],["1440",1440,900]]) { const v = { n, w, h };
  try { const c = await ctxOf(v); const p = await boot(c); if (!(await toPick(p, v))) throw new Error("没到挑字");
    let worst = null;
    for (const ch of ["水","日","人","木","田","火","力","月","休","林","从","男","明","本"]) {
      const loc = p.locator(`#pick .cand[data-char='${ch}']`); if (!(await loc.count())) continue; await loc.hover(); await p.waitForTimeout(120);
      const G = await p.evaluate(() => { const vw = document.documentElement.clientWidth; const R = e => e.getBoundingClientRect();
        const els = [...document.querySelectorAll("#pick *")].filter(e => { const r = R(e); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden"; });
        const over = []; const clip = [];
        for (const e of els) { const r = R(e); const id = (e.id ? "#" + e.id : e.tagName.toLowerCase() + "." + [...e.classList].join(".")).slice(0, 40);
          if (r.right > vw + 0.5 || r.left < -0.5) over.push(`${id} ${Math.round(r.left)}–${Math.round(r.right)}`);
          for (let a = e.parentElement; a && a !== document.documentElement; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.overflowX !== "visible" || cs.overflowY !== "visible") { const ar = R(a); if (r.right > ar.right + 0.5 || r.left < ar.left - 0.5 || r.bottom > ar.bottom + 0.5 || r.top < ar.top - 0.5) clip.push(`${id}⊄${(a.id || a.className || a.tagName).toString().slice(0, 20)}`); break; } } }
        const g = s => { const b = document.querySelector(s)?.getBoundingClientRect(); return b && { x: b.x, y: b.y, r: b.right, b: b.bottom }; };
        const blocks = { h2: g("#pick h2"), slots: g("#pick .pickslots"), pool: g("#pick .pool"), desc: g("#pick-desc"), go: g("#pick .go"), hint: g("#pick .season-note") };
        const cands = [...document.querySelectorAll("#pick .cand")].map(e => R(e)); const ovs = [];
        const ks = Object.keys(blocks); for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) { const a = blocks[ks[i]], b = blocks[ks[j]]; if (a && b && a.x < b.r - 0.5 && b.x < a.r - 0.5 && a.y < b.b - 0.5 && b.y < a.b - 0.5) ovs.push(ks[i] + "×" + ks[j]); }
        for (let i = 0; i < cands.length; i++) for (let j = i + 1; j < cands.length; j++) { const a = cands[i], b = cands[j]; if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) ovs.push(`cand${i}×cand${j}`); }
        return { vw, sw: document.documentElement.scrollWidth, over, clip, ovs, blocks }; });
      if (!worst || G.over.length + G.clip.length + G.ovs.length > worst.over.length + worst.clip.length + worst.ovs.length) worst = { ...G, ch };
      if (ch === "木") worst.m = G.blocks; }
    const sh = await shot(p, `${n}_geo`); const vs = `shots/${engine}_${n}_geo_view.png`; await p.screenshot({ path: `${OUT}/${vs}` });
    const ok = !worst.over.length && !worst.clip.length && !worst.ovs.length && worst.sw <= worst.vw;
    rec("W7", "所有元素右边≤视口/无被裁边框圆角/无叠压（14字逐个悬停）", n, ok ? "PASS" : "FAIL", ok ? `scrollW=${worst.sw}/${worst.vw} descR=${Math.round(worst.blocks.desc.r)}` : `最差字=${worst.ch} 溢出:${worst.over.join(" ")} 裁:${worst.clip.join(" ")} 叠:${worst.ovs.join(" ")}`, vs);
    const B0 = worst.m || worst.blocks; const m = { padL: B0.h2.x, h2y: B0.h2.y, slotsy: B0.slots.y, pooly: B0.pool.y, descx: B0.desc.x, descy: B0.desc.y, goy: B0.go.y }; const mr = Object.fromEntries(Object.entries(m).map(([k, x]) => [k, Math.round(x)]));
    if (n === "1280") { const bad = Object.entries(SPEC).filter(([k, val]) => Math.abs(m[k] - val) > 4).map(([k, val]) => `${k}=${mr[k]}(稿${val})`); rec("W7", "1280 PM 数值 ±4px", n, bad.length ? "FAIL" : "PASS", bad.join(" ") || JSON.stringify(mr), vs); }
    else if (n === "1440") { const L = B0.h2.x, Rm = worst.vw - B0.desc.r; rec("W7", "1440 居中（左右留白差≤4）", n, Math.abs(L - Rm) <= 4 ? "PASS" : "FAIL", `左=${Math.round(L)} 右=${Math.round(Rm)} ${JSON.stringify(mr)}`, vs); }
    if (+n >= 1280) { const dw = B0.desc.r - B0.desc.x; rec("P2-3", "说明卡宽约360（±4，PM：1280及以上仍按此验）", n, Math.abs(dw - 360) <= 4 ? "PASS" : "FAIL", `descW=${Math.round(dw)}`, vs); }
    else rec("W7", `${n} 实测记录`, n, "PASS", JSON.stringify(mr) + ` descR=${Math.round(B0.desc.r)}`, vs);
    await c.close();
  } catch (e) { rec("W7", "组", n, "FAIL", "异常:" + e.message.split("\n")[0]); } }
await B.close(); srv.kill();
fs.writeFileSync(`${OUT}/matrix_w7_${engine}.csv`, "block,item,engine,viewport,result,note,shot\n" + rows.map(r => r.join(",")).join("\n") + "\n"); process.exit(0);
