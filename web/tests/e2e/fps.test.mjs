// e2e 帧率：Chromium 并把 CPU 节流到 4×，量稳态 rAF 帧间隔，确认壳在只动
// transform/opacity 的前提下仍能贴近 60fps（brief 决定 2 / GAMEFEEL_SPEC §5.2）。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { SEED, buildDist, startServer } from "./helpers/env.mjs";

buildDist();

let server, browser;
before(async () => {
  server = await startServer();
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  server?.close();
});

test("chromium: steady-state rAF stays near 60fps under 4x CPU throttle", async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  try {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
    await page.waitForFunction(() => !!window.__zz);

    // 稳态：数 150 帧的间隔（丢掉前 30 帧暖机）
    const res = await page.evaluate(async () => {
      const gaps = [];
      let last = performance.now();
      await new Promise((done) => {
        const tick = (t) => {
          gaps.push(t - last); last = t;
          if (gaps.length < 180) requestAnimationFrame(tick); else done();
        };
        requestAnimationFrame(tick);
      });
      const s = gaps.slice(30).sort((a, b) => a - b);
      const avg = s.reduce((a, b) => a + b, 0) / s.length;
      return { avgMs: avg, p95Ms: s[Math.floor(s.length * 0.95)], n: s.length };
    });

    const fps = 1000 / res.avgMs;
    console.log(`    [fps] 4x throttle: avg ${fps.toFixed(1)}fps (${res.avgMs.toFixed(2)}ms), p95 ${res.p95Ms.toFixed(2)}ms, n=${res.n}`);
    assert.ok(fps >= 50, `4x 节流下平均帧率 ${fps.toFixed(1)}fps < 50`);
    assert.ok(res.p95Ms <= 40, `4x 节流下 p95 帧间隔 ${res.p95Ms.toFixed(1)}ms > 40`);
  } finally {
    await ctx.close();
  }
});
