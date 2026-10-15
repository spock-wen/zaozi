// ec61666 键位浮层：入场后弹出、3s 自可见起算、弹出时不压刻/教学目标/选项、6 条可见不滚动不出视口；点「?」手动。node pop3.mjs <engine> <port> <outdir> [N=10]
import { chromium, firefox, webkit } from "playwright"; import { spawn } from "node:child_process"; import fs from "node:fs"; import path from "node:path";
const [engine, PORT, OUT, N0] = process.argv.slice(2); const N = +(N0 || 10); const HERE = path.dirname(new URL(import.meta.url).pathname); fs.mkdirSync(OUT + "/shots", { recursive: true });
const rf = `${OUT}/root_pop3_${engine}.txt`; fs.writeFileSync(rf, process.env.DIST);
const srv = spawn("python3", [[HERE, HERE + "/.."].map(d => d + "/pages_server.py").find(f => fs.existsSync(f)), String(PORT), rf], { stdio: "ignore" }); await new Promise(r => setTimeout(r, 700));
const B = await { chromium, firefox, webkit }[engine].launch(); const rows = []; const rec = (...r) => { rows.push(r.map(x => String(x).replace(/[\n,]/g, " "))); console.log(r.join(" ")); };
const flush = () => fs.writeFileSync(`${OUT}/matrix_pop3_${engine}.csv`, "block,item,engine,viewport,result,note,shot\n" + rows.map(r => r.join(",")).join("\n") + "\n");
// 逐帧采样：浮层可见、卡是否入场中、浮层与刻/教学目标/选项是否相交、行/滚动/视口
const SAMPLER = () => { window.__ps = []; const t0 = performance.now();
  const tick = () => { const pop = document.querySelector("#keyhelp-pop"), card = document.querySelector("#card");
    if (pop && card && window.__zz) { const vis = !pop.hidden && getComputedStyle(pop).display !== "none" && pop.getBoundingClientRect().width > 0;
      const anim = !!window.__zz.animating || card.getAnimations().some(a => a.playState === "running");
      let ov = [], coach = "", rowsIn = 0, n = 0, sh = 0, ch = 0, inView = true;
      if (vis) { const p = pop.getBoundingClientRect(); const R = s => { const e = document.querySelector(s); if (!e || e.hidden || getComputedStyle(e).display === "none") return null; const r = e.getBoundingClientRect(); return r.width ? r : null; };
        const st = window.__zz.st; const cur = st.current || ""; const tgt = st.phase === "engrave" ? "#bonecorner" : (cur === "T04" ? "#wordbox-bar" : null);
        const list = [["#bonecorner", "刻"], ["#opt-left", "左选项"], ["#opt-right", "右选项"]]; if (tgt === "#wordbox-bar") list.push(["#wordbox-bar", "教学目标字匣"]); if (tgt === "#bonecorner") list.push(["#card-drops", "落字框"]);
        for (const [s, nme] of list) { const r = R(s); if (r && Math.min(p.right, r.right) - Math.max(p.left, r.left) > 0.5 && Math.min(p.bottom, r.bottom) - Math.max(p.top, r.top) > 0.5) ov.push(nme); }
        const rws = [...pop.querySelectorAll(".kh-row")]; n = rws.length; rowsIn = rws.filter(x => { const b = x.getBoundingClientRect(); return b.top >= p.top - 0.5 && b.bottom <= p.bottom + 0.5; }).length;
        { const r = R("#coach"); if (r && Math.min(p.right, r.right) - Math.max(p.left, r.left) > 0.5 && Math.min(p.bottom, r.bottom) - Math.max(p.top, r.top) > 0.5) coach = `${Math.round(Math.min(p.right, r.right) - Math.max(p.left, r.left))}x${Math.round(Math.min(p.bottom, r.bottom) - Math.max(p.top, r.top))}`; }
        sh = pop.scrollHeight; ch = pop.clientHeight; inView = p.left >= -0.5 && p.top >= -0.5 && p.right <= innerWidth + 0.5 && p.bottom <= innerHeight + 0.5; }
      window.__ps.push({ t: Math.round(performance.now() - t0), vis, anim, ov: ov.join("+"), coach, rowsIn, n, sh, ch, inView, cur: window.__zz.st.current, ph: window.__zz.st.phase }); }
    if (performance.now() - t0 < 60000) requestAnimationFrame(tick); };
  const go = () => requestAnimationFrame(tick); if (document.readyState === "loading") addEventListener("DOMContentLoaded", go); else go(); };
