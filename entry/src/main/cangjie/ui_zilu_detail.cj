package ohos_app_cangjie_entry

import kit.ArkUI.*
import ohos.arkui.state_macro_manage.*

/* 字录详情卡（从 ZiluScreen.build() 拆出）：大字 + 公式行 + 白话字义 + 典籍
   + 古字形演变（点一格 → 放大卡）+ 小故事 + 效果。
   拆分的理由同 ui_zilu_nav.cj：ZiluScreen 原来单个 build() 太大，
   DevEco 上 @Component 宏展开失败。这里再往下拆一层：
   字头行 → ZiluGlyphHead，效果行 → ZiluEffectRow。 */

/* 字头行：112×112 大字方块 + 造法徽标 / 公式行 / 造于 / 记事人 / 再看一次。 */
@Component
public class ZiluGlyphHead {
    @Prop var selectedId: String
    @Prop var onGoCard: () -> Unit

    /* build() 里不能有顶层 let（@Component 宏展开会失败），取值都走成员函数。
       这两个函数都是纯函数，反复调用结果一致。 */
    func ziluFirst(): GlyphRow {
        return GlyphCatalog.ofChar(this.selectedId)[0]
    }

    func ziluParts(): Array<String> {
        return formulaParts(this.selectedId)
    }

    func build() {
        Row {
            /* 大字方块 112 × 112 */
            Column {
                Text(this.ziluFirst().glyph)
                    .fontSize(Theme.fsZiluBig)
                    .fontFamily(Theme.serif)
                    .fontWeight(FontWeight.Bold)
                    .fontColor(Theme.ink900)
            }
            .width(Theme.ziluBigBox)
            .height(Theme.ziluBigBox)
            .borderRadius(14)
            .backgroundColor(Theme.bone100)
            .border(width: 1, color: Theme.bone300)
            .justifyContent(FlexAlign.Center)
            .alignItems(HorizontalAlign.Center)

            Column(space: 8) {
                MethodBadge(method: this.ziluFirst().method)
                Row {
                    if (this.ziluParts().size > 0) {
                        ForEach(this.ziluParts(), itemGeneratorFunc: {p: String, i: Int64 =>
                            Row {
                                if (i > 0) {
                                    Text("＋")
                                        .fontSize(14)
                                        .fontFamily(Theme.sans)
                                        .fontColor(Theme.ink600)
                                        .margin(left: 6, right: 6)
                                }
                                PartChip(glyph: p)
                            }
                            .alignItems(VerticalAlign.Center)
                        })
                    } else {
                        Text(formulaText(this.selectedId))
                            .fontSize(14)
                            .fontFamily(Theme.sans)
                            .fontWeight(FontWeight.Bold)
                            .fontColor(Theme.ink600)
                    }
                }
                .alignItems(VerticalAlign.Center)
                Text("造于 ${CARD_GEN_LINE}")
                    .fontSize(12)
                    .fontFamily(Theme.sans)
                    .fontColor(Theme.ink600)
                Text("记事人 阿禾")
                    .fontSize(12)
                    .fontFamily(Theme.sans)
                    .fontColor(Theme.ink600)
                Text(ZILU_REPLAY)
                    .fontSize(12)
                    .fontFamily(Theme.sans)
                    .fontColor(Theme.ink900)
                    .height(26)
                    .padding(left: 10, right: 10)
                    .borderRadius(13)
                    .border(width: 1, color: Theme.ink400)
                    .textAlign(TextAlign.Center)
                    .onClick({event => this.onGoCard()})
            }
            .layoutWeight(1)
            .margin(left: 16)
        }
        .width(100.percent)
    }
}

/* 效果行：左侧小胶囊标签 + 右侧正文。 */
@Component
public class ZiluEffectRow {
    @Prop var label: String
    @Prop var text: String

    func build() {
        Row {
            Text(this.label)
                .fontSize(Theme.fsBadge)
                .fontFamily(Theme.sans)
                .fontWeight(FontWeight.Bold)
                .fontColor(Theme.ink900)
                .backgroundColor(Theme.paper200)
                .height(22)
                .padding(left: 8, right: 8)
                .borderRadius(6)
                .textAlign(TextAlign.Center)
            Text(this.text)
                .fontSize(Theme.fsEffect)
                .fontFamily(Theme.serif)
                .fontColor(Theme.ink900)
                .layoutWeight(1)
                .margin(left: 10)
        }
        .width(100.percent)
        .margin(top: 8)
        .alignItems(VerticalAlign.Center)
    }
}

/* 详情卡本体。showPop / popIndex 由父组件 ZiluScreen 的 @State 推下来，
   放大卡里的上一格 / 下一格也回调回父组件改 popIndex。 */
