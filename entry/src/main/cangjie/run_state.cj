package ohos_app_cangjie_entry

import std.collection.ArrayList

/* M2「一代闭环」的存档状态 + 开局挑字的纯逻辑（SPEC §2.4 开局挑字页 / §3
   「开局已造少于 3 字」；设计稿 ziku_pick_v1 D）。
   本文件不 import 任何 kit/ohos 模块，能在普通 Linux 上编译（tools/box_check）。
   平台胶水（Preferences 读写）在 run_store.cj，界面在 ui_pick.cj / ui_home.cj。

   字段约定（slice 1 定，后面几片只加不改；格式变了才 bump RUN_SAVE_VERSION）：
     generation   代次，从 1 起
     year         本代第几年，从 1 起
     yearsLeft    余年
     dims         四维，顺序 粮 信 记 外，各 0..100，开局 50
     boneEmpty    空骨片（开局 2，上限 5）；boneShiqian 事签骨片；两者之和 ≤ 5
     boxChars     字匣里带的字（开局挑的，可能少于 3 个）
     boxLanded    与 boxChars 等长：本代这个字落过没有
     phase        0 开局挑字 / 1 主界 / 2 结局卡 / 3 代末结算
     cardIndex    事件牌堆下标；cardsSeen 已看张数
     endingId     结局 id，活着是空串；endingDim / endingKind 是原因胶囊
     family       家谱行（代、结局标题、是否善终、留下的字）
   存档格式：单行，"|" 分字段，列表字段用 ","，家谱条目用 ";" + "~"，
   空串 / 空列表一律写成 "-"（见 serializeRunState / parseRunState）。 */

/* —— 存档版本 —— */
public let RUN_SAVE_VERSION: Int64 = 1
public let RUN_SAVE_HEAD: String = "zaozi_run"
/* serialize 出来的字段个数，parse 时个数不对就是坏档。 */
public let RUN_FIELD_COUNT: Int64 = 17

/* —— 开局数值（SPEC / m2_common RunState contract）—— */
public let RUN_PICK_CAP: Int64 = 3
public let RUN_DIM_COUNT: Int64 = 4
public let RUN_DIM_START: Int64 = 50
public let RUN_DIM_MAX: Int64 = 100
public let RUN_BONE_EMPTY_START: Int64 = 2
public let RUN_BONE_CAP: Int64 = 5
public let RUN_YEARS_START: Int64 = 12

/* phase 取值。 */
public let RUN_PHASE_PICK: Int64 = 0
public let RUN_PHASE_HOME: Int64 = 1
public let RUN_PHASE_ENDING: Int64 = 2
public let RUN_PHASE_SETTLE: Int64 = 3

/* 家谱行：一代一条（SPEC §2.6 家谱行）。 */
public class FamilyEntry {
    public let generation: Int64
    public let endingTitle: String
    public let endingGood: Bool
    public let chars: Array<String>

    public init(generation: Int64, endingTitle: String, endingGood: Bool, chars: Array<String>) {
        this.generation = generation
        this.endingTitle = endingTitle
        this.endingGood = endingGood
        this.chars = chars
    }

    public func sameAs(o: FamilyEntry): Bool {
        if (this.generation != o.generation) { return false }
        if (this.endingTitle != o.endingTitle) { return false }
        if (this.endingGood != o.endingGood) { return false }
        return runSameStrs(this.chars, o.chars)
    }

    /* 一条存成 "代~标题~善终~字,字"。标题里不能出现 ~ ; | 三个字符。 */
    public func serialize(): String {
        return "${this.generation}~${runDash(this.endingTitle)}~${runBoolText(this.endingGood)}~${runJoinStrs(this.chars)}"
    }
}

/* 一代的存档状态。字段默认值就是「新开局」，newRunState() 直接 new 出来。 */
public class RunState {
    public var generation: Int64 = 1
    public var year: Int64 = 1
    public var yearsLeft: Int64 = 12
    /* 粮 信 记 外，开局各 50。 */
    public var dims: Array<Int64> = [50, 50, 50, 50]
    public var boneEmpty: Int64 = 2
    public var boneShiqian: Int64 = 0
    public var boxChars: Array<String> = []
    public var boxLanded: Array<Bool> = []
    public var phase: Int64 = RUN_PHASE_PICK
    public var cardIndex: Int64 = 0
    public var cardsSeen: Int64 = 0
    public var endingId: String = ""
    public var endingDim: Int64 = -1
    public var endingKind: String = ""
    public var family: Array<FamilyEntry> = []

