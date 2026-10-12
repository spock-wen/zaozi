# -*- coding: utf-8 -*-
import sys; sys.dont_write_bytecode=True; sys.path.insert(0,'/workspace/zaozi-formal/v2/src')
from v2common import *
CSS = r'''
.endc{position:absolute;left:24px;right:24px;top:132px;bottom:96px;border-radius:18px;background:var(--paper-50);box-shadow:0 0 0 1px var(--paper-line),0 16px 36px rgba(0,0,0,.45);overflow:hidden;color:var(--ink-900)}
.endc .band{height:8px;background:var(--accent)}
.endc .in{padding:22px 22px 0}
.endc .k{font:700 12px/1 var(--f-ui);color:var(--accent);letter-spacing:.12em}
.endc h2{font:700 40px/1.1 var(--f-serif);margin-top:14px;letter-spacing:.06em}
.endc .why{margin-top:10px;display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:13px;background:var(--accent-bg);color:var(--accent);font:700 12px/26px var(--f-ui)}
.endc .txt{margin-top:18px;font:400 16px/28px var(--f-serif);text-wrap:balance}
.endc .hr{height:1px;background:var(--paper-200);margin:20px 0 14px}
.endc .pu{font:400 13px/1.6 var(--f-serif);color:var(--ink-600)}
.endc .pu b{color:var(--ink-900)}
.endc .left{display:flex;gap:8px;align-items:center;margin-top:12px;font:400 12px/1.5 var(--f-ui);color:var(--ink-600)}
.endc .left .chip{width:40px;height:40px;font-size:24px}
.endbtn{position:absolute;left:24px;right:24px;bottom:24px}
.fail{--accent:#B5432E;--accent-bg:#F3DED6}
.good{--accent:#4E6E66;--accent-bg:#DDE6E1}
.mx{width:100%;border-collapse:separate;border-spacing:4px;margin-top:6px}
.notes .mx td{border:0;padding:6px 4px;border-radius:8px;background:var(--paper-100);font:400 11px/1.35 var(--f-ui);color:var(--ink-600);text-align:center;width:auto}
.notes .mx td:first-child{width:auto;background:none;font:700 12px/1.3 var(--f-serif);color:var(--ink-900)}
.notes .mx td b{display:block;font:700 13px/1.3 var(--f-serif);color:var(--zhu-600)}
.notes .mx td.gd b{color:var(--jade-600)}
.notes .mx th{font:700 11px/1 var(--f-ui);color:var(--ink-400);padding:2px 0}
'''
HUD0 = hud([44,0,58,62], warn='信', zero='信')
H = phone('<b>H</b> 失败结局卡 · 示例「失祀」（信 见底）', STRIP + stat('第 6 代 · 第 2 年秋', '第 6 代记事人') + HUD0 +
  '<div class="endc fail"><div class="band"></div><div class="in"><div class="k">这一代到此为止</div><h2>失祀</h2><span class="why">信 见底</span>'
  '<div class="txt">没人再信祭祀，族人说是你的刻骨招来了灾，<span class="nw">把你赶走。</span></div>'
  '<div class="hr"></div><div class="pu">家谱记下：<b>第 6 代，失祀</b></div>'
  '<div class="left"><span class="chip">林</span>这一代已刻成的字<span class="nw">照样留下</span></div></div></div>'
  '<div class="endbtn"><div class="btns" style="margin:0"><div class="btn ghostn">看家谱</div><div class="btn pri">往下传</div></div></div>')
I = phone('<b>I</b> 善终 · 寿终传笔（余年用完，四维都在中间）', STRIP + stat('第 4 代 · 第 4 年冬', '第 4 代记事人') + hud([57,45,63,62]) +
  '<div class="endc good"><div class="band"></div><div class="in"><div class="k">余年用完</div><h2>寿终传笔</h2><span class="why">四维都在中间</span>'
  '<div class="txt">这一冬没有大事。你把刻刀交给徒弟，<span class="nw">骨片收进了树洞。</span></div>'
  '<div class="hr"></div><div class="pu">家谱记下：<b>第 4 代，寿终传笔</b></div>'
  '<div class="left"><span class="chip">休</span><span class="chip">田</span>这一代刻成 2 字</div></div></div>'
  '<div class="endbtn"><div class="btns" style="margin:0"><div class="btn ghostn">看家谱</div><div class="btn pri">往下传</div></div></div>')
notes = '''<div class="notes">
<h3>结局卡模板</h3>
<table>
<tr><td>A 失败</td><td>8 种共用 H 的模板：色带 8 高 + 标题 Serif 40 Bold + 原因胶囊（某维见底 / 溢出）+ 一句结局话 Serif 16/28 + 家谱一行 + 留下的字。强调色 zhu-600 / zhu-100。</td></tr>
<tr><td>B 善终</td><td>寿终传笔、天雨粟、鬼夜哭共用 I 的模板，强调色 jade-600 / jade-100。</td></tr>
<tr><td>C 真结局</td><td>仓颉：单独做卷轴页，见真结局卷稿。</td></tr>
</table>
<h3>12 个结局 → 模板</h3>
<table class="mx">
<tr><th></th><th>见底（0）</th><th>溢出（100）</th></tr>
<tr><td>粮</td><td><b>饥年</b>A</td><td><b>仓满招寇</b>A</td></tr>
<tr><td>信</td><td><b>失祀</b>A · 本页</td><td><b>封骨</b>A</td></tr>
<tr><td>记</td><td><b>旧水重来</b>A</td><td><b>宿怨</b>A</td></tr>
<tr><td>外</td><td><b>兵祸</b>A</td><td><b>并族</b>A</td></tr>
<tr><td>善终</td><td class="gd"><b>寿终传笔</b>B · 本页</td><td class="gd"><b>天雨粟</b>B</td></tr>
<tr><td></td><td class="gd"><b>鬼夜哭</b>B</td><td class="gd"><b>仓颉</b>C</td></tr>
</table>
<h3>行为</h3>
<ul>
<li>触发时触底那一维条闪朱 2 次（各 200ms），再从下方升起结局卡 320ms，背后主界压暗。</li>
<li>只有一个出口按钮「往下传」→ 代末结算；「看家谱」开家谱页。</li>
<li>主线关键卡上的特殊结局套 A 或 B，标题和原因胶囊换文案。</li>
<li>结局话由写文案的同事给，一句，最多 3 行。</li>
</ul>
</div>'''
body = '<style>%s</style><div class="row">%s%s%s</div>' % (CSS, H, I, notes)
open('/workspace/zaozi-formal/v2/end_fail_v1.html','w').write(page('结局卡 · 失败与善终', '失败示例：失祀 · 善终示例：寿终传笔 · 12 个结局对应 3 套模板', body, 1010,
 '本稿不改玩法数值；四维、代次、结局话均为版式占位。', '结局卡 v2 · 360vp 屏宽'))
