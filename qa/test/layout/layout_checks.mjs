// R号: R13（核心元素可见，检查 E）+ R14 + R16（文字框/对比度，A/C）+ R18 + R12（提示所指可见，B）
// 造字人 Web 版式自动检查：A 文字框不出界 B 提示所指元素可见（含「未映射」）C 对比度 S FIX_SPEC 验收 E 核心交互元素可见。
// 环境变量 CHECKS（默认 "ABCSE"）选跑哪几块，例如 CHECKS=E 只跑 E。
// E「核心交互元素在全部视口可见」判据见 inpage_e.js 文件头。各元素「必须可见」的阶段（按游戏逻辑定）：
//   phase=card（普通发牌态，含教学卡 T01/T02/T04/T05 与普通卡 C*、第 2 代开局）：左选项、右选项、字匣 #wordbox-bar、菜单入口 #menubtn
//     ——card 阶段玩家靠左右选择推进，看不到两边选项 = 核心玩法缺失；手机/平板竖屏同样要求（MOBILE_SPEC §2「卡区 = 卡片 + 左右选项字 + 手势提示」）。
//   phase=engrave（刻阶段，含教学卡 T03 与普通刻卡）：骨片 #bonecorner、字匣、菜单入口；此阶段拖卡被锁（engine lock / B11），左右选项不要求。
//   拖动态（第 1 张普通卡上按住拖到卡宽 25%，未过 35% 提交阈值）：被预览那一侧的选项必须可见（GAMEFEEL_SPEC「拖动 <35% 选项字半显」）；拖回原位再松手，不提交。
//   菜单展开（第 2 代开局点菜单入口）：#menu-pop 必须可见。
//   扩展项（PM 四样之外、同属「看不到核心元素」，单列计数）：card/engrave 阶段四维资源条 #dims/#dims-desktop；第 1 代教学卡 T01–T05 的教学气泡 #coach。
//   winter / ended / elder / pick（冬夜、结局、先人、挑字的全屏阶段页）：四样核心元素按设计都不在场，不要求，记 N/A。
// node layout_checks.mjs <engine> <WxH> <mob:0|1> <baseURL> <outdir> [hint_map.json]
// 走真实流程：第1代 T01–T05 + 普通牌 + 刻 + 冬夜 + 结局 + 先人 + 挑字 + 第2代开局；每个场景截视口全图并跑两条检查。
// 坐标：CSS px，视口坐标系；mob=1 为 chromium 移动模拟（isMobile/hasTouch/DPR3）。矩阵列与 verdict_gate.py 一致。
import { chromium, firefox, webkit } from "playwright"; import fs from "node:fs"; import path from "node:path";
const [engine, VP, MOB, BASE, OUT, MAPF] = process.argv.slice(2);
const HERE = path.dirname(new URL(import.meta.url).pathname);
const CHECKS = process.env.CHECKS || "ABCSE"; const want = (k) => CHECKS.includes(k);
const MAP = JSON.parse(fs.readFileSync(MAPF || `${HERE}/hint_map.json`, "utf8")).entries;
// MOB：0=非移动；1=chromium 移动模拟（默认 UA）；A / I = 移动模拟 + Android / iPhone UA（主流清单用）
const [W, H] = VP.split("x").map(Number); const mob = MOB !== "0"; const touch = mob || W < 600; const mk = MOB === "A" || MOB === "I" ? MOB : "";
const MUA = { A: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36", I: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" };
const cfg = `${engine}_${VP}${mob ? "_mob" + mk : ""}`; const vpLabel = `${VP}${mob ? ` mob${mk}(DPR3)` : ""}`;
fs.mkdirSync(`${OUT}/shots`, { recursive: true }); fs.mkdirSync(`${OUT}/raw`, { recursive: true });
const rows = [], raw = [];
const B = await { chromium, firefox, webkit }[engine].launch();
const opt = { viewport: { width: W, height: H }, hasTouch: touch }; if (mob) Object.assign(opt, { isMobile: true, deviceScaleFactor: 3 }, mk ? { userAgent: MUA[mk] } : {});
const ctx = await B.newContext(opt); await ctx.addInitScript({ path: `${HERE}/inpage.js` }); await ctx.addInitScript({ path: `${HERE}/inpage2.js` }); await ctx.addInitScript({ path: `${HERE}/inpage_e.js` });
const CARDS = Object.fromEntries((await (await fetch(`${BASE}/data/year1_cards.json`)).json()).cards.map((c) => [c.id, c]));
const E_NEED = { card: ["left", "right", "wordbox", "menu", "dims"], engrave: ["bone", "wordbox", "menu", "dims"] };
const eRows = (name, E, shot, prefix = "") => { for (const x of E) rows.push(["E 核心元素可见", `${prefix}${name}·${x.label}`, engine, vpLabel, x.ok ? "PASS" : "FAIL",
  x.ok ? `${x.pick.el} ${x.pick.why}` : x.cands.map((c) => `${c.el}：${c.why}`).slice(0, 3).join("； ") + (x.cands.length > 3 ? `；…候选共${x.cands.length}个均不可见` : ""), shot]); };
