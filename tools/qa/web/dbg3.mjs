import { chromium } from "playwright";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const p = await ctx.newPage(); await p.goto("http://localhost:5381/?seed=20261012"); await p.waitForFunction(() => !!window.__zz);
const st = () => p.evaluate(() => window.__zz.st.current + "/" + window.__zz.st.phase);
console.log(await p.locator("#opt-left").isVisible());
const cdp = await ctx.newCDPSession(p);
async function sw(dx){const bb=await p.locator("#card").boundingBox();const cx=bb.x+bb.width/2,cy=bb.y+bb.height/2;await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:cx,y:cy,id:1}]});for(let i=1;i<=8;i++)await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:cx+dx*bb.width*0.6*i/8,y:cy,id:1}]});await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});await p.waitForTimeout(700);}
await p.locator("#menubtn").tap(); await p.waitForTimeout(200); await p.locator("#menubtn").tap(); await p.waitForTimeout(150); console.log("menu", await p.locator("#menu-pop").isVisible());
await sw(-1); console.log("a", await st()); await sw(1); console.log("b", await st());
await sw(1); console.log("b2 drag locked", await st());
const r = await p.evaluate(()=>{const q=document.querySelector("#bonecorner").getBoundingClientRect();const t=document.elementFromPoint(q.x+q.width/2,q.y+q.height/2);return [q.x,q.y,q.width,q.height].map(Math.round)+" "+t.outerHTML.slice(0,100)});
console.log(r);
await p.locator("#bonecorner").tap(); await p.waitForTimeout(600); console.log("c", await st(), await p.locator("#wordbox").innerHTML());
await p.screenshot({path:"run/shots/chromium_390_dbg_after_bonetap.png", fullPage:true});
await b.close();
