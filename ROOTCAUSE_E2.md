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

## Fix (da1906e)
patchHTML(el, html): skip the innerHTML assignment when the generated HTML equals the last render (WeakMap cache per element, cleared when hidden). An unchanged re-render no longer replaces nodes, so the press/release pair stays on the same button. Applies to #winter (the canvas redraws only when the HTML actually changes), #endseq and #elder. No retries, no added waits.

## Regression
tests/e2e/rerender_click.test.mjs, 3 engines: 天亮了 / 先人 / 交给第 n 代, each with a render() inserted between down and up; it must still advance. It fails on the pre-fix code (0/1) and passes with the fix.
The failure path also leaves evidence now: toPick/toPickDesktop write a screenshot plus state JSON to test-results/endseq-diag/ (phase, yearsLeft, banner, whether elementFromPoint hits #winter-end, the relevant overlays, running animations, the last actions, console errors) (e7679f6).
