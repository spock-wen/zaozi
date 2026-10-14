// 造字人 · 一年里程碑重做壳。规则全在 ../src/engine.js，数值全从 ../data/*.json 读。
// 这一版：手机/平板/桌面三档布局；DOM 卡（卡面图 <picture>）；每代目标；教学开局；
// 开局挑字；多代流程；WebAudio 音效 + 菜单静音；存档码导入导出。
// 只动 transform / opacity；圆点与资源条都是 DOM（PM 决定 1）。
import {
  createGame, step, run, RULES, CHARS, CARDS, GOALS, TUTORIAL,
  PICK_CHARS, isTutorialCard, tutorialStepOf,
} from "../src/engine.js";
import CARD_ART from "../data/card_art.js";
import INPUT from "../data/input_map.js";
import { encodeSaveCode, decodeSaveCode, saveToStorage, loadFromStorage, SAVE_KEY } from "../src/savecode.js";

const BUILD_DIST = false;                 // 构建 dist 时置 true：注册 Service Worker
const GLYPH_BASE = "../";                 // 字形包位置；构建 dist 时改成 "./"

const DIMS = RULES.dims.keys, DIMNAME = RULES.dims.names, SEASON = RULES.year.season_names;
const METHOD = Object.fromEntries(Object.entries(RULES.winter_night.methods).map(([k, v]) => [k, v.name]));
const POSNAME = { top: "上", middle: "中", bottom: "下" };
const DRAG_RATIO = INPUT.card.drag.commit_threshold_ratio;   // 0.35
const SIDEBAR_KEY = "zaozi.sidebar.open";
const MUTE_KEY = "zaozi.mute";
const MOTION_KEY = "zaozi.motion";
const BACKUP_KEY = SAVE_KEY + ".bak";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
// ?debug=1&debug_goal=G_FOOD_65：把某个目标硬塞进每一代的目标里，方便在网页上反复验它。
const DEBUG = params.get("debug") === "1";
const DEBUG_GOAL = DEBUG ? (params.get("debug_goal") || null) : null;
const reducedPref = () => (localStorage.getItem(MOTION_KEY) === "1") || matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- 状态 ----------
let seed = Number(params.get("seed") || 20261012);
let actions = [];
let lastHover = { x: NaN, y: NaN };   // 上一次鼠标位置：区分「真的移动」和重绘后对静止指针重发的 pointerover
let st = createGame({ seed, debugGoal: DEBUG_GOAL });
const ui = {
  dx: 0, dragging: false, dragged: false, startX: 0, hold: false, holdT: 0,
  preview: false, kbDir: null, animating: false, floats: {},
  winter: freshWinter(),
  goalShown: 0, bannerQueue: [], bannerOn: false,
  panelOpen: false, menuOpen: false, elderShown: false,
  pickFocus: null, pickTapped: null,
  presses: new Map(),                 // 挑字：每次按下（按 pointerId 分），值是 { token, node, key }
  swallow: [],                        // 已被 pointerup 处理、等待吞掉其合成 click 的 press token 队列
  lastDims: null,
};
function freshWinter() { return { tally: null, comps: [], base: null, pos: null, points: [] }; }

// ---------- 音效（WebAudio 合成；静音开关存 localStorage） ----------
let ac = null;
const muted = () => localStorage.getItem(MUTE_KEY) !== "0";
function audio() {
  if (muted()) return null;
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ac.state === "suspended") ac.resume().catch(() => {});
  return ac;
}
function tone(freq, dur, type = "sine", gain = 0.05, when = 0) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + when;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
const sfx = {
  threshold: () => tone(220, 0.08, "triangle", 0.03),
  commit:    () => tone(520, 0.18, "sawtooth", 0.03),
  rebound:   () => tone(180, 0.10, "sine", 0.03),
  flip:      () => tone(300, 0.22, "triangle", 0.035),
  up:        () => { tone(523, 0.12, "triangle", 0.04, 0); tone(659, 0.12, "triangle", 0.04, 0.12); },
  down:      () => tone(160, 0.20, "sine", 0.05),
  danger:    () => tone(110, 0.40, "sine", 0.05),
  drop:      () => tone(140, 0.26, "sine", 0.05),
  engrave:   () => { tone(700, 0.16, "square", 0.03, 0); tone(640, 0.16, "square", 0.03, 0.16); },
  evolve:    () => tone(880, 0.60, "sine", 0.03),
  goal:      () => { [523, 659, 784].forEach((f, i) => tone(f, 0.16, "triangle", 0.05, i * 0.16)); },
  pick:      () => tone(320, 0.12, "triangle", 0.04),
  unpick:    () => tone(420, 0.10, "triangle", 0.03),
  ready:     () => { tone(160, 0.30, "sine", 0.05, 0); tone(220, 0.60, "triangle", 0.03, 0.2); },
  genEnd:    () => { tone(300, 0.60, "sine", 0.04, 0); tone(132, 1.2, "sine", 0.05, 0.4); },
};

// ---------- 布局 ----------
let lastLayout = "";
function computeLayout() {
  const w = innerWidth, h = innerHeight;
  let view;
  if (w >= 1024) view = "desktop";
  else if (w >= 600) view = h >= w ? "tablet-portrait" : "tablet-landscape";
  else view = "mobile";
  const orient = h >= w ? "portrait" : "landscape";
  const key = view + ":" + orient;
  if (key === lastLayout) return;
  lastLayout = key;
  document.body.dataset.view = view;
  document.body.dataset.orient = orient;
  $("rotate-hint").hidden = !(view === "mobile" && orient === "landscape");
  document.body.dataset.reduced = reducedPref() ? "1" : "0";
  applySidebar();
  render();
}
function applySidebar() {
  const bar = $("sidebar");
  const view = document.body.dataset.view;
  if (view !== "desktop" && view !== "tablet-landscape") { bar.hidden = true; document.body.classList.remove("side-collapsed"); return; }
  bar.hidden = false;
  const w = innerWidth;
  const stored = localStorage.getItem(SIDEBAR_KEY);
  let open = stored === null ? w >= 1440 : stored === "1";
  if (w < 1100) open = false;                 // 1024 附近强制收起
  bar.classList.toggle("collapsed", !open);
  document.body.classList.toggle("side-collapsed", view === "desktop" && !open);
}
let resizeT;
addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(computeLayout, 120); });
addEventListener("orientationchange", () => setTimeout(computeLayout, 150));
matchMedia("(prefers-reduced-motion: reduce)").addEventListener?.("change", computeLayout);

