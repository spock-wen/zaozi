// e2e: C1 gesture contrast at 1024x768 touch desktop view
// Per RULES L110 §7-4 (Q6): with body[data-view="desktop"] #gesture-hint{color:var(--night-line)} deleted,
// default var(--paper-200) applies, giving contrast ratio >= 4.5:1.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";

buildDist();

let server, browsers = {};
before(async () => {
  server = await startServer();
  for (const [name, type] of Object.entries(ENGINES)) browsers[name] = await type.launch();
});
after(async () => {
  for (const b of Object.values(browsers)) await b.close();
  server?.close();
});

for (const [engine] of Object.entries(ENGINES)) {
  test(`${engine} 1024x768 touch: C1 #gesture-hint contrast >= 4.5:1`, async () => {
    const ctx = await browsers[engine].newContext({
      viewport: { width: 1024, height: 768 },
      hasTouch: true,
      ...(engine !== "firefox" ? { isMobile: true } : {}),
    });
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);

    await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
    await page.waitForFunction(() => !!window.__zz);

    const res = await page.evaluate(() => {
      const parseRGB = (s) => {
        const m = String(s).match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
        return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
      };
      const sRGBtoLinear = (c) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      const relLuminance = (rgb) => {
        return 0.2126 * sRGBtoLinear(rgb.r) + 0.7152 * sRGBtoLinear(rgb.g) + 0.0722 * sRGBtoLinear(rgb.b);
      };
      const contrastRatio = (c1, c2) => {
        const l1 = relLuminance(c1), l2 = relLuminance(c2);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      };

      const hintEl = document.getElementById("gesture-hint");
      if (!hintEl) return { error: "#gesture-hint not found" };

      const cs = getComputedStyle(hintEl);
      const fg = parseRGB(cs.color);

      // Resolve background: climb ancestors to find solid background color
      let bg = null;
      let el = hintEl;
      while (el && el !== document.documentElement) {
        const b = parseRGB(getComputedStyle(el).backgroundColor);
        if (b && b.a > 0.8) { bg = b; break; }
        el = el.parentElement;
      }
      if (!bg) bg = { r: 27, g: 30, b: 42, a: 1 }; // night-800 default #1b1e2a

      const cr = contrastRatio(fg, bg);
      return {
        view: document.body.dataset.view,
        text: hintEl.textContent,
        color: cs.color,
        contrast: cr,
      };
    });

    await ctx.close();
    assert.ok(res.contrast >= 4.5, `1024x768 touch #gesture-hint contrast ${res.contrast?.toFixed(2)}:1 must be >= 4.5:1 (color: ${res.color})`);
    assert.deepEqual(errs, []);
  });
}
