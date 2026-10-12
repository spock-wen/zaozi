package ohos_app_cangjie_entry

import kit.ArkUI.*
import ohos.arkui.state_macro_manage.*

/* 字匣详情弹层（SPEC §2.4 字匣详情弹层；设计稿 ziku_pick_v1 E）。
   规格同 v1 弹层：上圆角 20、内边距 20、把手 36×4、遮罩 45% 黑；
   点遮罩 / 「‹」/ 系统 Back 都关层（Back 在 index.cj 的 onBackPress 里先关层）。
   内容：大字 + 造法徽标（ziluMethodOf）+ 状态徽标（12 Bold、高 22、圆角 6：
   可落 jade / 本代已落 paper-200 / 待刻 zhu-100）+ 一行白话字义（ziluCopyOf，
   查不到就不显示）+ 两个按钮（「‹」关层 / 「在卡上落字」——只有可落那一格有）。
   版式拆成三个小 @Component（@Component 宏展开撑不住大 build()）。 */

/* 状态徽标：12 Bold、高 22、圆角 6（SPEC §2.4 弹层行）。 */
@Component
public class BoxStateBadge {
    @Prop var state: Int64

    func text(): String {
        return boxStateText(this.state)
    }

    func fg(): Int64 {
        if (this.state == BOX_SLOT_LANDED) { return Theme.ink600 }
        if (this.state == BOX_SLOT_SHIQIAN) { return Theme.zhu600 }
        return Theme.jade600
    }

    func bg(): Int64 {
        if (this.state == BOX_SLOT_LANDED) { return Theme.paper200 }
        if (this.state == BOX_SLOT_SHIQIAN) { return Theme.zhu100 }
        return Theme.jade100
    }

    func build() {
        Text(this.text())
            .fontSize(Theme.fsBadge)
            .fontFamily(Theme.sans)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.fg())
            .backgroundColor(this.bg())
            .height(22)
            .padding(left: 8, right: 8)
            .borderRadius(6)
            .textAlign(TextAlign.Center)
    }
}

/* 弹层里那一行：左边大字块 + 右边徽标与说明。 */
@Component
public class BoxSheetHead {
    @Prop var glyph: String
    @Prop var charId: String
    @Prop var state: Int64

    func method(): String {
        return ziluMethodOf(this.charId)
    }

    func hint(): String {
        return boxStateHint(this.state)
    }

    /* 白话字义：设计稿只给了「休」，别的字取空 → 这一行不显示（不编造）。 */
    func meaning(): String {
        return ziluCopyOf(this.charId).meaning
    }

    func hasMeaning(): Bool {
        return this.meaning().size > 0
    }

    func build() {
        Row {
            /* 大字块 64×64（骨色底，与挑字页大格同一档）。 */
            Column {
                Text(this.glyph)
                    .fontSize(34)
                    .fontFamily(Theme.serif)
                    .fontWeight(FontWeight.Bold)
                    .fontColor(Theme.ink900)
            }
            .width(64)
            .height(64)
            .borderRadius(14)
            .backgroundColor(Theme.bone100)
            .border(width: 1, color: Theme.bone300)
            .justifyContent(FlexAlign.Center)
            .alignItems(HorizontalAlign.Center)

            Column(space: 8) {
                Row(space: 8) {
                    /* 造法徽标：MethodBadge 的样式（会意朱 / 象形青 / 指事紫灰），
                       这里内联成 Text，字直接按 charId 现算。 */
                    Text(this.method())
                        .fontSize(Theme.fsBadge)
                        .fontFamily(Theme.sans)
                        .fontWeight(FontWeight.Bold)
                        .fontColor(methodBadgeFg(this.method()))
                        .backgroundColor(methodBadgeBg(this.method()))
                        .height(22)
                        .padding(left: 8, right: 8)
                        .borderRadius(6)
                        .textAlign(TextAlign.Center)
                    BoxStateBadge(state: this.state)
                }
                .width(100.percent)

                Text(this.hint())
                    .fontSize(Theme.fsNote)
                    .fontFamily(Theme.sans)
                    .fontColor(Theme.ink600)
                    .width(100.percent)
                if (this.hasMeaning()) {
                    Text(this.meaning())
                        .fontSize(Theme.fsBody)
                        .fontFamily(Theme.serif)
                        .fontColor(Theme.ink900)
                        .width(100.percent)
                        .lineHeight(22)
                }
            }
            .layoutWeight(1)
            .margin(left: 12)
        }
        .width(100.percent)
        .margin(top: 14)
        .alignItems(VerticalAlign.Center)
    }
}

