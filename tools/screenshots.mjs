// 发布截图：起 serve_pages.mjs（服务已构建的 dist/），用 chromium 在五个视口各截一张
// 全页图，落到 release_shots_v2/。用法: node tools/screenshots.mjs [--out DIR]
import { spawn } from "node:child_process";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const argv = process.argv.slice(2);
const OUT = path.resolve(ROOT, argv[argv.indexOf("--out") + 1] || "release_shots_v2");
const SEED = 20261012;
const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 768 },
  { name: "1280", width: 1280, height: 800 },
  { name: "1440", width: 1440, height: 900 },
];

if (!fs.existsSync(path.join(ROOT, "dist", "index.html"))) {
  console.error("dist/index.html 不存在——先 npm run build（干净树）。");
  process.exit(1);
}

const port = await new Promise((resolve, reject) => {
  const s = net.createServer();
  s.on("error", reject);
  s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => resolve(p)); });
});
const server = spawn(process.execPath, [path.join(ROOT, "web", "serve_pages.mjs"), "--port", String(port)], { cwd: ROOT, stdio: ["ignore", "pipe", "inherit"] });
await new Promise((resolve, reject) => {
  const to = setTimeout(() => reject(new Error("serve_pages 启动超时")), 10000);
  server.stdout.on("data", (d) => { if (String(d).includes("http://localhost")) { clearTimeout(to); resolve(); } });
  server.on("error", reject);
});
const origin = `http://localhost:${port}`;

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  await page.goto(`${origin}/?seed=${SEED}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__zz);
  await page.waitForTimeout(500);
  const file = path.join(OUT, `${vp.name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`${vp.name} -> ${path.relative(ROOT, file)}`);
  await ctx.close();
}
await browser.close();
server.kill();
