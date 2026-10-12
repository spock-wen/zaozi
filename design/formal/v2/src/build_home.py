# -*- coding: utf-8 -*-
import sys; sys.dont_write_bytecode=True; sys.path.insert(0,'/workspace/zaozi-formal/v2/src')
from v2common import *

def ecard(who, sea, txt, extra='', cls=''):
    return ('<div class="ecard %s"><div class="por"><span class="who">%s</span><span class="sea">%s</span><div class="sil"></div><span class="ph">人物立绘区</span></div>'
            '<div class="txt">%s</div>%s</div>' % (cls, who, sea, txt, extra))
UNDER = '<div class="ecard under"></div>'
def ziku(slots, tip):
    return '<div class="ziku"><div class="hd"><span><b>字匣</b></span><span>点字可落 · 每字每代一次</span></div><div class="slots">%s</div><div class="tip">%s</div></div>' % (slots, tip)
S_OK = '<div class="slot ok">水</div><div class="slot ok">日</div><div class="slot ok">禾</div>'

TOP = STRIP + stat('第 4 代 · 第 1 年春', '第 4 代记事人')
T1 = '「河边的地软了。先种粟，还是<span class="nw">先给水神献祭？</span>」'
A = phone('<b>A</b> 主界 · 读卡（静止）', TOP + hud([50,50,50,50]) + bones('eeecc') +
    '<div class="stage">%s%s</div>' % (UNDER, ecard('老族长', '春 · 1 / 3', T1)) +
    ziku(S_OK, '左右拖卡做决定<br>按住卡片看分量'))
B = phone('<b>B</b> 向右拖过阈值 · 卡顶出现右选项', TOP + hud([50,50,50,50]) + bones('eeecc') +
    '<div class="stage">%s%s</div>' % (UNDER, ecard('老族长', '春 · 1 / 3', T1, '<div class="opt r">先献祭</div>', 'tilt-r')) +
    ziku(S_OK, '松手即选定<br>拖回中间可取消'))
T4 = '「东岸的人<span class="nw">追鹿追过了河。</span>」'
C = phone('<b>C</b> 落字 · 点字匣「水」，卡上多出第三个选项', STRIP + stat('第 4 代 · 第 1 年夏', '第 4 代记事人') + hud([56,36,58,54], warn='信') + bones('eeeec') +
    '<div class="stage">%s%s</div>' % (UNDER, ecard('东岸猎人', '夏 · 1 / 2', T4, '<div class="third"><span>落「水」· 以河为界</span><small>再点一次确认</small></div>')) +
    ziku('<div class="slot sel">水</div><div class="slot ok">日</div><div class="slot ok">禾</div>', '落了的字<br>这一代冬夜不能当部件'))

notes = '''<div class="notes">
<h3>主界结构（自上而下，360vp）</h3>
<table>
<tr><td>24</td><td>设计稿标注条（正式包删除）</td></tr>
<tr><td>44</td><td>状态栏：代次 · 年 · 季；右侧「第 N 代记事人」</td></tr>
<tr><td>32</td><td><b>四维资源条</b>：粮 / 信 / 记 / 外，Serif 14 Bold；条高 6、圆角 3；两端各 15% 朱色淡区（0–15、85–100 危险）</td></tr>
<tr><td>32</td><td><b>骨片行</b>：空骨片 / 事签骨片（两道刻痕）/ 上限空位（虚线），共 5 位；右侧余年</td></tr>
<tr><td>396</td><td>事件卡 296×384，圆角 16；上半立绘 184，下半卡文 Serif 16/26；后一张卡缩 96%、透明 55%</td></tr>
<tr><td>104</td><td><b>字匣条</b>：3 格 48×48，圆角 12，间距 12</td></tr>
</table>
<h3>资源条状态</h3>
<ul>
<li>常态：填充 <code>#EEE7D8</code>，底 <code>#3A4057</code>。</li>
<li>进入两端 15%：填充和维名转朱色 <code>#B5432E</code> / <code>#E9A08F</code>（C 图的「信 36」只示意颜色，阈值以玩法为准）。</li>
<li>数值 10fp 二级色，是否显示数字待定（见 SPEC 待确认）。</li>
<li>结算动画：数值变动 320ms，变动的维名闪一下朱色描边。</li>
</ul>
</div>'''
notes2 = '''<div class="notes">
<h3>组件状态</h3>
<div style="display:flex;gap:14px;align-items:flex-end;background:var(--night-800);border-radius:12px;padding:12px 12px 10px;margin-bottom:6px">
<div style="width:70px">@H1@</div><div style="width:70px">@H2@</div><div style="width:70px">@H3@</div></div>
<p>资源条：常态 / 进入危险区 / 归零（触发结局）。</p>
<div style="display:flex;gap:16px;align-items:center;background:var(--night-800);border-radius:12px;padding:10px 12px;margin:10px 0 6px;color:var(--on-night-2);font-size:11px">
<span><i class="pip" style="display:inline-block;vertical-align:middle"></i> 空骨片</span><span><i class="pip sq" style="display:inline-block;vertical-align:middle"></i> 事签</span><span><i class="pip cap" style="display:inline-block;vertical-align:middle"></i> 上限空位</span><span><i class="pip crk" style="display:inline-block;vertical-align:middle"></i> 裂</span></div>
<p>骨片：上限 5 位；裂只在冬夜刻错时出现 600ms 后移除。</p>
<h3>拖卡</h3>
<ul>
<li>位移 ±14、旋转 ±5°，以卡底下方为轴；过阈值后卡顶出现选项条（深色 86%，Serif 16 Bold）。</li>
<li>点选退路：左右选项条常显，点一下即选（手势不过关时用）。</li>
</ul>
<h3>落字</h3>
<ul>
<li>点字匣格 → 该格选中（朱 2 描边 + 外发光），卡底升起朱色第三选项 48 高；再点一次确认，点别处取消。</li>
<li>落下后该格变「已落」，这一代冬夜部件盘里同字置灰。</li>
</ul>
</div>'''
_mini=lambda h:'<div class="hud" style="padding:0">'+h[len('<div class="hud">'):]
notes2=notes2.replace('@H1@',_mini(hud([50]))).replace('@H2@',_mini(hud([12],warn='粮'))).replace('@H3@',_mini(hud([0],warn='粮',zero='粮')))
body = '<div class="row">%s%s%s</div><div class="row" style="padding-top:20px">%s%s</div>' % (A, B, notes, C, notes2)
open('/workspace/zaozi-formal/v2/home_slide_v1.html','w').write(page('主界面 · 滑卡', '四维资源条 · 骨片行 · 事件卡 · 字匣条', body, 1720,
 '本稿不改玩法数值；四维、骨片、余年、卡文均为版式占位。卡面与选项用今天的字。', '主界面 v2 · 360vp 屏宽'))
