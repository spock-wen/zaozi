#!/bin/bash
# 99a75d7 串行全跑，可断点续；每步后合成矩阵并增量同步 store
Q=/workspace/qa-zaozi-web-99a75d7; D=/cursor/stores/store-5d48a5e4-1d9a-4785-b9b0-15909972afc9/qa-zaozi-web-99a75d7
cd $Q; export PATH=/home/box/.local/node22/bin:$PATH DIST=$Q/src/dist; mkdir -p run/done $D/partial
sync_() { python3 qa/mk_matrix.py > logs/matrix_count.txt 2>&1; cp MATRIX_zaozi_web_99a75d7.csv logs/*.log logs/matrix_count.txt $D/partial/ 2>/dev/null; cp run/*.csv run/*.log $D/partial/ 2>/dev/null; }
step() { local id=$1; shift; [ -f run/done/$id ] && return; "$@" && touch run/done/$id; sync_; }
for i in 1 2 3; do step e2e$i bash -c "cd /workspace/qa-zaozi-web-repo && npm run e2e > $Q/logs/e2e_run$i.log 2>&1; true"; done
P=6600; for e in chromium firefox webkit; do P=$((P+10))
  step touch_$e bash -c "node qa/touch.mjs $e $P run 20 > run/touch_$e.log 2>&1"
  step short_$e bash -c "node qa/short.mjs $e $((P+1)) run > run/short_$e.log 2>&1"
  step w8_$e bash -c "node qa/race2.mjs $e $((P+2)) run 20 > run/w8_$e.log 2>&1"
  step w7_$e bash -c "node qa/geo2.mjs $e $((P+3)) run > run/w7_$e.log 2>&1"
  step review_$e bash -c "node qa/review.mjs $e $((P+4)) run > run/review_$e.log 2>&1"
  step w5_$e bash -c "node qa/w5.mjs $e $((P+5)) run > run/$e.log 2>&1"
done
step w6 bash -c "node qa/w6.mjs 6700 run > run/w6.log 2>&1"
touch run/all.done