async function checkE(name, shot, meta) {
  if (!want("E")) return null;
  const need = E_NEED[meta.phase] && [...E_NEED[meta.phase]];
  if (!need) { rows.push(["E 核心元素可见", `${name}·（${meta.phase} 阶段）`, engine, vpLabel, "N/A", `phase=${meta.phase} 为全屏阶段页，四样核心元素按设计不在场，不要求`, shot]); return null; }
  const c = CARDS[meta.cur]; if (/^T0\d$/.test(meta.cur || "") && meta.gen === 1) need.push("coach");
  const E = await p.evaluate(([need, lb]) => window.__qaE.check(need, lb), [need, c ? { left: c.left.label, right: c.right.label } : null]);
  eRows(name, E, shot); return E;
}
const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message.slice(0, 100)));
const st = (k) => p.evaluate((k) => window.__zz.st[k], k);
const idle = () => p.waitForFunction(() => !window.__zz.animating, null, { timeout: 5000 }).catch(() => {});
const vis = (s) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && e.getClientRects().length > 0; }, s);
const tapSel = async (s) => { const L = p.locator(s).first(); if (touch) await L.tap(); else await L.click(); };
const tapXY = async (x, y) => { if (touch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y); };
const commit = async (d) => { await idle(); const k = d === "l" ? "ArrowLeft" : "ArrowRight"; await p.keyboard.press(k); await p.keyboard.press(k); await p.waitForTimeout(650); };
const cell = (s) => String(s).replace(/[\n\r]/g, " ").replace(/,/g, "，");
let n = 0; const cardSizes = [];
async function scene(name, settle = 300) {
  await p.waitForTimeout(settle); n++;
  const shot = `shots/${cfg}_${String(n).padStart(2, "0")}_${name}.png`; await p.screenshot({ path: `${OUT}/${shot}` });
  const meta = await p.evaluate(() => ({ dpr: devicePixelRatio, vw: innerWidth, vh: innerHeight, view: document.body.dataset.view, short: document.body.dataset.short || "", phase: window.__zz.st.phase, cur: window.__zz.st.current, gen: window.__zz.st.generation }));
  const E = await checkE(name, shot, meta);
  raw.push({ scene: name, shot, meta, env: await p.evaluate(() => window.__qaE.env()), E });
  if (!(want("A") || want("B") || want("C") || want("S"))) { console.log(cfg, name, "E", E ? E.filter((x) => !x.ok).map((x) => x.key).join("") || "ok" : "n/a"); return; }
  raw.pop();
  const A = await p.evaluate(() => window.__qaLayout.checkA());
  const Bv = await p.evaluate((m) => window.__qaLayout.checkB(m), MAP);
  raw.push({ scene: name, shot, meta, E, A, B: Bv });
  const aNote = A.v.length ? A.v.slice(0, 4).map((x) => x.kind === "内容溢出" ? `${x.el}「${x.text}」内容溢出 sw${x.sw}/cw${x.cw} sh${x.sh}/ch${x.ch}` : `${x.el}「${x.text}」${x.kind}${x.by}px 盒${x.box.join("/")} ⊄ ${x.cont} ${x.contBox.join("/")}`).join("； ") + (A.v.length > 4 ? `；…共${A.v.length}处` : "") : `文字框${A.n}个全在容器内、无溢出`;
  if (want("A")) rows.push(["A 文字框不出界", name, engine, vpLabel, A.v.length ? "FAIL" : "PASS", aNote, shot]);
  const bad = Bv.filter((x) => !x.ok);
  const bNote = Bv.length ? (bad.length ? bad.slice(0, 3).map((x) => `「${x.text.slice(0, 22)}」(${x.carrier}) ${x.why}`).join("； ") + (bad.length > 3 ? `；…共${bad.length}条` : "") : `提示${Bv.length}条：` + Bv.map((x) => x.id).join("/") + " 均可见") : "本场景无提示文案";
  if (want("B")) rows.push(["B 提示所指可见", name, engine, vpLabel, bad.length ? "FAIL" : (Bv.length ? "PASS" : "N/A"), bNote, shot]);
  // C 对比度：图片背景的项用「文字全部临时设透明」的截图采样（文字项取元素框内像素，非文字项取元素外 2–4px 环），取对比度第 10 百分位
  const C = await p.evaluate(() => window.__qaC.checkC());
  if (C.img.length) {
    const st = await p.addStyleTag({ content: "*{color:transparent !important;text-shadow:none !important;-webkit-text-fill-color:transparent !important;caret-color:transparent !important}" });
    const b64 = (await p.screenshot()).toString("base64"); await st.evaluate((e) => e.remove());
    const smp = await p.evaluate(([b, d, regs]) => window.__qaC.sample(b, d, regs), [b64, meta.dpr, C.img.map((it) => ({ mode: it.type === "text" ? "inside" : "ring", rect: it.rect }))]);
    for (let i = 0; i < C.img.length; i++) { const it = C.img[i]; const k = await p.evaluate(([it, sm]) => window.__qaC.contrastFromSamples(it, sm), [it, smp[i]]);
      const rec = { el: it.el, text: it.text, ratio: k ?? 0, how: `图片背景截图采样 ${smp[i].length} 点 P10`, src: it.src, ok: k !== null && k >= (it.type === "text" ? 4.5 : 3) };
      (it.type === "text" ? C.text : C.ui).push(rec); } }
  const S = await p.evaluate((m) => window.__qaC.checkS(m), MAP);
  raw[raw.length - 1].C = C; raw[raw.length - 1].S = S;
  const cfmt = (arr, th) => { const b = arr.filter((x) => !x.ok).sort((a, z) => a.ratio - z.ratio); const uniq = []; const seen = new Set(); for (const x of b) { const k = x.el + x.text; if (!seen.has(k)) { seen.add(k); uniq.push(x); } }
    return [b.length ? "FAIL" : (arr.length ? "PASS" : "N/A"), b.length ? uniq.slice(0, 4).map((x) => `${x.el}「${x.text}」${x.ratio}:1${x.fg ? ` (${x.fg} on ${x.bg})` : ""}${x.how ? " " + x.how : ""} 背景栈 ${x.src}`).join("； ") + (uniq.length > 4 ? `；…共${uniq.length}个元素` : "") : `${arr.length} 项均 ≥${th}:1；最低 ${arr.length ? Math.min(...arr.map((x) => x.ratio)) : "-"}:1`]; };
  const [ct, cn] = cfmt(C.text, 4.5); if (want("C")) rows.push(["C 文字对比度≥4.5", name, engine, vpLabel, ct, cn, shot]);
  const [ut, un] = cfmt(C.ui, 3); if (want("C")) rows.push(["C 非文字对比度≥3", name, engine, vpLabel, ut, un, shot]);
  for (const k of ["S1", "S2", "S3", "S5", "S6", "S8"]) if (want("S") && S[k]) rows.push([`S FIX_SPEC 验收${k.slice(1)}`, name, engine, vpLabel, S[k].ok ? "PASS" : "FAIL", S[k].note, shot]);
  if (S.cardSize && /_(卡|刻)$/.test(name) && name.startsWith("g1_")) cardSizes.push([name, S.cardSize]);
  console.log(cfg, name, "A", A.v.length, "B", `${bad.length}/${Bv.length}`, "C", C.text.filter((x) => !x.ok).length + "/" + C.ui.filter((x) => !x.ok).length, "S", Object.entries(S).filter(([k, v]) => v && v.ok === false).map(([k]) => k).join(""));
}
// 拖动态：鼠标按住卡中心向右拖卡宽 25%（<35% 提交阈值），检查右选项；再拖回原位松手（回弹，不提交）
async function dragProbe(cur) {
  const b = await p.evaluate(() => { const r = document.querySelector("#card").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width]; });
  await p.mouse.move(b[0], b[1]); await p.mouse.down(); for (let i = 1; i <= 6; i++) await p.mouse.move(b[0] + b[2] * 0.25 * i / 6, b[1]);
  await p.waitForTimeout(250); n++; const shot = `shots/${cfg}_${String(n).padStart(2, "0")}_g1_${cur}_拖动态.png`; await p.screenshot({ path: `${OUT}/${shot}` });
  const c = CARDS[cur]; const E = await p.evaluate(([lb]) => window.__qaE.check(["right"], lb), [{ left: c.left.label, right: c.right.label }]);
  eRows(`g1_${cur}_拖动态(右拖25%)`, E, shot); raw.push({ scene: `g1_${cur}_拖动态`, shot, env: await p.evaluate(() => window.__qaE.env()), E });
  for (let i = 5; i >= 0; i--) await p.mouse.move(b[0] + b[2] * 0.25 * i / 6, b[1]); await p.mouse.up(); await p.waitForTimeout(500); await idle();
}
async function menuProbe() {
  await tapSel("#menubtn"); await p.waitForTimeout(350); n++; const shot = `shots/${cfg}_${String(n).padStart(2, "0")}_菜单展开.png`; await p.screenshot({ path: `${OUT}/${shot}` });
  const E = await p.evaluate(() => window.__qaE.check(["menupop"], null)); eRows("菜单展开", E, shot); raw.push({ scene: "菜单展开", shot, E });
  await tapSel("#menubtn").catch(() => {}); await p.waitForTimeout(200);
}
let fatal = "";
try {
  await p.goto(`${BASE}/?seed=20261012`, { waitUntil: "load" }); await p.waitForFunction(() => !!window.__zz); await p.waitForTimeout(900);
  const done = new Set(); let lockDone = false, winterDone = false, dragDone = false;
  for (let i = 0; i < 300; i++) {
    const ph = await st("phase"), g = await st("generation"); if (g > 2) break;
    if (ph === "card" || ph === "engrave") {
      await idle(); const cur = await st("current"); const key = `g${g}_${cur}_${ph}`;
      if (g === 2) { await scene(`g2_${cur}_开局`); if (want("E")) await menuProbe(); break; }
      if (!done.has(key)) { done.add(key); await scene(`g1_${cur}_${ph === "engrave" ? "刻" : "卡"}`); if (ph === "card" && !dragDone && /^C/.test(cur) && want("E")) { dragDone = true; await dragProbe(cur); } }
      if (ph === "engrave") {
        if (!lockDone) { // 刻阶段先碰一下卡（锁拖 → 提示「先点卡角骨片…」），再点骨片刻下：提示还在而骨片已收起？
          lockDone = true; const c = await p.evaluate(() => { const b = document.querySelector("#card").getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
          await tapXY(c[0], c[1]); await scene(`g1_${cur}_刻_锁拖提示`, 200);
          await tapSel("#bonecorner"); await scene(`g1_${cur}_刻下后_提示残留`, 300); continue; }
        await p.keyboard.press("s"); await p.waitForTimeout(400); continue; }
      if (cur === "T04") { await p.keyboard.press("1"); await p.waitForTimeout(600); if ((await st("current")) === "T04" && (await st("phase")) === "card") await commit("l"); continue; }
      await commit(done.size % 2 ? "l" : "r"); continue; }
    if (ph === "winter") { if (!winterDone) { winterDone = true; await scene("g1_冬夜", 700); } await tapSel("#winter-end"); await p.waitForTimeout(900); continue; }
    if (ph === "ended") { for (let t = 0; t < 60 && !(await vis("#endseq")); t++) await p.waitForTimeout(200); await scene("g1_结局页", 600);
      await tapSel("#endseq [data-do=elder]"); await p.waitForTimeout(800); await scene("g1_先人", 300);
      await tapSel("#elder [data-do=heir]"); await p.waitForTimeout(800); continue; }
    if (ph === "pick") { await scene("g1_挑字", 400);
      const chars = await p.evaluate(() => [...document.querySelectorAll("#pick .cand")].slice(0, 3).map((c) => c.dataset.char));
      for (const ch of chars) { await tapSel(`#pick .cand[data-char='${ch}']`); await p.waitForTimeout(100); await tapSel(`#pick .cand[data-char='${ch}']`); await p.waitForTimeout(100); }
      await tapSel("#pick .go"); await p.waitForTimeout(1000); continue; }
    throw new Error("意外 phase=" + ph); }
} catch (e) { fatal = e.message.split("\n")[0].slice(0, 160); rows.push(["流程", "走查", engine, vpLabel, "FAIL", "脚本流程异常（非版式结论）：" + fatal, ""]); }
if (cardSizes.length) { const t = cardSizes.filter(([n]) => /_T0\d_/.test(n)), c = cardSizes.filter(([n]) => /_C\d+_/.test(n)); const all = cardSizes.map(([, s]) => s);
  const dw = Math.max(...all.map((s) => s[0])) - Math.min(...all.map((s) => s[0])), dh = Math.max(...all.map((s) => s[1])) - Math.min(...all.map((s) => s[1]));
  const fmt = (arr) => [...new Set(arr.map(([, s]) => s.join("×")))].join("、");
  if (want("S")) rows.push(["S FIX_SPEC 验收4", "教学T01–T05 与普通卡卡尺寸一致", engine, vpLabel, dw <= 1 && dh <= 1 ? "PASS" : "FAIL", `宽差 ${dw.toFixed(1)} 高差 ${dh.toFixed(1)}（≤1 为过）；教学卡 ${fmt(t)}；普通卡 ${fmt(c)}`, `raw/${cfg}.json`]); }
if (errs.length) rows.push(["流程", "页面 JS 报错", engine, vpLabel, "FAIL", errs.slice(0, 2).join(" | "), ""]);
fs.writeFileSync(`${OUT}/raw/${cfg}.json`, JSON.stringify(raw, null, 1));
fs.writeFileSync(`${OUT}/matrix_${cfg}.csv`, rows.map((r) => r.map(cell).join(",")).join("\n") + "\n");
await B.close(); process.exit(0);
