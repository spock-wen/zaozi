// e2e test for RULES_fix2_v2.md §11.4 & FIX_SPEC §I-04 & BEHAVIOR_RULES R12, R14, T2, D1, D2, U4:
// Real DOM measurements for trace box wrapping, card minimum size, and story non-clipping.
// 15 gate sizes + 360x640 (record-only), with and without safe area (D2), 3 engines, states T03 / C05 / C07.
// Negative control: TR_NEG=sidebyside forces trace and buttons on one line and MUST fail.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";

buildDist();

let server;
const browsers = {};

before(async () => {
  server = await startServer();
  for (const [name, type] of Object.entries(ENGINES)) {
    browsers[name] = await type.launch();
  }
});

after(async () => {
  for (const b of Object.values(browsers)) {
    await b.close();
  }
  server?.close();
});

const GATE_SIZES = [
  // Phone 7
  { name: "375x667", w: 375, h: 667, gate: true },
  { name: "360x800", w: 360, h: 800, gate: true },
  { name: "390x844", w: 390, h: 844, gate: true },
  { name: "393x852", w: 393, h: 852, gate: true },
  { name: "412x915", w: 412, h: 915, gate: true },
  { name: "430x932", w: 430, h: 932, gate: true },
  { name: "390x664", w: 390, h: 664, gate: true },
  // Tablet 3
  { name: "768x1024", w: 768, h: 1024, gate: true },
  { name: "820x1180", w: 820, h: 1180, gate: true },
  { name: "1024x768", w: 1024, h: 768, gate: true },
  // Desktop 5
  { name: "1280x720", w: 1280, h: 720, gate: true },
  { name: "1280x800", w: 1280, h: 800, gate: true },
  { name: "1366x768", w: 1366, h: 768, gate: true },
  { name: "1440x900", w: 1440, h: 900, gate: true },
  { name: "1920x1080", w: 1920, h: 1080, gate: true },
  // Record-only 1
  { name: "360x640", w: 360, h: 640, gate: false },
];

const STATES = [
  { id: "T03", target: "休", tally: "晌午正热，赶路的背抵着一截老干，头顶叶子遮着太阳，一直待到天色转凉" },
  { id: "C05", target: "休", tally: "晌午正热，赶路的背抵着一截老干，头顶叶子遮着太阳，一直待到天色转凉" },
  { id: "C07", target: "力", tally: "他把耒插进车轮底下的泥里，弯腰往上撬，胳膊上的筋一条条鼓起来，车轮一点点出了泥" },
];

const NEG = process.env.TR_NEG || "";

