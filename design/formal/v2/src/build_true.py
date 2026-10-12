# -*- coding: utf-8 -*-
import sys; sys.dont_write_bytecode=True; sys.path.insert(0,'/workspace/zaozi-formal/v2/src')
from v2common import *
CSS = r'''
.scroll{position:absolute;left:16px;right:16px;top:84px;bottom:20px;border-radius:6px;background:linear-gradient(180deg,#F6EEDC,var(--bone-100) 30%,var(--bone-100) 70%,var(--bone-200));box-shadow:0 14px 32px rgba(0,0,0,.45);color:var(--ink-900)}
.scroll::before,.scroll::after{content:"";position:absolute;left:-6px;right:-6px;height:12px;border-radius:6px;background:var(--carve)}
.scroll::before{top:-6px} .scroll::after{bottom:-6px}
.sc-in{padding:20px 16px 0}
.sc-in .k{font:700 12px/1 var(--f-ui);color:var(--zhu-600);letter-spacing:.12em;text-align:center}
.sc-in h2{font:700 30px/1.1 var(--f-serif);text-align:center;margin-top:10px;letter-spacing:.3em;padding-left:.3em}
.sc-in .lead{text-align:center;margin-top:8px;font:400 13px/1.6 var(--f-serif);color:var(--ink-600)}
.rows{display:grid;grid-template-columns:1fr 1fr;gap:10px 12px;margin-top:14px}
.rw .t{display:flex;align-items:baseline;gap:6px;font:700 13px/1 var(--f-serif)}
.rw .t small{font:400 10px/1 var(--f-ui);color:var(--ink-400)}
.rw .evo{margin-top:6px}
.rw .evo .lab{font-size:10px}
.sc-ft{position:absolute;left:16px;right:16px;bottom:18px;text-align:center;font:400 11px/1.5 var(--f-ui);color:var(--ink-400)}
.names{padding:24px 20px 0;text-align:center}
.names .nm{font:400 13px/2 var(--f-serif);color:var(--on-night-2)}
.names .nm span{display:inline-block;margin:0 6px;opacity:var(--o)}
.big{margin-top:18px;text-align:center}
.big .cj{font:700 64px/1 var(--f-serif);letter-spacing:.2em;padding-left:.2em;color:var(--on-night)}
.big .seal{display:inline-flex;margin-top:14px;height:26px;padding:0 10px;border-radius:6px;border:1px solid var(--gold-400);color:var(--gold-400);font:700 12px/24px var(--f-ui);letter-spacing:.06em}
.qt2{margin:24px 24px 0;padding:14px 16px;border-left:2px solid var(--gold-400);background:rgba(43,48,66,.6);border-radius:0 12px 12px 0}
.qt2 p{font:400 15px/26px var(--f-serif);color:var(--on-night)}
.qt2 small{display:block;margin-top:6px;font:400 11px/1 var(--f-ui);color:var(--on-night-2)}
.land{margin:22px 24px 0;font:400 16px/28px var(--f-serif);color:var(--on-night);text-align:center;text-wrap:balance}
.endbtn{position:absolute;left:24px;right:24px;bottom:24px}
'''
# 八个字：每字三格 = 最早一档 + 小篆 + 今天；缺的阶段不出格（本无甲骨文 → 从金文起）
ROWS = [('休','会意','g-xiu_oracle','甲骨文','g-xiu_seal'),('水','象形','g-shui_oracle','甲骨文','g-shui_seal'),
        ('从','会意','g-cong_oracle','甲骨文','g-cong_seal'),('本','指事','g-ben_bronze','金文','g-ben_seal'),
        ('日','象形','g-ri_oracle','甲骨文','g-ri_seal'),('人','象形','g-ren_oracle','甲骨文','g-ren_seal'),
        ('木','象形','g-mu_oracle','甲骨文','g-mu_seal'),('田','象形','g-tian_oracle','甲骨文','g-tian_seal')]
