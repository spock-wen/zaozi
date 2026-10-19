# 造字人 Web 重做 · 交付报告（REDESIGN_REPORT.md）

分支 `feat/web-redesign-v2`。基线 = 重建源码树（`src/*.ts` 引擎、`web/` 壳、`tools/build_dist.mjs`）。
玩法数值/规则不改，只做任务书（`REDESIGN_TASK.md`）列出的改动。

- **dist VERSION**：`742618efcde2`（内容哈希，干净树构建；本分支已解钉 `tools/baseline_version.txt`）
- **构建 commit**：本分支 tip `feat/web-redesign-v2`（推送后即 `git rev-parse HEAD`，本报告随该 tip 一同提交）；不写死 SHA，避免与 tip 不符
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
- 每个按钮用 click 单通道，pointer/touch 与 click 不双触发（D1/D2）；「天亮了」不穿透到新翻出的「交给第2代」（B7）；目标弹窗打开瞬间不被关（B8）；静音每次只切一次（B9）；导出对话框在 1024 能开（B10）；拖已锁卡出专属提示「先点卡角骨片刻下这件事」、toast 不遮字匣（B11）。目标弹层/菜单的「点外面收起」同时监听 `pointerdown` 与 `click`，兼容触控（D2，见下）。

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
- 干净树构建 dist；`release_shots_v2/` 五档全页截图（已提交，本次改动只动 JS 交互，重生成后逐字节一致，无需刷新）；本报告。

### 重做过程中修掉的三个真实缺陷
1. **字形首屏不出图**：重写把 `loadGlyphs` 的重绘限制成只在 pick/winter，card 阶段字匣/字录停在文字兜底。恢复基线行为（每次字形加载都 `render()`）。
2. **桌面教学气泡**：原本压在四维行上、1280 时挡住卡角骨片。按 gf3 电脑稿降到卡顶并设 `pointer-events:none`；同时修「收起侧栏在桌面/平板横仍占 336 宽」（BREAKPOINTS：收起只留 44 标签，改回 `width:0`）。
   （另修 `index.html` 重复的 `#goals-slip` id。）
3. **WebKit 触控点空白处不收起目标弹层/菜单**：新增的 390 触控 e2e 发现，WebKit 对普通元素的一次 tap 不合成 `click`，导致只监听 `click` 的「点外面收起」永不触发。改为 `pointerdown` + `click` 双通道（合成 click 仍有效，不破坏既有测试）。

## 二、测试

### 单测（`node --test`，`npm test`）——16 个，引擎无关
- `engine.test.mjs`：教学开局顺序与普通牌堆隔离；每代目标（第 1 代排除 G_ENGRAVE1、后续定序可复现）；目标文案无占位/无字母数字；第 3 张锁拖一进来就刻；即时目标在落字触发、四维目标代末判定；多代流程（ended→heir→pick→begin_generation 传字录、取 3 挑字）；14 字挑字池；旧存档码可读可回放。
- `card_art.test.mjs`：只发 C01–C10、先人无图、`gf4-休` 不上线、资产与设计稿逐字节一致、发布目录无杂文件。
- `build_dist.test.mjs`：构建完整、`dist/src` 忠实于 strip、VERSION=内容哈希。
- `no_notes_in_dist.test.mjs`：dist 无 notes/credit_note。
- `version_hash.test.mjs`：内容哈希对同长度内容变化敏感。

### e2e（`npm run e2e` = node:test + playwright 库；本项目只装了 `playwright`，无 `@playwright/test`）
`tests/e2e/helpers/env.mjs` 在干净树重建 dist 并起 `web/serve_pages.mjs`（Pages 模拟器）。**共 46 个，全过。**

| 引擎 | viewports（菜单/存档/静音/版权） | flow（390/1280/1440：教学→卡面图→目标→冬夜→先人→挑字→第2代） | touch（390 hasTouch/tap + 1024：D1/D2/D4/挑字/无占位） | offline（SW 后断网） | fps（4× 节流） | 小计 |
|---|---|---|---|---|---|---|
| chromium | 5 | 3 | 4 | 1 | 1 | **14** |
| firefox | 5 | 3 | 4 | 1 | 0 | **13** |
| webkit | 5 | 3 | 4 | 1 | 0 | **13** |

chromium 另有 2 个专属：1440 教学气泡距侧栏 ≥16 且不压四维行（B3）、568×320 手机横屏转竖屏提示 → chromium 合计 **16**。
另 4 个引擎无关：`redirects.test.mjs`（`/index.html`→`/`、`/credits.html`→`/credits` 308；`/credits` 服内容；`/sw.js` no-cache）。合计 16 + 13 + 13 + 4 = **46**。
关键断言：390/768 菜单 44×44 可见可点、导出弹层在 1024 可开；静音 pointer+click 只切一次（D1）；字匣字形首屏出图；卡面图 `<picture>`+webp 实际加载；先人卡无图；锁卡提示含「骨片」且 toast 在字匣之上；「天亮了」不穿透；目标弹层打开后 500ms 仍在；挑字 14 字池、季节标签已填；手机横屏转竖屏提示；SW 装好后断网仍能起局。
**新增触控套件**（`touch.test.mjs`，390 `hasTouch` + `tap()`，三引擎）：D1 tap「天亮了」不穿透且代末总结先出；D2 目标弹层一次 tap 不秒关、静音每次 tap 只切一次（390 与 1024）、导出弹层 1024 能开；D4 拖锁定第 3 张卡出「先点卡角骨片刻下这件事」且 toast 不遮字匣；挑字恰为 14 字切片并以现代字呈现、季节标签非空；全 UI 可见文本无「占位」。
**60fps 检查**：chromium `Emulation.setCPUThrottlingRate(4)` 下稳态 **60.0fps**（均 16.67ms，p95 16.70ms）。

