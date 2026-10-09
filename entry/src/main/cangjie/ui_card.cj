package ohos_app_cangjie_entry

import kit.ArkUI.*
import ohos.arkui.state_macro_manage.*

/* 造字卡（card_zaozi_v1）：
   冬夜底 · 状态栏 · 金色标签胶囊 · 事签 · 骨片（字形区 + 公式行 + 卡面档演变条）
   · 跳过提示 · 进度点 · 成字弹层。
   播放：每 600ms 进一格，交叉淡化（用 opacity 过渡）；点一下任意处 → 落定 + 弹层。
   计时器不引入 setInterval 这类未验证 API，用 yilu 里已验证的
   getUIContext().animateTo(AnimateParam(duration:, onFinish:)) 链式推进。 */

@Component
public class CardScreen {
    @Prop var onGoZilu: () -> Unit

    @State var stage: Int64 = 0
    @State var settled: Bool = false
    @State var showSheet: Bool = false
    /* 播放代次：跳过时 +1，让挂着旧代次的 onFinish 直接失效。 */
    @State var gen: Int64 = 0

    let charId: String = "xiu"

    public func aboutToAppear(): Unit {
        this.startPlay()
    }

    /* 切走时把代次 +1，让还挂着的 onFinish 直接失效，不去动已经销毁的控件。 */
    public func aboutToDisappear(): Unit {
        this.gen = this.gen + 1
    }

    func startPlay(): Unit {
        this.gen = this.gen + 1
        this.settled = false
        this.showSheet = false
        this.stage = 0
        this.schedule()
    }

    func schedule(): Unit {
        let g = this.gen
        this.getUIContext().animateTo(
            AnimateParam(duration: Theme.playStepMs, onFinish: Some({ =>
                if (g == this.gen) {
                    this.tick()
                }
            })),
            { => }
        )
    }

    func tick(): Unit {
        if (this.settled) {
            return
        }
        let last = buildCardStrip(this.charId).cells.size - 1
        if (this.stage < last) {
            this.stage = this.stage + 1
            this.schedule()
        } else {
            this.settle()
        }
    }

    func settle(): Unit {
        this.settled = true
        this.stage = 4096
        this.showSheet = true
    }

    /* 当前这一格（落定后停在最后一格）。 */
    func currentIndex(): Int64 {
        let last = buildCardStrip(this.charId).cells.size - 1
        if (this.stage > last) {
            return last
        }
        return this.stage
    }

