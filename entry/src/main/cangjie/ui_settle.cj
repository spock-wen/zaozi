package ohos_app_cangjie_entry

import kit.ArkUI.*
import ohos.arkui.state_macro_manage.*

/* 代末结算页（SPEC §2.6；设计稿 settle_gen_v1 F）。paper-100 底：
     小标 12 Bold 朱「代末」
     主标 Serif 24 Bold「第 N 代记事人放下了刻刀」
     结局胶囊 26 高（善终 jade、失败朱）
     家谱 · 添一笔：一行一代（圆点 10 + 竖线 2 + 名称 Serif 13 Bold + 字 24×24
                圆角 6 + 结局字 11 Medium + 本代「新」角标 16 高）
     这一代留下：44×44 朱 2 描边（没有字 → 「未成字」）
     传事签块：事签是 stub（本 milestone 不传）→ 整块不显示
     底部「下一代」（朱）→ 回开局挑字（纯逻辑 settleAndNextGeneration）
   家谱独立页（设计稿 G）不在本切片：「看家谱」按钮留着，点了只落一句提示。
   同样拆成小 @Component（@Component 宏展开撑不住大 build()）。 */

/* 小标「代末」12 Bold 朱（设计稿 .st0 .k）。 */
@Component
public class SettleKey {
    func build() {
        Text(SETTLE_KEY)
            .fontSize(Theme.fsBadge)
            .fontFamily(Theme.sans)
            .fontWeight(FontWeight.Bold)
            .fontColor(Theme.zhu600)
            .width(100.percent)
    }
}

/* 主标 Serif 24 Bold。 */
@Component
public class SettleTitle {
    @Prop var generation: Int64

    func text(): String {
        return settleTitleText(this.generation)
    }

    func build() {
        Text(this.text())
            .fontSize(Theme.fsSheetTitle)
            .fontFamily(Theme.serif)
            .fontWeight(FontWeight.Bold)
            .fontColor(Theme.ink900)
            .width(100.percent)
            .margin(top: 8)
    }
}

/* 结局胶囊 26 高：善终 jade-100/jade-600，失败 zhu-100/zhu-600（SPEC §2.6）。 */
@Component
public class SettleEndCapsule {
    @Prop var title: String
    @Prop var good: Bool

    func fg(): Int64 {
        if (this.good) { return Theme.jade600 }
        return Theme.zhu600
    }

    func bg(): Int64 {
        if (this.good) { return Theme.jade100 }
        return Theme.zhu100
    }