## 三、已知缺口
- **无真机测试**：e2e 用模拟视口与合成指针事件，未在真手机/平板上验证触控、安全区（`env(safe-area-inset-*)`）与横竖切换。
- **音效未试听**：WebAudio 合成的音色未被真人听过；测试只验证静音开关的状态与「一次点击只切一次」，不验声音本身。
- **部分动效未实现**：翻牌 / 演变条、「开春展开」（`renderSprout`）仍为空实现；这不影响任务书列出的功能点。
- **baseline 逐字节一致测试**：本分支源码已改，dist 不再与 `baseline_dist/` 逐字节一致，原测试对本分支无意义，已替换为「构建完整 + strip 忠实 + VERSION=内容哈希」。`baseline_dist/` 与 `tools/qa/` 未改动。
- **平板横屏用侧栏**：设计稿「待确认」项，未真机确认；横屏手机（<600 高）按决定显示转竖屏提示。
- **桌面 1024 教学气泡**：与卡右上角有轻微视觉重叠（气泡 `pointer-events:none`，不影响骨片/拖卡点击）。

## 第三轮（作家审核 GOALS_CHECK_c9a1886，2026-10-14 13:2x UTC+8）
- P1：目标达成横幅改用 goals.json 的 banner（如「达成　落一个字」），引擎事件带 banner，壳显示 ev.banner（238c201）。单测 + e2e 断言横幅文本。
- checkFail 提前结算行为保持不变（提前结束一代仍按代末判定）。
- package.json engines node>=22；npm test / e2e 在 Node<22 时先报清楚的错误并退出（39cd01c，tools/check_node.mjs）。
- 构建 commit 39cd01cd2151e14542cfcbea7214892227d43aba，VERSION f9f8a39eabcb；单测 17/17，e2e 46/46。

## 第四轮（QA 721f03a 复测 W1–W4 + 目标可达性，2026-10-14 UTC+8）
- W1 菜单「字源与版权」可跳转（d7e1ac2，credits_link e2e）。W4 干净 checkout 一次构建即正确，VERSION 在所有文件写完后算（0a98b53，build_clean 测试）。W3 T03 迹文案改读正确字段（71e020f）。W2 教学气泡不压「刻」，5 视口×3 引擎断言（1a74793）。
- 目标可达性：GOAL_REACHABILITY.md；tools/goal_sweep.mjs；?debug=1&debug_goal=<ID>（bb3a302）。G_FOOD_65/G_OUT_65 可达（点名打 100%），稀有是因为不在第 1 代固定集 + 随机打漂移。发现 G_ENGRAVE1 在当前规则下永远抽不到（未改设计，待 PM）。
- QA 提交 3d0f362（tools/qa/web/）已在分支上。
- 构建 commit 3e54792，VERSION f9f8a39eabcb；单测 25/25，e2e 73/73。

## 第五轮（PM 确认 G_ENGRAVE1 排除为缺陷，2026-10-14 UTC+8）
- G_ENGRAVE1 只从第 1 代排除，第 2 代起可抽（8799d01）；回归单测（1d827bf）。goal_sweep 2000×4 重跑：抽到 15145、达成 2064。可复现：种子 0，第 2 代抽到，第 3 代达成（GOAL_REACHABILITY.md §四/§五）。
- 构建 commit bddf816，VERSION f9f8a39eabcb；单测 26/26，e2e 73/73。

## 第六轮（工程复审 2026-10-14 UTC+8：报告头 / 版权页介绍 / 挑字）
- **报告头**（本文件顶部）去掉写死的旧构建 SHA（原 `39cd01c…`），改成「本分支 tip + VERSION」，不再写死 SHA。VERSION 更新为本次 dist 内容哈希 `177929f5b1ef`（本轮改了 `web/app.js`、`web/style.css`、`tools/credits_template.html`，故与上一版 `f9f8a39eabcb` 不同）。
- **版权页介绍**（`tools/credits_template.html`）去掉内部路径 `glyph/glyph_pack_v1.csv` 与 `<code>`，只留公开措辞（字、阶段、来源、许可、署名、原始链接）。新增 `tests/credits_public.test.mjs`：用真实模板 + 真实 csv 渲染 `credits.html`，断言不含 `glyph_pack` / `glyph/` / `<code>` / `baseline`，并保留公开措辞与 Richard Sears 署名。
- **挑字界面**（`web/app.js` + `web/style.css`）对齐 `design/v4_gamefeel/gf5_pick.html`：出发键两态「还差字」（未选满、灰、禁用）/「带这三个字出发」（选满、朱、可用）；提示按档位——桌面「点字，或用 ← → 移动、Space 选 · Backspace 放回最后一个 · Enter 出发」，手机点选引导「点一个字看它能做什么；再点一次带上。」；按钮改全宽 48 高胶囊。挑字池仍为 14 字切片（`PICK_CHARS`）。
- **e2e**：`flow.test.mjs`（390/1280/1440）断言 14 候选、桌面提示含 ← → 与 Space、按钮文案为 gf5 两态之一且选满切成「带这三个字出发」；`touch.test.mjs`（390 三引擎）断言手机点选引导与按钮两态。未新增用例节点，仍 73。
- 本轮不动：空的开春展开（P2）、9d0b 坏 SW。
- 构建 commit：本分支 tip，VERSION `177929f5b1ef`；单测 28/28，e2e 73/73。

## 第七轮（QA W5 挑字两步，2026-10-14 UTC+8）
- 挑字改两步（c00e5ec）：点一下只开说明卡（落/部件/解锁），不入格；再点同一字变朱、入下一格；点已选字或格子放回。键盘 ← → / Space / Backspace / Enter 不变。390 触控 e2e 三引擎断言 tap1/tap2/tap3。
- 768 断点核对：BREAKPOINTS.md 定义 600–1023 竖屏 = 平板竖屏「同手机结构」、触控为主，接了键盘（pointer:fine）才显键位行。768×1024 竖屏显示手机提示符合设计，未改。
- QA 提交 f66ccdb 已并入。VERSION 177929f5b1ef；单测 28/28，e2e 76/76。

## 第八轮（QA W6，平板竖屏接键鼠，2026-10-14 UTC+8）
- 按 BREAKPOINTS.md 第 8 行：600–1023 竖屏若 (hover:hover) and (pointer:fine)，显示 #keys 键位行、手势提示用键盘文案；触控平板/手机不变（ea70c3a）。e2e：768×1024 三引擎 pointer:fine vs hasTouch（e9a524c）。
- QA 提交 ed0a564 已 cherry-pick（e80bbc5）。VERSION 177929f5b1ef；单测 28/28，e2e 85/85。

