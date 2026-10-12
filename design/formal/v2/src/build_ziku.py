# -*- coding: utf-8 -*-
import sys; sys.dont_write_bytecode=True; sys.path.insert(0,'/workspace/zaozi-formal/v2/src')
from v2common import *
CSS = r'''
.pk{padding:14px 12px 0}
.pk h2{font:700 22px/1 var(--f-serif);letter-spacing:.08em}
.pk .lead{margin-top:8px;font:400 12px/1.6 var(--f-ui);color:var(--ink-600)}
.big3{display:flex;gap:12px;margin:14px 0 0;padding:14px;border-radius:16px;background:var(--paper-50);box-shadow:0 0 0 1px var(--paper-line)}
.big3 .b{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px}
.big3 .slot{width:64px;height:64px;font-size:34px;border-radius:14px}
.big3 .slot.sq{font-size:12px;width:64px}
.big3 .cap2{font:500 11px/1.3 var(--f-ui);color:var(--ink-600);text-align:center}
.grid{display:grid;grid-template-columns:repeat(5,60px);gap:9px;margin-top:14px}
.cell{width:60px;height:60px;border-radius:12px;background:var(--paper-50);box-shadow:inset 0 0 0 1.5px var(--ink-600);display:flex;align-items:center;justify-content:center;font:700 30px/1 var(--f-serif);position:relative}
.cell.on{background:var(--bone-100);box-shadow:inset 0 0 0 2px var(--zhu-600)}
.cell.on::after{content:attr(data-n);position:absolute;right:-5px;top:-5px;width:18px;height:18px;border-radius:9px;background:var(--zhu-600);color:#fff;font:700 11px/18px var(--f-ui);text-align:center}
.cell.unk{background:var(--paper-200);box-shadow:none;color:#A99F8D;font:500 22px/1 var(--f-ui)}
.info{margin-top:14px;border-radius:16px;background:var(--paper-50);box-shadow:0 0 0 1px var(--paper-line);padding:12px 14px;display:flex;gap:12px;align-items:flex-start}
.info .chip{width:44px;height:44px;font-size:26px;flex:none}
.info p{font:400 13px/1.6 var(--f-serif);color:var(--ink-900)}
.info small{display:block;font:400 11px/1.5 var(--f-ui);color:var(--ink-400);margin-top:2px}
.foot2{position:absolute;left:12px;right:12px;bottom:16px}
.list .it{display:flex;gap:12px;align-items:center;padding:12px 0;border-top:1px solid var(--paper-200)}
.list .it:first-child{border-top:0}
.list .slot{flex:none}
.list .tx{flex:1;min-width:0}
.list .tx b{font:700 15px/1.3 var(--f-serif);color:var(--ink-900)}
.list .tx p{font:400 12px/1.5 var(--f-ui);color:var(--ink-600);margin-top:2px}
.list .st{flex:none;height:22px;padding:0 8px;border-radius:6px;font:700 12px/22px var(--f-ui)}
.st.a{background:var(--jade-100);color:var(--jade-600)} .st.u{background:var(--paper-200);color:var(--ink-600)} .st.q{background:var(--zhu-100);color:var(--zhu-600)}
.cmp{display:flex;flex-wrap:wrap;gap:14px 4px;justify-content:space-between;background:var(--night-800);border-radius:12px;padding:12px 12px 16px;margin:4px 0 6px}
.cmp>div{width:60px;display:flex;flex-direction:column;align-items:center;gap:16px;font:400 10px/1.2 var(--f-ui);color:var(--on-night-2);text-align:center}
.cmpp{display:flex;gap:14px;background:var(--paper-100);border-radius:12px;padding:12px 12px 10px;margin:4px 0 6px}
.cmpp>div{display:flex;flex-direction:column;align-items:center;gap:6px;font:400 10px/1.2 var(--f-ui);color:var(--ink-600)}
.cmpp .slot{width:40px;height:40px;font-size:20px}
'''
cells = ''.join('<div class="cell%s"%s>%s</div>' % (((' on', ' data-n="%d"' % n) if n else ('', '')) + (c,)) for c, n in
                [('水',0),('日',0),('人',0),('木',0),('田',0),('火',0),('禾',0),('休',2)]) + ''.join('<div class="cell unk">?</div>' for _ in range(7))
