# W8 根因：挑字「按住不放」点选被静默吞掉

## 症状

挑字（pick）阶段，玩家按住某个候选字不放、稍后才松手时，这一次点选会**随机丢失**。
桌面端表现为「点两下没选中，要再点一下」；触控端（无悬停）表现为「点了没反应，得点三次」。
按住时间越长越容易丢，短促点击几乎不丢。

## 复现

`web/app.js` 加临时诊断（`?dbg=1` 把事件写入 `window.__zzlog`），chromium 1280×800：

```bash
npm run build
DIST=/workspace/zaozi-web/dist node <repro>.mjs chromium 5191 hold650
```

步骤（模拟真人）：
1. 连点「水」两下选中它 → 触发 `afterAction` 排一个 650ms 的 `render()`。
2. 把鼠标移到「日」（悬停只更新说明卡，`ui.pickFocus` 变「日」但**不**重绘 DOM）。
3. 在「日」上**按下并按住** 650ms，跨过上面那个 650ms 重绘，再松手。
4. 再补一次正常点击（玩家的「第二下」）。

## 事件时间线（修复前，单位 ms）

```
10098 doc.pointerdown tgt=cand:日#id4  conn=true     ← 玩家按下，#id4 是「日」当前的 DOM 节点
10277 afterAction:650-fire heir                      ← 任何 render() 都会重算挑字 HTML
10278 renderPick:REPLACE 2807                        ← innerHTML 整块重建：候选节点被换新
10647 pointerover moved=false tgt=cand:日#id5        ← 指针仍停在原地，节点已是 #id5（新节点）
10752 doc.pointerup   tgt=cand:日#id5  conn=true     ← 松手落在 #id5，与按下的 #id4 不是同一个节点
                                                     ← 浏览器因此**不合成 click**：整条日志无 doc.click
10891 doc.click       tgt=cand:日#id5               ← 玩家补的第二下
10891 pickClick 日 picks=水 focus=日 tapped=null     ← tapped 仍是 null → 又被当成「第一下」
       picks=["水"]   has 日 = false                  ← 点选丢失
```

要点：`pointerdown`（#id4）与 `pointerup`（#id5）落在**不同** DOM 节点上。按 DOM 规范，
一次 click 只有在按下与抬起是同一节点（或共同祖先）时才会被合成；节点在按住期间被替换，
浏览器就不发 click。于是 `pickClick` 根本没被调用。

## 根因

`renderPick()` 用 `el.innerHTML = html` 整块重建候选。触发条件不是「按住本身」，而是
**按住期间恰好发生了一次会改变挑字 HTML 的 render**：

- 挑字 HTML 里烘焙了 `ui.pickFocus`（`.focus` 类）。
- 悬停（`pointerover`）只调 `updatePickInfo()` 就地切类，**不更新** `lastPickHTML` 缓存，
  于是缓存变「脏」；
- 之后任何一次 `render()`（例如 `afterAction` 的 650ms 重绘、飘字清除、横幅/阶段渲染）
  重算 HTML 时发现与缓存不同 → 整块替换 → 把玩家正按着的节点换掉。

按住时间越长，越容易撞上这次重绘；短促点击通常已 `up`，故极少触发。

## 修复

不再依赖浏览器合成 click，把挑字选择改到 **pointerup** 上、针对 **pointerdown 时捕获的候选**执行：

- `pointerdown`（`#pick` 内）记下 `ui.pickPtr = 候选字`；
- 全局 `pointerup`：若松手仍在同一候选上（`e.target.closest('[data-char]')` 的字 === `pickPtr`），
  直接 `pickClick(ch)`，并置 `ui.pickHandled = ch`；
- 随后浏览器若仍合成了 click（节点没被换的情况），`#pick` 的 click 处理器见到
  `c.dataset.char === ui.pickHandled` 就**吞掉这一次**，避免与 pointerup 双触发；
- `pointercancel` 清空 `pickPtr`；新的 pointerdown 作废旧 swallow。

节点是否被重建都不影响：pointerup 用的是「当前」命中节点，与 pointerdown 那个被替换掉的节点无关。

保留不变：两段式点选语义（第一下看说明/记 tapped，第二下选中）、放回、键盘单焦点状态、
快速连续点选、触控 `tap()` 行为。

## 验证

同一复现脚本，修复后：

```
10722 doc.pointerup tgt=cand:日#id5  conn=true
10722 pickClick 日 picks=水 focus=日 tapped=null     ← pointerup 直接处理（合成 click 被吞，无 doc.click）
10867 doc.pointerdown/pointerup tgt=cand:日#id5
10867 pickClick 日 picks=水 focus=日 tapped=日       ← 第二下 → 选中
10869 sfx.pick
       picks=["水","日"]   has 日 = true
```

修复前 `has 日 = false`，修复后 `has 日 = true`。

回归入口：`tests/e2e/pick_hold.test.mjs`（3 引擎 × 1280；按住 0/300/650/1000ms + 50 次混合按住点击，零丢失）。
