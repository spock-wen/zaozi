# 目标可达性（GOAL_REACHABILITY.md）

分支 `feat/web-redesign-v2`。QA 看 `G_FOOD_65`、`G_OUT_65` 几乎没在代末亮过，怀疑这两个目标不可达。
本文件用**引擎本身**（和网页跑同一份代码）在大样本上实测「抽到 / 达成」，给出结论、原因，以及一条可复现的达成路径。
**不改玩法/目标设计**：阈值 `min`、卡上增量、代长一律不动（任务书要求）。

## 一、结论

- **可达。** 点名去打时 `G_FOOD_65` 达成 **3002/3002（100%）**、`G_OUT_65` 达成 **3036/3036（100%）**：凡被抽到就能达成，四个四维目标同理（见 §二 分打法表）。
- **「稀」是两个原因叠加**：(1) 它们不在第 1 代固定目标里，只在第 2–4 代按池抽（每代 3/6），抽到次数约为「记 / 信」的六成（实测 60%）；(2) 无指定打法（随机）时它们最难中——粮 2.8%、外 8.6%，因为整副卡的「粮」代均漂移是负的（见 §三）。
- **不是阈值 / 增量 / 代长的问题**（§三.3）：一代内「粮」最高能到 76、「外」70，都过 65 的线，而且挑这些正增量时没有反向扣分。
- `G_ENGRAVE1` 的抽不到问题**已修复**（§五）：它只从第 1 代固定集排除，第 2 代起回到池里——全样本抽到 **15145** 次、达成 **2064** 次（13.6%），有可复现达成。

## 二、实测：抽到 / 达成

运行 `node tools/goal_sweep.mjs --seeds 2000 --gens 4` = **2000 种子 × 4 代 × 5 打法 = 40000 代**。

| 目标 | 抽到 | 达成 | 达成/抽到 |
|---|---:|---:|---:|
| G_ENGRAVE1 | 15145 | 2064 | 13.6% |
| G_DROP1 | 25005 | 1610 | 6.4% |
| G_MEM_70 | 24695 | 7584 | 30.7% |
| G_FAITH_65 | 24965 | 10767 | 43.1% |
| G_FOOD_65 | 15010 | 3085 | 20.6% |
| G_OUT_65 | 15180 | 3298 | 21.7% |

**分打法（达成 / 抽到）** —— 可达性要看**点名打的那一列**（全表 20% 出头是被「不管这个维度的 4 种打法」拉低的）：

| 打法 | ENGRAVE1    | DROP1       | MEM_70      | FAITH_65    | FOOD_65     | OUT_65      |
|---|---|---|---|---|---|---|
| greedy-food | 0/3029      | 0/5001      | 0/4939      | 0/4993      | 3002/3002   | 0/3036      |
| greedy-outsider | 0/3029  | 0/5001      | 0/4939      | 4993/4993   | 0/3002      | 3036/3036   |
| greedy-memory | 0/3029    | 0/5001      | 4939/4939   | 0/4993      | 0/3002      | 0/3036      |
| greedy-faith | 0/3029     | 0/5001      | 0/4939      | 4993/4993   | 0/3002      | 0/3036      |
| random | 2064/3029        | 1610/5001   | 2645/4939   | 781/4993    | 83/3002     | 262/3036    |

打法定义（`tools/goal_sweep.mjs`）：`greedy-<dim>` = 每张卡挑**该维增量最大**且不会把任意维顶到 0/100 的一边（刻字只影响信/记，与目标维无关时一律不刻）；`random` = 均匀随机选边、50% 概率刻、随机挑三个字。

## 三、为什么 `G_FOOD_65` / `G_OUT_65` 看起来「稀」

### 3.1 抽到的机会本来就少（第 1 代固定集不含它们）
`data/goals.json` 的 `generation1_goals = [G_DROP1, G_MEM_70, G_FAITH_65]` 是固定 3 个；第 2 代起才在池里（6 个可抽，`G_ENGRAVE1` 只从第 1 代排除、第 2 代起已回到池里）按 (种子,代数) 抽 `per_generation = 3` 个。
于是：记/信/落 每个种子都必在第 1 代出现一次（+10000 次抽到），而粮/外/刻只能靠第 2–4 代，每代抽到的概率 3/6。实测每代抽到率：粮 50.0%、外 50.6%、刻 50.5%，与 3/6 吻合。

