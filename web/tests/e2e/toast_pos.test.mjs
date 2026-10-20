// e2e: D7 toast positioning & non-overlap across 15 gate viewports on T01, T03, C05
// RULES_fix2_v2 §1.2 R1′ + §12 + §13.1 P3-3:
// - Toast box + 4px margin never intersects clickables / protected areas (#topbar, #coach, #sidebar, options, bonecorner, etc.)
// - Fully in viewport, no ellipsis / truncation, multi-line support
// - P3-3: #bonecorner does not overlap #card-title
// - Injected negative check: forced overlap over #opt-left is detected by the checker
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";

buildDist();

// 15 gate viewports per R14 / T2
const GATE_SIZES = [
  // 7 Mobile
  { name: "375x667", width: 375, height: 667, touch: true, view: "mobile" },
  { name: "360x800", width: 360, height: 800, touch: true, view: "mobile" },
  { name: "390x844", width: 390, height: 844, touch: true, view: "mobile" },
  { name: "393x852", width: 393, height: 852, touch: true, view: "mobile" },
  { name: "412x915", width: 412, height: 915, touch: true, view: "mobile" },
  { name: "430x932", width: 430, height: 932, touch: true, view: "mobile" },
  { name: "390x664", width: 390, height: 664, touch: true, view: "mobile" },
  // 3 Tablet
  { name: "768x1024", width: 768, height: 1024, touch: true, view: "tablet-portrait" },
  { name: "820x1180", width: 820, height: 1180, touch: true, view: "tablet-portrait" },
  { name: "1024x768", width: 1024, height: 768, touch: true, view: "tablet-landscape" },
  // 5 Desktop
  { name: "1280x720", width: 1280, height: 720, touch: false, view: "desktop" },
  { name: "1280x800", width: 1280, height: 800, touch: false, view: "desktop" },
  { name: "1366x768", width: 1366, height: 768, touch: false, view: "desktop" },
  { name: "1440x900", width: 1440, height: 900, touch: false, view: "desktop" },
  { name: "1920x1080", width: 1920, height: 1080, touch: false, view: "desktop" },
];

const STATES = ["T01", "T03", "C05"];

let server, browsers = {};
before(async () => {
  server = await startServer();
  for (const [name, type] of Object.entries(ENGINES)) browsers[name] = await type.launch();
});
after(async () => {
  for (const b of Object.values(browsers)) await b.close();
  server?.close();
});

// Real DOM obstacle and collision checker executed in page
const CHECKER_FN_STRING = `
function checkToastAndObstacles() {
  const t = document.getElementById("toast");
  if (!t) return { ok: false, reason: "No #toast element" };
  const cs = getComputedStyle(t);

  // If toast is completely hidden via class or opacity < 0.05
  if (!t.classList.contains("on") || parseFloat(cs.opacity) < 0.05 || cs.visibility === "hidden" || cs.display === "none") {
    // If floating toast could not be placed, check if gesture-hint fallback was used or suppressed
    return { ok: true, hidden: true };
  }

  const tRect = t.getBoundingClientRect();
  if (tRect.width <= 0 || tRect.height <= 0) return { ok: false, reason: "toast has zero dimensions" };

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Fully within viewport (0.5px tolerance)
  if (tRect.left < -0.5 || tRect.top < -0.5 || tRect.right > vw + 0.5 || tRect.bottom > vh + 0.5) {
    return { ok: false, reason: "toast out of viewport", tRect, vw, vh };
  }

  // No ellipsis and no clipping
  if (cs.textOverflow === "ellipsis") return { ok: false, reason: "toast has text-overflow: ellipsis" };
  if (t.scrollWidth > t.clientWidth + 1) return { ok: false, reason: "toast horizontally clipped", scrollWidth: t.scrollWidth, clientWidth: t.clientWidth };
  if (t.scrollHeight > t.clientHeight + 1) return { ok: false, reason: "toast vertically clipped", scrollHeight: t.scrollHeight, clientHeight: t.clientHeight };

  // Toast box with 4px margin
  const M = 4;
  const tBox = {
    left: tRect.left - M,
    top: tRect.top - M,
    right: tRect.right + M,
    bottom: tRect.bottom + M,
  };

  const TOAST_AVOID = "button, a[href], [data-do], [data-tally], [data-comp], [data-base], [data-pos], [role=button], input, select, textarea, canvas, #xcv, .cand, .pickslot, #wb-handle, #topbar, #dims, #dims-desktop, #wordbox-bar, #too-short, #keys, #sidebar, #coach, #menu-pop, #keyhelp-pop, #dlgbox, #banner";
  const TOAST_LAYERS = ["savedlg", "pick", "elder", "endseq", "winter", "drawer"];
  const isVis = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden" && getComputedStyle(el).display !== "none";
  const layer = TOAST_LAYERS.map((id) => document.getElementById(id)).find(isVis) || null;

  const gh = document.getElementById("gesture-hint");
  const gestOnly = !layer && isVis(gh) && gh.dataset.kind === "gesture";

  const scope = layer || document;
  const candidates = [...scope.querySelectorAll(TOAST_AVOID)];
  if (layer) {
    const ts = document.getElementById("too-short");
    if (ts) candidates.push(ts);
  } else if (isVis(gh) && !gestOnly) {
    candidates.push(gh);
  }

  const collisions = [];
  for (const el of candidates) {
    if (!el || el === t || t.contains(el)) continue;
    if (!isVis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;

    // Overlap test with 0.5px tolerance
    const overlapX = tBox.right - 0.5 > r.left && tBox.left + 0.5 < r.right;
    const overlapY = tBox.bottom - 0.5 > r.top && tBox.top + 0.5 < r.bottom;
    if (overlapX && overlapY) {
      collisions.push({
        id: el.id,
        tag: el.tagName,
        cls: el.className,
        rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
      });
    }
  }

  if (collisions.length > 0) {
    return { ok: false, reason: "toast intersects obstacles", collisions, tBox };
  }

  // §13.1 P3-3: #bonecorner must not overlap #card-title
  const bc = document.getElementById("bonecorner");
  const title = document.getElementById("card-title");
  if (isVis(bc) && isVis(title)) {
    const bcr = bc.getBoundingClientRect();
    const tr = title.getBoundingClientRect();
    if (bcr.width > 0 && tr.width > 0) {
      const overlapX = tr.right > bcr.left && tr.left < bcr.right;
      const overlapY = tr.bottom > bcr.top && tr.top < bcr.bottom;
      if (overlapX && overlapY) {
        return { ok: false, reason: "P3-3: #bonecorner overlaps #card-title", bcr, tr };
      }
    }
  }

  return { ok: true };
}
`;

