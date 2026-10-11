package ohos_app_cangjie_entry

import kit.ArkUI.*
import ohos.arkui.state_macro_manage.*
import std.collection.ArrayList

/* 开局挑字页（SPEC §2.4 开局挑字页；设计稿 ziku_pick_v1 D 屏）。
   拆成多个小 @Component，每个 build() 只摆一层（DevEco 上 @Component 宏展开
   撑不住大 build()，见 ui_zilu.cj 顶上的说明）：
     PickStatLine  顶行「第 N 代 · 开局」+「第 N 代记事人」
     PickBigSlot   三个大格之一（64×64，空 = 虚线；满 = 字 + 朱序号）
     PickBigSlots  大格行（paper-50 卡）
     PickCellView  网格单格（60×60，选中加朱边 + 朱序号 18）
     PickGrid      网格（同字录：60×60、间距 9、一行 5 格）
     PickFootBtn   底部主按钮（灰「还差 N 个字」/ 朱「就带这些开局」）
     PickScreen    组装 + 自己的 @State（picked）
   挑字规则（挑/收回/上限 3/不足 3 个字）与落定都在 run_state.cj，这里只摆版式。 */

/* 顶行：左「第 N 代 · 开局」，右「第 N 代记事人」（设计稿 .stat）。
   代次是原始字段，文案在子组件里拼（函数调用当 @Prop 传进来不参与重绘跟踪）。 */
@Component
public class PickStatLine {
    @Prop var generation: Int64

    func genLine(): String {
        return PICK_GEN_LINE.replace("N", "${this.generation}")
    }

    func recorder(): String {
        return PICK_RECORDER.replace("N", "${this.generation}")
    }

    func build() {
        Row {
            Text(this.genLine)
                .fontSize(Theme.fsStatus)
                .fontFamily(Theme.sans)
                .fontColor(Theme.ink900)
                .layoutWeight(1)
            Text(this.recorder)
                .fontSize(Theme.fsStatus)
                .fontFamily(Theme.sans)
                .fontColor(Theme.ink600)
        }
        .width(100.percent)
        .height(44)
        .border(width: 1, color: Theme.paperLine)
    }
}

/* 一个大格：空 = 1.5 虚线 + 「＋」；满 = 字（Serif 30 Bold）+ 右上角朱序号。
   点满的格子就是把这个字收回（SPEC §2.4：挑字入字匣）。 */
@Component
public class PickBigSlot {
    @Prop var glyph: String
    /* 0 = 空格；>0 = 第几个挑的（右上角序号）。 */
    @Prop var order: Int64
    @Prop var onTap: () -> Unit

    func filled(): Bool {
        return this.glyph.size > 0
    }

    func build() {
        Column {
            Text(if (this.filled()) { this.glyph } else { PICK_SLOT_EMPTY })
                .fontSize(if (this.filled()) { Theme.fsGridChar } else { 20 })
                .fontFamily(if (this.filled()) { Theme.serif } else { Theme.sans })
                .fontWeight(FontWeight.Bold)
                .fontColor(if (this.filled()) { Theme.ink900 } else { Theme.ink400 })
            if (this.order > 0) {
                Text("${this.order}")
                    .fontSize(11)
                    .fontFamily(Theme.sans)
                    .fontWeight(FontWeight.Bold)
                    .fontColor(Theme.white)
                    .backgroundColor(Theme.zhu600)
                    .width(18)
                    .height(18)
                    .borderRadius(9)
                    .textAlign(TextAlign.Center)
                    .align(Alignment.TopEnd)
                    .offset(x: 5, y: -5)
            }
        }
        .width(64)
        .height(64)
        .borderRadius(14)
        .backgroundColor(if (this.filled()) { Theme.bone100 } else { Theme.paper50 })
        .border(
            width: if (this.filled()) { 2 } else { 1 },
            color: if (this.filled()) { Theme.zhu600 } else { Theme.paperLine },
            style: if (this.filled()) { BorderStyle.Solid } else { BorderStyle.Dashed }
        )
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .onClick({event => this.onTap()})
    }
}

/* 三个大格（64×64、间距 12），按挑选顺序从左到右排。 */
@Component
public class PickBigSlots {
    @Prop var picked: Array<String>
    @Prop var onRemove: (String) -> Unit

    func slotAt(i: Int64): String {
        if (i >= 0 && i < this.picked.size) { return this.picked[i] }
        return ""
    }

