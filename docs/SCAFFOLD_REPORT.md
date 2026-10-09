# 造字人 v1.1.1 — 脚手架报告

日期：2026-10-10 ｜ 分支：`feat/v1.1.1-ui` ｜ 工作树：`/workspace/tmp/zaozi`

本报告如实记录：这次做了什么、在本机验证到了哪一步、**哪些没验证**、以及与 SPEC 的偏差。

---

## 1. 结论先说

- **纯逻辑（字形数据 / 演变条 / 字录 / 文案 / 设计 token）已实现并在本机编译通过 + 1798 条断言全过。**
- **界面层（`index.cj` + `ui_*.cj`）只做了逐文件语法检查，没有类型检查、没有编译、没有跑过。**
- **整个工程从未在 DevEco Studio 或 ohos SDK 上编译过。** 本机只有裸 Linux 仓颉 SDK 1.1.3，
  `kit.ArkUI` / `ohos.*` 一律不可用。

---

## 2. 文件树

（`glyph/` 下 106 个字形文件只列一行，完整清单见
`entry/src/main/resources/rawfile/glyph/glyph_pack_v1.csv`。）

```
.
├── AppScope/
│   ├── app.json5                          # bundleName com.spockwen.zaozi / vendor spockwen
│   └── resources/base/
│       ├── element/string.json            # app_name 造字人 等
│       └── media/app_icon.png             # 占位图标（抄自 yilu-bios）
├── build-profile.json5                    # compatibleSdkVersion 6.1.1(24), runtimeOS HarmonyOS
├── oh-package.json5                       # 依赖为空（靠 DevEco 的 hvigorw.js 解析插件）
├── hvigorfile.ts                          # import { appTasks } from '@ohos/cangjie-build-support'
├── hvigor/hvigor-config.json5             # daemon: true（命令行构建需 --no-daemon）
├── .gitignore
├── README.md                              # 中文：是什么 / 树 / 同步字形 / 编译 / 版权 / 已知缺口
├── docs/
│   ├── COMPILE.md                         # DevEco on Mac + 命令行 hvigorw + 排错
│   └── SCAFFOLD_REPORT.md                 # 本文件
├── entry/
│   ├── build-profile.json5                # cangjieOptions.path = ./cjpm.toml, abiFilters
│   ├── cjpm.toml                          # 包名 ohos_app_cangjie_entry, cjc-version 1.1.3
│   ├── hvigorfile.ts                      # import { hapTasks } from '@ohos/cangjie-build-support'
│   ├── oh-package.json5
│   └── src/main/
│       ├── cangjie/                       # 15 个 .cj，共 2486 行
│       │   ├── ability_stage.cj           # 能力框架
│       │   ├── main_ability.cj            # 能力框架
│       │   ├── resource_helper.cj         # __GenerateResource__ 兼容 shim
│       │   ├── glyph_data.cj              # GENERATED，250 行：106 行 GlyphRow + GlyphCatalog
│       │   ├── glyph_res.cj               # GENERATED，130 行：106 个 @rawfile case
│       │   ├── theme.cj                   # 设计 token（不 import kit，可本机编译）
│       │   ├── evo_model.cj               # 演变条纯逻辑
│       │   ├── copy_text.cj               # 文案表
│       │   ├── zilu_model.cj              # 字录纯逻辑
│       │   ├── index.cj                   # @Entry 主界面 + 三段切换   ← 界面
│       │   ├── ui_common.cj               # 共用小组件              ← 界面
│       │   ├── ui_card.cj                 # 界面 1 造字卡           ← 界面
│       │   ├── ui_strip.cj                # 界面 2 演变条           ← 界面
│       │   ├── ui_zilu.cj                 # 界面 3 字录详情         ← 界面
│       │   └── ui_zilu_pop.cj             # 界面 3 放大卡弹层       ← 界面
│       ├── module.json5                   # stage 模型，phone，srcEntry/skills 齐
│       └── resources/
│           ├── base/element/{color,string}.json
│           └── rawfile/glyph/
│               ├── glyph_pack_v1.csv      # 106 行原始数据（出处/许可/sha1/credit_note）
│               ├── MANIFEST.json          # 归一化文件 sha1 清单
│               └── … 106 个 <id>_<stage>.<svg|png>
└── tools/
    ├── gen_glyph_catalog.py               # CSV → glyph_data.cj + glyph_res.cj
    ├── sync_glyphs.py                     # 同步字形 + 校验 + 重新生成
    ├── unify_frame.py                     # 归一化画框（300×300 / 86%）
    ├── verify_sha1.py                     # 按 .sha1 清单校验字形包
    └── box_check/
        ├── cjpm.toml                      # 本机校验工程（output-type executable）
        ├── sync.sh                        # 只同步 5 个纯逻辑 .cj
        ├── main.cj                        # 断言驱动
        └── parse_check.sh                 # 逐文件 parser + 整包类型检查
```