for (const [engine] of Object.entries(ENGINES)) {
  for (const vp of GATE_SIZES) {
    test(`${engine} ${vp.name}: toast positioning, margin avoidance & P3-3 across T01/T03/C05`, async () => {
      const ctx = await browsers[engine].newContext({
        viewport: { width: vp.width, height: vp.height },
        hasTouch: vp.touch,
        ...(vp.touch && engine !== "firefox" ? { isMobile: true } : {}),
      });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);

      await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz && document.body.dataset.cardReady === "1");

      for (const cardId of STATES) {
        // Set up the state
        await page.evaluate((targetCard) => {
          const z = window.__zz;
          z.st.current = targetCard;
          if (targetCard === "T01") {
            z.st.phase = "card";
          } else {
            z.st.phase = "engrave";
            z.st.pendingTrace = {
              target: "休",
              tally_text: "晌午正热，赶路的背抵着一截老干，头顶叶子遮着太阳，一直待到天色转凉",
            };
          }
          z.render();
        }, cardId);

        // Fire toast
        await page.evaluate((cardId) => {
          window.__zz.toast(`提示信息：在 ${cardId} 上测试 toast 避让规则与多行显示`);
        }, cardId);

        await page.waitForTimeout(60);

        // Run real DOM check
        const res = await page.evaluate(new Function(CHECKER_FN_STRING + " return checkToastAndObstacles();"));
        assert.ok(res.ok, `${engine} ${vp.name} on ${cardId}: toast collision check failed: ${JSON.stringify(res)}`);
      }

      await ctx.close();
      assert.deepEqual(errs, []);
    });
  }

  // Injected negative test: toast forced directly over #opt-left MUST be caught by the collision checker
  test(`${engine}: injected negative check - forced toast over #opt-left must be detected`, async () => {
    const ctx = await browsers[engine].newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      ...(engine !== "firefox" ? { isMobile: true } : {}),
    });
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);

    await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
    await page.waitForFunction(() => !!window.__zz && document.body.dataset.cardReady === "1");

    // Precondition: at boot the state is phase="card", so #opt-left must be shown —
    // otherwise the negative check below would pass vacuously
    const optPre = await page.evaluate(() => {
      const optL = document.getElementById("opt-left");
      if (!optL) return "missing";
      const r = optL.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return "zero rect";
      const cs = getComputedStyle(optL);
      if (cs.display === "none" || cs.visibility === "hidden") return `hidden (visibility:${cs.visibility})`;
      return "";
    });
    assert.equal(optPre, "", "precondition: #opt-left must be visible at boot state");

    const negRes = await page.evaluate((checkerCode) => {
      const t = document.getElementById("toast");
      const optL = document.getElementById("opt-left");
      if (!t || !optL) return { ok: true, reason: "Missing elements" };

      const r = optL.getBoundingClientRect();
      t.textContent = "强制覆盖左选项测试";
      t.classList.add("on");
      t.classList.remove("hold");
      // #toast carries `transition: opacity .3s`; with only opacity:1 inline, getComputedStyle
      // in this same tick still yields the transition start value (~0) and the checker's
      // hidden-guard passes vacuously — kill the transition so the toast is opaque right now
      t.style.transition = "none";
      t.style.top = Math.round(r.top) + "px";
      t.style.bottom = "auto";
      t.style.left = Math.round(r.left + r.width / 2) + "px";
      t.style.transform = "translateX(-50%)";
      t.style.opacity = "1";
      t.style.visibility = "visible";

      // Execute checker function passed from Node context
      return new Function(`
        ${checkerCode}
        return checkToastAndObstacles();
      `)();
    }, CHECKER_FN_STRING);

    assert.equal(negRes.ok, false, "Checker must flag forced overlap as failure");
    assert.ok(
      negRes.collisions && negRes.collisions.some((c) => c.id === "opt-left"),
      "Checker must specifically report collision with #opt-left: " + JSON.stringify(negRes),
    );

    await ctx.close();
  });
}
