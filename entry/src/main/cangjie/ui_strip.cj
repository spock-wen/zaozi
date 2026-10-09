package ohos_app_cangjie_entry

import kit.ArkUI.*
import ohos.arkui.state_macro_manage.*

/* 演变条（evo_strip_v1）界面 + 演示屏。
   格子全部来自 evo_model.buildEvoStrip：没有字形的阶段不出格，
   右边空出来的地方什么都不放，不写「暂缺」（SPEC §5 空格规则）。
   古字形走 glyph_res.glyphResource(asset) 的 rawfile 资源。 */

@Component
public class EvoStripView {
    /* None = 自动档（6 格用 S，否则 M）；Some(EvoTier.C) = 造字卡卡面档。 */
    @Prop var tierOpt: Option<EvoTier>
    @Prop var charId: String
    @Prop var dark: Bool
    /* 选中格（-1 表示没有选中）。 */
    @Prop var selectedIndex: Int64
    /* 已播到第几格；大于它的格透明度 38%。 */
    @Prop var playedUpTo: Int64
    @Prop var showBaihua: Bool
    @Prop var tappable: Bool
    @Prop var onSelect: (Int64) -> Unit

    func build() {
        let strip = buildEvoStrip(this.charId, this.tierOpt)
        Row {
            ForEach(strip.cells, itemGeneratorFunc: {cell: EvoCell, index: Int64 =>
                Column {
                    /* —— 格子：圆角 10，描边 1，底 bone-100；深底 night-700 —— */
                    Column {
                        if (cell.isOld()) {
                            Image(glyphResource(cell.asset))
                                .width(strip.cellSize)
                                .height(strip.cellSize)
                                .objectFit(ImageFit.Contain)
                                .fillColor(if (this.dark) { Theme.glyphNight } else { Theme.carve })
                        } else {
                            Text(cell.glyph)
                                .fontSize(strip.cellSize * 4 / 5)
                                .fontFamily(if (cell.kind == EvoCellKind.Trad) { Theme.serifTC } else { Theme.serif })
                                .fontWeight(FontWeight.Bold)
                                .fontColor(if (this.dark) { Theme.onNight } else { Theme.ink900 })
                        }
                    }
                    .width(strip.cellSize)
                    .height(strip.cellSize)
                    .borderRadius(Theme.evoRadius)
                    .backgroundColor(if (this.dark) { Theme.night700 } else { Theme.bone100 })
                    .border(
                        width: if (index == this.selectedIndex) { Theme.evoSelectedBorder } else { 1 },
                        color: if (index == this.selectedIndex) { Theme.zhu600 }
                            else { if (this.dark) { Theme.nightLine } else { Theme.bone300 } }
                    )
                    .opacity(if (index > this.playedUpTo) { Theme.evoDimOpacity } else { 1.0 })
                    .justifyContent(FlexAlign.Center)
                    .alignItems(HorizontalAlign.Center)
                    .onClick({event =>
                        if (this.tappable) {
                            this.onSelect(index)
                        }
                    })

                    /* —— 阶段名（卡面档 10，其余 11）—— */
                    Text(cell.name)
                        .fontSize(if (strip.tier == EvoTier.C) { Theme.fsStageNameCard } else { Theme.fsStageName })
                        .fontFamily(Theme.sans)
                        .fontWeight(FontWeight.Bold)
                        .fontColor(if (this.dark) { Theme.onNight } else { Theme.ink900 })
                        .maxLines(1)
                        .margin(top: Theme.evoLabelGap)

                    /* —— 时代行：最后一格不写 —— */
                    if (cell.era.size > 0) {
                        Text(cell.era)
                            .fontSize(Theme.fsEra)
                            .fontFamily(Theme.sans)
                            .fontColor(if (this.dark) { Theme.onNight2 } else { Theme.ink400 })
                            .maxLines(1)
                    }

                    /* —— 白话行：每阶段一行，最多两行，每行 ≤5 字 —— */
                    if (this.showBaihua && cell.baihua.size > 0) {
                        Text(cell.baihua[0])
                            .fontSize(Theme.fsBaihua)
                            .fontFamily(Theme.serif)
                            .fontColor(if (this.dark) { Theme.onNight2 } else { Theme.ink600 })
                            .maxLines(1)
                            .width(strip.cellSize + strip.gap - 2)
                            .textAlign(TextAlign.Center)
                        if (cell.baihua.size > 1) {
                            Text(cell.baihua[1])
                                .fontSize(Theme.fsBaihua)
                                .fontFamily(Theme.serif)
                                .fontColor(if (this.dark) { Theme.onNight2 } else { Theme.ink600 })
                                .maxLines(1)
                                .width(strip.cellSize + strip.gap - 2)
                                .textAlign(TextAlign.Center)
                        }
                    }
                }
                .width(strip.cellSize)
                .margin(right: strip.gap)
                .alignItems(HorizontalAlign.Center)
            })
        }
        .alignItems(HorizontalAlign.Top)
        .justifyContent(FlexAlign.Start)
    }
}

/* 演示屏：休（5 格 M）、本（4 格，无甲骨文）、从（6 格 S），浅底 + 深底各一份。 */
@Component
public class EvoStripScreen {
    func build() {
        Scroll {
            Column(space: 16) {
                ForEach(
                    Array<String>(["xiu", "ben", "cong"]),
                    itemGeneratorFunc: {charId: String, _: Int64 =>
                        Column(space: 12) {
                            Text(stripCaption(charId))
                                .fontSize(Theme.fsBody)
                                .fontFamily(Theme.sans)
                                .fontWeight(FontWeight.Bold)
                                .fontColor(Theme.ink900)
                                .width(100.percent)

                            /* 浅底 */
                            Column(space: 8) {
                                EvoStripView(
                                    tierOpt: None,
                                    charId: charId,
                                    dark: false,
                                    selectedIndex: -1,
                                    playedUpTo: 99,
                                    showBaihua: true,
                                    tappable: false,
                                    onSelect: {_ => }
                                )
                            }
                            .width(100.percent)
                            .padding(12)
                            .backgroundColor(Theme.paper50)
                            .borderRadius(12)
                            .border(width: 1, color: Theme.paperLine)

                            /* 深底 */
                            Column(space: 8) {
                                EvoStripView(
                                    tierOpt: None,
                                    charId: charId,
                                    dark: true,
                                    selectedIndex: -1,
                                    playedUpTo: 99,
                                    showBaihua: true,
                                    tappable: false,
                                    onSelect: {_ => }
                                )
                            }
                            .width(100.percent)
                            .padding(12)
                            .backgroundColor(Theme.night800)
                            .borderRadius(12)
                        }
                        .width(100.percent)
                    }
                )
                Text("空格规则：没有字形的阶段不出格，后面的格依次前移；格子从左排，宽度不拉伸。")
                    .fontSize(Theme.fsNote)
                    .fontFamily(Theme.sans)
                    .fontColor(Theme.ink400)
                    .width(100.percent)
                    .margin(top: 4)
            }
            .width(100.percent)
            .padding(12)
        }
        .layoutWeight(1)
        .backgroundColor(Theme.paper100)
    }
}

/* 「休 · 5 格 · M 档」这类说明文字。 */
public func stripCaption(charId: String): String {
    let strip = buildEvoStrip(charId, None)
    let tierName = if (strip.tier == EvoTier.C) { "C" } else { if (strip.tier == EvoTier.S) { "S" } else { "M" } }
    return "${strip.glyph} · ${strip.cells.size} 格 · ${tierName} 档"
}
