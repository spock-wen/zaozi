# 造字人（zaozi）

HarmonyOS 上的仓颉（Cangjie）+ ArkUI 二维「造字」小游戏，锁定设计稿版本 **v1.1.1**。
本仓库是它的**脚手架 + 纯逻辑实现**：字形数据、演变条/字录/文案的全部计算逻辑已经写好并在
本机验证过；界面层由 ArkUI 写成，**尚未在 DevEco + ohos SDK 上编译过**（见「已知缺口」）。

## 这是什么

- 三块界面（一个 `@Entry` + 顶部三段切换）：
  1. **造字卡** —— 冬夜背景、骨牌、事签、阶段依次推进、点一下跳过、成字弹层；
  2. **演变条** —— `EvoStrip`，按 SPEC §5 的 C/M/S 三档自动选档、空格规则、繁简合并；
  3. **字录详情** —— 27 格总览 + 单个字的详情卡（字义/典籍/演变/小故事/效果）。
- 字形资源 106 个（27 个字 × 甲骨文/金文/小篆/隶书），来自 Wikimedia Commons 与小学堂，
  统一成 300×300、最长墨边 86%、居中的显示文件后放进 `resources/rawfile/glyph/`。

## 目录树

```
.
├── AppScope/                          # 应用级配置与资源
│   ├── app.json5                      #   bundleName com.spockwen.zaozi / vendor spockwen
│   └── resources/base/{element,media} #   app_name 造字人、app_icon（占位图标）
├── build-profile.json5                # 应用构建配置，compatibleSdkVersion 6.1.1(24)
├── oh-package.json5
├── hvigorfile.ts                      # import { appTasks } from '@ohos/cangjie-build-support'
├── hvigor/hvigor-config.json5
├── entry/
│   ├── build-profile.json5            # cangjieOptions.path = ./cjpm.toml
│   ├── cjpm.toml                      # 仓颉包配置，包名 ohos_app_cangjie_entry
│   ├── hvigorfile.ts                  # import { hapTasks } from '@ohos/cangjie-build-support'
│   ├── oh-package.json5
│   └── src/main/
│       ├── cangjie/
│       │   ├── ability_stage.cj       # MyAbilityStage（@Entry 之前的能力框架）
│       │   ├── main_ability.cj        # MainAbility / EntryAbility
│       │   ├── resource_helper.cj     # __GenerateResource__ 兼容 shim
│       │   ├── glyph_data.cj          # GENERATED：106 行 GlyphRow + GlyphCatalog
│       │   ├── glyph_res.cj           # GENERATED：glyphResource() 的 @rawfile 映射
│       │   ├── theme.cj               # 设计 token（色板 / 字号 / 演变条尺寸）
│       │   ├── evo_model.cj           # 演变条纯逻辑：空格规则、繁简合并、选档
│       │   ├── copy_text.cj           # 文案表：白话行、事签、字义、典籍、小故事
│       │   ├── zilu_model.cj          # 字录纯逻辑：27 格、四种状态、分页计数
│       │   ├── index.cj               # @Entry 主界面 + 三段切换
│       │   ├── ui_common.cj           # 共用小组件（切换器、胶囊、按钮…）
│       │   ├── ui_card.cj             # 界面 1：造字卡
│       │   ├── ui_strip.cj            # 界面 2：演变条
│       │   ├── ui_zilu.cj             # 界面 3：字录详情
│       │   └── ui_zilu_pop.cj         # 界面 3：古字形放大卡弹层
│       ├── module.json5
│       └── resources/
│           ├── base/{element,media}
│           └── rawfile/glyph/
│               ├── glyph_pack_v1.csv  # 106 行原始数据（含出处、许可、sha1）
│               ├── MANIFEST.json      # 归一化文件的 sha1 清单
│               └── <id>_<stage>.<svg|png>   # 106 个显示用字形
├── tools/
│   ├── gen_glyph_catalog.py           # CSV → glyph_data.cj + glyph_res.cj
│   ├── sync_glyphs.py                 # 同步字形资源并重新生成上面两个文件
│   ├── unify_frame.py                 # 把原始字形统一成 300×300 / 86% 画框
│   ├── verify_sha1.py                 # 按 glyph_pack_v1.sha1 校验字形包
│   └── box_check/
│       ├── cjpm.toml                  # 本机（无 ohos SDK）校验工程
│       ├── sync.sh                    # 只同步纯逻辑 .cj 进校验工程
│       ├── main.cj                    # 2931 条断言的驱动
│       └── parse_check.sh             # 逐文件 cjc parser + 整包类型检查
├── README.md
└── docs/
    ├── COMPILE.md                     # DevEco / 命令行编译步骤
    ├── SCAFFOLD_REPORT.md             # 脚手架报告：做了什么、验到什么、没验什么
    └── VERIFY_指事徽标.md             # DEBUG ONLY 种子：怎么打验证包看指事徽标
```

## 同步字形资源

字形来自 GLYPH_PACK_V1，本仓库只放**归一化后的显示文件**。改 CSV 或换一批字形后：

```bash
python3 tools/sync_glyphs.py                     # 默认包 /workspace/zaozi-smoke/glyphs
python3 tools/sync_glyphs.py --bundle /path/to/glyphs
```

它会做：拷 CSV 与 MANIFEST → 校验 106 行、(id, stage) 不重复、每行 `path` 恰好对应一个
归一化文件、逐个比对 sha1 → 重新生成 `glyph_data.cj` 与 `glyph_res.cj`。
任何一项不过就退出非 0。归一化文件缺失时仍然生成 catalog，只打 WARNING。