// ---------- 字形 / 卡面图 ----------
const GLYPH = {}, IMG = {};
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
function loadGlyphs() {
  return fetch(GLYPH_BASE + "glyph/glyph_pack_v1.csv").then((r) => r.text()).then((t) => {
    const rows = parseCSV(t), h = rows[0], I = (k) => h.indexOf(k);
    for (const r of rows.slice(1)) if (r[I("order")] === "1") GLYPH[r[I("id")]] = GLYPH_BASE + r[I("path")];
    for (const [ch, def] of Object.entries(CHARS)) {
      const url = GLYPH[def.glyph_id]; if (!url) continue;
      const im = new Image(); im.onload = () => render(); im.src = url; IMG[ch] = im;
    }
  }).catch((e) => toast("字形包没加载上：" + e.message));
}
const glyphURL = (ch) => GLYPH[CHARS[ch]?.glyph_id] || "";
const gimg = (ch) => (glyphURL(ch) ? `<img src="${glyphURL(ch)}" alt="${ch}" loading="lazy">` : `<span>${ch}</span>`);
function artHTML(card) {
  const art = CARD_ART.cards[card.id]; if (!art) return "";
  const b = CARD_ART.base;
  return `<picture>` +
    `<source media="(min-width:1024px)" type="image/webp" srcset="${b}${art}_d@1x.webp 1x, ${b}${art}_d@2x.webp 2x">` +
    `<source media="(min-width:1024px)" type="image/png" srcset="${b}${art}_d@1x.png 1x, ${b}${art}_d@2x.png 2x">` +
    `<source type="image/webp" srcset="${b}${art}_m@1x.webp 1x, ${b}${art}_m@2x.webp 2x">` +
    `<img src="${b}${art}_m@1x.png" alt="" width="296" height="216" decoding="async"></picture>`;
}

// ---------- 交互助手 ----------
function toast(m) {
  const t = $("toast"); t.textContent = m; t.classList.add("on");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("on"), 1800);
}
function deferInteract(el, ms = 350) {         // 防「天亮了」穿透到下一屏的按钮
  el.style.pointerEvents = "none";
  setTimeout(() => { el.style.pointerEvents = ""; }, ms);
}
function on(el, fn) { el.addEventListener("click", (e) => { if (!e.target.closest?.("a[href]")) e.preventDefault?.(); fn(e); }); }

// ---------- 派发 / 存档 ----------
function dispatch(a) {
  try {
    st = step(st, a);
    actions.push(a);
    afterAction(a);
    saveNow();
  } catch (e) { toast(e.message); }
  ui.dx = 0; ui.kbDir = null; ui.preview = false; ui.hold = false;
  render();
}
function afterAction(a) {
  // 音效 + 数值飘字（对比前后四维）
  const before = ui.lastDims || {};
  const after = st.dims, floats = {};
  for (const k of DIMS) if (before[k] != null && before[k] !== after[k]) floats[k] = after[k] - before[k];
  ui.floats = floats;
  if (Object.keys(floats).length) { (Object.values(floats).some((v) => v < 0) ? sfx.down : sfx.up)(); }
  if (a.type === "choose" && a.side === "drop") sfx.drop();
  if (a.type === "engrave") sfx.engrave();
  if (a.type === "winter_carve") { /* 结果音在 winterCarve 里按对错播 */ }
  for (const k of DIMS) if (after[k] <= 15 || after[k] >= 85) sfx.danger();
  setTimeout(() => { ui.floats = {}; render(); }, 650);
}
function saveNow() {
  ui.lastDims = { ...st.dims };
  try { saveToStorage(localStorage, seed, actions); } catch { /* 隐私模式 */ }
}
function restore() {
  let d = null;
  try { d = loadFromStorage(localStorage); } catch { d = null; }
  if (!d) return false;
  try {
    st = run({ seed: d.seed }, d.actions);
    seed = d.seed; actions = d.actions.slice();
    toast(`读回上次的进度：${st.log[st.log.length - 1] || "开局"}`);
    return true;
  } catch (e) {
    try {                                  // 先备份再删（B5）
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) localStorage.setItem(BACKUP_KEY, raw);
      localStorage.removeItem(SAVE_KEY);
    } catch { /* 隐私模式 */ }
    toast("存档读不出来，已备份后重开");
    return false;
  }
}
function newGame(s) {
  seed = s >>> 0; actions = []; st = createGame({ seed, debugGoal: DEBUG_GOAL }); ui.winter = freshWinter();
  ui.goalShown = 0; ui.bannerQueue = []; ui.elderShown = false;
  ui.pickFocus = null; ui.pickTapped = null; ui.presses.clear(); ui.swallow = [];
  ui.lastDims = null; saveNow(); render();
}
// ---------- 存档码 ----------
function openDlg(title, msg, editable) {
  $("dlgtitle").textContent = title;
  $("dlgmsg").textContent = msg; $("dlgmsg").hidden = !msg;
  $("dlgtext").readOnly = !editable; $("dlgtext").hidden = !editable;
  $("dlgapply").hidden = !editable; $("dlgcopy").hidden = !editable;
  $("savedlg").hidden = false;
  if (editable) { $("dlgtext").focus(); $("dlgtext").select(); }
}
function closeDlg() { $("savedlg").hidden = true; }
function exportCode() {
  $("dlgtext").value = encodeSaveCode(seed, actions);
  openDlg("导出存档码", "把下面这串抄走（或点复制）。在新设备里粘贴导入，就从这里接着走。", true);
}
function importCode() {
  const code = $("dlgtext").value;
  let d;
  try { d = decodeSaveCode(code); } catch (e) { return openDlg("导入存档码", "导不进来：" + e.message, false); }
  try {
    st = run({ seed: d.seed }, d.actions); seed = d.seed; actions = d.actions.slice();
    ui.winter = freshWinter(); ui.goalShown = 0; ui.bannerQueue = []; ui.elderShown = false;
    ui.lastDims = null; saveNow(); render(); closeDlg();
    toast(`导入成功：种子 ${seed}，${actions.length} 步`);
  } catch (e) { openDlg("导入存档码", "这串码走不通：" + e.message, false); }
}

// ---------- 渲染 ----------
const curCard = () => CARDS.find((c) => c.id === st.current);
const usable = (ch) => st.zilu.includes(ch) && !st.newThisGen.includes(ch);
const pool = () => st.zilu.filter((c) => usable(c) && !st.dropped.includes(c));

