#!/bin/bash
# 造字人 web 测试一条命令：构建 → 本地服务 → e2e 套件 → 增量/矩阵脚本 → 版式 → （可选）审核入口 → 矩阵 CSV → 两门禁。
# 用法（仓库根目录）：bash qa/run_all.sh --quick            中间轮：375x667、360x800 触屏 + 1920x1080 桌面 × 三引擎
#                    bash qa/run_all.sh --full             合并版：R14 门内 15 格 × 三引擎 + R15 边界
# 选项：--engines "chromium firefox webkit"  --out DIR（默认 qa/out/<时间>）  --skip-build  --skip-e2e  --skip-layout  --port N（默认 9700）
# 环境：QA_LOCK（浏览器锁文件；默认若存在 /workspace/qa-locks/browser.lock 就用它）、PW_NODE_MODULES（默认 web/node_modules）
# 退出码：两门禁都过 = 0（结论可以是「不过门」，门禁只保证结论与矩阵一致）；门禁违规 = 1；用法/环境错误 = 2。
set -u
ROOT=$(cd "$(dirname "$0")/.." && pwd); QA=$ROOT/qa; T=$QA/test
MODE=quick; ENGINES="chromium firefox webkit"; OUT=""; SKIP_BUILD=0; SKIP_E2E=0; SKIP_LAYOUT=0; PORT=9700
while [ $# -gt 0 ]; do case "$1" in
  --quick) MODE=quick;; --full) MODE=full;; --engines) ENGINES=$2; shift;; --out) OUT=$2; shift;; --port) PORT=$2; shift;;
  --skip-build) SKIP_BUILD=1;; --skip-e2e) SKIP_E2E=1;; --skip-layout) SKIP_LAYOUT=1;;
  -h|--help) sed -n 2,8p "$0"; exit 0;; *) echo "未知参数 $1" >&2; exit 2;; esac; shift; done
OUT=${OUT:-$QA/out/$(date +%Y%m%d_%H%M%S)_$MODE}; mkdir -p "$OUT"; OUT=$(cd "$OUT" && pwd)
LOG=$OUT/run.log; say(){ echo "$(date '+%F %T') $*" | tee -a "$LOG"; }
# Node 22
if ! node -v 2>/dev/null | grep -q '^v22\.'; then [ -x /home/box/.local/node22/bin/node ] && export PATH=/home/box/.local/node22/bin:$PATH; fi
node -v | grep -q '^v22\.' || { echo "需要 Node 22（当前 $(node -v 2>&1)）" >&2; exit 2; }
LOCK=${QA_LOCK:-}; [ -z "$LOCK" ] && [ -e /workspace/qa-locks/browser.lock ] && LOCK=/workspace/qa-locks/browser.lock
L(){ if [ -n "$LOCK" ]; then flock "$LOCK" "$@"; else "$@"; fi; }
TIP=$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)
say "run_all --$MODE tip $TIP engines [$ENGINES] out $OUT lock ${LOCK:-无}"
# 1) 构建
if [ $SKIP_BUILD = 0 ]; then (cd "$ROOT/web" && npm ci --no-audit --no-fund && npm run build) > "$OUT/build.log" 2>&1 || { say "构建失败，见 build.log"; exit 2; }; fi
DIST=$ROOT/web/dist; VERSION=$(grep -o 'VERSION = "[^"]*"' "$DIST/sw.js" 2>/dev/null | cut -d'"' -f2); say "dist $DIST VERSION ${VERSION:-?}"
NM=${PW_NODE_MODULES:-$ROOT/web/node_modules}; [ -e "$T/node_modules" ] || ln -s "$NM" "$T/node_modules"
# 2) 本地服务（只按 PID 结束）
echo "$DIST" > "$OUT/.root"; python3 "$T/pages_server.py" "$PORT" "$OUT/.root" & SRV=$!; trap 'kill $SRV 2>/dev/null' EXIT; sleep 1; BASE=http://127.0.0.1:$PORT
curl -sf -o /dev/null "$BASE/" || { say "本地服务 $BASE 起不来（端口占用？换 --port）"; exit 2; }
: > "$OUT/jobs.tsv"
job(){ local name=$1 expect=$2; shift 2; local t0=$(date +%s); L timeout 900 "$@" >> "$OUT/logs/$name.log" 2>&1; local rc=$?
  local has=noout; ls $expect >/dev/null 2>&1 && has=out; printf '%s\t%s\t%s\t%s\t%ss\n' "$name" "$rc" "logs/$name.log" "$has" "$(( $(date +%s)-t0 ))" >> "$OUT/jobs.tsv"; say "  $name rc=$rc $has"; }
