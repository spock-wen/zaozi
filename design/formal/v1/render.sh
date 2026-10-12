#!/bin/bash
# 用法: ./render.sh name height   （CSS 宽 1080，device scale 2 → 2160 宽）
cd /workspace/zaozi-formal/v1
google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
  --window-size=1080,$2 --virtual-time-budget=3000 --screenshot=$PWD/$1.png file://$PWD/$1.html 2>/dev/null
python3 -c "from PIL import Image;im=Image.open('$1.png');print('$1',im.size)"