function previewSide() {
  if (ui.kbDir) return ui.kbDir;
  if (ui.dragging || ui.hold) return ui.dx < 0 ? "left" : (ui.dx > 0 ? "right" : "left");
  return null;
}
function dimsHTML() {
  const side = previewSide();
  const card = (st.phase === "card" || st.phase === "engrave") ? curCard() : null;
  const opt = side && card ? (side === "left" ? card.left : card.right) : null;
  return DIMS.map((k) => {
    const v = st.dims[k];
    const danger = v <= 15 || v >= 85;
    let dots = "";
    if (opt && typeof opt.delta[k] === "number") {
      const a = Math.abs(opt.delta[k]);
      dots = `<div class="dots on">${a > 8 ? '<i class="dot s3"></i>' : a > 4 ? '<i class="dot s2"></i>' : '<i class="dot"></i>'}</div>`;
    } else dots = `<div class="dots"></div>`;
    const fl = ui.floats[k];
    const float = fl ? `<span class="float ${fl > 0 ? "up" : "down"}">${fl > 0 ? "+" : "−"}${Math.abs(fl)}</span>` : "";
    return `<div class="dim${danger ? " danger" : ""}">${dots}${float}<div class="lbl"><span>${DIMNAME[k]}</span><span>${v}</span></div><div class="bar"><div class="fill" style="transform:scaleX(${(v / 100).toFixed(3)})"></div></div></div>`;
  }).join("");
}
function floatHTML() { return ""; }

function goalsState() { return (st.goals || []).map((g) => ({ id: g.id, text: g.text, achieved: g.achieved })); }
function renderGoalSlip() {
  const gs = goalsState(), n = gs.filter((g) => g.achieved).length;
  const slip = $("goals-slip");
  const desktopExpanded = document.body.dataset.view === "desktop" && !$("sidebar").classList.contains("collapsed");
  const show = st.phase !== "ended" && st.phase !== "pick" && gs.length > 0 && !desktopExpanded;
  slip.hidden = !show;
  if (!show) return;
  slip.innerHTML = `目标 ${gs.map((g) => `<i class="gdot${g.achieved ? " on" : ""}"></i>`).join("")}`;
}
function renderGoalPanel() {
  const p = $("goals-panel");
  p.hidden = !ui.panelOpen;
  if (!ui.panelOpen) return;
  p.innerHTML = goalsState().map((g) => `<div class="goal${g.achieved ? " on" : ""}"><span class="mk">${g.achieved ? "◆" : "◇"}</span><span>${g.text}</span></div>`).join("");
}
function syncGoalEvents() {
  const ev = st.goalEvents || [];
  for (let i = ui.goalShown; i < ev.length; i++) ui.bannerQueue.push(ev[i]);
  ui.goalShown = ev.length;
  pumpBanner();                                        // 达成横幅先出，等它放完再进结局（A9/A12）
}
function pumpBanner() {
  if (ui.bannerOn || ui.bannerQueue.length === 0) return;
  if (Object.keys(ui.floats).length) return;          // 等飘字结束再出（A12）
  const ev = ui.bannerQueue.shift();
  ui.bannerOn = true; sfx.goal();
  const b = $("banner"); b.textContent = ev.banner ?? ev.text; b.hidden = false;
  setTimeout(() => { b.hidden = true; ui.bannerOn = false; pumpBanner(); render(); }, 1800);
}
function renderSprout() { /* 开春展开：每代第一张卡显示三件事，随后收起 */ }

function renderTopbar() {
  $("gennum").textContent = st.generation ?? 1;
  $("bonesnum").textContent = st.bones;
  const card = (st.phase === "card" || st.phase === "engrave") ? curCard() : null;
  $("season-chip").textContent = card ? SEASON[card.season] : (st.phase === "pick" ? "春" : "—");
  $("bones-chip").hidden = false;
}
function renderCard() {
  const card = $("card");
  const canCard = st.phase === "card" || st.phase === "engrave";
  $("stage").hidden = false;
  if (!canCard) { return; }
  const c = curCard();
  $("card-art").innerHTML = artHTML(c);
  $("card-art").hidden = !artHTML(c);
  $("card-season").textContent = SEASON[c.season];
  $("card-speaker").textContent = c.speaker;
  $("card-title").textContent = c.title || "";
  $("card-text").textContent = c.text;
  card.classList.toggle("engrave", st.phase === "engrave");
  const bc = $("bonecorner");
  bc.classList.toggle("done", st.phase === "engrave" && ui.engraved);
  const drops = $("card-drops");
  if (st.phase === "engrave") {
    drops.hidden = false;
    drops.innerHTML = `卡上出现一道迹：${st.pendingTrace.tally_text} <button class="act" data-do="skip" style="margin-left:8px">先不刻</button>`;
  } else if (c.drops && c.drops.length) {
    const d = c.drops.filter((x) => st.wordBox.includes(x.char))[0];
    drops.hidden = !d;
    drops.innerHTML = d ? `可落字：<b>${d.char}</b> <span class="chiplink">点字匣里的它</span>` : "";
  } else { drops.hidden = true; }
  // 左右选项
  const ol = $("opt-left"), or = $("opt-right");
  const showOpts = document.body.dataset.view === "desktop" || document.body.dataset.view === "tablet-landscape";
  ol.hidden = !showOpts; or.hidden = !showOpts;
  if (showOpts) { ol.textContent = "← " + c.left.label; or.textContent = c.right.label + " →"; }
  const side = previewSide();
  ol.classList.toggle("on", side === "left"); or.classList.toggle("on", side === "right");
  // 手势/键位提示：接了键鼠（pointer:fine）才用键盘文案。
  $("gesture-hint").textContent = keyboardMode()
    ? "←/→ 预览 · 再按同向或 Enter 提交 · 1–3 落字 · 按住 Space 看分量 · K 刻字"
    : "左右拖卡做选择 · 长按看分量";
}
function hasFinePointer() { return matchMedia("(hover:hover) and (pointer:fine)").matches; }
// 键鼠文案与键位行：接了键鼠（pointer:fine）才用（BREAKPOINTS 平板竖/横「有键盘显键位」）；
// 手机档（<600）设计上一律「不显键位」，保持触控文案。
function keyboardMode() { return hasFinePointer() && document.body.dataset.view !== "mobile"; }

