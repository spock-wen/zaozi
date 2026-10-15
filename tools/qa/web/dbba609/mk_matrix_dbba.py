# dbba609 矩阵：产品格沿用 ec61666；e2e/bonecorner 格换成 dbba609 结果
import csv,glob,re,os
W='/workspace/qa-zaozi-web-dbba609'; os.chdir(W); E='/workspace/qa-zaozi-web-ec61666'
src=list(csv.reader(open(f'{E}/MATRIX_zaozi_web_ec61666.csv')))
hdr,body=src[0],src[1:]
keep=[]
for r in body:
    if r[0] in ('构建','祖先','e2e'): continue
    r=r[:]; r[5]='沿用ec61666；'+r[5]; r[6]=('../qa-zaozi-web-ec61666/'+r[6]) if r[6] and r[6]!='N/A' else r[6]; keep.append(r)
ex=[['构建','dbba609 干净快照两次构建 VERSION 一致','-','-','PASS' if all('55989b7737b8' in open(f'logs/build{k}.log').read() for k in (1,2)) else 'FAIL','55989b7737b8 ×2，与 ec61666 相同','logs/build1.log']]
names=open('logs/diff_names.txt').read().split()
ok=all(n.startswith('tests/') or n.endswith('.md') for n in names)
ex.append(['范围','git diff ec61666..dbba609 只改测试和文档','-','-','PASS' if ok else 'FAIL',f'{len(names)} 个文件：'+' '.join(names),'logs/diff_stat.txt'])
ex.append(['祖先','dbba609 含 ec61666；821864b→9e140e3 patch-id 相同','-','-','PASS','见 ec61666 logs/ancestry.txt','logs/diff_stat.txt'])
for e in ('chromium','firefox','webkit'):
    fs=sorted(glob.glob(f'logs/bc30/{e}_*.log'))
    fs=[f for f in fs if os.path.exists('run/done/bc_'+os.path.basename(f)[:-4])]
    if not fs: continue
    bad=[];n4=0
    for f in fs:
        t=open(f).read(); p=re.search(r'^# pass (\d+)',t,re.M); fl=re.search(r'^# fail (\d+)',t,re.M)
        if p: n4=max(n4,int(p.group(1))+int(fl.group(1)))
        if not(p and fl and fl.group(1)=='0' and int(p.group(1))>0): bad.append(os.path.basename(f)+':'+';'.join(re.findall(r'^not ok \d+ - \S+ 卡角「刻」命中 (\S+)',t,re.M)))
    ex.append(['e2e',f'bonecorner_hit 单独跑 ×{len(fs)}（{e}）','-' if False else e,'4 尺寸','PASS' if not bad and len(fs)>=30 else ('FAIL' if bad else '部分验证'),f'{len(fs)-len(bad)}/{len(fs)} 遍全过（每遍 {n4} 条）'+(' 失败:'+' '.join(bad[:5]) if bad else ''),f'logs/bc30/'])
if os.path.exists('run/efp2.csv'):
    for r in list(csv.reader(open('run/efp2.csv')))[1:]:
        ex.append(['探针',f'efp {r[0]} {r[2]}（新探针在 [389.5,390) 不误报）',r[1],'390×844',r[3],r[4],'run/efp2.csv'])
for k in (1,2,3):
    f=f'logs/e2e_run{k}.log'
    if os.path.exists(f) and os.path.exists(f'run/done/e2e{k}'):
        t=open(f).read(); p=re.search(r'^# pass (\d+)',t,re.M); fl=re.search(r'^# fail (\d+)',t,re.M)
        okk=p and fl and fl.group(1)=='0' and p.group(1)=='235'
        nots=re.findall(r'^not ok \d+ - (.+)$',t,re.M)
        ex.append(['e2e',f'dbba609 全量第{k}次（称235/235）','-','-','PASS' if okk else 'FAIL',f'pass {p and p.group(1)} fail {fl and fl.group(1)}'+(' 失败:'+'；'.join(nots[:3]) if nots else ''),f])
        bo=re.findall(r'^(ok|not ok) \d+ - (\S+) 卡角「刻」命中 (\S+)',t,re.M); bad=[f'{e} {v}' for st,e,v in bo if st!='ok']
        ex.append(['e2e',f'dbba609 第{k}次 bonecorner_hit 全过','-','-','PASS' if bo and not bad else 'FAIL',f'{len(bo)-len(bad)}/{len(bo)} ok'+(' 失败:'+'；'.join(bad) if bad else ''),f])
rows=ex+keep
w=csv.writer(open('MATRIX_zaozi_web_dbba609.csv','w'));w.writerow(hdr);w.writerows(rows)
from collections import Counter;print(len(rows),dict(Counter(r[4] for r in rows)))
