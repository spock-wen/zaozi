# -*- coding: utf-8 -*-
import sys; sys.dont_write_bytecode=True; sys.path.insert(0,'/workspace/zaozi-formal/v2/src')
from v2common import *
CSS = r'''
.eb{display:flex;justify-content:space-between;align-items:center;padding:14px 16px 0}
.eb .tag{height:24px;padding:0 10px;border-radius:12px;border:1px solid var(--gold-400);color:var(--gold-400);font:700 12px/22px var(--f-ui);letter-spacing:.06em}
.eb .n{font:400 12px/1 var(--f-ui);color:var(--on-night-2)}
.qt{padding:10px 16px 0;font:400 14px/22px var(--f-serif);color:var(--on-night-2);text-wrap:balance}
.qt b{font-weight:400;color:var(--on-night)}
.bonewrap{padding:14px 16px 0}
.bone.w{width:328px;height:236px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px}
.drop{display:flex;align-items:center;gap:14px;font:700 22px/1 var(--f-ui);color:var(--ink-400)}
.dp{position:relative;z-index:2;width:84px;height:84px;border-radius:16px;display:flex;align-items:center;justify-content:center;font:700 56px/1 var(--f-serif);color:var(--ink-900);background:var(--paper-50);box-shadow:inset 0 0 0 1.5px var(--ink-600),0 2px 0 rgba(0,0,0,.08)}
.dp.e{background:rgba(255,255,255,.25);box-shadow:none;border:2px dashed var(--bone-crack);color:var(--bone-crack);font:400 30px/1 var(--f-ui)}
.dp.bad{color:rgba(42,36,29,.45);box-shadow:inset 0 0 0 1.5px var(--zhu-600)}
.bone .hint2{font:400 12px/1 var(--f-ui);color:var(--ink-600)}
.bone.broken{filter:saturate(.7) brightness(.92)}
.bone .bigcrack{position:absolute;left:40px;top:30px;width:250px;height:180px}
.parts{padding:14px 16px 0}
.parts .hd{display:flex;justify-content:space-between;font:500 12px/1 var(--f-ui);color:var(--on-night-2)}
.pg{display:grid;grid-template-columns:repeat(7,40px);gap:6px;margin-top:10px}
.pg .slot{width:40px;height:40px;font-size:22px;border-radius:10px}
.kbtn{position:absolute;left:16px;right:16px;bottom:16px}
.res{margin:14px 16px 0;padding:12px 14px;border-radius:12px;background:rgba(181,67,46,.14);box-shadow:inset 0 0 0 1px rgba(181,67,46,.5)}
.res b{display:block;font:700 15px/1.3 var(--f-serif);color:#E9A08F}
.res p{margin-top:6px;font:400 12px/1.6 var(--f-ui);color:var(--on-night)}
.res .clue{display:inline-flex;align-items:center;gap:4px;height:26px;padding:0 8px;border-radius:8px;background:var(--jade-100);color:var(--jade-600);font:700 13px/26px var(--f-serif);margin-top:8px}
'''
QT = ('<div class="eb"><span class="tag">冬夜刻字</span><span class="n">事签 1 / 1</span></div><div class="qt">事签：<b>晌午正热，赶路的背抵着<span class="nw">一截老干</span>，头顶叶子<span class="nw">遮着太阳</span>，一直待到<span class="nw">天色转凉</span></b></div>')
def parts(sel):
    o=[]
    for c in '日人月木禾田水':
        if c=='水': o.append('<div class="slot used">水</div>')
        elif c in sel: o.append('<div class="slot sel">%s</div>'%c)
        else: o.append('<div class="slot ok">%s</div>'%c)
    return '<div class="parts"><div class="hd"><span>部件（字录里本代没落过的字）</span><span>可重复用</span></div><div class="pg">%s</div></div>' % ''.join(o)
TOP = STRIP + stat('第 4 代 · 第 1 年冬夜', '空骨片 2 · 字录 7 / 27')
L = phone('<b>L</b> 冬夜 · 拼部件（摆上一个，还差一个）', TOP + QT +
  '<div class="bonewrap"><div class="bone w"><div class="drop"><div class="dp">人</div>＋<div class="dp e">？</div></div><div class="hint2">把部件拖上骨片 · 按「刻」之前都能拿下来</div></div></div>' + parts('人') +
  '<div class="kbtn"><div class="btns" style="margin:0"><div class="btn ghostn">先不刻</div><div class="btn off">刻</div></div></div>')
CR = '<svg class="bigcrack" viewBox="0 0 250 180"><path d="M8 20 L70 64 L96 58 L132 96 L120 118 L170 132 L242 170" fill="none" stroke="#6E2F1F" stroke-width="2.5" stroke-linejoin="round"/><path d="M132 96 L164 78 L190 84" fill="none" stroke="#6E2F1F" stroke-width="1.5"/></svg>'
M = phone('<b>M</b> 刻错 · 骨片裂开（摆成了 人 ＋ 禾）', TOP.replace('空骨片 2','空骨片 1') + QT +
  '<div class="bonewrap"><div class="bone w broken">%s<div class="drop"><div class="dp">人</div>＋<div class="dp bad">禾</div></div></div></div>'
  '<div class="res"><b>骨片裂了，这张事签作废</b><p>记 −4。摆对的那一半记进字录，下次遇到这件事会直接显示：</p><span class="clue">人 ＋ ？</span></div>'
  '<div class="kbtn"><div class="btns" style="margin:0"><div class="btn pri">继续</div></div></div>' % CR)
notes = '''<div class="notes">
<h3>冬夜刻字 · 刻之前（L）</h3>
<table>
<tr><td>事签</td><td>沿用 v1 造字卡的冬夜标签、事签行（Serif 14/22，平衡换行）。</td></tr>
<tr><td>骨片</td><td>v1 骨片形，这里 328×236；两个落位 84×84 圆角 16，空位 2 虚线 bone-crack。</td></tr>
<tr><td>部件盘</td><td>一行 7 格 40×40，圆角 10，间距 6，同字匣格样式；本代已落的字用「已落」态，不能拖。</td></tr>
<tr><td>按钮</td><td>两个落位都满之前「刻」为灰；满了变朱。「先不刻」= 留到明年冬夜。</td></tr>
</table>
<h3>刻错（M）</h3>
<ul>
<li>按「刻」→ 骨片抖 2 下 → 裂纹从左上划到右下 400ms（刻痕色，静态图退路）。</li>
<li>摆错的那格转朱描边、字 45% 透明。</li>
<li>结果条：朱 14% 底；残片线索用 jade 胶囊。两个都错时不显示线索。</li>
<li>拼出别的真字（如人＋人）同样算错，结果条改写「人 ＋ 人 是一个字」。</li>
</ul>
<h3>刻对</h3>
<p>直接进入已锁的造字那一刻（v1 造字卡），本稿不重画。</p>
<h3>只写 SPEC、不出图</h3>
<ul><li>象形「描迹」：骨片上显示迹的淡影，手指沿迹描；退路为依次点三个亮点。</li>
<li>指事：部件盘只选一个底字，骨片上出现上 / 中 / 下三个落点。</li></ul>
</div>'''
body = '<style>%s</style><div class="row">%s%s%s</div>' % (CSS, L, M, notes)
open('/workspace/zaozi-formal/v2/winter_compose_v1.html','w').write(page('冬夜刻字 · 拼部件与刻错', '刻之前的部件盘 · 刻错骨片裂 · 刻对接已锁造字卡', body, 1000,
 '本稿不改玩法数值；部件、计数、事签均为版式占位。', '冬夜刻字 v2 · 360vp 屏宽'))