function renderCoach() {
  const el = $("coach");
  const card = (st.phase === "card" || st.phase === "engrave") ? curCard() : null;
  const step = card && isTutorialCard(card.id) ? tutorialStepOf(card.id) : null;
  if (!step) { el.hidden = true; return; }
  el.hidden = false;
  const desktop = document.body.dataset.view === "desktop";
  const text = desktop && step.coach_desktop ? step.coach_desktop : step.coach;
  el.innerHTML = `${text}${desktop ? "" : ""}`;
}
function renderWordbox() {
  $("wordbox").innerHTML = st.wordBox.map((ch, i) => {
    const used = st.dropped.includes(ch);
    const card = (st.phase === "card") ? curCard() : null;
    const ok = card && !used && usable(ch) && card.drops.some((d) => d.char === ch);
    return `<button class="slot ${ok ? "ok" : ""} ${used ? "used" : ""}" data-slot="${i}" ${st.phase !== "card" ? "disabled" : ""}>${gimg(ch)}<span>${i + 1}·${ch}${used ? " · 已落" : ""}</span></button>`;
  }).join("");
}
function sideHTML() {
  const zl = st.zilu.map((c) => `<span class="zl ${st.newThisGen.includes(c) ? "new" : ""}">${gimg(c)}${c}${(st.clues[c] || []).map((x) => `<small>${x}</small>`).join("")}</span>`).join("");
  const tallies = st.tallies.length ? st.tallies.map((t) => `<div class="tally">${t.id}：${t.text}</div>`).join("") : "<div>手里没有事签。</div>";
  const goals = document.body.dataset.view === "desktop"
    ? `<div class="side-sec"><h3>目标</h3>${goalsState().map((g) => `<div class="goal${g.achieved ? " on" : ""}">${g.achieved ? "◆" : "◇"} ${g.text}</div>`).join("")}</div>` : "";
  return `<div class="side-sec"><h3>字录</h3><div class="zilu">${zl}</div></div>
    <div class="side-sec"><h3>空骨片 ${st.bones}</h3>${tallies}</div>
    <div class="side-sec"><h3>日志</h3><ol id="log">${st.log.slice(-40).reverse().map((l) => `<li>${l}</li>`).join("")}</ol></div>${goals}`;
}
function renderSide() {
  const html = sideHTML();
  $("sidebar-body").innerHTML = html;
  $("drawer-body").innerHTML = `<h3 style="color:#8a6a2a">字录 / 骨片 / 日志</h3>` + html;
}

function renderWinter() {
  const el = $("winter");
  el.hidden = st.phase !== "winter";
  if (st.phase !== "winter") return;
  const w = ui.winter;
  if (w.tally && !st.tallies.some((t) => t.id === w.tally)) ui.winter = freshWinter();
  const t = st.tallies.find((x) => x.id === ui.winter.tally);
  let h = `<h2>冬夜</h2><p>点一张事签，按造法刻。</p>`;
  h += st.tallies.length ? st.tallies.map((x) => `<div class="tally ${x.id === ui.winter.tally ? "sel" : ""}" data-tally="${x.id}">${x.id}：${x.text}</div>`).join("") : "<p>手里没有事签了。</p>";
  if (t) {
    const def = CHARS[t.target], P = pool();
    h += `<h3>${METHOD[def.method]}</h3>`;
    if (def.method === "huiyi") {
      h += `<div>选两个部件（可重复）：已选 ${ui.winter.comps.join(" + ") || "—"}</div>` + P.map((c) => `<button class="comp" data-comp="${c}">${gimg(c)}${c}</button>`).join("") + `<button class="act" data-do="clear">清空</button>`;
    } else if (def.method === "zhishi") {
      h += `<div>底字：</div>` + P.map((c) => `<button class="comp ${ui.winter.base === c ? "sel" : ""}" data-base="${c}">${gimg(c)}${c}</button>`).join("") +
        `<div>位置：</div>` + RULES.winter_night.methods.zhishi.positions.map((p) => `<button class="comp ${ui.winter.pos === p ? "sel" : ""}" data-pos="${p}">${POSNAME[p]}</button>`).join("");
    } else {
      h += `<div>依次点三个亮点：${ui.winter.points.join(" → ") || "—"} <button class="act" data-do="clear">重描</button></div><canvas id="xcv" width="260" height="260"></canvas>`;
    }
    h += `<div><button class="act" data-do="carve">刻（Enter）</button><button class="act" data-do="defer">留到明年</button></div>`;
  }
  h += `<hr><button class="act" data-do="end" id="winter-end">天亮了</button>`;
  el.innerHTML = h;
  if (t && CHARS[t.target].method === "xiangxing") drawTrace(t.target);
}
function drawTrace(target) {
  const el = $("xcv"); if (!el) return;
  const def = CHARS[target], X = 260;
  const x = el.getContext("2d"); x.clearRect(0, 0, X, X);
  const im = IMG[target]; if (im?.complete) { x.globalAlpha = 0.18; x.drawImage(im, 20, 20, X - 40, X - 40); x.globalAlpha = 1; }
  for (const p of def.trace_points) {
    const i = ui.winter.points.indexOf(p.id);
    x.fillStyle = i >= 0 ? "#B5432E" : "#e0a020"; x.beginPath(); x.arc(p.x * X, p.y * X, 12, 0, Math.PI * 2); x.fill();
    if (i >= 0) { x.fillStyle = "#fff"; x.font = "bold 14px serif"; x.textAlign = "center"; x.fillText(String(i + 1), p.x * X, p.y * X + 5); }
  }
  el.onpointerdown = (e) => {
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) * X / r.width, py = (e.clientY - r.top) * X / r.height;
    const hit = def.trace_points.find((q) => Math.hypot(q.x * X - px, q.y * X - py) <= 20);
    if (hit && !ui.winter.points.includes(hit.id) && ui.winter.points.length < 3) { ui.winter.points.push(hit.id); render(); }
  };
}
function winterCarve() {
  const t = st.tallies.find((x) => x.id === ui.winter.tally); if (!t) return toast("先点一张事签");
  const m = CHARS[t.target].method; let answer;
  if (m === "huiyi") { if (ui.winter.comps.length !== 2) return toast("要两个部件"); answer = { method: m, components: ui.winter.comps.slice() }; }
  else if (m === "zhishi") { if (!ui.winter.base || !ui.winter.pos) return toast("要底字和位置"); answer = { method: m, base: ui.winter.base, position: ui.winter.pos }; }
  else { if (ui.winter.points.length !== 3) return toast("要依次点三个亮点"); answer = { method: m, points: ui.winter.points.slice() }; }
  const before = st.zilu.length;
  dispatch({ type: "winter_carve", tally: t.id, answer });
  if (before === st.zilu.length) { toast("刻错了，骨片裂"); sfx.down(); } else { toast(`刻成「${t.target}」`); sfx.evolve(); }
  ui.winter = freshWinter(); render();
}

