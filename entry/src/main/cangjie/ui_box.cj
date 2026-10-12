package ohos_app_cangjie_entry

import kit.ArkUI.*
import ohos.arkui.state_macro_manage.*
import std.collection.ArrayList

/* 字匣（SPEC §2.4；设计稿 home_slide_v1 字匣条 + ziku_pick_v1 的格子状态、
   E 的主界字匣详情弹层——弹层在 ui_box_sheet.cj）。
   版式：主界底部一条 104 高（night-900 60% + 上边一线 night-line），
   里面一行小标题 + 三格 48×48、圆角 12、间距 12，格内字 Serif 26 Bold。

   五种格子状态（game_rules 的 BOX_SLOT_*，界面只照着摆）：
     可落     paper-50 底、ink-600 1 描边、ink-900 字；点一下选中并开详情弹层
     选中     bone-100 底、zhu-600 2 描边 + 3 外发光（本仓库 shadow 没验过，
              用一圈 zhu-600 25% 的圆角块垫在格子背后顶，见 BoxSlotGlow）
     本代已落 night-700 底、字 38% 透明、下沿「已落」小签 16 高；点了只开弹层看，
              不改选中
     事签     骨片形（不等圆角）+ carve 字；本 slice 是 stub，见 game_rules 的
              BOX_SHIQIAN_ID
     空       1 虚线 night-line + 「＋」（只在本代带的字不足 3 个时出现）
   同样拆成小 @Component（@Component 宏展开撑不住大 build()）。
   R1（e4c8def 烟测 FAIL）之后字匣不收数组：三格各收一个原始 String（字 id），
   加一个 boxCount（有几格有字）和一个 landedMask（哪些格本代已落，位掩码），
   格子状态在 HomeBoxSlot 里按 home_mirror.cj 的纯逻辑现算。 */

/* 选中外发光：比格子大 3px 的一圈 zhu-600 25%（设计稿 0 0 0 3px rgba(181,67,46,.25)）。
   ArkUI 这一版的 shadow 在本仓库没有先用例，先用垫一层同色圆角块的办法。 */
@Component
public class BoxSlotGlow {
    func build() {
        Text("")
            .width(Theme.boxSlotCell + 6)
            .height(Theme.boxSlotCell + 6)
            .borderRadius(Theme.boxSlotRadius + 3)
            .backgroundColor(Theme.boxSelGlow)
    }
}

/* 字匣一格。传进来的全是原始值（R1：函数调用结果 / 数组不当 @Prop 传），
   格子状态与字形都在本组件自己的成员函数里按原始值现算。 */
@Component
public class HomeBoxSlot {
    /* 这一格是第几格（0..2）。 */
    @Prop var slot: Int64
    /* 字匣三格的字 id + 有几格有字 + 哪些格本代已落（位掩码）。 */
    @Prop var box0: String
    @Prop var box1: String
    @Prop var box2: String
    @Prop var boxCount: Int64
    @Prop var landedMask: Int64
    /* 界面选中态（-1 = 没有选中）。 */
    @Prop var selectedSlot: Int64
    @Prop var onTap: () -> Unit

    /* 原始值 → HomeMirror（纯逻辑在 home_mirror.cj，box_check 有断言）。 */
    func mirror(): HomeMirror {
        let m = HomeMirror()
        m.boxCount = this.boxCount
        m.box0 = this.box0
        m.box1 = this.box1
        m.box2 = this.box2
        m.landedMask = this.landedMask
        return m
    }

    func state(): Int64 {
        return homeBoxSlotState(this.mirror(), this.selectedSlot, this.slot)
    }

    /* 格内的字形（事签 / 空格 → 空串，由状态那一支摆）。 */
    func glyph(): String {
        return ziluGlyphOf(homeMirrorBoxId(this.mirror(), this.slot))
    }

    func isOk(): Bool {
        return this.state() == BOX_SLOT_OK
    }

    func isSelected(): Bool {
        return this.state() == BOX_SLOT_SELECTED
    }

    func isLanded(): Bool {
        return this.state() == BOX_SLOT_LANDED
    }

