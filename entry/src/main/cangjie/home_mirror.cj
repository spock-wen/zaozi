package ohos_app_cangjie_entry

import std.collection.ArrayList

/* M2 烟测 R1/R3 的纯映射逻辑（本文件不 import 任何 kit/ohos 模块，
   能在普通 Linux 上编译，tools/box_check 里有断言守着）。

   为什么要有这个文件（e4c8def 烟测的三个 FAIL 的根因）：
   ArkUI-Cangjie 这一版的 @Prop 只认真实发生的「原始值变化」——
     · class 类型 @State 的字段（this.run.year / this.run.dims）传进子组件
       @Prop，父组件换了引用也不会推给孩子（主界年份 / 四维 / 卡面全不刷新）；
     · 函数调用结果当 @Prop 传（leftLabel: this.leftLabel()）不参与跟踪；
     · 数组 @Prop 没验过，玩起来会变的值不用它。
   所以 EntryView 把存档状态「摊平」成一组原始 @State（HomeMirror 就是这组
   值的形状），只把这些原始值递给 HomeScreen；下游每一层都只收原始值，
   文案 / 状态 / 增减一律在收到原始值的那一层自己的成员函数里现算。

   这里放的三块纯逻辑：
     HomeMirror / homeMirrorOf   RunState → 一组原始值（含 landed 位掩码）
     runLandedMask*              字匣「本代已落」↔ Int64 位掩码（第 i 位 = 第 i 格）
     dragSideOf / dragClampShift / dragPastThreshold
                                拖卡决策：dx → 选哪一侧 / 钳位移 / 过没过阈值（R2）
     luoziBarStateOf / luoziBarLabelOf / luoziBarEnabled
                                卡底落字条状态机：没选中 → 灰态；选中可落的字 →
                                朱态「落「X」字」；再点一次 → 武装态（R3） */

/* 字匣「本代已落」压成一个 Int64（第 i 位 = 第 i 格落过没有）。
   不用 Array<Bool> 当 @Prop：数组 @Prop 没验过，位掩码是原始值。 */
public func runLandedMaskEncode(landed: Array<Bool>): Int64 {
    var mask: Int64 = 0
    var i: Int64 = 0
    while (i < landed.size && i < RUN_PICK_CAP) {
        if (landed[i]) {
            mask = mask + runLandedBit(i)
        }
        i = i + 1
    }
    return mask
}

/* 第 i 格落过没有（越界 / 没这一格 → false）。 */
public func runLandedAtMask(mask: Int64, i: Int64): Bool {
    if (i < 0 || i >= RUN_PICK_CAP) { return false }
    return (mask / runLandedBit(i)) % 2 == 1
}

/* 第 i 格那一位（1 / 2 / 4）。 */
public func runLandedBit(i: Int64): Int64 {
    if (i <= 0) { return 1 }
    if (i == 1) { return 2 }
    return 4
}

/* HomeScreen 要显示的那一组原始值（EntryView 的 @State 镜子）。
   每个字段都是 Int64 / String / Bool —— 不出现 class 实例、不出现数组。 */
public class HomeMirror {
    /* 顶行：第 N 代 · 第 Y 年。 */
    public var generation: Int64 = 1
    public var year: Int64 = 1
    /* 骨片行右侧「余年 N 年」。 */
    public var yearsLeft: Int64 = RUN_YEARS_START
    /* 四维（粮 信 记 外），逐维一个原始值。 */
    public var dim0: Int64 = RUN_DIM_START
    public var dim1: Int64 = RUN_DIM_START
    public var dim2: Int64 = RUN_DIM_START
    public var dim3: Int64 = RUN_DIM_START
    /* 骨片行：空骨片 / 事签骨片。 */
    public var boneEmpty: Int64 = RUN_BONE_EMPTY_START
    public var boneShiqian: Int64 = 0
    /* 事件牌堆下标（卡面文案 / 选项 / 落字许不许可，都由这一层现算）。 */
    public var cardIndex: Int64 = 0
    /* 字匣：本代带的字（id）+ 有几格有字 + 哪些格本代已落（位掩码）。
       boxCount 之外的格是空格（SPEC §3：开局不足 3 个字）。 */
    public var boxCount: Int64 = 0
    public var box0: String = ""
    public var box1: String = ""
    public var box2: String = ""
    public var landedMask: Int64 = 0
}

