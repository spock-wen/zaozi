// 本分支改了源码，dist 不再与 baseline_dist 逐字节一致——原来那套「字节复现 baseline」
// 测试只对重建分支有意义，已在本分支移除（见 REDESIGN_REPORT.md 的已知缺口）。
// 这里保留仍然有意义的检查：构建成功、发布文件齐全、src → dist 的剥类型变换忠实、
// VERSION 来自内容哈希（本分支已解钉 tools/baseline_version.txt）。
import { stripTypeScriptTypes } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";
import { versionHash } from "../tools/version_hash.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, "dist");
const SRC = ["engine", "rng", "savecode", "types", "validator"];

test("build produces a complete, self-consistent dist", { timeout: 60_000 }, () => {
  execFileSync(process.execPath, [path.join(ROOT, "tools", "build_dist.mjs")], {
    cwd: ROOT,
    stdio: "pipe",
  });

  for (const f of [
    "index.html", "app.js", "style.css", "sw.js", "credits.html", "manifest.webmanifest",
    "data/goals.js", "data/tutorial.js", "data/year1_cards.js", "data/chars_slice.js",
    "src/engine.js", "glyph/glyph_pack_v1.csv",
  ]) {
    assert.ok(fs.existsSync(path.join(DIST, f)), `dist 缺文件 ${f}`);
  }

  // dist/src/*.js 必须就是 strip(src/*.ts) 的结果（构建变换忠实）
  for (const name of SRC) {
    const ts = fs.readFileSync(path.join(ROOT, "src", name + ".ts"), "utf8");
    const js = fs.readFileSync(path.join(DIST, "src", name + ".js"), "utf8");
    assert.equal(js, stripTypeScriptTypes(ts, { mode: "strip" }), `dist/src/${name}.js 必须是 strip(src/${name}.ts)`);
  }

  // VERSION 来自内容哈希，不是钉住的 baseline 值
  const sw = fs.readFileSync(path.join(DIST, "sw.js"), "utf8");
  const m = sw.match(/const VERSION = "([0-9a-f]{12})"/);
  assert.ok(m, "sw.js 的 VERSION 应是 12 位内容哈希");
  assert.equal(m[1], versionHash(DIST), "VERSION 必须等于内容哈希（本分支已解钉）");
});
