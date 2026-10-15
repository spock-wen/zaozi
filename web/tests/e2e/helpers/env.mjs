// e2e 公共设施：从干净已提交树构建 dist（缺了就建）、起一个模拟 Cloudflare Pages 的
// 静态服务器（web/serve_pages.mjs，带 308 规范化跳转与 _headers），并给出三引擎工厂。
// 用 node:test 驱动，直接用 playwright 库（本项目只装了 playwright，没有 @playwright/test）。
import { spawn, execFileSync } from "node:child_process";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, firefox, webkit } from "playwright";

export const ROOT = path.dirname(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))));
export const DIST = path.join(ROOT, "dist");
export const SEED = 20261012;

const ALL_ENGINES = { chromium, firefox, webkit };
// E2E_ENGINES=firefox 或 "firefox,webkit"：只跑指定引擎（默认三引擎全跑）。
// 只影响按 ENGINES 迭代的用例；写死引擎名的用例在别的引擎缺席时会自行 skip。
const only = (process.env.E2E_ENGINES || "").split(",").map((s) => s.trim()).filter(Boolean);
export const ENGINES = only.length
  ? Object.fromEntries(Object.entries(ALL_ENGINES).filter(([n]) => only.includes(n)))
  : ALL_ENGINES;

// 视口清单（brief）：390×844、768×1024、1024×768、1280×800、1440×900
export const VIEWPORTS = [
  { name: "390", width: 390, height: 844, view: "mobile" },
  { name: "768", width: 768, height: 1024, view: "tablet-portrait" },
  { name: "1024", width: 1024, height: 768, view: "desktop" },
  { name: "1280", width: 1280, height: 800, view: "desktop" },
  { name: "1440", width: 1440, height: 900, view: "desktop" },
];

// 从当前源码重建 dist（e2e 要测的就是将要发布的产物）。
export function buildDist() {
  execFileSync(process.execPath, [path.join(ROOT, "tools", "build_dist.mjs")], { cwd: ROOT, stdio: "pipe" });
}

export async function freePort() {
  return await new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}

// 起 serve_pages.mjs（Pages 模拟器，服务 dist/）。返回 { origin, close }。
export async function startServer() {
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(ROOT, "web", "serve_pages.mjs"), "--port", String(port)], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error("serve_pages 启动超时")), 10000);
    child.stdout.on("data", (d) => {
      if (String(d).includes("http://localhost")) { clearTimeout(to); resolve(); }
    });
    child.on("error", reject);
    child.on("exit", (c) => reject(new Error("serve_pages 退出 " + c)));
  });
  return { origin: `http://localhost:${port}`, close: () => child.kill() };
}

// 收集页面错误与 console error，供断言「无报错」。
export function collectErrors(page, bucket) {
  page.on("pageerror", (e) => bucket.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") bucket.push("console: " + m.text()); });
}

// 真实点击 + 模拟 pointerdown/pointerup 与 click 同时到达一个按钮，用来回归
// 「D1/D2：指针/触摸与 click 不能触发两次」。壳只监听 click，所以效果必须只发生一次。
export async function firePointerThenClick(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
    el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  }, selector);
}

export const phaseOf = (page) => page.evaluate(() => window.__zz.st.phase);
export const stateOf = (page) => page.evaluate(() => window.__zz.st);
