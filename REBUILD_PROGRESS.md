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
- [x] src/engine.ts（strip 往返 OK）
- [x] src/types.ts（strip 往返 OK）
- [x] src/validator.ts（strip 往返 OK；类型标注按空格段长度精确填充）
- [x] web/app.js（dev 壳：BUILD_DIST=false、GLYPH_BASE="../"、import 走 ../src、../data）
- [x] web/serve.mjs（dev 静态服务器，--dist 开关，端口 5178，现场生成 /src 与 /data）
- [x] web/serve_pages.mjs（模拟 Cloudflare Pages：/index.html 与 /credits.html 308 规范化，_headers 规则生效）
- [x] tools/：build_dist.mjs、sw.template.js（{{VERSION}}/{{FILES}} 占位符）、version_hash.mjs、credits_table.mjs、credits_template.html（__COUNT__/__ROWS__ 占位符）、public_csv.mjs、compare_baseline.mjs、baseline_version.txt、dist/_headers（构建时写 `/sw.js\n  Cache-Control: no-cache\n`）
- [x] tests/（node --test，10 个用例全过）
- [x] 构建 + 逐文件对比 + 测试，附最终逐文件状态（见下）

## 最终验证（2026-10-14 11:30 CST）

- `npm run build`：built dist/ — 130 files (incl. sw.js + _headers), VERSION=7dc14fa2ab57（经 tools/baseline_version.txt 钉住）
- `node tools/compare_baseline.mjs`：IDENTICAL 129 / DIFF 0 / BASELINE-ONLY 0 / DIST-ONLY 1（_headers，线上抓不到，属预期）→ **PASS**
- `npm test`：tests 10, pass 10, fail 0

## 版本哈希结论

- 对「全部发布文件内容 sha256 取前 12 hex」试遍合理变体（排序/遍历序、拼接/换行分隔/带路径、
  含不含 `_headers`、排除 sw.js、hash-of-hashes、sha1/md5/sha512），**无一命中 `7dc14fa2ab57`**。
- 结论：原版本号不是内容哈希，极可能就是丢失仓库的 git short hash（12 hex）。
- 处理：`tools/version_hash.mjs` 实现内容哈希（`versionHash()`，对同字节长度内容变化敏感，
  有用例锁定），构建时按 `--version` > `ZAOZI_VERSION`/`VERSION_OVERRIDE` >
  `tools/baseline_version.txt`（钉住 `7dc14fa2ab57`）> 内容哈希 的顺序取版本号。

