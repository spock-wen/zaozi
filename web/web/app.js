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
const DWELL_MS = 250;   // 排队输入生效前，目标卡「落定并绘制」后还要多留的最短停留（round 5 A）
const SIDEBAR_KEY = "zaozi.sidebar.open";
const MUTE_KEY = "zaozi.mute";
const MOTION_KEY = "zaozi.motion";
const BACKUP_KEY = SAVE_KEY + ".bak";
const KEYHELP_PREFIX = "zaozi.keyhelp.";   // 矮屏 B：每个存档首次进入自动弹一次键位「?」

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
  preview: false, kbDir: null, animating: false, floats: {}, keyQueue: [], drainArmed: false,
  settleKey: null, settledAt: 0, dwellT: 0, commitNotBefore: 0, heldCommitT: 0,   // round 5：最短停留 / 提交不早于
  resumeHeldCommit: null, epoch: 0,
  winter: freshWinter(),
  goalShown: 0, bannerQueue: [], bannerOn: false,
  panelOpen: false, menuOpen: false, elderShown: false,
  engraved: false,                    // 本张卡卡角是否已刻：布尔量。undefined 会被
                                      // classList.toggle(name, undefined) 当成「无 force」→ 误翻转
  pickFocus: null, pickTapped: null,
  presses: new Map(),                 // 挑字：每次按下（按 pointerId 分），值是 { token, node, key }
  swallow: [],                        // 已被 pointerup 处理、等待吞掉其合成 click 的 press token 队列
  lastDims: null,
  keyhelpOpen: false,                 // 矮屏 B：顶栏「?」键位浮层
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
// 矮屏分档（design/v3_mobile/BREAKPOINTS.md §矮屏）：只用于桌面档（宽 ≥1024），
// 手机与平板不变。按视口高 innerHeight 分：A 601–760、B ≤600（>760 即常规 N）。
function shortTier(view) {
  if (view !== "desktop") return "";
  const h = innerHeight;
  if (h <= 600) return "B";
  if (h <= 760) return "A";
  return "";
}
// 矮屏把四维资源条并入 48 顶栏；常规档放回卡上方（#cardcol 里 #cardwrap 之前）。
function setShortTier(tier) {
  if (tier) document.body.dataset.short = tier; else delete document.body.dataset.short;
  const bar = $("topbar"), cardcol = $("cardcol"), dimsD = $("dims-desktop");
  if (tier) { if (dimsD.parentElement !== bar) bar.insertBefore(dimsD, $("topright")); }
  else if (dimsD.parentElement !== cardcol) cardcol.insertBefore(dimsD, $("cardwrap"));
}
// 跳档（视口高变化导致 N/A/B 切换）时给 body 挂 no-anim 两帧：这期间所有过渡被禁用，
// 卡/字匣/键位行等直接换尺寸，不逐帧补间（BREAKPOINTS §矮屏「跳档不加过渡」）。
function suppressTierTransition() {
  document.body.classList.add("no-anim");
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove("no-anim")));
}
function computeLayout() {
  const w = innerWidth, h = innerHeight;
  let view;
  if (w >= 1024) view = "desktop";
  else if (w >= 600) view = h >= w ? "tablet-portrait" : "tablet-landscape";
  else view = "mobile";
  const orient = h >= w ? "portrait" : "landscape";
  const tier = shortTier(view);
  const key = view + ":" + orient + ":" + tier + ":" + (h < 600 || w < 360 ? "s" : "");
  if (key === lastLayout) return;
  const prevTier = document.body.dataset.short || "";
  lastLayout = key;
  if (tier !== prevTier) suppressTierTransition();   // 跳档直接换尺寸，不加过渡（避免拖动中抖）
  document.body.dataset.view = view;
  document.body.dataset.orient = orient;
  setShortTier(tier);
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
  if (innerHeight < 492) open = false;        // 太矮：侧栏强制收起（BREAKPOINTS 矮屏）
  bar.classList.toggle("collapsed", !open);
  document.body.classList.toggle("side-collapsed", view === "desktop" && !open);
}
let resizeT;
addEventListener("resize", () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    computeLayout();                          // 档位变化时内部已 render()
    renderShort(); applySidebar(); renderCoach();   // 只变高不变档：同步顶栏/气泡/侧栏
    maybeAutoKeyhelp();
  }, 120);
});
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
const gimg = (ch) => (glyphURL(ch) ? `<img src="${glyphURL(ch)}" alt="${ch}" loading="lazy" draggable="false">` : `<span>${ch}</span>`);
function artHTML(card) {
  const art = CARD_ART.cards[card.id]; if (!art) return "";
  const b = CARD_ART.base;
  return `<picture>` +
    `<source media="(min-width:1024px)" type="image/webp" srcset="${b}${art}_d@1x.webp 1x, ${b}${art}_d@2x.webp 2x">` +
    `<source media="(min-width:1024px)" type="image/png" srcset="${b}${art}_d@1x.png 1x, ${b}${art}_d@2x.png 2x">` +
    `<source type="image/webp" srcset="${b}${art}_m@1x.webp 1x, ${b}${art}_m@2x.webp 2x">` +
    `<img src="${b}${art}_m@1x.png" alt="" width="296" height="216" decoding="async" draggable="false"></picture>`;
}

// ---------- 交互助手 ----------
// toast 位置为工程兜底，待设计师确认（R1 已撤回）
function toast(m) {
  const t = $("toast");
  const view = document.body.dataset.view;
  const dims = (view === "desktop" ? $("dims-desktop") : null) || $("dims");
  const bc = $("bonecorner");
  const bcShown = bc && !bc.hidden && getComputedStyle(bc).display !== "none";

  let top = 60;
  if (dims && dims.getBoundingClientRect().height > 0) {
    top = dims.getBoundingClientRect().bottom + 8;
  } else {
    const tb = $("topbar");
    if (tb) top = tb.getBoundingClientRect().bottom + 8;
  }
  if (bcShown) {
    const bcr = bc.getBoundingClientRect();
    if (top < bcr.bottom + 8 && top + 42 > bcr.top) {
      top = bcr.bottom + 8;
    }
  }

  t.style.top = top + "px";
  t.style.bottom = "auto";
  t.textContent = m;
  t.classList.add("on");
  const tl = $("toast-live"); if (tl) tl.textContent = m;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    t.classList.remove("on");
    t.style.top = "";
    t.style.bottom = "";
    if (tl) tl.textContent = "";
  }, 1800);
}
function hideToast() {                          // D1：切卡/换阶段时立刻收起，别让 toast 盖住下一张卡的 #coach
  const t = $("toast"); clearTimeout(toast._t);
  if (t) {
    t.classList.remove("on");
    t.style.transition = "none"; void t.offsetWidth; t.style.transition = "";  // 跳过 .3s 淡出，立即变透明
    t.style.top = "";
    t.style.bottom = "";
  }
  const tl = $("toast-live"); if (tl) tl.textContent = "";
}
function clearToast() {
  hideToast();
}
// N1（R05，PM U1 裁定 + P1）的状态（判定函数 n1RepeatTap 在 bindOpt 上方）。
// n1Ref 只记「用户直接点选项按钮、当下启动的那次飞卡」的那一下落点；它挂着（这次飞卡还没结束）
// 时，同一选项上落点 ≤10px 的点按整次吞掉——不提交、不入队。**没有时间窗**（70ms 已删）。
// 键盘（←/→/Enter/1–3）、拖拽松手、点字格、队列项启动的飞卡都不设参照点（P1、P1 补），
// 途中点选项一律按 R06 走。
let n1Ref = null;                // { side, x, y } | null：当前这次飞卡的 N1 参照点
let n1Swallowed = 0;             // 被 N1 吞掉的点按数（调试计数，window.__zz.n1Swallowed）
let n1Reason = null;             // 最后一次吞掉的原因（window.__zz.n1Reason），供用例区分「N1 吞的」与「inputBusy 挡的」
function resetInputState() {
  hideToast();
  clearTimeout(ui.holdT);
  n1Swallowed = 0; n1Reason = null;
  n1Ref = null;
  ui.dragging = false; ui.dragged = false; ui.hold = false; ui.kbDir = null; ui.animating = false; ui.dx = 0;
  const c = cardEl();
  if (c) {
    c.classList.remove("dragging");
    c.style.transform = "";
    c.style.opacity = "";
  }
  const dh = $("card-drag-hint");
  if (dh) dh.hidden = true;
  paintOpts();
}
function deferInteract(el, ms = 350) {         // 防「天亮了」穿透到下一屏的按钮
  el.style.pointerEvents = "none";
  setTimeout(() => { el.style.pointerEvents = ""; }, ms);
}
function on(el, fn) { el.addEventListener("click", (e) => { if (!e.target.closest?.("a[href]")) e.preventDefault?.(); fn(e); }); }

