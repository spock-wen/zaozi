package ohos_app_cangjie_entry

import kit.ArkUI.*
import ohos.arkui.state_macro_manage.*

/* 字录顶部两行：导航行（返回 / 标题 / 计数胶囊）+ 分页条（全部 / 象形 / 会意 / 指事）。
   这两行从 ZiluScreen.build() 里拆出来单独成 @Component：
   ZiluScreen 原来一个 build() 有 500 行嵌套，DevEco 上 @Component 宏展开直接失败
   （macro evaluation has failed），拆小后每个 build() 只负责一层。
   计数由父组件用 ziluCounts() 算好后按 @Prop 传进来。 */

/* 导航：返回 / 字录 / 计数胶囊。 */
@Component
public class ZiluNavBar {
    func build() {
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
    }
}

/* 分页条：0 全部 / 1 象形 / 2 会意 / 3 指事，选中态加粗 + 纸白字。 */
@Component
public class ZiluTabs {
    @Prop var tab: Int64
    @Prop var onTab: (Int64) -> Unit
    @Prop var nAll: Int64
    @Prop var nXiang: Int64
    @Prop var nHuiyi: Int64
    @Prop var nZhishi: Int64

    func build() {
        Row {
            Text("${ZILU_TAB_ALL} ${this.nAll}")
                .fontSize(14)
                .fontFamily(Theme.sans)
                .fontWeight(if (this.tab == 0) { FontWeight.Bold } else { FontWeight.Normal })
                .fontColor(if (this.tab == 0) { Theme.paper50 } else { Theme.ink600 })
                .layoutWeight(1)
                .textAlign(TextAlign.Center)
                .onClick({event => this.onTab(0)})
            Text("${ZILU_TAB_XIANG} ${this.nXiang}")
                .fontSize(14)
                .fontFamily(Theme.sans)
                .fontWeight(if (this.tab == 1) { FontWeight.Bold } else { FontWeight.Normal })
                .fontColor(if (this.tab == 1) { Theme.paper50 } else { Theme.ink600 })
                .layoutWeight(1)
                .textAlign(TextAlign.Center)
                .onClick({event => this.onTab(1)})
            Text("${ZILU_TAB_HUIYI} ${this.nHuiyi}")
                .fontSize(14)
                .fontFamily(Theme.sans)
                .fontWeight(if (this.tab == 2) { FontWeight.Bold } else { FontWeight.Normal })
                .fontColor(if (this.tab == 2) { Theme.paper50 } else { Theme.ink600 })
                .layoutWeight(1)
                .textAlign(TextAlign.Center)
                .onClick({event => this.onTab(2)})
            Text("${ZILU_TAB_ZHISHI} ${this.nZhishi}")
                .fontSize(14)
                .fontFamily(Theme.sans)
                .fontWeight(if (this.tab == 3) { FontWeight.Bold } else { FontWeight.Normal })
                .fontColor(if (this.tab == 3) { Theme.paper50 } else { Theme.ink600 })
                .layoutWeight(1)
                .textAlign(TextAlign.Center)
                .onClick({event => this.onTab(3)})
        }
        .width(100.percent)
        .height(36)
        .borderRadius(18)
        .backgroundColor(Theme.paper200)
        .padding(left: 3, right: 3)
        .margin(left: Theme.insetPaper, right: Theme.insetPaper)
    }
}
