# -*- coding: utf-8 -*-
import sys; sys.dont_write_bytecode=True; sys.path.insert(0,'/workspace/zaozi-formal/v2/src')
from v2common import *
CSS = r'''
.pn{width:328px;flex:none;border-radius:24px;overflow:hidden;position:relative;box-shadow:0 0 0 1px rgba(0,0,0,.18),0 12px 32px rgba(0,0,0,.18)}
.pn .ecard{left:16px}
.dz{position:relative;display:flex;gap:8px;padding:10px 16px 0}
.dz span{flex:1;height:14px;display:flex;align-items:center;justify-content:center}
.dz span i{display:block;border-radius:50%;background:var(--gold-400)}
.dz .sd{position:absolute;left:3px;top:11px;font:700 10px/1 var(--f-ui);color:var(--gold-400);width:10px;text-align:center}
.dz .bm{position:absolute;right:1px;top:10px;transform:scale(.7);transform-origin:right top}
.dz + .dz{padding-top:4px} .dz + .dz .sd{top:5px} .dz + .dz .bm{top:4px}
.held{box-shadow:0 0 0 2px var(--gold-400),0 0 0 8px rgba(216,180,106,.18),0 12px 28px rgba(0,0,0,.4)!important;transform:scale(.98)}
.trk{display:flex;gap:8px;margin-top:12px}
.trk .t{flex:1;height:64px;border-radius:12px;background:var(--paper-100);box-shadow:inset 0 0 0 1px var(--paper-200);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font:500 12px/1 var(--f-ui);color:var(--ink-600)}
.trk .t b{font:700 15px/1 var(--f-serif);color:var(--ink-900)}
.trk .t.on{background:var(--bone-100);box-shadow:inset 0 0 0 2px var(--zhu-600)}
.warnl{margin-top:10px;padding:8px 10px;border-radius:10px;background:var(--zhu-100);font:500 12px/1.5 var(--f-ui);color:var(--zhu-600)}
.ap{padding:14px 14px 0}
.ap h2{font:700 22px/1.2 var(--f-serif)}
.ap .lead{margin-top:6px;font:400 12px/1.6 var(--f-ui);color:var(--ink-600)}
.apc{margin-top:12px;border-radius:16px;background:var(--paper-50);box-shadow:0 0 0 1px var(--paper-line);overflow:hidden;display:flex}
.apc.on{box-shadow:0 0 0 2px var(--zhu-600),0 0 0 5px rgba(181,67,46,.14)}
.apc .por{width:96px;flex:none;background:radial-gradient(90% 80% at 50% 30%,#F6EEDC 0%,var(--bone-200) 100%);display:flex;align-items:flex-end;justify-content:center;position:relative}
.apc .por i{width:62px;height:96px;border-radius:31px 31px 6px 6px;background:linear-gradient(180deg,rgba(110,80,40,.18),rgba(110,80,40,.30))}
.apc .por small{position:absolute;left:0;right:0;top:8px;text-align:center;font:400 10px/1 var(--f-ui);color:var(--ink-400)}
.apc .tx{padding:14px 14px 14px;flex:1}
.apc .tx .n{font:700 15px/1.3 var(--f-serif)}
.apc .tx .tr{display:inline-flex;margin-top:8px;height:22px;padding:0 8px;border-radius:6px;background:var(--jade-100);color:var(--jade-600);font:700 12px/22px var(--f-ui)}
.apc .tx p{margin-top:8px;font:400 13px/1.6 var(--f-serif);color:var(--ink-900)}
.yrbox{margin-top:12px;display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-radius:12px;background:var(--paper-50);box-shadow:inset 0 0 0 1px var(--paper-200);font:400 12px/1.4 var(--f-ui);color:var(--ink-600)}
.yrbox b{font:700 18px/1 var(--f-ui);color:var(--ink-900);font-variant-numeric:tabular-nums}
.fb{position:absolute;left:14px;right:14px;bottom:16px}
.ncols{display:flex;gap:24px;padding:20px 24px 0}
.ncols .notes{flex:1}
'''
def pn(cap, inner, cls=''):
    return '<div><div class="cap">%s</div><div class="pn"><div class="scr %s" style="height:700px">%s</div></div></div>' % (cap, cls, inner)
def dz(side, sizes, bone=False):
    return '<div class="dz"><span class="sd">%s</span>%s%s</div>' % (side, ''.join('<span>%s</span>' % ('<i class="d%d"></i>' % s if s else '') for s in sizes), '<i class="pip bm"></i>' if bone else '')
T1 = '「采集的人在半路碰见一个外族孩子，满身是伤，<span class="nw">走不动了。</span>」'
def ecard(txt, extra='', cls='', who='采集的人', sea='夏 · 2 / 2'):
    return ('<div class="ecard %s"><div class="por"><span class="who">%s</span><span class="sea">%s</span><div class="sil"></div><span class="ph">人物立绘区</span></div><div class="txt">%s</div>%s</div>' % (cls, who, sea, txt, extra))
