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
    /* 本次会话是否已看过「休」的成字动画。看过 → 再进造字 tab 直接落定，
       不自动播、不弹层（否则「继续」会变成重播，无限循环）。 */
    @State var cardDone: Bool = false

    func goZilu(): Unit {
        this.ziluSelected = ZILU_SELECTED_ID
        this.screen = 2
    }

    /* 字录「再看一次」：把 cardDone 置回 false 再切回造字 tab，
       CardScreen 重建后就会重新播放（播完仍弹层，「继续」仍是关层）。 */
    func replayCard(): Unit {
        this.cardDone = false
        this.screen = 0
    }

    /* 系统 Back：应用内返回到造字 tab，不退桌面。造字 tab 上就让系统默认处理。 */
    protected override func onBackPress(): Bool {
        if (this.screen != 0) {
            this.screen = 0
            return true
        }
        return false
    }

    func build() {
        Column {
            TopSwitcher(
                screen: this.screen,
                onSwitch: {i => this.screen = i}
            )

            if (this.screen == 0) {
                CardScreen(
                    cardDone: this.cardDone,
                    onDone: { => this.cardDone = true },
                    onGoZilu: { => this.goZilu() }
                )
            } else if (this.screen == 1) {
                EvoStripScreen()
            } else {
                ZiluScreen(
                    selectedId: this.ziluSelected,
                    onSelect: {id => this.ziluSelected = id},
                    onGoCard: { => this.replayCard() },
                    onBack: { => this.screen = 0 }
                )
            }
        }
        .width(100.percent)
        .height(100.percent)
        .backgroundColor(Theme.night900)
    }
}