### 3.2 无指定打法时「粮」整代均值是负的
随机打时四维目标达成率（达成/抽到）：粮 **2.8%**、外 **8.6%**、信 15.6%、记 **53.6%**。原因在整副卡的增量分布：
把每张卡的「左 / 右 / 可落字」当作等概率选项，逐代累加四维的期望：

| 维度 | 代均漂移（均匀随机的期望） | 一代可选的正增量之和 | 正增量卡数 | 从 50 起一代上限 |
|---|---:|---:|---:|---:|
| 粮（food） | -11.67 | +26 | 6/10 | 76 |
| 信（faith） | +3.67 | +28 | 5/10 | 78 |
| 记（memory） | +10.00 | +24 | 5/10 | 74 |
| 外（outsider） | +1.00 | +20 | 4/10 | 70 |

- **粮**：代均漂移 **−11.67**。6 张卡有正的「粮」，但每一张都把「粮」和「外 / 记」对着给；另有 4 张卡根本没有正的「粮」边。乱选一代下来粮多在 50−12≈38 附近，离 65 很远——所以随机只有 2.8%。
- **外**：代均漂移 **+1.00**。均值几乎不动，终值大致停在 50 上下，够到 65 属于右尾，所以随机 8.6%。
- **记**：代均漂移 **+10.00**，且冬夜每刻对一个字再 +6（`winter_night.correct_delta`）——记是不指定打法时最容易中的，随机 53.6%。
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

