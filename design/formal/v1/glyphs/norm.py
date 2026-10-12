#!/usr/bin/env python3
"""显示版：只改 SVG 根标签 viewBox/width/height，路径不动；PNG 只裁白边+透明边，最长边占 86%，等比缩到 400。"""
import io,re,glob,os,cairosvg
from PIL import Image
FILL=0.86;S=4
def attr(tag,n):
    m=re.search(r'\b%s\s*=\s*"([^"]*)"'%n,tag);return m.group(1) if m else None
def seta(tag,n,v):
    p=re.compile(r'\b%s\s*=\s*"[^"]*"'%n)
    return p.sub('%s="%s"'%(n,v),tag,count=1) if p.search(tag) else tag[:-1]+' %s="%s">'%(n,v)
for f in sorted(glob.glob('*.svg')):
    t=open(f,encoding='utf-8').read()
    m=re.search(r'(?s)<svg\b.*?>',t);tag=m.group(0)
    vb=attr(tag,'viewBox')
    if vb: vx,vy,vw,vh=map(float,vb.replace(',',' ').split())
    else:
        vx=vy=0;vw=float(re.sub('[a-z]','',attr(tag,'width')));vh=float(re.sub('[a-z]','',attr(tag,'height')))
    mt=seta(seta(seta(tag,'viewBox','%g %g %g %g'%(vx,vy,vw,vh)),'width','%g'%(vw*S)),'height','%g'%(vh*S))
    img=Image.open(io.BytesIO(cairosvg.svg2png(bytestring=(t[:m.start()]+mt+t[m.end():]).encode()))).convert('RGBA')
    l,tp,r,b=img.getchannel('A').point(lambda a:255 if a>10 else 0).getbbox()
    x0,y0,x1,y1=vx+l/S,vy+tp/S,vx+r/S,vy+b/S
    side=max(x1-x0,y1-y0)/FILL;cx,cy=(x0+x1)/2,(y0+y1)/2
    nt=seta(seta(seta(tag,'viewBox','%.3f %.3f %.3f %.3f'%(cx-side/2,cy-side/2,side,side)),'width','400'),'height','400')
    if 'preserveAspectRatio' not in nt: nt=seta(nt,'preserveAspectRatio','xMidYMid meet')
    open('norm/'+f,'w',encoding='utf-8').write(t[:m.start()]+nt+t[m.end():])
    print('svg',f,'bbox',round(x1-x0,1),round(y1-y0,1))
for f in sorted(glob.glob('*_lishu_raw.png')):
    im=Image.open(f).convert('RGBA');bb=im.getchannel('A').point(lambda a:255 if a>10 else 0).getbbox()
    c=im.crop(bb);w,h=c.size;side=int(round(max(w,h)/FILL))
    can=Image.new('RGBA',(side,side),(0,0,0,0));can.paste(c,((side-w)//2,(side-h)//2))
    out='norm/'+f.replace('_raw','');can.resize((400,400),Image.LANCZOS).save(out);print('png',f,im.size,bb,'->',out)
