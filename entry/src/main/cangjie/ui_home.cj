package ohos_app_cangjie_entry

import kit.ArkUI.*
import ohos.arkui.state_macro_manage.*

/* 主界（home_slide_v1）。M2 slice 1 铺了版式（代次/年 + 字匣三格 + 二级界面入口），
   slice 2 把 SPEC §2.1 四维条、§2.2 骨片行、§2.3 事件卡（拖动 / 按住看分量 /
   点选退路 / 落字灰态）填了进来；slice 3 接上字匣（§2.4 五种格子状态 + 详情弹层）
   与落字第三选项；slice 4 接上触底闪朱、结局卡与代末结算（ui_ending.cj /
   ui_settle.cj，路由在 index.cj）。四维条在 ui_hud.cj、骨片行在 ui_bones.cj、
   事件卡在 ui_event_card.cj、字匣在 ui_box.cj / ui_box_sheet.cj，
   本文件只管这一层的版式。
   同样拆成小 @Component（@Component 宏展开撑不住大 build()）。 */

/* 顶行：左「第 N 代 · 第 Y 年」，右「第 N 代记事人」（设计稿 .stat）。
   代次 / 年是原始字段，文案在子组件里拼。 */
@Component
public class HomeStatLine {
    @Prop var generation: Int64
    @Prop var year: Int64

    func genLine(): String {
        return HOME_GEN_LINE.replace("N", "${this.generation}").replace("Y", "${this.year}")
    }

    func recorder(): String {
        return HOME_RECORDER.replace("N", "${this.generation}")
    }

    func build() {
        Row {
            Text(this.genLine)
                .fontSize(Theme.fsStatus)
                .fontFamily(Theme.sans)
                .fontColor(Theme.onNight)
                .layoutWeight(1)
            Text(this.recorder)
                .fontSize(Theme.fsStatus)
                .fontFamily(Theme.sans)
                .fontColor(Theme.onNight2)
        }
        .width(100.percent)
        .height(44)
        .border(width: 1, color: Theme.nightLine)
        .padding(left: Theme.insetNight, right: Theme.insetNight)
    }
}

/* 二级界面入口：字录 / 演变条 / 造字卡（本 slice 的小文字按钮）。 */
@Component
public class HomeEntryBtns {
    @Prop var onOpenZilu: () -> Unit
    @Prop var onOpenEvo: () -> Unit
    @Prop var onOpenCard: () -> Unit

    func build() {
        Row(space: 12) {
            Text(HOME_BTN_ZILU)
                .fontSize(Theme.fsButton)
                .fontFamily(Theme.sans)
                .fontColor(Theme.onNight)
                .layoutWeight(1)
                .height(Theme.buttonH)
                .borderRadius(22)
                .border(width: 1, color: Theme.onNight2)
                .textAlign(TextAlign.Center)
                .onClick({event => this.onOpenZilu()})
            Text(HOME_BTN_EVO)
                .fontSize(Theme.fsButton)
                .fontFamily(Theme.sans)
                .fontColor(Theme.onNight)
                .layoutWeight(1)
                .height(Theme.buttonH)
                .borderRadius(22)
                .border(width: 1, color: Theme.onNight2)
                .textAlign(TextAlign.Center)
                .onClick({event => this.onOpenEvo()})
            Text(HOME_BTN_CARD)
                .fontSize(Theme.fsButton)
                .fontFamily(Theme.sans)
                .fontColor(Theme.onNight)
                .layoutWeight(1)
                .height(Theme.buttonH)
                .borderRadius(22)
                .border(width: 1, color: Theme.onNight2)
                .textAlign(TextAlign.Center)
                .onClick({event => this.onOpenCard()})
        }
        .width(100.percent)
        .margin(top: 20)
    }
}

/* 调试按钮「调试：粮归零」（DEBUG ONLY：M2_DEBUG_FORCE_END 打开才显示，
   默认 false，见 game_rules.cj）。点一下把「粮」按到 0，然后走完全正常的
   纯逻辑路径进结局卡 —— 不抄近路改 phase，测的就是真链路。 */
