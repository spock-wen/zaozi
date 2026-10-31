import { chromium } from "playwright";
const URL = "http://localhost:5178/?seed=20261012";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
const st = () => p.evaluate(() => window.__zz.st.phase);
const cur = () => p.evaluate(() => window.__zz.st.current);
const log = (...a) => console.log(...a);

await p.goto(URL, { waitUntil: "load" });
await p.waitForTimeout(300);
log("start current=", await cur(), "phase=", await st());

// T01: ← preview then ← commit
const cont = async () => { const open = await p.evaluate(() => { const e = document.getElementById("cutscene"); return !!e && !e.hidden; }); if (open) await p.locator("#cut-continue").click(); };
await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowLeft");
await p.waitForTimeout(300);
await cont();
log("after T01:", await cur(), await st());
// T02
await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowRight");
await p.waitForTimeout(300);
await cont();
log("after T02:", await cur(), await st());
if ((await st()) !== "engrave") errs.push("T03 did not enter engrave");

// locked drag → hint
const c = await p.locator("#card").boundingBox();
await p.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
await p.mouse.down(); await p.mouse.move(c.x + c.width / 2 + 120, c.y + c.height / 2, { steps: 5 }); await p.mouse.up();
await p.waitForTimeout(100);
const toastTxt = await p.locator("#toast").textContent();
log("locked drag toast:", toastTxt);
if (!toastTxt.includes("骨片")) errs.push("no locked-card hint, got: " + toastTxt);

// engrave
await p.locator("#bonecorner").click();
await p.waitForTimeout(300);
await cont();
log("after engrave:", await cur(), await st());
// T04 drop
await p.locator("#wordbox .slot").first().click();
await p.waitForTimeout(300);
await cont();
log("after T04 drop:", await cur(), await st());
// T05 right
await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowRight");
await p.waitForTimeout(300);
await cont();
log("after T05:", await cur(), await st());

// play normal cards until winter/ended
for (let i = 0; i < 40; i++) {
  const ph = await st();
  if (ph === "engrave") { await p.keyboard.press("s"); await p.waitForTimeout(200); continue; }
  if (ph !== "card") break;
  await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowLeft");
  await p.waitForTimeout(240);
}
log("phase now:", await st());
if ((await st()) === "winter") {
  await p.locator("#winter-end").click();
  await p.waitForTimeout(300);
  log("after 天亮了:", await st());
}
await p.locator("#endseq").waitFor({ state: "visible", timeout: 10000 });
log("endseq visible:", await p.locator("#endseq").isVisible());
log("elder visible (should be false):", await p.locator("#elder").isVisible());
await p.locator("#endseq [data-do=elder]").click();
await p.waitForTimeout(300);
log("elder visible:", await p.locator("#elder").isVisible());
await p.locator("#elder [data-do=heir]").click();
await p.waitForTimeout(400);
log("pick phase:", await st(), "cands=", await p.locator("#pick .cand").count(), "season=", await p.locator("#season-chip").textContent());
for (const ch of ["水", "休", "木"]) {                       // gf5：点一下看说明、再点一次带上
  await p.locator(`#pick .cand[data-char="${ch}"]`).click();
  await p.locator(`#pick .cand[data-char="${ch}"]`).click();
}
await p.waitForTimeout(200);
log("go enabled:", await p.locator("#pick .go").isEnabled());
await p.locator("#pick .go").click();
await p.waitForTimeout(500);
log("gen2:", await p.evaluate(() => window.__zz.st.generation), "phase=", await st(), "wordbox=", await p.evaluate(() => JSON.stringify(window.__zz.st.wordBox)));

// mute toggle once
await p.locator("#menubtn").click();
await p.waitForTimeout(100);
const m1 = await p.evaluate(() => window.__zz.isMuted());
await p.locator('#menu-pop [data-menu="mute"]').click();
await p.waitForTimeout(100);
const m2 = await p.evaluate(() => window.__zz.isMuted());
log("mute before/after:", m1, m2);
if (m1 === m2) errs.push("mute did not toggle");
console.log("ERRORS:", errs.length ? errs : "none");
await b.close();
