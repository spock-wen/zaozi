package ohos_app_cangjie_entry

import kit.ArkUI.*
import ohos.arkui.state_macro_manage.*
import std.collection.ArrayList

/* 主界（home_slide_v1）。M2 slice 1 铺了版式（代次/年 + 字匣三格 + 二级界面入口），
   slice 2 把 SPEC §2.1 四维条、§2.2 骨片行、§2.3 事件卡（拖动 / 按住看分量 /
   点选退路 / 落字灰态）填了进来；字匣的「可落 / 已落 / 事签」、结局卡、代末结算
   还是后面的 slice。四维条在 ui_hud.cj、骨片行在 ui_bones.cj、事件卡在
   ui_event_card.cj，本文件只管这一层的版式。
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

/* 字匣一格（48×48、圆角 12、Serif 26 Bold）。空格只在开局挑字前出现。 */
@Component
public class HomeBoxSlot {
    @Prop var glyph: String

    func filled(): Bool {
        return this.glyph.size > 0
    }

    func build() {
        Text(if (this.filled()) { this.glyph } else { PICK_SLOT_EMPTY })
            .fontSize(if (this.filled()) { 26 } else { 20 })
            .fontFamily(if (this.filled()) { Theme.serif } else { Theme.sans })
            .fontWeight(FontWeight.Bold)
            .fontColor(if (this.filled()) { Theme.ink900 } else { Theme.onNight2 })
            .width(48)
            .height(48)
            .borderRadius(12)
            .backgroundColor(if (this.filled()) { Theme.paper50 } else { Theme.night700 })
            .border(
                width: 1,
                color: if (this.filled()) { Theme.ink600 } else { Theme.nightLine },
                style: if (this.filled()) { BorderStyle.Solid } else { BorderStyle.Dashed }
            )
            .textAlign(TextAlign.Center)
    }
}

/* 字匣条：标题 + 三格（SPEC §2.4 主界字匣条）。 */
@Component
public class HomeBoxBar {
    @Prop var boxChars: Array<String>

    func slotAt(i: Int64): String {
        if (i >= 0 && i < this.boxChars.size) { return this.boxChars[i] }
        return ""
    }

    /* 三格的下标（0/1/2）。ArrayList 是为了跟仓库里其它 ForEach 调用一致。 */
    func slotIndexes(): ArrayList<Int64> {
        let out = ArrayList<Int64>()
        out.add(0)
        out.add(1)
        out.add(2)
        return out
    }

    func build() {
        Column {
            Text(HOME_BOX_TITLE)
                .fontSize(Theme.fsStatus)
                .fontFamily(Theme.sans)
                .fontWeight(FontWeight.Bold)
                .fontColor(Theme.onNight2)
                .width(100.percent)
            Row(space: 12) {
                ForEach(this.slotIndexes(), itemGeneratorFunc: {i: Int64, at: Int64 =>
                    HomeBoxSlot(glyph: this.slotAt(i))
                })
            }
            .width(100.percent)
            .margin(top: 10)
            if (this.boxChars.size == 0) {
                Text(HOME_BOX_EMPTY)
                    .fontSize(Theme.fsNote)
                    .fontFamily(Theme.sans)
                    .fontColor(Theme.onNight2)
                    .width(100.percent)
                    .margin(top: 10)
            }
        }
        .width(100.percent)
        .padding(Theme.insetPaper)
        .borderRadius(16)
        .backgroundColor(Theme.night800)
        .margin(top: 20)
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

/* 结局占位（slice 4 才做结局卡 SPEC §2.7）：一行「结局：<标题>（结算待接）」。
   title 空串时整行不画。 */
@Component
public class HomeEndingHolder {
    @Prop var title: String

    func text(): String {
        return homeEndingText(this.title)
    }

    func build() {
        Column {
            if (this.title.size > 0) {
                Text(this.text())
                    .fontSize(Theme.fsPageTitle)
                    .fontFamily(Theme.serif)
                    .fontWeight(FontWeight.Bold)
                    .fontColor(Theme.onNight)
            }
        }
        .width(100.percent)
        .height(100.percent)
        .backgroundColor(Theme.night900)
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
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
   撑不住大 build()）。落字条这一片恒灰（luoziEnabled: false）——字匣的
   「可落 / 已落」是 slice 3 的事。 */
@Component
public class HomeCardStage {
    @Prop var cardIndex: Int64
    @Prop var onHoldChange: (Bool) -> Unit
    @Prop var onPick: (Int64) -> Unit

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
                luoziEnabled: false,
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
     事件卡 296×384，下一张垫在后面；左右拖动 / 长按看分量 / 两条点选按钮
     字匣   3 格（slice 3 接「可落 / 已落 / 事签」五种状态）
     入口   字录 / 演变条 / 造字卡
   props 全是简单类型：牌面字段在成员函数里从牌堆现算，界面层只传原始值。 */
@Component
public class HomeScreen {
    @Prop var generation: Int64
    @Prop var year: Int64
    @Prop var yearsLeft: Int64
    @Prop var dims: Array<Int64>
    @Prop var boneEmpty: Int64
    @Prop var boneShiqian: Int64
    @Prop var boxChars: Array<String>
    @Prop var cardIndex: Int64
    /* 选定一个选项（0 左 / 1 右 / 2 落字）：EntryView 负责 applyChoice + 存档。 */
    @Prop var onPick: (Int64) -> Unit
    @Prop var onOpenZilu: () -> Unit
    @Prop var onOpenEvo: () -> Unit
    @Prop var onOpenCard: () -> Unit

    /* 按住看分量中：卡片长按置 true，两排圆点才排在四维条上方。 */
    @State var held: Bool = false

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
            HomeHud(dims: this.dims)
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
                onHoldChange: {v => this.holdChange(v)},
                onPick: {side => this.pick(side)}
            )
            .layoutWeight(1)

            /* 点选退路。 */
            HomeOptBtns(
                leftLabel: this.leftLabel(),
                rightLabel: this.rightLabel(),
                onPick: {side => this.pick(side)}
            )

            HomeCardTip()

            /* 字匣：slice 3 之前只摆三格 + 提示。 */
            HomeBoxBar(boxChars: this.boxChars)

            HomeEntryBtns(
                onOpenZilu: { => this.onOpenZilu() },
                onOpenEvo: { => this.onOpenEvo() },
                onOpenCard: { => this.onOpenCard() }
            )
        }
        .width(100.percent)
        .height(100.percent)
        .backgroundColor(Theme.night900)
        .padding(bottom: 16)
    }
}
