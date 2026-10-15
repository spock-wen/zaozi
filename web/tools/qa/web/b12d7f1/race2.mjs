// W8 回归 b12d7f1：pointerup 选字。用法 node race2.mjs <engine> <port> <outdir> [N=20]
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
const CASES = [["1280",1280,800,0],["390",390,844,1]];
for (const [n,w,h,t] of CASES) { const v = { n, w, h, t };
  try { const c = await ctxOf(v); const p = await boot(c);
    if (!(await toPick(p, v))) throw new Error("没到挑字");
    const cdp = t && engine === "chromium" ? await c.newCDPSession(p) : null; const weak = t && !cdp;
    const cand = ch => p.locator(`#pick .cand[data-char='${ch}']`); const act = l => t ? l.tap() : l.click();
    const ctr = async ch => { const b = await cand(ch).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
    const tch = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y]) => ({ x, y })) });
    let clearFail = 0;
    const clear = async () => { for (let k = 0; k < 4; k++) { const ps = await picks(p); if (!ps.length) return; for (const ch of ps) { await act(cand(ch)); await p.waitForTimeout(80); } } if ((await picks(p)).length) clearFail++; await p.evaluate(() => { for (const ch of window.__zz.st.picks.slice()) window.__zz.dispatch?.({ type: "pick_toggle", char: ch }); }).catch(() => {}); };
    // 按住 ms（鼠标：down/wait/up；触屏：CDP touch 或弱化 tap）
    const hold = async (ch, ms, to) => { const [x, y] = await ctr(ch); const [x2, y2] = to ? (typeof to === "string" ? await ctr(to) : to) : [x, y];
      if (!t) { await p.mouse.move(x, y); await p.mouse.down(); await p.waitForTimeout(ms); if (to) await p.mouse.move(x2, y2, { steps: 6 }); await p.mouse.up(); }
      else if (cdp) { await tch("touchStart", [[x, y]]); await p.waitForTimeout(ms); if (to) for (let s = 1; s <= 6; s++) await tch("touchMove", [[x + (x2 - x) * s / 6, y + (y2 - y) * s / 6]]); await tch("touchEnd", []); }
      else { if (to) return "skip"; await p.waitForTimeout(ms); await cand(ch).tap(); } };
    const R = {}; const bad = (k, i, s) => { (R[k] ||= []).push(`${i}:${s}`); }; const tally = k => (R[k] ||= []);
    for (let i = 0; i < N; i++) {
      await clear(); await p.waitForTimeout(100);
      // A 放回后立刻再选
      await act(cand("水")); await act(cand("水")); await p.waitForTimeout(60); await act(cand("水")); await act(cand("水")); await act(cand("水")); await p.waitForTimeout(150);
      { const ps = await picks(p); tally("A"); if (ps.join() !== "水") bad("A", i, ps); }
      // B 一下看说明后按住 650 抬起
      await act(cand("日")); await p.waitForTimeout(50); await hold("日", 650); await p.waitForTimeout(150);
      { const ps = await picks(p); tally("B"); if (ps.join() !== "水,日") bad("B", i, ps); }
      // C 快速5下
      for (const k of [0,1,2,3,4]) { await act(cand("人")); await p.waitForTimeout(40); } await p.waitForTimeout(200);
      { const ps = await picks(p); tally("C"); if (ps.join() !== "水,日,人") bad("C", i, ps); }
      // 按住 0/300/650/1000：先一下看，再按住第二下 → 选中且只一次
      for (const ms of [0, 300, 650, 1000]) { await clear(); await act(cand("木")); await p.waitForTimeout(50); await hold("木", ms); await p.waitForTimeout(150);
        const ps = await picks(p); tally("H" + ms); if (ps.join() !== "木") bad("H" + ms, i, ps); }
      // 拖到另一字松开：不选错、不选两个（期望空）
      await clear(); await act(cand("田")); await p.waitForTimeout(50);
      if ((await hold("田", 120, "火")) === "skip") tally("DRAG").skip = 1; else { await p.waitForTimeout(150); const ps = await picks(p); tally("DRAG"); if (ps.includes("火") || ps.length > 1) bad("DRAG", i, ps); else if (ps.length) bad("DRAG-soft", i, ps); }
      // 拖出字外松开：不选中
      await clear(); await act(cand("月")); await p.waitForTimeout(50);
      if ((await hold("月", 120, [5, h - 5])) === "skip") tally("OUT").skip = 1; else { await p.waitForTimeout(150); const ps = await picks(p); tally("OUT"); if (ps.length) bad("OUT", i, ps); }
      // 双击只选一次
      await clear(); if (t) { await cand("力").tap(); await p.waitForTimeout(30); await cand("力").tap(); } else await cand("力").dblclick(); await p.waitForTimeout(200);
      { const ps = await picks(p); tally("DBL"); if (ps.join() !== "力") bad("DBL", i, ps); }
      // 键盘（仅桌面）：鼠标点过候选后 Space 切换焦点字一次、Enter（未满）不改
      if (!t) { await clear(); await cand("林").click(); await cand("林").click(); await p.waitForTimeout(100);
        await p.keyboard.press("Space"); await p.waitForTimeout(120); const s1 = await picks(p);
        await p.keyboard.press("Space"); await p.waitForTimeout(120); const s2 = await picks(p);
        await p.keyboard.press("Enter"); await p.waitForTimeout(150); const s3 = await picks(p); const ph3 = await ph(p);
        tally("KB"); if (s1.join() !== "" || s2.join() !== "林" || s3.join() !== "林" || ph3 !== "pick") bad("KB", i, `${s1}|${s2}|${s3}|${ph3}`); }
    }
    const s = await shot(p, `${n}_w8_end`);
    const LBL = { A: "A 放回后立刻再选", B: "B 一下后按住650ms抬起", C: "C 快速连续5下", H0: "按住0ms", H300: "按住300ms", H650: "按住650ms", H1000: "按住1000ms", DRAG: "按下拖到另一字松开（不错选/不选两个）", OUT: "按下拖出字外松开（不选中）", DBL: "双击只选一次", KB: "键盘 Space/Enter 不受影响（鼠标点后）" };
    for (const k of Object.keys(LBL)) { if (!R[k]) continue; const f = R[k]; const holdish = /^(B|H|DRAG|OUT)/.test(k);
      const soft = k === "DRAG" ? (R["DRAG-soft"] || []) : [];
      let res = f.length ? "FAIL" : "PASS"; let item = `${LBL[k]} ×${N}`; let note = `错/丢/重=${f.length}/${N} ${f.join(" ")}`;
      if (f.skip) { res = "部分验证"; item += "（非CDP触屏无法拖动，未测）"; note = "无 CDP touch"; }
      else if (weak && holdish && !f.length) { res = "部分验证"; item += "（非CDP：等待后tap，弱化）"; }
      if (soft.length) note += ` 选中起点字=${soft.length}次 ${soft.join(" ")}`;
      rec("W8", item, n, res, note, s); }
    rec("W8", `清理（放回）点击 ×${N}`, n, clearFail ? "FAIL" : "PASS", `放回失败=${clearFail}`, s);
    await c.close();
  } catch (e) { rec("W8", "组", n, "FAIL", "异常:" + e.message.split("\n")[0]); } }
await B.close(); srv.kill();
fs.writeFileSync(`${OUT}/matrix_w8_${engine}.csv`, "block,item,engine,viewport,result,note,shot\n" + rows.map(r => r.join(",")).join("\n") + "\n"); process.exit(0);