- 种子 `0`，打法 `greedy-outsider`，第 **2** 代代末达成，36 步，代末四维 `{"food":18,"faith":66,"memory":56,"outsider":70}`。
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
```

### G_ENGRAVE1（本轮修复后新增）

- 种子 `0`，打法 `random`，第 **3** 代代末达成，58 步，代末四维 `{"food":28,"faith":40,"memory":92,"outsider":48}`；该代目标为 `G_FOOD_65, G_ENGRAVE1, G_DROP1`（第 2 代也抽到过它）。达成点是第 46 步「3代 C02 刻 本」——卡上刻下第一件事即达成。
- 网页打开：`/?debug=1&debug_goal=G_ENGRAVE1&seed=0`（debug 参数把该目标硬塞进每一代，方便反复验）。
- 只验「被抽到」更简单：种子 `0` 一路走到第 2 代，目标里就含 `G_ENGRAVE1`（第 2 代 = 先人 → 挑字 → 出发）。
- 存档码：

```
ZZ1.1rpp75n.eyJ2IjoxLCJzZWVkIjowLCJhY3Rpb25zIjpbeyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImVuZ3JhdmUiLCJ0cmFjZSI6IuS8kSJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJza2lwX2VuZ3JhdmUifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6InNraXBfZW5ncmF2ZSJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6InNraXBfZW5ncmF2ZSJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6IndpbnRlcl9jYXJ2ZSIsInRhbGx5IjoiVDEt5LyRIiwiYW5zd2VyIjp7Im1ldGhvZCI6Imh1aXlpIiwiY29tcG9uZW50cyI6WyLkuroiLCLmnKgiXX19LHsidHlwZSI6IndpbnRlcl9lbmQifSx7InR5cGUiOiJoZWlyIn0seyJ0eXBlIjoicGlja190b2dnbGUiLCJjaGFyIjoi5LyRIn0seyJ0eXBlIjoicGlja190b2dnbGUiLCJjaGFyIjoi5piOIn0seyJ0eXBlIjoicGlja190b2dnbGUiLCJjaGFyIjoi5pysIn0seyJ0eXBlIjoiYmVnaW5fZ2VuZXJhdGlvbiIsInBpY2tzIjpbIuS8kSIsIuaYjiIsIuacrCJdfSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoic2tpcF9lbmdyYXZlIn0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6InNraXBfZW5ncmF2ZSJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6InJpZ2h0In0seyJ0eXBlIjoid2ludGVyX2VuZCJ9LHsidHlwZSI6ImhlaXIifSx7InR5cGUiOiJwaWNrX3RvZ2dsZSIsImNoYXIiOiLnlLAifSx7InR5cGUiOiJwaWNrX3RvZ2dsZSIsImNoYXIiOiLngasifSx7InR5cGUiOiJwaWNrX3RvZ2dsZSIsImNoYXIiOiLkuroifSx7InR5cGUiOiJiZWdpbl9nZW5lcmF0aW9uIiwicGlja3MiOlsi55SwIiwi54GrIiwi5Lq6Il19LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImVuZ3JhdmUiLCJ0cmFjZSI6IuacrCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6InJpZ2h0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6InJpZ2h0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJlbmdyYXZlIiwidHJhY2UiOiLmnIgifSx7InR5cGUiOiJ3aW50ZXJfY2FydmUiLCJ0YWxseSI6IlQxLeacrCIsImFuc3dlciI6eyJtZXRob2QiOiJ6aGlzaGkiLCJiYXNlIjoi5pyoIiwicG9zaXRpb24iOiJib3R0b20ifX0seyJ0eXBlIjoid2ludGVyX2NhcnZlIiwidGFsbHkiOiJUMi3mnIgiLCJhbnN3ZXIiOnsibWV0aG9kIjoieGlhbmd4aW5nIiwicG9pbnRzIjpbImEiLCJiIiwiYyJdfX0seyJ0eXBlIjoid2ludGVyX2VuZCJ9XX0
```

走法（`--show` 的输出）：

```
 1. 1代 T01 选左 (faith+6)
 2. 1代 T02 选左 (food+8 faith-4)
 3. 1代 T03 刻 休 (faith-3 memory+3)
 4. 1代 T04 选左 (food-4 outsider+4)
 5. 1代 T05 选左 (food+4 outsider-8)
 6. 1代 C02 选右 (food-4 memory+6)
 7. 1代 C02 不刻
 8. 1代 C03 选右 (food+4 faith-6)
 9. 1代 C01 选左 (food+8 outsider-4)