## 第九轮（工程审核 f04dfb8 DELTA，2026-10-14 UTC+8）
- P1-1 挑字说明卡：无数据的行整行不画，不出「？」（5823fb9，pick_info e2e）。
- P1-2 键盘光标 / 金色焦点框 / 鼠标悬停合成一个状态，说明卡跟随；回归：悬停木 → → → Space，焦点、说明卡、所挑都是田（b10c53a，pick_keyboard e2e 三引擎）。
- P2-3 桌面挑字按 gf5 §11：说明卡在网格右侧，挑字格标签（如「1·水」）不被字形图盖住（b10c53a，pick_desktop_layout e2e 1280/1440 三引擎）。
- 保留：同字快速双击即选中（已接受）。
- 截图：release_shots_v2/desktop_pick_1280.png、desktop_pick_1440.png（tools/shot_pick_desktop.mjs）。
- 注：b10c53a 的提交说明写了「P1-2 测试失败」，那是两份 e2e 并行跑时的误报；单独跑和全量跑都通过。
- VERSION 177929f5b1ef；单测 28/28，e2e 95/95。

## 第十轮（QA d29439b 复测 + PM 改判挑字几何，2026-10-14 UTC+8）
- 抖动结论：**产品竞态**。afterAction 的 650ms 重绘若落在按下与抬起之间，会用 innerHTML 重建挑字候选节点，浏览器就不合成 click，真实点击被吞。修法：HTML 没变就不重建（af86562）。回归 pick_race（967396f）：先按下、强制重绘、再抬起；不带修复三引擎全挂，带修复全过。firefox 1280 主流程连跑 20 次：20/20 通过。
- 电脑端挑字几何按 gf5 §11（7ed0cdd）：1280 时左边距 96，标题 y96，挑字格 y160，字池 y256（宽 560），说明卡 x820 y160（宽 360），按钮 y640；1440 整块水平居中（x +80）。e2e pick_geometry 三引擎 ±4px（c39e682）。落/解锁无数据整行不画，保持。
- 另两处全量跑偶发（测试时序，非产品缺陷）：转竖屏提示改为等 body 视图/朝向状态（1a4320c）；commit() 先等飞出动画结束再按键（动画中按的键会被提交后的状态重置吞掉）。为此新增调试只读属性 __zz.animating。
- QA 提交 7551cc1 已 cherry-pick（d68f021）。截图 release_shots_v2/desktop_pick_1280/1440.png 已刷新。
- VERSION 177929f5b1ef；单测 28/28，e2e 104/104。

## 第十一轮（QA 40bf79b：W7 / W8，2026-10-14 UTC+8）
- **W8 根因**（详见 ROOTCAUSE_W8.md）：挑字选择原来依赖浏览器合成 click，而 click 只在按下和抬起落在同一 DOM 节点时才合成。挑字 HTML 里写进了焦点（.focus）类；鼠标悬停只就地切类，没更新 HTML 缓存，缓存因此「变脏」。之后任何一次 render()（如 afterAction 的 650ms 重绘）都会判定 HTML 变了，整块替换候选节点。玩家按住期间节点被换，抬起落在新节点上，浏览器不合成 click，点击就被静默吞掉。按住越久越容易撞上，所以约 650ms 时最明显。上一轮「HTML 不变就不重建」只修了一半，没堵住缓存变脏这条路。
- **W8 修法**（3ada90b）：选择改在 pointerup 上，针对 pointerdown 时捕获的候选字执行，不再依赖合成 click；如果浏览器仍合成了 click，吞掉它，不会触发两次。节点在按住期间是否被重建都不影响。两步挑字、放回、键盘单一焦点、同字快速双击、触控行为都不变。
- **W8 测试**：pick_hold e2e（73f4e8d），三引擎，按住 0/300/650/1000ms 各验两步挑字；另有 50 次混合按住（含 ~650ms）、含放回的点选序列，逐次对照模型，零丢失。firefox 单跑 20 次：20/20 通过。QA race.mjs 在 firefox 跑 20 次：1280 的 A/B/C 三项和 390 的 A/C 两项全部 PASS，共 50 项，均为丢=0/10；390 的 B 项在 firefox 无法用 CDP 模拟触控按住，脚本自标「部分验证」，10 次也都是丢=0/10。
- **W7**（18e5bc4）：电脑端挑字在 ≥1024 的任何宽度都放得下。1280 严格按 PM 数值；≥1280 整块居中（1440 → x+80）；1024–1279 收窄说明卡和间距，整块进视口。手机/平板不变。e2e（216dc91）：1280/1440 位置 ±4px；1024/1100/1279 检查 #pick 所有子元素 getBoundingClientRect().right ≤ innerWidth、left ≥ 0，说明卡完整可见、不压字池。三引擎。
- **已知小项**：卡片飞出动画期间按的键按设计丢弃。PM：缓冲按键会在玩家看到下一张卡之前就替他提交。
- QA 提交 f5319d0 已 cherry-pick（8fcf9fd）。
- VERSION 177929f5b1ef；单测 28/28，e2e 119/119。

## 第十二轮（工程审核 b12d7f1 + 设计师矮屏规则，2026-10-15 UTC+8）
- **P1（触控放回一个却放回两个）**：根因见 ROOTCAUSE_P1_b12.md。修法（7250f3a）：挑字屏改为只建一次骨架、之后按 data-char / data-slot / data-do 就地补丁，按住期间不再换节点；pointerup 与合成 click 的去重改按「这一次按下」（pointerId + 每次按下的 token），不再比较字；「出发」键走同一路径。
- **P2-1 多指**：按下按 pointerId 分别记录（Map），一指松开只处理它自己的那次按下，第二指不会取消或抢走第一指。
- **测试**（8cdd2cd）：390 触控三引擎：填满三格后点第 1 格恰好少一个字；点已选候选恰好少一个；「出发」恰好触发一次。chromium 用 CDP 双指测试，其他引擎跳过并注明原因。去掉修复后这些用例全挂（点格子少两个）。
- **矮屏（设计师 BREAKPOINTS.md「矮屏（高度 ≤ 760）」，sha 4ba0bfae）**：
  - 601–760：卡高 vh−188（限 380–468），键位行一行 28px，字匣 60。
  - ≤600：卡高 vh−172（限 320–428），键位提示收进顶栏「?」浮层（首次进入自动弹一次），字匣 56。
  - 高度 <492：提示「放大窗口」。
  - 换档不加过渡动画；挑字页固定 7×2、不滚动；「落」在矮屏压成一行，「解锁」无数据不显示。
  - P2-4：教学气泡不压目标（70a2e02，根因：气泡按正在做过渡动画的卡定位）。1024×600 第 4 步字匣可点，按 1 能落字。
  - P2-2：1280×720 键位行在视口内。
  - WebKit 卡槽宽算错导致字匣不在卡下，已修（#cardwrap 用卡的宽高比）。
