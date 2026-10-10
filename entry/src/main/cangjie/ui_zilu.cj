package ohos_app_cangjie_entry

import kit.ArkUI.*
import ohos.arkui.state_macro_manage.*

/* 字录（zilu_detail_v1）：导航 · 分页条 · 详情卡 · 白话字义 · 典籍 · 古字形演变
   （标准档 M，可点 → 放大卡）· 小故事 · 效果 · 27 格总览。
   空着的情况：典籍查不到 → 整块不显示；某阶段没有字形 → 那一格不出现。 */

/* 一行格子（5 格），避免在 ForEach 里写泛型闭包参数。 */
public class UiGridRow {
    public let cells: ArrayList<ZiluGridCell>

    public init(cells: ArrayList<ZiluGridCell>) {
        this.cells = cells
    }
}

@Component
public class ZiluScreen {
    @Prop var selectedId: String
    @Prop var onSelect: (String) -> Unit
    @Prop var onGoCard: () -> Unit

    /* 分页条：0 全部 / 1 象形 / 2 会意 / 3 指事。 */
    @State var tab: Int64 = 0
    @State var showPop: Bool = false
    @State var popIndex: Int64 = 0

    let recorder: String = "记事人 阿禾"

    func tabName(): String {
        if (this.tab == 1) {
            return "象形"
        }
        if (this.tab == 2) {
            return "会意"
        }
        return "指事"
    }

    /* 分页后要显示的格子（只对已造的字按造法过滤）。 */
    func visibleCells(): ArrayList<ZiluGridCell> {
        let all = ziluGrid()
        if (this.tab == 0) {
            return all
        }
        let out = ArrayList<ZiluGridCell>()
        var i: Int64 = 0
        while (i < all.size) {
            let c = all[i]
            if (c.isMade()) {
                let rows = GlyphCatalog.ofChar(c.charId)
                if (rows[0].method == this.tabName()) {
                    out.add(c)
                }
            }
            i = i + 1
        }
        return out
    }

