# P1-b12 根因：触屏点已选格子「放回」，一次放回两个字

## 症状

手机（390，无悬停）挑字阶段，选满三个字后，点格子里的第 1 个字想放回它，
结果**连着第 2 个字一起被放回**。三个引擎 100% 复现：

```
选满「水日人」→ 点格子里的「水」→ 只剩「人」（预期「日人」）
再点已选的「人」→ 正常放回成空（字池里的字位置不动，所以点候选不受影响）
```

## 根因

W8 的修法把点选从「浏览器合成 click」挪到 **pointerup 手动处理**，并用「字符比较」吞掉随后的合成 click：

```js
// 旧代码（f04dfb8 之后的 b12d7f1）
$("pick").addEventListener("pointerdown", (e) => { ui.pickPtr = b ? b.dataset.char : null; });
addEventListener("pointerup", (e) => {
  const ch = ui.pickPtr; ui.pickPtr = null;
  const b = e.target.closest?.("[data-char]");
  if (b && b.dataset.char === ch) { ui.pickHandled = ch; pickClick(ch); }   // 手动放回
});
on($("pick"), (e) => {
  const c = e.target.closest("[data-char],[data-do]"); if (!c) return;
  const handled = ui.pickHandled; ui.pickHandled = null;
  if (c.dataset.char && c.dataset.char === handled) return;                 // 只吞「同一个字」的合成 click
  ...
});
```

两个缺陷叠加：

1. **每次 render 整块替换节点。** `renderPick()` 用 `el.innerHTML = html` 重建候选/格子。
   它缓存过 HTML，但悬停（`pointerover`）只就地切 `.focus` 类、不更新缓存；只要之后有任意一次
   `render()`（`afterAction` 的 650ms 重绘、飘字清除、横幅/阶段渲染），缓存就与 DOM 不一致 →
   整块替换。**玩家正按着的那个格子按钮被换成了新节点。**
2. **吞点击靠比较字。** 触屏 tap 的手势识别是**按坐标**命中的：pointerup 放回「水」后立即重绘，
   同一格补进了「日」；浏览器随后合成的 click 落在这个坐标上，`closest('[data-char]')` 拿到的是
   **「日」**。旧逻辑比较 `日 === 水` 不成立 → 不吞 → `pickClick("日")` 又执行一次放回。

### 事件时间线（390 触屏，修复前）

```
t0  pointerdown tgt=slot[data-char=水]           ← 按下，ui.pickPtr="水"
t1  pointerup   tgt=slot[data-char=水]           ← 命中「水」→ pickClick("水") 放回；ui.pickHandled="水"
      → dispatch pick_toggle 水 → renderPick 整块重建 → 第 1 格内容变成「日」（节点被换新）
t2  click       命中坐标仍是第 1 格 → 节点已是「日」  ← 合成 click 按坐标落在新节点
      → handled="水"，日≠水 → 不吞 → pickClick("日") 又放回
最终 picks=[]（少了两 个），只剩「人」
```

要点：`pointerup` 处理的字与随后合成 `click` 命中的字**不是同一个**了——这是「节点被替换 +
合成 click 按坐标命中」共同造成的，不是「按了两下」。

`f04dfb8` 没有这个问题（当时只走 click，放回只发生一次）。测试的「点格子放回」那格只选了一个字，
放回一个和放回两个结果一样，所以 PASS 是**假绿**。

## 修复（从根上修，见 web/app.js）

**(a) 挑字屏红绘改成就地补丁，不再整块替换节点。** 候选 / 格子 / 出发键的 DOM 节点只建一次，
之后只改 class 与文本（`buildPickSkeleton` + `patchKeyed`，按 `data-char` / `data-slot` / `data-do`
复用节点）。按下与抬起之间即使发生 render，玩家按着的节点也还是同一个——浏览器照常合成 click。

**(b) pointerup 与合成 click 的去重，按「这一次按下」本身区分，不再比较字。**
每次 `pointerdown` 给该 `pointerId` 记一条 press（`token` + 命中的节点）；`pointerup` 只处理
「自己这一次按下」，命中同一节点才动作，动作后把 `token` 入队；随后的合成 click 按 `token` 吞掉
（不比较字）。因此「放回一个字后格子补进另一个字、合成 click 命中新字」不会再被当作第二次放回。
出发键（`data-do=go`）走同一条路径，同样只触发一次。

**(P2-1) 多点触控：** press 存在 `Map<pointerId, press>` 里，第二指不再覆盖第一指，
`pointerup`/`pointercancel` 只清自己那一指；松开只对「自己 pointerId 的 press」生效。

## 验证

`tests/e2e/pick_touch_putback.test.mjs`（390 触屏）：

- 三引擎：填满三格 → 点第 1 格，`picks` 长度恰好减 1（修复前减 2）；点已选候选同样恰好减 1；
  选满后点出发键，`begin_generation` 恰好一次。
- chromium（CDP 双指 `Input.dispatchTouchEvent` 两个 touchPoints）：两指同时按两个已选候选，
  各放回一个、互不取消/劫持，恰好两次放回；其它引擎跳过并注明原因。

修复前本套件 4/4 失败（「点格子应恰好放回一个字」得到减 2；双指得到 `["水","木"]` 不动），
修复后 4/4 通过。
