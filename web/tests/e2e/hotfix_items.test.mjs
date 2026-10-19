// e2e hotfix items verification (N1, N2, O1, O2, Esc, Overflow, Aria/Data-ready, SW update)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { spawn } from "node:child_process";
import { ENGINES, SEED, DIST, ROOT, buildDist, startServer, collectErrors } from "./helpers/env.mjs";

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

const PHONES = [
  { name: "375x667", w: 375, h: 667 },
  { name: "360x800", w: 360, h: 800 },
  { name: "390x844", w: 390, h: 844 },
  { name: "393x852", w: 393, h: 852 },
  { name: "412x915", w: 412, h: 915 },
  { name: "430x932", w: 430, h: 932 },
  { name: "390x664", w: 390, h: 664 },
];

for (const [engine] of Object.entries(ENGINES)) {
  // ==========================================
  // a. N1: Double tap/click within 70ms -> exactly 1 commit
  // ==========================================
  for (const vp of [
    { name: "390x844", w: 390, h: 844, isMobile: true },
    { name: "1280x800", w: 1280, h: 800, isMobile: false },
  ]) {
    const testTitle = vp.isMobile
      ? `${engine} ${vp.name}: N1 double-tap within 70ms commits exactly once`
      : `${engine} ${vp.name}: N1 double-click within 70ms commits exactly once`;

    test(testTitle, async () => {
      const ctx = await browsers[engine].newContext({
        viewport: { width: vp.w, height: vp.h },
        hasTouch: vp.isMobile,
      });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);

      try {
        await page.goto(`${server.origin}/?seed=20261016`, { waitUntil: "load" });
        await page.waitForFunction(() => document.body.dataset.cardReady === "1");

        const optL = page.locator("#opt-left");
        const box = await optL.boundingBox();
        assert.ok(box, "Option left bounding box should exist");

        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;

        if (vp.isMobile) {
          await page.touchscreen.tap(cx, cy);
          await page.waitForTimeout(30);
          await page.touchscreen.tap(cx, cy);
        } else {
          await page.mouse.click(cx, cy);
          await page.waitForTimeout(30);
          await page.mouse.click(cx, cy);
        }

        // Wait for next card to settle
        await page.waitForFunction(() => document.body.dataset.cardReady === "1", null, { timeout: 5000 });
        const actCount = await page.evaluate(() => window.__zz.actions.length);
        const cur = await page.evaluate(() => window.__zz.st.current);
        assert.equal(actCount, 1, `Exactly 1 commit expected, got ${actCount}`);
        assert.equal(cur, "T02", `Next card T02 expected, got ${cur}`);
        assert.deepEqual(errs, []);
      } finally {
        await ctx.close();
      }
    });
  }

  // ==========================================
  // b. N2: T03 engrave phase options hidden & disabled, tapping center does nothing
  // ==========================================
  for (const vp of [
    { name: "390x844", w: 390, h: 844, isMobile: true },
    { name: "1280x800", w: 1280, h: 800, isMobile: false },
  ]) {
    const testTitle = vp.isMobile
      ? `${engine} ${vp.name}: N2 T03 engrave options hidden and tapping does nothing`
      : `${engine} ${vp.name}: N2 T03 engrave options hidden and tapping does nothing`;

    test(testTitle, async () => {
      const ctx = await browsers[engine].newContext({
        viewport: { width: vp.w, height: vp.h },
        hasTouch: vp.isMobile,
      });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);

      try {
        await page.goto(`${server.origin}/?seed=20261016`, { waitUntil: "load" });
        await page.waitForFunction(() => document.body.dataset.cardReady === "1");

        // Advance to T03 (engrave)
        await page.evaluate(() => {
          window.__zz.dispatch({ type: "choose", side: "left" }); // T01 -> T02
          window.__zz.dispatch({ type: "choose", side: "right" }); // T02 -> T03 (engrave)
        });
        await page.waitForFunction(() => window.__zz.st.phase === "engrave");

        const optL = page.locator("#opt-left");
        const optR = page.locator("#opt-right");

        assert.ok(await optL.isDisabled(), "#opt-left should be disabled");
        assert.ok(await optR.isDisabled(), "#opt-right should be disabled");

        const visL = await optL.evaluate((el) => getComputedStyle(el).visibility);
        const visR = await optR.evaluate((el) => getComputedStyle(el).visibility);
        assert.equal(visL, "hidden", "#opt-left should have visibility: hidden");
        assert.equal(visR, "hidden", "#opt-right should have visibility: hidden");

        const boxL = await optL.boundingBox();
        assert.ok(boxL, "Box L should exist for layout geometry");
        const cx = boxL.x + boxL.width / 2;
        const cy = boxL.y + boxL.height / 2;

        const initialActions = await page.evaluate(() => window.__zz.actions.length);

        if (vp.isMobile) {
          await page.touchscreen.tap(cx, cy);
        } else {
          await page.mouse.click(cx, cy);
        }
        await page.waitForTimeout(100);

        assert.equal(await page.locator("#toast.on").count(), 0, "No toast on tapping hidden option");
        assert.equal(await page.evaluate(() => window.__zz.st.phase), "engrave", "Phase must remain engrave");
        assert.equal(await page.evaluate(() => window.__zz.actions.length), initialActions, "Actions must not change");
        assert.deepEqual(errs, []);
      } finally {
        await ctx.close();
      }
    });
  }

  // ==========================================
  // c. O1: Fly-out guard on #wordbox click
  // ==========================================
  for (const vp of [
    { name: "390x844", w: 390, h: 844, isMobile: true },
    { name: "1280x800", w: 1280, h: 800, isMobile: false },
  ]) {
    const testTitle = vp.isMobile
      ? `${engine} ${vp.name}: O1 click wordbox during fly-out ignored`
      : `${engine} ${vp.name}: O1 click wordbox during fly-out ignored`;

    test(testTitle, async () => {
      const ctx = await browsers[engine].newContext({
        viewport: { width: vp.w, height: vp.h },
        hasTouch: vp.isMobile,
      });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);

      try {
        await page.goto(`${server.origin}/?seed=20261016`, { waitUntil: "load" });
        await page.waitForFunction(() => document.body.dataset.cardReady === "1");

        const optBox = await page.locator("#opt-left").boundingBox();
        const slotBox = await page.locator("#wordbox [data-slot]").first().boundingBox();
        assert.ok(optBox && slotBox);

        // Click option then immediately click wordbox slot during flyout
        if (vp.isMobile) {
          await page.touchscreen.tap(optBox.x + optBox.width / 2, optBox.y + optBox.height / 2);
          await page.waitForTimeout(20);
          await page.touchscreen.tap(slotBox.x + slotBox.width / 2, slotBox.y + slotBox.height / 2);
        } else {
          await page.mouse.click(optBox.x + optBox.width / 2, optBox.y + optBox.height / 2);
          await page.waitForTimeout(20);
          await page.mouse.click(slotBox.x + slotBox.width / 2, slotBox.y + slotBox.height / 2);
        }

        await page.waitForFunction(() => document.body.dataset.cardReady === "1", null, { timeout: 5000 });
        const actCount = await page.evaluate(() => window.__zz.actions.length);
        assert.equal(actCount, 1, `Exactly 1 commit expected, got ${actCount}`);
        assert.deepEqual(errs, []);
      } finally {
        await ctx.close();
      }
    });
  }

  // ==========================================
  // d. O2: Keyboard ← twice then hold ←
  // ==========================================
  for (const vp of [
    { name: "390x844", w: 390, h: 844, isMobile: true },
    { name: "1280x800", w: 1280, h: 800, isMobile: false },
  ]) {
    const testTitle = vp.isMobile
      ? `${engine} ${vp.name}: O2 press ArrowLeft twice and hold during flyout commits at most 1`
      : `${engine} ${vp.name}: O2 press ArrowLeft twice and hold during flyout commits at most 1`;

    test(testTitle, async () => {
      const ctx = await browsers[engine].newContext({
        viewport: { width: vp.w, height: vp.h },
      });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);

      try {
        await page.goto(`${server.origin}/?seed=20261016`, { waitUntil: "load" });
        await page.waitForFunction(() => document.body.dataset.cardReady === "1");

        // Press Left (preview), press Left (commit)
        await page.keyboard.press("ArrowLeft");
        await page.keyboard.press("ArrowLeft");
        // Immediately hold Left during flyout
        await page.keyboard.down("ArrowLeft");
        await page.waitForTimeout(150); // mid fly-out
        await page.keyboard.up("ArrowLeft");

        // Wait for next card to settle
        await page.waitForFunction(() => document.body.dataset.cardReady === "1", null, { timeout: 5000 });
        const actCount = await page.evaluate(() => window.__zz.actions.length);
        assert.equal(actCount, 1, `Held Left during flyout should not cause extra commit, got ${actCount}`);
        assert.deepEqual(errs, []);
      } finally {
        await ctx.close();
      }
    });
  }

  // ==========================================
  // e. Esc closes the menu
  // ==========================================
  for (const vp of [
    { name: "390x844", w: 390, h: 844, isMobile: true },
    { name: "1280x800", w: 1280, h: 800, isMobile: false },
  ]) {
    const testTitle = vp.isMobile
      ? `${engine} ${vp.name}: Escape key closes menu popup and resets aria-expanded`
      : `${engine} ${vp.name}: Escape key closes menu popup and resets aria-expanded`;

    test(testTitle, async () => {
      const ctx = await browsers[engine].newContext({
        viewport: { width: vp.w, height: vp.h },
      });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);

      try {
        await page.goto(`${server.origin}/?seed=20261016`, { waitUntil: "load" });
        await page.waitForFunction(() => document.body.dataset.cardReady === "1");

        // Open menu
        await page.locator("#menubtn").click();
        const menuPop = page.locator("#menu-pop");
        assert.equal(await menuPop.isHidden(), false, "Menu pop should be visible");
        assert.equal(await page.locator("#menubtn").getAttribute("aria-expanded"), "true");

        // Press Escape
        await page.keyboard.press("Escape");
        await page.waitForTimeout(50);

        assert.equal(await menuPop.isHidden(), true, "Menu pop should be hidden after Escape");
        assert.equal(await page.locator("#menubtn").getAttribute("aria-expanded"), "false", "aria-expanded should be false");
        assert.deepEqual(errs, []);
      } finally {
        await ctx.close();
      }
    });
  }

  // ==========================================
  // f. Phone overflow across 7 phone sizes
  // ==========================================
  for (const vp of PHONES) {
    test(`${engine} ${vp.name}: carving box text and wordbox slot no overflow`, async () => {
      const ctx = await browsers[engine].newContext({
        viewport: { width: vp.w, height: vp.h },
        hasTouch: true,
      });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);

      try {
        await page.goto(`${server.origin}/?seed=20261016`, { waitUntil: "load" });
        await page.waitForFunction(() => document.body.dataset.cardReady === "1");

        // Set C02 card with long tally text and dropped slot
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
          const sr = slot.getBoundingClientRect();
          const pr = span.getBoundingClientRect();

          const dScrollOk = d.scrollWidth <= d.clientWidth + 1;
          const cScrollOk = card.scrollWidth <= card.clientWidth + 1;
          const slotScrollOk = slot.scrollWidth <= slot.clientWidth + 1;
          const spanScrollOk = span.scrollWidth <= span.clientWidth + 1;

          const btnInsideD = br.left >= dr.left - 1 && br.right <= dr.right + 1 && br.top >= dr.top - 1 && br.bottom <= dr.bottom + 1;
          const dInsideC = dr.left >= cr.left - 1 && dr.right <= cr.right + 1 && dr.top >= cr.top - 1 && dr.bottom <= cr.bottom + 1;
          const spanInsideSlot = pr.left >= sr.left - 1 && pr.right <= sr.right + 1 && pr.top >= sr.top - 1 && pr.bottom <= sr.bottom + 1;

          return {
            dScrollOk, cScrollOk, slotScrollOk, spanScrollOk,
            btnInsideD, dInsideC, spanInsideSlot,
          };
        });

        assert.ok(check.dScrollOk, "Drops scrollWidth <= clientWidth + 1");
        assert.ok(check.cScrollOk, "Card scrollWidth <= clientWidth + 1");
        assert.ok(check.slotScrollOk, "Slot scrollWidth <= clientWidth + 1");
        assert.ok(check.spanScrollOk, "Span scrollWidth <= clientWidth + 1");
        assert.ok(check.btnInsideD, "Skip button inside card-drops ±1px");
        assert.ok(check.dInsideC, "card-drops inside card ±1px");
        assert.ok(check.spanInsideSlot, "used slot span inside slot button ±1px");
        assert.deepEqual(errs, []);
      } finally {
        await ctx.close();
      }
    });
  }

  // ==========================================
  // g. aria-label, data-ready on drag threshold, long press no highlight
  // ==========================================
  for (const vp of [
    { name: "390x844", w: 390, h: 844, isMobile: true },
    { name: "1280x800", w: 1280, h: 800, isMobile: false },
  ]) {
    const testTitle = vp.isMobile
      ? `${engine} ${vp.name}: aria-label, data-ready on drag past thr, long press no highlight`
      : `${engine} ${vp.name}: aria-label, data-ready on drag past thr, long press no highlight`;

    test(testTitle, async () => {
      const ctx = await browsers[engine].newContext({
        viewport: { width: vp.w, height: vp.h },
      });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);

      try {
        await page.goto(`${server.origin}/?seed=20261016`, { waitUntil: "load" });
        await page.waitForFunction(() => document.body.dataset.cardReady === "1");

        // 1. Aria-label present
        const optL = page.locator("#opt-left");
        const optR = page.locator("#opt-right");
        const ariaL = await optL.getAttribute("aria-label");
        const ariaR = await optR.getAttribute("aria-label");
        assert.ok(ariaL && ariaL.startsWith("选左："), `Aria-label left "${ariaL}" should start with "选左："`);
        assert.ok(ariaR && ariaR.startsWith("选右："), `Aria-label right "${ariaR}" should start with "选右："`);

        // 2. Real mouse drag past threshold -> data-ready on dragged option
        const cardBox = await page.locator("#card").boundingBox();
        const startX = cardBox.x + cardBox.width / 2;
        const startY = cardBox.y + cardBox.height / 2;

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        // Drag left 40% of card width (threshold is 35%)
        await page.mouse.move(startX - cardBox.width * 0.4, startY, { steps: 5 });
        await page.waitForTimeout(50);

        const readyL = await optL.getAttribute("data-ready");
        const onL = await optL.evaluate((el) => el.classList.contains("on"));
        assert.equal(readyL, "1", "opt-left should have data-ready=1 when dragged past threshold");
        assert.ok(onL, "opt-left should have .on class");

        // Release -> rebound -> data-ready removed
        await page.mouse.up();
        await page.waitForTimeout(350);
        const readyAfter = await optL.getAttribute("data-ready");
        assert.equal(readyAfter, null, "data-ready should be removed after release/rebound");

        // 3. Long press 800ms with no move -> no .on and no data-ready
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.waitForTimeout(800);

        const onLongL = await optL.evaluate((el) => el.classList.contains("on"));
        const onLongR = await optR.evaluate((el) => el.classList.contains("on"));
        const readyLongL = await optL.getAttribute("data-ready");
        const readyLongR = await optR.getAttribute("data-ready");

        assert.equal(onLongL, false, "Long press should not highlight opt-left (.on)");
        assert.equal(onLongR, false, "Long press should not highlight opt-right (.on)");
        assert.equal(readyLongL, null, "Long press should not set data-ready on opt-left");
        assert.equal(readyLongR, null, "Long press should not set data-ready on opt-right");

        await page.mouse.up();
        assert.deepEqual(errs, []);
      } finally {
        await ctx.close();
      }
    });
  }

  // ==========================================
  // h. SW update: reload once -> exactly 1 auto reload, save intact
  // ==========================================
  test(`${engine} 1280x800: SW update auto reload exactly once, save intact`, async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sw-e2e-"));
    fs.cpSync(DIST, tmpDir, { recursive: true });

    const port = await new Promise((res) => {
      const s = net.createServer();
      s.listen(0, "127.0.0.1", () => {
        const p = s.address().port;
        s.close(() => res(p));
      });
    });

    const child = spawn(process.execPath, [path.join(ROOT, "web", "serve_pages.mjs"), "--port", String(port), "--dir", tmpDir], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });

    await new Promise((res, rej) => {
      const to = setTimeout(() => rej(new Error("serve_pages start timeout")), 5000);
      child.stdout.on("data", (d) => {
        if (String(d).includes("http://localhost")) {
          clearTimeout(to);
          res();
        }
      });
    });

    const origin = `http://127.0.0.1:${port}`;
    const ctx = await browsers[engine].newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();

    try {
      // 1. First visit: register SW
      await page.goto(`${origin}/?seed=20261016`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz && !!navigator.serviceWorker?.controller, null, { timeout: 10000 });

      // 2. Second visit: controller already active from start
      await page.goto(`${origin}/?seed=20261016`, { waitUntil: "load" });
      await page.waitForFunction(() => document.body.dataset.cardReady === "1");

      // Play 2 cards
      await page.evaluate(() => {
        window.__zz.dispatch({ type: "choose", side: "left" });
        window.__zz.dispatch({ type: "choose", side: "left" });
      });
      await page.waitForFunction(() => window.__zz.actions.length === 2);

      // 3. Update VERSION in sw.js
      const swPath = path.join(tmpDir, "sw.js");
      let swContent = fs.readFileSync(swPath, "utf8");
      const newVersion = `sw_v2_${engine}_${Date.now()}`;
      swContent = swContent.replace(/const VERSION = "[^"]+"/, `const VERSION = "${newVersion}"`);
      fs.writeFileSync(swPath, swContent);

      let navCount = 0;
      page.on("framenavigated", (frame) => {
        if (frame === page.mainFrame()) navCount++;
      });

      // User reloads
      await page.reload();

      // Wait for automatic reload after controllerchange
      await page.waitForFunction(() => !!sessionStorage.getItem("zz_sw_reloaded"), null, { timeout: 10000 });
      if (navCount < 2) {
        await page.waitForEvent("framenavigated", {
          predicate: (f) => f === page.mainFrame(),
          timeout: 5000,
        }).catch(() => {});
      }
      await page.waitForLoadState("load");
      await page.waitForFunction(() => document.body.dataset.cardReady === "1", null, { timeout: 10000 });

      const finalActions = await page.evaluate(() => window.__zz.actions.length);
      assert.equal(finalActions, 2, "Save must be intact with action count 2");
      assert.ok(navCount <= 2, `Total navigations must be <= 2, got ${navCount}`);
    } finally {
      await ctx.close();
      child.kill();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
}
