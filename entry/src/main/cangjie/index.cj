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
    /* 字匣选中态（界面状态，不进存档）：-1 = 没有选中（game_rules.BOX_SLOT_NONE）。
       放在这一层是因为详情弹层的开关也要被 onBackPress 看见。 */
    @State var selectedSlot: Int64 = BOX_SLOT_NONE
    /* 字匣详情弹层开着没有 / 开的是哪一格。 */
    @State var boxSheetOpen: Bool = false
    @State var boxSheetSlot: Int64 = BOX_SLOT_NONE

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

    /* 点字匣某一格（SPEC §2.4：点字可落 · 每字每代一次）：
       可落的格 → 选中它并打开详情弹层（再点一下同一格就是取消选中、关层）；
       本代已落的格 → 只打开弹层看，不改选中；空格 / 事签格点了不动。 */
    func selectBoxSlot(i: Int64): Unit {
        let st = boxSlotStateOf(this.run.boxChars, this.run.boxLanded, this.selectedSlot, i)
        if (st == BOX_SLOT_EMPTY || st == BOX_SLOT_SHIQIAN) { return }
        if (st == BOX_SLOT_OK) {
            if (this.selectedSlot == i) {
                /* 再点一下已选中的格：取消选中，关层。 */
                this.selectedSlot = BOX_SLOT_NONE
                this.closeBoxSheet()
                return
            }
            this.selectedSlot = i
        }
        this.boxSheetSlot = i
        this.boxSheetOpen = true
    }

    func closeBoxSheet(): Unit {
        this.boxSheetOpen = false
        this.boxSheetSlot = BOX_SLOT_NONE
    }

    /* 详情弹层的「在卡上落字」：关层、留着选中，卡底那条已经是「落「X」字」。 */
    func landFromSheet(): Unit {
        this.closeBoxSheet()
    }

    /* 主界选定一个选项（0 左 / 1 右 / 2 落字）：四维增减、牌堆前进一步、
       三年一过、结局判定全在 game_rules.applyChoice；落字走 applyLuozi
       （多一步：这一格标记「本代已落」）。这里只负责换引用 + 存档。
       落到 phase 2（结局）时主界面换成占位的一行字（结局卡是 slice 4）。 */
    func pick(side: Int64): Unit {
        if (side == RUN_SIDE_LUOZI) {
            let next = applyLuozi(this.run, this.selectedSlot)
            /* 没落下（卡不允许 / 没选中可落的格）：状态、选中都别动。 */
            if (next.cardsSeen == this.run.cardsSeen) { return }
            this.run = next
            RunStore.save(next)
            this.selectedSlot = BOX_SLOT_NONE
            return
        }
        let next = applyChoice(this.run, side)
        this.run = next
        RunStore.save(next)
        /* 选完这一张，字匣的选中跟着清掉（下一张重新挑）。 */
        this.selectedSlot = BOX_SLOT_NONE
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

    /* 系统 Back：先关字匣详情弹层，再关二级界面，最后才让系统默认处理
       （弹层开着的时候绝不能直接退回桌面）。 */
    protected override func onBackPress(): Bool {
        if (this.boxSheetOpen) {
            this.closeBoxSheet()
            return true
        }
        if (this.sub != 0) {
            this.sub = 0
            return true
        }
        return false
    }

    /* 字匣详情弹层上的那一格（选中态 / 已落态都照实际状态画徽标）。 */
    func boxSheetState(): Int64 {
        return boxSlotStateOf(this.run.boxChars, this.run.boxLanded, this.selectedSlot, this.boxSheetSlot)
    }

    /* 弹层上的字id（查造法 / 白话字义用）与字形（大字用）。boxChars 存的是 id。 */
    func boxSheetCharId(): String {
        if (this.boxSheetSlot < 0 || this.boxSheetSlot >= this.run.boxChars.size) { return "" }
        return this.run.boxChars[this.boxSheetSlot]
    }

    func boxSheetGlyph(): String {
        if (boxSlotIsShiqianId(this.boxSheetCharId())) { return BOX_SLOT_SHIQIAN_TEXT }
        return ziluGlyphOf(this.boxSheetCharId())
    }

    func build() {
        Stack {
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
                    boxLanded: this.run.boxLanded,
                    selectedSlot: this.selectedSlot,
                    cardIndex: this.run.cardIndex,
                    onPick: {side => this.pick(side)},
                    onSelectSlot: {i => this.selectBoxSlot(i)},
                    onOpenZilu: { => this.openSub(1) },
                    onOpenEvo: { => this.openSub(2) },
                    onOpenCard: { => this.openSub(3) }
                )
            }
            }

            /* 字匣详情弹层：盖在首屏之上（遮罩 45% 黑 + 底部弹层）。
               只有主界开着才有；二级界面 / 挑字页 / 结局占位都不出。 */
            if (this.boxSheetOpen && this.sub == 0 && this.run.phase == RUN_PHASE_HOME) {
                BoxSheet(
                    charId: this.boxSheetCharId(),
                    glyph: this.boxSheetGlyph(),
                    state: this.boxSheetState(),
                    onClose: { => this.closeBoxSheet() },
                    onLand: { => this.landFromSheet() }
                )
            }
        }
        .width(100.percent)
        .height(100.percent)
        .backgroundColor(Theme.night900)
    }
}
