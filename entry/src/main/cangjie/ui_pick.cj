package ohos_app_cangjie_entry

import kit.ArkUI.*
import ohos.arkui.state_macro_manage.*
import std.collection.ArrayList

/* 开局挑字页（SPEC §2.4 开局挑字页；设计稿 ziku_pick_v1 D 屏）。
   拆成多个小 @Component，每个 build() 只摆一层（DevEco 上 @Component 宏展开
   撑不住大 build()，见 ui_zilu.cj 顶上的说明）：
     PickStatLine  顶行「第 N 代 · 开局」+「第 N 代记事人」
     PickBigSlot   三个大格之一（64×64，空 = 虚线；满 = 字 + 朱序号）
     PickShiqianSlot 第 2 代起第 1 格：上一代传下的事签（骨片形，不可换）
     PickSlotCol / PickShiqianCol  大格 + 下面一行说明（拆小 build）
     PickBigSlots  大格行（paper-50 卡）
     PickCellView  网格单格（60×60，选中加朱边 + 朱序号 18）
     PickGrid      网格（同字录：60×60、间距 9、一行 5 格）
     PickFootBtn   底部主按钮（灰「还差 N 个字」/ 朱「就带这些开局」）
     PickScreen    组装 + 自己的 @State（picked）
   挑字规则（挑/收回/上限 cap/不足 cap 个字）与落定都在 run_state.cj，这里只摆版式。
   第 2 代起三个大格的第 1 格是「上一代传下的事签」（不可换），玩家只挑 2 个字
   （pickShiqianReserved / pickCapFor / pickToggleCap / pickButtonTextCap）；
   刻事签 / 传事签不在本里程碑，所以那一格实际永远显示「上一代没传事签」。
   O1（e4c8def 烟测观察项：挑了字，上方三个大格还是「＋ / 第 n 格」）之后，
   三个大格各收一个原始 String（字 id），格子内部自己换字形、算序号 ——
   原来收 picked 数组当 @Prop 再用不带 key 的 ForEach 摆，数组 @Prop 没验过，
   ForEach 还会按下标复用子组件、不重跑 itemGeneratorFunc，格子就不翻面。 */

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
            Text(this.genLine())
                .fontSize(Theme.fsStatus)
                .fontFamily(Theme.sans)
                .fontColor(Theme.ink900)
                .layoutWeight(1)
            Text(this.recorder())
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
   点满的格子就是把这个字收回（SPEC §2.4：挑字入字匣）。
   charId 是原始值（picked 存的是字id "shui"），字形在本组件里现换。 */
@Component
public class PickBigSlot {
    @Prop var charId: String
    /* 0 = 空格；>0 = 第几个挑的（右上角序号）。 */
    @Prop var order: Int64
    @Prop var onTap: () -> Unit

    func filled(): Bool {
        return this.charId.size > 0
    }

    func glyph(): String {
        return ziluGlyphOf(this.charId)
    }

