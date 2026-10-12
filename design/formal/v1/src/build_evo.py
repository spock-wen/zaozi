# -*- coding: utf-8 -*-
import sys; sys.path.insert(0, '/workspace/zaozi-formal/v1/src')
from common import *

CSS = r'''
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:24px;padding:24px 24px 0}
.panel{background:var(--paper-50);border-radius:16px;padding:20px;box-shadow:0 0 0 1px var(--paper-line)}
.panel.dark{background:var(--night-800);box-shadow:none;color:var(--on-night)}
.panel h3{font:700 16px/1.3 var(--f-serif);color:var(--ink-900);margin-bottom:4px}
.panel.dark h3{color:var(--on-night)}
.panel .d{font:400 12px/1.6 var(--f-ui);color:var(--ink-600)}
.panel.dark .d{color:var(--on-night-2)}
.full{padding:24px 24px 0}
.track{width:304px;padding:12px 0 6px;position:relative;margin-top:12px}
.track:before{content:"";position:absolute;left:-6px;right:-6px;top:4px;bottom:0;border:1px dashed var(--paper-line);border-radius:12px}
.dark .track:before{border-color:var(--night-line)}
.track .w{position:absolute;right:0;top:-12px;font:400 10px/1 var(--f-ui);color:var(--ink-400)}
.ex{display:grid;grid-template-columns:330px 1fr;gap:20px;align-items:start;padding:16px 0;border-top:1px solid var(--paper-200)}
.ex:first-of-type{border-top:0}
.ex h4{font:700 14px/1.4 var(--f-serif);color:var(--ink-900)}
.ex h4 .badge{margin-right:8px;vertical-align:1px}
.ex p{font:400 12px/1.65 var(--f-ui);color:var(--ink-600);margin-top:4px}
.ex p b{color:var(--ink-900)}
/* anatomy */
.ana{position:relative;height:300px;margin-top:8px}
.ana .evo{position:absolute;left:40px;top:28px}
.ana .gbox{position:absolute;left:40px;top:28px;width:168px;height:168px}
.ana .inner{position:absolute;left:51.76px;top:39.76px;width:144.48px;height:144.48px;border:1px dashed var(--zhu-600)}
.dm{position:absolute;font:700 11px/1 var(--f-ui);color:var(--zhu-600);white-space:nowrap}
.hl{position:absolute;border-top:1px solid var(--zhu-600)}
.vl{position:absolute;border-left:1px solid var(--zhu-600)}
.ana .lst{position:absolute;left:236px;top:24px;font:400 12px/1.7 var(--f-ui);color:var(--ink-600)}
.ana .lst b{color:var(--ink-900);display:inline-block;width:64px}
table.tk{width:100%;border-collapse:collapse;margin-top:10px;font:400 12px/1.5 var(--f-ui);color:var(--ink-600)}
table.tk th{font:700 12px/1.5 var(--f-ui);color:var(--ink-900);text-align:left;padding:6px 8px 6px 0;border-bottom:1px solid var(--paper-line)}
table.tk td{padding:6px 8px 6px 0;border-bottom:1px solid var(--paper-200);vertical-align:top}
table.tk td:first-child{font-weight:700;color:var(--ink-900);white-space:nowrap}
.states{display:flex;gap:18px;margin-top:14px;align-items:flex-start}
.st{text-align:center;font:400 11px/1.4 var(--f-ui);color:var(--ink-600)}
.st .evo{justify-content:center;margin-bottom:6px}
.pop2{width:188px;background:var(--paper-50);border-radius:14px;padding:10px;box-shadow:0 0 0 1px var(--paper-line),0 8px 20px rgba(40,30,20,.18);text-align:left}
.pop2 .gl{width:144px;height:144px;border-radius:14px;background:var(--bone-100);box-shadow:inset 0 0 0 1px var(--bone-300);color:var(--carve);display:flex;align-items:center;justify-content:center;margin:0 auto}
.pop2 .gl .g{width:86%;height:86%}
.pop2 h5{font:700 14px/1.3 var(--f-serif);color:var(--ink-900);margin-top:8px}
.pop2 p{font:400 12px/1.5 var(--f-serif);color:var(--ink-900)}
.pop2 small{display:block;font:400 10px/1.4 var(--f-ui);color:var(--ink-400);margin-top:4px}
.rules{columns:2;column-gap:32px;font:400 12px/1.7 var(--f-ui);color:var(--ink-600);margin-top:8px}
.rules li{break-inside:avoid;margin:0 0 6px 16px}
.rules b{color:var(--ink-900)}
'''

