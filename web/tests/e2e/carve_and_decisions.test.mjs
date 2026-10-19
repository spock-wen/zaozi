// e2e T5 Carve phase visibility, N3 card text not clipped, T7 product decisions (Q3, Q9, Q15)
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

const MAINSTREAM_17 = [
  // 7 phones
  { name: "375x667", w: 375, h: 667, isPhone: true },
  { name: "360x800", w: 360, h: 800, isPhone: true },
  { name: "390x844", w: 390, h: 844, isPhone: true },
  { name: "393x852", w: 393, h: 852, isPhone: true },
  { name: "412x915", w: 412, h: 915, isPhone: true },
  { name: "430x932", w: 430, h: 932, isPhone: true },
  { name: "390x664", w: 390, h: 664, isPhone: true },
  // 3 tablets
  { name: "768x1024", w: 768, h: 1024, isTablet: true },
  { name: "820x1180", w: 820, h: 1180, isTablet: true },
  { name: "1024x768", w: 1024, h: 768, isTablet: true },
  // 5 desktops
  { name: "1280x720", w: 1280, h: 720, isDesktop: true },
  { name: "1280x800", w: 1280, h: 800, isDesktop: true },
  { name: "1366x768", w: 1366, h: 768, isDesktop: true },
  { name: "1440x900", w: 1440, h: 900, isDesktop: true },
  { name: "1920x1080", w: 1920, h: 1080, isDesktop: true },
  // 2 in-scope extra
  { name: "900x600", w: 900, h: 600, isDesktop: true },
  { name: "960x600", w: 960, h: 600, isDesktop: true },
];

