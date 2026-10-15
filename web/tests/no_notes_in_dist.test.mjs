// 发布目录里不能出现私有 csv 的 notes / credit_note 两列。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, "dist");

function walk(dir, prefix, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? prefix + "/" + ent.name : ent.name;
    if (ent.isDirectory()) walk(path.join(dir, ent.name), rel, out);
    else out.push(rel);
  }
  return out;
}

test("no notes/credit_note columns in dist glyph csv", () => {
  const csv = fs.readFileSync(path.join(DIST, "glyph", "glyph_pack_v1.csv"), "utf8");
  const header = csv.split("\n")[0].split(",");
  assert.ok(!header.includes("notes"), "dist csv 表头不能有 notes 列");
  assert.ok(!header.includes("credit_note"), "dist csv 表头不能有 credit_note 列");
});

test("no credit_note content anywhere in dist", () => {
  for (const f of walk(DIST, "", [])) {
    const text = fs.readFileSync(path.join(DIST, f), "utf8");
    assert.ok(!text.includes("credit_note"), `dist 文件里出现 credit_note: ${f}`);
  }
});