ana_evo = '<div class="evo" style="--cell:168px"><div class="c"><div class="box" style="border-radius:30px"><i class="g g-xiu_seal"></i></div></div></div>'
anatomy = '''<div class="panel"><h3>格子解剖（放大 3 倍示意）</h3><p class="d">字形最长边占格子 86%%；SVG 已按这个比例裁好外框，代码里只需「等比放进格子」。</p>
<div class="ana">%s<div class="inner"></div>
<span class="hl" style="left:40px;top:14px;width:168px"></span><span class="dm" style="left:104px;top:0">56</span>
<span class="vl" style="left:26px;top:28px;height:168px"></span><span class="dm" style="left:8px;top:104px">56</span>
<span class="hl" style="left:52px;top:208px;width:144px"></span><span class="dm" style="left:84px;top:214px">字形 48（86%%）</span>
<div class="lst"><b>格子</b>56 × 56（标准档 M）<br><b>圆角</b>10　<b style="width:auto">描边</b> 1 <code>#CDBB94</code><br><b>底色</b>骨色 <code>#F1E8D4</code><br><b>字形色</b>刻痕色 <code>#6E2F1F</code><br><b>今天的字</b>Serif Bold，字号 = 格 × 0.80<br><b>阶段名</b>11 Bold，格下 6<br><b>时代</b>10，<code>#766C5E</code><br><b>白话</b>10 / 14，最多两行<br><b>格间距</b>6（M）· 5（S）· 14（卡面）</div>
<div style="position:absolute;left:40px;top:240px;width:440px;font:400 12px/1.6 var(--f-ui);color:var(--ink-600)">繁简写法相同时，最后一格写<b style="color:var(--ink-900)">「繁简同形」</b>，只放一个今天的字；繁简不同时拆成「繁体」「简体」两格，繁体用 Noto Serif CJK TC。</div>
</div><h3 style="margin-top:4px">放大态</h3><div class="states" style="margin-top:8px">
<div class="pop2"><div class="gl"><i class="g g-ben_bronze"></i></div><h5>金文 · 商周</h5><p>树根加粗成一团</p><small>出处：Wikimedia Commons<br>本-bronze.svg · 公有领域</small></div>
<div class="st" style="text-align:left;flex:1;padding-top:4px">放大卡宽 188，字形区 144 × 144，圆角 14。<br>标题 = 阶段名 · 时代（Serif 14 Bold）；下面<span class="nw">一行白话</span>；再下面是出处（10，<code>#766C5E</code>）。<br>左右滑切换阶段，底部圆点指示当前格。</div>
</div></div>''' % ana_evo

sizes = '''<div class="panel"><h3>尺寸档位</h3><p class="d">按所在界面挑档位，不在中间档之间插值。轨道宽度按 360vp 屏宽、左右各留 12 + 卡片内边距 16 计。</p>
<table class="tk"><tr><th>档位</th><th>格子</th><th>间距</th><th>用在</th><th>轨道</th></tr>
<tr><td>卡面 C</td><td>48</td><td>14</td><td>造字卡骨片底部，只显示阶段名</td><td>296（5 格）</td></tr>
<tr><td>标准 M</td><td>56</td><td>6</td><td>字录详情，带时代和白话</td><td>304（5 格）</td></tr>
<tr><td>紧凑 S</td><td>46</td><td>5</td><td>繁简不同、共 6 格时</td><td>301（6 格）</td></tr>
<tr><td>放大 L</td><td>144</td><td>—</td><td>点一格后的放大卡</td><td>—</td></tr></table>
<h3 style="margin-top:18px">状态</h3>
<div class="states">
<div class="st">%s默认</div>
<div class="st">%s选中<br>朱色 2 描边</div>
<div class="st">%s造字卡里<br>还没播到<br>透明度 38%%</div>
</div>
</div>''' % (
    '<div class="evo"><div class="c"><div class="box"><i class="g g-shui_seal"></i></div></div></div>',
    '<div class="evo"><div class="c on"><div class="box"><i class="g g-shui_seal"></i></div></div></div>',
    '<div class="evo"><div class="c dim"><div class="box"><i class="g g-shui_seal"></i></div></div></div>')

