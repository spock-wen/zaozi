import { chromium } from "playwright";
const base = "http://localhost:5178/";
const url = base + "?seed=20261012";
const errs = [];
const b = await chromium.launch();
async function shot(w, h, name) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on("console", (m) => { if (m.type() === "error") errs.push(name + ": " + m.text()); });
  p.on("pageerror", (e) => errs.push(name + " pageerror: " + e.message));
  await p.goto(url, { waitUntil: "load" });
  await p.waitForTimeout(400);
  const view = await p.evaluate(() => document.body.dataset.view);
  const menu = await p.locator("#menubtn").boundingBox();
  const title = await p.locator("#card-title").textContent().catch(() => "?");
  const words = await p.locator("#wordbox .slot").count();
  console.log(name, "view=" + view, "menu=" + (menu ? Math.round(menu.width) + "x" + Math.round(menu.height) : "null"), "title=" + title, "slots=" + words);
  await p.screenshot({ path: `${process.env.COMMANDCODE_SCRATCHPAD}/${name}.png` });
  await p.close();
}
await shot(390, 844, "m390");
await shot(768, 1024, "t768");
await shot(1024, 768, "d1024");
await shot(1440, 900, "d1440");
console.log("ERRORS:", errs.length ? errs : "none");
await b.close();
