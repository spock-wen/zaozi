package ohos_app_cangjie_entry

import kit.ArkUI.*
import ohos.arkui.state_macro_manage.*
import std.collection.ArrayList

/* 事件卡（SPEC §2.3 / §2.9；设计稿 home_slide_v1 A/B/C、states_v1 ①）。
   拆成多个小 @Component，每个 build() 只摆一层：
     CardArt        立绘区 184：人物胶囊（左上）+ 季节 · 序号（右上）+ 立绘占位
     CardBody       卡文 Serif 16 / 行高 26，内边距 18
     CardOptBar     卡顶 64 高选项条（拖过阈值时露出来）
     CardLuoziBar   卡底 48 高落字条（字匣选中可落的字 → 朱底，再点一次确认）
     WeightDotRow   按住看分量的一排圆点（上排 = 左选项，下排 = 右选项）
     HomeWeightDots 两排圆点，由主界面排在四维条上方
     EventCardView  这一张卡本身：下一张垫在后面 + 拖动 / 按住 / 点选退路

   版式上按 SPEC 写了、但 ArkUI-Cangjie 这一版没做的三处（都留了说明，
   不影响交互，等 SDK 侧确认后再补）：
     1) 卡片阴影 0 12 28 rgba(0,0,0,.4) —— 本仓库的 ArkUI 调用只用过已验证的
        那一档属性（见 ui_common.cj 顶部说明），shadow 没验过，先用 1 描边顶；
     2) 拖卡倾斜 ±5° 与下一张缩到 96% —— SPEC §4 待确认 2 自己留了「去掉倾斜、
        只留位移」的退路，这里只做位移 + 55% 透明度；
     3) 数值 / 条宽变化 320ms 缓动 —— .animation 同理留到验过之后再开。
   手势走 .onTouch（这一版仓颉 ArkUI 没有 PanGesture / LongPressGesture /
   GestureGroup 那一档，编译期直接报 undeclared type name）：Down 记起点，
   Move 拿位移算拖动、够 300ms 就算长按，Up / Cancel 收尾，都在本文件的
   onTouch* 几个函数里。点选退路（左右两条常显按钮）另有一条，不依赖手势。
   R2（e4c8def 烟测 FAIL：拖动完全没响应、卡片也不位移）之后：
     · onTouch 挂在外层那个不位移的容器上，.offset 只加在里面的卡片上
       （卡片一移，触摸点的局部坐标跟着偏，dx 就算错了）；
     · 横坐标优先取 touches[0]（设备上验过的那一个），changedTouches 只兜底；
     · Up / Cancel 不读坐标，按最后一次 Move 的 dx 收尾（Up 不一定带坐标）；
     · 位移 / 侧别 / 阈值的决策抽成 home_mirror.cj 的纯函数（box_check 断言）。
   R1 / R3 之后 props 只剩原始值：牌面按 cardIndex 现算，落字条按字匣原始值
   在 CardLuoziBar 里现算。 */

/* 立绘区 184 高（SPEC §4 待确认 5：立绘风格另定，本版是骨色占位）。
   cardIndex 是原始值（R1：函数调用结果不当 @Prop 传），人物胶囊与
   「季节 · 序号」都在本组件里按牌堆现算。 */
@Component
public class CardArt {
    @Prop var cardIndex: Int64

    func who(): String {
        return eventCardAt(this.cardIndex).who
    }

    func season(): String {
        return eventCardAt(this.cardIndex).seasonLabel(this.cardIndex, eventCardCount())
    }

