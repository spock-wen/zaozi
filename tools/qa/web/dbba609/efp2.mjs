// dbba609 新探针（矩形∩视口内缩 k 的中心）在视口右缘 [w-0.5,w) 不再误报。node efp2.mjs <port> <outdir> [runs=5]
// A 合成：元素中心 x 扫 389.0→390.5（步 0.02），无旋转 / 父级旋转 3°，旧探针（中心，cx<iw 即在屏）vs 新探针。
// B 实页：390×844 T03 入场中，暂停卡动画，currentTime 0→160 逐 1ms 扫，同一帧用旧/新探针各测一次。
import { chromium, firefox, webkit } from "playwright"; import { spawn } from "node:child_process"; import fs from "node:fs"; import path from "node:path";
const [PORT, OUT, R0] = process.argv.slice(2); const RUNS = +(R0 || 5); const HERE = path.dirname(new URL(import.meta.url).pathname); fs.mkdirSync(OUT, { recursive: true });
const rf = `${OUT}/root_efp2.txt`; fs.writeFileSync(rf, process.env.DIST); const srv = spawn("python3", [HERE + "/pages_server.py", String(PORT), rf], { stdio: "ignore" }); await new Promise(r => setTimeout(r, 700));
const PROBES = `window.__oldP = (el) => { const r = el.getBoundingClientRect(); const cx = r.x + r.width / 2, cy = r.y + r.height / 2; const on = r.width >= 1 && cx >= 0 && cx < innerWidth && cy >= 0 && cy < innerHeight; const e = on ? document.elementFromPoint(cx, cy) : null; return { cx, on, hit: !!(e && e.closest("#" + el.id)) }; };
window.__newP = (el) => { const r = el.getBoundingClientRect(); const k = 1 + 2 * Math.max(0, r.width - el.offsetWidth, r.height - el.offsetHeight); const L = Math.max(r.left, 0) + k, R = Math.min(r.right, innerWidth) - k, T = Math.max(r.top, 0) + k, B = Math.min(r.bottom, innerHeight) - k; const pt = r.width >= 1 && R > L && B > T ? [(L + R) / 2, (T + B) / 2] : null; const e = pt ? document.elementFromPoint(pt[0], pt[1]) : null; return { pt, on: !!pt, hit: !!(e && e.closest("#" + el.id)), offRight: r.left >= innerWidth - 2 * k }; };`;
const rows = []; const rec = (...r) => { rows.push(r.map(x => String(x).replace(/[\n,]/g, " "))); console.log(r.join(" ")); };
for (const [en, T] of Object.entries({ chromium, firefox, webkit })) { const b = await T.launch();
  // A
  for (const rot of [0, 3]) { const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    await p.setContent(`<style>body{margin:0}</style><div id=par style="position:fixed;left:0;top:200px;width:390px;height:60px;transform-origin:0 0;transform:rotate(${rot}deg)"><div id=bc style="position:absolute;top:0;width:46px;height:46px;background:#c00"></div></div><script>${PROBES}</script>`);
    const r = await p.evaluate(() => { let n = 0, oldBand = 0, oldFalse = 0, newFalse = 0, newOff = 0, newOffBad = 0; const bc = document.getElementById("bc");
      for (let c = 389.0; c <= 390.5001; c += 0.02) { bc.style.left = (c - 23) + "px"; const o = __oldP(bc), q = __newP(bc); n++;
        const cx = o.cx; if (cx >= innerWidth - 0.5 && cx < innerWidth) { oldBand++; if (o.on && !o.hit) oldFalse++; }
        if (q.on && !q.hit) newFalse++; if (!q.on) { newOff++; if (!q.offRight) newOffBad++; } }
      return { n, oldBand, oldFalse, newFalse, newOff, newOffBad }; });
    rec("A合成", en, `旋转${rot}°`, r.newFalse === 0 && r.newOffBad === 0 ? "PASS" : "FAIL", `扫${r.n}点；中心落[389.5,390)共${r.oldBand}点，旧探针误报${r.oldFalse}；新探针误报${r.newFalse}，判屏外${r.newOff}(其中非整块屏外${r.newOffBad})`); await p.close(); }
  // B
  let tot = { fr: 0, band: 0, oldFalse: 0, newFalse: 0, newOffBad: 0, newOn: 0 }; const errs = [];
  for (let i = 0; i < RUNS; i++) { const c = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true }); const p = await c.newPage();
    try { await p.goto(`http://localhost:${PORT}/?seed=7`, { waitUntil: "load" }); await p.waitForFunction(() => !!window.__zz); await p.evaluate(PROBES);
      await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowLeft"); await p.waitForFunction(() => !window.__zz.animating && window.__zz.st.current === "T02", null, { timeout: 5000 }); await p.waitForTimeout(300);
      await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowRight");
      await p.waitForFunction(() => !window.__zz.animating && window.__zz.st.phase === "engrave" && document.querySelector("#card").getAnimations().some(a => a.playState === "running"), null, { timeout: 5000, polling: "raf" });
      const r = await p.evaluate(() => { const card = document.querySelector("#card"), bc = document.querySelector("#bonecorner"); const an = card.getAnimations(); an.forEach(a => a.pause()); const D = Math.max(...an.map(a => Number(a.effect.getTiming().duration)));
        const o = { fr: 0, band: 0, oldFalse: 0, newFalse: 0, newOffBad: 0, newOn: 0, ex: [] };
        for (let t = 0; t <= D; t += 1) { an.forEach(a => a.currentTime = t); const A = __oldP(bc), B = __newP(bc); o.fr++; if (B.on) o.newOn++;
          if (A.cx >= innerWidth - 0.5 && A.cx < innerWidth) { o.band++; if (A.on && !A.hit) o.oldFalse++; }
          if (B.on && !B.hit) { o.newFalse++; if (o.ex.length < 3) o.ex.push(`t${t}:pt${B.pt.map(v => v.toFixed(2))}`); } if (!B.on && !B.offRight) o.newOffBad++; }
        an.forEach(a => a.finish()); return o; });
      for (const k of Object.keys(tot)) tot[k] += r[k]; if (r.ex.length) errs.push(...r.ex);
    } catch (e) { errs.push(`run${i}异常 ${e.message.split("\n")[0].slice(0, 80)}`); }
    await c.close(); }
  rec("B实页", en, `390×844 T03入场 currentTime逐1ms扫 ×${RUNS}`, tot.newFalse === 0 && tot.newOffBad === 0 && !errs.some(x => x.includes("异常")) ? "PASS" : "FAIL", `帧${tot.fr}；新探针在屏${tot.newOn}帧、误报${tot.newFalse}、非整块屏外却判屏外${tot.newOffBad}；中心落[389.5,390)帧${tot.band}，旧探针误报${tot.oldFalse} ${errs.slice(0, 3).join(" ")}`);
  await b.close(); }
fs.writeFileSync(`${OUT}/efp2.csv`, "块,引擎,项,判定,原因\n" + rows.map(r => r.join(",")).join("\n") + "\n"); srv.kill(); process.exit(0);
