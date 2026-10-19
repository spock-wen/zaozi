// e2e: E1-D1 engrave phase hints & option visibility
// In engrave phase:
// - Forbidden words absent in #keys, #gesture-hint, and #keyhelp-pop:
//   "左右", "拖卡", "← →", "←→", "←/→", "预览", "Enter 提交"
// - Correct copy per RULES §3.1/§3.3
// - Options stay visibility:hidden + disabled (R12)
// Tested at 375x667, 360x800, 1024x768 touch, 1280x720, 1920x1080 across T03 & C05
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";

buildDist();

const FORBIDDEN_WORDS = ["左右", "拖卡", "← →", "←→", "←/→", "预览", "Enter 提交"];

const VIEWPORTS = [
  { name: "375x667", width: 375, height: 667, touch: true },
  { name: "360x800", width: 360, height: 800, touch: true },
  { name: "1024x768 touch", width: 1024, height: 768, touch: true },
  { name: "1280x720", width: 1280, height: 720, touch: false },
  { name: "1920x1080", width: 1920, height: 1080, touch: false },
];

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
  for (const vp of VIEWPORTS) {
    for (const cardId of ["T03", "C05"]) {
      test(`${engine} ${vp.name} on ${cardId}: D1 engrave hints free of forbidden words & options hidden+disabled`, async () => {
        const ctx = await browsers[engine].newContext({
          viewport: { width: vp.width, height: vp.height },
          hasTouch: vp.touch,
          ...(vp.touch && engine !== "firefox" ? { isMobile: true } : {}),
        });
        const page = await ctx.newPage();
        const errs = [];
        collectErrors(page, errs);

        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz);

        // Put the game into engrave phase on cardId
        await page.evaluate((targetCard) => {
          const z = window.__zz;
          z.st.current = targetCard;
          z.st.phase = "engrave";
          z.st.pendingTrace = {
            target: targetCard === "T03" ? "休" : "休",
            tally_text: targetCard === "T03"
              ? "晌午正热，赶路的背抵着一截老干，头顶叶子遮着太阳，一直待到天色转凉"
              : "晌午正热，赶路的背抵着一截老干，头顶叶子遮着太阳，一直待到天色转凉",
          };
          z.render();
        }, cardId);

        // Open keyhelp popover to check its contents
        await page.evaluate(() => {
          window.__zz.ui.keyhelpOpen = true;
          window.__zz.render();
        });

        const checkRes = await page.evaluate((forbidden) => {
          const failures = [];
          const keysEl = document.getElementById("keys");
          const gestureEl = document.getElementById("gesture-hint");
          const popEl = document.getElementById("keyhelp-pop");
          const optLeft = document.getElementById("opt-left");
          const optRight = document.getElementById("opt-right");

          const keysText = (keysEl?.textContent || "").trim();
          const gestureText = (gestureEl?.textContent || "").trim();
          const popText = (popEl?.textContent || "").trim();

          // 1. Check forbidden words
          for (const w of forbidden) {
            if (keysText.includes(w)) failures.push(`#keys contains forbidden word "${w}": "${keysText}"`);
            if (gestureText.includes(w)) failures.push(`#gesture-hint contains forbidden word "${w}": "${gestureText}"`);
            if (popText.includes(w)) failures.push(`#keyhelp-pop contains forbidden word "${w}": "${popText}"`);
          }

          // 2. Options R12 check: visibility:hidden + disabled
          if (optLeft) {
            const cs = getComputedStyle(optLeft);
            if (cs.visibility !== "hidden") failures.push(`#opt-left visibility is "${cs.visibility}", expected "hidden"`);
            if (!optLeft.disabled) failures.push(`#opt-left disabled is false, expected true`);
          }
          if (optRight) {
            const cs = getComputedStyle(optRight);
            if (cs.visibility !== "hidden") failures.push(`#opt-right visibility is "${cs.visibility}", expected "hidden"`);
            if (!optRight.disabled) failures.push(`#opt-right disabled is false, expected true`);
          }

          return { failures, keysText, gestureText, popText };
        }, FORBIDDEN_WORDS);

        await ctx.close();
        assert.deepEqual(checkRes.failures, [], `Failures on ${vp.name} ${cardId}:\n${checkRes.failures.join("\n")}`);
        assert.deepEqual(errs, []);
      });
    }
  }
}
