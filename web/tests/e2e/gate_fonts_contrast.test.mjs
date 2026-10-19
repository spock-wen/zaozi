// e2e Gate: Fonts and Contrast verification
// Tests 3 engines across 5 viewports: 390x844, 375x667, 768x1024, 1280x720, 1440x900
// - Visible text font-size >= 13px (desktop body/main text >= 14px per rule)
// - Text contrast >= 4.5:1 (alpha-composited)
// - Listed non-text contrast >= 3:1
// - Listed hit targets >= 44x44
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";

buildDist();

let server;
const browsers = {};

before(async () => {
  server = await startServer();
  for (const [name, type] of Object.entries(ENGINES)) browsers[name] = await type.launch();
});

after(async () => {
  for (const b of Object.values(browsers)) await b.close();
  server?.close();
});

const VIEWPORTS = [
  { name: "390x844", w: 390, h: 844 },
  { name: "375x667", w: 375, h: 667 },
  { name: "768x1024", w: 768, h: 1024 },
  { name: "1280x720", w: 1280, h: 720 },
  { name: "1440x900", w: 1440, h: 900 },
];

const INPAGE_CHECK = () => {
  const parse = (s) => {
    const m = String(s).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    const x = lum(a), y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const over = (top, bot) => {
    const a = top.a + bot.a * (1 - top.a);
    if (a <= 0) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: (top.r * top.a + bot.r * bot.a * (1 - top.a)) / a,
      g: (top.g * top.a + bot.g * bot.a * (1 - top.a)) / a,
      b: (top.b * top.a + bot.b * bot.a * (1 - top.a)) / a,
      a
    };
  };
  const effOp = (e) => {
    let o = 1;
    for (let x = e; x && x.nodeType === 1; x = x.parentElement) o *= +getComputedStyle(x).opacity;
    return o;
  };
  const rendered = (e) => {
    if (e.closest("[hidden]") || e.closest(".float, script, style, noscript")) return false;
    const r = e.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const cs = getComputedStyle(e);
    return cs.visibility === "visible" && cs.display !== "none" && effOp(e) >= 0.05;
  };
  const ownText = (e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());

  const isDesktop = document.body.dataset.view === "desktop" || document.body.dataset.view === "tablet-landscape";
  const vw = innerWidth, vh = innerHeight;

  // 1. Font Size Check
  const fontBad = [];
  const textEls = [...document.querySelectorAll("body *")].filter((e) => rendered(e) && ownText(e));
  for (const e of textEls) {
    const cs = getComputedStyle(e);
    const fs = parseFloat(cs.fontSize);
    const txt = (e.innerText || e.textContent || "").trim().slice(0, 20);
    const tag = e.id ? "#" + e.id : e.className ? "." + String(e.className).trim().split(/\s+/)[0] : e.tagName.toLowerCase();

    if (fs < 12.9) {
      fontBad.push(`${tag}「${txt}」fontSize=${fs}px < 13px`);
    } else if (isDesktop && fs < 13.9) {
      // Exclude special elements if any
      if (!e.closest(".float, kbd, #keyhelp-btn")) {
        fontBad.push(`[desktop] ${tag}「${txt}」fontSize=${fs}px < 14px`);
      }
    }
  }

  // 2. Text Contrast Check
  const contrastBad = [];
  for (const e of textEls) {
    if (e.closest(":disabled") || e.closest(".float")) continue;
    const r = e.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx >= vw || cy >= vh) continue;

    const cs = getComputedStyle(e);
    const fg0 = parse(cs.color);
    if (!fg0) continue;
    const fg = { ...fg0, a: fg0.a * effOp(e) };

    // Sample elements below
    const stack = document.elementsFromPoint(cx, cy);
    const layers = [e];
    let seenE = false;
    for (const h of stack) {
      if (h === e) { seenE = true; continue; }
      if (e.contains(h)) continue;
      if (!seenE && !h.contains(e)) continue;
      layers.push(h);
    }
    let bg = { r: 30, g: 34, b: 48, a: 1 }; // default night-800
    for (const h of layers.reverse()) {
      const hcs = getComputedStyle(h);
      const c = parse(hcs.backgroundColor);
      if (c && c.a > 0) bg = over({ ...c, a: c.a * effOp(h) }, bg);
    }
    const ff = over(fg, bg);
    const cr = ratio(ff, bg);
    const txt = (e.innerText || e.textContent || "").trim().slice(0, 20);
    const tag = e.id ? "#" + e.id : e.className ? "." + String(e.className).trim().split(/\s+/)[0] : e.tagName.toLowerCase();
    if (cr < 4.45) {
      contrastBad.push(`${tag}「${txt}」contrast=${cr.toFixed(2)}:1 < 4.5:1`);
    }
  }

  // 3. Listed Hit Targets Check
  const hitBad = [];
  const interactiveSels = "button, [role=button], a[href], .slot, .cand, .tally, #bonecorner, #goals-slip, #keyhelp-btn, #menubtn";
  for (const e of document.querySelectorAll(interactiveSels)) {
    if (!rendered(e) || e.closest("[hidden]")) continue;
    const r = e.getBoundingClientRect();
    const tag = e.id ? "#" + e.id : e.className ? "." + String(e.className).trim().split(/\s+/)[0] : e.tagName.toLowerCase();
    if (r.width < 43.5 || r.height < 43.5) {
      hitBad.push(`${tag} size=${r.width.toFixed(1)}x${r.height.toFixed(1)} < 44`);
    }
  }

  // Check wb-handle hit area (only when pick overlay is not covering it)
  const pickEl = document.querySelector("#pick");
  const isPick = pickEl && getComputedStyle(pickEl).display !== "none" && !pickEl.hidden;
  const h = isPick ? null : document.querySelector(".wb-handle");
  if (h && rendered(h)) {
    const r = h.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (let dx = -70; dx <= 70; dx += 2) {
      for (let dy = -40; dy <= 40; dy += 2) {
        const t = document.elementFromPoint(cx + dx, cy + dy);
        if (t === h) {
          x0 = Math.min(x0, dx); x1 = Math.max(x1, dx);
          y0 = Math.min(y0, dy); y1 = Math.max(y1, dy);
        }
      }
    }
    const w = x1 >= x0 ? x1 - x0 + 2 : 0, hh = y1 >= y0 ? y1 - y0 + 2 : 0;
    if (w < 43.5 || hh < 43.5) hitBad.push(`.wb-handle hitArea=${w}x${hh} < 44`);
  }

  // 4. Listed Non-Text Contrast Check (>= 3:1)
  const nonTextBad = [];
  const nonTextSels = "#goals-slip, .wb-handle, .slot, .tally, #bonecorner, .card-drops, #sidebar-tab";
  for (const e of document.querySelectorAll(nonTextSels)) {
    if (!rendered(e) || e.closest(":disabled")) continue;
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e), op = effOp(e);
    const bc = parse(cs.borderTopColor);
    const bgc = parse(cs.backgroundColor);
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx >= vw || cy >= vh) continue;

    // Outer backdrop
    const stack = document.elementsFromPoint(cx, cy);
    let bg = { r: 30, g: 34, b: 48, a: 1 };
    const layers = [];
    let seenE = false;
    for (const el of stack) {
      if (el === e) { seenE = true; continue; }
      if (e.contains(el)) continue;
      if (!seenE && !el.contains(e)) continue;
      layers.push(el);
    }
    for (const el of layers.reverse()) {
      const elcs = getComputedStyle(el);
      const c = parse(elcs.backgroundColor);
      if (c && c.a > 0) bg = over({ ...c, a: c.a * effOp(el) }, bg);
    }
    let k1 = 0, k2 = 0;
    if (bc && bc.a > 0) k1 = ratio(over({ ...bc, a: bc.a * op }, bg), bg);
    if (bgc && bgc.a > 0) k2 = ratio(over({ ...bgc, a: bgc.a * op }, bg), bg);
    const best = Math.max(k1, k2);
    const tag = e.id ? "#" + e.id : e.className ? "." + String(e.className).trim().split(/\s+/)[0] : e.tagName.toLowerCase();
    if (best < 2.95) {
      nonTextBad.push(`${tag} nonTextContrast=${best.toFixed(2)}:1 < 3:1`);
    }
  }

  return { fontBad, contrastBad, hitBad, nonTextBad };
};