/* 弹层按钮一行：左「‹」（幽灵），右「在卡上落字」（朱底白字，只有可落才有）。 */
@Component
public class BoxSheetBtns {
    @Prop var canLand: Bool
    @Prop var onClose: () -> Unit
    @Prop var onLand: () -> Unit

    func build() {
        Row(space: 12) {
            Text(BOX_SHEET_BACK)
                .fontSize(Theme.fsButton)
                .fontFamily(Theme.sans)
                .fontWeight(FontWeight.Bold)
                .fontColor(Theme.ink900)
                .height(Theme.buttonH)
                .borderRadius(22)
                .border(width: 1, color: Theme.ink400)
                .layoutWeight(1)
                .textAlign(TextAlign.Center)
                .onClick({event => this.onClose()})
            if (this.canLand) {
                Text(BOX_SHEET_LAND)
                    .fontSize(Theme.fsButton)
                    .fontFamily(Theme.sans)
                    .fontWeight(FontWeight.Bold)
                    .fontColor(Theme.white)
                    .backgroundColor(Theme.zhu600)
                    .height(Theme.buttonH)
                    .borderRadius(22)
                    .layoutWeight(2)
                    .textAlign(TextAlign.Center)
                    .onClick({event => this.onLand()})
            }
        }
        .width(100.percent)
        .margin(top: 18)
    }
}

/* 弹层本体：遮罩 45% 黑 + paper-50 底、上圆角 20 的底部弹层。
   charId 用来查造法 / 白话字义；state 是这一格此刻的状态（选中 / 已落 / 待刻）。 */
@Component
public class BoxSheet {
    @Prop var charId: String
    @Prop var glyph: String
    @Prop var state: Int64
    @Prop var onClose: () -> Unit
    @Prop var onLand: () -> Unit

    /* 只有「可落」那一格能落字（选中态就是可落；已落 / 事签只有关层）。 */
    func canLand(): Bool {
        return this.state == BOX_SLOT_OK || this.state == BOX_SLOT_SELECTED
    }

    func build() {
        Stack {
            /* 遮罩：点一下关层。 */
            Text("")
                .width(100.percent)
                .height(100.percent)
                .backgroundColor(Theme.scrimBlack45)
                .onClick({event => this.onClose()})

            /* 弹层贴底（与 ui_card.cj 的成字弹层同一套摆法）。 */
            Column {
                Column {
                    /* 把手 36×4（v1 弹层规格）。 */
                    Row()
                        .width(36)
                        .height(4)
                        .borderRadius(2)
                        .backgroundColor(Theme.paperLine)

                    Text(BOX_SHEET_KEY)
                        .fontSize(Theme.fsBadge)
                        .fontFamily(Theme.sans)
                        .fontWeight(FontWeight.Bold)
                        .fontColor(Theme.zhu600)
                        .width(100.percent)
                        .margin(top: 14)

                    Text(BOX_SHEET_TITLE)
                        .fontSize(Theme.fsSheetTitle)
                        .fontFamily(Theme.serif)
                        .fontWeight(FontWeight.Bold)
                        .fontColor(Theme.ink900)
                        .width(100.percent)
                        .margin(top: 8)

                    BoxSheetHead(
                        charId: this.charId,
                        glyph: this.glyph,
                        state: this.state
                    )

                    BoxSheetBtns(
                        canLand: this.canLand(),
                        onClose: { => this.onClose() },
                        onLand: { => this.onLand() }
                    )
                }
                .width(100.percent)
                .padding(left: 20, right: 20, top: 10, bottom: 20)
                .backgroundColor(Theme.paper50)
                .borderRadius(topLeft: Theme.sheetRadius, topRight: Theme.sheetRadius)
                /* 同 R-P3-2c：弹层本体吞掉点击（空 onClick），点弹层内容不关。 */
                .onClick({event => })
            }
            .width(100.percent)
            .height(100.percent)
            .justifyContent(FlexAlign.End)
            /* 同 R-P3-2c：满高 Column 盖住遮罩 → 关层挂在这层上。 */
            .onClick({event => this.onClose()})
        }
        .width(100.percent)
        .height(100.percent)
    }
}
