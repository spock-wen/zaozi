# -*- coding: utf-8 -*-
import sys; sys.path.insert(0, '/workspace/zaozi-formal/v1/src')
from common import *

CSS = r'''
.pp{background:var(--paper-100);position:relative}
.nav{height:52px;display:flex;align-items:center;padding:0 12px;gap:8px}
.nav .bk{width:32px;height:32px;border-radius:16px;display:flex;align-items:center;justify-content:center;font:400 22px/1 var(--f-ui);color:var(--ink-900)}
.nav h2{font:700 22px/1 var(--f-serif);flex:1;letter-spacing:.08em}
.cnt{height:28px;padding:0 12px;border-radius:14px;box-shadow:inset 0 0 0 1px var(--paper-line);font:700 14px/28px var(--f-ui);font-variant-numeric:tabular-nums;color:var(--ink-900);background:var(--paper-50)}
.tabs{display:flex;margin:4px 12px 0;height:36px;border-radius:18px;background:var(--paper-200);padding:3px}
.tabs span{flex:1;display:flex;align-items:center;justify-content:center;border-radius:15px;font:500 14px/1 var(--f-ui);color:var(--ink-600)}
.tabs span.on{background:var(--ink-900);color:var(--paper-50);font-weight:700}
.tabs em{font-style:normal;font-size:11px;margin-left:3px;opacity:.75;font-variant-numeric:tabular-nums}
.card{margin:12px;background:var(--paper-50);border-radius:16px;padding:16px;box-shadow:0 0 0 1px var(--paper-line),0 2px 8px rgba(60,40,20,.06)}
.top{display:flex;gap:16px}
.big{width:112px;height:112px;flex:none;border-radius:14px;background:var(--bone-100);box-shadow:inset 0 0 0 1px var(--bone-300);display:flex;align-items:center;justify-content:center;font:700 92px/1 var(--f-serif);color:var(--ink-900)}
.ti{display:flex;flex-direction:column;gap:8px;padding-top:2px}
.ti .f{display:flex;align-items:center;gap:6px;font:700 14px/1 var(--f-ui);color:var(--ink-600)}
.ti .f .chip{width:28px;height:28px;font-size:16px}
.ti .by{font:400 12px/1.5 var(--f-ui);color:var(--ink-600)}
.ti .re{display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:13px;box-shadow:inset 0 0 0 1px var(--ink-400);font:500 12px/1 var(--f-ui);color:var(--ink-900);align-self:flex-start}
.sec{margin-top:16px;padding-top:14px;border-top:1px solid var(--paper-200)}
.sec h4{font:700 12px/1 var(--f-ui);color:var(--ink-400);letter-spacing:.12em;margin-bottom:8px;display:flex;justify-content:space-between}
.sec h4 i{font-style:normal;font-weight:400;letter-spacing:0;color:var(--zhu-600)}
.sec p{font:400 15px/24px var(--f-serif);color:var(--ink-900)}
.quote{border-left:3px solid var(--bone-300);padding:2px 0 2px 12px}
.quote p{font-size:15px}
.quote small{display:block;margin-top:4px;font:400 12px/1.4 var(--f-ui);color:var(--ink-400)}
.eff{display:flex;gap:10px;align-items:flex-start;padding:8px 0}
.eff + .eff{border-top:1px dashed var(--paper-line)}
.eff .k{flex:none;height:22px;padding:0 8px;border-radius:6px;font:700 12px/22px var(--f-ui);background:var(--paper-200);color:var(--ink-900)}
.eff p{font-size:14px;line-height:22px}
.tap{position:absolute;width:56px;height:56px;border-radius:12px;border:2px dashed var(--zhu-600)}
.callout{position:absolute;font:700 11px/1 var(--f-ui);color:#fff;background:var(--zhu-600);border-radius:10px;height:20px;line-height:20px;padding:0 8px}
/* grid */
.grid{display:grid;grid-template-columns:repeat(5,60px);gap:9px;padding:12px}
.gc{height:60px;border-radius:12px;display:flex;align-items:center;justify-content:center;position:relative;font:700 30px/1 var(--f-serif)}
.gc.made{background:var(--paper-50);box-shadow:inset 0 0 0 1.5px var(--ink-600);color:var(--ink-900)}
.gc.made.sel{background:var(--bone-100);box-shadow:inset 0 0 0 2px var(--zhu-600)}
.gc.sign{background:transparent;border:1.5px dashed var(--ink-600);color:var(--ink-600);font:700 24px/1 var(--f-ui);flex-direction:column}
.gc.frag{background:var(--jade-100);box-shadow:inset 0 0 0 1.5px var(--jade-600);color:var(--jade-600);font:700 24px/1 var(--f-ui);flex-direction:column}
.gc.unk{background:var(--paper-200);color:#A99F8D;font:700 22px/1 var(--f-ui)}
.gc small{font:500 10px/1 var(--f-ui);margin-top:5px;letter-spacing:0}
.gc .new{position:absolute;right:-4px;top:-6px;height:16px;padding:0 5px;border-radius:8px;background:var(--zhu-600);color:#fff;font:700 10px/16px var(--f-ui)}
.lg{display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;margin-top:6px}
.lg div{display:flex;gap:10px;align-items:center}
.lg .gc{width:44px;height:44px;flex:none;font-size:22px;border-radius:10px}
.lg .gc small{font-size:9px;margin-top:3px}
.lg p{font:400 12px/1.5 var(--f-ui)}
.lg p b{color:var(--ink-900)}
/* popover */
.pop{width:188px;box-sizing:border-box;background:var(--paper-50);border-radius:16px;box-shadow:0 0 0 1px var(--paper-line),0 12px 28px rgba(40,30,20,.22);padding:14px;position:relative;margin-top:8px}
.pop .pb{display:flex;flex-direction:column;gap:12px}
.pop .gl{width:144px;height:144px;flex:none;border-radius:14px;background:var(--bone-100);box-shadow:inset 0 0 0 1px var(--bone-300);color:var(--carve);display:flex;align-items:center;justify-content:center}
.pop .gl .g{width:86%;height:86%}
.pop h5{font:700 14px/1.3 var(--f-serif);color:var(--ink-900)}
.pop .bh2{font:400 12px/1.5 var(--f-serif);color:var(--ink-900);margin-top:6px}
.pop .src{font:400 10px/1.5 var(--f-ui);color:var(--ink-400);margin-top:8px}
.pop .pg{display:flex;gap:4px;margin-top:10px}
.pop .pg i{width:6px;height:6px;border-radius:3px;background:var(--paper-line)} .pop .pg i.on{background:var(--zhu-600);width:16px}
.pop .arrow{position:absolute;top:-7px;left:64px;width:14px;height:14px;background:var(--paper-50);transform:rotate(45deg);box-shadow:-1px -1px 0 var(--paper-line)}
'''

