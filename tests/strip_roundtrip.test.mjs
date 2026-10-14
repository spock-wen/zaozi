// src/*.ts 经 stripTypeScriptTypes 剥离后与 dist/src/*.js 逐字节一致。
import { stripTypeScriptTypes } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = ["engine", "rng", "savecode", "types", "validator"];

for (const name of SRC) {
  test(`strip roundtrip: src/${name}.ts`, () => {
    const ts = fs.readFileSync(path.join(ROOT, "src", name + ".ts"), "utf8");
    const want = fs.readFileSync(path.join(ROOT, "baseline_dist", "src", name + ".js"), "utf8");
    const got = stripTypeScriptTypes(ts, { mode: "strip" });
    assert.equal(got, want, `strip(${name}.ts) must equal baseline_dist/src/${name}.js`);
  });
}