    func caption(i: Int64): String {
        if (this.slotAt(i).size > 0) { return "第 ${i + 1} 格" }
        return "点下方的字"
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
        Row(space: 12) {
            ForEach(this.slotIndexes(), itemGeneratorFunc: {i: Int64, at: Int64 =>
                Column {
                    PickBigSlot(
                        glyph: this.slotAt(i),
                        order: if (this.slotAt(i).size > 0) { i + 1 } else { 0 },
                        onTap: { => this.onRemove(this.slotAt(i)) }
                    )
                    Text(this.caption(i))
                        .fontSize(Theme.fsStageName)
                        .fontFamily(Theme.sans)
                        .fontColor(Theme.ink600)
                        .margin(top: 6)
                }
            })
        }
        .width(100.percent)
        .padding(14)
        .borderRadius(16)
        .backgroundColor(Theme.paper50)
        .border(width: 1, color: Theme.paperLine)
        .margin(top: 14)
    }
}

/* 网格单格：已造显字（可挑），其余显「?」；挑中的加朱边 + 右上角朱序号 18。 */
@Component
public class PickCellView {
    @Prop var glyph: String
    /* 0 已造 / 1 有事签 / 2 有残片 / 3 未知（与 ziluStateCode 一致）。 */
    @Prop var stateCode: Int64
    @Prop var pickable: Bool
    @Prop var order: Int64
    @Prop var onTap: () -> Unit

    func markColor(): Int64 {
        if (this.stateCode == 2) { return Theme.jade600 }
        return Theme.ink600
    }

    func build() {
        Column {
            if (this.pickable) {
                Text(this.glyph)
                    .fontSize(Theme.fsGridChar)
                    .fontFamily(Theme.serif)
                    .fontWeight(FontWeight.Bold)
                    .fontColor(Theme.ink900)
            } else if (this.stateCode == 3) {
                Text("?")
                    .fontSize(22)
                    .fontFamily(Theme.sans)
                    .fontWeight(FontWeight.Bold)
                    .fontColor(Theme.unknownMark)
            } else {
                Text("?")
                    .fontSize(24)
                    .fontFamily(Theme.sans)
                    .fontWeight(FontWeight.Bold)
                    .fontColor(this.markColor())
            }
            if (this.order > 0) {
                Text("${this.order}")
                    .fontSize(11)
                    .fontFamily(Theme.sans)
                    .fontWeight(FontWeight.Bold)
                    .fontColor(Theme.white)
                    .backgroundColor(Theme.zhu600)
                    .width(18)
                    .height(18)
                    .borderRadius(9)
                    .textAlign(TextAlign.Center)
                    .align(Alignment.TopEnd)
                    .offset(x: 5, y: -5)
            }
        }
        .width(Theme.gridCell)
        .height(Theme.gridCell)
        .borderRadius(Theme.gridRadius)
        .backgroundColor(if (this.pickable) {
            if (this.order > 0) { Theme.bone100 } else { Theme.paper50 }
        } else {
            if (this.stateCode == 3) { Theme.paper200 } else { Theme.paper50 }
        })
        .border(
            width: if (this.order > 0) { 2 } else { 1 },
            color: if (this.order > 0) { Theme.zhu600 }
                else {
                    if (this.pickable) { Theme.ink600 }
                    else { if (this.stateCode == 3) { Theme.paperLine } else { this.markColor() } }
                }
        )
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .onClick({event => this.onTap()})
    }
}

/* 网格：数据就是字录那个 27 格总览（pickGridCells），只有已造的字可挑。
   按一行 5 格切行（复用 ui_zilu_grid.cj 的 UiGridRow）。 */
@Component
public class PickGrid {
    @Prop var picked: Array<String>
    @Prop var onToggle: (String) -> Unit

    func rows(): ArrayList<UiGridRow> {
        let cells = pickGridCells(this.picked)
        let out = ArrayList<UiGridRow>()
        var i: Int64 = 0
        while (i < cells.size) {
            let row = ArrayList<ZiluGridCell>()
            var j: Int64 = 0
            while (j < Theme.gridPerRow && i + j < cells.size) {
                row.add(cells[i + j])
                j = j + 1
            }
            out.add(UiGridRow(row))
            i = i + Theme.gridPerRow
        }
        return out
    }

    func tap(c: ZiluGridCell): Unit {
        if (c.isMade()) {
            this.onToggle(c.charId)
        }
    }

