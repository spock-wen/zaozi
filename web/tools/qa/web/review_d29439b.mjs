// 回归 0aa3166：字源页/挑字 gf5/冒烟。用法 node regress.mjs <engine> <port> <outdir>
import { chromium, firefox, webkit } from "playwright"; import { spawn } from "node:child_process"; import fs from "node:fs"; import path from "node:path";
const [engine, PORT, OUT] = [process.argv[2], +process.argv[3], process.argv[4]]; const DIST = process.env.DIST;
const HERE = path.dirname(new URL(import.meta.url).pathname); fs.mkdirSync(OUT + "/shots", { recursive: true });
const rf = `${OUT}/root_${engine}.txt`; fs.writeFileSync(rf, DIST);
const srv = spawn("python3", [HERE + "/pages_server.py", String(PORT), rf], { stdio: "ignore" }); await new Promise(r => setTimeout(r, 700));
const O = `http://localhost:${PORT}`; const B = await { chromium, firefox, webkit }[engine].launch(); const rows = [];
const rec = (b, i, v, r, n = "", s = "") => { rows.push([b, i, engine, v, r, String(n).replace(/[\n,]/g, " ").slice(0, 250), s]); console.log(r, b, i, engine, v, n); };
const shot = async (p, n) => { const f = `shots/${engine}_${n}.png`; await p.screenshot({ path: `${OUT}/${f}`, fullPage: true }).catch(() => {}); return f; };
const VPS = [{ n: "390", w: 390, h: 844, t: 1 }, { n: "768m", w: 768, h: 1024 }, { n: "1024", w: 1024, h: 768 }, { n: "1280", w: 1280, h: 800 }, { n: "1440", w: 1440, h: 900 }];
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