DET_H = 990
evo = evo_html('xiu', '', on=3, bh=True)
phoneC = '''<div><div class="cap"><b>C</b> 字录 · 单字详情（会意「休」）</div><div class="phone"><div class="pp" style="height:%dpx">
<div class="draft-strip">设计稿，非玩法示意</div>
<div class="nav"><span class="bk">‹</span><h2>字录</h2><span class="cnt">8 / 27</span></div>
<div class="tabs"><span>全部<em>8</em></span><span>象形<em>7</em></span><span class="on">会意<em>1</em></span><span>指事<em>0</em></span></div>
<div class="card">
 <div class="top"><div class="big">休</div><div class="ti">
  <span class="badge huiyi" style="align-self:flex-start">会意</span>
  <div class="f"><span class="chip">人</span>＋<span class="chip">木</span></div>
  <div class="by">造于 第 4 代 · 第 1 年冬夜<br>记事人 阿禾</div>
  <span class="re">▶ 再看一次</span>
 </div></div>
 <div class="sec"><h4>白话字义</h4><p>人靠着树歇息；引申为停下。</p></div>
 <div class="sec"><h4>典籍</h4><div class="quote"><p>休，息止也。从人依木。</p><small>《说文解字》卷六</small></div></div>
 <div class="sec" style="position:relative"><h4>古字形演变<i>点一格可放大</i></h4>%s
   <span class="tap" style="left:186px;top:30px"></span></div>
 <div class="sec"><h4>小故事</h4><p>东岸的孩子受了伤，走不动了。你留下他，给了他一口吃的。秋天，他父亲带着东岸的人来道谢。</p></div>
 <div class="sec"><h4>效果</h4>
  <div class="eff"><span class="k">落字</span><p>「歇一季」：跳过这张卡，粮 −6，另外三维各向 50 回 3</p></div>
  <div class="eff"><span class="k">解锁</span><p>东岸「休战」事件链进入牌堆</p></div>
  <div class="eff"><span class="k">部件</span><p>可作更复杂的字的部件，不消耗</p></div>
 </div>
</div></div></div></div>''' % (DET_H, evo)

