# 目标可达性（GOAL_REACHABILITY.md）

分支 `feat/web-redesign-v2`。QA 看 `G_FOOD_65`、`G_OUT_65` 几乎没在代末亮过，怀疑这两个目标不可达。
本文件用**引擎本身**（和网页跑同一份代码）在大样本上实测「抽到 / 达成」，给出结论、原因，以及一条可复现的达成路径。
**不改玩法/目标设计**：阈值 `min`、卡上增量、代长一律不动（任务书要求）。

## 一、结论

- **可达。** 点名去打时 `G_FOOD_65` 达成 **3584/3584（100%）**、`G_OUT_65` 达成 **3656/3656（100%）**：凡被抽到就能达成，四个四维目标同理（见 §二 分打法表）。
- **「稀」是两个原因叠加**：(1) 它们不在第 1 代固定目标里，只在第 2–4 代按池抽（每代 3/5），抽到次数约为「记 / 信」的六成多（实测 64%）；(2) 无指定打法（随机）时它们最难中——粮 2.6%、外 9.1%，因为整副卡的「粮」代均漂移是负的（见 §三）。
- **不是阈值 / 增量 / 代长的问题**（§三.3）：一代内「粮」最高能到 76、「外」70，都过 65 的线，而且挑这些正增量时没有反向扣分。
- `G_ENGRAVE1` 在当前设计里**永远抽不到**（第 1 代固定集按设计排除它，第 2 代起的池又排除了它）——只记录，不动设计（§五）。

## 二、实测：抽到 / 达成

运行 `node tools/goal_sweep.mjs --seeds 2000 --gens 4` = **2000 种子 × 4 代 × 5 打法 = 40000 代**。

| 目标 | 抽到 | 达成 | 达成/抽到 |
|---|---:|---:|---:|
| G_ENGRAVE1 | 0 | 0 | — |
| G_DROP1 | 27970 | 1727 | 6.2% |
| G_MEM_70 | 27870 | 8470 | 30.4% |
| G_FAITH_65 | 27960 | 12073 | 43.2% |
| G_FOOD_65 | 17920 | 3676 | 20.5% |
| G_OUT_65 | 18280 | 3988 | 21.8% |

**分打法（达成 / 抽到）** —— 可达性要看**点名打的那一列**（全表 20% 出头是被「不管这个维度的 4 种打法」拉低的）：

| 打法 | ENGRAVE1    | DROP1       | MEM_70      | FAITH_65    | FOOD_65     | OUT_65      |
|---|---|---|---|---|---|---|
| greedy-food | 0/0         | 0/5594      | 0/5574      | 0/5592      | 3584/3584   | 0/3656      |
| greedy-outsider | 0/0         | 0/5594      | 0/5574      | 5592/5592   | 0/3584      | 3656/3656   |
| greedy-memory | 0/0         | 0/5594      | 5574/5574   | 0/5592      | 0/3584      | 0/3656      |
| greedy-faith | 0/0         | 0/5594      | 0/5574      | 5592/5592   | 0/3584      | 0/3656      |
| random | 0/0         | 1727/5594   | 2896/5574   | 889/5592    | 92/3584     | 332/3656    |

打法定义（`tools/goal_sweep.mjs`）：`greedy-<dim>` = 每张卡挑**该维增量最大**且不会把任意维顶到 0/100 的一边（刻字只影响信/记，与目标维无关时一律不刻）；`random` = 均匀随机选边、50% 概率刻、随机挑三个字。

## 三、为什么 `G_FOOD_65` / `G_OUT_65` 看起来「稀」

### 3.1 抽到的机会本来就少（第 1 代固定集不含它们）
`data/goals.json` 的 `generation1_goals = [G_DROP1, G_MEM_70, G_FAITH_65]` 是固定 3 个；第 2 代起才在池里（5 个可抽，`G_ENGRAVE1` 被 `generation1_exclude` 排除）按 (种子,代数) 抽 `per_generation = 3` 个。
于是：记/信/落 每个种子都必在第 1 代出现一次（+10000 次抽到），而粮/外只能靠第 2–4 代，每代抽到的概率 3/5。实测每代抽到率：粮 59.7%、外 60.9%，与 3/5 吻合。