for (const [engineName] of Object.entries(ENGINES)) {
  test(`${engineName}: sheet_card_min suite (15 gate sizes + 360x640, sa 0/1, T03/C05/C07)`, { timeout: 300000 }, async () => {
    const browser = browsers[engineName];
    const gateFailures = [];
    const recordLogs = [];

    for (const size of GATE_SIZES) {
      for (const sa of [0, 1]) {
        const isDesktop = size.w >= 1280;
        const ctx = await browser.newContext({
          viewport: { width: size.w, height: size.h },
          hasTouch: !isDesktop,
          isMobile: !isDesktop && engineName !== "firefox",
        });

        // Safe area and negative control route
        await ctx.route("**/style.css", async (r) => {
          const res = await r.fetch();
          let text = await res.text();
          if (sa) {
            text = text
              .replaceAll("env(safe-area-inset-top)", "47px")
              .replaceAll("env(safe-area-inset-bottom)", "34px")
              .replaceAll("env(safe-area-inset-left)", "0px")
              .replaceAll("env(safe-area-inset-right)", "0px");
          }
          if (NEG === "sidebyside") {
            // Negative control: force trace box and buttons onto the same line
            text += `\n/* TR_NEG sidebyside injection */\n.card.engrave .card-drops { flex-wrap: nowrap !important; } .card.engrave .card-drops #card-trace, .card.engrave .card-drops .tr { flex: 1 1 auto !important; width: auto !important; max-width: none !important; }\n`;
          }
          r.fulfill({ response: res, body: text });
        });

        const page = await ctx.newPage();
        const errs = [];
        collectErrors(page, errs);

        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz);

        for (const st of STATES) {
          const tag = `${engineName} ${size.name}${sa ? "+sa" : ""} ${st.id}`;
          // Set engrave state
          await page.evaluate((info) => {
            const z = window.__zz;
            z.st.current = info.id;
            z.st.phase = "engrave";
            z.st.pendingTrace = { target: info.target, tally_text: info.tally };
            z.render();
          }, st);

          await page.waitForTimeout(60);

          const check = await page.evaluate(() => {
            const c = document.getElementById("card");
            const d = document.getElementById("card-drops");
            const t = document.getElementById("card-trace");
            const cw = document.getElementById("cardwrap");
            if (!c || !d) return { ok: false, errors: ["Missing #card or #card-drops"] };
            if (!t) return { ok: false, errors: ["Missing #card-trace"] };

            const cs = getComputedStyle(t);
            const ds = getComputedStyle(d);
            const cr = c.getBoundingClientRect();
            const dr = d.getBoundingClientRect();
            const tr = t.getBoundingClientRect();

            const padLeft = parseFloat(ds.paddingLeft) || 0;
            const padRight = parseFloat(ds.paddingRight) || 0;
            const innerWidth = d.clientWidth - padLeft - padRight;

            const vis = t.getClientRects().length > 0 && cs.display !== "none" && cs.visibility !== "hidden";
            const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
            const lines = Math.floor((tr.height + 1) / lh);

            const btns = [document.getElementById("skip"), document.getElementById("full")]
              .filter((e) => e && !e.hidden && e.getClientRects().length)
              .map((e) => {
                const r = e.getBoundingClientRect();
                return { id: e.id, x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom };
              });

            const nextLine = btns.every((b) => b.y >= tr.bottom - 1);
            const bigBtns = btns.every((b) => b.w >= 43.5 && b.h >= 43.5);
            const inDrops = btns.every((b) => b.x >= dr.left - 1 && b.r <= dr.right + 1 && b.y >= dr.top - 1 && b.b <= dr.bottom + 1);
            const inCard = dr.bottom <= cr.bottom + 1 && dr.top >= cr.top - 1;
            const inVp = btns.every((b) => b.b <= window.innerHeight + 1 && b.y >= -1 && b.r <= window.innerWidth + 1);

            const view = document.body.dataset.view;
            const isPortrait = view === "mobile" || view === "tablet-portrait";

            const optL = document.getElementById("opt-left");
            const optR = document.getElementById("opt-right");
            const optLVis = optL ? getComputedStyle(optL).visibility : null;
            const optRVis = optR ? getComputedStyle(optR).visibility : null;
            const optLDisp = optL ? getComputedStyle(optL).display : null;
            const optRDisp = optR ? getComputedStyle(optR).display : null;
            const optsOk = !isPortrait || (
              optL?.disabled && optR?.disabled &&
              optLVis === "hidden" && optRVis === "hidden" &&
              optLDisp !== "none" && optRDisp !== "none"
            );

            const slotW = cw ? cw.clientWidth : 0;
            const slotH = cw ? cw.clientHeight : 0;
            const expectedMinW = Math.min(slotW, 300);
            const cardWOk = !isPortrait || (cr.width >= expectedMinW - 1);
            const expectedH = Math.min(slotH, cr.width * 468 / 328);
            const cardHOk = !isPortrait || (cr.height >= expectedH - 1.5);

            const cPadBottom = parseFloat(getComputedStyle(c).paddingBottom) || 0;
            const storyBad = [];
            for (const sel of [".card-head", "#card-title", "#card-text"]) {
              const el = c.querySelector(sel);
              if (!el) continue;
              const es = getComputedStyle(el);
              const er = el.getBoundingClientRect();
              const txt = el.innerText || "";
              if (el.scrollHeight > el.clientHeight + 1) storyBad.push(`${sel}: scrollH ${el.scrollHeight} > clientH ${el.clientHeight}`);
              if (el.scrollWidth > el.clientWidth + 1) storyBad.push(`${sel}: scrollW ${el.scrollWidth} > clientW ${el.clientWidth}`);
              if (es.textOverflow === "ellipsis" || (es.webkitLineClamp && es.webkitLineClamp !== "none")) storyBad.push(`${sel}: ellipsis style`);
              if (/[…]$|\.\.\.$/.test(txt.trim())) storyBad.push(`${sel}: ends with ellipsis`);
              if (er.bottom > cr.bottom - cPadBottom + 1) storyBad.push(`${sel}: out of card bottom by ${Math.round(er.bottom - (cr.bottom - cPadBottom))}`);
              if (er.bottom > dr.top + 1) storyBad.push(`${sel}: overlaps trace box by ${Math.round(er.bottom - dr.top)}`);
              if (er.top < cr.top - 1) storyBad.push(`${sel}: out of card top`);
            }

            const errors = [];
            if (!vis) errors.push("Trace text not visible");
            if (lines < 1) errors.push("Trace text 0 lines");
            if (t.clientWidth < innerWidth - 1) errors.push(`Trace width ${Math.round(t.clientWidth)} < inner width ${Math.round(innerWidth)}`);
            if (!nextLine) errors.push("Buttons and trace on same line");
            if (!bigBtns) errors.push("Buttons < 44x44");
            if (!inDrops) errors.push("Buttons out of trace box");
            if (!inCard) errors.push("Trace box out of card");
            if (!inVp) errors.push("Buttons out of viewport");
            if (!optsOk) errors.push(`Options not visibility:hidden + disabled (L:${optLVis}/${optLDisp}, R:${optRVis}/${optRDisp})`);
            if (!cardWOk) errors.push(`Card width ${Math.round(cr.width)} < min(slotW ${Math.round(slotW)}, 300) = ${Math.round(expectedMinW)}`);
            if (!cardHOk) errors.push(`Card height ${Math.round(cr.height)} < expected ${Math.round(expectedH)}`);
            if (storyBad.length > 0) errors.push(`Story clipped: ${storyBad.join(", ")}`);

            return {
              ok: errors.length === 0,
              errors,
              metrics: {
                card: `${Math.round(cr.width)}x${Math.round(cr.height)}`,
                slot: `${Math.round(slotW)}x${Math.round(slotH)}`,
                traceW: Math.round(t.clientWidth),
                innerW: Math.round(innerWidth),
                lines,
                btns: btns.map((b) => `${b.id}:${Math.round(b.w)}x${Math.round(b.h)}@y=${Math.round(b.y)}`).join(" "),
                storyBad,
              }
            };
          });

          if (size.gate) {
            if (!check.ok) {
              gateFailures.push(`${tag}: ${check.errors.join("; ")} [metrics: ${JSON.stringify(check.metrics)}]`);
            }
          } else {
            recordLogs.push(`${tag} (record-only): ok=${check.ok} errors=${check.errors.join("; ")} metrics=${JSON.stringify(check.metrics)}`);
          }
        }

        await ctx.close();
      }
    }

    if (recordLogs.length > 0) {
      console.log(`[sheet_card_min record-only 360x640]\n${recordLogs.join("\n")}`);
    }

    assert.equal(gateFailures.length, 0, `Gate failures (${gateFailures.length}):\n${gateFailures.join("\n")}`);
  });
}