// ---------- 派发 / 存档 ----------
function dispatch(a) {
  try {
    const prevCurrent = st.current, prevPhase = st.phase;   // D1
    st = step(st, a);
    actions.push(a);
    afterAction(a);
    saveNow();
    if (st.current !== prevCurrent || st.phase !== prevPhase) hideToast();  // D1：换卡/换阶段即收起 toast
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
const capturedPointers = new Set();
// 重置卡片运动与拖拽残留态（仅用于 newGame / importCode / restore 三个重置入口）：
// 换局/导入时若正逢飞出或拖拽，epoch++ 会使动画/提交中止，此处将位移归零、动画态与实拖标志清空、
// 取消长按定时器、释放卡片捕获的指针，并重置卡片 DOM 的 transform/opacity 与 .dragging 类。
function resetCardMotion() {
  ui.dx = 0;
  ui.animating = false;
  ui.dragging = false; ui.dragged = false; ui.hold = false;
  ui.kbDir = null; ui.preview = false;
  clearTimeout(ui.holdT); ui.holdT = 0;
  const c = $("card");
  if (c) {
    for (const id of capturedPointers) { try { c.releasePointerCapture?.(id); } catch {} }
    c.classList.remove("dragging");
    c.style.transform = "";
    c.style.opacity = "";
  }
  const ol = $("opt-left"), or = $("opt-right");
  if (ol) ol.classList.remove("on");
  if (or) or.classList.remove("on");
  capturedPointers.clear();
}
function restore() {
  clearQueue(); ui.epoch++; ui.settleKey = null; ui.settledAt = 0; resetCardMotion();
  resetInputState();
  let d = null;
  try { d = loadFromStorage(localStorage); } catch { d = null; }
  if (!d) return false;
  try {
    st = run({ seed: d.seed }, d.actions);
    seed = d.seed; actions = d.actions.slice();
  } catch (e) {
    try {                                  // 先备份再删（B5）
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) localStorage.setItem(BACKUP_KEY, raw);
      localStorage.removeItem(SAVE_KEY);
    } catch { /* 隐私模式 */ }
    toast("存档读不出来，已备份后重开");
    return false;
  }
  try {
    hideToast();
    toast(`读回上次的进度：${st.log[st.log.length - 1] || "开局"}`);
    render();
  } catch (e) {
    console.error("render failed on restore", e);
    try {
      toast("渲染出错：" + e.message);
    } catch {
      const t = $("toast");
      if (t) { t.textContent = "渲染出错：" + e.message; t.classList.add("on"); }
    }
  }
  return true;
}
function newGame(s) {
  clearQueue(); ui.epoch++; ui.settleKey = null; ui.settledAt = 0; resetCardMotion();
  resetInputState();
  hideToast();   // 先清队列（含挂起的重放/提交、epoch++），再收 toast：之后不会再有排队项把提示弹回来
  seed = s >>> 0; actions = []; st = createGame({ seed, debugGoal: DEBUG_GOAL }); ui.winter = freshWinter();
  ui.goalShown = 0; ui.bannerQueue = []; ui.elderShown = false;
  ui.pickFocus = null; ui.pickTapped = null; ui.presses.clear(); ui.swallow = [];
  ui.lastDims = null; saveNow(); render();
  whenCardEntryDone().then(() => setCardSettled(true));
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
  resetInputState();
  const code = $("dlgtext").value;
  let d;
  try { d = decodeSaveCode(code); } catch (e) { return openDlg("导入存档码", "导不进来：" + e.message, false); }
  try {
    st = run({ seed: d.seed }, d.actions); seed = d.seed; actions = d.actions.slice();
    clearQueue(); ui.epoch++; ui.settleKey = null; ui.settledAt = 0; resetCardMotion();
    hideToast();   // 顺序同 newGame/restore：先清队列，再收 toast
    toast(`导入成功：种子 ${seed}，${actions.length} 步`);
    ui.winter = freshWinter(); ui.goalShown = 0; ui.bannerQueue = []; ui.elderShown = false;
    ui.lastDims = null; saveNow(); render();
    whenCardEntryDone().then(() => setCardSettled(true));
    closeDlg();
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
  if (!show) { dropHTML(slip); return; }
  patchHTML(slip, `目标 ${gs.map((g) => `<i class="gdot${g.achieved ? " on" : ""}"></i>`).join("")}`);
}
function renderGoalPanel() {
  const p = $("goals-panel");
  p.hidden = !ui.panelOpen;
  if (!ui.panelOpen) { dropHTML(p); return; }
  patchHTML(p, goalsState().map((g) => `<div class="goal${g.achieved ? " on" : ""}"><span class="mk">${g.achieved ? "◆" : "◇"}</span><span>${g.text}</span></div>`).join(""));
}
function syncGoalEvents() {
  const ev = st.goalEvents || [];
  for (let i = ui.goalShown; i < ev.length; i++) ui.bannerQueue.push(ev[i]);
  ui.goalShown = ev.length;
  pumpBanner();                                        // 达成横幅先出，等它放完再进结局（A9/A12）
}
function placeBanner() {
  const b = $("banner");
  if (!b || b.hidden) return;
  const view = document.body.dataset.view;
  const dims = (view === "desktop" ? $("dims-desktop") : null) || $("dims");
  const tb = $("topbar");
  let baseBottom = tb ? tb.getBoundingClientRect().bottom : 0;
  if (dims && dims.getBoundingClientRect().height > 0) {
    baseBottom = Math.max(baseBottom, dims.getBoundingClientRect().bottom);
  }
  b.style.top = (baseBottom + 8) + "px";
}
function pumpBanner() {
  if (ui.bannerOn || ui.bannerQueue.length === 0) return;
  if (Object.keys(ui.floats).length) return;          // 等飘字结束再出（A12）
  const ev = ui.bannerQueue.shift();
  ui.bannerOn = true; sfx.goal();
  const b = $("banner"); b.textContent = ev.banner ?? ev.text; b.hidden = false;
  placeBanner();
  setTimeout(() => { b.hidden = true; b.style.top = ""; ui.bannerOn = false; pumpBanner(); render(); }, 1800);
}
function renderSprout() { /* 开春展开：每代第一张卡显示三件事，随后收起 */ }

function renderTopbar() {
  setText($("gennum"), st.generation ?? 1);
  setText($("bonesnum"), st.bones);
  const card = (st.phase === "card" || st.phase === "engrave") ? curCard() : null;
  setText($("season-chip"), card ? SEASON[card.season] : (st.phase === "pick" ? "春" : "—"));
  $("bones-chip").hidden = false;
}
function renderCard() {
  const card = $("card");
  const canCard = st.phase === "card" || st.phase === "engrave";
  $("stage").hidden = false;
  if (!canCard) { return; }
  const c = curCard();
  const art = artHTML(c);
  patchHTML($("card-art"), art);
  $("card-art").hidden = !art;
  setText($("card-season"), SEASON[c.season]);
  setText($("card-speaker"), c.speaker);
  setText($("card-title"), c.title || "");
  setText($("card-text"), c.text);
  const engrave = st.phase === "engrave";
  card.classList.toggle("engrave", engrave);
  if (!engrave) ui.engraved = false;    // 离开「刻」就复位本张卡的已刻标记，别把 done 带到下一张「刻」卡
  const bc = $("bonecorner");
  bc.classList.toggle("done", engrave && ui.engraved);
  const drops = $("card-drops");
  if (st.phase === "engrave") {
    drops.hidden = false;
    patchHTML(drops, `卡上出现一道迹：${st.pendingTrace.tally_text} <button class="act" data-do="skip" style="margin-left:8px">先不刻</button>`);
  } else if (c.drops && c.drops.length) {
    const d = c.drops.filter((x) => st.wordBox.includes(x.char))[0];
    drops.hidden = !d;
    if (d) patchHTML(drops, `可落字：<b>${d.char}</b> <span class="chiplink">点字匣里的它</span>`);
    else dropHTML(drops);
  } else { drops.hidden = true; dropHTML(drops); }
  const dh = $("card-drag-hint"); if (dh) dh.hidden = true;
  // 左右选项：各视口在卡/刻阶段均显示（手机与平板竖屏经 CSS 排到卡下方并排）
  const ol = $("opt-left"), or = $("opt-right");
  const showOpts = true;
  ol.hidden = !showOpts; or.hidden = !showOpts;
  if (showOpts) {
    setText(ol, "← " + c.left.label);
    setText(or, c.right.label + " →");
    ol.setAttribute("aria-label", "选左：" + c.left.label);
    or.setAttribute("aria-label", "选右：" + c.right.label);
  }
  ol.disabled = or.disabled = st.phase !== "card";
  paintOpts();
  // 手势/键位提示：接了键鼠（pointer:fine）才用键盘文案。
  // R18 (L15)：电脑端按键提示只出现一处，由底部 #keys 承载，卡下 #gesture-hint 置空隐藏。
  const deskKeys = document.body.dataset.view === "desktop" && keyboardMode();
  setText($("gesture-hint"), deskKeys ? "" : (keyboardMode()
    ? (st.phase === "engrave"
        ? "←/→ 预览 · 再按同向或 Enter 提交 · 1–3 落字 · 按住 Space 看分量 · K 刻字"
        : "←/→ 预览 · 再按同向或 Enter 提交 · 1–3 落字 · 按住 Space 看分量")
    : "左右拖卡做选择 · 长按看分量"));
}
function boneAvailable() { return st.phase === "engrave"; }
function hasFinePointer() { return matchMedia("(hover:hover) and (pointer:fine)").matches; }
// 键鼠文案与键位行：接了键鼠（pointer:fine）才用（BREAKPOINTS 平板竖/横「有键盘显键位」）；
// 手机档（<600）设计上一律「不显键位」，保持触控文案。
function keyboardMode() { return hasFinePointer() && document.body.dataset.view !== "mobile"; }

function renderCoach() {
  const el = $("coach"), col = $("coachcol");
  col.style.cssText = "";               // 先清掉上次的定位，交回 placeCoach 重算
  const card = (st.phase === "card" || st.phase === "engrave") ? curCard() : null;
  const step = card && isTutorialCard(card.id) ? tutorialStepOf(card.id) : null;
  if (!step) { el.hidden = true; dropHTML(el); return; }
  el.hidden = false;
  const desktop = document.body.dataset.view === "desktop";
  const text = desktop && step.coach_desktop ? step.coach_desktop : step.coach;
  patchHTML(el, text);
  if (desktop) placeCoach(step);        // 桌面所有档位（N/A/B）同一条摆放规则
}
// 目标若在 #card 内（#bonecorner / #card-drops），卡可能正处入场过渡（.card 的 transform 160ms）
// 或拖拽中——此时 getBoundingClientRect 读到的是被 transform 挪走的盒（T03 #coach 曾因此偏 ~190px，
// 直到下一次 render 才被纠正）。改用不被变换影响的 #cardwrap 视口盒 + 目标相对卡的 offset*，
// 得到「未变换」的视口矩形。.card 填满 #cardwrap，故卡槽的 left/top 即卡的 left/top。
function targetRect(el) {
  if (!el.closest("#card")) return el.getBoundingClientRect();
  const cw = $("cardwrap").getBoundingClientRect();
  const left = cw.left + el.offsetLeft, top = cw.top + el.offsetTop;
  return { left, top, right: left + el.offsetWidth, bottom: top + el.offsetHeight, width: el.offsetWidth, height: el.offsetHeight };
}
// 桌面教学气泡：一律贴在卡右侧的空沟里——所有桌面尺寸同一条规则，不按视口微调：
//   左缘 = 卡（#cardwrap 槽）右缘 + 24；
//   右缘 ≤ 舞台右缘 − 16（舞台右缘即侧栏左缘；侧栏收起/没有时即视口右缘）；
//   宽 ≤ 320，沟放不下就收宽（字号保持 14px，文字换行、不裁切）；
//   底缘 = 卡底 − 8（FIX_SPEC §Z3 / RULES_fix2_v2 §13 / R18）。
// 因此气泡整个在卡外，任何视口都不会压到卡（也就压不到卡右上角的「刻」）。
function placeCoach(step) {
  const col = $("coachcol"), el = $("coach");
  // 用 #cardwrap（不被拖拽/飞出动画改 transform）当卡的槽位，别用 #card——
  // 否则切卡瞬间（卡片 transform 还在 160ms 过渡里）读到的是移动中的卡，气泡会算到卡上面。
  const sb = $("stage").getBoundingClientRect(), cb = $("cardwrap").getBoundingClientRect();
  const GAP = 24, EDGE = 16, MAXW = 320, MINW = 160;
  let left = cb.right + GAP, width = Math.min(MAXW, sb.right - EDGE - left);   // 视口坐标
  if (width < MINW) {                  // 右沟窄到放不下可读的文字（侧栏开着、窗口又窄）：改贴卡左侧
    width = Math.min(MAXW, cb.left - GAP - sb.left - EDGE);
    left = cb.left - GAP - width;
  }
  if (width < MINW) { width = Math.min(MAXW, cb.width); left = cb.left; }      // 两边都不够：垫到卡上方
  col.style.left = (left - sb.left) + "px"; col.style.right = "auto"; col.style.width = width + "px";
  // 底边 = 卡底 − 8（所有桌面尺寸同一条规则，FIX_SPEC §Z3 / RULES_fix2_v2 §13 / R18）
  col.style.bottom = (sb.bottom - (cb.bottom - 8)) + "px";
  col.style.top = "auto";

  // 若气泡盖住按键提示/卡角刻/顶栏，按 R18 L15「按键提示不被教学气泡压住」上报而非悄悄挪动
  for (const sel of ["#keys", "#bonecorner", "#topbar"]) {
    const tel = document.querySelector(sel);
    if (!tel || tel.hidden || getComputedStyle(tel).display === "none") continue;
    const tr = targetRect(tel);
    const cr = el.getBoundingClientRect();
    const ix = Math.min(cr.right, tr.right) - Math.max(cr.left, tr.left);
    const iy = Math.min(cr.bottom, tr.bottom) - Math.max(cr.top, tr.top);
    if (ix > 0 && iy > 0) {
      console.warn(`[placeCoach] 教学气泡覆盖目标 ${sel} (R18 L15):`, { coach: cr, target: tr });
    }
  }
}
function renderWordbox() {
  patchHTML($("wordbox"), st.wordBox.map((ch, i) => {
    const used = st.dropped.includes(ch);
    const card = (st.phase === "card") ? curCard() : null;
    const ok = card && !used && usable(ch) && card.drops.some((d) => d.char === ch);
    // 标签只放「序号·字」：N 档格宽固定 52（BREAKPOINTS §字匣），塞不下「 · 已落」。
    // 「已落」由 .used 的删除线 + 灰化表达，读屏用 aria-label 补全（A/B/手机档格子自适应宽，
    // 那边也曾因这句文字溢出格子——LEFTOVERS D3/H5「不出容器」）。
    const label = `${i + 1}·${ch}`;
    const usedAttr = used ? ` aria-label="${label}，已落"` : "";
    return `<button class="slot ${ok ? "ok" : ""} ${used ? "used" : ""}" data-slot="${i}" ${st.phase !== "card" ? "disabled" : ""}${usedAttr}>${gimg(ch)}<span>${label}</span></button>`;
  }).join(""));
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
  patchHTML($("sidebar-body"), html);
  patchHTML($("drawer-body"), `<h3 style="color:#8a6a2a">字录 / 骨片 / 日志</h3>` + html);
}

// 生成结果没变就别重设 innerHTML：重设会把整块节点换掉，若恰落在「按下」与「抬起」之间，
// 浏览器不会再合成 click，那一次点击就静默丢了（E2）。元素隐藏时清缓存，下次显示必定重建。
const htmlCache = new WeakMap();
function patchHTML(el, html) {
  if (htmlCache.get(el) === html) return false;
  htmlCache.set(el, html);
  el.innerHTML = html;
  return true;
}
function dropHTML(el) { htmlCache.delete(el); }
// 文本与 innerHTML 同理：把同样的文本再赋一次也会换掉元素内部的文本节点。若这次重绘恰落在
// 「按下」与「抬起」之间，WebKit 会因为按下时命中的节点被换掉而不再合成 click（E2 的同一类；
// 实测把 textContent 设成与原来完全相同的值也会触发）。值没变就不写，节点保持不动。
function setText(el, text) { const s = String(text); if (el.textContent !== s) el.textContent = s; }

function renderWinter() {
  const el = $("winter");
  el.hidden = st.phase !== "winter";
  if (st.phase !== "winter") { dropHTML(el); return; }
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
  if (patchHTML(el, h) && t && CHARS[t.target].method === "xiangxing") drawTrace(t.target);
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
  // 挑字页标题显示即将开始的代：此刻 st.generation 还是刚结束的那一代（begin_generation 之后才 +1），与交棒按钮（n+1）保持一致。
  setText(el.querySelector("h2"), `出发挑字 · 第 ${(st.generation ?? 1) + 1} 代`);
  // gf5：手机用点选引导（点一下看说明、再点一次带上），电脑用键位提示。
  setText(el.querySelector(".season-note"), document.body.dataset.view === "desktop"
    ? "点字，或用 ← → 移动、Space 选 · Backspace 放回最后一个 · Enter 出发"
    : "点一个字看它能做什么；再点一次带上。");
  patchKeyed(el.querySelector(".pickslots"), [0, 1, 2], (i) => i,
    () => document.createElement("button"),
    (node, i) => {
      const ch = picks[i];
      node.className = "pickslot";
      node.dataset.slot = String(i);
      if (ch) { node.dataset.char = ch; node.title = "放回"; patchHTML(node, `${gimg(ch)}<span>${i + 1}·${ch}</span>`); }
      else { delete node.dataset.char; node.removeAttribute("title"); patchHTML(node, "空"); }
    });
  patchKeyed(el.querySelector(".pool"), PICK_CHARS, (p) => p.char,
    () => document.createElement("button"),
    (node, p) => {
      const sel = picks.indexOf(p.char), isSel = sel >= 0;
      node.className = "cand" + (isSel ? " sel" : "") + (full && !isSel ? " dim" : "") + (p.char === ui.pickFocus ? " focus" : "");
      node.dataset.char = p.char; node.dataset.i = String(PICK_CHARS.indexOf(p));
      patchHTML(node, `${gimg(p.char)}<span>${p.char}</span><span class="mng">${p.meaning}</span>${isSel ? `<span class="badge">${sel + 1}</span>` : ""}`);
    });
  const go = el.querySelector(".go");
  go.disabled = !full;
  setText(go, full ? "带这三个字出发" : "还差字");
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
  if (desc) patchHTML(desc, ui.pickFocus ? pickInfoHTML(ui.pickFocus) : "");
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
  if (el.hidden) { dropHTML(el); return; }
  const n = st.generation ?? 1;
  patchHTML(el, `<div class="card-e"><h1>${TUTORIAL.elder.header.replace("{n}", String(n))}</h1>
    <p><b>${TUTORIAL.elder.title}</b></p><p>${TUTORIAL.elder.body}</p>
    <div class="btnrow"><button class="act primary" data-do="heir">${TUTORIAL.elder.button_next.replace("{n}", String(n + 1))}</button></div></div>`);
}
function renderEnded() {
  const el = $("endseq");
  const pending = ui.bannerQueue.length > 0 || ui.bannerOn;   // 达成横幅先出，不能与结局重叠（A9）
  const show = st.phase === "ended" && !ui.elderShown && !pending;
  el.hidden = !show;
  if (!show) { dropHTML(el); return; }
  const e = st.ending, L = st.legacy;
  patchHTML(el, `<div class="card-e"><h1>${e.name}</h1><p>${e.kind === "good" ? "这一代平安走完。" : "这一代没撑住。"}</p>
    <p>${DIMS.map((k) => `${DIMNAME[k]} ${st.dims[k]}`).join(" · ")} · 骨片 ${st.bones}</p>
    <p>传下字录：${L ? L.zilu.join(" ") : "—"} · 传下事签：${L?.carriedTally ? L.carriedTally.id : "无"}</p>
    <div class="btnrow"><button class="act primary" data-do="elder">先人</button></div></div>`);
  if (pending) deferInteract(el, 400);
}

// 键位行：N 整句；A 缩成一行短句（12 号，高 28）；B 不占行，收进顶栏「?」浮层；
// 触控设备（非 pointer:fine）与手机档三档都不显。
function renderKeys() {
  const tier = document.body.dataset.short || "";
  const el = $("keys");
  if (!keyboardMode() || tier === "B") { setText(el, ""); return; }
  const engrave = st.phase === "engrave";
  if (tier === "A") {
    setText(el, engrave ? "←→选 1–3落字 Space分量 K刻" : "←→选 1–3落字 Space分量");
  } else {
    setText(el, engrave
      ? "← → 预览，再按同向或 Enter 提交 · 1–3 落字 · 按住 Space 看分量 · K 刻字 · Esc 关浮层"
      : "← → 预览，再按同向或 Enter 提交 · 1–3 落字 · 按住 Space 看分量 · Esc 关浮层");
  }
}
// 矮屏 B 顶栏「?」浮层：列出全部键位。首次进入某存档自动弹一次（3 秒后收起）。
function keyhelpHTML() {
  const rows = [
    ["← →", "选字；再按同向或 Enter 提交"],
    ["1–3", "落字"],
    ["Space", "按住看分量"],
    ...(st.phase === "engrave" ? [
      ["K", "刻字（或点卡角骨片）"],
      ["S", "先不刻"],
    ] : []),
    ["Esc", "关浮层"],
  ];
  return rows.map(([k, t]) => `<div class="kh-row"><b>${k}</b><span>${t}</span></div>`).join("");
}
// 卡入场动画是否在跑：JS 飞出/回弹的 rAF 阶段（ui.animating），或随后 160ms 的 CSS 回位过渡。
// 键位浮层在这期间必须隐去——它右上贴边，卡从右侧滑回时会正好从它下面经过（压住卡角「刻」）。
// cardSettling 只兜「飞出 rAF 结束、过渡对象还没建好的那一帧」。卡上真的没有在跑的入场过渡时
// 必须把这个闭锁放掉：它一旦卡死，renderShort()→armKeyhelpReshow()→whenCardEntryDone()
// （无动画可等，立刻 resolve）→renderShort()… 就变成只跑微任务的自旋，把事件循环饿死
// （页面全卡、page.evaluate 永不返回），inputBusy() 也会被永久摁住。
let cardSettling = false;
function cardEntryBusy() {
  if (ui.animating) return true;
  if (!cardSettling) return false;
  if (!$("card").getAnimations().some((a) => a.playState === "running")) cardSettling = false;
  return cardSettling;
}
function setCardSettled(settled) {
  const card = $("card");
  if (settled) {
    if (card) card.setAttribute("data-ready", "1");
    document.body.setAttribute("data-card-ready", "1");
  } else {
    if (card) card.removeAttribute("data-ready");
    document.body.removeAttribute("data-card-ready");
  }
}
// 「输入忙」：出卡阶段里卡还在飞出/入场，或还有排队项/挂起的重放——此时离散输入一律先入队。
function inputBusy() {
  return st.phase === "card" && (cardEntryBusy() || ui.keyQueue.length > 0 || ui.drainArmed);
}
// 刻字阶段的同一条规则：卡还在入场、或队列里还有没重放的项/挂起的重放时，K/S（骨片/先不刻同路）
// 也先入队，等刻字卡落定并经历最短停留后再生效（M22：与出卡阶段的 inputBusy 一致，别抢在上一张卡的队列前头）。
function carveBusy() {
  return st.phase === "engrave" && (cardEntryBusy() || ui.keyQueue.length > 0 || ui.drainArmed);
}
// 等卡入场动画结束：先等 rAF 阶段，再等 CSS 过渡跑完（Promise.all(finished)），
// 过渡对象还没建好的一帧用一次 transitionend 兜底。
function whenCardEntryDone() {
  return new Promise((resolve) => {
    const card = $("card");
    const step = () => {
      if (ui.animating) { requestAnimationFrame(step); return; }
      const running = card.getAnimations().filter((a) => a.playState === "running");
      if (!running.length) { resolve(); return; }
      let fired = false;
      const fin = () => { if (fired) return; fired = true; card.removeEventListener("transitionend", onEnd); step(); };
      const onEnd = (e) => { if (e.target === card) fin(); };
      card.addEventListener("transitionend", onEnd);
      Promise.allSettled(running.map((a) => a.finished)).then(fin, fin);
    };
    step();
  });
}
let keyhelpSettle = null;             // 入场中被隐去时挂的「稳住后再显形」等待
function armKeyhelpReshow() {
  if (keyhelpSettle) return;
  // 必须先让出一帧再重查：whenCardEntryDone() 在「没有动画可等」时会同步 resolve，若在这里
  // 直接重入 renderShort()→armKeyhelpReshow()，就形成只跑微任务的自旋循环（饿死事件循环）。
  keyhelpSettle = whenCardEntryDone()
    .then(() => new Promise((r) => requestAnimationFrame(() => r())))
    .then(() => { keyhelpSettle = null; renderShort(); });
}
let keyhelpCloseT = 0;
function scheduleKeyhelpClose() {
  clearTimeout(keyhelpCloseT);
  keyhelpCloseT = setTimeout(() => {
    if (!ui.keyhelpOpen) return;
    if (cardEntryBusy()) { scheduleKeyhelpClose(); return; }   // 入场中不收起：等它稳住再计时
    ui.keyhelpOpen = false; renderShort();
  }, 3000);
}
// 当前教学步要指的目标（落字 → 字匣；刻 → 卡角）；与占位气泡 placeCoach 用同一套映射。
function keyhelpTargets() {
  const els = [];
  const bc = $("bonecorner");
  if (bc && getComputedStyle(bc).display !== "none") els.push(bc);
  const card = (st.phase === "card" || st.phase === "engrave") ? curCard() : null;
  const step = card && isTutorialCard(card.id) ? tutorialStepOf(card.id) : null;
  const sel = step && step.teach === "drop" ? "#wordbox-bar" : step && step.teach === "engrave" ? "#bonecorner" : null;
  const t = sel ? document.querySelector(sel) : null;
  if (t && t !== bc && !t.hidden && getComputedStyle(t).display !== "none") els.push(t);
  return els;
}
// 浮层默认右上贴边；与任何「要避让的框」相交时就换位。要避让的框 = 卡角「刻」+ 当前教学目标
// （落字→字匣、刻→卡角）+ 教学气泡 #coach + 左右选项 + 矮屏提示：这些都不能被浮层压住
// （#coach 是 PM 决定 T03「刻」必须让开的；左右选项是 BREAKPOINTS「点击目标不被盖住」硬规则）。
// 候选位置按 右上（CSS 默认）→右下方→左下方→右上/左上→上方 依次挑，取第一个整块落在视口内、
// 且不与任何框相交的位置。整屏都放不下时，才隐去 #coach 让位（唯一允许的第二选择，关闭时还原）。
function placeKeyhelp() {
  const pop = $("keyhelp-pop");
  const coach = $("coach");
  if (coach) coach.style.visibility = "";                 // 每次重排先还原上次让位时隐去的 #coach
  pop.style.top = ""; pop.style.left = ""; pop.style.right = "";
  const shown = (e) => !!e && !e.hidden && e.getBoundingClientRect().width > 0
    && getComputedStyle(e).display !== "none" && getComputedStyle(e).visibility !== "hidden";
  const items = keyhelpTargets().map((e) => ({ e, r: e.getBoundingClientRect() }));
  for (const sel of ["opt-left", "opt-right", "too-short", "coach"]) {
    const e = $(sel);
    if (shown(e)) items.push({ e, r: e.getBoundingClientRect() });
  }
  if (!items.length) return;                              // 没有要避让的框：保持 CSS 默认位
  const d = pop.getBoundingClientRect();
  const pw = d.width, ph = d.height, M = 8, VW = innerWidth, VH = innerHeight;
  if (pw <= 0 || ph <= 0) return;
  const inter = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0;
  const pick = (rs) => {
    const xr = VW - M - pw, xl = M;
    const below = Math.max(0, ...rs.map((r) => r.bottom)) + M;
    const above = Math.min(...rs.map((r) => r.top)) - M - ph;
    const cands = [[d.left, d.top], [xr, below], [xl, below], [xr, d.top], [xl, d.top], [xr, above], [xl, above]];
    for (const [l, t] of cands) {
      if (l < M - 0.5 || t < M - 0.5 || l + pw > VW - M + 0.5 || t + ph > VH - M + 0.5) continue;
      const box = { left: l, top: t, right: l + pw, bottom: t + ph };
      if (!rs.some((r) => inter(box, r))) return [l, t];
    }
    return null;
  };
  let pos = pick(items.map((i) => i.r));
  if (!pos && coach) {                                    // 全屏都放不下：隐去 #coach 让位（唯一允许的第二选择）
    coach.style.visibility = "hidden";
    pos = pick(items.filter((i) => i.e !== coach).map((i) => i.r));
  }
  if (pos) { pop.style.left = pos[0] + "px"; pop.style.right = "auto"; pop.style.top = pos[1] + "px"; }
}
function renderShort() {
  const tier = document.body.dataset.short || "";
  const showBtn = tier === "B" && keyboardMode();
  $("keyhelp-btn").dataset.show = showBtn ? "1" : "0";
  if (!showBtn) ui.keyhelpOpen = false;
  const pop = $("keyhelp-pop");
  const busy = cardEntryBusy();
  const wasHidden = pop.hidden;
  pop.hidden = !ui.keyhelpOpen || busy;
  if (ui.keyhelpOpen && !busy) {
    patchHTML(pop, keyhelpHTML());
    placeKeyhelp();
    if (wasHidden) scheduleKeyhelpClose();        // 重新显形：自收计时从可见这一刻起算
  } else {
    dropHTML(pop);
    const coach = $("coach");
    if (coach) coach.style.visibility = "";        // 浮层收起（或入场中临时隐去）：还原被让位隐去的 #coach
    if (ui.keyhelpOpen) armKeyhelpReshow();        // 入场中：等卡稳住再显形
  }
  $("too-short").hidden = !(innerHeight < 600 || innerWidth < 360);
}
function maybeAutoKeyhelp() {
  if (document.body.dataset.short !== "B" || !keyboardMode()) return;
  const key = KEYHELP_PREFIX + seed;
  try { if (localStorage.getItem(key) === "1") return; localStorage.setItem(key, "1"); } catch { return; }
  ui.keyhelpOpen = true;
  whenCardEntryDone().then(() => { if (ui.keyhelpOpen) renderShort(); });   // 卡还在入场就等它走完再弹
  renderShort();
}

function render() {
  syncGoalEvents();
  renderTopbar();
  const d = dimsHTML();
  patchHTML($("dims"), d); patchHTML($("dims-desktop"), d);
  renderCard();
  renderWordbox();
  renderCoach();
  renderSide();
  renderGoalSlip(); renderGoalPanel();
  renderWinter(); renderPick(); renderElder(); renderEnded();
  renderKeys(); renderShort();
  if (ui.bannerOn) placeBanner();
  if (st.phase !== "ended" && st.phase !== "pick" && st.phase !== "winter") $("endseq").hidden = true;
}

// ---------- 拖卡 / 键盘 ----------
const cardEl = () => $("card");
function threshold() { return DRAG_RATIO * (cardEl().offsetWidth || cardEl().getBoundingClientRect().width); }

// 试着在 #card 上捕获指针：真实指针成功，合成指针（e2e 触屏 PointerEvent）会抛，吞掉即可。
const captureCard = (id) => {
  try {
    cardEl().setPointerCapture?.(id);
    capturedPointers.add(id);
  } catch { /* 合成指针会抛 */ }
};
// 起拖：onDown 与「排队 press 的重放」共用同一段（round 4 A5）。置拖拽态、加 .dragging、挂长按计时。
function beginDrag(x, pointerId) {
  ui.dragging = true; ui.dragged = false; ui.startX = x;
  cardEl().classList.add("dragging");
  captureCard(pointerId);
  ui.holdT = setTimeout(() => { if (ui.dragging && Math.abs(ui.dx) < 8) { ui.hold = true; render(); } }, 300);
}
const queuedPress = (id) => ui.keyQueue.find((it) => it.kind === "press" && it.id === id);
function onDown(e) {
  if (st.phase === "engrave") { toast(tutorialStepOf(st.current)?.lock_hint || "先点卡角骨片刻下这件事"); return; }  // B11
  if (st.phase !== "card" || inputBusy()) return;
  // 鼠标在可拖的卡上一按下就清掉页面上已有的文字选区：从卡外开始的选区（提示行/顶栏划进卡、Ctrl+A）会把卡包进去，
  // 浏览器把这次按下移动当成拖选中内容（webkit 粘卡并误提交，chromium/firefox pointercancel）。别处的选择不动。
  if (e.pointerType === "mouse") getSelection()?.removeAllRanges();
  beginDrag(e.clientX, e.pointerId);
  ui.commitNotBefore = 0;                                 // 现场起拖：松手即可提交，不受最短停留约束
}
function onMove(e) {
  if (!ui.dragging) {
    const p = queuedPress(e.pointerId);        // 排队中的 press：先把位置记上，重放起拖时用它当起点
    if (p && p.down) p.x = e.clientX;
    return;
  }
  ui.dx = e.clientX - ui.startX;
  if (Math.abs(ui.dx) > 8) { ui.dragged = true; clearTimeout(ui.holdT); ui.hold = false; }
  if (Math.abs(ui.dx) >= threshold() && !ui._thr) { ui._thr = true; sfx.threshold(); }
  if (Math.abs(ui.dx) < threshold()) ui._thr = false;
  applyTilt();
  renderDimsOnly();
}
function applyTilt() {
  const w = cardEl().offsetWidth || cardEl().getBoundingClientRect().width;
  const deg = Math.max(-15, Math.min(15, (ui.dx / w) * 15));
  cardEl().style.transform = `translateX(${ui.dx}px) rotate(${deg}deg)`;
}
function renderDragHintOnly() {
  const el = $("card-drag-hint");
  if (!el) return;
  if (!ui.dragging || Math.abs(ui.dx) <= 8 || st.phase !== "card") {
    el.hidden = true;
    return;
  }
  const c = curCard();
  if (!c) { el.hidden = true; return; }
  const opt = ui.dx < 0 ? c.left : c.right;
  const thr = threshold();
  const ratio = Math.min(1, Math.abs(ui.dx) / thr);
  const hot = Math.abs(ui.dx) >= thr;
  const lbl = $("card-drag-label");
  if (lbl) {
    lbl.textContent = opt.label;
    lbl.classList.toggle("hot", hot);
  }
  const fill = $("card-drag-fill");
  if (fill) {
    fill.style.width = (ratio * 100) + "%";
  }
  const drops = $("card-drops");
  const dropsVisible = drops && !drops.hidden && drops.offsetHeight > 0;
  el.classList.toggle("above-drops", dropsVisible);
  el.hidden = false;
}
function paintOpts() {
  const ol = $("opt-left"), or = $("opt-right");
  if (!ol || !or) return;
  const thr = threshold();
  const dragging = ui.dragging && Math.abs(ui.dx) > 8 && st.phase === "card";
  const pastThr = dragging && Math.abs(ui.dx) >= thr;
  const side = dragging ? (ui.dx < 0 ? "left" : "right") : (ui.kbDir ? ui.kbDir : null);
  ol.classList.toggle("on", side === "left");
  or.classList.toggle("on", side === "right");
  if (pastThr && side === "left") ol.setAttribute("data-ready", "1");
  else ol.removeAttribute("data-ready");
  if (pastThr && side === "right") or.setAttribute("data-ready", "1");
  else or.removeAttribute("data-ready");
}
function renderDimsOnly() {
  const d = dimsHTML();
  patchHTML($("dims"), d); patchHTML($("dims-desktop"), d);
  paintOpts();
  renderDragHintOnly();
}
function onUp(e) {
  if (e?.pointerId != null) capturedPointers.delete(e.pointerId);
  if (!ui.dragging) {
    // 排队中的 press 松手：按抬起时的位移决定「在队列原位变成一次 side 提交」还是整项丢弃。
    const it = e?.pointerId != null ? queuedPress(e.pointerId) : null;
    if (!it) return;
    it.x = e.clientX; it.down = false;
    const i = ui.keyQueue.indexOf(it), dx = it.x - it.startX;
    if (e.type === "pointerup" && Math.abs(dx) >= threshold()) ui.keyQueue[i] = { kind: "side", dir: dx < 0 ? "left" : "right" };
    else it.down = false;
    return;
  }
  clearTimeout(ui.holdT);
  ui.dragging = false; cardEl().classList.remove("dragging");
  paintOpts();
  const dh = $("card-drag-hint"); if (dh) dh.hidden = true;
  const thr = threshold(), dx = ui.dx;
  const wasHold = ui.hold; ui.hold = false;
  if (Math.abs(dx) >= thr) {
    const target = Math.sign(dx) * 620, act = dx < 0 ? INPUT.card.drag.left_action : INPUT.card.drag.right_action;
    const ep = ui.epoch;
    if (performance.now() < ui.commitNotBefore) {
      // 还在最短停留窗口内：卡停在松手处不动，等窗口结束再飞出提交（round 5 A）；期间 animating 让后续输入继续排队。
      ui.animating = true;
      const fire = () => {
        ui.heldCommitT = 0;
        ui.resumeHeldCommit = null;
        if (document.hidden || ui.epoch !== ep || modalOpen() || st.phase !== "card") {
          ui.animating = false;
          rebound();
          return;
        }
        ui.animating = false;
        sfx.commit();
        flyOut(target, () => {
          if (ui.epoch !== ep) return;
          dispatch(act);
        });
      };
      ui.resumeHeldCommit = fire;
      ui.heldCommitT = setTimeout(fire, ui.commitNotBefore - performance.now());
    } else {
      sfx.commit();
      flyOut(target, () => {
        if (ui.epoch !== ep) return;
        dispatch(act);
      });
    }
  } else {
    if (wasHold) sfx.rebound();
    else if (ui.dragged) sfx.rebound();
    rebound();
  }
}
function rebound() {
  const dh = $("card-drag-hint"); if (dh) dh.hidden = true;
  const ep = ui.epoch, from = ui.dx;
  if (reducedPref()) { ui.dx = 0; cardEl().style.transform = ""; render(); setCardSettled(true); return; }
  ui.animating = true; renderShort(); const t0 = performance.now(), dur = 320;
  const tick = (t) => {
    if (ui.epoch !== ep) { ui.animating = false; return; }
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    ui.dx = from * (1 - e); cardEl().style.transform = `translateX(${ui.dx}px)`; renderDimsOnly();
    if (k < 1) requestAnimationFrame(tick);
    else {
      ui.animating = false; ui.dx = 0; cardEl().style.transform = "";
      render();
      setCardSettled(true);
    }
  };
  requestAnimationFrame(tick);
}
function flyOut(targetX, done) {
  const dh = $("card-drag-hint"); if (dh) dh.hidden = true;
  n1Ref = null;                   // 新一次飞出：上一次飞卡的 N1 参照点作废（键盘/拖拽启动的也没有参照点）
  cardSettling = true;
  setCardSettled(false);
  paintOpts();
  const ep = ui.epoch;
  if (reducedPref()) {
    ui.animating = true;
    cardEl().style.opacity = "0";
    cardSettling = true;
    setTimeout(() => {
      cardEl().style.opacity = "";
      ui.animating = false;
      if (ui.epoch === ep) done();
      cardSettling = false;
      n1Ref = null;               // 这次飞卡结束：N1 不再管随后的点按
      setCardSettled(true);
      renderShort();
    }, 120);
    return;
  }
  ui.animating = true; renderShort(); const from = ui.dx, t0 = performance.now(), dur = 240, deg = Math.sign(targetX) * 18;
  const tick = (t) => {
    if (ui.epoch !== ep) { ui.animating = false; return; }
    const k = Math.min(1, (t - t0) / dur), e = k * k;
    ui.dx = from + (targetX - from) * e;
    cardEl().style.transform = `translateX(${ui.dx}px) rotate(${deg * e}deg)`; cardEl().style.opacity = String(1 - e);
    if (k < 1) requestAnimationFrame(tick);
    else {
      ui.animating = false;
      ui.dx = 0;
      cardEl().style.transform = ""; cardEl().style.opacity = "";
      cardSettling = true;
      if (ui.epoch === ep) done();
      requestAnimationFrame(() => {
        whenCardEntryDone().then(() => {
          cardSettling = false;
          n1Ref = null;           // 这次飞卡（含落定回位）结束：N1 不再管随后的点按
          setCardSettled(true);
          renderShort();
        });
      });
    }
  };
  requestAnimationFrame(tick);
}
// 按下目标统一判定 #cardwrap：卡片区内（含卡边距但非按钮）无论空闲现场起拖或忙时排队按下均一致接受，
// 避免命中边缘在空闲与飞出重放时表现不一致。
addEventListener("pointerdown", (e) => {
  if (e.target.closest("button")) return;
  const isPrimary = e.isPrimary || !e.isTrusted;
  if (inputBusy()) {
    if (isPrimary && e.target.closest("#cardwrap")) {
      captureCard(e.pointerId);
      enqueueInput({ kind: "press", id: e.pointerId, pointerType: e.pointerType, startX: e.clientX, x: e.clientX, down: true });
    }
  } else if (isPrimary && e.target.closest("#cardwrap")) onDown(e);
});
// 卡上不许原生拖拽（图片 / 选中内容）：dragstart 一律拦掉，否则 webkit 丢 pointerup 粘卡、其他引擎 pointercancel。
cardEl().addEventListener("dragstart", (e) => e.preventDefault());
addEventListener("pointermove", onMove);
addEventListener("pointerup", onUp);
addEventListener("pointercancel", onUp);

// 模态浮层：存档框 / ☰ 菜单 / 目标面板 / 移动抽屉（键位浮层不是模态）。
function modalOpen() { return !$("savedlg").hidden || ui.menuOpen || ui.panelOpen || !$("drawer").hidden; }
// 关掉「最上面」的浮层：存档框最后开、最先关；否则关菜单/目标面板/抽屉。只关浮层，不动输入队列。
function closeOverlay() {
  if (!$("savedlg").hidden) { closeDlg(); return; }
  ui.menuOpen = false; ui.panelOpen = false; $("drawer").hidden = true;
  renderMenu(); render();                              // render() 内含 renderGoalPanel()，目标面板随之收起
}
addEventListener("keydown", (e) => {
  // 浮层打开时键盘属于它：Esc 只关浮层；出卡阶段其它键（方向/落字/Enter…）既不排队也不处理，
  // 也不拦默认（存档框里打字、菜单按钮上的 Enter 等原生行为照旧）。其它阶段落入下方原有逻辑。
  if (modalOpen()) { if (e.key === "Escape") { closeOverlay(); return; } if (st.phase === "card") return; }
  if (e.key === "Escape" && (ui.keyhelpOpen || !$("keyhelp-pop").hidden)) { ui.keyhelpOpen = false; renderShort(); return; }
  // 出卡阶段焦点在牌桌外的按钮/输入控件上（如 ☰）时，Enter 归该控件：不拦默认、不入队、不处理游戏。
  // 牌桌内的卡、字匣格、左右选项不算：点过它们焦点会留在上面，Enter 仍是「提交预览」。
  if (e.key === "Enter" && st.phase === "card" && e.target?.closest?.("button, a[href], input, textarea, select")
      && !e.target.closest("#card, #wordbox, .optbtn")) return;
  if (inputBusy()) {
    if (e.key === "Escape" || e.code === "Space") { handleKey(e); return; }   // Esc/Space 保持原有即时行为
    // K/S pressed during a fly-out are not card keys and are not queued (unchanged)
    const cardKey = e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Enter" || !!INPUT.card.keys[e.code];
    if (!cardKey || e.ctrlKey || e.metaKey || e.altKey) return;               // 其它键不排队、不拦、不处理
    e.preventDefault();
    if (!e.repeat) enqueueInput({ kind: "key", key: e.key, code: e.code });  // 自动重复只拦默认，不入队
    return;
  }
  if (carveBusy()) {
    if (e.key === "Escape") { handleKey(e); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === INPUT.engrave.key) {
      e.preventDefault();
      if (!e.repeat) enqueueInput({ kind: "carve" });
      return;
    }
    if (e.code === "KeyS") {
      e.preventDefault();
      if (!e.repeat) enqueueInput({ kind: "skip" });
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Enter") {
      e.preventDefault();
      if (!e.repeat) enqueueInput({ kind: "key", key: e.key, code: e.code });
      return;
    }
    return;
  }
  handleKey(e);
});
function handleKey(e) {
  if (!$("savedlg").hidden && e.key === "Escape") { closeDlg(); return; }   // 关存档框不清队列（keydown 的 modalOpen 分支已先接管）
  if (e.key === "Escape") { clearQueue(); ui.panelOpen = false; ui.menuOpen = false; ui.keyhelpOpen = false; renderMenu(); renderGoalPanel(); render(); return; }
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
    if (e.repeat && (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Enter")) { e.preventDefault(); return; }  // 自动重复只预览一次
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
    if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Enter") {
      toast(tutorialStepOf(st.current)?.lock_hint || "先点卡角骨片刻下这件事");
    } else if (e.code === INPUT.engrave.key) {
      clearToast();
      ui.engraved = true;
      dispatch({ type: "engrave", trace: st.pendingTrace.target });
    } else if (e.code === "KeyS") {
      clearToast();
      dispatch(INPUT.engrave.skip);
    }
  } else if (st.phase === "winter" && e.key === "Enter") { e.preventDefault(); winterCarve(); }
}
// 离散输入的排队与重放：唯一入队口 enqueueInput、唯一启动口 armDrain，逐项重放一次只放一个。
// 每项都要等当前卡落定（whenCardEntryDone）后再过两帧 rAF，保证卡先画出来、输入才生效；
// 换阶段或弹出存档框/菜单时整队作废（那是玩家还没看到的界面，不替他按）。
function enqueueInput(item) {
  ui.keyQueue.push(item);
  armDrain();
}
const drainStep = () => {
  // 触屏窗口（round 4 A4）：等飞出结束；若队列头是一次仍按住的 press，就把卡的入场过渡直接结束，
  // 让卡立刻落定——「拖不动」的窗口只剩飞出 + 两帧，否则还要再等 ~400ms 的入场过渡。
  const settle = new Promise((resolve) => {
    const step = () => {
      if (ui.animating) { requestAnimationFrame(step); return; }
      const head = ui.keyQueue[0];
      if (head && head.kind === "press" && head.down) cardEl().getAnimations().forEach((a) => a.finish());
      resolve();
    };
    step();
  });
  settle.then(() => whenCardEntryDone()).then(() => requestAnimationFrame(() => requestAnimationFrame(() => {
    if (modalOpen()) { clearQueue(); ui.drainArmed = false; return; }
    if (st.phase !== "card" && st.phase !== "engrave") { clearQueue(); ui.drainArmed = false; return; }
    if (document.hidden) { ui.drainArmed = false; return; }
    if (ui.dragging) { ui.drainArmed = false; armDrain(); return; }   // 拖拽中：本帧不重放，下一帧再试
    const key = st.current + "|" + actions.length;                     // 这张卡「落定并绘制」的时刻（第 5 轮）：同卡保留，
    if (ui.settleKey !== key) { ui.settleKey = key; ui.settledAt = performance.now(); }   // 预览、提交共用同一个时间戳。
    const head = ui.keyQueue[0];
    if (head && !(head.kind === "press" && head.down) && performance.now() < ui.settledAt + DWELL_MS) {
      ui.drainArmed = false;                                           // 除了仍按住的 press（起拖不等停留），其它都要多留 DWELL_MS
      clearTimeout(ui.dwellT); ui.dwellT = setTimeout(armDrain, ui.settledAt + DWELL_MS - performance.now());
      return;
    }
    if (st.phase === "engrave") {
      const idx = ui.keyQueue.findIndex((it) => it.kind === "carve" || it.kind === "skip");
      if (idx >= 0) {
        const item = ui.keyQueue[idx];
        ui.keyQueue.splice(0, idx + 1);
        ui.drainArmed = false;
        if (item.kind === "carve") { ui.engraved = true; dispatch({ type: "engrave", trace: st.pendingTrace.target }); }
        else dispatch(INPUT.engrave.skip);
        if (ui.keyQueue.length) armDrain();
        return;
      }
      const hint = ui.keyQueue.some((it) => it.kind === "press" || it.kind === "side" || it.kind === "key");
      clearQueue();
      ui.drainArmed = false;
      if (hint) toast(tutorialStepOf(st.current)?.lock_hint || "先点卡角骨片刻下这件事");
      return;
    }
    const item = ui.keyQueue.shift();
    if (!item) { ui.drainArmed = false; return; }
    if (item.kind === "press") {                                      // 排队的按下：仍按住就起成实拖（round 4 A3）
      ui.drainArmed = false;
      if (item.down) {
        beginDrag(item.startX, item.id);
        ui.dx = item.x - item.startX;
        if (Math.abs(ui.dx) > 8) { ui.dragged = true; clearTimeout(ui.holdT); ui.hold = false; }
        if (Math.abs(ui.dx) >= threshold() && !ui._thr) { ui._thr = true; sfx.threshold(); }
        if (Math.abs(ui.dx) < threshold()) ui._thr = false;
        applyTilt();
        renderDimsOnly();
        ui.commitNotBefore = ui.settledAt + DWELL_MS;
      }
      if (ui.keyQueue.length) armDrain();
      return;
    }
    applyQueued(item);
    if (ui.keyQueue.length) { ui.drainArmed = false; armDrain(); }
    else ui.drainArmed = false;
  })));
};
function armDrain() {
  if (ui.drainArmed) return;
  ui.drainArmed = true;
  drainStep();
}
// 整队作废（Esc / 换阶段 / 弹层打开）：清空队列、取消停留计时；若正挂在「等最短停留后再提交」的实拖上，取消它并弹回原位。
function clearQueue() {
  ui.keyQueue.length = 0;
  clearTimeout(ui.dwellT); ui.dwellT = 0;
  if (ui.heldCommitT || ui.resumeHeldCommit) {
    clearTimeout(ui.heldCommitT); ui.heldCommitT = 0;
    ui.resumeHeldCommit = null;
    ui.animating = false;
    rebound();
  }
}
function applyQueued(item) {
  if (item.kind === "key") handleKey({ key: item.key, code: item.code, repeat: false, preventDefault() {} });
  else if (item.kind === "drop") dropSlot(item.slot);
  else if (item.kind === "side") commitSide(item.dir);
}
addEventListener("keyup", (e) => { if (e.code === "Space" && ui.hold && !ui.dragging) { ui.hold = false; render(); } });
// 后台标签页（P2-3）：document.hidden 期间停止 dwell / heldCommit 计时并禁止排队执行；恢复可见两帧后重新等满 DWELL_MS。
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearTimeout(ui.dwellT); ui.dwellT = 0;
    if (ui.heldCommitT) { clearTimeout(ui.heldCommitT); ui.heldCommitT = 0; }
  } else {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (document.hidden) return;
      const now = performance.now();
      ui.settledAt = now;
      if (ui.resumeHeldCommit) {
        ui.commitNotBefore = now + DWELL_MS;
        ui.animating = true;
        ui.heldCommitT = setTimeout(ui.resumeHeldCommit, DWELL_MS);
      }
      if (ui.keyQueue.length) armDrain();
    }));
  }
});
function commitSide(dir) {
  const ep = ui.epoch;
  flyOut((dir === "left" ? -1 : 1) * 620, () => {
    if (ui.epoch !== ep) return;
    dispatch(dir === "left" ? INPUT.card.drag.left_action : INPUT.card.drag.right_action);
  });
}