### 3.2 无指定打法时「粮」整代均值是负的
随机打时四维目标达成率（达成/抽到）：粮 **2.6%**、外 **9.1%**、信 15.9%、记 **52%**。原因在整副卡的增量分布：
把每张卡的「左 / 右 / 可落字」当作等概率选项，逐代累加四维的期望：

| 维度 | 代均漂移（均匀随机的期望） | 一代可选的正增量之和 | 正增量卡数 | 从 50 起一代上限 |
|---|---:|---:|---:|---:|
| 粮（food） | -11.67 | +26 | 6/10 | 76 |
| 信（faith） | +3.67 | +28 | 5/10 | 78 |
| 记（memory） | +10.00 | +24 | 5/10 | 74 |
| 外（outsider） | +1.00 | +20 | 4/10 | 70 |

- **粮**：代均漂移 **−11.67**。6 张卡有正的「粮」，但每一张都把「粮」和「外 / 记」对着给；另有 4 张卡根本没有正的「粮」边。乱选一代下来粮多在 50−12≈38 附近，离 65 很远——所以随机只有 2.6%。
- **外**：代均漂移 **+1.00**。均值几乎不动，终值大致停在 50 上下，够到 65 属于右尾，所以随机 9.1%。
- **记**：代均漂移 **+10.00**，且冬夜每刻对一个字再 +6（`winter_night.correct_delta`）——记是不指定打法时最容易中的，随机 52%。
- 每条正确的冬夜刻字只加「记」，不影响粮/外，所以这四种打法里没有谁能靠冬夜顺手把粮/外顶上去。

### 3.3 阈值 vs 增量 vs 代长：都够，问题不在设计
- 阈值：四维每代都重置回 50（`rules.dims.start`；`begin_generation` → `createGame` 会重置），所以四维目标等价于「一代内净涨到 65/70」。粮/外各要 **+15**。
- 增量与代长：一代 = 一年 = 10 张普通卡。只要专挑正边，粮最高 **76**（+26，6 张卡全挑正边）、外最高 **70**（+20，4 张卡全挑正边）。两条上限都过 65，**一代足够**，不需要攒代。
- 且这些正边各自只扣别的维度，挑完之后四维都还在 1–99 的安全区，不会误触失败结局（饥年 / 兵祸 / 仓满招寇 / 并族）。外比粮更紧（只有 4/10 张卡有正的外边，上限 70，只高出阈值 5），但依然稳过。
- 结论：**瓶颈是无脑随机时的选项构成，不是阈值太高、增量不够、或代太短。** 玩法设计无需改动。

## 四、可复现的「种子 + 选择序列」

「存档码」就是完整的选择序列（种子 + 每一步操作），在网页菜单「导入存档码」粘贴即复现；`node tools/goal_sweep.mjs --show <目标>` 还会打印逐步的「人话走法」并做重放校验。四维目标在该代最后一个冬夜结束时判定。

### G_FOOD_65

- 种子 `0`，打法 `greedy-food`，第 **3** 代代末达成，51 步，代末四维 `{"food":76,"faith":54,"memory":46,"outsider":30}`。
- 网页打开：`/?debug=1&debug_goal=G_FOOD_65&seed=0`（debug 参数把该目标硬塞进每一代，方便反复验）。
- 存档码：

