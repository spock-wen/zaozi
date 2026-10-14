// 由 tools/build_dist.mjs 从 data/chars_slice.json 生成：浏览器直接吃 JS 模块，不用 import 属性（Safari 老版本不支持）。
export default {
  "schema_version": "1",
  "_说明": "切片 14 字（已定，CHAR_LIST_V1.md 第 6 节）。glyph_id 对应 glyph/glyph_pack_v1.csv 的 id 列。forbidden 是事签禁用词表（GAMEPLAY §2.5 第 3 条），只给一年里程碑会刻的 4 个目标字和它们的部件写全，其余待补。trace_points 的坐标是占位，接壳后按字形调。",
  "milestone_start_zilu": ["水", "日", "人", "木", "田", "火"],
  "milestone_word_box": ["水", "火", "日"],
  "chars": {
    "水": { "method": "xiangxing", "glyph_id": "shui", "forbidden": ["水", "河水"] },
    "日": { "method": "xiangxing", "glyph_id": "ri",   "forbidden": ["日", "太阳", "日头"] },
    "人": { "method": "xiangxing", "glyph_id": "ren",  "forbidden": ["人", "有人", "孩子"] },
    "木": { "method": "xiangxing", "glyph_id": "mu",   "forbidden": ["木", "树", "木头", "树枝"] },
    "田": { "method": "xiangxing", "glyph_id": "tian", "forbidden": ["田", "田地"] },
    "火": { "method": "xiangxing", "glyph_id": "huo",  "forbidden": ["火", "火焰"] },
    "力": { "method": "xiangxing", "glyph_id": "li",   "forbidden": ["力", "力气", "用力", "使劲"],
            "trace_points": [ { "id": "a", "x": 0.30, "y": 0.20 }, { "id": "b", "x": 0.62, "y": 0.35 }, { "id": "c", "x": 0.45, "y": 0.85 } ],
            "trace_order": ["a", "b", "c"] },
    "月": { "method": "xiangxing", "glyph_id": "yue",  "forbidden": ["月", "月亮", "月光"],
            "trace_points": [ { "id": "a", "x": 0.55, "y": 0.12 }, { "id": "b", "x": 0.30, "y": 0.50 }, { "id": "c", "x": 0.55, "y": 0.88 } ],
            "trace_order": ["a", "b", "c"] },
    "休": { "method": "huiyi", "glyph_id": "xiu",  "components": ["人", "木"], "forbidden": ["休", "歇", "休息", "停下"] },
    "林": { "method": "huiyi", "glyph_id": "lin",  "components": ["木", "木"], "forbidden": ["林", "树林", "林子"] },
    "从": { "method": "huiyi", "glyph_id": "cong", "components": ["人", "人"], "forbidden": ["从", "跟着", "跟从"] },
    "男": { "method": "huiyi", "glyph_id": "nan",  "components": ["田", "力"], "forbidden": ["男", "男人"] },
    "明": { "method": "huiyi", "glyph_id": "ming", "components": ["日", "月"], "forbidden": ["明", "明亮", "光亮"] },
    "本": { "method": "zhishi", "glyph_id": "ben",  "base": "木", "position": "bottom", "forbidden": ["本", "根", "树根", "根子"] }
  },
  "first_edition_chars": ["水","日","人","木","田","火","力","月","休","林","从","男","明","本","末","女","子","好","目","见","禾","米","鸟","衣","门","祭","雨"]
}
