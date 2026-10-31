// 构建 dist/：从 web/ + src/ + data/ + glyph/ + icons/ 生成发布目录，
// 目标是与 baseline_dist/ 逐字节一致（见 tools/compare_baseline.mjs）。
//
// 步骤：拷贝静态资产 → 由 data/*.json 生成 data/*.js → strip src/*.ts →
// 变换 web/app.js（BUILD_DIST/GLYPH_BASE/import 路径）→ 生成 credits.html →
// 汇总文件清单 → 算版本哈希（或钉住）→ 生成 sw.js → 写 _headers。
import { stripTypeScriptTypes } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderCredits } from "./credits_table.mjs";
import { resolveVersion, collectFiles } from "./version_hash.mjs";
import { publicCsv } from "./public_csv.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, "dist");

const rmrf = (dir) => fs.rmSync(dir, { recursive: true, force: true });
const mkdirp = (dir) => fs.mkdirSync(dir, { recursive: true });
const copyFile = (src, dest) => { mkdirp(path.dirname(dest)); fs.copyFileSync(src, dest); };
const writeFile = (dest, content) => { mkdirp(path.dirname(dest)); fs.writeFileSync(dest, content); };
function copyTree(src, dest) {
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name), d = path.join(dest, ent.name);
    if (ent.isDirectory()) copyTree(s, d);
    else copyFile(s, d);
  }
}

// ---- 1. 清空 dist（rm -rf + mkdir -p，干净树里也能从零建出来）----
rmrf(DIST);
mkdirp(DIST);

// ---- 2. 静态资产（逐字节拷贝）----
copyFile(path.join(ROOT, "web/index.html"), path.join(DIST, "index.html"));
copyFile(path.join(ROOT, "web/style.css"), path.join(DIST, "style.css"));
copyFile(path.join(ROOT, "web/manifest.webmanifest"), path.join(DIST, "manifest.webmanifest"));
copyTree(path.join(ROOT, "icons"), path.join(DIST, "icons"));
copyTree(path.join(ROOT, "glyph/img"), path.join(DIST, "glyph/img"));
copyTree(path.join(ROOT, "web/img"), path.join(DIST, "img"));

// ---- 3. glyph CSV（公开版；源 csv 已是公开版，publicCsv 对它幂等）----
const csvText = fs.readFileSync(path.join(ROOT, "glyph/glyph_pack_v1.csv"), "utf8");
writeFile(path.join(DIST, "glyph/glyph_pack_v1.csv"), publicCsv(csvText));

// ---- 4. data/*.js：由 data/*.json 生成（一行注释 + export default + JSON 原文）----
const DATA_HEADER = (name) =>
  `// 由 tools/build_dist.mjs 从 data/${name}.json 生成：浏览器直接吃 JS 模块，不用 import 属性（Safari 老版本不支持）。\n`;
for (const name of ["chars_slice", "input_map", "rules", "year1_cards", "goals", "tutorial", "card_art"]) {
  const json = fs.readFileSync(path.join(ROOT, "data", name + ".json"), "utf8");
  writeFile(path.join(DIST, "data", name + ".js"), DATA_HEADER(name) + "export default " + json);
  writeFile(path.join(DIST, "data", name + ".json"), json);
}

// ---- 5. src/*.ts → dist/src/*.js（stripTypeScriptTypes，等长空格替换类型语法）----
for (const name of ["engine", "rng", "savecode", "types", "validator"]) {
  const ts = fs.readFileSync(path.join(ROOT, "src", name + ".ts"), "utf8");
  const js = stripTypeScriptTypes(ts, { mode: "strip" });
  writeFile(path.join(DIST, "src", name + ".js"), js);
}

// ---- 6. web/app.js → dist/app.js（开发壳 → 发布壳）----
// 构建只翻四处：import 路径 ../ → ./，BUILD_DIST false→true，GLYPH_BASE "../"→"./"；
// 每处都把字符串缩短一个字符（行尾注释列随之左移一列，与原版构建一致）。
let app = fs.readFileSync(path.join(ROOT, "web/app.js"), "utf8");
app = app
  .replaceAll('from "../src/', 'from "./src/')
  .replaceAll('from "../data/', 'from "./data/')
  .replaceAll("BUILD_DIST = false;", "BUILD_DIST = true;")
  .replaceAll('GLYPH_BASE = "../";', 'GLYPH_BASE = "./";');
writeFile(path.join(DIST, "app.js"), app);
copyFile(path.join(ROOT, "web/ui_copy.js"), path.join(DIST, "ui_copy.js"));

// ---- 7. credits.html：模板 + 由 csv 生成的表格行（__COUNT__/__ROWS__ 占位符）----
const creditsTmpl = fs.readFileSync(path.join(ROOT, "tools/credits_template.html"), "utf8");
const sourcesCsv = fs.readFileSync(path.join(ROOT, "data/glyph_sources.csv"), "utf8");
writeFile(path.join(DIST, "credits.html"), renderCredits(csvText, creditsTmpl, sourcesCsv));

// ---- 8. 版本号（内容哈希）----
// 必须等全部发布文件都写完之后再算，而且 dist 已由第 1 步从零重建：
//   - 干净树里 dist 还不存在时先扫会 ENOENT；
//   - 若沿用上一版残留，干净树第一次会算成空目录的哈希 e3b0c44298fc，
//     第二次才对——发版只构建一次就会带着旧 VERSION，用户拿不到新版。
// 优先级：--version 参数 > ZAOZI_VERSION / VERSION_OVERRIDE 环境变量 > 内容哈希。
const version = resolveVersion(DIST, process.argv.slice(2));

// ---- 9. 文件清单 + sw.js ----
// 清单 = dist 内全部文件（除 sw.js 与 _headers），"./index.html" 记作 "./"，
// 排序时把 "./" 当作 "./index.html"（按码点比，ASCII 路径下与默认排序一致），
// 每行 4 条，行尾带逗号。
const distFiles = collectFiles(DIST); // 此刻 dist 里还没有 sw.js 与 _headers
const entries = distFiles.map((f) => (f === "index.html" ? "./" : "./" + f));
const key = (e) => (e === "./" ? "./index.html" : e);
entries.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
const fileLines = [];
for (let i = 0; i < entries.length; i += 4) {
  fileLines.push("  " + entries.slice(i, i + 4).map((e) => `"${e}",`).join(" "));
}
const swTmpl = fs.readFileSync(path.join(ROOT, "tools/sw.template.js"), "utf8");
writeFile(path.join(DIST, "sw.js"), swTmpl.replace("{{VERSION}}", version).replace("{{FILES}}", fileLines.join("\n")));

// ---- 10. _headers（Cloudflare Pages：sw.js 不缓存，每次拉新）----
writeFile(path.join(DIST, "_headers"), "/sw.js\n  Cache-Control: no-cache\n");

console.log(`built dist/ — ${distFiles.length + 2} files (incl. sw.js + _headers), VERSION=${version}`);
