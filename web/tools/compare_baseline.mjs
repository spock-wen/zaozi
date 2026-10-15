// 逐文件对比 dist/ 与 baseline_dist/：打印每个文件 IDENTICAL/DIFF，
// 最后给汇总。baseline_dist 是线上 dist 的镜像（缺 _headers：线上抓不到），
// 所以 dist 里多出的 _headers 属预期，单独注明。
// 用法：node tools/compare_baseline.mjs [--strict]
//   --strict：把 dist-only 的 _headers 也算失败（默认只警告）。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, "dist");
const BASE = path.join(ROOT, "baseline_dist");
const strict = process.argv.includes("--strict");

function walk(dir, prefix, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? prefix + "/" + ent.name : ent.name;
    if (ent.isDirectory()) walk(path.join(dir, ent.name), rel, out);
    else out.push(rel);
  }
  return out;
}

const distFiles = walk(DIST, "", []).sort();
const baseFiles = walk(BASE, "", []).sort();
const baseSet = new Set(baseFiles);
const distSet = new Set(distFiles);

let identical = 0, diff = 0, baseOnly = 0, distOnly = 0;
const diffList = [], baseOnlyList = [], distOnlyList = [];

for (const f of baseFiles) {
  const a = path.join(BASE, f), b = path.join(DIST, f);
  if (!distSet.has(f)) { baseOnly++; baseOnlyList.push(f); console.log(`BASELINE-ONLY  ${f}`); continue; }
  const ca = fs.readFileSync(a), cb = fs.readFileSync(b);
  if (ca.equals(cb)) { identical++; }
  else { diff++; diffList.push(f); console.log(`DIFF           ${f}  (baseline ${ca.length}B vs dist ${cb.length}B)`); }
}
for (const f of distFiles) {
  if (!baseSet.has(f)) { distOnly++; distOnlyList.push(f); console.log(`DIST-ONLY      ${f}`); }
}

console.log("");
console.log(`对比文件：baseline ${baseFiles.length} 个，dist ${distFiles.length} 个`);
console.log(`IDENTICAL ${identical} / DIFF ${diff} / BASELINE-ONLY ${baseOnly} / DIST-ONLY ${distOnly}`);
if (distOnlyList.length) console.log(`dist 多出的文件（预期只有 _headers，线上抓不到）：${distOnlyList.join(", ")}`);

const fail = diff > 0 || baseOnly > 0 || (strict && distOnly > 0);
console.log(fail ? "结果：FAIL" : "结果：PASS（dist 与 baseline_dist 逐字节一致；_headers 为 dist 独有，属预期）");
process.exit(fail ? 1 : 0);
