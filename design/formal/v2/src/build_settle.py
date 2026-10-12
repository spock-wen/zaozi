# -*- coding: utf-8 -*-
import sys; sys.dont_write_bytecode=True; sys.path.insert(0,'/workspace/zaozi-formal/v2/src')
from v2common import *
CSS = r'''
.st0{padding:16px 16px 0}
.st0 .k{font:700 12px/1 var(--f-ui);color:var(--zhu-600);letter-spacing:.12em}
.st0 h2{font:700 24px/1.25 var(--f-serif);margin-top:8px}
.st0 .end{display:inline-flex;align-items:center;gap:6px;margin-top:10px;height:26px;padding:0 10px;border-radius:13px;background:var(--jade-100);color:var(--jade-600);font:700 12px/26px var(--f-ui)}
.blk{margin:14px 12px 0;border-radius:16px;background:var(--paper-50);box-shadow:0 0 0 1px var(--paper-line);padding:14px 16px}
.blk .sec{margin-bottom:10px}
.tl{position:relative;padding-left:22px}
.tl::before{content:"";position:absolute;left:6px;top:6px;bottom:6px;border-left:2px solid var(--paper-line)}
.tl .g{display:block}
.tl .ln{position:relative;padding:6px 0;display:flex;align-items:center;gap:8px;font:400 13px/1.4 var(--f-ui);color:var(--ink-600)}
.tl .ln::before{content:"";position:absolute;left:-20px;top:50%;width:10px;height:10px;margin-top:-5px;border-radius:5px;background:var(--paper-50);box-shadow:inset 0 0 0 2px var(--ink-400)}
.tl .ln.now::before{background:var(--zhu-600);box-shadow:0 0 0 3px rgba(181,67,46,.2)}
.tl .ln.fail::before{box-shadow:inset 0 0 0 2px var(--zhu-600)}
.tl .ln b{font:700 13px/1.4 var(--f-serif);color:var(--ink-900);width:92px;flex:none}
.tl .ln .cs{display:flex;gap:4px}
.tl .ln .cs .chip{width:24px;height:24px;font-size:14px;border-radius:6px}
.tl .ln .ed{margin-left:auto;font:500 11px/1 var(--f-ui);white-space:nowrap}
.tl .ln .ed.f{color:var(--zhu-600)} .tl .ln .ed.ok{color:var(--jade-600)}
.tl .ln.now{color:var(--ink-900)}
.tl .ln .new{height:16px;padding:0 4px;border-radius:4px;background:var(--zhu-600);color:#fff;font:700 10px/16px var(--f-ui);margin-left:2px}
.keep{display:flex;gap:10px;align-items:center}
.keep .chip{width:44px;height:44px;font-size:26px}
.keep .chip.new{box-shadow:0 0 0 2px var(--zhu-600)}
.keep .meta{font:400 12px/1.5 var(--f-ui);color:var(--ink-600)}
.qrow{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:12px;box-shadow:inset 0 0 0 1px var(--paper-200);margin-top:8px}
.qrow.on{box-shadow:inset 0 0 0 2px var(--zhu-600);background:var(--bone-100)}
.qrow .rd{flex:none;width:18px;height:18px;border-radius:9px;box-shadow:inset 0 0 0 1.5px var(--ink-400);margin-top:2px}
.qrow.on .rd{box-shadow:inset 0 0 0 5px var(--zhu-600)}
.qrow p{text-wrap:balance;font:400 13px/1.6 var(--f-serif);color:var(--ink-900)}
.qrow small{display:block;font:400 11px/1.4 var(--f-ui);color:var(--ink-400)}
.fb{position:absolute;left:12px;right:12px;bottom:16px}
.fam{padding:6px 12px 0}
.fam .yr{display:flex;justify-content:space-between;align-items:center;padding:8px 4px;font:500 12px/1 var(--f-ui);color:var(--ink-600)}
.prog{display:flex;gap:8px;margin:10px 12px 0}
.prog .p{flex:1;border-radius:12px;background:var(--paper-50);box-shadow:0 0 0 1px var(--paper-line);padding:10px 12px}
.prog .p b{display:block;font:700 13px/1.3 var(--f-serif)}
.prog .p small{font:400 11px/1.4 var(--f-ui);color:var(--ink-400)}
.prog .bar{height:4px;border-radius:2px;background:var(--paper-200);margin-top:6px;position:relative;overflow:hidden}
.prog .bar i{position:absolute;left:0;top:0;bottom:0;background:var(--ink-600)}
'''
def ln(n, chars, end, kind='', now=False):
    cs = ''.join('<span class="chip">%s</span>' % c for c in chars) if chars else '<span style="font-size:11px;color:var(--ink-400)">未成字</span>'
    return '<div class="ln%s%s"><b>第 %d 代记事人</b><span class="cs">%s</span>%s<span class="ed %s">%s</span></div>' % (
        ' now' if now else '', ' fail' if kind == 'f' else '', n, cs, '<span class="new">新</span>' if now else '', kind, end)

