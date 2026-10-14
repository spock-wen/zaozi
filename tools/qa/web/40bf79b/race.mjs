// 回归 0aa3166：字源页/挑字 gf5/冒烟。用法 node regress.mjs <engine> <port> <outdir>
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


const picks = p => p.evaluate(() => window.__zz.st.picks.slice());
const CASES = [["1280",1280,800,0],["390",390,844,1]];
for (const [n,w,h,t] of CASES) { const v = { n, w, h, t };
  try { const c = await ctxOf(v); const p = await boot(c);
    if (!(await toPick(p, v))) throw new Error("没到挑字");
    const cand = ch => p.locator(`#pick .cand[data-char='${ch}']`); const act = l => t ? l.tap() : l.click();
    const clear = async () => { for (const ch of await picks(p)) { await act(cand(ch)); await p.waitForTimeout(80); } };
    const two = async ch => { await act(cand(ch)); await act(cand(ch)); };
    let lostA = 0, lostB = 0, lostC = 0, notes = [];
    for (let i = 0; i < 10; i++) {
      await clear(); await p.waitForTimeout(100);
      // A 放回后立刻再选
      await two("水"); await p.waitForTimeout(60); await act(cand("水")); await two("水"); await p.waitForTimeout(120);
      if ((await picks(p)).join() !== "水") { lostA++; notes.push(`A${i}:${await picks(p)}`); }
      // B 按下后 ~650ms 抬起（第二下）
      await act(cand("日")); await p.waitForTimeout(50);
      if (t) { const b = await cand("日").boundingBox(); const cdp = engine === "chromium" ? await c.newCDPSession(p) : null;
        if (cdp) { await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }] }); await p.waitForTimeout(650); await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); }
        else { await p.waitForTimeout(650); await cand("日").tap(); } }
      else { const b = await cand("日").boundingBox(); await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.mouse.down(); await p.waitForTimeout(650); await p.mouse.up(); }
      await p.waitForTimeout(150); if (!(await picks(p)).includes("日")) { lostB++; notes.push(`B${i}:${await picks(p)}`); }
      // C 快速连续选/放回 人：两下选、一下放、两下选（共5下，间隔~40ms）→ 应选中
      for (const k of [0, 1, 2, 3, 4]) { await act(cand("人")); await p.waitForTimeout(40); }
      await p.waitForTimeout(200); const pc = await picks(p);
      if (!pc.includes("人") || pc.filter(x => x === "人").length !== 1) { lostC++; notes.push(`C${i}:${pc}`); }
    }
    const s = await shot(p, `${n}_race_end`);
    rec("放回再选", "A 放回后立刻再选 ×10 丢点击", n, lostA === 0 ? "PASS" : "FAIL", `丢=${lostA}/10 ${notes.filter(x=>x[0]=="A").join(" ")}`, s);
    rec("放回再选", t && engine !== "chromium" ? "B 按下~650ms再抬起 ×10（非CDP：等650ms后tap，弱化）" : "B 按下~650ms再抬起 ×10 丢点击", n, lostB === 0 ? (t && engine !== "chromium" ? "部分验证" : "PASS") : "FAIL", `丢=${lostB}/10 ${notes.filter(x=>x[0]=="B").join(" ")}`, s);
    rec("放回再选", "C 快速连续选/放回 ×10 丢点击", n, lostC === 0 ? "PASS" : "FAIL", `丢=${lostC}/10 ${notes.filter(x=>x[0]=="C").join(" ")}`, s);
    // 3) __zz.animating 只读
    const ro = await p.evaluate(() => { const before = window.__zz.animating; let threw = false; try { window.__zz.animating = !before; } catch (e) { threw = true; } const after = window.__zz.animating; const d = Object.getOwnPropertyDescriptor(window.__zz, "animating"); return { before, after, threw, hasSetter: !!d.set, txt: /animating/.test(document.body.innerText) }; });
    rec("__zz.animating", "只读、不在界面显示", n, ro.before === ro.after && !ro.hasSetter && !ro.txt ? "PASS" : "FAIL", JSON.stringify(ro));
    await c.close();
  } catch (e) { rec("放回再选", "组", n, "FAIL", "异常:" + e.message.split("\n")[0]); } }
// animating 不影响玩法：卡牌阶段写入后仍能正常提交
{ const c = await ctxOf({ n: "1280", w: 1280, h: 800 }); const p = await boot(c);
  const r = await p.evaluate(async () => { try { window.__zz.animating = true; } catch {} return window.__zz.animating; });
  const a0 = await p.evaluate(() => window.__zz.actions.length); await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(600);
  const mid = await p.evaluate(() => window.__zz.animating);
  const a1 = await p.evaluate(() => window.__zz.actions.length);
  rec("__zz.animating", "外部写入不影响玩法（写后仍可提交）", "1280", r === false && a1 === a0 + 1 ? "PASS" : "FAIL", `写true后读=${r} actions ${a0}->${a1} 动画后=${mid}`, await shot(p, "animating_play")); await c.close(); }
await B.close(); srv.kill();
fs.writeFileSync(`${OUT}/matrix_race_${engine}.csv`, "block,item,engine,viewport,result,note,shot\n" + rows.map(r => r.join(",")).join("\n") + "\n"); process.exit(0);
