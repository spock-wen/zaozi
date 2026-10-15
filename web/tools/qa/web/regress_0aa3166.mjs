// 回归 0aa3166：字源页/挑字 gf5/冒烟。用法 node regress.mjs <engine> <port> <outdir>
import { chromium, firefox, webkit } from "playwright"; import { spawn } from "node:child_process"; import fs from "node:fs"; import path from "node:path";
const [engine, PORT, OUT] = [process.argv[2], +process.argv[3], process.argv[4]]; const DIST = process.env.DIST;
const HERE = path.dirname(new URL(import.meta.url).pathname); fs.mkdirSync(OUT + "/shots", { recursive: true });
const rf = `${OUT}/root_${engine}.txt`; fs.writeFileSync(rf, DIST);
const srv = spawn("python3", [HERE + "/pages_server.py", String(PORT), rf], { stdio: "ignore" }); await new Promise(r => setTimeout(r, 700));
const O = `http://localhost:${PORT}`; const B = await { chromium, firefox, webkit }[engine].launch(); const rows = [];
const rec = (b, i, v, r, n = "", s = "") => { rows.push([b, i, engine, v, r, String(n).replace(/[\n,]/g, " ").slice(0, 250), s]); console.log(r, b, i, engine, v, n); };
const shot = async (p, n) => { const f = `shots/${engine}_${n}.png`; await p.screenshot({ path: `${OUT}/${f}`, fullPage: true }).catch(() => {}); return f; };
const VPS = [{ n: "390", w: 390, h: 844, t: 1 }, { n: "768", w: 768, h: 1024 }, { n: "1024", w: 1024, h: 768 }, { n: "1280", w: 1280, h: 800 }, { n: "1440", w: 1440, h: 900 }];
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
for (const v of VPS) {
  // 1) 字源页 + 菜单
  try { const c = await ctxOf(v); const p = await boot(c);
    if (v.t) await p.locator("#menubtn").tap(); else await p.locator("#menubtn").click(); await p.waitForTimeout(200); const nav = p.waitForNavigation({ timeout: 5000 }).then(() => 1, () => 0);
    if (v.t) await p.locator("#menu-pop a[href*=credits]").tap(); else await p.locator("#menu-pop a[href*=credits]").click(); const ok = await nav; await p.waitForLoadState("load");
    const t = await p.evaluate(() => document.body.innerText); const s = await shot(p, `${v.n}_credits`);
    rec("W1", "菜单进字源页", v.n, ok && /\/credits/.test(p.url()) && /字源与版权/.test(t) ? "PASS" : "FAIL", p.url().replace(O, ""), s);
    rec("字源页", "全页无内部路径 glyph/ .csv", v.n, !/glyph\/|glyph_pack|\.csv/.test(t) ? "PASS" : "FAIL", (t.match(/.{20}(glyph\/|\.csv).{20}/) || [""])[0], s);
    rec("字源页", "Sears 致谢在", v.n, /Richard Sears/.test(t) && /ACClicense s07887/.test(t) ? "PASS" : "FAIL", "", s); await c.close();
  } catch (e) { rec("字源页", "组", v.n, "FAIL", "异常:" + e.message.split("\n")[0]); }
  // 2) 挑字 gf5 + 冒烟（结算→刷新→离线）
  try { const c = await ctxOf(v); const p = await boot(c);
    const okPick = await toPick(p, v); if (!okPick) throw new Error("没走到挑字 phase=" + await ph(p));
    const hint = await p.locator("#pick").innerText(); const s0 = await shot(p, `${v.n}_pick_empty`);
    const mob = await p.evaluate(() => document.body.dataset.view);
    const wantM = "点一个字看它能做什么；再点一次带上。", wantD = "点字，或用 ← → 移动、Space 选 · Backspace 放回最后一个 · Enter 出发";
    const isMob = v.n === "390"; const hintMob = mob !== "desktop";
    rec("挑字", "提示文案对齐 gf5", v.n, hint.includes(hintMob ? wantM : wantD) ? "PASS" : "FAIL", `view=${mob} 期望=${hintMob ? wantM : wantD}`, s0);
    const n = await p.locator("#pick .cand").count(); rec("挑字", "字池14", v.n, n === 14 ? "PASS" : "FAIL", `n=${n}`, s0);
    const go = p.locator("#pick .go"); const g0 = (await go.innerText()).trim(); const dis0 = await go.isDisabled();
    rec("挑字", "未选满按钮「还差字」且不可出发", v.n, /还差/.test(g0) && /字/.test(g0) && dis0 ? "PASS" : "FAIL", `btn="${g0}" disabled=${dis0}`, s0);
    let picks;
    if (isMob) { // 触屏点两次带上
      const cands = p.locator("#pick .cand");
      await cands.nth(0).tap(); await p.waitForTimeout(200);
      const a1 = await p.evaluate(() => window.__zz.st.picks.length); const sA = await shot(p, `${v.n}_pick_tap1`);
      const card = await p.evaluate(() => document.querySelector("#pick").innerText.slice(0, 400));
      await cands.nth(0).tap(); await p.waitForTimeout(200);
      const a2 = await p.evaluate(() => window.__zz.st.picks.length);
      rec("挑字", "触屏点一次只看、再点一次带上", v.n, a1 === 0 && a2 === 1 ? "PASS" : "FAIL", `1次后picks=${a1} 2次后picks=${a2}`, sA + "; " + await shot(p, `${v.n}_pick_tap2`));
      // 按实际行为（单击即带上）补满继续冒烟
      for (let k = 0; k < 6 && (await p.evaluate(() => window.__zz.st.picks.length)) < 3; k++) { const ch = await cands.nth(k).getAttribute("data-char"); const has = await p.evaluate((c) => window.__zz.st.picks.includes(c), ch); if (!has) { await cands.nth(k).tap(); await p.waitForTimeout(200); } }
    } else { // 键盘 → Space × 3，Backspace 放回，再补，Enter 出发
      await p.keyboard.press("Space"); await p.keyboard.press("ArrowRight"); await p.keyboard.press("Space"); await p.keyboard.press("ArrowRight"); await p.keyboard.press("Space"); await p.waitForTimeout(150);
      const k3 = await p.evaluate(() => window.__zz.st.picks.slice()); await p.keyboard.press("Backspace"); await p.waitForTimeout(120);
      const k2 = await p.evaluate(() => window.__zz.st.picks.slice());
      rec("挑字", "←→+Space 选、Backspace 放回最后一个", v.n, k3.length === 3 && k2.length === 2 && k2.join() === k3.slice(0, 2).join() ? "PASS" : "FAIL", `${k3.join("")}→${k2.join("")}`, await shot(p, `${v.n}_pick_keys`));
      await p.keyboard.press("ArrowRight"); await p.keyboard.press("Space"); await p.waitForTimeout(120); }
    picks = await p.evaluate(() => window.__zz.st.picks.slice()); const g1 = (await go.innerText()).trim(); const s1 = await shot(p, `${v.n}_pick_full`);
    rec("挑字", "选满按钮「带这三个字出发」", v.n, picks.length === 3 && g1.includes("带这三个字出发") && !(await go.isDisabled()) ? "PASS" : "FAIL", `picks=${picks.join("")} btn="${g1}"`, s1);
    if (isMob) await go.tap(); else await p.keyboard.press("Enter"); await p.waitForTimeout(500);
    const st = await p.evaluate(() => ({ g: window.__zz.st.generation, ph: window.__zz.st.phase }));
    rec("挑字", isMob ? "点按钮出发开局" : "Enter 出发开局", v.n, st.g === 2 && st.ph === "card" ? "PASS" : "FAIL", JSON.stringify(st), await shot(p, `${v.n}_gen2`));
    if (v.n === "390" || v.n === "1280") { // 冒烟（每引擎覆盖手机+桌面）
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
