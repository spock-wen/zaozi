package ohos_app_cangjie_entry

import std.collection.ArrayList

/* 字录（zilu_detail_v1）纯逻辑模型。规则来自 SPEC §4.2：
   格子四种状态 + 选中/新造；分页条 全部 8 · 象形 7 · 会意 1 · 指事 0；
   格子 60×60、圆角 12、间距 9、一行 5 格。
   已造的 8 个字与设计稿一致：水 日 人 木 田 火 禾（象形）+ 休（会意），
   休为选中且带「新」角标。
   下面另有一个 DEBUG ONLY 的开关 ZILU_DEBUG_SEED_ZHISHI（默认 false），
   打开后追加指事字「本」，只为验证指事徽标，出包必须保持 false。
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

/* ================== DEBUG ONLY（仅用于验证，出包前必须是 false）==================
   把这个开关置 true，已造列表会在基线 8 个字之外多追加一个指事字「本」，
   于是字录的「指事」分页不再是空的，选中本就能在详情卡看到「指事」徽标
   （ui_zilu_detail.cj 走 methodBadgeFg/methodBadgeBg(ziluMethod())）。
   唯一用途：给测试同事打一个验证用的 HAP，见 VERIFY_指事徽标.md。
   正式出包（尤其 release）必须是 false —— 否则字录计数、空分页文案、
   27 格总览都会和设计稿 zilu_detail_v1 不一致。
   tools/box_check 里有断言守着的：ZILU_DEBUG_SEED_ZHISHI == false。
   ============================================================================= */
public let ZILU_DEBUG_SEED_ZHISHI: Bool = false

/* 种子追加的那个字（本，造法 指事，glyph_data.cj 里已有）。 */
public let ZILU_DEBUG_SEED_CHAR_ID: String = "ben"

/* 已造 8 个（设计稿 zilu_detail_v1 D 屏）—— 不带任何种子，基线就是这 8 个。 */
public let ZILU_BASE_MADE_IDS: Array<String> = ["shui", "ri", "ren", "mu", "tian", "huo", "he", "xiu"]

/* 已造列表 = 基线 8 个（+ DEBUG 种子打开时追加的本）。
   开关默认 false，所以出包行为和以前一模一样。 */
public func ziluBuildMadeIds(seedZhishi: Bool): Array<String> {
    let out = ArrayList<String>()
    var i: Int64 = 0
    while (i < ZILU_BASE_MADE_IDS.size) {
        out.add(ZILU_BASE_MADE_IDS[i])
        i = i + 1
    }
    if (seedZhishi) {
        out.add(ZILU_DEBUG_SEED_CHAR_ID)
    }
    return out.toArray()
}

public let ZILU_MADE_IDS: Array<String> = ziluBuildMadeIds(ZILU_DEBUG_SEED_ZHISHI)

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

/* 一个字在不在这个 id 列表里（纯函数，种子开关两边的行为都能测）。 */
public func ziluIsMadeOf(madeIds: Array<String>, charId: String): Bool {
    return ziluIndexOfOf(madeIds, charId) >= 0
}

public func ziluIndexOfOf(madeIds: Array<String>, charId: String): Int64 {
    var i: Int64 = 0
    while (i < madeIds.size) {
        if (madeIds[i] == charId) {
            return i
        }
        i = i + 1
    }
    return -1
}

/* 一个字在不在已造列表里。 */
public func ziluIsMade(charId: String): Bool {
    return ziluIsMadeOf(ZILU_MADE_IDS, charId)
}

public func ziluIndexOf(charId: String): Int64 {
    return ziluIndexOfOf(ZILU_MADE_IDS, charId)
}

