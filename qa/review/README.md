# 工程送审检查清单 (Engineering Review Checklist)

本目录提供造字人前端工程在提交代码审核（Pull Request 送审）前的一键式自动化门禁检查工具，确保视觉规范、文本尺寸、容器溢出、点击目标几何、代码语法、送审合规性及数据安全性全部达到发布与审核标准。

---

## 1. 运行主体与时机

- **责任人**: 程序员在提交 PR 或合并送审前必须执行。
- **执行时机**: 必须在**送审 tip 提交**（当前 HEAD）上完整运行。
- **送审交付物**: 送审件中必须附带本工具生成的汇总报告 `qa/review/out/<sha>/summary.md`。

---

## 2. 使用方法

### 一键运行完整门禁
```bash
bash qa/review/run.sh --submission path/to/送审件.md
```

### 中间迭代快速轮次 (`--quick`)
在开发过程中进行快速验证时，可开启 `--quick` 参数（仅测试 375x667、360x800、1920x1080 三种典型视口，按 PM 规则 T4）：
```bash
bash qa/review/run.sh --quick --submission path/to/送审件.md
```

### 常用运行参数说明
- `--quick`: 启用快速测试模式，仅跑 3 个核心尺寸（375x667 经典小屏、360x800 现代主流手机屏、1920x1080 桌面宽屏）。
- `--engines <engines>`: 指定测试浏览器内核，逗号分隔，默认全跑 `chromium,firefox,webkit`。例如只测 Chromium：`--engines chromium`。
- `--submission <file>`: 指定送审件 Markdown 文件路径（例如 PR Description 文本）。若缺省，工具会自动尝试调用 `gh pr view --json body -q .body` 获取当前分支 PR 内容；若仍未获取到则 C5 报失败。
- `--base <ref>`: 指定比较基线 Git Commit / Ref（默认自动取 HEAD 与 `origin/main` 或 `main` 的 merge-base）。
- `--only <items>`: 仅执行部分检查项子集（逗号分隔），例如 `--only c1,c4,c6`。

---

## 3. 门禁检查清单与规则映射

| 编号 | 检查 | 规则号 | 通过判据 | 输出文件 |
|:---:|---|---|---|---|
| **C1** | 对比度 | R16 | 文本颜色与有效背景合成后，正文对比度 ≥ 4.5:1，大字（字号≥24px 或 字号≥18.66px且加粗）对比度 ≥ 3.0:1；`#opt-left` / `#opt-right` 选项边框对比度 ≥ 3.0:1 且自身综合透明度 = 1.0 (R16 N4) | `ui_gate.md` / `ui_gate.json` |
| **C2** | 字号 | R16 | 页面全部可见文本计算字号 ≥ 13px；桌面视口（宽度 ≥ 1024px）下，正文元素（`#card-text`, `#coach`, `#opt-left`, `#opt-right`）计算字号 ≥ 14px | `ui_gate.md` / `ui_gate.json` |
| **C3** | 溢出与目标门禁 | R12 / R13 / R17 / R18 | (1) 可见文本包围盒必须完全包含在容器盒内（容差 1px），容器取非 visible overflow 祖先或 `#card`, `button`, `.opt`, `#wordbox`, `#coach`, `#toast`, `dialog`, `#menu-pop`, `#keyhelp-pop`，且带滚动/裁剪的文本元素不得内溢出。<br>(2) 各阶段目标在视口内完全可见且可点 (`document.elementFromPoint(center)` 为自身或子元素)；核心入口（`#opt-left`, `#opt-right`, `#bonecorner`, `[data-do="skip"]`, `#menubtn`）尺寸 ≥ 44×44。<br>(3) T03engrave 刻字阶段左右选项必须被隐藏 (`visibility:hidden`) 或禁用 (`disabled`) (R12)<br>(4) 电脑视口（宽 ≥ 1280）卡片 `#card` ≤ 448×640（容差 1px，R18） | `ui_gate.md` / `ui_gate.json` |
| **C4** | 代码规范与运行错误 | R20 | (1) C4a 静态代码：`web/web/*.js` 内无重复顶层函数声明，全局 `function inputBusy` 出现次数恰为 1，无 Node 语法解析错误 (`SyntaxError`)。<br>(2) C4b 运行时错误：首屏及各操作阶段控制台无 `console.error` 与 `pageerror` 抛错；T01 阶段卡片 `#card` 必须可见 | `static_check.md`<br>`ui_gate.md` |
| **C5** | 送审与模型规范 | R24 + 审核规则「CLI/模型」行 | (1) 送审件中包含「CLI/模型」标题或行。<br>(2) `git log <base>..HEAD` 中所有 7 位 Commit SHA 必须在送审件中全部列出。<br>(3) 出现 `cc` 或 `claude` 的行必须写明原因（包含 原因/因为/报错/额度/429/quota/error/RESOURCE_EXHAUSTED）；若向 cc 传 `--model` 必须显式披露违反原因。<br>(4) 严禁在同一行将 `glm-5.3` 用于图片/截图/视觉任务 | `cli_model.md` / `cli_model.json` |
| **C6** | 数据安全 | 数据安全 (PR9 D4/B5，P1；R20 同属) | (1) C6a 静态检查：`web/tests/**/*.mjs` 或 `qa/test/**/*.mjs` 中必须有「注入渲染报错 + 断言存档还在」的用例（只在 qa/test 时会注明未接入 npm e2e）。<br>(2) C6b 动态探针：先玩两步生成存档，再带注入脚本重载——只在调用栈里有 `render()` 时让 DOM 写入（textContent/innerHTML/appendChild/replaceChildren）抛错，加载后 `zaozi.save.year1` 必须与注入前**逐字相同**（备份后删除也算不过）；注入一次都没打中也判不过。<br>(3) C6c 损坏存档探针：写入结构合法但不可重放的存档后重载，这串原文必须还在 `zaozi.save.year1` 或 `zaozi.save.year1.bak` 里。<br>C6b/C6c 按 `--engines` 每个引擎各跑一次，任一引擎不过即不过 | `data_safety.md` / `data_safety.json` |

