// npm run build 产出的 dist/ 与 baseline_dist/ 逐字节一致（除 _headers：
// 线上抓不到，不在 baseline 镜像里，属预期）。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, "dist");
const BASE = path.join(ROOT, "baseline_dist");

function walk(dir, prefix, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? prefix + "/" + ent.name : ent.name;
    if (ent.isDirectory()) walk(path.join(dir, ent.name), rel, out);
    else out.push(rel);
  }
  return out;
}

test("build reproduces baseline_dist (every file)", { timeout: 60_000 }, () => {
  // 真实跑一遍构建（版本号经 tools/baseline_version.txt 钉住 7dc14fa2ab57）
  execFileSync(process.execPath, [path.join(ROOT, "tools", "build_dist.mjs")], {
    cwd: ROOT,
    stdio: "pipe",
  });

  const distFiles = walk(DIST, "", []).sort();
  const baseFiles = walk(BASE, "", []).sort();
  const baseSet = new Set(baseFiles);
  const distSet = new Set(distFiles);

  // baseline 里的每个文件都要在 dist 里逐字节一致
  for (const f of baseFiles) {
    assert.ok(distSet.has(f), `dist 缺 baseline 文件: ${f}`);
    const a = fs.readFileSync(path.join(BASE, f));
    const b = fs.readFileSync(path.join(DIST, f));
    assert.ok(a.equals(b), `dist 与 baseline 不一致: ${f} (baseline ${a.length}B vs dist ${b.length}B)`);
  }
  // dist 只允许比 baseline 多一个 _headers
  const extra = distFiles.filter((f) => !baseSet.has(f));
  assert.deepEqual(extra, ["_headers"], `dist 多出的文件应只有 _headers，实际: ${extra.join(", ")}`);
});