ex = '''<div class="full"><div class="panel"><h3>示例：按实际有的字形排</h3><p class="d">虚线框是 304 宽的轨道。格子从左排起，宽度不拉伸；少几格，右边就空出几格的位置，什么也不写。</p>
<div class="ex"><div class="track"><span class="w">304</span>%s</div><div><h4><span class="badge huiyi">会意</span>休 · 五格，隶书用西汉</h4><p>甲骨文 › 金文 › 小篆 › 隶书 › 繁简同形。<br>休在秦代隶书里没有字形，这一格用西汉隶书，<b>时代行写「西汉」</b>。</p></div></div>
<div class="ex"><div class="track"><span class="w">304</span>%s</div><div><h4><span class="badge zhishi">指事</span>本 · 四格，从金文起</h4><p>本没有甲骨文字形，<b>那一格不出现</b>，金文排在第一格，后面依次前移。<br>同样的规则也适用于缺金文（云、炎、森）、缺小篆（众）或缺隶书的字：缺哪格就少哪格，不放空框、不写说明文字。</p></div></div>
<div class="ex"><div class="track"><span class="w">304</span>%s</div><div><h4><span class="badge huiyi">会意</span>从 · 六格，繁简不同</h4><p>繁体「從」、简体「从」分成两格，换用紧凑档（格 46，间距 5）。<br>隶书一格是「從」的秦简写法，和繁体一格对得上。</p></div></div>
</div></div>''' % (evo_html('xiu'), evo_html('ben'), evo_html('cong', 's'))

themes = '''<div class="grid2">
<div class="panel"><h3>浅底（字录、卡纸）</h3><p class="d">骨色格 + 刻痕色字形，对比度 8.3 : 1。</p><div class="track" style="margin-top:16px">%s</div></div>
<div class="panel dark"><h3>深底（冬夜、真结局）</h3><p class="d">深格 <code style="background:#2B3042;color:#EADFC6">#2B3042</code> + 浅骨色字形 <code style="background:#2B3042;color:#EADFC6">#EADFC6</code>，对比度 9.9 : 1。深底上不用刻痕色，太暗。</p><div class="track" style="margin-top:16px">%s</div></div>
</div>''' % (evo_html('shui', bh=False), evo_html('shui', 'night', bh=False))

rules = '''<div class="full"><div class="panel"><h3>规则</h3><ul class="rules">
<li><b>顺序固定：</b>甲骨文 › 金文 › 小篆 › 隶书 › 繁简（同形一格 / 不同两格）。</li>
<li><b>空格就是空格：</b>没有字形的阶段直接不出格，不放灰框、不写任何说明。</li>
<li><b>阶段名：</b>只用「甲骨文、金文、小篆、隶书、繁简同形、繁体、简体」七个词。</li>
<li><b>时代行：</b>商 / 商周 / 秦 / 秦简 / 西汉 / 东汉，跟着字形出处写；最后一格不写时代。</li>
<li><b>白话：</b>每阶段一行，十字以内，只写看得见的变化（如「中线变直成撇捺」），不下<span class="nw">字源结论</span>；手动断行，每行最多五字。</li>
<li><b>出处：</b>只在放大卡里写，格子上不写。</li>
<li><b>只在三处出现：</b>造字那一刻、字录详情、真结局；事件卡和选项一律用今天的字。</li>
<li><b>不自己画古字形：</b>只用有出处的 Commons SVG 和小学堂 CC0 字形，不改笔画。</li>
</ul></div></div>'''

body = '<div class="grid2">%s%s</div>%s%s%s<div class="foot"><span>示例字形：Wikimedia Commons 古汉字项目（公有领域）与中研院小学堂隶书（CC0）。本稿不改玩法数值。</span><span>演变条 v1</span></div>' % (anatomy, sizes, ex, themes, rules)
open('/workspace/zaozi-formal/v1/evo_strip_v1.html', 'w').write(page('演变条 · 组件说明', '格子尺寸 · 空格规则 · 繁简合并 · 放大态', '<style>%s</style>%s' % (CSS, body), 1900))