    func isShiqian(): Bool {
        return this.state() == BOX_SLOT_SHIQIAN
    }

    /* 空格只在开局挑字不足 3 个字时出现（本代会带几个字是开局定死的）。 */
    func isEmpty(): Bool {
        return this.state() == BOX_SLOT_EMPTY
    }

    /* 空格 / 事签格点了不开层（事签是 stub，本来也不会出现）。 */
    func tappable(): Bool {
        return this.isOk() || this.isSelected() || this.isLanded()
    }

    /* 格子底色。 */
    func bg(): Int64 {
        if (this.isSelected()) { return Theme.bone100 }
        if (this.isLanded()) { return Theme.night700 }
        if (this.isShiqian()) { return Theme.bone100 }
        if (this.isEmpty()) { return Theme.night800 }
        return Theme.paper50
    }

    /* 描边：空格是虚线，其余实线；选中 2、其余 1。 */
    func borderW(): Int64 {
        if (this.isSelected()) { return 2 }
        return 1
    }

    func borderColor(): Int64 {
        if (this.isSelected()) { return Theme.zhu600 }
        if (this.isLanded()) { return Theme.nightLine }
        if (this.isEmpty()) { return Theme.nightLine }
        if (this.isShiqian()) { return Theme.bone300 }
        return Theme.ink600
    }

    func dashed(): Bool {
        return this.isEmpty()
    }

    /* 格内的字（事签格写「事签」两个字，空格写「＋」）。 */
    func text(): String {
        if (this.isShiqian()) { return BOX_SLOT_SHIQIAN_TEXT }
        if (this.glyph().size > 0) { return this.glyph() }
        return BOX_SLOT_EMPTY_MARK
    }

    func fontSize(): Int64 {
        if (this.isShiqian()) { return Theme.boxShiqianFs }
        if (this.glyph().size > 0) { return Theme.boxSlotFs }
        return 20
    }

    func fontFamily(): String {
        if (this.isShiqian()) { return Theme.sans }
        if (this.glyph().size > 0) { return Theme.serif }
        return Theme.sans
    }

    func fontColor(): Int64 {
        if (this.isLanded()) { return Theme.glyphNight }
        if (this.isShiqian()) { return Theme.carve }
        if (this.isEmpty()) { return Theme.onNight2 }
        return Theme.ink900
    }

    /* 本代已落：字 38% 透明（SPEC §2.4）。 */
    func opacity(): Float64 {
        if (this.isLanded()) { return Theme.boxLandedOpacity }
        return 1.0
    }

    func tap(): Unit {
        if (this.tappable()) {
            this.onTap()
        }
    }

    func build() {
        Stack {
            /* 选中外发光垫在格子背后。 */
            if (this.isSelected()) {
                BoxSlotGlow()
            }

            /* 格子本体。事签格用大一点的圆角（设计稿是骨片那种不等圆角
               7 5 8 4 / 5 8 5 7；四角分别取值在本仓库没验过，先用统一的 14）。 */
            Text(this.text())
                .fontSize(this.fontSize())
                .fontFamily(this.fontFamily())
                .fontWeight(FontWeight.Bold)
                .fontColor(this.fontColor())
                .opacity(this.opacity())
                .width(Theme.boxSlotCell)
                .height(Theme.boxSlotCell)
                .borderRadius(if (this.isShiqian()) { 14 } else { Theme.boxSlotRadius })
                .backgroundColor(this.bg())
                .border(
                    width: this.borderW(),
                    color: this.borderColor(),
                    style: if (this.dashed()) { BorderStyle.Dashed } else { BorderStyle.Solid }
                )
                .textAlign(TextAlign.Center)

            /* 下沿「已落」小签 16 高（设计稿 .slot.used::after：骑在下沿上）。 */
            if (this.isLanded()) {
                Text(HOME_BOX_TAG_LANDED)
                    .fontSize(Theme.boxTagFs)
                    .fontFamily(Theme.sans)
                    .fontWeight(FontWeight.Bold)
                    .fontColor(Theme.onNight2)
                    .backgroundColor(Theme.night900)
                    .height(Theme.boxTagH)
                    .padding(left: 5, right: 5)
                    .borderRadius(Theme.boxTagRadius)
                    .border(width: 1, color: Theme.nightLine)
                    .textAlign(TextAlign.Center)
                    .align(Alignment.Bottom)
                    /* offset 的 x / y 都是必填命名参数（本 SDK 没有单参重载）。 */
                    .offset(x: 0, y: Theme.boxTagH / 2)
            }
        }
        .width(Theme.boxSlotCell)
        .height(Theme.boxSlotCell)
        .onClick({event => this.tap()})
    }
}

