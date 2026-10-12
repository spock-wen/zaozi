# -*- coding: utf-8 -*-
"""造字人 正式视觉 v1 —— 共用 token / 组件。设计稿，非玩法示意。"""
import base64, os
G = '/workspace/zaozi-formal/v1/glyphs/norm/'

def data_uri(fn):
    b = open(G + fn, 'rb').read()
    mime = 'image/svg+xml' if fn.endswith('.svg') else 'image/png'
    return 'data:%s;base64,%s' % (mime, base64.b64encode(b).decode())

# 每个阶段: key -> (文件, 阶段名, 时代)
GLYPHS = {
 'xiu':  [('xiu_oracle.svg','甲骨文','商'),('xiu_bronze.svg','金文','商周'),('xiu_seal.svg','小篆','秦'),('xiu_lishu.png','隶书','西汉')],
 'shui': [('shui_oracle.svg','甲骨文','商'),('shui_bronze.svg','金文','商周'),('shui_seal.svg','小篆','秦'),('shui_slip.svg','隶书','秦简')],
 'ben':  [('ben_bronze.svg','金文','商周'),('ben_seal.svg','小篆','秦'),('ben_lishu.png','隶书','秦简')],
 'cong': [('cong_oracle.svg','甲骨文','商'),('cong_bronze.svg','金文','商周'),('cong_seal.svg','小篆','秦'),('cong_lishu.png','隶书','秦简')],
}
# 白话：一阶段一行，十字以内，只写看得见的变化
BAIHUA = {
 'xiu':  ['一人背靠|一棵树','人形多了|一道短笔','笔画变成|匀称弧线','弧线拉成|横竖','和今天一样'],
 'shui': ['中间曲线|两旁水点','中线弯曲|加深','两旁点|拉成长线','中线变直|成撇捺','和今天一样'],
 'ben':  ['树根加粗|成一团','根部变成|一短横','横画平直|有波势','和今天一样'],
 'cong': ['两人|一前一后','两人笔画|加粗','两人站直|并排','添了走路|的部件','保留走路|部件','回到|两个人'],
}
def bh_plain(t): return t.replace('|','')
MODERN = {'xiu':'休','shui':'水','ben':'本','cong':'从'}

def glyph_css():
    out = []
    for k, st in GLYPHS.items():
        for fn, _, _ in st:
            out.append('.g-%s{--src:url("%s")}' % (fn.split('.')[0], data_uri(fn)))
    return '\n'.join(out)

def stages(key):
    """返回演变条的格子列表：(kind, glyph_class或今字, 阶段名, 时代)。缺的阶段不出格。"""
    cells = [('old', 'g-' + fn.split('.')[0], name, era) for fn, name, era in GLYPHS[key]]
    if key == 'cong':
        cells += [('trad', '從', '繁体', ''), ('simp', '从', '简体', '')]
    else:
        cells += [('simp', MODERN[key], '繁简同形', '')]
    return cells

