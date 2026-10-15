// 开发静态服务器：默认跑 web/ 里的 dev 壳（端口 5178）。
// dev 壳（web/app.js）用 "../src/*.js"、"../data/*.js" 引用源文件 —— 本服务现场生成：
//   /src/*.js  = src/*.ts 经 stripTypeScriptTypes 剥掉类型（与构建产物同款）
//   /data/*.js = data/*.json 包成 ES 模块（与构建产物同款）
// /glyph/*、/icons/* 直接映射到仓库目录。加 --dist 改跑 dist/（纯静态，不再生成）。
// 用法: node web/serve.mjs [--dist] [--port N]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { stripTypeScriptTypes } from "node:module";

const ROOT = path.dirname(path.dirname(path.resolve(import.meta.url.replace("file://", ""))));
const argv = process.argv.slice(2);
const DIST = argv.includes("--dist");
const PORT = Number(argv[argv.indexOf("--port") + 1]) || 5178;

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

// dev 模式下由源码现场生成的两个目录（.ts -> 剥类型，.json -> 包成模块）。
function devGenerated(urlPath) {
  if (urlPath.startsWith("/src/") && urlPath.endsWith(".js")) {
    const tsPath = path.join(ROOT, "src", urlPath.slice("/src/".length).replace(/\.js$/, ".ts"));
    if (!fs.existsSync(tsPath)) return null;
    return stripTypeScriptTypes(fs.readFileSync(tsPath, "utf8"), { mode: "strip" });
  }
  if (urlPath.startsWith("/data/") && urlPath.endsWith(".js")) {
    const jsonPath = path.join(ROOT, "data", urlPath.slice("/data/".length).replace(/\.js$/, ".json"));
    if (!fs.existsSync(jsonPath)) return null;
    const json = fs.readFileSync(jsonPath, "utf8");
    const name = path.basename(jsonPath);
    return `// 由 tools/build_dist.mjs 从 data/${name} 生成：浏览器直接吃 JS 模块，不用 import 属性（Safari 老版本不支持）。\nexport default ${json}`;
  }
  return null;
}

const server = http.createServer((req, res) => {
  try {
    let urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (urlPath.endsWith("/")) urlPath += "index.html";
    if (DIST) {
      // --dist：dist/ 里全是成品，静态发出去即可
      const filePath = path.join(ROOT, "dist", urlPath);
      if (!filePath.startsWith(path.join(ROOT, "dist")) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404).end("not found");
        return;
      }
      res.writeHead(200, { "content-type": MIME[path.extname(filePath)] || "application/octet-stream" });
      res.end(fs.readFileSync(filePath));
      return;
    }
    const generated = devGenerated(urlPath);
    if (generated !== null) {
      res.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
      res.end(generated);
      return;
    }
    // 其余：web/ 优先，缺了再试仓库根部的 /glyph、/icons
    const candidates = [path.join(ROOT, "web", urlPath), path.join(ROOT, urlPath)];
    for (const filePath of candidates) {
      if (filePath.startsWith(ROOT) && fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
        res.writeHead(200, { "content-type": MIME[path.extname(filePath)] || "application/octet-stream" });
        res.end(fs.readFileSync(filePath));
        return;
      }
    }
    res.writeHead(404).end("not found");
  } catch (e) {
    res.writeHead(500).end(String(e));
  }
});

server.listen(PORT, () => {
  console.log(`zaozi dev server (${DIST ? "dist" : "web"}) at http://localhost:${PORT}/`);
});
