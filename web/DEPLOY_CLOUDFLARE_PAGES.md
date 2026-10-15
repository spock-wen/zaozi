# 造字人 Web · Cloudflare Pages 部署设置（合入 spock-wen/zaozi 后）

本目录（仓库内 `web/`）是从 spock-wen/zaozi-web 以 `git subtree add --prefix=web`（不 squash，保留完整历史）
导入的 Web 版。所有工具、测试都以本目录为根（脚本用 `import.meta.url` / 相对路径定位），不依赖仓库根。

## Pages 项目设置
| 项 | 值 |
|---|---|
| Root directory（根目录） | `web` |
| Build command | `npm run build` |
| Build output directory | `dist`（相对根目录，即仓库里的 `web/dist`） |
| Node | 22（本目录 `.nvmrc`=22；也可在 Pages 环境变量设 `NODE_VERSION=22`）。构建用到 Node 22 的 `node:module` stripTypeScriptTypes，Node 20 会失败 |

- Cloudflare 的 Build output directory 是相对 Root directory 填的：根目录填 `web` 时这里填 `dist`，实际产物就是 `web/dist`。
- 构建只用 Node 内置模块；Pages 会按 package.json 自动 `npm install`（只装 playwright 这一个 devDep，构建不需要它）。
- `dist/sw.js` 和 `dist/_headers` 都由 `tools/build_dist.mjs` 生成；**不要手改 sw.js**。VERSION 是产物内容哈希（`tools/version_hash.mjs`），构建自动写入。
- 鸿蒙/仓颉部分（仓库根的 `entry/`、`AppScope/` 等）与本目录互不引用；Pages 只看 `web/`。
- 若想只在 `web/` 变动时触发 Pages 构建，可在 Pages 的 Build watch paths 里填 `web/*`（可选）。

## 本地（在仓库根执行）
```sh
cd web
npm ci
npm run build        # → web/dist，打印 VERSION
npm test             # 单测
npm run e2e          # 三引擎 e2e（串行；同一 checkout 里不要并行跑，会互相清掉 dist/）
```

## 测试门禁脚本（测试交件用）
- `python3 web/tools/qa/verdict_gate.py <matrix.csv> <report.md>`
- `python3 web/tools/qa/sticky_blocked.py <report.md>`（默认读同目录 `BLOCKED_LEDGER.tsv`）
- 历次复测的 `tools/qa/web/<sha>/run_all.sh` 用 `REPO` 环境变量指向要跑 e2e 的目录：
  合入后应为 `<zaozi 克隆>/web`，例如 `REPO=/workspace/qa-zaozi/web bash run_all.sh`；不设时沿用原默认 `/workspace/qa-zaozi-web-repo`（zaozi-web 克隆）。