    /* 四维取值，越界钳到 0..100（界面不判空）。 */
    public func dimAt(i: Int64): Int64 {
        if (i < 0 || i >= this.dims.size) { return 0 }
        return this.dims[i]
    }

    /* 字匣第 i 格的字，越界 / 空格返回空串。 */
    public func boxAt(i: Int64): String {
        if (i < 0 || i >= this.boxChars.size) { return "" }
        return this.boxChars[i]
    }

    /* 字匣第 i 格本代落过没有（没有这一格 → false）。 */
    public func landedAt(i: Int64): Bool {
        if (i < 0 || i >= this.boxLanded.size) { return false }
        return this.boxLanded[i]
    }

    /* 开局挑字落定：挑的字进字匣，全部「本代未落」，phase 进主界。
       存档由调用方（EntryView）负责写。 */
    public func confirmPick(picked: Array<String>): Unit {
        this.boxChars = picked
        let landed = ArrayList<Bool>()
        var i: Int64 = 0
        while (i < picked.size) {
            landed.add(false)
            i = i + 1
        }
        this.boxLanded = landed.toArray()
        this.phase = RUN_PHASE_HOME
    }

    /* 逐字段比对（box_check 的序列化往返断言用；Cangjie 的 class 没有默认 ==）。 */
    public func sameAs(o: RunState): Bool {
        if (this.generation != o.generation) { return false }
        if (this.year != o.year) { return false }
        if (this.yearsLeft != o.yearsLeft) { return false }
        if (!runSameInts(this.dims, o.dims)) { return false }
        if (this.boneEmpty != o.boneEmpty) { return false }
        if (this.boneShiqian != o.boneShiqian) { return false }
        if (!runSameStrs(this.boxChars, o.boxChars)) { return false }
        if (!runSameBools(this.boxLanded, o.boxLanded)) { return false }
        if (this.phase != o.phase) { return false }
        if (this.cardIndex != o.cardIndex) { return false }
        if (this.cardsSeen != o.cardsSeen) { return false }
        if (this.endingId != o.endingId) { return false }
        if (this.endingDim != o.endingDim) { return false }
        if (this.endingKind != o.endingKind) { return false }
        if (this.family.size != o.family.size) { return false }
        var i: Int64 = 0
        while (i < this.family.size) {
            if (!this.family[i].sameAs(o.family[i])) { return false }
            i = i + 1
        }
        return true
    }
}

/* 新开局：phase 0（开局挑字页），四维 50，空骨片 2，余年 12，家谱空。 */
public func newRunState(): RunState {
    return RunState()
}

/* 开下一代：代次 +1，年 / 余年 / 四维 / 字匣 / 骨片全部回到开局值，
   家谱整条留着。phase 回 0 → 又回到开局挑字页（SPEC §2.4 / §2.6）。 */
public func startGeneration(prev: RunState): RunState {
    let s = RunState()
    s.generation = prev.generation + 1
    s.family = prev.family
    return s
}

/* 逐字段复制一份。界面层改完状态要重新赋回 @State：class 类型的 @State 认的是
   引用变化，只改内部字段不保证触发重绘（挑完字必须从挑字页切到主界）。 */
public func cloneRunState(prev: RunState): RunState {
    let s = RunState()
    s.generation = prev.generation
    s.year = prev.year
    s.yearsLeft = prev.yearsLeft
    s.dims = prev.dims
    s.boneEmpty = prev.boneEmpty
    s.boneShiqian = prev.boneShiqian
    s.boxChars = prev.boxChars
    s.boxLanded = prev.boxLanded
    s.phase = prev.phase
    s.cardIndex = prev.cardIndex
    s.cardsSeen = prev.cardsSeen
    s.endingId = prev.endingId
    s.endingDim = prev.endingDim
    s.endingKind = prev.endingKind
    s.family = prev.family
    return s
}

