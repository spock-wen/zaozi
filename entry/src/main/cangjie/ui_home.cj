package ohos_app_cangjie_entry

import kit.ArkUI.*
import ohos.arkui.state_macro_manage.*
import std.collection.ArrayList

/* 主界（home_slide_v1）。M2 slice 1 只放占位内容：代次/年 + 字匣三格 +
   进二级界面（字录 / 演变条 / 造字卡）的小入口。四维条、骨片行、事件卡、
   结局卡、代末结算由后面的 slice 填，本文件只管这一层的版式。
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

/* 主界外壳：代次 / 年 / 字匣三格 + 二级界面入口。 */
@Component
public class HomeScreen {
    @Prop var generation: Int64
    @Prop var year: Int64
    @Prop var boxChars: Array<String>
    @Prop var onOpenZilu: () -> Unit
    @Prop var onOpenEvo: () -> Unit
    @Prop var onOpenCard: () -> Unit

    func build() {
        Column {
            HomeStatLine(generation: this.generation, year: this.year)

            Column {
                HomeBoxBar(boxChars: this.boxChars)
                HomeEntryBtns(
                    onOpenZilu: { => this.onOpenZilu() },
                    onOpenEvo: { => this.onOpenEvo() },
                    onOpenCard: { => this.onOpenCard() }
                )
            }
            .width(100.percent)
            .padding(left: Theme.insetNight, right: Theme.insetNight)
            .layoutWeight(1)
        }
        .width(100.percent)
        .height(100.percent)
        .backgroundColor(Theme.night900)
    }
}