- **测试**：short_screen / short_tutorial / short_bounds，三引擎 × 1280×720、1024×600、1366×768（另含 1280×633、1024×513、1024×488/492）：卡局和挑字页所有可见元素都在视口内，页面不滚动，教学全程走通。
- VERSION 177929f5b1ef；单测 28/28，e2e 180/180。

## Round 13 — 92cf10a QA retest fixes (VERSION f243a91ccb14)
- QA commit ab6a626 cherry-picked (cc21503).
- D1: on two-finger put-back the character is recorded at pointerdown, not by the slot index at pointerup; 水日人, two fingers on slots 1+3 → only 日 left. Test: pick_touch_putback.
- D2: the <492 'window too short' prompt no longer overlaps the card header (1024/1280×491). Test: short_overlap.
- D3: the B-tier key-hint popover is narrower and pinned right, so it no longer overlaps the option buttons (1024×600/513/491, auto-open and '?'). Test: short_overlap.
- D4: the goals-slip hit area is ≥44×44 in tiers A/B with no visual change. Test: goals_hit.
- Note: at 1366×768 the 字匣 measures 83, while BREAKPOINTS sets N tier to 64 (cells 52), so this deviates from the design. Not changed this round; waiting on the user's decision.
- D3 follow-up (e51caf2): WebKit popover capped in height so it clears the options in WebKit too.

## Round 14 — 99a75d7 retest follow-ups (VERSION b882984d66d7)
- QA commit 925d28e cherry-picked (0564def).
- Card-corner 刻 intercepted by .card-head (Firefox flake). Root cause: `ui.engraved` was never initialised, so `classList.toggle("done", true && undefined)` became a plain toggle. The `done` class (pointer-events:none) flipped on every render during the engrave phase, so the corner sometimes ignored taps and the click fell through to .card-head. This was not a z-index problem. Fix: engraved is a boolean and resets when leaving engrave (59d39b8). Details: ROOTCAUSE_bonecorner.md. Regression test bonecorner_hit (elementFromPoint, 4 viewports × entry/after/tutorial): 30/30 on firefox.
- D3: removed the height cap and scrolling. The B-tier popover is now a two-column grid, all 6 rows visible with no scroll and no overlap with the options at 1024×600/513/491 and 1280×491, auto-open and '?' (7b48404). The design was not edited.

## Round 15 — N-tier 字匣 (VERSION 1d16af20f0f9)
- PM decision: at 1366×768 (N tier) the 字匣 is 64 with 52px cells (was 83); hit areas ≥44, no overlap with the top bar or card, A/B tiers unchanged (9de8f08). Test: tray_n_tier, 3 engines.

## Round 16 — ca040c9 retest follow-ups (VERSION 55989b7737b8)
- QA commit 821864b cherry-picked (9e140e3).
- PM decision ①: the first B-tier auto-open '?' popover now waits for the card entry animation to finish (ui.animating plus card.getAnimations()[].finished, with a transitionend fallback). While the card is entering it is hidden and the 3s auto-close does not count down. Once open, placeKeyhelp checks the popover against 刻 and the current tutorial target and moves it down or left to clear them (2499499). New test keyhelp_entry: pause the card animation via getAnimations() and set it to the midpoint, then finish(); 1024×600/513/491, 3 engines.
- ②: bonecorner_hit is deterministic. The rAF sampling race is gone: it waits for the entry animation to start, pauses at the midpoint to probe elementFromPoint, then finish()es and probes again. No retries.
- Removed a node_modules symlink that had been committed by mistake (a6f5a40).
- Loops: bonecorner_hit + keyhelp_entry 30/30 on each of chromium/firefox/webkit (one worktree per engine; each e2e file runs buildDist() on load, so parallel runs in one checkout wipe dist mid-serve. That only affected my parallel loop; npm run e2e uses --test-concurrency=1).
- Full 3-engine e2e, 3 consecutive runs (product = de92759, VERSION 55989b7737b8): 235/235, 235/235, 235/235. Unit 28/28.

## Round 17 — ec61666 retest: probe fixes (tests only, VERSION unchanged 55989b7737b8)
- Every elementFromPoint centre probe (bonecorner_hit, coach_overlap, pick_desktop_layout, tray_n_tier, short_tutorial, short_screen) now uses the centre of (element rect ∩ viewport) inset from every edge. Chromium rounds x, so a 刻 centre in [389.5,390) at 390 wide returned null (QA efp_probe) (da7e96c). goals_hit already probed 1px inside; keyhelp_entry/short_overlap do not use elementFromPoint.
- bonecorner_hit mid-entry: the card is rotated (~3°), so the bounding box is ~s·sinθ wider than 刻 itself. Inset k = 1 + 2×(bbox − layout size) so the probe lands inside 刻 itself. With only a 1px inset, firefox 390×844 failed 3/30 (narrow edge strip hit card-head, or the visible strip was <2px). The probe is skipped only when the inset intersection is empty, and then it asserts 刻 is almost entirely off-screen right (r.left ≥ innerWidth − 2k). Failure messages include rect/k/pt (235e6ea).
- bonecorner_hit 30× per engine (separate checkouts): chromium 30/30, firefox 30/30, webkit 30/30.
- Full 3-engine e2e, 3 consecutive serial runs (tests at 235e6ea, VERSION 55989b7737b8): 235/235, 235/235, 235/235.

