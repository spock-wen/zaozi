// 测试独立验收矩阵 · 造字人 web f6f799e（QA 自写，不复用程序员 e2e 断言）
// 用法: node qa_matrix.mjs <engine> <port> <outdir>
import { chromium, firefox, webkit } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs"; import path from "node:path";
const [engine, PORT, OUT] = [process.argv[2], Number(process.argv[3]), process.argv[4]];
const HERE = path.dirname(new URL(import.meta.url).pathname);
const DIST = process.env.DIST, BASE_DIST = process.env.BASE_DIST;
const SEED = 20261012;
const GOALS = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(path.dirname(DIST), "data/goals.json"), "utf8")).pool.map((g) => [g.id, g.banner]));
const VPS = [
  { name: "390", width: 390, height: 844, touch: true, mobile: true },
  { name: "768", width: 768, height: 1024, touch: false },
  { name: "1024", width: 1024, height: 768, touch: false },
  { name: "1280", width: 1280, height: 800, touch: false },
  { name: "1440", width: 1440, height: 900, touch: false },
];
fs.mkdirSync(path.join(OUT, "shots"), { recursive: true });
const rows = [];
const rec = (block, item, vp, result, note = "", shot = "") => {
  rows.push({ block, item, engine, viewport: vp, result, note: String(note).replace(/[\n,]/g, " ").slice(0, 300), shot });
  console.log(`${result}\t${block}\t${item}\t${engine}\t${vp}\t${note}`);
};
function server(port, rootFile) {
  const p = spawn("python3", [path.join(HERE, "pages_server.py"), String(port), rootFile], { stdio: "ignore" });
  return p;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function shot(page, name) {
  const f = `shots/${engine}_${name}.png`;
  try { await page.screenshot({ path: path.join(OUT, f), fullPage: !(engine === "chromium" && page.viewportSize()?.width < 600), timeout: 15000 }); } catch (e) { return "shot-fail:" + e.message.slice(0, 60); }
  return f;
}
const T = { chromium, firefox, webkit }[engine];
const rootFile = path.join(OUT, `root_${engine}.txt`); fs.writeFileSync(rootFile, DIST);
const srv = server(PORT, rootFile); await sleep(800);
const ORIGIN = `http://localhost:${PORT}`;
const browser = await T.launch();
const phase = (p) => p.evaluate(() => window.__zz.st.phase);
const cur = (p) => p.evaluate(() => window.__zz.st.current);
async function commit(p, vp, dir) {
  if (vp.touch) {
    const sel = dir === "left" ? "#opt-left" : "#opt-right";
    if (await p.locator(sel).isVisible()) { await p.locator(sel).tap(); await p.waitForTimeout(560); return "tap"; }
    // 手机没有选项按钮时用触摸拖卡
    await touchDrag(p, dir); await p.waitForTimeout(560); return "swipe";
  }
  const k = dir === "left" ? "ArrowLeft" : "ArrowRight";
  await p.keyboard.press(k); await p.keyboard.press(k); await p.waitForTimeout(540); return "key";
}
async function touchDrag(p, dir) {
  const b = await p.locator("#card").boundingBox();
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2, dx = (dir === "left" ? -1 : 1) * b.width * 0.6;
  const cdp = engine === "chromium" ? await p.context().newCDPSession(p) : null;
  if (cdp) {
    const tp = (x, y) => [{ x, y, id: 1 }];
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: tp(cx, cy) });
    for (let i = 1; i <= 8; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: tp(cx + dx * i / 8, cy) });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else {
    await p.evaluate(({ cx, cy, dx }) => {
      const el = document.querySelector("#card");
      const mk = (t, x) => new PointerEvent(t, { bubbles: true, cancelable: true, clientX: x, clientY: cy, pointerType: "touch", pointerId: 7, isPrimary: true });
      el.dispatchEvent(mk("pointerdown", cx));
      for (let i = 1; i <= 8; i++) el.dispatchEvent(mk("pointermove", cx + dx * i / 8));
      el.dispatchEvent(mk("pointerup", cx + dx));
    }, { cx, cy, dx });
  }
}
const blocked = new Set();
async function tapOrClick(p, vp, sel) {
  try { if (vp.touch) await p.locator(sel).tap({ timeout: 4000 }); else await p.locator(sel).click({ timeout: 4000 }); return true; }
  catch (e) {
    const who = await p.evaluate((s) => { const el = document.querySelector(s); if (!el) return "无元素"; const r = el.getBoundingClientRect(); const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return t ? (t.id ? "#" + t.id : t.tagName) + (t.closest("[id]") ? " in #" + t.closest("[id]").id : "") : "null"; }, sel.replace(" >> nth=0", ""));
    const key = sel + "@" + vp.name;
    if (!blocked.has(key)) { blocked.add(key); rec("交互遮挡", `真点 ${sel} 失败`, vp.name, "FAIL", `被 ${who} 挡住/不可点；改用 el.click() 继续`, await shot(p, `${vp.name}_blocked_${sel.replace(/[^a-z0-9]/gi, "_")}`)); }
    await p.evaluate((s) => document.querySelector(s).click(), sel.replace(" >> nth=0", ""));
    return false;
  }
}
async function newCtx(vp, extra = {}) {
  const o = { viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.touch, ...extra };
  if (vp.mobile && engine !== "firefox") o.isMobile = true;
  return await browser.newContext(o);
}
async function boot(ctx, url = `/?seed=${SEED}`) {
  const page = await ctx.newPage(); const errs = []; const reqs = [];
  page.on("pageerror", (e) => errs.push("pageerror:" + e.message));
  page.on("console", (m) => { if (m.type() === "error") errs.push("console:" + m.text()); });
  page.on("request", (r) => reqs.push(r.url()));
  await page.goto(ORIGIN + url, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__zz, null, { timeout: 10000 });
  await page.evaluate(() => { window.__qaBanners = []; const b = document.querySelector("#banner"); if (b) new MutationObserver(() => { if (!b.hidden && b.textContent) window.__qaBanners.push(b.textContent); }).observe(b, { attributes: true, childList: true, characterData: true, subtree: true }); });
  return { page, errs, reqs };
}
async function clearTutorial(p, vp) {
  await commit(p, vp, "left"); await commit(p, vp, "right");
  await tapOrClick(p, vp, "#bonecorner"); await p.waitForTimeout(300);
  await tapOrClick(p, vp, "#wordbox .slot.ok >> nth=0"); await p.waitForTimeout(300);
  await commit(p, vp, "left");
}
async function playToWinter(p, vp) {
  const methods = new Set();
  for (let i = 0; i < 90; i++) {
    const ph = await phase(p);
    if (ph === "winter") return methods;
    if (ph === "engrave") { const s = p.locator("#card [data-do=skip]"); if (await s.isVisible()) await tapOrClick(p, vp, "#card [data-do=skip]"); else await p.keyboard.press("s"); await p.waitForTimeout(280); continue; }
    if (ph !== "card") return methods;
    methods.add(await commit(p, vp, i % 2 ? "right" : "left"));
  }
  return methods;
}
const wrap = async (block, item, vp, fn) => {
  try { await fn(); } catch (e) { rec(block, item, vp, "FAIL", "异常:" + e.message.split("\n")[0]); }
};

