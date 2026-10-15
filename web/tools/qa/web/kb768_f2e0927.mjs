import { chromium, firefox, webkit } from "playwright";
for (const [n,T] of Object.entries({chromium,firefox,webkit})) { const b=await T.launch();
 for (const [lab,o] of [["768m",{viewport:{width:768,height:1024}}],["768t",{viewport:{width:768,height:1024},hasTouch:true,...(n!=="firefox"?{isMobile:true}:{})}],["1280",{viewport:{width:1280,height:800}}]]) {
  const c=await b.newContext(o); const p=await c.newPage(); await p.goto("http://localhost:9990/?seed=7"); await p.waitForFunction(()=>!!window.__zz); await p.waitForTimeout(400);
  const r=await p.evaluate(()=>{const k=document.querySelector("#keys");const g=document.querySelector("#gesture-hint");const vis=e=>e&&e.offsetParent!==null&&getComputedStyle(e).display!=="none"&&getComputedStyle(e).visibility!=="hidden";return {view:document.body.dataset.view,fine:matchMedia("(hover:hover) and (pointer:fine)").matches,keys:vis(k)?k.innerText.trim().slice(0,50):"(hidden)",gest:vis(g)?g.innerText.trim().slice(0,50):"(hidden)"}});
  await p.screenshot({path:`../run/shots/${n}_${lab}_cardphase_keys.png`,fullPage:true});
  console.log(n,lab,JSON.stringify(r)); await c.close(); } await b.close(); }