/* 挑字落定后的新状态（复制一份再改，见 cloneRunState 的说明）。 */
public func runAfterPick(prev: RunState, picked: Array<String>): RunState {
    let s = cloneRunState(prev)
    s.confirmPick(picked)
    return s
}

/* ————— 序列化 ————— */

/* 空串写成 "-"：这样切出来的字段都不是空串，"a||b" 那种空段歧义进不到解析里。 */
func runDash(v: String): String {
    if (v.size == 0) { return "-" }
    return v
}

func runUnDash(v: String): String {
    if (v == "-") { return "" }
    return v
}

func runBoolText(v: Bool): String {
    if (v) { return "1" }
    return "0"
}

func runJoinInts(xs: Array<Int64>): String {
    if (xs.size == 0) { return "-" }
    var out = ""
    var i: Int64 = 0
    while (i < xs.size) {
        if (i > 0) { out = out + "," }
        out = out + "${xs[i]}"
        i = i + 1
    }
    return out
}

func runJoinBools(xs: Array<Bool>): String {
    if (xs.size == 0) { return "-" }
    var out = ""
    var i: Int64 = 0
    while (i < xs.size) {
        if (i > 0) { out = out + "," }
        out = out + runBoolText(xs[i])
        i = i + 1
    }
    return out
}

func runJoinStrs(xs: Array<String>): String {
    if (xs.size == 0) { return "-" }
    var out = ""
    var i: Int64 = 0
    while (i < xs.size) {
        if (i > 0) { out = out + "," }
        out = out + xs[i]
        i = i + 1
    }
    return out
}

func runJoinFamily(xs: Array<FamilyEntry>): String {
    if (xs.size == 0) { return "-" }
    var out = ""
    var i: Int64 = 0
    while (i < xs.size) {
        if (i > 0) { out = out + ";" }
        out = out + xs[i].serialize()
        i = i + 1
    }
    return out
}

public func serializeRunState(s: RunState): String {
    var out = RUN_SAVE_HEAD + "|v${RUN_SAVE_VERSION}"
    out = out + "|${s.generation}|${s.year}|${s.yearsLeft}"
    out = out + "|${runJoinInts(s.dims)}"
    out = out + "|${s.boneEmpty}|${s.boneShiqian}"
    out = out + "|${runJoinStrs(s.boxChars)}"
    out = out + "|${runJoinBools(s.boxLanded)}"
    out = out + "|${s.phase}|${s.cardIndex}|${s.cardsSeen}"
    out = out + "|${runDash(s.endingId)}"
    out = out + "|${s.endingDim}"
    out = out + "|${runDash(s.endingKind)}"
    out = out + "|${runJoinFamily(s.family)}"
    return out
}

/* 十进制整数（可带负号）；出现任何非数字字符 → None。 */
public func runParseI64(raw: String): Option<Int64> {
    let arr = raw.toArray()
    if (arr.size == 0) { return Option<Int64>.None }
    var i: Int64 = 0
    var neg = false
    if (arr[0] == UInt8(45)) {
        neg = true
        i = 1
    }
    if (i >= arr.size) { return Option<Int64>.None }
    var n: Int64 = 0
    while (i < arr.size) {
        let c = Int64(arr[i])
        if (c < 48 || c > 57) { return Option<Int64>.None }
        n = n * 10 + (c - 48)
        i = i + 1
    }
    if (neg) { return Some(-n) }
    return Some(n)
}

public func runParseBool(raw: String): Option<Bool> {
    if (raw == "1") { return Some(true) }
    if (raw == "0") { return Some(false) }
    return Option<Bool>.None
}

public func runParseIntList(raw: String): Option<Array<Int64>> {
    if (raw == "-") {
        let e: Array<Int64> = []
        return Some(e)
    }
    let parts = raw.split(",")
    let out = ArrayList<Int64>()
    var i: Int64 = 0
    while (i < parts.size) {
        match (runParseI64(parts[i])) {
            case Some(v) => out.add(v)
            case None => return Option<Array<Int64>>.None
        }
        i = i + 1
    }
    return Some(out.toArray())
}