F = phone('<b>F</b> 代末 · 余年用完（寿终传笔）', STRIP + stat('第 4 代 · 终', '一代终了') +
  '<div class="st0"><div class="k">一代终了</div><h2>第 4 代记事人放下了刻刀</h2><span class="end">寿终传笔</span></div>'
  '<div class="blk"><div class="sec">家谱 · 添一笔</div><div class="tl">%s%s%s</div></div>'
  '<div class="blk"><div class="sec">这一代留下</div><div class="keep"><span class="chip new">休</span><span class="chip new">田</span><div class="meta">刻成 2 字 · 残片线索 1 条<br>骨片 1 片在冬夜裂了</div></div></div>'
  '<div class="blk"><div class="sec">传给下一代的事签（最多 1 张）</div>'
  '<div class="qrow on"><i class="rd"></i><div><p>雨后泥地上，一串小小的爪印绕着粟堆<span class="nw">走了一圈</span></p><small>第 4 年秋刻下 · 将占下一代字匣 1 格</small></div></div>'
  '<div class="qrow"><i class="rd"></i><div><p>不传，空出字匣一格</p></div></div></div>'
  '<div class="fb"><div class="btns" style="margin:0"><div class="btn ghost">看家谱</div><div class="btn pri">开新一代</div></div></div>'
  % (ln(2, '人月', '寿终传笔', 'ok'), ln(3, '木禾', '寿终传笔', 'ok'), ln(4, '休田', '寿终传笔', 'ok', True)), cls='paper')

G = phone('<b>G</b> 家谱页 · 从主菜单或代末进入', STRIP + stat('家谱', '已传 6 代') +
  '<div class="st0"><h2 style="margin-top:0">家谱</h2><div style="margin-top:6px;font:400 12px/1.6 var(--f-ui);color:var(--ink-600)">一代一笔：哪一代记事人、造了哪些字、怎么结束的。</div></div>'
  '<div class="prog"><div class="p"><b>河曲部落</b><small>主线 · 第 2 段 / 6</small><div class="bar"><i style="width:33%%"></i></div></div><div class="p"><b>字录</b><small>9 / 27</small><div class="bar"><i style="width:33%%"></i></div></div></div>'
  '<div class="blk"><div class="tl">%s%s%s%s%s%s</div></div>' % (
   ln(1, '水日', '寿终传笔', 'ok'), ln(2, '人月', '寿终传笔', 'ok'), ln(3, '木禾', '寿终传笔', 'ok'), ln(4, '休田', '寿终传笔', 'ok'),
   ln(5, '', '仓满招寇', 'f'), ln(6, '林', '失祀', 'f', True)) +
  '<div style="padding:12px 16px 0;font:400 11px/1.6 var(--f-ui);color:var(--ink-400)">点任一行展开：这一代的小故事、刻成的字、结局卡原文。</div>', cls='paper')

notes = '''<div class="notes">
<h3>代末结算（F）</h3>
<table>
<tr><td>顺序</td><td>结局卡（失败或善终）→ 本页 → 选传人 → 开局挑字。</td></tr>
<tr><td>标题</td><td>小标「一代终了」12 Bold 朱；主标 Serif 24 Bold；结局胶囊 26 高：善终用 jade，失败用朱（见结局页）。</td></tr>
<tr><td>家谱</td><td>只露最近 3 代；新一行左侧朱点 + 「新」，入场时从左描出 400ms。</td></tr>
<tr><td>留下</td><td>本代刻成的字 44×44，朱 2 描边；残片线索、裂骨片只写一行数字。</td></tr>
<tr><td>传事签</td><td>单选，最多 1 张；默认选最近刻下的一张；可选「不传」。没有事签时整块不显示。</td></tr>
</table>
<h3>家谱页（G）</h3>
<ul>
<li>一行一代：圆点 10、竖线 2 paper-line；名称一律「第 N 代记事人」，不起名字。</li>
<li>字 24×24 圆角 6；未成字的那代写「未成字」ink-400。</li>
<li>结局字：善终 jade-600，失败 zhu-600，11 Medium。</li>
<li>顶部两张进度卡：主线段数、字录计数；条高 4。</li>
<li>行多时整页滚动，最新一代在最下并自动滚到底。</li>
</ul>
<h3>不出图，只写 SPEC</h3>
<p>天雨粟、鬼夜哭两种特殊善终用同一张代末页，只换结局胶囊文字。</p>
</div>'''
body = '<style>%s</style><div class="row">%s%s%s</div>' % (CSS, F, G, notes)
open('/workspace/zaozi-formal/v2/settle_gen_v1.html','w').write(page('代末结算 · 家谱', '一代终了 · 家谱添一笔 · 留下的字 · 传事签', body, 960,
 '本稿不改玩法数值；代次、字、结局、事签文案均为版式占位。', '代末结算 v2 · 360vp 屏宽'))
