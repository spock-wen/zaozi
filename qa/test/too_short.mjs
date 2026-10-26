// R号: R15（可见高 <600 或宽 <360 只出「太矮」条，文案一字不差、在视口内、不挡 ☰、pointer-events:none；够高够宽不出）
// node too_short.mjs <engine> <WxH> <expect:must|mustnot|record> <baseURL> <outdir>
// 走首屏 + 刻字卡（T03）两个场景各判一次；每场景全屏截图。record = 只记录（PM T1：360x640、1280x600），判定 N/A。
import { chromium, firefox, webkit } from "playwright"; import fs from "node:fs";
const [engine, VP, EXPECT, BASE, OUT] = process.argv.slice(2); const [W, H] = VP.split("x").map(Number); const cfg = `${engine}_${VP}_${EXPECT}`;
const TEXT = "窗口太小，放大窗口更好玩"; fs.mkdirSync(`${OUT}/shots`, { recursive: true });
const touch = W < 600; const opt = { viewport: { width: W, height: H }, hasTouch: touch }; if (touch && engine !== "firefox") Object.assign(opt, { isMobile: true, deviceScaleFactor: 2 });
const B = await { chromium, firefox, webkit }[engine].launch(); const p = await (await B.newContext(opt)).newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));
await p.goto(`${BASE}/?seed=20261016`, { waitUntil: "load" }); await p.evaluate(() => localStorage.clear()); await p.goto(`${BASE}/?seed=20261016`, { waitUntil: "load" }); await p.waitForFunction(() => !!window.__zz); await p.waitForTimeout(900);
const probe = () => p.evaluate(({ W, H }) => { const e = document.getElementById("too-short"); const m = document.getElementById("menubtn");
  if (!e) return { exists: false, shown: false };
  const cs = getComputedStyle(e), r = e.getBoundingClientRect(); const shown = !e.hidden && cs.display !== "none" && cs.visibility !== "hidden" && +cs.opacity > 0 && r.width > 0 && r.height > 0;
  const mr = m ? m.getBoundingClientRect() : null; const overlapMenu = !!(mr && shown && r.left < mr.right && r.right > mr.left && r.top < mr.bottom && r.bottom > mr.top);
  return { exists: true, shown, text: e.textContent.trim(), pe: cs.pointerEvents, inVP: r.left >= -0.5 && r.top >= -0.5 && r.right <= W + 0.5 && r.bottom <= H + 0.5, overlapMenu, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)] }; }, { W, H });
const res = [];
for (const scene of ["首屏T01", "刻字卡T03"]) {
  if (scene === "刻字卡T03") { await p.evaluate(() => { __zz.dispatch({ type: "choose", side: "left" }); }).catch(() => {}); await p.waitForTimeout(500); await p.evaluate(() => { if (__zz.st.phase !== "engrave") __zz.dispatch({ type: "choose", side: "left" }); }).catch(() => {}); await p.waitForTimeout(800); }
  const pr = await probe(); const f = `shots/${cfg}_${scene}.png`; await p.screenshot({ path: `${OUT}/${f}`, fullPage: true }).catch(() => {});
  const okMust = pr.shown && pr.text === TEXT && pr.pe === "none" && pr.inVP && !pr.overlapMenu; const okNot = !pr.shown;
  const pass = EXPECT === "must" ? okMust : EXPECT === "mustnot" ? okNot : null;
  res.push({ scene, probe: pr, expect: EXPECT, pass, phase: await p.evaluate(() => __zz.st.phase), errs: errs.slice(), shots: [f] });
  console.log(pass === null ? "REC " : pass ? "PASS" : "FAIL", cfg, scene, JSON.stringify(pr));
}
fs.writeFileSync(`${OUT}/too_short_${cfg}.json`, JSON.stringify({ cfg, res }, null, 1)); await B.close();
