import subprocess,os
from PIL import Image
os.chdir('/workspace/zaozi-formal/v5_cardart')
sizes={'m':(296,216),'d':(400,292)}
for k in ['elder','shaman','gatherer','river','north','strong']:
  for tag,(w,h) in sizes.items():
    open('/tmp/w.html','w').write(f'<html><body style="margin:0"><img src="file://{os.getcwd()}/src/{k}.svg" style="width:{w}px;height:{h}px;object-fit:cover;display:block"></body></html>')
    for sc in (1,2):
      out=f'assets/{k}_{tag}@{sc}x.png'
      subprocess.run(['google-chrome','--headless=new','--no-sandbox','--disable-gpu','--hide-scrollbars',f'--force-device-scale-factor={sc}',f'--window-size={w},{h}','--screenshot='+os.path.abspath(out),'file:///tmp/w.html'],stderr=subprocess.DEVNULL,stdout=subprocess.DEVNULL)
      im=Image.open(out).convert('RGB'); assert im.size==(w*sc,h*sc)
      im.save(out[:-4]+'.webp',quality=82,method=6)
      im.quantize(32,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE).save(out,optimize=True)
