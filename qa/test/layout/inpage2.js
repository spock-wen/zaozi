// 第二组注入：C 对比度（文字 ≥4.5:1、非文字 ≥3:1）+ S FIX_SPEC 验收清单可自动化的项。依赖 inpage.js（同一页先注入）。
// 颜色计算：WCAG 2.x 相对亮度；前景按 alpha×有效 opacity 叠到实际背景上；实际背景 = 该点自上而下的绘制栈（elementsFromPoint，
// 去掉元素自身后代）逐层 alpha 合成，直到遇到不透明层；渐变取每个色标分别算、取最差；图片/画布背景标 needsImage，交给外层截图采样。
(() => {
  const parse = (s) => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const over = (top, bot) => { const a = top.a + bot.a * (1 - top.a); if (a <= 0) return { r: 0, g: 0, b: 0, a: 0 }; return { r: (top.r * top.a + bot.r * bot.a * (1 - top.a)) / a, g: (top.g * top.a + bot.g * bot.a * (1 - top.a)) / a, b: (top.b * top.a + bot.b * bot.a * (1 - top.a)) / a, a }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex = (c) => "#" + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  const effOp = (e) => { let o = 1; for (let x = e; x && x.nodeType === 1; x = x.parentElement) o *= +getComputedStyle(x).opacity; return o; };
  const name = (e) => e.id ? "#" + e.id : e.tagName.toLowerCase() + (typeof e.className === "string" && e.className.trim() ? "." + e.className.trim().split(/\s+/).join(".") : "");
  const snip = (e) => (e.innerText || e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 16);
  const rendered = (e) => { if (e.closest("[hidden]")) return false; const r = e.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) return false; const cs = getComputedStyle(e); return cs.visibility === "visible" && cs.display !== "none" && effOp(e) >= 0.05; };
  const ownText = (e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  const LAYERS = ["#savedlg", "#pick", "#winter", "#elder", "#endseq", "#drawer"];
  const scopeRoot = () => { for (const s of LAYERS) { const e = document.querySelector(s); if (e && !e.hidden && e.getClientRects().length) return e; } return document.body; };
  const inScope = (e, root) => root === document.body || root.contains(e) || !!e.closest("#toast, #banner, #sprout");
  // 一层自身的「底」：返回 {kind:'color'|'grad'|'image'|'none', colors:[...]}，颜色已乘该层有效 opacity
  function layerPaint(h) {
    const cs = getComputedStyle(h), op = effOp(h);
    if (/^(IMG|CANVAS|VIDEO|PICTURE|SVG)$/i.test(h.tagName) || /url\(/.test(cs.backgroundImage)) return { kind: "image" };
    if (cs.backgroundImage && cs.backgroundImage !== "none" && /gradient/.test(cs.backgroundImage)) {
      const stops = [...cs.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map((m) => parse(m[0])).filter(Boolean).map((c) => ({ ...c, a: c.a * op }));
      const bg = parse(cs.backgroundColor); return { kind: "grad", colors: stops.map((s) => bg && bg.a ? over(s, { ...bg, a: bg.a * op }) : s) }; }
    const bg = parse(cs.backgroundColor); if (bg && bg.a > 0) return { kind: "color", colors: [{ ...bg, a: bg.a * op }] };
    return { kind: "none" };
  }
  // 点 (x,y) 处、元素 e 下面（不含 e 及其后代；含不含 e 自己由 self 决定）的合成背景候选集
  function backdrop(e, x, y, self) {
    const st = document.createElement("style"); st.textContent = "*{pointer-events:auto !important}"; document.head.appendChild(st);
    const stack = document.elementsFromPoint(x, y); st.remove();
    const layers = []; if (self) layers.push(e);
    let seenE = false;
    for (const h of stack) { if (h === e) { seenE = true; continue; } if (e.contains(h)) continue; if (!seenE && !h.contains(e)) continue;   // e 上面盖着的不算背景（遮挡由 ② 判）
      layers.push(h); }
    let cands = [{ r: 255, g: 255, b: 255, a: 1 }], image = false, src = [];
    const paints = [];
    for (const h of layers) { const p = layerPaint(h); if (p.kind === "image") { image = true; src.push(name(h) + "(图)"); break; } if (p.kind === "none") continue; paints.push(p); src.push(name(h) + (p.kind === "grad" ? "(渐变)" : "")); if (p.colors.length && p.colors.every((c) => c.a >= 0.999)) break; }   // 不透明层（纯色或全不透明渐变）以下看不见
    // 自底向上合成；渐变展开为多个候选
    for (const p of paints.reverse()) { const nc = []; for (const b of cands) for (const c of p.colors) nc.push(over(c, b)); cands = nc.slice(0, 16); }
    return { cands, image, src: src.join(" ← ") };
  }
  const textBoxes = (root) => [...document.querySelectorAll("body *")].filter((e) => inScope(e, root) && !e.closest("script,style,svg *,.float") && ownText(e) && rendered(e));
  const INTERACTIVE = "button, [role=button], a[href], input, textarea, select, .slot, .cand, .tally, #bonecorner, .card-drops, .wb-handle, #goals-slip";
  function checkC() {
    const root = scopeRoot(), text = [], ui = [], img = [];
    for (const e of textBoxes(root)) {
      if (e.closest(":disabled")) continue;
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e); const fg0 = parse(cs.color); if (!fg0) continue;
      { const cx = r.left + r.width / 2, cy = r.top + r.height / 2; if (cx < 0 || cy < 0 || cx >= innerWidth || cy >= innerHeight) continue; }   // 中心在视口外（可滚动页下方）取不到绘制栈，不判
      const fg = { ...fg0, a: fg0.a * effOp(e) };
      const bd = backdrop(e, r.left + r.width / 2, r.top + r.height / 2, true);
      if (bd.image) { img.push({ type: "text", el: name(e), text: snip(e), rect: [r.left, r.top, r.width, r.height], fg: [fg.r, fg.g, fg.b, fg.a], src: bd.src }); continue; }
      let worst = 99, wb = null; for (const b of bd.cands) { const ff = over(fg, b); const k = ratio(ff, b); if (k < worst) { worst = k; wb = b; } }
      text.push({ el: name(e), text: snip(e), ratio: +worst.toFixed(2), fg: hex(over(fg, wb)), bg: hex(wb), src: bd.src, ok: worst >= 4.5 });
    }
    for (const e of document.querySelectorAll(INTERACTIVE)) {
      if (!inScope(e, root) || !rendered(e) || e.matches(":disabled")) continue;
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e), op = effOp(e);
      // 背景采样点：元素外侧 3px（上沿中点；越出视口就换下沿/左沿）
      const pts = [[r.left + r.width / 2, r.top - 3], [r.left + r.width / 2, r.bottom + 3], [r.left - 3, r.top + r.height / 2], [r.right + 3, r.top + r.height / 2]].filter(([x, y]) => x >= 0 && y >= 0 && x < innerWidth && y < innerHeight);
      if (!pts.length) continue;
      { const cx = r.left + r.width / 2, cy = r.top + r.height / 2; if (cx < 0 || cy < 0 || cx >= innerWidth || cy >= innerHeight) continue; }
      // 用元素「下面」的绘制栈：取元素中心点的栈去掉元素本身（更接近真实背后）
      const bd = backdrop(e, r.left + r.width / 2, r.top + r.height / 2, false);
      const bw = ["Top", "Right", "Bottom", "Left"].map((k) => cs["border" + k + "Style"] !== "none" ? parseFloat(cs["border" + k + "Width"]) : 0); const hasB = Math.max(...bw) >= 1;
      const bc = parse(cs.borderTopColor); const fill = layerPaint(e);
      if (!(hasB && bc && bc.a > 0) && fill.kind === "none") continue;   // 无底无边的纯文字/图标按钮：边界就是它的字，交给文字对比度判
      if (bd.image) { img.push({ type: "ui", el: name(e), text: snip(e), rect: [r.left, r.top, r.width, r.height], border: hasB && bc ? [bc.r, bc.g, bc.b, bc.a * op] : null, fill: fill.colors ? fill.colors.map((c) => [c.r, c.g, c.b, c.a]) : null, src: bd.src }); continue; }
      let best = 0, how = "";
      for (const b of bd.cands) {
        let k1 = 0, k2 = 0;
        if (hasB && bc && bc.a > 0) k1 = ratio(over({ ...bc, a: bc.a * op }, b), b);
        if (fill.colors) k2 = Math.min(...fill.colors.map((c) => ratio(over(c, b), b)));
        const k = Math.max(k1, k2); if (best === 0 || k < best) { best = k; how = `边框${k1.toFixed(2)} 底${k2.toFixed(2)} 对 ${hex(b)}`; }
      }
      ui.push({ el: name(e), text: snip(e), ratio: +best.toFixed(2), how, src: bd.src, ok: best >= 3 });
    }
    return { text, ui, img };
  }
  // 外层截图采样后回填：samples = [[r,g,b],...]（元素框内/外环像素），返回第 10 百分位对比度
  function contrastFromSamples(item, samples) {
    if (!samples.length) return null;
    const ks = [];
    if (item.type === "text") { const fg = { r: item.fg[0], g: item.fg[1], b: item.fg[2], a: item.fg[3] }; for (const [r, g, b] of samples) { const bg = { r, g, b, a: 1 }; ks.push(ratio(over(fg, bg), bg)); } }
    else for (const [r, g, b] of samples) { const bg = { r, g, b, a: 1 }; let k1 = 0, k2 = 0; if (item.border) k1 = ratio(over({ r: item.border[0], g: item.border[1], b: item.border[2], a: item.border[3] }, bg), bg); if (item.fill) k2 = Math.min(...item.fill.map((c) => ratio(over({ r: c[0], g: c[1], b: c[2], a: c[3] }, bg), bg))); ks.push(Math.max(k1, k2)); }
    ks.sort((a, b) => a - b); return +ks[Math.floor(ks.length * 0.1)].toFixed(2);
  }
  async function sample(b64, dpr, regions) { // regions: [{mode:'inside'|'ring', rect:[x,y,w,h]}]
    const im = new Image(); im.src = "data:image/png;base64," + b64; await im.decode();
    const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const g = c.getContext("2d"); g.drawImage(im, 0, 0);
    const D = g.getImageData(0, 0, c.width, c.height).data; const px = (x, y) => { x = Math.round(x * dpr); y = Math.round(y * dpr); if (x < 0 || y < 0 || x >= c.width || y >= c.height) return null; const i = (y * c.width + x) * 4; return [D[i], D[i + 1], D[i + 2]]; };
    return regions.map(({ mode, rect: [x, y, w, h] }) => { const out = []; const step = Math.max(1, Math.min(w, h) / 12);
      if (mode === "inside") { for (let yy = y + 1; yy < y + h - 1; yy += step) for (let xx = x + 1; xx < x + w - 1; xx += step) { const p = px(xx, yy); if (p) out.push(p); } }
      else { for (const d of [2, 3, 4]) { for (let xx = x; xx <= x + w; xx += step) { for (const yy of [y - d, y + h + d]) { const p = px(xx, yy); if (p) out.push(p); } } for (let yy = y; yy <= y + h; yy += step) { for (const xx of [x - d, x + w + d]) { const p = px(xx, yy); if (p) out.push(p); } } } }
      return out; });
  }
  // ---------- S：FIX_SPEC 验收清单 ----------
  const rectOf = (s) => { const e = document.querySelector(s); if (!e || !rendered(e)) return null; return e.getBoundingClientRect(); };
  const inter = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
  const R = (r) => [r.left, r.top, r.right, r.bottom].map((v) => +v.toFixed(1)).join("/");
  const lines = (e) => { const rg = document.createRange(); rg.selectNodeContents(e); const tops = new Set([...rg.getClientRects()].filter((q) => q.width > 0.5).map((q) => Math.round(q.top))); return tops.size; };
  function checkS(MAP) {
    const out = {}; const root = scopeRoot(); const vw = innerWidth, vh = innerHeight;
    // S1：提到「骨片 / K」的提示出现时 #bonecorner 可见/在视口/点击区≥44/命中自身/边框对卡底≥3:1
    const carriers = [...document.querySelectorAll("body *")].filter((e) => inScope(e, root) && ownText(e) && rendered(e) && !e.closest("#card-title,#card-text,.card-head,#drawer-body,#sidebar-body,.optbtn"))
      .map((e) => [e, (e.innerText || "").replace(/\s+/g, " ").trim()]).filter(([, t]) => /卡角.{0,2}骨片|点骨片|骨片「刻」|(^|[^A-Za-z])K([^A-Za-z]|$)/.test(t));
    if (carriers.length) {
      const bc = document.querySelector("#bonecorner"); const why = window.__qaLayout.visibleWhy(bc); const bad = [];
      if (why) bad.push("可见性：" + why);
      else { const r = bc.getBoundingClientRect(); if (r.width < 44 || r.height < 44) bad.push(`点击区 ${r.width.toFixed(0)}×${r.height.toFixed(0)} <44`);
        const cs = getComputedStyle(bc), card = document.querySelector("#card"), cb = parse(getComputedStyle(card).backgroundColor), b = parse(cs.borderTopColor);
        const k = b && cb ? ratio(over(b, cb), cb) : 0; if (k < 3) bad.push(`边框 ${b ? hex(b) : "无"} 对卡底 ${cb ? hex(cb) : "?"} = ${k.toFixed(2)}:1 <3`); out.s1k = +k.toFixed(2); }
      out.S1 = { ok: !bad.length, note: `提示「${carriers.map(([, t]) => t.slice(0, 14)).join("」「")}」；` + (bad.join("；") || "骨片可见、≥44、命中自身、边框对比≥3") };
    }
    // S2：.card-drops 子元素在框内；.card-drops 在 #card 内；先不刻一行
    const dr = document.querySelector("#card-drops");
    if (dr && rendered(dr) && inScope(dr, root)) {
      const d = dr.getBoundingClientRect(), c = document.querySelector("#card").getBoundingClientRect(); const bad = [];
      for (const k of dr.querySelectorAll("*")) { if (!rendered(k)) continue; const r = k.getBoundingClientRect(); const o = Math.max(d.left - r.left, d.top - r.top, r.right - d.right, r.bottom - d.bottom); if (o > 1) bad.push(`${name(k)}「${snip(k)}」越出 ${o.toFixed(1)}`); }
      // 文本节点（迹文直接写在 .card-drops 里）也算子元素：用 Range 量
      const rg = document.createRange(); rg.selectNodeContents(dr); const tr = rg.getBoundingClientRect(); const ot = Math.max(d.top - tr.top, tr.bottom - d.bottom, d.left - tr.left, tr.right - d.right); if (ot > 1) bad.push(`文字内容越出 ${ot.toFixed(1)}（内容盒 ${R(tr)}）`);
      const oc = Math.max(c.left - d.left, c.top - d.top, d.right - c.right, d.bottom - c.bottom); if (oc > 1) bad.push(`.card-drops 越出 #card ${oc.toFixed(1)}`);
      const sk = dr.querySelector("[data-do=skip]"); if (sk) { const n1 = sk.getClientRects().length, n2 = lines(sk); if (n1 !== 1 || n2 !== 1) bad.push(`「先不刻」行数=${n2}（getClientRects=${n1}）`); }
      out.S2 = { ok: !bad.length, note: bad.slice(0, 4).join("；") || "子元素、文字都在框内，框在卡内，「先不刻」一行" };
    }
    // S3：#card 不与 #topbar/资源条(#dimrow)/#coach/#wordbox-bar 相交，卡顶 ≥0
    const card = rectOf("#card");
    if (card && root === document.body) { const bad = [];
      for (const s of ["#topbar", "#dimrow", "#coach", "#wordbox-bar"]) { const r = rectOf(s); if (r && inter(card, r)) bad.push(`与 ${s} 相交（卡 ${R(card)}，${s} ${R(r)}）`); }
      if (card.top < -0.5) bad.push(`卡顶 ${card.top.toFixed(1)} <0`);
      out.S3 = { ok: !bad.length, note: bad.join("；") || `卡 ${R(card)} 不与顶栏/资源条/提示条/字匣相交` };
      out.cardSize = [+card.width.toFixed(1), +card.height.toFixed(1)]; }
    // S5：挑字页 .go 完整在视口内；.cand .mng 不超出 .cand
    const pick = document.querySelector("#pick");
    if (pick && !pick.hidden && pick.getClientRects().length) { const bad = []; const go = pick.querySelector(".go");
      if (!go) bad.push("没有 .go"); else { const r = go.getBoundingClientRect(); if (r.top < -0.5 || r.left < -0.5 || r.bottom > vh + 0.5 || r.right > vw + 0.5) bad.push(`.go ${R(r)} 不完整在视口 ${vw}×${vh} 内`); }
      for (const m of pick.querySelectorAll(".cand .mng")) { const cd = m.closest(".cand").getBoundingClientRect(), r = m.getBoundingClientRect(); const o = Math.max(cd.left - r.left, cd.top - r.top, r.right - cd.right, r.bottom - cd.bottom); if (o > 1 || m.scrollWidth > m.clientWidth + 1) { bad.push(`.mng「${snip(m)}」越出 .cand ${o.toFixed(1)}`); } }
      out.S5 = { ok: !bad.length, note: bad.slice(0, 4).join("；") + (bad.length > 4 ? `；…共${bad.length}处` : "") || ".go 在视口内，释义都在格内" }; }
    // S6：所有可点元素 ≥44×44（把手按命中区域实测）
    { const bad = []; let n = 0;
      for (const e of document.querySelectorAll("button, [role=button], a[href], .slot, .cand, .tally, [data-do], #goals-slip, #keyhelp-btn, #menubtn")) {
        if (!inScope(e, root) || !rendered(e)) continue; if (e.closest("#dlgbox") && root === document.body) continue; n++;
        const r = e.getBoundingClientRect(); if (r.width < 44 - 0.5 || r.height < 44 - 0.5) bad.push(`${name(e)}「${snip(e)}」${r.width.toFixed(0)}×${r.height.toFixed(0)}`); }
      const h = document.querySelector(".wb-handle");
      if (h && rendered(h) && inScope(h, root)) { n++; const r = h.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
        for (let dx = -70; dx <= 70; dx += 2) for (let dy = -40; dy <= 40; dy += 2) { const t = document.elementFromPoint(cx + dx, cy + dy); if (t === h) { x0 = Math.min(x0, dx); x1 = Math.max(x1, dx); y0 = Math.min(y0, dy); y1 = Math.max(y1, dy); } }
        const w = x1 >= x0 ? x1 - x0 + 2 : 0, hh = y1 >= y0 ? y1 - y0 + 2 : 0; if (w < 44 || hh < 44) bad.push(`.wb-handle 命中区约 ${w}×${hh}`); }
      out.S6 = { ok: !bad.length, note: bad.length ? bad.slice(0, 5).join("；") + (bad.length > 5 ? `；…共${bad.length}个` : "") : `可点元素 ${n} 个都 ≥44×44` }; }
    // S8：触屏（应用自己的判据 !(hover:hover and pointer:fine)）下界面文字不出现键名/<kbd>；没有骨片时任何文案不出现「点…骨片」「K 刻字」「按 K」
    { const fine = matchMedia("(hover:hover) and (pointer:fine)").matches; const bad = [];
      const txt = [...document.querySelectorAll("body *")].filter((e) => inScope(e, root) && ownText(e) && rendered(e)).map((e) => [e, (e.innerText || "").replace(/\s+/g, " ").trim()]);
      if (!fine) { for (const [e, t] of txt) { const m = t.match(/Enter|Space|Esc\b|Backspace|按\s*K\b/); if (m) bad.push(`触屏下 ${name(e)}「${t.slice(0, 18)}」含键名「${m[0]}」`); }
        for (const k of document.querySelectorAll("kbd")) if (inScope(k, root) && rendered(k)) bad.push(`触屏下有 <kbd>「${snip(k)}」`); }
      const bc = document.querySelector("#bonecorner"); const boneOn = bc && !window.__qaLayout.visibleWhy(bc);
      if (!boneOn) for (const [e, t] of txt) { const m = t.match(/点[^。，；]{0,6}骨片|K\s*刻字|按\s*K\b/); if (m) bad.push(`骨片不在时 ${name(e)}「${t.slice(0, 18)}」提到「${m[0]}」`); }
      out.S8 = { ok: !bad.length, note: (fine ? "键鼠：不查键名；" : "触屏：") + (bad.slice(0, 4).join("；") + (bad.length > 4 ? `；…共${bad.length}处` : "") || (fine ? "骨片不在时无「点骨片/K 刻字/按 K」" : "无键名/<kbd>，骨片不在时无「点骨片/K 刻字/按 K」")) }; }
    return out;
  }
  window.__qaC = { checkC, contrastFromSamples, sample, checkS };
})();