const segs = s => { const out = []; let cur = null; for (const x of s) { if (x.vis && !cur) cur = { on: x.t, frames: [] }; if (cur) { if (x.vis) cur.frames.push(x); else { cur.off = x.t; out.push(cur); cur = null; } } } if (cur) out.push(cur); return out; };
const badFrames = fr => { const b = []; for (const x of fr) { if (x.anim) b.push(`入场中可见@${x.t}`); if (x.ov) b.push(`压${x.ov}@${x.t}(${x.cur})`); if (x.rowsIn !== 6 || x.n !== 6) b.push(`行${x.rowsIn}/${x.n}@${x.t}`); if (x.sh > x.ch) b.push(`滚动${x.sh}/${x.ch}@${x.t}`); if (!x.inView) b.push(`出视口@${x.t}`); } return [...new Set(b.map(z => z.replace(/@\d+/, "")))].map(k => k + "×" + b.filter(z => z.replace(/@\d+/, "") === k).length); };
const commitK = async (p, d) => { const k = d === "left" ? "ArrowLeft" : "ArrowRight"; await p.keyboard.press(k); await p.keyboard.press(k); };
for (const [w, h] of [[1024, 600], [1024, 513], [1024, 491]]) { const vp = `${w}x${h}`;
  // A 自动弹出（首进）×N：入场后才可见、可见时长≈3000、可见期间各项
  const A = { n: 0, late: [], dur: [], bad: [], never: 0 };
  for (let i = 0; i < N; i++) { const c = await B.newContext({ viewport: { width: w, height: h } }); await c.addInitScript(SAMPLER); const p = await c.newPage();
    try { await p.goto(`http://localhost:${PORT}/?seed=7`, { waitUntil: "load" }); await p.waitForFunction(() => !!window.__zz); await p.waitForTimeout(4500);
      const s = await p.evaluate(() => window.__ps); const sg = segs(s); A.n++;
      if (!sg.length) { A.never++; A.bad.push(`${i}:未弹出`); }
      else { const g = sg[0]; const lastAnim = s.filter(x => x.anim && x.t <= g.on).at(-1); const d = (g.off ?? s.at(-1).t) - g.on; A.dur.push(d);
        if (Math.abs(d - 3000) > 150) A.bad.push(`${i}:可见${d}ms`); const bf = badFrames(g.frames); if (bf.length) A.bad.push(`${i}:${bf.join(" ")}`);
        A.late.push(lastAnim ? g.on - lastAnim.t : null); if (sg.length > 1) A.bad.push(`${i}:弹出${sg.length}次`); }
      if (i === 0) { await p.goto(`http://localhost:${PORT}/?seed=7`).catch(() => {}); }
    } catch (e) { A.bad.push(`${i}:异常 ${e.message.split("\n")[0].slice(0, 60)}`); }
    await c.close(); }
  // 截图：自动弹出可见时
  { const c = await B.newContext({ viewport: { width: w, height: h } }); const p = await c.newPage(); await p.goto(`http://localhost:${PORT}/?seed=7`, { waitUntil: "load" }); await p.waitForFunction(() => !!window.__zz);
    await p.waitForFunction(() => { const e = document.querySelector("#keyhelp-pop"); return e && !e.hidden && e.getBoundingClientRect().width > 0; }, null, { timeout: 5000 }).catch(() => {}); await p.screenshot({ path: `${OUT}/shots/${engine}_${vp}_pop3_auto.png` }); await c.close(); }
  const fa = `shots/${engine}_${vp}_pop3_auto.png`; const ds = A.dur.slice().sort((a, b) => a - b);
  rec("浮层时序", `首进自动弹出：入场结束后才可见、可见约3s（±150ms）后自收、只弹一次、可见期间不压刻/选项·6条可见·不滚动·不出视口 ×${A.n}`, engine, vp, A.bad.length ? "FAIL" : "PASS", `失败=${A.bad.length}/${A.n} 可见时长 ${ds[0]}–${ds.at(-1)}ms 入场结束→弹出 ${A.late.filter(x => x != null).map(x => x + "ms").slice(0, 5).join("/") || "首帧无入场"} ${A.bad.slice(0, 4).join(" ")}`, fa);
  flush();
  // B 手动点「?」：T01 / T03（刻）/ T04（落字），可见期间各项；之后提交 → 入场中隐去、入场后重现并 3s 自收
  for (const stepName of ["T01", "T03", "T04"]) { const M = { n: 0, bad: [], coach: [] }; let shotF = "";
    for (let i = 0; i < 3; i++) { const c = await B.newContext({ viewport: { width: w, height: h } }); await c.addInitScript(SAMPLER); const p = await c.newPage();
      try { await p.goto(`http://localhost:${PORT}/?seed=7`, { waitUntil: "load" }); await p.waitForFunction(() => !!window.__zz); await p.waitForTimeout(4500);   // 等首进自动弹出收起
        if (stepName !== "T01") { await commitK(p, "left"); await p.waitForTimeout(700); await commitK(p, "right"); await p.waitForTimeout(900); }
        if (stepName === "T04") { await p.locator("#bonecorner").click(); await p.waitForTimeout(900); }
        const cur = await p.evaluate(() => window.__zz.st.current + "/" + window.__zz.st.phase);
        const tOpen = await p.evaluate(() => { document.querySelector("#keyhelp-btn").click(); return Math.round(performance.now()); }); await p.waitForTimeout(400);
        if (i === 0) { shotF = `shots/${engine}_${vp}_pop3_click_${stepName}.png`; await p.screenshot({ path: `${OUT}/${shotF}` }); }
        await p.waitForTimeout(3300); const s = await p.evaluate(() => window.__ps); const sg = segs(s).filter(g => g.frames.length); const g = sg.at(-1); M.n++;
        if (!g) M.bad.push(`${i}:点「?」未出现(${cur})`); else { const bf = badFrames(g.frames); if (bf.length) M.bad.push(`${i}:${cur} ${bf.join(" ")}`); const cf = g.frames.filter(x => x.coach); if (cf.length) M.coach.push(`${i}:${cf[0].coach}×${cf.length}帧`); }
      } catch (e) { M.bad.push(`${i}:异常 ${e.message.split("\n")[0].slice(0, 60)}`); }
      await c.close(); }
    rec("浮层手动", `点「?」打开（${stepName}）：不压刻/当前教学目标/选项·6条可见·不滚动·不出视口 ×${M.n}`, engine, vp, M.bad.length ? "FAIL" : "PASS", `失败=${M.bad.length}/${M.n} ${M.bad.slice(0, 3).join(" ")} [观察·规格未列] 盖住教学气泡#coach: ${M.coach.length ? M.coach.join(" ") : "无"}`, shotF); flush(); }
  // C 手动打开后提交下一张：入场中不可见，入场后重现，重现后约 3s 自收
  { const C = { n: 0, bad: [] }; for (let i = 0; i < 3; i++) { const c = await B.newContext({ viewport: { width: w, height: h } }); await c.addInitScript(SAMPLER); const p = await c.newPage();
      try { await p.goto(`http://localhost:${PORT}/?seed=7`, { waitUntil: "load" }); await p.waitForFunction(() => !!window.__zz); await p.waitForTimeout(4500);
        await p.evaluate(() => document.querySelector("#keyhelp-btn").click()); await p.waitForTimeout(500); const tc = await p.evaluate(() => Math.round(performance.now()));
        await commitK(p, "left"); await p.waitForTimeout(4500); const s = await p.evaluate(() => window.__ps); C.n++;
        const animVis = s.filter(x => x.anim && x.vis).length; const sg = segs(s); const after = sg.filter(g => g.frames.some(x => x.cur === "T02"));
        if (animVis) C.bad.push(`${i}:入场中可见${animVis}帧`); if (!after.length) C.bad.push(`${i}:入场后未重现`); else { const g = after.at(-1); const d = (g.off ?? s.at(-1).t) - g.on; if (Math.abs(d - 3000) > 150) C.bad.push(`${i}:重现后可见${d}ms`); const bf = badFrames(g.frames); if (bf.length) C.bad.push(`${i}:${bf.join(" ")}`); }
      } catch (e) { C.bad.push(`${i}:异常 ${e.message.split("\n")[0].slice(0, 60)}`); }
      await c.close(); }
    rec("浮层时序", `手动打开后提交下一张：入场中隐去、入场后重现、重现后约3s自收 ×${C.n}`, engine, vp, C.bad.length ? "FAIL" : "PASS", `失败=${C.bad.length}/${C.n} ${C.bad.slice(0, 3).join(" ")}`, ""); flush(); } }
await B.close(); srv.kill(); flush(); process.exit(0);
