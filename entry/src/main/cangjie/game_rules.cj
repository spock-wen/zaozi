package ohos_app_cangjie_entry

import std.collection.ArrayList

/* M2「一代闭环」主界选卡的纯规则（SPEC §2.1 四维条 / §2.3 事件卡与落字第三选项 /
   §2.4 字匣 / §2.7 结局卡；设计稿 home_slide_v1）。
   本文件不 import 任何 kit/ohos 模块，能在普通 Linux 上编译（tools/box_check）。
   牌堆数据与「按住看分量」的圆点档位在 event_cards.cj，存档状态在
   run_state.cj，平台胶水在 run_store.cj，界面在 ui_hud.cj / ui_bones.cj /
   ui_event_card.cj / ui_box.cj / ui_home.cj。

   这一片只加「玩法规则」，不改 RunState 的字段与存档格式（SAVE_VERSION 还是 1，
   RUN_FIELD_COUNT 还是 17）：applyChoice / applyLuozi 只写 run_state.cj 里已有的字段。

   约定：
     side 0 = 左选项，1 = 右选项，2 = 落字（第三选项，卡片 allowsLuozi 才有）
     deltas 顺序 = 粮 信 记 外（与 RunState.dims 一致），负数就是减
     endingKind = "见底" / "溢出" / "善终" */

/* —— 数值 —— */
/* 看几张卡过一年（3 张 = 1 年）。 */
public let RUN_CARDS_PER_YEAR: Int64 = 3
/* 危险区阈值：≤15 或 ≥85（SPEC §2.1 两端 15%）。 */
public let RUN_DANGER_LOW: Int64 = 15
public let RUN_DANGER_HIGH: Int64 = 85

/* 骨片 pip 的三种样子（SPEC §2.2）。 */
public let BONE_PIP_EMPTY: Int64 = 0
public let BONE_PIP_SHIQIAN: Int64 = 1
public let BONE_PIP_CAP: Int64 = 2

/* 骨片行 5 位怎么排：空骨片在前、事签骨片随后，剩下的都是上限空位。
   裂（BONE_PIP_CRACK）只在冬夜刻错时出现 600ms，属于 slice 3 之后的界面态，
   不进存档、这里也不出。 */
public func bonePipKinds(boneEmpty: Int64, boneShiqian: Int64): Array<Int64> {
    let out = ArrayList<Int64>()
    var empty = if (boneEmpty < 0) { 0 } else { boneEmpty }
    var sq = if (boneShiqian < 0) { 0 } else { boneShiqian }
    while (out.size < RUN_BONE_CAP && empty > 0) {
        out.add(BONE_PIP_EMPTY)
        empty = empty - 1
    }
    while (out.size < RUN_BONE_CAP && sq > 0) {
        out.add(BONE_PIP_SHIQIAN)
        sq = sq - 1
    }
    while (out.size < RUN_BONE_CAP) {
        out.add(BONE_PIP_CAP)
    }
    return out.toArray()
}

/* dimEnds / endingOf 的返回：这一维怎么了。 */
public let RUN_END_NONE: Int64 = -1
public let RUN_END_BOTTOM: Int64 = 0
public let RUN_END_TOP: Int64 = 1

/* endingKind 文案（原因胶囊用）。 */
public let RUN_KIND_BOTTOM: String = "见底"
public let RUN_KIND_TOP: String = "溢出"
public let RUN_KIND_GOOD: String = "善终"

/* 这一维在不在危险区（≤15 或 ≥85）。 */
public func dimInDanger(v: Int64): Bool {
    return v <= RUN_DANGER_LOW || v >= RUN_DANGER_HIGH
}

/* 这一维有没有触底 / 溢出：RUN_END_NONE 正常，RUN_END_BOTTOM 见底，
   RUN_END_TOP 溢出。 */
public func dimEnds(v: Int64): Int64 {
    if (v <= 0) { return RUN_END_BOTTOM }
    if (v >= RUN_DIM_MAX) { return RUN_END_TOP }
    return RUN_END_NONE
}

