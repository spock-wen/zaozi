from gf import *
C=list('水日人木田火力月休林从男明本')
M=dict(zip(C,['河水','太阳','人','树木','田地','火','力气','月亮','歇息','树林','跟随','男子','光亮','树根']))
def grid(sel=(),off=False,x=16,y=232,cols=4):
    CC=C if cols>4 else C[:8]
    o=f'<div style="position:absolute;left:{x}px;top:{y}px;display:flex;flex-wrap:wrap;gap:8px;width:{cols*80}px">'
    for c in CC:
        cls='sel' if c in sel else ('off' if off else '')
        n=f'<span class="n">{sel.index(c)+1}</span>' if c in sel else ''
        o+=f'<div class="pk {cls}">{c}<small>{M[c]}</small>{n}</div>'
    return o+'</div>'
def slots(s,x=16,y=140):
    return f'<div style="position:absolute;left:{x}px;top:{y}px;display:flex;gap:8px;align-items:center"><span style="font-size:13px;color:#A8A193;width:56px">带三个字</span>'+''.join(f'<div class="slot {"f" if i<len(s) else ""}">{s[i] if i<len(s) else ""}</div>' for i in range(3))+'</div>'
def info(c,x=16,y=470,w=328):
    return f'<div class="info" style="position:absolute;left:{x}px;top:{y}px;width:{w}px;box-sizing:border-box"><div style="font-family:Noto Serif CJK SC;font-weight:700;font-size:16px">{c}</div><div><b>落</b>遇到河、界的事能落，分量 ●●</div><div><b>部件</b>能拼出：泉（线索）</div><div><b>解锁</b>？</div><div style="font-size:12px;color:#766C5E">带去落掉，冬夜就少一个部件</div></div>'
hd='<div style="position:absolute;left:16px;top:84px;font-family:Noto Serif CJK SC;font-size:20px;font-weight:700">出发 · 挑三个字</div>'
btn=lambda on:f'<div class="btn" style="position:absolute;left:16px;right:16px;bottom:32px;{"background:#B5432E;color:#fff" if on else "background:#2B3042;color:#766C5E"}">{"带这三个字出发" if on else "还差字"}</div>'
P=lambda inner: f'<div class="pw"><div class="ph"><div class="sb">安全区</div><div class="gen" style="top:40px">第 2 代记事人</div>{inner}</div></div>'
p1=P(hd+slots([])+grid()+'<div class="coach" style="top:432px;left:16px;right:16px">点一个字看它能做什么；再点一次带上。</div>'+info('水')+btn(False))
p2=P(hd+slots(['水'])+grid(('水',))+'<div class="pk sel" style="position:absolute;left:80px;top:150px;transform:scale(.8);opacity:.6">水</div>'+info('水')+btn(False))
p3=P(hd+slots(['水','木'])+grid(('水','木'))+'<div class="coach" style="top:432px">再点「木」或点上方格子，可以放回去。</div>'+btn(False))
p4=P(hd+slots(['水','木','田'])+grid(('水','木','田'),off=True)+'<div class="info" style="position:absolute;left:16px;right:16px;top:432px;box-sizing:border-box;text-align:center;font-family:Noto Serif CJK SC">这一代多半靠水吃饭。</div>'+btn(True))
r1=''.join([col(p1,'<b>① 选字提示</b>：字池为 v1 验证切片 14 字（手机首屏显示前 8 个，其余 6 个下滑可见）；点一下出说明卡（落 / 部件 / 解锁 三行，未知打问号）+ 一句提醒；按钮灰「还差字」。'),col(p2,'<b>② 选中</b>：再点一次，字卡变朱色、角标顺序号；字副本飞入第一个空格 280ms cubic-bezier(.2,.8,.2,1)，入格下压 120ms，配「刻木」音。'),col(p3,'<b>③ 取消</b>：点已选字或格子里的字 → 飞回原位 200ms ease-in-out，后面的字左移补位 160ms，配轻一点的「退」音。'),col(p4,'<b>④ 选满三个</b>：其余候选降到 40%（仍可点，点了提示「先放回一个」并抖格子 2 次 240ms）；下方出开局判语；按钮变朱「带这三个字出发」。')])
D=lambda inner: f'<div class="dw"><div class="dk"><div style="height:56px;border-bottom:1px solid #3A4057"></div><div class="gen" style="top:18px;left:24px;font-size:15px">第 2 代记事人</div>{inner}</div></div>'
dhd='<div style="position:absolute;left:96px;top:96px;font-family:Noto Serif CJK SC;font-size:24px;font-weight:700">出发 · 挑三个字</div>'
dbtn=lambda on:f'<div class="btn" style="position:absolute;left:96px;width:320px;top:640px;{"background:#B5432E;color:#fff" if on else "background:#2B3042;color:#766C5E"}">{"带这三个字出发" if on else "还差字"}</div>'
d1=D(dhd+slots(['水'],96,160)+grid(('水',),x=96,y=256,cols=7)+info('木',820,160,360).replace('能拼出：泉（线索）','能拼出：休、本、林')+dbtn(False)+'<div style="position:absolute;left:96px;top:720px;font-size:13px;color:#A8A193">点字，或用 <span class="k">←</span> <span class="k">→</span> 移动、<span class="k">Space</span> 选 · <span class="k">Backspace</span> 放回最后一个 · <span class="k">Enter</span> 出发</div>')
d2=D(dhd+slots(['水','木','田'],96,160)+grid(('水','木','田'),off=True,x=96,y=256,cols=7)+'<div class="info" style="position:absolute;left:820px;top:160px;width:360px;font-family:Noto Serif CJK SC">这一代多半靠水吃饭。</div>'+dbtn(True))
r2=col(d1,'<b>电脑 · 选字</b>：左挑右看；悬停字即在右侧显示说明（不必先点）。键位为<b>新增建议</b>，线上没有，待确认。',704)+col(d2,'<b>电脑 · 选满</b>：同手机；判语放在右侧说明位。',704)
page('出发挑字','差距 #5（优先级 5）',f'<div class="h2"><b>10</b>选字提示、选中、取消、选满确认<span>差距 #5 · 字池：v1 验证切片 14 字（水日人木田火力月 休林从男明 本）</span></div><div class="row">{r1}</div><div class="h2"><b>11</b>电脑端</div><div class="row">{r2}</div><div class="box" style="margin-top:16px">字池：v1 验证切片 14 字（水日人木田火力月 休林从男明 本），每个字下标字义。说明三行、判语为版式示意；「木 → 休、本、林」取自研究稿示例。字匣 3 格、传下事签占 1 格的规则以玩法稿 §4.2 为准，本图没画事签格（待确认）。</div>','gf5_pick')