public func runParseBoolList(raw: String): Option<Array<Bool>> {
    if (raw == "-") {
        let e: Array<Bool> = []
        return Some(e)
    }
    let parts = raw.split(",")
    let out = ArrayList<Bool>()
    var i: Int64 = 0
    while (i < parts.size) {
        match (runParseBool(parts[i])) {
            case Some(v) => out.add(v)
            case None => return Option<Array<Bool>>.None
        }
        i = i + 1
    }
    return Some(out.toArray())
}

public func runParseStrList(raw: String): Option<Array<String>> {
    if (raw == "-") {
        let e: Array<String> = []
        return Some(e)
    }
    /* 空字段只可能是被截坏的档：serialize 时空列表一律写 "-"。 */
    if (raw.size == 0) { return Option<Array<String>>.None }
    let parts = raw.split(",")
    let out = ArrayList<String>()
    var i: Int64 = 0
    while (i < parts.size) {
        out.add(parts[i])
        i = i + 1
    }
    return Some(out.toArray())
}

public func runParseFamily(raw: String): Option<Array<FamilyEntry>> {
    if (raw == "-") {
        let e: Array<FamilyEntry> = []
        return Some(e)
    }
    let rows = raw.split(";")
    let out = ArrayList<FamilyEntry>()
    var i: Int64 = 0
    while (i < rows.size) {
        let f = rows[i].split("~")
        if (f.size != 4) { return Option<Array<FamilyEntry>>.None }
        var gen: Int64 = 0
        match (runParseI64(f[0])) {
            case Some(v) => gen = v
            case None => return Option<Array<FamilyEntry>>.None
        }
        /* 字段顺序同 FamilyEntry.serialize()：代~标题~善终~字,字。 */
        var good: Bool = false
        match (runParseBool(f[2])) {
            case Some(v) => good = v
            case None => return Option<Array<FamilyEntry>>.None
        }
        var chars: Array<String> = []
        match (runParseStrList(f[3])) {
            case Some(v) => chars = v
            case None => return Option<Array<FamilyEntry>>.None
        }
        out.add(FamilyEntry(gen, runUnDash(f[1]), good, chars))
        i = i + 1
    }
    return Some(out.toArray())
}

/* 字段读取器：任何一个字段不是整数就记 ok = false，最后统一回退新开局。 */
class RunFields {
    public var ok: Bool = true
    var parts: Array<String>

    public init(parts: Array<String>) {
        this.parts = parts
    }

    public func num(i: Int64): Int64 {
        match (runParseI64(this.parts[i])) {
            case Some(v) => return v
            case None =>
                this.ok = false
                return 0
        }
    }
}

/* 存档自洽性：四维 4 个、字匣不超 3 格、landed 与 chars 等长、phase 在界内。 */
func runStateSane(s: RunState): Bool {
    if (s.dims.size != RUN_DIM_COUNT) { return false }
    if (s.boxChars.size > RUN_PICK_CAP) { return false }
    if (s.boxLanded.size != s.boxChars.size) { return false }
    if (s.phase < RUN_PHASE_PICK || s.phase > RUN_PHASE_SETTLE) { return false }
    if (s.boneEmpty < 0 || s.boneShiqian < 0) { return false }
    return true
}

/* 坏档（字段数不对 / 版本不符 / 有字段不是数 / 不自洽）→ None，
   调用方回退 newRunState()，绝不崩。 */
public func parseRunState(raw: String): Option<RunState> {
    if (raw.size == 0) { return Option<RunState>.None }
    let parts = raw.split("|")
    if (parts.size != RUN_FIELD_COUNT) { return Option<RunState>.None }
    if (parts[0] != RUN_SAVE_HEAD) { return Option<RunState>.None }
    if (parts[1] != "v${RUN_SAVE_VERSION}") { return Option<RunState>.None }
    let f = RunFields(parts)
    let s = RunState()
    s.generation = f.num(2)
    s.year = f.num(3)
    s.yearsLeft = f.num(4)
    match (runParseIntList(parts[5])) {
        case Some(v) => s.dims = v
        case None => f.ok = false
    }
    s.boneEmpty = f.num(6)
    s.boneShiqian = f.num(7)
    match (runParseStrList(parts[8])) {
        case Some(v) => s.boxChars = v
        case None => f.ok = false
    }
    match (runParseBoolList(parts[9])) {
        case Some(v) => s.boxLanded = v
        case None => f.ok = false
    }
    s.phase = f.num(10)
    s.cardIndex = f.num(11)
    s.cardsSeen = f.num(12)
    s.endingId = runUnDash(parts[13])
    s.endingDim = f.num(14)
    s.endingKind = runUnDash(parts[15])
    match (runParseFamily(parts[16])) {
        case Some(v) => s.family = v
        case None => f.ok = false
    }
    if (!f.ok) { return Option<RunState>.None }
    if (!runStateSane(s)) { return Option<RunState>.None }
    return Some(s)
}