for (const vp of VPS.filter((v) => !process.env.ONLY_VP || v.name === process.env.ONLY_VP)) {
  const V = vp.name;
  // ---------- 主流程：整年通关 + D3/D4/D1/D2 + 卡图 + 同源 + 存档 ----------
  await wrap("上线清单", "整年通关", V, async () => {
    const ctx = await newCtx(vp); const { page, errs, reqs } = await boot(ctx);
    try {
      rec("基础", "首屏无白屏", V, (await page.locator("#card").isVisible()) ? "PASS" : "FAIL", "", await shot(page, `${V}_boot`));
      // D3/B1 菜单
      const mb = await page.locator("#menubtn").boundingBox();
      const vis = await page.locator("#menubtn").isVisible();
      const big = mb && mb.width >= 44 && mb.height >= 44;
      await tapOrClick(page, vp, "#menubtn"); await page.waitForTimeout(200);
      const open = await page.locator("#menu-pop").isVisible();
      const items = open ? await page.locator("#menu-pop").innerText() : "";
      rec("D3", "菜单可见可点(≥44px)", V, vis && big && open && /导出存档码/.test(items) && /字源与版权/.test(items) ? "PASS" : "FAIL", `vis=${vis} box=${mb && Math.round(mb.width)}x${mb && Math.round(mb.height)} open=${open}`, await shot(page, `${V}_menu`));
      await tapOrClick(page, vp, "#menubtn"); await page.waitForTimeout(150);
      // 教学 + D4 锁卡
      await commit(page, vp, "left"); await commit(page, vp, "right");
      if ((await cur(page)) !== "T03") throw new Error("未到 T03，当前 " + (await cur(page)));
      if (vp.touch) await touchDrag(page, "right"); else {
        const c = await page.locator("#card").boundingBox(); const cx = c.x + c.width / 2, cy = c.y + c.height / 2;
        await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + c.width * .5, cy, { steps: 6 }); await page.mouse.up();
      }
      await page.waitForTimeout(150);
      const tvis = await page.locator("#toast").isVisible(); const tt = tvis ? await page.locator("#toast").innerText() : "";
      const tb = await page.locator("#toast").boundingBox(), wb = await page.locator("#wordbox-bar").boundingBox();
      const noCover = tb && wb ? tb.y + tb.height <= wb.y + 2 : false;
      const s4 = await shot(page, `${V}_D4_locktoast`);
      rec("D4", "锁卡专属toast且不遮字匣", V, tvis && tt.includes("先点卡角骨片刻下这件事") && noCover && (await phase(page)) === "engrave" ? "PASS" : "FAIL", `toast="${tt}" noCover=${noCover}`, s4);
      await page.waitForTimeout(1900); // 等 toast 消失
      // W3 回归：刻字卡文案不得含 undefined
      const dropsTxt = await page.locator("#card-drops").innerText().catch(() => "");
      const sW3 = await shot(page, `${V}_W3_tally`);
      rec("W3", "刻字卡文案无 undefined（用 tally_text）", V, dropsTxt && !/undefined/.test(dropsTxt) && /迹/.test(dropsTxt) ? "PASS" : "FAIL", `drops="${dropsTxt.slice(0,80)}"`, sW3);
      // W2 回归：真点 #bonecorner 不被教学气泡挡住（尤其 1024）
      const hit = await page.evaluate(() => {
        const el = document.querySelector("#bonecorner");
        const r = el.getBoundingClientRect();
        const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { id: t && (t.id || t.tagName), pe: getComputedStyle(document.querySelector("#coachcol") || document.body).pointerEvents };
      });
      const beforeCur = await cur(page);
      const clickOk = await tapOrClick(page, vp, "#bonecorner"); await page.waitForTimeout(300);
      const afterPh = await phase(page); const afterCur = await cur(page);
      // tapOrClick 失败时会 el.click()，所以看 phase/cur 是否前进更准；1024 还要看 elementFromPoint
      const w2pass = afterCur !== beforeCur || afterPh !== "engrave";
      rec("W2", "真点#bonecorner不被教学气泡挡住", V, w2pass && (V !== "1024" || hit.id === "bonecorner" || hit.pe === "none") ? "PASS" : (w2pass ? "部分验证" : "FAIL"), `hit=${hit.id} coachPE=${hit.pe} clickOk=${clickOk} ${beforeCur}->${afterCur} ph=${afterPh}`, await shot(page, `${V}_W2_bonecorner`));
      if (!w2pass) { /* already advanced? */ }
      // 若 tapOrClick 已点过则不再点；上面已经点了
      if ((await phase(page)) === "engrave") { await tapOrClick(page, vp, "#bonecorner"); await page.waitForTimeout(300); }
      if (process.env.QA_DEBUG) console.log("DBG after 刻", await cur(page), await phase(page));
      await tapOrClick(page, vp, "#wordbox .slot.ok >> nth=0"); await page.waitForTimeout(300);
      await commit(page, vp, "left");
      // 卡图
      await page.waitForFunction(() => { const i = document.querySelector("#card-art img"); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 6000 });
      const art = await page.evaluate(() => { const i = document.querySelector("#card-art img"); const r = i.getBoundingClientRect(); return { src: i.currentSrc, nw: i.naturalWidth, nh: i.naturalHeight, w: r.width, h: r.height, fit: getComputedStyle(i).objectFit, pic: !!i.closest("picture"), srcset: [...document.querySelectorAll("#card-art source")].map(s => s.media + "|" + s.type + "|" + s.srcset).join(" ; "), dpr: devicePixelRatio, view: document.body.dataset.view }; });
      const wantM = vp.width < 1024; // 设计只有 手机/电脑 两套；<1024 走手机图（picture media=min-width:1024px）
      const okFile = new RegExp(`_${wantM ? "m" : "d"}@1x\\.webp$`).test(art.src);
      const okDim = wantM ? art.nw === 296 && art.nh === 216 : art.nw === 400 && art.nh === 292;
      const ratio = Math.abs(art.w / art.h - art.nw / art.nh) < 0.03 || art.fit === "contain";
      rec("卡图", "1x webp 选对源+尺寸+不裁切", V, art.pic && okFile && okDim && ratio ? "PASS" : "FAIL", `view=${art.view} src=${art.src.split("/").pop()} nat=${art.nw}x${art.nh} box=${Math.round(art.w)}x${Math.round(art.h)} fit=${art.fit}`, await shot(page, `${V}_cardart1x`));
      // 玩到冬夜
      const methods = await playToWinter(page, vp);
      if ((await phase(page)) !== "winter") throw new Error("没到冬夜，phase=" + (await phase(page)));
      const sW = await shot(page, `${V}_winter`);
      // 目标横幅文案 = goals.json banner
      await page.waitForTimeout(2500);
      const bn = await page.evaluate(() => ({ seen: [...new Set(window.__qaBanners)], ev: (window.__zz.st.goalEvents || []).map((e) => e.id) }));
      rec("目标横幅", "横幅文案=goals.json banner", V, bn.seen.length === 0 ? "N/A" : bn.seen.every((t) => Object.values(GOALS).includes(t)) ? "PASS" : "FAIL", `seen=${bn.seen.join("|")} ev=${bn.ev.join("|")}`);
      // D1：点天亮了不跳过结算
      if (vp.touch) await page.locator("#winter [data-do=end]").tap(); else await page.locator("#winter [data-do=end]").click();
      await page.waitForTimeout(80);
      const elderEarly = await page.locator("#elder").isVisible();
      await page.locator("#endseq").waitFor({ state: "visible", timeout: 12000 });
      const sE = await shot(page, `${V}_D1_endseq`);
      rec("D1", "天亮了不跳结算", V, !elderEarly && (await phase(page)) === "ended" ? "PASS" : "FAIL", `elderEarly=${elderEarly}`, sE);
      await tapOrClick(page, vp, "#endseq [data-do=elder]"); await page.locator("#elder").waitFor({ state: "visible" });
      const elderImg = await page.locator("#elder picture, #elder img").count();
      rec("卡图", "先人卡无图", V, elderImg === 0 ? "PASS" : "FAIL", `imgs=${elderImg}`, await shot(page, `${V}_elder`));
      await tapOrClick(page, vp, "#elder [data-do=heir]"); await page.locator("#pick").waitFor({ state: "visible" });
      // D2：pointer+click 双触发 / 真 tap 只选一次
      await page.evaluate(() => { const el = document.querySelector("#pick .cand[data-char='水']"); for (const t of ["pointerdown", "pointerup"]) el.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerType: "touch" })); el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); });
      await page.waitForTimeout(100);
      const p1 = await page.evaluate(() => window.__zz.st.picks.slice());
      await tapOrClick(page, vp, "#pick .cand[data-char='休']"); await page.waitForTimeout(100);
      const p2 = await page.evaluate(() => window.__zz.st.picks.slice());
      rec("D2", "触摸/pointer+click 只触发一次", V, JSON.stringify(p1) === '["水"]' && JSON.stringify(p2) === '["水","休"]' ? "PASS" : "FAIL", `after1=${p1} after2=${p2}`, await shot(page, `${V}_D2_pick`));
      await tapOrClick(page, vp, "#pick .cand[data-char='木']"); await page.waitForTimeout(80);
      await tapOrClick(page, vp, "#pick .go"); await page.waitForTimeout(450);
      const g = await page.evaluate(() => ({ gen: window.__zz.st.generation, ph: window.__zz.st.phase }));
      const yearOk = g.gen === 2 && g.ph === "card";
      rec("上线清单", vp.touch ? "整年通关(手机竖屏触屏)" : "整年通关(桌面/平板)", V, yearOk ? "PASS" : "FAIL", `gen=${g.gen} phase=${g.ph} 输入=${[...methods].join("/")}`, await shot(page, `${V}_gen2`));
      // 刷新存档保留
      const before = await page.evaluate(() => ({ n: window.__zz.actions.length, gen: window.__zz.st.generation, cur: window.__zz.st.current }));
      await page.reload({ waitUntil: "load" }); await page.waitForFunction(() => !!window.__zz);
      const after = await page.evaluate(() => ({ n: window.__zz.actions.length, gen: window.__zz.st.generation, cur: window.__zz.st.current }));
      rec("上线清单", "刷新存档保留", V, JSON.stringify(before) === JSON.stringify(after) && after.n > 0 ? "PASS" : "FAIL", `before=${JSON.stringify(before)} after=${JSON.stringify(after)}`, await shot(page, `${V}_reload`));
      // ZZ1 导出 → 另一 context 导入续玩（走 UI 菜单）
      await tapOrClick(page, vp, "#menubtn"); await page.waitForTimeout(150);
      await tapOrClick(page, vp, "#menu-pop [data-menu=export]"); await page.waitForTimeout(150);
      const code = await page.locator("#dlgtext").inputValue();
      const sx = await shot(page, `${V}_export`);
      await tapOrClick(page, vp, "#dlgclose");
      const ctx2 = await newCtx(vp); const b2 = await boot(ctx2, "/");
      await tapOrClick(b2.page, vp, "#menubtn"); await b2.page.waitForTimeout(150);
      await tapOrClick(b2.page, vp, "#menu-pop [data-menu=import]"); await b2.page.waitForTimeout(150);
      await b2.page.locator("#dlgtext").fill(code); await tapOrClick(b2.page, vp, "#dlgapply"); await b2.page.waitForTimeout(400);
      const imp = await b2.page.evaluate(() => ({ n: window.__zz.actions.length, gen: window.__zz.st.generation, cur: window.__zz.st.current, seed: window.__zz.seed }));
      const n0 = imp.n; await commit(b2.page, vp, "left"); await b2.page.waitForTimeout(200);
      const n1 = await b2.page.evaluate(() => window.__zz.actions.length);
      rec("上线清单", "ZZ1导出→另一context导入续玩", V, code.startsWith("ZZ1") && imp.n === after.n && imp.gen === after.gen && imp.cur === after.cur && n1 > n0 ? "PASS" : "FAIL", `code=${code.slice(0, 12)}… len=${code.length} imp=${JSON.stringify(imp)} 续玩actions ${n0}->${n1}`, sx + " ; " + (await shot(b2.page, `${V}_import_continue`)));
      await ctx2.close();
      // 同源
      const foreign = [...new Set(reqs.filter((u) => !u.startsWith(ORIGIN) && !u.startsWith("data:") && !u.startsWith("blob:")))];
      rec("上线清单", "所有资源同源", V, foreign.length === 0 ? "PASS" : "FAIL", foreign.length ? foreign.slice(0, 3).join(" ") : `${reqs.length} 请求全同源`);
      // 占位/内部术语
      const txt = await page.evaluate(() => document.body.innerText);
      rec("决策5", "无「占位」文案", V, /占位/.test(txt) ? "FAIL" : "PASS");
      const real = errs.filter((e) => !/setPointerCapture|object can not be found here/.test(e));
      rec("基础", "全程无页面报错", V, real.length === 0 ? "PASS" : "FAIL", (real.length ? real.slice(0, 3).join(" | ") : "") + (errs.length - real.length ? ` (另有 ${errs.length - real.length} 条为测试合成 pointerId 触发的 setPointerCapture 报错，已排除)` : ""));
    } finally { await ctx.close(); }
  });

  // ---------- 卡图 2x ----------
  await wrap("卡图", "2x webp", V, async () => {
    const ctx = await newCtx(vp, { deviceScaleFactor: 2 }); const { page } = await boot(ctx);
    try {
      await page.evaluate(() => { for (const a of [["left"], ["right"]]) ; });
      await clearTutorial(page, vp);
      await page.waitForFunction(() => { const i = document.querySelector("#card-art img"); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 6000 });
      const a = await page.evaluate(async () => { const i = document.querySelector("#card-art img"); const bm = await createImageBitmap(await (await fetch(i.currentSrc)).blob()); return { src: i.currentSrc, nw: bm.width, nh: bm.height, view: document.body.dataset.view }; });
      const m = vp.width < 1024;
      const ok = new RegExp(`_${m ? "m" : "d"}@2x\\.webp$`).test(a.src) && (m ? a.nw === 592 && a.nh === 432 : a.nw === 800 && a.nh === 584);
      rec("卡图", "2x webp 选对源+尺寸", V, ok ? "PASS" : "FAIL", `view=${a.view} src=${a.src.split("/").pop()} nat=${a.nw}x${a.nh}`, await shot(page, `${V}_cardart2x`));
    } finally { await ctx.close(); }
  });

  // ---------- P1 字源页 + Sears ----------
  await wrap("P1", "字源页", V, async () => {
    const ctx = await newCtx(vp); const { page } = await boot(ctx);
    try {
      await tapOrClick(page, vp, "#menubtn"); await page.waitForTimeout(150);
      const navP = page.waitForNavigation({ waitUntil: "load", timeout: 5000 }).then(() => true).catch(() => false);
      if (vp.touch) await page.locator("#menu-pop a[href*=credits]").tap(); else await page.locator("#menu-pop a[href*=credits]").click();
      const navd = await navP; const shm = await shot(page, `${V}_credits_menulink`);
      rec("上线清单", "菜单「字源与版权」链接可进入字源页", V, navd && /\/credits/.test(page.url()) ? "PASS" : "FAIL", `点后 url=${page.url().replace(ORIGIN, "")} 导航=${navd}`, shm);
      await page.goto(ORIGIN + "/credits", { waitUntil: "load" });
      const t = await page.evaluate(() => document.body.innerText); const isGame = await page.locator("#card").count();
      const sh = await shot(page, `${V}_credits`);
      rec("P1", "/credits 是字源页不被游戏页替换", V, /字源与版权/.test(t) && isGame === 0 ? "PASS" : "FAIL", `url=${page.url().replace(ORIGIN, "")} game=${isGame}`, sh);
      rec("字源页", "Sears 致谢+ACClicense", V, /Richard Sears/.test(t) && /ACClicense s07887/.test(t) && /© 2003/.test(t) ? "PASS" : "FAIL", "", sh);
      await page.goto(ORIGIN + "/credits.html", { waitUntil: "load" });
      rec("P1", "/credits.html 308 后仍是字源页", V, page.url().endsWith("/credits") && (await page.locator("#card").count()) === 0 && /字源与版权/.test(await page.evaluate(() => document.body.innerText)) ? "PASS" : "FAIL", page.url().replace(ORIGIN, ""));
    } finally { await ctx.close(); }
  });

  // ---------- 离线 PWA + 对照组 + P0 ----------
  await wrap("上线清单", "离线PWA", V, async () => {
    const ctx = await newCtx(vp); const { page } = await boot(ctx);
    try {
      await page.evaluate(async () => { await navigator.serviceWorker.ready; });
      await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {});
      await page.reload({ waitUntil: "load" }); await page.waitForFunction(() => !!window.__zz);
      const ctrl = await page.evaluate(() => !!navigator.serviceWorker.controller);
      // P0：在线时 /index.html（308）在 SW 下不白屏
      await page.goto(ORIGIN + "/index.html?seed=1", { waitUntil: "load" }); await page.waitForTimeout(300);
      const p0 = await page.locator("#card").isVisible().catch(() => false);
      rec("P0", "SW控制下 /index.html(308) 不白屏", V, ctrl && p0 ? "PASS" : "FAIL", `controller=${ctrl}`, await shot(page, `${V}_P0_indexhtml`));
      await ctx.setOffline(true);
      const res = {};
      for (const u of ["/", "/?seed=5", "/index.html", "/credits", "/credits.html"]) {
        try { await page.goto(ORIGIN + u, { waitUntil: "load", timeout: 10000 }); await page.waitForTimeout(300);
          res[u] = u.includes("credits") ? /字源与版权/.test(await page.evaluate(() => document.body.innerText)) : await page.locator("#card").isVisible();
        } catch (e) { res[u] = "ERR:" + e.message.split("\n")[0].slice(0, 50); }
        if (u === "/") var offShot = await shot(page, `${V}_offline_root`);
      }
      // 离线还能玩一步
      await page.goto(ORIGIN + "/", { waitUntil: "load" }).catch(() => {});
      let playable = false;
      try { await page.waitForFunction(() => !!window.__zz, null, { timeout: 5000 }); const n0 = await page.evaluate(() => window.__zz.actions.length); await commit(page, vp, "left"); playable = (await page.evaluate(() => window.__zz.actions.length)) > n0; } catch {}
      const coreOk = res["/"] === true && res["/credits"] === true && playable;
      rec("上线清单", "离线可开(/ 与 /credits)且可玩", V, coreOk ? "PASS" : "FAIL", JSON.stringify(res) + ` playable=${playable}`, offShot);
      rec("上线清单", "离线 /index.html 与 /credits.html(PWA start_url)", V, res["/index.html"] === true && res["/credits.html"] === true ? "PASS" : "FAIL", JSON.stringify({ i: res["/index.html"], c: res["/credits.html"] }));
    } finally { await ctx.close(); }
    // 对照组：屏蔽 SW
    const c2 = await newCtx(vp, { serviceWorkers: "block" }); await c2.route("**/*", (r) => r.continue()); const b = await boot(c2);
    try {
      await c2.setOffline(true); let failed = false;
      try { await b.page.reload({ waitUntil: "load", timeout: 8000 }); failed = !(await b.page.locator("#card").isVisible().catch(() => false)); } catch { failed = true; }
      rec("上线清单", "对照组(屏蔽SW)离线打不开", V, failed ? "PASS" : "FAIL", failed ? "对照组如预期失败，证明离线来自SW" : "屏蔽SW仍能离线打开→离线结论无效");
    } finally { await c2.close(); }
  });
}

