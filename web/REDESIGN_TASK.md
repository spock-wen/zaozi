# 造字人 Web 重做 · 任务书（REDESIGN_TASK.md）

分支 `feat/web-redesign-v2`。基线 = 当前源码（`src/*.ts` 引擎、`web/` 壳、`tools/build_dist.mjs`）。
设计已批准，放在 `design/`。**不改玩法数值/规则**，只做下面列出的改动。

不改：`baseline_dist/`、`tools/qa/`。Node 22。Playwright 已在 devDeps。
硬规则：每步先 commit 再 build dist；不干净的树不 build。每步更新 `REDESIGN_PROGRESS.md`。

## 需求 → 出处

### A. 目标与流程（PM 决定 §5，`design/v4_gamefeel/`）
| # | 需求 | 出处 |
|---|---|---|
| A1 | 资源条保持 DOM；预览圆点也是 DOM 浮层 | 决定 1；GAMEFEEL_SPEC §5.1、§4 |
| A2 | 目标 60fps，只动 transform/opacity；Chromium 4x CPU 节流验证 | 决定 2；GAMEFEEL_SPEC §5.2 |
| A3 | 桌面 ←/→ 先预览，再按同向或 Enter 才提交；K = 刻字；Enter 不再等于刻 | 决定 3；GAMEFEEL_SPEC §1.1；BREAKPOINTS |
| A4 | 每代小目标、开局挑字、多代流程、教学顺序字段、第 3 张锁左右拖 | 决定 4/5；GAMEFEEL_SPEC §1.4/1.5、§3 |
| A5 | 目标文案取 `GOALS_COPY.md` v2.1；不出现「（占位）」与内部术语 | 决定 5；GOALS_COPY v2.1 |
| A6 | `goals.json` 说明「本年」→「本代」 | 决定 5；GOALS_COPY 待确认 6 |
| A7 | 四维目标在**代末**判定 | 决定 5；GOALS_COPY 待确认 2；engine.ts:331-333 |
| A8 | gf4 示例目标（会意字 / 骨片攒到 5 / 一年不落字）不实现 | 决定 5；GAMEFEEL_SPEC §5.3 |
| A9 | 达成横幅在「寿终传笔」结局**之前**单独出现，不重叠 | 决定 5；GOALS_COPY 待确认 4；GAMEFEEL_SPEC §1.4 |
| A10 | 第 1 代目标池排除 G_ENGRAVE1（教学已强制刻一次） | 决定 5；GOALS_COPY 待确认 5 |
| A11 | 音效用 WebAudio 合成；菜单里有静音开关，存 localStorage | 决定 6；GAMEFEEL_SPEC §2 |
| A12 | 横幅只在飘字结束后出现 | 决定 7；GAMEFEEL_SPEC §1.4 |
| A13 | 挑字界面没有事签占位格 | 决定 8；GAMEFEEL_SPEC §5.8 |
| A14 | 挑字界面采用 spec 的键位 | 决定 9；GAMEFEEL_SPEC §1.5 |
| A15 | prefers-reduced-motion → 120ms 淡入淡出代替动效 | 决定 10；GAMEFEEL_SPEC §5.9 |
| A16 | 平板按 BREAKPOINTS；手机横屏提示转竖屏；侧栏开合存 localStorage；~1024 强制收起侧栏 | 决定 11；BREAKPOINTS |
| A17 | 开局挑字候选只用 14 字切片（水日人木田火力月 休林从男明 本），选 3；显示现代字；季节标签在挑字阶段就要填 | 决定；GAMEFEEL_SPEC「出发挑字字池」 |