BASE_CSS = r'''
:root{
  /* —— 色板 —— */
  --night-900:#15171F; --night-800:#1E2230; --night-700:#2B3042; --night-line:#3A4057;
  --bone-100:#F1E8D4; --bone-200:#E4D6B8; --bone-300:#CDBB94; --bone-crack:#B9A57C;
  --paper-50:#FAF6EC; --paper-100:#F3ECDD; --paper-200:#E6DCC6; --paper-line:#D8CCB2;
  --ink-900:#2A241D; --ink-600:#5C5346; --ink-400:#766C5E;
  --carve:#6E2F1F; --glyph-night:#EADFC6;
  --zhu-600:#B5432E; --zhu-100:#F3DED6; --gold-400:#D8B46A; --jade-600:#4E6E66; --jade-100:#DDE6E1;
  --on-night:#EEE7D8; --on-night-2:#A8A193;
  /* —— 字体 —— */
  --f-serif:"Noto Serif CJK SC","Noto Serif SC",serif;
  --f-ui:"HarmonyOS Sans SC","Noto Sans CJK SC",sans-serif;
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#D9D3C6}
body{font-family:var(--f-ui);color:var(--ink-900);-webkit-font-smoothing:antialiased}
.canvas{width:1080px;position:relative;background:#DCD6C8;padding:0 0 28px}
.sheet-head{height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 24px;background:var(--night-900);color:var(--on-night)}
.sheet-head h1{font:700 18px/1 var(--f-serif);letter-spacing:.04em}
.sheet-head h1 small{font:400 12px/1 var(--f-ui);color:var(--on-night-2);margin-left:12px;letter-spacing:0}
.draft{display:inline-flex;align-items:center;height:28px;padding:0 12px;border-radius:14px;background:var(--zhu-600);color:#fff;font:700 13px/1 var(--f-ui);letter-spacing:.06em}
.draft-strip{height:24px;display:flex;align-items:center;justify-content:center;background:var(--zhu-600);color:#fff;font:700 11px/1 var(--f-ui);letter-spacing:.12em}
.row{display:flex;gap:24px;padding:24px 24px 0;align-items:flex-start}
.phone{width:360px;flex:none;border-radius:28px;overflow:hidden;position:relative;box-shadow:0 0 0 1px rgba(0,0,0,.18),0 12px 32px rgba(0,0,0,.18)}
.cap{font:700 13px/1 var(--f-ui);color:var(--ink-600);margin:0 0 10px 4px;letter-spacing:.04em}
.cap b{color:var(--zhu-600)}
.notes{flex:1;min-width:0;background:var(--paper-50);border-radius:16px;padding:20px;font:400 12px/1.65 var(--f-ui);color:var(--ink-600);box-shadow:0 0 0 1px var(--paper-line)}
.notes h3{font:700 14px/1.3 var(--f-serif);color:var(--ink-900);margin:0 0 8px}
.notes h3:not(:first-child){margin-top:18px}
.notes table{width:100%;border-collapse:collapse;margin-top:4px}
.notes td{vertical-align:top;padding:5px 0;border-top:1px solid var(--paper-200)}
.notes td:first-child{width:52px;font:700 12px/1.65 var(--f-ui);color:var(--zhu-600);font-variant-numeric:tabular-nums}
.notes ul{padding-left:16px}
.notes code{font:500 11px/1 ui-monospace,monospace;background:var(--paper-100);padding:1px 4px;border-radius:4px;color:var(--ink-900)}
.foot{padding:16px 24px 0;font:400 12px/1.5 var(--f-ui);color:var(--ink-600);display:flex;justify-content:space-between}
.nw{white-space:nowrap}

/* 古字形：SVG/PNG 作蒙版，颜色走 token */
.g{display:block;width:100%;height:100%;background:currentColor;-webkit-mask:var(--src) center/contain no-repeat;mask:var(--src) center/contain no-repeat}
.today{display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-family:var(--f-serif);font-weight:700;line-height:1}

/* —— 演变条 —— */
.evo{display:flex;gap:var(--gap,6px);--cell:56px}
.evo .c{width:var(--cell);flex:none;display:flex;flex-direction:column;align-items:center}
.evo .box{width:var(--cell);height:var(--cell);border-radius:10px;background:var(--cell-bg,var(--bone-100));border:1px solid var(--cell-line,var(--bone-300));color:var(--carve);position:relative;display:flex;align-items:center;justify-content:center}
.evo .box .g{width:86%;height:86%}  /* 字形占格 86% */
.evo .box .today{font-size:calc(var(--cell) * .80);color:var(--ink-900)}
.evo .lab{margin-top:6px;font:700 11px/1.2 var(--f-ui);color:var(--ink-900);white-space:nowrap}
.evo .era{font:400 10px/1.3 var(--f-ui);color:var(--ink-400);white-space:nowrap;min-height:13px}
.evo .bh{margin-top:4px;font:400 10px/14px var(--f-serif);color:var(--ink-600);text-align:center;width:calc(var(--cell) + var(--gap,6px) - 2px);white-space:nowrap}
.evo .c.on .box{border:2px solid var(--zhu-600);box-shadow:0 0 0 3px rgba(181,67,46,.16)}
.evo .c.dim .box{opacity:.38}
.evo.night{--cell-bg:var(--night-700);--cell-line:var(--night-line)}
.evo.night .box{color:var(--glyph-night)}
.evo.night .box .today{color:var(--on-night)}
.evo.night .lab{color:var(--on-night)} .evo.night .era{color:var(--on-night-2)} .evo.night .bh{color:var(--on-night-2)}
.evo.s{--cell:46px;--gap:5px}
.evo.card{--cell:48px;--gap:14px}
.evo.card .lab{font-size:10px}

/* —— 骨片 —— */
.bone{position:relative;background:radial-gradient(120% 90% at 30% 20%,#F6EEDC 0%,var(--bone-100) 45%,var(--bone-200) 100%);border-radius:30px 22px 34px 20px / 22px 32px 22px 30px;box-shadow:inset 0 0 0 1px rgba(110,80,40,.18),inset 0 -10px 24px rgba(120,90,50,.18),0 10px 24px rgba(0,0,0,.35)}
.bone .crack{position:absolute;border-top:1px solid var(--bone-crack);opacity:.55;transform-origin:left}
.chip{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;background:var(--paper-50);box-shadow:0 0 0 1px var(--paper-line),0 1px 0 rgba(0,0,0,.08);font:700 18px/1 var(--f-serif);color:var(--ink-900)}
.badge{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:6px;font:700 12px/1 var(--f-ui);letter-spacing:.04em}
.badge.huiyi{background:var(--zhu-100);color:var(--zhu-600)}
.badge.xiang{background:var(--jade-100);color:var(--jade-600)}
.badge.zhishi{background:#E9E1F0;color:#5B4A72}
'''

def evo_html(key, cls='', on=None, bh=True, labels=True, era=True, dim_after=None):
    cells = stages(key)
    h = ['<div class="evo %s">' % cls]
    for i, (kind, g, name, er) in enumerate(cells):
        c = 'c'
        if on is not None and i == on: c += ' on'
        if dim_after is not None and i > dim_after: c += ' dim'
        inner = '<i class="g %s"></i>' % g if kind == 'old' else '<span class="today" style="%s">%s</span>' % ('font-family:\'Noto Serif CJK TC\',serif' if kind=='trad' else '', g)
        h.append('<div class="%s"><div class="box">%s</div>' % (c, inner))
        if labels: h.append('<div class="lab">%s</div>' % name)
        if era: h.append('<div class="era">%s</div>' % er)
        if bh: h.append('<div class="bh">%s</div>' % BAIHUA[key][i].replace('|','<br>'))
        h.append('</div>')
    h.append('</div>')
    return ''.join(h)

def page(title, sub, body, h):
    return '''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>%s · 设计稿，非玩法示意</title>
<!-- 设计稿，非玩法示意。本稿不改玩法数值；样例数值仅为版式占位。 -->
<style>%s
%s
body{width:1080px;height:%dpx;overflow:hidden}
</style></head><body><div class="canvas" style="height:%dpx">
<div class="sheet-head"><h1>%s<small>%s</small></h1><span class="draft">设计稿，非玩法示意</span></div>
%s
</div></body></html>''' % (title, BASE_CSS, glyph_css(), h, h, title, sub, body)