made = list('水日人木田火禾')
cells = ''.join('<div class="gc made">%s</div>' % c for c in made)
cells += '<div class="gc made sel">休<span class="new">新</span></div>'
cells += '<div class="gc sign">?<small>有事签</small></div>'
cells += '<div class="gc frag">?<small>木 + ？</small></div>'
cells += '<div class="gc unk">?</div>' * 17
phoneD = '''<div><div class="cap"><b>D</b> 字录 · 格子总览（四种状态）</div><div class="phone"><div class="pp" style="height:560px">
<div class="draft-strip">设计稿，非玩法示意</div>
<div class="nav"><span class="bk">‹</span><h2>字录</h2><span class="cnt">8 / 27</span></div>
<div class="tabs"><span class="on">全部<em>8</em></span><span>象形<em>7</em></span><span>会意<em>1</em></span><span>指事<em>0</em></span></div>
<div style="padding:10px 12px 0;font:400 12px/1 var(--f-ui);color:var(--ink-600)">已造 8 · 手里有事签 1 · 有残片线索 1 · 未知 17</div>
<div class="grid">%s</div>
</div></div>
<div class="notes" style="margin-top:16px;width:360px">
<h3>格子四种状态</h3>
<div class="lg">
<div><span class="gc made">水</span><p><b>已造</b><br>今天的字，墨色，1.5 描边 <code>#5C5346</code></p></div>
<div><span class="gc sign">?<small>有事签</small></span><p><b>有事签</b><br>1.5 虚线框，字仍是问号</p></div>
<div><span class="gc frag">?<small>木 + ？</small></span><p><b>有残片线索</b><br>青底，只写摆对的一半</p></div>
<div><span class="gc unk">?</span><p><b>未知</b><br>无描边，问号 <code>#A99F8D</code></p></div>
</div>
<p style="margin-top:10px">选中/新造：朱色 2 描边 + 骨色底，「新」角标在玩家第一次点开后消失。格子 60×60，圆角 12，间距 9。</p>
</div></div>''' % cells

pop_cells = ''.join('<i%s></i>' % (' class="on"' if i == 3 else '') for i in range(5))
notes = '''<div class="notes">
<h3>点一格放大（演变条聚焦态）</h3>
<p>点演变条任一格，在条的下方展开放大卡；左右滑动切换阶段，点空白处收起。放大卡出现时其余内容不动，只加 20%% 遮罩。</p>
<div class="pop"><span class="arrow"></span><div class="pb"><div class="gl"><i class="g g-xiu_lishu"></i></div>
<div><h5>隶书 · 西汉</h5><p class="bh2">弧线拉成横竖</p><p class="src">出处：中研院小学堂<br>老子甲後283(隸) 西漢<br>CC0 1.0</p><div class="pg">%s</div></div></div></div>
<h3>信息顺序与字号</h3>
<table>
<tr><td>大字</td><td>今天的写法，Noto Serif CJK SC Bold 92，放在 112×112 骨色方块里。</td></tr>
<tr><td>造法</td><td>徽标 12 Bold；会意写两个部件，指事写<span class="nw">「底字 木 · 一在其下」</span>。</td></tr>
<tr><td>区块标题</td><td>12 Bold，字距 0.12em，<code>#766C5E</code>。</td></tr>
<tr><td>正文</td><td>Serif 15，行高 24；效果行 <span class="nw">14 / 22</span>。</td></tr>
<tr><td>演变条</td><td>格 56，间距 6；阶段名 11 Bold，时代 10，白话 <span class="nw">10 / 14</span>，最多两行。</td></tr>
</table>
<h3>空着的情况</h3>
<ul>
<li>某阶段没有字形：那一格不出现，后面的格依次前移，不写占位文字。</li>
<li>典籍查不到原文：这一块整块不显示。</li>

</ul>
<h3>指事字的同一张卡</h3>
<p>换成「本」时：徽标换紫灰 <code>#5B4A72</code>，公式行写「底字 木 · 一在其下」，演变条从金文起共 4 格（见演变条示意）。</p>
</div>''' % pop_cells

body = '<div class="row">%s%s%s</div><div class="foot"><span>本稿不改玩法数值；字录总数、代次、效果数值均为版式占位，以玩法稿为准。</span><span>字录详情 v1 · 360vp 屏宽</span></div>' % (phoneC, phoneD, notes)
open('/workspace/zaozi-formal/v1/zilu_detail_v1.html', 'w').write(page('字录 · 单字详情', '示例：休（会意）· 格子四种状态 · 演变条放大态', '<style>%s</style>%s' % (CSS, body), 1250))
