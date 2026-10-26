// 注入页面的两条检查（addInitScript）。坐标一律 CSS px（getBoundingClientRect，视口坐标系，原点=视口左上）。
(() => {
  const TOL = 1;
  // 文字框的「容器」：自下而上第一个命中的祖先；都不中则用视口。
  const CONTAINERS = ["#card-drops", "#card", ".card-e", "#coach", "#wordbox-bar", "#topbar", "#dimrow", "#stage",
    "#dlgbox", "#drawer-body", "#menu-pop", "#keyhelp-pop", "#sidebar", "#goals-panel", "#pick", "#winter", "#elder", "#endseq", "#savedlg"];
  const SKIP = ".float, script, style, noscript, template, svg *, option";
  const R = (r) => [+r.left.toFixed(1), +r.top.toFixed(1), +r.right.toFixed(1), +r.bottom.toFixed(1)];
  const name = (e) => e === null ? "视口" : (e.id ? "#" + e.id : e.tagName.toLowerCase() + (typeof e.className === "string" && e.className.trim() ? "." + e.className.trim().split(/\s+/).join(".") : ""));
  const snip = (e) => (e.innerText || e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 24);
  const effOpacity = (e) => { let o = 1; for (let x = e; x && x.nodeType === 1; x = x.parentElement) o *= +getComputedStyle(x).opacity; return o; };
  const rendered = (e) => {
    if (e.closest(SKIP) || e.closest("[hidden]")) return false;
    const r = e.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) return false;
    const cs = getComputedStyle(e); if (cs.visibility !== "visible" || cs.display === "none") return false;
    return effOpacity(e) >= 0.05;
  };
  const ownText = (e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  const hasBg = (e) => { const cs = getComputedStyle(e); const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/); const a = m ? (m[1].split(",")[3] ?? "1") : "0"; return +a > 0 || cs.backgroundImage !== "none"; };
  const paints = (h) => {
    if (h.closest(SKIP) && !/^(svg)$/i.test(h.tagName)) return false;
    const cs = getComputedStyle(h); if (cs.visibility !== "visible" || effOpacity(h) < 0.05) return false;
    if (/^(IMG|CANVAS|SVG|VIDEO|INPUT|TEXTAREA|PICTURE)$/i.test(h.tagName)) return true;
    if (hasBg(h) || ownText(h)) return true;
    return ["Top", "Right", "Bottom", "Left"].some((k) => parseFloat(cs["border" + k + "Width"]) > 0 && cs["border" + k + "Style"] !== "none");
  };
  const scrollable = (e) => { const cs = getComputedStyle(e); return /auto|scroll/.test(cs.overflowX + cs.overflowY); };
  // 容器规则：fixed 元素以视口为容器；absolute 元素若定位参照（offsetParent）在某容器之外，跳过该容器（设计上贴出去的，如桌面目标签）；
  // 宽或高为 0 的容器（收起的侧栏）不算框，继续往上找。
  const containerOf = (e) => {
    const pos = getComputedStyle(e).position; if (pos === "fixed") return null;
    const op = pos === "absolute" ? e.offsetParent : null;
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
      if (!CONTAINERS.some((s) => p.matches(s))) continue;
      const r = p.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
      if (op && op !== p && !p.contains(op)) continue;
      return p; }
    return null; };
  const scrollBetween = (e, c) => { for (let p = e.parentElement; p && p !== c && p !== document.body; p = p.parentElement) if (scrollable(p)) return true; return c && scrollable(c); };
  const vpRect = () => ({ left: 0, top: 0, right: innerWidth, bottom: innerHeight });
  // 当前顶层：全屏层（挑字/冬夜/先人/结局/存档/抽屉）显示时，只判这一层（及其上的 toast/横幅），被它整屏盖住的底层不判。
  const LAYERS = ["#savedlg", "#pick", "#winter", "#elder", "#endseq", "#drawer"];
  const ABOVE = "#toast, #banner, #sprout";
  const scopeRoot = () => { for (const s of LAYERS) { const e = document.querySelector(s); if (e && !e.hidden && e.getClientRects().length) return e; } return document.body; };
  const inScope = (e, root) => root === document.body || root.contains(e) || !!e.closest(ABOVE);
  const outBy = (r, c) => Math.max(c.left - r.left, c.top - r.top, r.right - c.right, r.bottom - c.bottom);

  // ① 文字框不出界：文字框 = 有自身文字节点的元素，或带背景且有文字的块（气泡/按钮/提示框）。
  function checkA() {
    const v = [], boxes = [], root = scopeRoot();
    for (const e of document.querySelectorAll("body *")) {
      if (!inScope(e, root) || !rendered(e)) continue;
      if (ownText(e) || (hasBg(e) && (e.innerText || "").trim())) boxes.push(e);
    }
    const contSet = new Set(CONTAINERS.flatMap((s) => [...document.querySelectorAll(s)]).filter((c) => inScope(c, root) && rendered(c)));
    for (const e of boxes) {
      const c = containerOf(e);
      if (scrollBetween(e, c)) continue;                       // 设计上可滚动的列表不判越界
      const r = e.getBoundingClientRect(), cr = c ? c.getBoundingClientRect() : vpRect(), d = outBy(r, cr);
      if (d > TOL) v.push({ kind: "越界", el: name(e), text: snip(e), box: R(r), cont: name(c), contBox: R(cr), by: +d.toFixed(1) });
    }
    // 容器本身也要在它的容器里（例：#card 必须在 #stage 里）
    for (const c of contSet) {
      const pc = containerOf(c), r = c.getBoundingClientRect(), cr = pc ? pc.getBoundingClientRect() : vpRect(), d = outBy(r, cr);
      if (pc && scrollBetween(c, pc)) continue;
      if (v.some((x) => x.el === name(c) && x.kind === "越界")) continue;   // 已作为文字框报过
      if (d > TOL) v.push({ kind: "容器越界", el: name(c), text: snip(c), box: R(r), cont: name(pc), contBox: R(cr), by: +d.toFixed(1) });
    }
    // scrollWidth/scrollHeight 溢出（overflow:auto/scroll 的除外）
    for (const e of new Set([...boxes, ...contSet])) {
      if (scrollable(e) || e.clientWidth === 0) continue;
      if (e.classList.contains("sr-only") && e.getBoundingClientRect().width <= 1.5 && e.getBoundingClientRect().height <= 1.5) continue;   // 读屏专用区（.sr-only 1px+clip，如 #toast-live）设计上不可见，溢出不算；只跳过真被缩成 ≤1.5px 的
      const lc = getComputedStyle(e).webkitLineClamp; if (lc && lc !== "none") continue;   // 设计上的行数截断（-webkit-line-clamp，FIX_SPEC I-04 迹文 2 行）不算溢出；438124f/e75a390 没用到
      const dx = e.scrollWidth - e.clientWidth, dy = e.scrollHeight - e.clientHeight;
      if (dx > TOL || dy > TOL) v.push({ kind: "内容溢出", el: name(e), text: snip(e), sw: e.scrollWidth, cw: e.clientWidth, sh: e.scrollHeight, ch: e.clientHeight, box: R(e.getBoundingClientRect()) });
    }
    return { n: boxes.length, v };
  }

  // 可见判定：尺寸>0、display/visibility/有效 opacity、在视口内、不被祖先 overflow 裁、elementFromPoint 中心+四角不被遮挡。
  function visibleWhy(e) {
    if (!e) return "不存在";
    if (e.closest("[hidden]")) return "hidden 属性";
    const cs = getComputedStyle(e), r = e.getBoundingClientRect();
    if (cs.display === "none" || e.getClientRects().length === 0) return "display:none（尺寸 0）";
    if (r.width <= 0 || r.height <= 0) return `尺寸 0 (${r.width}×${r.height})`;
    if (cs.visibility !== "visible") return "visibility:" + cs.visibility;
    const op = effOpacity(e); if (op < 0.05) return "有效 opacity=" + op.toFixed(2);
    const d = outBy(r, vpRect()); if (d > TOL) return `出视口 ${d.toFixed(1)}px 盒${JSON.stringify(R(r))}`;
    for (let p = e.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const pc = getComputedStyle(p); if (pc.overflowX === "visible" && pc.overflowY === "visible") continue;
      const pr = p.getBoundingClientRect(), dd = outBy(r, pr); if (dd > TOL) return `被祖先 ${name(p)} overflow 裁掉 ${dd.toFixed(1)}px`;
    }
    // 遮挡采样：临时让所有元素参与命中（pointer-events:none 的 toast/气泡也会盖住别人），用 elementsFromPoint 自上而下找：
    // 先碰到 e 或其后代 = 可见；先碰到「会画东西」的别的元素（有背景/边框/自身文字/图片画布，且有效 opacity≥0.05）= 被遮挡；透明包装层跳过。
    const st = document.createElement("style"); st.textContent = "*{pointer-events:auto !important}"; document.head.appendChild(st);
    const rad = parseFloat(cs.borderTopLeftRadius) || 0; const ix = Math.min(r.width / 4, Math.max(4, rad)), iy = Math.min(r.height / 4, Math.max(4, rad)); const bad = [];
    for (const [x, y, n] of [[(r.left + r.right) / 2, (r.top + r.bottom) / 2, "中心"], [r.left + ix, r.top + iy, "左上"], [r.right - ix, r.top + iy, "右上"], [r.left + ix, r.bottom - iy, "左下"], [r.right - ix, r.bottom - iy, "右下"]]) {
      let who = "空";
      for (const h of document.elementsFromPoint(x, y)) {
        if (h === e || e.contains(h)) { who = ""; break; }
        if (h.contains(e)) continue;
        if (!paints(h)) continue;
        who = name(h); break; }
      if (who) bad.push(`${n}被${who}`);
    }
    st.remove();
    if (bad.length) return "被遮挡：" + bad.join("、");
    return "";
  }

  // ② 提示所指元素可见。map: [{id, match, kind: pointer|keyboard|info, targets:[sel]}]
  const POINT = /点|拖|按住|长按|卡角|骨片|松手|上拉|下拉|滑|轻点|挑|落在|按 ?[A-Z←→]/;
  const NARRATIVE = "#card-title, #card-text, .card-head, #drawer-body, #sidebar-body, #dlgtext, #card-art, .optbtn";   // 叙述/选项标签不算提示
  function checkB(map) {
    const out = [], seen = new Set(), root = scopeRoot();
    for (const e of document.querySelectorAll("body *")) {
      if (!inScope(e, root)) continue;
      if (!ownText(e) || e.closest(NARRATIVE) || e.closest(SKIP)) continue;
      if (!rendered(e)) continue;
      const text = (e.innerText || "").replace(/\s+/g, " ").trim(); if (!POINT.test(text) || seen.has(text)) continue; seen.add(text);
      const ent = map.find((m) => new RegExp(m.match).test(text));
      const carrier = visibleWhy(e);
      if (!ent) { out.push({ ok: false, text, carrier: name(e), why: "未映射" + (carrier ? `；提示本身：${carrier}` : "") }); continue; }
      const why = [];
      if (carrier) why.push(`提示本身不可见：${carrier}`);
      if (ent.kind === "pointer") {
        const cands = ent.targets.flatMap((s) => [...document.querySelectorAll(s)]);
        if (!cands.length) why.push(`所指 ${ent.targets.join("|")} 不存在`);
        else { const res = cands.map((t) => [t, visibleWhy(t)]); if (!res.some(([, w]) => !w)) why.push(`所指 ${name(res[0][0])} ${res[0][1]} 盒${JSON.stringify(R(res[0][0].getBoundingClientRect()))}`); }
      }
      out.push({ ok: !why.length, id: ent.id, kind: ent.kind, text, carrier: name(e), why: why.join("；") });
    }
    return out;
  }
  window.__qaLayout = { checkA, checkB, visibleWhy, scope: () => name(scopeRoot()) };
})();