for (const [engine] of Object.entries(ENGINES)) {
  for (const vp of VIEWPORTS) {
    test(`${engine} ${vp.name}: gate fonts >=13 (desktop >=14), contrast >=4.5, non-text >=3, hit targets >=44`, { timeout: 60000 }, async () => {
      const ctx = await browsers[engine].newContext({ viewport: { width: vp.w, height: vp.h } });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);

      await page.goto(`${server.origin}/?seed=${SEED}`);
      await page.waitForFunction(() => !!window.__zz && (window.__zz.st?.phase === "card" || window.__zz.st?.phase === "engrave"), null, { timeout: 10000 });
      await page.waitForTimeout(300);

      // Phase 1: Card state (g1_T01)
      const res1 = await page.evaluate(INPAGE_CHECK);
      assert.deepEqual(res1.fontBad, [], `Font size violations on card phase: ${res1.fontBad.join("; ")}`);
      assert.deepEqual(res1.contrastBad, [], `Text contrast violations on card phase: ${res1.contrastBad.join("; ")}`);
      assert.deepEqual(res1.hitBad, [], `Hit target violations on card phase: ${res1.hitBad.join("; ")}`);
      assert.deepEqual(res1.nonTextBad, [], `Non-text contrast violations on card phase: ${res1.nonTextBad.join("; ")}`);

      // Phase 2: Engrave state (enter T03)
      await page.evaluate(() => {
        window.__zz.st.current = "T03";
        window.__zz.st.phase = "engrave";
        window.__zz.st.pendingTrace = { target: "休", tally_text: "晌午正热，赶路的背抵着一截老干，头顶叶子筛下的光斑落了一身。" };
        window.__zz.render();
      });
      await page.waitForTimeout(200);

      const res2 = await page.evaluate(INPAGE_CHECK);
      assert.deepEqual(res2.fontBad, [], `Font size violations on engrave phase: ${res2.fontBad.join("; ")}`);
      assert.deepEqual(res2.contrastBad, [], `Text contrast violations on engrave phase: ${res2.contrastBad.join("; ")}`);
      assert.deepEqual(res2.hitBad, [], `Hit target violations on engrave phase: ${res2.hitBad.join("; ")}`);
      assert.deepEqual(res2.nonTextBad, [], `Non-text contrast violations on engrave phase: ${res2.nonTextBad.join("; ")}`);

      // Phase 3: Pick state
      await page.evaluate(() => {
        window.__zz.st.phase = "pick";
        window.__zz.render();
      });
      await page.waitForTimeout(200);

      const res3 = await page.evaluate(INPAGE_CHECK);
      assert.deepEqual(res3.fontBad, [], `Font size violations on pick phase: ${res3.fontBad.join("; ")}`);
      assert.deepEqual(res3.contrastBad, [], `Text contrast violations on pick phase: ${res3.contrastBad.join("; ")}`);
      assert.deepEqual(res3.hitBad, [], `Hit target violations on pick phase: ${res3.hitBad.join("; ")}`);
      assert.deepEqual(res3.nonTextBad, [], `Non-text contrast violations on pick phase: ${res3.nonTextBad.join("; ")}`);

      assert.equal(errs.length, 0, `Page errors: ${errs.join("; ")}`);
      await ctx.close();
    });
  }
}
