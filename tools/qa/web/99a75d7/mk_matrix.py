# 合成矩阵（每步后调用，增量落盘）
import csv,glob,re,os,sys
Q=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(Q)
rows=[]
for f in sorted(glob.glob('run/matrix_*.csv')):
    for r in list(csv.reader(open(f)))[1:]:
        if len(r)!=7: continue
        b,i,e,v,res,n,s=r
        if b=='P2-3' and '360' in i and v.isdigit() and 1024<=int(v)<1280:
            res='N/A'; n+='；PM裁定：1024–1279「说明卡宽约360」作废，按 W7 判'
        if b=='常规N' and '1366' in i: n+='；字匣83对稿64仅记录'
        rows.append([b,i,e,v,res,n,'run/'+s if s else ''])
ex=[['构建','干净快照两次构建 VERSION 一致','-','-','PASS','f243a91ccb14 ×2，与 REDESIGN_REPORT 一致','logs/build1.log'],
['祖先','ab6a626 以 cc21503 cherry-pick','-','-','PASS','patch-id 相同，是 99a75d7 祖先','logs/ancestry.txt'],
['单测','unit 28/28','-','-','PASS','28/28','logs/unit.log']]
for k in (1,2,3):
    f=f'logs/e2e_run{k}.log'
    if os.path.exists(f) and os.path.exists(f'run/done/e2e{k}'):
        t=open(f).read(); p=re.search(r'^# pass (\d+)',t,re.M); fl=re.search(r'^# fail (\d+)',t,re.M)
        ok=p and fl and fl.group(1)=='0' and p.group(1)=='202'
        ex.append(['e2e',f'全量第{k}次（称202/202）','-','-','PASS' if ok else 'FAIL',f'pass {p and p.group(1)} fail {fl and fl.group(1)}',f])
ex.append(['设备','触屏+触控板混用 / 真机','-','-','部分验证','未上真机','N/A'])
rows=ex+rows
w=csv.writer(open('MATRIX_zaozi_web_99a75d7.csv','w'));w.writerow(['块','项','引擎','视口','判定','原因','证据路径']);w.writerows(rows)
from collections import Counter;print(len(rows),dict(Counter(r[4] for r in rows)))
