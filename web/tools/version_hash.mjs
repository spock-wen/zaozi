// 发布版本哈希：对 dist 内全部已发布文件（除 sw.js 与 _headers）的内容求 sha256，
// 取前 12 个 hex。原算法随源码仓库丢失，已试遍合理变体都无法复现线上的
// 7dc14fa2ab57（它很可能本来就是那个仓库的 git short hash），所以构建时：
//   - 给了 ZAOZI_VERSION 环境变量或 --version 参数就钉住用它（字节级复现用）；
//   - 否则用这里的内容哈希（确定、可复现，但与线上值不同）。
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function collectFiles(distDir, exclude = new Set(["sw.js", "_headers"])) {
  const out = [];
  (function walk(dir, prefix) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? prefix + "/" + ent.name : ent.name;
      if (ent.isDirectory()) walk(dir + "/" + ent.name, rel);
      else if (!exclude.has(ent.name)) out.push(rel);
    }
  })(distDir, "");
  out.sort();
  return out;
}

export function versionHash(distDir) {
  const files = collectFiles(distDir);
  const h = createHash("sha256");
  for (const f of files) h.update(fs.readFileSync(path.join(distDir, f)));
  return h.digest("hex").slice(0, 12);
}

// 构建时按优先级解析版本号：
//   1. --version 命令行参数
//   2. 环境变量 ZAOZI_VERSION / VERSION_OVERRIDE
//   3. tools/baseline_version.txt（重建期钉住 baseline 的 7dc14fa2ab57，
//      让 npm run build 能逐字节复现线上 dist）
//   4. 都没有才用内容哈希 versionHash()
export function resolveVersion(distDir, argv = []) {
  const cli = argv[argv.indexOf("--version") + 1];
  if (cli) return cli;
  if (process.env.ZAOZI_VERSION) return process.env.ZAOZI_VERSION;
  if (process.env.VERSION_OVERRIDE) return process.env.VERSION_OVERRIDE;
  const pinFile = path.join(path.dirname(path.dirname(path.resolve(import.meta.url.replace("file://", "")))), "tools", "baseline_version.txt");
  if (fs.existsSync(pinFile)) return fs.readFileSync(pinFile, "utf8").trim();
  return versionHash(distDir);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const distDir = process.argv[2] || "dist";
  console.log(versionHash(distDir));
}