```
ZZ1.f0mqr4.eyJ2IjoxLCJzZWVkIjowLCJhY3Rpb25zIjpbeyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6InNraXBfZW5ncmF2ZSJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6InJpZ2h0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJza2lwX2VuZ3JhdmUifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoid2ludGVyX2VuZCJ9LHsidHlwZSI6ImhlaXIifSx7InR5cGUiOiJwaWNrX3RvZ2dsZSIsImNoYXIiOiLmsLQifSx7InR5cGUiOiJwaWNrX3RvZ2dsZSIsImNoYXIiOiLngasifSx7InR5cGUiOiJwaWNrX3RvZ2dsZSIsImNoYXIiOiLml6UifSx7InR5cGUiOiJiZWdpbl9nZW5lcmF0aW9uIiwicGlja3MiOlsi5rC0Iiwi54GrIiwi5pelIl19LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoic2tpcF9lbmdyYXZlIn0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6InJpZ2h0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6IndpbnRlcl9lbmQifSx7InR5cGUiOiJoZWlyIn0seyJ0eXBlIjoicGlja190b2dnbGUiLCJjaGFyIjoi5rC0In0seyJ0eXBlIjoicGlja190b2dnbGUiLCJjaGFyIjoi54GrIn0seyJ0eXBlIjoicGlja190b2dnbGUiLCJjaGFyIjoi5pelIn0seyJ0eXBlIjoiYmVnaW5fZ2VuZXJhdGlvbiIsInBpY2tzIjpbIuawtCIsIueBqyIsIuaXpSJdfSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6InJpZ2h0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6InNraXBfZW5ncmF2ZSJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJ3aW50ZXJfZW5kIn1dfQ
```

走法（`--show` 的输出）：

```
 1. 1代 T01 选左 (faith+6)
 2. 1代 T02 选左 (food+8 faith-4)
 3. 1代 T03 不刻
 4. 1代 T04 选右 (food+4 outsider-4)
 5. 1代 T05 选左 (food+4 outsider-8)
 6. 1代 C02 选左 (faith+4 memory-4)
 7. 1代 C03 选右 (food+4 faith-6)
 8. 1代 C01 选左 (food+8 outsider-4)
 9. 1代 C05 选右 (faith+4 outsider-4)
10. 1代 C06 选右 (food+4 faith-6)
11. 1代 C04 选左 (food+4 outsider-8)
12. 1代 C08 选右 (food+4 outsider-4)
13. 1代 C07 选左 (food+6 faith-4)
14. 1代 C07 不刻
15. 1代 C09 选左 (faith+8)
16. 1代 C10 选左 (food-4 faith+4)
17. 1代 winter 天亮了
18. 1代 ended 先人
19. 1代 pick 挑字 水
20. 1代 pick 挑字 火
21. 1代 pick 挑字 日
22. 1代 pick 出发（水火日） (food-42 faith-6 memory+4 outsider+32)
23. 2代 C03 选右 (food+4 faith-6)
24. 2代 C01 选左 (food+8 outsider-4)
25. 2代 C02 选左 (faith+4 memory-4)
26. 2代 C06 选右 (food+4 faith-6)
27. 2代 C05 选右 (faith+4 outsider-4)
28. 2代 C04 选左 (food+4 outsider-8)
29. 2代 C07 选左 (food+6 faith-4)
30. 2代 C07 不刻
31. 2代 C08 选右 (food+4 outsider-4)
32. 2代 C09 选左 (faith+8)
33. 2代 C10 选左 (food-4 faith+4)
34. 2代 winter 天亮了
35. 2代 ended 先人
36. 2代 pick 挑字 水
37. 2代 pick 挑字 火
38. 2代 pick 挑字 日
39. 2代 pick 出发（水火日） (food-26 faith-4 memory+4 outsider+20)
40. 3代 C01 选左 (food+8 outsider-4)
41. 3代 C02 选左 (faith+4 memory-4)
42. 3代 C03 选右 (food+4 faith-6)
43. 3代 C04 选左 (food+4 outsider-8)
44. 3代 C05 选右 (faith+4 outsider-4)
45. 3代 C06 选右 (food+4 faith-6)
46. 3代 C07 选左 (food+6 faith-4)
47. 3代 C07 不刻
48. 3代 C08 选右 (food+4 outsider-4)
49. 3代 C10 选左 (food-4 faith+4)
50. 3代 C09 选左 (faith+8)
51. 3代 winter 天亮了
```

### G_OUT_65

- 种子 `0`，打法 `greedy-outsider`，第 **3** 代代末达成，54 步，代末四维 `{"food":18,"faith":66,"memory":56,"outsider":70}`。
- 网页打开：`/?debug=1&debug_goal=G_OUT_65&seed=0`（debug 参数把该目标硬塞进每一代，方便反复验）。
- 存档码：