// 挑字屏「就地补丁」：候选 / 格子 / 出发键的 DOM 节点只建一次，之后只改 class 与文本。
// 整块 innerHTML 重建会在按下与抬起之间换掉玩家正按着的节点，浏览器便不再合成 click（W8）；
// 触屏的合成 click 又按坐标命中「补进同一格的新字」，把放回做两次（P1-1）。两处都从根上避免。
function buildPickSkeleton(el) {
  el.innerHTML =
    `<h2></h2>` +
    `<p class="season-note"></p>` +
    `<div class="pickslots"></div>` +
    `<div class="pool"></div>` +
    `<div class="desc" id="pick-desc"></div>` +
    `<div class="pickfoot"><button class="go" data-do="go" type="button"></button></div>`;
}
// 按 key 复用 container 的子节点：已有的平移到位并更新内容，缺的补、多的删。节点本身不换。
function patchKeyed(container, items, keyOf, make, apply) {
  const old = new Map();
  for (const child of Array.from(container.children)) if (child.dataset.key != null) old.set(child.dataset.key, child);
  const keep = new Set();
  let prev = null;
  for (const item of items) {
    const k = String(keyOf(item));
    keep.add(k);
    let node = old.get(k);
    if (!node) { node = make(item); node.dataset.key = k; }
    apply(node, item);
    const ref = prev ? prev.nextSibling : container.firstChild;
    if (node !== ref) container.insertBefore(node, ref);
    prev = node;
  }
  for (const [k, node] of old) if (!keep.has(k)) node.remove();
}
function renderPick() {
  const el = $("pick");
  el.hidden = st.phase !== "pick";
  if (st.phase !== "pick") {
    ui.pickFocus = null; ui.pickTapped = null; ui.presses.clear(); ui.swallow = [];
    delete el.dataset.pickBuilt;
    return;
  }
  if (el.dataset.pickBuilt !== "1") { buildPickSkeleton(el); el.dataset.pickBuilt = "1"; }
  const picks = st.picks || [];
  const full = picks.length >= RULES.word_box.slots;
  el.querySelector("h2").textContent = `出发挑字 · 第 ${st.generation ?? 2} 代`;
  // gf5：手机用点选引导（点一下看说明、再点一次带上），电脑用键位提示。
  el.querySelector(".season-note").textContent = document.body.dataset.view === "desktop"
    ? "点字，或用 ← → 移动、Space 选 · Backspace 放回最后一个 · Enter 出发"
    : "点一个字看它能做什么；再点一次带上。";
  patchKeyed(el.querySelector(".pickslots"), [0, 1, 2], (i) => i,
    () => document.createElement("button"),
    (node, i) => {
      const ch = picks[i];
      node.className = "pickslot";
      node.dataset.slot = String(i);
      if (ch) { node.dataset.char = ch; node.title = "放回"; node.innerHTML = `${gimg(ch)}<span>${i + 1}·${ch}</span>`; }
      else { delete node.dataset.char; node.removeAttribute("title"); node.textContent = "空"; }
    });
  patchKeyed(el.querySelector(".pool"), PICK_CHARS, (p) => p.char,
    () => document.createElement("button"),
    (node, p) => {
      const sel = picks.indexOf(p.char), isSel = sel >= 0;
      node.className = "cand" + (isSel ? " sel" : "") + (full && !isSel ? " dim" : "") + (p.char === ui.pickFocus ? " focus" : "");
      node.dataset.char = p.char; node.dataset.i = String(PICK_CHARS.indexOf(p));
      node.innerHTML = `${gimg(p.char)}<span>${p.char}</span><span class="mng">${p.meaning}</span>${isSel ? `<span class="badge">${sel + 1}</span>` : ""}`;
    });
  const go = el.querySelector(".go");
  go.disabled = !full;
  go.textContent = full ? "带这三个字出发" : "还差字";
  go.classList.toggle("ready", full);
  updatePickInfo();
}
// gf5 ①：说明卡只画有数据的行——没数据的行整行不画，绝不写「？」占位。
// 目前数据里只有「部件」一条：部件 = 字池里用它当部件或底字的字（木 → 休、林、本）。
// 「落 / 解锁」的文案数据待补，先在数据到位前整行省略。
function charParts(ch) {
  return PICK_CHARS.filter((p) => {
    if (p.char === ch) return false;
    const d = CHARS[p.char] || {};
    return (Array.isArray(d.components) && d.components.includes(ch)) || d.base === ch;
  }).map((p) => p.char);
}
function pickInfoHTML(ch) {
  const p = PICK_CHARS.find((x) => x.char === ch) || {};
  const parts = charParts(ch);
  const rows = parts.length
    ? `<div class="pi-row"><b>部件</b><span>能拼出：${parts.join("、")}</span></div>`
    : "";
  return `<div class="pickinfo"><div class="pi-h">${ch}${p.meaning ? ` <span>${p.meaning}</span>` : ""}</div>${rows}</div>`;
}
function updatePickInfo() {
  const el = $("pick"); if (!el) return;
  const desc = el.querySelector("#pick-desc");
  if (desc) desc.innerHTML = ui.pickFocus ? pickInfoHTML(ui.pickFocus) : "";
  el.querySelectorAll(".cand").forEach((c) => c.classList.toggle("focus", c.dataset.char === ui.pickFocus));
}
// gf5 ①②③：第一次点只看说明；同一字再点一次选中；已选字（或格内字）点一下放回。
// 电脑悬停只更新说明，不算第一次点击——所以用 pickTapped 区分「悬停看」和「点过一下」。
function pickClick(ch) {
  const picks = st.picks || [];
  if (picks.includes(ch)) { ui.pickFocus = ch; ui.pickTapped = null; dispatch({ type: "pick_toggle", char: ch }); sfx.unpick(); }
  else if (ui.pickTapped === ch) { ui.pickTapped = null; pickToggle(ch); }
  else { ui.pickFocus = ch; ui.pickTapped = ch; render(); }
}
function pickToggle(ch) {
  const picks = (st.picks || []).slice();
  if (picks.includes(ch)) { dispatch({ type: "pick_toggle", char: ch }); sfx.unpick(); }
  else if (picks.length >= RULES.word_box.slots) { toast("先放回一个"); shakeSlots(); }
  else { dispatch({ type: "pick_toggle", char: ch }); sfx.pick(); }
}
function shakeSlots() { const s = $("pick")?.querySelector(".pickslots"); if (!s) return; s.animate?.([{ transform: "translateX(0)" }, { transform: "translateX(-4px)" }, { transform: "translateX(4px)" }, { transform: "translateX(0)" }], { duration: 240 }); }