    func build() {
        Stack {
            /* 骨色底（设计稿是径向渐变，占位版用 bone-200 平铺）。 */
            Text("")
                .width(100.percent)
                .height(100.percent)
                .backgroundColor(Theme.bone200)

            /* 人物胶囊 24 高（左上）。 */
            Text(this.who())
                .height(Theme.whoCapsuleH)
                .padding(left: 10, right: 10)
                .borderRadius(12)
                .backgroundColor(Theme.paper50)
                .border(width: 1, color: Theme.paperLine)
                .fontSize(Theme.whoFs)
                .fontFamily(Theme.sans)
                .fontWeight(FontWeight.Bold)
                .fontColor(Theme.ink900)
                .textAlign(TextAlign.Center)
                .align(Alignment.TopStart)
                .margin(left: 12, top: 12)

            /* 季节 · 序号 11（右上）。 */
            Text(this.season())
                .fontSize(Theme.seasonFs)
                .fontFamily(Theme.sans)
                .fontColor(Theme.ink600)
                .align(Alignment.TopEnd)
                .margin(right: 12, top: 12)

            /* 立绘占位说明（右下角，跟设计稿一致）。 */
            Text(HOME_ART_PLACEHOLDER)
                .fontSize(Theme.fsEra)
                .fontFamily(Theme.sans)
                .fontColor(Theme.ink400)
                .align(Alignment.BottomEnd)
                .margin(right: 12, bottom: 10)
        }
        .width(100.percent)
        .height(Theme.cardArtH)
    }
}

/* 卡文：Serif 16 / 行高 26，内边距 18（SPEC §2.3）。牌堆每张 ≤40 字，
   正常三行内放得下；maxLines 只是兜底，不让长文案把卡撑爆。
   cardIndex 是原始值，卡文在本组件里按牌堆现算。 */
@Component
public class CardBody {
    @Prop var cardIndex: Int64

    func bodyText(): String {
        return eventCardAt(this.cardIndex).body
    }

    func build() {
        Text(this.bodyText())
            .width(100.percent)
            .fontSize(Theme.cardBodyFs)
            .fontFamily(Theme.serif)
            .fontColor(Theme.ink900)
            .lineHeight(Theme.cardBodyLh)
            .maxLines(5)
            .padding(left: Theme.cardBodyPad, right: Theme.cardBodyPad, top: Theme.cardBodyPad)
    }
}

/* 卡顶选项条 64 高（拖过阈值后露出这一侧的选项；night-900 86%，Serif 16 Bold）。
   cardIndex + dragX 是原始值（R1），文案与靠哪一头都在本组件里现算：
   往右拖 → 右边的选项，靠右对齐。 */
@Component
public class CardOptBar {
    @Prop var cardIndex: Int64
    @Prop var dragX: Float64

    /* 拖到哪一侧（纯逻辑在 home_mirror.cj 的 dragSideOf）。 */
    func side(): Int64 {
        return dragSideOf(this.dragX)
    }

    func label(): String {
        let card = eventCardAt(this.cardIndex)
        if (this.side() == RUN_SIDE_LEFT) { return card.left.label }
        return card.right.label
    }

    func build() {
        Text(this.label())
            .width(100.percent)
            .height(Theme.optBarH)
            .backgroundColor(Theme.optBarNight)
            .fontSize(Theme.cardBodyFs)
            .fontFamily(Theme.serif)
            .fontWeight(FontWeight.Bold)
            .fontColor(Theme.onNight)
            .padding(left: 30, right: 30)
            .textAlign(if (this.side() == RUN_SIDE_LEFT) { TextAlign.Start } else { TextAlign.End })
    }
}

/* 卡底落字条 48 高、圆角 12（SPEC §2.3 第三选项：朱底白字 Serif 15 Bold，
   再点一次确认落字）。
   R3（e4c8def 烟测 FAIL：字匣选中可落的字，落字条还是灰态）：传进来的全是
   原始值（cardIndex / 字匣三格 / landed 掩码 / selectedSlot / 武装态），
   「能不能点、文案写什么」都在本组件里按 home_mirror.cj 的 luoziBarStateOf
   现算 —— 不用函数调用结果当 @Prop 传（那样不参与重绘跟踪）。 */
