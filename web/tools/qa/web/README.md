# 测试独立验收矩阵（造字人 web）
- pages_server.py：Cloudflare Pages 模拟器（308 规范化跳转、_headers、webp MIME；根目录从文件读，可热切换模拟发版）
- qa_matrix.mjs：`DIST=… BASE_DIST=… node qa_matrix.mjs <chromium|firefox|webkit> <port> <outdir>`；`ONLY_VP=390` 只跑一个视口
- merge_matrix.py：合并各引擎矩阵并套用人工复核裁定 → verdict_gate.py 可读的 CSV
- banner_recheck.mjs / dbg2-4.mjs：缺陷复现与复核脚本
- sha_check.py：卡图三方 sha 对照（agy 生成）
需要 Node ≥22 和 playwright（仓库 devDeps）。

合入 spock-wen/zaozi 后：脚本在 `web/tools/qa/web/`，playwright 从 `web/node_modules` 解析（先在 `web/` 里 `npm ci`）；`DIST` 指向 `<zaozi 克隆>/web/dist`。各轮 `run_all.sh` 的 e2e 目录用 `REPO=<zaozi 克隆>/web` 指定（默认仍是旧的 zaozi-web 克隆路径）。