/* 字匣条：小标题 + 三格（SPEC §2.4 主界字匣条 104 高）。
   box0..box2 / boxCount / landedMask / selectedSlot 都是原始值（R1：数组与
   函数调用结果不当 @Prop 传），格子状态由 HomeBoxSlot 自己按原始值现算。 */
@Component
public class HomeBoxBar {
    /* 字匣三格的字 id（boxChars 存的是 id，字形在格子里换）。 */
    @Prop var box0: String
    @Prop var box1: String
    @Prop var box2: String
    /* 有几格有字（开局不足 3 个字时后面是空格）。 */
    @Prop var boxCount: Int64
    /* 哪些格本代已落（位掩码，第 i 位 = 第 i 格）。 */
    @Prop var landedMask: Int64
    /* 界面选中态：-1 = 没有选中（game_rules 的 BOX_SLOT_NONE）。 */
    @Prop var selectedSlot: Int64
    /* 点某一格：EntryView 决定选中谁、开不开详情弹层。 */
    @Prop var onSelect: (Int64) -> Unit

    /* 原始值 → HomeMirror（算格子状态 / key 用；纯逻辑在 home_mirror.cj）。 */
    func mirror(): HomeMirror {
        let m = HomeMirror()
        m.boxCount = this.boxCount
        m.box0 = this.box0
        m.box1 = this.box1
        m.box2 = this.box2
        m.landedMask = this.landedMask
        return m
    }

    func stateAt(i: Int64): Int64 {
        return homeBoxSlotState(this.mirror(), this.selectedSlot, i)
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
        Column {
            /* 上边一线 night-line（设计稿 .ziku 的 border-top；本仓库的 border
               是四边一起画的，顶线单独摆一根 1 高的 Row）。 */
            Row()
                .width(100.percent)
                .height(1)
                .backgroundColor(Theme.nightLine)

            Column {
                Row {
                    Text(HOME_BOX_TITLE)
                        .fontSize(Theme.fsStatus)
                        .fontFamily(Theme.sans)
                        .fontWeight(FontWeight.Bold)
                        .fontColor(Theme.onNight)
                        .margin(right: 10)
                    Text(HOME_BOX_HINT)
                        .fontSize(Theme.fsNote)
                        .fontFamily(Theme.sans)
                        .fontColor(Theme.onNight2)
                }
                .width(100.percent)

                /* key 带上状态：选中 / 已落变化时格子要重建（不然描边和「已落」签不跟着变）。 */
                Row(space: Theme.boxSlotGap) {
                    ForEach(this.slotIndexes(), itemGeneratorFunc: {i: Int64, at: Int64 =>
                        HomeBoxSlot(
                            slot: i,
                            box0: this.box0,
                            box1: this.box1,
                            box2: this.box2,
                            boxCount: this.boxCount,
                            landedMask: this.landedMask,
                            selectedSlot: this.selectedSlot,
                            onTap: { => this.onSelect(i) }
                        )
                    }, keyGeneratorFunc: {i: Int64, at: Int64 =>
                        "${i}_${this.stateAt(i)}"
                    })
                }
                .width(100.percent)
                .margin(top: 10)
            }
            .width(100.percent)
            .layoutWeight(1)
            .padding(left: Theme.insetNight, right: Theme.insetNight, top: 10)
        }
        .width(100.percent)
        .height(Theme.boxBarH)
        .backgroundColor(Theme.boxBarBg)
    }
}
