package ohos_app_cangjie_entry

/* 文案表。字符串全部抄自 /workspace/zaozi-formal/v1/src/ 下的设计稿生成脚本
   （common.py / build_card.py / build_zilu.py）：
   common.py 的 BAIHUA、build_card.py 的事签/弹层、build_zilu.py 的字义/典籍/
   小故事/效果），一字未改。
   只有 休/水/本/从 四个字有白话行；字义、典籍、小故事、效果设计稿只给了「休」
   （zilu_detail_v1），其余字取空 → 界面上那一行/那一块整块不显示（SPEC §4.2）。
   玩法数值（代次、记忆、骨片数）按 SPEC 只是版式占位。
   本文件不 import 任何 kit/ohos 模块，能在普通 Linux 上编译（tools/box_check）。 */

import std.collection.ArrayList

/* —— 造字卡（card_zaozi_v1）—— */
public let CARD_GEN_LINE: String = "第 4 代 · 第 1 年冬夜"
public let CARD_BONE_PLAYING: String = "空骨片 2 · 字录 7 / 27"
public let CARD_BONE_SETTLED: String = "空骨片 2 · 字录 8 / 27"
public let CARD_TAG: String = "冬夜刻字 · 成字"
public let SHIQIAN_LABEL: String = "事签："
public let SHIQIAN_COUNT: String = "事签 1 / 1"
/* 设计稿用平衡换行，并把「一截老干」「遮着太阳」「天色转凉」设为不拆行；
    ArkUI 没有 text-wrap:balance，这里保留整句，由 Text 自行断行。 */
public let SHIQIAN_BODY: String =
    "晌午正热，赶路的背抵着一截老干，头顶叶子遮着太阳，一直待到天色转凉"
public let CARD_HINT: String = "古字形一步步变成今天的写法"
public let CARD_SKIP_HINT: String = "点一下跳过"
public let CARD_SHEET_KEY: String = "成字"
public let CARD_SHEET_TITLE: String = "「休」入字录"
public let CARD_SHEET_SUB: String = "人 ＋ 木 · 第 4 代第 1 年冬夜"
public let CARD_MEMORY_BAR: String = "63 → 69"
public let CARD_MEMORY_DELTA: String = "记 +6"
public let CARD_MEMORY_LABEL: String = "记忆"
public let CARD_SHEET_META: String = "骨片随字入录 · 空骨片仍是 2"
public let CARD_BTN_ZILU: String = "看字录"
public let CARD_BTN_CONTINUE: String = "继续"

/* —— 字录详情（zilu_detail_v1）—— */
public let ZILU_TITLE: String = "字录"
public let ZILU_NAV_COUNT: String = "8 / 27"
public let ZILU_BACK: String = "‹"
public let ZILU_TAB_ALL: String = "全部"
public let ZILU_TAB_XIANG: String = "象形"
public let ZILU_TAB_HUIYI: String = "会意"
public let ZILU_TAB_ZHISHI: String = "指事"
public let ZILU_REPLAY: String = "▶ 再看一次"
public let ZILU_SEC_MEANING: String = "白话字义"
public let ZILU_SEC_CLASSIC: String = "典籍"
public let ZILU_SEC_EVO: String = "古字形演变"
public let ZILU_SEC_EVO_HINT: String = "点一格可放大"
public let ZILU_SEC_STORY: String = "小故事"
public let ZILU_SEC_EFFECT: String = "效果"
public let ZILU_GRID_SUMMARY: String = "已造 8 · 手里有事签 1 · 有残片线索 1 · 未知 17"

