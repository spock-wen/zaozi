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
