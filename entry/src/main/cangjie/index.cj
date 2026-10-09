package ohos_app_cangjie_entry

import kit.ArkUI.*
import ohos.arkui.state_macro_manage.*

/* 造字人 v1.1.1 首版：一个 @Entry，顶部三段切换器切三套界面。
   main_ability.cj 用 windowStage.loadContent("EntryView") 加载本类。
   造字 = card_zaozi_v1；演变条 = evo_strip_v1；字录 = zilu_detail_v1。
   版式数值全部来自 /workspace/zaozi-formal/v1/SPEC.md，见 theme.cj。 */

@Entry
@Component
class EntryView {
    /* 0 造字 / 1 演变条 / 2 字录。 */
    @State var screen: Int64 = 0
    /* 字录当前选中的字（造字卡弹层「看字录」会跳到「休」）。 */
    @State var ziluSelected: String = ZILU_SELECTED_ID

    func goZilu(): Unit {
        this.ziluSelected = ZILU_SELECTED_ID
        this.screen = 2
    }

    func build() {
        Column {
            TopSwitcher(
                screen: this.screen,
                onSwitch: {i => this.screen = i}
            )

            if (this.screen == 0) {
                CardScreen(
                    onGoZilu: { => this.goZilu() }
                )
            } else if (this.screen == 1) {
                EvoStripScreen()
            } else {
                ZiluScreen(
                    selectedId: this.ziluSelected,
                    onSelect: {id => this.ziluSelected = id},
                    onGoCard: { => this.screen = 0 }
                )
            }
        }
        .width(100.percent)
        .height(100.percent)
        .backgroundColor(Theme.night900)
    }
}
