// D3（PM：不接受滚动）键位浮层两列、6条全可见、不滚动、不压选项、文字不裁切、「?」≥44。node pop2.mjs <port> <outdir>
import { chromium, firefox, webkit } from "playwright"; import { spawn } from "node:child_process"; import fs from "node:fs"; import path from "node:path";
const [PORT, OUT] = [+process.argv[2], process.argv[3]]; const HERE = path.dirname(new URL(import.meta.url).pathname); fs.mkdirSync(OUT + "/shots", { recursive: true });
const rf = `${OUT}/root_pop2.txt`; fs.writeFileSync(rf, process.env.DIST);
const srv = spawn("python3", [[HERE, HERE + "/.."].map(d => d + "/pages_server.py").find(f => fs.existsSync(f)), String(PORT), rf], { stdio: "ignore" }); await new Promise(r => setTimeout(r, 700));
const rows = []; const rec = (...r) => { rows.push(r.map(x => String(x).replace(/[\n,]/g, " "))); console.log(r.join(" ")); };
const M = () => { const pop = document.querySelector("#keyhelp-pop"); const vis = e => e && !e.hidden && getComputedStyle(e).display !== "none" && e.getBoundingClientRect().width > 0;
  if (!vis(pop)) return null; const pr = pop.getBoundingClientRect(); const R = s => { const e = document.querySelector(s); return vis(e) ? e.getBoundingClientRect() : null; };
  const rws = [...pop.querySelectorAll(".kh-row")]; const rr = rws.map(x => x.getBoundingClientRect());
  const inside = rr.filter(b => b.top >= pr.top - 0.5 && b.bottom <= pr.bottom + 0.5 && b.left >= pr.left - 0.5 && b.right <= pr.right + 0.5).length;
  const cols = new Set(rr.map(b => Math.round(b.left))).size;
  const clipped = []; for (const r of rws) for (const e of r.querySelectorAll("b,span")) { if (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== "visible") clipped.push(e.textContent);
    const rg = document.createRange(); rg.selectNodeContents(e); for (const q of rg.getClientRects()) if (q.right > pr.right + 0.5 || q.bottom > pr.bottom + 0.5 || q.left < pr.left - 0.5) { clipped.push(e.textContent.trim()); break; } }
  const inter = (a, b) => a && b && a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
  const ov = [["#opt-left", "左选项"], ["#opt-right", "右选项"], ["#card", "卡"], ["#wordbox-bar", "字匣"], ["#too-short", "太矮提示"]].filter(([s]) => inter(pr, R(s))).map(([s, n]) => { const b = R(s); return `${n}(${Math.round(Math.min(pr.right, b.right) - Math.max(pr.left, b.left))}×${Math.round(Math.min(pr.bottom, b.bottom) - Math.max(pr.top, b.top))})`; });
  const btn = R("#keyhelp-btn");
  return { n: rws.length, inside, cols, sh: pop.scrollHeight, ch: pop.clientHeight, clipped, ov, btn: btn && [Math.round(btn.width), Math.round(btn.height)], inView: pr.top >= 0 && pr.bottom <= innerHeight + 0.5 && pr.right <= innerWidth + 0.5 && pr.left >= 0, rect: [pr.left, pr.top, pr.right, pr.bottom].map(Math.round) }; };
for (const [en, T] of Object.entries({ chromium, firefox, webkit })) { const B = await T.launch();
  for (const [w, h] of [[1024, 600], [1024, 513], [1024, 491], [1280, 491]]) { const vp = `${w}x${h}`;
    for (const mode of ["自动弹出", "点「?」"]) { const c = await B.newContext({ viewport: { width: w, height: h } }); const p = await c.newPage();
      try { await p.goto(`http://localhost:${PORT}/?seed=7`, { waitUntil: "load" }); await p.waitForFunction(() => !!window.__zz); await p.waitForTimeout(400);
        if (mode === "点「?」") { await p.waitForTimeout(3300); await p.locator("#keyhelp-btn").click(); await p.waitForTimeout(250); }
        const m = await p.evaluate(M); const f = `shots/${en}_${vp}_pop2_${mode === "自动弹出" ? "auto" : "click"}.png`; await p.screenshot({ path: `${OUT}/${f}` });
        if (!m) { rec("D3", `浮层（${mode}）`, en, vp, "FAIL", "浮层未出现", f); continue; }
        const it = (lab, ok, note) => rec("D3", `${lab}（${mode}）`, en, vp, ok ? "PASS" : "FAIL", note, f);
        it("两列", m.cols === 2, `列=${m.cols}`);
        it("6条全部可见", m.n === 6 && m.inside === 6, `行 ${m.inside}/${m.n} 在框内`);
        it("不滚动（scrollHeight=clientHeight）", m.sh <= m.ch, `scrollH ${m.sh} / clientH ${m.ch}`);
        it("不压选项/卡/字匣、在视口内", !m.ov.length && m.inView, `叠:${m.ov.join(" ") || "无"} 框=${m.rect} 视口内=${m.inView}`);
        it("文字不裁切", !m.clipped.length, m.clipped.join("|") || "无");
        it("「?」点击区≥44", m.btn && m.btn[0] >= 44 && m.btn[1] >= 44, `?=${m.btn}`);
      } catch (e) { rec("D3", `组（${mode}）`, en, vp, "FAIL", "异常:" + e.message.split("\n")[0], ""); }
      await c.close(); } }
  await B.close(); }
srv.kill(); fs.writeFileSync(`${OUT}/matrix_pop2.csv`, "block,item,engine,viewport,result,note,shot\n" + rows.map(r => r.join(",")).join("\n") + "\n"); process.exit(0);
