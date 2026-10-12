# -*- coding: utf-8 -*-
import sys; sys.path.insert(0, '/workspace/zaozi-formal/v1/src')
from common import *

CSS = r'''
.scr{background:linear-gradient(180deg,var(--night-900) 0%,#1A1D29 60%,var(--night-800) 100%);height:760px;position:relative;color:var(--on-night)}
.stat{height:44px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;font:500 13px/1 var(--f-ui);color:var(--on-night);border-bottom:1px solid var(--night-line)}
.stat span:last-child{color:var(--on-night-2);font-variant-numeric:tabular-nums}
.eb{display:flex;justify-content:space-between;align-items:center;padding:16px 16px 0}
.eb .tag{height:24px;padding:0 10px;border-radius:12px;border:1px solid var(--gold-400);color:var(--gold-400);font:700 12px/22px var(--f-ui);letter-spacing:.06em}
.eb .n{font:400 12px/1 var(--f-ui);color:var(--on-night-2)}
.qt{padding:10px 16px 0;font:400 14px/22px var(--f-serif);color:var(--on-night-2);text-wrap:balance}
.qt b{font-weight:400;color:var(--on-night)}
.bonewrap{padding:16px 16px 0}
.bone.hero{width:328px;height:356px;padding:22px 16px 0}
.hero .gbox{width:176px;height:176px;margin:0 auto;color:var(--carve);position:relative}
.hero .gbox .today{font-size:150px;color:var(--ink-900)}
.hero .formula{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;height:32px;font:700 14px/1 var(--f-ui);color:var(--ink-600)}
.hero .evo{margin-top:20px;justify-content:center}
.skip{position:absolute;right:14px;top:12px;font:400 11px/1 var(--f-ui);color:var(--ink-400)}
.hint{text-align:center;padding:18px 16px 0;font:400 12px/1.5 var(--f-ui);color:var(--on-night-2)}
.dots{display:flex;gap:6px;justify-content:center;margin-top:10px}
.dots i{width:6px;height:6px;border-radius:3px;background:var(--night-line)} .dots i.on{width:18px;background:var(--gold-400)}
.scr .draft-strip{position:relative;z-index:5}
.scrim{position:absolute;left:0;right:0;top:24px;bottom:0;background:rgba(10,11,16,.45)}
.sheet{position:absolute;left:0;right:0;bottom:0;background:var(--paper-50);border-radius:20px 20px 0 0;padding:10px 20px 20px;color:var(--ink-900);box-shadow:0 -8px 24px rgba(0,0,0,.3)}
.sheet .grab{width:36px;height:4px;border-radius:2px;background:var(--paper-line);margin:0 auto 14px}
.sheet .k{font:700 12px/1 var(--f-ui);color:var(--zhu-600);letter-spacing:.12em}
.sheet h2{font:700 24px/1.25 var(--f-serif);margin-top:8px}
.sheet .sub{display:flex;align-items:center;gap:8px;margin-top:10px;font:400 13px/1 var(--f-ui);color:var(--ink-600)}
.val{display:flex;align-items:center;justify-content:space-between;margin-top:16px;height:52px;border-radius:12px;background:var(--paper-100);padding:0 16px;box-shadow:inset 0 0 0 1px var(--paper-200)}
.val .l{font:500 14px/1 var(--f-ui);color:var(--ink-600)}
.val .r{font:700 16px/1 var(--f-ui);font-variant-numeric:tabular-nums;color:var(--ink-900)}
.val .d{display:inline-block;margin-left:10px;height:24px;line-height:24px;padding:0 8px;border-radius:12px;background:var(--zhu-600);color:#fff;font-size:13px}
.sheet .meta{margin-top:10px;font:400 12px/1.5 var(--f-ui);color:var(--ink-400)}
.btns{display:flex;gap:12px;margin-top:18px}
.btn{flex:1;height:44px;border-radius:22px;display:flex;align-items:center;justify-content:center;font:700 15px/1 var(--f-ui)}
.btn.ghost{box-shadow:inset 0 0 0 1px var(--ink-400);color:var(--ink-900)}
.btn.pri{background:var(--zhu-600);color:#fff}
.kf{display:flex;gap:8px;margin-top:6px}
.kf .f{flex:1;text-align:center}
.kf .m{height:58px;border-radius:12px 9px 13px 8px;background:var(--bone-100);box-shadow:inset 0 0 0 1px var(--bone-300);color:var(--carve);padding:6px;display:flex;align-items:center;justify-content:center}
.kf .m .g{width:86%;height:86%} .kf .m .today{font-size:36px;color:var(--ink-900)}
.kf .t{font:700 11px/1.2 var(--f-ui);color:var(--zhu-600);margin-top:4px;font-variant-numeric:tabular-nums}
.kf .s{font:400 10px/1.2 var(--f-ui);color:var(--ink-600)}
.mini{transform:scale(.68);transform-origin:top left;width:328px;height:356px}
.miniwrap{width:223px;height:242px;margin:8px auto 0;background:var(--night-800);border-radius:14px;padding:8px 0 0 0;overflow:hidden}
'''

def crack():
    return ('<i class="crack" style="left:22px;top:64px;width:46px;transform:rotate(18deg)"></i>'
            '<i class="crack" style="left:270px;top:40px;width:34px;transform:rotate(-24deg)"></i>'
            '<i class="crack" style="left:252px;top:228px;width:40px;transform:rotate(12deg)"></i>')