    func build() {
        let strip = buildCardStrip(this.charId)
        let idx = this.currentIndex()
        let lastIdx = strip.cells.size - 1
        let parts = formulaParts(this.charId)

        Stack {
            /* —— 卡面本体：点一下跳过 —— */
            Column {
                /* 状态栏 */
                Row {
                    Text(CARD_GEN_LINE)
                        .fontSize(Theme.fsStatus)
                        .fontFamily(Theme.sans)
                        .fontColor(Theme.onNight)
                        .layoutWeight(1)
                    Text(if (this.settled) { CARD_BONE_SETTLED } else { CARD_BONE_PLAYING })
                        .fontSize(Theme.fsStatus)
                        .fontFamily(Theme.sans)
                        .fontColor(Theme.onNight2)
                }
                .width(100.percent)
                .height(44)
                .padding(left: Theme.insetNight, right: Theme.insetNight)

                /* 冬夜标签 + 事签 */
                Row {
                    Text(CARD_TAG)
                        .fontSize(Theme.fsBadge)
                        .fontFamily(Theme.sans)
                        .fontWeight(FontWeight.Bold)
                        .fontColor(Theme.gold400)
                        .height(24)
                        .padding(left: 10, right: 10)
                        .borderRadius(12)
                        .border(width: 1, color: Theme.gold400)
                        .textAlign(TextAlign.Center)
                    Blank()
                }
                .width(100.percent)
                .padding(left: Theme.insetNight, right: Theme.insetNight)

                Row {
                    Text(SHIQIAN_LABEL)
                        .fontSize(Theme.fsShiqian)
                        .fontFamily(Theme.serif)
                        .fontColor(Theme.onNight)
                    Text(SHIQIAN_BODY)
                        .fontSize(Theme.fsShiqian)
                        .fontFamily(Theme.serif)
                        .fontColor(Theme.onNight2)
                        .layoutWeight(1)
                        .maxLines(3)
                }
                .width(100.percent)
                .padding(left: Theme.insetNight, right: Theme.insetNight, top: 10)

                /* —— 骨片 328 × 356，四角不等圆角 —— */
                Stack {
                    /* 跳过提示（骨片右上角，绝对定位在 Stack 顶部） */
                    Row {
                        Blank()
                        Text(CARD_SKIP_HINT)
                            .fontSize(11)
                            .fontFamily(Theme.sans)
                            .fontColor(Theme.ink400)
                            .margin(right: 14, top: 12)
                    }
                    .width(100.percent)
                    .height(24)
                    .align(Alignment.TopEnd)

                    Column {
                        /* 字形区 176 × 176 */
                        Column {
                            if (idx == lastIdx) {
                                Text(strip.cells[idx].glyph)
                                    .fontSize(Theme.fsGlyphHero)
                                    .fontFamily(Theme.serif)
                                    .fontWeight(FontWeight.Bold)
                                    .fontColor(Theme.ink900)
                            } else {
                                Image(glyphResource(strip.cells[idx].asset))
                                    .width(Theme.boneGlyphBox)
                                    .height(Theme.boneGlyphBox)
                                    .objectFit(ImageFit.Contain)
                                    .fillColor(if (this.settled) { Theme.ink900 } else { Theme.carve })
                            }
                        }
                        .width(Theme.boneGlyphBox)
                        .height(Theme.boneGlyphBox)
                        .justifyContent(FlexAlign.Center)
                        .alignItems(HorizontalAlign.Center)
                        .margin(top: Theme.boneGlyphTop)

                        /* 公式行 */
                        Row {
                            if (parts.size > 0) {
                                ForEach(parts, itemGeneratorFunc: {p: String, i: Int64 =>
                                    Row {
                                        if (i > 0) {
                                            Text("＋")
                                                .fontSize(14)
                                                .fontFamily(Theme.sans)
                                                .fontWeight(FontWeight.Bold)
                                                .fontColor(Theme.ink600)
                                                .margin(left: 8, right: 8)
                                        }
                                        PartChip(glyph: p)
                                    }
                                    .alignItems(HorizontalAlign.Center)
                                })
                            } else {
                                Text(formulaText(this.charId))
                                    .fontSize(14)
                                    .fontFamily(Theme.sans)
                                    .fontWeight(FontWeight.Bold)
                                    .fontColor(Theme.ink600)
                            }
                        }
                        .width(100.percent)
                        .height(32)
                        .margin(top: 12)
                        .justifyContent(FlexAlign.Center)
                        .alignItems(HorizontalAlign.Center)

                        /* 卡面档演变条：只显示阶段名 */
                        Column {
                            EvoStripView(
                                tierOpt: Some(EvoTier.C),
                                charId: this.charId,
                                dark: false,
                                selectedIndex: idx,
                                playedUpTo: idx,
                                showBaihua: false,
                                tappable: false,
                                onSelect: {_ => }
                            )
                        }
                        .margin(top: 20)
                    }
                    .width(Theme.boneW)
                    .height(Theme.boneH)
                    .backgroundColor(Theme.bone100)
                    .borderRadius(topLeft: 30, topRight: 22, bottomRight: 34, bottomLeft: 20)
                    .border(width: 1, color: Theme.bone300)
                    .padding(left: Theme.cardPad, right: Theme.cardPad)
                }
                .width(100.percent)
                .margin(top: 16)

                /* 提示 + 进度点 */
                Text(CARD_HINT)
                    .fontSize(12)
                    .fontFamily(Theme.sans)
                    .fontColor(Theme.onNight2)
                    .margin(top: 18)
                Row {
                    ForEach(strip.cells, itemGeneratorFunc: {cell: EvoCell, i: Int64 =>
                        Row()
                            .width(if (i == idx) { 18 } else { 6 })
                            .height(6)
                            .borderRadius(3)
                            .backgroundColor(if (i == idx) { Theme.gold400 } else { Theme.nightLine })
                            .margin(left: 3, right: 3)
                    })
                }
                .width(100.percent)
                .margin(top: 10)
                .justifyContent(FlexAlign.Center)
            }
            .width(100.percent)
            .height(100.percent)
            .backgroundColor(Theme.night900)
            .onClick({event => this.skip()})

            /* —— 成字弹层：遮罩 45% 黑 + 上滑 240ms —— */
            /* 遮罩在卡面之上、弹层之下 */
            if (this.showSheet) {
                Column()
                    .width(100.percent)
                    .height(100.percent)
                    .backgroundColor(Theme.scrimBlack45)
            }

            /* 弹层贴底 */
            if (this.showSheet) {
                Column {
                    Column {
                        /* 把手 36 × 4 */
                        Row()
                            .width(36)
                            .height(4)
                            .borderRadius(2)
                            .backgroundColor(Theme.paperLine)
                        Text(CARD_SHEET_KEY)
                            .fontSize(Theme.fsSectionTitle)
                            .fontFamily(Theme.sans)
                            .fontWeight(FontWeight.Bold)
                            .fontColor(Theme.zhu600)
                            .width(100.percent)
                            .margin(top: 14)
                        Text(CARD_SHEET_TITLE)
                            .fontSize(Theme.fsSheetTitle)
                            .fontFamily(Theme.serif)
                            .fontWeight(FontWeight.Bold)
                            .fontColor(Theme.ink900)
                            .width(100.percent)
                            .margin(top: 8)
                        Row {
                            PartChip(glyph: "人")
                            Text("＋")
                                .fontSize(14)
                                .fontFamily(Theme.sans)
                                .fontColor(Theme.ink600)
                                .margin(left: 8, right: 8)
                            PartChip(glyph: "木")
                            Text(CARD_SHEET_SUB)
                                .fontSize(13)
                                .fontFamily(Theme.sans)
                                .fontColor(Theme.ink600)
                                .margin(left: 8)
                        }
                        .width(100.percent)
                        .margin(top: 10)
                        .alignItems(HorizontalAlign.Center)

                        /* 记忆数值条 */
                        Row {
                            Text(CARD_MEMORY_LABEL)
                                .fontSize(14)
                                .fontFamily(Theme.sans)
                                .fontColor(Theme.ink600)
                                .layoutWeight(1)
                            Text(CARD_MEMORY_BAR)
                                .fontSize(16)
                                .fontFamily(Theme.sans)
                                .fontWeight(FontWeight.Bold)
                                .fontColor(Theme.ink900)
                            Text(CARD_MEMORY_DELTA)
                                .fontSize(13)
                                .fontFamily(Theme.sans)
                                .fontColor(Theme.white)
                                .backgroundColor(Theme.zhu600)
                                .height(24)
                                .padding(left: 8, right: 8)
                                .borderRadius(12)
                                .margin(left: 10)
                                .textAlign(TextAlign.Center)
                        }
                        .width(100.percent)
                        .height(52)
                        .borderRadius(12)
                        .backgroundColor(Theme.paper100)
                        .border(width: 1, color: Theme.paper200)
                        .padding(left: 16, right: 16)
                        .margin(top: 16)
                        .alignItems(HorizontalAlign.Center)

                        Text(CARD_SHEET_META)
                            .fontSize(12)
                            .fontFamily(Theme.sans)
                            .fontColor(Theme.ink400)
                            .width(100.percent)
                            .margin(top: 10)

                        Row {
                            Column {
                                GhostButton(label: CARD_BTN_ZILU, onTap: { => this.onGoZilu() })
                            }
                            .layoutWeight(1)
                            .margin(right: 6)
                            Column {
                                PrimaryButton(label: CARD_BTN_CONTINUE, onTap: { => this.startPlay() })
                            }
                            .layoutWeight(1)
                            .margin(left: 6)
                        }
                        .width(100.percent)
                        .margin(top: 18)
                    }
                    .width(100.percent)
                    .padding(left: 20, right: 20, top: 10, bottom: 20)
                    .backgroundColor(Theme.paper50)
                    .borderRadius(topLeft: Theme.sheetRadius, topRight: Theme.sheetRadius)
                }
                .width(100.percent)
                .height(100.percent)
                .justifyContent(FlexAlign.End)
            }
        }
        .width(100.percent)
        .height(100.percent)
    }
}
