package ohos_app_cangjie_entry

import std.collection.ArrayList

/* M2「一代闭环」的事件牌堆（SPEC §2.3 事件卡 / §2.9 按住看分量；
   设计稿 home_slide_v1 A/B/C、states_v1 ①）。
   本文件不 import 任何 kit/ohos 模块，能在普通 Linux 上编译（tools/box_check）。
   牌堆是占位数据：文案按游戏语气写，数值只是版式示意（SPEC 图注「非玩法示意」）。
   选卡之后怎么算在 game_rules.cj（applyChoice / 结局表），存档状态在 run_state.cj，
   界面在 ui_event_card.cj。

   约定：
     deltas 顺序 = 粮 信 记 外（与 RunState.dims 一致），负数就是减
     side 0 = 左选项，1 = 右选项，2 = 落字（只有 allowsLuozi 的卡有）
     按住看分量的圆点只表分量大小，不表涨跌 */

/* —— 按住看分量：圆点三档 5 / 8 / 12，0 表示这一维不动（不画点）——
   档位按增减的绝对值分：0 不动、≤5 小、≤10 中、再大 大。 */
public let RUN_WEIGHT_NONE: Int64 = 0
public let RUN_WEIGHT_SMALL: Int64 = 5
public let RUN_WEIGHT_MID: Int64 = 8
public let RUN_WEIGHT_LARGE: Int64 = 12
/* 中档的上限（|d| ≤ 10 算中档）；小档上限就是 RUN_WEIGHT_SMALL = 5。 */
public let RUN_WEIGHT_MID_MAX: Int64 = 10

/* side 取值（game_rules.applyChoice 用同一套）。 */
public let RUN_SIDE_LEFT: Int64 = 0
public let RUN_SIDE_RIGHT: Int64 = 1
public let RUN_SIDE_LUOZI: Int64 = 2

/* 一个选项：文案 + 四维增减（粮 信 记 外）。 */
public class EventOption {
    public let label: String
    public let deltas: Array<Int64>

    public init(label: String, deltas: Array<Int64>) {
        this.label = label
        this.deltas = deltas
    }

    /* 这一维的增减，越界当 0（牌面数据都写满 4 个）。 */
    public func deltaAt(i: Int64): Int64 {
        if (i < 0 || i >= this.deltas.size) { return 0 }
        return this.deltas[i]
    }
}

/* 一张事件卡。allowsLuozi = 字匣里选中一个可落的字，卡底就升起第三个选项
   （SPEC §2.3 / §2.4；规则在 game_rules.cj 的 canLuozi / applyLuozi）。 */
public class EventCard {
    public let id: String
    public let who: String
    public let season: String
    public let body: String
    public let left: EventOption
    public let right: EventOption
    public let allowsLuozi: Bool
    /* 落字选项的四维增减（allowsLuozi 为 false 时不用）。 */
    public let luozi: EventOption

    public init(
        id: String,
        who: String,
        season: String,
        body: String,
        left: EventOption,
        right: EventOption,
        allowsLuozi: Bool,
        luozi: EventOption
    ) {
        this.id = id
        this.who = who
        this.season = season
        this.body = body
        this.left = left
        this.right = right
        this.allowsLuozi = allowsLuozi
        this.luozi = luozi
    }

    /* 卡面右上角「季节 · 序号」（牌堆大小由调用方给，省得每次都重建牌堆）。 */
    public func seasonLabel(index: Int64, total: Int64): String {
        return "${this.season} · ${index + 1} / ${total}"
    }

    /* 某个 side 的选项；落字那张不在 → None（调用方按不能选处理）。 */
    public func optionOf(side: Int64): Option<EventOption> {
        if (side == RUN_SIDE_LEFT) { return Some(this.left) }
        if (side == RUN_SIDE_RIGHT) { return Some(this.right) }
        if (side == RUN_SIDE_LUOZI && this.allowsLuozi) { return Some(this.luozi) }
        return Option<EventOption>.None
    }
}

/* 牌堆（SPEC：占位牌堆约 10 张）。人物胶囊只写身份（族老 / 巫 / 猎户…），
   不起人名（SPEC §4 待确认 6：一律「第 N 代记事人」那条同样适用于此）。 */
