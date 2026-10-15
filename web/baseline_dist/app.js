// 造字人 PC 网页壳 · 一年里程碑。纯原生 JS + Canvas2D/DOM，规则全在 ../src/engine.ts，数值全从 ../data/*.json 读。
// 壳只做两件事：按 state.phase 画界面；把鼠标/键盘翻成 Action 交给 step()。
import { createGame, step, run, RULES, CHARS, CARDS } from "./src/engine.js";
import INPUT from "./data/input_map.js";
import { encodeSaveCode, decodeSaveCode, saveToStorage, loadFromStorage, SAVE_KEY } from "./src/savecode.js";

// ---------- 占位常量（手感/点位，接壳后再调；不是规则数值） ----------
const CARD = { cx: 360, cy: 245, w: 300, h: 380 };          // 卡位
const DRAG_RATIO = INPUT.card.drag.commit_threshold_ratio;  // 0.35，来自 input_map
const BONE_HIT = { dx: CARD.w / 2 - 58, dy: -CARD.h / 2 + 10, w: 48, h: 48 }; // 卡角骨片热区（相对卡心）
const SKIP_HIT = { x: CARD.cx - 60, y: CARD.cy + CARD.h / 2 + 14, w: 120, h: 34 }; // 「不刻」按钮
const TRACE_HIT_R = 20;                                      // 象形亮点点中半径（px）
const XSIZE = 260;                                           // 象形描迹画布边长
const LOGW = 720, LOGH = 520;                                // 画布逻辑尺寸：桌面就是它，手机按视口等比缩放
const BUILD_DIST = true;                                    // 构建 dist 时置 true：注册 Service Worker、显示字源页入口
const GLYPH_BASE = "./";                                 // 字形包位置（CSV 的 path 相对它）；构建 dist 时改成 "./"

const DIMS = RULES.dims.keys, DIMNAME = RULES.dims.names, SEASON = RULES.year.season_names;
const METHOD = Object.fromEntries(Object.entries(RULES.winter_night.methods).map(([k, v]) => [k, v.name]));
const POSNAME = { top: "上", middle: "中", bottom: "下" };

const $ = (id) => document.getElementById(id);
const cv = $("cv"), ctx = cv.getContext("2d");
const params = new URLSearchParams(location.search);
let seed = Number(params.get("seed") || 20261012);
let actions = [];                              // 本局的操作序列：存档只存「种子 + 它」，读档时重放
let st = createGame({ seed });
const ui = { dx: 0, dragging: false, startX: 0, preview: false, anim: null, hits: [], w: freshWinter() };
function freshWinter() { return { tally: null, comps: [], base: null, pos: null, points: [] }; }

// ---------- 画布尺寸：按 devicePixelRatio 开后备缓冲区，CSS 尺寸交给样式表（桌面 720×520，手机等比缩） ----------
function fitCanvas(c, w, h) {
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  const x = c.getContext("2d");
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  return x;
}
function fitStage() {
  fitCanvas(cv, LOGW, LOGH);
  if ($("xcv")) fitCanvas($("xcv"), XSIZE, XSIZE);
  render();
}
addEventListener("resize", fitStage);
addEventListener("orientationchange", () => setTimeout(fitStage, 120));
// 客户端坐标 → 画布逻辑坐标（画布被 CSS 缩放过，所以按显示尺寸折算）
function toLocal(e, w, h) {
  const r = e.target.getBoundingClientRect ? e.target.getBoundingClientRect() : { left: 0, top: 0, width: w, height: h };
  return { x: (e.clientX - r.left) * w / r.width, y: (e.clientY - r.top) * h / r.height };
}

