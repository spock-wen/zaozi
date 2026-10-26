// R号: R08（排队 K/S 进刻字卡后 ≥落定+250ms 才执行）+ R02
// 刻字卡停留窗口内现场 K：T02 飞出中排 →→（排队键进刻字卡），T03 落定后立即按 K / 点骨片 → 须排在队后，T03 独立落定 ≥230ms 后才刻（carveBusy 看队列）。
// node carve_dwell.mjs <engine> <baseURL> <outjson> [desk|touch]
import { chromium, firefox, webkit } from "playwright"; import fs from "node:fs";
const [engine, BASE, OUTJ, LEG] = process.argv.slice(2); const touch = LEG === "touch";
const B = await { chromium, firefox, webkit }[engine].launch(); const ctx = await B.newContext(touch ? { viewport: { width: +(process.env.VP_TOUCH || "390x844").split("x")[0], height: +(process.env.VP_TOUCH || "390x844").split("x")[1] }, hasTouch: true, isMobile: engine !== "firefox", deviceScaleFactor: 3 } : { viewport: { width: +(process.env.VP_DESK || "1280x800").split("x")[0], height: +(process.env.VP_DESK || "1280x800").split("x")[1] } }); const p = await ctx.newPage(); const res = [];
const still = async () => { await p.waitForFunction(() => !__zz.animating && !(__zz.queued > 0) && !document.getElementById("card").getAnimations().some((a) => a.playState === "running"), null, { timeout: 9000, polling: 30 }).catch(() => {}); await p.waitForTimeout(400); };
const ctr = (s) => p.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, s);
await p.goto(`${BASE}/?seed=20261016`); await p.evaluate(() => localStorage.clear()); await p.goto(`${BASE}/?seed=20261016`); await p.waitForFunction(() => !!window.__zz); await p.waitForTimeout(800);
const codes = {}; for (let i = 0; i < 3; i++) { await still(); const z = await p.evaluate(() => ({ cur: __zz.st.current, c: __zz.code() })); codes[z.cur] = z.c; if (z.cur === "T03") break; const L = await ctr("#opt-left"); touch ? await p.touchscreen.tap(L[0], L[1]) : await p.mouse.click(L[0], L[1]); }
for (const how of ["K", "K", "K", "骨片", "骨片"]) {
  await p.evaluate((c) => __zz.importCode(c), codes.T02); await p.waitForTimeout(300); await still();
  await p.evaluate(() => { const M = window.__M = { fr: [], on: true }; let pn = __zz.actions.length; const loop = () => { if (!M.on) return; const n = __zz.actions.length; M.fr.push({ t: performance.now(), a: !!(__zz.animating || document.getElementById("card").getAnimations().some((x) => x.playState === "running")), n, cur: __zz.st.current, last: (__zz.actions[n - 1] || {}).type || (__zz.actions[n - 1] || {}).side }); requestAnimationFrame(loop); }; requestAnimationFrame(loop); });
  await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(50); await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowRight");
  await p.waitForFunction(() => __zz.st.current === "T03" && !__zz.animating && !document.getElementById("card").getAnimations().some((a) => a.playState === "running"), null, { timeout: 4000, polling: "raf" }).catch(() => {});
  await p.waitForTimeout(+(process.env.DELAY || 0)); const q0 = await p.evaluate(() => __zz.queued); const tK = await p.evaluate(() => performance.now());
  if (how === "K") await p.keyboard.press("k"); else { const c = await ctr("#bonecorner"); touch ? await p.touchscreen.tap(c[0], c[1]) : await p.mouse.click(c[0], c[1]); }
  const q1 = await p.evaluate(() => __zz.queued); await p.waitForTimeout(1200);
  const g = await p.evaluate(() => { window.__M.on = false; return window.__M.fr; });
  let settle = null; for (const f of g) { if (f.cur !== "T03") continue; if (f.a) settle = null; else if (settle === null) settle = f.t; if (f.t >= tK) break; }
  const eng = g.find((f, i) => i > 0 && f.n > g[i - 1].n && /engrave/.test(f.last || ""));
  const r = { how, queuedBefore: q0, queuedAfter: q1, kAfterSettle: settle ? Math.round(tK - settle) : null, engraveAfterSettle: eng && settle ? Math.round(eng.t - settle) : null, toasts: await p.evaluate(() => document.getElementById("toast").textContent) };
  r.pass = r.engraveAfterSettle !== null && r.engraveAfterSettle >= 230; res.push(r); console.log(r.pass ? "PASS" : "FAIL", engine, LEG || "desk", JSON.stringify(r));
}
await p.screenshot({ path: OUTJ.replace(".json", ".png"), fullPage: true }); fs.writeFileSync(OUTJ, JSON.stringify(res, null, 1)); await B.close();
