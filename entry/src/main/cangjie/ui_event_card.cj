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
   onTouch* 几个函数里。点选退路（左右两条常显按钮）另有一条，不依赖手势。 */

/* 立绘区 184 高（SPEC §4 待确认 5：立绘风格另定，本版是骨色占位）。 */
@Component
public class CardArt {
    @Prop var who: String
    @Prop var season: String

    func build() {
        Stack {
            /* 骨色底（设计稿是径向渐变，占位版用 bone-200 平铺）。 */
            Text("")
                .width(100.percent)
                .height(100.percent)
                .backgroundColor(Theme.bone200)

            /* 人物胶囊 24 高（左上）。 */
            Text(this.who)
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
            Text(this.season)
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
   正常三行内放得下；maxLines 只是兜底，不让长文案把卡撑爆。 */
@Component
public class CardBody {
    @Prop var text: String

    func build() {
        Text(this.text)
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
   side 决定文案靠哪一头（往右拖 → 右边的选项，靠右对齐）。 */
@Component
public class CardOptBar {
    @Prop var label: String
    @Prop var side: Int64

    func build() {
        Text(this.label)
            .width(100.percent)
            .height(Theme.optBarH)
            .backgroundColor(Theme.optBarNight)
            .fontSize(Theme.cardBodyFs)
            .fontFamily(Theme.serif)
            .fontWeight(FontWeight.Bold)
            .fontColor(Theme.onNight)
            .padding(left: 30, right: 30)
            .textAlign(if (this.side == RUN_SIDE_LEFT) { TextAlign.Start } else { TextAlign.End })
    }
}

/* 卡底落字条 48 高、圆角 12（SPEC §2.3 第三选项：朱底白字 Serif 15 Bold，
   再点一次确认落字）。字匣里选中一个可落的字才有朱底那一版（enabled）；
   卡允许落字但没选字 → 灰态「先在字匣选一个字」，点了不动。 */
@Component
public class CardLuoziBar {
    @Prop var label: String
    @Prop var enabled: Bool
    @Prop var onTap: () -> Unit

    func build() {
        Text(this.label)
            .width(100.percent)
            .height(Theme.luoziBarH)
            .borderRadius(12)
            .backgroundColor(if (this.enabled) { Theme.zhu600 } else { Theme.paper200 })
            .fontSize(Theme.fsButton)
            .fontFamily(Theme.serif)
            .fontWeight(FontWeight.Bold)
            .fontColor(if (this.enabled) { Theme.white } else { Theme.ink400 })
            .textAlign(TextAlign.Center)
            .enabled(this.enabled)
            .onClick({event =>
                if (this.enabled) {
                    this.onTap()
                }
            })
    }
}

/* 按住看分量的一排圆点：四列对齐四维条，圆点大小 5 / 8 / 12 三档，
   没有增减的那一维不画点；只表分量大小，不表涨跌（SPEC §2.9）。
   side 是左边那两个字（「左」/「右」），金色 10 Bold。 */
@Component
public class WeightDotRow {
    @Prop var deltas: Array<Int64>
    @Prop var side: String

    /* 第 i 维的圆点档位（0 = 不画）。 */
    func tierAt(i: Int64): Int64 {
        if (i < 0 || i >= this.deltas.size) { return RUN_WEIGHT_NONE }
        return weightTier(this.deltas[i])
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
   deltas 是原始数组（函数调用当 @Prop 传进来不参与重绘跟踪）。 */
@Component
public class HomeWeightDots {
    @Prop var leftDeltas: Array<Int64>
    @Prop var rightDeltas: Array<Int64>

    func build() {
        Column(space: 4) {
            WeightDotRow(deltas: this.leftDeltas, side: HOME_HOLD_LEFT)
            WeightDotRow(deltas: this.rightDeltas, side: HOME_HOLD_RIGHT)
        }
        .width(100.percent)
    }
}

/* 这一张卡。props 全是简单类型（仓颉 @Prop 对 class 实例只认引用，
   牌面字段拆开传，父组件从 RunState / 牌堆现算）。
     dragX   拖动位移（vp，未钳；钳过的位移见 shiftX）
     held    按住看分量中（松手 / 下一次拖动 / 取消 → 收起圆点）
   交互三条路：
     拖动   过 ±60vp → 松手即选这一侧；没过 → 弹回中间（SPEC §2.3 阈值）
     按住   300ms → 卡缩 98% + 金色外圈 + 四维条上方两排圆点（本版没做缩放，
             见文件头说明 2，只做外圈与圆点）
     点选   左右两条常显按钮由主界面给（HomeOptBtns），点一下即选 */
@Component
public class EventCardView {
    @Prop var who: String
    @Prop var season: String
    @Prop var body: String
    @Prop var leftLabel: String
    @Prop var rightLabel: String
    @Prop var leftDeltas: Array<Int64>
    @Prop var rightDeltas: Array<Int64>
    @Prop var allowsLuozi: Bool
    @Prop var luoziEnabled: Bool
    /* 落字条上的文案（选中了哪个字 / 还没选），由主界面按字匣状态现算。 */
    @Prop var luoziLabel: String
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
       touchDrag    位移已经超过 8vp（拖起来就不再算长按）
       touchHold    长按已经亮过（一次按压只亮一次） */
    @State var touchStartX: Float64 = 0.0
    @State var touchStartTs: Int64 = 0
    @State var touchDrag: Bool = false
    @State var touchHold: Bool = false

    /* 往右拖 = 选右边，往左拖 = 选左边。 */
    func sideOf(x: Float64): Int64 {
        if (x >= 0.0) { return RUN_SIDE_RIGHT }
        return RUN_SIDE_LEFT
    }

    /* 过没过拖拽阈值（±60vp）。 */
    func pastThreshold(): Bool {
        let t = Float64(Theme.swipeThreshold)
        if (this.dragX >= t) { return true }
        if (this.dragX <= -t) { return true }
        return false
    }

    /* 位移钳到 ±14（SPEC §2.3；倾斜见文件头说明 2）。 */
    func shiftX(): Int64 {
        let cap = Float64(Theme.swipeShift)
        if (this.dragX > cap) { return Theme.swipeShift }
        if (this.dragX < -cap) { return -Theme.swipeShift }
        return Int64(this.dragX)
    }

    /* 卡顶选项条上的文案（拖到哪一侧就露哪一条）。 */
    func optLabel(side: Int64): String {
        if (side == RUN_SIDE_LEFT) { return this.leftLabel }
        return this.rightLabel
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

    func dragEnd(): Unit {
        let past = this.pastThreshold()
        let side = this.sideOf(this.dragX)
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
       按下到抬起之间一次按压算一串事件，中途 Cancel 也算抬起。 */

    /* 触点数组兜底：Cancel 有时不带触点，取不到就当这一下没发生过。 */
    func onTouchEvent(e: TouchEvent): Unit {
        if (e.changedTouches.size > 0) {
            this.onTouchAt(e.changedTouches[0], e)
            return
        }
        if (e.touches.size > 0) {
            this.onTouchAt(e.touches[0], e)
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
       折回来再比，反正只跟 300 比大小。 */
    func heldMs(now: Int64): Int64 {
        let d = now - this.touchStartTs
        if (d <= 0) { return 0 }
        if (d > 100000) { return d / 1000000 }
        return d
    }

    func onTouchDown(x: Float64, ts: Int64): Unit {
        this.touchStartX = x
        this.touchStartTs = ts
        this.touchDrag = false
        this.touchHold = false
        this.dragStart()
    }

    func onTouchMove(x: Float64, ts: Int64): Unit {
        let dx = x - this.touchStartX
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
        this.dragEnd()
    }

    func build() {
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
                    CardArt(who: this.who, season: this.season)
                    CardBody(text: this.body)
                    Blank()
                    if (this.allowsLuozi) {
                        /* 自建组件不能挂链式属性（@Component 宏不认），套一层
                           Column 把 margin 放容器上（同 ui_card.cj 的 GhostButton）。 */
                        Column {
                            CardLuoziBar(
                                label: this.luoziLabel,
                                enabled: this.luoziEnabled,
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
                        CardOptBar(label: this.optLabel(this.sideOf(this.dragX)), side: this.sideOf(this.dragX))
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
            .offset(x: this.shiftX(), y: 0)
            .onTouch({e: TouchEvent => this.onTouchEvent(e)})
        }
        .width(Theme.cardW)
        .height(Theme.cardH)
    }
}
