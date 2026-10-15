// 92cf10a P1 触控放回 / 出发只一次 / P2-1 多指。用法 node touch.mjs <engine> <port> <outdir> [N=20]
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
const picks = p => p.evaluate(() => window.__zz.st.picks.slice());
const v = { n: "390", w: 390, h: 844, t: 1 };
const R = {}; const tal = k => (R[k] ||= { n: 0, bad: [] }); const ok = (k, good, note) => { const t = tal(k); t.n++; if (!good) t.bad.push(note); };
const c = await ctxOf(v); const p = await boot(c);
if (!(await toPick(p, v))) throw new Error("没到挑字");
const state = await c.storageState();
const cand = (pg, ch) => pg.locator(`#pick .cand[data-char='${ch}']`); const slot = (pg, i) => pg.locator(`#pick .pickslot[data-slot='${i}']`);
const add = async (pg, ch) => { await cand(pg, ch).tap(); await cand(pg, ch).tap(); };
const setPicks = async (pg, arr) => { for (let k = 0; k < 6; k++) { const cur = await picks(pg); if (cur.join() === arr.join()) return true;
    if (cur.length) { await slot(pg, cur.length - 1).tap(); await pg.waitForTimeout(60); continue; }
    for (const ch of arr) await add(pg, ch); await pg.waitForTimeout(80); } return (await picks(pg)).join() === arr.join(); };
const cdp = engine === "chromium" ? await c.newCDPSession(p) : null;
const ctr = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
for (let i = 0; i < N; i++) {
  // P1a 选满后点第1格 / 第2格 / 第3格
  for (const s of [0, 1, 2]) { if (!(await setPicks(p, ["水", "日", "人"]))) { ok(`slot${s}`, false, `${i}:setup`); continue; }
    await slot(p, s).tap(); await p.waitForTimeout(250); const ps = await picks(p); const exp = ["水", "日", "人"].filter((_, k) => k !== s);
    ok(`slot${s}`, ps.join() === exp.join(), `${i}:${ps}`); }
  // P1b 点已选候选只少一个（逐个 水/日/人）
  for (const ch of ["水", "日", "人"]) { if (!(await setPicks(p, ["水", "日", "人"]))) { ok(`cand${ch}`, false, `${i}:setup`); continue; }
    await cand(p, ch).tap(); await p.waitForTimeout(250); const ps = await picks(p);
    ok(`cand${ch}`, ps.join() === ["水", "日", "人"].filter(x => x !== ch).join(), `${i}:${ps}`); }
  // P2-1 多指
  if (cdp) for (const [mode, A, Bk] of [["cand", "水", "人"], ["slot", 0, 2]]) {
    for (const rel of ["同时", "先后"]) { const key = `mt_${mode}_${rel}`;
      if (!(await setPicks(p, ["水", "日", "人"]))) { ok(key, false, `${i}:setup`); continue; }
      const a = await ctr(mode === "cand" ? cand(p, A) : slot(p, A)), b = await ctr(mode === "cand" ? cand(p, Bk) : slot(p, Bk));
      const pt = (q, id) => ({ x: q.x, y: q.y, id });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [pt(a, 1)] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [pt(a, 1), pt(b, 2)] });
      await p.waitForTimeout(80);
      if (rel === "同时") await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      else { await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [pt(b, 2)] }); await p.waitForTimeout(60); await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); }
      await p.waitForTimeout(250); const ps = await picks(p);
      ok(key, ps.join() === "日", `${i}:${ps}`);
      // 两指松开后 200ms 内单指点另一候选（第一下看说明、第二下选中）不应被吞
      if (mode === "cand" && rel === "同时") { await cand(p, "木").tap(); await cand(p, "木").tap(); await p.waitForTimeout(200); const q = await picks(p); ok("mt_after_tap", q.join() === "日,木", `${i}:${q}`); }
    } }
}
// 出发只一次：每遍新上下文（复用存档直进挑字），奇数遍快速连点 3 下
let fast = 0;
for (let i = 0; i < N; i++) { const c2 = await B.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, ...(engine !== "firefox" ? { isMobile: true } : {}), storageState: state });
  const p2 = await c2.newPage(); await p2.goto(O + "/?seed=7", { waitUntil: "load" }); await p2.waitForFunction(() => !!window.__zz);
  if (!(await p2.locator("#pick").isVisible())) { fast++; await toPick(p2, v); }
  await setPicks(p2, ["水", "日", "人"]); const go = p2.locator("#pick .go"); const n0 = await p2.evaluate(() => window.__zz.actions.filter(a => a.type === "begin_generation").length);
  const k = i % 2 ? "go_rapid3" : "go_single";
  if (i % 2) { const q = await ctr(go); await Promise.all([0, 1, 2].map(d => new Promise(r => setTimeout(r, d * 40)).then(() => p2.touchscreen.tap(q.x, q.y).catch(() => {})))); } else await go.tap();
  await p2.waitForTimeout(500); const n1 = await p2.evaluate(() => window.__zz.actions.filter(a => a.type === "begin_generation").length);
  ok(k, n1 - n0 === 1, `${i}:+${n1 - n0}`); await c2.close(); }
const s = await shot(p, "390_touch_end");
const L = { slot0: "选满后点第1格只少一个", slot1: "选满后点第2格只少一个", slot2: "选满后点第3格只少一个", "cand水": "点已选候选「水」只少一个", "cand日": "点已选候选「日」只少一个", "cand人": "点已选候选「人」只少一个",
  go_single: "「出发」单点只触发一次", go_rapid3: "「出发」快速连点3下只触发一次", mt_cand_同时: "P2-1 两指按两个已选候选同时松开各放回自己", mt_cand_先后: "P2-1 两指按两个已选候选先后松开各放回自己",
  mt_slot_同时: "P2-1 两指按第1/3格同时松开各放回自己", mt_slot_先后: "P2-1 两指按第1/3格先后松开各放回自己", mt_after_tap: "P2-1 两指松开后立即单指选字不被吞" };
for (const [k, lab] of Object.entries(L)) { const t = R[k]; if (!t) continue; rec(k.startsWith("mt") ? "P2-1" : "P1", `${lab} ×${t.n}`, "390", t.bad.length ? "FAIL" : "PASS", `丢/错/重=${t.bad.length}/${t.n} ${t.bad.slice(0, 8).join(" ")}`, s); }
if (!cdp) rec("P2-1", "两指分别按不同已选字（真多点触控）", "390", "部分验证", `${engine} 无 CDP 多点触控，未测；chromium 已测`, s);
if (fast) console.log("存档直进挑字失败次数", fast);
await c.close(); await B.close(); srv.kill();
fs.writeFileSync(`${OUT}/matrix_touch_${engine}.csv`, "block,item,engine,viewport,result,note,shot\n" + rows.map(r => r.join(",")).join("\n") + "\n"); process.exit(0);