`tools/box_check/src/`、`tools/box_check/target/`、`tools/box_check/cjpm.lock`、`tools/__pycache__/`
都是本机生成物，已在 `.gitignore` 里；报告写成时已删除。

---

## 3. box_check 跑的结果

命令（完整输出：`/workspace/zaozi-smoke/box_check_run.log`）：

```bash
source /home/box/.cangjie-sdk/6.1/cangjie/envsetup.sh
cd tools/box_check && ./sync.sh && cjpm build && cjpm run
```

`cjpm build success`，`cjpm run` 退出码 0，**9 组断言全部 PASS，共 1798 条**：

| 组 | 断言数 | 内容 |
|---|---|---|
| catalog | 877 | 106 行 / 27 字、asset 后缀与非空、sha1 40 位、每字 3 或 4 阶段、order 从 1 起且严格递增、asset 唯一、查无此 asset 返回 −1 |
| ben-mo | 24 | `本`/`末` 各 3 行且首行是 `bronze`；演变条 4 格、第 1 格 金文/商周、末格 繁简同形 且不写时代；M 档 56/6/304，实际占宽 242 < 304 |
| xiu | 59 | 5 格 M 档 56/6/304，`usedWidth() == 304` 正好铺满；阶段名与时代逐格比对；白话每行 ≤5 字（按**码点**数，不是字节）；前 4 格是古字形且有 asset，末格显示「休」；method 会意；隶书出处与 CC0 1.0 |
| cong | 18 | 6 格 S 档 46/5/301，`usedWidth() == 301`；繁体「從」/简体「从」分两格且都不写时代；前 4 格有 asset |
| card-tier | 8 | 卡面档 C 48/14/296 且 5 格正好 296；字录详情档 M 304 |
| empty-rule | 735 | 27 个字逐个：格数 = 古字形数 + 繁简格数、≤6 格、古字形格 asset 非空且在表里、今天的字不带 asset、格子从左对齐、阶段名白名单、阶段顺序是规范顺序的连续前缀 |
| zilu | 43 | 分页计数 8/7/1/0、27 格、未知 17、已造 8 / 有事签 1 / 残片 1、只有一格选中且是「休」、未知格无字 |
| copy | 20 | 休/水/本/从 白话逐行比对、日 无白话、休 的字义/典籍出处/小故事/3 条效果、水 无典籍无字义、公式两个部件 / 描迹 / 指事、事签与弹层标题 |
| tokens | 14 | 色板关键值、C/M/S 三档 48-14 / 56-6 / 46-5、轨道 296/304/301、放大卡 188/144、字录格 60/9/5、`splitStageLabel` 拆「隶书 · 西汉」 |

修掉的编译错误（都是仓颉 1.1.3 上的真实 API 问题，不是逻辑问题）：

| 问题 | 原因 | 修法 |
|---|---|---|
| `package 'ohos_app_cangjie_entry' imports root package ... outputType executable` | `main.cj` 里 `import ohos_app_cangjie_entry.*` 自己 import 自己；cjpm 编译 executable 时根包不是 lib，不允许自引用 | 删掉该 import（同包文件本来就不用 import），并在注释里写明原因 |
| `invalid binary operator '==' on type 'Enum-EvoTier'/'Enum-EvoCellKind'/'Enum-ZiluCellState'` | **仓颉的 enum 没有默认 `==` 运算符** | 加谓词 `EvoStrip.isTier()` / `EvoCell.kindIs()` / `ZiluGridCell.stateIs()`，内部用 `match`；原有公开 API 与签名不变 |
| `'at' is not a member of class 'ArrayList<T>'` / `'set' is not a member of ...` | 仓颉 1.1.3 的 `ArrayList` 用下标 `[]`，没有 `at()` / `set()` | 全部改成 `arr[i]` 读、`arr[i] = v` 写（`glyph_data.cj` / `evo_model.cj` / `zilu_model.cj` 共 14 处） |

