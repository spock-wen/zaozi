# 由 v1 底稿依次套 v2、v2.1 修改，生成 mobile_layout_v2_1.html（重建版）
import os
os.chdir(os.path.dirname(os.path.abspath(__file__))+'/..')
s=open('src/v1_base.html').read()
V2=[('手机竖屏重排 v1','手机竖屏重排 v2'),
('.ill{margin:16px 0;height:150px;','.ill{margin:12px 0;height:214px;background:linear-gradient(160deg,#E4D6B8,#CDBB94);'),
('卡面插画区','卡面图（主体）'),
('.hint{position:absolute;left:0;right:0;bottom:0;background:#F3ECDD;border-top:1px solid #D8CCB2;border-radius:0 0 18px 18px;padding:10px 18px;font-family:"Noto Serif CJK SC";font-size:13px;line-height:20px;color:#5C5346}',
 '.hint{position:absolute;left:18px;right:18px;bottom:14px;max-height:62px;background:#F3ECDD;border:1px solid #D8CCB2;border-radius:10px;padding:8px 12px;font-family:"Noto Serif CJK SC";font-size:12px;line-height:20px;color:#5C5346}\n.bone{position:absolute;top:6px;right:6px;width:44px;height:44px;border:1px dashed rgba(181,67,46,.55);border-radius:10px;display:flex;align-items:center;justify-content:center}\n.bone i{width:34px;height:34px;border-radius:9px 12px 8px 13px;background:linear-gradient(145deg,#F1E8D4,#E4D6B8);border:1.5px solid #B9A57C;box-shadow:0 2px 4px rgba(42,36,29,.3);font-style:normal;font-family:"Noto Serif CJK SC";font-weight:700;font-size:18px;color:#6E2F1F;display:flex;align-items:center;justify-content:center}\n.bone.p i{transform:scale(.92);background:#E4D6B8;box-shadow:0 0 0 3px rgba(181,67,46,.45)}\n.bone.d i{background:#B5432E;border-color:#B5432E;color:#fff;font-size:13px}\n.st{display:flex;gap:26px;margin-top:6px}.st div{text-align:center;font-size:12px;color:#5C5346}.st .bone{position:relative;top:0;right:0;transform:scale(1.6);margin:18px auto 22px}'),
('<div class="card"><div class="h">春 · 采集的妇人</div><div class="t">北坡塌下去一块</div>\n','<div class="card"><div class="bone"><i>刻</i></div><div class="h">春 · 采集的妇人</div><div class="t">北坡塌下去一块</div>\n'),
('<span class="x">收起 ▾</span>坡上的土被雨冲开，露出一团盘结的须，顺着往深处扎。','<span class="x">收起 ▾</span>坡上的土被雨冲开，露出一团盘结的须。'),
('左右拖卡做选择 · 长按看分量','左右拖卡做选择 · 点卡角骨片刻字'),
('<div class="carve">刻</div>',''),
('.drw{position:absolute;left:0;right:0;bottom:0;height:520px;background:#FAF6EC;border-radius:20px 20px 0 0;','.drw{position:absolute;left:18px;right:18px;bottom:22px;height:420px;background:#FAF6EC;border-radius:18px;'),
('.menu{position:absolute;right:10px;top:76px;width:250px;','.menu{position:absolute;right:18px;top:84px;width:220px;'),
('从字匣条上拉打开，三页切换；下拉或点暗处收起','从字匣条上拉打开；面板与卡同宽、比卡矮，卡头仍可见'),
]
for a,b in V2:
    assert a in s,a; s=s.replace(a,b)
