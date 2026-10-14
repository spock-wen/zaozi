# 卡面图映射（设计稿，非玩法示意）

来源数据：原为 `pc_web_milestone1/data/year1_cards.json`（feat/web-redesign-v2 @e069842）。**10-14 重建**：代码目录已不在，按对话记录里的 C01–C10（`src/cards_year1.json`）重出。共 10 张卡、8 个出场人物；6 张图覆盖全部卡。

| 卡 | 季 | 人物 | 图 | 手机 1x / 2x | 电脑 1x / 2x |
|---|---|---|---|---|---|
| C01 | 春 | 族长 | elder | `assets/elder_m@1x.webp` / `assets/elder_m@2x.webp` | `assets/elder_d@1x.webp` / `assets/elder_d@2x.webp` |
| C02 | 春 | 采集的妇人 | gatherer | `assets/gatherer_m@1x.webp` / `assets/gatherer_m@2x.webp` | `assets/gatherer_d@1x.webp` / `assets/gatherer_d@2x.webp` |
| C03 | 春 | 巫 | shaman | `assets/shaman_m@1x.webp` / `assets/shaman_m@2x.webp` | `assets/shaman_d@1x.webp` / `assets/shaman_d@2x.webp` |
| C04 | 夏 | 东岸的使者 | river | `assets/river_m@1x.webp` / `assets/river_m@2x.webp` | `assets/river_d@1x.webp` / `assets/river_d@2x.webp` |
| C05 | 夏 | 北山来的赶路者 | north | `assets/north_m@1x.webp` / `assets/north_m@2x.webp` | `assets/north_d@1x.webp` / `assets/north_d@2x.webp` |
| C06 | 夏 | 守堤的老汉 | river | `assets/river_m@1x.webp` / `assets/river_m@2x.webp` | `assets/river_d@1x.webp` / `assets/river_d@2x.webp` |
| C07 | 秋 | 族里最壮的汉子 | strong | `assets/strong_m@1x.webp` / `assets/strong_m@2x.webp` | `assets/strong_d@1x.webp` / `assets/strong_d@2x.webp` |
| C08 | 秋 | 北山的人 | north | `assets/north_m@1x.webp` / `assets/north_m@2x.webp` | `assets/north_d@1x.webp` / `assets/north_d@2x.webp` |
| C09 | 冬 | 巫 | shaman | `assets/shaman_m@1x.webp` / `assets/shaman_m@2x.webp` | `assets/shaman_d@1x.webp` / `assets/shaman_d@2x.webp` |
| C10 | 冬 | 族长 | elder | `assets/elder_m@1x.webp` / `assets/elder_m@2x.webp` | `assets/elder_d@1x.webp` / `assets/elder_d@2x.webp` |
| gf4-休 | 冬 | 冬夜 · 「休」入字录（设计稿 gf4 ③ 与电脑端） | strong | `assets/strong_m@1x.webp` / `assets/strong_m@2x.webp` | `assets/strong_d@1x.webp` / `assets/strong_d@2x.webp` |

PNG 兜底同名换后缀 `.png`。另附 `card_art_map.csv`、`card_art_map.json`。

## 六张图
| 图 | 内容 | 用于 |
|---|---|---|
| elder | 族长：田边背影持杖，草屋，红日 | C01, C10 |
| shaman | 巫：双臂举骨片，祭火，弯月 | C03, C09 |
| gatherer | 采集的妇人：塌坡露出根须，背筐背影 | C02 |
| river | 河岸：宽河、土坎，对岸三人影（东岸 / 守堤共用） | C04, C06 |
| north | 北山来客：远山，持杖赶路人，牛（赶路者 / 北山的人共用） | C05, C08 |
| strong | 壮汉：陷泥的粟车，撬杠 | C07, gf4-休 |

## 为什么是 6 张
- 按人物复用：族长（C01、C10）、巫（C03、C09）各出场两次，一人一图。
- 再按场景合并：东岸的使者（C04）和守堤的老汉（C06）都是「河与岸」的事，共用河岸图；北山来的赶路者（C05）和北山的人（C08）都是「北山来人」，共用北山图。
- 采集的妇人、族里最壮的汉子场景独特（塌坡、陷车），各一张。
- 再少就要让不同人物共用一张无辨识度的图，卡面失去「这次是谁」的提示，所以停在 6。
- 季节不另出图：卡头已有季名。

