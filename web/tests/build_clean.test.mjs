// W4 回归：干净树（没有 dist/）一次构建不能崩，且 VERSION 必须是本次产物的内容哈希。
// 缺陷：build_dist 在清空/重建 dist 之前就调 resolveVersion 去扫 dist——
//   - 没有 dist/ 时 ENOENT 崩溃；
//   - dist/ 有旧残留时算出的是旧内容的哈希；
//   - 干净树里先 mkdir 空 dist 再构建，第一次还会退化成空目录哈希 e3b0c44298fc，
//     第二次才对（只构建一次就发版会带旧 VERSION）。
// 这里真的 `git archive HEAD` 出一个干净快照，在临时目录里构建一次来验。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";
import { versionHash } from "../tools/version_hash.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const EMPTY_HASH = "e3b0c44298fc"; // sha256("") 的前 12 位

function readVersion(distDir) {
  const sw = fs.readFileSync(path.join(distDir, "sw.js"), "utf8");
  const m = sw.match(/const VERSION = "([0-9a-f]{12})"/);
  assert.ok(m, "sw.js 里应有 12 位 VERSION");
  return m[1];
}

function buildIn(dir) {
  execFileSync(process.execPath, [path.join(dir, "tools", "build_dist.mjs")], { cwd: dir, stdio: "pipe" });
}

test("clean tree (no dist/) builds once with the real content-hash VERSION", { timeout: 120_000 }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zaozi-clean-"));
  try {
    // 1. git archive HEAD → 临时目录（只含已提交文件，等同干净 checkout）
    const tarPath = path.join(tmp, "_head.tar");
    execFileSync("git", ["archive", "HEAD", "-o", tarPath], { cwd: ROOT });
    execFileSync("tar", ["-xf", tarPath, "-C", tmp]);
    fs.rmSync(tarPath);

    // 构建本身只用 Node 内置模块；node_modules 若在就链接过去，防止将来引入依赖后漏掉
    const nm = path.join(ROOT, "node_modules");
    if (fs.existsSync(nm)) {
      try { fs.symlinkSync(nm, path.join(tmp, "node_modules"), "dir"); } catch { /* 已存在则跳过 */ }
    }

    // 2. 干净快照里必须没有 dist/，一次构建不能 ENOENT
    const distTmp = path.join(tmp, "dist");
    assert.ok(!fs.existsSync(distTmp), "干净快照不应带 dist/");
    buildIn(tmp);
    assert.ok(fs.existsSync(path.join(distTmp, "sw.js")), "构建应生成 dist/sw.js");

    const version = readVersion(distTmp);
    assert.notEqual(version, EMPTY_HASH, "干净树一次构建不能是空内容哈希（说明扫到了不存在/空的 dist）");
    assert.equal(version, versionHash(distTmp), "VERSION 必须等于本次产物的内容哈希");

    // 3. 工作树干净时，与仓库里一次构建的结果必须一致（干净树 == HEAD 归档）
    const dirty = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" }).trim();
    if (dirty === "") {
      buildIn(ROOT);
      assert.equal(readVersion(path.join(ROOT, "dist")), version, "干净工作树构建应与 HEAD 归档构建得到相同 VERSION");
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