def row(c, how, g0, n0, g1):
    cells = [('<i class="g %s"></i>' % g0, n0), ('<i class="g %s"></i>' % g1, '小篆'), ('<span class="today">%s</span>' % c, '今天')]
    ev = '<div class="evo s">' + ''.join('<div class="c%s"><div class="box">%s</div><div class="lab">%s</div></div>' % (' on' if i == 2 else '', b, l) for i, (b, l) in enumerate(cells)) + '</div>'
    return '<div class="rw"><div class="t">%s<small>%s</small></div>%s</div>' % (c, how, ev)
J = phone('<b>J</b> 真结局 · 字卷展开（8 字占位）', STRIP + stat('仓颉', '第 41 代') +
  '<div class="scroll"><div class="sc-in"><div class="k">真结局</div><h2>仓颉</h2><div class="lead">这些字，是一代代记事人<span class="nw">刻下来的。</span></div>'
  '<div class="rows">%s</div></div><div class="sc-ft">字卷按造字先后排；字多时纵向滚动</div></div>' % ''.join(row(*r) for r in ROWS))
names = ''.join('<span style="--o:%.2f">第 %d 代记事人</span>' % (o, n) for n, o in [(1,.35),(2,.45),(3,.55),(4,.65),(5,.55),(6,.45),(39,.55),(40,.7),(41,.9)])
K = phone('<b>K</b> 真结局 · 落点（字卷收起之后）', STRIP + stat('仓颉', '第 41 代') +
  '<div class="names"><div class="nm">%s</div></div>'
  '<div class="big"><div class="cj">仓颉</div><div class="seal">后人合称</div></div>'
  '<div class="qt2"><p>故好書者眾矣，而倉頡獨傳者，壹也。</p><small>《荀子·解蔽》</small></div>'
  '<div class="land">很多个记事人，传下来的<span class="nw">只有一个名字。</span></div>'
  '<div class="endbtn"><div class="btns" style="margin:0"><div class="btn ghostn">再看字卷</div><div class="btn pri">回到家谱</div></div></div>' % names)
notes = '''<div class="notes">
<h3>字卷（J）</h3>
<table>
<tr><td>卷面</td><td>bone 渐变底，上下卷轴 12 高刻痕色 <code>#6E2F1F</code>，圆角 6；左右边距 16。</td></tr>
<tr><td>每字</td><td>字名 Serif 13 Bold + 造法 10；下面一条紧凑档演变条（格 46、间距 5）：最早一档 → 小篆 → 今天，今天那格选中。</td></tr>
<tr><td>空格</td><td>没有字形的阶段不出格：本没有甲骨文，从金文起。不写任何占位字。</td></tr>
<tr><td>排列</td><td>两列，按造字先后；玩家字录有多少字就列多少，超过一屏纵向滚动。</td></tr>
</table>
<h3>落点（K）</h3>
<ul>
<li>历代「第 N 代记事人」淡入成一行行小字，透明度由远到近升高，然后向中间收拢，合成「仓颉」Serif 64 Bold。</li>
<li>「后人合称」小签 gold 描边；引文用繁体原文，出处一行。</li>
<li>落点句 Serif 16/28：说清玩家不是仓颉本人，而是很多个无名记事人。</li>
</ul>
<h3>节奏</h3>
<ul>
<li>字卷从上往下展开 1.2s；每个字的三格依次点亮 120ms。</li>
<li>点「继续」或滑到卷尾 → 卷收起 → 名字收拢 1.6s → 引文与落点句淡入。</li>
</ul>
<h3>字形</h3>
<p>休水从本沿用 v1 显示版；日人木田取自已定的字形包（Commons 原文件，只改 viewBox）。小篆、金文里需致谢 Sears 的文件，致谢放在制作名单，不放卷面。</p>
</div>'''
body = '<style>%s</style><div class="row">%s%s%s</div>' % (CSS, J, K, notes)
open('/workspace/zaozi-formal/v2/end_true_v1.html','w').write(page('真结局 · 仓颉卷', '字卷展开 · 后人合称仓颉 · 8 字为版式占位', body, 960,
 '本稿不改玩法数值；字数、代次为版式占位。古字形只用已定字形包里的文件，没有自画。', '真结局卷 v2 · 360vp 屏宽'))