> 这两个 API 事实（enum 无 `==`、`ArrayList` 无 `at`/`set`）也回头修进了
> `tools/gen_glyph_catalog.py`，否则重新生成 `glyph_data.cj` 会把 bug 带回来。

修掉的断言自身 bug（不是模型 bug）：

| 现象 | 原因 | 修法 |
|---|---|---|
| 「第 N 格白话每行 ≤5 字」9 条 FAIL | 断言用 `String.size`，仓颉里这是**字节数**，一个汉字 3 字节，「一人背靠」= 12 | 加 `utf8Len()` 数字码点（跳过 UTF-8 续字节 `10xxxxxx`） |
| 「ben/mo 第 k 个阶段是 oracle」6 条 FAIL | 断言拿 `["oracle","bronze","seal","clerical"]` 逐位比，但 `本`/`末` 没有甲骨文那一格 | 改成「rows 是规范顺序的一个连续前缀」，先定位起始下标再逐位比 |

字形资源侧（`python3 tools/sync_glyphs.py` + `python3 tools/verify_sha1.py`）：

```
CSV 行数：106（期望 106）
字形图：拷贝 106 / 期望 106（normalized/ 实有 109 个文件）
glyph_catalog: 106 行 → entry/src/main/cangjie/glyph_data.cj（250 行 Cangjie）
glyph_res: 106 个 @rawfile case → entry/src/main/cangjie/glyph_res.cj（130 行 Cangjie）
OK: glyph 同步完成
verify_sha1: entries=106 ok=106 fail=0 csv_rows=106 csv_disagree=0 → RESULT: 106/106 PASS
```

额外做的交叉核对（脚本外，python 一次性）：`glyph_res.cj` 里 106 个 case 的分支条件与
`@rawfile` 实参**逐个相同**；106 个 asset **全部**在 `resources/rawfile/glyph/` 下有对应文件；
磁盘上的 106 个字形文件与 catalog **完全一致**（无多余、无缺失）。

---

## 4. parse_check 跑的结果

命令（完整输出：`/workspace/zaozi-smoke/parse_check_run.log`）：

```bash
bash tools/box_check/parse_check.sh
```

```
趟 A：逐文件 parser（15 个文件）
  OK  ability_stage.cj / copy_text.cj / evo_model.cj / glyph_data.cj / glyph_res.cj
  OK  index.cj / main_ability.cj / resource_helper.cj / theme.cj
  OK  ui_card.cj / ui_common.cj / ui_strip.cj / ui_zilu.cj / ui_zilu_pop.cj / zilu_model.cj
  通过 15 / 15，失败 0
趟 B：整包类型检查（5 个纯逻辑文件）→ PASS（0 error）
PARSE CHECK RESULT: PASS
```

### 这个检查是怎么做的

`cjc` 没有 `--parse-only` / `--dump-tokens`（`cjc --help` 里只有 `--dump-ast` / `--dump-chir` /
`--dump-ir`）。但有一个可利用的性质：**cjc 先跑 parser，parser 失败就不会往下做 import 解析
和语义分析**。所以把「本机环境造成」的错误剔掉之后，剩下的 error 就是这个文件自己的
词法/语法错误。

剔掉的三类（`tools/box_check/parse_check.sh` 的 `is_ignorable()`）：

1. `can not find package '<pkg>'` —— 本机没有 ohos SDK。实际缺的 6 个：
   `kit.ArkUI`、`kit.AbilityKit`、`ohos.arkui.state_macro_manage`、`ohos.state_macro_manage`、
   `ohos.resource`、`ohos.window`。
2. `'main' is missing` —— 单文件编译没有入口函数。
3. `undeclared identifier '<x>'` —— 单文件看不到同包其它文件里的符号（例如
   `evo_model.cj` 用到的 `Theme`、`zilu_model.cj` 用到的 `GlyphCatalog`）。
   这一类由趟 B 兜住。

