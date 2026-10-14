# 重做进度（REDESIGN_PROGRESS.md）

分支 `feat/web-redesign-v2`。基线 = 当前源码。每步 commit 后在这里记一行；中断后从这里继续。

- [ ] 0. 写 REDESIGN_TASK.md + REDESIGN_PROGRESS.md（本文件），commit
- [ ] 1. data：goals.json（v2.1 文案、placeholder:false、条件）；year1_cards.json 加教学顺序字段 + 卡片正文拆分
- [ ] 2. 引擎：每代目标、开局挑字、教学顺序、多代流程（不改数值）
- [ ] 3. Web 壳重排：index.html + style.css（手机/平板/桌面三档）+ app.js 结构改造（DOM 卡、字匣、抽屉/侧栏、菜单、存档弹层）
- [ ] 4. 手感：拖卡倾角/回弹/飞出/翻牌、预览圆点、飘字、演变条、卡角骨片四态
- [ ] 5. 音效（WebAudio）+ 菜单静音开关（localStorage）
- [ ] 6. 目标 UI（小签/清单/开春展开/达成横幅）+ 教学气泡 + 挑字界面
- [ ] 7. 卡面图进 web/img/cardart + <picture> + 预缓存；build_dist 拷贝
- [ ] 8. 字源：水 3 字形进字形包 + SOURCES.csv 行 + credits 生成
- [ ] 9. VERSION 内容哈希；baseline 测试改造
- [ ] 10. 单测（node --test）
- [ ] 11. Playwright e2e（3 引擎 × 5 视口）
- [ ] 12. 干净树 build dist
- [ ] 13. release_shots_v2 截图
- [ ] 14. REDESIGN_REPORT.md + DONE
