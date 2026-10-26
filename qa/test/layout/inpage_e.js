// 检查 E「核心交互元素在全部视口可见」（addInitScript 注入）。坐标一律 CSS px，视口坐标系（getBoundingClientRect）。
// 「可见」判据（全部满足才算可见，任何一条不满足 = 不可见）：
//   1 元素存在；2 宽、高都 > 0（getClientRects 非空）；3 自身及祖先都不是 display:none / [hidden]，
//   自身 computed visibility = visible，自身×祖先的有效 opacity ≥ 0.05（≈0 判不可见）；
//   4 整体落在可视视口内（visualViewport 矩形，容差 1px；没有 visualViewport 时用 innerWidth/innerHeight）；
//   5 没有被任何 overflow≠visible 的祖先裁掉（与每个裁切祖先的交集面积 ≥ 自身面积 99%）；
//   6 没有被别的元素盖住：在元素盒内取 5×3 网格（内缩 18%）共 15 点 elementFromPoint，
//     每个点命中的必须是元素自身或其后代；任何一点命中别的元素即判被遮挡（报告遮挡者）。
// 左右选项既接受源码选择器 #opt-left / #opt-right，也接受「文字等于/包含当前卡 left.label / right.label 的任何元素」
// （hotfix 可能换实现，例如手机卡外选项字行），只要其中一个候选满足全部 6 条即算可见。
(() => {
  const TOL = 1;
  const nm = (e) => !e ? "无" : (e.id ? "#" + e.id : e.tagName.toLowerCase() + (typeof e.className === "string" && e.className.trim() ? "." + e.className.trim().split(/\s+/).join(".") : ""));
  const R = (r) => [+r.left.toFixed(1), +r.top.toFixed(1), +r.right.toFixed(1), +r.bottom.toFixed(1)];
  const vpRect = () => { const v = window.visualViewport; return v ? { left: v.offsetLeft, top: v.offsetTop, right: v.offsetLeft + v.width, bottom: v.offsetTop + v.height, src: "visualViewport" } : { left: 0, top: 0, right: innerWidth, bottom: innerHeight, src: "inner" }; };
  function vis(e) {
    if (!e) return { ok: false, why: "元素不存在" };
    const r = e.getBoundingClientRect(); const box = R(r);
    const hid = e.closest("[hidden]"); if (hid) return { ok: false, why: `${hid === e ? "自身" : "祖先 " + nm(hid)} 带 hidden 属性`, box };
    for (let x = e; x && x.nodeType === 1; x = x.parentElement) if (getComputedStyle(x).display === "none") return { ok: false, why: `${x === e ? "自身" : "祖先 " + nm(x)} display:none`, box };
    if (!e.getClientRects().length || r.width <= 0 || r.height <= 0) return { ok: false, why: `宽高为 0（${r.width.toFixed(1)}×${r.height.toFixed(1)}）`, box };
    const cs = getComputedStyle(e); if (cs.visibility !== "visible") return { ok: false, why: `visibility:${cs.visibility}`, box };
    let op = 1; for (let x = e; x && x.nodeType === 1; x = x.parentElement) op *= +getComputedStyle(x).opacity;
    if (op < 0.05) return { ok: false, why: `有效 opacity ${op.toFixed(3)}≈0`, box };
    const vp = vpRect();
    if (r.left < vp.left - TOL || r.top < vp.top - TOL || r.right > vp.right + TOL || r.bottom > vp.bottom + TOL)
      return { ok: false, why: `不在视口内：盒 ${box.join("/")} ⊄ 视口 ${R(vp).join("/")}（${vp.src}）`, box };
    const area = r.width * r.height;
    for (let p = e.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const pc = getComputedStyle(p); if (pc.overflowX === "visible" && pc.overflowY === "visible") continue;
      const q = p.getBoundingClientRect();
      const L = pc.overflowX === "visible" ? r.left : Math.max(r.left, q.left), Rr = pc.overflowX === "visible" ? r.right : Math.min(r.right, q.right);
      const T = pc.overflowY === "visible" ? r.top : Math.max(r.top, q.top), Bt = pc.overflowY === "visible" ? r.bottom : Math.min(r.bottom, q.bottom);
      const inter = Math.max(0, Rr - L) * Math.max(0, Bt - T);
      if (inter < area * 0.99 && area - inter > TOL * Math.max(r.width, r.height)) return { ok: false, why: `被祖先 ${nm(p)}（overflow ${pc.overflowX}/${pc.overflowY}，盒 ${R(q).join("/")}）裁掉 ${(100 - inter / area * 100).toFixed(0)}%`, box };
    }
    // 元素自身 pointer-events:none 时 elementFromPoint 会穿透到祖先：采样期间临时把自身设成 auto，采完复原。
    // 瞬时横幅 #banner（1.8s 自动收起）命中时不算遮挡，命中会穿透到它下面继续判。
    const occ = new Map(); let n = 0; const pe0 = e.style.pointerEvents; const peOff = getComputedStyle(e).pointerEvents === "none"; if (peOff) e.style.pointerEvents = "auto";
    const TRANSIENT = "#banner";
    for (const fx of [0.18, 0.34, 0.5, 0.66, 0.82]) for (const fy of [0.18, 0.5, 0.82]) {
      const x = r.left + r.width * fx, y = r.top + r.height * fy; n++;
      let h = document.elementFromPoint(x, y);
      if (h && h.closest(TRANSIENT)) h = document.elementsFromPoint(x, y).find((z) => !z.closest(TRANSIENT)) || null;
      if (!h || !(h === e || e.contains(h))) { const k = nm(h); occ.set(k, (occ.get(k) || 0) + 1); }
    }
    if (peOff) e.style.pointerEvents = pe0;
    if (occ.size) return { ok: false, why: `被遮挡：15 点中 ${[...occ.values()].reduce((a, b) => a + b, 0)} 点命中 ${[...occ.entries()].map(([k, v]) => `${k}×${v}`).join("、")}`, box };
    return { ok: true, why: `可见 盒 ${box.join("/")}`, box };
  }
  const norm = (s) => String(s || "").replace(/[←→\s]/g, "");
  // 文字候选：直接文字节点（去掉箭头和空白后）包含 label、且 label 占该节点文字 ≥60% 的元素（排除卡面叙事正文/标题、
  // 教学气泡、toast、字录/日志等里偶然出现同词的情况）
  const NOT_OPT = "#card-text, #card-title, .card-head, #coach, #toast, #sidebar, #drawer, #banner, #goals-panel, #keyhelp-pop, #menu-pop";
  function textCands(label) {
    const L = norm(label); if (!L) return [];
    const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let t; (t = w.nextNode());) { const T = norm(t.textContent); const pe = t.parentElement;
      if (pe && T.includes(L) && L.length >= T.length * 0.6 && !pe.closest(NOT_OPT)) out.push(pe); }
    return [...new Set(out)];
  }
  function item(key, label, sels, extraText) {
    const cands = []; for (const s of sels) { const e = document.querySelector(s); if (e) cands.push(e); else cands.push(null); }
    if (extraText) for (const e of textCands(extraText)) if (!cands.includes(e)) cands.push(e);
    const res = cands.map((e, i) => ({ el: e ? nm(e) : sels[i], ...vis(e) }));
    const good = res.find((x) => x.ok);
    return { key, label, ok: !!good, pick: good || res[0], cands: res };
  }
  // need：本阶段必须可见的元素键。labels：当前卡左右 label（card 阶段）
  window.__qaE = {
    vis,
    check(need, labels) {
      const all = {
        left: () => item("left", "左选项", ["#opt-left"], labels && labels.left),
        right: () => item("right", "右选项", ["#opt-right"], labels && labels.right),
        wordbox: () => item("wordbox", "字匣", ["#wordbox-bar"]),
        bone: () => item("bone", "骨片", ["#bonecorner"]),
        menu: () => item("menu", "菜单入口", ["#menubtn"]),
        menupop: () => item("menupop", "菜单浮层", ["#menu-pop"]),
        // 扩展项（PM 四样之外，同属「看不到核心元素」）：四维资源条（选择的代价靠它看）、教学气泡（教学卡 T01–T05 的唯一操作说明）
        dims: () => item("dims", "资源条(扩展)", ["#dims", "#dims-desktop"]),
        coach: () => item("coach", "教学气泡(扩展)", ["#coach"]),
      };
      return need.map((k) => all[k]());
    },
    env() { const v = window.visualViewport; return { ua: navigator.userAgent, dpr: devicePixelRatio, inner: [innerWidth, innerHeight], vv: v ? [v.width, v.height, v.offsetLeft, v.offsetTop, v.scale] : null, client: [document.documentElement.clientWidth, document.documentElement.clientHeight], view: document.body.dataset.view, orient: document.body.dataset.orient, short: document.body.dataset.short || "", fine: matchMedia("(hover:hover) and (pointer:fine)").matches, coarse: matchMedia("(pointer:coarse)").matches }; },
  };
})();
