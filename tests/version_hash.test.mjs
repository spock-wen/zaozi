// 版本哈希对内容敏感：同字节长度的内容变化必须改变哈希（否则换版本时
// Service Worker 不会失效）。同时验证同内容哈希稳定。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import { versionHash } from "../tools/version_hash.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("versionHash changes when content changes with same byte length", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zaozi-ver-"));
  try {
    const file = path.join(tmp, "a.txt");
    fs.writeFileSync(file, "aaaa"); // 4 bytes
    const h1 = versionHash(tmp);
    fs.writeFileSync(file, "bbbb"); // 仍 4 bytes，内容变了
    const h2 = versionHash(tmp);
    assert.notEqual(h1, h2, "同字节长度但内容不同，哈希必须变");

    fs.writeFileSync(file, "bbbb");
    const h3 = versionHash(tmp);
    assert.equal(h2, h3, "同内容哈希必须稳定");
    assert.match(h1, /^[0-9a-f]{12}$/, "哈希是 12 个 hex");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("versionHash differs between two same-length dist trees", () => {
  const tmpA = fs.mkdtempSync(path.join(os.tmpdir(), "zaozi-verA-"));
  const tmpB = fs.mkdtempSync(path.join(os.tmpdir(), "zaozi-verB-"));
  try {
    // 两棵各 2 文件、总字节数相同的 dist 树
    fs.writeFileSync(path.join(tmpA, "x.js"), "const v = 1;\n");
    fs.writeFileSync(path.join(tmpA, "y.js"), "const w = 2;\n");
    fs.writeFileSync(path.join(tmpB, "x.js"), "const v = 1;\n");
    fs.writeFileSync(path.join(tmpB, "y.js"), "const w = 3;\n"); // 同长度不同内容
    assert.notEqual(versionHash(tmpA), versionHash(tmpB));
  } finally {
    fs.rmSync(tmpA, { recursive: true, force: true });
    fs.rmSync(tmpB, { recursive: true, force: true });
  }
});