public func eventCardPool(): Array<EventCard> {
    let out = ArrayList<EventCard>()
    out.add(EventCard(
        "he_di", "族老", "春",
        "河边的地软了。先种粟，还是先给水神献祭？",
        EventOption("先种粟", [10, -4, 0, 0]),
        EventOption("先献祭", [-4, 8, 0, 0]),
        true,
        EventOption("落「水」· 两处都顾", [6, 6, 0, 0])
    ))
    out.add(EventCard(
        "lie_hu", "猎户", "秋",
        "北岭的鹿群过了界，猎户想问要不要追。",
        EventOption("追下去", [-6, 0, 0, 8]),
        EventOption("让它们走", [-2, 0, 4, 0]),
        false,
        EventOption("", [0, 0, 0, 0])
    ))
    out.add(EventCard(
        "wu_gu", "巫", "冬",
        "骨片上的纹裂了。巫说要再刻一道，问族人肯不肯。",
        EventOption("肯", [-3, 8, 4, 0]),
        EventOption("不肯", [-2, -6, 0, 0]),
        true,
        EventOption("落「禾」· 补这一刀", [0, 6, 6, 0])
    ))
    out.add(EventCard(
        "dong_an", "东岸的人", "夏",
        "东岸的人追鹿追过了河，站在界桩边上不肯走。",
        EventOption("请他们过河", [-8, 0, 0, 6]),
        EventOption("守住界桩", [-4, 0, 0, -6]),
        false,
        EventOption("", [0, 0, 0, 0])
    ))
    out.add(EventCard(
        "hai_zi", "采粟的人", "秋",
        "粟米见底了，有人提议把种子也煮了。",
        EventOption("煮了", [4, -8, -2, 0]),
        EventOption("留着", [-6, 4, 2, 0]),
        true,
        EventOption("落「日」· 记下这一天", [2, 2, 2, 0])
    ))
    out.add(EventCard(
        "wai_zu", "外族孩子", "夏",
        "采集的人在半路碰见一个外族孩子，满身是伤。",
        EventOption("留下他", [-6, 6, 4, 0]),
        EventOption("送走他", [-2, 0, -4, 4]),
        true,
        EventOption("落「休」· 让他靠一会儿", [0, 6, 4, 0])
    ))
    out.add(EventCard(
        "he_shang", "河上的人", "春",
        "有人撑船来换粟，说要拿外面的字换。",
        EventOption("换", [8, -2, 6, 0]),
        EventOption("不换", [-4, 2, 0, 4]),
        true,
        EventOption("落「从」· 记下来路", [4, 0, 6, 0])
    ))
    out.add(EventCard(
        "ji_shi", "记事人", "冬",
        "去年的骨片受了潮，有的纹看不清了。",
        EventOption("重刻", [0, -2, 8, 0]),
        EventOption("随它去", [-2, 0, -6, 0]),
        true,
        EventOption("落「本」· 补上根笔", [0, 2, 6, 0])
    ))
    out.add(EventCard(
        "qiu_shou", "老猎人", "秋",
        "秋天的收成看着厚，有人想多开一片河滩地。",
        EventOption("开", [12, -4, 0, -6]),
        EventOption("不开", [-4, 4, 2, 0]),
        false,
        EventOption("", [0, 0, 0, 0])
    ))
    out.add(EventCard(
        "xue_ye", "孩子", "冬",
        "孩子在火堆边问：这些话是谁教我们记下的？",
        EventOption("说是族老", [0, 6, 8, 0]),
        EventOption("说是骨头自己", [-2, -4, 4, 0]),
        true,
        EventOption("落「木」· 指给他看", [0, 4, 6, 0])
    ))
    return out.toArray()
}

/* 牌堆大小。 */
public func eventCardCount(): Int64 {
    return eventCardPool().size
}

/* 第 i 张卡（越界按取末张处理，界面不判空）。 */
public func eventCardAt(i: Int64): EventCard {
    let pool = eventCardPool()
    if (pool.size == 0) { return pool[0] }
    if (i < 0) { return pool[0] }
    if (i >= pool.size) { return pool[pool.size - 1] }
    return pool[i]
}

/* 下一张：牌堆循环（确定性，读档回到同一张）。 */
public func eventCardNext(i: Int64): Int64 {
    let n = eventCardCount()
    if (n <= 0) { return 0 }
    let at = (i + 1) % n
    if (at < 0) { return 0 }
    return at
}

/* 这一维的增减折算成圆点档位：0 → 不画点；|d| ≤5 小点 5；≤10 中点 8；
   再大 大点 12。只表分量，不表涨跌（SPEC §2.9）。 */
public func weightTier(delta: Int64): Int64 {
    let d = if (delta < 0) { -delta } else { delta }
    if (d == 0) { return RUN_WEIGHT_NONE }
    if (d <= RUN_WEIGHT_SMALL) { return RUN_WEIGHT_SMALL }
    if (d <= RUN_WEIGHT_MID_MAX) { return RUN_WEIGHT_MID }
    return RUN_WEIGHT_LARGE
}

/* 一个选项的四维圆点档位（长度 = deltas 长度）。 */
public func weightTiersOf(deltas: Array<Int64>): Array<Int64> {
    let out = ArrayList<Int64>()
    var i: Int64 = 0
    while (i < deltas.size) {
        out.add(weightTier(deltas[i]))
        i = i + 1
    }
    return out.toArray()
}

/* 一个选项某一维的圆点档位。 */
public func weightTierOf(opt: EventOption, i: Int64): Int64 {
    return weightTier(opt.deltaAt(i))
}
