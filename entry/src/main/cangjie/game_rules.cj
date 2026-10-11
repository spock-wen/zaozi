package ohos_app_cangjie_entry

import std.collection.ArrayList

/* M2「一代闭环」主界选卡的纯规则（SPEC §2.1 四维条 / §2.7 结局卡；
   设计稿 home_slide_v1）。本文件不 import 任何 kit/ohos 模块，能在普通
   Linux 上编译（tools/box_check）。
   牌堆数据与「按住看分量」的圆点档位在 event_cards.cj，存档状态在
   run_state.cj，平台胶水在 run_store.cj，界面在 ui_hud.cj / ui_bones.cj /
   ui_event_card.cj / ui_home.cj。

   这一片只加「玩法规则」，不改 RunState 的字段与存档格式（SAVE_VERSION 还是 1，
   RUN_FIELD_COUNT 还是 17）：applyChoice 只写 run_state.cj 里已有的字段。

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
