import { chromium, firefox, webkit } from "playwright";
for (const [n, t] of Object.entries({ chromium, firefox, webkit })) { const b = await t.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.setContent('<div id=x style="position:fixed;left:300px;top:0;width:200px;height:300px;background:red"></div>');
  const r = await p.evaluate(() => [388.9, 389.3, 389.49, 389.5, 389.54, 389.98].map(x => x + ":" + (document.elementFromPoint(x, 100)?.id || "null")).join(" "));
  console.log(n, r); await b.close(); }