    func build() {
        Column {
            Text(if (this.filled()) { this.glyph() } else { PICK_SLOT_EMPTY })
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

/* 第 2 代起挑字页第 1 格：上一代传下的事签（骨片形，不可换）。
   设计稿 ziku_pick_v1 D 屏 .big3 .slot.sq：64×64、骨片形圆角 14、carve 字
   12 Bold 两行（「事签 / 传下」）；上一代没传事签时这一格空着 —— paper-200
   底、ink-400 字、1 虚线 paper-line（刻事签 / 传事签不在本里程碑，所以实际
   永远是这个状态）。点了不动：既不能挑、也不能收回。 */
@Component
public class PickShiqianSlot {
    /* 上一代真传下了事签没有（pickShiqianCarried；本里程碑恒 false）。 */
    @Prop var carried: Bool

    func text(): String {
        if (this.carried) { return PICK_SHIQIAN_CARRIED }
        return PICK_SHIQIAN_NONE
    }

    func bg(): Int64 {
        if (this.carried) { return Theme.bone200 }
        return Theme.paper200
    }

    func fg(): Int64 {
        if (this.carried) { return Theme.carve }
        return Theme.ink400
    }

    /* 没传事签 → 空格那一路的虚线；传下来了 → 骨片实边。 */
    func borderColor(): Int64 {
        if (this.carried) { return Theme.boneCrack }
        return Theme.paperLine
    }

    func borderStyle(): BorderStyle {
        if (this.carried) { return BorderStyle.Solid }
        return BorderStyle.Dashed
    }

    func build() {
        Column {
            Text(this.text())
                .fontSize(12)
                .fontFamily(Theme.sans)
                .fontWeight(FontWeight.Bold)
                .fontColor(this.fg())
                .textAlign(TextAlign.Center)
        }
        .width(64)
        .height(64)
        .borderRadius(14)
        .backgroundColor(this.bg())
        .border(width: 1, color: this.borderColor(), style: this.borderStyle())
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
    }
}

/* 一个大格 + 下面一行说明（从 PickBigSlots 拆出来，build() 保持小块）。
   order 是这一格的位置序号（1..3）；格子空着时不画序号。 */
@Component
public class PickSlotCol {
    @Prop var charId: String
    @Prop var order: Int64
    @Prop var caption: String
    @Prop var onTap: () -> Unit

    func build() {
        Column {
            PickBigSlot(
                charId: this.charId,
                order: if (this.charId.size > 0) { this.order } else { 0 },
                onTap: { => this.onTap() }
            )
            Text(this.caption)
                .fontSize(Theme.fsStageName)
                .fontFamily(Theme.sans)
                .fontColor(Theme.ink600)
                .textAlign(TextAlign.Center)
                .margin(top: 6)
        }
    }
}

/* 事签格 + 下面一行说明（第 2 代起第 1 格）。 */
@Component
public class PickShiqianCol {
    @Prop var carried: Bool
    @Prop var caption: String

    func build() {
        Column {
            PickShiqianSlot(carried: this.carried)
            Text(this.caption)
                .fontSize(Theme.fsStageName)
                .fontFamily(Theme.sans)
                .fontColor(Theme.ink600)
                .textAlign(TextAlign.Center)
                .margin(top: 6)
        }
    }
}

/* 三个大格（64×64、间距 12），按挑选顺序从左到右排。
   O1（e4c8def 烟测观察项：挑了字，上方三格还是「＋ / 第 n 格」）：
   原来这里收 picked 数组当 @Prop、再用不带 key 的 ForEach 摆三格 —— 数组
   @Prop 没验过，ForEach 还会按下标复用子组件、不重跑 itemGeneratorFunc，
   于是挑了字格子不翻面（下面网格有 key 带序号，所以网格那侧是好的）。
   现在按 R1 的路子走：三个格子各收一个原始 String（字 id），格子内部自己
   换字形、算序号；三个格子显式摆出来，不依赖 ForEach 复用。
   第 2 代起（reserved）第 1 格是事签（不可换），玩家只挑 2 个字：第 2/3 位
   摆 slot0/slot1，序号 2/3（事签占了第 1 格，挑的第 1 个字排第 2 格）。 */
@Component
public class PickBigSlots {
    /* 三格的字 id（空串 = 空格）。第 2 代起只用到 slot0/slot1。 */
    @Prop var slot0: String
    @Prop var slot1: String
    @Prop var slot2: String
    /* 第 1 格留给事签没有（第 2 代起 = true）。 */
    @Prop var reserved: Bool
    /* 上一代真传下了事签没有（false → 这一格空着）。 */
    @Prop var carried: Bool
    @Prop var onRemove: (String) -> Unit

    func caption(id: String, at: Int64): String {
        if (id.size > 0) { return "第 ${at + 1} 格" }
        return "点下方的字"
    }

    /* 事签格下面那行说明（设计稿 D 屏 .cap2）。 */
    func shiqianCaption(): String {
        if (this.carried) { return PICK_SHIQIAN_CAP_CARRIED }
        return PICK_SHIQIAN_CAP_NONE
    }

    func build() {
        Row(space: 12) {
            if (this.reserved) {
                PickShiqianCol(carried: this.carried, caption: this.shiqianCaption())
                PickSlotCol(charId: this.slot0, order: 2, caption: this.caption(this.slot0, 1),
                    onTap: { => this.onRemove(this.slot0) })
                PickSlotCol(charId: this.slot1, order: 3, caption: this.caption(this.slot1, 2),
                    onTap: { => this.onRemove(this.slot1) })
            } else {
                PickSlotCol(charId: this.slot0, order: 1, caption: this.caption(this.slot0, 0),
                    onTap: { => this.onRemove(this.slot0) })
                PickSlotCol(charId: this.slot1, order: 2, caption: this.caption(this.slot1, 1),
                    onTap: { => this.onRemove(this.slot1) })
                PickSlotCol(charId: this.slot2, order: 3, caption: this.caption(this.slot2, 2),
                    onTap: { => this.onRemove(this.slot2) })
            }
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
    /* 序号整体后移几位：第 2 代起事签占了第 1 格，挑的第 1 个字排第 2 格。
       第 1 代传 0，行为不变。 */
    @Prop var orderBase: Int64
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
                            order: pickOrderOfBase(this.picked, c.charId, this.orderBase),
                            onTap: { => this.tap(c) }
                        )
                    }, keyGeneratorFunc: {c: ZiluGridCell, j: Int64 =>
                        "${c.charId}_${pickOrderOfBase(this.picked, c.charId, this.orderBase)}_${j}"
                    })
                }
            }, keyGeneratorFunc: {row: UiGridRow, i: Int64 => "${i}"})
        }
        .width(100.percent)
        .margin(top: 14)
    }
}

