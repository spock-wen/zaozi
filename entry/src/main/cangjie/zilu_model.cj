package ohos_app_cangjie_entry

import std.collection.ArrayList

/* 字录（zilu_detail_v1）纯逻辑模型。规则来自 SPEC §4.2：
   格子四种状态 + 选中/新造；分页条 全部 8 · 象形 7 · 会意 1 · 指事 0；
   格子 60×60、圆角 12、间距 9、一行 5 格。
   已造的 8 个字与设计稿一致：水 日 人 木 田 火 禾（象形）+ 休（会意），
   休为选中且带「新」角标。
   本文件不 import 任何 kit/ohos 模块，能在普通 Linux 上编译（tools/box_check）。 */

public enum ZiluCellState {
    | Made
    | HasSign
    | HasFragment
    | Unknown
}

public class ZiluGridCell {
    public let charId: String
    /* 今天的字；未造出来的格子是空串（只显示问号/线索）。 */
    public let glyph: String
    public let state: ZiluCellState
    /* 「有事签」/「木 + ？」这类格内小字。 */
    public let hint: String
    public let isSelected: Bool
    public let isNew: Bool

    public init(
        charId: String,
        glyph: String,
        state: ZiluCellState,
        hint: String,
        isSelected: Bool,
        isNew: Bool
    ) {
        this.charId = charId
        this.glyph = glyph
        this.state = state
        this.hint = hint
        this.isSelected = isSelected
        this.isNew = isNew
    }

    /* Cangjie 的 enum 没有默认 == 运算符，统一走这几个谓词。 */
    public func isMade(): Bool {
        return this.stateIs(ZiluCellState.Made)
    }

    public func stateIs(s: ZiluCellState): Bool {
        match (this.state) {
            case ZiluCellState.Made => match (s) { case ZiluCellState.Made => true; case _ => false }
            case ZiluCellState.HasSign => match (s) { case ZiluCellState.HasSign => true; case _ => false }
            case ZiluCellState.HasFragment => match (s) { case ZiluCellState.HasFragment => true; case _ => false }
            case ZiluCellState.Unknown => match (s) { case ZiluCellState.Unknown => true; case _ => false }
        }
    }
}

/* 首版必收 27 字（GLYPH_PACK_V1）。 */
public let ZILU_TOTAL: Int64 = 27

/* 已造 8 个（设计稿 zilu_detail_v1 D 屏）。 */
public let ZILU_MADE_IDS: Array<String> = ["shui", "ri", "ren", "mu", "tian", "huo", "he", "xiu"]

/* 默认选中「休」，并带「新」角标（第一次点开后消失，本版不做持久化）。 */
public let ZILU_SELECTED_ID: String = "xiu"

public func ziluMadeIds(): ArrayList<String> {
    let out = ArrayList<String>()
    var i: Int64 = 0
    while (i < ZILU_MADE_IDS.size) {
        out.add(ZILU_MADE_IDS[i])
        i = i + 1
    }
    return out
}

public func ziluMadeCount(): Int64 {
    return ZILU_MADE_IDS.size
}

/* 一个字在不在已造列表里。 */
public func ziluIsMade(charId: String): Bool {
    var i: Int64 = 0
    while (i < ZILU_MADE_IDS.size) {
        if (ZILU_MADE_IDS[i] == charId) {
            return true
        }
        i = i + 1
    }
    return false
}

public func ziluIndexOf(charId: String): Int64 {
    var i: Int64 = 0
    while (i < ZILU_MADE_IDS.size) {
        if (ZILU_MADE_IDS[i] == charId) {
            return i
        }
        i = i + 1
    }
    return -1
}

/* 分页条计数：(全部, 象形, 会意, 指事)。按已造字的 method 归类。 */
public func ziluCounts(): (Int64, Int64, Int64, Int64) {
    var xiang: Int64 = 0
    var huiyi: Int64 = 0
    var zhishi: Int64 = 0
    var i: Int64 = 0
    while (i < ZILU_MADE_IDS.size) {
        let rows = GlyphCatalog.ofChar(ZILU_MADE_IDS[i])
        let method = rows[0].method
        if (method == "象形") {
            xiang = xiang + 1
        } else if (method == "会意") {
            huiyi = huiyi + 1
        } else if (method == "指事") {
            zhishi = zhishi + 1
        }
        i = i + 1
    }
    return (ZILU_MADE_IDS.size, xiang, huiyi, zhishi)
}

/* 27 格总览：8 已造 + 1 有事签 + 1 有残片线索 + 17 未知。 */
public func ziluGrid(): ArrayList<ZiluGridCell> {
    let out = ArrayList<ZiluGridCell>()
    var i: Int64 = 0
    while (i < ZILU_MADE_IDS.size) {
        let charId = ZILU_MADE_IDS[i]
        let rows = GlyphCatalog.ofChar(charId)
        let sel = (charId == ZILU_SELECTED_ID)
        out.add(ZiluGridCell(charId, rows[0].glyph, ZiluCellState.Made, "", sel, sel))
        i = i + 1
    }
    out.add(ZiluGridCell("", "", ZiluCellState.HasSign, "有事签", false, false))
    out.add(ZiluGridCell("", "", ZiluCellState.HasFragment, "木 + ？", false, false))
    var u: Int64 = 0
    while (u < ziluUnknownCount()) {
        out.add(ZiluGridCell("", "", ZiluCellState.Unknown, "", false, false))
        u = u + 1
    }
    return out
}

public func ziluUnknownCount(): Int64 {
    let made = ZILU_MADE_IDS.size
    return ZILU_TOTAL - made - 2
}
