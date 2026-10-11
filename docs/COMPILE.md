# 编译造字人（HarmonyOS / 仓颉）

本文分两部分：**DevEco Studio（Mac）点按钮**和**命令行 `hvigorw`**。两边用的是同一套工程，
命令行那套是从一次实际跑通的环境（14 次全部 BUILD SUCCESSFUL）里整理出来的，环境变量一个都
不能少——缺任何一个都会让仓颉插件被判成「未启用」，报
`buildOption.cangjieOptions is not a valid property`。

> **当前状态：本仓库没有在任何 DevEco / ohos SDK 上编译过。** 本文是照实际跑通的环境写的，
> 但步骤本身没有在本机上验证。第一次跑请按「排错」一节逐项确认。

---

## 0. 前置条件

| 项 | 版本 / 路径 |
|---|---|
| DevEco Studio | 6.1（含 Cangjie 插件，插件版本 6.1.1.x） |
| Cangjie SDK | 6.1，放在 `$HOME/.cangjie-sdk/6.1/cangjie` |
| HarmonyOS SDK | DevEco 自带，`sdk.dir` 指到它 |
| Node | DevEco 自带的 v18.x（**不要**用 Homebrew 的 node，PATH 要前置） |
| API 版本 | 24，compatibleSdkVersion `6.1.1(24)` |
| 机器 | Apple Silicon 或 Intel 均可，本文路径按 macOS 写 |

确认 Cangjie SDK 目录下**有** `oh-uni-package.json`：

```bash
ls "$HOME/.cangjie-sdk/6.1/cangjie/oh-uni-package.json"
```

这个文件存在，`cangjie-build-support` 插件才会把自己判成启用。如果 `DEVECO_CANGJIE_PATH`
指到了 `.../cangjie/build-tools` 或某个 Android 版 SDK 目录（那些目录里没有这个文件），
插件就会静默不启用，然后报 schema 错。

---

## 1. DevEco Studio（Mac）

1. **打开工程**：`File → Open`，选本仓库**根目录**（有 `build-profile.json5` 那一层），
   不要选 `entry/`。
2. **等仓颉插件加载**：右下角会提示安装/启用 Cangjie 插件，确认启用。
   装完后 `File → Settings → Cangjie` 里应能看到 SDK 路径指向 6.1。
3. **Sync**：`File → Sync`（或工具栏的 Sync 按钮）。这一步会生成 `oh_modules/`、
   建好 hvigor 的工程缓存链接。**不要**手动跑 `ohpm install`——本工程
   `oh-package.json5` 的 dependencies 是空的，靠 DevEco 的 `hvigorw.js` 自己解析
   `@ohos/cangjie-build-support`。
4. **选模块和 API**：右上角模块选 **entry**，`API 24`。
   如果下拉里没有 24，说明 HarmonyOS SDK 没装齐，去 `Settings → SDK` 补 API 24。
5. **签名**：`File → Project Structure → Signing Configs`，勾
   **Automatically generate signature**，登录华为账号。自动签名会在
   `build-profile.json5` 的 `signingConfigs` 里写入配置（该数组初始为空是正常的）。
6. **Run**：连真机或起模拟器，点 **Run 'entry'**。

日志里出现下面这些 task，说明仓颉插件确实生效了：

```
:entry:default@CangjiePreBuild
GenerateCangjieResource
CompileCangjie
MoveCangjieLibs
ProcessCangjieLibs
AfterCompileCangjie
```

并且 `:entry:default@PreBuild` 应该显示为 **Disabled**（被 Cangjie 插件接管）。
如果 `CompileCangjie` 没出现、`PreBuild` 是正常执行的，那就是插件没启用，跳到「排错」。

---

## 2. 命令行 `hvigorw`

命令行构建需要在**项目根目录**执行——hvigor 用 `process.cwd()` 定位工程、算缓存目录，
换目录会换到另一个 workspace，可能拿到旧的缓存链接。

### 2.1 一次性准备（仓库里不带的三个文件）

`local.properties`、`hvigorw`、`hvigorw.js` 都被 `.gitignore` 掉了，需要手动放：

```bash
cd <本仓库根目录>

SDK="$HOME/Applications/DevEco-Studio.app/Contents/sdk"
DE="$HOME/Applications/DevEco-Studio.app/Contents"

ln -sf "$DE/tools/hvigor/bin/hvigorw"   hvigorw
ln -sf "$DE/tools/hvigor/bin/hvigorw.js" hvigorw.js

cat > local.properties <<EOF
sdk.dir=$SDK/default
hwsdk.dir=$SDK/default
EOF
```

DevEco 默认装在 `/Applications`。如果装在了别处，把 `SDK` / `DE` 换成实际路径。

### 2.2 环境变量

```bash
export DEVECO_SDK_HOME="$HOME/Applications/DevEco-Studio.app/Contents/sdk"
export DEVECO_CANGJIE_PATH="$HOME/.cangjie-sdk/6.1/cangjie"
export DEVECO_CANGJIE_HOME="$HOME/.cangjie-sdk/6.1/cangjie"
export DEVECO_CANGJIE_PLUGIN_ENABLED=true
export CANGJIE_HOME="$HOME/.cangjie-sdk/6.1/cangjie/build-tools"

export PATH="$HOME/.cangjie-sdk/6.1/cangjie/build-tools/tools/bin:\
$HOME/.cangjie-sdk/6.1/cangjie/build-tools/bin:\
$HOME/Applications/DevEco-Studio.app/Contents/tools/node/bin:\
$HOME/Applications/DevEco-Studio.app/Contents/tools/hvigor/bin:\
$DEVECO_SDK_HOME/default/openharmony/toolchains:$PATH"

export LD_LIBRARY_PATH="$HOME/.cangjie-sdk/6.1/cangjie/build-tools/runtime/lib/darwin_aarch64_cjnative:\
$HOME/.cangjie-sdk/6.1/cangjie/build-tools/tools/lib"
export DYLD_LIBRARY_PATH="$LD_LIBRARY_PATH"
export DYLD_FALLBACK_LIBRARY_PATH="$LD_LIBRARY_PATH"
```