10. 1代 C05 选右 (faith+4 outsider-4)
11. 1代 C06 选左 (food-8 memory+4)
12. 1代 C04 选左 (food+4 outsider-8)
13. 1代 C08 选右 (food+4 outsider-4)
14. 1代 C07 选左 (food+6 faith-4)
15. 1代 C07 不刻
16. 1代 C09 选右 (faith-6 memory+4)
17. 1代 C09 不刻
18. 1代 C10 选右 (food-4 outsider+4)
19. 1代 winter 冬夜刻 T1-休 (memory+6)
20. 1代 winter 天亮了
21. 1代 ended 先人
22. 1代 pick 挑字 休
23. 1代 pick 挑字 明
24. 1代 pick 挑字 本
25. 1代 pick 出发（休明本） (food-18 faith+13 memory-23 outsider+20)
26. 2代 C03 选左 (food-6 faith+8)
27. 2代 C01 选左 (food+8 outsider-4)
28. 2代 C02 选左 (faith+4 memory-4)
29. 2代 C06 选左 (food-8 memory+4)
30. 2代 C05 选左 (food-4 outsider+6)
31. 2代 C05 不刻
32. 2代 C04 选左 (food+4 outsider-8)
33. 2代 C07 选左 (food+6 faith-4)
34. 2代 C07 不刻
35. 2代 C08 选右 (food+4 outsider-4)
36. 2代 C09 选左 (faith+8)
37. 2代 C10 选右 (food-4 outsider+4)
38. 2代 winter 天亮了
39. 2代 ended 先人
40. 2代 pick 挑字 田
41. 2代 pick 挑字 火
42. 2代 pick 挑字 人
43. 2代 pick 出发（田火人） (faith-16 outsider+6)
44. 3代 C01 选右 (food-4 memory+6)
45. 3代 C02 选右 (food-4 memory+6)
46. 3代 C02 刻 本 (faith-3 memory+3)   ← G_ENGRAVE1 达成
47. 3代 C03 选右 (food+4 faith-6)
48. 3代 C04 选右 (food-6 outsider+6)
49. 3代 C05 选右 (faith+4 outsider-4)
50. 3代 C06 选左 (food-8 memory+4)
51. 3代 C07 选右 (food-4 memory+4)
52. 3代 C08 选右 (food+4 outsider-4)
53. 3代 C10 选左 (food-4 faith+4)
54. 3代 C09 选右 (faith-6 memory+4)
55. 3代 C09 刻 月 (faith-3 memory+3)
56. 3代 winter 冬夜刻 T1-本 (memory+6)
57. 3代 winter 冬夜刻 T2-月 (memory+6)
58. 3代 winter 天亮了
```

### 其余目标

| 目标 | 种子 | 打法 | 达成代 | 步数 | 代末四维 |
|---|---:|---|---:|---:|---|
| G_ENGRAVE1 | 0 | random | 3 | 58 | `{"food":28,"faith":40,"memory":92,"outsider":48}` |
| G_DROP1 | 1 | random | 1 | 19 | `{"food":58,"faith":45,"memory":65,"outsider":58}` |
| G_MEM_70 | 0 | greedy-memory | 1 | 19 | `{"food":22,"faith":52,"memory":80,"outsider":48}` |
| G_FAITH_65 | 0 | greedy-outsider | 1 | 18 | `{"food":16,"faith":68,"memory":56,"outsider":80}` |
| G_FOOD_65 | 0 | greedy-food | 3 | 51 | `{"food":76,"faith":54,"memory":46,"outsider":30}` |
| G_OUT_65 | 0 | greedy-outsider | 2 | 36 | `{"food":18,"faith":66,"memory":56,"outsider":70}` |

存档码（粘贴导入即复现）：

```
G_ENGRAVE1  ZZ1.1rpp75n.eyJ2IjoxLCJzZWVkIjowLCJhY3Rpb25zIjpbeyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImVuZ3JhdmUiLCJ0cmFjZSI6IuS8kSJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJza2lwX2VuZ3JhdmUifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6InNraXBfZW5ncmF2ZSJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6InNraXBfZW5ncmF2ZSJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6IndpbnRlcl9jYXJ2ZSIsInRhbGx5IjoiVDEt5LyRIiwiYW5zd2VyIjp7Im1ldGhvZCI6Imh1aXlpIiwiY29tcG9uZW50cyI6WyLkuroiLCLmnKgiXX19LHsidHlwZSI6IndpbnRlcl9lbmQifSx7InR5cGUiOiJoZWlyIn0seyJ0eXBlIjoicGlja190b2dnbGUiLCJjaGFyIjoi5LyRIn0seyJ0eXBlIjoicGlja190b2dnbGUiLCJjaGFyIjoi5piOIn0seyJ0eXBlIjoicGlja190b2dnbGUiLCJjaGFyIjoi5pysIn0seyJ0eXBlIjoiYmVnaW5fZ2VuZXJhdGlvbiIsInBpY2tzIjpbIuS8kSIsIuaYjiIsIuacrCJdfSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoic2tpcF9lbmdyYXZlIn0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6InNraXBfZW5ncmF2ZSJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6InJpZ2h0In0seyJ0eXBlIjoid2ludGVyX2VuZCJ9LHsidHlwZSI6ImhlaXIifSx7InR5cGUiOiJwaWNrX3RvZ2dsZSIsImNoYXIiOiLnlLAifSx7InR5cGUiOiJwaWNrX3RvZ2dsZSIsImNoYXIiOiLngasifSx7InR5cGUiOiJwaWNrX3RvZ2dsZSIsImNoYXIiOiLkuroifSx7InR5cGUiOiJiZWdpbl9nZW5lcmF0aW9uIiwicGlja3MiOlsi55SwIiwi54GrIiwi5Lq6Il19LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImVuZ3JhdmUiLCJ0cmFjZSI6IuacrCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6InJpZ2h0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6InJpZ2h0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJlbmdyYXZlIiwidHJhY2UiOiLmnIgifSx7InR5cGUiOiJ3aW50ZXJfY2FydmUiLCJ0YWxseSI6IlQxLeacrCIsImFuc3dlciI6eyJtZXRob2QiOiJ6aGlzaGkiLCJiYXNlIjoi5pyoIiwicG9zaXRpb24iOiJib3R0b20ifX0seyJ0eXBlIjoid2ludGVyX2NhcnZlIiwidGFsbHkiOiJUMi3mnIgiLCJhbnN3ZXIiOnsibWV0aG9kIjoieGlhbmd4aW5nIiwicG9pbnRzIjpbImEiLCJiIiwiYyJdfX0seyJ0eXBlIjoid2ludGVyX2VuZCJ9XX0
G_DROP1  ZZ1.g04zlz.eyJ2IjoxLCJzZWVkIjoxLCJhY3Rpb25zIjpbeyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6InJpZ2h0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJlbmdyYXZlIiwidHJhY2UiOiLkvJEifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImRyb3AiLCJzbG90IjowfSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoic2tpcF9lbmdyYXZlIn0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJza2lwX2VuZ3JhdmUifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6IndpbnRlcl9jYXJ2ZSIsInRhbGx5IjoiVDEt5LyRIiwiYW5zd2VyIjp7Im1ldGhvZCI6Imh1aXlpIiwiY29tcG9uZW50cyI6WyLkuroiLCLmnKgiXX19LHsidHlwZSI6IndpbnRlcl9lbmQifV19
G_MEM_70  ZZ1.102dxea.eyJ2IjoxLCJzZWVkIjowLCJhY3Rpb25zIjpbeyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6InJpZ2h0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJza2lwX2VuZ3JhdmUifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6InJpZ2h0In0seyJ0eXBlIjoic2tpcF9lbmdyYXZlIn0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6InNraXBfZW5ncmF2ZSJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6InNraXBfZW5ncmF2ZSJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoid2ludGVyX2VuZCJ9XX0
G_FAITH_65  ZZ1.1l73l3v.eyJ2IjoxLCJzZWVkIjowLCJhY3Rpb25zIjpbeyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6InNraXBfZW5ncmF2ZSJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6InJpZ2h0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoic2tpcF9lbmdyYXZlIn0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoic2tpcF9lbmdyYXZlIn0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJ3aW50ZXJfZW5kIn1dfQ
G_FOOD_65  ZZ1.f0mqr4.eyJ2IjoxLCJzZWVkIjowLCJhY3Rpb25zIjpbeyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6InNraXBfZW5ncmF2ZSJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6InJpZ2h0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJza2lwX2VuZ3JhdmUifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoid2ludGVyX2VuZCJ9LHsidHlwZSI6ImhlaXIifSx7InR5cGUiOiJwaWNrX3RvZ2dsZSIsImNoYXIiOiLmsLQifSx7InR5cGUiOiJwaWNrX3RvZ2dsZSIsImNoYXIiOiLngasifSx7InR5cGUiOiJwaWNrX3RvZ2dsZSIsImNoYXIiOiLml6UifSx7InR5cGUiOiJiZWdpbl9nZW5lcmF0aW9uIiwicGlja3MiOlsi5rC0Iiwi54GrIiwi5pelIl19LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoic2tpcF9lbmdyYXZlIn0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6InJpZ2h0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6IndpbnRlcl9lbmQifSx7InR5cGUiOiJoZWlyIn0seyJ0eXBlIjoicGlja190b2dnbGUiLCJjaGFyIjoi5rC0In0seyJ0eXBlIjoicGlja190b2dnbGUiLCJjaGFyIjoi54GrIn0seyJ0eXBlIjoicGlja190b2dnbGUiLCJjaGFyIjoi5pelIn0seyJ0eXBlIjoiYmVnaW5fZ2VuZXJhdGlvbiIsInBpY2tzIjpbIuawtCIsIueBqyIsIuaXpSJdfSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6InJpZ2h0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6InNraXBfZW5ncmF2ZSJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJ3aW50ZXJfZW5kIn1dfQ
G_OUT_65  ZZ1.bed4q9.eyJ2IjoxLCJzZWVkIjowLCJhY3Rpb25zIjpbeyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6InNraXBfZW5ncmF2ZSJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6InJpZ2h0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJyaWdodCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoic2tpcF9lbmdyYXZlIn0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoic2tpcF9lbmdyYXZlIn0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJ3aW50ZXJfZW5kIn0seyJ0eXBlIjoiaGVpciJ9LHsidHlwZSI6InBpY2tfdG9nZ2xlIiwiY2hhciI6IuawtCJ9LHsidHlwZSI6InBpY2tfdG9nZ2xlIiwiY2hhciI6IueBqyJ9LHsidHlwZSI6InBpY2tfdG9nZ2xlIiwiY2hhciI6IuaXpSJ9LHsidHlwZSI6ImJlZ2luX2dlbmVyYXRpb24iLCJwaWNrcyI6WyLmsLQiLCLngasiLCLml6UiXX0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJza2lwX2VuZ3JhdmUifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoibGVmdCJ9LHsidHlwZSI6InNraXBfZW5ncmF2ZSJ9LHsidHlwZSI6ImNob29zZSIsInNpZGUiOiJsZWZ0In0seyJ0eXBlIjoiY2hvb3NlIiwic2lkZSI6ImxlZnQifSx7InR5cGUiOiJjaG9vc2UiLCJzaWRlIjoicmlnaHQifSx7InR5cGUiOiJ3aW50ZXJfZW5kIn1dfQ
```

## 五、`G_ENGRAVE1`（已修复）

**现象（修复前）**：40,000 代里 **抽到 0 次**——第 1 代固定目标按设计排除了它（`generation1_goals` 只含落字/记/信，因为教学已强制刻一次），第 2 代起的池又被 `generation1_exclude` 一并排除，成了「死目标」。

**修复**：`goalIdsForGeneration` 只在第 1 代用固定集（`generation1_goals`，本就不含它）；第 2 代起的池**不再套用** `generation1_exclude`，全 6 个目标都可抽。`data/goals.json` 的字段与目标设计未动（`generation1_exclude` 仍是「第 1 代排除」的声明）。

**修复后实测**（`--seeds 2000 --gens 4`）：`G_ENGRAVE1` 抽到 **15145** 次、达成 **2064** 次（13.6%）；`greedy-*` 打法刻意不刻字所以 0 达成，`random` 打法 2064/3029。可复现达成（种子 `0`、第 2 代起进池、第 3 代达成、存档码与走法见 §四）。

**回归单测**：`tests/engine.test.mjs` 的「G_ENGRAVE1 excluded only from gen 1, eligible for the gen>=2 pool」——第 1 代恒为固定集且永不含它；直接抽 + 真实多代流程（`begin_generation` 演化种子）里第 2/3 代必须能抽到它。

调试参数仍可把它单独塞进来验（不改变正常玩法）：`/?debug=1&debug_goal=G_ENGRAVE1`。

## 六、复现命令

```bash
# 总表 + 分打法表（默认 2000 种子 × 4 代 × 5 打法）
node tools/goal_sweep.mjs
# 只跑 300 种子 / 换 5 代
node tools/goal_sweep.mjs --seeds 300 --gens 5
# 某个目标的「种子 + 存档码 + 人话走法」，末尾带重放校验（须为「达成 ✓」）
node tools/goal_sweep.mjs --show G_FOOD_65
node tools/goal_sweep.mjs --show G_OUT_65
node tools/goal_sweep.mjs --show G_ENGRAVE1
# 机器可读结果
node tools/goal_sweep.mjs --json
```

网页侧（debug 参数）：`/?debug=1&debug_goal=G_FOOD_65&seed=0`。