## 尺寸
- 手机 296×216（v2_1 卡面图位）。
- 电脑 400×292：BREAKPOINTS 最大卡高 640 → 宽 448，内边距 24 → 图宽 400，按手机比例等比。**已定：电脑图位按 400×292 比例，不裁切**（卡内宽 388 → 图高 283；364 宽卡 → 231）。
- 各 1x、2x；webp（q82）+ png（32 色调色板）。

## 文件 sha16
| 文件 | 字节 | sha16 |
|---|---|---|
| elder_d@1x.png | 1951 | 5c02a6eecba642a9 |
| elder_d@1x.webp | 1992 | 0a274cc752954ad1 |
| elder_d@2x.png | 4078 | 6dc6144ef94dee72 |
| elder_d@2x.webp | 4048 | 14ffc9bfca73cc98 |
| elder_m@1x.png | 1354 | e566624e05ad1444 |
| elder_m@1x.webp | 1470 | f4cf3ad264f5cace |
| elder_m@2x.png | 2875 | e06697a0f4031f2c |
| elder_m@2x.webp | 2784 | c3a128056e6cb070 |
| gatherer_d@1x.png | 2330 | de12c75ae6728705 |
| gatherer_d@1x.webp | 2058 | b000579a548b7677 |
| gatherer_d@2x.png | 4780 | 19a1c94bd341afb7 |
| gatherer_d@2x.webp | 4488 | 2425090915882cbe |
| gatherer_m@1x.png | 1685 | 200cfa41efa1ed0e |
| gatherer_m@1x.webp | 1472 | ce417d37e5ffed41 |
| gatherer_m@2x.png | 3594 | e0a2b3981784674e |
| gatherer_m@2x.webp | 3056 | 22651fc1af01ff89 |
| north_d@1x.png | 2843 | d7f13837acfce5f4 |
| north_d@1x.webp | 2438 | 6b0e8901180ad265 |
| north_d@2x.png | 5806 | 62cf23c964117e7a |
| north_d@2x.webp | 5324 | 3719337a1845d142 |
| north_m@1x.png | 1929 | fbf62533da866a5b |
| north_m@1x.webp | 1776 | 02fb2df36f58251e |
| north_m@2x.png | 4070 | 84e8747e8ea866d6 |
| north_m@2x.webp | 3470 | cc405c1d856018c2 |
| river_d@1x.png | 2573 | 5708176e8a90f9f8 |
| river_d@1x.webp | 2986 | 796f3a7c59f1446f |
| river_d@2x.png | 5816 | ada61b18219b428c |
| river_d@2x.webp | 6378 | 8b2d26a907122a10 |
| river_m@1x.png | 1489 | fb3f09e3a0d062b0 |
| river_m@1x.webp | 2148 | fbb1f70e6873518c |
| river_m@2x.png | 3278 | 13cf83bb318f8268 |
| river_m@2x.webp | 4500 | 7d86a5a69dbe36fb |
| shaman_d@1x.png | 2450 | c72d70658bb5cb69 |
| shaman_d@1x.webp | 2298 | 5e50cd12985f72ee |
| shaman_d@2x.png | 5227 | d30d581f3e07d2d7 |
| shaman_d@2x.webp | 4864 | 4944b764e840939c |
| shaman_m@1x.png | 1765 | f4d3ce5684537318 |
| shaman_m@1x.webp | 1722 | f8757d7fc64d82e1 |
| shaman_m@2x.png | 3679 | 5650d56565202fd0 |
| shaman_m@2x.webp | 3346 | 4b51819ca8407243 |
| strong_d@1x.png | 3169 | 26f9f0cc348c382a |
| strong_d@1x.webp | 3914 | 9136a7ee6d68e9fd |
| strong_d@2x.png | 6806 | 91657c0c4014c589 |
| strong_d@2x.webp | 7868 | a73789ae1923fa71 |
| strong_m@1x.png | 1943 | 51e380a3011d6a9a |
| strong_m@1x.webp | 2778 | 080ead7ef56f554e |
| strong_m@2x.png | 4282 | 44015f6068ce56e1 |
| strong_m@2x.webp | 5522 | e0151702aed101d4 |

## 借图登记
- `gf4-休`（冬夜「休」入字录，gf4 ③ 与电脑端）：借用 strong 图（推车），与「人靠在木旁边」不符，待专画，不进正式版。