@Component
public class CardLuoziBar {
    /* 当前这一张卡（许不许落字按它算）。 */
    @Prop var cardIndex: Int64
    /* 字匣三格的字 id + 有几格有字 + 哪些格本代已落（位掩码）。 */
    @Prop var box0: String
    @Prop var box1: String
    @Prop var box2: String
    @Prop var boxCount: Int64
    @Prop var landedMask: Int64
    /* 字匣选中态（-1 = 没有选中）。 */
    @Prop var selectedSlot: Int64
    /* 「准备落」记在哪个格子、哪张卡上（界面态，换了选中 / 换了卡就不算）。 */
    @Prop var armedSlot: Int64
    @Prop var armedCard: Int64
    @Prop var onTap: () -> Unit

    /* 原始值 → HomeMirror（纯逻辑在 home_mirror.cj，box_check 有断言）。 */
    func mirror(): HomeMirror {
        let m = HomeMirror()
        m.boxCount = this.boxCount
        m.box0 = this.box0
        m.box1 = this.box1
        m.box2 = this.box2
        m.landedMask = this.landedMask
        return m
    }

    /* 这一张卡许不许落字。 */
    func allowsLuozi(): Bool {
        return eventCardAt(this.cardIndex).allowsLuozi
    }

    /* 落字条状态：LUOZI_BAR_NEED / READY / ARMED。 */
    func state(): Int64 {
        return luoziBarStateOf(this.mirror(), this.allowsLuozi(), this.selectedSlot,
            this.armedSlot, this.armedCard, this.cardIndex)
    }

    func enabled(): Bool {
        return luoziBarEnabled(this.state())
    }

    /* 选中格里的字形（落「X」字用）。 */
    func selectedGlyph(): String {
        return ziluGlyphOf(homeMirrorBoxId(this.mirror(), this.selectedSlot))
    }

    func label(): String {
        return luoziBarLabelOf(this.state(), this.selectedGlyph())
    }

    func build() {
        Text(this.label())
            .width(100.percent)
            .height(Theme.luoziBarH)
            .borderRadius(12)
            .backgroundColor(if (this.enabled()) { Theme.zhu600 } else { Theme.paper200 })
            .fontSize(Theme.fsButton)
            .fontFamily(Theme.serif)
            .fontWeight(FontWeight.Bold)
            .fontColor(if (this.enabled()) { Theme.white } else { Theme.ink400 })
            .textAlign(TextAlign.Center)
            .enabled(this.enabled())
            .onClick({event =>
                if (this.enabled()) {
                    this.onTap()
                }
            })
    }
}

/* 按住看分量的一排圆点：四列对齐四维条，圆点大小 5 / 8 / 12 三档，
   没有增减的那一维不画点；只表分量大小，不表涨跌（SPEC §2.9）。
   side 是左边那两个字（「左」/「右」），金色 10 Bold。
   cardIndex + sideCode 是原始值（R1：数组 / 函数调用结果不当 @Prop 传），
   增减在成员函数里按牌堆现算。 */
@Component
public class WeightDotRow {
    @Prop var cardIndex: Int64
    /* RUN_SIDE_LEFT / RUN_SIDE_RIGHT：这一排看哪一边。 */
    @Prop var sideCode: Int64
    @Prop var side: String

    /* 这一排的四维增减。 */
    func deltas(): Array<Int64> {
        let card = eventCardAt(this.cardIndex)
        if (this.sideCode == RUN_SIDE_LEFT) { return card.left.deltas }
        return card.right.deltas
    }

    /* 第 i 维的圆点档位（0 = 不画）。 */
    func tierAt(i: Int64): Int64 {
        let d = this.deltas()
        if (i < 0 || i >= d.size) { return RUN_WEIGHT_NONE }
        return weightTier(d[i])
    }

    /* 四维的下标（0/1/2/3）。ArrayList 是为了跟仓库里其它 ForEach 调用一致。 */
    func indexes(): ArrayList<Int64> {
        let out = ArrayList<Int64>()
        out.add(0)
        out.add(1)
        out.add(2)
        out.add(3)
        return out
    }

