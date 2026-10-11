package ohos_app_cangjie_entry

import kit.ArkUI.*
import ohos.arkui.state_macro_manage.*

/* 字录（zilu_detail_v1）外壳：只管自己的 @State（分页 tab / 放大卡开关与下标），
   版面按四块拼出来：
     ZiluNavBar      ui_zilu_nav.cj    返回 / 标题 / 计数胶囊
     ZiluTabs        ui_zilu_nav.cj    全部 / 象形 / 会意 / 指事
     ZiluDetailCard  ui_zilu_detail.cj 大字 + 白话 / 典籍 / 演变 / 故事 / 效果
     ZiluGridOverview ui_zilu_grid.cj  27 格总览
   原来这些都写在 ZiluScreen 单个 build() 里（500 行、六七层嵌套），
   DevEco 上 @Component 宏展开失败（ui_zilu.cj:19 macro evaluation has failed）。
   拆成 @Component 后每个 build() 只负责一层，宏能正常展开。
   空着的情况：典籍查不到 → 整块不显示；某阶段没有字形 → 那一格不出现。 */

@Component
public class ZiluScreen {
    @Prop var selectedId: String
    @Prop var onSelect: (String) -> Unit
    @Prop var onGoCard: () -> Unit
    /* 字录导航「‹」：回 EntryView 的造字 tab。 */
    @Prop var onBack: () -> Unit

    /* 分页条：0 全部 / 1 象形 / 2 会意 / 3 指事。 */
    @State var tab: Int64 = 0
    @State var showPop: Bool = false
    @State var popIndex: Int64 = 0

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

    /* 当前字演变条的格数（放大卡的上一格 / 下一格按它钳制）。 */
    func popCount(): Int64 {
        return buildDetailStrip(this.selectedId).cells.size
    }

    /* 放大卡下标：越界时退回第 0 格（父组件只透传字段，钳制放在最底层）。 */
    func popIndexSafe(): Int64 {
        if (this.popIndex < this.popCount() && this.popIndex >= 0) {
            return this.popIndex
        }
        return 0
    }

    func setTab(i: Int64): Unit {
        this.tab = i
        /* 切分页时若当前选中的字不在这个分页里，就把选中改成该分页第一个已造的字，
           让详情卡跟着分页走；tab 0（全部）与空分页不动。 */
        if (i != 0 && !ziluTabHasChar(i, this.selectedId)) {
            let first = ziluTabFirstId(i)
            if (first.size > 0) {
                this.pick(first)
            }
        }
    }

    /* 换字：放大卡归第 0 格并关掉，避免上一个字的阶段残留。 */
    func pick(id: String): Unit {
        this.popIndex = 0
        this.showPop = false
        this.onSelect(id)
    }

    func openPop(i: Int64): Unit {
        this.popIndex = i
        this.showPop = true
    }

    func prevPop(): Unit {
        let n = this.popCount()
        if (this.popIndexSafe() > 0 && n > 0) {
            this.popIndex = this.popIndexSafe() - 1
        }
    }

    func nextPop(): Unit {
        let n = this.popCount()
        if (n > 0 && this.popIndexSafe() < n - 1) {
            this.popIndex = this.popIndexSafe() + 1
        }
    }

    func build() {
        Column {
            ZiluNavBar(onBack: { => this.onBack() })

            ZiluTabs(
                tab: this.tab,
                onTab: {i => this.setTab(i)},
                nAll: this.ziluNAll(),
                nXiang: this.ziluNXiang(),
                nHuiyi: this.ziluNHuiyi(),
                nZhishi: this.ziluNZhishi()
            )

            Scroll {
                Column(space: 0) {
                    ZiluDetailCard(
                        selectedId: this.selectedId,
                        showPop: this.showPop,
                        /* 直接传字段：写成函数调用时状态宏识别不到对 @State 的依赖，
                           父组件改了子组件不更新（› / ‹ 就这样失效的）。 */
                        popIndex: this.popIndex,
                        onGoCard: { => this.onGoCard() },
                        onEvoSelect: {i => this.openPop(i)},
                        onPrev: { => this.prevPop()},
                        onNext: { => this.nextPop()}
                    )

                    ZiluGridOverview(
                        tab: this.tab,
                        selectedId: this.selectedId,
                        onSelect: {id => this.pick(id)}
                    )
                }
                .width(100.percent)
                .padding(left: Theme.insetPaper, right: Theme.insetPaper)
            }
            .layoutWeight(1)
        }
        .width(100.percent)
        .height(100.percent)
        .backgroundColor(Theme.paper100)
    }
}