    /* 按一行 5 格切好。 */
    func gridRows(): ArrayList<UiGridRow> {
        let cells = this.visibleCells()
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

    func selectCell(c: ZiluGridCell): Unit {
        if (c.isMade()) {
            this.onSelect(c.charId)
        }
    }

    /* build() 里不能有顶层 let（@Component 宏展开会失败），取值都走成员函数。
       这些函数都是纯函数，反复调用结果一致。 */
    func ziluFirst(): GlyphRow {
        return GlyphCatalog.ofChar(this.selectedId)[0]
    }

    func ziluCopy(): ZiluCopy {
        return ziluCopyOf(this.selectedId)
    }

    func ziluDetail(): EvoStrip {
        return buildDetailStrip(this.selectedId)
    }

    /* 放大卡下标：越界时退回第 0 格。 */
    func popIndexSafe(): Int64 {
        if (this.popIndex < this.ziluDetail().cells.size) {
            return this.popIndex
        }
        return 0
    }

    /* 分页条计数：全部 / 象形 / 会意 / 指事。 */
    func ziluNAll(): Int64 {
        return ziluCounts()[0]
    }

    func ziluNXiang(): Int64 {
        return ziluCounts()[1]
    }

    func ziluNHuiyi(): Int64 {
        return ziluCounts()[2]
    }

    func ziluNZhishi(): Int64 {
        return ziluCounts()[3]
    }

    func ziluParts(): Array<String> {
        return formulaParts(this.selectedId)
    }

    func build() {
        Column {
            /* —— 导航：返回 / 字录 / 计数胶囊 —— */
            Row {
                Text(ZILU_BACK)
                    .fontSize(22)
                    .fontFamily(Theme.sans)
                    .fontColor(Theme.ink900)
                    .width(32)
                    .height(32)
                    .borderRadius(16)
                    .textAlign(TextAlign.Center)
                Text(ZILU_TITLE)
                    .fontSize(Theme.fsPageTitle)
                    .fontFamily(Theme.serif)
                    .fontWeight(FontWeight.Bold)
                    .fontColor(Theme.ink900)
                    .layoutWeight(1)
                    .margin(left: 8)
                Text(ZILU_NAV_COUNT)
                    .fontSize(14)
                    .fontFamily(Theme.sans)
                    .fontWeight(FontWeight.Bold)
                    .fontColor(Theme.ink900)
                    .backgroundColor(Theme.paper50)
                    .height(28)
                    .padding(left: 12, right: 12)
                    .borderRadius(14)
                    .border(width: 1, color: Theme.paperLine)
                    .textAlign(TextAlign.Center)
            }
            .width(100.percent)
            .height(52)
            .padding(left: Theme.insetPaper, right: Theme.insetPaper)

            /* —— 分页条 —— */
            Row {
                Text("${ZILU_TAB_ALL} ${this.ziluNAll()}")
                    .fontSize(14)
                    .fontFamily(Theme.sans)
                    .fontWeight(if (this.tab == 0) { FontWeight.Bold } else { FontWeight.Normal })
                    .fontColor(if (this.tab == 0) { Theme.paper50 } else { Theme.ink600 })
                    .layoutWeight(1)
                    .textAlign(TextAlign.Center)
                    .onClick({event => this.tab = 0})
                Text("${ZILU_TAB_XIANG} ${this.ziluNXiang()}")
                    .fontSize(14)
                    .fontFamily(Theme.sans)
                    .fontWeight(if (this.tab == 1) { FontWeight.Bold } else { FontWeight.Normal })
                    .fontColor(if (this.tab == 1) { Theme.paper50 } else { Theme.ink600 })
                    .layoutWeight(1)
                    .textAlign(TextAlign.Center)
                    .onClick({event => this.tab = 1})
                Text("${ZILU_TAB_HUIYI} ${this.ziluNHuiyi()}")
                    .fontSize(14)
                    .fontFamily(Theme.sans)
                    .fontWeight(if (this.tab == 2) { FontWeight.Bold } else { FontWeight.Normal })
                    .fontColor(if (this.tab == 2) { Theme.paper50 } else { Theme.ink600 })
                    .layoutWeight(1)
                    .textAlign(TextAlign.Center)
                    .onClick({event => this.tab = 2})
                Text("${ZILU_TAB_ZHISHI} ${this.ziluNZhishi()}")
                    .fontSize(14)
                    .fontFamily(Theme.sans)
                    .fontWeight(if (this.tab == 3) { FontWeight.Bold } else { FontWeight.Normal })
                    .fontColor(if (this.tab == 3) { Theme.paper50 } else { Theme.ink600 })
                    .layoutWeight(1)
                    .textAlign(TextAlign.Center)
                    .onClick({event => this.tab = 3})
            }
            .width(100.percent)
            .height(36)
            .borderRadius(18)
            .backgroundColor(Theme.paper200)
            .padding(left: 3, right: 3)
            .margin(left: Theme.insetPaper, right: Theme.insetPaper)

            Scroll {
                Column(space: 0) {
                    /* —— 详情卡 —— */
                    Column {
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
                                            .alignItems(HorizontalAlign.Center)
                                        })
                                    } else {
                                        Text(formulaText(this.selectedId))
                                            .fontSize(14)
                                            .fontFamily(Theme.sans)
                                            .fontWeight(FontWeight.Bold)
                                            .fontColor(Theme.ink600)
                                    }
                                }
                                .alignItems(HorizontalAlign.Center)
                                Text("造于 ${CARD_GEN_LINE}")
                                    .fontSize(12)
                                    .fontFamily(Theme.sans)
                                    .fontColor(Theme.ink600)
                                Text(this.recorder)
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
                                    onSelect: {i =>
                                        this.popIndex = i
                                        this.showPop = true
                                    }
                                )
                            }
                            .margin(top: 10)

                            /* —— 放大卡：宽 188，字形区 144×144 圆角 14 —— */
                            if (this.showPop) {
                                ZiluPopCard(
                                    charId: this.selectedId,
                                    popIndex: this.popIndexSafe(),
                                    onPrev: { => this.popIndex = this.popIndexSafe() - 1 },
                                    onNext: { => this.popIndex = this.popIndexSafe() + 1 }
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
                                ForEach(this.ziluCopy().effects, itemGeneratorFunc: {row: EffectRow, _: Int64 =>
                                    Row {
                                        Text(row.label)
                                            .fontSize(Theme.fsBadge)
                                            .fontFamily(Theme.sans)
                                            .fontWeight(FontWeight.Bold)
                                            .fontColor(Theme.ink900)
                                            .backgroundColor(Theme.paper200)
                                            .height(22)
                                            .padding(left: 8, right: 8)
                                            .borderRadius(6)
                                            .textAlign(TextAlign.Center)
                                        Text(row.text)
                                            .fontSize(Theme.fsEffect)
                                            .fontFamily(Theme.serif)
                                            .fontColor(Theme.ink900)
                                            .layoutWeight(1)
                                            .margin(left: 10)
                                    }
                                    .width(100.percent)
                                    .margin(top: 8)
                                    .alignItems(HorizontalAlign.Center)
                                })
                            }
                            .width(100.percent)
                            .margin(top: 16)
                        }
                        .width(100.percent)
                        .padding(Theme.cardPad)
                        .backgroundColor(Theme.paper50)
                        .borderRadius(Theme.cardRadius)
                        .border(width: 1, color: Theme.paperLine)
                        .margin(top: Theme.insetPaper)