---

## 4. 视口矩阵 (Rule R14 / T2)

门禁在 Playwright 中覆盖以下视口，移动端/平板端模拟 Touch（Firefox 不支持 isMobile 仅启用 hasTouch）：

### 门禁内 15 种视口 (In-Gate Viewports)
- **手机屏 (Phones, 7 档)**:
  - `375x667` (iOS 经典小屏)
  - `360x800` (Android 主流标准屏)
  - `390x844` (iPhone 标准屏)
  - `393x852` (iPhone Pro 屏)
  - `412x915` (Android 大屏)
  - `430x932` (iPhone Max 屏)
  - `390x664` (带地址栏与底栏的矮视口)
- **平板屏 (Tablets, 3 档)**:
  - `768x1024` (iPad 竖屏)
  - `820x1180` (iPad Air 竖屏)
  - `1024x768` (iPad 横屏)
- **桌面端 (Desktops, 5 档)**:
  - `1280x720` (720p 笔记本)
  - `1280x800` (MacBook 宽屏)
  - `1366x768` (常见办公笔记本)
  - `1440x900` (MacBook Pro)
  - `1920x1080` (1080p 标准显示器)

### 仅记录视口 (Record-Only)
- `360x640` (超小/超矮历史屏): 运行并采集数据，但依据规则 R14 / PM U4 属于「只记录不阻断门禁」（结果标记为 RECORD，不触发 Gate FAIL）。

### 快速模式视口 (`--quick`, Rule T4)
- `375x667`
- `360x800`
- `1920x1080`

---

## 5. 状态流转探针 (States)

门禁对每个测试单元依次探查 4 组关键交互状态，并截取全屏快照保存至 `qa/review/out/<sha>/shots/<engine>_<size>_<state>.png`：
1. **`T01`**: 全新教学开局（访问 `/?seed=20261016`，清除 localStorage 并刷新，等待 `__zz.st.phase === "card"` 且动画结束，等待 600ms 稳定）。
2. **`T02`**: 两次按 `ArrowLeft` 进入第二张卡片状态，等待 600ms 稳定。
3. **`T03engrave`**: 随后两次按 `ArrowRight` 进入第一张刻字状态，等待 `__zz.st.phase === "engrave"` 且动画结束，等待 600ms 稳定。
4. **`menu`**: 从 `T01` 状态点击右上角菜单按钮 `#menubtn`，等待 300ms 弹层稳定。

---

## 6. 输出位置

- 每次运行先清空再写 `qa/review/out/<短 sha>/`（已在 `qa/review/.gitignore` 里忽略，不进仓库）：
  - `summary.md` / `summary.json`：总表（送审件里附这一份）
  - `static_check.*`、`ui_gate.*`、`cli_model.*`、`data_safety.*`：各项明细（失败项列前 30 条，全量在 json）
  - `shots/<引擎>_<尺寸>_<状态>.png`：每格截图
  - `server.log`：本次静态服务日志
- `qa/review/out/latest/summary.*`：最近一次的总表副本。
- 被要求跑的项如果没产出结果（检查器崩溃），总表记为 FAIL，不会按 PASS 放过。

## 7. 进程退出码 (Exit Codes)

- **`0`**: 全部测试项（或 `--only` 指定的全部项）判定为 **PASS**。
- **`1`**: 存在任一项门禁未通过（判定为 **FAIL**）。
- **`2`**: 环境错误或工具执行崩溃（如 Node 版本 < 22、缺少依赖且无法安装、静态服务启动失败等）。

---

## 8. 已知局限与边界条件 (Known Limitations)

1. **非真实物理设备**: 使用 Playwright 进行无头模拟渲染，未能模拟真机 WebView、物理刘海屏/动态岛遮挡。
2. **Safe-Area 暂未做像素级裁剪**: 视口环境未完全模拟手机端动态键盘弹出及底部 Home 指示条的安全区。
3. **带背景图元素的对比度**: 不透明纯色渐变（如卡角 `#bonecorner`）按每个色标分别算，取最差值判定；`url()` 图片或半透明渐变无法算，标 `bgUnknown`，只记 **WARN**，不阻断。
4. **对比度/字号不放宽**: 判据按 WCAG 原值（4.5 / 3.0），字号只吸收 0.01px 浮点误差。
5. **C2 的「电脑正文 ≥14px」按视口宽 ≥1024 判**，所以 1024×768（平板横屏）也按电脑正文要求。
6. **C5 默认基线**是 `origin/main` 的 merge-base；分支如果是叠在别的未合分支上，请用 `--base` 指到上一轮送审 tip。