// ---------- 字形：按 glyph_pack_v1.csv 的 path 加载，取 order=1（甲骨文） ----------
const GLYPH = {}; const IMG = {};
function parseCSV(t) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
async function loadGlyphs() {
  try {
    const rows = parseCSV(await (await fetch(GLYPH_BASE + "glyph/glyph_pack_v1.csv")).text());
    const h = rows[0], I = (k) => h.indexOf(k);
    for (const r of rows.slice(1)) if (r[I("order")] === "1") GLYPH[r[I("id")]] = GLYPH_BASE + r[I("path")];
    for (const [ch, def] of Object.entries(CHARS)) {
      const url = GLYPH[def.glyph_id]; if (!url) continue;
      const im = new Image(); im.onload = () => render(); im.src = url; IMG[ch] = im;
    }
  } catch (e) { toast("字形包没加载上：" + e.message); }
}
const glyphURL = (ch) => GLYPH[CHARS[ch]?.glyph_id] || "";

// ---------- 派发 ----------
function dispatch(a) {
  try {
    if (a.type === "choose") a = { ...a, expectCard: st.current };
    st = step(st, a);
    actions.push(a);                       // 记操作序列：存档码 = 种子 + 它，读档时重放
    saveNow();
  } catch (e) { toast(e.message); }
  ui.dx = 0; render();
}
// ---------- 存档：本地自动存 + 存档码导出/导入 ----------
function saveNow() {
  try { saveToStorage(localStorage, seed, actions); } catch (e) { /* 隐私模式下 localStorage 可能不可用，不影响玩 */ }
}
function restore() {
  let d = null;
  try { d = loadFromStorage(localStorage); } catch (e) { d = null; }
  if (!d) return false;
  try {
    st = run({ seed: d.seed }, d.actions);  // 同种子 + 同操作 → 同一个状态
    seed = d.seed; actions = d.actions.slice();
    toast(`读回上次的进度：${st.log[st.log.length - 1] || "开局"}`);
    return true;
  } catch (e) {
    try { localStorage.removeItem(SAVE_KEY); } catch {}
    toast("存档读不出来，重新开局");
    return false;
  }
}
function newGame(s) {
  seed = s >>> 0; actions = []; st = createGame({ seed }); ui.w = freshWinter();
  saveNow(); render();
}
function exportCode() {
  $("dlgtext").value = encodeSaveCode(seed, actions);
  openDlg("导出存档码", "把下面这串抄走（或点复制）。在新设备/新档案里粘贴导入，就从这里接着走。", true);
}
function importCode() {
  const code = $("dlgtext").value;
  let d;
  try { d = decodeSaveCode(code); } catch (e) { return openDlg("导入存档码", "导不进来：" + e.message, false); }
  try {
    st = run({ seed: d.seed }, d.actions); seed = d.seed; actions = d.actions.slice(); ui.w = freshWinter();
    saveNow(); render(); closeDlg();
    toast(`导入成功：种子 ${seed}，${actions.length} 步`);
  } catch (e) { openDlg("导入存档码", "这串码走不通：" + e.message, false); }
}
function openDlg(title, msg, editable) {
  $("dlgtitle").textContent = title;
  $("dlgmsg").textContent = msg; $("dlgmsg").hidden = !msg;
  $("dlgtext").readOnly = !editable;
  $("dlgtext").hidden = !editable;
  $("dlgapply").hidden = !editable;
  $("dlgcopy").hidden = !editable;
  $("savedlg").classList.add("on");
  if (editable) { $("dlgtext").focus(); $("dlgtext").select(); }
}
function closeDlg() { $("savedlg").classList.remove("on"); }
$("dlgcopy").addEventListener("click", async () => {
  const t = $("dlgtext");
  try { await navigator.clipboard.writeText(t.value); toast("已复制"); }
  catch (e) { t.focus(); t.select(); toast("复制不了，请手动选中复制"); }
});
$("dlgapply").addEventListener("click", importCode);
$("dlgclose").addEventListener("click", closeDlg);
$("savedlg").addEventListener("click", (e) => { if (e.target === $("savedlg")) closeDlg(); });
$("dlgtext").addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); closeDlg(); } });
addEventListener("keydown", (e) => { if (e.key === "Escape") closeDlg(); });
$("dlgexport").addEventListener("click", exportCode);
$("dlgimport").addEventListener("click", () => openDlg("导入存档码", "把存档码粘贴在下面，点导入。", true));
let toastT;
function toast(m) { const t = $("toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 1800); }
const curCard = () => CARDS.find((c) => c.id === st.current);
const usable = (ch) => st.zilu.includes(ch) && !st.newThisGen.includes(ch);
const pool = () => st.zilu.filter((c) => usable(c) && !st.dropped.includes(c)); // 冬夜部件池（显示用；判定在引擎）

// ---------- Canvas：卡 / 刻 ----------
function wrap(text, x, y, maxW, lh) {
  let line = "";
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxW) { ctx.fillText(line, x, y); y += lh; line = ch; } else line += ch;
  }
  if (line) ctx.fillText(line, x, y);
  return y + lh;
}
function drawDots(opt, x, y, align) {
  // 分量圆点：动哪几维、点越大动得越多；不显示涨跌；有迹多一个骨片标记
  ctx.textAlign = "center";
  const ks = DIMS.filter((k) => typeof opt.delta[k] === "number");
  let i = 0;
  for (const k of ks) {
    const r = 3 + Math.abs(opt.delta[k]) / 2;
    const px = x + (align === "left" ? i * 30 : -i * 30);
    ctx.fillStyle = "#e9dfc9"; ctx.beginPath(); ctx.arc(px, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.font = "12px serif"; ctx.fillText(DIMNAME[k], px, y + 22); i++;
  }
  if (opt.trace || opt.bones) { const px = x + (align === "left" ? i * 30 : -i * 30); ctx.fillStyle = "#d8c8a0"; ctx.fillRect(px - 6, y - 8, 12, 16); ctx.fillStyle = "#e9dfc9"; ctx.fillText("骨", px, y + 22); }
}
function drawCard(card, dx, dim) {
  ctx.save();
  ctx.translate(CARD.cx + dx, CARD.cy); ctx.rotate(dx * 0.0012);
  ctx.globalAlpha = dim ? 0.55 : 1;
  ctx.fillStyle = "#efe6d2"; ctx.strokeStyle = "#8a7652"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-CARD.w / 2, -CARD.h / 2, CARD.w, CARD.h, 14); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#3b2f20"; ctx.textAlign = "left"; ctx.font = "bold 18px serif";
  ctx.fillText(`${SEASON[card.season]} · ${card.speaker}`, -CARD.w / 2 + 18, -CARD.h / 2 + 34);
  ctx.font = "16px serif";
  wrap(card.text, -CARD.w / 2 + 18, -CARD.h / 2 + 70, CARD.w - 36, 24);
  // 拖动时显示将要提交的一边
  const thr = DRAG_RATIO * CARD.w;
  if (Math.abs(dx) > 8) {
    const opt = dx < 0 ? card.left : card.right;
    ctx.fillStyle = Math.abs(dx) >= thr ? "#7a2f2f" : "#6b5a3e"; ctx.font = "bold 18px serif"; ctx.textAlign = "center";
    ctx.fillText(opt.label, 0, CARD.h / 2 - 60);
    ctx.fillStyle = "#c9b897"; ctx.fillRect(-100, CARD.h / 2 - 40, 200, 6);
    ctx.fillStyle = "#7a2f2f"; ctx.fillRect(-100, CARD.h / 2 - 40, 200 * Math.min(1, Math.abs(dx) / thr), 6);
  }
  if (card.drops.length) { ctx.fillStyle = "#8a6a2a"; ctx.font = "13px serif"; ctx.textAlign = "left"; ctx.fillText("可落字：" + card.drops.map((d) => `${d.char}（${d.label}）`).join("、"), -CARD.w / 2 + 18, CARD.h / 2 - 14); }
  ctx.restore();
}
function render() {
  ui.hits = [];
  ctx.clearRect(0, 0, LOGW, LOGH);
  $("winter").hidden = st.phase !== "winter"; $("ended").hidden = st.phase !== "ended";
  if (st.phase === "card" || st.phase === "engrave") {
    const card = curCard();
    ctx.fillStyle = "#9a8f79"; ctx.font = "16px serif"; ctx.textAlign = "left";
    ctx.fillText("← " + card.left.label, 16, 30); ctx.textAlign = "right"; ctx.fillText(card.right.label + " →", LOGW - 16, 30);
    drawCard(card, st.phase === "card" ? ui.dx : 0, st.phase === "engrave");
    if (st.phase === "card" && ui.preview) { drawDots(card.left, 30, 470, "left"); drawDots(card.right, LOGW - 30, 470, "right"); }
    if (st.phase === "engrave") drawEngrave();
  }
  renderDOM();
}
function drawEngrave() {
  const t = st.pendingTrace;
  ctx.fillStyle = "rgba(20,16,12,.82)"; ctx.fillRect(CARD.cx - CARD.w / 2 - 20, CARD.cy - 40, CARD.w + 40, 120);
  ctx.fillStyle = "#e9dfc9"; ctx.font = "14px serif"; ctx.textAlign = "left";
  ctx.fillText("卡上出现了一道迹：", CARD.cx - CARD.w / 2 - 10, CARD.cy - 18);
  wrap(t.tally_text, CARD.cx - CARD.w / 2 - 10, CARD.cy + 4, CARD.w + 20, 20);
  // 卡角骨片
  const b = { x: CARD.cx + BONE_HIT.dx, y: CARD.cy + BONE_HIT.dy, w: BONE_HIT.w, h: BONE_HIT.h };
  const can = st.bones >= RULES.engrave_tally.bone_cost;
  ctx.fillStyle = can ? "#e0c98a" : "#6b6253"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#3b2f20"; ctx.font = "bold 16px serif"; ctx.textAlign = "center"; ctx.fillText("刻", b.x + b.w / 2, b.y + 30);
  ui.hits.push({ ...b, fn: () => dispatch({ type: "engrave", trace: t.target }) });
  ctx.fillStyle = "#4a3f2f"; ctx.beginPath(); ctx.roundRect(SKIP_HIT.x, SKIP_HIT.y, SKIP_HIT.w, SKIP_HIT.h, 6); ctx.fill();
  ctx.fillStyle = "#e9dfc9"; ctx.fillText("不刻（S）", SKIP_HIT.x + SKIP_HIT.w / 2, SKIP_HIT.y + 23);
  ui.hits.push({ ...SKIP_HIT, fn: () => dispatch({ type: "skip_engrave" }) });
  ctx.fillStyle = "#c9a86a"; ctx.font = "13px serif"; ctx.fillText(`空骨片 ${st.bones} · 点卡角骨片或按 K 刻`, CARD.cx, CARD.cy + CARD.h / 2 + 70);
}

