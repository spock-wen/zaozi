// 验证 src/*.ts 经 stripTypeScriptTypes 后与 baseline_dist/src/*.js 字节一致。
// 用法: node tools/check_strip.mjs [file...]
import { stripTypeScriptTypes } from "node:module";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.dirname(path.dirname(path.resolve(import.meta.url.replace("file://", ""))));
const targets = process.argv.slice(2).length ? process.argv.slice(2) : ["engine", "rng", "savecode", "types", "validator"];
let fail = 0;
for (const name of targets) {
  const tsPath = path.join(ROOT, "src", name + ".ts");
  const jsPath = path.join(ROOT, "baseline_dist", "src", name + ".js");
  const ts = fs.readFileSync(tsPath, "utf8");
  const want = fs.readFileSync(jsPath, "utf8");
  let got;
  try {
    got = stripTypeScriptTypes(ts, { mode: "strip" });
  } catch (e) {
    console.log(`${name}.ts  PARSE/STRIP ERROR: ${e.message}`);
    fail++;
    continue;
  }
  if (got === want) {
    console.log(`${name}.ts  OK (${ts.length} bytes)`);
  } else {
    fail++;
    console.log(`${name}.ts  MISMATCH`);
    const g = got.split("\n");
    const w = want.split("\n");
    for (let i = 0; i < Math.max(g.length, w.length); i++) {
      if (g[i] !== w[i]) {
        console.log(`  line ${i + 1}:`);
        console.log(`    want: ${JSON.stringify(w[i])}`);
        console.log(`    got : ${JSON.stringify(g[i])}`);
      }
    }
  }
}
process.exit(fail ? 1 : 0);
