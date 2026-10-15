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

const picks = p => p.evaluate(() => window.__zz.st.picks.slice());
const desc = p => p.evaluate(() => { const d = document.querySelector("#pick .pickdesc, #pick-desc, #pick .desc, #pick [class*=info]"); return d ? d.innerText.trim() : ""; });
for (const v of VPS) {
  const touch = !!v.t;
  // 字源页 + W1
  try { const c = await ctxOf(v); const p = await boot(c);
    const act = (l) => touch ? l.tap() : l.click();
    await act(p.locator("#menubtn")); await p.waitForTimeout(200); const nav = p.waitForNavigation({ timeout: 5000 }).then(() => 1, () => 0);
    await act(p.locator("#menu-pop a[href*=credits]")); const ok = await nav; await p.waitForLoadState("load");
    const t = await p.evaluate(() => document.body.innerText); const s = await shot(p, `${v.n}_credits`);
    rec("W1", "菜单进字源页", v.n, ok && /\/credits/.test(p.url()) ? "PASS" : "FAIL", p.url().replace(O, ""), s);
    rec("字源页", "无内部路径+Sears", v.n, !/glyph\/|\.csv/.test(t) && /Richard Sears/.test(t) ? "PASS" : "FAIL", "", s); await c.close();
  } catch (e) { rec("字源页", "组", v.n, "FAIL", "异常:" + e.message.split("\n")[0]); }
  try { const c = await ctxOf(v); const p = await boot(c);
    if (!(await toPick(p, v))) throw new Error("没到挑字");
    const view = await p.evaluate(() => document.body.dataset.view); const fine = await p.evaluate(() => matchMedia("(hover:hover) and (pointer:fine)").matches);
    const hint = await p.locator("#pick").innerText(); const s0 = await shot(p, `${v.n}_pick0`);
    const wantM = "点一个字看它能做什么；再点一次带上。", wantD = "点字，或用 ← → 移动、Space 选 · Backspace 放回最后一个 · Enter 出发";
    const keys = await p.evaluate(() => { const k = document.querySelector("#keys"); return k ? (getComputedStyle(k).display !== "none" && k.offsetParent !== null ? k.innerText.trim() : "") : ""; });
    rec("挑字", "提示文案/视图", v.n, hint.includes(view === "desktop" ? wantD : wantM) ? "PASS" : "FAIL", `view=${view} fine=${fine}`, s0);
    if (v.n.startsWith("768")) rec("BREAKPOINTS", "600–1023 竖屏=平板同手机；键位行仅 pointer:fine", v.n, view === "tablet-portrait" && (touch ? !keys : true) ? "PASS" : "FAIL", `view=${view} fine=${fine} keys="${keys.slice(0, 60)}"`, s0);
    const n = await p.locator("#pick .cand").count(); rec("挑字", "字池14", v.n, n === 14 ? "PASS" : "FAIL", `n=${n}`, s0);
    const cand = (ch) => p.locator(`#pick .cand[data-char='${ch}']`); const act = (l) => touch ? l.tap() : l.click();
    if (touch || v.n === "768m" || true) {
      // ① 第一下只开说明卡
      await act(cand("水")); await p.waitForTimeout(250);
      const p1 = await picks(p); const d1 = await desc(p); const foc = await cand("水").evaluate(e => e.classList.contains("focus")); const s1 = await shot(p, `${v.n}_W5_tap1`);
      rec("W5", "①第一下只开说明卡不进格", v.n, p1.length === 0 && (d1.length > 0 || foc) ? "PASS" : "FAIL", `picks=${p1} desc="${d1.slice(0, 40)}" focus=${foc}`, s1);
      // A→B：点水(已看)后点日：应只换说明不进格
      await act(cand("日")); await p.waitForTimeout(250); const pAB = await picks(p); const dAB = await desc(p); const sAB = await shot(p, `${v.n}_W5_AthenB`);
      rec("W5", "点A后点B：只切换说明，不进格", v.n, pAB.length === 0 && /日/.test(dAB) ? "PASS" : (pAB.length === 0 ? "部分验证" : "FAIL"), `picks=${pAB} desc="${dAB.slice(0, 40)}"`, sAB);
      // 再点水：因已切到日，水应重新只看
      await act(cand("水")); await p.waitForTimeout(200); const pBA = await picks(p);
      rec("W5", "A→B→A：回到A第一下仍只看", v.n, pBA.length === 0 ? "PASS" : "FAIL", `picks=${pBA}`);
      // ② 再点同字进格变朱
      await act(cand("水")); await p.waitForTimeout(250); const p2 = await picks(p); const sel = await cand("水").evaluate(e => e.classList.contains("sel")); const bg = await cand("水").evaluate(e => getComputedStyle(e).backgroundColor); const s2 = await shot(p, `${v.n}_W5_tap2`);
      rec("W5", "②再点同字变朱色进格", v.n, p2.join() === "水" && sel ? "PASS" : "FAIL", `picks=${p2} sel=${sel} bg=${bg}`, s2);
      // ③ 点已选字放回
      await act(cand("水")); await p.waitForTimeout(250); const p3 = await picks(p);
      rec("W5", "③点已选字放回", v.n, p3.length === 0 ? "PASS" : "FAIL", `picks=${p3}`, await shot(p, `${v.n}_W5_unpick`));
      // 选回 水，再点格子放回
      await act(cand("水")); await p.waitForTimeout(150); if ((await picks(p)).length === 0) { await act(cand("水")); await p.waitForTimeout(150); }
      await act(p.locator("#pick .pickslot[data-char]").first()); await p.waitForTimeout(250); const p4 = await picks(p);
      rec("W5", "③点格子放回", v.n, p4.length === 0 ? "PASS" : "FAIL", `picks=${p4}`, await shot(p, `${v.n}_W5_slotback`));
    }
    if (!touch && v.n !== "768m") { // 桌面键盘
      await p.keyboard.press("Space"); await p.keyboard.press("ArrowRight"); await p.keyboard.press("Space"); await p.keyboard.press("ArrowRight"); await p.keyboard.press("Space"); await p.waitForTimeout(150);
      const k3 = await picks(p); await p.keyboard.press("Backspace"); await p.waitForTimeout(120); const k2 = await picks(p);
      rec("挑字", "键盘 ←→/Space 选、Backspace 放回最后一个", v.n, k3.length === 3 && k2.length === 2 && k2.join() === k3.slice(0, 2).join() ? "PASS" : "FAIL", `${k3.join("")}→${k2.join("")}`, await shot(p, `${v.n}_keys`));
      await p.keyboard.press("ArrowRight"); await p.keyboard.press("Space"); await p.waitForTimeout(120);
    } else { // 触屏/鼠标两下补满
      for (const ch of ["木", "田", "火"]) { await act(cand(ch)); await p.waitForTimeout(150); await act(cand(ch)); await p.waitForTimeout(150); }
    }
    const pf = await picks(p); const go = p.locator("#pick .go"); const g1 = (await go.innerText()).trim(); const sF = await shot(p, `${v.n}_pickfull`);
    // 满 3 后再点第4字两下：不应进格
    await act(cand("力")); await p.waitForTimeout(120); await act(cand("力")); await p.waitForTimeout(200); const p5 = await picks(p);
    rec("W5", "挑满三字按钮「带这三个字出发」，第4字进不去", v.n, pf.length === 3 && /带这三个字出发/.test(g1) && p5.length === 3 ? "PASS" : "FAIL", `picks=${pf.join("")} btn="${g1}" 第4字后=${p5.join("")}`, sF);
    if (!touch && v.n !== "768m") await p.keyboard.press("Enter"); else await act(go); await p.waitForTimeout(500);
    const st = await p.evaluate(() => ({ g: window.__zz.st.generation, ph: window.__zz.st.phase }));
    rec("挑字", "出发开局", v.n, st.g === 2 && st.ph === "card" ? "PASS" : "FAIL", JSON.stringify(st), await shot(p, `${v.n}_gen2`));
    if (["390", "1280"].includes(v.n)) {
      rec("冒烟", "开局→一代结算→第2代", v.n, st.g === 2 ? "PASS" : "FAIL", JSON.stringify(st));
      const b = await p.evaluate(() => window.__zz.actions.length); await p.reload({ waitUntil: "load" }); await p.waitForFunction(() => !!window.__zz);
      const a = await p.evaluate(() => ({ n: window.__zz.actions.length, g: window.__zz.st.generation }));
      rec("冒烟", "刷新存档在", v.n, a.n === b && a.g === 2 ? "PASS" : "FAIL", `${b}→${JSON.stringify(a)}`, await shot(p, `${v.n}_reload`));
      await p.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {});
      await c.setOffline(true); let off = false;
      try { await p.goto(O + "/", { waitUntil: "load", timeout: 10000 }); await p.waitForFunction(() => !!window.__zz, null, { timeout: 5000 }); off = await p.locator("#card").isVisible(); } catch {}
      rec("冒烟", "离线可开", v.n, off ? "PASS" : "FAIL", "", await shot(p, `${v.n}_offline`)); }
    await c.close();
  } catch (e) { rec("挑字", "组", v.n, "FAIL", "异常:" + e.message.split("\n")[0]); }
}
await B.close(); srv.kill();
fs.writeFileSync(`${OUT}/matrix_${engine}.csv`, "block,item,engine,viewport,result,note,shot\n" + rows.map(r => r.join(",")).join("\n") + "\n"); process.exit(0);
