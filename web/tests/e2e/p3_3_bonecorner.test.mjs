// e2e: §13.1 P3-3 bonecorner non-overlap with card title on safe-area phones
// On safe-area phones in engrave phase (T03, C05), the #bonecorner 刻 corner
// must never overlap #card-title or .card-head.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";

buildDist();

const PHONE_VIEWPORTS = [
  { name: "375x667", width: 375, height: 667, touch: true },
  { name: "390x664", width: 390, height: 664, touch: true }, // with safe area top 47 / bottom 34
  { name: "390x844", width: 390, height: 844, touch: true },
  { name: "393x852", width: 393, height: 852, touch: true },
  { name: "412x915", width: 412, height: 915, touch: true },
  { name: "430x932", width: 430, height: 932, touch: true },
  { name: "360x800", width: 360, height: 800, touch: true },
];

const STATES = ["T03", "C05"];

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
  for (const vp of PHONE_VIEWPORTS) {
    for (const cardId of STATES) {
      test(`${engine} ${vp.name} on ${cardId}: #bonecorner does not overlap #card-title or .card-head`, async () => {
        const ctx = await browsers[engine].newContext({
          viewport: { width: vp.width, height: vp.height },
          hasTouch: vp.touch,
          ...(engine !== "firefox" ? { isMobile: true } : {}),
        });
        const page = await ctx.newPage();
        const errs = [];
        collectErrors(page, errs);

        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz && document.body.dataset.cardReady === "1");

        const overlapResult = await page.evaluate((targetCard) => {
          const z = window.__zz;
          z.st.current = targetCard;
          z.st.phase = "engrave";
          z.st.pendingTrace = {
            target: "休",
            tally_text: "晌午正热，赶路的背抵着一截老干，头顶叶子遮着太阳，一直待到天色转凉",
          };
          z.render();

          const bc = document.getElementById("bonecorner");
          const title = document.getElementById("card-title");
          const head = document.querySelector(".card-head");

          if (!bc || !title) return { ok: false, reason: "Missing elements" };

          const bcr = bc.getBoundingClientRect();
          const tr = title.getBoundingClientRect();
          const hr = head?.getBoundingClientRect();

          // Title overlap check
          const titleOverlap = !(tr.right <= bcr.left || tr.left >= bcr.right || tr.bottom <= bcr.top || tr.top >= bcr.bottom);
          // Head overlap check
          const headOverlap = hr ? !(hr.right <= bcr.left || hr.left >= bcr.right || hr.bottom <= bcr.top || hr.top >= bcr.bottom) : false;

          return {
            ok: !titleOverlap && !headOverlap,
            titleOverlap,
            headOverlap,
            bcr: { left: bcr.left, top: bcr.top, right: bcr.right, bottom: bcr.bottom },
            tr: { left: tr.left, top: tr.top, right: tr.right, bottom: tr.bottom },
            hr: hr ? { left: hr.left, top: hr.top, right: hr.right, bottom: hr.bottom } : null,
          };
        }, cardId);

        assert.equal(overlapResult.ok, true, `P3-3 overlap on ${vp.name} ${cardId}: ${JSON.stringify(overlapResult)}`);
        await ctx.close();
        assert.deepEqual(errs, []);
      });
    }
  }
}
