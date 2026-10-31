// e2e PC Leftovers verification (P1: S1/S8 K hint, P2: Desktop overflow D3/H5, P3: 1280x720 skip button, P4: Desktop log font >= 14px, P5: L14 Card height/proportions, P6: L15 Key hints duplication & coach avoidance & hint uniqueness)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";
import { passCutscene } from "./helpers/flow.mjs";

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

const DESKTOP_SIZES = [
  { name: "1024x768", w: 1024, h: 768 },
  { name: "1280x720", w: 1280, h: 720 },
  { name: "1280x800", w: 1280, h: 800 },
  { name: "1366x768", w: 1366, h: 768 },
  { name: "1440x900", w: 1440, h: 900 },
  { name: "1920x1080", w: 1920, h: 1080 },
];

async function waitSettled(page, condition) {
  if (condition) await page.waitForFunction(condition, null, { timeout: 10000 });
  else await page.waitForFunction(() => !!window.__zz && (window.__zz.st?.phase === "card" || window.__zz.st?.phase === "engrave"), null, { timeout: 10000 });
  await page.waitForFunction(() => !window.__zz?.animating, null, { timeout: 5000 });
  await page.waitForTimeout(300);
}

async function commitCard(page, dir) {
  await page.waitForFunction(() => !window.__zz?.animating, null, { timeout: 5000 });
  await page.waitForTimeout(200);
  const k = dir === "left" ? "ArrowLeft" : "ArrowRight";
  await page.keyboard.press(k);
  await page.waitForTimeout(60);
  await page.keyboard.press(k);
  await page.waitForFunction(() => !window.__zz?.animating, null, { timeout: 5000 });
  await page.waitForTimeout(400);
  await passCutscene(page);
}