```
ZZ1.5odhez.eyJ2IjoxLCJzZWVkIjowLCJhY3Rpb25zIjpbeyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6InNraXBfZW5ncmF2ZSJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6InJpZ2h0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoic2tpcF9lbmdyYXZlIn0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoic2tpcF9lbmdyYXZlIn0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJ3aW50ZXJfZW5kIn0seyJ0eXBlIjoiaGVpciJ9LHsidHlwZSI6InBpY2tfdG9nZ2xlIiwiY2hhciI6IuawtCJ9LHsidHlwZSI6InBpY2tfdG9nZ2xlIiwiY2hhciI6IueBqyJ9LHsidHlwZSI6InBpY2tfdG9nZ2xlIiwiY2hhciI6IuaXpSJ9LHsidHlwZSI6ImJlZ2luX2dlbmVyYXRpb24iLCJwaWNrcyI6WyLmsLQiLCLngasiLCLml6UiXX0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJza2lwX2VuZ3JhdmUifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6InNraXBfZW5ncmF2ZSJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJ3aW50ZXJfZW5kIn0seyJ0eXBlIjoiaGVpciJ9LHsidHlwZSI6InBpY2tfdG9nZ2xlIiwiY2hhciI6IuawtCJ9LHsidHlwZSI6InBpY2tfdG9nZ2xlIiwiY2hhciI6IueBqyJ9LHsidHlwZSI6InBpY2tfdG9nZ2xlIiwiY2hhciI6IuaXpSJ9LHsidHlwZSI6ImJlZ2luX2dlbmVyYXRpb24iLCJwaWNrcyI6WyLmsLQiLCLngasiLCLml6UiXX0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6InJpZ2h0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoic2tpcF9lbmdyYXZlIn0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6InNraXBfZW5ncmF2ZSJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6InJpZ2h0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJ3aW50ZXJfZW5kIn1dfQ
```

走法（`--show` 的输出）：

```
 1. 1代 T01 选左 (faith+6)
 2. 1代 T02 选左 (food+8 faith-4)
 3. 1代 T03 不刻
 4. 1代 T04 选左 (food-4 outsider+4)
 5. 1代 T05 选右 (food-6 outsider+6)
 6. 1代 C02 选左 (faith+4 memory-4)
 7. 1代 C03 选左 (food-6 faith+8)
 8. 1代 C01 选右 (food-4 memory+6)
 9. 1代 C05 选左 (food-4 outsider+6)
10. 1代 C05 不刻
11. 1代 C06 选左 (food-8 memory+4)
12. 1代 C04 选右 (food-6 outsider+6)
13. 1代 C08 选左 (food-6 outsider+4)
14. 1代 C07 选左 (food+6 faith-4)
15. 1代 C07 不刻
16. 1代 C09 选左 (faith+8)
17. 1代 C10 选右 (food-4 outsider+4)
18. 1代 winter 天亮了
19. 1代 ended 先人
20. 1代 pick 挑字 水
21. 1代 pick 挑字 火
22. 1代 pick 挑字 日
23. 1代 pick 出发（水火日） (food+34 faith-18 memory-6 outsider-30)
24. 2代 C03 选左 (food-6 faith+8)
25. 2代 C01 选右 (food-4 memory+6)
26. 2代 C02 选左 (faith+4 memory-4)
27. 2代 C06 选左 (food-8 memory+4)
28. 2代 C05 选左 (food-4 outsider+6)
29. 2代 C05 不刻
30. 2代 C04 选右 (food-6 outsider+6)
31. 2代 C07 选左 (food+6 faith-4)
32. 2代 C07 不刻
33. 2代 C08 选左 (food-6 outsider+4)
34. 2代 C09 选左 (faith+8)
35. 2代 C10 选右 (food-4 outsider+4)
36. 2代 winter 天亮了
37. 2代 ended 先人
38. 2代 pick 挑字 水
39. 2代 pick 挑字 火
40. 2代 pick 挑字 日
41. 2代 pick 出发（水火日） (food+32 faith-16 memory-6 outsider-20)
42. 3代 C01 选右 (food-4 memory+6)
43. 3代 C02 选左 (faith+4 memory-4)
44. 3代 C03 选左 (food-6 faith+8)
45. 3代 C04 选右 (food-6 outsider+6)
46. 3代 C05 选左 (food-4 outsider+6)
47. 3代 C05 不刻
48. 3代 C06 选左 (food-8 memory+4)
49. 3代 C07 选左 (food+6 faith-4)
50. 3代 C07 不刻
51. 3代 C08 选左 (food-6 outsider+4)
52. 3代 C10 选右 (food-4 outsider+4)
53. 3代 C09 选左 (faith+8)
54. 3代 winter 天亮了
```