@Component
public class ZiluDetailCard {
    @Prop var selectedId: String
    @Prop var showPop: Bool
    @Prop var popIndex: Int64
    @Prop var onGoCard: () -> Unit
    @Prop var onEvoSelect: (Int64) -> Unit
    @Prop var onPrev: () -> Unit
    @Prop var onNext: () -> Unit

    /* build() 里不能有顶层 let（@Component 宏展开会失败），取值都走成员函数。
       这些函数都是纯函数，反复调用结果一致。 */
    func ziluCopy(): ZiluCopy {
        return ziluCopyOf(this.selectedId)
    }

    func ziluEffects(): Array<EffectRow> {
        return this.ziluCopy().effects
    }

    /* 放大卡下标：越界时退回第 0 格。 */
    func popIndexSafe(): Int64 {
        if (this.popIndex < buildDetailStrip(this.selectedId).cells.size) {
            return this.popIndex
        }
        return 0
    }

    func build() {
        Column {
            ZiluGlyphHead(
                selectedId: this.selectedId,
                onGoCard: { => this.onGoCard() }
            )

            /* 白话字义 */
            if (this.ziluCopy().hasMeaning()) {
                Column {
                    SectionHead(title: ZILU_SEC_MEANING, hint: "")
                    Text(this.ziluCopy().meaning)
                        .fontSize(Theme.fsBody)
                        .fontFamily(Theme.serif)
                        .fontColor(Theme.ink900)
                        .width(100.percent)
                        .margin(top: 8)
                }
                .width(100.percent)
                .margin(top: 16)
            }

            /* 典籍：查不到就整块不显示 */
            if (this.ziluCopy().hasClassic()) {
                Column {
                    SectionHead(title: ZILU_SEC_CLASSIC, hint: "")
                    Row {
                        Row()
                            .width(3)
                            .height(40)
                            .backgroundColor(Theme.bone300)
                        Text(this.ziluCopy().classic)
                            .fontSize(Theme.fsBody)
                            .fontFamily(Theme.serif)
                            .fontColor(Theme.ink900)
                            .layoutWeight(1)
                            .margin(left: 12)
                    }
                    .width(100.percent)
                    .margin(top: 8)
                    Text(this.ziluCopy().classicSource)
                        .fontSize(12)
                        .fontFamily(Theme.sans)
                        .fontColor(Theme.ink400)
                        .margin(left: 15, top: 4)
                }
                .width(100.percent)
                .margin(top: 16)
            }

            /* 古字形演变：标准档 M，点一格放大 */
            Column {
                SectionHead(title: ZILU_SEC_EVO, hint: ZILU_SEC_EVO_HINT)
                Column {
                    EvoStripView(
                        tierOpt: Some(EvoTier.M),
                        charId: this.selectedId,
                        dark: false,
                        selectedIndex: this.popIndexSafe(),
                        playedUpTo: 99,
                        showBaihua: false,
                        tappable: true,
                        onSelect: {i => this.onEvoSelect(i)}
                    )
                }
                .margin(top: 10)

                /* —— 放大卡：宽 188，字形区 144×144 圆角 14 —— */
                if (this.showPop) {
                    ZiluPopCard(
                        charId: this.selectedId,
                        popIndex: this.popIndexSafe(),
                        onPrev: { => this.onPrev() },
                        onNext: { => this.onNext() }
                    )
                }
            }
            .width(100.percent)
            .margin(top: 16)

            /* 小故事 */
            if (this.ziluCopy().hasStory()) {
                Column {
                    SectionHead(title: ZILU_SEC_STORY, hint: "")
                    Text(this.ziluCopy().story)
                        .fontSize(Theme.fsBody)
                        .fontFamily(Theme.serif)
                        .fontColor(Theme.ink900)
                        .width(100.percent)
                        .margin(top: 8)
                }
                .width(100.percent)
                .margin(top: 16)
            }

            /* 效果 */
            if (this.ziluCopy().hasEffects()) {
                Column {
                    SectionHead(title: ZILU_SEC_EFFECT, hint: "")
                    ForEach(this.ziluEffects(), itemGeneratorFunc: {row: EffectRow, _: Int64 =>
                        ZiluEffectRow(label: row.label, text: row.text)
                    })
                }
                .width(100.percent)
                .margin(top: 16)
            }
        }
        .width(100.percent)
        .padding(Theme.cardPad)
        .backgroundColor(Theme.paper50)
        .borderRadius(Theme.cardRadius)
        .border(width: 1, color: Theme.paperLine)
        .margin(top: Theme.insetPaper)
    }
}
