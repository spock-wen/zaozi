import json,csv,hashlib,glob,os
os.chdir('/workspace/zaozi-formal/v5_cardart')
cards=json.load(open('src/cards_year1.json'))
M={'族长':'elder','巫':'shaman','采集的妇人':'gatherer','东岸的使者':'river','守堤的老汉':'river','北山来的赶路者':'north','北山的人':'north','族里最壮的汉子':'strong'}
S={'spring':'春','summer':'夏','autumn':'秋','winter':'冬'}
rows=[]
for c in cards:
    k=M[c['speaker']]
    rows.append(dict(id=c['id'],season=S[c['season']],speaker=c['speaker'],art=k,mobile_1x=f'assets/{k}_m@1x.webp',mobile_2x=f'assets/{k}_m@2x.webp',desktop_1x=f'assets/{k}_d@1x.webp',desktop_2x=f'assets/{k}_d@2x.webp',png_fallback=f'assets/{k}_{{m|d}}@{{1|2}}x.png'))
for r in rows: r['note']=''
k='strong'
rows.append(dict(id='gf4-休',season='冬',speaker='冬夜 · 「休」入字录（设计稿 gf4 ③ 与电脑端）',art=k,mobile_1x=f'assets/{k}_m@1x.webp',mobile_2x=f'assets/{k}_m@2x.webp',desktop_1x=f'assets/{k}_d@1x.webp',desktop_2x=f'assets/{k}_d@2x.webp',png_fallback=f'assets/{k}_{{m|d}}@{{1|2}}x.png',note='借用 strong 图，画面与「人靠在木旁边」不符，待专画；不进正式版'))
json.dump(rows,open('card_art_map.json','w'),ensure_ascii=False,indent=1)
with open('card_art_map.csv','w',newline='') as f:
    w=csv.DictWriter(f,fieldnames=rows[0].keys());w.writeheader();w.writerows(rows)
sh={os.path.basename(p):(hashlib.sha256(open(p,'rb').read()).hexdigest()[:16],os.path.getsize(p)) for p in sorted(glob.glob('assets/*'))}
desc={'elder':'族长：田边背影持杖，草屋，红日','shaman':'巫：双臂举骨片，祭火，弯月','gatherer':'采集的妇人：塌坡露出根须，背筐背影','river':'河岸：宽河、土坎，对岸三人影（东岸 / 守堤共用）','north':'北山来客：远山，持杖赶路人，牛（赶路者 / 北山的人共用）','strong':'壮汉：陷泥的粟车，撬杠'}
L=['# 卡面图映射（设计稿，非玩法示意）','','来源数据：原为 `pc_web_milestone1/data/year1_cards.json`（feat/web-redesign-v2 @e069842）。**10-14 重建**：代码目录已不在，按对话记录里的 C01–C10（`src/cards_year1.json`）重出。共 10 张卡、8 个出场人物；6 张图覆盖全部卡。','','| 卡 | 季 | 人物 | 图 | 手机 1x / 2x | 电脑 1x / 2x |','|---|---|---|---|---|---|']
for r in rows: L.append(f"| {r['id']} | {r['season']} | {r['speaker']} | {r['art']} | `{r['mobile_1x']}` / `{r['mobile_2x']}` | `{r['desktop_1x']}` / `{r['desktop_2x']}` |")
L+=['','PNG 兜底同名换后缀 `.png`。另附 `card_art_map.csv`、`card_art_map.json`。','','## 六张图','| 图 | 内容 | 用于 |','|---|---|---|']
for k,v in desc.items(): L.append(f"| {k} | {v} | {', '.join(r['id'] for r in rows if r['art']==k)} |")
L+=['','## 为什么是 6 张','- 按人物复用：族长（C01、C10）、巫（C03、C09）各出场两次，一人一图。','- 再按场景合并：东岸的使者（C04）和守堤的老汉（C06）都是「河与岸」的事，共用河岸图；北山来的赶路者（C05）和北山的人（C08）都是「北山来人」，共用北山图。','- 采集的妇人、族里最壮的汉子场景独特（塌坡、陷车），各一张。','- 再少就要让不同人物共用一张无辨识度的图，卡面失去「这次是谁」的提示，所以停在 6。','- 季节不另出图：卡头已有季名。','','## 尺寸','- 手机 296×216（v2_1 卡面图位）。','- 电脑 400×292：BREAKPOINTS 最大卡高 640 → 宽 448，内边距 24 → 图宽 400，按手机比例等比。**已定：电脑图位按 400×292 比例，不裁切**（卡内宽 388 → 图高 283；364 宽卡 → 231）。','- 各 1x、2x；webp（q82）+ png（32 色调色板）。','','## 文件 sha16','| 文件 | 字节 | sha16 |','|---|---|---|']
for k,(h,s) in sh.items(): L.append(f'| {k} | {s} | {h} |')
L+=['','## 借图登记','- `gf4-休`（冬夜「休」入字录，gf4 ③ 与电脑端）：借用 strong 图（推车），与「人靠在木旁边」不符，待专画，不进正式版。']
open('CARD_ART_MAP.md','w').write('\n'.join(L)+'\n')