s=s.replace('<div class="card"><div class="h">春 · 采集的妇人</div><div class="t">北坡塌下去一块</div></div>','<div class="card"><div class="bone"><i>刻</i></div><div class="h">春 · 采集的妇人</div><div class="t">北坡塌下去一块</div></div>')
E='''<div class="dsec" style="display:block"><div class="lab"><b>E</b>卡角骨片三态 + 浮层尺寸核对</div>
<div style="display:flex;gap:40px"><div><div class="st">
<div><div class="bone"><i>刻</i></div>默认</div><div><div class="bone p"><i>刻</i></div>按下</div><div><div class="bone d"><i>已刻</i></div>已刻</div></div>
<div class="issue" style="font-size:12px;color:#766C5E;max-width:330px">骨片 34×34 画在卡右上角，触控区 44×44（虚线示意，实物不显示）；按下缩 0.92 并出朱色描边；刻过后变朱底白字「已刻」，不可再点。提示文案统一写「点卡角骨片刻字」。</div></div>
<table style="font-size:13px;border-collapse:collapse;line-height:26px">
<tr style="color:#766C5E"><td style="width:150px">元素</td><td style="width:110px">尺寸</td><td>相对卡片 324×468</td></tr>
<tr><td>卡底提示框</td><td>288×≤62</td><td>在卡内，约 13% 卡高</td></tr>
<tr><td>卡面图</td><td>288×214</td><td>卡内最大块，主体</td></tr>
<tr><td>上拉面板（B）</td><td>324×420</td><td>与卡同宽，比卡矮</td></tr>
<tr><td>菜单（C）</td><td>220×约 300</td><td>明显小于卡</td></tr>
<tr><td>卡角骨片</td><td>34（触控 44）</td><td>在卡内右上</td></tr></table></div></div>'''
s=s.replace('<div class="foot">',E+'\n<div class="foot">')
s=s.replace('提示放在卡底可收起区，不再压在正文上','提示收进卡内底部小框（≤62 高），不压正文、不大于卡')
V21=[('手机竖屏重排 v2','手机竖屏重排 v2.1'),
('padding:8px 22px 0','padding:8px 24px 0'),
('.res{height:44px;margin:0 10px;','.res{height:44px;margin:0 8px;'),
('.mb{width:36px;height:36px;border-radius:18px;background:#2B3042;','.mb{position:relative;width:36px;height:36px;margin-right:4px;border-radius:18px;background:#2B3042;'),
('.mb i{','.mb:after{content:"";position:absolute;left:-4px;top:-4px;width:44px;height:44px;box-sizing:border-box;border:1px dashed rgba(216,180,106,.7);border-radius:10px}\n.mb i{'),
('.card{position:absolute;left:18px;right:18px;top:84px;height:468px;','.card{position:absolute;left:16px;right:16px;top:84px;height:468px;'),
('padding:18px;box-shadow','padding:16px;box-shadow'),
('.ill{margin:12px 0;height:214px;','.ill{margin:12px 0;height:216px;'),
('.hint{position:absolute;left:18px;right:18px;bottom:14px;max-height:62px;','.hint{position:absolute;left:16px;right:16px;bottom:16px;max-height:64px;'),
('.bone{position:absolute;top:6px;right:6px;','.bone{position:absolute;top:8px;right:8px;'),
('.lr{position:absolute;top:562px;left:18px;right:18px;','.lr{position:absolute;top:560px;left:16px;right:16px;'),
('.ges{position:absolute;top:586px;','.ges{position:absolute;top:584px;'),
('.ziku{position:absolute;left:10px;right:10px;bottom:22px;','.ziku{position:absolute;left:8px;right:8px;bottom:24px;'),
('.drw{position:absolute;left:18px;right:18px;bottom:22px;','.drw{position:absolute;left:16px;right:16px;bottom:24px;'),
('margin:8px 0 14px}','margin:8px 0 16px}'),
('.menu{position:absolute;right:18px;top:84px;','.menu{position:absolute;right:16px;top:84px;'),
('.mi{padding:13px 18px;','.mi{padding:12px 16px;'),
('padding:10px 18px 4px}','padding:8px 16px 4px}'),
('宽度贴边 18','左右边距 16'),('提示收进卡内底部小框（≤62 高）','提示收进卡内底部小框（≤64 高）'),
('相对卡片 324×468','相对卡片 328×468'),('<td>288×≤62</td>','<td>296×≤64</td>'),('<td>288×214</td>','<td>296×216</td>'),
('<td>324×420</td>','<td>328×420</td>'),('34（触控 44）</td><td>在卡内右上','34（触控 44）</td><td>距卡边 8，在卡内右上'),
('菜单（C）</td><td>220×约 300</td><td>明显小于卡</td></tr>','菜单（C）</td><td>220×约 296</td><td>明显小于卡</td></tr>\n<tr><td>菜单按钮</td><td>36（触控 44）</td><td>资源条内，虚线为点击区</td></tr>'),
]
for a,b in V21:
    assert a in s,a; s=s.replace(a,b)
# 重建差异：用户原截图已丢失，D 区改为占位框
s=s.replace('<img src="user_shot.jpg">','<div style="width:200px;height:452px;border-radius:10px;border:1px dashed #CDBB94;background:#F1E8D4;display:flex;align-items:center;justify-content:center;font-size:12px;color:#766C5E;text-align:center">用户手机截图<br>（原图已丢失，占位）</div>')
s=s.replace('<div class="ill">卡面图（主体）</div>','<div class="ill" style="background:#F1E8D4 url(../v5_cardart/assets/gatherer_m@2x.png) center/contain no-repeat;border:0"></div>')
s=s.replace('卡面文案为版式占位','卡面文案为版式示意 · 卡面图用 v5_cardart · ☰ 外圈虚线：点击区标注，非样式')
open('mobile_layout_v2_1.html','w').write(s)
print('ok')