/* RunState → 这一组原始值（纯映射，box_check 逐字段断言）。 */
public func homeMirrorOf(s: RunState): HomeMirror {
    let m = HomeMirror()
    m.generation = s.generation
    m.year = s.year
    m.yearsLeft = s.yearsLeft
    m.dim0 = s.dimAt(0)
    m.dim1 = s.dimAt(1)
    m.dim2 = s.dimAt(2)
    m.dim3 = s.dimAt(3)
    m.boneEmpty = s.boneEmpty
    m.boneShiqian = s.boneShiqian
    m.cardIndex = s.cardIndex
    var n = s.boxChars.size
    if (n > RUN_PICK_CAP) { n = RUN_PICK_CAP }
    if (n < 0) { n = 0 }
    m.boxCount = n
    m.box0 = s.boxAt(0)
    m.box1 = s.boxAt(1)
    m.box2 = s.boxAt(2)
    m.landedMask = runLandedMaskEncode(s.boxLanded)
    return m
}

/* 逐字段比对（提交存档后用来断言「镜子跟上了」，Cangjie 的 class 没有默认 ==）。 */
public func homeMirrorSame(a: HomeMirror, b: HomeMirror): Bool {
    if (a.generation != b.generation) { return false }
    if (a.year != b.year) { return false }
    if (a.yearsLeft != b.yearsLeft) { return false }
    if (a.dim0 != b.dim0 || a.dim1 != b.dim1 || a.dim2 != b.dim2 || a.dim3 != b.dim3) { return false }
    if (a.boneEmpty != b.boneEmpty) { return false }
    if (a.boneShiqian != b.boneShiqian) { return false }
    if (a.cardIndex != b.cardIndex) { return false }
    if (a.boxCount != b.boxCount) { return false }
    if (a.box0 != b.box0 || a.box1 != b.box1 || a.box2 != b.box2) { return false }
    if (a.landedMask != b.landedMask) { return false }
    return true
}

/* 字匣格子的字 id（界面层拿它换字形；空格 / 越界 → 空串）。 */
public func homeMirrorBoxId(m: HomeMirror, i: Int64): String {
    if (i < 0 || i >= m.boxCount) { return "" }
    if (i == 0) { return m.box0 }
    if (i == 1) { return m.box1 }
    return m.box2
}

/* 字匣格子按原始值算状态（0..4，见 game_rules 的 BOX_SLOT_*）。
   界面层（ui_box.cj / ui_event_card.cj）走这一条：传进来的全是原始值。 */
public func homeBoxSlotState(m: HomeMirror, selectedSlot: Int64, i: Int64): Int64 {
    if (i < 0 || i >= RUN_PICK_CAP) { return BOX_SLOT_EMPTY }
    if (i >= m.boxCount) { return BOX_SLOT_EMPTY }
    if (boxSlotIsShiqianId(homeMirrorBoxId(m, i))) { return BOX_SLOT_SHIQIAN }
    if (runLandedAtMask(m.landedMask, i)) { return BOX_SLOT_LANDED }
    if (i == selectedSlot) { return BOX_SLOT_SELECTED }
    return BOX_SLOT_OK
}

/* ————— 拖卡（R2：e4c8def 上拖动完全没响应）—————

   手势在 ui_event_card.cj 的 .onTouch 里手算（这一版仓颉 ArkUI 没有
   PanGesture / LongPressGesture）。决策本身是纯的，放这里由 box_check 断言：
   横向位移 dx（右正左负，vp）→ 选哪一侧 / 卡片位移钳多少 / 过没过阈值。 */

