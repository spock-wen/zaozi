# 验证「指事」徽标（DEBUG ONLY 种子）

## 为什么要有这个开关

设计稿 `zilu_detail_v1` 里已造的 8 个字全是**象形**（水 日 人 木 田 火 禾）加一个
**会意**（休），所以字录的「指事」分页在正式数据下是空的、详情卡也看不到指事徽标。
为了在真机上确认 `指事` 徽标（`methodBadgeFg` / `methodBadgeBg`，`ui_zilu_detail.cj`）
的颜色和排版是对的，`zilu_model.cj` 里留了一个**只给验证用**的开关：

```cangjie
public let ZILU_DEBUG_SEED_ZHISHI: Bool = false   // 出包必须保持 false
```

置 `true` 后，已造列表 = 基线 8 个字 + 追加指事字「本」（`glyph_data.cj` 里本来就有，
造法 `指事`）：

| | 全部 | 象形 | 会意 | 指事 | 27 格总览 |
|---|---|---|---|---|---|
| 默认（`false`） | 8 | 7 | 1 | 0（空分页） | 8 已造 + 1 有事签 + 1 残片 + 17 未知 |
| 种子（`true`） | 9 | 7 | 1 | 1（只有「本」） | 9 已造 + 1 有事签 + 1 残片 + 16 未知 |

开关默认 `false`，所以**不打开它时 Release 行为和以前完全一样**。
`tools/box_check/main.cj` 的 `zilu-seed` 一节里有断言守着 `ZILU_DEBUG_SEED_ZHISHI == false`，
防止有人带着 `true` 提交或出包。

## 打一个验证 HAP

1. 改 `entry/src/main/cangjie/zilu_model.cj`：`ZILU_DEBUG_SEED_ZHISHI` → `true`；
2. 按 [`COMPILE.md`](COMPILE.md) 出包（调试包即可）；
3. 装机后按下面「验收步骤」过一遍；
4. **验完把开关改回 `false` 再提交**，别把这个改动带到正式包里。

## 验收步骤

1. 打开 App 进**字录**；
2. 分页条计数应为 `全部 9 · 象形 7 · 会意 1 · 指事 1`（原来是 `… · 指事 0`）；
3. 切到**指事**分页：不再显示「暂无指事字」，网格里只有一个格子「本」；
4. 点「本」→ 详情卡上的造法徽标显示「**指事**」（紫灰色，`Theme.zhishi600` / `zhishi100`），
   不是会意的朱红、也不是象形的青绿；
5. 回**全部**分页：格子总数仍是 27，网格里多了「本」（排在 8 个基线字之后），未知格 16 个；
   （切回「全部」不改选中，详情卡仍停在「本」——这是 `setTab` 的既有行为，不是缺陷）；
6. 象形 / 会意分页的字和以前一致（7 / 1），不多个「本」也不错个字。

## 只在本机（无 ohos SDK）能验的部分

```bash
source /home/box/.cangjie-sdk/6.1/cangjie/envsetup.sh
cd tools/box_check && ./sync.sh && cjpm build && cjpm run   # zilu-seed 一节
bash tools/box_check/parse_check.sh                        # 语法 / 类型
```

`zilu-seed` 一节用参数化的纯函数（`ziluBuildMadeIds` / `ziluCountsOf` / `ziluTabIdsOf` /
`ziluGridOf` …）把种子打开后的效果全查一遍，**不需要**真把开关改成 `true`：
9 个 id、含「本」且在最后、指事分页只有「本」、第一个字是「本」、
`ziluMethodOf("ben") == "指事"`、27 格仍铺满、未知 16 格。

徽标本身的颜色只有真机/DevEco 上看得到，本机证不了（见 `SCAFFOLD_REPORT.md`）。