    func build() {
        Column(space: Theme.gridGap) {
            /* key 带上选中序号：不传 keyGenerator 时 ForEach 按下标复用，
               挑了字格子不重建 → 朱边和序号不跟着变。 */
            ForEach(this.rows(), itemGeneratorFunc: {row: UiGridRow, i: Int64 =>
                Row(space: Theme.gridGap) {
                    ForEach(row.cells, itemGeneratorFunc: {c: ZiluGridCell, j: Int64 =>
                        PickCellView(
                            glyph: c.glyph,
                            stateCode: ziluStateCode(c),
                            pickable: c.isMade(),
                            order: pickOrderOf(this.picked, c.charId),
                            onTap: { => this.tap(c) }
                        )
                    }, keyGeneratorFunc: {c: ZiluGridCell, j: Int64 =>
                        "${c.charId}_${pickOrderOf(this.picked, c.charId)}_${j}"
                    })
                }
            }, keyGeneratorFunc: {row: UiGridRow, i: Int64 => "${i}"})
        }
        .width(100.percent)
        .margin(top: 14)
    }
}

/* 底部主按钮：没挑满 → paper-200 底、字 ink-400、点不动；
   挑满（或本来不足 3 个字）→ 朱底白字。
   文案 / 能不能点都由 picked 在子组件里算（原始数组当 @Prop 传进来）。 */
@Component
public class PickFootBtn {
    @Prop var picked: Array<String>
    @Prop var onTap: () -> Unit

    /* 可挑的字 = 已造的字（zilu_model 的 ZILU_MADE_IDS）。 */
    func available(): Int64 {
        return pickAvailable()
    }

    func label(): String {
        return pickButtonText(this.picked, this.available())
    }

    func enabled(): Bool {
        return pickCanConfirm(this.picked, this.available())
    }

    func build() {
        Text(this.label())
            .fontSize(Theme.fsButton)
            .fontFamily(Theme.sans)
            .fontWeight(FontWeight.Bold)
            .fontColor(if (this.enabled()) { Theme.white } else { Theme.ink400 })
            .backgroundColor(if (this.enabled()) { Theme.zhu600 } else { Theme.paper200 })
            .height(Theme.buttonH)
            .width(100.percent)
            .borderRadius(22)
            .textAlign(TextAlign.Center)
            .enabled(this.enabled())
            .onClick({event =>
                if (this.enabled()) {
                    this.onTap()
                }
            })
    }
}

/* 开局挑字页。picked 顺序 = 挑选顺序（大格从左到右、序号 1..3 都按它）。 */
@Component
public class PickScreen {
    /* 代次（EntryView 从存档带下来）。 */
    @Prop var generation: Int64
    /* 挑好了：把挑的字（按顺序）交出去，EntryView 落定 + 存档 + 进主界。 */
    @Prop var onConfirm: (Array<String>) -> Unit

    @State var picked: Array<String> = []

    func toggle(id: String): Unit {
        this.picked = pickToggle(this.picked, id)
    }

    func remove(id: String): Unit {
        /* 空格（没有字）点了什么都不做。 */
        if (id.size == 0) { return }
        this.picked = pickToggle(this.picked, id)
    }

    func confirm(): Unit {
        this.onConfirm(this.picked)
    }

    func build() {
        Column {
            PickStatLine(generation: this.generation)

            Scroll {
                Column(space: 0) {
                    Text(PICK_TITLE)
                        .fontSize(Theme.fsPageTitle)
                        .fontFamily(Theme.serif)
                        .fontWeight(FontWeight.Bold)
                        .fontColor(Theme.ink900)
                        .width(100.percent)
                        .margin(top: 14)
                    Text(PICK_HINT)
                        .fontSize(Theme.fsShiqian)
                        .fontFamily(Theme.sans)
                        .fontColor(Theme.ink600)
                        .width(100.percent)
                        .margin(top: 8)
                        .lineHeight(19)

                    PickBigSlots(
                        picked: this.picked,
                        onRemove: {id => this.remove(id)}
                    )

                    PickGrid(
                        picked: this.picked,
                        onToggle: {id => this.toggle(id)}
                    )
                }
                .width(100.percent)
            }
            .layoutWeight(1)

            PickFootBtn(
                picked: this.picked,
                onTap: { => this.confirm() }
            )
            .margin(bottom: 16)
        }
        .width(100.percent)
        .height(100.percent)
        .backgroundColor(Theme.paper100)
        .padding(left: Theme.insetPaper, right: Theme.insetPaper)
    }
}
