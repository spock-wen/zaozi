import subprocess,os
from PIL import Image
os.chdir('/workspace/zaozi-formal/v5_cardart')
CH=['google-chrome','--headless=new','--no-sandbox','--disable-gpu','--hide-scrollbars','--force-device-scale-factor=2']
s0=open('../v3_mobile/mobile_layout_v2_1.html').read()
MS='<div class="ill" style="background:#F1E8D4 url(../v5_cardart/assets/gatherer_m@2x.png) center/contain no-repeat;border:0"></div>'
assert s0.count(MS)==1
s0=s0.replace(MS,'<div class="ill" style="background:url(../assets/gatherer_m@2x.webp) center/cover;border:0;color:transparent"></div>').replace('手机竖屏重排 v2.1','卡面图预览 · 手机（v2_1 布局）')
open('preview/preview_mobile.html','w').write(s0)
V=[('gatherer','春 · 采集的妇人','北坡塌下去一块','一夜大雨，北坡塌下去一块。<span class="nw">坍处底下</span>露出了怪东西，没人敢过去看。','坡上的土被雨冲开，露出一团盘结的须。','绕开北坡，别招惹','下去看个究竟'),
   ('river','夏 · 东岸的使者','东岸的猎手过了河','东岸的猎手趁水浅过了河，在我们的猎场上下了套。','可落字：水（以河为界）','把他们赶回去','猎场让出一半'),
   ('shaman','冬 · 巫','冬祭到了','冬祭到了。巫要一片骨片去占来年的收成。','选右可出迹：月','给他一片','骨片要留着记事'),
   ('strong','秋 · 族里最壮的汉子','一车粟陷进了泥里','满满一车粟陷进了泥里，几个后生推不动。','选左可出迹：力','让他一个人来撬','卸下一半再推')]
crops=[]
for k,who,t,b,h,l,r in V:
    s=s0.replace('gatherer_m',f'{k}_m')
    s=s.replace('<div class="h">春 · 采集的妇人</div><div class="t">北坡塌下去一块</div>\n <div class="b">一夜大雨，北坡塌下去一块。<span class="nw">坍处底下</span>露出了怪东西，没人敢过去看。</div>',f'<div class="h">{who}</div><div class="t">{t}</div>\n <div class="b">{b}</div>',1)
    s=s.replace('坡上的土被雨冲开，露出一团盘结的须。',h,1).replace('<span>← 绕开北坡，别招惹</span><span>下去看个究竟 →</span>',f'<span>← {l}</span><span>{r} →</span>',1)
    open('preview/_m.html','w').write(s)
    subprocess.run(CH+['--window-size=1080,900','--screenshot=/tmp/_m.png','file://'+os.path.abspath('preview/_m.html')],stderr=subprocess.DEVNULL)
    crops.append(Image.open('/tmp/_m.png').crop((50,330,730,1660)))
os.remove('preview/_m.html')
from PIL import ImageDraw,ImageFont
out=Image.new('RGB',(len(crops)*700+40,1330+40+64),'#F3ECDD')
for i,c in enumerate(crops): out.paste(c,(20+i*700,20))
dr=ImageDraw.Draw(out)
for k in range(3): dr.rectangle((28,1330+40+22+k*9,52,1330+40+25+k*9),fill='#5C5346')  # ☰ 图标（CJK 字体无此字形，手绘三横）
dr.text((64,1330+40+12),'外圈虚线：点击区标注，非样式 · 设计稿，非玩法示意',fill='#5C5346',font=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',30))
out.save('preview/preview_mobile_4cards.png',optimize=True); print(out.size)
# 电脑：图位按 400×292 比例，不裁切（高 = 卡内宽 × 292/400）
d=open('../v3_mobile/desktop_layout_v1.html').read().replace('电脑宽屏 v1（配 mobile_layout_v2_1）','卡面图预览 · 电脑（desktop v1 布局，图位 400×292 比例）')
i=d.index('1280 × 800'); a,b=d[:i],d[i:]
DS='<div class="ill" style="height:%dpx;background:#F1E8D4 url(../v5_cardart/assets/gatherer_d@2x.png) center/contain no-repeat;border:0"></div>'
assert a.count(DS%356)==1 and b.count(DS%256)==1
a=a.replace(DS%356,'<div class="ill" style="height:%dpx;background:url(../assets/gatherer_d@2x.webp) center/contain no-repeat;border:0"></div>'%round(388*292/400),1)
b=b.replace(DS%256,'<div class="ill" style="height:%dpx;background:url(../assets/strong_d@2x.webp) center/contain no-repeat;border:0"></div>'%round(316*292/400),1)
b=b.replace('春 · 采集的妇人','秋 · 族里最壮的汉子',1).replace('北坡塌下去一块','一车粟陷进了泥里',1).replace('一夜大雨，北坡塌下去一块。<span class="nw">坍处底下</span>露出了怪东西，没人敢过去看。','满满一车粟陷进了泥里，几个后生推不动。',1).replace('坡上的土被雨冲开，露出一团盘结的须。','选左可出迹：力',1).replace('绕开北坡，别招惹','让他一个人来撬',1).replace('下去看个究竟','卸下一半再推',1)
assert 'gatherer_d' in a and 'strong_d' in b
open('preview/preview_desktop.html','w').write(a+b)
subprocess.run(CH+['--window-size=1520,2340','--screenshot='+os.path.abspath('preview/preview_desktop.png'),'file://'+os.path.abspath('preview/preview_desktop.html')],stderr=subprocess.DEVNULL)
im=Image.open('preview/preview_desktop.png');print(im.size);im.resize((im.width//3,im.height//3)).save('/workspace/tmp_view/pd.png')