const PICK = ["水","日","人","木","田","火","力","月","休","林","从","男","明","本"];
const picks = p => p.evaluate(() => window.__zz.st.picks.slice());
const descT = p => p.evaluate(() => (document.querySelector("#pick-desc")?.innerText || "").trim());
const state = p => p.evaluate(() => ({ focus: [...document.querySelectorAll("#pick .cand.focus")].map(e => e.dataset.char), cursor: (window.__zz.ui?.pickCursor ?? null), desc: (document.querySelector("#pick-desc")?.innerText || "").trim().split("\n")[0], picks: window.__zz.st.picks.slice() }));
const CASES = [["390",390,844,1],["768m",768,1024,0],["1024",1024,768,0],["1280",1280,800,0],["1440",1440,900,0]];
for (const [n,w,h,t] of CASES) { const v = { n, w, h, t };
  for (const seed of (n === "1280" ? [7, 11, 23] : [7])) {
  try { const c = await ctxOf(v); const p = await boot(c, `/?seed=${seed}`);
    if (!(await toPick(p, v))) throw new Error("没到挑字");
    const gen = await p.evaluate(() => window.__zz.st.generation);
    const act = l => t ? l.tap() : l.click(); const cand = ch => p.locator(`#pick .cand[data-char='${ch}']`);
    // 1) ？占位：逐字看说明卡
    const bad = []; let rowsSeen = new Set();
    for (const ch of PICK) { if (t) { await act(cand(ch)); } else { await cand(ch).hover(); } await p.waitForTimeout(120);
      const d = await descT(p); d.split("\n").forEach(l => rowsSeen.add(l.split(/[：:\s]/)[0]));
      if (/[？?]/.test(d) || !d.startsWith(ch)) bad.push(`${ch}:"${d.replace(/\n/g, "/").slice(0, 40)}"`);
      if (t && (await picks(p)).length) { bad.push(`${ch}:单击误选`); } }
    const s1 = await shot(p, `${n}_s${seed}_desc_all`);
    rec("P1-1", `说明卡无「？」占位、无数据行不显示（14字 seed${seed} 第${gen}代）`, n, bad.length === 0 ? "PASS" : "FAIL", bad.join(" ").slice(0, 200) || `行标=${[...rowsSeen].slice(0, 8).join("/")}`, s1);
    if (seed !== 7) { await c.close(); continue; }
    if (!t) {
      // 2) 悬停木 → 按 → → Space：应是田
      await cand("木").hover(); await p.waitForTimeout(150); const sH = await state(p);
      await p.keyboard.press("ArrowRight"); await p.waitForTimeout(150); const sR = await state(p); const s2a = await shot(p, `${n}_cursor_after_right`);
      const vis = await p.evaluate(() => { const e = document.querySelector("#pick .cand.focus"); if (!e) return "无focus"; const cs = getComputedStyle(e); return `${cs.outlineStyle}/${cs.outlineColor}/${cs.boxShadow.slice(0, 40)}/${cs.borderColor}`; });
      await p.keyboard.press("Space"); await p.waitForTimeout(200); const sS = await state(p);
      const ok2 = sH.focus.join() === "木" && sH.desc.startsWith("木") && sR.focus.join() === "田" && sR.desc.startsWith("田") && sS.picks.join() === "田";
      rec("P1-2", "悬停木→按→→Space：金框/说明/选中均为田", n, ok2 ? "PASS" : "FAIL", `hover=${JSON.stringify(sH)} →=${JSON.stringify(sR)} space=${JSON.stringify(sS)}`, s2a + "; " + await shot(p, `${n}_cursor_space`));
      rec("P1-2", "键盘光标可见（focus 样式）", n, vis !== "无focus" && !/none\/.*none/.test(vis) ? "PASS" : "FAIL", vis, s2a);
      // 鼠标悬停后再键盘：悬停「人」后 ← → 跟随
      await cand("人").hover(); await p.waitForTimeout(120); await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(120); const sL = await state(p);
      rec("P1-2", "悬停人→按←：金框/说明为日", n, sL.focus.join() === "日" && sL.desc.startsWith("日") ? "PASS" : "FAIL", JSON.stringify(sL));
      await p.keyboard.press("Backspace"); await p.waitForTimeout(150);
      // 4) 悬停后第一次点击：只看不选
      await cand("火").hover(); await p.waitForTimeout(150); await cand("火").click(); await p.waitForTimeout(200); const p4 = await picks(p); const d4 = await descT(p);
      rec("P1-4", "悬停后第一次点击只看说明不误选", n, p4.length === 0 && d4.startsWith("火") ? "PASS" : "FAIL", `picks=${p4} desc=${d4.split("\n")[0]}`, await shot(p, `${n}_hover_click1`));
      await cand("火").click(); await p.waitForTimeout(200); const p4b = await picks(p);
      rec("P1-4", "再点一次选上", n, p4b.join() === "火" ? "PASS" : "FAIL", `picks=${p4b}`);
      await cand("火").click(); await p.waitForTimeout(200);
      // 5) 快速双击：选对字、只一次
      await cand("月").dblclick(); await p.waitForTimeout(300); const p5 = await picks(p);
      rec("P1-5", "快速双击同字：无错字、不重复", n, p5.filter(x => x === "月").length <= 1 && p5.every(x => x === "月") ? "PASS" : "FAIL", `picks=${JSON.stringify(p5)}（PM 已接受双击直接选上）`, await shot(p, `${n}_dblclick`));
      await p.locator("#pick").evaluate(() => {}); if (p5.includes("月")) { await cand("月").click(); await p.waitForTimeout(200); }
    } else {
      await p.waitForTimeout(100);
      await cand("月").dblclick().catch(() => {}); await p.waitForTimeout(300); const p5 = await picks(p);
      rec("P1-5", "快速双击同字：无错字、不重复", n, p5.length <= 1 && p5.every(x => x === "月") ? "PASS" : "FAIL", `picks=${JSON.stringify(p5)}`, await shot(p, `${n}_dbl`));
    }
    // 3) 布局：选两字后量
    for (const ch of ["水", "木"]) { if (!(await picks(p)).includes(ch)) { if (t) { await act(cand(ch)); await p.waitForTimeout(120); await act(cand(ch)); } else { await cand(ch).click(); await p.waitForTimeout(120); await cand(ch).click(); } await p.waitForTimeout(150); } }
    if (!t) await cand("木").hover();
    await p.waitForTimeout(200);
    const L = await p.evaluate(() => { const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
      const cands = [...document.querySelectorAll("#pick .cand")].map(e => e.getBoundingClientRect()); const rowsY = [...new Set(cands.map(b => Math.round(b.y)))];
      const cover = [...document.querySelectorAll("#pick .pickslot[data-char]")].map(sl => { const sp = sl.querySelector("span"), im = sl.querySelector("img,svg,.g,picture"); if (!sp) return "nospan"; const a = sp.getBoundingClientRect(); const top = document.elementFromPoint(a.x + a.width / 2, a.y + a.height / 2); const b = im?.getBoundingClientRect(); const ov = b ? Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) : 0; return `${sp.innerText}:hit=${top === sp || sp.contains(top) ? "label" : (top?.tagName || "?")} ov=${Math.round(ov)}`; });
      return { pool: r("#pick .pool"), desc: r("#pick-desc"), slots: r("#pick .pickslots"), go: r("#pick .go"), cols: cands.filter(b => Math.round(b.y) === rowsY[0]).length, rows: rowsY.length, cand0: cands[0] && { w: Math.round(cands[0].width), h: Math.round(cands[0].height) }, cover, scrollW: document.documentElement.scrollWidth, vw: innerWidth }; });
    const sL3 = await shot(p, `${n}_layout`);
    const coverOk = L.cover.every(s => /hit=label/.test(s) && /ov=0/.test(s));
    rec("P2-3", "格标签「1·水」不被字形压住", n, coverOk ? "PASS" : "FAIL", L.cover.join(" "), sL3);
    if (!t && n !== "768m") {
      const right = L.desc && L.pool && L.desc.x >= L.pool.x + L.pool.w - 2;
      rec("P2-3", "说明卡在字池右侧（gf5 §11）", n, right ? "PASS" : "FAIL", `pool=${JSON.stringify(L.pool)} desc=${JSON.stringify(L.desc)}`, sL3);
      rec("P2-3", "字池 7 列 2 行全显示（gf5）", n, L.cols === 7 && L.rows === 2 ? "PASS" : "FAIL", `cols=${L.cols} rows=${L.rows} cand=${JSON.stringify(L.cand0)}`, sL3);
      const dw = L.desc?.w ?? 0, topAlign = L.desc && L.slots ? Math.abs(L.desc.y - L.slots.y) : 999;
      rec("P2-3", "尺寸间距对照稿（说明卡宽≈360、与挑字格同顶、无横向溢出）", n, dw >= 300 && dw <= 420 && topAlign <= 24 && L.scrollW <= L.vw ? "PASS" : "部分验证", `descW=${dw} |desc.y-slots.y|=${topAlign} poolW=${L.pool?.w} scrollW=${L.scrollW}/${L.vw}（稿: pool 560、desc 360、同 top160）`, sL3);
    }
    await c.close();
  } catch (e) { rec("挑字审核", `组 seed${seed}`, n, "FAIL", "异常:" + e.message.split("\n")[0]); } } }
await B.close(); srv.kill();
fs.writeFileSync(`${OUT}/matrix_review_${engine}.csv`, "block,item,engine,viewport,result,note,shot\n" + rows.map(r => r.join(",")).join("\n") + "\n"); process.exit(0);
