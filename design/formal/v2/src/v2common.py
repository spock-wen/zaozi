# -*- coding: utf-8 -*-
"""造字人 正式视觉 v2（补缺口）—— 只读引用 v1 token（v1/src/common.py），只追加新组件。设计稿，非玩法示意。"""
import sys, base64
sys.dont_write_bytecode = True
sys.path.insert(0, '/workspace/zaozi-formal/v1/src')
from common import BASE_CSS, glyph_css, GLYPHS, MODERN, evo_html  # v1 token，只读
V2G = '/workspace/zaozi-formal/v2/glyphs/norm/'
EXTRA = ['ri_oracle','ri_seal','ren_oracle','ren_seal','mu_oracle','mu_seal','tian_oracle','tian_seal']
def extra_css():
    o=[]
    for k in EXTRA:
        b=base64.b64encode(open(V2G+k+'.svg','rb').read()).decode()
        o.append('.g-%s{--src:url("data:image/svg+xml;base64,%s")}'%(k,b))
    return '\n'.join(o)

V2_CSS = r'''
:root{ --hud-track:#3A4057; --dim-liang:#D8B46A; --dim-xin:#B5432E; --dim-ji:#4E6E66; --dim-wai:#5B4A72; }
.scr{background:linear-gradient(180deg,var(--night-900) 0%,#1A1D29 60%,var(--night-800) 100%);height:760px;position:relative;color:var(--on-night);overflow:hidden}
.scr.paper{background:var(--paper-100);color:var(--ink-900)}
.scr .draft-strip{position:relative;z-index:9}
.stat{height:44px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;font:500 13px/1 var(--f-ui);color:var(--on-night);border-bottom:1px solid var(--night-line)}
.stat span:last-child{color:var(--on-night-2);font-variant-numeric:tabular-nums}
.paper .stat{color:var(--ink-900);border-bottom:1px solid var(--paper-line)} .paper .stat span:last-child{color:var(--ink-600)}
/* —— 四维资源条 —— */
.hud{display:flex;gap:8px;padding:12px 16px 0;position:relative}
.m{flex:1;min-width:0}
.m .top{display:flex;align-items:baseline;justify-content:space-between}
.m .k{font:700 14px/1 var(--f-serif);color:var(--on-night)}
.m .v{font:400 10px/1 var(--f-ui);color:var(--on-night-2);font-variant-numeric:tabular-nums}
.m .bar{position:relative;height:6px;border-radius:3px;background:var(--hud-track);margin-top:6px;overflow:hidden}
.m .bar i{position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:var(--on-night)}
.m .bar b{position:absolute;top:0;bottom:0;width:15%;background:rgba(181,67,46,.35)}
.m .bar b.l{left:0} .m .bar b.r{right:0}
.m.warn .bar i{background:var(--zhu-600)} .m.warn .k{color:#E9A08F}
.m.zero .bar i{width:0!important} 
/* 按住看分量：两排圆点 */
.dots2{padding:10px 16px 0;display:flex;flex-direction:column;gap:6px}
.dots2 .r{display:flex;gap:8px;align-items:center}
.dots2 .r .side{width:20px;font:700 10px/1 var(--f-ui);color:var(--gold-400)}
.dots2 .r .cells{flex:1;display:flex;gap:8px}
.dots2 .r .cells span{flex:1;height:12px;display:flex;align-items:center;justify-content:center}
.dots2 .r .cells span i{display:block;border-radius:50%;background:var(--gold-400)}
.d1{width:5px;height:5px} .d2{width:8px;height:8px} .d3{width:12px;height:12px}
/* 骨片行 */
.bones{display:flex;align-items:center;justify-content:space-between;padding:12px 16px 0}
.bones .lab{font:500 12px/1 var(--f-ui);color:var(--on-night-2);margin-right:8px}
.bones .set{display:flex;align-items:center;gap:6px}
.pip{width:16px;height:20px;border-radius:7px 5px 8px 4px / 5px 8px 5px 7px;background:linear-gradient(160deg,#F6EEDC,var(--bone-200));box-shadow:inset 0 0 0 1px rgba(110,80,40,.2);position:relative}
.pip.sq::after{content:"";position:absolute;left:4px;right:4px;top:9px;height:2px;background:var(--carve);border-radius:1px;box-shadow:0 -4px 0 var(--carve)}
.pip.cap{background:none;box-shadow:none;border:1px dashed var(--night-line)}
.pip.crk{opacity:.4} .pip.crk::before{content:"";position:absolute;left:2px;top:3px;width:12px;border-top:1.5px solid var(--carve);transform:rotate(55deg);transform-origin:left;}
.yrs{font:500 12px/1 var(--f-ui);color:var(--on-night-2);font-variant-numeric:tabular-nums}
.yrs b{color:var(--gold-400);font-weight:700}
/* 事件卡 */
.stage{position:relative;height:396px;margin-top:14px}
.ecard{position:absolute;left:32px;top:0;width:296px;height:384px;border-radius:16px;background:var(--paper-50);box-shadow:0 0 0 1px var(--paper-line),0 12px 28px rgba(0,0,0,.4);overflow:hidden;color:var(--ink-900)}
.ecard.under{transform:translateY(8px) scale(.96);opacity:.55;box-shadow:0 0 0 1px var(--paper-line)}
.ecard .por{height:184px;background:radial-gradient(90% 80% at 50% 30%,#F6EEDC 0%,var(--bone-200) 100%);position:relative;display:flex;align-items:flex-end;justify-content:center}
.ecard .sil{width:120px;height:150px;border-radius:60px 60px 10px 10px;background:linear-gradient(180deg,rgba(110,80,40,.18),rgba(110,80,40,.30))}
.ecard .who{position:absolute;left:12px;top:12px;height:24px;padding:0 10px;border-radius:12px;background:rgba(250,246,236,.92);font:700 12px/24px var(--f-ui);color:var(--ink-900);box-shadow:0 0 0 1px var(--paper-line)}
.ecard .sea{position:absolute;right:12px;top:12px;font:500 11px/24px var(--f-ui);color:var(--ink-600)}
.ecard .por .ph{position:absolute;bottom:10px;right:12px;font:400 10px/1 var(--f-ui);color:var(--ink-400)}
.ecard .txt{padding:18px 18px 0;font:400 16px/26px var(--f-serif);text-wrap:balance}
.ecard .opt{position:absolute;left:0;right:0;top:0;height:64px;display:flex;align-items:center;padding:0 16px;background:rgba(21,23,31,.86);color:var(--on-night);font:700 16px/1.3 var(--f-serif)}
.ecard .opt.r{justify-content:flex-end;text-align:right;padding-right:30px}.ecard .opt.l{padding-left:30px}
.ecard .third{position:absolute;left:12px;right:12px;bottom:12px;height:48px;border-radius:12px;background:var(--zhu-600);color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 14px;font:700 15px/1 var(--f-serif)}
.ecard .third small{font:500 11px/1 var(--f-ui);opacity:.85}
.ecard .mark{position:absolute;right:10px;top:150px;width:40px;height:40px;border-radius:12px;background:var(--bone-100);box-shadow:0 0 0 2px var(--zhu-600),0 0 0 6px rgba(181,67,46,.18);display:flex;align-items:center;justify-content:center}
.ecard .mark .pip{transform:scale(1.2)}
.tilt-r{transform:translateX(14px) rotate(5deg);transform-origin:50% 120%}
.tilt-l{transform:translateX(-14px) rotate(-5deg);transform-origin:50% 120%}
/* 字匣条 */
.ziku{position:absolute;left:0;right:0;bottom:0;height:104px;border-top:1px solid var(--night-line);background:rgba(21,23,31,.6);padding:10px 16px 0}
.ziku .hd{display:flex;justify-content:space-between;font:500 12px/1 var(--f-ui);color:var(--on-night-2)}
.ziku .hd b{color:var(--on-night);font-weight:700;letter-spacing:.12em}
.slots{display:flex;gap:12px;margin-top:10px}
.slot{width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;position:relative;font:700 26px/1 var(--f-serif)}
.slot.ok{background:var(--paper-50);color:var(--ink-900);box-shadow:inset 0 0 0 1.5px var(--ink-600)}
.slot.sel{background:var(--bone-100);color:var(--ink-900);box-shadow:inset 0 0 0 2px var(--zhu-600),0 0 0 3px rgba(181,67,46,.25)}
.slot.used{background:var(--night-700);color:rgba(238,231,216,.38);box-shadow:inset 0 0 0 1px var(--night-line)}
.slot.used::after{content:"已落";position:absolute;left:50%;bottom:-7px;transform:translateX(-50%);height:16px;padding:0 5px;border-radius:5px;background:var(--night-900);box-shadow:0 0 0 1px var(--night-line);font:700 10px/16px var(--f-ui);color:var(--on-night-2);white-space:nowrap}
.slot.sq{background:linear-gradient(160deg,#F6EEDC,var(--bone-200));color:var(--carve);font:700 11px/1.2 var(--f-ui);flex-direction:column;border-radius:14px 10px 15px 9px / 10px 15px 10px 14px}
.slot.empty{border:1.5px dashed var(--night-line);color:var(--on-night-2);font:400 20px/1 var(--f-ui)}
.slot.p.empty{border-color:var(--paper-line);color:var(--ink-400)}
.ziku .tip{position:absolute;right:16px;bottom:26px;width:150px;text-align:right;font:400 11px/1.5 var(--f-ui);color:var(--on-night-2)}
/* 底部弹层（沿用 v1 规格：上圆角 20、内边距 20、把手 36×4） */
.scrim{position:absolute;left:0;right:0;top:24px;bottom:0;background:rgba(10,11,16,.45);z-index:3}
.sheet{position:absolute;left:0;right:0;bottom:0;background:var(--paper-50);border-radius:20px 20px 0 0;padding:10px 20px 20px;color:var(--ink-900);box-shadow:0 -8px 24px rgba(0,0,0,.3);z-index:4}
.sheet .grab{width:36px;height:4px;border-radius:2px;background:var(--paper-line);margin:0 auto 14px}
.sheet .k{font:700 12px/1 var(--f-ui);color:var(--zhu-600);letter-spacing:.12em}
.sheet h2{font:700 24px/1.25 var(--f-serif);margin-top:8px}
.sheet .sub{margin-top:8px;font:400 13px/1.6 var(--f-ui);color:var(--ink-600)}
.btns{display:flex;gap:12px;margin-top:18px}
.btn{flex:1;height:44px;border-radius:22px;display:flex;align-items:center;justify-content:center;font:700 15px/1 var(--f-ui)}
.btn.ghost{box-shadow:inset 0 0 0 1px var(--ink-400);color:var(--ink-900)}
.btn.ghostn{box-shadow:inset 0 0 0 1px var(--on-night-2);color:var(--on-night)}
.btn.pri{background:var(--zhu-600);color:#fff}
.btn.off{background:var(--paper-200);color:var(--ink-400)}
.cost{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.cost span{height:28px;padding:0 10px;border-radius:14px;background:var(--paper-100);box-shadow:inset 0 0 0 1px var(--paper-200);font:500 13px/28px var(--f-ui);color:var(--ink-900);font-variant-numeric:tabular-nums}
.sec{font:700 12px/1 var(--f-ui);color:var(--ink-400);letter-spacing:.12em}
.chip{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;background:var(--paper-50);box-shadow:0 0 0 1px var(--paper-line),0 1px 0 rgba(0,0,0,.08);font:700 18px/1 var(--f-serif);color:var(--ink-900)}
.notes .sw{display:inline-block;width:10px;height:10px;border-radius:3px;vertical-align:-1px;margin-right:4px}
'''