/* 钳到 0..100（界面与规则都不判空）。 */
public func runClampDim(v: Int64): Int64 {
    if (v < 0) { return 0 }
    if (v > RUN_DIM_MAX) { return RUN_DIM_MAX }
    return v
}

/* —— 结局表（SPEC §2.7：八败 + 善终）—— */

/* 一条结局。dim 是原因维（善终 -1）；good = 善终。 */
public class EndingInfo {
    public let id: String
    public let title: String
    public let kind: String
    public let dim: Int64
    public let good: Bool

    public init(id: String, title: String, kind: String, dim: Int64, good: Bool) {
        this.id = id
        this.title = title
        this.kind = kind
        this.dim = dim
        this.good = good
    }
}

/* 结局表：粮 信 记 外 各自的见底 / 溢出。 */
public func endingOf(dim: Int64, end: Int64): EndingInfo {
    if (dim == 0) {
        if (end == RUN_END_TOP) { return EndingInfo("cangman", "仓满招寇", RUN_KIND_TOP, dim, false) }
        return EndingInfo("jinian", "饥年", RUN_KIND_BOTTOM, dim, false)
    }
    if (dim == 1) {
        if (end == RUN_END_TOP) { return EndingInfo("fenggu", "封骨", RUN_KIND_TOP, dim, false) }
        return EndingInfo("shisi", "失祀", RUN_KIND_BOTTOM, dim, false)
    }
    if (dim == 2) {
        if (end == RUN_END_TOP) { return EndingInfo("suyuan", "宿怨", RUN_KIND_TOP, dim, false) }
        return EndingInfo("jiushui", "旧水重来", RUN_KIND_BOTTOM, dim, false)
    }
    /* 外（dim 3）；不认识的维按兵祸收，绝不返回空。 */
    if (end == RUN_END_TOP) { return EndingInfo("bingzu", "并族", RUN_KIND_TOP, dim, false) }
    return EndingInfo("binghuo", "兵祸", RUN_KIND_BOTTOM, dim, false)
}

/* 余年走完的善终结局。 */
public func endingGood(): EndingInfo {
    return EndingInfo("shouzhong", "寿终传笔", RUN_KIND_GOOD, -1, true)
}

/* 这一局的结局信息（没有结局 → None）。 */
public func endingOfState(s: RunState): Option<EndingInfo> {
    if (s.phase != RUN_PHASE_ENDING) { return Option<EndingInfo>.None }
    if (s.endingId == "shouzhong") { return Some(endingGood()) }
    if (s.endingDim < 0) { return Option<EndingInfo>.None }
    let end = if (s.endingKind == RUN_KIND_TOP) { RUN_END_TOP } else { RUN_END_BOTTOM }
    return Some(endingOf(s.endingDim, end))
}

/* —— 选一张卡 —— */

/* 把四维增减叠上去，逐维钳到 0..100。 */
public func runApplyDeltas(dims: Array<Int64>, deltas: Array<Int64>): Array<Int64> {
    let out = ArrayList<Int64>()
    var i: Int64 = 0
    while (i < dims.size) {
        let d = if (i < deltas.size) { deltas[i] } else { 0 }
        out.add(runClampDim(dims[i] + d))
        i = i + 1
    }
    return out.toArray()
}

/* 记结局：phase 进 2，写 endingId / endingDim / endingKind。 */
func runSetEnding(s: RunState, info: EndingInfo): Unit {
    s.phase = RUN_PHASE_ENDING
    s.endingId = info.id
    s.endingDim = info.dim
    s.endingKind = info.kind
}

/* 有没有哪一维触底 / 溢出：有就记结局并返回 true。 */
func runDetectEnding(s: RunState): Bool {
    var i: Int64 = 0
    while (i < s.dims.size) {
        let end = dimEnds(s.dims[i])
        if (end != RUN_END_NONE) {
            runSetEnding(s, endingOf(i, end))
            return true
        }
        i = i + 1
    }
    return false
}