// ---------- DOM：四维、字匣、事签、字录、冬夜、结局 ----------
const gimg = (ch) => `<img src="${glyphURL(ch)}" alt="${ch}">`;
function renderDOM() {
  $("dims").innerHTML = DIMS.map((k) => `<div class="dim"><div class="lbl"><span>${DIMNAME[k]}</span><span>${st.dims[k]}</span></div><div class="bar"><div class="fill" style="width:${st.dims[k]}%"></div></div></div>`).join("");
  $("meta").textContent = `余年 ${st.yearsLeft} · 本年剩 ${st.deck.length + (st.current ? 1 : 0)} 张 · ${st.current ?? ""}`;
  $("seedinfo").textContent = `种子 ${seed}`;
  const card = st.phase === "card" ? curCard() : null;
  $("wordbox").innerHTML = st.wordBox.map((ch, i) => {
    const used = st.dropped.includes(ch);
    const ok = card && !used && usable(ch) && card.drops.some((d) => d.char === ch);
    return `<button class="slot ${ok ? "ok" : ""} ${used ? "used" : ""}" data-slot="${i}" ${st.phase !== "card" ? "disabled" : ""}>${gimg(ch)}<span>${i + 1}·${ch}${used ? "（已落）" : ""}</span></button>`;
  }).join("");
  $("tallies").innerHTML = `<div>空骨片 ${"▮".repeat(st.bones)}${st.bones ? "" : "无"}（${st.bones}）</div>` +
    st.tallies.map((t) => `<div class="tally">${t.id}：${t.text}</div>`).join("");
  $("zilu").innerHTML = st.zilu.map((c) => `<span class="zl ${st.newThisGen.includes(c) ? "new" : ""}">${gimg(c)}${c}${(st.clues[c] || []).map((x) => `<small>${x}</small>`).join("")}</span>`).join("") +
    Object.entries(st.clues).filter(([c]) => !st.zilu.includes(c)).map(([c, xs]) => `<div><small>线索 ${c}：${xs.join("；")}</small></div>`).join("");
  $("log").innerHTML = st.log.map((l) => `<li>${l}</li>`).join(""); $("log").scrollTop = 1e9;
  if (st.phase === "winter") renderWinter();
  if (st.phase === "ended") renderEnded();
}
function renderWinter() {
  const w = ui.w, el = $("winter");
  if (w.tally && !st.tallies.some((t) => t.id === w.tally)) ui.w = freshWinter();
  const t = st.tallies.find((x) => x.id === ui.w.tally);
  const lowMem = st.dims.memory < RULES.winter_night.low_memory_threshold;
  let h = `<h2>冬夜</h2><p>点一张事签，按造法刻。${lowMem ? "<small>（记太低：事签显示缺词 —— 占位，未实现）</small>" : ""}</p>`;
  h += st.tallies.length ? st.tallies.map((x) => `<div class="tally ${x.id === ui.w.tally ? "sel" : ""}" data-tally="${x.id}">${x.id}：${x.text}</div>`).join("") : "<p>手里没有事签了。</p>";
  if (t) {
    const def = CHARS[t.target]; const P = pool();
    h += `<h3>${METHOD[def.method]}</h3>`;
    if (def.method === "huiyi") {
      h += `<div>选两个部件（可重复）：已选 ${ui.w.comps.join(" + ") || "—"}</div>` + P.map((c) => `<button class="comp" data-comp="${c}">${gimg(c)}${c}</button>`).join("") + `<button class="act" data-do="clear">清空</button>`;
    } else if (def.method === "zhishi") {
      h += `<div>底字：</div>` + P.map((c) => `<button class="comp ${ui.w.base === c ? "sel" : ""}" data-base="${c}">${gimg(c)}${c}</button>`).join("") +
        `<div>位置：</div>` + RULES.winter_night.methods.zhishi.positions.map((p) => `<button class="comp ${ui.w.pos === p ? "sel" : ""}" data-pos="${p}">${POSNAME[p]}</button>`).join("");
    } else {
      h += `<div>依次点三个亮点：${ui.w.points.join(" → ") || "—"} <button class="act" data-do="clear">重描</button></div><canvas id="xcv" width="${XSIZE}" height="${XSIZE}"></canvas>`;
    }
    h += `<div><button class="act" data-do="carve">刻（Enter）</button><button class="act" data-do="defer">留到明年</button></div>`;
  }
  h += `<hr><button class="act" data-do="end">天亮了</button>`;
  el.innerHTML = h;
  if (t && CHARS[t.target].method === "xiangxing") drawTrace(t.target);
}
function drawTrace(target) {
  const el = $("xcv"), def = CHARS[target];
  fitCanvas(el, XSIZE, XSIZE);                      // 这块画布每次渲染都重建，重设一次 DPR 缩放
  const x = el.getContext("2d");
  x.clearRect(0, 0, XSIZE, XSIZE);
  const im = IMG[target]; if (im?.complete) { x.globalAlpha = 0.18; x.drawImage(im, 20, 20, XSIZE - 40, XSIZE - 40); x.globalAlpha = 1; }
  for (const p of def.trace_points) {
    const i = ui.w.points.indexOf(p.id);
    x.fillStyle = i >= 0 ? "#7a2f2f" : "#e0a020"; x.beginPath(); x.arc(p.x * XSIZE, p.y * XSIZE, 12, 0, Math.PI * 2); x.fill();
    if (i >= 0) { x.fillStyle = "#fff"; x.font = "bold 14px serif"; x.textAlign = "center"; x.fillText(String(i + 1), p.x * XSIZE, p.y * XSIZE + 5); }
  }
  // 指针事件（鼠标/触摸/笔都走这条），客户端坐标折算成画布坐标
  el.onpointerdown = (e) => {
    const p = toLocal(e, XSIZE, XSIZE);
    const hit = def.trace_points.find((q) => Math.hypot(q.x * XSIZE - p.x, q.y * XSIZE - p.y) <= TRACE_HIT_R);
    if (hit && !ui.w.points.includes(hit.id) && ui.w.points.length < 3) { ui.w.points.push(hit.id); render(); }
  };
}
function winterCarve() {
  const t = st.tallies.find((x) => x.id === ui.w.tally); if (!t) return toast("先点一张事签");
  const m = CHARS[t.target].method; let answer;
  if (m === "huiyi") { if (ui.w.comps.length !== 2) return toast("要两个部件"); answer = { method: m, components: ui.w.comps.slice() }; }
  else if (m === "zhishi") { if (!ui.w.base || !ui.w.pos) return toast("要底字和位置"); answer = { method: m, base: ui.w.base, position: ui.w.pos }; }
  else { if (ui.w.points.length !== 3) return toast("要依次点三个亮点"); answer = { method: m, points: ui.w.points.slice() }; }
  const before = st.zilu.length;
  dispatch({ type: "winter_carve", tally: t.id, answer });
  toast(st.zilu.length > before ? `刻成「${t.target}」` : "刻错了，骨片裂");
  ui.w = freshWinter(); render();
}
$("winter").addEventListener("click", (e) => {
  const d = e.target.closest("[data-tally],[data-comp],[data-base],[data-pos],[data-do]"); if (!d) return;
  const w = ui.w;
  if (d.dataset.tally) { ui.w = { ...freshWinter(), tally: d.dataset.tally }; }
  else if (d.dataset.comp) { if (w.comps.length < 2) w.comps.push(d.dataset.comp); }
  else if (d.dataset.base) w.base = d.dataset.base;
  else if (d.dataset.pos) w.pos = d.dataset.pos;
  else if (d.dataset.do === "clear") { w.comps = []; w.points = []; }
  else if (d.dataset.do === "carve") return winterCarve();
  else if (d.dataset.do === "defer") { dispatch({ type: "winter_defer", tally: w.tally }); ui.w = freshWinter(); }
  else if (d.dataset.do === "end") { dispatch({ type: "winter_end" }); return; }
  render();
});
function renderEnded() {
  const e = st.ending, L = st.legacy;
  $("ended").innerHTML = `<h1>${e.name}</h1><p>${e.kind === "good" ? "这一代平安走完。" : "这一代没撑住。"}</p>
    <p>${DIMS.map((k) => `${DIMNAME[k]} ${st.dims[k]}`).join(" · ")} · 骨片 ${st.bones}</p>
    <p>传下字录：${L ? L.zilu.join(" ") : "—"}</p><p>传下事签：${L?.carriedTally ? L.carriedTally.id : "无"}</p>
    <button class="act" data-do="same">同种子重开</button><button class="act" data-do="new">换种子</button>`;
}
$("ended").addEventListener("click", (e) => {
  const d = e.target.closest("[data-do]"); if (!d) return;
  if (d.dataset.do === "new") newGame((Math.random() * 1e9) >>> 0);
  else newGame(seed);                                  // 同种子重开：清掉这一局的操作序列
});
$("wordbox").addEventListener("click", (e) => { const b = e.target.closest("[data-slot]"); if (b && !b.disabled) dispatch({ type: "choose", side: "drop", slot: Number(b.dataset.slot) }); });

