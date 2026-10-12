# NOTES · 造字人正式视觉 v1（设计稿，非玩法示意）

2026-10-09 21:04–21:15 SGT。假绿：否。

## 做了什么
- 三套正式视觉，每套 html + png（CSS 宽 1080，device scale 2，出图 2160 宽）：
  - `card_zaozi_v1`：造字那一刻。A 帧（0.2 秒，骨片上甲骨文「休」）、B 帧（3.0 秒，落成今天写法 + 「记 +6」成字弹层）、动画节奏表、同一套组件换成象形「水」的小样。
  - `zilu_detail_v1`：字录单字详情（休）、格子四种状态总览、演变条点一格放大态。
  - `evo_strip_v1`：演变条组件。格子解剖、尺寸档位、状态、放大态；示例 休（5 格，隶书西汉）、本（4 格，没有甲骨文那格不出现）、从（6 格，繁简分开）；浅底 / 深底两种主题；规则。
- `SPEC.md`：色板 hex、字号层级、布局尺寸、组件与状态、演变条 token、字形文件清单、待工程确认。
- 配色、字号、间距、圆角全部按正式 token 重写，没有沿用玩法示意里的数值。
- 处理了快审留下的排版问题：事签末行孤字。现在用平衡换行，并把「一截老干」「遮着太阳」「天色转凉」设成不拆行。

## 参考了哪些（只读，未改）
- `next-game-principles/gameplay_b/html/mock_zaozi.html`、`logs/mock_zaozi_v2.html`、`logs/mock_zaozi_v3.html`、`img/mock_zaozi.png`、`img/mock_zilu.png`
- `next-game-principles/GAMEPLAY_B_ZAOZI.md`、`CHAR_LIST_V1.md`、`GLYPH_EVOLUTION.md`，以及 `tmp/design_audit/ZAOZI_GAMEPLAY_V3_QUICK_REVIEW_20261007.md`
- `glyph/mock_glyph.png`、`glyph/evolution_table.png` 复制到了 `/workspace/zaozi-formal/ref/`，只作参考。
- 开工前后各核了一次 md5，四个 mock 文件都没变：mock_zaozi.html `5a5329c9…`、v2 `5684feda…`、v3 `74486df8…`、mock_zaozi.png `8cc6448f…`。
- 两页 Notion 用的是任务里给的要点，这次没有再打开 Notion。

## 字形：下到了哪些 / 哪些故意空着
- Commons（2026-10-09 21:05 SGT 用 Special:FilePath 下载，sha1 和 Commons API 逐个比对，12/12 一致）：休、水、从的甲骨文、金文、小篆；水的秦简；本的金文、小篆。休、从的 6 个文件和 `next-game-principles/glyph/img/` 里已有的文件 sha1 也一致。
- 小学堂 CC0 隶书：本（睡虎地簡12.38，21:05 SGT 新取，size=200）；休（老子甲後283，西汉）、从（睡.編53，「從」）复制自 18:32 已入库的原图。
- 需致谢 Sears（文件页解析出「Richard Sears」）：水-seal、从-bronze、从-seal。
- 故意空着：本的甲骨文。`本-oracle.svg` 在 Commons 上返回 404，演变条按规则不出这一格，也没有写任何占位文字。
- 没有自己画古字形，笔画和粗细都没改。显示版只改 SVG 根标签的 viewBox，PNG 只裁边，最长边占 86%（`glyphs/norm.py`）。
- 明细：`glyphs/manifest_v1.json`、`glyphs/commons_meta.json`、`glyphs/sears_check.txt`。

## 白话行
按「只写看得见的变化」逐张对照字形写的，每行不超过十字。比如休的金文写「人形多了一道短笔」，对应金文里人形多出的那道短斜笔。字源判断都没写进去。请写文案的同事再过一遍。

## 渲染命令
```
python3 src/build_card.py && ./render.sh card_zaozi_v1 1150
python3 src/build_zilu.py && ./render.sh zilu_detail_v1 1250
python3 src/build_evo.py  && ./render.sh evo_strip_v1 1900
# render.sh: google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
#   --force-device-scale-factor=2 --window-size=1080,<高> --virtual-time-budget=3000 --screenshot=<png> file://<html>
```
html 里的字形都以 data URI 内嵌，单个文件就能打开。

## 自检
- OCR（rapidocr）三张都过了：「设计稿，非玩法示意」分别识别到 3 / 3 / 1 处；PR、main、门禁、QA、内部角色名、「暂缺」「没查到」之类一处都没有。OCR 全文在 `logs/*.ocr.txt`。
- 三张都按原尺寸分块看过：没有拆词、孤字，也没有溢出。

## 手写 vs cc/agy
手写，没用 cc/agy。全部是排版和逐张看图的手工活，没有适合交给 cc/agy 的机械批量步骤。

## v1.1（2026-10-09 21:2x SGT）：审核两条 P1 的修复
- 只改了字录详情（`src/build_zilu.py` → `zilu_detail_v1.html/png`，沿用 v1 文件名）；造字卡、演变条、SPEC 都没动。v1.0 原件留在 `_v1_0/`。
- P1-1：C、D 两屏的分页计数改成「全部 8 · 象形 7 · 会意 1 · 指事 0」，和已造的水、日、人、木、田、火、禾（象形）加休（会意）对上。格子、「已造 8」和导航「8 / 27」都没动。说明栏里「指事字的同一张卡」只是讲换成「本」时卡面怎么变，不涉及计数，所以保留。
- P1-2：右栏放大卡 `.pop` 按 SPEC §5 定宽 188（box-sizing:border-box），字形区仍为 144×144，标题 `h5` 从 16 改成 14 Bold，出处 `.src` 从 11 改成 10。没有另起一档，SPEC 不改。
- PNG 仍是 2160×2500。差异只在两屏分页的数字和右栏：放大卡变窄、变矮之后，右栏下面的内容整体上移了几像素，底部的页脚说明也跟着上移了约 6px（2x 像素）。
- 核对：OCR 读到象形7、指事0 各 2 处，象形6、指事1 都是 0 处，「设计稿，非玩法示意」3 处。gameplay_b 下 5 个 mock 文件的 md5 和开工前一致。并排图：`sbs/sbs_zilu_v1_0_vs_v1_1.png`（左边是 v1.0，右边是 v1.1）。
- 手改，没用 cc/agy。

## v1.1.1 放大卡白话字号（2026-10-09 22:41 SGT）
用户锁定 v1.1 进工程后要求：放大卡白话统一成 12（与 evo 页一致）。`.pop .bh2` 由 Serif 14 改为 Serif 12；SPEC §5 放大卡一行白话已写明 12。仅改这一处字号，分页计数等 v1.1 改动保留。手改，没用 cc/agy。假绿：否。
