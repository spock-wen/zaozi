from gf import *
p1=phone(pcard(),dots=None)
p2=phone(pcard(rot=5,dx=40,opt=('下去看个究竟',.5)),dots=[8,0,0,5])
p3=phone(pcard(rot=7,dx=56,opt=('下去看个究竟',1))+'<div style="position:absolute;right:0;top:128px;width:6px;height:440px;background:#D8B46A;border-radius:3px"></div>',dots=[8,0,0,5])
p4=phone(pcard(title='坡下有一团须',body='挖开一看，是能吃的根。',op=1),fl=['+8',None,None,'−4'],vals=[70,48,30,51])
row1=''.join([col(p1,'<b>① 静止</b>：四维显示数字和条，无圆点。'),col(p2,'<span style="color:#B5432E;font-weight:700">动效中间帧，越框是故意的</span><br><b>② 拖动未过阈值</b>（&lt;35%）：受影响的维度上方出圆点，大小三档 5/8/12，只表示幅度、不表示涨跌；选项字淡入到 50%。数字保持可见。'),col(p3,'<span style="color:#B5432E;font-weight:700">动效中间帧，越框是故意的</span><br><b>③ 过阈值</b>（≥35%）：选项字全显，屏幕边缘出 6 宽金色提示条，圆点不变；此刻松手即提交。'),col(p4,'<b>④ 松手提交</b>：圆点收起；条长和数字一起滚到新值（400ms），维名上方飘「+8」「−4」，涨为青、跌为赭，600ms 上飘淡出；配「提交」音。')])
d1=desk(dcard(rot=6,dx=80,opt=('下去看个究竟',1)),dots=[8,0,0,5])
d2=desk(dcard(title='坡下有一团须',body='挖开一看，是能吃的根。'),fl=['+8',None,None,'−4'],vals=[70,48,30,51])
row2=col(d1,'<span style="color:#B5432E;font-weight:700">动效中间帧，越框是故意的</span><br><b>电脑 · 拖动/按住 → 键预览</b>：鼠标拖卡同手机；按 ← → 一次=卡倾到该侧并显示圆点（不提交），再按同向键或 Enter 提交。',704)+col(d2,'<b>电脑 · 提交后</b>：同手机，飘字在四维条上方；四维条居中于卡上方，宽 480。',704)
box='''<div class="box" style="margin-top:16px"><b>和「资源条显示数字」怎么协调</b>：数字一直显示，作为结果；圆点只在拖动/按住时出现，作为预期，只说幅度不说方向——保留猜测的乐趣（Reigns 做法），提交后才用飘字揭晓方向和具体数。阈值附近（数值 ≤15 或 ≥85）维名和条变赭色，作为危险提示（对应差距表第 7 项红色警示）。圆点原位在画布底部的旧做法取消。</div>'''
page('预览圆点 + 数值飘字','差距 #1 #2（优先级 1、2）',f'<div class="h2"><b>1</b>拖动时圆点挪到数值条上方<span>差距 #1</span></div><div class="row">{row1}</div><div class="h2"><b>2</b>电脑端<span>差距 #1 #2</span></div><div class="row">{row2}</div>{box}','gf1_preview_float')
