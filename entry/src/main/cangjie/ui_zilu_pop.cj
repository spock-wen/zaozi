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

    /* build() 里不能有顶层 let（@Component 宏展开会失败），取值都走成员函数。
       popIndex 越界时退回第 0 格。 */
    func popStrip(): EvoStrip {
        return buildDetailStrip(this.charId)
    }

    func popIndexSafe(): Int64 {
        if (this.popIndex < this.popStrip().cells.size) {
            return this.popIndex
        }
        return 0
    }

    func popCell(): EvoCell {
        return this.popStrip().cells.at(this.popIndexSafe())
    }

    func build() {
        Column {
            /* 字形区 144 × 144 */
            Column {
                if (this.popCell().isOld()) {
                    Image(glyphResource(this.popCell().asset))
                        .width(Theme.popGlyphBox)
                        .height(Theme.popGlyphBox)
                        .objectFit(ImageFit.Contain)
                        .fillColor(Theme.carve)
                } else {
                    Text(this.popCell().glyph)
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
            Text(if (this.popCell().era.size > 0) { "${this.popCell().name} · ${this.popCell().era}" } else { this.popCell().name })
                .fontSize(Theme.fsPopTitle)
                .fontFamily(Theme.serif)
                .fontWeight(FontWeight.Bold)
                .fontColor(Theme.ink900)
                .width(100.percent)
                .margin(top: 12)

            /* 白话 Serif 12 */
            if (this.popCell().baihua.size > 0) {
                Text(this.popCell().baihua[0])
                    .fontSize(Theme.fsPopBaihua)
                    .fontFamily(Theme.serif)
                    .fontColor(Theme.ink900)
                    .width(100.percent)
                    .margin(top: 6)
            }
            if (this.popCell().baihua.size > 1) {
                Text(this.popCell().baihua[1])
                    .fontSize(Theme.fsPopBaihua)
                    .fontFamily(Theme.serif)
                    .fontColor(Theme.ink900)
                    .width(100.percent)
            }

            /* 出处 10 ink-400 */
            if (this.popCell().sourceLabel.size > 0) {
                Text("出处：${this.popCell().sourceLabel}")
                    .fontSize(Theme.fsPopSource)
                    .fontFamily(Theme.sans)
                    .fontColor(Theme.ink400)
                    .width(100.percent)
                    .margin(top: 8)
            }
            if (this.popCell().license.size > 0) {
                Text(this.popCell().license)
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
                    ForEach(this.popStrip().cells, itemGeneratorFunc: {c: EvoCell, i: Int64 =>
                        Row()
                            .width(if (i == this.popIndexSafe()) { 16 } else { 6 })
                            .height(6)
                            .borderRadius(3)
                            .backgroundColor(if (i == this.popIndexSafe()) { Theme.zhu600 } else { Theme.paperLine })
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