/* 分页条计数：(全部, 象形, 会意, 指事)。按已造字的 method 归类。 */
public func ziluCountsOf(madeIds: Array<String>): (Int64, Int64, Int64, Int64) {
    var xiang: Int64 = 0
    var huiyi: Int64 = 0
    var zhishi: Int64 = 0
    var i: Int64 = 0
    while (i < madeIds.size) {
        let rows = GlyphCatalog.ofChar(madeIds[i])
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
    return (madeIds.size, xiang, huiyi, zhishi)
}

public func ziluCounts(): (Int64, Int64, Int64, Int64) {
    return ziluCountsOf(ZILU_MADE_IDS)
}

/* 分页条 tab（0 全部 / 1 象形 / 2 会意 / 3 指事）→ 造法名；0 与未知返回空串。 */
public func ziluTabName(tab: Int64): String {
    if (tab == 1) {
        return "象形"
    }
    if (tab == 2) {
        return "会意"
    }
    if (tab == 3) {
        return "指事"
    }
    return ""
}

/* 空分页的提示：「暂无${造法名}字」（指事 0 → 暂无指事字）；
   tab 0 与未知 tab 没有造法名，退回 copy_text 的通用文案。 */
public func ziluTabEmptyText(tab: Int64): String {
    let name = ziluTabName(tab)
    if (name.size > 0) {
        return "暂无${name}字"
    }
    return ZILU_TAB_EMPTY
}

/* 一个字的造法 / 字形。字表里没有这个 id（切分页 / 换字那一瞬 selectedId
   可能还没跟上）时返回空串，不越界 —— 界面层一律走这两个函数取值。 */
public func ziluMethodOf(charId: String): String {
    let rows = GlyphCatalog.ofChar(charId)
    if (rows.size > 0) {
        return rows[0].method
    }
    return ""
}

public func ziluGlyphOf(charId: String): String {
    let rows = GlyphCatalog.ofChar(charId)
    if (rows.size > 0) {
        return rows[0].glyph
    }
    return ""
}

/* 某个分页里已造的字（按传入的 id 顺序）。tab 0 = 全部已造的字。
   字录的分页筛选、切 tab 时改选中、底部网格过滤都走这一个函数，保证三处一致。 */
public func ziluTabIdsOf(madeIds: Array<String>, tab: Int64): ArrayList<String> {
    let out = ArrayList<String>()
    let name = ziluTabName(tab)
    var i: Int64 = 0
    while (i < madeIds.size) {
        let charId = madeIds[i]
        if (tab == 0 || GlyphCatalog.ofChar(charId)[0].method == name) {
            out.add(charId)
        }
        i = i + 1
    }
    return out
}

public func ziluTabIds(tab: Int64): ArrayList<String> {
    return ziluTabIdsOf(ZILU_MADE_IDS, tab)
}

/* 某个分页第一个已造的字；没有（空分页）返回空串。 */
public func ziluTabFirstIdOf(madeIds: Array<String>, tab: Int64): String {
    let ids = ziluTabIdsOf(madeIds, tab)
    if (ids.size > 0) {
        return ids[0]
    }
    return ""
}

public func ziluTabFirstId(tab: Int64): String {
    return ziluTabFirstIdOf(ZILU_MADE_IDS, tab)
}

/* 一个字在不在这个 id 列表里。 */
public func ziluHasId(ids: ArrayList<String>, charId: String): Bool {
    var i: Int64 = 0
    while (i < ids.size) {
        if (ids[i] == charId) {
            return true
        }
        i = i + 1
    }
    return false
}

/* 某个字在不在这个分页里（tab 0 恒真）。 */
public func ziluTabHasChar(tab: Int64, charId: String): Bool {
    return ziluHasId(ziluTabIds(tab), charId)
}

/* 27 格总览：基线是 8 已造 + 1 有事签 + 1 有残片线索 + 17 未知；
   DEBUG 种子打开时 9 已造 + 同样两格 + 16 未知，总数仍是 ZILU_TOTAL。 */
public func ziluGridOf(madeIds: Array<String>): ArrayList<ZiluGridCell> {
    let out = ArrayList<ZiluGridCell>()
    var i: Int64 = 0
    while (i < madeIds.size) {
        let charId = madeIds[i]
        let rows = GlyphCatalog.ofChar(charId)
        let sel = (charId == ZILU_SELECTED_ID)
        out.add(ZiluGridCell(charId, rows[0].glyph, ZiluCellState.Made, "", sel, sel))
        i = i + 1
    }
    out.add(ZiluGridCell("", "", ZiluCellState.HasSign, "有事签", false, false))
    out.add(ZiluGridCell("", "", ZiluCellState.HasFragment, "木 + ？", false, false))
    var u: Int64 = 0
    while (u < ziluUnknownCountOf(madeIds)) {
        out.add(ZiluGridCell("", "", ZiluCellState.Unknown, "", false, false))
        u = u + 1
    }
    return out
}

public func ziluGrid(): ArrayList<ZiluGridCell> {
    return ziluGridOf(ZILU_MADE_IDS)
}

public func ziluUnknownCountOf(madeIds: Array<String>): Int64 {
    let made = madeIds.size
    return ZILU_TOTAL - made - 2
}

public func ziluUnknownCount(): Int64 {
    return ziluUnknownCountOf(ZILU_MADE_IDS)
}