## Round 18 — dbba609 retest: E2 + T03 (VERSION c0fb55e86b41)
- QA commits 0ec2010, fdecf3a, f45d82f cherry-picked (3ea772c, c677988, 6bdf547).
- E2 (pick_hold flake): product bug. A render() (650ms float-clear / 1800ms banner timer) that lands between mousedown and mouseup rebuilds #winter's innerHTML, so the click is silently swallowed. Fix: patchHTML skips unchanged innerHTML (da1906e). Details: ROOTCAUSE_E2.md. Regression test rerender_click (3 engines; fails on the pre-fix code). On failure, toPick/toPickDesktop now save a screenshot plus state (e7679f6).
- T03 (PM): the manually opened '?' popover now also avoids #coach (plus 刻, the tutorial target, the left/right options and the too-short prompt). It picks the first of 7 positions that fits inside the viewport with no intersection. Only if none fits does it hide #coach (visibility), restoring it on close (bc8c18e). Regression test keyhelp_coach (1024×600/513/491, 3 engines: intersection 0 or #coach hidden; elementFromPoint 刻 hit; #coach back at the same position after close).
- T03 measured: at 1024×600/513/491, chromium/firefox/webkit all **move** the popover (x672, below the right option, y254–309); #coach stays visible and is never hidden.
- Full 3-engine e2e, 3 consecutive serial runs (VERSION c0fb55e86b41): 247,247,247/247.

## Round 19 — dc322ed pre-run: E2 whole class + E3 (VERSION c84e0eb2102a)
- E2 whole class: every innerHTML write in web/app.js on a container with clickable children now goes through patchHTML (unchanged HTML → no node swap; cache cleared when hidden) or keyed patching. Newly covered: #wordbox (落字), #card-drops (先不刻), #menu-pop, #goals-slip/panel, #coach, #card-art, sidebar/drawer, #pick-desc, #keyhelp-pop, dims (acf46f5, c9be490). Audit table in ROOTCAUSE_E2.md "Audit (whole class)". rerender_click now replays every clickable in a full game (options, 刻, 落字, 先不刻, the winter tally/component/base/position/clear/defer/carve/天亮了, 先人, hand-over, pick candidates/slots/出发, menu + mute, goals slip, save-dialog close/copy/import, 1024×600 '?') with a forced render() between down and up, on 3 engines, plus a chromium 390 CDP-touch case. It fails on the dc322ed code.
- E3: ui.elderShown was reset only in newGame/importCode, so from generation 2 the ending page #endseq was skipped and 先人 showed directly. Intent (tutorial.json 「第 {n} 代结束 · 先人」/「交给第 {n} 代」 templates, A9 banner before the ending each generation, fail endings must be shown): ending page every generation. Fix: reset when the hand-over (heir) starts the next generation. Regression test multigen_ending (3 generations × 3 engines: #endseq first with #elder hidden → 先人 header 「第 n 代结束」 → pick). It fails at generation 2 on the dc322ed code.
- QA rr.mjs against the new dist (c84e0eb2102a): 字匣落字 / 先不刻 / 天亮了 / 先人 / 交给第n代 swallowed 0 times on chromium/firefox/webkit (mouse) and chromium 390 (CDP touch); 留到明年 is N/A for this seed.
- Full 3-engine e2e, 3 consecutive serial runs: 257,257,257/257.

## Round 20 — 23e18e5 pre-run: drawer mask + T03 #coach jump (VERSION 63bade20c0e3) — version frozen after this round
- ① #drawer-mask swallowed (firefox 390): not a render problem. The global pointerdown listener decided "start a card drag" from coordinates (inCard(x,y)), so even with an overlay covering the card it started a drag, and onDown's setPointerCapture retargeted the click to #card. The overlay's close click never fired; plain taps at the mask centre failed 6/6 on firefox, while the top-left corner (outside the card) worked. Fix: start a drag only when the pointerdown target is inside #card (5a72257). The same fix covers the save-dialog backdrop, menu and goals panel. rerender_click adds #drawer-mask (centre/corner) plus the save-dialog backdrop, menu outside-click and goals panel: plain and with render() between down and up, 390×844 touch + mouse, 3 engines.
- ② T03 #coach "moved after closing the popover": the popover never moved #coach. placeCoach used #bonecorner.getBoundingClientRect(), and #bonecorner is inside the transformed #card. If #coach was placed during the card entry transition (rotate/translate) it landed ~190px off (265 instead of 74 at 1024×513) until a later render, such as closing the popover, corrected it. Fix: targetRect() takes targets inside the card from the #cardwrap rect + offset*, i.e. the untransformed rect (#bonecorner/#card-drops; also used in slideClearOfTargets) (5a72257). keyhelp_coach adds: render() with the entry frozen at its midpoint gives #coach = its settled position; open/close '?' 5+ times with #coach identical (±0.5px) before and after each cycle; 1024×600/513/491 × 3 engines.
- Known debt (PM): the fail endings cannot be reached in normal play (a balance issue). Numbers not changed this round.
- Full 3-engine e2e (one run, per PM): 272/272.

