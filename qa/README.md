# qa/ — 造字人 web 测试一条命令

## 一条命令（在仓库根目录）
```bash
bash qa/run_all.sh --quick     # 中间轮：375x667、360x800 触屏 + 1920x1080 桌面 × 三引擎（PM T4）
bash qa/run_all.sh --full      # 合并版/上线候选：R14 门内 15 格 × 三引擎 + R15 边界
```
常用选项：`--engines "chromium"`（先跑通一个引擎）、`--skip-e2e`、`--skip-layout`、`--skip-build`、`--out DIR`、`--port N`。
需要 Node 22（`node -v` 是 v22.x；盒内会自动用 `/home/box/.local/node22`）和已装好的 Playwright 浏览器。
浏览器任务串行：若存在 `/workspace/qa-locks/browser.lock`（或设 `QA_LOCK`），每个浏览器任务都在 `flock` 下跑。

它依次做：`cd web && npm ci && npm run build` → 起本地服务（`qa/test/pages_server.py`，Pages 行为模拟）→ 增量/矩阵脚本 → 版式检查 → e2e 套件（`web/tests/e2e`，每引擎一遍，TAP）→ 若有 `qa/review/run_review.sh` 或 `qa/review/run.sh` 则调用（qa/review/ 由工程审核维护，本脚本不创建、不修改）→ 生成矩阵 → 两门禁。

## 输出在哪
`qa/out/<时间>_<quick|full>/`（已 gitignore）：
- `REPORT.md` 第一行 `总结论: …`；下面是各块判定分布、FAIL/BLOCKED 清单、未测范围。
- `MATRIX.csv`：列 `块,项,R号,引擎,模式,视口,判定,原因,证据路径`；每个非 PASS 格都有原因和证据路径（截图都是全屏 fullPage）。
- `gate.txt`：`verdict_gate.py` 与 `sticky_blocked.py` 的输出。
- `jobs.tsv`（每个任务 rc/耗时/是否有产物）、`logs/`、各脚本子目录（`p91/ p21/ keybar/ carve/ d4/ short/ p7/ layout/ e2e/`）。

## 怎么看结果
- `总结论:` 只有三种值：`PASS`（仅 --full 且全部格 PASS）、`部分验证`（--quick 无 FAIL 时固定写「部分验证（中间轮增量，全量留合并版）」；或有 BLOCKED/N/A）、`不过门`（任何一格 FAIL）。
- 退出码：两门禁都过 = 0（注意：结论是「不过门」时门禁也会过，门禁只保证结论与矩阵一致）；门禁违规 = 1；构建/环境错误 = 2。
- BLOCKED = 脚本没跑出结果（超时、注入未生效、时序没对上），不是产品结论，要排查脚本后重跑。

## 送测规则（R24）
程序员送测前必须在自己的 tip 上跑通 `bash qa/run_all.sh --quick`，把 `REPORT.md` 第一行、矩阵计数和 `gate.txt` 全文附进送测单；没有这份输出不收测。

## R 号对照表（/workspace/zaozi-rules/BEHAVIOR_RULES_mobile_next.md）
| 脚本 | R 号 | 验什么 |
|---|---|---|
| `test/p91_reset.mjs` | R10 + R01 | 新局/导入/读档清队后，飞出中触点卡片仍入队、出锁定提示（P9-1） |
| `test/p21_preview.mjs` | R10 | 飞出途中重开局/导入/读档后，旧局 ← 预览不带入：无高亮、首次 ← 只预览（A-R7 P2-1） |
| `test/keybar.mjs` | R12（D1）、A-R7 P3-3、R14 | 刻字阶段键位行/「?」浮层无「左右/← →」、无「Enter 刻」、有 K 刻（浮层有 S 先不刻），不溢出视口 |
| `test/carve_dwell.mjs` | R08、R02 | 排队 →→ 进刻字卡后落定 +100ms 现场 K/骨片：须排队，≥落定+230ms 才刻 |
| `test/p7_audit.mjs` | R02、R01、R08、R10 | 停留窗口、排队先于现场输入、飞出中 K 不入队、重置时 toast/清队顺序、#toast-live |
| `test/d4_restore.mjs` | E1-D4、R21 | 启动渲染抛错时存档不得被删/改，去掉异常后回到同一局 |
| `test/too_short.mjs` | R15 | 320x568/375x553/359x700/1280x599 必出 #too-short（文案一字不差、视口内、不挡 ☰、pointer-events:none）；门内尺寸不出；360x640/1280x600 只记录 |
| `test/layout/run_layout_checks.sh` | R13、R14、R16、R18 | 版式 A 文字框不出界、B 提示所指可见、C 对比度、S 验收、E 核心元素（左右选项等）可见 |
| `web/tests/e2e/*.test.mjs` | R01–R12 等（按文件） | 程序员的永久 e2e，三引擎各一遍 |
| `gate/verdict_gate.py`、`gate/sticky_blocked.py` | 交件门禁 | 结论与矩阵一致、BLOCKED 账本不被写成 PASS（`gate/BLOCKED_LEDGER.tsv`，可用 `QA_LEDGER` 换路径） |

尺寸清单在 `test/viewports.sh`（R14 门内 15 格、R15 边界、--quick 三格），都可用环境变量覆盖。

## 工程审核清单
`qa/review/` 留给工程审核放自己的检查脚本和入口（`run_review.sh <dist> <outdir>` 或 `run.sh`）。run_all 只在它存在时调用，测试侧不往里放东西。