@Component
public class HomeDebugBtn {
    @Prop var onTap: () -> Unit

    func build() {
        Text(HOME_DEBUG_ZERO)
            .fontSize(Theme.fsNote)
            .fontFamily(Theme.sans)
            .fontColor(Theme.onNight2)
            .height(28)
            .padding(left: 10, right: 10)
            .borderRadius(14)
            .border(width: 1, color: Theme.nightLine)
            .textAlign(TextAlign.Center)
            .margin(top: 10)
            .onClick({event => this.onTap()})
    }
}

/* 点选退路：左右两条常显选项按钮（SPEC §2.3「点一下即选」）。
   拖动 / 长按在 ArkUI-Cangjie 这一版没验过的前提下，这两条就是保底的那条路。 */
@Component
public class HomeOptBtns {
    @Prop var leftLabel: String
    @Prop var rightLabel: String
    @Prop var onPick: (Int64) -> Unit

    func build() {
        Row(space: 12) {
            Text(this.leftLabel)
                .fontSize(Theme.fsButton)
                .fontFamily(Theme.sans)
                .fontColor(Theme.onNight)
                .backgroundColor(Theme.night800)
                .height(Theme.buttonH)
                .borderRadius(12)
                .border(width: 1, color: Theme.nightLine)
                .layoutWeight(1)
                .textAlign(TextAlign.Center)
                .onClick({event => this.onPick(RUN_SIDE_LEFT)})
            Text(this.rightLabel)
                .fontSize(Theme.fsButton)
                .fontFamily(Theme.sans)
                .fontColor(Theme.onNight)
                .backgroundColor(Theme.night800)
                .height(Theme.buttonH)
                .borderRadius(12)
                .border(width: 1, color: Theme.nightLine)
                .layoutWeight(1)
                .textAlign(TextAlign.Center)
                .onClick({event => this.onPick(RUN_SIDE_RIGHT)})
        }
        .width(100.percent)
        .margin(top: 12)
        .padding(left: Theme.insetNight, right: Theme.insetNight)
    }
}

/* 操作提示：拖卡 / 长按两行小字（设计稿字匣条右下角）。
   这一版的手势（PanGesture / LongPressGesture）没有本仓库先用例，
   这两行就是告诉玩家「卡片可以拖、可以按住」的兜底说明。 */
@Component
public class HomeCardTip {
    func build() {
        Column {
            Text(HOME_CARD_TIP_DRAG)
                .fontSize(Theme.fsNote)
                .fontFamily(Theme.sans)
                .fontColor(Theme.onNight2)
            Text(HOME_CARD_TIP_HOLD)
                .fontSize(Theme.fsNote)
                .fontFamily(Theme.sans)
                .fontColor(Theme.onNight2)
        }
        .width(100.percent)
        .margin(top: 10)
        .padding(left: Theme.insetNight, right: Theme.insetNight)
    }
}

/* 事件卡那一块：把牌面字段从牌堆里取出来递给 EventCardView。
   单独拆一层是为了让 HomeScreen 的 build() 保持小块（@Component 宏展开
   撑不住大 build()）。落字条的文案 / 能不能点由字匣那边递进来
   （luoziLabel / luoziEnabled）。 */
@Component
public class HomeCardStage {
    @Prop var cardIndex: Int64
    @Prop var luoziLabel: String
    @Prop var luoziEnabled: Bool
    @Prop var onHoldChange: (Bool) -> Unit
    @Prop var onPick: (Int64) -> Unit
    @Prop var onLuozi: () -> Unit

    func card(): EventCard {
        return eventCardAt(this.cardIndex)
    }

    func seasonText(): String {
        return this.card().seasonLabel(this.cardIndex, eventCardCount())
    }

