<!-- 跟踪副本：源自 /workspace/qa-zaozi-pr10-b81125d/LEFTOVERS_b81125d.md（测试，2026-10-16），本分支 fix/web-mobile-next 按此清单修。S-1 为 PM 2026-10-19 16:09 追加。 -->
# 造字人网页 b81125d 上线遗留清单（2026-10-16 20:30 SGT，测试）

来源：FINAL_REPORT_zaozi_pr10_b81125d.md（总结论: 不过门，原样保留）；矩阵 MATRIX_zaozi_pr10_b81125d.csv。
据 PM 转达：用户 20:28 决定先上线 b81125d，本清单全部记为遗留，10/19 10:00 开修。复现种子 ?seed=20261016；证据路径相对于 /workspace/qa-zaozi-pr10-b81125d/。

| 编号 | 问题 | 代码位置 | 证据 | 下版验收 |
|---|---|---|---|---|
| N1 | 同一选项 70ms 内连点两下连交两张卡（C03 时 actions 5→7，C01 被跳过），31 配置全复现 | app.js:959-962 commitSide 无 ui.animating/阶段判断；绑定 app.js:1014-1015 | run/fp/shots/chromium_360x640_phone/020_C03_dbl_pre.jpg, 021_C03_dbl_post.jpg | 连点只交一张 |
| N2 | 刻字阶段(T03)点选项，卡飞出又回来并提示「现在不是选卡的时候」 | 同 N1；提示来自 app.js:214 | .../010_T03_engrave_tapopt.jpg | 刻字时选项禁用并隐藏(HOTFIX_SPEC J2) |
| N3 | 手机卡面底部文字被裁（360×640 少最后一行；更小屏正文几乎全无），114 格 | style.css 新手机 #cardwrap dvh 公式缩放整卡 | .../022_C01_opts.jpg；chromium_320x568_phone/046_C10_opts.jpg | 主流手机尺寸卡面文字完整 |
| N4 | 选项对比度 3.77（规格法）/3.96（版式 C），低于 4.5 | style.css:105 .optbtn{opacity:.45} | 版式 C 矩阵 | ≥4.5:1 |
| N5 | #too-short 只在电脑端高<492 时出，宽<360 不出；文案仍是旧的 | app.js:815 | 范围外格 | 高<约600 或宽<360 在所有端出现「窗口太小，放大窗口更好玩」 |
| F1 | 飞出期间按 ← 同帧交 2–4 张，按住交 6 张（22 格） | app.js:942-951 keydown 无 ui.animating 判断 | run/old/matrix_flykeys_* | 飞出时不交卡、不丢卡、不崩 |
| F2 | 飞出约 60ms 后点字格会交掉下一张卡 | app.js:1011 #wordbox 点击无 ui.animating 判断 | run/old/f2/ | 同上 |
| F4/Esc | 按 Esc 关不掉菜单（7 格，电脑与 1280 触屏） | app.js:920 只调 render() 未调 renderMenu() | *_1280x800_desk/068_menu_esc.jpg | Esc 关菜单 |
| SW 首开 | 18 次升级中 17 次首次重开仍跑旧代码，第二次才新版 | 页面未监听 controllerchange | run/sw_*（首轮误判见 run/sw_first/） | 首开即新版、存档不丢 |
| 手机溢出 | 见 N3；另手机 UI 硬门 FAIL：对比度、刻字状态、卡面文字、D3 | — | evidence/side_by_side/ | 主流手机尺寸全过 |
| PC 溢出 D3/H5 | 刻字框文字与「先不刻」溢出，字框「已落」溢出（版式 A 585 格） | — | 版式 A 矩阵 | 不出容器（容差 1px） |
| S1/S8 | 1280 下「K 刻字」提示 display:none；FIX_SPEC 1/2/5/6/8 不过（版式 S 共 1112 格） | — | 版式 S 矩阵 | 提示可见且所指元素可见 |
| O4 | 1280×600 拖动时卡片盖住右选项（按新范围 1280×600 为范围外，记录备查） | — | run/layout/shots/chromium_1280x600_09_g1_C03_拖动态.png | 范围外只验提示/不崩 |
| L14 | 1440×900 第一张卡 T01「开春了」卡片下半截大片空白（正文一行，卡高约占满视口），卡面图没有显示或卡高没有跟内容走 | 待查（#cardwrap 高度/卡面图） | 运维线上截图 evidence/ops_release/desktop-1440x900.png | 主流电脑尺寸卡面无大片空白，按设计稿比例 |
| L15 | 电脑端按键提示重复：卡片下方一行（淡色，且被教学气泡「左右拖卡做选择…」压住）、页面底部又一行 | 待查（两处提示元素同时显示） | 同上 | 按键提示只出现一处，不被气泡遮挡 |

另有手机 UI 待定项（已归 PR10）：点击区按 ≥44×44 计、aria-label、data-ready、长按不点亮。
下一版：新 tip 到后按 17:46 主流尺寸清单跑全量（含 E 检查），补测 360×800、393×852、430×932、768×1024、820×1180、1024×768、1280×720、1366×768、1440×900、1920×1080。


补记（2026-10-16 22:15 SGT）：L14、L15 由运维在线上 f3965770659e（main b0c7b5d，部署 80f27356）截图发现，测试已看图确认。测试本轮矩阵未覆盖 1440×900（旧视口清单），属于本角漏测；L15 在 1280×800 也应能看到，测试矩阵未设「提示唯一性」检查，下一版版式检查补这一条。

## 追加（PM 裁定 2026-10-19 16:09 SGT）

| 编号 | 问题 | 代码位置 | 证据 | 下版验收 |
|---|---|---|---|---|
| S-1 | **丢输入（部署前必须关闭）**：webkit 1280×800 鼠标，点 #opt-left 后 50ms 在 #opt-right 上 mousedown、按住 ≥260ms 再 mouseup → 不触发 click，输入丢失 12/12。chromium、firefox 正常。b81125d 已存在，非 PR9 引入 | 待查：疑 webkit 长按后不补发 click，或拖卡起始阈值/指针捕获吞掉；考虑「未起拖时在 pointerup 上提交」 | /workspace/qa-zaozi-pr9-6a88f4d/recheck/f1/press_webkit.json、press_pr9_*.json、press_b81_*.json；run/pr9/shots/webkit_1280x800_desk/013、014 | 按住 ≥260ms 松开也提交一次（且只一次）；webkit e2e + 变异证明（去掉修复必失败） |