    func build() {
        Row(space: 8) {
            Text(this.side)
                .fontSize(Theme.fsEra)
                .fontFamily(Theme.sans)
                .fontWeight(FontWeight.Bold)
                .fontColor(Theme.gold400)
                .width(20)
            ForEach(this.indexes(), itemGeneratorFunc: {i: Int64, at: Int64 =>
                Column {
                    if (this.tierAt(i) > RUN_WEIGHT_NONE) {
                        Text("")
                            .width(this.tierAt(i))
                            .height(this.tierAt(i))
                            .borderRadius(this.tierAt(i) / 2)
                            .backgroundColor(Theme.gold400)
                    }
                }
                .layoutWeight(1)
                .height(Theme.dotLarge)
            })
        }
        .width(100.percent)
        .height(14)
        .padding(left: Theme.insetNight, right: Theme.insetNight)
    }
}

/* 两排圆点：上排左选项、下排右选项（states_v1 ①）。
   cardIndex 是原始值，两边增减在 WeightDotRow 里按牌堆现算。 */
@Component
public class HomeWeightDots {
    @Prop var cardIndex: Int64

    func build() {
        Column(space: 4) {
            WeightDotRow(cardIndex: this.cardIndex, sideCode: RUN_SIDE_LEFT, side: HOME_HOLD_LEFT)
            WeightDotRow(cardIndex: this.cardIndex, sideCode: RUN_SIDE_RIGHT, side: HOME_HOLD_RIGHT)
        }
        .width(100.percent)
    }
}

/* 这一张卡。R1 之后 props 只剩原始值：牌面字段（人物 / 季节 · 序号 / 卡文 /
   左右选项文案与增减 / 许不许落字）全部由 cardIndex 一个下标在本组件自己的
   成员函数里从牌堆现算 —— class 字段（this.run.*）与函数调用结果当 @Prop
   传都不参与重绘跟踪，那就是主界选卡后不刷新的根因。
     dragX   拖动位移（vp，未钳；钳过的位移见 shiftX）
     held    按住看分量中（松手 / 下一次拖动 / 取消 → 收起圆点）
   交互三条路：
     拖动   过 ±60vp → 松手即选这一侧；没过 → 弹回中间（SPEC §2.3 阈值）
     按住   300ms → 卡缩 98% + 金色外圈 + 四维条上方两排圆点（本版没做缩放，
             见文件头说明 2，只做外圈与圆点）
     点选   左右两条常显按钮由主界面给（HomeOptBtns），点一下即选 */
@Component
public class EventCardView {
    /* 当前这一张卡（牌堆循环，读档回到同一张）。 */
    @Prop var cardIndex: Int64
    /* 字匣三格的字 id + 有几格有字 + 哪些格本代已落（位掩码）+ 选中态。 */
    @Prop var box0: String
    @Prop var box1: String
    @Prop var box2: String
    @Prop var boxCount: Int64
    @Prop var landedMask: Int64
    @Prop var selectedSlot: Int64
    /* 「准备落」记在哪个格子、哪张卡上（界面态；落字条按它出武装文案）。 */
    @Prop var armedSlot: Int64
    @Prop var armedCard: Int64
    /* 点落字条：第一次按下只是「准备落」，再点一次才真的落（主界面记 armed）。 */
    @Prop var onLuozi: () -> Unit
    /* 按住状态回传：圆点排在主界面四维条上方，那一层才是它的父组件。 */
    @Prop var onHoldChange: (Bool) -> Unit
    @Prop var onPick: (Int64) -> Unit

    @State var dragX: Float64 = 0.0
    @State var held: Bool = false