public func baihuaLines(charId: String, cellIndex: Int64): Array<String> {
    /* 与设计稿 common.py 的 BAIHUA 一致：每阶段一行，竖线是手动断行，
       每行 ≤5 字；下标含最后那格繁简。 */
    if (charId == "xiu") {
        if (cellIndex == 0) { return ["一人背靠", "一棵树"] }
        if (cellIndex == 1) { return ["人形多了", "一道短笔"] }
        if (cellIndex == 2) { return ["笔画变成", "匀称弧线"] }
        if (cellIndex == 3) { return ["弧线拉成", "横竖"] }
        if (cellIndex == 4) { return ["和今天一样"] }
        return []
    }
    if (charId == "shui") {
        if (cellIndex == 0) { return ["中间曲线", "两旁水点"] }
        if (cellIndex == 1) { return ["中线弯曲", "加深"] }
        if (cellIndex == 2) { return ["两旁点", "拉成长线"] }
        if (cellIndex == 3) { return ["中线变直", "成撇捺"] }
        if (cellIndex == 4) { return ["和今天一样"] }
        return []
    }
    if (charId == "ben") {
        if (cellIndex == 0) { return ["树根加粗", "成一团"] }
        if (cellIndex == 1) { return ["根部变成", "一短横"] }
        if (cellIndex == 2) { return ["横画平直", "有波势"] }
        if (cellIndex == 3) { return ["和今天一样"] }
        return []
    }
    if (charId == "cong") {
        if (cellIndex == 0) { return ["两人", "一前一后"] }
        if (cellIndex == 1) { return ["两人笔画", "加粗"] }
        if (cellIndex == 2) { return ["两人站直", "并排"] }
        if (cellIndex == 3) { return ["添了走路", "的部件"] }
        if (cellIndex == 4) { return ["保留走路", "部件"] }
        if (cellIndex == 5) { return ["回到", "两个人"] }
        return []
    }
    return []
}

/* 会意写两个部件（SPEC §4.1）；设计稿只给了「休 = 人 + 木」。 */
public func formulaParts(charId: String): Array<String> {
    if (charId == "xiu") { return ["人", "木"] }
    return []
}

/* 象形写「描迹」，指事写「底字 木 · 一在其下」（SPEC §4.1，示例取「本」）。 */
public func formulaText(charId: String): String {
    if (charId == "shui") { return "描迹 · 水" }
    if (charId == "ben") { return "底字 木 · 一在其下" }
    return ""
}

public class EffectRow {
    public let label: String
    public let text: String

    public init(label: String, text: String) {
        this.label = label
        this.text = text
    }
}

/* 一个字录详情卡的文案。空字段 → 界面不显示那一行/那一块。 */
public class ZiluCopy {
    public let meaning: String
    public let classic: String
    public let classicSource: String
    public let story: String
    public let effects: ArrayList<EffectRow>

    public init(
        meaning: String,
        classic: String,
        classicSource: String,
        story: String,
        effects: ArrayList<EffectRow>
    ) {
        this.meaning = meaning
        this.classic = classic
        this.classicSource = classicSource
        this.story = story
        this.effects = effects
    }

    public func hasMeaning(): Bool {
        return this.meaning.size > 0
    }

    public func hasClassic(): Bool {
        return this.classic.size > 0
    }

    public func hasStory(): Bool {
        return this.story.size > 0
    }

    public func hasEffects(): Bool {
        return this.effects.size > 0
    }
}

public func ziluCopyOf(charId: String): ZiluCopy {
    if (charId == "xiu") {
        let effects = ArrayList<EffectRow>()
        effects.add(EffectRow("落字", "「歇一季」：跳过这张卡，粮 −6，另外三维各向 50 回 3"))
        effects.add(EffectRow("解锁", "东岸「休战」事件链进入牌堆"))
        effects.add(EffectRow("部件", "可作更复杂的字的部件，不消耗"))
        return ZiluCopy(
            "人靠着树歇息；引申为停下。",
            "休，息止也。从人依木。",
            "《说文解字》卷六",
            "东岸的孩子受了伤，走不动了。你留下他，给了他一口吃的。秋天，他父亲带着东岸的人来道谢。",
            effects
        )
    }
    let empty = ArrayList<EffectRow>()
    return ZiluCopy("", "", "", "", empty)
}
