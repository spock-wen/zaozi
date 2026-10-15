// 复现：锁卡拖动后立即点「刻」
import { chromium } from "playwright";
const b = await chromium.launch();
for (const wait of [1900]) for (const menu of [false, true]) {
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p.goto("http://localhost:5381/?seed=20261012"); await p.waitForFunction(() => !!window.__zz);
if (menu) { await p.locator("#menubtn").click(); await p.waitForTimeout(200); await p.screenshot({path:"/tmp/x.png",fullPage:true}); await p.locator("#menubtn").click(); await p.waitForTimeout(150); }
for (const k of ["ArrowLeft","ArrowLeft"]) await p.keyboard.press(k); await p.waitForTimeout(700);
for (const k of ["ArrowRight","ArrowRight"]) await p.keyboard.press(k); await p.waitForTimeout(700);
const c = await p.locator("#card").boundingBox(); const cx=c.x+c.width/2, cy=c.y+c.height/2;
await p.mouse.move(cx,cy); await p.mouse.down(); await p.mouse.move(cx+c.width*.5,cy,{steps:6}); await p.mouse.up();
await p.waitForTimeout(wait);
const info = await p.evaluate(()=>{const q=document.querySelector("#bonecorner").getBoundingClientRect();const t=document.elementFromPoint(q.x+q.width/2,q.y+q.height/2);return {box:[q.x,q.y].map(Math.round), hit:t.outerHTML.slice(0,200), card: getComputedStyle(document.querySelector("#card")).transform, cls: document.querySelector("#card").className}});
await p.screenshot({path:"/tmp/y.png",fullPage:true});
const ok = await p.locator("#bonecorner").click({timeout:2000}).then(()=>true).catch(()=>false);
console.log(wait, menu, JSON.stringify(info), "click", ok, await p.evaluate(()=>window.__zz.st.current));
}
await b.close();