function renderElder() {
  const el = $("elder");
  el.hidden = !(st.phase === "ended" && ui.elderShown);
  if (el.hidden) return;
  const n = st.generation ?? 1;
  el.innerHTML = `<div class="card-e"><h1>${TUTORIAL.elder.header.replace("{n}", String(n))}</h1>
    <p><b>${TUTORIAL.elder.title}</b></p><p>${TUTORIAL.elder.body}</p>
    <div class="btnrow"><button class="act primary" data-do="heir">${TUTORIAL.elder.button_next.replace("{n}", String(n + 1))}</button></div></div>`;
}
function renderEnded() {
  const el = $("endseq");
  const pending = ui.bannerQueue.length > 0 || ui.bannerOn;   // 达成横幅先出，不能与结局重叠（A9）
  const show = st.phase === "ended" && !ui.elderShown && !pending;
  el.hidden = !show;
  if (!show) return;
  const e = st.ending, L = st.legacy;
  el.innerHTML = `<div class="card-e"><h1>${e.name}</h1><p>${e.kind === "good" ? "这一代平安走完。" : "这一代没撑住。"}</p>
    <p>${DIMS.map((k) => `${DIMNAME[k]} ${st.dims[k]}`).join(" · ")} · 骨片 ${st.bones}</p>
    <p>传下字录：${L ? L.zilu.join(" ") : "—"} · 传下事签：${L?.carriedTally ? L.carriedTally.id : "无"}</p>
    <div class="btnrow"><button class="act primary" data-do="elder">先人</button></div></div>`;
  if (pending) deferInteract(el, 400);
}

function renderKeys() {
  $("keys").textContent = keyboardMode()
    ? "← → 预览，再按同向或 Enter 提交 · 1–3 落字 · 按住 Space 看分量 · K 刻字 · Esc 关浮层"
    : "";
}

function render() {
  syncGoalEvents();
  renderTopbar();
  const d = dimsHTML();
  $("dims").innerHTML = d; $("dims-desktop").innerHTML = d;
  renderCard();
  renderWordbox();
  renderCoach();
  renderSide();
  renderGoalSlip(); renderGoalPanel();
  renderWinter(); renderPick(); renderElder(); renderEnded();
  renderKeys();
  if (st.phase !== "ended" && st.phase !== "pick" && st.phase !== "winter") $("endseq").hidden = true;
}

// ---------- 拖卡 / 键盘 ----------
const cardEl = () => $("card");
function inCard(x, y) { const r = cardEl().getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; }
function threshold() { return DRAG_RATIO * cardEl().getBoundingClientRect().width; }

function onDown(e) {
  if (st.phase === "engrave") { toast(tutorialStepOf(st.current)?.lock_hint || "先点卡角骨片刻下这件事"); return; }  // B11
  if (st.phase !== "card" || ui.animating) return;
  ui.dragging = true; ui.dragged = false; ui.startX = e.clientX;
  cardEl().classList.add("dragging");
  cardEl().setPointerCapture?.(e.pointerId);
  ui.holdT = setTimeout(() => { if (ui.dragging && Math.abs(ui.dx) < 8) { ui.hold = true; render(); } }, 300);
}
function onMove(e) {
  if (!ui.dragging) return;
  ui.dx = e.clientX - ui.startX;
  if (Math.abs(ui.dx) > 8) { ui.dragged = true; clearTimeout(ui.holdT); ui.hold = false; }
  if (Math.abs(ui.dx) >= threshold() && !ui._thr) { ui._thr = true; sfx.threshold(); }
  if (Math.abs(ui.dx) < threshold()) ui._thr = false;
  applyTilt();
  renderDimsOnly();
}
function applyTilt() {
  const r = cardEl().getBoundingClientRect();
  const deg = Math.max(-15, Math.min(15, (ui.dx / r.width) * 15));
  cardEl().style.transform = `translateX(${ui.dx}px) rotate(${deg}deg)`;
}
function renderDimsOnly() { const d = dimsHTML(); $("dims").innerHTML = d; $("dims-desktop").innerHTML = d; const s = previewSide(); $("opt-left").classList.toggle("on", s === "left"); $("opt-right").classList.toggle("on", s === "right"); }
function onUp() {
  if (!ui.dragging) return;
  clearTimeout(ui.holdT);
  ui.dragging = false; cardEl().classList.remove("dragging");
  const thr = threshold(), dx = ui.dx;
  const wasHold = ui.hold; ui.hold = false;
  if (Math.abs(dx) >= thr) {
    sfx.commit();
    flyOut(Math.sign(dx) * 620, () => dispatch(dx < 0 ? INPUT.card.drag.left_action : INPUT.card.drag.right_action));
  } else {
    if (wasHold) sfx.rebound();
    else if (ui.dragged) sfx.rebound();
    rebound();
  }
}
function rebound() {
  const from = ui.dx;
  if (reducedPref()) { ui.dx = 0; cardEl().style.transform = ""; render(); return; }
  ui.animating = true; const t0 = performance.now(), dur = 320;
  const tick = (t) => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    ui.dx = from * (1 - e); cardEl().style.transform = `translateX(${ui.dx}px)`; renderDimsOnly();
    if (k < 1) requestAnimationFrame(tick); else { ui.animating = false; ui.dx = 0; cardEl().style.transform = ""; render(); }
  };
  requestAnimationFrame(tick);
}
function flyOut(targetX, done) {
  if (reducedPref()) { cardEl().style.opacity = "0"; setTimeout(() => { cardEl().style.opacity = ""; done(); }, 120); return; }
  ui.animating = true; const from = ui.dx, t0 = performance.now(), dur = 240, deg = Math.sign(targetX) * 18;
  const tick = (t) => {
    const k = Math.min(1, (t - t0) / dur), e = k * k;
    ui.dx = from + (targetX - from) * e;
    cardEl().style.transform = `translateX(${ui.dx}px) rotate(${deg * e}deg)`; cardEl().style.opacity = String(1 - e);
    if (k < 1) requestAnimationFrame(tick); else { ui.animating = false; cardEl().style.transform = ""; cardEl().style.opacity = ""; done(); }
  };
  requestAnimationFrame(tick);
}
addEventListener("pointerdown", (e) => { if (inCard(e.clientX, e.clientY) && !e.target.closest("button")) onDown(e); });
addEventListener("pointermove", onMove);
addEventListener("pointerup", onUp);
addEventListener("pointercancel", onUp);

