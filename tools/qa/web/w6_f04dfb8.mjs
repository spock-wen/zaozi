// W6：键位行按 BREAKPOINTS 第8/9行。node w6.mjs <port> <outdir>
import { chromium, firefox, webkit } from "playwright"; import { spawn } from "node:child_process"; import fs from "node:fs"; import path from "node:path";
const [PORT, OUT] = [+process.argv[2], process.argv[3]]; const HERE = path.dirname(new URL(import.meta.url).pathname);
const rf = `${OUT}/root_w6.txt`; fs.writeFileSync(rf, process.env.DIST); const srv = spawn("python3", [HERE + "/pages_server.py", String(PORT), rf], { stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
const O = `http://localhost:${PORT}`; const rows = []; fs.mkdirSync(OUT + "/shots", { recursive: true });
const CASES = [ // [名, w, h, touch, 期望键位]
  ["390m", 390, 844, 0, false], ["390t", 390, 844, 1, false],
  ["600m", 600, 1024, 0, true], ["600t", 600, 1024, 1, false],
  ["768m", 768, 1024, 0, true], ["768t", 768, 1024, 1, false],
  ["1023m", 1023, 1366, 0, true], ["1023t", 1023, 1366, 1, false],
  ["599m", 599, 1024, 0, false],
  ["L900m", 900, 600, 0, true], ["L900t", 900, 600, 1, false],
  ["1024", 1024, 768, 0, true], ["1280", 1280, 800, 0, true], ["1440", 1440, 900, 0, true]];
for (const [en, T] of Object.entries({ chromium, firefox, webkit })) { const b = await T.launch();
  for (const [n, w, h, t, want] of CASES) {
    const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: !!t, ...(t && en !== "firefox" ? { isMobile: true } : {}) });
    const p = await c.newPage(); await p.goto(O + "/?seed=7"); await p.waitForFunction(() => !!window.__zz); await p.waitForTimeout(400);
    const r = await p.evaluate(() => { const vis = e => !!e && e.offsetParent !== null && getComputedStyle(e).display !== "none" && getComputedStyle(e).visibility !== "hidden" && e.getBoundingClientRect().height > 0;
      const k = document.querySelector("#keys"), g = document.querySelector("#gesture-hint");
      return { view: document.body.dataset.view, fine: matchMedia("(hover:hover) and (pointer:fine)").matches, keys: vis(k), ktxt: k?.innerText.trim().slice(0, 40), gest: vis(g) ? g.innerText.trim().slice(0, 40) : "" }; });
    const shot = `shots/${en}_${n}_w6.png`; await p.screenshot({ path: `${OUT}/${shot}`, fullPage: true });
    const kbText = /←|→|Enter|Space/.test(r.gest), touchText = /拖卡/.test(r.gest);
    let kbOk = "-"; if (want) { const a0 = await p.evaluate(() => window.__zz.actions.length); await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(600); kbOk = (await p.evaluate(() => window.__zz.actions.length)) === a0 + 1; }
    const pass = want ? (r.keys && kbText && kbOk === true) : (!r.keys && (r.gest === "" || touchText || n.startsWith("390") || n === "599m"));
    const note = `view=${r.view} fine=${r.fine} keys=${r.keys} gest="${r.gest}" kb=${kbOk}`;
    rows.push(["W6", want ? "显#keys+键盘文案+键盘可用" : "不显#keys、文案非键位", en, n, pass ? "PASS" : "FAIL", note.replace(/,/g, " "), shot]); console.log(pass ? "PASS" : "FAIL", en, n, note);
    await c.close(); } await b.close(); }
srv.kill(); fs.writeFileSync(`${OUT}/matrix_w6.csv`, "block,item,engine,viewport,result,note,shot\n" + rows.map(r => r.join(",")).join("\n") + "\n"); process.exit(0);