// ---------- P2：从线上旧版 SW(7dc14fa baseline) 升级到新版 ----------
if (!process.env.ONLY_VP) await (async () => {
  const port2 = PORT + 50; const rf = path.join(OUT, `root2_${engine}.txt`); fs.writeFileSync(rf, BASE_DIST);
  const s2 = server(port2, rf); await sleep(800); const O2 = `http://localhost:${port2}`;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(e.message));
    await page.goto(O2 + "/", { waitUntil: "load" });
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.waitForTimeout(800); await page.reload({ waitUntil: "load" });
    const oldV = await page.evaluate(async () => (await caches.keys()).join(","));
    fs.writeFileSync(rf, DIST);   // 部署新版
    const opens = [];
    for (let i = 1; i <= 4; i++) {
      try { await page.goto(O2 + "/", { waitUntil: "load", timeout: 10000 }); await page.waitForTimeout(1200);
        const ok = (await page.evaluate(() => document.body.innerText.trim().length)) > 20; const newUI = await page.locator("#menubtn").isVisible().catch(() => false); const ver = await page.evaluate(async () => (await caches.keys()).join(","));
        opens.push(`#${i}:${ok ? (newUI ? "OK新版" : "OK旧版") : "WHITE"}[${ver}]`); if (i === 1) var sh1 = await shot(page, `P2_upgrade_open1`); if (i === 4) var sh4 = await shot(page, `P2_upgrade_open4`);
      } catch (e) { opens.push(`#${i}:ERR`); }
    }
    const allOk = opens.every((o) => o.includes("OK")) && opens[3].includes("OK新版"); const lastOk = opens[3]?.includes("OK新版");
    rec("P2", "线上7dc14fa SW→新版升级 每次打开都不白屏", "1280", allOk ? "PASS" : lastOk ? "部分验证" : "FAIL", `old=${oldV} ${opens.join(" ")}`, `${sh1} ; ${sh4}`);
  } catch (e) { rec("P2", "线上7dc14fa SW→新版升级", "1280", "FAIL", "异常:" + e.message.split("\n")[0]); }
  finally { await ctx.close(); s2.kill(); }
  // P2b：模拟 9d0bdec 型坏 SW（缓存了带 redirected 的 /index.html 并直接回给导航）—— context.route 注入
  const port3 = PORT + 60; const rf3 = path.join(OUT, `root3_${engine}.txt`); fs.writeFileSync(rf3, DIST);
  const s3 = server(port3, rf3); await sleep(800); const O3 = `http://localhost:${port3}`;
  const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    let legacy = true;
    const LEGACY = `const C="zaozi-year1-9d0bdecLEGACY";self.addEventListener("install",e=>e.waitUntil(caches.open(C).then(c=>c.addAll(["./index.html","./app.js","./style.css"])).then(()=>self.skipWaiting())));self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));self.addEventListener("fetch",e=>{if(e.request.mode==="navigate"){e.respondWith(caches.match("./index.html").then(r=>r||fetch(e.request)));}});`;
    await ctx3.route("**/sw.js", async (route) => { if (legacy) return route.fulfill({ status: 200, contentType: "text/javascript", headers: { "cache-control": "no-cache" }, body: LEGACY }); return route.continue(); });
    const page = await ctx3.newPage();
    await page.goto(O3 + "/", { waitUntil: "load" }); await page.evaluate(async () => { await navigator.serviceWorker.ready; }); await page.waitForTimeout(800);
    const legacyOpen = await page.goto(O3 + "/", { waitUntil: "load", timeout: 8000 }).then(async () => (await page.locator("#card").isVisible()) ? "OK" : "WHITE").catch((e) => "ERR");
    legacy = false;
    const opens = [];
    for (let i = 1; i <= 8; i++) {
      const r = await page.goto(O3 + "/", { waitUntil: "load", timeout: 8000 }).then(async () => { await page.waitForTimeout(1200); return (await page.locator("#card").isVisible()) ? "OK" : "WHITE"; }).catch(() => "ERR");
      opens.push(`#${i}:${r}`);
    }
    const sh = await shot(page, `P2b_legacy_upgrade_after`);
    const ver = await page.evaluate(async () => (await caches.keys()).join(",")).catch(() => "?");
    const res = opens.every((o) => o.endsWith("OK")) ? "PASS" : opens[7].endsWith("OK") ? "部分验证" : "FAIL";
    rec("P2", "模拟9d0bdec坏SW(route注入)→新版 恢复", "1280", res, `坏SW下打开=${legacyOpen} 升级后 ${opens.join(" ")} caches=${ver}`, sh);
  } catch (e) { rec("P2", "模拟9d0bdec坏SW→新版", "1280", "FAIL", "异常:" + e.message.split("\n")[0]); }
  finally { await ctx3.close(); s3.kill(); }
})();