    func build() {
        Text(this.title)
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

/* 块小标题（设计稿 .blk .sec：12 Bold ink-400 字距 .12em）。 */
@Component
public class SettleSectionTitle {
    @Prop var text: String

    func build() {
        Text(this.text)
            .fontSize(Theme.fsBadge)
            .fontFamily(Theme.sans)
            .fontWeight(FontWeight.Bold)
            .fontColor(Theme.ink400)
            .width(100.percent)
    }
}

/* 家谱行里的一个字：24×24 圆角 6（SPEC §2.6；设计稿 .tl .ln .cs .chip）。 */
@Component
public class FamilyCharChip {
    @Prop var glyph: String

    func build() {
        Text(this.glyph)
            .fontSize(14)
            .fontFamily(Theme.serif)
            .fontWeight(FontWeight.Bold)
            .fontColor(Theme.ink900)
            .backgroundColor(Theme.paper50)
            .border(width: 1, color: Theme.paperLine)
            .width(24)
            .height(24)
            .borderRadius(6)
            .textAlign(TextAlign.Center)
    }
}

/* 一行一代（SPEC §2.6；设计稿 .tl .ln）。
   generation / title / good / chars 都是原始字段；now = 本代那一行
   （朱点实心 + 3 外发光 + 「新」角标）。
   行高定死 Theme.settleRowH：竖线要一行一行连下来，行高不定就连不到一起。 */
@Component
public class SettleFamilyRow {
    @Prop var generation: Int64
    @Prop var title: String
    @Prop var good: Bool
    @Prop var chars: Array<String>
    @Prop var now: Bool

    /* 圆点：常态 ink-400 描边、失败 zhu 描边、本代 zhu 实心 + 外发光。 */
    func dotFill(): Int64 {
        if (this.now) { return Theme.zhu600 }
        return Theme.paper50
    }

    func dotStroke(): Int64 {
        if (this.now || !this.good) { return Theme.zhu600 }
        return Theme.ink400
    }

    /* 结局字：善终 jade、失败 zhu，11 Medium。 */
    func endingColor(): Int64 {
        if (this.good) { return Theme.jade600 }
        return Theme.zhu600
    }

    func name(): String {
        return familyRowName(this.generation)
    }

    func none(): Bool {
        return this.chars.size == 0
    }

    func build() {
        Row {
            /* 圆点 10（贴在行顶，竖线从它下面接下去）。外发光用同色圆角块垫
               （本仓库 shadow 没验过，见 ui_box.cj 的 BoxSlotGlow）。 */
            Stack {
                if (this.now) {
                    Text("")
                        .width(Theme.familyDot + 6)
                        .height(Theme.familyDot + 6)
                        .borderRadius(8)
                        .backgroundColor(Theme.zhu100)
                }
                Text("")
                    .width(Theme.familyDot)
                    .height(Theme.familyDot)
                    .borderRadius(5)
                    .backgroundColor(this.dotFill())
                    .border(width: 2, color: this.dotStroke())
            }
            .width(Theme.familyDot + 6)
            .height(Theme.familyDot + 6)

            Column {
                Row {
                    Text(this.name())
                        .fontSize(Theme.fsStatus)
                        .fontFamily(Theme.serif)
                        .fontWeight(FontWeight.Bold)
                        .fontColor(Theme.ink900)
                    if (this.now) {
                        Text("新")
                            .fontSize(10)
                            .fontFamily(Theme.sans)
                            .fontWeight(FontWeight.Bold)
                            .fontColor(Theme.white)
                            .backgroundColor(Theme.zhu600)
                            .height(Theme.familyNewTagH)
                            .padding(left: 4, right: 4)
                            .borderRadius(4)
                            .textAlign(TextAlign.Center)
                            .margin(left: 4)
                    }
                    Blank()
                    Text(this.title)
                        .fontSize(Theme.fsStageName)
                        .fontFamily(Theme.sans)
                        .fontWeight(FontWeight.Medium)
                        .fontColor(this.endingColor())
                }
                .width(100.percent)

                /* 留下的字 24×24；一个都没落下 → 「未成字」ink-400（SPEC §3）。 */
                Row(space: 4) {
                    if (this.none()) {
                        Text(END_CHARS_NONE)
                            .fontSize(Theme.fsStageName)
                            .fontFamily(Theme.sans)
                            .fontColor(Theme.ink400)
                            .margin(top: 4)
                    } else {
                        ForEach(this.chars, itemGeneratorFunc: {g: String, i: Int64 =>
                            FamilyCharChip(glyph: g)
                        })
                    }
                }
                .width(100.percent)
                .margin(top: 4)
            }
            .layoutWeight(1)
            .margin(left: 10)
        }
        .width(100.percent)
        .height(Theme.settleRowH)
        .alignItems(VerticalAlign.Top)
        .padding(top: 6)
    }
}

/* 家谱块：竖线 2 paper-line 从第一颗圆点连到最后一颗（设计稿 .tl::before），
   行叠在上面。rows 是「最老在上、最新在下」的家谱条；thisGen = 本代代次
   （「新」角标画它身上）。至少两行：上一代（家谱里已有的）+ 本代。 */
@Component
public class SettleGenealogy {
    @Prop var rows: Array<FamilyEntry>
    @Prop var thisGen: Int64

    /* 竖线长度：从第一颗圆点中心到最后一颗圆点中心。
       圆点贴在行顶 6vp 处，圆心 = 6 + 10 / 2 = 11；每行一行高。 */
    func lineTop(): Int64 {
        return 6 + Theme.familyDot / 2 - Theme.familyLine / 2
    }

    func lineHeight(): Int64 {
        let n = this.rows.size
        if (n <= 1) { return 0 }
        return (n - 1) * Theme.settleRowH
    }

    func build() {
        Stack {
            /* 竖线：2 宽 paper-line（行高定死才连得起来，见 SettleFamilyRow）。 */
            if (this.lineHeight() > 0) {
                Text("")
                    .width(Theme.familyLine)
                    .height(this.lineHeight())
                    .backgroundColor(Theme.paperLine)
                    .margin(left: 6 + Theme.familyDot / 2 - Theme.familyLine / 2, top: this.lineTop())
            }

            Column {
                ForEach(this.rows, itemGeneratorFunc: {e: FamilyEntry, i: Int64 =>
                    SettleFamilyRow(
                        generation: e.generation,
                        title: e.endingTitle,
                        good: e.endingGood,
                        chars: familyEntryGlyphs(e),
                        now: familyIsThisGen(e, this.thisGen)
                    )
                })
            }
            .width(100.percent)
        }
        .width(100.percent)
    }
}

/* 「这一代留下」：44×44 朱 2 描边；一个都没落下 → 「未成字」。 */
@Component
public class SettleKeep {
    @Prop var chars: Array<String>

    func count(): Int64 {
        return this.chars.size
    }

    func none(): Bool {
        return this.chars.size == 0
    }

    func build() {
        Row(space: 10) {
            if (this.none()) {
                Text(END_CHARS_NONE)
                    .fontSize(Theme.fsNote)
                    .fontFamily(Theme.sans)
                    .fontColor(Theme.ink400)
                    .height(44)
            } else {
                ForEach(this.chars, itemGeneratorFunc: {g: String, i: Int64 =>
                    Text(g)
                        .fontSize(26)
                        .fontFamily(Theme.serif)
                        .fontWeight(FontWeight.Bold)
                        .fontColor(Theme.ink900)
                        .backgroundColor(Theme.paper50)
                        .border(width: 2, color: Theme.zhu600)
                        .width(44)
                        .height(44)
                        .borderRadius(8)
                        .textAlign(TextAlign.Center)
                })
            }
        }
        .width(100.percent)
        .alignItems(VerticalAlign.Center)
    }
}

/* 底部两个按钮：「看家谱」描边（家谱独立页不在本切片，点了只落提示）、
   「下一代」朱底白字 → 回开局挑字（SPEC §2.6）。 */
@Component
public class SettleBtns {
    @Prop var onGenealogy: () -> Unit
    @Prop var onNext: () -> Unit

    func build() {
        Row(space: 12) {
            Text(SETTLE_BTN_GENEALOGY)
                .fontSize(Theme.fsButton)
                .fontFamily(Theme.sans)
                .fontWeight(FontWeight.Bold)
                .fontColor(Theme.ink900)
                .height(Theme.buttonH)
                .borderRadius(22)
                .border(width: 1, color: Theme.ink400)
                .layoutWeight(1)
                .textAlign(TextAlign.Center)
                .onClick({event => this.onGenealogy()})
            Text(SETTLE_BTN_NEXT)
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

/* 一块：paper-50 底、圆角 16、1 描边 paper-line、左右外距 12、内边距 16
   （设计稿 .blk）。内容由调用方给，本组件只管这一层的版式。 */
@Component
public class SettleBlock {
    @Prop var title: String

    func build() {
        Column {
            SettleSectionTitle(text: this.title)
        }
        .width(100.percent)
        .margin(left: 12, right: 12, top: 14)
        .padding(left: 16, right: 16, top: 14, bottom: 14)
        .backgroundColor(Theme.paper50)
        .borderRadius(16)
        .border(width: 1, color: Theme.paperLine)
    }
}

/* 家谱块：小标题 + 一行一代（设计稿 F 的「家谱 · 添一笔」）。 */
@Component
public class SettleGenealogyBlock {
    @Prop var rows: Array<FamilyEntry>
    @Prop var thisGen: Int64

    func build() {
        Column {
            SettleSectionTitle(text: SETTLE_SEC_GENEALOGY)
            SettleGenealogy(rows: this.rows, thisGen: this.thisGen)
        }
        .width(100.percent)
        .margin(left: 12, right: 12, top: 14)
        .padding(left: 16, right: 16, top: 14, bottom: 14)
        .backgroundColor(Theme.paper50)
        .borderRadius(16)
        .border(width: 1, color: Theme.paperLine)
    }
}

/* 「这一代留下」块：44×44 那一排 + 「刻成 N 字」一行小字。 */
@Component
public class SettleKeepBlock {
    @Prop var chars: Array<String>

    func meta(): String {
        return settleKeepMeta(this.chars.size)
    }

    func build() {
        Column {
            SettleSectionTitle(text: SETTLE_SEC_KEEP)
            SettleKeep(chars: this.chars)
            Text(this.meta())
                .fontSize(Theme.fsStatus)
                .fontFamily(Theme.sans)
                .fontColor(Theme.ink600)
                .width(100.percent)
                .margin(top: 10)
        }
        .width(100.percent)
        .margin(left: 12, right: 12, top: 14)
        .padding(left: 16, right: 16, top: 14, bottom: 14)
        .backgroundColor(Theme.paper50)
        .borderRadius(16)
        .border(width: 1, color: Theme.paperLine)
    }
}

/* 代末结算页整页（paper-100；设计稿 .scr paper）。
   generation / title / good / rows / keepChars 全是原始字段或数组，
   文案在成员函数里拼（函数调用当 @Prop 传进来不参与重绘跟踪）。 */
@Component
public class SettleScreen {
    @Prop var generation: Int64
    @Prop var title: String
    @Prop var good: Bool
    @Prop var rows: Array<FamilyEntry>
    @Prop var keepChars: Array<String>
    @Prop var onGenealogy: () -> Unit
    @Prop var onNext: () -> Unit

    /* 传事签块：事签是 stub，本切片不显示（SPEC §2.6「没有事签时整块不显示」）。 */
    func hasShiqian(): Bool {
        return false
    }

    func build() {
        Column {
            SettleHead(
                generation: this.generation,
                title: this.title,
                good: this.good
            )

            Scroll {
                Column {
                    SettleGenealogyBlock(rows: this.rows, thisGen: this.generation)
                    SettleKeepBlock(chars: this.keepChars)
                    /* 传给下一代的事签：事签是 stub，本切片整块不显示。 */
                    if (this.hasShiqian()) {
                        SettleBlock(title: SETTLE_SEC_SHIQIAN)
                    }
                }
                .width(100.percent)
            }
            .layoutWeight(1)

            /* 自建组件不能挂链式属性（@Component 宏不认），套一层 Column
               把 margin 放容器上（同 ui_card.cj 的 GhostButton）。 */
            Column {
                SettleBtns(
                    onGenealogy: { => this.onGenealogy() },
                    onNext: { => this.onNext() }
                )
            }
            /* 容器也要给宽度：Column 默认 alignItems 是 Center，不写 100%
               会缩成内容宽，里面 SettleBtns 的 100% 就没有基准了。 */
            .width(100.percent)
            .margin(left: 12, right: 12, bottom: 16, top: 12)
        }
        .width(100.percent)
        .height(100.percent)
        .backgroundColor(Theme.paper100)
    }
}

/* 页头：小标「代末」+ 主标 + 结局胶囊（设计稿 .st0）。 */
@Component
public class SettleHead {
    @Prop var generation: Int64
    @Prop var title: String
    @Prop var good: Bool

    func build() {
        Column {
            SettleKey()
            SettleTitle(generation: this.generation)
            SettleEndCapsule(title: this.title, good: this.good)
        }
        .width(100.percent)
        .padding(left: Theme.insetNight, right: Theme.insetNight, top: 16)
    }
}


/* 「看家谱」的底部小提示（家谱独立页不在本切片）。从 index.cj 的 build() 拆出来，
   让根 build() 保持小（@Component 宏展开对大 build() 敏感）。点一下关掉。 */
@Component
public class StubHint {
    @Prop var text: String
    @Prop var onClose: () -> Unit

    func build() {
        Text(this.text)
            .fontSize(Theme.fsNote)
            .fontFamily(Theme.sans)
            .fontColor(Theme.onNight)
            .backgroundColor(Theme.night800)
            .height(32)
            .padding(left: 12, right: 12)
            .borderRadius(16)
            .textAlign(TextAlign.Center)
            .align(Alignment.Bottom)
            .margin(bottom: 60)
            .onClick({event => this.onClose()})
    }
}
