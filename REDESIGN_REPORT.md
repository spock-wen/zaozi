# 造字人 Web 重做 · 交付报告（REDESIGN_REPORT.md）

分支 `feat/web-redesign-v2`。基线 = 重建源码树（`src/*.ts` 引擎、`web/` 壳、`tools/build_dist.mjs`）。
玩法数值/规则不改，只做任务书（`REDESIGN_TASK.md`）列出的改动。

- **dist VERSION**：`7ec28f7d7403`（内容哈希，干净树构建；本分支已解钉 `tools/baseline_version.txt`）
- **构建 commit**：`51267ac5ae6724aeda8c1a409c849128e3304672`
- **dist 文件数**：184（含 `sw.js`、`_headers`）
- **不部署**（brief E7）。

## 一、改动清单

### A. 目标与流程（PM 决定 §5）
- **数据**：`data/goals.json`（每代 3 个目标，文案取 `GOALS_COPY.md` v2.1，`placeholder:false`，无「（占位）」/内部术语，数字用汉字；第 1 代池排除 `G_ENGRAVE1`，四维目标 `dim_goal_judged_at=generation_end`）；`data/tutorial.json`（T01–T05 教学步骤 + 锁拖 + 先人卡文案）；`data/year1_cards.json`（教学卡顺序字段 `tutorial`/`only_tutorial`/`lock_choice`/`trace`，卡片 `title`）；`data/chars_slice.json`（`pick_chars` 14 字池）。
- **引擎**（`src/engine.ts`）：每代目标生成（第 1 代固定、第 2 代起按 (种子,代数) 定序挑 3）、开局挑字（`pick_toggle`/`heir`/`begin_generation`）、教学顺序与第 3 张锁左右拖、多代流程（代末结算 → 先人 → 挑字 → 下一代，字录/事签传承）；代末判四维目标。**数值一律读 `data/*.json`，未改。**
- **壳**（`web/`）：四维资源条 DOM + 预览圆点 DOM 浮层（决定 1）；桌面 ←/→ 先预览、同向或 Enter 提交、K = 刻字（决定 3）；目标小签/清单/达成横幅（横幅等飘字结束再出、先于结局，决定 7/A9/A12）；WebAudio 音效 + 菜单静音开关存 localStorage（决定 6）；`prefers-reduced-motion` → 120ms 淡入淡出（决定 10）。

### B. 审核 P0 / QA 修
- ☰ 菜单手机/平板竖屏右上 44×44 可点（B1）；只在 `:focus-visible` 出焦点环（B2）；1440 教学气泡距侧栏 ≥16（B3，见下）；resize 节流（B4）。
- 重放失败先备份存档再删（B5）；绝不显示占位文案（B5）。
- 每个按钮用 click 单通道，pointer/touch 与 click 不双触发（D1/D2）；「天亮了」不穿透到新翻出的「交给第2代」（B7）；目标弹窗打开瞬间不被关（B8）；静音每次只切一次（B9）；导出对话框在 1024 能开（B10）；拖已锁卡出专属提示「先点卡角骨片刻下这件事」、toast 不遮字匣（B11）。

### C. 卡面图（v5_cardart）
- 资产拷进发布树 `web/img/cardart/`（48 个：6 图 × m/d × 1x/2x × webp/png）；`<picture>` + webp srcset 1x/2x + png 兜底（手机 296×216、电脑 400×292 比例不裁切）；`build_dist.mjs` 拷贝 `web/img`，`sw.js` 预缓存全部 48 个（构建时自动生成清单）。
- 严格按 `card_art_map.json`：只登记上线条目 C01–C10；先人卡无图；「休」借的 strong 图**不上线**（`data/card_art.json` 无 `gf4-休`）。

### D. 字源与版权
- `design/v4_gamefeel/glyphs` 的 水 oracle/bronze/seal 三字形并入 `glyph/img/commons/`（与设计稿逐字节一致），`glyph/glyph_pack_v1.csv` 有对应行。
- `data/glyph_sources.csv`（公开字段）按 `SOURCES.csv`；`credits.html` 的 seal 行列出 credit 列署名：**Richard Sears (ACClicense s07887; Courtesy, permission and copyright from Richard Sears website © 2003)**。notes/credit_note 内部列不进 dist（`tools/public_csv.mjs` + 现有测试）。