for (const [engine] of Object.entries(ENGINES)) {
  // ==========================================
  // T5. Carve phase visibility rule across all 17 mainstream sizes
  // ==========================================
  for (const vp of MAINSTREAM_17) {
    const isDesk = vp.w >= 1024 || vp.isDesktop;
    const testTitle = isDesk
      ? `${engine} ${vp.name} [regression guard]: T5 carve phase usable entries visible & >=44x44, options hidden`
      : `${engine} ${vp.name}: T5 carve phase usable entries visible & >=44x44, options hidden`;

    test(testTitle, { timeout: 60000 }, async () => {
      const ctx = await browsers[engine].newContext({ viewport: { width: vp.w, height: vp.h } });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);

      try {
        await page.goto(`${server.origin}/?seed=20261016`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz && window.__zz.st?.current === "T01");

        // Advance to T03 engrave
        await page.evaluate(() => {
          window.__zz.dispatch({ type: "choose", side: "left" });
          window.__zz.dispatch({ type: "choose", side: "right" });
        });
        await page.waitForFunction(() => window.__zz.st?.phase === "engrave");

        // Helper to check 5x3 elementFromPoint
        const checkEntryHit = async (selector, label) => {
          return await page.evaluate(({ selector, label }) => {
            const el = document.querySelector(selector);
            if (!el || el.hidden || getComputedStyle(el).display === "none" || getComputedStyle(el).visibility === "hidden") {
              return { ok: false, msg: `${label} not visible` };
            }
            const r = el.getBoundingClientRect();
            const vw = window.innerWidth, vh = window.innerHeight;
            if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1) {
              return { ok: false, msg: `${label} out of viewport [${r.left}, ${r.top}, ${r.right}, ${r.bottom}]` };
            }
            if (r.width < 44 || r.height < 44) {
              return { ok: false, msg: `${label} size ${r.width.toFixed(1)}x${r.height.toFixed(1)} < 44x44` };
            }

            for (let xi = 0; xi < 5; xi++) {
              for (let yi = 0; yi < 3; yi++) {
                const px = r.left + (r.width * (xi + 0.5)) / 5;
                const py = r.top + (r.height * (yi + 0.5)) / 3;
                const top = document.elementFromPoint(px, py);
                if (!top || (top !== el && !el.contains(top))) {
                  return { ok: false, msg: `${label} covered at (${px.toFixed(1)}, ${py.toFixed(1)}) by ${top?.tagName || 'null'}` };
                }
              }
            }
            return { ok: true, r };
          }, { selector, label });
        };

        // 1. In T03 engrave:
        // Options hidden
        const optsHidden = await page.evaluate(() => {
          const ol = document.querySelector("#opt-left");
          const or = document.querySelector("#opt-right");
          return getComputedStyle(ol).visibility === "hidden" && getComputedStyle(or).visibility === "hidden";
        });
        assert.ok(optsHidden, "T03 engrave: options must have visibility: hidden");

        // Bonecorner visible, >=44x44, hit by 5x3
        const bcCheck = await checkEntryHit("#bonecorner", "T03 bonecorner");
        assert.ok(bcCheck.ok, bcCheck.msg);

        // Skip button visible, >=44x44, hit by 5x3
        const skipCheck = await checkEntryHit("#card-drops button.act[data-do=skip]", "T03 skip button");
        assert.ok(skipCheck.ok, skipCheck.msg);

        // On keyboard devices: K 刻字 hint visible
        if (vp.w >= 1024) {
          const kHintOk = await page.evaluate(() => {
            const keys = document.querySelector("#keys");
            const gest = document.querySelector("#gesture-hint");
            const kt = keys ? keys.innerText : "";
            const gt = gest ? gest.innerText : "";
            return kt.includes("K 刻字") || gt.includes("K 刻字");
          });
          assert.ok(kHintOk, "On desktop/keyboard, 'K 刻字' hint must be visible");
        }

        // Real click on 先不刻 skips -> advances to next state
        const scx = skipCheck.r.left + skipCheck.r.width / 2;
        const scy = skipCheck.r.top + skipCheck.r.height / 2;
        await page.mouse.click(scx, scy);
        await page.waitForFunction(() => window.__zz.st?.phase !== "engrave", null, { timeout: 5000 });
        assert.equal(await page.evaluate(() => window.__zz.st?.phase), "card", "Skipping T03 transitions to card phase");

        // 2. Normal card engrave (C02 刻):
        await page.evaluate(() => {
          window.__zz.st.current = "C02";
          window.__zz.st.phase = "engrave";
          window.__zz.st.pendingTrace = {
            target: "本",
            tally_text: "坡上的土被雨冲开，那截老干脚下露出一团盘结的须",
          };
          window.__zz.render();
        });
        await page.waitForFunction(() => window.__zz.st?.current === "C02" && window.__zz.st?.phase === "engrave");

        const bcC02 = await checkEntryHit("#bonecorner", "C02 bonecorner");
        assert.ok(bcC02.ok, bcC02.msg);

        const skipC02 = await checkEntryHit("#card-drops button.act[data-do=skip]", "C02 skip button");
        assert.ok(skipC02.ok, skipC02.msg);

        // Real click on 刻 engraves -> advances
        const bcx = bcC02.r.left + bcC02.r.width / 2;
        const bcy = bcC02.r.top + bcC02.r.height / 2;
        await page.mouse.click(bcx, bcy);
        await page.waitForFunction(() => window.__zz.st.log.some(l => l.startsWith("刻事签")), null, { timeout: 5000 });
        const engravedOk = await page.evaluate(() => window.__zz.st.log.some(l => l.startsWith("刻事签")));
        assert.ok(engravedOk, "Clicking 刻 engraves successfully and logs 刻事签");

        assert.deepEqual(errs, []);
      } finally {
        await ctx.close();
      }
    });
  }

  // ==========================================
  // N3. Card text not clipped at all 7 phone sizes + tablets for T01..T05, C01..C10
  // ==========================================
  const N3_VIEWPORTS = [
    { name: "375x667", w: 375, h: 667 },
    { name: "360x800", w: 360, h: 800 },
    { name: "390x844", w: 390, h: 844 },
    { name: "393x852", w: 393, h: 852 },
    { name: "412x915", w: 412, h: 915 },
    { name: "430x932", w: 430, h: 932 },
    { name: "390x664", w: 390, h: 664 },
    { name: "768x1024", w: 768, h: 1024 },
    { name: "820x1180", w: 820, h: 1180 },
    { name: "1024x768", w: 1024, h: 768 },
  ];

  for (const vp of N3_VIEWPORTS) {
    const isTablet = vp.w >= 768;
    const testTitle = isTablet
      ? `${engine} ${vp.name} [regression guard]: N3 card text not clipped for all cards T01..T05, C01..C10`
      : `${engine} ${vp.name}: N3 card text not clipped for all cards T01..T05, C01..C10`;

    test(testTitle, { timeout: 90000 }, async () => {
      const ctx = await browsers[engine].newContext({ viewport: { width: vp.w, height: vp.h } });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);

      try {
        await page.goto(`${server.origin}/?seed=20261016`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz && window.__zz.st?.current === "T01");

        const cardsToCheck = ["T01", "T02", "T03", "T04", "T05", "C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08", "C09", "C10"];

        for (const cid of cardsToCheck) {
          const res = await page.evaluate((id) => {
            // N3 strengthened (engineering review of b81125d found real clipping/overlap
            // at 375x667 & 390x664, e.g. #card-drops rendered on top of #card-text lines).
            // For every text node inside #card (#card-title, #card-text, .card-head speaker/
            // season, #card-drops) walk each *line* via Range.getClientRects() and require:
            //   1) the line rect is fully inside the card's visible box
            //      (card rect ∩ every ancestor's overflow clip rect),
            //   2) the line rect is inside the viewport,
            //   3) no other visible #card child overlaps the line rect
            //      (catches card-drops covering card-text lines).
            const TOL = 1.5;
            const fmt = (r) => `[${r.left.toFixed(1)}, ${r.top.toFixed(1)}, ${r.right.toFixed(1)}, ${r.bottom.toFixed(1)}]`;
            const contains = (outer, inner) =>
              inner.left >= outer.left - TOL && inner.right <= outer.right + TOL &&
              inner.top >= outer.top - TOL && inner.bottom <= outer.bottom + TOL;
            const inter = (a, b) => ({
              left: Math.max(a.left, b.left),
              top: Math.max(a.top, b.top),
              right: Math.min(a.right, b.right),
              bottom: Math.min(a.bottom, b.bottom),
            });
            const hits = (a, b) =>
              a.left < b.right - TOL && b.left < a.right - TOL && a.top < b.bottom - TOL && b.top < a.bottom - TOL;

            window.__zz.st.current = id;
            window.__zz.st.phase = "card";
            window.__zz.render();

            const card = document.querySelector("#card");
            if (!card) return { ok: false, msg: `${id}: #card missing` };
            const cr = card.getBoundingClientRect();

            // Card's visible box: intersect every ancestor that clips overflow.
            let vbox = { left: cr.left, top: cr.top, right: cr.right, bottom: cr.bottom };
            for (let p = card.parentElement; p && p !== document.body; p = p.parentElement) {
              const cs = getComputedStyle(p);
              if (cs.overflow !== "visible" || cs.overflowX !== "visible" || cs.overflowY !== "visible") {
                const pr = p.getBoundingClientRect();
                vbox = inter(vbox, { left: pr.left, top: pr.top, right: pr.right, bottom: pr.bottom });
              }
            }

            const boxes = [];
            for (const sel of [".card-head", "#card-title", "#card-text", "#card-drops"]) {
              const el = document.querySelector(sel);
              if (!el) return { ok: false, msg: `${id}: ${sel} missing` };
              if (el.hidden || getComputedStyle(el).display === "none" || getComputedStyle(el).visibility === "hidden") continue;
              boxes.push({ el, label: sel });
            }
            // Every other visible #card child is a potential overlapper.
            const others = Array.from(card.children)
              .filter((el) => !boxes.some((b) => b.el === el) && !el.hidden && getComputedStyle(el).display !== "none")
              .map((el) => ({ el, label: el.id || el.className || el.tagName }));

            for (const b of boxes) {
              const walker = document.createTreeWalker(b.el, NodeFilter.SHOW_TEXT);
              let lines = 0;
              while (walker.nextNode()) {
                const node = walker.currentNode;
                if (!node.nodeValue.trim()) continue;
                const range = document.createRange();
                range.selectNodeContents(node);
                for (const rect of range.getClientRects()) {
                  if (rect.width <= 0 || rect.height <= 0) continue;
                  lines++;
                  if (!contains(cr, rect)) {
                    return { ok: false, msg: `${id}: ${b.label} line ${fmt(rect)} not inside card ${fmt(cr)}` };
                  }
                  if (!contains(vbox, rect)) {
                    return { ok: false, msg: `${id}: ${b.label} line ${fmt(rect)} clipped by ancestor overflow (visible ${fmt(vbox)})` };
                  }
                  if (rect.left < -0.5 || rect.top < -0.5 || rect.right > window.innerWidth + 0.5 || rect.bottom > window.innerHeight + 0.5) {
                    return { ok: false, msg: `${id}: ${b.label} line ${fmt(rect)} outside viewport` };
                  }
                  for (const o of [...boxes, ...others]) {
                    if (o.el === b.el || b.el.contains(o.el)) continue;
                    const orr = o.el.getBoundingClientRect();
                    if (orr.width <= 0 || orr.height <= 0) continue;
                    if (hits(rect, orr)) {
                      return { ok: false, msg: `${id}: ${b.label} line ${fmt(rect)} overlapped by ${o.label} ${fmt(orr)}` };
                    }
                  }
                }
              }
              if (lines === 0) return { ok: false, msg: `${id}: ${b.label} has no visible text lines` };
            }
            return { ok: true };
          }, cid);

          assert.ok(res.ok, res.msg);
        }

        assert.deepEqual(errs, []);
      } finally {
        await ctx.close();
      }
    });
  }

  // ==========================================
  // T7 Q3=A: On new game / import, clear visible toast and pending lock hint; reset state
  // ==========================================
  test(`${engine} 390x844: Q3=A new game / import clears visible toast and resets state clean`, { timeout: 30000 }, async () => {
    const ctx = await browsers[engine].newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);

    try {
      await page.goto(`${server.origin}/?seed=20261016`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz && window.__zz.st?.current === "T01");

      // Advance to T03 engrave
      await page.evaluate(() => {
        window.__zz.dispatch({ type: "choose", side: "left" });
        window.__zz.dispatch({ type: "choose", side: "right" });
      });
      await page.waitForFunction(() => window.__zz.st?.phase === "engrave");

      // Show lock toast
      await page.evaluate(() => {
        window.__zz.toast("先点卡角骨片刻下这件事");
      });
      await page.waitForSelector("#toast.on", { timeout: 3000 });

      // Click menu button
      await page.locator("#menubtn").click();
      await page.waitForSelector("#menu-pop:not([hidden])", { timeout: 3000 });

      // Click 重新开局
      await page.locator('#menu-pop button[data-menu="new"]').click();
      await page.waitForFunction(() => window.__zz.st?.current === "T01", null, { timeout: 5000 });

      // Toast must NOT be visible in new game
      const toastVisible = await page.evaluate(() => {
        const t = document.querySelector("#toast");
        return t && t.classList.contains("on");
      });
      assert.equal(toastVisible, false, "No toast should be visible in the new game after clicking 重新开局");

      // T01 state clean
      const stateClean = await page.evaluate(() => {
        return window.__zz.st.current === "T01" && window.__zz.actions.length === 0 && !window.__zz.animating;
      });
      assert.ok(stateClean, "T01 state must be clean");

      assert.deepEqual(errs, []);
    } finally {
      await ctx.close();
    }
  });

  // ==========================================
  // T7 Q9=A: Pressing K engraves and S skips, dismissing hint toast immediately
  // ==========================================
  test(`${engine} 1280x800: Q9=A keyboard K engraves and S skips, dismissing hint toast immediately`, { timeout: 30000 }, async () => {
    const ctx = await browsers[engine].newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);

    try {
      await page.goto(`${server.origin}/?seed=20261016`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz && window.__zz.st?.current === "T01");

      // Advance to T03 engrave
      await page.evaluate(() => {
        window.__zz.dispatch({ type: "choose", side: "left" });
        window.__zz.dispatch({ type: "choose", side: "right" });
      });
      await page.waitForFunction(() => window.__zz.st?.phase === "engrave");

      // Show lock toast
      await page.evaluate(() => {
        window.__zz.toast("先点卡角骨片刻下这件事");
      });
      await page.waitForSelector("#toast.on", { timeout: 3000 });

      // Press S (skip) -> immediately dismisses toast
      await page.keyboard.press("KeyS");
      await page.waitForFunction(() => window.__zz.st?.phase === "card", null, { timeout: 5000 });

      const toastDismissedS = await page.evaluate(() => !document.querySelector("#toast").classList.contains("on"));
      assert.ok(toastDismissedS, "Pressing S must immediately dismiss the hint toast");

      // Advance to C02 engrave
      await page.evaluate(() => {
        window.__zz.st.current = "C02";
        window.__zz.st.phase = "engrave";
        window.__zz.st.pendingTrace = {
          target: "本",
          tally_text: "老干脚下盘结的须",
        };
        window.__zz.render();
        window.__zz.toast("先点卡角骨片刻下这件事");
      });
      await page.waitForSelector("#toast.on", { timeout: 3000 });

      // Press K -> engraves and immediately dismisses toast
      await page.keyboard.press("KeyK");
      await page.waitForFunction(() => window.__zz.st.log.some(l => l.startsWith("刻事签")), null, { timeout: 5000 });

      const toastDismissedK = await page.evaluate(() => !document.querySelector("#toast").classList.contains("on"));
      assert.ok(toastDismissedK, "Pressing K must immediately dismiss the hint toast");

      assert.deepEqual(errs, []);
    } finally {
      await ctx.close();
    }
  });

  test(`${engine} 390x844: Q9=A touch tapping 刻 and 先不刻 dismisses hint toast immediately`, { timeout: 30000 }, async () => {
    const ctx = await browsers[engine].newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);

    try {
      await page.goto(`${server.origin}/?seed=20261016`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz && window.__zz.st?.current === "T01");

      // Advance to T03 engrave
      await page.evaluate(() => {
        window.__zz.dispatch({ type: "choose", side: "left" });
        window.__zz.dispatch({ type: "choose", side: "right" });
      });
      await page.waitForFunction(() => window.__zz.st?.phase === "engrave");

      // Show lock toast
      await page.evaluate(() => {
        window.__zz.toast("先点卡角骨片刻下这件事");
      });
      await page.waitForSelector("#toast.on", { timeout: 3000 });

      // Tap 先不刻
      await page.locator('#card-drops button.act[data-do="skip"]').tap();
      await page.waitForFunction(() => window.__zz.st?.phase === "card", null, { timeout: 5000 });

      const toastDismissedTapSkip = await page.evaluate(() => !document.querySelector("#toast").classList.contains("on"));
      assert.ok(toastDismissedTapSkip, "Tapping 先不刻 must immediately dismiss the hint toast");

      // Advance to C02 engrave and test tapping 刻
      await page.evaluate(() => {
        window.__zz.st.current = "C02";
        window.__zz.st.phase = "engrave";
        window.__zz.st.pendingTrace = {
          target: "本",
          tally_text: "老干脚下盘结的须",
        };
        window.__zz.render();
        window.__zz.toast("先点卡角骨片刻下这件事");
      });
      await page.waitForSelector("#toast.on", { timeout: 3000 });

      // Tap 刻 (#bonecorner)
      await page.locator("#bonecorner").tap();
      await page.waitForFunction(() => window.__zz.st.log.some(l => l.startsWith("刻事签")), null, { timeout: 5000 });

      const toastDismissedTapBone = await page.evaluate(() => !document.querySelector("#toast").classList.contains("on"));
      assert.ok(toastDismissedTapBone, "Tapping 刻 (#bonecorner) must immediately dismiss the hint toast");

      assert.deepEqual(errs, []);
    } finally {
      await ctx.close();
    }
  });

  // ==========================================
  // T7 Q15=A: font-size >= 13px and no overflow (scrollWidth <= clientWidth + 1, inside parent)
  // ==========================================
  for (const vp of [
    { name: "390x844", w: 390, h: 844 },
    { name: "768x1024", w: 768, h: 1024 },
    { name: "1280x720", w: 1280, h: 720 },
    { name: "1280x800", w: 1280, h: 800 },
    { name: "1920x1080", w: 1920, h: 1080 },
  ]) {
    test(`${engine} ${vp.name}: Q15=A font-size >= 13px and no overflow on all required elements`, { timeout: 30000 }, async () => {
      const ctx = await browsers[engine].newContext({ viewport: { width: vp.w, height: vp.h } });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);

      try {
        await page.goto(`${server.origin}/?seed=20261016`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz && window.__zz.st?.current === "T01");

        // Open menu to test .grp and .seed
        await page.evaluate(() => {
          window.__zz.openMenu();
        });
        await page.waitForSelector("#menu-pop .grp", { timeout: 3000 });

        const menuRes = await page.evaluate(() => {
          const grps = Array.from(document.querySelectorAll("#menu-pop .grp"));
          const seed = document.querySelector("#menu-pop .seed");
          const items = [...grps, seed].filter(Boolean);
          for (const el of items) {
            const fs = parseFloat(getComputedStyle(el).fontSize);
            if (fs < 13) return { ok: false, msg: `${el.className} font-size ${fs} < 13` };
            if (el.scrollWidth > el.clientWidth + 1) return { ok: false, msg: `${el.className} scrollWidth (${el.scrollWidth}) > clientWidth (${el.clientWidth})` };
          }
          return { ok: true };
        });
        assert.ok(menuRes.ok, menuRes.msg);

        // Open savedlg to test #savedlg text
        await page.evaluate(() => {
          document.querySelector("#menu-pop").hidden = true;
          window.__zz.dispatch({ type: "choose", side: "left" });
          const code = window.__zz.code();
          window.__zz.importCode(code);
        });
        const dlgRes = await page.evaluate(() => {
          const text = document.querySelector("#dlgtext");
          const fs = parseFloat(getComputedStyle(text).fontSize);
          if (fs < 13) return { ok: false, msg: `#dlgtext font-size ${fs} < 13` };
          return { ok: true };
        });
        assert.ok(dlgRes.ok, dlgRes.msg);

        // #gen-line font-size and no overflow
        const genRes = await page.evaluate(() => {
          const gl = document.querySelector("#gen-line");
          const fs = parseFloat(getComputedStyle(gl).fontSize);
          if (fs < 13) return { ok: false, msg: `#gen-line font-size ${fs} < 13` };
          if (gl.scrollWidth > gl.clientWidth + 1) return { ok: false, msg: `#gen-line scrollWidth > clientWidth + 1` };
          return { ok: true };
        });
        assert.ok(genRes.ok, genRes.msg);

        // 字录 .zl entries
        const zlRes = await page.evaluate(() => {
          const drawer = document.querySelector("#drawer");
          if (drawer) drawer.hidden = false;
          const zls = Array.from(document.querySelectorAll(".zl"));
          for (const zl of zls) {
            const fs = parseFloat(getComputedStyle(zl).fontSize);
            if (fs < 13) return { ok: false, msg: `.zl font-size ${fs} < 13` };
            if (zl.scrollWidth > zl.clientWidth + 1) return { ok: false, msg: `.zl scrollWidth > clientWidth + 1` };
          }
          return { ok: true };
        });
        assert.ok(zlRes.ok, zlRes.msg);

        // keyhelp popup (#keyhelp-pop .kh-row)
        const khRes = await page.evaluate(() => {
          const pop = document.querySelector("#keyhelp-pop");
          pop.hidden = false;
          pop.innerHTML = '<div class="kh-row"><b>← →</b><span>选字；再按同向或 Enter 提交</span></div><div class="kh-row"><b>1–3</b><span>落字</span></div>';
          const rows = Array.from(pop.querySelectorAll(".kh-row"));
          for (const row of rows) {
            const fs = parseFloat(getComputedStyle(row).fontSize);
            if (fs < 13) return { ok: false, msg: `kh-row font-size ${fs} < 13` };
            if (row.scrollWidth > row.clientWidth + 1) return { ok: false, msg: `kh-row scrollWidth > clientWidth + 1` };
          }
          return { ok: true };
        });
        assert.ok(khRes.ok, khRes.msg);

        // pick info (挑字说明)
        const pickRes = await page.evaluate(() => {
          const pick = document.querySelector("#pick");
          pick.hidden = false;
          pick.innerHTML = '<div class="desc"><div class="pickinfo"><div class="pi-h">木 <span>mù</span></div><div class="pi-row"><b>本义</b><span>树木</span></div></div></div>';
          const info = pick.querySelector(".pickinfo");
          const span = pick.querySelector(".pi-h span");
          const row = pick.querySelector(".pi-row");
          const sfs = parseFloat(getComputedStyle(span).fontSize);
          const rfs = parseFloat(getComputedStyle(row).fontSize);
          if (sfs < 13) return { ok: false, msg: `pi-h span font-size ${sfs} < 13` };
          if (rfs < 13) return { ok: false, msg: `pi-row font-size ${rfs} < 13` };
          if (info.scrollWidth > info.clientWidth + 1) return { ok: false, msg: `pickinfo scrollWidth > clientWidth + 1` };
          return { ok: true };
        });
        assert.ok(pickRes.ok, pickRes.msg);

        assert.deepEqual(errs, []);
      } finally {
        await ctx.close();
      }
    });
  }
}