    /* —— onTouch 的记账字段（不是界面状态，只是这一串触摸的中间量）——
       touchStartX  Down 时的横坐标，Move 里 dx = 当前 - 它
       touchStartTs Down 时的时间戳，用来判 300ms 长按
       touchLastDx  最后一次 Move 算出来的位移（Up 不一定带坐标，松手按它算）
       touchDrag    位移已经超过 8vp（拖起来就不再算长按）
       touchHold    长按已经亮过（一次按压只亮一次） */
    @State var touchStartX: Float64 = 0.0
    @State var touchStartTs: Int64 = 0
    @State var touchLastDx: Float64 = 0.0
    @State var touchDrag: Bool = false
    @State var touchHold: Bool = false

    /* —— 牌面字段：都由 cardIndex 现算（成员函数里算，不当 @Prop 传）—— */
    func card(): EventCard {
        return eventCardAt(this.cardIndex)
    }

    func allowsLuozi(): Bool {
        return this.card().allowsLuozi
    }

    /* 过没过拖拽阈值（±60vp）。 */
    func pastThreshold(): Bool {
        return dragPastThreshold(this.dragX, Theme.swipeThreshold)
    }

    /* 位移钳到 ±14（SPEC §2.3；倾斜见文件头说明 2）。 */
    func shiftX(): Int64 {
        return dragClampShift(this.dragX, Theme.swipeShift)
    }

    /* 按住时的外圈：gold-400 2 + rgba(216,180,106,.18) 8（SPEC §2.9）。 */
    func holdBorderColor(): Int64 {
        if (this.held) { return Theme.gold400 }
        return Theme.paperLine
    }

    func holdBorderWidth(): Int64 {
        if (this.held) { return 2 }
        return 1
    }

    /* —— 手势回调 —— */
    func dragStart(): Unit {
        this.held = false
        this.onHoldChange(false)
        this.dragX = 0.0
    }

    func dragMove(x: Float64): Unit {
        this.dragX = x
    }

    /* 松手：位移按最后一次 Move 的 dx 算（Up / Cancel 不一定带坐标）。
       过阈值 → 选这一侧；没过 → 弹回中间（dragX 归零）。 */
    func dragEnd(dx: Float64): Unit {
        let past = dragPastThreshold(dx, Theme.swipeThreshold)
        let side = dragSideOf(dx)
        this.dragX = 0.0
        this.held = false
        this.onHoldChange(false)
        if (past) {
            this.onPick(side)
        }
    }

    func holdOn(): Unit {
        this.held = true
        this.onHoldChange(true)
    }

    func holdOff(): Unit {
        this.held = false
        this.onHoldChange(false)
    }

    /* —— onTouch 回调（见文件头：这一版没有手势 API，拖动 / 长按都手算）——
       按下到抬起之间一次按压算一串事件，中途 Cancel 也算抬起。
       R2（e4c8def 烟测 FAIL：拖动完全没响应）：
         · onTouch 挂在外层那个不位移的容器上，offset 只加在里面的卡片上 ——
           不然卡片一移，触摸点的局部坐标跟着偏，dx 就算错了；
         · 横坐标优先取 touches[0]（设备上验过的那一个），changedTouches 只作兜底；
         · Up / Cancel 不读坐标，按最后一次 Move 的 dx 收尾。 */

    /* 这一次事件的触点：touches 优先，空了才看 changedTouches。 */
    func onTouchEvent(e: TouchEvent): Unit {
        if (e.touches.size > 0) {
            this.onTouchAt(e.touches[0], e)
            return
        }
        if (e.changedTouches.size > 0) {
            this.onTouchAt(e.changedTouches[0], e)
        }
    }

    func onTouchAt(t: TouchObject, e: TouchEvent): Unit {
        match (e.eventType) {
            case TouchType.Down => this.onTouchDown(t.screenX, e.timestamp)
            case TouchType.Move => this.onTouchMove(t.screenX, e.timestamp)
            case TouchType.Up => this.onTouchUp()
            case TouchType.Cancel => this.onTouchUp()
            case _ => ()
        }
    }

