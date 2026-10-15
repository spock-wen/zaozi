#!/bin/bash
# dbba609：等 ec61666 run_all 跑完后串行跑；可断点续（每遍/每步落标记）
W=/workspace/qa-zaozi-web-dbba609; D=/cursor/stores/store-5d48a5e4-1d9a-4785-b9b0-15909972afc9/qa-zaozi-web-dbba609
export PATH=/home/box/.local/node22/bin:$PATH; cd $W; mkdir -p run/done logs/bc30 $D/partial
while [ ! -f /workspace/qa-zaozi-web-ec61666/run/all.done ]; do sleep 30; done
sync_() { python3 qa/mk_matrix_dbba.py > logs/matrix_count.txt 2>&1; cp MATRIX_zaozi_web_dbba609.csv logs/*.txt logs/*.log $D/partial/ 2>/dev/null; cp -r logs/bc30 run/*.csv $D/partial/ 2>/dev/null; }
for e in chromium firefox webkit; do for i in $(seq 1 30); do f=logs/bc30/${e}_$i.log; [ -f run/done/bc_${e}_$i ] && continue
  (cd co && E2E_ENGINES=$e node --test --test-concurrency=1 tests/e2e/bonecorner_hit.test.mjs > $W/$f 2>&1); touch run/done/bc_${e}_$i; done; sync_; done
[ -f run/done/efp2 ] || { DIST=$W/snap/dist node qa/efp2.mjs 7700 run 5 > run/efp2.log 2>&1 && touch run/done/efp2; sync_; }
for i in 1 2 3; do [ -f run/done/e2e$i ] && continue; (cd co && npm run e2e > $W/logs/e2e_run$i.log 2>&1); touch run/done/e2e$i; sync_; done
touch run/all.done
