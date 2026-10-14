# 测试独立验收矩阵（造字人 web）
- pages_server.py：Cloudflare Pages 模拟器（308 规范化跳转、_headers、webp MIME；根目录从文件读，可热切换模拟发版）
- qa_matrix.mjs：`DIST=… BASE_DIST=… node qa_matrix.mjs <chromium|firefox|webkit> <port> <outdir>`；`ONLY_VP=390` 只跑一个视口
- merge_matrix.py：合并各引擎矩阵并套用人工复核裁定 → verdict_gate.py 可读的 CSV
- banner_recheck.mjs / dbg2-4.mjs：缺陷复现与复核脚本
- sha_check.py：卡图三方 sha 对照（agy 生成）
需要 Node ≥22 和 playwright（仓库 devDeps）。
