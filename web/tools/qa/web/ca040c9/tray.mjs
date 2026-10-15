// 字匣（PM 裁定）：N 1366×768 高64/格52/点击≥44/不压顶栏与卡；A 60、B 56；手机与上一版(DIST_BASE)一致。node tray.mjs <engine> <port> <outdir>
import { chromium, firefox, webkit } from "playwright"; import { spawn } from "node:child_process"; import fs from "node:fs"; import path from "node:path";
const [engine, PORT, OUT] = [process.argv[2], +process.argv[3], process.argv[4]]; const HERE = path.dirname(new URL(import.meta.url).pathname); fs.mkdirSync(OUT + "/shots", { recursive: true });
const PS = [HERE, HERE + "/.."].map(d => d + "/pages_server.py").find(f => fs.existsSync(f));
const serve = (port, dist, tag) => { const rf = `${OUT}/root_tray_${tag}_${engine}.txt`; fs.writeFileSync(rf, dist); return spawn("python3", [PS, String(port), rf], { stdio: "ignore" }); };
const s1 = serve(PORT, process.env.DIST, "cur"), s2 = serve(PORT + 50, process.env.DIST_BASE, "base"); await new Promise(r => setTimeout(r, 800));
const B = await { chromium, firefox, webkit }[engine].launch(); const rows = []; const rec = (...r) => { rows.push(r.map(x => String(x).replace(/[\n,]/g, " "))); console.log(r.join(" ")); };
const measure = async (port, w, h, t, shotName) => { const c = await B.newContext({ viewport: { width: w, height: h }, ...(t ? { hasTouch: true, ...(engine !== "firefox" ? { isMobile: true } : {}) } : {}) }); const p = await c.newPage();
  await p.goto(`http://localhost:${port}/?seed=7`, { waitUntil: "load" }); await p.waitForFunction(() => !!window.__zz); await p.waitForTimeout(500);
  const m = await p.evaluate(() => { const R = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom } : null; };
    const slots = [...document.querySelectorAll("#wordbox .slot")].map(e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { w: r.width, h: r.height, hitW: r.width + parseFloat(cs.marginLeft) * 0, hitH: r.height }; });
    const inter = (a, b) => a && b && a.x < b.r - 0.5 && b.x < a.r - 0.5 && a.y < b.b - 0.5 && b.y < a.b - 0.5;
    const wb = R("#wordbox-bar"), top = R("#topbar"), card = R("#card");
    return { short: document.body.dataset.short || "N", view: document.body.dataset.view, wb, slots, ovTop: inter(wb, top), ovCard: inter(wb, card) }; });
  if (shotName) await p.screenshot({ path: `${OUT}/shots/${engine}_${shotName}.png` }); await c.close(); return m; };
const r2 = x => Math.round(x * 10) / 10;
// N 1366×768
{ const m = await measure(PORT, 1366, 768, 0, "1366x768_tray"); const f = `shots/${engine}_1366x768_tray.png`; const s = m.slots[0];
  rec("字匣", "N 1366×768 字匣高64（±1）", engine, "1366x768", Math.abs(m.wb.h - 64) <= 1 ? "PASS" : "FAIL", `档=${m.short} 字匣高=${r2(m.wb.h)}`, f);
  rec("字匣", "N 1366×768 格52（±1）", engine, "1366x768", s && Math.abs(s.h - 52) <= 1 && Math.abs(s.w - 52) <= 1 ? "PASS" : "FAIL", `格=${m.slots.map(x => `${r2(x.w)}×${r2(x.h)}`).join(" ")}`, f);
  rec("字匣", "N 1366×768 格点击区≥44", engine, "1366x768", m.slots.length && m.slots.every(x => x.w >= 44 && x.h >= 44) ? "PASS" : "FAIL", `格数=${m.slots.length}`, f);
  rec("字匣", "N 1366×768 不压顶栏与卡", engine, "1366x768", !m.ovTop && !m.ovCard ? "PASS" : "FAIL", `压顶栏=${m.ovTop} 压卡=${m.ovCard} 字匣y=${r2(m.wb.y)}–${r2(m.wb.b)}`, f); }
// A / B
for (const [w, h, tier, H, S] of [[1280, 720, "A", 60, 48], [1280, 633, "A", 60, 48], [1024, 600, "B", 56, 48], [1024, 513, "B", 56, 48]]) { const vp = `${w}x${h}`; const m = await measure(PORT, w, h, 0, `${vp}_tray`); const f = `shots/${engine}_${vp}_tray.png`;
  rec("字匣", `${tier} 档字匣高${H}、格${S}、≥44、不压顶栏与卡`, engine, vp, m.short === tier && Math.abs(m.wb.h - H) <= 1 && m.slots.every(x => Math.abs(x.h - S) <= 1 && x.w >= 44 && x.h >= 44) && !m.ovTop && !m.ovCard ? "PASS" : "FAIL", `档=${m.short} 字匣高=${r2(m.wb.h)} 格=${m.slots.map(x => `${r2(x.w)}×${r2(x.h)}`).join(" ")} 压顶栏=${m.ovTop} 压卡=${m.ovCard}`, f); }
// 手机不变：与 99a75d7 比
for (const [w, h] of [[390, 844], [360, 740]]) { const vp = `${w}x${h}`; const a = await measure(PORT, w, h, 1, `${vp}_tray`), b = await measure(PORT + 50, w, h, 1, null); const f = `shots/${engine}_${vp}_tray.png`;
  const same = Math.abs(a.wb.h - b.wb.h) <= 0.5 && Math.abs(a.wb.y - b.wb.y) <= 0.5 && a.slots.length === b.slots.length && a.slots.every((x, i) => Math.abs(x.w - b.slots[i].w) <= 0.5 && Math.abs(x.h - b.slots[i].h) <= 0.5);
  rec("字匣", "手机字匣不变（与99a75d7比：高/位置/格尺寸）", engine, vp, same ? "PASS" : "FAIL", `现=${r2(a.wb.h)}@y${r2(a.wb.y)} 格${a.slots.map(x => `${r2(x.w)}×${r2(x.h)}`).join(" ")}；旧=${r2(b.wb.h)}@y${r2(b.wb.y)} 格${b.slots.map(x => `${r2(x.w)}×${r2(x.h)}`).join(" ")}`, f); }
await B.close(); s1.kill(); s2.kill(); fs.writeFileSync(`${OUT}/matrix_tray_${engine}.csv`, "block,item,engine,viewport,result,note,shot\n" + rows.map(r => r.join(",")).join("\n") + "\n"); process.exit(0);