    func build() {
        Column {
            EventCardView(
                who: this.card().who,
                season: this.seasonText(),
                body: this.card().body,
                leftLabel: this.card().left.label,
                rightLabel: this.card().right.label,
                leftDeltas: this.card().left.deltas,
                rightDeltas: this.card().right.deltas,
                allowsLuozi: this.card().allowsLuozi,
                luoziEnabled: this.luoziEnabled,
                luoziLabel: this.luoziLabel,
                onLuozi: { => this.onLuozi() },
                onHoldChange: {v => this.onHoldChange(v)},
                onPick: {side => this.onPick(side)}
            )
        }
        .width(100.percent)
    }
}

/* 主界外壳（SPEC §2.1–§2.4；设计稿 home_slide_v1）：
     顶行   第 N 代 · 第 Y 年 / 第 N 代记事人
     按住   四维条上方两排圆点（states_v1 ①，长按卡片才出现）
     四维   粮 信 记 外四条资源条
     骨片   5 位 pip + 余年
     事件卡 296×384，下一张垫在后面；左右拖动 / 长按看分量 / 两条点选按钮 /
             落字第三选项（字匣选中一个可落的字才有）
     字匣   104 高一条，3 格五种状态（可落 / 选中 / 本代已落 / 事签 / 空）
     入口   字录 / 演变条 / 造字卡
   props 全是简单类型：牌面字段在成员函数里从牌堆现算，界面层只传原始值。
   字匣的选中态是界面状态（selectedSlot，-1 = 没有选中），存在 EntryView 里
   ——详情弹层的开关也要被 onBackPress 看见。 */
@Component
public class HomeScreen {
    @Prop var generation: Int64
    @Prop var year: Int64
    @Prop var yearsLeft: Int64
    @Prop var dims: Array<Int64>
    @Prop var boneEmpty: Int64
    @Prop var boneShiqian: Int64
    @Prop var boxChars: Array<String>
    @Prop var boxLanded: Array<Bool>
    /* 字匣选中态（-1 = 没有选中）。 */
    @Prop var selectedSlot: Int64
    @Prop var cardIndex: Int64
    /* 触底 / 溢出闪朱（SPEC §2.1）：正在闪的那一维 + 这一下亮不亮。
       EntryView 用 animateTo 推进两下（各 ~200ms）。 */
    @Prop var flashDim: Int64
    @Prop var flashOn: Bool
    /* 选定一个选项（0 左 / 1 右 / 2 落字）：EntryView 负责 applyChoice / applyLuozi + 存档。 */
    @Prop var onPick: (Int64) -> Unit
    /* 点字匣某一格：EntryView 决定选中谁、开不开详情弹层。 */
    @Prop var onSelectSlot: (Int64) -> Unit
    @Prop var onOpenZilu: () -> Unit
    @Prop var onOpenEvo: () -> Unit
    @Prop var onOpenCard: () -> Unit
    /* 调试入口（M2_DEBUG_FORCE_END 打开才显示按钮）。 */
    @Prop var onDebugZero: () -> Unit

    /* 按住看分量中：卡片长按置 true，两排圆点才排在四维条上方。 */
    @State var held: Bool = false
    /* 「准备落字」记在哪个格子、哪张卡上：换了选中或换了卡就自动不算准备过
       （不用监听 prop 变化，比较两个数就够）。 */
    @State var armedSlot: Int64 = BOX_SLOT_NONE
    @State var armedCard: Int64 = -1

    /* —— 当前这一张卡（牌堆循环，读档回到同一张）—— */
    func card(): EventCard {
        return eventCardAt(this.cardIndex)
    }

    func seasonText(): String {
        return this.card().seasonLabel(this.cardIndex, eventCardCount())
    }

    func leftLabel(): String {
        return this.card().left.label
    }

    func rightLabel(): String {
        return this.card().right.label
    }

    func leftDeltas(): Array<Int64> {
        return this.card().left.deltas
    }

    func rightDeltas(): Array<Int64> {
        return this.card().right.deltas
    }

    func allowsLuozi(): Bool {
        return this.card().allowsLuozi
    }

    /* 字匣第 i 格现在能不能落（纯逻辑在 game_rules.cj）。 */
    func slotState(i: Int64): Int64 {
        return boxSlotStateOf(this.boxChars, this.boxLanded, this.selectedSlot, i)
    }