/* 往右拖 = 选右边，往左拖 = 选左边（0 算右边：起点那一侧不算拖动）。 */
public func dragSideOf(dx: Float64): Int64 {
    if (dx >= 0.0) { return RUN_SIDE_RIGHT }
    return RUN_SIDE_LEFT
}

/* 卡片实际位移：钳到 ±cap（SPEC §2.3 只做位移，不做倾斜）。 */
public func dragClampShift(dx: Float64, cap: Int64): Int64 {
    let c = Float64(cap)
    if (dx > c) { return cap }
    if (dx < -c) { return -cap }
    return Int64(dx)
}

/* 过没过拖拽阈值（±threshold，默认 ±60vp）。 */
public func dragPastThreshold(dx: Float64, threshold: Int64): Bool {
    let t = Float64(threshold)
    if (dx >= t) { return true }
    if (dx <= -t) { return true }
    return false
}

/* ————— 卡底落字条（R3：e4c8def 上字匣选中可落的字，落字条还是灰态）—————

   状态机（纯函数，入参全是原始值）：
     NEED   灰态「先在字匣选一个字」：这一张不允许落字，或者字匣里没选中
            一个可落的字（没选 / 空格 / 事签格 / 本代已落）
     READY  朱态「落「X」字」：选中了一个可落的字，等第一次点
     ARMED  朱态「再点一次确认落字」：已经点过一次，再点一次才真落 */
public let LUOZI_BAR_NEED: Int64 = 0
public let LUOZI_BAR_READY: Int64 = 1
public let LUOZI_BAR_ARMED: Int64 = 2

/* armedSlot / armedCard 是「准备落」记在哪个格子、哪张卡上（界面态）；
   换了选中或换了卡就不算准备过 —— 所以武装态要求三者都对上。 */
public func luoziBarStateOf(m: HomeMirror, allowsLuozi: Bool, selectedSlot: Int64,
    armedSlot: Int64, armedCard: Int64, cardIndex: Int64): Int64 {
    if (!canLuoziOf(homeMirrorBoxIds(m), homeMirrorBoxLanded(m), allowsLuozi, selectedSlot)) {
        return LUOZI_BAR_NEED
    }
    if (selectedSlot != BOX_SLOT_NONE && armedSlot == selectedSlot && armedCard == cardIndex) {
        return LUOZI_BAR_ARMED
    }
    return LUOZI_BAR_READY
}

/* 落字条能不能点（灰态点了不动）。 */
public func luoziBarEnabled(state: Int64): Bool {
    return state != LUOZI_BAR_NEED
}

/* 落字条文案：选中了哪个字由调用方给字形（ziluGlyphOf 在字录那一侧）。 */
public func luoziBarLabelOf(state: Int64, glyph: String): String {
    if (state == LUOZI_BAR_ARMED) { return HOME_LUOZI_ARMED }
    if (state == LUOZI_BAR_READY) { return homeLuoziLabel(glyph) }
    return HOME_LUOZI_NEED
}

/* 镜子里的字匣三格 → Array<String>（给 canLuoziOf / boxSlotStateOf 用；
   只在纯逻辑与叶子组件内部出现，不当 @Prop 传）。 */
public func homeMirrorBoxIds(m: HomeMirror): Array<String> {
    let out = ArrayList<String>()
    var i: Int64 = 0
    while (i < m.boxCount && i < RUN_PICK_CAP) {
        out.add(homeMirrorBoxId(m, i))
        i = i + 1
    }
    return out.toArray()
}

/* 镜子里的 landed 掩码 → Array<Bool>（同上）。 */
public func homeMirrorBoxLanded(m: HomeMirror): Array<Bool> {
    let out = ArrayList<Bool>()
    var i: Int64 = 0
    while (i < m.boxCount && i < RUN_PICK_CAP) {
        out.add(runLandedAtMask(m.landedMask, i))
        i = i + 1
    }
    return out.toArray()
}