## 逐文件状态（最终）
- [x] dist/_headers — DIST-ONLY（线上抓不到，内容 `/sw.js` + `Cache-Control: no-cache`）
- [x] dist/app.js — IDENTICAL (23405 B)
- [x] dist/credits.html — IDENTICAL (36339 B)
- [x] dist/data/chars_slice.js — IDENTICAL (2780 B)
- [x] dist/data/chars_slice.json — IDENTICAL (2616 B)
- [x] dist/data/input_map.js — IDENTICAL (2091 B)
- [x] dist/data/input_map.json — IDENTICAL (1929 B)
- [x] dist/data/rules.js — IDENTICAL (4948 B)
- [x] dist/data/rules.json — IDENTICAL (4790 B)
- [x] dist/data/year1_cards.js — IDENTICAL (5271 B)
- [x] dist/data/year1_cards.json — IDENTICAL (5107 B)
- [x] dist/glyph/glyph_pack_v1.csv — IDENTICAL (43845 B)
- [x] dist/glyph/img/commons/ben_bronze.svg — IDENTICAL (4403 B)
- [x] dist/glyph/img/commons/ben_seal.svg — IDENTICAL (4591 B)
- [x] dist/glyph/img/commons/hao_bronze.svg — IDENTICAL (5583 B)
- [x] dist/glyph/img/commons/hao_oracle.svg — IDENTICAL (5100 B)
- [x] dist/glyph/img/commons/hao_seal.svg — IDENTICAL (5335 B)
- [x] dist/glyph/img/commons/he_bronze.svg — IDENTICAL (2034 B)
- [x] dist/glyph/img/commons/he_oracle.svg — IDENTICAL (1127 B)
- [x] dist/glyph/img/commons/he_seal.svg — IDENTICAL (2853 B)
- [x] dist/glyph/img/commons/huo_bronze.svg — IDENTICAL (3246 B)
- [x] dist/glyph/img/commons/huo_clerical.svg — IDENTICAL (2232 B)
- [x] dist/glyph/img/commons/huo_oracle.svg — IDENTICAL (2179 B)
- [x] dist/glyph/img/commons/huo_seal.svg — IDENTICAL (2276 B)
- [x] dist/glyph/img/commons/ji_bronze.svg — IDENTICAL (4112 B)
- [x] dist/glyph/img/commons/ji_oracle.svg — IDENTICAL (4683 B)
- [x] dist/glyph/img/commons/ji_seal.svg — IDENTICAL (5369 B)
- [x] dist/glyph/img/commons/jian_bronze.svg — IDENTICAL (5343 B)
- [x] dist/glyph/img/commons/jian_oracle.svg — IDENTICAL (3356 B)
- [x] dist/glyph/img/commons/jian_seal.svg — IDENTICAL (6263 B)
- [x] dist/glyph/img/commons/li_bronze.svg — IDENTICAL (3179 B)
- [x] dist/glyph/img/commons/li_clerical.svg — IDENTICAL (1616 B)
- [x] dist/glyph/img/commons/li_oracle.svg — IDENTICAL (1856 B)
- [x] dist/glyph/img/commons/li_seal.svg — IDENTICAL (2774 B)
- [x] dist/glyph/img/commons/lin_bronze.svg — IDENTICAL (5709 B)
- [x] dist/glyph/img/commons/lin_oracle.svg — IDENTICAL (3834 B)
- [x] dist/glyph/img/commons/lin_seal.svg — IDENTICAL (4104 B)
- [x] dist/glyph/img/commons/men_bronze.svg — IDENTICAL (3118 B)
- [x] dist/glyph/img/commons/men_clerical.svg — IDENTICAL (3339 B)
- [x] dist/glyph/img/commons/men_oracle.svg — IDENTICAL (2854 B)
- [x] dist/glyph/img/commons/men_seal.svg — IDENTICAL (2954 B)
- [x] dist/glyph/img/commons/mi_bronze.svg — IDENTICAL (7071 B)
- [x] dist/glyph/img/commons/mi_clerical.svg — IDENTICAL (7722 B)
- [x] dist/glyph/img/commons/mi_oracle.svg — IDENTICAL (5555 B)
- [x] dist/glyph/img/commons/mi_seal.svg — IDENTICAL (3120 B)
- [x] dist/glyph/img/commons/ming_bronze.svg — IDENTICAL (4192 B)
- [x] dist/glyph/img/commons/ming_oracle.svg — IDENTICAL (5550 B)
- [x] dist/glyph/img/commons/ming_seal.svg — IDENTICAL (4979 B)
- [x] dist/glyph/img/commons/mo_bronze.svg — IDENTICAL (8626 B)
- [x] dist/glyph/img/commons/mo_seal.svg — IDENTICAL (8743 B)
- [x] dist/glyph/img/commons/muye_bronze.svg — IDENTICAL (4315 B)
- [x] dist/glyph/img/commons/muye_clerical.svg — IDENTICAL (2127 B)
- [x] dist/glyph/img/commons/muye_oracle.svg — IDENTICAL (2476 B)
- [x] dist/glyph/img/commons/muye_seal.svg — IDENTICAL (2167 B)
- [x] dist/glyph/img/commons/niao_bronze.svg — IDENTICAL (4372 B)
- [x] dist/glyph/img/commons/niao_oracle.svg — IDENTICAL (4774 B)
- [x] dist/glyph/img/commons/niao_seal.svg — IDENTICAL (6324 B)
- [x] dist/glyph/img/commons/nv_bronze.svg — IDENTICAL (3239 B)
- [x] dist/glyph/img/commons/nv_clerical.svg — IDENTICAL (6477 B)
- [x] dist/glyph/img/commons/nv_oracle.svg — IDENTICAL (2919 B)
- [x] dist/glyph/img/commons/nv_seal.svg — IDENTICAL (5060 B)
- [x] dist/glyph/img/commons/shui_bronze.svg — IDENTICAL (2460 B)
- [x] dist/glyph/img/commons/shui_clerical.svg — IDENTICAL (2606 B)
- [x] dist/glyph/img/commons/shui_oracle.svg — IDENTICAL (2117 B)
- [x] dist/glyph/img/commons/shui_seal.svg — IDENTICAL (2815 B)
- [x] dist/glyph/img/commons/tian_bronze.svg — IDENTICAL (1502 B)
- [x] dist/glyph/img/commons/tian_clerical.svg — IDENTICAL (4135 B)
- [x] dist/glyph/img/commons/tian_oracle.svg — IDENTICAL (1668 B)
- [x] dist/glyph/img/commons/tian_seal.svg — IDENTICAL (1516 B)
- [x] dist/glyph/img/commons/yi_bronze.svg — IDENTICAL (6291 B)
- [x] dist/glyph/img/commons/yi_clerical.svg — IDENTICAL (6482 B)
- [x] dist/glyph/img/commons/yi_oracle.svg — IDENTICAL (3702 B)
- [x] dist/glyph/img/commons/yi_seal.svg — IDENTICAL (6384 B)
- [x] dist/glyph/img/commons/yu_bronze.svg — IDENTICAL (6444 B)
- [x] dist/glyph/img/commons/yu_clerical.svg — IDENTICAL (4903 B)
- [x] dist/glyph/img/commons/yu_oracle.svg — IDENTICAL (2128 B)
- [x] dist/glyph/img/commons/yu_seal.svg — IDENTICAL (4968 B)
- [x] dist/glyph/img/commons/yue_bronze.svg — IDENTICAL (3441 B)
- [x] dist/glyph/img/commons/yue_oracle.svg — IDENTICAL (1462 B)
- [x] dist/glyph/img/commons/yue_seal.svg — IDENTICAL (2275 B)
- [x] dist/glyph/img/commons/zi_bronze.svg — IDENTICAL (4184 B)
- [x] dist/glyph/img/commons/zi_oracle.svg — IDENTICAL (2182 B)
- [x] dist/glyph/img/commons/zi_seal.svg — IDENTICAL (4119 B)
- [x] dist/glyph/img/norm/cong_bronze.svg — IDENTICAL (4240 B)
- [x] dist/glyph/img/norm/cong_oracle.svg — IDENTICAL (2921 B)
- [x] dist/glyph/img/norm/cong_seal.svg — IDENTICAL (4183 B)
- [x] dist/glyph/img/norm/mu_bronze.svg — IDENTICAL (3866 B)
- [x] dist/glyph/img/norm/mu_oracle.svg — IDENTICAL (2671 B)
- [x] dist/glyph/img/norm/mu_seal.svg — IDENTICAL (2219 B)
- [x] dist/glyph/img/norm/nan_bronze.svg — IDENTICAL (3138 B)
- [x] dist/glyph/img/norm/nan_oracle.svg — IDENTICAL (2405 B)
- [x] dist/glyph/img/norm/nan_seal.svg — IDENTICAL (2261 B)
- [x] dist/glyph/img/norm/ren_bronze.svg — IDENTICAL (1680 B)
- [x] dist/glyph/img/norm/ren_oracle.svg — IDENTICAL (1499 B)
- [x] dist/glyph/img/norm/ren_seal.svg — IDENTICAL (2199 B)
- [x] dist/glyph/img/norm/ren_slip.svg — IDENTICAL (1714 B)
- [x] dist/glyph/img/norm/ri_bronze.svg — IDENTICAL (1001 B)
- [x] dist/glyph/img/norm/ri_oracle.svg — IDENTICAL (1978 B)
- [x] dist/glyph/img/norm/ri_seal.svg — IDENTICAL (1886 B)
- [x] dist/glyph/img/norm/xiu_bronze.svg — IDENTICAL (3358 B)
- [x] dist/glyph/img/norm/xiu_oracle.svg — IDENTICAL (3416 B)
- [x] dist/glyph/img/norm/xiu_seal.svg — IDENTICAL (3751 B)
- [x] dist/glyph/img/xiaoxue/ben_lishu_raw.png — IDENTICAL (4018 B)
- [x] dist/glyph/img/xiaoxue/cong_lishu_raw.png — IDENTICAL (5258 B)
- [x] dist/glyph/img/xiaoxue/hao_lishu_raw.png — IDENTICAL (5017 B)
- [x] dist/glyph/img/xiaoxue/he_lishu_raw.png — IDENTICAL (4209 B)
- [x] dist/glyph/img/xiaoxue/ji_lishu_raw.png — IDENTICAL (6467 B)
- [x] dist/glyph/img/xiaoxue/jian_lishu_raw.png — IDENTICAL (4816 B)
- [x] dist/glyph/img/xiaoxue/lin_lishu_raw.png — IDENTICAL (5515 B)
- [x] dist/glyph/img/xiaoxue/ming_lishu_raw.png — IDENTICAL (6082 B)
- [x] dist/glyph/img/xiaoxue/mo_lishu_raw.png — IDENTICAL (5035 B)
- [x] dist/glyph/img/xiaoxue/mu_lishu_raw.png — IDENTICAL (4146 B)
- [x] dist/glyph/img/xiaoxue/nan_lishu_raw.png — IDENTICAL (5224 B)
- [x] dist/glyph/img/xiaoxue/niao_lishu_raw.png — IDENTICAL (6023 B)
- [x] dist/glyph/img/xiaoxue/ri_lishu_raw.png — IDENTICAL (6528 B)
- [x] dist/glyph/img/xiaoxue/xiu_lishu_raw.png — IDENTICAL (4651 B)
- [x] dist/glyph/img/xiaoxue/yue_lishu_raw.png — IDENTICAL (4927 B)
- [x] dist/glyph/img/xiaoxue/zi_lishu_raw.png — IDENTICAL (3972 B)
- [x] dist/icons/icon-192.png — IDENTICAL (3761 B)
- [x] dist/icons/icon-512.png — IDENTICAL (10878 B)
- [x] dist/icons/icon.svg — IDENTICAL (1991 B)
- [x] dist/index.html — IDENTICAL (1847 B)
- [x] dist/manifest.webmanifest — IDENTICAL (649 B)
- [x] dist/src/engine.js — IDENTICAL (11167 B)
- [x] dist/src/rng.js — IDENTICAL (604 B)
- [x] dist/src/savecode.js — IDENTICAL (3266 B)
- [x] dist/src/types.js — IDENTICAL (2453 B)
- [x] dist/src/validator.js — IDENTICAL (2507 B)
- [x] dist/style.css — IDENTICAL (4520 B)
- [x] dist/sw.js — IDENTICAL (9980 B)