addEventListener("keydown", (e) => {
  if (!$("savedlg").hidden && e.key === "Escape") { closeDlg(); return; }
  if (e.key === "Escape") { ui.panelOpen = false; ui.menuOpen = false; render(); return; }
  if (st.phase === "pick") {
    // 键盘光标、金色焦点框和鼠标悬停是同一个状态 ui.pickFocus（P1-2）：
    // 移动光标时同步重绘焦点框和说明卡；Space 选中的就是框里的字。
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const cur = PICK_CHARS.findIndex((p) => p.char === ui.pickFocus);
      const i = cur < 0 ? (dir > 0 ? 0 : PICK_CHARS.length - 1) : (cur + dir + PICK_CHARS.length) % PICK_CHARS.length;
      ui.pickFocus = PICK_CHARS[i].char; ui.pickTapped = null;
      updatePickInfo();
    }
    else if (e.code === "Space") {
      e.preventDefault();
      const ch = ui.pickFocus || PICK_CHARS[0].char;
      ui.pickFocus = ch; ui.pickTapped = null;
      pickToggle(ch);
    }
    else if (e.key === "Backspace") { const last = (st.picks || []).slice(-1)[0]; if (last) dispatch({ type: "pick_toggle", char: last }); }
    else if (e.key === "Enter") { const p = st.picks || []; if (p.length === RULES.word_box.slots) { sfx.ready(); dispatch({ type: "begin_generation", picks: p }); } }
    return;
  }
  if (st.phase === "card") {
    if (e.code === "Space") { e.preventDefault(); ui.hold = true; render(); return; }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const dir = e.key === "ArrowLeft" ? "left" : "right";
      if (ui.kbDir === dir) commitSide(dir);
      else { ui.kbDir = dir; sfx.threshold(); render(); }
      return;
    }
    if (e.key === "Enter" && ui.kbDir) { e.preventDefault(); commitSide(ui.kbDir); return; }
    const a = INPUT.card.keys[e.code]; if (a && !e.repeat) { e.preventDefault(); dispatch(a); }
  } else if (st.phase === "engrave") {
    if (e.code === INPUT.engrave.key) { ui.engraved = true; dispatch({ type: "engrave", trace: st.pendingTrace.target }); }
    else if (e.code === "KeyS") dispatch(INPUT.engrave.skip);
  } else if (st.phase === "winter" && e.key === "Enter") { e.preventDefault(); winterCarve(); }
});
addEventListener("keyup", (e) => { if (e.code === "Space" && ui.hold && !ui.dragging) { ui.hold = false; render(); } });
function commitSide(dir) {
  const thr = threshold();
  flyOut((dir === "left" ? -1 : 1) * 620, () => dispatch(dir === "left" ? INPUT.card.drag.left_action : INPUT.card.drag.right_action));
}

