// 由 tools/build_dist.mjs 从 data/input_map.json 生成：浏览器直接吃 JS 模块，不用 import 属性（Safari 老版本不支持）。
export default {
  "schema_version": "1",
  "_说明": "PC 网页版输入映射。动作名是引擎能理解的；渲染壳只负责把鼠标、键盘事件翻成这些动作。阈值类数字是占位，接壳后按手感调。",
  "card": {
    "drag": { "device": "mouse", "how": "按住卡片左右拖", "commit_threshold_ratio": 0.35, "below_threshold": "回弹，不提交", "left_action": { "type": "choose", "side": "left" }, "right_action": { "type": "choose", "side": "right" } },
    "keys": {
      "ArrowLeft":  { "type": "choose", "side": "left" },
      "ArrowRight": { "type": "choose", "side": "right" },
      "Digit1": { "type": "choose", "side": "drop", "slot": 0 },
      "Digit2": { "type": "choose", "side": "drop", "slot": 1 },
      "Digit3": { "type": "choose", "side": "drop", "slot": 2 }
    },
    "preview": { "hold": ["Space", "mouse_down_on_card"], "shows": "左右两排分量圆点：动哪几维、点越大动得越多；不显示涨跌；有迹的一边末尾多一个骨片标记" },
    "word_box_click": { "how": "点字匣里的字", "action": { "type": "choose", "side": "drop", "slot": "被点的格子" } }
  },
  "engrave": {
    "click": "点卡角的骨片",
    "key": "KeyK",
    "action": { "type": "engrave", "trace": "迹对应的字 id" },
    "skip": { "type": "skip_engrave" }
  },
  "winter": {
    "pick_tally": "点一张事签",
    "huiyi": "点两个部件（或拖上骨片），再按「刻」",
    "zhishi": "点底字，再点上/中/下一处，再按「刻」",
    "xiangxing": "依次点三个亮点，再按「刻」",
    "confirm": { "key": "Enter", "button": "刻" },
    "defer": { "button": "留到明年" },
    "end": { "button": "天亮了" },
    "actions": [
      { "type": "winter_carve", "tally": "事签 id", "answer": "见 src/types.ts 的 WinterAnswer" },
      { "type": "winter_defer", "tally": "事签 id" },
      { "type": "winter_end" }
    ]
  }
}