趟 B 把 5 个不 import kit/ohos 的文件**一次性**交给 `cjc`，让语义分析真的跑起来，
输出 0 error（除了可忽略的 `'main' is missing`）。这与 `cjpm build` 互为交叉验证。

**负向测试**（确认这个检查真的能报错，不是永远 PASS）：故意写了一个未终止字符串的
`broken.cj`，脚本输出 `FAIL entry/src/main/cangjie/broken.cj - unterminated single-line string`，
退出码 1。

### 它证明了什么

- 15 个 `.cj` 文件的**词法 / 语法正确**：括号、字符串、`func`/`class`/`enum`/`let`/`var`
  声明、泛型、`match`  arms、模板字符串 `${...}` 都能过仓颉 1.1.3 的 parser。
- 5 个纯逻辑文件**类型正确**（趟 B）。

### 它没有证明什么（重要）

- **`@Entry` / `@Component` / `@State` / `@Prop` / `@Builder` / `@r` / `@rawfile` 这些宏
  没有被展开、没有被校验。** 它们在 `kit.ArkUI` / `ohos.state_macro_manage` 里定义，
  本机 import 就失败了，宏展开根本不会发生。语法对了不等于宏用对了。
- **`kit.ArkUI` 的类型、属性、事件签名没有校验。** `ui_*.cj` 里每一个
  `.width()` / `.backgroundColor()` / `.onClick()` 调用，属性名和参数类型是否真的存在，
  本机一概查不了。
- **`ohos.resource.AppResource`、`ohos.window`、`kit.AbilityKit` 的类型没有校验。**
- **整个包没有链接过**，没有生成过 HAP，没有装到过设备，没有运行过。
- 趟 A 是逐文件跑的，**跨文件的一致性没验**（例如界面调 `glyphResource(cell.asset)` 时
  实参类型是否匹配 `String`、`EvoStrip` 的字段名是否和界面里写的一致）。这些里的一部分
  由 `cjpm build` 间接覆盖（5 个纯逻辑文件之间），但**界面 ↔ 纯逻辑之间没有**。

---

## 5. 没验证的条目（汇总）

| # | 条目 | 为什么没验 | 怎么验 |
|---|---|---|---|
| 1 | 全部 `kit.ArkUI` 代码能否编译 | 本机无 ohos SDK | DevEco Sync + Run，或命令行 `hvigorw ... assembleHap` |
| 2 | `@Entry`/`@Component`/`@State`/`@Prop`/`@Builder` 宏展开是否正确 | 宏定义在 kit 里，本机不可用 | 同上 |
| 3 | `@r(app.media.x)` / `@rawfile("glyph/...")` 能否解析到资源 | 宏 + 资源表都需要 SDK | 同上；跑起来看图是否显示 |
| 4 | 106 个 SVG/PNG 能否被 ArkUI 正确加载 | 需要运行时 | 真机/模拟器逐屏看 |
| 5 | SVG 上刻痕色（`fillColor` / `colorFilter`）是否生效 | 需要运行时 | 真机看骨牌上的字形颜色 |
| 6 | 界面布局是否和设计稿一致（尺寸、圆角、间距、断行） | 没有渲染过 | 对照 `card_zaozi_v1.png` / `zilu_detail_v1.png` / `evo_strip_v1.png` 逐屏比对 |
| 7 | 字体：Noto Serif CJK SC/TC 未内置 | 包体原因，本版故意不做 | 之后 `font.registerFont` 注册再比对 |
| 8 | 骨牌不均匀圆角（per-corner `borderRadius`）在真机上是否平滑 | 需要运行时 | 真机看 |
| 9 | 签名 / 出包 | 没跑过 hvigorw | `docs/COMPILE.md` §2、§3 |
| 10 | 自动签名配置 | `build-profile.json5` 的 `signingConfigs` 还是空数组 | DevEco 里勾 Automatically generate signature 后由 IDE 写入 |

---

## 6. 与 SPEC 的偏差

### 6.1 有意的实现选择（SPEC 明确允许）