// ---------- 11 条决策（桌面 1280 + 手机 390 抽样，每引擎） ----------
if (!process.env.ONLY_VP) await (async () => {
  const vp = VPS[3];
  const ctx = await newCtx(vp); const { page } = await boot(ctx);
  try {
    // 决定1：资源条/四维为 DOM
    const dom = await page.evaluate(() => { const d = document.querySelector("#dims-desktop") || document.querySelector("#dims"); return d && d.children.length > 0 && !d.querySelector("canvas"); });
    rec("决策1", "资源条为DOM(无canvas)", "1280", dom ? "PASS" : "FAIL", "", await shot(page, `D1280_decision1`));
    // 决定3：单按 ← 只预览不提交；再按提交；Enter 不刻
    const n0 = await page.evaluate(() => window.__zz.actions.length);
    await page.keyboard.press("ArrowLeft"); await page.waitForTimeout(250);
    const n1 = await page.evaluate(() => window.__zz.actions.length); const sPrev = await shot(page, `D1280_decision3_preview`);
    await page.keyboard.press("ArrowLeft"); await page.waitForTimeout(600);
    const n2 = await page.evaluate(() => window.__zz.actions.length);
    rec("决策3", "←预览、再←提交", "1280", n1 === n0 && n2 === n0 + 1 ? "PASS" : "FAIL", `${n0}->${n1}->${n2}`, sPrev);
    await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight"); await page.waitForTimeout(600); // → T03 engrave
    const phE = await phase(page);
    await page.keyboard.press("Enter"); await page.waitForTimeout(300);
    const afterEnter = await phase(page);
    await page.keyboard.press("k"); await page.waitForTimeout(300);
    const afterK = await page.evaluate(() => ({ ph: window.__zz.st.phase, cur: window.__zz.st.current }));
    rec("决策3", "Enter≠刻，K=刻", "1280", phE === "engrave" && afterEnter === "engrave" && afterK.cur === "T04" ? "PASS" : "FAIL", `engrave→Enter:${afterEnter}→K:${JSON.stringify(afterK)}`, await shot(page, `D1280_decision3_K`));
    // 决定4：每代小目标
    const goals = await page.evaluate(() => window.__zz.st.goals || []);
    rec("决策4", "每代小目标(第1代无G_ENGRAVE1)", "1280", goals.length > 0 && !JSON.stringify(goals).includes("G_ENGRAVE1") ? "PASS" : "FAIL", JSON.stringify(goals).slice(0, 120));
    // 决定6：静音开关存 localStorage，一次点击只切一次
    const m0 = await page.evaluate(() => window.__zz.isMuted());
    await page.locator("#menubtn").click(); await page.locator("#menu-pop [data-menu=mute]").click(); await page.waitForTimeout(150);
    const m1 = await page.evaluate(() => window.__zz.isMuted()); await page.reload(); await page.waitForFunction(() => !!window.__zz);
    const m2 = await page.evaluate(() => window.__zz.isMuted());
    rec("决策6", "静音单次切换+localStorage持久", "1280", m1 === !m0 && m2 === m1 ? "PASS" : "FAIL", `${m0}->${m1}->reload ${m2}`);
    // 决定11：侧栏开合持久（1280）
    const tab = page.locator("#sidebar-tab");
    if (await tab.isVisible()) {
      const c0 = await page.evaluate(() => document.querySelector("#sidebar").classList.contains("collapsed"));
      await tab.click(); await page.reload(); await page.waitForFunction(() => !!window.__zz);
      const c1 = await page.evaluate(() => document.querySelector("#sidebar").classList.contains("collapsed"));
      rec("决策11", "侧栏开合存 localStorage", "1280", c1 === !c0 ? "PASS" : "FAIL", `${c0}->${c1}`, await shot(page, `D1280_decision11_sidebar`));
    } else rec("决策11", "侧栏开合存 localStorage", "1280", "FAIL", "1280 无侧栏开合键");
  } catch (e) { rec("决策", "桌面决策组", "1280", "FAIL", "异常:" + e.message.split("\n")[0]); }
  finally { await ctx.close(); }
  // 决定11：1024 强制收起侧栏；手机横屏提示
  for (const [w, h, check] of [[1024, 768, "c1024"], [568, 320, "rot"]]) {
    const c = await browser.newContext({ viewport: { width: w, height: h } }); const { page } = await boot(c);
    try {
      if (check === "c1024") { const col = await page.evaluate(() => { const s = document.querySelector("#sidebar"); return !s || s.classList.contains("collapsed") || getComputedStyle(s).display === "none"; }); rec("决策11", "~1024 侧栏收起", "1024", col ? "PASS" : "FAIL", "", await shot(page, `D1024_decision11`)); }
      else rec("决策11", "手机横屏提示转竖屏", "568x320", (await page.locator("#rotate-hint").isVisible()) ? "PASS" : "FAIL", "", await shot(page, `D568_rotate`));
    } finally { await c.close(); }
  }
  // 决定10：reduced motion
  const c = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" }); const { page: rp } = await boot(c);
  try {
    const dur = await rp.evaluate(() => { const el = document.querySelector("#card"); const cs = getComputedStyle(el); return cs.transitionDuration + "|" + cs.animationDuration + "|" + document.body.className + "|" + document.documentElement.className; });
    const t0 = Date.now(); await rp.keyboard.press("ArrowLeft"); await rp.keyboard.press("ArrowLeft"); await rp.waitForTimeout(250); const n = await rp.evaluate(() => window.__zz.actions.length);
    rec("决策10", "prefers-reduced-motion 生效(≤250ms 内提交完成)", "1280", n === 1 ? "PASS" : "部分验证", `computed=${dur} actions=${n}`);
  } finally { await c.close(); }
  // 决定8/9：挑字无事签占位格 + 键位（走到挑字）
  const c9 = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const b9 = await boot(c9);
  try {
    const p = b9.page; await clearTutorial(p, VPS[3]); await playToWinter(p, VPS[3]);
    await p.locator("#winter [data-do=end]").click(); await p.locator("#endseq").waitFor({ state: "visible", timeout: 12000 });
    await p.locator("#endseq [data-do=elder]").click(); await p.locator("#elder [data-do=heir]").click(); await p.locator("#pick").waitFor({ state: "visible" });
    const pickTxt = await p.locator("#pick").innerText(); const cands = await p.locator("#pick .cand").evaluateAll((a) => a.map((x) => x.dataset.char).join(""));
    rec("决策8", "挑字界面无事签占位格", "1280", !/事签|占位/.test(pickTxt) ? "PASS" : "FAIL", "", await shot(p, `D1280_decision8_pick`));
    rec("决策(A17)", "挑字14字池", "1280", [...cands].sort().join("") === [..."水日人木田火力月休林从男明本"].sort().join("") ? "PASS" : "FAIL", cands);
    // 键位：方向键移动 + 空格/Enter 选
    await p.keyboard.press("ArrowRight"); await p.keyboard.press(" "); await p.waitForTimeout(120);
    const k1 = await p.evaluate(() => window.__zz.st.picks.length);
    await p.keyboard.press("ArrowRight"); await p.keyboard.press("Enter"); await p.waitForTimeout(120);
    const k2 = await p.evaluate(() => window.__zz.st.picks.length);
    rec("决策9", "挑字键盘可选字", "1280", k1 >= 1 || k2 >= 1 ? "PASS" : "FAIL", `space后${k1} enter后${k2}`, await shot(p, `D1280_decision9_keys`));
  } catch (e) { rec("决策8/9", "挑字", "1280", "FAIL", "异常:" + e.message.split("\n")[0]); }
  finally { await c9.close(); }
})();