// ---------- 事件绑定 ----------
on($("keyhelp-btn"), () => { ui.keyhelpOpen = !ui.keyhelpOpen; renderShort(); });
on($("menubtn"), () => { ui.menuOpen = !ui.menuOpen; renderMenu(); });
function renderMenu() {
  const m = $("menu-pop"); m.hidden = !ui.menuOpen; $("menubtn").setAttribute("aria-expanded", String(ui.menuOpen));
  if (!ui.menuOpen) { dropHTML(m); return; }
  patchHTML(m,
    `<div class="grp">存档</div>` +
    `<button data-menu="export">导出存档码</button>` +
    `<button data-menu="import">导入存档码</button>` +
    `<div class="grp">设置</div>` +
    `<button data-menu="mute">${muted() ? "打开音效" : "静音"}</button>` +
    `<div class="grp">别的</div>` +
    `<a href="credits.html">字源与版权</a>` +
    `<button data-menu="new">重新开局</button>` +
    `<div class="seed">种子 ${seed}</div>`);
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
  renderCoach();      // 舞台右缘随侧栏开合移动：教学气泡要按新卡位重算（贴着卡右缘 +24）
});
on($("wb-handle"), () => { $("drawer").hidden = false; renderSide(); });
on($("drawer-mask"), () => { $("drawer").hidden = true; });
// 落字：点字匣格子与重放排队项共用这一条路（重放时按当前卡重新取格子，沿用 disabled 判定）。
function dropSlot(slot) {
  const b = document.querySelector(`#wordbox [data-slot="${slot}"]`);
  if (b && !b.disabled) dispatch({ type: "choose", side: "drop", slot });
}
on($("wordbox"), (e) => {
  const b = e.target.closest("[data-slot]"); if (!b || b.disabled) return;
  if (inputBusy()) enqueueInput({ kind: "drop", slot: Number(b.dataset.slot) });
  else dropSlot(Number(b.dataset.slot));
});
on($("card"), (e) => {
  const b = e.target.closest("[data-do]"); if (!b) return;
  if (b.dataset.do === "skip") {
    clearToast();
    if (carveBusy()) enqueueInput({ kind: "skip" });
    else dispatch({ type: "skip_engrave" });
  }
});
on($("bonecorner"), () => {
  if (st.phase === "engrave") {
    clearToast();
    if (carveBusy()) enqueueInput({ kind: "carve" });
    else { ui.engraved = true; dispatch({ type: "engrave", trace: st.pendingTrace.target }); }
  }
});
// 左右选项：支持 pointerup 提交并与 click 去重（S-1）。
// WebKit 在切卡/重绘（setText 换 text 节点）跨越按下与抬起时，不会为按钮合成 click。
// 在 pointerup 上若未起拖且仍在按钮内，即提交；随后的 click 借时间窗口去重，确保仅触发一次。
let lastOptPointerCommit = { side: null, at: 0 };
let optPress = null;
// N1（R05 / Q5=B，PM U1 裁定）：**飞卡途中**，同一个选项上、落点离「启动这次飞卡的那一下」
// ≤10px 的点按整次吞掉——不提交、不入队。**没有时间窗**（70ms 已删）：只要这次飞卡还没结束，
// 同选项 ≤10px 的每一下都吞。参照点 n1Ref 只由「用户直接点选项按钮、当下起飞」的那一下设置
// （见 bindOpt 里的 n1Arm）：键盘（←/→/Enter/1–3）、拖拽松手、点字格、队列项启动的飞卡
// 没有参照点，途中点选项一律按 R06 走（PM P1、P1 补）。
// N1 是一道纯过滤器，放在 hit / inputBusy() 之前；队列拿到的就是 N1 没吞掉的每一次点按。
const N1_MAX_DIST = 10;
function n1Arm(side, x, y) { n1Ref = { side, x, y }; }      // 只有「直接点选项且真的起飞」才调
function n1RepeatTap(side, x, y) {
  if (!n1Ref || n1Ref.side !== side) return false;          // 没有参照点（不是点选项起的飞卡）→ 不吞
  const d = Math.hypot(x - n1Ref.x, y - n1Ref.y);
  if (d > N1_MAX_DIST) return false;                        // 另一处落点 → 不吞
  n1Swallowed++;
  n1Reason = `n1:same-option d=${d.toFixed(1)}px`;
  return true;
}
function bindOpt(id, side) {
  const el = $(id);
  if (!el) return;
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    optPress = { side, id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  el.addEventListener("pointerup", (e) => {
    if (!optPress || optPress.side !== side || optPress.id !== e.pointerId) return;
    const press = optPress;
    optPress = null;
    if (ui.dragging) return;
    const dist = Math.hypot(e.clientX - press.x, e.clientY - press.y);
    if (dist > 20) return;
    // N1 重复点按过滤器：放在 hit / inputBusy 之前，只认「按下点在同一个选项按钮上」，
    // 不依赖抬起时卡片是否已经飞出移位（选项按钮不在 #card 里，不随飞出位移）。
    if (n1RepeatTap(side, press.x, press.y)) {
      // 这次点按没有提交，但它后面照样会合成一个 click：借 S-1 那条既有的 700ms 去重把它挡掉，
      // 否则这条 click 会绕过 N1 走到 commitSide（白入队一次）。
      lastOptPointerCommit = { side, at: performance.now() };
      return;
    }
    const hit = el.contains(e.target) || document.elementFromPoint(e.clientX, e.clientY)?.closest("#" + id);
    if (!hit) return;
    lastOptPointerCommit = { side, at: performance.now() };
    if (inputBusy()) {
      enqueueInput({ kind: "side", dir: side });
    } else {
      commitSide(side);
      n1Arm(side, press.x, press.y);   // 这一下真的起了飞卡：N1 从这一刻盯同选项 ≤10px
    }
  });
  el.addEventListener("pointercancel", (e) => {
    if (optPress && optPress.id === e.pointerId) optPress = null;
  });
  on(el, (e) => {
    const now = performance.now();
    if (lastOptPointerCommit.side === side && (now - lastOptPointerCommit.at) < 700) {
      lastOptPointerCommit = { side: null, at: 0 };
      return;
    }
    // pointerup 没赶上（S-1：WebKit 跨重绘不合成 click 的同类反例）时，click 自己提交；
    // 它也是一次「直接点选项」，照设参照点（没有坐标的合成 click 传 0,0，量不出距离就不会误吞）。
    if (n1RepeatTap(side, e.clientX || 0, e.clientY || 0)) return;
    if (inputBusy()) {
      enqueueInput({ kind: "side", dir: side });
    } else {
      commitSide(side);
      n1Arm(side, e.clientX || 0, e.clientY || 0);
    }
  });
}
bindOpt("opt-left", "left");
bindOpt("opt-right", "right");
addEventListener("pointerup", (e) => {
  if (optPress && optPress.id === e.pointerId) optPress = null;
});
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
// 动作按「按下那一刻记下的字/动作」执行（doAttr+char），不再读抬起时手指下的节点：
// 多指同时松开时，前指的放回会让格子就地补位（第 3 格的字挪到第 2 格、第 3 格变空），
// 后指的 pointerup 会命中同一个已空的格子节点——读当前内容就什么都不做，漏放回（D1）。
function pickAction(doAttr, char) {
  if (doAttr === "go") {
    const p = st.picks || [];
    if (p.length === RULES.word_box.slots) { sfx.ready(); dispatch({ type: "begin_generation", picks: p }); }
    return;
  }
  if (char) pickClick(char);
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
  // 记下按下那一刻的字与动作；抬起时按它执行（不读抬起时手指下的节点，见 pickAction 注释）。
  ui.presses.set(e.pointerId, {
    token: ++pickPressSeq,
    node,
    key: node ? pickKey(node) : null,
    do: node?.dataset.do || null,
    char: node?.dataset.char || null,
  });
});
addEventListener("pointerup", (e) => {
  const press = ui.presses.get(e.pointerId);
  if (!press) return;
  ui.presses.delete(e.pointerId);                          // 只清自己这一指
  if (!press.node) return;
  // 抬起仍落在按下时的那一个控件上（或在原位补丁下它已脱离、但按下时的 key 仍能对上）才动作。
  // 不能按「抬起时手指下带 data-char 的节点」判：多指同时松开时，前指的放回会让格子就地补位
  // （第 3 格的字挪到第 2 格、第 3 格变空），后指下的格子已没有 data-char，那样判会整条漏掉（D1）。
  const same = press.node.isConnected
    ? press.node.contains(e.target)
    : (press.key != null && e.target.closest?.(PICK_HIT) != null && pickKey(e.target.closest(PICK_HIT)) === press.key);
  if (!same) return;                                       // 拖到别的控件再松手：不动作
  ui.swallow.push({ token: press.token, at: performance.now() });
  pickAction(press.do, press.char);                        // 用按下时记下的字/动作，不用抬起时的节点内容
});
addEventListener("pointercancel", (e) => { ui.presses.delete(e.pointerId); capturedPointers.delete(e.pointerId); });
on($("pick"), (e) => {
  const c = e.target.closest(PICK_HIT); if (!c) return;
  if (consumePickSwallow()) return;                        // 这次 click 由 pointerup 已处理的同一次按下合成
  pickAction(c.dataset.do || null, c.dataset.char || null);
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
on($("elder"), (e) => {
  const b = e.target.closest("[data-do]"); if (b?.dataset.do !== "heir") return;
  // 先人卡属于「这一代」：交棒就是进入下一代，必须复位每代一次的状态——
  // 否则 ui.elderShown 会一直为 true，第 2 代结束时 renderEnded 被跳过、直接弹 #elder（E3）。
  ui.elderShown = false; ui.winter = freshWinter();
  dispatch({ type: "heir" });
});
on($("dlgcopy"), async () => { const t = $("dlgtext"); try { await navigator.clipboard.writeText(t.value); toast("已复制"); } catch { t.focus(); t.select(); toast("复制不了，请手动选中复制"); } });
on($("dlgapply"), importCode);
on($("dlgclose"), closeDlg);
$("savedlg").addEventListener("click", (e) => { if (e.target === $("savedlg")) closeDlg(); });
const closeMenuOutside = (e) => {                 // 点外面关菜单
  if (ui.menuOpen && !e.target.closest("#menu-pop") && !e.target.closest("#menubtn")) { ui.menuOpen = false; renderMenu(); }
};
document.addEventListener("pointerdown", closeMenuOutside);  // WebKit 触控点空白处不合成 click
document.addEventListener("click", closeMenuOutside);
// 点「?」浮层外面也收起（同菜单：pointerdown + click 双通道）
const closeKeyhelpOutside = (e) => {
  if (ui.keyhelpOpen && !e.target.closest("#keyhelp-pop") && !e.target.closest("#keyhelp-btn")) { ui.keyhelpOpen = false; renderShort(); }
};
document.addEventListener("pointerdown", closeKeyhelpOutside);
document.addEventListener("click", closeKeyhelpOutside);

// ---------- 调试钩子 ----------
window.__zz = {
  get st() { return st; }, get seed() { return seed; }, get actions() { return actions; },
  get view() { return document.body.dataset.view; },
  get short() { return document.body.dataset.short || ""; },
  get animating() { return ui.animating; },
  get busy() { return inputBusy(); },          // 当前是否处在飞卡/入场闭锁中（供用例判断「还在飞出途中」）
  get queued() { return ui.keyQueue.length + (ui.drainArmed ? 1 : 0); },
  get n1Swallowed() { return n1Swallowed; },   // N1 重复点按过滤器吞掉的次数（见 n1RepeatTap）
  get n1Reason() { return n1Reason; },         // 最后一次被 N1 吞掉的原因，供用例区分 N1 与 inputBusy
  get n1Ref() { return n1Ref ? { ...n1Ref } : null; },   // 当前这次飞卡的 N1 参照点（null = N1 不生效）
  get debugGoal() { return DEBUG_GOAL; },
  get settledAt() { return ui.settledAt; },
  dispatch, newGame, restore, render, clearToast, toast, code: () => encodeSaveCode(seed, actions),
  importCode(c) { $("dlgtext").value = c; return importCode(); },
  setMuted(v) { localStorage.setItem(MUTE_KEY, v ? "1" : "0"); renderMenu(); },
  isMuted: () => muted(),
  openMenu: () => { ui.menuOpen = true; renderMenu(); },
};

// ---------- 启动 ----------
if (!DEBUG_GOAL) restore();          // 调试图标（debug_goal）时不读旧存档，保证这一局就是目标被塞进去的局
computeLayout();
render();
whenCardEntryDone().then(() => setCardSettled(true));
maybeAutoKeyhelp();                  // 矮屏 B：该存档首次进入自动弹一次键位「?」
loadGlyphs();
if ("serviceWorker" in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) return;
    if (reloading) return;
    const key = "zz_sw_reloaded";
    const last = Number(sessionStorage.getItem(key) || 0);
    if (Date.now() - last < 5000) return;
    sessionStorage.setItem(key, String(Date.now()));
    reloading = true;
    const tryReload = () => {
      const busy = ui.dragging || ui.animating || cardEntryBusy() || (ui.keyQueue && ui.keyQueue.length > 0) || ui.drainArmed;
      if (busy) {
        whenCardEntryDone().then(() => {
          const stillBusy = ui.dragging || ui.animating || cardEntryBusy() || (ui.keyQueue && ui.keyQueue.length > 0) || ui.drainArmed;
          if (stillBusy) { setTimeout(tryReload, 100); return; }
          saveNow();
          location.reload();
        });
      } else {
        saveNow();
        location.reload();
      }
    };
    tryReload();
  });
  if (BUILD_DIST) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
