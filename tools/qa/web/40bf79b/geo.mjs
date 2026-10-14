// 回归 0aa3166：字源页/挑字 gf5/冒烟。用法 node regress.mjs <engine> <port> <outdir>
import { chromium, firefox, webkit } from "playwright"; import { spawn } from "node:child_process"; import fs from "node:fs"; import path from "node:path";
const [engine, PORT, OUT] = [process.argv[2], +process.argv[3], process.argv[4]]; const DIST = process.env.DIST;
const HERE = path.dirname(new URL(import.meta.url).pathname); fs.mkdirSync(OUT + "/shots", { recursive: true });
const rf = `${OUT}/root_${engine}.txt`; fs.writeFileSync(rf, DIST);
const srv = spawn("python3", [HERE + "/pages_server.py", String(PORT), rf], { stdio: "ignore" }); await new Promise(r => setTimeout(r, 700));
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


const SPEC = { "1280": { padL: 96, h2y: 96, slotsy: 160, pooly: 256, descx: 820, descy: 160, goy: 640 } };
SPEC["1440"] = { ...SPEC["1280"], padL: 176, descx: 900 };
for (const [n,w,h] of [["1024",1024,768],["1280",1280,800],["1440",1440,900]]) { const v = { n, w, h };
  try { const c = await ctxOf(v); const p = await boot(c); if (!(await toPick(p, v))) throw new Error("没到挑字");
    await p.locator("#pick .cand[data-char='木']").hover(); await p.waitForTimeout(200);
    const G = await p.evaluate(() => { const g = s => { const b = document.querySelector(s)?.getBoundingClientRect(); return b && { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), r: Math.round(b.right), b: Math.round(b.bottom) }; };
      const o = { h2: g("#pick h2"), slots: g("#pick .pickslots"), pool: g("#pick .pool"), desc: g("#pick-desc"), go: g("#pick .go"), hint: g("#pick .season-note") }; o.sw = document.documentElement.scrollWidth; o.sh = document.documentElement.scrollHeight; o.vw = innerWidth; o.vh = innerHeight; return o; });
    const sh = await shot(p, `${n}_geo`);
    const m = { padL: G.h2.x, h2y: G.h2.y, slotsy: G.slots.y, pooly: G.pool.y, descx: G.desc.x, descy: G.desc.y, goy: G.go.y };
    // 叠压
    const boxes = ["h2","slots","pool","desc","go","hint"].map(k => [k, G[k]]); const ovs = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const [ka, a] = boxes[i], [kb, b] = boxes[j]; if (a && b && a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b) ovs.push(ka + "×" + kb); }
    const noOverflow = G.sw <= G.vw;
    rec("布局", "无横向溢出/块间无叠压", n, noOverflow && ovs.length === 0 ? "PASS" : "FAIL", `scrollW=${G.sw}/${G.vw} 叠压=${ovs.join("|") || "无"}`, sh);
    if (SPEC[n]) { const bad = Object.entries(SPEC[n]).filter(([k, val]) => Math.abs(m[k] - val) > 4).map(([k, val]) => `${k}=${m[k]}(稿${val})`);
      rec("布局", `PM 数值 ±4px（${n}）`, n, bad.length === 0 ? "PASS" : "FAIL", bad.length ? bad.join(" ") : JSON.stringify(m), sh); }
    else rec("布局", "1024 实测记录", n, "PASS", JSON.stringify(m), sh);
    console.log("GEO", engine, n, JSON.stringify(G));
    await c.close();
  } catch (e) { rec("布局", "组", n, "FAIL", "异常:" + e.message.split("\n")[0]); } }
await B.close(); srv.kill();
fs.writeFileSync(`${OUT}/matrix_geo_${engine}.csv`, "block,item,engine,viewport,result,note,shot\n" + rows.map(r => r.join(",")).join("\n") + "\n"); process.exit(0);