// ---------- 拖卡（指针事件：鼠标、触摸、笔都走这条；画布可能被 CSS 缩放，先折算成画布坐标） ----------
const pos = (e) => toLocal(e, LOGW, LOGH);
const inRect = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
cv.addEventListener("pointerdown", (e) => {
  const p = pos(e);
  const h = ui.hits.find((r) => inRect(p, r)); if (h) return h.fn();
  if (st.phase !== "card" || ui.anim) return;
  if (!inRect(p, { x: CARD.cx - CARD.w / 2, y: CARD.cy - CARD.h / 2, w: CARD.w, h: CARD.h })) return;
  ui.dragging = true; ui.startX = p.x; ui.preview = true; cv.setPointerCapture(e.pointerId); render();
});
cv.addEventListener("pointermove", (e) => { if (!ui.dragging) return; ui.dx = pos(e).x - ui.startX; render(); });
function release() {
  if (!ui.dragging) return;
  ui.dragging = false; ui.preview = false;
  const thr = DRAG_RATIO * CARD.w;
  if (Math.abs(ui.dx) >= thr) animateTo(Math.sign(ui.dx) * 600, () => dispatch(INPUT.card.drag[ui.dx < 0 ? "left_action" : "right_action"]));
  else animateTo(0, () => {}); // 回弹，不提交
}
cv.addEventListener("pointerup", release); cv.addEventListener("pointercancel", release);
function animateTo(target, done) {
  const from = ui.dx, t0 = performance.now(), dur = 160;
  ui.anim = true;
  const tick = (t) => {
    const k = Math.min(1, (t - t0) / dur); ui.dx = from + (target - from) * (1 - (1 - k) ** 3); render();
    if (k < 1) requestAnimationFrame(tick); else { ui.anim = null; done(); ui.dx = 0; render(); }
  };
  requestAnimationFrame(tick);
}

