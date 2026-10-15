#!/usr/bin/env python3
"""合并 run/ + run390/ + rerun/ 的分引擎矩阵，套用人工复核裁定，输出 MATRIX_zaozi_web_721f03a.csv"""
import csv,glob,os
R='/workspace/qa-zaozi-web-721f03a'
def load(f,sub):
    out=[]
    for r in csv.DictReader(open(f,encoding='utf8')):
        r['shot']=';'.join(os.path.join(sub,s.strip()) for s in r['shot'].split(';') if s.strip()); out.append(r)
    return out
rows=[]
main={e:load(f'{R}/run/matrix_{e}.csv','run') for e in ['chromium','firefox','webkit']}
override={}
for f in glob.glob(f'{R}/rerun/*/matrix_*.csv'):
    sub=os.path.relpath(os.path.dirname(f),R); r=load(f,sub); e,v=os.path.basename(os.path.dirname(f)).split('_'); override[(e,v)]=r
override[('chromium','390')]=load(f'{R}/run390/matrix_chromium.csv','run390')
for e,rs in main.items():
    done=set()
    for r in rs:
        k=(e,r['viewport'])
        if k in override and (r['block'],r['item']) in {(x['block'],x['item']) for x in override[k]} | {('上线清单','整年通关'),('交互遮挡',r['item'] if r['block']=='交互遮挡' else None)}:
            if k not in done: rows+=override[k]; done.add(k)
            continue
        rows.append(r)
def judge(r):
    res,note,item,v=r['result'],r['note'],r['item'],r['viewport']
    why=note
    if res=='FAIL' and r['block']=='交互遮挡' and v=='1024' and 'coachcol' in note:
        return 'FAIL','W2 教学气泡#coachcol 盖住卡角「刻」；鼠标点不到（K 键可用）'
    if res=='FAIL' and r['block']=='交互遮挡' and v in('768','1280','1440'):
        return '部分验证','矩阵内真点「刻」超时，独立脚本 qa/dbg4.mjs 3 种时序+菜单开合均复现不了，未定为缺陷；该步改 el.click 继续'
    if res=='FAIL' and item.startswith('/credits.html 308'):
        return 'PASS','SW 已装：/credits.html 由 SW 直接回字源页内容不再 308（离线组同样验证内容=字源页）；URL 断言过严，复核改判'
    if res=='FAIL' and item.startswith('菜单「字源与版权」'):
        return 'FAIL','W1 菜单里的「字源与版权」链接点了不跳转：app.js:160 on() 对 #menu-pop 所有 click preventDefault'
    if res=='FAIL' and 'G_FAITH_65' in item:
        return 'PASS','扫描等待 4s 不够排完 3 条横幅；qa/banner_recheck.mjs 同种子 1555 等 9s 看到「达成　代末「信」够六十五」，证据 run/shots/banner_recheck_1555.png'
    if res=='FAIL' and item.startswith('模拟9d0bdec'):
        return '部分验证','合成的 9d0bdec 型坏 SW 在 chromium/webkit 8 次打开不恢复（firefox 恢复）；9d0bdec 从未上线，线上 7dc14fa→新版升级路径三引擎 PASS；遗留行为 PM 已裁过，不计本版缺陷'
    if res=='BLOCKED': return 'BLOCKED',note+'；代码面 app.js:296 统一用 ev.banner，未运行时见到'
    return res,why
out=[]
for r in rows:
    j,why=judge(r)
    out.append({'块':r['block'],'项':r['item'],'引擎':r['engine'],'视口':r['viewport'],'判定':j,'原因':why if j!='PASS' else (why or ''),'证据路径':r['shot'] or ('run/'+r['engine']+'.log')})
# 构建/版本格（手工）
out.append({'块':'构建','项':'干净快照 npm run build','引擎':'-','视口':'-','判定':'FAIL','原因':'W4 无 dist 时 ENOENT 崩（version_hash 在建 dist 前扫 dist）','证据路径':'logs/build_clean.log'})
out.append({'块':'构建','项':'VERSION=内容哈希且与本次产物一致','引擎':'-','视口':'-','判定':'FAIL','原因':'W4 版本号算的是上一次 dist：首建=e3b0c44298fc(空哈希)，第二次才=3232828264d4','证据路径':'logs/build_clean.log'})
out.append({'块':'仓库自带','项':'单测 17/17','引擎':'node22','视口':'-','判定':'PASS','原因':'','证据路径':'logs/unit.log'})
out.append({'块':'仓库自带','项':'e2e 46/46','引擎':'3引擎','视口':'-','判定':'PASS','原因':'','证据路径':'logs/e2e.log'})
out.append({'块':'卡图','项':'48 个文件 sha 与设计师 store/SHA256SUMS 三方一致，尺寸 296×216/592×432/400×292/800×584','引擎':'-','视口':'-','判定':'PASS','原因':'agy 生成+我复核 sha256sum diff','证据路径':'cardart/sha_compare.csv'})
out.append({'块':'卡图','项':'「休」借用 strong 图不上线','引擎':'-','视口':'-','判定':'PASS','原因':'card_art_map 中 gf4-休 标不进正式版；运行时先人卡无图','证据路径':'cardart/sha_compare.csv'})
out.append({'块':'文案','项':'刻字卡「卡上出现一道迹」','引擎':'3引擎','视口':'全部','判定':'FAIL','原因':'W3 显示「卡上出现一道迹：undefined」：app.js:326 读 pendingTrace.text，数据字段是 target/tally_text','证据路径':'run/shots/chromium_1280_blocked__bonecorner.png'})
out.append({'块':'决策2','项':'60fps(4x CPU 节流)','引擎':'chromium','视口':'-','判定':'部分验证','原因':'只由仓库 e2e fps.test 覆盖（通过），QA 未独立测','证据路径':'logs/e2e.log'})
out.append({'块':'决策7','项':'横幅只在飘字结束后出现','引擎':'-','视口':'-','判定':'部分验证','原因':'只由仓库 e2e 覆盖，QA 未独立断言时序','证据路径':'logs/e2e.log'})
w=csv.DictWriter(open(f'{R}/MATRIX_zaozi_web_721f03a.csv','w',encoding='utf8',newline=''),fieldnames=list(out[0].keys())); w.writeheader(); w.writerows(out)
from collections import Counter
print(len(out),Counter(o['判定'] for o in out))
c=Counter((o['块'],o['判定']) for o in out)
for k in sorted(c): print(k,c[k])
