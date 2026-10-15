import os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
CSS=open('gf.css').read()
DIMS=[('粮',62),('信',48),('记',30),('外',55)]
def hud(top,dots=None,fl=None,vals=None,warn=None,left=16,width=None):
    st=f'top:{top}px;' + (f'left:{left}px;width:{width}px;right:auto;' if width else '')
    o=f'<div class="hud" style="{st}">'
    for i,(n,v) in enumerate(DIMS):
        if vals: v=vals[i]
        d=''
        if dots and dots[i]: s=dots[i]; d=f'<div class="dot" style="width:{s}px;height:{s}px;top:{-6-s}px"></div>'
        f=''
        if fl and fl[i]: c='up' if fl[i][0]=='+' else 'dn'; f=f'<div class="fl {c}" style="top:-22px">{fl[i]}</div>'
        col='#E08A74' if warn==i else '#EEE7D8'
        o+=f'<div class="dim">{d}{f}<div class="n" style="color:{col}">{n}</div><div class="v">{v}</div><div class="t"><i style="width:{v}%;background:{col}"></i></div></div>'
    return o+'</div>'
def goals(n=0):
    return ''.join(f'<span class="gd{" on" if i<n else ""}"></span>' for i in range(3))
def card(x,y,w,h,title='北坡塌下去一块',who='春 · 族长',body='一夜大雨，北坡塌下去一块。',rot=0,dx=0,opt=None,extra='',op=1,illh=None,scale=1):
    t=f'transform:translateX({dx}px) rotate({rot}deg) scale({scale});opacity:{op};'
    o=''
    if opt: o=f'<div class="opt" style="opacity:{opt[1]}">{opt[0]}</div>'
    ih=illh or h-150
    if 'bottom:' in extra and not illh: ih-=76  # 卡底落点/落定条另占一行，不压卡面图
    return f'<div class="card" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;{t}">{o}<div class="h">{who}</div><div class="tt">{title}</div><div class="b">{body}</div><div class="ill" style="height:{ih}px;background:#F1E8D4 url(../v5_cardart/assets/{art(who,title)}_m@2x.png) center/contain no-repeat"></div>{extra}</div>'
def art(who,title):
    if '河' in title: return 'river'
    for k,v in [('外族','north'),('巫','shaman'),('采集','gatherer'),('族长','elder')]:
        if k in who: return v
    return 'strong'
def phone(inner,bones=3,gen='第 1 代记事人',g=0,dots=None,fl=None,vals=None,warn=None,tray=None,hudon=True,back=True):
    tr=tray if tray is not None else '<span class="zt">字匣</span><div class="z">水</div><div class="z">火</div><div class="z">日</div>'
    b='<div class="back" style="left:24px;top:152px;width:312px;height:420px"></div>' if back else ''
    h=hud(92,dots,fl,vals,warn) if hudon else ''
    return f'''<div class="pw"><div class="ph"><div class="sb">安全区</div>
<div class="gen" style="top:40px">{gen}</div><div class="chip" style="right:160px;top:36px">骨片 {bones}</div><div class="chip" style="right:60px;top:36px">目标 {goals(g)}</div><div class="chip" style="right:16px;top:36px;width:36px;justify-content:center">☰</div>
{h}{b}{inner}<div class="tray">{tr}</div></div></div>'''
def desk(inner,bones=3,gen='第 1 代记事人',g=0,dots=None,fl=None,vals=None,warn=None,side='',tray=None):
    stage=1280-(336 if side else 0)
    tr=tray if tray is not None else '<span class="zt">字匣</span><div class="z">水</div><div class="z">火</div><div class="z">日</div>'
    return f'''<div class="dw"><div class="dk"><div style="height:56px;border-bottom:1px solid #3A4057"></div>
<div class="gen" style="top:18px;left:24px;font-size:15px">{gen}</div>
<div class="chip" style="left:200px;top:14px">目标 {goals(g)}</div><div class="chip" style="left:300px;top:14px">骨片 {bones}</div>
{hud(84,dots,fl,vals,warn,left=(stage-480)//2,width=480)}
<div class="back" style="left:{(stage-364)//2+8}px;top:148px;width:364px;height:500px"></div>
{inner}
<div class="tray" style="left:{(stage-360)//2}px;right:auto;width:360px;bottom:48px">{tr}</div>
<div style="position:absolute;bottom:12px;left:0;width:{stage}px;text-align:center;font-size:12px;color:#A8A193"><span class="k">←</span> <span class="k">→</span> 选 · <span class="k">1–3</span> 落字 · 按住 <span class="k">Space</span> 看分量 · <span class="k">K</span> 或点骨片刻 · <span class="k">Enter</span> 刻</div>
{side}</div></div>'''
def dcard(stage=1280,**k): return card((stage-364)//2,140,364,500,**k)
def pcard(**k): return card(16,140,328,428,**k)
def page(title,sub,body,name):
    s=f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body><div class="top"><h1>造字人 · 游戏感 · {title}<small>{sub}</small></h1><span class="tag">设计稿，非玩法示意</span></div><div class="pad">{body}</div><div class="foot"><span>布局沿用 mobile_layout_v2_1 / desktop_layout_v1 · 色板字号 v1.1.1 · 数值与文案为版式示意</span><span>设计稿，非玩法示意</span></div></body></html>'
    open(name+'.html','w').write(s)
def col(x,cap,w=300): return f'<div>{x}<div class="cap" style="width:{w}px">{cap}</div></div>'
