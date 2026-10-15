# E2: after clicking 「天亮了」 #endseq never appears (pick_hold flake)

## Symptom
Full e2e, chromium 1280×800, toPickDesktop: after clicking #winter-end, #endseq stayed `<section hidden id="endseq"></section>` (empty) for 12s. The empty innerHTML means renderEnded never ran in "show" state: winter_end was never dispatched and the click was lost.

## Root cause (product bug)
renderWinter() / renderEnded() / renderElder() reassigned innerHTML on every render(), even when nothing changed. render() is also called by timers:
- afterAction's 650ms float-clear `setTimeout(() => { ui.floats = {}; render(); }, 650)`;
- the banner's 1800ms close timer.

If one of these re-renders lands **between mousedown and mouseup**, the 「天亮了」 button is replaced by a new node. The press and release happen on different nodes, the browser sends click to the common ancestor #winter, and `e.target.closest("[data-do]")` finds nothing. The click is silently lost.

In the test: playToWinter's last commit (the action that arrives at winter) waits 520ms, then the click follows immediately, so the 650ms timer fires about 130ms later. Playwright sends mousedown and mouseup as separate CDP messages, and under load the renderer can run that timer between them, giving an occasional failure. Real users are more exposed, since a press lasts ~100ms.

## Reproduction (deterministic)
At winter, wait 2.5s for the timers to drain → mouse.down at the #winter-end centre → keyboard Escape (which calls render()) → mouse.up. Before the fix the phase stays winter and #endseq stays hidden; the plain click is fine. Pure CPU load (4 busy loops + 4 parallel pick_hold, 48 runs) did not reproduce it: hitting the window needs specific timer timing, not just load.

## Fix (da1906e, extended whole-class)
patchHTML(el, html): skip the innerHTML assignment when the generated HTML equals the last render
(WeakMap cache per element, cleared by dropHTML when the element is hidden). An unchanged re-render
no longer replaces nodes, so the press/release pair stays on the same button.
Applied to **every** clickable container — #winter, #endseq, #elder, #wordbox, #card-drops, #menu-pop,
#goals-slip, #goals-panel, #coach, #card-art, #sidebar-body/#drawer-body, #dims/#dims-desktop — plus
#pick-desc; the pick screen instead keyed-patches its nodes so they are reused outright. #winter's
canvas redraws only when the HTML actually changes (patchHTML returns true). No retries, no added waits.

## Regression
tests/e2e/rerender_click.test.mjs, 3 engines: 天亮了 / 先人 / 交给第 n 代, each with a render() inserted between down and up; it must still advance. It fails on the pre-fix code (0/1) and passes with the fix.
The failure path also leaves evidence now: toPick/toPickDesktop write a screenshot plus state JSON to test-results/endseq-diag/ (phase, yearsLeft, banner, whether elementFromPoint hits #winter-end, the relevant overlays, running animations, the last actions, console errors) (e7679f6).

## Audit (whole class)

The winter case is one instance of a class: **any** container whose clickable children are
re-created by `innerHTML` during `render()` can lose a press that spans a re-render. `render()`
is called from timers (650ms float-clear, 1800ms banner) and from unrelated UI writes, so the
re-render can land between mousedown and mouseup on *any* screen.

Scan: `grep -n innerHTML web/app.js` → 6 hits, only 3 line numbers actually assign.

| line | assignment | what it is |
|---|---|---|
| 479 | `el.innerHTML = html` | inside `patchHTML()` — the single guarded writer |
| 542 | `el.innerHTML = …` | `buildPickSkeleton(#pick)` — runs **once** per pick screen (`dataset.pickBuilt`) |
| 590 | `node.innerHTML = …` | keyed `.pickslot` button content (icon+label), node reused |
| 599 | `node.innerHTML = …` | keyed `.cand` button content (icon+label+badge), node reused |

Clickable containers are those whose handler is **delegated** (`on(container, e => e.target.closest(sel))`),
so the pressed node is a descendant that a wholesale rebuild would replace.

| container | clickable children? | rendered by | handled how |
|---|---|---|---|
| `#winter` | yes — `[data-tally] [data-comp] [data-base] [data-pos] [data-do]` | `renderWinter` | `patchHTML` (skip if HTML unchanged), `dropHTML` when hidden |
| `#endseq` | yes — `[data-do=elder]` | `renderEnded` | `patchHTML` / `dropHTML` |
| `#elder` | yes — `[data-do=heir]` | `renderElder` | `patchHTML` / `dropHTML` |
| `#wordbox` | yes — `[data-slot]` | `renderWordbox` | `patchHTML` |
| `#card-drops` | yes — `[data-do=skip]` (delegated on `#card`) | `renderCard` | `patchHTML` / `dropHTML` |
| `#pick` | yes — `[data-char] [data-do]` | `renderPick` | **keyed patch**: `buildPickSkeleton` once + `patchKeyed` reuses `.pickslot`/`.cand`/`.go` nodes |
| `#menu-pop` | yes — `[data-menu]` | `renderMenu` | `patchHTML` / `dropHTML` |
| `#goals-slip` | itself clickable, no clickable child | `renderGoalSlip` | `patchHTML` / `dropHTML` |
| `#goals-panel` | no (text only) | `renderGoalPanel` | `patchHTML` / `dropHTML` |
| `#coach` | no | `renderCoach` | `patchHTML` / `dropHTML` |
| `#card-art` | no (art only) | `renderCard` | `patchHTML` |
| `#sidebar-body`, `#drawer-body` | no | `renderSide` | `patchHTML` |
| `#pick-desc` | no (info only) | `updatePickInfo` | `patchHTML` |
| `#keyhelp-pop` | no (rows only) | `renderShort` | `patchHTML` / `dropHTML` |
| `#dims`, `#dims-desktop` | no | `render`, `renderDimsOnly` | `patchHTML` |

Controls bound **on the element itself** (never `innerHTML`'d; the pressed node is the element, which
`render()` never replaces): `#bonecorner`, `#opt-left`, `#opt-right`, `#keyhelp-btn`, `#menubtn`,
`#goals-slip`, `#sidebar-tab`, `#wb-handle`, `#drawer-mask`, `#dlgcopy`, `#dlgapply`, `#dlgclose`.
Screens that only `textContent`-write (never touch nodes): `#topbar` numbers, `#card` text fields,
`#keys`, `#banner`, `#toast`.

Result: **every** clickable container is either `patchHTML`-guarded (unchanged HTML → no node swap)
or keyed-patched (nodes reused by key). No raw `innerHTML` remains on a clickable container except the
one-shot skeleton build and the two per-node content writes inside `patchKeyed`, both of which keep the
pressed node itself.

The whole class is exercised by tests/e2e/rerender_click.test.mjs §②: on each of the three engines it
replays **every** clickable element of a full game with a `render()` forced between down and up
(T01/T02 options, 刻, 落字, 先不刻, 冬夜的签/部件/底字/位置/清空/留到明年/刻/天亮了, 先人, 交棒,
挑字候选/格子/出发, 菜单键 + 静音, 目标小签, 存档弹层的关闭/复制/导入), asserting state advances each time.