// ---------- 目标横幅 + G_ENGRAVE1/G_FOOD_65/G_OUT_65（正常玩法优先，debug 辅证） ----------
if (!process.env.ONLY_VP) await (async () => {
  const hit = {};
  // 1) 第 1 代多种子扫（落/记/信）
  for (let k = 0; k < 24 && Object.keys(hit).length < 3; k++) {
    const c = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const { page } = await boot(c, `/?seed=${1000 + k * 37}`);
    try {
      await clearTutorial(page, VPS[3]);
      for (let i = 0; i < 90; i++) { const ph = await phase(page); if (ph === "winter") break; if (ph === "engrave") { await page.keyboard.press(k % 2 ? "k" : "s"); await page.waitForTimeout(260); continue; } if (ph !== "card") break;
        const d = ((k * 7 + i * 3) % 5) < 2 + (k % 2) ? "left" : "right"; await page.keyboard.press(d === "left" ? "ArrowLeft" : "ArrowRight"); await page.keyboard.press(d === "left" ? "ArrowLeft" : "ArrowRight"); await page.waitForTimeout(520);
        if (i % 4 === 0) { const s = page.locator("#wordbox .slot.ok").first(); if (await s.isVisible().catch(() => false)) await s.click({ timeout: 1500 }).catch(() => {}); } }
      if ((await phase(page)) === "winter") { await page.locator("#winter [data-do=end]").click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(4000); }
      const r = await page.evaluate(() => ({ seen: window.__qaBanners.slice(), ev: (window.__zz.st.goalEvents || []).map((e) => e.id) }));
      for (const id of r.ev) { const want = GOALS[id]; const ok = r.seen.includes(want); if (!hit[id] || !ok) hit[id] = { ok, seed: 1000 + k * 37, seen: r.seen.join("|"), shot: hit[id]?.shot || (await shot(page, `banner_${id}`)), how: "gen1-scan" }; }
    } catch {} finally { await c.close(); }
  }

  // 2) G_ENGRAVE1：seed=0 正常玩到第 2 代，应抽到；再导入达成存档码核横幅
  {
    const c = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const { page } = await boot(c, "/?seed=0");
    try {
      await clearTutorial(page, VPS[3]);
      // 玩完第 1 代
      for (let i = 0; i < 120; i++) {
        const ph = await phase(page); const g = await page.evaluate(() => window.__zz.st.generation);
        if (g >= 2 && ph === "card") break;
        if (ph === "engrave") { await page.keyboard.press("s"); await page.waitForTimeout(260); continue; }
        if (ph === "card") { await page.keyboard.press("ArrowLeft"); await page.keyboard.press("ArrowLeft"); await page.waitForTimeout(520); continue; }
        if (ph === "winter") { await page.locator("#winter [data-do=end]").click(); await page.waitForTimeout(400); continue; }
        if (ph === "ended") {
          if (await page.locator("#endseq [data-do=elder]").isVisible().catch(()=>false)) await page.locator("#endseq [data-do=elder]").click();
          else if (await page.locator("#elder [data-do=heir]").isVisible().catch(()=>false)) await page.locator("#elder [data-do=heir]").click();
          await page.waitForTimeout(300); continue;
        }
        if (ph === "pick" || await page.locator("#pick").isVisible().catch(()=>false)) {
          for (const ch of ["水","火","日"]) {
            const sel = `#pick .cand[data-char='${ch}']`;
            if (await page.locator(sel).isVisible().catch(()=>false)) await page.locator(sel).click().catch(()=>{});
          }
          if (await page.locator("#pick .go").isEnabled().catch(()=>false)) await page.locator("#pick .go").click().catch(()=>{});
          await page.waitForTimeout(450); continue;
        }
        break;
      }
      const g2 = await page.evaluate(() => ({ gen: window.__zz.st.generation, goals: (window.__zz.st.goals||[]).map(x=>x.id||x), ph: window.__zz.st.phase }));
      const drawn = JSON.stringify(g2.goals).includes("G_ENGRAVE1");
      rec("G_ENGRAVE1", "seed0 第2代抽到 G_ENGRAVE1（正常玩法）", "1280", g2.gen === 2 && drawn ? "PASS" : "FAIL", JSON.stringify(g2), await shot(page, `G_ENGRAVE1_gen2_pool`));
    } catch (e) { rec("G_ENGRAVE1", "seed0 第2代抽到", "1280", "FAIL", "异常:"+e.message.split("\n")[0]); }
    finally { await c.close(); }
  }

  // 3) 用 GOAL_REACHABILITY 存档码导入：核横幅文案（正常玩法路径的复现）
  async function importAndCheck(gid, codePath) {
    const code = fs.readFileSync(codePath, "utf8").trim();
    const c = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const { page } = await boot(c, "/");
    try {
      await page.locator("#menubtn").click(); await page.waitForTimeout(120);
      await page.locator("#menu-pop [data-menu=import]").click(); await page.waitForTimeout(120);
      await page.locator("#dlgtext").fill(code);
      await page.locator("#dlgapply").click(); await page.waitForTimeout(600);
      // 触发横幅：若已达成应在 goalEvents；再辅以 debug 打开同目标确认 banner 字符串
      const ev = await page.evaluate(() => ({ gen: window.__zz.st.generation, goals: (window.__zz.st.goals||[]).map(x=>x.id||x), events: (window.__zz.st.goalEvents||[]).map(e=>({id:e.id,banner:e.banner})), seen: window.__qaBanners.slice(), body: document.body.innerText.slice(0,200) }));
      const want = GOALS[gid];
      let ok = ev.events.some(e => e.id === gid) || ev.seen.includes(want) || JSON.stringify(ev.goals).includes(gid);
      // 若导入后已过达成点，横幅可能已消失；用 debug_goal 辅证 banner DOM 文案
      let aux = "";
      if (!ev.seen.includes(want)) {
        const c2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
        const b2 = await boot(c2, `/?debug=1&debug_goal=${gid}&seed=0`);
        try {
          await clearTutorial(b2.page, VPS[3]);
          // 立刻刻一事触发 G_ENGRAVE1；或玩到代末
          for (let i = 0; i < 40; i++) {
            const ph = await phase(b2.page);
            if (ph === "engrave" && gid === "G_ENGRAVE1") { await b2.page.keyboard.press("k"); await b2.page.waitForTimeout(400); break; }
            if (ph === "engrave") { await b2.page.keyboard.press("s"); await b2.page.waitForTimeout(260); continue; }
            if (ph === "winter") { await b2.page.locator("#winter [data-do=end]").click(); await b2.page.waitForTimeout(3500); break; }
            if (ph === "card") { await b2.page.keyboard.press("ArrowLeft"); await b2.page.keyboard.press("ArrowLeft"); await b2.page.waitForTimeout(500); continue; }
            break;
          }
          await b2.page.waitForTimeout(1500);
          const r2 = await b2.page.evaluate(() => ({ seen: window.__qaBanners.slice(), ev: (window.__zz.st.goalEvents||[]).map(e=>e.id) }));
          aux = `debug_aux seen=${r2.seen.join("|")} ev=${r2.ev.join("|")}`;
          if (r2.seen.includes(want)) { ok = true; hit[gid] = { ok: true, seed: "debug:"+gid, seen: r2.seen.join("|"), shot: await shot(b2.page, `banner_${gid}_debug`), how: "debug_goal" }; }
        } finally { await c2.close(); }
      } else {
        hit[gid] = { ok: true, seed: "import", seen: ev.seen.join("|"), shot: await shot(page, `banner_${gid}_import`), how: "import-zz1" };
      }
      if (ev.events.some(e => e.id === gid) && !hit[gid]) {
        hit[gid] = { ok: true, seed: "import-events", seen: ev.seen.join("|") || "events-only", shot: await shot(page, `banner_${gid}_import`), how: "import-events" };
        ok = true;
      }
      rec("目标横幅", `${gid} 存档码导入/可达`, "1280", ok ? "PASS" : "FAIL", `import goals=${JSON.stringify(ev.goals)} events=${JSON.stringify(ev.events)} seen=${ev.seen.join("|")} ${aux}`, await shot(page, `import_${gid}`));
      // 横幅文案精确对照
      if (hit[gid]) rec("目标横幅", `${gid} 横幅=「${want}」`, "1280", hit[gid].ok ? "PASS" : "FAIL", `how=${hit[gid].how} seen=${hit[gid].seen}`, hit[gid].shot || "");
    } catch (e) { rec("目标横幅", `${gid} 存档码导入`, "1280", "FAIL", "异常:"+e.message.split("\n")[0]); }
    finally { await c.close(); }
  }
  await importAndCheck("G_ENGRAVE1", path.join(HERE, "G_ENGRAVE1.zz1"));
  await importAndCheck("G_FOOD_65", path.join(HERE, "G_FOOD_65.zz1"));
  await importAndCheck("G_OUT_65", path.join(HERE, "G_OUT_65.zz1"));

  // 汇总：gen1 扫到的也记
  for (const id of ["G_DROP1", "G_MEM_70", "G_FAITH_65"]) {
    const want = GOALS[id]; const h = hit[id];
    rec("目标横幅", `${id} 横幅=「${want}」`, "1280", !h ? "BLOCKED" : h.ok ? "PASS" : "FAIL", !h ? "24种子未触发" : `how=${h.how||"gen1"} seed=${h.seed} seen=${h.seen}`, h?.shot || "");
  }
  // 若 import 没写出横幅行，补 BLOCKED/FAIL 不覆盖已有
  for (const id of ["G_FOOD_65", "G_OUT_65", "G_ENGRAVE1"]) {
    if (!rows.some(r => r.block === "目标横幅" && r.item.startsWith(id + " 横幅"))) {
      const want = GOALS[id]; const h = hit[id];
      rec("目标横幅", `${id} 横幅=「${want}」`, "1280", !h ? "BLOCKED" : h.ok ? "PASS" : "FAIL", !h ? "未采到横幅" : `how=${h.how} seen=${h.seen}`, h?.shot || "");
    }
  }
})();