for (const [engine] of Object.entries(ENGINES)) {
  // ==========================================
  // P1. S1/S8 「K 刻字」 at 1280-class widths
  // ==========================================
  for (const vp of [
    { name: "1280x720", w: 1280, h: 720 },
    { name: "1280x800", w: 1280, h: 800 },
  ]) {
    test(`${engine} ${vp.name}: P1 K hint visible only when bone chip available, absent otherwise`, { timeout: 60000 }, async () => {
      const ctx = await browsers[engine].newContext({ viewport: { width: vp.w, height: vp.h } });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);

      try {
        await page.goto(`${server.origin}/?seed=20261016`, { waitUntil: "load" });
        await waitSettled(page);

        // On T01: No bone chip available -> K 刻字 must NOT appear in any rendered element
        const carriersNoBone = await page.evaluate(() => {
          const all = [...document.querySelectorAll("body *")];
          return all.filter((e) => {
            if (e.closest("#card-title,#card-text,.card-head,#drawer-body,#sidebar-body,.optbtn")) return false;
            const cs = getComputedStyle(e);
            if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return false;
            if (!e.offsetParent && cs.position !== "fixed") return false;
            const txt = (e.innerText || "").replace(/\s+/g, " ").trim();
            return /卡角.{0,2}骨片|点骨片|骨片「刻」|K\s*刻字|按\s*K\b/.test(txt);
          }).map(e => e.id || e.className || e.tagName);
        });
        assert.equal(carriersNoBone.length, 0, `No bone chip on T01: must not mention K 刻字/骨片, found in: ${carriersNoBone.join(", ")}`);

        // Real input to advance T01 -> T02 -> T03 (engrave phase)
        await commitCard(page, "left");
        assert.equal(await page.evaluate(() => window.__zz.st?.current), "T02");

        await commitCard(page, "right");
        assert.equal(await page.evaluate(() => window.__zz.st?.phase), "engrave");

        // On T03: Bone chip is available (#bonecorner shown) -> K hint MUST be present and visible
        const kCheck = await page.evaluate(() => {
          const keys = document.querySelector("#keys");
          if (!keys) return { found: false, msg: "no #keys" };
          const cs = getComputedStyle(keys);
          if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") {
            return { found: false, msg: "keys hidden" };
          }
          const text = (keys.innerText || "").replace(/\s+/g, " ").trim();
          const hasK = text.includes("K 刻字") || text.includes("K刻");
          const r = keys.getBoundingClientRect();
          const inView = r.top >= 0 && r.bottom <= window.innerHeight + 1 && r.left >= 0 && r.right <= window.innerWidth + 1;

          // elementFromPoint at centre of #keys
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const hit = document.elementFromPoint(cx, cy);
          const hitKeys = hit === keys || keys.contains(hit);

          return { found: hasK, text, inView, hitKeys, r };
        });

        assert.ok(kCheck.found, `Bone chip available on T03: #keys must contain 'K 刻字' or 'K刻', got: '${kCheck.text}'`);
        assert.ok(kCheck.inView, `#keys must be inside viewport`);
        assert.ok(kCheck.hitKeys, `#keys centre must be hit via elementFromPoint`);
        assert.deepEqual(errs, []);
      } finally {
        await ctx.close();
      }
    });
  }

  // ==========================================
  // P2. PC overflow D3/H5 at all 6 desktop sizes
  // ==========================================
  for (const vp of DESKTOP_SIZES) {
    test(`${engine} ${vp.name}: P2 PC overflow D3/H5 engrave box & skip button & used slot inside bounds`, { timeout: 60000 }, async () => {
      const ctx = await browsers[engine].newContext({ viewport: { width: vp.w, height: vp.h } });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);

      try {
        await page.goto(`${server.origin}/?seed=20261016`, { waitUntil: "load" });
        await waitSettled(page);

        // Set card with long trace text in engrave phase and a dropped wordbox slot
        await page.evaluate(() => {
          window.__zz.st.current = "C02";
          window.__zz.st.phase = "engrave";
          window.__zz.st.pendingTrace = {
            target: "本",
            tally_text: "坡上的土被雨冲开，那截老干脚下露出一团盘结的须，顺着往深处挖，越挖越粗，最粗的一股一直扎进石缝里",
          };
          window.__zz.st.dropped = ["水"];
          window.__zz.render();
        });

        const check = await page.evaluate(() => {
          const d = document.querySelector("#card-drops");
          const card = document.querySelector("#card");
          const btn = d.querySelector("button.act[data-do=skip]");
          const dr = d.getBoundingClientRect();
          const cr = card.getBoundingClientRect();
          const br = btn ? btn.getBoundingClientRect() : null;

          const slot = document.querySelector("button.slot.used");
          const span = slot ? slot.querySelector("span") : null;
          const sr = slot ? slot.getBoundingClientRect() : null;
          const pr = span ? span.getBoundingClientRect() : null;

          const dScrollOk = d.scrollWidth <= d.clientWidth + 1;
          const cScrollOk = card.scrollWidth <= card.clientWidth + 1;
          const slotScrollOk = slot ? slot.scrollWidth <= slot.clientWidth + 1 : false;
          const spanScrollOk = span ? span.scrollWidth <= span.clientWidth + 1 : false;

          const btnInsideD = br ? (br.left >= dr.left - 1 && br.right <= dr.right + 1 && br.top >= dr.top - 1 && br.bottom <= dr.bottom + 1) : false;
          const dInsideC = dr.left >= cr.left - 1 && dr.right <= cr.right + 1 && dr.top >= cr.top - 1 && dr.bottom <= cr.bottom + 1;
          const spanInsideSlot = (pr && sr) ? (pr.left >= sr.left - 1 && pr.right <= sr.right + 1 && pr.top >= sr.top - 1 && pr.bottom <= sr.bottom + 1) : false;

          return {
            dScrollOk, cScrollOk, slotScrollOk, spanScrollOk,
            btnInsideD, dInsideC, spanInsideSlot,
            dScrollW: d.scrollWidth, dClientW: d.clientWidth,
            dr, cr, br, sr, pr,
          };
        });

        assert.ok(check.dScrollOk, `Carving box scrollWidth <= clientWidth + 1 (${check.dScrollW} vs ${check.dClientW})`);
        assert.ok(check.cScrollOk, `Card scrollWidth <= clientWidth + 1`);
        assert.ok(check.btnInsideD, `Skip button inside carving box ±1px: btn=${JSON.stringify(check.br)} drops=${JSON.stringify(check.dr)}`);
        assert.ok(check.dInsideC, `Carving box inside card ±1px: drops=${JSON.stringify(check.dr)} card=${JSON.stringify(check.cr)}`);
        assert.ok(check.slotScrollOk, `Slot scrollWidth <= clientWidth + 1`);
        assert.ok(check.spanScrollOk, `Slot span scrollWidth <= clientWidth + 1`);
        assert.ok(check.spanInsideSlot, `Used slot span text inside slot button ±1px: span=${JSON.stringify(check.pr)} slot=${JSON.stringify(check.sr)}`);

        assert.deepEqual(errs, []);
      } finally {
        await ctx.close();
      }
    });
  }

  // ==========================================
  // P3. 1280x720 「先不刻」 clipped
  // ==========================================
  test(`${engine} 1280x720: P3 skip button fully visible and clickable without changing card overflow`, { timeout: 60000 }, async () => {
    const ctx = await browsers[engine].newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);

    try {
      await page.goto(`${server.origin}/?seed=20261016`, { waitUntil: "load" });
      await waitSettled(page);

      // Reach C02 with trace text in engrave state
      await page.evaluate(() => {
        window.__zz.st.current = "C02";
        window.__zz.st.phase = "engrave";
        window.__zz.st.pendingTrace = {
          target: "本",
          tally_text: "坡上的土被雨冲开，那截老干脚下露出一团盘结的须，顺着往深处挖，越挖越粗，最粗的一股一直扎进石缝里",
        };
        window.__zz.render();
      });

      const overflowVal = await page.evaluate(() => getComputedStyle(document.querySelector("#card")).overflow);
      assert.equal(overflowVal, "hidden", "Card overflow must remain hidden (must fix by layout, not overflow property)");

      // 5x3 elementFromPoint sampling hits skip button
      const efpResult = await page.evaluate(() => {
        const btn = document.querySelector("#card-drops button.act[data-do=skip]");
        if (!btn) return { ok: false, msg: "Button not found" };
        const br = btn.getBoundingClientRect();
        for (let xi = 0; xi < 5; xi++) {
          for (let yi = 0; yi < 3; yi++) {
            const px = br.left + (br.width * (xi + 0.5)) / 5;
            const py = br.top + (br.height * (yi + 0.5)) / 3;
            const hit = document.elementFromPoint(px, py);
            if (!hit || (hit !== btn && !btn.contains(hit))) {
              return { ok: false, msg: `Point (${px.toFixed(1)}, ${py.toFixed(1)}) hit ${hit?.tagName || 'null'} instead of skip button` };
            }
          }
        }
        return { ok: true, br };
      });
      assert.ok(efpResult.ok, efpResult.msg);
      assert.ok(efpResult.br.width >= 44 && efpResult.br.height >= 44, `Skip button must be >= 44x44 CSS px, got ${efpResult.br.width}x${efpResult.br.height}`);

      // Real mouse click on skip button triggers skip_engrave
      const cx = efpResult.br.left + efpResult.br.width / 2;
      const cy = efpResult.br.top + efpResult.br.height / 2;
      await page.mouse.click(cx, cy);

      await page.waitForFunction(() => window.__zz.st?.phase !== "engrave", null, { timeout: 5000 });
      const phase = await page.evaluate(() => window.__zz.st?.phase);
      assert.equal(phase, "card", "Clicking skip button must transition phase out of engrave");

      assert.deepEqual(errs, []);
    } finally {
      await ctx.close();
    }
  });

  // ==========================================
  // P4. Desktop log text font-size >= 14px
  // ==========================================
  for (const vp of DESKTOP_SIZES) {
    test(`${engine} ${vp.name}: P4 Desktop log text font-size >= 14px with no overflow`, { timeout: 60000 }, async () => {
      const ctx = await browsers[engine].newContext({ viewport: { width: vp.w, height: vp.h } });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);

      try {
        await page.goto(`${server.origin}/?seed=20261016`, { waitUntil: "load" });
        await waitSettled(page);

        // Ensure sidebar is expanded to check #log
        await page.evaluate(() => {
          const sb = document.querySelector("#sidebar");
          if (sb) sb.classList.remove("collapsed");
        });

        const logInfo = await page.evaluate(() => {
          const log = document.querySelector("#log");
          if (!log) return null;
          const cs = getComputedStyle(log);
          const fs = parseFloat(cs.fontSize);
          const scrollOk = log.scrollWidth <= log.clientWidth + 1;
          const sb = document.querySelector("#sidebar");
          const sbScrollOk = sb ? sb.scrollWidth <= sb.clientWidth + 1 : true;
          return { fs, scrollOk, sbScrollOk };
        });

        assert.ok(logInfo, "#log should exist in sidebar");
        assert.ok(logInfo.fs >= 14, `Log font-size must be >= 14px, got ${logInfo.fs}px`);
        assert.ok(logInfo.scrollOk, `#log scrollWidth <= clientWidth + 1`);
        assert.ok(logInfo.sbScrollOk, `#sidebar scrollWidth <= clientWidth + 1`);

        assert.deepEqual(errs, []);
      } finally {
        await ctx.close();
      }
    });
  }

  // ==========================================
  // P5. L14 Card sizing clamp(468px, 100dvh - 280px, 640px) & content fills taller card
  // ==========================================
  for (const vp of [
    { name: "1366x768", w: 1366, h: 768, expH: 488 },
    { name: "1440x900", w: 1440, h: 900, expH: 620 },
    { name: "1920x1080", w: 1920, h: 1080, expH: 640 },
  ]) {
    test(`${engine} ${vp.name}: P5 L14 card respects clamp sizing (h=${vp.expH}) & card-art fills card on C02`, { timeout: 60000 }, async () => {
      const ctx = await browsers[engine].newContext({ viewport: { width: vp.w, height: vp.h } });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);

      try {
        await page.goto(`${server.origin}/?seed=20261016`, { waitUntil: "load" });
        await waitSettled(page);

        const cardDim = await page.evaluate(() => {
          const card = document.querySelector("#card");
          const r = card.getBoundingClientRect();
          return { w: r.width, h: r.height, ratio: r.width / r.height };
        });

        // Designer proportion is 328:468 (ratio ~0.70085)
        const expRatio = 328 / 468;
        assert.ok(
          Math.abs(cardDim.ratio - expRatio) <= 0.02,
          `Card aspect ratio should be ~${expRatio.toFixed(3)}, got ${cardDim.ratio.toFixed(3)} (${cardDim.w}x${cardDim.h})`
        );
        assert.ok(
          Math.abs(cardDim.h - vp.expH) <= 2,
          `Card height on desktop should match clamp formula (exp ${vp.expH}px ±2), got ${cardDim.h}`
        );
        assert.ok(cardDim.h <= 640.5, `Card height must not exceed 640px max-height, got ${cardDim.h}`);

        // Check C02: card content fills taller card (card-art flex: 1 1 auto)
        const c02Info = await page.evaluate(() => {
          window.__zz.st.current = "C02";
          window.__zz.st.phase = "card";
          window.__zz.render();
          const card = document.querySelector("#card");
          const art = document.querySelector("#card-art");
          const cr = card.getBoundingClientRect();
          const ar = art.getBoundingClientRect();
          return {
            artVis: !art.hidden && getComputedStyle(art).display !== "none",
            artH: ar.height,
            cardH: cr.height,
            artRatio: ar.height / cr.height,
          };
        });

        assert.ok(c02Info.artVis, "C02 card-art must be visible");
        assert.ok(c02Info.artRatio > 0.5, `C02 card-art should expand to fill card (>50% card height), got ${(c02Info.artRatio * 100).toFixed(1)}%`);

        assert.deepEqual(errs, []);
      } finally {
        await ctx.close();
      }
    });
  }

  // Ultrawide / 2K out of scope: no crash, no errors
  for (const vp of [
    { name: "2560x1440", w: 2560, h: 1440 },
    { name: "3440x1440", w: 3440, h: 1440 },
  ]) {
    test(`${engine} ${vp.name} [regression guard]: ultrawide no crash and card height capped at 640`, { timeout: 60000 }, async () => {
      const ctx = await browsers[engine].newContext({ viewport: { width: vp.w, height: vp.h } });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);

      try {
        await page.goto(`${server.origin}/?seed=20261016`, { waitUntil: "load" });
        await waitSettled(page);

        const cardH = await page.evaluate(() => document.querySelector("#card").getBoundingClientRect().height);
        assert.ok(cardH <= 640.5, `Card height capped at 640px, got ${cardH}`);
        assert.deepEqual(errs, []);
      } finally {
        await ctx.close();
      }
    });
  }

  // ==========================================
  // P6. L15 Duplicate key hints & coach avoidance & hint uniqueness
  // ==========================================
  for (const vp of DESKTOP_SIZES) {
    test(`${engine} ${vp.name}: P6 L15 key hint appears in exactly one place and not covered by coach`, { timeout: 60000 }, async () => {
      const ctx = await browsers[engine].newContext({ viewport: { width: vp.w, height: vp.h } });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);

      try {
        await page.goto(`${server.origin}/?seed=20261016`, { waitUntil: "load" });
        await waitSettled(page);

        // Helper to check hint uniqueness across visible elements
        const checkHintUniqueness = async (stateLabel, expectedSegments) => {
          return await page.evaluate(({ expectedSegments }) => {
            const results = {};
            const allElements = [...document.querySelectorAll("body *")];

            for (const seg of expectedSegments) {
              const matchedVisible = [];
              for (const el of allElements) {
                // Ignore elements that contain other elements containing the text (only find deepest or direct carrier)
                const cs = getComputedStyle(el);
                if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) <= 0) continue;
                if (!el.offsetParent && cs.position !== "fixed") continue;
                const r = el.getBoundingClientRect();
                if (r.width <= 0 || r.height <= 0) continue;

                // Check own text or whether direct children repeat it
                const text = (el.innerText || "").replace(/\s+/g, " ").trim();
                if (text.includes(seg)) {
                  // Ensure no child element also matches (deepest carrier only)
                  const childHas = [...el.children].some(c => (c.innerText || "").replace(/\s+/g, " ").trim().includes(seg));
                  if (!childHas) {
                    // Check elementFromPoint at centre is not covered
                    const cx = r.left + r.width / 2;
                    const cy = r.top + r.height / 2;
                    const hit = document.elementFromPoint(cx, cy);
                    const notCovered = hit ? (hit === el || el.contains(hit) || hit.contains(el)) : false;
                    matchedVisible.push({
                      id: el.id,
                      tag: el.tagName,
                      cls: el.className,
                      notCovered,
                      text: text.slice(0, 30),
                    });
                  }
                }
              }
              results[seg] = matchedVisible;
            }
            return results;
          }, { expectedSegments });
        };

        // 1. T01 with coach
        const segsT01 = vp.h <= 760
          ? ["1–3落字", "Space分量", "左右拖卡做选择"]
          : ["1–3 落字", "按住 Space 看分量", "左右拖卡做选择"];
        const resT01 = await checkHintUniqueness("T01", segsT01);
        for (const seg of segsT01) {
          const list = resT01[seg];
          assert.equal(
            list.length,
            1,
            `On T01, hint '${seg}' must appear in exactly ONE visible element, found ${list.length}: ${JSON.stringify(list)}`
          );
          assert.ok(list[0].notCovered, `On T01, element containing '${seg}' must not be covered per elementFromPoint`);
        }
        // K 刻字 / K刻 must be in 0 visible elements on T01
        const kSegT01 = vp.h <= 760 ? "K刻" : "K 刻字";
        const resK_T01 = await checkHintUniqueness("T01", [kSegT01]);
        assert.equal(resK_T01[kSegT01].length, 0, `On T01, '${kSegT01}' must appear in 0 visible elements`);

        // Advance to T02 (normal card, coach hidden)
        await commitCard(page, "left");
        assert.equal(await page.evaluate(() => window.__zz.st?.current), "T02");

        const segsT02 = vp.h <= 760
          ? ["1–3落字", "Space分量"]
          : ["1–3 落字", "按住 Space 看分量"];
        const resT02 = await checkHintUniqueness("T02", segsT02);
        for (const seg of segsT02) {
          const list = resT02[seg];
          assert.equal(
            list.length,
            1,
            `On T02, hint '${seg}' must appear in exactly ONE visible element, found ${list.length}: ${JSON.stringify(list)}`
          );
          assert.ok(list[0].notCovered, `On T02, element containing '${seg}' must not be covered`);
        }

        // Advance to T03 (engrave state, bone chip available)
        await commitCard(page, "right");
        assert.equal(await page.evaluate(() => window.__zz.st?.phase), "engrave");

        // R12 / D1: In engrave phase, keys bar drops decision keys (1-3, Space) and shows only K 刻字 · S 先不刻 · 卡已定住
        const segsT03 = ["K 刻字"];
        const resT03 = await checkHintUniqueness("T03", segsT03);
        for (const seg of segsT03) {
          const list = resT03[seg];
          assert.equal(
            list.length,
            1,
            `On T03, hint '${seg}' must appear in exactly ONE visible element, found ${list.length}: ${JSON.stringify(list)}`
          );
          assert.ok(list[0].notCovered, `On T03, element containing '${seg}' must not be covered`);
        }

        assert.deepEqual(errs, []);
      } finally {
        await ctx.close();
      }
    });
  }
}
