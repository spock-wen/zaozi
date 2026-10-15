// 横幅复核：seed 1555 第1代，冬夜后等足所有横幅（每条 1.8s 排队）
import { chromium } from "playwright";
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p.goto(process.argv[2] + "/?seed=1555"); await p.waitForFunction(() => !!window.__zz);
await p.evaluate(() => { window.__qaBanners = []; const bn = document.querySelector("#banner"); new MutationObserver(() => { if (!bn.hidden && bn.textContent) window.__qaBanners.push(bn.textContent); }).observe(bn, { attributes: true, childList: true, subtree: true, characterData: true }); });
const k = 15; const ph = () => p.evaluate(() => window.__zz.st.phase);
const press = async (d) => { await p.keyboard.press(d); await p.keyboard.press(d); await p.waitForTimeout(520); };
await press("ArrowLeft"); await press("ArrowRight"); await p.keyboard.press("k"); await p.waitForTimeout(300); await p.locator("#wordbox .slot.ok").first().click(); await p.waitForTimeout(300); await press("ArrowLeft");
for (let i = 0; i < 90; i++) { const s = await ph(); if (s === "winter") break; if (s === "engrave") { await p.keyboard.press("k"); await p.waitForTimeout(260); continue; } if (s !== "card") break;
  const d = ((k * 7 + i * 3) % 5) < 2 + (k % 2) ? "ArrowLeft" : "ArrowRight"; await press(d);
  if (i % 4 === 0) { const s2 = p.locator("#wordbox .slot.ok").first(); if (await s2.isVisible().catch(() => false)) await s2.click({ timeout: 1500 }).catch(() => {}); } }
await p.locator("#winter [data-do=end]").click().catch(() => {}); await p.waitForTimeout(9000);
console.log(JSON.stringify(await p.evaluate(() => ({ seen: [...new Set(window.__qaBanners)], ev: window.__zz.st.goalEvents }))));
await p.screenshot({ path: "run/shots/banner_recheck_1555.png", fullPage: true }); await b.close();
