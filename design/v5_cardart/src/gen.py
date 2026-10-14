# 卡面图 SVG 生成：4 色（骨底 / 骨暗 / 墨 / 刻痕红），版画剪影
import os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
BG='#F1E8D4'; MID='#CDBB94'; INK='#2A241D'; RED='#6E2F1F'
W,H=296,216
def wrap(body,sky=BG):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
<defs><pattern id="hz" width="6" height="4" patternUnits="userSpaceOnUse"><path d="M0 2H6" stroke="{MID}" stroke-width="1"/></pattern></defs>
<rect width="{W}" height="{H}" fill="{sky}"/>{body}
</svg>'''
def person(x,y,s=1,staff=False,basket=False,back=True,arms=None,fill=INK):
    p=f'<g transform="translate({x},{y}) scale({s})" fill="{fill}">'
    p+='<ellipse cx="0" cy="-58" rx="7" ry="8"/>'
    p+='<path d="M-9 -50 Q-13 -30 -12 -8 L-6 0 L-2 0 L0 -18 L2 0 L6 0 L12 -8 Q13 -30 9 -50 Z"/>'
    if staff: p+=f'<rect x="12" y="-78" width="2.5" height="78" rx="1"/>'
    if basket: p+=f'<path d="M-14 -46 h28 l-4 22 h-20 Z" fill="{RED}"/><path d="M-14 -46 h28" stroke="{fill}" stroke-width="2"/>'
    if arms=='up': p+='<path d="M-8 -48 L-20 -74 L-16 -76 L-4 -50 Z M8 -48 L20 -74 L16 -76 L4 -50Z"/>'
    return p+'</g>'
def hills(pts,fill): return f'<path d="M0 {H} L{pts} L{W} {H} Z" fill="{fill}"/>'
art={}
art['elder']=wrap(hills('0 150 60 140 140 146 220 136 296 144',MID)+
 '<rect x="0" y="150" width="296" height="66" fill="url(#hz)"/>'+
 f'<path d="M206 136 L232 108 L258 136 Z" fill="{INK}"/><rect x="212" y="136" width="40" height="18" fill="{INK}"/><rect x="226" y="142" width="10" height="12" fill="{BG}"/>'+
 f'<circle cx="70" cy="58" r="16" fill="{RED}" opacity=".85"/>'+person(120,196,1.25,staff=True))
art['shaman']=wrap(f'<rect x="0" y="160" width="296" height="56" fill="{MID}"/>'+
 f'<path d="M222 26 a16 16 0 1 1 -8 30 a12 12 0 1 0 8 -30Z" fill="{INK}"/>'+
 f'<path d="M168 170 Q160 140 172 118 Q176 138 186 126 Q190 150 200 136 Q206 158 196 170 Z" fill="{RED}"/>'+
 f'<path d="M156 172 h56 l-6 8 h-44 Z" fill="{INK}"/>'+
 person(100,190,1.3,arms='up')+f'<path d="M80 92 l10 -6 l8 4 l-4 10 l-10 2 Z" fill="{BG}" stroke="{INK}" stroke-width="1.5"/>')
art['gatherer']=wrap(f'<path d="M0 216 L0 90 Q60 70 120 96 L150 130 L176 128 L210 160 L296 150 L296 216 Z" fill="{MID}"/>'+
 f'<path d="M120 96 L150 130 L176 128 L196 150 Q170 150 140 138 Z" fill="{INK}" opacity=".85"/>'+
 ''.join(f'<path d="M{150+i*8} 136 q{-4+i*3} 14 {2+i} 30" stroke="{RED}" stroke-width="2" fill="none"/>' for i in range(5))+
 f'<rect x="0" y="176" width="296" height="40" fill="url(#hz)"/>'+person(236,196,1.15,basket=True))
art['river']=wrap(f'<rect x="0" y="96" width="296" height="74" fill="{MID}"/>'+
 ''.join(f'<path d="M{10+i*40} {112+(i%3)*14} q10 -4 20 0 t20 0" stroke="{BG}" stroke-width="2" fill="none"/>' for i in range(7))+
 f'<path d="M0 96 L296 96 L296 88 Q200 80 120 90 L0 86 Z" fill="{INK}" opacity=".7"/>'+
 person(200,90,.45)+person(222,90,.45)+person(244,90,.45)+
 f'<path d="M0 216 L0 160 Q90 150 180 164 L296 158 L296 216 Z" fill="{INK}"/>'+
 f'<path d="M0 160 Q90 150 180 164 L296 158" stroke="{RED}" stroke-width="3" fill="none"/>'+person(70,158,.9,staff=True,fill=INK))
art['north']=wrap(hills('0 120 50 70 96 110 150 50 210 104 250 76 296 112',MID)+
 f'<rect x="0" y="170" width="296" height="46" fill="url(#hz)"/>'+
 f'<circle cx="236" cy="40" r="14" fill="{RED}" opacity=".85"/>'+
 person(96,192,1.15,staff=True)+f'<path d="M84 140 h-18 v16 h18Z" fill="{RED}"/>'+
 f'<g fill="{INK}"><path d="M150 168 q2 -26 30 -26 h40 q14 0 16 12 l12 -4 l-2 10 l-10 2 v24 h-6 v-18 h-44 v18 h-6 v-20 q-8 0 -10 4 Z"/><path d="M246 144 l8 -8 M240 142 l2 -10" stroke="{INK}" stroke-width="2"/></g>')
art['strong']=wrap(f'<rect x="0" y="168" width="296" height="48" fill="{MID}"/><path d="M0 168 Q148 156 296 168" fill="none" stroke="{INK}" stroke-width="2"/>'+
 f'<g fill="{INK}"><rect x="130" y="110" width="120" height="34" rx="2"/><circle cx="160" cy="166" r="22" fill="none" stroke="{INK}" stroke-width="7"/><circle cx="160" cy="166" r="4"/></g>'+
 ''.join(f'<circle cx="{140+i*12}" cy="{104-(i%2)*4}" r="7" fill="{RED}"/>' for i in range(9))+
 f'<rect x="150" y="184" width="40" height="32" fill="{MID}"/>'+
 f'<path d="M150 186 L80 120" stroke="{INK}" stroke-width="5" stroke-linecap="round"/>'+
 f'<g fill="{INK}" transform="translate(72,190) scale(1.2)"><ellipse cx="-6" cy="-52" rx="7" ry="8"/><path d="M-12 -44 Q4 -46 10 -58 L16 -56 Q10 -36 -2 -30 L4 0 L-4 0 L-10 -24 L-18 0 L-26 0 L-16 -30 Z"/></g>')
for k,v in art.items(): open(f'{k}.svg','w').write(v)
print(list(art))
