package ohos_app_cangjie_entry

import kit.ArkUI.*
import ohos.arkui.state_macro_manage.*

/* 结局卡（SPEC §2.7 模板 A 失败 / B 善终；设计稿 end_fail_v1 H / I）。
   触发链（SPEC §2.7）：触底那一维的条闪朱 2 次 → 主界压暗 → 卡从下方升起 320ms。
   闪朱在 EntryView 里用 getUIContext().animateTo 链式推进（200ms 一下，共两下），
   压暗 + 升起就是本文件最外层这层 Stack（遮罩 45% 黑 + 卡 offset 从 400 升到 0）。
   两套模板同一个组件，只换强调色（失败 zhu-600 / zhu-100，善终 jade-600 / jade-100）
   和几句文案（小标、原因胶囊、结局话）。
   同样拆成小 @Component（@Component 宏展开撑不住大 build()）。 */

/* 强调色：失败朱、善终青（设计稿 .fail / .good 的 --accent）。 */
@Component
public class EndingBand {
    @Prop var good: Bool

    func color(): Int64 {
        if (this.good) { return Theme.jade600 }
        return Theme.zhu600
    }

    func build() {
        Text("")
            .width(100.percent)
            .height(Theme.endBandH)
            .backgroundColor(this.color())
    }
}

/* 小标 12 Bold + 字距（设计稿 .endc .k：letter-spacing .12em）。 */
@Component
public class EndingKey {
    @Prop var generation: Int64
    @Prop var good: Bool

    func text(): String {
        return endingKeyText(this.generation)
    }

    func color(): Int64 {
        if (this.good) { return Theme.jade600 }
        return Theme.zhu600
    }

    func build() {
        Text(this.text())
            .fontSize(Theme.fsBadge)
            .fontFamily(Theme.sans)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.color())
            .width(100.percent)
    }
}

/* 标题：Serif 40 Bold 字距 .06em（设计稿 .endc h2）。 */
@Component
public class EndingTitle {
    @Prop var title: String

    func build() {
        Text(this.title)
            .fontSize(Theme.endTitleFs)
            .fontFamily(Theme.serif)
            .fontWeight(FontWeight.Bold)
            .fontColor(Theme.ink900)
            .width(100.percent)
            .margin(top: 14)
    }
}

/* 原因胶囊 26 高：失败「某维 见底 / 溢出」，善终「四维都在中间」
   （zhu-100 / jade-100 底，字用强调色）。 */
@Component
public class EndingWhy {
    @Prop var dim: Int64
    @Prop var kind: String
    @Prop var good: Bool

    func text(): String {
        return endingWhyText(this.dim, this.kind)
    }

    func fg(): Int64 {
        if (this.good) { return Theme.jade600 }
        return Theme.zhu600
    }

    func bg(): Int64 {
        if (this.good) { return Theme.jade100 }
        return Theme.zhu100
    }

    func build() {
        Text(this.text())
            .fontSize(Theme.fsBadge)
            .fontFamily(Theme.sans)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.fg())
            .backgroundColor(this.bg())
            .height(26)
            .padding(left: 10, right: 10)
            .borderRadius(13)
            .textAlign(TextAlign.Center)
            .margin(top: 10)
    }
}

/* 结局话：Serif 16 / 行高 28，最多 3 行（SPEC §2.7 模板 A/B）。
   文案表在 copy_text.cj 的 endingLine（按结局 id 查）。 */
@Component
public class EndingLine {
    @Prop var endingId: String

    func text(): String {
        return endingLine(this.endingId)
    }

    func build() {
        Text(this.text())
            .fontSize(Theme.cardBodyFs)
            .fontFamily(Theme.serif)
            .fontColor(Theme.ink900)
            .lineHeight(Theme.endLineLh)
            .maxLines(3)
            .width(100.percent)
            .margin(top: 18)
    }
}

/* 分隔线（设计稿 .endc .hr：1 高 paper-200）。 */
@Component
public class EndingDivider {
    func build() {
        Text("")
            .width(100.percent)
            .height(1)
            .backgroundColor(Theme.paper200)
            .margin(top: 20)
            .margin(bottom: 14)
    }
}

/* 「家谱记下：第 N 代，<标题>」（Serif 13，标题 ink-900 Bold，其余 ink-600）。 */
@Component
public class EndingGenealogy {
    @Prop var generation: Int64
    @Prop var title: String

    func lead(): String {
        return END_GENEALOGY.replace("N", "${this.generation}")
    }

    func build() {
        Row {
            Text(this.lead())
                .fontSize(Theme.fsStatus)
                .fontFamily(Theme.serif)
                .fontColor(Theme.ink600)
            Text(this.title)
                .fontSize(Theme.fsStatus)
                .fontFamily(Theme.serif)
                .fontWeight(FontWeight.Bold)
                .fontColor(Theme.ink900)
        }
        .width(100.percent)
    }
}

/* 这一代留下的字：40×40（设计稿 .endc .left .chip）。
   一个都没落下 → 写「未成字」ink-400（SPEC §3）。 */
@Component
public class EndingChars {
    @Prop var chars: Array<String>

    func none(): Bool {
        return this.chars.size == 0
    }