// ---------- 键盘 ----------
addEventListener("keydown", (e) => {
  if (st.phase === "card") {
    if (e.code === "Space") { e.preventDefault(); if (!ui.preview) { ui.preview = true; render(); } return; }
    const a = INPUT.card.keys[e.code]; if (a && !e.repeat) { e.preventDefault(); dispatch(a); }
  } else if (st.phase === "engrave") {
    if (e.code === INPUT.engrave.key) dispatch({ type: "engrave", trace: st.pendingTrace.target });
    else if (e.code === "KeyS") dispatch(INPUT.engrave.skip); // S 不刻：占位键，input_map 没给
  } else if (st.phase === "winter" && e.key === INPUT.winter.confirm.key) { e.preventDefault(); winterCarve(); }
});
addEventListener("keyup", (e) => { if (e.code === "Space" && ui.preview && !ui.dragging) { ui.preview = false; render(); } });

// 调试钩子：无界面回放 / 自检用
window.__zz = { get st() { return st; }, get seed() { return seed; }, get actions() { return actions; },
  dispatch, newGame, restore, code: () => encodeSaveCode(seed, actions),
  importCode(c) { $("dlgtext").value = c; return importCode(); } };
restore();                                             // 有本地存档就先读回来
render(); loadGlyphs(); fitStage();
if (BUILD_DIST && "serviceWorker" in navigator) {      // 只有发布目录里注册：离线后重开还能玩
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