mkdir -p "$OUT/logs" "$OUT/p91" "$OUT/p21" "$OUT/keybar" "$OUT/carve" "$OUT/d4" "$OUT/short" "$OUT/p7" "$OUT/e2e"
. "$T/viewports.sh"
if [ $MODE = quick ]; then TOUCH_VPS=$VP_QUICK_TOUCH; DESK_VPS=$VP_QUICK_DESK; TAB_VPS=""; else TOUCH_VPS=$VP_PHONE; DESK_VPS=$VP_DESK; TAB_VPS=$VP_TABLET; fi
tmode(){ [ "$1" = chromium ] && echo emuA || echo phone; }
# 3) 增量/矩阵脚本（R 号见各脚本头）
say "增量脚本"
for e in $ENGINES; do
  for vp in $TOUCH_VPS $TAB_VPS; do m=$(tmode $e); case " $TAB_VPS " in *" $vp "*) m=tab;; esac
    job "p91_${e}_$vp" "$OUT/p91/p91_${e}_${vp}_$m.json" node "$T/p91_reset.mjs" $e $vp $m "$BASE" "$OUT/p91" 2
    job "p21_${e}_$vp" "$OUT/p21/p21_${e}_${vp}_touch.json" node "$T/p21_preview.mjs" $e $vp touch "$BASE" "$OUT/p21" 2
    job "keybar_${e}_$vp" "$OUT/keybar/keybar_${e}_${vp}_$m.json" node "$T/keybar.mjs" $e $vp $m "$BASE" "$OUT/keybar"
    job "carve_${e}_$vp" "$OUT/carve/cd_${e}_touch_$vp.json" env DELAY=100 VP_TOUCH=$vp node "$T/carve_dwell.mjs" $e "$BASE" "$OUT/carve/cd_${e}_touch_$vp.json" touch
    job "d4_${e}_$vp" "$OUT/d4/d4_${e}_${vp}_touch.json" node "$T/d4_restore.mjs" $e $vp touch "$BASE" "$OUT/d4"
    job "short_${e}_$vp" "$OUT/short/too_short_${e}_${vp}_mustnot.json" node "$T/too_short.mjs" $e $vp mustnot "$BASE" "$OUT/short"
    mkdir -p "$OUT/p7/${e}_$vp"; job "p7_${e}_$vp" "$OUT/p7/${e}_$vp/p7_*.csv" env VP_TOUCH=$vp node "$T/p7_audit.mjs" $e touch "$BASE" "$OUT/p7/${e}_$vp"
  done
  for vp in $DESK_VPS; do
    job "p91_${e}_$vp" "$OUT/p91/p91_${e}_${vp}_desk.json" node "$T/p91_reset.mjs" $e $vp desk "$BASE" "$OUT/p91" 2
    for inp in kbd mouse; do job "p21_${e}_${vp}_$inp" "$OUT/p21/p21_${e}_${vp}_$inp.json" node "$T/p21_preview.mjs" $e $vp $inp "$BASE" "$OUT/p21" 2; done
    job "keybar_${e}_$vp" "$OUT/keybar/keybar_${e}_${vp}_desk.json" node "$T/keybar.mjs" $e $vp desk "$BASE" "$OUT/keybar"
    job "carve_${e}_$vp" "$OUT/carve/cd_${e}_desk_$vp.json" env DELAY=100 VP_DESK=$vp node "$T/carve_dwell.mjs" $e "$BASE" "$OUT/carve/cd_${e}_desk_$vp.json" desk
    job "d4_${e}_$vp" "$OUT/d4/d4_${e}_${vp}_desk.json" node "$T/d4_restore.mjs" $e $vp desk "$BASE" "$OUT/d4"
    job "short_${e}_$vp" "$OUT/short/too_short_${e}_${vp}_mustnot.json" node "$T/too_short.mjs" $e $vp mustnot "$BASE" "$OUT/short"
    mkdir -p "$OUT/p7/${e}_$vp"; job "p7_${e}_$vp" "$OUT/p7/${e}_$vp/p7_*.csv" env VP_DESK=$vp node "$T/p7_audit.mjs" $e desk "$BASE" "$OUT/p7/${e}_$vp"
  done
  if [ $MODE = full ]; then
    for vp in $VP_SHORT_MUST; do job "short_${e}_$vp" "$OUT/short/too_short_${e}_${vp}_must.json" node "$T/too_short.mjs" $e $vp must "$BASE" "$OUT/short"; done
    for vp in $VP_SHORT_RECORD; do job "short_${e}_$vp" "$OUT/short/too_short_${e}_${vp}_record.json" node "$T/too_short.mjs" $e $vp record "$BASE" "$OUT/short"; done
  fi