/* 选一个选项，返回新状态（原状态不改，界面层换引用触发重绘）。
   side = 0 左 / 1 右 / 2 落字；落字那张没有（allowsLuozi = false）时
   这一下不算选过：原样返回，牌堆 / 年数都不动。 */
public func applyChoice(prev: RunState, side: Int64): RunState {
    let card = eventCardAt(prev.cardIndex)
    match (card.optionOf(side)) {
        case Some(opt) =>
            let s = cloneRunState(prev)
            s.dims = runApplyDeltas(prev.dims, opt.deltas)
            s.cardsSeen = prev.cardsSeen + 1
            s.cardIndex = eventCardNext(prev.cardIndex)
            /* 3 张卡 = 1 年。 */
            if (s.cardsSeen % RUN_CARDS_PER_YEAR == 0) {
                s.year = prev.year + 1
                s.yearsLeft = prev.yearsLeft - 1
            }
            /* 结局：先看四维（见底 / 溢出），余年走完算善终。 */
            if (!runDetectEnding(s)) {
                if (s.yearsLeft <= 0) {
                    runSetEnding(s, endingGood())
                }
            }
            return s
        case None => return prev
    }
}

/* ————— 字匣（SPEC §2.4：五种格子状态 / §2.3 落字第三选项）—————

   字匣一共 3 格。格子里可能有字（开局挑的，可能不足 3 个 → 空格）、
   上一代传下的事签（占一格，不能落）、或者本代已经落过的字。
   选中（选中态）不进存档：它是界面状态（selectedSlot，-1 = 没有选中），
   读档回来一律回到「没有选中」，玩家重新点。 */

/* 字匣一格的状态码（界面照着摆，ui_box.cj）。 */
public let BOX_SLOT_OK: Int64 = 0       /* 可落 */
public let BOX_SLOT_SELECTED: Int64 = 1 /* 选中 */
public let BOX_SLOT_LANDED: Int64 = 2   /* 本代已落 */
public let BOX_SLOT_SHIQIAN: Int64 = 3  /* 传下的事签 */
public let BOX_SLOT_EMPTY: Int64 = 4    /* 空（只在本代带的字不足 3 个时出现） */

/* 「没有选中格」：界面层（EntryView / HomeScreen）的 selectedSlot 初值。 */
public let BOX_SLOT_NONE: Int64 = -1

/* 事签在字匣里占格时写的 id。这一片只把规则定死：现在还没有任何代码往
   字匣里写这个 id（startGeneration 清空字匣，事签骨片记在 boneShiqian 里，
   「传下的事签占一格」是代末结算 slice 的事），界面照这个 id 画骨片格。 */
public let BOX_SHIQIAN_ID: String = "shiqian"

/* 这一格是不是事签占位。 */
public func boxSlotIsShiqianId(charId: String): Bool {
    return charId == BOX_SHIQIAN_ID
}

/* 字匣第 i 格的状态（0..4，见 BOX_SLOT_*）。
   chars / landed 是原始数组（函数调用当 @Prop 传进来不参与重绘跟踪，界面层
   直接把 RunState 的这两个字段递给子组件）；selectedSlot 是界面选中态。 */
public func boxSlotStateOf(chars: Array<String>, landed: Array<Bool>, selectedSlot: Int64, i: Int64): Int64 {
    if (i < 0 || i >= RUN_PICK_CAP) { return BOX_SLOT_EMPTY }
    if (i >= chars.size) { return BOX_SLOT_EMPTY }
    if (boxSlotIsShiqianId(chars[i])) { return BOX_SLOT_SHIQIAN }
    if (i < landed.size && landed[i]) { return BOX_SLOT_LANDED }
    if (i == selectedSlot) { return BOX_SLOT_SELECTED }
    return BOX_SLOT_OK
}

/* 同一个状态，从 RunState 上读（纯逻辑 / box_check 用；界面层走上面那个，
   免得把 class 实例当 @Prop 传）。 */
