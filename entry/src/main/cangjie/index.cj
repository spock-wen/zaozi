package ohos_app_cangjie_entry

import kit.ArkUI.*
import ohos.arkui.state_macro_manage.*

/* 造字人 v1.2「一代闭环」：一个 @Entry，首屏由存档状态 RunState.phase 驱动
   （0 开局挑字 / 1 主界），主界上再开二级界面（字录 / 演变条 / 造字卡）。
   main_ability.cj 用 windowStage.loadContent("EntryView") 加载本类。
   冷启：aboutToAppear 里读档（run_store.cj → Preferences）——新装 / 坏档都是
   开局挑字页；挑字落定即存档，杀掉再进直接回主界。
   版式数值全部来自 /workspace/zaozi-formal/v2/SPEC.md，见 theme.cj。 */

@Entry
@Component
class EntryView {
    /* 存档状态。phase 0 → 开局挑字页；phase 1 → 主界（结局卡 / 代末结算
       由后面的 slice 接，phase 2 / 3 也走主界占位）。 */
    @State var run: RunState = newRunState()
    /* 二级界面：0 无 / 1 字录 / 2 演变条 / 3 造字卡。 */
    @State var sub: Int64 = 0
    /* 字录当前选中的字（造字卡弹层「看字录」会跳到「休」）。 */
    @State var ziluSelected: String = ZILU_SELECTED_ID
    /* 本次会话是否已看过「休」的成字动画。看过 → 再进造字卡直接落定，
       不自动播、不弹层（否则「继续」会变成重播，无限循环）。 */
    @State var cardDone: Bool = false

    /* 冷启读档。新装 / 存档坏 → 新开局（phase 0 挑字页）。 */
    public func aboutToAppear(): Unit {
        this.run = RunStore.load()
    }

    /* 挑字落定：挑的字进字匣、phase 进主界，随即存档（杀掉再进回主界）。
       复制一份新状态赋回 @State —— class 类型的 @State 认的是引用变化，
       只改内部字段不保证触发重绘。 */
    func confirmPick(picked: Array<String>): Unit {
        let next = runAfterPick(this.run, picked)
        this.run = next
        RunStore.save(next)
    }

    /* 主界选定一个选项（0 左 / 1 右 / 2 落字）：四维增减、牌堆前进一步、
       三年一过、结局判定全在 game_rules.applyChoice，这里只负责换引用 + 存档。
       落到 phase 2（结局）时主界面换成占位的一行字（结局卡是 slice 4）。 */
    func pick(side: Int64): Unit {
        let next = applyChoice(this.run, side)
        this.run = next
        RunStore.save(next)
    }

    func openSub(i: Int64): Unit {
        this.sub = i
    }

    /* 这一局的结局标题（没有结局 → 空串，占位行整行不显示）。 */
    func endingTitle(): String {
        match (endingOfState(this.run)) {
            case Some(info) => return info.title
            case None => return ""
        }
    }

    func goZilu(): Unit {
        this.ziluSelected = ZILU_SELECTED_ID
        this.sub = 1
    }

    /* 字录「再看一次」：把 cardDone 置回 false 再切回造字卡，
       CardScreen 重建后就会重新播放（播完仍弹层，「继续」仍是关层）。 */
    func replayCard(): Unit {
        this.cardDone = false
        this.sub = 3
    }

    /* 系统 Back：先关二级界面回首屏；首屏上返回 false 让系统默认处理。 */
    protected override func onBackPress(): Bool {
        if (this.sub != 0) {
            this.sub = 0
            return true
        }
        return false
    }

    func build() {
        Column {
            if (this.sub == 1) {
                ZiluScreen(
                    selectedId: this.ziluSelected,
                    onSelect: {id => this.ziluSelected = id},
                    onGoCard: { => this.replayCard() },
                    onBack: { => this.sub = 0 }
                )
            } else if (this.sub == 2) {
                EvoStripScreen()
            } else if (this.sub == 3) {
                CardScreen(
                    cardDone: this.cardDone,
                    onDone: { => this.cardDone = true },
                    onGoZilu: { => this.goZilu() }
                )
            } else if (this.run.phase == RUN_PHASE_PICK) {
                PickScreen(
                    generation: this.run.generation,
                    onConfirm: {picked => this.confirmPick(picked)}
                )
            } else if (this.run.phase == RUN_PHASE_ENDING) {
                /* 结局卡是 slice 4；现在只落一行占位字，界面不空、也不崩。 */
                HomeEndingHolder(title: this.endingTitle())
            } else {
                HomeScreen(
                    generation: this.run.generation,
                    year: this.run.year,
                    yearsLeft: this.run.yearsLeft,
                    dims: this.run.dims,
                    boneEmpty: this.run.boneEmpty,
                    boneShiqian: this.run.boneShiqian,
                    boxChars: this.run.boxChars,
                    cardIndex: this.run.cardIndex,
                    onPick: {side => this.pick(side)},
                    onOpenZilu: { => this.openSub(1) },
                    onOpenEvo: { => this.openSub(2) },
                    onOpenCard: { => this.openSub(3) }
                )
            }
        }
        .width(100.percent)
        .height(100.percent)
        .backgroundColor(Theme.night900)
    }
}