def hero(key, frame, on, dim_after, formula, skip=True):
    if frame == 'today':
        g = '<span class="today">%s</span>' % MODERN[key]
    else:
        g = '<i class="g g-%s"></i>' % GLYPHS[key][0][0].split('.')[0]
    sk = '<span class="skip">点一下跳过</span>' if skip else ''
    return ('<div class="bone hero">%s%s<div class="gbox">%s</div><div class="formula">%s</div>%s</div>'
            % (crack(), sk, g, formula, evo_html(key, 'card', on=on, bh=False, era=False, dim_after=dim_after)))

F_XIU = '<span class="badge huiyi">会意</span><span class="chip">人</span>＋<span class="chip">木</span>'
F_SHUI = '<span class="badge xiang">象形</span><span style="font:500 13px/1 var(--f-ui)">描迹 · 水</span>'
QT = '<div class="eb"><span class="tag">冬夜刻字 · 成字</span><span class="n">事签 1 / 1</span></div><div class="qt">事签：<b>晌午正热，赶路的背抵着<span class="nw">一截老干</span>，头顶叶子<span class="nw">遮着太阳</span>，一直待到<span class="nw">天色转凉</span></b></div>'
STAT = '<div class="draft-strip">设计稿，非玩法示意</div><div class="stat"><span>第 4 代 · 第 1 年冬夜</span><span>空骨片 2 · 字录 7 / 27</span></div>'

phoneA = ('<div><div class="cap"><b>A</b> 刻对后第 0.2 秒 · 骨片上先出甲骨文</div><div class="phone"><div class="scr">%s%s<div class="bonewrap">%s</div>'
          '<div class="hint">古字形一步步变成今天的写法</div><div class="dots"><i class="on"></i><i></i><i></i><i></i><i></i></div></div></div></div>'
          % (STAT, QT, hero('xiu', 'old', 0, 0, F_XIU)))
sheet = ('<div class="scrim"></div><div class="sheet"><div class="grab"></div><div class="k">成字</div><h2>「休」入字录</h2>'
         '<div class="sub"><span class="badge huiyi">会意</span>人 ＋ 木 · 第 4 代第 1 年冬夜</div>'
         '<div class="val"><span class="l">记忆</span><span class="r">63 → 69<span class="d">记 +6</span></span></div>'
         '<div class="meta">骨片随字入录 · 空骨片仍是 2</div>'
         '<div class="btns"><div class="btn ghost">看字录</div><div class="btn pri">继续</div></div></div>')
phoneB = ('<div><div class="cap"><b>B</b> 第 3.0 秒 · 落成今天的写法，弹层上滑</div><div class="phone"><div class="scr">%s%s<div class="bonewrap">%s</div>%s</div></div></div>'
          % (STAT.replace('7 / 27', '8 / 27'), QT, hero('xiu', 'today', 4, None, F_XIU, skip=False), sheet))

kf = ''.join('<div class="f"><div class="m">%s</div><div class="t">%s</div><div class="s">%s</div></div>' % (
    ('<i class="g g-%s"></i>' % fn.split('.')[0]), t, nm) for (fn, nm, _), t in zip(GLYPHS['xiu'], ['0.0s', '0.6s', '1.2s', '1.8s']))
kf += '<div class="f"><div class="m"><span class="today">休</span></div><div class="t">2.4s</div><div class="s">今天</div></div>'

notes = '''<div class="notes">
<h3>动画节奏（首次完整播约 3 秒）</h3>
<div class="kf">%s</div>
<table>
<tr><td>0.0s</td><td>甲骨文刻痕显现：描边由起笔处生长，480ms，ease-out；演变条第 1 格亮起。</td></tr>
<tr><td>0.6s</td><td>交叉淡化到金文，每次 300ms；演变条同步点亮下一格，已过的格保持常亮。</td></tr>
<tr><td>1.2s</td><td>小篆。</td></tr>
<tr><td>1.8s</td><td>隶书（这一格有字形才播；没有就直接跳到下一步，不停顿）。</td></tr>
<tr><td>2.4s</td><td>今天的写法：刻痕色 <code>#6E2F1F</code> 变为墨色 <code>#2A241D</code>，骨片轻微下沉 2px 再回弹。</td></tr>
<tr><td>3.0s</td><td>弹层上滑 240ms（遮罩 45%%）；「记 +6」数字从 63 滚到 69。</td></tr>
</table>
<ul style="margin-top:8px">
<li><b>重看<span class="nw">约 1 秒</span></b>（字录里点<span class="nw">「再看一次」</span>）：甲骨文 400ms → 今天写法 600ms，中间阶段只在<span class="nw">演变条</span>上依次闪亮。</li>
<li><b>点一下</b>任意处：直接到 B 的末帧，弹层随即上滑。</li>
</ul>
<h3>同一套组件 · 象形「水」</h3>
<div class="miniwrap"><div class="mini">%s</div></div>
<p style="margin-top:8px">只换三处：字形组、<span class="nw">造法徽标</span>（象形用<span class="nw">青色</span>）、<span class="nw">公式行</span>（会意写部件，象形写<span class="nw">「描迹」</span>，指事写<span class="nw">「底字 木 · 下」</span>）。<span class="nw">演变条</span>格数随<span class="nw">实际字形</span>走。</p>
</div>''' % (kf, hero('shui', 'old', 0, 0, F_SHUI, skip=False))

body = '<div class="row">%s%s%s</div><div class="foot"><span>本稿不改玩法数值；字录计数、四维、事签文案均为版式占位。卡面与选项仍用今天的字。</span><span>造字卡 v1 · 360vp 屏宽</span></div>' % (phoneA, phoneB, notes)
open('/workspace/zaozi-formal/v1/card_zaozi_v1.html', 'w').write(page('造字卡 · 造字那一刻', '冬夜刻对之后 · 示例：休（会意）／水（象形）', '<style>%s</style>%s' % (CSS, body), 1150))