每个变量的作用：

| 变量 | 谁在读 / 干什么 |
|---|---|
| `DEVECO_SDK_HOME` | `hvigorw.js` 用它定位 HarmonyOS SDK |
| `DEVECO_CANGJIE_PATH` | **最关键**。`hvigorw.js` 在它下面找 `build-tools/tools/hvigor/cangjie-build-support`；插件也用它判断是否启用 |
| `DEVECO_CANGJIE_PLUGIN_ENABLED` | 显式打开插件（和上一个变量是「或」的关系，两个都设最稳） |
| `DEVECO_CANGJIE_HOME` | 插件找 Harmony SDK 的备选；`entry/cjpm.toml` 的 `-B` / `-L` 参数也引用它 |
| `CANGJIE_HOME` | `cjpm` / `cjc` 的工具链根，注意指 **build-tools** 不是 cangjie 根 |
| `PATH` | 让 cjc/cjpm 用 6.1 的版本、node 用 DevEco 自带的 v18、hdc 在 toolchains 里 |
| `LD_LIBRARY_PATH` / `DYLD_*` | 仓颉编译器与运行时的 dylib |

### 2.3 构建

```bash
cd <本仓库根目录>
./hvigorw --mode module -p module=entry@default -p product=default \
          -p buildMode=debug assembleHap --no-daemon
```

- `--no-daemon` **刻意加上**：hvigor 的 daemon 会复用启动时的环境，如果它是在没设上面那些
  变量的 shell 里先起来的，之后 export 也不生效。加 `--no-daemon` 每次都是新进程读当前环境。
  （或者先 `./hvigorw --stop-daemon`。）
- 产物：`entry/build/default/outputs/default/entry-default-unsigned.hap`

### 2.4 安装到设备

```bash
hdc list targets
hdc -t <target> install -r entry/build/default/outputs/default/entry-default-unsigned.hap
```

模拟器允许免签安装；真机需要第 1 节第 5 步的自动签名配置。

---

## 3. Release 包

把 `buildMode=debug` 换成 `release`，并确认签名配置已就位：

```bash
./hvigorw --mode module -p module=entry@default -p product=default \
          -p buildMode=release assembleHap --no-daemon
```

`entry/build-profile.json5` 的 `buildOptionSet` 里已经给 release 关了资源混淆
（`obfuscation.ruleOptions.enable = false`）——字形 asset 名是代码里 `@rawfile` 字面量穷举出来的，
混淆资源名会让它们对不上。正式出包前如果要开混淆，需要同步调整 `glyph_res.cj` 的生成规则。

---

## 4. 排错

| 现象 | 原因 / 处理 |
|---|---|
| `buildOption.cangjieOptions is not a valid property` | 仓颉插件未启用。按可能性：① 没设 `DEVECO_CANGJIE_PATH`，或它指到了没有 `oh-uni-package.json` 的目录；② daemon 带着旧环境 → 加 `--no-daemon` 或先 `--stop-daemon`；③ 不是在项目根目录跑的，缓存 workspace 不对 |
| `Cannot find module '@ohos/cangjie-build-support'` | `~/.hvigor/project_caches/<cwd 哈希>/workspace/node_modules/@ohos/` 下没有 `cangjie-build-support` 链接。设好 `DEVECO_CANGJIE_PATH` 再跑一次，`hvigorw.js` 会自己建 |
| 用了 Homebrew 的 node 导致奇怪报错 | PATH 里 DevEco 的 `tools/node/bin` 要排在 `/opt/homebrew/bin` 前面 |
| `cjpm`/`cjc` 版本不对 | PATH 里 `.../cangjie/build-tools/tools/bin` 要前置 |
| Sync 之后 `oh_modules/` 是空的 | 正常。本工程依赖为空，靠 `hvigorw.js` 解析插件 |

确认插件链接是否建好：

```bash
python3 - <<'PY'
import hashlib, os
print(hashlib.sha256(os.getcwd().encode()).hexdigest()[:32])
PY
# 然后 ls ~/.hvigor/project_caches/<上面这个哈希>/workspace/node_modules/@ohos/
# 应该看到 cangjie-build-support -> $DEVECO_CANGJIE_PATH/build-tools/tools/hvigor/cangjie-build-support
```

---

## 5. 只用裸仓颉 SDK 能验到什么

本机（无 ohos SDK）能跑的只有纯逻辑：

```bash
source /home/box/.cangjie-sdk/6.1/cangjie/envsetup.sh
cd tools/box_check && ./sync.sh && cjpm build && cjpm run   # 1798 条断言
bash tools/box_check/parse_check.sh                        # 逐文件 parser + 整包类型检查
```

具体证明到哪一步、哪些没证明，见 [`SCAFFOLD_REPORT.md`](SCAFFOLD_REPORT.md)。
