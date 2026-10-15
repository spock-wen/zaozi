# 重做进度（REDESIGN_PROGRESS.md）

分支 `feat/web-redesign-v2`。基线 = 当前源码。每步 commit 后在这里记一行；中断后从这里继续。

- [x] 0. 写 REDESIGN_TASK.md + REDESIGN_PROGRESS.md（本文件），commit
- [x] 1. data：goals.json（v2.1 文案、placeholder:false、条件）；year1_cards.json 加教学顺序字段 + 卡片正文拆分
- [x] 2. 引擎：每代目标、开局挑字、教学顺序、多代流程（不改数值）
- [x] 3. Web 壳重排：index.html + style.css（手机/平板/桌面三档）+ app.js 结构改造（DOM 卡、字匣、抽屉/侧栏、菜单、存档弹层）
- [x] 4. 手感：拖卡倾角/回弹/飞出、预览圆点、飘字、卡角骨片四态（翻牌/演变条见已知缺口）
- [x] 5. 音效（WebAudio）+ 菜单静音开关（localStorage）
- [x] 6. 目标 UI（小签/清单/达成横幅）+ 教学气泡 + 挑字界面（开春展开见已知缺口）
- [x] 7. 卡面图进 web/img/cardart + <picture> + 预缓存；build_dist 拷贝
- [x] 8. 字源：水 3 字形进字形包 + SOURCES.csv 行 + credits 生成
- [x] 9. VERSION 内容哈希；baseline 测试改造
- [x] 10. 单测（node --test）
- [x] 11. Playwright e2e（3 引擎 × 5 视口）
- [x] 12. 干净树 build dist
- [x] 13. release_shots_v2 截图
- [x] 14. REDESIGN_REPORT.md + DONE