```bash
python3 tools/verify_sha1.py        # 单独校验字形包 sha1，106/106 才算过
python3 tools/unify_frame.py --help # 重新归一化（改画框规则时用）
```

> `glyph_data.cj` 与 `glyph_res.cj` 是**生成文件**，头部有 GENERATED 标记，不要手改。

## 在本机校验（不需要 ohos SDK）

```bash
# 1. 纯逻辑：编译 + 2931 条断言
source /home/box/.cangjie-sdk/6.1/cangjie/envsetup.sh
cd tools/box_check && ./sync.sh && cjpm build && cjpm run

# 2. 语法 / 类型：逐文件 parser + 整包类型检查
bash tools/box_check/parse_check.sh
```

第 1 项查的是：106 行 / 27 字、`本` `末` 只有 3 格且从金文起、`休` 5 格 M 档正好铺满 304、
`从` 6 格 S 档正好 301、没有一格 asset 为空、阶段名白名单、时代行、字录 8/7/1/0 与 27 格
四种状态、文案逐字比对、token 数值、M2 一代闭环（挑字 / 选卡 / 字匣 / 落字 / 结算）、
第 2 代起的事签格（只挑 2 个字）、事件卡高度放不放得下落字条、按已造列表现算的计数文案。
第 2 项只能证明**语法正确**，详见 `docs/SCAFFOLD_REPORT.md`。

## 在 DevEco Studio（Mac）上编译

完整步骤见 [`docs/COMPILE.md`](docs/COMPILE.md)。摘要：

1. 用 **DevEco Studio 6.1**（含仓颉插件）打开本仓库根目录；
2. **File → Sync**（会装 oh_modules、建 hvigor 缓存链接）；
3. 模块选 **entry**，API **24**（compatibleSdkVersion `6.1.1(24)`）；
4. **File → Project Structure → Signing Configs** 里勾 **Automatically generate signature**；
5. 连真机或模拟器，点 **Run**。

命令行等价物：

```bash
export DEVECO_SDK_HOME="$HOME/Applications/DevEco-Studio.app/Contents/sdk"
export DEVECO_CANGJIE_PATH="$HOME/.cangjie-sdk/6.1/cangjie"
export DEVECO_CANGJIE_PLUGIN_ENABLED=true
ln -sf "$DEVECO_SDK_HOME/../tools/hvigor/bin/hvigorw"   hvigorw
ln -sf "$DEVECO_SDK_HOME/../tools/hvigor/bin/hvigorw.js" hvigorw.js
printf 'sdk.dir=%s/default\nhwsdk.dir=%s/default\n' "$DEVECO_SDK_HOME" "$DEVECO_SDK_HOME" > local.properties
./hvigorw --mode module -p module=entry@default -p product=default -p buildMode=debug assembleHap --no-daemon
```

产物：`entry/build/default/outputs/default/entry-default-unsigned.hap`。

## 版权与致谢

字形分两个来源，许可与出处都逐行记在 `entry/src/main/resources/rawfile/glyph/glyph_pack_v1.csv`
的 `source` / `license` / `commons_page` / `credit_note` 列里，界面按行渲染：

| 来源 | 许可 | 说明 |
|---|---|---|
| Wikimedia Commons | 公有领域 | 甲骨文/金文/小篆/隶书，多为公版古籍扫描或作者释出 |
| 小学堂（xiaoxue） | CC0 1.0 | 秦汉简牍字形 |

**Richard Sears**：CSV 里 `credit_note` 非空的行，其 Commons 文件页注明资料来自 Richard Sears
（Chinese Etymology，<https://hanziyuan.net/>）并**请求致谢**。用到这些行的字，界面或本项目
README 需保留致谢。`credit_note` 已经随 `GlyphRow` 进入 App 数据，渲染处可直接取用。

设计稿与文案版权归造字人项目所有；设计稿生成脚本在
`/workspace/zaozi-formal/v1/src/`，本仓库的文案从那里逐字抄录。

## 已知缺口

- **没有用 DevEco / ohos SDK 编译过。** 本机只有裸 Linux 仓颉 SDK（1.1.3），
  `kit.ArkUI`、`ohos.*` 一律编不了。语法已逐文件验过，类型与宏展开没有验。
- **没有打包字体。** SPEC 用 Noto Serif CJK SC/TC 与 HarmonyOS Sans SC，字体文件太大没有塞进
  仓库；`theme.cj` 里 `Theme.serif` / `Theme.serifTC` 现在只是 `"serif"` / `"sans-serif"`
  的系统回退名，等以后 `font.registerFont` 注册 rawfile 下的字体再换掉（TODO 已写在文件里）。
- **SVG 上色 / 颜色滤镜没验。** 骨片上给字形上刻痕色（`Theme.carve`）需要 SVG 的
  `fillColor` 或 `colorFilter` 之类的机制，真机上能不能按预期生效要试。
- **笔画生长动画换成了淡入/上移。** SPEC §7.3 允许不做笔画生长，实现用的是
  `animateTo` + `opacity`。
- **只有 休/水/本/从 四个字有白话行**，字义/典籍/小故事/效果设计稿只给了「休」。
  其余字对应行/块整块不渲染（`copy_text.cj` 里空串，界面判空后跳过）。
- **玩法数值全是版式占位**（代次、记忆、骨片数），按 SPEC 说明只是先把版式排对。
- **图标是占位的**：`AppScope/resources/base/media/app_icon.png` 直接用了 yilu-bios 的图标。