    func build() {
        Row(space: 8) {
            if (this.none()) {
                Text(END_CHARS_NONE)
                    .fontSize(Theme.fsStageName)
                    .fontFamily(Theme.sans)
                    .fontColor(Theme.ink400)
            } else {
                ForEach(this.chars, itemGeneratorFunc: {g: String, i: Int64 =>
                    Text(g)
                        .fontSize(24)
                        .fontFamily(Theme.serif)
                        .fontWeight(FontWeight.Bold)
                        .fontColor(Theme.ink900)
                        .backgroundColor(Theme.paper50)
                        .border(width: 1, color: Theme.paperLine)
                        .width(Theme.endCharCell)
                        .height(Theme.endCharCell)
                        .borderRadius(8)
                        .textAlign(TextAlign.Center)
                })
            }
        }
        .width(100.percent)
        .margin(top: 12)
    }
}

/* 卡底两个按钮：「看家谱」描边（on-night 字 + on-night-2 描边，卡是压暗的主界上
   浮起来的）、「往下传」朱底白字 → 代末结算（SPEC §2.7）。 */
@Component
public class EndingBtns {
    @Prop var onGenealogy: () -> Unit
    @Prop var onNext: () -> Unit

    func build() {
        Row(space: 12) {
            Text(END_BTN_GENEALOGY)
                .fontSize(Theme.fsButton)
                .fontFamily(Theme.sans)
                .fontWeight(FontWeight.Bold)
                .fontColor(Theme.onNight)
                .height(Theme.buttonH)
                .borderRadius(22)
                .border(width: 1, color: Theme.onNight2)
                .layoutWeight(1)
                .textAlign(TextAlign.Center)
                .onClick({event => this.onGenealogy()})
            Text(END_BTN_NEXT)
                .fontSize(Theme.fsButton)
                .fontFamily(Theme.sans)
                .fontWeight(FontWeight.Bold)
                .fontColor(Theme.white)
                .backgroundColor(Theme.zhu600)
                .height(Theme.buttonH)
                .borderRadius(22)
                .layoutWeight(1)
                .textAlign(TextAlign.Center)
                .onClick({event => this.onNext()})
        }
        .width(100.percent)
    }
}

/* 卡本体：paper-50、左右边距 24、上圆角 18、顶部 8 高色带（设计稿 .endc）。 */
@Component
public class EndingCardBody {
    @Prop var generation: Int64
    @Prop var title: String
    @Prop var endingId: String
    @Prop var dim: Int64
    @Prop var kind: String
    @Prop var good: Bool
    @Prop var chars: Array<String>
    @Prop var onGenealogy: () -> Unit
    @Prop var onNext: () -> Unit

    func build() {
        Column {
            EndingBand(good: this.good)

            Column {
                EndingKey(generation: this.generation, good: this.good)
                EndingTitle(title: this.title)
                EndingWhy(dim: this.dim, kind: this.kind, good: this.good)
                EndingLine(endingId: this.endingId)
                EndingDivider()
                EndingGenealogy(generation: this.generation, title: this.title)
                EndingChars(chars: this.chars)
            }
            .width(100.percent)
            .layoutWeight(1)
            .padding(left: 22, right: 22, top: 22)

            EndingBtns(
                onGenealogy: { => this.onGenealogy() },
                onNext: { => this.onNext() }
            )
            .padding(left: 24, right: 24, bottom: 24)
        }
        .width(100.percent)
        .height(100.percent)
        .backgroundColor(Theme.paper50)
        .borderRadius(topLeft: Theme.endRadius, topRight: Theme.endRadius)
    }
}

/* 结局卡整层：主界压暗（45% 黑遮罩）+ 卡从下方升起 320ms。
   rise 在 aboutToAppear 里用 getUIContext().animateTo 置 true（本仓库已验证的
   动画 API，见 ui_card.cj）；若某机型上 offset 不吃动画，卡也照样在原位显示，
   不会缺内容。 */
@Component
public class EndingOverlay {
    @Prop var generation: Int64
    @Prop var title: String
    @Prop var endingId: String
    @Prop var dim: Int64
    @Prop var kind: String
    @Prop var good: Bool
    @Prop var chars: Array<String>
    @Prop var onGenealogy: () -> Unit
    @Prop var onNext: () -> Unit

    /* 升起中：false 时卡沉在屏幕下方，true 时归位。 */
    @State var rise: Bool = false

    public func aboutToAppear(): Unit {
        this.rise = false
        this.getUIContext().animateTo(
            /* duration 要 Int32 字面量：Theme.endRiseMs 是 Int64(320)，直接传会
               mismatched types（同 ui_card.cj 的 playStepMs，用裸字面量 320）。 */
            AnimateParam(duration: 320, onFinish: Some({ => })),
            { => this.rise = true }
        )
    }

    /* 升起位移（vp）：沉在下方时多留一屏，归位时 0。 */
    func offsetY(): Int64 {
        if (this.rise) { return 0 }
        return 400
    }

    func build() {
        Stack {
            /* 主界压暗（设计稿 .scrim）。 */
            Text("")
                .width(100.percent)
                .height(100.percent)
                .backgroundColor(Theme.scrimBlack45)

            EndingCardBody(
                generation: this.generation,
                title: this.title,
                endingId: this.endingId,
                dim: this.dim,
                kind: this.kind,
                good: this.good,
                chars: this.chars,
                onGenealogy: { => this.onGenealogy() },
                onNext: { => this.onNext() }
            )
            .width(100.percent)
            .height(100.percent)
            .offset(y: this.offsetY())
        }
        .width(100.percent)
        .height(100.percent)
    }
}
