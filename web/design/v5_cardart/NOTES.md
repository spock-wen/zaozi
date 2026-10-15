# v5_cardart NOTES（假绿：否）
- **10-14 重建版**：07:49 重启后 /workspace 回退，原 v5_cardart 丢失；按对话记录里的脚本和参数重出。脚本与原版一致（原 shaman 里一条不可见的空心路径删了，画面不变）。代码目录 pc_web_milestone1 已不在，卡数据按记录的 C01–C10 写进 `src/cards_year1.json`。
- 盘点：10 张卡（C01–C10），8 个出场人物；教学只重排这些卡；先人过场是深色文字卡，没有卡面图位，未出图。
- 人物设定：没有正式人物形象设定，全部用剪影 / 背影，不画脸。
- 方案：6 张图覆盖 10 张卡，理由见 CARD_ART_MAP.md。
- 画法：手写 SVG（`src/gen.py`），4 色：骨底 #F1E8D4、骨暗 #CDBB94、墨 #2A241D、刻痕红 #6E2F1F。版画剪影，画内无文字。没有用 GenerateImage，也没用 cc/agy。
- 导出：`src/export.py`（Chrome 渲染 SVG → webp q82 + png 32 色）；手机 296×216、电脑 400×292，各 1x/2x，共 48 个文件。
- 预览：`src/preview.py` → `preview/preview_mobile_4cards.png`（C02/C04/C09/C07 放进 v2_1 卡面）、`preview/preview_desktop.png`/.html（1440 放 C02、1280 放 C07）。**电脑图位按已定的 400×292 比例、不裁切**（与原版的 cover 裁切不同）。
- 自检见报告：原尺寸看图、文字不压图、映射 10/10。
