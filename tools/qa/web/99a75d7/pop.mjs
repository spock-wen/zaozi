// D3 后续：键位浮层是否列全部键位（行被裁/需滚动）。node pop.mjs <port> <outdir>
import { chromium, firefox, webkit } from "playwright"; import { spawn } from "node:child_process"; import fs from "node:fs"; import path from "node:path";
const [PORT, OUT] = [+process.argv[2], process.argv[3]]; const HERE = path.dirname(new URL(import.meta.url).pathname); fs.mkdirSync(OUT + "/shots", { recursive: true });
const rf = `${OUT}/root_pop.txt`; fs.writeFileSync(rf, process.env.DIST);
const srv = spawn("python3", [[HERE, HERE + "/.."].map(d => d + "/pages_server.py").find(f => fs.existsSync(f)), String(PORT), rf], { stdio: "ignore" }); await new Promise(r => setTimeout(r, 700));
const rows = [];
for (const [en, T] of Object.entries({ chromium, firefox, webkit })) { const B = await T.launch();
  for (const [w, h] of [[1024, 600], [1024, 513], [1024, 491]]) { const c = await B.newContext({ viewport: { width: w, height: h } }); const p = await c.newPage();
    await p.goto(`http://localhost:${PORT}/?seed=7`, { waitUntil: "load" }); await p.waitForFunction(() => !!window.__zz); await p.waitForTimeout(400);
    const r = await p.evaluate(() => { const pop = document.querySelector("#keyhelp-pop"); if (!pop || pop.hidden) return null; const pr = pop.getBoundingClientRect(); const all = [...pop.querySelectorAll(".kh-row")];
      const vis = all.filter(x => { const b = x.getBoundingClientRect(); return b.bottom <= pr.bottom + 0.5 && b.top >= pr.top - 0.5; });
      return { total: all.length, visible: vis.length, hidden: all.filter(x => !vis.includes(x)).map(x => x.innerText.replace(/\s+/g, " ").trim()), sh: pop.scrollHeight, ch: pop.clientHeight, ov: getComputedStyle(pop).overflowY }; });
    const f = `shots/${en}_${w}x${h}_pop.png`; await p.screenshot({ path: `${OUT}/${f}` });
    const ok = r && r.visible === r.total; const scrollable = r && r.sh > r.ch && /auto|scroll/.test(r.ov);
    rows.push(["D3后续", "键位浮层列全部键位（不裁行）", en, `${w}x${h}`, ok ? "PASS" : (scrollable ? "部分验证" : "FAIL"), r ? `行 ${r.visible}/${r.total} 可见；不可见:${r.hidden.join(" | ") || "无"}；scrollH ${r.sh}/clientH ${r.ch} overflowY=${r.ov}${scrollable ? "（可滚动查看）" : ""}` : "浮层未弹", f]);
    console.log(rows.at(-1).join(" ")); await c.close(); }
  await B.close(); }
srv.kill(); fs.writeFileSync(`${OUT}/matrix_pop.csv`, "block,item,engine,viewport,result,note,shot\n" + rows.map(r => r.map(x => String(x).replace(/,/g, " ")).join(",")).join("\n") + "\n"); process.exit(0);
