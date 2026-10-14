// 单测里加载引擎：把 src/*.ts 剥类型、data/*.json 包成模块，放进临时目录再动态 import。
// 和 tools/build_dist.mjs 同一套变换，保证测的就是发布时跑的代码。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { stripTypeScriptTypes } from "node:module";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.dirname(path.dirname(HERE));

export function materialize({ names = null } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zaozi-engine-"));
  fs.mkdirSync(path.join(dir, "src"));
  fs.mkdirSync(path.join(dir, "data"));
  for (const f of fs.readdirSync(path.join(ROOT, "src"))) {
    if (!f.endsWith(".ts")) continue;
    fs.writeFileSync(
      path.join(dir, "src", f.replace(/\.ts$/, ".js")),
      stripTypeScriptTypes(fs.readFileSync(path.join(ROOT, "src", f), "utf8"), { mode: "strip" }),
    );
  }
  for (const f of fs.readdirSync(path.join(ROOT, "data"))) {
    if (!f.endsWith(".json")) continue;
    const json = fs.readFileSync(path.join(ROOT, "data", f), "utf8");
    fs.writeFileSync(path.join(dir, "data", f.replace(/\.json$/, ".js")), "export default " + json);
  }
  const out = {};
  for (const name of names ?? fs.readdirSync(path.join(ROOT, "src")).filter((f) => f.endsWith(".ts")).map((f) => f.replace(/\.ts$/, ""))) {
    out[name] = pathToFileURL(path.join(dir, "src", name + ".js")).href;
  }
  out.__dir = dir;
  return out;
}

let enginePromise = null;
export function loadEngine() {
  if (!enginePromise) {
    const paths = materialize();
    enginePromise = import(paths.engine);
  }
  return enginePromise;
}

// 单独加载剥类型后的 savecode 模块：测旧存档码读取（encodeSaveCodeWith / decodeSaveCode）。
let savecodePromise = null;
export function loadSavecode() {
  if (!savecodePromise) {
    const paths = materialize({ names: ["savecode"] });
    savecodePromise = import(paths.savecode);
  }
  return savecodePromise;
}
