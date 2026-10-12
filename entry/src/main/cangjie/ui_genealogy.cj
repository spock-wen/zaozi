package ohos_app_cangjie_entry

import kit.ArkUI.*
import ohos.arkui.state_macro_manage.*

/* 家谱面板（结局卡 / 代末结算页的「看家谱」；ui_genealogy.cj）。
   原来是点了只落一句 StubHint 小字，测试看着像没反应；现在弹一个底部面板：
   全屏 45% 黑遮罩（点遮罩关）+ 底部 paper-100 弹层（上圆角 Theme.sheetRadius），
   里面复用 ui_settle.cj 的 SettleGenealogyBlock 列家谱（最老在上）。
   拆成小 @Component（@Component 宏展开撑不住大 build()）：
     GenealogyPanelKey    小标「家谱」12 Bold 朱
     GenealogyPanelTitle  标题 Serif 24 Bold
     GenealogyPanelRange  「第 X – Y 代」一行小字
     GenealogyPanelClose  底部描边按钮「回去」
     GenealogyPanel       组装：遮罩 + 弹层
   完整家谱页（进度卡、主线段数、超过一屏分页）仍是 full version 的事，
   弹层里那行小字（GENEALOGY_PANEL_NOTE）就是说明这个。
   rows / thisGen 由 index.cj 在 if 里新建面板时传进来（数组当 @Prop 只在组件
   新建时用一次，同 SettleScreen 的 rows）。 */

/* 小标「家谱」12 Bold 朱（设计稿 .sheet .k 那一档）。 */
@Component
public class GenealogyPanelKey {
    func build() {
        Text(GENEALOGY_PANEL_KEY)
            .fontSize(Theme.fsSectionTitle)
            .fontFamily(Theme.sans)
            .fontWeight(FontWeight.Bold)
            .fontColor(Theme.zhu600)
            .width(100.percent)
    }
}

/* 标题 Serif 24 Bold。 */
@Component
public class GenealogyPanelTitle {
    func build() {
        Text(GENEALOGY_PANEL_TITLE)
            .fontSize(Theme.fsSheetTitle)
            .fontFamily(Theme.serif)
            .fontWeight(FontWeight.Bold)
            .fontColor(Theme.ink900)
            .width(100.percent)
            .margin(top: 8)
    }
}

/* 「第 X – Y 代」：最老一代到最新一代（家谱最老在上，所以取首尾两条）。 */
@Component
public class GenealogyPanelRange {
    @Prop var rows: Array<FamilyEntry>
    @Prop var thisGen: Int64

    func text(): String {
        return genealogyPanelRange(this.rows, this.thisGen)
    }

    func build() {
        Text(this.text())
            .fontSize(Theme.fsStatus)
            .fontFamily(Theme.sans)
            .fontColor(Theme.ink600)
            .width(100.percent)
            .margin(top: 4)
    }
}

/* 底部描边按钮「回去」：关面板。版式同代末页 SettleBtns 左边那颗。 */
@Component
public class GenealogyPanelClose {
    @Prop var onTap: () -> Unit

    func build() {
        Text(GENEALOGY_PANEL_CLOSE)
            .fontSize(Theme.fsButton)
            .fontFamily(Theme.sans)
            .fontWeight(FontWeight.Bold)
            .fontColor(Theme.ink900)
            .height(Theme.buttonH)
            .borderRadius(22)
            .border(width: 1, color: Theme.ink400)
            .width(100.percent)
            .textAlign(TextAlign.Center)
            .onClick({event => this.onTap()})
    }
}

/* 家谱面板整层：遮罩点一下关，弹层贴在底（上圆角）。
   放在 index.cj 根 Stack 的最后一层 → 盖在结局卡 / 代末结算页之上。 */
@Component
public class GenealogyPanel {
    /* 家谱行（最老在上、本代在最下；至少两行：上一代 + 本代）。 */
    @Prop var rows: Array<FamilyEntry>
    /* 本代代次（「新」角标画它身上）。 */
    @Prop var thisGen: Int64
    @Prop var onClose: () -> Unit

    func build() {
        Stack {
            /* 遮罩 45% 黑，点它关面板。 */
            Text("")
                .width(100.percent)
                .height(100.percent)
                .backgroundColor(Theme.scrimBlack45)
                .onClick({event => this.onClose()})

            /* 弹层贴底：同 ui_box_sheet.cj 的 BoxSheet，外面套一层满高 Column +
               justifyContent(End)（子组件上的 .align() 不定位 Stack 的子组件）。 */
            Column {
            Column {
                /* 把手 36×4（同其它底部弹层）。 */
                Row()
                    .width(36)
                    .height(4)
                    .borderRadius(2)
                    .backgroundColor(Theme.paperLine)

                Column {
                    GenealogyPanelKey()
                    GenealogyPanelTitle()
                    GenealogyPanelRange(rows: this.rows, thisGen: this.thisGen)

                    /* 家谱行：一行一代，复用代末结算页那一块（最老在上）。 */
                    SettleGenealogyBlock(rows: this.rows, thisGen: this.thisGen)

                    /* 完整家谱页不在本切片：一行小字说明。 */
                    Text(GENEALOGY_PANEL_NOTE)
                        .fontSize(Theme.fsNote)
                        .fontFamily(Theme.sans)
                        .fontColor(Theme.ink600)
                        .width(100.percent)
                        .margin(top: 10)

                    /* 自建组件不能挂链式属性（@Component 宏不认），套一层
                       Column 把 margin 放容器上（同 ui_card.cj 的 GhostButton）。 */
                    Column {
                        GenealogyPanelClose(onTap: { => this.onClose() })
                    }
                    /* 容器也要给宽度：Column 默认 alignItems 是 Center，
                       不写 100% 会缩成内容宽，里面 100% 就没有基准了。 */
                    .width(100.percent)
                    .margin(top: 14)
                }
                .width(100.percent)
            }
            .width(100.percent)
            .backgroundColor(Theme.paper100)
            .borderRadius(topLeft: Theme.sheetRadius, topRight: Theme.sheetRadius)
            .padding(left: Theme.insetNight, right: Theme.insetNight, top: 10, bottom: 20)
            }
            .width(100.percent)
            .height(100.percent)
            .justifyContent(FlexAlign.End)
        }
        .width(100.percent)
        .height(100.percent)
    }
}
