import os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
def r4(x): return int(round(x/4))*4
def screen(W,H,label,cursor=False,collapsed=False):
    top=56; side=0 if collapsed else 336
    ch=max(468,min(640,H-280)); cw=r4(ch*0.7)
    stage=W-side
    cx=(stage-cw)//2
    zh= '<div class="z"><b>1</b>水</div><div class="z"><b>2</b>火</div><div class="z"><b>3</b>日</div>'
    cur='<div class="cursor" style="left:%dpx;top:%dpx"></div><div class="tip" style="left:%dpx;top:%dpx">刻字（K）</div>'%(cx+cw-34,top+40+34,cx+cw+8,top+40+12) if cursor else ''
    sidebar = '' if collapsed else f'''<div class="side" style="width:{side}px"><div class="tabs"><span class="on">字录 6</span><span>骨片 3</span><span>日志</span></div>
<div class="sec">已造</div><div class="grid">{"".join(f'<div class="cell"><div>{c}</div>{c}</div>' for c in "水日人木田火")}<div class="cell u"><div>？</div>未知</div><div class="cell u"><div>？</div>未知</div></div>
<div class="sec" style="margin-top:16px">日志（最近）</div><div class="log">开局 · 第一张卡<br>向右 · 下去看个究竟<br>向右 · 再往前走</div>
<div class="fold">收起侧栏 ⟩</div></div>'''
    tab = '<div class="sidetab">字录 · 骨片 · 日志 ⟨</div>' if collapsed else ''
    return f'''<div class="lab"><b>{label}</b></div>
<div class="scr" style="width:{W}px;height:{H}px">
<div class="bar"><span class="g">第 3 代记事人</span><span class="s">骨片 3</span><span class="s">春</span><span class="sp"></span><span class="tb">存档 ▾</span><span class="tb">字源与版权</span></div>
<div class="card" style="left:{cx}px;top:{top+40}px;width:{cw}px;height:{ch}px"><div class="bone{' hv' if cursor else ''}"><i>刻</i></div><div class="h">春 · 采集的妇人</div><div class="t">北坡塌下去一块</div>
<div class="b">一夜大雨，北坡塌下去一块。<span class="nw">坍处底下</span>露出了怪东西，没人敢过去看。</div>
<div class="ill" style="height:{ch-264}px;background:#F1E8D4 url(../v5_cardart/assets/gatherer_d@2x.png) center/contain no-repeat;border:0"></div>
<div class="hint"><span class="x">收起 ▾</span>坡上的土被雨冲开，露出一团盘结的须。</div></div>
<div class="opt" style="left:{cx-216}px;top:{top+40+ch//2-24}px"><span class="k">←</span>绕开北坡，别招惹</div>
<div class="opt r" style="left:{cx+cw+24}px;top:{top+40+ch//2-24}px">下去看个究竟<span class="k">→</span></div>
<div class="tray" style="left:{(stage-424)//2}px;top:{top+40+ch+24}px"><span class="zt">字匣</span>{zh}<span class="zc">点字或按 1–3 落在卡上</span></div>
<div class="keys" style="left:0;width:{stage}px;top:{H-40}px"><span class="k">←</span><span class="k">→</span> 选 · <span class="k">1–3</span> 落字 · 按住 <span class="k">Space</span> 看分量 · <span class="k">K</span> 或点骨片刻 · <span class="k">Enter</span> 刻</div>
{sidebar}{tab}{cur}</div>'''
css=open('desktop.css').read()
body=f'''<div class="top"><h1>造字人 · 电脑宽屏 v1（配 mobile_layout_v2_1）</h1><span class="tag">设计稿，非玩法示意</span></div>
<div class="pad">{screen(1440,900,"1440 × 900 · 侧栏展开（默认）· 鼠标悬停卡角骨片",cursor=True)}
{screen(1280,800,"1280 × 800 · 侧栏收起态（点右侧标签或按钮展开）",collapsed=True)}
<div class="row2">
<div class="box"><div class="lab"><b>卡角骨片四态</b></div><div class="st">
<div><div class="bone2"><i>刻</i></div>默认</div><div><div class="bone2 h"><i>刻</i></div>悬停</div><div><div class="bone2 p"><i>刻</i></div>按下</div><div><div class="bone2 d"><i>已刻</i></div>已刻</div></div>
<p>悬停：上浮 2、加深阴影、1px 朱色描边、鼠标变手形，旁出小签「刻字（K）」放在卡外右侧，不压卡面。按下缩 0.92；已刻不可点、无悬停。触控区 44×44。</p></div>
<div class="box"><div class="lab"><b>菜单（宽屏）</b></div>
<div class="dd"><div class="mg">存档</div><div class="mi">导出存档码</div><div class="mi">导入存档码</div><div class="mi" style="border:0;color:#766C5E;font-size:13px">种子 20261012</div></div>
<p>顶栏右侧两个文字按钮：「存档 ▾」下拉 240 宽（导出 / 导入 / 种子），「字源与版权」直接打开居中弹层。项高 44，Esc 关闭。</p></div>
<div class="box"><div class="lab"><b>侧栏选择：可收起侧栏</b></div>
<p>选可收起，不选常驻。理由：① 卡是主体，1280×800 时常驻 336 侧栏会把卡挤到中线偏左，收起后卡回正中；② 字录/日志不是每张卡都要看，收起时右缘留 44 宽标签一键展开；③ 与手机上拉抽屉同一套内容和分页，状态可记住。≥1440 默认展开，1024–1439 默认收起。快捷键不新增，用鼠标点。</p></div>
</div></div>
<div class="foot"><span>色板与字号沿用正式视觉 v1.1.1 · 间距 4/8 · 卡面文案为版式示意 · 卡面图用 v5_cardart</span><span>设计稿，非玩法示意</span></div>'''
open('desktop_layout_v1.html','w').write('<!doctype html><html><head><meta charset="utf-8"><style>'+css+'</style></head><body>'+body+'</body></html>')