### 其余目标

| 目标 | 种子 | 打法 | 达成代 | 步数 | 代末四维 |
|---|---:|---|---:|---:|---|
| G_ENGRAVE1 | — | — | — | — | 找不到（见 §五） |
| G_DROP1 | 1 | random | 1 | 19 | `{"food":58,"faith":45,"memory":65,"outsider":58}` |
| G_MEM_70 | 0 | greedy-memory | 1 | 19 | `{"food":22,"faith":52,"memory":80,"outsider":48}` |
| G_FAITH_65 | 0 | greedy-outsider | 1 | 18 | `{"food":16,"faith":68,"memory":56,"outsider":80}` |
| G_FOOD_65 | 0 | greedy-food | 3 | 51 | `{"food":76,"faith":54,"memory":46,"outsider":30}` |
| G_OUT_65 | 0 | greedy-outsider | 3 | 54 | `{"food":18,"faith":66,"memory":56,"outsider":70}` |

存档码（粘贴导入即复现）：

```
G_DROP1  ZZ1.g04zlz.eyJ2IjoxLCJzZWVkIjoxLCJhY3Rpb25zIjpbeyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6InJpZ2h0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJlbmdyYXZlIiwidHJhY2UiOiLkvJEifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImRyb3AiLCJzbG90IjowfSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoic2tpcF9lbmdyYXZlIn0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJza2lwX2VuZ3JhdmUifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6IndpbnRlcl9jYXJ2ZSIsInRhbGx5IjoiVDEt5LyRIiwiYW5zd2VyIjp7Im1ldGhvZCI6Imh1aXlpIiwiY29tcG9uZW50cyI6WyLkuroiLCLmnKgiXX19LHsidHlwZSI6IndpbnRlcl9lbmQifV19
G_MEM_70  ZZ1.102dxea.eyJ2IjoxLCJzZWVkIjowLCJhY3Rpb25zIjpbeyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6InJpZ2h0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJza2lwX2VuZ3JhdmUifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6InJpZ2h0In0seyJ0eXBlIjoic2tpcF9lbmdyYXZlIn0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6InNraXBfZW5ncmF2ZSJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6InNraXBfZW5ncmF2ZSJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoid2ludGVyX2VuZCJ9XX0
G_FAITH_65  ZZ1.1l73l3v.eyJ2IjoxLCJzZWVkIjowLCJhY3Rpb25zIjpbeyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6InNraXBfZW5ncmF2ZSJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6InJpZ2h0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoic2tpcF9lbmdyYXZlIn0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoic2tpcF9lbmdyYXZlIn0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJ3aW50ZXJfZW5kIn1dfQ
G_FOOD_65  ZZ1.f0mqr4.eyJ2IjoxLCJzZWVkIjowLCJhY3Rpb25zIjpbeyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6InNraXBfZW5ncmF2ZSJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6InJpZ2h0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJza2lwX2VuZ3JhdmUifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoid2ludGVyX2VuZCJ9LHsidHlwZSI6ImhlaXIifSx7InR5cGUiOiJwaWNrX3RvZ2dsZSIsImNoYXIiOiLmsLQifSx7InR5cGUiOiJwaWNrX3RvZ2dsZSIsImNoYXIiOiLngasifSx7InR5cGUiOiJwaWNrX3RvZ2dsZSIsImNoYXIiOiLml6UifSx7InR5cGUiOiJiZWdpbl9nZW5lcmF0aW9uIiwicGlja3MiOlsi5rC0Iiwi54GrIiwi5pelIl19LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoic2tpcF9lbmdyYXZlIn0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6InJpZ2h0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6IndpbnRlcl9lbmQifSx7InR5cGUiOiJoZWlyIn0seyJ0eXBlIjoicGlja190b2dnbGUiLCJjaGFyIjoi5rC0In0seyJ0eXBlIjoicGlja190b2dnbGUiLCJjaGFyIjoi54GrIn0seyJ0eXBlIjoicGlja190b2dnbGUiLCJjaGFyIjoi5pelIn0seyJ0eXBlIjoiYmVnaW5fZ2VuZXJhdGlvbiIsInBpY2tzIjpbIuawtCIsIueBqyIsIuaXpSJdfSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6InJpZ2h0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6InNraXBfZW5ncmF2ZSJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJ3aW50ZXJfZW5kIn1dfQ
G_OUT_65  ZZ1.5odhez.eyJ2IjoxLCJzZWVkIjowLCJhY3Rpb25zIjpbeyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6InNraXBfZW5ncmF2ZSJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6InJpZ2h0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoic2tpcF9lbmdyYXZlIn0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoic2tpcF9lbmdyYXZlIn0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJ3aW50ZXJfZW5kIn0seyJ0eXBlIjoiaGVpciJ9LHsidHlwZSI6InBpY2tfdG9nZ2xlIiwiY2hhciI6IuawtCJ9LHsidHlwZSI6InBpY2tfdG9nZ2xlIiwiY2hhciI6IueBqyJ9LHsidHlwZSI6InBpY2tfdG9nZ2xlIiwiY2hhciI6IuaXpSJ9LHsidHlwZSI6ImJlZ2luX2dlbmVyYXRpb24iLCJwaWNrcyI6WyLmsLQiLCLngasiLCLml6UiXX0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJza2lwX2VuZ3JhdmUifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6InNraXBfZW5ncmF2ZSJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJ3aW50ZXJfZW5kIn0seyJ0eXBlIjoiaGVpciJ9LHsidHlwZSI6InBpY2tfdG9nZ2xlIiwiY2hhciI6IuawtCJ9LHsidHlwZSI6InBpY2tfdG9nZ2xlIiwiY2hhciI6IueBqyJ9LHsidHlwZSI6InBpY2tfdG9nZ2xlIiwiY2hhciI6IuaXpSJ9LHsidHlwZSI6ImJlZ2luX2dlbmVyYXRpb24iLCJwaWNrcyI6WyLmsLQiLCLngasiLCLml6UiXX0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6InJpZ2h0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoic2tpcF9lbmdyYXZlIn0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6InNraXBfZW5ncmF2ZSJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6InJpZ2h0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJ3aW50ZXJfZW5kIn1dfQ
```

## 五、`G_ENGRAVE1`（只记录，不改设计）

40,000 代里 **抽到 0 次**：第 1 代固定目标按设计排除了它（`generation1_goals` 只含落字/记/信，因为教学已强制刻一次），第 2 代起的池又被 `generation1_exclude` 排除。也就是说它是当前设计下的「死目标」，任何种子、任何打法都不会在代末看到它。
调试参数可以把它单独塞进来验（不改变正常玩法）：`/?debug=1&debug_goal=G_ENGRAVE1`。是否要让它进入常规池属于**目标设计**改动，本次不做。

## 六、复现命令

```bash
# 总表 + 分打法表（默认 2000 种子 × 4 代 × 5 打法）
node tools/goal_sweep.mjs
# 只跑 300 种子 / 换 5 代
node tools/goal_sweep.mjs --seeds 300 --gens 5
# 某个目标的「种子 + 存档码 + 人话走法」，末尾带重放校验（须为「达成 ✓」）
node tools/goal_sweep.mjs --show G_FOOD_65
node tools/goal_sweep.mjs --show G_OUT_65
# 机器可读结果
node tools/goal_sweep.mjs --json
```

网页侧（debug 参数）：`/?debug=1&debug_goal=G_FOOD_65&seed=0`。
