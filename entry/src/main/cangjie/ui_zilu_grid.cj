package ohos_app_cangjie_entry

import kit.ArkUI.*
import ohos.arkui.state_macro_manage.*
import std.collection.ArrayList

/* 27 格总览（从 ZiluScreen.build() 拆出）：分页过滤 + 按 5 格一行切行 + 单格。
   拆分理由同 ui_zilu_nav.cj：ZiluScreen 原来单个 build() 嵌套太深，
   DevEco 上 @Component 宏展开直接失败。
   格子状态不直接传 enum（@Prop 只用了 Int64/String/Bool/Option/闭包这几类），
   统一过一层 Int64 状态码：0 已造 / 1 有事签 / 2 有残片 / 3 未知。 */

public func ziluStateCode(c: ZiluGridCell): Int64 {
    if (c.isMade()) {
        return 0
    }
    if (c.stateIs(ZiluCellState.HasSign)) {
        return 1
    }
    if (c.stateIs(ZiluCellState.HasFragment)) {
        return 2
    }
    return 3
}

/* 一行格子（5 格），避免在 ForEach 里写泛型闭包参数。 */
public class UiGridRow {
    public let cells: ArrayList<ZiluGridCell>

    public init(cells: ArrayList<ZiluGridCell>) {
        this.cells = cells
    }
}

/* 单个格子：已造显字、有事签/残片显「?」+ 小字、未知只显「?」；选中加粗描边，
   新造带「新」角标。 */
@Component
public class ZiluGridCellView {
    @Prop var glyph: String
    @Prop var hint: String
    @Prop var stateCode: Int64
    @Prop var isNew: Bool
    @Prop var selected: Bool
    @Prop var onTap: () -> Unit

    func isMade(): Bool {
        return this.stateCode == 0
    }

    func isSign(): Bool {
        return this.stateCode == 1
    }

    func isFragment(): Bool {
        return this.stateCode == 2
    }

    func build() {
        Column {
            if (this.isMade()) {
                Text(this.glyph)
                    .fontSize(Theme.fsGridChar)
                    .fontFamily(Theme.serif)
                    .fontWeight(FontWeight.Bold)
                    .fontColor(Theme.ink900)
            } else if (this.isSign()) {
                Text("?")
                    .fontSize(24)
                    .fontFamily(Theme.sans)
                    .fontWeight(FontWeight.Bold)
                    .fontColor(Theme.ink600)
                Text(this.hint)
                    .fontSize(10)
                    .fontFamily(Theme.sans)
                    .fontColor(Theme.ink600)
                    .margin(top: 5)
            } else if (this.isFragment()) {
                Text("?")
                    .fontSize(24)
                    .fontFamily(Theme.sans)
                    .fontWeight(FontWeight.Bold)
                    .fontColor(Theme.jade600)
                Text(this.hint)
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
            if (this.isNew) {
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
        .backgroundColor(if (this.isMade()) {
            if (this.selected) { Theme.bone100 } else { Theme.paper50 }
        } else {
            if (this.isFragment()) { Theme.jade100 }
            else { if (this.stateCode == 3) { Theme.paper200 } else { Theme.paper50 } }
        })
        .border(
            width: if (this.selected) { 2 } else { 1 },
            color: if (this.selected) { Theme.zhu600 }
                else {
                    if (this.isFragment()) { Theme.jade600 }
                    else { Theme.ink600 }
                },
            style: if (this.isSign()) { BorderStyle.Dashed } else { BorderStyle.Solid }
        )
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .onClick({event => this.onTap()})
    }
}

/* 格子总览：先按分页过滤（只对已造的字按造法过滤），再按一行 5 格切行。 */
@Component
public class ZiluGridOverview {
    /* 分页条：0 全部 / 1 象形 / 2 会意 / 3 指事。 */
    @Prop var tab: Int64
    @Prop var selectedId: String
    @Prop var onSelect: (String) -> Unit

    /* 分页后要显示的格子（只对已造的字按造法过滤）。
       该分页有哪些字走 ziluTabIds（与切 tab 时改选中用同一个函数，两处不会不一致）。 */
    func visibleCells(): ArrayList<ZiluGridCell> {
        let all = ziluGrid()
        let ids = ziluTabIds(this.tab)
        let out = ArrayList<ZiluGridCell>()
        var i: Int64 = 0
        while (i < all.size) {
            let c = all[i]
            if (this.tab == 0 || (c.isMade() && ziluHasId(ids, c.charId))) {
                out.add(c)
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

    func pick(c: ZiluGridCell): Unit {
        if (c.isMade()) {
            this.onSelect(c.charId)
        }
    }

    func build() {
        Column {
            /* 已造 / 未知数按已造列表现算（原来是写死的「已造 8 · … 未知 17」）。 */
            Text(ziluGridSummary())
                .fontSize(12)
                .fontFamily(Theme.sans)
                .fontColor(Theme.ink600)
                .width(100.percent)
                .margin(top: 20)
            Column(space: Theme.gridGap) {
                /* key 都带上会变的东西（分页 / 选中字 / 下标）：不传 keyGenerator 时
                   ForEach 按下标复用，数据变了不重建 → 切分页网格不筛、选中不跟字。 */
                ForEach(this.gridRows(), itemGeneratorFunc: {row: UiGridRow, i: Int64 =>
                    Row {
                        ForEach(row.cells, itemGeneratorFunc: {c: ZiluGridCell, j: Int64 =>
                            ZiluGridCellView(
                                glyph: c.glyph,
                                hint: c.hint,
                                stateCode: ziluStateCode(c),
                                isNew: c.isNew,
                                selected: (c.charId == this.selectedId),
                                onTap: { => this.pick(c) }
                            )
                        }, keyGeneratorFunc: {c: ZiluGridCell, j: Int64 =>
                            "${this.tab}_${c.charId}_${c.charId == this.selectedId}_${j}"
                        })
                    }
                }, keyGeneratorFunc: {row: UiGridRow, i: Int64 =>
                    "${this.tab}_${this.selectedId}_${i}"
                })
            }
            .width(100.percent)
            .margin(top: Theme.gridGap)
            .padding(bottom: 24)
        }
        .width(100.percent)
    }
}