### E. 存档 / 版本 / 测试 / 交付
- 旧存档码仍可读（`savecode` 格式未变，单测覆盖）。
- dist VERSION 来自内容哈希；本分支解钉 `tools/baseline_version.txt`，原「字节复现 baseline」测试在本分支移除并改为有意义检查（构建完整 + `dist/src` 忠实于 strip + VERSION=内容哈希），见「已知缺口」。
- 单测 + Playwright e2e（chromium/firefox/webkit × 390×844 / 768×1024 / 1024×768 / 1280×800 / 1440×900）。
- 干净树构建 dist；`release_shots_v2/` 五档全页截图（已提交）；本报告。

### 重做过程中修掉的两个真实缺陷
1. **字形首屏不出图**：重写把 `loadGlyphs` 的重绘限制成只在 pick/winter，card 阶段字匣/字录停在文字兜底。恢复基线行为（每次字形加载都 `render()`）。
2. **桌面教学气泡**：原本压在四维行上、1280 时挡住卡角骨片。按 gf3 电脑稿降到卡顶并设 `pointer-events:none`；同时修「收起侧栏在桌面/平板横仍占 336 宽」（BREAKPOINTS：收起只留 44 标签，改回 `width:0`）。
   （另修 `index.html` 重复的 `#goals-slip` id。）

## 二、测试

### 单测（`node --test`，`npm test`）——16 个，引擎无关
- `engine.test.mjs`：教学开局顺序与普通牌堆隔离；每代目标（第 1 代排除 G_ENGRAVE1、后续定序可复现）；目标文案无占位/无字母数字；第 3 张锁拖一进来就刻；即时目标在落字触发、四维目标代末判定；多代流程（ended→heir→pick→begin_generation 传字录、取 3 挑字）；14 字挑字池；旧存档码可读可回放。
- `card_art.test.mjs`：只发 C01–C10、先人无图、`gf4-休` 不上线、资产与设计稿逐字节一致、发布目录无杂文件。
- `build_dist.test.mjs`：构建完整、`dist/src` 忠实于 strip、VERSION=内容哈希。
- `no_notes_in_dist.test.mjs`：dist 无 notes/credit_note。
- `version_hash.test.mjs`：内容哈希对同长度内容变化敏感。

### e2e（`npm run e2e` = node:test + playwright 库；本项目只装了 `playwright`，无 `@playwright/test`）
`tests/e2e/helpers/env.mjs` 在干净树重建 dist 并起 `web/serve_pages.mjs`（Pages 模拟器）。**共 28 个，全过。**

| 引擎 | viewports（菜单/存档/静音/版权） | flow（教学→卡面图→目标→冬夜→先人→挑字→第2代） | offline（SW 后断网） | fps（4× 节流） | 小计 |
|---|---|---|---|---|---|
| chromium | 5 | 3 | 1 | 1 | **10** |
| firefox | 5 | 1 | 1 | 0 | **7** |
| webkit | 5 | 1 | 1 | 0 | **7** |

另 4 个引擎无关：`redirects.test.mjs`（`/index.html`→`/`、`/credits.html`→`/credits` 308；`/credits` 服内容；`/sw.js` no-cache）。
关键断言：390/768 菜单 44×44 可见可点、导出弹层在 1024 可开；静音 pointer+click 只切一次（D1）；字匣字形首屏出图；卡面图 `<picture>`+webp 实际加载；先人卡无图；锁卡提示含「骨片」且 toast 在字匣之上；「天亮了」不穿透；目标弹层打开后 500ms 仍在；挑字 14 字池、季节标签已填；手机横屏转竖屏提示；SW 装好后断网仍能起局。
**60fps 检查**：chromium `Emulation.setCPUThrottlingRate(4)` 下稳态 **60.0fps**（均 16.67ms，p95 16.70ms）。

## 三、已知缺口
- **无真机测试**：e2e 用模拟视口与合成指针事件，未在真手机/平板上验证触控、安全区（`env(safe-area-inset-*)`）与横竖切换。
- **音效未试听**：WebAudio 合成的音色未被真人听过；测试只验证静音开关的状态与「一次点击只切一次」，不验声音本身。
- **部分动效未实现**：翻牌 / 演变条、「开春展开」（`renderSprout`）仍为空实现；这不影响任务书列出的功能点。
- **baseline 逐字节一致测试**：本分支源码已改，dist 不再与 `baseline_dist/` 逐字节一致，原测试对本分支无意义，已替换为「构建完整 + strip 忠实 + VERSION=内容哈希」。`baseline_dist/` 与 `tools/qa/` 未改动。
- **平板横屏用侧栏**：设计稿「待确认」项，未真机确认；横屏手机（<600 高）按决定显示转竖屏提示。
- **桌面 1024 教学气泡**：与卡右上角有轻微视觉重叠（气泡 `pointer-events:none`，不影响骨片/拖卡点击）。