    /* 选中格里的字（没选中 / 越界 → 空串）。 */
    func selectedGlyph(): String {
        if (this.selectedSlot < 0 || this.selectedSlot >= this.boxChars.size) { return "" }
        return this.boxChars[this.selectedSlot]
    }

    /* 落字条能不能点：卡允许落字、并且字匣里选中了一个可落的字。 */
    func luoziReady(): Bool {
        return canLuoziOf(this.boxChars, this.boxLanded, this.allowsLuozi(), this.selectedSlot)
    }

    /* 第一次点只是准备，再点一次才真的落。 */
    func luoziArmed(): Bool {
        return this.armedSlot == this.selectedSlot && this.armedCard == this.cardIndex
    }

    func luoziLabel(): String {
        if (!this.luoziReady()) { return HOME_LUOZI_NEED }
        if (this.luoziArmed()) { return HOME_LUOZI_ARMED }
        return homeLuoziLabel(this.selectedGlyph())
    }

    func luoziTap(): Unit {
        if (!this.luoziReady()) { return }
        if (!this.luoziArmed()) {
            this.armedSlot = this.selectedSlot
            this.armedCard = this.cardIndex
            return
        }
        this.armedSlot = BOX_SLOT_NONE
        this.pick(RUN_SIDE_LUOZI)
    }

    func pick(side: Int64): Unit {
        /* 选定就把分量圆点收起来（长按中点了选项按钮的情况）。 */
        this.held = false
        this.onPick(side)
    }

    /* 卡片长按状态回传（EventCardView 自己管手势，圆点排在这一层）。 */
    func holdChange(v: Bool): Unit {
        this.held = v
    }

    func build() {
        Column {
            HomeStatLine(generation: this.generation, year: this.year)

            /* 按住看分量：两排圆点（上左 / 下右），只在长按中出现。 */
            if (this.held) {
                HomeWeightDots(
                    leftDeltas: this.leftDeltas(),
                    rightDeltas: this.rightDeltas()
                )
                .margin(top: 10)
            }

            /* 四维资源条。 */
            HomeHud(dims: this.dims, flashDim: this.flashDim, flashOn: this.flashOn)
            .margin(top: 12)

            /* 骨片行 + 余年。 */
            HomeBonesRow(
                boneEmpty: this.boneEmpty,
                boneShiqian: this.boneShiqian,
                yearsLeft: this.yearsLeft
            )

            /* 事件卡：中间剩下的地方都归它（牌面在 HomeCardStage 里拼）。 */
            HomeCardStage(
                cardIndex: this.cardIndex,
                luoziLabel: this.luoziLabel(),
                luoziEnabled: this.luoziReady(),
                onHoldChange: {v => this.holdChange(v)},
                onPick: {side => this.pick(side)},
                onLuozi: { => this.luoziTap() }
            )
            .layoutWeight(1)

            /* 点选退路。 */
            HomeOptBtns(
                leftLabel: this.leftLabel(),
                rightLabel: this.rightLabel(),
                onPick: {side => this.pick(side)}
            )

            HomeCardTip()

            /* 字匣：104 高一条，3 格五种状态。 */
            HomeBoxBar(
                boxChars: this.boxChars,
                boxLanded: this.boxLanded,
                selectedSlot: this.selectedSlot,
                onSelect: {i => this.onSelectSlot(i)}
            )

            HomeEntryBtns(
                onOpenZilu: { => this.onOpenZilu() },
                onOpenEvo: { => this.onOpenEvo() },
                onOpenCard: { => this.onOpenCard() }
            )

            /* 调试：粮归零（DEBUG ONLY，默认关）。 */
            if (M2_DEBUG_FORCE_END) {
                HomeDebugBtn(onTap: { => this.onDebugZero() })
            }
        }
        .width(100.percent)
        .height(100.percent)
        .backgroundColor(Theme.night900)
        .padding(bottom: 16)
    }
}
