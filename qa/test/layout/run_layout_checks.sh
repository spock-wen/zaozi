#!/bin/bash
# R号: R13 R14 R15 R16 R18（版式；R15 太矮条另见 qa/test/too_short.mjs）
# 版式自动检查入口（A 文字框不出界、B 提示所指可见、C 对比度、S FIX_SPEC v6.1 验收 1–6、8、E 核心交互元素在全部视口可见；
# 反证见 selftest_inject.mjs / selftest2_inject.mjs / selftest_e_inject.mjs）：bash qa/checks/run_layout_checks.sh <dist目录或URL> [输出目录]
# CHECKS="ABCSE"（默认全跑）；CHECKS=E 只跑 E。E 判据见 inpage_e.js，各元素必须可见的阶段见 layout_checks.mjs 文件头。
# 环境变量：ENGINES="chromium firefox webkit"  VPS="..."（默认主流清单+范围外）  MOB_VPS（chromium 移动模拟尺寸，默认 VP_PHONE）  MOB_KINDS（默认 "A I"）  OOS_VPS（默认 VP_OOS）
#           PORT（本地服务端口，默认 9640）  PW_NODE_MODULES（playwright 所在 node_modules）
# 串行跑（不并行），每格：三引擎 × 尺寸 + chromium 移动模拟（isMobile/hasTouch/DPR3）。
# 产物：<out>/MATRIX_layout_checks.csv（块,项,引擎,视口,判定,原因,证据路径）、shots/、raw/*.json、static_hint_coverage.txt
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
TARGET=${1:?用法: run_layout_checks.sh <dist目录或URL> [输出目录]}
OUT=${2:-$PWD/layout_checks_out}; mkdir -p "$OUT"; OUT=$(cd "$OUT" && pwd)
ENGINES=${ENGINES-"chromium firefox webkit"}
# 视口默认取主流清单 qa/test/viewports.sh（VP_PHONE/VP_TABLET/VP_DESK/VP_OOS 可覆盖）；VPS / MOB_VPS 直接给则以其为准。
. "$HERE/../viewports.sh"
VPS=${VPS-"$VP_PHONE $VP_TABLET $VP_DESK $VP_OOS"}
MOB_VPS=${MOB_VPS-"$VP_PHONE"}
MOB_KINDS=${MOB_KINDS-"A I"}   # chromium 移动模拟：A=Android UA，I=iPhone UA，1=默认 UA（旧行为）
OOS_VPS=${OOS_VPS-"$VP_OOS"}  # 范围外：版式格一律记 N/A（原因写「范围外」+原判定），只由 ms_checks 的 #too-short 三件事门禁
PORT=${PORT:-9640}
export CHECKS=${CHECKS:-ABCSE}
[ -d /home/box/.local/node22/bin ] && export PATH=/home/box/.local/node22/bin:$PATH
[ -e "$HERE/node_modules" ] || ln -s "${PW_NODE_MODULES:-$(cd "$HERE/../../.." && pwd)/web/node_modules}" "$HERE/node_modules"
SRV=""
if [[ "$TARGET" =~ ^https?:// ]]; then BASE=${TARGET%/}; APPROOT=""
else
  DIST=$(cd "$TARGET" && pwd); echo "$DIST" > "$OUT/.root"; APPROOT=$DIST
  if ss -ltn | grep -q ":$PORT "; then echo "端口 $PORT 已占用，换 PORT=" >&2; exit 2; fi
  python3 "$HERE/../pages_server.py" "$PORT" "$OUT/.root" & SRV=$!; sleep 0.8; BASE="http://127.0.0.1:$PORT"
fi
trap '[ -n "$SRV" ] && kill $SRV 2>/dev/null' EXIT
echo "目标 $BASE  输出 $OUT  CHECKS=$CHECKS" | tee "$OUT/run.log"
# 静态：源码里的提示文案都要在 hint_map.json 里登记
if [ -n "$APPROOT" ] && [[ "$CHECKS" == *B* ]]; then
  python3 "$HERE/extract_hints.py" "$APPROOT" > "$OUT/hints_extracted.json" && \
  python3 "$HERE/static_coverage.py" "$OUT/hints_extracted.json" "$HERE/hint_map.json" > "$OUT/static_hint_coverage.txt"
fi
for e in $ENGINES; do for vp in $VPS; do node "$HERE/layout_checks.mjs" $e $vp 0 "$BASE" "$OUT" >> "$OUT/run.log" 2>&1 || echo "FAIL-RUN $e $vp" >> "$OUT/run.log"; done; done
if [[ " $ENGINES " == *" chromium "* ]]; then for mk in $MOB_KINDS; do for vp in $MOB_VPS; do node "$HERE/layout_checks.mjs" chromium $vp $mk "$BASE" "$OUT" >> "$OUT/run.log" 2>&1 || echo "FAIL-RUN mob$mk $vp" >> "$OUT/run.log"; done; done; fi
{ echo "块,项,引擎,视口,判定,原因,证据路径"; [ -f "$OUT/static_rows.csv" ] && cat "$OUT/static_rows.csv"; cat "$OUT"/matrix_*.csv; } > "$OUT/MATRIX_layout_checks.csv"
python3 - "$OUT/MATRIX_layout_checks.csv" "$OOS_VPS" <<'PY'
import csv,sys,collections
rows=list(csv.DictReader(open(sys.argv[1],encoding="utf-8"))); oos=set(sys.argv[2].split())
for r in rows:
    if r["视口"].split()[0] in oos and r["判定"] in ("PASS","FAIL","PARTIAL"):
        r["原因"]=f"范围外（版式不作门禁，原判定 {r['判定']}）：{r['原因']}"; r["判定"]="N/A"
if oos:
    with open(sys.argv[1],"w",encoding="utf-8",newline="") as fh:
        w=csv.DictWriter(fh,fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
c=collections.Counter((r["块"],r["判定"]) for r in rows); print("格数",len(rows)); [print(" ",k,v) for k,v in sorted(c.items())]
bad=sum(1 for r in rows if r["判定"]=="FAIL"); print("FAIL",bad); sys.exit(1 if bad else 0)
PY