### B. 审核 P0 / QA 修（brief 18-19）
| # | 需求 |
|---|---|
| B1 | P0 ☰ 菜单在手机/平板竖屏必须可见可点：右上、44px 点击区 |
| B2 | 虚线只是点击区标注，不画；只在 `:focus-visible` 出焦点环 |
| B3 | 1440 时教学气泡距侧栏 ≥16px |
| B4 | resize 节流 |
| B5 | 重放存档失败：先备份存档再删除。绝不显示「卡面图（占位）」或任何占位文案 |
| B6 | D1/D2：每个按钮处理 pointer/touch 与 click 双触发一次 |
| B7 | 点「天亮了」不能穿透点到新翻出的「交给第2代」 |
| B8 | 目标弹窗打开瞬间不能被关掉 |
| B9 | 静音每次点击只切换一次 |
| B10 | 导出对话框在 1024 宽要能打开 |
| B11 | D4：拖已锁的卡出专属提示「先点卡角骨片刻下这件事」；toast 不遮字匣 |

### C. 卡面图（brief 20，`design/v5_cardart/`）
| # | 需求 |
|---|---|
| C1 | 资产拷进发布树 `web/img/cardart/` |
| C2 | `<picture>`：webp srcset 1x/2x + png 兜底 |
| C3 | 手机 296×216；电脑 400×292 比例、不裁切 |
| C4 | 每个文件进 SW 预缓存清单 |
| C5 | 严格按 `card_art_map.json`：先人卡无图；「休」借的 strong 图**不许**上线（只有标记上线的条目才发） |

### D. 字源与版权（brief 21）
| # | 需求 |
|---|---|
| D1 | `design/v4_gamefeel/glyphs` 的 3 个水字形（oracle/bronze/seal）进字形包 |
| D2 | 版权行按 `SOURCES.csv` |
| D3 | seal 行要列出 credit 列的署名：Richard Sears (ACClicense s07887; Courtesy, permission and copyright from Richard Sears website © 2003) |
| D4 | 只发公共字段；notes/credit_note 内部列不进 dist（现有测试保持） |

### E. 存档 / 版本 / 测试 / 交付（brief 22-26）
| # | 需求 |
|---|---|
| E1 | 旧存档码仍可读 |
| E2 | dist VERSION 来自内容哈希（本分支解钉 baseline 覆盖；baseline 测试改成有意义的形式或删掉并在报告说明） |
| E3 | 单测（node --test）+ Playwright e2e：chromium/firefox/webkit × 视口 390×844、768×1024、1024×768、1280×800、1440×900 |
| E4 | e2e 覆盖：各视口菜单/存档/静音/版权（含 390、768）；挑字；目标；多代流程；教学；D1/D2 双触发回归；锁卡提示；卡面图加载（picture/webp）且先人无图；SW 装好后离线；serve_pages.mjs 跳转 |
| E5 | Chromium 4x CPU 节流下的 60fps 检查 |
| E6 | 交付：本分支提交；干净树 build 的 dist；`release_shots_v2/` 全页截图（390/768/1024/1280/1440，提交）；`REDESIGN_REPORT.md`（改动清单、各引擎测试数、新 VERSION、commit sha、已知缺口） |
| E7 | 不部署 |

## 设计稿坐标（实现参考）
- 色板：night-800 `#1E2230`、night-700 `#2B3042`、night-line `#3A4057`；paper-50 `#FAF6EC`、paper-100 `#F3ECDD`、paper-200 `#E6DCC6`、paper-line `#D8CCB2`；zhu-600 `#B5432E`；gold-400 `#D8B46A`；骨片 bone-100 `#F1E8D4` / bone-200 `#E4D6B8` / bone-crack `#B9A57C`；跌 `#E08A74`、涨 `#8FB8A8`。
- 手机：状态区→资源条 44→卡（宽=屏宽−32，高=clamp）→选项行→手势行→字匣条 110（距底 24）。上拉面板 328×420。菜单 220 宽。
- 平板竖：同手机，卡宽 = min(屏宽−64, 480)。平板横：卡居中，右侧 320 侧栏默认收起（右缘 44 标签）。
- 桌面 ≥1024：顶栏 56 + 中央卡 + 左右选项 192 宽 + 卡下字匣 + 底部键位行 + 右侧可收起侧栏 336（≥1440 默认展开，1024–1439 默认收起）。
