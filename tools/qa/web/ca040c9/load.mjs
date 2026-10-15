// webkit 1024×600 页面加载偶发超时观察。node load.mjs <engine> <port> <outdir> [N=40]
import { chromium, firefox, webkit } from "playwright"; import { spawn } from "node:child_process"; import fs from "node:fs"; import path from "node:path";
const [engine, PORT, OUT, N0] = process.argv.slice(2); const N = +(N0 || 40); const HERE = path.dirname(new URL(import.meta.url).pathname); fs.mkdirSync(OUT + "/shots", { recursive: true });
const rf = `${OUT}/root_load_${engine}.txt`; fs.writeFileSync(rf, process.env.DIST);
const srv = spawn("python3", [[HERE, HERE + "/.."].map(d => d + "/pages_server.py").find(f => fs.existsSync(f)), String(PORT), rf], { stdio: "ignore" }); await new Promise(r => setTimeout(r, 700));
const B = await { chromium, firefox, webkit }[engine].launch(); const ts = [], bad = [];
for (let i = 0; i < N; i++) { const c = await B.newContext({ viewport: { width: 1024, height: 600 } }); const p = await c.newPage(); const t0 = Date.now(); const log = [];
  p.on("console", m => log.push(m.type() + ":" + m.text().slice(0, 80))); p.on("pageerror", e => log.push("err:" + e.message.slice(0, 80))); p.on("requestfailed", r => log.push("reqfail:" + r.url().split("/").pop()));
  try { await p.goto(`http://localhost:${PORT}/?seed=7`, { waitUntil: "load", timeout: 20000 }); const tl = Date.now() - t0; await p.waitForFunction(() => !!window.__zz, null, { timeout: 10000 }); ts.push(Date.now() - t0); if (tl > 5000) bad.push(`${i}:慢 load=${tl}ms`); }
  catch (e) { bad.push(`${i}:${e.message.split("\n")[0].slice(0, 60)} 用时${Date.now() - t0}ms 日志:${log.slice(-3).join(" | ")}`); await p.screenshot({ path: `${OUT}/shots/${engine}_1024x600_loadfail_${i}.png` }).catch(() => {}); }
  await c.close(); }
await B.close(); srv.kill(); ts.sort((a, b) => a - b);
const row = ["加载", `1024×600 冷启动加载 ×${N}（20s 超时）`, engine, "1024x600", bad.length ? "FAIL" : "PASS", `失败/慢=${bad.length}/${N} p50=${ts[ts.length >> 1]}ms max=${ts.at(-1)}ms ${bad.slice(0, 4).join(" ")}`.replace(/,/g, " "), bad.length ? `shots/${engine}_1024x600_loadfail_${bad[0].split(":")[0]}.png` : ""];
console.log(row.join(" ")); fs.writeFileSync(`${OUT}/matrix_load_${engine}.csv`, "block,item,engine,viewport,result,note,shot\n" + row.join(",") + "\n"); process.exit(0);