done
# 4) 版式（R13/R14/R16/R18）
if [ $SKIP_LAYOUT = 0 ]; then say "版式"; LV="$TOUCH_VPS $TAB_VPS $DESK_VPS"; [ $MODE = full ] && LV="$LV $VP_SHORT_RECORD"
  job layout "$OUT/layout/MATRIX_layout_checks.csv" env ENGINES="$ENGINES" VPS="$LV" MOB_VPS="$TOUCH_VPS" MOB_KINDS="A" OOS_VPS="$([ $MODE = full ] && echo "$VP_SHORT_RECORD")" PORT=$((PORT+1)) PW_NODE_MODULES="$NM" bash "$T/layout/run_layout_checks.sh" "$DIST" "$OUT/layout"; fi
# 5) e2e 套件（web/tests/e2e，三引擎各一遍）
if [ $SKIP_E2E = 0 ]; then say "e2e"; for e in $ENGINES; do
  t0=$(date +%s); (cd "$ROOT/web" && L env E2E_ENGINES=$e timeout 5400 node --test --test-concurrency=1 --test-reporter=tap tests/e2e/*.test.mjs) > "$OUT/e2e/e2e_$e.tap" 2>&1; rc=$?
  printf 'e2e_%s\t%s\te2e/e2e_%s.tap\tout\t%ss\n' $e $rc $e $(( $(date +%s)-t0 )) >> "$OUT/jobs.tsv"; say "  e2e $e rc=$rc"; done; fi
# 6) 工程审核入口（qa/review/ 由审核维护；存在才调用，不创建不修改）
for r in "$QA/review/run_review.sh" "$QA/review/run.sh"; do [ -f "$r" ] && { say "审核入口 $r"; mkdir -p "$OUT/review"; bash "$r" "$DIST" "$OUT/review" > "$OUT/review/run.log" 2>&1; say "  review rc=$?"; break; }; done
# 7) 矩阵 + 两门禁
python3 "$T/collect.py" "$OUT" "$MODE" "$TIP${VERSION:+ VERSION $VERSION}" > "$OUT/collect.log" 2>&1 || { cat "$OUT/collect.log"; say "矩阵汇总失败（collect.py），见 collect.log"; exit 2; }; cat "$OUT/collect.log" | tee -a "$LOG"
{ echo "== verdict_gate"; python3 "$QA/gate/verdict_gate.py" "$OUT/MATRIX.csv" "$OUT/REPORT.md"; g1=$?; echo "rc=$g1"
  echo "== sticky_blocked"; python3 "$QA/gate/sticky_blocked.py" "$OUT/REPORT.md" --ledger "${QA_LEDGER:-$QA/gate/BLOCKED_LEDGER.tsv}"; g2=$?; echo "rc=$g2"; exit $(( g1 || g2 )); } > "$OUT/gate.txt" 2>&1; GRC=$?
cat "$OUT/gate.txt" | tee -a "$LOG"; head -1 "$OUT/REPORT.md" | tee -a "$LOG"; say "完成：$OUT/REPORT.md  $OUT/MATRIX.csv  $OUT/gate.txt"
exit $GRC