func runSameInts(a: Array<Int64>, b: Array<Int64>): Bool {
    if (a.size != b.size) { return false }
    var i: Int64 = 0
    while (i < a.size) {
        if (a[i] != b[i]) { return false }
        i = i + 1
    }
    return true
}

func runSameBools(a: Array<Bool>, b: Array<Bool>): Bool {
    if (a.size != b.size) { return false }
    var i: Int64 = 0
    while (i < a.size) {
        if (a[i] != b[i]) { return false }
        i = i + 1
    }
    return true
}

func runSameStrs(a: Array<String>, b: Array<String>): Bool {
    if (a.size != b.size) { return false }
    var i: Int64 = 0
    while (i < a.size) {
        if (a[i] != b[i]) { return false }
        i = i + 1
    }
    return true
}

/* ————— 开局挑字（SPEC §2.4 / §3）———— */

/* 能挑的字 = 已造的字（zilu_model 的 ZILU_MADE_IDS）。 */
public func pickAvailable(): Int64 {
    return ZILU_MADE_IDS.size
}

/* 这个字挑没挑（不在 → -1；在 → 挑选顺序下标 0..2）。 */
public func pickIndexOf(picked: Array<String>, id: String): Int64 {
    return ziluIndexOfOf(picked, id)
}

/* 大格 / 网格右上角那个朱序号：1..3；没挑返回 0。 */
public func pickOrderOf(picked: Array<String>, id: String): Int64 {
    let at = pickIndexOf(picked, id)
    if (at < 0) { return 0 }
    return at + 1
}

/* 挑字页「上一代传下的事签」占的那一格（SPEC §2.4 / 设计稿 ziku_pick_v1 D 屏）。
   PM/user 2026-10-12：刻事签 / 传事签还没落地（事签传不下来）之前，不预留事签格 ——
   每一代（含第 2 代起）玩家都挑满 3 个字，所以这里恒返回 0（挑字页也就不画事签格）。
   设计终态：第 2 代起三个大格里的第 1 格留给事签（骨片形，不可换），玩家只挑 2 个字。
   等事签传递上线时，恢复为：
       if (generation >= 2) { return 1 }
       return 0
   并同步改回 tools/box_check 的 pickShiqianShape 预留格 / cap 断言。 */
public func pickShiqianReserved(generation: Int64): Int64 {
    return 0
}

/* 这一代最多能挑几个 = 3 − 事签占格（事签未通前预留恒 0 → 每代都是 3）。 */
public func pickCapFor(generation: Int64): Int64 {
    let cap = RUN_PICK_CAP - pickShiqianReserved(generation)
    if (cap < 0) { return 0 }
    return cap
}

/* 这一代开局时字匣里有没有「上一代传下的事签」。
   注意：刻事签 / 传事签不在本里程碑 —— startGeneration 现在把骨片清零，
   所以这一条恒 false（挑字页第 1 格永远显示「上一代没传事签」）。等传事签
   落地时只改这里（和 startGeneration）：runAfterPickGen 会照常把事签摆进
   字匣第 0 格，界面层也已经按 carried 画好骨片格了。 */
public func pickShiqianCarried(s: RunState): Bool {
    return s.generation >= 2 && s.boneShiqian > 0
}

/* 点格子：挑了的收回，没挑的追加在最后；已满 cap 个就不再收。
   cap 版给第 2 代起用（事签落地后占 1 格 → cap 2；未通前 reserved 恒 0 → cap 3）；不带 cap 的版本就是
   cap = RUN_PICK_CAP，第 1 代行为一格不变。 */
