# zaozi-web rebuild notes (interim, 2026-10-14 10:40 UTC+8)
## Recovered
- baseline_dist/: 129 files mirrored from https://zaozi.pages.dev, every fetch HTTP 200, sw.js VERSION=7dc14fa2ab57. index.html fetched from / and credits.html from /credits (Pages 308s the .html URLs). Precache list = 128 entries + sw.js.
- _headers: NOT fetchable (Pages serves the SPA HTML for /_headers). Original content is known from notes: `/sw.js` Cache-Control: no-cache.
- Origin: github.com/spock-wen/zaozi-web (private). A post-commit hook auto-pushes all branches after each commit; failures go to .git/push_fail.log.
## Source reconstruction (Command Code, done 2026-10-14)
- src/rng.ts, savecode.ts, engine.ts, types.ts, validator.ts: type annotations sized to fill the stripped whitespace exactly; stripTypeScriptTypes round-trip is byte-identical (tools/check_strip.mjs).
- web/app.js dev shell (BUILD_DIST=false, GLYPH_BASE="../", ../src imports) + web/serve.mjs + web/serve_pages.mjs.
- tools/: build_dist.mjs, sw.template.js ({{VERSION}}/{{FILES}}), version_hash.mjs (+baseline_version.txt pin), credits_table.mjs + credits_template.html (__COUNT__/__ROWS__), public_csv.mjs, compare_baseline.mjs.
- tests/: node --test, 10 cases green.
- `npm run build` → dist/ is byte-identical to baseline_dist/ (129/129; only _headers extra, expected — not fetchable live). See REBUILD_PROGRESS.md for the per-file list.
## Gaps
- Types are inferred, not original. The private glyph CSV (with notes) is lost; only the public CSV survives.
- Version-hash algorithm unknown: 7 sha256 variants tried, none reproduced 7dc14fa2ab57.
- The whole redesign branch (e069842) is lost and must be redone.
## Tool failures
- 09:3x UTC+8: the cmd from the restored snapshot (v1.74) needed Node ≥22 and the box had v20.19.2. Fixed by installing Node v22.23.3 at ~/.local/node22; system node untouched.
- ~09:40: the first cmd run self-updated to 1.82.1 and exited without doing any work. The nohup and setsid background runs died silently with empty logs. A foreground run under a Shell background job works. Model: default deepseek/deepseek-v4.1-flash.
## Queued for redesign batch
- 11 PM decisions, review P0/P1/P2, QA D1–D4, final punch list; GOALS_COPY v2.1.
- Card art from designer store v5_cardart (picture/srcset webp+png, desktop 400x292 no crop, precached, no art on 先人 card).
- Credits row for 水 seal from SOURCES.csv. The CSV has NO author column and does not mention Richard Sears. Need a decision on where the Sears credit text comes from.
- Workspace copy of v4_gamefeel/glyphs lacks shui_seal.svg; only the designer store copy has it.
