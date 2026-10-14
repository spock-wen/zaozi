# 卡角「刻」根因：`.bonecorner.done` 的 `pointer-events:none` 被误翻转

## 症状

Firefox 上跑教学（`tests/e2e/short_screen.test.mjs` 的「挑字 1280×720」用例，其 `toPickDesktop`
前置会走 `clearTutorial`，点 `#bonecorner`），点击卡角「刻」时 Playwright 报：

```
element is not clickable ... <div class="card-head">…</div> intercepts pointer events
retrying click action ... 30 × …
```

即点击卡角中心被卡头 `.card-head` 接住，重试到 30s 超时。**随机复现**（跑十次可能挂一两次），
Chromium/WebKit 少但同样存在，Firefox 时序下最容易撞上。

## 复现

Firefox 1280×720，走 `commit left → commit right` 到 T03（`phase=engrave`），期间每 20ms 采样一次
`#bonecorner` 的包围盒中心 `document.elementFromPoint` 与其 `className` / 计算 `pointer-events`：

```
t11 phase=engrave cur=T03 hit=card-head cls="bonecorner done" pe=none  ← 入场动画中
t12 phase=engrave cur=T03 hit=card-head cls="bonecorner done" pe=none
t13 phase=engrave cur=T03 hit=card-head cls="bonecorner done" pe=none
t14 phase=engrave cur=T03 hit=card-head cls="bonecorner done" pe=none
t15 phase=engrave cur=T03 hit=bonecorner cls="bonecorner"      pe=auto  ← 翻回来了
…
t37 phase=engrave cur=T03 hit=bonecorner cls="bonecorner"      pe=auto
t38 phase=engrave cur=T03 hit=card-head cls="bonecorner done" pe=none  ← ~650ms 重绘又翻成 done
t39 phase=engrave cur=T03 hit=card-head cls="bonecorner done" pe=none
```

`done` 类在「刻」阶段来回翻转，翻到「有」的那些帧 `pointer-events:none`，卡角就失去命中测试。

## 根因

`web/app.js` 的 `renderCard()`：

```js
card.classList.toggle("engrave", st.phase === "engrave");
const bc = $("bonecorner");
bc.classList.toggle("done", st.phase === "engrave" && ui.engraved);   // ← 这里
```

- `ui` 对象里**从来没有初始化 `engraved`**（`let ui = { …, pickFocus, pickTapped, … }` 没这个键），
  所以它在真刻之前的值是 `undefined`。
- 进入「刻」但还没点卡角时，第二个实参求值为 `true && undefined === undefined`。
- `DOMTokenList.toggle(token, force)` 的 `force` 是**可选参数**：传入 `undefined` 与「不传 force」
  等价，于是退化成**普通翻转**（有 `done` 就删、没有就加），而不是「强制移除」。
- 结果：「刻」阶段每调用一次 `renderCard()`，`done` 类就翻一次。`render()` 会在提交进卡、
  `afterAction` 的 650ms 重绘、飘字清除、横幅等许多时机被调用 —— 于是 `done` 的奇偶随时序变化，
  卡角在「可点 / 不可点」之间抖动。
- `web/style.css`：

  ```css
  .bonecorner.done{ …; pointer-events:none; }
  ```

  `done` 一旦为「有」，卡角不再参与命中测试，卡角中心（`top:8px;right:8px;44×44`）正好落在
  卡头 `.card-head`（卡内首个流内块，顶部起，右边被卡内边距截到 `width-16`）的盒内 → 命中 `.card-head`。

表面看像「叠层 / z-index」问题，其实不是：
- `.bonecorner` 是 `position:absolute`，`.card-head` 是普通流内块，正常层序里 positioned 元素本就该在上面，
  两者的 `z-index` 都是 `auto`，谁也没自建叠层上下文。
- 真正让卡角「掉到下面」的是 `pointer-events:none`（非命中的元素在命中测试里被跳过）。

**附带的同类缺陷**：`ui.engraved` 一旦真刻过一次就永远为 `true`（代码里没有复位），
下一张带迹的普通卡一进「刻」就带 `done` → 同样点不到。这次一并修掉。

## 修复（产品代码）

`web/app.js`：

1. `ui` 增加 `engraved: false`（明确是布尔量，杜绝 `undefined` 走 `toggle` 的「无 force」语义）。
2. `renderCard()` 把 `toggle` 的 `force` 保持为布尔，并在**离开「刻」阶段**即复位本张卡的已刻标记：

   ```js
   const engrave = st.phase === "engrave";
   card.classList.toggle("engrave", engrave);
   if (!engrave) ui.engraved = false;   // 别把 done 带到下一张「刻」卡
   const bc = $("bonecorner");
   bc.classList.toggle("done", engrave && ui.engraved);
   ```

`web/style.css`：

3. `.bonecorner` 加 `z-index:1`，显式压在卡内正文（含 `.card-head`）之上，防止将来
   `.card-head` 因 `transform` / `opacity` / `isolation` 之类自建叠层而上浮。

（B 档 1024×600 首进的「?」键位浮层 `#keyhelp-pop` 是独立的 `z-index:61` 提示浮层，
首进一次、3 秒自收，与本次缺陷无关；回归测试里先收掉它再断言卡角 vs `.card-head`。）

## 验证

回归入口：`tests/e2e/bonecorner_hit.test.mjs`。四个视口（1280×720 / 1024×600 / 1366×768 / 390×844），
在卡角包围盒中心用 `document.elementFromPoint` 断言命中 `#bonecorner` 或其子节点，三处都查：

1. **入场动画进行中**：提交进「刻」后按 rAF 逐帧采样（卡还在飞出→回位的 160ms 过渡里）；
2. **入场动画结束后**：同次采样里卡已回位（`transform:none`）的帧，外加跨过 650ms 重绘的稳态；
3. **教学态**：同存档重载回到 T03，`load` 之后立刻查。

```
# 修复前（退回旧 renderCard，仅留 z-index 修复）：4 个视口全挂
not ok 1 - firefox 卡角「刻」命中 1280×720 …（命中 card-head）
not ok 2 - firefox 卡角「刻」命中 1024×600 …
not ok 3 - firefox 卡角「刻」命中 1366×768 …
not ok 4 - firefox 卡角「刻」命中 390×844 …
# pass 0 / fail 4

# 修复后：
E2E_ENGINES=firefox node --test tests/e2e/bonecorner_hit.test.mjs   → 4/4 通过
E2E_ENGINES=firefox npm run e2e                                    → 全套通过
```

采样日志修复后全程 `hit=bonecorner`、`pe=auto`，`done` 类不再出现在「刻」阶段。