// ---------- 事件绑定 ----------
on($("menubtn"), () => { ui.menuOpen = !ui.menuOpen; renderMenu(); });
function renderMenu() {
  const m = $("menu-pop"); m.hidden = !ui.menuOpen; $("menubtn").setAttribute("aria-expanded", String(ui.menuOpen));
  if (!ui.menuOpen) return;
  m.innerHTML =
    `<div class="grp">存档</div>` +
    `<button data-menu="export">导出存档码</button>` +
    `<button data-menu="import">导入存档码</button>` +
    `<div class="grp">设置</div>` +
    `<button data-menu="mute">${muted() ? "打开音效" : "静音"}</button>` +
    `<div class="grp">别的</div>` +
    `<a href="credits.html">字源与版权</a>` +
    `<button data-menu="new">重新开局</button>` +
    `<div class="seed">种子 ${seed}</div>`;
}
on($("menu-pop"), (e) => {
  const b = e.target.closest("[data-menu]"); if (!b) return;
  const k = b.dataset.menu;
  if (k === "export") exportCode();
  else if (k === "import") openDlg("导入存档码", "把存档码粘贴在下面，点导入。", true);
  else if (k === "mute") { localStorage.setItem(MUTE_KEY, muted() ? "0" : "1"); renderMenu(); }
  else if (k === "new") newGame(seed);
  ui.menuOpen = false; renderMenu();
});
on($("goals-slip"), () => {
  ui.panelOpen = true; renderGoalPanel();
  setTimeout(() => {                                   // 打开的那一下不能立刻被关掉（B8）
    const closer = (e) => {
      if (!e.target.closest("#goals-panel") && !e.target.closest("#goals-slip")) {
        ui.panelOpen = false; renderGoalPanel();
        document.removeEventListener("pointerdown", closer);
        document.removeEventListener("click", closer);
      }
    };
    // WebKit 触控点空白处不一定合成 click，pointerdown 才是可靠通道（D2）
    document.addEventListener("pointerdown", closer);
    document.addEventListener("click", closer);
  }, 0);
});
on($("sidebar-tab"), () => {
  const collapsed = $("sidebar").classList.toggle("collapsed");
  localStorage.setItem(SIDEBAR_KEY, collapsed ? "0" : "1");
});
on($("wb-handle"), () => { $("drawer").hidden = false; renderSide(); });
on($("drawer-mask"), () => { $("drawer").hidden = true; });
on($("wordbox"), (e) => { const b = e.target.closest("[data-slot]"); if (b && !b.disabled) dispatch({ type: "choose", side: "drop", slot: Number(b.dataset.slot) }); });
on($("card"), (e) => { const b = e.target.closest("[data-do]"); if (!b) return; if (b.dataset.do === "skip") dispatch({ type: "skip_engrave" }); });
on($("bonecorner"), () => { if (st.phase === "engrave") { ui.engraved = true; dispatch({ type: "engrave", trace: st.pendingTrace.target }); } });
on($("opt-left"), () => commitSide("left"));
on($("opt-right"), () => commitSide("right"));
on($("winter"), (e) => {
  const d = e.target.closest("[data-tally],[data-comp],[data-base],[data-pos],[data-do]"); if (!d) return;
  const w = ui.winter;
  if (d.dataset.tally) ui.winter = { ...freshWinter(), tally: d.dataset.tally };
  else if (d.dataset.comp) { if (w.comps.length < 2) w.comps.push(d.dataset.comp); }
  else if (d.dataset.base) w.base = d.dataset.base;
  else if (d.dataset.pos) w.pos = d.dataset.pos;
  else if (d.dataset.do === "clear") { w.comps = []; w.points = []; }
  else if (d.dataset.do === "carve") return winterCarve();
  else if (d.dataset.do === "defer") { dispatch({ type: "winter_defer", tally: w.tally }); ui.winter = freshWinter(); }
  else if (d.dataset.do === "end") { const el = $("winter"); sfx.flip(); dispatch({ type: "winter_end" }); deferInteract($("endseq"), 400); deferInteract($("elder"), 400); return; }
  render();
});
// 挑字：指针（含触控）与合成 click 的交互。
// 每次按下按 pointerId 记一条 press（token + 命中的节点）；抬起时只处理「自己这次按下」，
// 命中的节点与按下时同一节点（或在原位补丁下仍连着）才动作。多指互不干扰。
// 动作后把该 press 的 token 入队，随后的合成 click 按 token 吞掉——不比较字，故
// 「放回一个字后格子补进另一个字、合成 click 命中新字」不会再被当成第二次放回（P1-1）。
const PICK_HIT = "[data-char],[data-do]";
let pickPressSeq = 0;
const pickKey = (node) => node.dataset.do || node.dataset.char || null;
function pickAction(node) {
  if (node.dataset.do === "go") {
    const p = st.picks || [];
    if (p.length === RULES.word_box.slots) { sfx.ready(); dispatch({ type: "begin_generation", picks: p }); }
    return;
  }
  if (node.dataset.char) pickClick(node.dataset.char);
}
function consumePickSwallow() {
  const now = performance.now();
  ui.swallow = ui.swallow.filter((s) => now - s.at < 700);   // 只吞紧随其后的那一次 click
  if (!ui.swallow.length) return false;
  ui.swallow.shift();
  return true;
}
$("pick").addEventListener("pointerdown", (e) => {
  const node = e.target.closest?.(PICK_HIT) || null;
  ui.presses.set(e.pointerId, { token: ++pickPressSeq, node, key: node ? pickKey(node) : null });
});
addEventListener("pointerup", (e) => {
  const press = ui.presses.get(e.pointerId);
  if (!press) return;
  ui.presses.delete(e.pointerId);                          // 只清自己这一指
  if (!press.node) return;
  const node = e.target.closest?.(PICK_HIT) || null;
  if (!node) return;
  const same = node === press.node || (press.node.isConnected === false && press.key != null && pickKey(node) === press.key);
  if (!same) return;                                       // 拖到别的控件再松手：不动作
  ui.swallow.push({ token: press.token, at: performance.now() });
  pickAction(node);
});
addEventListener("pointercancel", (e) => { ui.presses.delete(e.pointerId); });
on($("pick"), (e) => {
  const c = e.target.closest(PICK_HIT); if (!c) return;
  if (consumePickSwallow()) return;                        // 这次 click 由 pointerup 已处理的同一次按下合成
  pickAction(c);
});
// gf5 电脑：悬停即显示右侧说明（不选中）。触控设备无 fine pointer，不走这里。
$("pick").addEventListener("pointerover", (e) => {
  if (!hasFinePointer()) return;
  // 重绘（innerHTML 重建候选）后浏览器会对静止的指针重发 pointerover，
  // 若照单全收，键盘刚移动的光标会被鼠标位置抢回（P1-2）。只在指针真的动了时才更新。
  if (e.clientX === lastHover.x && e.clientY === lastHover.y) return;
  lastHover = { x: e.clientX, y: e.clientY };
  const b = e.target.closest?.(".cand[data-char]"); if (!b) return;
  if (ui.pickFocus === b.dataset.char) return;
  ui.pickFocus = b.dataset.char; updatePickInfo();
});
on($("endseq"), (e) => { const b = e.target.closest("[data-do]"); if (b?.dataset.do === "elder") { ui.elderShown = true; sfx.genEnd(); render(); } });
on($("elder"), (e) => { const b = e.target.closest("[data-do]"); if (b?.dataset.do === "heir") { dispatch({ type: "heir" }); } });
on($("dlgcopy"), async () => { const t = $("dlgtext"); try { await navigator.clipboard.writeText(t.value); toast("已复制"); } catch { t.focus(); t.select(); toast("复制不了，请手动选中复制"); } });
on($("dlgapply"), importCode);
on($("dlgclose"), closeDlg);
$("savedlg").addEventListener("click", (e) => { if (e.target === $("savedlg")) closeDlg(); });
const closeMenuOutside = (e) => {                 // 点外面关菜单
  if (ui.menuOpen && !e.target.closest("#menu-pop") && !e.target.closest("#menubtn")) { ui.menuOpen = false; renderMenu(); }
};
document.addEventListener("pointerdown", closeMenuOutside);  // WebKit 触控点空白处不合成 click
document.addEventListener("click", closeMenuOutside);

// ---------- 调试钩子 ----------
window.__zz = {
  get st() { return st; }, get seed() { return seed; }, get actions() { return actions; },
  get view() { return document.body.dataset.view; },
  get animating() { return ui.animating; },
  get debugGoal() { return DEBUG_GOAL; },
  dispatch, newGame, restore, render, code: () => encodeSaveCode(seed, actions),
  importCode(c) { $("dlgtext").value = c; return importCode(); },
  setMuted(v) { localStorage.setItem(MUTE_KEY, v ? "1" : "0"); renderMenu(); },
  isMuted: () => muted(),
  openMenu: () => { ui.menuOpen = true; renderMenu(); },
};

// ---------- 启动 ----------
if (!DEBUG_GOAL) restore();          // 调试图标（debug_goal）时不读旧存档，保证这一局就是目标被塞进去的局
computeLayout();
render();
loadGlyphs();
if (BUILD_DIST && "serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