// ---------- W4 构建门禁（读预写日志） ----------
if (!process.env.ONLY_VP) {
  try {
    const log1 = fs.readFileSync(path.join(OUT, "..", "logs", "build_w4_once.log"), "utf8");
    const log2 = fs.readFileSync(path.join(OUT, "..", "logs", "build2.log"), "utf8");
    const v1 = (log1.match(/VERSION=([a-f0-9]+)/) || [])[1];
    const v2 = (log2.match(/VERSION=([a-f0-9]+)/) || [])[1];
    const expect = "f9f8a39eabcb";
    rec("W4", "干净树首次构建 VERSION=内容哈希且两次一致", "n/a", v1 === expect && v2 === expect ? "PASS" : "FAIL", `first=${v1} second=${v2} expect=${expect}`);
  } catch (e) {
    rec("W4", "干净树首次构建 VERSION", "n/a", "FAIL", "读日志失败:"+e.message);
  }
}

await browser.close(); srv.kill();
const hdr = "block,item,engine,viewport,result,note,shot\n";
fs.writeFileSync(path.join(OUT, `matrix_${engine}.csv`), hdr + rows.map((r) => [r.block, r.item, r.engine, r.viewport, r.result, r.note, r.shot].join(",")).join("\n") + "\n");
console.log("DONE", engine, rows.length);
process.exit(0);
