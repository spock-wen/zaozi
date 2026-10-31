// R号: E1-D4（restore() 渲染出错不得删存档）+ R21（存档不丢）
// D4：restore() 内 render() 在 try 里——启动渲染抛错时是否误删存档。
// node d4_restore.mjs <engine> <WxH> <desk|touch> <baseURL> <outdir>
// 1) seed 20261016 打到 T03（两次点左）→ 记 localStorage 全部键值；2) page.addInitScript 劫持 document.getElementById：首次取 "dims"（render() 第 4 行 patchHTML($("dims"))）时 throw，刷新；
// 3) 记异常后 localStorage；4) 同一 context 开新页（无注入，等于去掉注入再刷新）→ 记局面与 localStorage。每步全屏截图。
import { chromium, firefox, webkit } from "playwright"; import fs from "node:fs";
const [engine, VP, MODE, BASE, OUT] = process.argv.slice(2); const [W, H] = VP.split("x").map(Number); const cfg = `${engine}_${VP}_${MODE}`;
fs.mkdirSync(`${OUT}/shots`, { recursive: true }); const touch = MODE !== "desk";
const opt = { viewport: { width: W, height: H }, hasTouch: touch }; if (touch) Object.assign(opt, engine === "firefox" ? { deviceScaleFactor: 3 } : { isMobile: true, deviceScaleFactor: 3 });
const B = await { chromium, firefox, webkit }[engine].launch(); const ctx = await B.newContext(opt);
const ls = (p) => p.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])));
const state = (p) => p.evaluate(() => window.__zz ? { cur: __zz.st.current, ph: __zz.st.phase, n: __zz.actions.length, toast: document.getElementById("toast")?.textContent.trim() } : null);
const shot = async (p, n) => { const f = `shots/${cfg}_${n}.png`; await p.screenshot({ path: `${OUT}/${f}`, fullPage: true }).catch(() => {}); return f; };
let p = await ctx.newPage(); const errs1 = []; p.on("pageerror", (e) => errs1.push(e.message.slice(0, 160)));
await p.goto(`${BASE}/?seed=20261016`, { waitUntil: "load" }); await p.evaluate(() => localStorage.clear()); await p.goto(`${BASE}/?seed=20261016`, { waitUntil: "load" }); await p.waitForFunction(() => !!window.__zz); await p.waitForTimeout(900);
for (let i = 0; i < 2; i++) { await p.waitForFunction(() => !__zz.animating && !(__zz.queued > 0)); await p.waitForTimeout(400);
  const cut = await p.evaluate(() => { const e = document.getElementById("cutscene"); return !!e && !e.hidden; }); if (cut) await p.locator("#cut-continue").click();
  const c = await p.evaluate(() => { const r = document.getElementById("opt-left").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); touch ? await p.touchscreen.tap(c[0], c[1]) : await p.mouse.click(c[0], c[1]); }
await p.waitForTimeout(1200); const before = await ls(p); const stBefore = await state(p); const f1 = await shot(p, "1_前");
await p.addInitScript(() => { const orig = Document.prototype.getElementById; let hit = 0; window.__d4 = { thrown: 0 };
  Document.prototype.getElementById = function (id) { if (id === "dims" && !hit) { hit = 1; window.__d4.thrown = 1; throw new Error("D4 注入的渲染异常"); } return orig.call(this, id); }; });
const errs2 = []; p.on("pageerror", (e) => errs2.push(e.message.slice(0, 160)));
await p.reload({ waitUntil: "load" }); await p.waitForTimeout(1500);
const thrown = await p.evaluate(() => window.__d4?.thrown || 0); const after = await ls(p); const stAfter = await state(p); const f2 = await shot(p, "2_异常后");
await p.close(); p = await ctx.newPage(); const errs3 = []; p.on("pageerror", (e) => errs3.push(e.message.slice(0, 160)));
await p.goto(`${BASE}/?seed=20261016`, { waitUntil: "load" }); await p.waitForFunction(() => !!window.__zz); await p.waitForTimeout(1500);
const rec = await ls(p); const stRec = await state(p); const f3 = await shot(p, "3_去注入恢复后");
const KEY = Object.keys(before).find((k) => !/keyhelp|mute|\.bak$/.test(k) && /save|zaozi/.test(k)) || null;
const keptSame = KEY && after[KEY] === before[KEY]; const recovered = stRec && stBefore && stRec.cur === stBefore.cur && stRec.n === stBefore.n;
const pass = thrown === 1 && keptSame && recovered;
const r = { cfg, thrown, saveKey: KEY, before: { st: stBefore, ls: before }, afterError: { st: stAfter, ls: after, errs: errs2 }, recovered: { st: stRec, ls: rec, errs: errs3 }, keptSame, recoveredSame: recovered, pass, shots: [f1, f2, f3] };
fs.writeFileSync(`${OUT}/d4_${cfg}.json`, JSON.stringify(r, null, 1));
console.log((thrown ? (pass ? "PASS" : "FAIL") : "INVAL"), cfg, "key", KEY, "| 前", JSON.stringify(stBefore), "| 异常后 key在=" + (KEY in after) + " 同=" + keptSame + " .bak=" + Object.keys(after).filter((k) => /\.bak$/.test(k)).length, JSON.stringify(stAfter), "| 恢复后", JSON.stringify(stRec), "keys", Object.keys(rec).join(","), "| errs", errs2.join(";"));
await B.close();