## Round 21 — 0759c65 review P1: mouse drag starting on the card image (VERSION 72e2a899e2b1)
- P1 (engineering review + 测试 baseline 0/6, 3 engines × 1280/390): `<img>` is natively draggable by default. A mouse press-and-move on #card-art's img started a native image drag (dragstart → pointercancel), so the page stopped getting pointermove/pointerup: the card didn't follow (firefox translateX 0, chromium/webkit stopped at ~16–18px) and no swipe registered; on firefox 390 the card could stay in the dragging state. Keyboard and touch were unaffected, which is why earlier tests missed it.
- Fix (4d8ec8c): `draggable="false"` on the card art `<img>` (the only img inside #card), plus CSS `#card img{-webkit-user-drag:none;user-select:none}`. No pointer-events:none: the img stays the hit target inside #card, so the 5a72257 target-in-#card onDown logic is unchanged.
- Regression test card_img_drag (3 engines × 1280×800/390×844, mouse): press on the image centre, move half a card width (card follows mid-drag), release → the swipe commits; afterwards no `.dragging` and an idle mouse move doesn't move the card; img draggable=false; elementFromPoint at the image centre is inside #card. Fails 6/6 on the 0759c65 code, passes 6/6 with the fix.
- Not fixed (debt, PM): firefox 390 mouse drag from the card centre 3/6 (later found to be a probe-script bug, not an app issue — see round 22); chromium leftover text selection cancelling the next drag; 390 touch overlay tests that also pass on old code.
- Unit 28/28. Full 3-engine e2e (one run, per PM): 278/278.

## Round 22 — f96632f review P1-1: leftover text selection breaks the next card drag (VERSION 427bd7d950e9)
- P1-1 (engineering review; pre-existing, same on 23e18e5/0759c65/f96632f): text inside #card was selectable. A mouse drag starting in the band at ~47–60% of the card height (the gap between the art and the header/title; the card's geometric centre at 1280 and 390) commits but leaves a selection ("card-head → picture"). The next drag that starts on the selection makes the browser start a native drag of the selected content (dragstart on ARTICLE/IMG): chromium then sends pointercancel (card stops at ~18px, no commit); webkit loses pointerup and the card stays `.dragging`, following the mouse. 测试 baseline on f96632f (3 rounds of centre-left / centre-right / image-left, selection never cleared): webkit 6/9, chromium 6/9, firefox 8/9 (firefox: IMG dragstart + pointercancel after a 「夏」 selection).
- webkit spurious commit, reproduced on f96632f (webkit 1280×800, seed 20261012): clear the tutorial → mouse drag from the card's geometric centre to the left (commits 选左, leaves a selection) → mouse drag from the centre to the right: no commit, #card stays `.dragging` → click anywhere outside the card: that click commits a choice (actions 6→7). The side follows the click position relative to the drag start: a click left of it submits 选左, right of it 选右. At 390 the same sequence did not stick in this probe.
- Fix (0f2516b): CSS `#card{user-select:none;-webkit-user-select:none}`. With no selection possible inside the card the native drag never starts; this alone passes the 3-round test on all 3 engines, so no dragstart handler and no selection clearing were added. No other code changed.
- Regression test card_select_drag (3 engines × 1280×800/390×844, mouse, one game; mirrors 测试's sequence: 3 rounds × ① centre→left ② centre→right ③ image→left, no clicks/selection clearing between drags). Each drag: no un-prevented native dragstart, no pointercancel, card follows mid-drag, release commits exactly once in the intended direction, no `.dragging` left, no selection left; after the 9 drags a blank click (#gen-line) adds no commit. On the f96632f code it fails 4/6 (chromium and webkit, round 1 drag ② or ③: native dragstart); firefox passed on old code in this test. With the fix: 6/6.
- Debt correction: the round 21 "firefox 390 mouse drag from the card centre 3/6" item is not an app issue. It was a probe-script bug (测试: drag endpoint x=392, outside the 390 viewport; the review also saw drags during the engrave phase / animations). This fix is unrelated to it; card_select_drag drags from the centre on firefox 390 and passes on both old and new code.
- Unit 28/28. Full 3-engine e2e (one serial run on 0f2516b): 284/284; the 3-round version of card_select_drag (test-only change made after that run started) re-run alone: 6/6.

## Round 23 — c7fdcfc review P1-1′: selection starting OUTSIDE #card still breaks the card drag (VERSION c4b6a44e4c2f)
- P1-1′ (engineering review; pre-existing, also on 0759c65): 0f2516b only made text inside #card unselectable. A selection that starts outside the card still wraps the whole card (including the IMG). Examples: a missed press on the hint line under the card (#gesture-hint) swept into the card, a drag-select from the top bar (#gen-line, bone count, the four stats) into the card, or Ctrl+A. The next press-and-move on the card then makes the browser drag the selected content (dragstart, target IMG/ARTICLE). WebKit loses pointerup, the card sticks to the mouse (`.dragging` left) and the next click anywhere submits a choice for the player. Chromium/Firefox send pointercancel, so that one drag doesn't move.
- Fix (67553f4, web/app.js only): ① `#card` dragstart listener → `e.preventDefault()`; ② in onDown, for mouse pointers, call `getSelection().removeAllRanges()` as soon as the mouse is pressed on the card. It runs after onDown's early returns (engrave phase, card animating), so it fires on every mouse press on a draggable card, not only once a drag actually starts (passes the movement threshold): a plain click or hold on the card without moving also clears the selection. (Corrected post-merge; an earlier version of this note said "only when the press really starts a card drag".) Buttons inside the card never reach onDown (the listener excludes `button`), and selection anywhere else, e.g. the credits page, is untouched.
- Regression test card_outside_select_drag (3 engines × 1280×800/390×844, mouse, fresh page per scenario, imported save at the first regular card): (a) press on #gesture-hint, sweep into the card, release, then drag from the image; (b) drag-select from #gen-line into the card, then drag from the centre; (c) Ctrl+A, then drag from the image (Ctrl+A only: Meta+A isn't select-all on Linux WebKit). For the card drag in each: no native dragstart at all, no pointercancel, card follows mid-drag, release commits exactly once as 选左, no `.dragging` left, no selection left; then a blank click (#gen-line) adds no commit. Guards: #opt-left/#opt-right click commit once each and the menu button opens the menu (1280, 3 engines); on the credits page, triple-clicking the title, drag-selecting a paragraph and Ctrl+A select-all all still produce a selection (3 engines).
- On the c7fdcfc code: 12 of 18 drag scenarios fail: chromium 1280 (a)(b)(c) and 390 (b)(c); firefox (b)(c) at both sizes (on (b) the drag commits but leaves the selection); webkit 1280 (a)(c) and 390 (c). Failures were dragstart, pointercancel, the card not following, or selection left behind. This matches 测试's c7fdcfc baseline (qa/sel2.mjs). The 6 guard tests pass on both versions, as intended. With the fix: 24/24.
- Unit 28/28. Full 3-engine e2e (one serial run on 67553f4): 308/308. card_outside_select_drag then gained the dragstart / pointercancel / leftover-selection and credits Ctrl+A assertions (test-only, after that run started); re-run alone on the final code: 24/24.

## Post-merge (spock-wen/zaozi, branch fix/web-post-merge from main 438124f; VERSION 742618efcde2 on fix/web-flyout-keys (merged with main b0c7b5d, P0 hotfix f3965770659e), 087459be13f7 for #8 alone)
- Generation off by one (PM ruling) (0073f15): the pick screen title used `st.generation`, which during the pick is still the generation that just ended (begin_generation adds 1 later), so it read 第 1 代 while the button said 交给第 2 代. It now shows the generation about to start, `(st.generation ?? 1) + 1`, matching the hand-off button. The first game still shows 第 1 代 (it has no pick screen). Regression test gen_label (3 engines, 1280): first game 第 1 代; after each hand-off the pick title says 第 N 代 with the same N as the button; after setting out the top bar says 第 N 代. Fails on the old code (title 第 1 代 after 交给第 2 代).
- Review P2-12 (74f884e): the small glyph images get `draggable="false"` (in gimg, so this covers every glyph image: 字匣, pick, winter, sidebar) and CSS `#wordbox img{-webkit-user-drag:none;user-select:none}`. Regression test wordbox_img_drag (3 engines, 1280, mouse drag from a 字匣 glyph image): no un-prevented native dragstart; img draggable=false. Fails 3/3 on the old code.
- Docs: corrected the round 23 description of when the selection is cleared (see above).
- D1/H14 (P1, 测试 35/35 repro): the engrave-phase lock hint toast 「先点卡角骨片刻下这件事」 was only dismissed by its 1800 ms timer, so after carving it stayed (plus a .3s fade) over T04's #coach; now `dispatch` hides the toast immediately whenever the card or phase changes (`hideToast`), and a hidden `#toast` is `visibility:hidden` so it no longer paints or hit-tests. Regression test toast_coach (3 engines × 360×640/390×844/1280×800/1280×600): after carving, #toast not shown and the #coach center hits #coach. Fails 12/12 on 00f7e5a.

## 飞出期间按键（branch fix/web-flyout-keys，基于 #8 tip 9462842，已合入 main b0c7b5d；VERSION 742618efcde2）
- 问题：卡片飞出（240ms）期间的输入被吞或误执行：不同方向的一下被飞出结束的 dispatch 清掉（丢键）；同方向再按一下开出第二段重叠飞出，盲提交下一张；飞出期间点字格会先在飞走的卡上落字、再盲提交下一张（F2，main 上就有）。
- 规则（用户裁定：排队；键盘、鼠标、触摸同一条）：出卡阶段里卡在飞出、入场过渡没停稳、或队列里还有没回放完的项时，离散输入（出卡键 ←/→/Enter/1–3、点字格、点左右选项）和在卡区按下的拖拽一律按顺序入队。回放一次只放一项：等当前卡入场停稳（whenCardEntryDone）再过两帧 rAF（停稳的卡已画出），并且从这张卡落定并画出起至少再停留 250ms（第 5 轮，用户裁定的最短停留；键、点击、排队的拖拽都适用）才执行，放完一项若还有，再等一次（同一张卡上的预览和提交共用一个落定时间戳）。换阶段、存档框/菜单打开、目标面板或手机抽屉打开时整队作废。
- 拖拽（第 4 轮，PM 选方案 a）：忙时在 #cardwrap 上按下记为队列里的一项 press。轮到它时若还按着：直接结束入场过渡，从当前指针位置起实拖并跟随（触摸「拖不动」窗口（飞出开始→起拖）两次实测 chromium 300/300ms、firefox 283/299ms、webkit 290/290ms，≤ 旧的约 300ms；鼠标 285–301ms）；轮到前已松手：按松手时的方向和位移在队列原位变成一次 side 提交（与键/点击同序），不到拖动阈值则丢弃。#cardwrap 加 touch-action:none。
- 第 5 轮：仍按住的拖拽在卡落定后立即开始跟随（不等 250ms），但松手提交不早于「落定并画出 + 250ms」：提前松手时卡停在松手处，等满 250ms 再飞出提交，期间其它输入继续排队。没有浮层时按 Esc 清空整个队列（含仍按住的 press、正在等停留的提交，后者弹回原位）。浮层（存档框、☰ 菜单、目标面板、手机抽屉）的键盘处理放在 keydown 最前面，早于「Enter 归焦点按钮」的守卫和 inputBusy 入队：浮层开着时 Esc 只关浮层、不清队列；出卡阶段其它键既不排队也不动卡；Esc 现在也能关手机抽屉。触摸「拖不动」窗口不变（见下）。
- 其它：存档框/菜单开着时键不动卡；出卡阶段焦点在牌桌外按钮（如 ☰）上时 Enter 归按钮；按住方向键的自动重复只预览一次、不提交；Esc 能关 ☰ 菜单（F4）；带修饰键/非出卡键动画期间不拦不排；删掉 commitSide 里的死代码 thr。
- 结构：唯一入队口 enqueueInput、唯一启动口 armDrain，动画出口不再各自调用 drain；由单测 tests/flyout_queue_static.test.mjs 锁住（第 4 轮加强：逐个检查 dispatch/commitSide/dropSlot/handleKey 的每个调用点都经过队列/守卫，新增一个直连入口即失败；5 例在 9462842 上全部失败）。
- 测试：flyout_keys（3 引擎 × 7 例）+ flyout_settle（3 引擎 × 13 例：飞出期间点「刻」不替玩家刻字、回放前卡已停稳并画出 ≥1 帧、数字键不落在没上屏的卡、鼠标/触摸点字格、点选项、菜单/存档框、焦点按钮 Enter、自动重复、Esc 关菜单），在 a217560 上 36/36 失败；flyout_drag（3 引擎 × 8 例：鼠标/触摸各「按住过落定再跟随」「落定前松手超阈值按序入队」「未到阈值丢弃」，以及目标面板、手机抽屉整队作废），在 38fc511 上 18/24 失败（通过的 6 例是「未到阈值丢弃」守卫）。
- 自测（第 4 轮更正计数：rAF 采样在绘制之前，动作所在那一帧不算，已画出的落定帧 = 落定采样数 − 1；第 3 轮写的「≥2 帧、29–32ms」多算了一帧）：每个回放输入作用前，目标卡已停稳并画出的帧数 min/中位数 = 1/1（chromium、firefox、webkit 都是），时长 min/中位 chromium 16/17ms、firefox 14/17ms、webkit 15/22ms（每引擎 38 个回放事件，含减少动态）。卡从出现到输入作用 min/中位：chromium 115/166ms、firefox 134/167ms、webkit 98/163ms。
- 测试（第 5 轮）：flyout_dwell（3 引擎 × 6 例：排队键、点选项、提前松手的拖拽、按住的拖拽的提交都在落定并画出 ≥250ms 后；Esc 清空队列，鼠标与触摸各一）在 38fc511 上 18/18 失败；flyout_overlay_esc（3 引擎 × 4 例：菜单开着时按的键不排队、Esc 关浮层保留更早入队的输入、Esc 关抽屉、菜单开着时方向键不预览）在 38fc511 上 6/12 失败（通过的 6 例是守护例：38fc511 本来就不在 Esc 时清队列，也本来就在菜单开着时不动卡）。静态单测 7 条，在 38fc511 上 3/7 失败。
- 自测（第 5 轮，同一口径，每引擎 38 个回放事件）：输入生效前目标卡已停稳并画出的帧数 min/中位 chromium 17/18、firefox 17/18、webkit 12/18（webkit 帧间隔不均），时长 min/中位 chromium 283/300ms、firefox 282/300ms、webkit 289/295ms，都 ≥250ms；卡出现→输入生效 min/中位 chromium 383/450ms、firefox 401/450ms、webkit 403/436ms。触摸「拖不动」窗口（飞出开始→起拖跟随）：chromium 283–300ms、firefox 283–299ms、webkit 290ms，仍 ≤ 旧的约 300ms（压在上限附近）；按住的拖拽提交在落定后 316–322ms。
- 第 6 轮（工程审核第 4 轮 e3dea4e 不过门 + PM 补充裁定，2026-10-16 UTC+8）：
  - P1-1：飞出时按下、落定时仍按住的拖拽，重放从**原始按下点**起算（startX = 按下时的 x），落定那一刻卡就带着已有的位移跟手；之后不动、直接松手也会提交（仍不早于落定 + 250ms）。新 e2e flyout_held（3 引擎 × 1280 真实鼠标 / 390 触屏，chromium 用 CDP touch）：在 e3dea4e 上 6/6 挂（落定后位移 0px，只提交了一张）。
  - P2-1：提前松手后等停留的提交（heldCommitT）触发时，若浮层已打开、阶段已变、局已换（epoch）或页面在后台，就不提交、卡弹回。
  - P2-2：newGame / importCode / restore 重置 settleKey 与 settledAt，同一状态再出现时不再跳过停留。
  - P2-3（PM）：标签页进入后台时停掉停留计时和挂起的提交计时，后台期间不执行队列；回到前台、卡重新画出 2 帧后从头再等满 250ms。
  - P2-4（PM）：键位说明气泡算浮层：气泡开着时 Esc 只关气泡、保留队列。它没有并入 modalOpen()，因为 B 档首进会自动弹 3s，不能因此拦键或作废队列。浮层打开时作废队列的规则不变。
  - P3-2（PM）：飞出期间排队的输入，如果目标卡是刻字卡（如教学 T03），也等落定 + 250ms 后照空闲时的行为执行：拖、点出锁定提示「先点卡角骨片…」，键走 handleKey 的刻字分支。每次回放最多出一条提示，然后清空队列。
  - P3-1 / P3-5：newGame / importCode / restore 清队列（含挂起的提交），并递增 epoch；flyOut、commitSide、松手提交的回调都核对 epoch，旧局的回调不会把 choose 打进新局。
  - P3-4：阈值和倾角都按卡的布局宽度（offsetWidth）算，不受旋转后包围盒变宽的影响。
  - P3-6：drainStep 改用 modalOpen()；删掉 handleKey 出卡分支里的死代码；空闲和忙时都按 #cardwrap 判定按下。
  - 未到阈值就松手的按下：留在队列里标为已松开，轮到它时丢弃，不提交，并保持队列原有顺序。
  - 测试强度（P2-5）：「未到阈值丢弃」×6、「开面板 / 抽屉作废」×6 改名为 [guard]（修复前也过，只作回归守卫，不当作修复的证据），并用变异 MB、MD 证明它们能抓到回归；overlay_esc 不再卡在等菜单关闭的超时上；静态测试按处理器逐个核对 dispatch / commitSide 调用点白名单，能抓到 M3、M4；M6（去掉松手提交的停留门）在 chromium 上也会挂。全部 13 个变异都被抓到，见 pstack_trail/r6/agy_log.md。
  - 没做（等 PM 或另开）：P3-3 记为债，见下。
  - 债 P3-3（9462842 起就有）：选字阶段用键盘打开导入框后，在文本框里按键会漏到选字逻辑。复现：?seed=20261016，走到第 1 代挑字页，选「水」「日」两个字 → Tab 到 ☰ 按 Enter → Tab 到「导入存档码」按 Enter（焦点进 #dlgtext）→ 输入 XYZ → 按 Backspace：文本变成 XY，同时已选字少了「日」 → 按 Space：「日」又被选上，空格没输进文本框。原因：keydown 里 modalOpen() 只在出卡阶段 return，挑字阶段落到 handleKey 的 pick 分支。证据：工程审核 zaozi_pr9_r4/p/pick6.mjs、pick6_tip.json。
  - 和 PR #10 的关系：PR #10 会先合并，它会加一个最小的飞出守卫（飞出期间 keydown、#wordbox 点击、选项点按一律忽略），并把 Esc 关菜单改成调用 renderMenu。本分支 rebase 到 PR #10 后，用队列**替换**那个忽略守卫（输入是排队，不是丢弃），避免同一个输入被处理两次；Esc 关菜单改用 PR #10 的写法（本分支第 3 轮的 F4 修复在 rebase 时去重）。
- 第 6 轮补充（10/19）：
  - QA（PR #10 报告）F1/F2 用真实输入复测（种子 20261016）：新 e2e flyout_qa（3 引擎 × 4 例）。在 9462842 的 app.js 上 12/12 挂（单帧最多提交 4 张；动作序列是 ["drop0","left"]），本分支 12/12 过。
  - PM 10/19 裁定 Q3=A（新局、读档、导入清空输入队列）、Q9=A（刻字阶段锁定提示出现时，K、S 照常生效，提示立即消失）：新 e2e flyout_reset_q（3 引擎 × 5 例），e3dea4e 上 15/15 挂，本分支 15/15 过，不需要改 app.js。
    - Q9 的两条在 e3dea4e 上挂，是因为排队的拖拽进 T03 时被丢掉、提示根本没出现（P3-2）。按 K、S 时提示消失，D1 起就已经成立，所以 Q9 里这一半只算回归守卫。
  - 已合入 main b0c7b5d（P0 热修），只有第 6 行 VERSION 冲突。合并后构建 VERSION 742618efcde2；单测 35/35；全量 3 引擎串行 e2e 518/518（296eb51），另加 flyout_reset_q 15/15 单独跑。
  - 留给 fix/web-mobile-next：Q9 的「拦截提示进提示条」（v6.2.x showLock）、Q5「看全文」遮罩只吞那一次补发点击（浮层本分支没有）、Q3 里清拦截提示（v6.2.x）。Q3 里清 toast 在 PR #8 c15d8a9。
