#!/bin/bash
# 92cf10a 串行全跑（可断点续：已有 done 标记的步骤跳过）
Q=/workspace/qa-zaozi-web-92cf10a; cd $Q; export PATH=/home/box/.local/node22/bin:$PATH DIST=$Q/src/dist; mkdir -p run/done
step() { local id=$1; shift; [ -f run/done/$id ] && return; "$@" && touch run/done/$id; }
for i in 1 2 3; do step e2e$i bash -c "cd ${REPO:-/workspace/qa-zaozi-web-repo} && npm run e2e > $Q/logs/e2e_run$i.log 2>&1; true"; done
P=6400; for e in chromium firefox webkit; do P=$((P+10))
  step touch_$e bash -c "node qa/touch.mjs $e $P run 20 > run/touch_$e.log 2>&1"
  step short_$e bash -c "node qa/short.mjs $e $((P+1)) run > run/short_$e.log 2>&1"
  step w8_$e bash -c "node qa/race2.mjs $e $((P+2)) run 20 > run/w8_$e.log 2>&1"
  step w7_$e bash -c "node qa/geo2.mjs $e $((P+3)) run > run/w7_$e.log 2>&1"
  step review_$e bash -c "node qa/review.mjs $e $((P+4)) run > run/review_$e.log 2>&1"
  step w5_$e bash -c "node qa/w5.mjs $e $((P+5)) run > run/$e.log 2>&1"
done
step w6 bash -c "node qa/w6.mjs 6500 run > run/w6.log 2>&1"
touch run/all.done