## 当前进度
- 1/2/7/8/9 已提交（882f9f1、be47a83）：data/goals.json、data/tutorial.json、year1_cards 教学卡与 title、chars_slice.pick_chars；engine.ts 每代目标/开局挑字/教学顺序/多代流程；解钉 baseline_version.txt；卡面图进 web/img/cardart、data/card_art.json；glyph_sources.csv + credits_table 署名。
- 3/4/5/6 已实现并提交（本步）：三档布局（手机顶栏 + 四维行 + 卡 + 字匣；平板竖同手机、横右栏；桌面顶栏 56 + 中央卡 + 左右选项 + 卡下字匣 + 底键位 + 右侧可收起 336 侧栏）；教学气泡手机在卡与字匣之间、桌面浮在卡右（距侧栏 16）；目标小签/清单/达成横幅（等飘字后出、先于结局）；挑字界面（14 字池、键位）；WebAudio 音效 + 菜单静音；存档导入导出；拖动/倾角/回弹/飞出/预览圆点/飘字/骨片四态；☰ 44×44 在手机/平板可见；resize 节流；侧栏开合 localStorage、~1024 强制收起。
- 修：挑字 pick_toggle 双切换（壳传已切换数组又让引擎再切换）——壳只传 char。
- 7/8 收尾核对完成（ae5e53e）：48 个卡面图资产并入发布树 + SW 预缓存；credits seal 行带 SOURCES.csv 的 credit 署名；shui 3 字形与设计稿逐字节一致。
- 10 单测完成（本步）：新增 tests/card_art.test.mjs（只发 C01–C10、先人无图、gf4-休 不上线、资产逐字节一致、无杂文件）；修 index.html 重复的 #goals-slip id。16 个单测全过。
- 11 e2e 完成（本步）：`npm run e2e` = node:test + playwright 库（本项目只装了 playwright，无 @playwright/test）。helpers/env.mjs 干净树重建 dist + 起 serve_pages 模拟 Pages。27 个 e2e 全过：viewports（3 引擎 × 390/768/1024/1280/1440，菜单/存档/静音 D1/版权）、flow（3 引擎 1280：教学/卡面图 picture+webp/目标弹层不秒关/锁卡提示且不遮字匣/天亮了不穿透/先人无图/挑字 14 字池/多代）、手机横屏转竖屏提示、offline（3 引擎 SW 后断网）、redirects（serve_pages 308 + no-cache）、fps（chromium 4× 节流 60.0fps）。
- 修：字形首屏不出图——重写把 loadGlyphs 的 onload 重绘限制成只在 pick/winter，导致 card 阶段字匣/字录停在文字兜底。恢复基线行为（每次字形加载都 render），e2e viewports 加断言锁死。
- 修 2：桌面教学气泡压在四维行上、且 1280 挡住卡角骨片。按 gf3 电脑稿把桌面气泡降到卡顶（#stage+48）、并设 pointer-events:none（纯提示不可交互）；同时修收起侧栏在桌面/平板横仍占 336 宽（BREAKPOINTS 说收起只留 44 标签，改回 width:0）。e2e flow 加 B3 断言（气泡不压四维行、距侧栏 ≥16）。
- 28 e2e + 16 单测全过。VERSION（干净树）= 见报告。
- 12/13 完成（51267ac）：干净树构建 dist，VERSION=7ec28f7d7403；release_shots_v2/ 五档全页截图提交。
- 14 完成：REDESIGN_REPORT.md（改动清单、各引擎测试数、VERSION、commit sha、已知缺口）。16 单测 + 28 e2e 全过，60fps（4× 节流）。不部署。
- 15 补 e2e 覆盖（本次）：新增 `tests/e2e/touch.test.mjs`——390 `hasTouch` + 真 `tap()`，三引擎；覆盖 D1（tap「天亮了」不穿透、代末总结先出）、D2（目标弹层一次 tap 不秒关、静音每次 tap 只切一次 @390/1024、导出弹层 1024 能开）、D4（拖锁定第 3 张卡出「先点卡角骨片刻下这件事」、toast 不遮字匣）、挑字 14 字切片以现代字呈现且季节标签非空、全 UI 无「占位」。抽出 `tests/e2e/helpers/flow.mjs` 复用动作。
- 修 3（触控）：WebKit 对普通元素一次 tap 不合成 `click`，导致目标弹层/菜单「点外面收起」失效——改 `pointerdown` + `click` 双通道（`app.js`）。
- 16 主流程扩视口：`flow.test.mjs` 现按 390/1280/1440 三视口 × 三引擎跑（1440 侧栏默认展开时目标清单在侧栏验）。
- 17 干净树 build：commit 61cfb2c 上构建 dist，VERSION=d3d9cfc7782b（内容哈希，184 文件）。重生成五档截图与已提交的 `release_shots_v2/` 逐字节一致（本改动只动 JS 交互，UI 未变，无需刷新）。
- 18 复跑：`npm test` 16 全过；`npm run e2e` 46 全过（chromium 16 / firefox 13 / webkit 13 / 引擎无关 4）。REDESIGN_REPORT.md 更新（新 VERSION、build commit、测试数）。不部署。
- 19 作家审核 P1：横幅用 goals.json banner；Node<22 先报错；VERSION=3232828264d4；单测 17、e2e 46 全过。
- 20 QA 复测 W1（P1）：菜单「字源与版权」进不去。根因 `app.js` 的 `on()` 对每次 click 都 `preventDefault`，把 `<a href>` 的默认跳转也拦了。改成带 `href` 的真链接不拦（照常导航），其余点击行为不变。新增 `tests/e2e/credits_link.test.mjs`（三引擎 × 390 tap / 1280 click：开菜单→点链接→落 `/credits` 且版权表 >50 行带 Richard Sears）；反修复时该测试超时失败，证明确实锁死。e2e 52、单测 17 全过。
- 21 QA 复测 W4（P1·发布）：干净树 `npm ci && npm run build` 崩 ENOENT、且第一次 VERSION=e3b0c44298fc。根因 `build_dist.mjs` 在 rmrf/mkdirp 重建 dist 之前就 `resolveVersion` 去扫 dist。改成：dist 用 rm -rf + mkdir -p 从零重建；VERSION 移到「所有发布文件写完之后、生成 sw.js 之前」再算（sw.js 除外，它嵌 VERSION）。`rm -rf dist && npm run build` 一次成功，VERSION=cec268a33090（=内容哈希，第二次相同；W1 改动使哈希随内容变，故与 3232828264d4 不同）。新增 `tests/build_clean.test.mjs`：`git archive HEAD` 到临时目录、一次构建，断言 VERSION≠空哈希、等于内容哈希、且（工作树干净时）等于仓库里一次构建的 VERSION。单测 18 全过。
- 22 第四轮：W1–W4 + 目标可达性；VERSION=37a6d803c885；单测 25、e2e 73。
- 23 修 G_ENGRAVE1 只应从第 1 代排除：`goalIdsForGeneration` 第 2 代起误把 `generation1_exclude` 也套到池上（引擎一行 filter），改回全 6 目标可抽；加回归单测（gen1 永不含 + 直接抽/真实多代流程 gen≥2 必中）。重跑 `node tools/goal_sweep.mjs --seeds 2000 --gens 4`（40000 代）：G_ENGRAVE1 抽到 15145、达成 2064（13.6%）。GOAL_REACHABILITY.md 换新表、§5 改「已修复」、新增可复现达成（种子 0，第 2 代进池、第 3 代达成，含存档码/走法）。单测 26 全过。
- 24 工程复审 1/3（`5dd91fd`）：版权页介绍去掉内部路径 `glyph/glyph_pack_v1.csv` 与 `<code>`，只留公开措辞；新增 `tests/credits_public.test.mjs`——用真实模板 + csv 渲染 `credits.html`，断言不含 `glyph_pack` / `glyph/` / `<code>` / `baseline`，且保留公开措辞与 Richard Sears 署名。单测 28。
- 25 工程复审 2/3（`a64ffd6`）：挑字按钮/键位提示对齐 `design/v4_gamefeel/gf5_pick.html`——出发键两态「还差字」（未选满、禁用）/「带这三个字出发」（选满、可用）；桌面提示「点字，或用 ← → 移动、Space 选 · Backspace 放回最后一个 · Enter 出发」、手机点选引导「点一个字看它能做什么；再点一次带上。」；按钮改全宽 48 高胶囊。`flow.test.mjs`（390/1280/1440）+ `touch.test.mjs`（390 三引擎）加断言。挑字池仍 14 字。
- 26 工程复审 3/3：报告头去写死的旧构建 SHA，改成 tip + VERSION；本轮改了 `web/app.js`/`web/style.css`/`tools/credits_template.html`，dist VERSION 更新为 `0ef899e7d326`。`npm test` 28、`npm run e2e` 73 全过。本轮不动：空开春展开（P2）、9d0b 坏 SW。
- 27 QA 复测 W5（P2·挑字两步，`design/v4_gamefeel/gf5_pick.html` ①②③）：390 触控下 tap 一个字原来直接 `pickToggle` 就入格，与 gf5 的「点一下看说明、再点一次带上」不符。根因 `web/app.js` 挑字 click 直接调 `pickToggle`。改法：新增 UI 态 `ui.pickFocus`（说明卡显示谁）与 `ui.pickTapped`（真正点过一下、等着第二次的谁）——pointer/mouse 第一次点只 `pickFocus` 出说明卡（落 / 部件 / 解锁 三行；缺数据写「？」，部件行由字池数据推：如 木 → 休、林、本），不填格；同一字再点一次（`pickTapped === char`）才 `pickToggle` 入格、变朱、带序号角标；点已选字或格内字 → 放回（补齐位）。电脑悬停只更新说明（`pointerover` + `hasFinePointer()`），不当作第一次点击，故桌面鼠标也是两步。键盘不变（← → 移动、Space 选 / 切换、Backspace 放回、Enter 出发）。`web/style.css` 加 `.cand.focus` 金色描边 + `.pickinfo` 说明卡。测试：`flow.test.mjs`（390/1280/1440 × 三引擎）挑字段按两步改写（加 ③ 放回与部件推导断言）、`_flow.mjs` 同步；`touch.test.mjs` 新增 390 `hasTouch` + `tap()` 三引擎回归（tap1 出说明卡且三格空 / tap2 填第 1 格 + 序号角标 1 / tap3 放回清空），`helpers/flow.mjs` 抽出 `toPick`。单测 28、e2e 全过。
- DONE（v2.4）
- 28 QA 复测 W6（平板竖屏接键鼠）：768×1024 竖屏接了键鼠（pointer:fine）原不显 `#keys`、手势提示走触控文案，与 `BREAKPOINTS.md` 第 8 行「触控；接了键盘（pointer:fine）才显键位行」不符。改 `web/app.js` + `web/style.css`：新增 `keyboardMode()`（fine pointer 且非手机档），平板竖/横在 `(hover:hover) and (pointer:fine)` 下显 `#keys`、手势改用键盘文案；手机档（<600）设计「不显键位」保持隐藏 + 触控文案，触控设备（非 fine pointer）两态都不变——桌面已在 baseline 显示。新增 `tests/e2e/keys_pointer.test.mjs`：三引擎 × 3（768 键鼠 / 768 触控 / 390 手机档 fine），9 例全过（fix ea70c3a、test e9a524c）。dist VERSION=b2443cc481c0（内容哈希）。
- 29 工程复审 f04dfb8 P1-1（挑字说明卡占位「？」）：`web/app.js` `pickInfoHTML()` 原来对「落 / 解锁」固定输出「？」、部件没数据也输出「？」。改成只画有数据的行——缺数据的行整行不画、不写占位（目前数据里只有「部件」一条：木 → 休、林、本；「落 / 解锁」文案待补，先整行省略）。`flow.test.mjs` / `touch.test.mjs` 的水字断言改为「0 说明行 + 无问号」，`flow.test.mjs` 木字部件行改取第一行。新增 `tests/e2e/pick_info.test.mjs`（chromium 1280）：14 字逐字出说明卡均无「？」/'?'，有部件数据的 6 字（人木田力日月）恰一行「部件」、其余 8 字 0 行。dist VERSION=deda7567de70。
- 24 flake：产品竞态（render 在按下/抬起之间重建候选节点吞掉点击）。修 af86562，测 967396f（pick_race 无修复时三引擎全挂）。firefox 1280 flow 连跑 20 次：20/20 过。
- 30 电脑端挑字几何（PM override，`design/v4_gamefeel/gf5_pick.html` §11 电脑端，`7ed0cdd` css + `c39e682` test）：桌面 `#pick` 由 grid 改为按 1280 设计稿绝对定位——h2 (96,96)、挑字格行 (96,160)、字池 (96,256) 宽 560、说明卡 (820,160) 宽 360、出发键 (96,640) 宽 320、键位提示 (96,720)。≥1280 整块水平居中 `left:calc(Npx + max(0px,(100vw-1280px)/2))`（1440→+80），y 不变；手机/平板选择器（`body[data-view="desktop"]` 之外）未改。坐标帧 = `getBoundingClientRect()` 视口坐标 —— 与 QA `logs/pick_geo.log` 的 `qa/ov.mjs` 取法完全一致；桌面 `#pick` 为 `fixed;inset:0`，故等同「相对 #pick 边框盒」（设计稿 1280 宽含其 56px 顶栏，y=96 即含顶栏区）。新增 `tests/e2e/pick_geometry.test.mjs`（chromium/firefox/webkit × 1280×800/1440×900）：逐项 x/y 对齐 ±4px，另锁字池/说明卡/出发键宽 560/360/320 与「说明卡在字池右侧」。`pick_desktop_layout.test.mjs` 原断言无冲突（`info.x(820) >= pool.right(656)` 仍成立），未改；该套件三引擎全过。落/解锁无数据的整行省略、格子标签「1·火」不被字形盖住均保持。
- 31 W8 回归测试（本次）：新增 `tests/e2e/pick_hold.test.mjs`——3 引擎 × 1280×800，用 `helpers/flow.mjs` 的 `toPickDesktop` 进挑字。（A）真人式「按下 → 按住 Nms → 抬起」按住 0/300/650/1000ms：第一下只出说明（`.cand.focus` + `#pick-desc .pi-h` 为该字、picks 空），第二下选中，再按一下放回。（B）50 次混合按住（0/120/300/650/900 循环）打在 4 个变化的候选（日/田/月/从）上、含放回：用与 `pick_toggle` 同语义的模型逐次比对 `window.__zz.st.picks`（`waitForFunction` 等真实状态，不用 sleep），断言零丢失、含 ≥5 次放回、出现过选满 3 个。chromium/firefox/webkit 全过（修复已在 `3ada90b`；`ROOTCAUSE_W8.md` 记的回归入口即此套件）。
- 25 W7/W8：W8 根因（悬停让 HTML 缓存变脏 → 650ms 重绘换节点 → 无 click）改为 pointerup 处理；W7 1024–1279 收窄进视口；firefox pick_hold 20/20、race 20/20 零丢失；VERSION c381ec1d0116；e2e 119。
- 26 工程审核 b12d7f1 P1-1 + P2-1（本步·修复）：挑字屏从「整块 `innerHTML` 重建」改为**就地补丁**——`buildPickSkeleton` 只建一次骨架，`patchKeyed` 按 `data-char`/`data-slot`/`data-do` 复用候选/格子/出发键节点、只改 class 与文本；按下与抬起之间不再换节点（W8 根因消除，合成 click 照常）。pointerup 与合成 click 的去重不再比较字，改为按「这一次按下」区分：`ui.presses: Map<pointerId,{token,node,key}>` + `ui.swallow` token 队列；`pointerup`/`pointercancel` 只清自己那一指，`pointerup` 只处理自己 pointerId 的 press（P2-1 多指互不干扰）；出发键 `data-do=go` 走同一路径。删 `ui.pickPtr`/`ui.pickHandled`/`lastPickHTML`。根因见 `ROOTCAUSE_P1_b12.md`。
- 27 工程审核 b12d7f1 测试（本步）：新增 `tests/e2e/pick_touch_putback.test.mjs`——390 触屏三引擎：填满三格 → 点第 1 格 `picks` 恰好减 1（不是 2）、点已选候选恰好减 1、选满点出发 `begin_generation` 恰好一次；chromium（CDP `Input.dispatchTouchEvent` 两个 touchPoints）双指同时按两个已选候选，各放回一个、互不取消/劫持，恰好两次放回（其它引擎 skip 并注明原因）。反修复（`git stash web/app.js` 后跑本套件）4/4 全挂：点格子得到减 2（`['水','日','人']→['人']`）、双指得到 `['水','木']` 不动；恢复修复后 4/4 通过。
- 28 矮屏分档 WIP 现状核对（本步·`8c6d5f0`+`0f7ef57` 两个 WIP 提交，`design/v3_mobile/BREAKPOINTS.md` §矮屏（高度 ≤ 760））：**已做**——`shortTier()`/`setShortTier()` 按 `innerHeight` 分 A 601–760/B ≤600（仅 desktop，手机/平板不变）；卡高 A `clamp(380,100dvh−188,468)`（1280×720→328×468、视口 633→312×445）、B `clamp(320,100dvh−172,428)`（1024×600→300×428、视口 513→240×341）；A 键位行缩成一行 28（`←→选 1–3落字 Space分量 K/Enter刻`）；B 键位收进顶栏「?」44×44 浮层、每存档首进自动弹一次 3 秒收起（`KEYHELP_PREFIX`+seed）；四维资源条并入 48 顶栏；视口高 <492 出「窗口太矮…」提示且侧栏强制收起；挑字 A/B 改网格 7×2 不滚动（实测 `pickScroll=0`、`cols=7 rows=2 count=14`）；教学气泡 `placeCoach()` 矮屏放在卡外侧、对字匣的提示底边对齐字匣（1024×600 第 4 张：气泡 x678–998 底 564、字匣格 y512–560、`elementFromPoint`=slot、按 1 落字 → T05，均无交叠）。**缺口**——(a) `#gesture-hint` 在 A/B 仍显整句旧键位文案（设计稿 `short_screen_720.png`/`600.png` 面板 1/2 卡下只有卡→字匣→键位，无手势行），与 A 的键位行/B 的「?」重复；(b) 字匣实测 A=61 / B=57，比设计 60/56 多 1px（`#wordbox-bar` 的 `border-top:1px` 在 border-box 下撑高）；(c) 尚无矮屏 e2e、dist 未重建。下一步逐项收口。
- 29 矮屏收口 1/7·A 档（601–760）：`web/style.css`——矮屏 `#gesture-hint{display:none}`（设计稿卡下只有卡→字匣→键位，旧整句手势文案与 A 键位行/B「?」重复）；`#wordbox-bar` 矮屏去 `border-top`（border-box 下 1px 会把字匣撑到 61/57），改 `border-radius:16px` 居中胶囊。实测 1280×720 卡 328×468、字匣 60、键位行 y608–636、溢出 0；1280×633 卡 312×445、字匣 60、键位行 y585–613——与设计稿逐项一致。新增 `tests/e2e/short_screen.test.mjs`（item 1 断言：卡高 clamp、字匣 60 且卡下居中、键位行一行 28 且文案、三块不交叠、不显手势行、不滚动）。
- 30 矮屏收口 2/7·B 档（≤600）：卡高 `clamp(320,vh−172,428)`（1024×600→300×428、1024×513→240×341）、字匣 56（item 1 去 border-top 后 A/B 同时达标）、键位收进顶栏「?」——WIP 已实现，本步补 e2e 锁死：1024×600/513 卡高、字匣 56 且卡下不交叠、不显键位行/手势行、不滚动；「?」44×44 在屏内；**首进自动弹一次**（空 context 进来即开着、浮层在屏内、≥5 行键位；`reload` 同存档不再弹；点「?」手动开、点外面关）。
- 31 矮屏收口 3/7·视口高 <492：WIP 已实现（`#too-short` 提示 + 侧栏强制收起 + 卡 320 下限），本步补 e2e：1024×488 → 提示可见且文案含「窗口太矮」、在屏内、卡恰 320、`body.side-collapsed`；1024×492（不在 <492）→ 不出提示。
- 32 矮屏收口 4/7·教学气泡不压目标（`70a2e02` fix + `6d37d24` test）：根因——`placeCoach()` 用 `#card` 的 `getBoundingClientRect()` 定位气泡，切卡瞬间卡片 `transform` 还在 160ms 过渡里，读到的是移动中的卡（1024×600 第 4 步算到卡上、气泡压住字匣 → 格点不到、按 1 不落）。改为读 `#cardwrap`（不被拖拽/飞出动画改 transform）当卡槽，`slideClearOfTargets` 同样改用 `#cardwrap`。探针 `_dbg_coach.mjs`：1024×600 / 1280×720 的 T01–T04 气泡与卡/字匣/落字框/卡角刻均不相交，第 4 张字匣格 `elementFromPoint`=`slot`、按 1 进 T05。新增 `tests/e2e/short_tutorial.test.mjs`——三引擎 × 1024×600（B）/1280×720（A）用真实输入（← → 提交 / 点卡角骨片 / 按 1）走完 T01→T05，每步断言气泡不与当步目标相交、目标命中自己，末了进普通卡（正常play），6 例全过；顺带修好 `short_screen.test.mjs` 第 4 节（原三引擎 6 例全挂，现 6/6 过）。
- 33 矮屏收口 5/7·挑字页 7×2 不滚动（本次）：实现早已就位（A/B 用 `grid` + `overflow:hidden`，N 用 gf5 §11 绝对定位 + `repeat(7,1fr)`），本次补 e2e 逐档锁死。`tests/e2e/short_screen.test.mjs` 新增第 5 节（三引擎 × 1280×720 A / 1024×600 B / 1366×768 N）：进挑字后断言 `.pool` 计算样式 7 条轨道、14 个候选排成 **7 列 × 2 行**、`#pick.scrollHeight/scrollWidth ≤ client`、`document.scrollingElement.scrollHeight/scrollWidth ≤ client`（都不滚动）。9/9 过（探针 `_scratch_bounds.mjs` / `_probe.mjs` 复核 7×2、pickScroll=0、docScroll=0）。
- 34 矮屏收口 6/7·跳档不加过渡 + 7/7·「落」框一行（WIP `97f00e2`）：`web/app.js` 加 `suppressTierTransition()`——`computeLayout()` 里只有 `tier !== prevTier`（N/A/B 真的换档）才给 `body` 挂 `no-anim` 两帧；`web/style.css` 加 `body.no-anim, body.no-anim *{transition:none!important}`（具体度高于 prefers-reduced-motion 的 120ms 规则，故能压过它）。三引擎锁死见 `short_screen.test.mjs` 第 6 节（N→A 切档瞬间 `#card` `transition-property=none`、同档 800→780 不挂 no-anim、收尾恢复 `transform,opacity` 各 0.16s），6/6 过。「落」框：`body[data-short] .card-drops{height:auto;padding:4px 8px;font-size:12px;white-space:nowrap;overflow:hidden}`——探针实测 A（1280×720）/B（1024×600）`white-space=nowrap`、框高 54（原固定 56 且会折行），N（1366×768）仍是 `normal`。
- 35 矮屏收口 补边界 e2e（本次·`tests/e2e/short_bounds.test.mjs`）：三引擎 × 1280×720（A）/ 1024×600（B）/ 1366×768（N），两个状态各扫一遍——**卡局**（`clearTutorial()` 走完教学进普通卡）与**挑字页**（`toPickDesktop()`：教学→冬夜→天亮了→先人→交给第 2 代）。逐元素扫 `document.body` 全部后代，可见判定 = 非 `display:none`/`visibility:hidden`（`[hidden]` 有全局 `display:none!important`，故隐藏弹层/收起浮层自动不算「可见」）、非「`opacity:0` 且 `pointer-events:none`」的纯装饰（预览圆点、闲置 toast）、且有非零盒子；`offsetParent!==null` 之外对 `position:fixed/sticky` 改用「有布局盒」——`offsetParent` 对 fixed 元素恒为 null，本应用 `#pick`/`#elder`/`#winter`/`#sidebar-tab` 等整屏浮层都是 fixed，照搬会把它们连子元素一起漏掉。断言每个矩形落在 0..innerWidth / 0..innerHeight 内（±1px），且 `document.scrollingElement.scrollHeight ≤ innerHeight`；另断言扫描到的元素数 ≥30，防止判定失效时的「空过」。**结果 18/18 全过、0 处越界、0 滚动、无 console/page 报错**（实测扫描元素数：卡局 A=60 / B=79 / N=62）。负向对照（探针，未入库）：注入一个 `left:-40px;top:-30px` 的可见 div 后，同一段扫描立刻报出该节点——证明判定不空过。**未发现需要修的产品溢出**。
- 36 第十二轮收口：WebKit 卡槽比例修复；VERSION 177929f5b1ef；单测 28、e2e 180 全过。
- 37 QA 复测 D2（`web/style.css`）：视口高 <492 的「窗口太矮」提示原水平居中（`left:50%`+`translateX(-50%)`），提示盒 y52..83 压在卡顶 y64 上（QA 量到 224×20 重叠，盖住卡头「春 · 族长」）。卡在 <492 时恒到 320 下限、宽恒 224、水平居中，1024 起卡左缘 = (vw−224)/2 ≥ 400、提示右缘 ≤ 285，故改左对齐贴舞台左缘（去 transform、`left:12px`）即可不压卡。新增 `tests/e2e/short_overlap.test.mjs`（chromium：1024×491 / 1280×491，断言 #too-short 与 #card 及 #card .card-head 无包围盒交集、且在视口内）；反修复（`git stash` 本改动）2/2 全挂。
- 38 QA 复测 D3（`web/style.css`）：B 档键位浮层 `#keyhelp-pop` 原 `right:16px;width:248px`，1024 下左缘 760；而左右选项紧贴卡（卡右缘 = 卡心 + 卡高×0.7/2，选项右缘 = 卡右缘 + 8 + 140），1024 最宽卡（卡高 428）时右选项右缘到 810 → 浮层压住右选项（491 下 12×57、513 下 19×46、600 下擦边 50×2，与 QA 量级一致）。改贴右上、`right:8px;width:200px`（左缘 ≥ 816），并加 `max-height:calc(100dvh−60px);overflow:auto` 兜底；行间距/键位列同步收窄（`b` 64、`line-height:20`）。`tests/e2e/short_overlap.test.mjs` 新增 D3 节（chromium × 1024×600/513/491，`#keyhelp-pop` 与 `#opt-right`/`#opt-left` 无包围盒交集、且在视口内；覆盖首进自动弹与点「?」手动开两条路径）；反修复该套件 5/5 全挂。此套件按指示只跑 `E2E_ENGINES=chromium`。
37. Round 13: D1–D4 fixed + regression tests; VERSION 4cc4b2e4835c.
38. D3 WebKit follow-up e51caf2; VERSION f243a91ccb14.
39. Round 14: 刻 hit-test root cause + D3 two columns; VERSION b882984d66d7.
40. Round 15: N-tier 字匣 64/52; VERSION 1d16af20f0f9.
41. Round 16: popover waits for card entry + clears 刻/target; bonecorner_hit deterministic.
42. Round 16 gate: 3× full e2e 235/235.
43. Round 17: probe insets (tests only).
44. Round 17 gate: 3× full e2e 235/235.
45. Round 18: E2 rerender click swallow fix + T03 popover avoids #coach; VERSION c0fb55e86b41.
46. Round 18 gate: 3× full e2e.
47. Round 19: E2 whole-class patchHTML audit + E3 ending every generation; VERSION c84e0eb2102a.
48. Round 19 gate: rr.mjs 0 swallowed; 3× full e2e.
