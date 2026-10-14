#!/bin/bash
# 等 e2e 结束后在空闲机器上串行跑
cd /workspace/qa-zaozi-web-b12d7f1; export PATH=/home/box/.local/node22/bin:$PATH DIST=$PWD/src/dist
while [ ! -f logs/e2e.done ]; do sleep 10; done
P=6000; for e in chromium firefox webkit; do
  P=$((P+10)); node qa/race2.mjs $e $P run 20 > run/w8_$e.log 2>&1
  node qa/geo2.mjs $e $((P+1)) run > run/w7_$e.log 2>&1
  node qa/review.mjs $e $((P+2)) run > run/review_$e.log 2>&1
  node qa/w5.mjs $e $((P+3)) run > run/$e.log 2>&1
done
node qa/w6.mjs 6100 run > run/w6.log 2>&1
touch run/all.done