/* 底部主按钮：没挑满 → paper-200 底、字 ink-400、点不动；
   挑满（或本来不足 cap 个字）→ 朱底白字。
   文案 / 能不能点都由 picked 在子组件里算（原始数组当 @Prop 传进来）。
   cap = 这一代最多能挑几个（第 1 代 3，第 2 代起事签占 1 格 → 2）。 */
@Component
public class PickFootBtn {
    @Prop var picked: Array<String>
    @Prop var cap: Int64
    @Prop var onTap: () -> Unit

    /* 可挑的字 = 已造的字（zilu_model 的 ZILU_MADE_IDS）。 */
    func available(): Int64 {
        return pickAvailable()
    }

    func label(): String {
        return pickButtonTextCap(this.picked, this.available(), this.cap)
    }

    func enabled(): Bool {
        return pickCanConfirmCap(this.picked, this.available(), this.cap)
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

/* 开局挑字页。picked 顺序 = 挑选顺序（大格从左到右、序号都按它）。
   第 2 代起第 1 格是上一代传下的事签（不可换），玩家只挑 cap = 2 个字。 */
@Component
public class PickScreen {
    /* 代次（EntryView 从存档带下来）。 */
    @Prop var generation: Int64
    /* 上一代传下了事签没有（EntryView 用 pickShiqianCarried 算好传下来）。 */
    @Prop var carried: Bool
    /* 挑好了：把挑的字（按顺序）交出去，EntryView 落定 + 存档 + 进主界。 */
    @Prop var onConfirm: (Array<String>) -> Unit

    @State var picked: Array<String> = []
    /* 三个大格的原始值镜子（O1：挑了字大格不翻面）。 picked 数组只留在本层
       给 PickGrid / PickFootBtn / 落定用，大格那三个 @Prop 逐个收原始 String。 */
    @State var slot0: String = ""
    @State var slot1: String = ""
    @State var slot2: String = ""

    /* 第 1 格留给事签没有（第 2 代起 = true；纯逻辑在 run_state.cj）。 */
    func reserved(): Bool {
        return pickShiqianReserved(this.generation) > 0
    }

    /* 这一代最多能挑几个（第 1 代 3，第 2 代起 2）。 */
    func cap(): Int64 {
        return pickCapFor(this.generation)
    }

    /* 网格朱序号的起点：事签占了第 1 格 → 后移 1。 */
    func orderBase(): Int64 {
        return pickShiqianReserved(this.generation)
    }

    /* picked 变完就把三格镜子跟上（不跟着走，大格就停在旧值）。 */
    func syncSlots(): Unit {
        this.slot0 = if (this.picked.size > 0) { this.picked[0] } else { "" }
        this.slot1 = if (this.picked.size > 1) { this.picked[1] } else { "" }
        this.slot2 = if (this.picked.size > 2) { this.picked[2] } else { "" }
    }

    func toggle(id: String): Unit {
        this.picked = pickToggleCap(this.picked, id, this.cap())
        this.syncSlots()
    }

    func remove(id: String): Unit {
        /* 空格（没有字）点了什么都不做。 */
        if (id.size == 0) { return }
        this.picked = pickToggleCap(this.picked, id, this.cap())
        this.syncSlots()
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
                        slot0: this.slot0,
                        slot1: this.slot1,
                        slot2: this.slot2,
                        reserved: this.reserved(),
                        carried: this.carried,
                        onRemove: {id => this.remove(id)}
                    )

                    PickGrid(
                        picked: this.picked,
                        orderBase: this.orderBase(),
                        onToggle: {id => this.toggle(id)}
                    )
                }
                .width(100.percent)
            }
            .layoutWeight(1)

            /* 自建组件不能挂链式属性（@Component 宏不认），套一层 Column
               把 margin 放容器上（同 ui_card.cj 的 GhostButton）。 */
            Column {
                PickFootBtn(
                    picked: this.picked,
                    cap: this.cap(),
                    onTap: { => this.confirm() }
                )
            }
            /* 容器也要给宽度：Column 默认 alignItems 是 Center，不写 100%
               会缩成内容宽，里面 PickFootBtn 的 100% 就没有基准了。 */
            .width(100.percent)
            .margin(bottom: 16)
        }
        .width(100.percent)
        .height(100.percent)
        .backgroundColor(Theme.paper100)
        .padding(left: Theme.insetPaper, right: Theme.insetPaper)
    }
}
