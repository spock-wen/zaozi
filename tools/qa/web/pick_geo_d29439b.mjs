import { chromium } from "playwright";
const b=await chromium.launch(); 
for (const w of [1024,1280,1440]) { const p=await (await b.newContext({viewport:{width:w,height:w==1440?900:800}})).newPage(); await p.goto("http://localhost:9991/?seed=7"); await p.waitForFunction(()=>!!window.__zz);
await p.evaluate(()=>{ window.__zz.dispatch ? 0:0; });
// jump: use imported state via engine? simply play quickly via keyboard
for(let i=0;i<120;i++){const s=await p.evaluate(()=>window.__zz.st.phase); if(await p.locator("#pick").isVisible())break;
 if(s==="engrave"){await p.evaluate(()=>document.querySelector("#bonecorner").click());}
 else if(s==="card"){await p.keyboard.press("ArrowLeft");await p.keyboard.press("ArrowLeft");}
 else if(s==="winter"){await p.locator("#winter [data-do=end]").click();await p.waitForTimeout(3000);}
 else { for (const sel of ["#endseq [data-do=elder]","#elder [data-do=heir]"]) if(await p.locator(sel).isVisible().catch(()=>0)) await p.locator(sel).click(); }
 await p.waitForTimeout(450);}
const r=await p.evaluate(()=>[...document.querySelectorAll("#pick .cand")].slice(0,14).map(c=>{const im=c.querySelector("img,svg,picture,.g");const sp=c.querySelector("span");if(!im||!sp)return c.dataset.char+":?";const a=im.getBoundingClientRect(),s=sp.getBoundingClientRect();return c.dataset.char+":"+Math.round(Math.max(0,a.bottom-s.top))}).join(" "));
const geo=await p.evaluate(()=>{const g=s=>{const b=document.querySelector(s)?.getBoundingClientRect();return b&&[Math.round(b.x),Math.round(b.y),Math.round(b.width),Math.round(b.height)]};return {h2:g("#pick h2"),slots:g("#pick .pickslots"),pool:g("#pick .pool"),desc:g("#pick-desc"),go:g("#pick .go"),hint:g("#pick .season-note")}});
console.log(w,"glyph压字px:",r); console.log(w,JSON.stringify(geo)); await p.screenshot({path:`../run/shots/chromium_${w}_pick_geo.png`}); }
await b.close(); process.exit(0)