| SPEC | 做法 |
|---|---|
| §7.3 允许不做笔画生长动画 | 造字卡的阶段推进用 `animateTo` + `opacity` 淡入 / 底部上移，没有笔画生长 |
| 屏幕数量：允许用顶部三段切换器做首版 | 一个 `@Entry` + `TopSwitcher`（造字 / 演变条 / 字录），没有做多页面路由 |
| 字体太大不内置 | `Theme.serif` / `serifTC` 暂用系统 `"serif"`、`sans` 用 `"sans-serif"`，TODO 已写在 `theme.cj` 第 40–47 行 |
| 骨牌不均匀圆角 | ArkUI 只有统一的 `borderRadius`，用 per-corner 近似，真机效果未验（见 §5 第 8 条） |
| 玩法数值是版式占位 | 代次、记忆、骨片数全部按 SPEC 说明只排版式，没有游戏逻辑 |
| 正式包去掉「设计稿，非玩法示意」条 | 没有渲染该 banner/badge |

### 6.2 SPEC 与数据之间的既有差异（不是这次改的，照实记录）

- **`本` / `末` 没有甲骨文那一格。** 字形包里这两个字只有 金文/小篆/隶书 三个阶段，
  所以演变条是 4 格（3 古字形 + 繁简同形）而不是 5 格。这是 SPEC §5「空格规则」的正常情形，
  断言已按此写。
- **`从` 的隶书阶段年代是「秦」而 `休` 是「西汉」。** 数据里 `cong_clerical` 出自睡虎地秦简，
  `xiu_clerical` 出自西汉老子甲本。时代行直接取 CSV 的 `stage_label`，没有统一。

### 6.3 与 SPEC 用词不一致的地方

- CSV 的 `char` 列在 `glyph_data.cj` 里叫 `glyph`（`char` 与仓颉关键字冲突）。字段含义未变。
- `glyph_res.cj` 的兜底分支 `case _` 返回第一条资源 `glyph/shui_oracle.svg`。
  SPEC 没规定取不到资源时怎么办，这里选「不崩、显示第一个字形」。

---

## 7. 这次改动清单

**修 bug（保持公开 API 与签名不变）**

- `entry/src/main/cangjie/evo_model.cj`、`zilu_model.cj`、`glyph_data.cj`：
  `ArrayList.at()/set()` → 下标 `[]`；enum `==` → `match` 谓词。
  新增（纯追加，不改原有签名）：`EvoStrip.isTier()`、`EvoCell.kindIs()`、
  `ZiluGridCell.stateIs()`。
- `tools/box_check/main.cj`：删掉自引用 import；断言改用码点数、阶段顺序改连续前缀。
- `tools/gen_glyph_catalog.py`：生成下标语法（否则重新生成会把上面的 bug 带回来）；
  新增 `--res-out`，同时生成 `glyph_res.cj`。
- `tools/sync_glyphs.py`：重新生成时带上 `glyph_res.cj`。
- `tools/verify_sha1.py`：默认包路径从「脚本所在目录」改成 `/workspace/zaozi-smoke/glyphs`，
  否则不带参数跑必然 FileNotFoundError。

**新增**

- `entry/src/main/cangjie/glyph_res.cj`（生成文件）：`glyphResource(asset: String): AppResource`，
  106 个字面量 case + 兜底。**没有改名字和签名**，界面按 `glyphResource(cell.asset)` 调用。
- `tools/box_check/parse_check.sh`：趟 A 逐文件 parser + 趟 B 整包类型检查，退出码可用。
- `README.md`、`docs/COMPILE.md`、`docs/SCAFFOLD_REPORT.md`。
- `.gitignore` 增加 `__pycache__/`、`*.py[cod]`、`tools/__pycache__/`、`hvigorw`、`hvigorw.js`。

**未触碰**

`entry/src/main/cangjie/index.cj` 与 `ui_*.cj` 一个字都没改——那两个文件由并行的界面任务负责，
本次只对它们跑只读的语法检查。

---

## 8. 下一步（按优先级）

1. 在 Mac 上用 DevEco 6.1 打开，Sync + Run，把 §5 第 1、2、3 条一次解决。
2. 逐屏对照三张设计稿 PNG（§5 第 6 条）。
3. 字形显示与 SVG 上色（§5 第 4、5 条）。
4. 注册 Noto Serif CJK 字体（§5 第 7 条）。
5. 之后再做玩法逻辑、存档、多字流程。
