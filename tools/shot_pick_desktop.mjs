// 桌面挑字截图（1280/1440）：一个字选中 + 说明卡展开，存到 release_shots_v2/。
import { chromium } from "playwright";
import { SEED, buildDist, startServer } from "../tests/e2e/helpers/env.mjs";
import { toPickDesktop } from "../tests/e2e/helpers/flow.mjs";
buildDist();
const server = await startServer();
const b = await chromium.launch();
for (const w of [1280, 1440]) {
  const page = await (await b.newContext({ viewport: { width: w, height: 900 } })).newPage();
  await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__zz);
  await toPickDesktop(page);
  await page.locator("#pick .cand").first().hover();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `release_shots_v2/desktop_pick_${w}.png`, fullPage: true });
}
await b.close(); server.close();
