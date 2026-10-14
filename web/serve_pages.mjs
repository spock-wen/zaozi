// 模拟 Cloudflare Pages 的静态托管（默认端口 5179，dist/ 为发布目录）：
//   - /index.html 308 跳到 /，/credits.html 308 跳到 /credits（Pages 的规范化跳转）
//   - /credits 直接服 credits.html 的内容（规范化后的地址）
//   - 读 dist/_headers，按规则给响应加 Header（现只有 /sw.js -> Cache-Control: no-cache）
// _headers 格式：路径独占一行（可带 * 通配），下面缩进的「Header: Value」逐条套用。
// 用法: node web/serve_pages.mjs [--port N]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.dirname(path.dirname(path.resolve(import.meta.url.replace("file://", ""))));
const argv = process.argv.slice(2);
const PORT = Number(argv[argv.indexOf("--port") + 1]) || 5179;
const DIST = path.join(ROOT, "dist");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".csv": "text/csv; charset=utf-8",
};

// 解析 _headers：返回 [{ pattern, headers: [[name, value]] }]
function parseHeadersFile(text) {
  const rules = [];
  let current = null;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    if (/^\S/.test(line)) {
      current = { pattern: line.trim(), headers: [] };
      rules.push(current);
    } else if (current) {
      const m = line.trim().match(/^([^:]+):\s*(.*)$/);
      if (m) current.headers.push([m[1].trim(), m[2].trim()]);
    }
  }
  return rules;
}

// 路径是否匹配 _headers 里的 pattern（支持 * 通配）
function matchPattern(pattern, urlPath) {
  const re = new RegExp("^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
  return re.test(urlPath);
}

const headersRules = fs.existsSync(path.join(DIST, "_headers"))
  ? parseHeadersFile(fs.readFileSync(path.join(DIST, "_headers"), "utf8"))
  : [];

// Pages 的规范化跳转：.html 后缀去掉（308 permanent，保留 query）
const REDIRECTS = { "/index.html": "/", "/credits.html": "/credits" };

const server = http.createServer((req, res) => {
  try {
    const u = new URL(req.url, "http://localhost");
    const urlPath = decodeURIComponent(u.pathname);
    if (REDIRECTS[urlPath]) {
      res.writeHead(308, { location: REDIRECTS[urlPath] + u.search });
      res.end();
      return;
    }
    // 规范化地址直接服对应的 .html
    let filePath = path.join(DIST, urlPath);
    if (urlPath.endsWith("/")) filePath = path.join(filePath, "index.html");
    else if (!path.extname(filePath) && fs.existsSync(filePath + ".html")) filePath += ".html";
    if (!filePath.startsWith(DIST) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404).end("not found");
      return;
    }
    const headers = { "content-type": MIME[path.extname(filePath)] || "application/octet-stream" };
    for (const rule of headersRules) {
      if (matchPattern(rule.pattern, urlPath)) {
        for (const [name, value] of rule.headers) headers[name] = value;
      }
    }
    res.writeHead(200, headers);
    res.end(fs.readFileSync(filePath));
  } catch (e) {
    res.writeHead(500).end(String(e));
  }
});

server.listen(PORT, () => {
  console.log(`zaozi pages emulator at http://localhost:${PORT}/ (root: dist/)`);
});
