#!/bin/bash
# ./r.sh name height  (CSS 1520 × scale 2 → 3040 宽)
cd /workspace/zaozi-formal/v4_gamefeel
google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --window-size=1520,$2 --virtual-time-budget=3000 --screenshot=$PWD/$1.png file://$PWD/$1.html 2>/dev/null
python3 -c "from PIL import Image;im=Image.open('$1.png');print('$1',im.size);im.resize((im.width//3,im.height//3)).save('/workspace/tmp_view/$1_s.png')"
