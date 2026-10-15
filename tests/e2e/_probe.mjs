import { chromium } from "playwright";
import { startServer, SEED } from "./helpers/env.mjs";

const server = await startServer();
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("PAGEERR", e.message));
p.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", m.text()); });
const phase = () => p.evaluate(() => window.__zz.st.phase);
const cur = () => p.evaluate(() => window.__zz.st.current);
const st = () => p.evaluate(() => ({ phase: window.__zz.st.phase, current: window.__zz.st.current, gen: window.__zz.st.generation, tallies: window.__zz.st.tallies.map(t=>t.id+"/"+t.target), zilu: window.__zz.st.zilu, dropped: window.__zz.st.dropped, bones: window.__zz.st.bones }));
const commit = async (d) => { const k = d === "left" ? "ArrowLeft" : "ArrowRight"; await p.waitForFunction(() => !window.__zz.animating, null, { timeout: 5000 }); await p.keyboard.press(k); await p.keyboard.press(k); await p.waitForTimeout(520); };

await p.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
await p.waitForFunction(() => !!window.__zz);

// clear tutorial manually with logs
console.log("start", JSON.stringify(await st()));
await commit("left"); console.log("T01->", JSON.stringify(await st()));
await commit("right"); console.log("T02->", JSON.stringify(await st()));
console.log("bonecorner count", await p.locator("#bonecorner").count(), "visible", await p.locator("#bonecorner").isVisible());
console.log("card-drops skip count", await p.locator("#card-drops [data-do=skip]").count());
await p.locator("#bonecorner").click(); await p.waitForTimeout(300);
console.log("after engrave", JSON.stringify(await st()));
console.log("wordbox slot.ok count", await p.locator("#wordbox .slot.ok").count());
await p.locator("#wordbox .slot.ok").first().click(); await p.waitForTimeout(300);
console.log("after T04 drop", JSON.stringify(await st()));
await commit("left"); console.log("T05->", JSON.stringify(await st()));

// play left until winter or engrave
let engraveSeen = [];
for (let i = 0; i < 80; i++) {
  const ph = await phase();
  if (ph === "winter") break;
  if (ph === "engrave") {
    const skip = await p.locator("#card-drops [data-do=skip]").count();
    engraveSeen.push((await cur()) + ":skip=" + skip);
    await p.keyboard.press("s"); await p.waitForTimeout(260); continue;
  }
  if (ph !== "card") break;
  await commit("left");
}
console.log("engrave cards seen:", engraveSeen.join(", "));
console.log("winter", JSON.stringify(await st()));
console.log("winter tallies", await p.locator("#winter [data-tally]").count(), "comp", await p.locator("#winter [data-comp]").count(), "base", await p.locator("#winter [data-base]").count(), "pos", await p.locator("#winter [data-pos]").count(), "clear", await p.locator("#winter [data-do=clear]").count(), "carve", await p.locator("#winter [data-do=carve]").count(), "defer", await p.locator("#winter [data-do=defer]").count(), "end", await p.locator("#winter-end").count());
console.log("goals-slip visible", await p.locator("#goals-slip").isVisible(), "goals", await p.evaluate(()=>JSON.stringify(window.__zz.st.goals)));

// 天亮了
await p.locator("#winter-end").click();
await p.waitForTimeout(400);
console.log("after end", await phase(), "endseq vis", await p.locator("#endseq").isVisible());
await p.locator("#endseq [data-do=elder]").click();
await p.waitForTimeout(200);
console.log("elder vis", await p.locator("#elder").isVisible(), "header", await p.locator("#elder h1").textContent());
await p.locator("#elder [data-do=heir]").click();
await p.waitForTimeout(200);
console.log("pick phase", await phase(), "cands", await p.locator("#pick .cand").count());

// pick 3
for (const ch of ["水", "休", "木"]) {
  await p.locator(`#pick .cand[data-char="${ch}"]`).click();
  await p.locator(`#pick .cand[data-char="${ch}"]`).click();
}
await p.waitForTimeout(150);
console.log("go enabled", await p.locator("#pick .go").isEnabled());
await p.locator("#pick .go").click(); await p.waitForTimeout(500);
console.log("gen2 start", JSON.stringify(await st()));

// play gen2 left to winter -> end, check whether endseq shows
for (let i = 0; i < 80; i++) {
  const ph = await phase();
  if (ph === "winter") break;
  if (ph === "engrave") { await p.keyboard.press("s"); await p.waitForTimeout(260); continue; }
  if (ph !== "card") break;
  await commit("left");
}
console.log("gen2 winter", await phase());
await p.locator("#winter-end").click();
await p.waitForTimeout(500);
console.log("gen2 after end +0.5s: phase", await phase(), "endseq vis", await p.locator("#endseq").isVisible(), "elder vis", await p.locator("#elder").isVisible());
try { await p.locator("#endseq").waitFor({ state: "visible", timeout: 5000 }); } catch {}
console.log("gen2 after end waited: endseq vis", await p.locator("#endseq").isVisible(), "elder vis", await p.locator("#elder").isVisible(), "header", await p.locator("#endseq").isVisible() ? await p.locator("#endseq h1").textContent() : "-");

await b.close();
server.close();