D = phone('<b>D</b> 开局 · 挑字入字匣（第 2 / 3 格已选）', STRIP + stat('第 5 代 · 开局', '第 5 代记事人') +
  '<div class="pk"><h2>挑字入字匣</h2><div class="lead">带进字匣的字，这一代能落在卡上；落过的字这一代冬夜不能当部件。上一代传下的事签占 1 格。</div>'
  '<div class="big3"><div class="b"><div class="slot sq">事签<br>传下</div><div class="cap2">上一代传下<br>不可换</div></div>'
  '<div class="b"><div class="slot sel">休</div><div class="cap2">第 2 格</div></div>'
  '<div class="b"><div class="slot p empty">＋</div><div class="cap2">第 3 格<br>点下方的字</div></div></div>'
  '<div class="grid">%s</div>'
  '<div class="info"><span class="chip">休</span><div><p>落字「歇一季」：跳过这张卡，这一季剩下的迹不能刻。</p><small>落字代价以玩法数值为准 · 已造 8 字，可挑 8 字</small></div></div></div>'
  '<div class="foot2"><div class="btns" style="margin:0"><div class="btn off">还差 1 个字</div></div></div>' % cells, cls='paper')

sheet = ('<div class="scrim"></div><div class="sheet"><div class="grab"></div><div class="k">字匣</div><h2>这一代带着的三格</h2>'
  '<div class="list" style="margin-top:10px">'
  '<div class="it"><div class="slot ok" style="box-shadow:inset 0 0 0 1.5px var(--ink-600);background:var(--paper-50)">日</div><div class="tx"><b>日</b><p>可落一次 · 落下后这一代冬夜不能当部件</p></div><span class="st a">可落</span></div>'
  '<div class="it"><div class="slot used" style="background:var(--paper-200);color:var(--ink-400);box-shadow:none">水</div><div class="tx"><b>水</b><p>夏 · 以河为界 · 这一代冬夜部件里置灰</p></div><span class="st u">本代已落</span></div>'
  '<div class="it"><div class="slot sq">事签</div><div class="tx"><b>传下的事签</b><p>占一格，不能落；冬夜可拿来刻字</p></div><span class="st q">待刻</span></div>'
  '</div><div class="btns"><div class="btn pri">回到卡上</div></div></div>')
E = phone('<b>E</b> 主界 · 点「字匣」打开详情（本代落过一字）', STRIP + stat('第 5 代 · 第 1 年秋', '第 5 代记事人') + hud([52,44,58,58]) + bones('eescc') + sheet)

notes = '''<div class="notes">
<h3>字匣格：五种状态</h3>
<div class="cmp">
<div><div class="slot ok">水</div>可落</div>
<div><div class="slot sel">水</div>选中</div>
<div><div class="slot used">水</div>本代已落</div>
<div><div class="slot sq">事签</div>事签</div>
<div><div class="slot empty">＋</div>空·仅开局</div>
</div>
<table>
<tr><td>可落</td><td>paper-50 底，1.5 描边 ink-600，Serif 26 Bold。</td></tr>
<tr><td>选中</td><td>bone-100 底，2 描边朱色 + 3 外发光；卡底升起第三选项。</td></tr>
<tr><td>已落</td><td>night-700 底，字 38% 透明，下沿「已落」小签 16 高。冬夜部件盘里同字同样置灰并写「本代已落」。</td></tr>
<tr><td>事签</td><td>骨片形，刻痕色字；不能落，冬夜才用。</td></tr>
<tr><td>空</td><td>1.5 虚线；只在开局挑字时出现，进卡后三格必满。</td></tr>
</table>
<h3>开局挑字（D）</h3>
<ul>
<li>页底色 paper-100，边距 12，网格同字录（60×60、间距 9、一行 5 格）。</li>
<li>点字 → 进下一个空格，格右上角朱色序号；再点同字取出。</li>
<li>挑满 3 格前主按钮灰，写「还差 N 个字」；满了变朱色「带这三个字开局」。</li>
<li>下方说明卡显示最后点的字的落字说明。</li>
<li>已造少于 3 字时（前几代），空格允许留空，按钮写「就带这些开局」。</li>
</ul>
<h3>字匣详情（E）</h3>
<p>点字匣条标题打开底部弹层，规格同 v1 弹层（上圆角 20、内边距 20、把手 36×4、遮罩 45%）。状态徽标 12 Bold、高 22、圆角 6。</p>
</div>'''
body = '<style>%s</style><div class="row">%s%s%s</div>' % (CSS, D, E, notes)
open('/workspace/zaozi-formal/v2/ziku_pick_v1.html','w').write(page('字匣 · 三格', '开局挑字入字匣 · 字匣详情 · 五种格子状态', body, 1000,
 '本稿不改玩法数值；字录计数、落字说明均为版式占位。', '字匣 v2 · 360vp 屏宽'))
