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
       大字 / 造法都走 zilu_model 的安全取值：字表里没这个字时返回空串，
       不越界（切分页 / 换字那一瞬 selectedId 可能还没跟上）。
       这两个函数都是纯函数，反复调用结果一致。 */
    func ziluGlyph(): String {
        return ziluGlyphOf(this.selectedId)
    }

    func ziluMethod(): String {
        return ziluMethodOf(this.selectedId)
    }

    func ziluParts(): Array<String> {
        return formulaParts(this.selectedId)
    }

    func build() {
        Row {
            /* 大字方块 112 × 112 */
            Column {
                Text(this.ziluGlyph())
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
                /* 造法徽标：原来是 MethodBadge(method: this.ziluFirst().method)，
                   函数调用传给子组件 @Prop 不被状态宏跟踪，换字不重渲染
                   （QA L3：徽标恒「会意」）→ 这里内联成 Text，样式与 MethodBadge
                   完全一致，字直接取当前选中字。MethodBadge 本身留着给别处用。 */
                Text(this.ziluMethod())
                    .fontSize(Theme.fsBadge)
                    .fontFamily(Theme.sans)
                    .fontWeight(FontWeight.Bold)
                    .fontColor(methodBadgeFg(this.ziluMethod()))
                    .backgroundColor(methodBadgeBg(this.ziluMethod()))
                    .height(22)
                    .padding(left: 8, right: 8)
                    .borderRadius(6)
                    .textAlign(TextAlign.Center)
                Row {
                    if (this.ziluParts().size > 0) {
                        /* key 带上字与下标：换字时公式行要重建。 */
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
                        }, keyGeneratorFunc: {p: String, i: Int64 =>
                            "${this.selectedId}_${i}"
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
                /* 造于 / 记事人：设计稿只在「休」给了这条记录，别的字没有 → 不显示，不编造。 */
                if (hasMadeMeta(this.selectedId)) {
                    Text("造于 ${CARD_GEN_LINE}")
                        .fontSize(12)
                        .fontFamily(Theme.sans)
                        .fontColor(Theme.ink600)
                    Text("记事人 阿禾")
                        .fontSize(12)
                        .fontFamily(Theme.sans)
                        .fontColor(Theme.ink600)
                }
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
    /* 放大卡下标：直接透传父组件的字段（不在这层做钳制，也不写成函数调用），
       越界钳制放在最底层 ZiluPopCard.popIndexSafe 里。 */
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

    /* copy_text 里 effects 是 ArrayList，ForEach 要 Array：在界面这层转一次。
       cjc 1.1.3 的 ArrayList 没有 at()，所以用下标取值。 */
    func ziluEffects(): Array<EffectRow> {
        let src = this.ziluCopy().effects
        return Array<EffectRow>(src.size, {i: Int64 => src[i]})
    }

    /* 当前字演变条的格数：0（字表里没这个字）时放大卡整块不画。 */
    func popCount(): Int64 {
        return buildDetailStrip(this.selectedId).cells.size
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
                    /* selectedIndex 直接传字段：写成 this.popIndexSafe() 时状态宏识别不到
                       对 @State popIndex 的依赖，父组件改了子组件不更新（› 就这样失效的）。 */
                    EvoStripView(
                        tierOpt: Some(EvoTier.M),
                        charId: this.selectedId,
                        dark: false,
                        selectedIndex: this.popIndex,
                        playedUpTo: 99,
                        showBaihua: false,
                        tappable: true,
                        onSelect: {i => this.onEvoSelect(i)}
                    )
                }
                .margin(top: 10)

                /* —— 放大卡：宽 188，字形区 144×144 圆角 14 ——
                   当前字一条格子都没有（切分页 / 换字那一瞬）时不画，
                   画出来也是一张空卡。 */
                if (this.showPop && this.popCount() > 0) {
                    ZiluPopCard(
                        charId: this.selectedId,
                        popIndex: this.popIndex,
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
                    /* key 带上选中字与下标：不传 keyGenerator 时按下标复用，换字不重建。 */
                    ForEach(this.ziluEffects(), itemGeneratorFunc: {row: EffectRow, i: Int64 =>
                        ZiluEffectRow(label: row.label, text: row.text)
                    }, keyGeneratorFunc: {row: EffectRow, i: Int64 =>
                        "${this.selectedId}_${i}"
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