public func boxSlotState(s: RunState, selectedSlot: Int64, i: Int64): Int64 {
    return boxSlotStateOf(s.boxChars, s.boxLanded, selectedSlot, i)
}

/* 这一格现在能不能落字：卡允许落字、格子在界内、格子里有字、本代没落过。
   空格 / 事签格 / 已落格都不能落。
   注意这里按「没有选中」算这一格的状态：选中只是界面态，落不落看得还是
   格子里有没有字、落过没有。 */
public func canLuoziOf(chars: Array<String>, landed: Array<Bool>, allowsLuozi: Bool, selectedSlot: Int64): Bool {
    if (!allowsLuozi) { return false }
    if (selectedSlot < 0 || selectedSlot >= RUN_PICK_CAP) { return false }
    return boxSlotStateOf(chars, landed, BOX_SLOT_NONE, selectedSlot) == BOX_SLOT_OK
}

/* 同上，从 RunState + 当前这张卡上读。 */
public func canLuozi(s: RunState, card: EventCard, selectedSlot: Int64): Bool {
    return canLuoziOf(s.boxChars, s.boxLanded, card.allowsLuozi, selectedSlot)
}

/* 落字：这一格标记「本代已落」，卡上第三个选项的增减照算，牌堆前进一步。
   返回新状态（原状态不改）；这一下落不下去（卡不允许 / 没选中可落的格）时
   原样返回，cardsSeen 不动 —— 界面层靠这个判断「没落下」。 */
public func applyLuozi(prev: RunState, slot: Int64): RunState {
    let card = eventCardAt(prev.cardIndex)
    if (!canLuozi(prev, card, slot)) { return prev }
    let s = applyChoice(prev, RUN_SIDE_LUOZI)
    /* applyChoice 只浅拷贝，boxLanded 还是原状态那个数组：复制一份再改，
      不然会把上一帧的 @State 数组一起改掉（界面不重绘）。 */
    let landed = ArrayList<Bool>()
    var i: Int64 = 0
    while (i < s.boxLanded.size) {
        landed.add(s.boxLanded[i])
        i = i + 1
    }
    if (slot >= 0 && slot < landed.size) {
        landed[slot] = true
    }
    s.boxLanded = landed.toArray()
    return s
}

/* ————— 代末结算（SPEC §2.6 / §2.7）—————

   结局卡（phase 2）之后的收尾：把这一代写进家谱、开下一代（phase 0 开局挑字）。
   界面在 ui_ending.cj / ui_settle.cj，规则全在这里。 */

/* 这一代「留下的字」= 字匣里落过的那几格（SPEC §2.4 / §3：本代刻成的字）。
   没有落过 → 空数组，界面写「未成字」。事签占位格不算字。 */
public func landedChars(s: RunState): Array<String> {
    let out = ArrayList<String>()
    var i: Int64 = 0
    while (i < s.boxChars.size && i < s.boxLanded.size) {
        if (s.boxLanded[i] && !boxSlotIsShiqianId(s.boxChars[i])) {
            out.add(s.boxChars[i])
        }
        i = i + 1
    }
    return out.toArray()
}

/* 同一批字的字形（界面直接画：家谱行 24×24、结局卡 40×40）。 */
public func landedGlyphs(s: RunState): Array<String> {
    let ids = landedChars(s)
    let out = ArrayList<String>()
    var i: Int64 = 0
    while (i < ids.size) {
        out.add(ziluGlyphOf(ids[i]))
        i = i + 1
    }
    return out.toArray()
}

/* 这一代家谱条怎么记（结局标题 / 善终 / 留下的字）。 */
public func familyEntryOf(s: RunState): Option<FamilyEntry> {
    match (endingOfState(s)) {
        case Some(info) =>
            return Some(FamilyEntry(s.generation, info.title, info.good, landedChars(s)))
        case None => return Option<FamilyEntry>.None
    }
}

