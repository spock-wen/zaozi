# 造字人源码重建进度（REBUILD_PROGRESS）

目标：从 `baseline_dist/`（线上 dist 的字节级镜像，VERSION `7dc14fa2ab57`）重建源码树与构建管线，
使 `npm run build` 产出的 `dist/` 与 `baseline_dist/` **逐字节一致**。

约束：
- 不改 `baseline_dist/`；不用网络；不手动 git push（post-commit 钩子会自动推，保留不动）。
- `dist src/*.js` 由 `stripTypeScriptTypes(ts, { mode: "strip" })` 产出：类型语法被等长空
  格替换。因此 dist JS 里的空格段标记了原类型标注的位置/长度。
- 校验工具：`node tools/check_strip.mjs`（逐个文件验证 strip 往返字节一致）。

## 已确认的事实

- Node 22.23.3，`node:module` 的 `stripTypeScriptTypes` 可用（实验特性）。
- strip 行为（实测）：类型语法（含 `import type`、单行 interface/type、`as T`、`satisfies T`、
  多行类型）整体替换为等长空格；**类型区内部已有空白符原样保留**（含 U+2002 en space）；
  注释、字符串、代码原样保留；行结构不变；CRLF/尾换行保留。
- `data/*.js` 由 `data/*.json` 生成，格式 = 一行注释 + `export default ` + JSON 原文（无尾分号）：
  `// 由 tools/build_dist.mjs 从 data/<name>.json 生成：浏览器直接吃 JS 模块，不用 import 属性（Safari 老版本不支持）。`
- `glyph/glyph_pack_v1.csv`（dist 版）已是公开版：`notes`、`credit_note` 两列已被移除；
  原始私有 csv 已丢失，源 csv 就用它本身，`tools/public_csv.mjs` 对它幂等。
- `sw.js` 的 `FILES` 清单：dist 内全部文件（除 `sw.js` 自身与 `_headers`）加 `"./"`，
  排序键把 `"./"` 当作 `"./index.html"`（即排在 `./icons/*` 之后、`./manifest.webmanifest` 之前），
  每行 4 条，`"./path"` 形式，行尾带逗号。
- dist 里有 `_headers`（`/sw.js` + `Cache-Control: no-cache`），但不进 sw.js 的 FILES 清单
  （baseline_dist 里缺 `_headers`：线上没抓到，共 129 文件）。

## 版本哈希（version_hash）

- 原算法未知：对「全部发布文件内容 sha256 取前 12 hex」试遍了合理变体（排序/遍历序、
  拼接/换行分隔/带路径、含不含 `_headers`、sw.js 占位符替换、hash-of-hashes、
  其他摘要算法），**无一命中 `7dc14fa2ab57`**。它很可能本就是丢失仓库的 git short hash。
- 处理：`tools/version_hash.mjs` 照「内容哈希」实现并记录过程；构建时若环境变量
  `ZAOZI_VERSION` 或 `--version` 给出钉住值则用它，否则用内容哈希。字节级校验构建
  （`tools/compare_baseline.mjs`、测试）钉住 `7dc14fa2ab57` 以复现 dist。

## 阶段

- [x] 脚手架：package.json / .gitignore / 本进度文件 / tools/qa（保留 .gitkeep 与既有 QA 脚本）
- [x] 静态资产：data/*.json、glyph/（csv + img）、icons/、web/index.html、web/manifest.webmanifest、web/style.css（逐字节核对一致）
- [x] src/rng.ts、src/savecode.ts（strip 往返 OK）
- [ ] src/engine.ts
- [ ] src/types.ts
- [ ] src/validator.ts
- [ ] web/app.js（dev 壳）+ web/serve.mjs + web/serve_pages.mjs
- [ ] tools/：build_dist.mjs、sw.template.js、version_hash.mjs、credits_table.mjs、credits_template.html、public_csv.mjs、compare_baseline.mjs、dist/_headers
- [ ] tests/（node --test）
- [ ] 构建 + 逐文件对比 + 测试，附最终逐文件状态

## 逐文件状态（最终）

（构建完成后附在这里）
