from gf import *
p1=phone(pcard(rot=-6,dx=-48,opt=('绕开北坡，别招惹',.6)),dots=[0,5,8,0])
p2=phone(pcard(rot=0,dx=0)+'<div style="position:absolute;left:150px;top:600px;font-size:12px;color:#A8A193">回弹 ↺</div>',dots=None)
p3=phone(card(16,140,328,428,rot=18,dx=300,op=.6,title='北坡塌下去一块')+'<div class="card" style="left:16px;top:140px;width:328px;height:428px;transform:perspective(800px) rotateY(40deg);background:#2B3042;border:1px solid #3A4057"></div>',fl=['+8',None,None,'−4'],vals=[70,48,30,51])
p4=phone(pcard(title='坡下有一团须',body='挖开一看，是能吃的根。'),vals=[70,48,30,51])
r1=''.join([col(p1,'<span style="color:#B5432E;font-weight:700">动效中间帧，越框是故意的</span><br><b>① 拖动</b>：卡随手指平移，倾角 = 位移/卡宽 × 15°（上限 15°），绕卡底中心转；选项字按位移 0→35% 淡入 0→1。'),col(p2,'<b>② 未过阈值松手 → 回弹</b>：320ms，弹性缓动 cubic-bezier(.34,1.56,.64,1)，圆点 160ms 淡出。'),col(p3,'<span style="color:#B5432E;font-weight:700">动效中间帧，越框是故意的</span><br><b>③ 过阈值松手 → 飞出</b>：240ms ease-in，沿拖动方向飞出并加转到 18°、淡到 0；同时数值动画开始（见板 1）。'),col(p4,'<b>④ 翻下一张</b>：牌背（night-700）在原位 Y 轴翻 180°，360ms cubic-bezier(.2,.8,.2,1)，翻过 90° 时换成正面；翻完 120ms 内不接受拖动。')])
drop_card=pcard(title='河水漫过了界石',who='夏 · 族长',body='两家为一条河争了三天。',extra='<div style="position:absolute;left:16px;right:16px;bottom:16px;height:56px;border:2px dashed #D8B46A;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:13px;color:#766C5E">可落字：水（以河为界）</div>')
tr_gl='<span class="zt">字匣</span><div class="z gl">水</div><div class="z">火</div><div class="z">日</div>'
q1=phone(drop_card,tray=tr_gl)
fly='<div class="z" style="position:absolute;left:150px;top:470px;transform:scale(1.4);box-shadow:0 12px 24px rgba(0,0,0,.5)">水</div>'
q2=phone(drop_card+fly,tray='<span class="zt">字匣</span><div class="z em">已落</div><div class="z">火</div><div class="z">日</div>')
q3=phone(pcard(title='河水漫过了界石',who='夏 · 族长',body='两家为一条河争了三天。',extra='<div style="position:absolute;left:16px;right:16px;bottom:16px;height:56px;background:#F1E8D4;border-radius:12px;display:flex;align-items:center;gap:8px;padding:0 12px;font-family:Noto Serif CJK SC;font-size:28px;font-weight:700;color:#6E2F1F">水<span style="font:400 13px Noto Sans CJK SC;color:#5C5346">落在卡上：以河为界</span></div>'),fl=[None,'+6','+4',None],vals=[62,54,34,55],tray='<span class="zt">字匣</span><div class="z em">已落</div><div class="z">火</div><div class="z">日</div>')
bone=lambda cls,t: f'<div style="position:absolute;right:24px;top:148px;width:44px;height:44px;display:flex;align-items:center;justify-content:center"><i style="width:36px;height:36px;border-radius:9px 12px 8px 13px;{cls};font-style:normal;font-family:Noto Serif CJK SC;font-weight:700;display:flex;align-items:center;justify-content:center">{t}</i></div>'
# 古字形：Commons 公有领域 svg（见 glyphs/SOURCES.csv）
ph=lambda st,lab,cls='': f'<div class="{cls}"><img src="glyphs/shui_{st}.svg" style="width:30px;height:30px"><small>{lab}</small></div>'
evo=f'<div style="position:absolute;left:16px;right:16px;top:300px;background:#FAF6EC;border-radius:16px;padding:16px;color:#2A241D"><div style="font-size:12px;color:#766C5E;margin-bottom:8px">「水」的写法往前走一格</div><div class="evo">{ph("oracle","甲骨")}{ph("bronze","金文")}{ph("seal","篆书","cur")}<div class="nx">水<small>今天</small></div></div><div style="font-size:12px;color:#5C5346;margin-top:8px">新格先描边 240ms，再亮底 200ms</div></div>'
q4=phone(pcard(title='河水漫过了界石',who='夏 · 族长',body='两家为一条河争了三天。')+bone('background:#B5432E;color:#fff;font-size:13px','已刻')+'<div style="position:absolute;right:176px;top:12px;font-size:12px;font-weight:700;color:#E08A74">−1</div>'+evo,bones=2,tray='<span class="zt">字匣</span><div class="z em">已落</div><div class="z">火</div><div class="z">日</div>')
r2=''.join([col(q1,'<b>⑤ 可落字</b>：卡底出虚线落点「可落字：水」；字匣里能落的字外圈金色呼吸（1200ms 一周期，循环 2 次后停）。'),col(q2,'<b>⑥ 落字</b>：点字或拖字；字放大到 1.4 倍沿弧线飞到落点，280ms cubic-bezier(.2,.8,.2,1)；原格变虚线「已落」。'),col(q3,'<b>⑦ 落定</b>：落点盖印式下压 120ms（scale 1.12→1），配「落字」音；随后受影响的维度飘字，同板 1。'),col(q4,'<b>⑧ 刻字 + 演变进一格</b>：点卡角骨片 → 骨片变「已刻」，资源条骨片数 −1 飘字；卡上浮演变条，当前格朱色外圈，下一格从 35% 亮起。')])
d1=desk(dcard(rot=10,dx=160,op=.8,opt=('下去看个究竟',1)),dots=[8,0,0,5])
d2=desk(card((1280-364)//2,140,364,500,title='河水漫过了界石',who='夏 · 族长',body='两家为一条河争了三天。',extra='<div style="position:absolute;left:16px;right:16px;bottom:16px;height:56px;border:2px dashed #D8B46A;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:13px;color:#766C5E">可落字：水（按 1 或点字）</div>'),tray=tr_gl)
r3=col(d1,'<span style="color:#B5432E;font-weight:700">动效中间帧，越框是故意的</span><br><b>电脑 · 卡面动效</b>：鼠标拖动同手机；按 ←/→ 时卡倾 8° 并显示选项，动画 160ms ease-out；时长、曲线与手机一致。',704)+col(d2,'<b>电脑 · 落字</b>：按 1–3 或点字匣格；悬停可落的字时落点虚线变实线。刻字：K 或点骨片，同手机反馈。',704)
tl='''<div class="box" style="margin-top:16px"><b>一次完整选择的时间线（ms）</b>
<div class="tl" style="width:1360px">
<div class="seg" style="left:0;width:180px;background:#E6DCC6">拖动（跟手）</div>
<div class="seg" style="left:180px;width:96px;background:#F3DED6">飞出 240</div>
<div class="seg" style="left:276px;width:160px;background:#DDE6E1">数值滚动 400</div>
<div class="seg" style="left:276px;top:34px;height:4px;width:240px;background:#D8B46A"></div>
<div class="seg" style="left:436px;width:144px;background:#E9E1F0">翻牌 360</div>
<div class="ax" style="left:0">0 松手前</div><div class="ax" style="left:180px">松手</div><div class="ax" style="left:276px">+240 飘字 600（金线）</div><div class="ax" style="left:580px">+600 可再拖（再加 120 防误触）</div></div></div>'''
page('卡面动效 + 落字/刻字/演变','差距 #2 #7；配套板 1',f'<div class="h2"><b>3</b>拖动、回弹、飞出、翻牌<span>差距 #7</span></div><div class="row">{r1}</div><div class="h2"><b>4</b>落字、刻字、演变条进一格<span>差距 #2 #5</span></div><div class="row">{r2}</div><div class="h2"><b>5</b>电脑端</div><div class="row">{r3}</div>{tl}','gf2_motion_glyph')
