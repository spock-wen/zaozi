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
- [ ] 10. 单测（node --test）
- [ ] 11. Playwright e2e（3 引擎 × 5 视口）
- [ ] 12. 干净树 build dist
- [ ] 13. release_shots_v2 截图
- [ ] 14. REDESIGN_REPORT.md + DONE

## 当前进度
- 1/2/7/8/9 已提交（882f9f1、be47a83）：data/goals.json、data/tutorial.json、year1_cards 教学卡与 title、chars_slice.pick_chars；engine.ts 每代目标/开局挑字/教学顺序/多代流程；解钉 baseline_version.txt；卡面图进 web/img/cardart、data/card_art.json；glyph_sources.csv + credits_table 署名。
- 3/4/5/6 已实现并提交（本步）：三档布局（手机顶栏 + 四维行 + 卡 + 字匣；平板竖同手机、横右栏；桌面顶栏 56 + 中央卡 + 左右选项 + 卡下字匣 + 底键位 + 右侧可收起 336 侧栏）；教学气泡手机在卡与字匣之间、桌面浮在卡右（距侧栏 16）；目标小签/清单/达成横幅（等飘字后出、先于结局）；挑字界面（14 字池、键位）；WebAudio 音效 + 菜单静音；存档导入导出；拖动/倾角/回弹/飞出/预览圆点/飘字/骨片四态；☰ 44×44 在手机/平板可见；resize 节流；侧栏开合 localStorage、~1024 强制收起。
- 修：挑字 pick_toggle 双切换（壳传已切换数组又让引擎再切换）——壳只传 char。
- 下一步：7/8 收尾核对（预缓存清单、credits 署名行），然后 10–14。