def page(title, sub, body, h, foot_l, foot_r):
    return '''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>%s · 设计稿，非玩法示意</title>
<!-- 设计稿，非玩法示意。本稿不改玩法数值；样例数值仅为版式占位。token 引用 v1 SPEC §1–§5。 -->
<style>%s
%s
%s
%s
body{width:1080px;height:%dpx;overflow:hidden}
</style></head><body><div class="canvas" style="height:%dpx">
<div class="sheet-head"><h1>%s<small>%s</small></h1><span class="draft">设计稿，非玩法示意</span></div>
%s
<div class="foot"><span>%s</span><span>%s</span></div>
</div></body></html>''' % (title, BASE_CSS, glyph_css(), extra_css(), V2_CSS, h, h, title, sub, body, foot_l, foot_r)

STRIP = '<div class="draft-strip">设计稿，非玩法示意</div>'
def stat(l, r): return '<div class="stat"><span>%s</span><span>%s</span></div>' % (l, r)
def hud(vals, warn=(), zero=()):
    o = ['<div class="hud">']
    for k, v in zip('粮信记外', vals):
        c = 'm' + (' warn' if k in warn else '') + (' zero' if k in zero else '')
        o.append('<div class="%s"><div class="top"><span class="k">%s</span><span class="v">%s</span></div><div class="bar"><b class="l"></b><b class="r"></b><i style="width:%d%%"></i></div></div>' % (c, k, v, v))
    o.append('</div>'); return ''.join(o)
def bones(spec, yrs='余年 <b>4</b> 年'):
    # spec 字符串：e 空骨片 / s 事签骨片 / c 上限空位
    m = {'e': 'pip', 's': 'pip sq', 'c': 'pip cap'}
    return '<div class="bones"><div class="set"><span class="lab">骨片</span>%s</div><span class="yrs">%s</span></div>' % (''.join('<i class="%s"></i>' % m[x] for x in spec), yrs)
def phone(cap, inner, h=760, cls=''):
    return '<div><div class="cap">%s</div><div class="phone"><div class="scr %s" style="height:%dpx">%s</div></div></div>' % (cap, cls, h, inner)