                        /* —— 格子总览 —— */
                        Text(ZILU_GRID_SUMMARY)
                            .fontSize(12)
                            .fontFamily(Theme.sans)
                            .fontColor(Theme.ink600)
                            .width(100.percent)
                            .margin(top: 20)
                        Column(space: Theme.gridGap) {
                            ForEach(this.gridRows(), itemGeneratorFunc: {row: UiGridRow, _: Int64 =>
                                Row {
                                    ForEach(row.cells, itemGeneratorFunc: {c: ZiluGridCell, _: Int64 =>
                                        Column {
                                            if (c.state == ZiluCellState.Made) {
                                                Text(c.glyph)
                                                    .fontSize(Theme.fsGridChar)
                                                    .fontFamily(Theme.serif)
                                                    .fontWeight(FontWeight.Bold)
                                                    .fontColor(Theme.ink900)
                                            } else if (c.state == ZiluCellState.HasSign) {
                                                Text("?")
                                                    .fontSize(24)
                                                    .fontFamily(Theme.sans)
                                                    .fontWeight(FontWeight.Bold)
                                                    .fontColor(Theme.ink600)
                                                Text(c.hint)
                                                    .fontSize(10)
                                                    .fontFamily(Theme.sans)
                                                    .fontColor(Theme.ink600)
                                                    .margin(top: 5)
                                            } else if (c.state == ZiluCellState.HasFragment) {
                                                Text("?")
                                                    .fontSize(24)
                                                    .fontFamily(Theme.sans)
                                                    .fontWeight(FontWeight.Bold)
                                                    .fontColor(Theme.jade600)
                                                Text(c.hint)
                                                    .fontSize(10)
                                                    .fontFamily(Theme.sans)
                                                    .fontColor(Theme.jade600)
                                                    .margin(top: 5)
                                            } else {
                                                Text("?")
                                                    .fontSize(22)
                                                    .fontFamily(Theme.sans)
                                                    .fontWeight(FontWeight.Bold)
                                                    .fontColor(Theme.unknownMark)
                                            }
                                            if (c.isNew) {
                                                Text("新")
                                                    .fontSize(10)
                                                    .fontFamily(Theme.sans)
                                                    .fontWeight(FontWeight.Bold)
                                                    .fontColor(Theme.white)
                                                    .backgroundColor(Theme.zhu600)
                                                    .height(16)
                                                    .padding(left: 5, right: 5)
                                                    .borderRadius(8)
                                                    .align(Alignment.TopEnd)
                                                    .offset(x: 4, y: -6)
                                            }
                                        }
                                        .width(Theme.gridCell)
                                        .height(Theme.gridCell)
                                        .borderRadius(Theme.gridRadius)
                                        .backgroundColor(if (c.state == ZiluCellState.Made) {
                                            if (c.charId == this.selectedId) { Theme.bone100 } else { Theme.paper50 }
                                        } else {
                                            if (c.state == ZiluCellState.HasFragment) { Theme.jade100 }
                                            else { if (c.state == ZiluCellState.Unknown) { Theme.paper200 } else { Theme.paper50 } }
                                        })
                                        .border(
                                            width: if (c.charId == this.selectedId) { 2 } else { 1 },
                                            color: if (c.charId == this.selectedId) { Theme.zhu600 }
                                                else {
                                                    if (c.state == ZiluCellState.HasFragment) { Theme.jade600 }
                                                    else { Theme.ink600 }
                                                },
                                            style: if (c.state == ZiluCellState.HasSign) { BorderStyle.Dashed } else { BorderStyle.Solid }
                                        )
                                        .justifyContent(FlexAlign.Center)
                                        .alignItems(HorizontalAlign.Center)
                                        .onClick({event => this.selectCell(c)})
                                    })
                                }
                            })
                        }
                        .width(100.percent)
                        .margin(top: Theme.gridGap)
                        .padding(bottom: 24)
                    }
                    .width(100.percent)
                    .padding(left: Theme.insetPaper, right: Theme.insetPaper)
                }
                .width(100.percent)
            }
            .layoutWeight(1)
        }
        .width(100.percent)
        .height(100.percent)
        .backgroundColor(Theme.paper100)
    }
}