P1 = pn('<b>①</b> 按住看分量', STRIP + stat('第 4 代 · 第 1 年夏', '按住中') + dz('左', [0,3,0,2]) + dz('右', [2,0,1,2], bone=True) + hud([52,36,58,58]) + bones('eeecc') +
  '<div class="stage" style="height:420px"><div class="ecard under"></div>%s</div>' % ecard(T1, '', 'held'))
sheet = ('<div class="scrim"></div><div class="sheet"><div class="grab"></div><div class="k">卡上有迹</div><h2>刻下这件事？</h2>'
  '<div class="sub">这张卡上有三种迹，只能刻一种。</div>'
  '<div class="trk"><div class="t"><b>水纹</b>迹 1</div><div class="t on"><b>鸟爪印</b>迹 2</div><div class="t"><b>干泥裂纹</b>迹 3</div></div>'
  '<div class="cost"><span>空骨片 −1</span><span>信 −3</span><span>记 +3</span></div>'
  '<div class="warnl">信已偏低，再刻一次<span class="nw">离失祀更近</span></div>'
  '<div class="btns"><div class="btn ghost">不刻</div><div class="btn pri">刻下</div></div></div>')
P2 = pn('<b>②</b> 刻事签确认（点卡角骨片后）', STRIP + stat('第 4 代 · 第 1 年夏', '第 4 代记事人') + hud([47,14,58,64], warn='信') + bones('eeecc') +
  '<div class="stage" style="height:420px"><div class="ecard under"></div>%s</div>' % ecard('「大水退了，河滩上留下<span class="nw">一片干泥。</span>」', '<div class="mark"><i class="pip"></i></div>', who='族人', sea='夏 · 1 / 2') + sheet)
P3 = pn('<b>③</b> 传人二选一（代末之后）', STRIP + stat('第 5 代 · 开局', '选传人') +
  '<div class="ap"><h2>选一位徒弟接笔</h2><div class="lead">上一代记事人留下两个徒弟。选中的这位，<span class="nw">就是第 5 代记事人。</span></div>'
  '<div class="apc on"><div class="por"><small>立绘</small><i></i></div><div class="tx"><div class="n">徒弟 · 其一</div><span class="tr">力气大</span><p>粮食类选项多 +2</p></div></div>'
  '<div class="apc"><div class="por"><small>立绘</small><i></i></div><div class="tx"><div class="n">徒弟 · 其二</div><span class="tr">记性好</span><p>记忆下降时少 −2</p></div></div>'
  '<div class="yrbox"><span>这一代余年<br><small style="color:var(--ink-400)">开局时随机定下</small></span><b>4 年</b></div></div>'
  '<div class="fb"><div class="btns" style="margin:0"><div class="btn pri">就由这位接笔</div></div></div>', cls='paper')
N1 = '''<div class="notes"><h3>① 按住看分量</h3><ul>
<li>按住卡片 300ms 触发：卡缩到 98%%，外圈 gold 2 描边 + 8 外发光。</li>
<li>四维条上方出现两排圆点：上排左选项，下排右选项；圆点对齐所在维的列中心。</li>
<li>点三档：5 / 8 / 12（动得越多点越大）；不显示涨跌。</li>
<li>哪一边有迹，那一排末尾多一个小骨片（70%% 大小）。</li>
<li>松手 160ms 淡出。</li></ul></div>'''.replace('%%','%')
N2 = '''<div class="notes"><h3>② 刻事签确认</h3><ul>
<li>选完左右后，有迹的卡右侧出现骨片按钮 40×40，朱 2 描边 + 外发光，轻跳一次。</li>
<li>点它打开弹层：多种迹时用三列选择块（64 高），只能选一；只有一种迹时不显示这一行。</li>
<li>代价胶囊 28 高：空骨片、信、记三项固定写出。</li>
<li>信进入危险区时多一行朱色提示。</li>
<li>没有空骨片时「刻下」变灰，写「没有空骨片」。</li></ul></div>'''
N3 = '''<div class="notes"><h3>③ 传人二选一</h3><ul>
<li>两张徒弟卡纵排，左侧立绘 96 宽；不起名字，写「徒弟 · 其一 / 其二」，接笔后统称「第 N 代记事人」。</li>
<li>特性徽标 jade 12 Bold，下面一句效果 Serif 13。</li>
<li>选中：朱 2 描边 + 5 外发光；默认不选，主按钮在选中前为灰。</li>
<li>余年在这里第一次亮出，之后常驻主界骨片行右侧。</li>
<li>下一步：开局挑字入字匣。</li></ul></div>'''
body = '<style>%s</style><div class="row">%s%s%s</div><div class="ncols">%s%s%s</div>' % (CSS, P1, P2, P3, N1, N2, N3)
open('/workspace/zaozi-formal/v2/states_v1.html','w').write(page('状态总览', '按住看分量 · 刻事签确认 · 传人二选一', body, 1110,
 '本稿不改玩法数值；四维、卡文、徒弟特性均为版式占位。', '状态总览 v2 · 组件宽 328'))
