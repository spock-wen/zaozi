// e2e S-1 verification: webkit 1280x800 mouse long-press option click loss
// S-1: click #opt-left, 50ms later mousedown on #opt-right, hold >=260ms (past settle), mouseup
// Verifies that neither long-press after settle nor holding across card transition loses option input.
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

const ctr = (page, sel) => page.evaluate((s) => {
  const r = document.querySelector(s).getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}, sel);

for (const [engine] of Object.entries(ENGINES)) {
  test(`${engine} 1280x800 mouse: 300ms hold on #opt-right after settle commits right`, async () => {
    const ctx = await browsers[engine].newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);

    try {
      await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
      await page.evaluate(() => localStorage.clear());
      await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz && document.body.dataset.cardReady === "1", null, { timeout: 10000 });

      assert.equal(await page.evaluate(() => window.__zz.st.current), "T01", "开局应为 T01");

      const R = await ctr(page, "#opt-right");
      await page.mouse.move(R[0], R[1]);
      await page.mouse.down();
      await page.waitForTimeout(300);
      await page.mouse.up();

      await page.waitForFunction(
        () => document.body.dataset.cardReady === "1" && window.__zz.st.current === "T02",
        null,
        { timeout: 5000 },
      );

      const n = await page.evaluate(() => window.__zz.actions.length);
      const cur = await page.evaluate(() => window.__zz.st.current);
      assert.equal(n, 1, `应恰好提交 1 次，实际为 ${n}`);
      assert.equal(cur, "T02", `卡面应推进到 T02，实际为 ${cur}`);
      assert.deepEqual(errs, [], "页面不应有未捕获异常");
    } finally {
      await ctx.close();
    }
  });

  test(`${engine} 1280x800 mouse: S-1 QA sequence (click #opt-left, 50ms later mousedown #opt-right, hold past settle) commits both`, async () => {
    const ctx = await browsers[engine].newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errs = [];
    collectErrors(page, errs);

    try {
      await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
      await page.evaluate(() => localStorage.clear());
      await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
      await page.waitForFunction(() => !!window.__zz && document.body.dataset.cardReady === "1", null, { timeout: 10000 });

      assert.equal(await page.evaluate(() => window.__zz.st.current), "T01", "开局应为 T01");

      const L = await ctr(page, "#opt-left");
      const R = await ctr(page, "#opt-right");

      // Exact QA sequence: click #opt-left, 50ms later mousedown on #opt-right
      await page.mouse.click(L[0], L[1]);
      await page.waitForTimeout(50);
      await page.mouse.move(R[0], R[1]);
      await page.mouse.down();

      // Hold past settle (card settles at ~415ms, hold 550ms -> release at ~600ms)
      await page.waitForTimeout(550);
      await page.mouse.up();

      // Wait for second card commit to complete and settle
      await page.waitForFunction(
        () => window.__zz.actions.length === 2 && window.__zz.st.current === "T03" && document.body.dataset.cardReady === "1",
        null,
        { timeout: 5000 },
      );

      const acts = await page.evaluate(() => window.__zz.actions.map((a) => a.side || a.type));
      const cur = await page.evaluate(() => window.__zz.st.current);
      assert.deepEqual(acts, ["left", "right"], `动作序列应为 ["left", "right"]，实际为 ${JSON.stringify(acts)}`);
      assert.equal(cur, "T03", `卡面应推进到 T03，实际为 ${cur}`);
      assert.deepEqual(errs, [], "页面不应有未捕获异常");
    } finally {
      await ctx.close();
    }
  });
}