public func pickToggleCap(picked: Array<String>, id: String, cap: Int64): Array<String> {
    let out = ArrayList<String>()
    var removed = false
    var i: Int64 = 0
    while (i < picked.size) {
        if (picked[i] == id) {
            removed = true
        } else {
            out.add(picked[i])
        }
        i = i + 1
    }
    if (removed) { return out.toArray() }
    if (out.size >= cap) { return out.toArray() }
    out.add(id)
    return out.toArray()
}

public func pickToggle(picked: Array<String>, id: String): Array<String> {
    return pickToggleCap(picked, id, RUN_PICK_CAP)
}

/* 这一代最多能带几个：满 cap 个按 cap；可挑的字不足 cap 个时能带多少算多少
   （SPEC §3「开局已造少于 3 字」）。 */
public func pickNeedCap(available: Int64, cap: Int64): Int64 {
    if (available < cap) { return available }
    return cap
}

public func pickNeed(available: Int64): Int64 {
    return pickNeedCap(available, RUN_PICK_CAP)
}

/* 还差几个字才满。 */
public func pickRemainingCap(picked: Array<String>, available: Int64, cap: Int64): Int64 {
    let left = pickNeedCap(available, cap) - picked.size
    if (left < 0) { return 0 }
    return left
}

public func pickRemaining(picked: Array<String>, available: Int64): Int64 {
    return pickRemainingCap(picked, available, RUN_PICK_CAP)
}

/* 主按钮文案：没满「还差 N 个字」；满了（或本来就不足 cap 个字可挑）
   →「就带这些开局」（SPEC §3）。 */
public func pickButtonTextCap(picked: Array<String>, available: Int64, cap: Int64): String {
    let left = pickRemainingCap(picked, available, cap)
    if (left > 0) { return PICK_BTN_NEED.replace("N", "${left}") }
    return PICK_BTN_GO
}

public func pickButtonText(picked: Array<String>, available: Int64): String {
    return pickButtonTextCap(picked, available, RUN_PICK_CAP)
}

/* 主按钮能不能点。 */
public func pickCanConfirmCap(picked: Array<String>, available: Int64, cap: Int64): Bool {
    return pickRemainingCap(picked, available, cap) == 0
}

public func pickCanConfirm(picked: Array<String>, available: Int64): Bool {
    return pickCanConfirmCap(picked, available, RUN_PICK_CAP)
}

/* 挑字页网格格子的朱序号：第 2 代起事签占了第 1 格，挑的第 1 个字排第 2 格，
   所以序号整体后移 orderBase（第 1 代 orderBase = 0，行为不变）。没挑 → 0。 */
public func pickOrderOfBase(picked: Array<String>, id: String, orderBase: Int64): Int64 {
    let at = pickIndexOf(picked, id)
    if (at < 0) { return 0 }
    return at + 1 + orderBase
}

/* 挑字落定后的新状态（复制一份再改，见 cloneRunState 的说明）。
   第 2 代起且上一代真传下了事签时，字匣第 0 格是事签、挑的字跟在后面
   （事签格不能落，landedChars 也不把它算成「留下的字」）。 */
public func runAfterPickGen(prev: RunState, picked: Array<String>): RunState {
    let box = ArrayList<String>()
    if (pickShiqianCarried(prev)) {
        box.add(BOX_SHIQIAN_ID)
    }
    var i: Int64 = 0
    while (i < picked.size) {
        box.add(picked[i])
        i = i + 1
    }
    return runAfterPick(prev, box.toArray())
}

/* 挑字页网格：就是字录那个 27 格总览（60×60、间距 9、一行 5 格），
   只有已造的字能挑；选中态按 picked 算（不按字录的 ZILU_SELECTED_ID）。 */
public func pickGridCells(picked: Array<String>): ArrayList<ZiluGridCell> {
    let all = ziluGrid()
    let out = ArrayList<ZiluGridCell>()
    var i: Int64 = 0
    while (i < all.size) {
        let c = all[i]
        let sel = c.isMade() && ziluIsMadeOf(picked, c.charId)
        out.add(ZiluGridCell(c.charId, c.glyph, c.state, c.hint, sel, false))
        i = i + 1
    }
    return out
}
