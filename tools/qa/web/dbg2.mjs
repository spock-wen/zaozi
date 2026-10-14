import { chromium } from "playwright";
const b = await chromium.launch();
for (const w of [1024,1280]) {
const p = await (await b.newContext({ viewport: { width: w, height: 800 } })).newPage();
await p.goto("http://localhost:5381/?seed=20261012"); await p.waitForFunction(() => !!window.__zz);
for (const k of ["ArrowLeft","ArrowLeft"]) await p.keyboard.press(k); await p.waitForTimeout(700);
for (const k of ["ArrowRight","ArrowRight"]) await p.keyboard.press(k); await p.waitForTimeout(1500);
const r = await p.evaluate(()=>{const el=document.querySelector("#bonecorner");const q=el.getBoundingClientRect();const t=document.elementFromPoint(q.x+q.width/2,q.y+q.height/2);return {cur:window.__zz.st.current,box:[q.x,q.y,q.width,q.height].map(Math.round),hit:t.outerHTML.slice(0,160),txt:document.body.innerText.includes("undefined"), trace: JSON.stringify(window.__zz.st.pendingTrace)}});
console.log(w, JSON.stringify(r));
const ok = await p.locator("#bonecorner").click({timeout:3000}).then(()=>true).catch(()=>false); console.log("click", ok, await p.evaluate(()=>window.__zz.st.current));
}
// banner seed 1555 long wait
await b.close();
