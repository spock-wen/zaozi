// e2e P1-1 回归：挑字说明卡只画有数据的行，绝不写「？」占位。
// 对 14 字池逐字出说明卡：任何字都不得出现「？」或 '?'；
// 有部件/底字数据的字（人木田力日月）出「部件」行。
// 年卡 drops 有 label 的字（水、火）出「落」行。两头都没有的字一行都不出。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";
import { toPickDesktop } from "./helpers/flow.mjs";

buildDist();

const SLICE = ["水", "日", "人", "木", "田", "火", "力", "月", "休", "林", "从", "男", "明", "本"];
// 字池里被别的字当部件或底字用的字：components 含它，或 base 指它（见 data/chars_slice.json）。
const WITH_PARTS = new Set(["人", "木", "田", "力", "日", "月"]);
const WITH_DROP = new Set(["水", "火"]);

let server, browsers = {};
before(async () => {
  server = await startServer();
  for (const [name, type] of Object.entries(ENGINES)) browsers[name] = await type.launch();
});
after(async () => {
  for (const b of Object.values(browsers)) await b.close();
  server?.close();
});

test("chromium 1280: 说明卡对 14 字都不出「？」占位，无数据的行整行不画", async () => {
  const ctx = await browsers.chromium.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  collectErrors(page, errs);
  try {
    await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
    await page.waitForFunction(() => !!window.__zz);
    await toPickDesktop(page);

    for (const ch of SLICE) {
      await page.locator(`#pick .cand[data-char='${ch}']`).click();
      await page.waitForTimeout(30);
      const text = (await page.locator("#pick-desc").innerText()).trim();
      assert.ok(!text.includes("？") && !text.includes("?"), `${ch} 说明卡不能出现问号占位：${text}`);
      const rows = await page.locator("#pick-desc .pi-row").allInnerTexts();
      const expectN = (WITH_PARTS.has(ch) ? 1 : 0) + (WITH_DROP.has(ch) ? 1 : 0);
      assert.equal(rows.length, expectN, `${ch} 说明卡行数不符合「无数据不画」：${JSON.stringify(rows)}`);
      if (WITH_PARTS.has(ch)) assert.ok(rows.some((r) => r.includes("能拼出")), `${ch} 的「部件」行应写「能拼出」，得到：${JSON.stringify(rows)}`);
      if (WITH_DROP.has(ch)) assert.ok(rows.some((r) => r.includes("能落")), `${ch} 的「落」行应写「能落」，得到：${JSON.stringify(rows)}`);
    }

    assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
  } finally {
    await ctx.close();
  }
});
