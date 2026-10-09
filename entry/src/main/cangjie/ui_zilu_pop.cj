package ohos_app_cangjie_entry

import kit.ArkUI.*
import ohos.arkui.state_macro_manage.*

/* 放大卡（SPEC §5「放大卡」）：宽 188，字形区 144×144 圆角 14；
   标题「阶段名 · 时代」Serif 14 Bold；白话 Serif 12；出处 10 ink-400；
   左右按钮切换阶段（设计稿的左右滑动用按钮代替，见 UI_NOTES）。 */

@Component
public class ZiluPopCard {
    @Prop var charId: String
    @Prop var popIndex: Int64
    @Prop var onPrev: () -> Unit
    @Prop var onNext: () -> Unit

    func build() {
        let strip = buildDetailStrip(this.charId)
        let pi = if (this.popIndex < strip.cells.size) { this.popIndex } else { 0 }
        let cell = strip.cells.at(pi)

        Column {
            /* 字形区 144 × 144 */
            Column {
                if (cell.isOld()) {
                    Image(glyphResource(cell.asset))
                        .width(Theme.popGlyphBox)
                        .height(Theme.popGlyphBox)
                        .objectFit(ImageFit.Contain)
                        .fillColor(Theme.carve)
                } else {
                    Text(cell.glyph)
                        .fontSize(Theme.popGlyphBox * 4 / 5)
                        .fontFamily(Theme.serif)
                        .fontWeight(FontWeight.Bold)
                        .fontColor(Theme.ink900)
                }
            }
            .width(Theme.popGlyphBox)
            .height(Theme.popGlyphBox)
            .borderRadius(Theme.popGlyphRadius)
            .backgroundColor(Theme.bone100)
            .border(width: 1, color: Theme.bone300)
            .justifyContent(FlexAlign.Center)
            .alignItems(HorizontalAlign.Center)

            /* 标题「阶段名 · 时代」 */
            Text(if (cell.era.size > 0) { "${cell.name} · ${cell.era}" } else { cell.name })
                .fontSize(Theme.fsPopTitle)
                .fontFamily(Theme.serif)
                .fontWeight(FontWeight.Bold)
                .fontColor(Theme.ink900)
                .width(100.percent)
                .margin(top: 12)

            /* 白话 Serif 12 */
            if (cell.baihua.size > 0) {
                Text(cell.baihua[0])
                    .fontSize(Theme.fsPopBaihua)
                    .fontFamily(Theme.serif)
                    .fontColor(Theme.ink900)
                    .width(100.percent)
                    .margin(top: 6)
            }
            if (cell.baihua.size > 1) {
                Text(cell.baihua[1])
                    .fontSize(Theme.fsPopBaihua)
                    .fontFamily(Theme.serif)
                    .fontColor(Theme.ink900)
                    .width(100.percent)
            }

            /* 出处 10 ink-400 */
            if (cell.sourceLabel.size > 0) {
                Text("出处：${cell.sourceLabel}")
                    .fontSize(Theme.fsPopSource)
                    .fontFamily(Theme.sans)
                    .fontColor(Theme.ink400)
                    .width(100.percent)
                    .margin(top: 8)
            }
            if (cell.license.size > 0) {
                Text(cell.license)
                    .fontSize(Theme.fsPopSource)
                    .fontFamily(Theme.sans)
                    .fontColor(Theme.ink400)
                    .width(100.percent)
            }

            /* 上一格 / 圆点 / 下一格 */
            Row {
                Text("‹")
                    .fontSize(18)
                    .fontFamily(Theme.sans)
                    .fontColor(Theme.ink900)
                    .width(44)
                    .height(28)
                    .borderRadius(14)
                    .border(width: 1, color: Theme.ink400)
                    .textAlign(TextAlign.Center)
                    .onClick({event => this.onPrev()})
                Row {
                    ForEach(strip.cells, itemGeneratorFunc: {c: EvoCell, i: Int64 =>
                        Row()
                            .width(if (i == pi) { 16 } else { 6 })
                            .height(6)
                            .borderRadius(3)
                            .backgroundColor(if (i == pi) { Theme.zhu600 } else { Theme.paperLine })
                            .margin(left: 2, right: 2)
                    })
                }
                .layoutWeight(1)
                .justifyContent(FlexAlign.Center)
                Text("›")
                    .fontSize(18)
                    .fontFamily(Theme.sans)
                    .fontColor(Theme.ink900)
                    .width(44)
                    .height(28)
                    .borderRadius(14)
                    .border(width: 1, color: Theme.ink400)
                    .textAlign(TextAlign.Center)
                    .onClick({event => this.onNext()})
            }
            .width(100.percent)
            .margin(top: 10)
            .alignItems(HorizontalAlign.Center)
        }
        .width(Theme.popW)
        .padding(14)
        .backgroundColor(Theme.paper50)
        .borderRadius(16)
        .border(width: 1, color: Theme.paperLine)
        .margin(top: 12)
    }
}