    /* 按满 300ms 才算长按。时间戳按 ms 比；万一某机型给的是 ns（差 6 个数量级），
       折回来再比，反正只跟 300 比大小。长按只是加分项：判不出来也照样能拖。 */
    func heldMs(now: Int64): Int64 {
        let d = now - this.touchStartTs
        if (d <= 0) { return 0 }
        if (d > 100000) { return d / 1000000 }
        return d
    }

    func onTouchDown(x: Float64, ts: Int64): Unit {
        this.touchStartX = x
        this.touchStartTs = ts
        this.touchLastDx = 0.0
        this.touchDrag = false
        this.touchHold = false
        this.dragStart()
    }

    func onTouchMove(x: Float64, ts: Int64): Unit {
        let dx = x - this.touchStartX
        this.touchLastDx = dx
        if (dx > 8.0 || dx < -8.0) { this.touchDrag = true }
        this.dragMove(dx)
        /* 位移小、按住够久 → 亮一次（亮过就不重复亮）。 */
        if (!this.touchHold && !this.touchDrag && this.heldMs(ts) >= 300) {
            this.touchHold = true
            this.holdOn()
        }
    }

    func onTouchUp(): Unit {
        if (this.touchHold) { this.holdOff() }
        this.dragEnd(this.touchLastDx)
    }

    func build() {
        /* 外层容器：不位移，onTouch 挂在它上面（R2：位移会让局部坐标跑偏）。
           里面那个 Stack 才是会跟着手指移动的卡片。 */
        Stack {
            /* 下一张垫在后面：55% 透明度（96% 缩放见文件头说明 2）。 */
            Text("")
                .width(Theme.cardW)
                .height(Theme.cardH)
                .borderRadius(Theme.cardRadius)
                .backgroundColor(Theme.paper50)
                .border(width: 1, color: Theme.paperLine)
                .opacity(Theme.cardUnderOpacity)
                .margin(top: 8)

            /* 这一张。 */
            Stack {
                Column {
                    CardArt(cardIndex: this.cardIndex)
                    CardBody(cardIndex: this.cardIndex)
                    Blank()
                    if (this.allowsLuozi()) {
                        /* 自建组件不能挂链式属性（@Component 宏不认），套一层
                           Column 把 margin 放容器上（同 ui_card.cj 的 GhostButton）。 */
                        Column {
                            CardLuoziBar(
                                cardIndex: this.cardIndex,
                                box0: this.box0,
                                box1: this.box1,
                                box2: this.box2,
                                boxCount: this.boxCount,
                                landedMask: this.landedMask,
                                selectedSlot: this.selectedSlot,
                                armedSlot: this.armedSlot,
                                armedCard: this.armedCard,
                                onTap: { => this.onLuozi() }
                            )
                        }
                        /* 容器也要给宽度：Column 默认 alignItems 是 Center，
                           不写 100% 会缩成内容宽，里面 100% 就没有基准了。 */
                        .width(100.percent)
                        .margin(left: 12, right: 12, bottom: 12)
                    }
                }
                .width(100.percent)
                .height(100.percent)

                /* 拖过阈值：卡顶露出这一侧的选项条。 */
                if (this.pastThreshold()) {
                    Column {
                        CardOptBar(cardIndex: this.cardIndex, dragX: this.dragX)
                    }
                    .width(100.percent)
                    .align(Alignment.Top)
                }
            }
            .width(Theme.cardW)
            .height(Theme.cardH)
            .borderRadius(Theme.cardRadius)
            .backgroundColor(Theme.paper50)
            .border(width: this.holdBorderWidth(), color: this.holdBorderColor())
            /* 位移只加在这一层里面：外层容器不动，触摸坐标才稳（R2）。 */
            .offset(x: this.shiftX(), y: 0)
        }
        .width(Theme.cardW)
        .height(Theme.cardH)
        .onTouch({e: TouchEvent => this.onTouchEvent(e)})
    }
}