/* 家谱行在界面上要的顺序：最老的在最上、最新一代在最下（设计稿 .tl）。
   上一代们来自存档的 family，本代这一条由结局现算（settleAndNextGeneration 落定
   之后它才进 family）—— 所以代末结算页至少能看到「上一代 + 本代」两行。 */
public func familyRows(s: RunState): Array<FamilyEntry> {
    let out = ArrayList<FamilyEntry>()
    var i: Int64 = 0
    while (i < s.family.size) {
        out.add(s.family[i])
        i = i + 1
    }
    match (familyEntryOf(s)) {
        case Some(e) => out.add(e)
        case None => ()
    }
    return out.toArray()
}

/* 这一代是不是家谱里最新一条（「新」角标 / 朱点画在它身上）。 */
public func familyIsThisGen(e: FamilyEntry, generation: Int64): Bool {
    return e.generation == generation
}

/* 家谱条留下的字（字 id → 字形，家谱行 24×24 那一排直接画）。 */
public func familyEntryGlyphs(e: FamilyEntry): Array<String> {
    let out = ArrayList<String>()
    var i: Int64 = 0
    while (i < e.chars.size) {
        out.add(ziluGlyphOf(e.chars[i]))
        i = i + 1
    }
    return out.toArray()
}

/* 「往下传」：这一代写进家谱，然后开下一代（SPEC §2.6）。
   返回新状态（原状态不改，界面层换引用触发重绘）：
     family 追加一条（代、结局标题、善终、落过的字）
     代次 +1，年 / 余年 / 四维 / 骨片 / 字匣 / 牌堆 / 结局字段全部归开局值
     phase 回 0（开局挑字页）
   没有结局（phase 不是 2）时原样返回 —— 界面层靠这个拦住误点。 */
public func settleAndNextGeneration(prev: RunState): RunState {
    match (familyEntryOf(prev)) {
        case Some(entry) =>
            let s = startGeneration(prev)
            let fam = ArrayList<FamilyEntry>()
            var i: Int64 = 0
            while (i < prev.family.size) {
                fam.add(prev.family[i])
                i = i + 1
            }
            fam.add(entry)
            s.family = fam.toArray()
            return s
        case None => return prev
    }
}

/* =============================================================================
   调试开关 M2_DEBUG_FORCE_END（DEBUG ONLY，默认 false）
   -----------------------------------------------------------------------------
   把这个开关置 true，主界底部会多一颗小按钮「调试：粮归零」，点一下把「粮」这一维
   直接按到 0，然后走完全正常的纯逻辑路径（debugForceDimZero → runDetectEnding
   那一套）进 phase 2 结局卡 —— 不抄近路、不直接改 phase，测的就是真链路。
   唯一用途：本机 / 测试机上不打完 12 年就能看到结局卡与代末结算。
   正式出包（尤其 release）必须是 false，否则主界多一颗按钮、四维条数值也和
   设计稿不一致。
   tools/box_check 里有断言守着的：M2_DEBUG_FORCE_END == false。
   ============================================================================= */
public let M2_DEBUG_FORCE_END: Bool = false

/* 调试入口：把某一维按到 0 并重新判结局（见上面 M2_DEBUG_FORCE_END）。
   dim 认不出 / 不在界内时按「粮」算；原状态不改，返回新状态。
   已经是 phase 2 / 3 时原样返回（调试按钮只在主界出现）。 */
public func debugForceDimZero(prev: RunState, dim: Int64): RunState {
    if (prev.phase == RUN_PHASE_ENDING || prev.phase == RUN_PHASE_SETTLE) { return prev }
    let d = if (dim < 0 || dim >= RUN_DIM_COUNT) { 0 } else { dim }
    let s = cloneRunState(prev)
    let dims = ArrayList<Int64>()
    var i: Int64 = 0
    while (i < s.dims.size) {
        dims.add(if (i == d) { 0 } else { s.dims[i] })
        i = i + 1
    }
    s.dims = dims.toArray()
    /* 正常路径判结局：见底那一维是什么结局，结局卡就显示什么。 */
    runDetectEnding(s)
    return s
}
