package ohos_app_cangjie_entry

import kit.ArkUI.*
import ohos.arkui.state_macro_manage.*

/* 造字人 v1.2「一代闭环」：一个 @Entry，首屏由存档状态 RunState.phase 驱动
   （0 开局挑字 / 1 主界 / 2 结局卡 / 3 代末结算），主界上再开二级界面
   （字录 / 演变条 / 造字卡）。
   main_ability.cj 用 windowStage.loadContent("EntryView") 加载本类。
   冷启：aboutToAppear 里读档（run_store.cj → Preferences）——新装 / 坏档都是
   开局挑字页；挑字落定即存档，杀掉再进直接回主界。phase 2 / 3 的存档
   （结局卡 / 代末结算）杀掉再进也回到原页，不丢进度。
   版式数值全部来自 /workspace/zaozi-formal/v2/SPEC.md，见 theme.cj。 */

@Entry
@Component
class EntryView {
    /* 存档状态。phase 0 → 开局挑字页；1 → 主界；2 → 结局卡（盖在主界上）；
       3 → 代末结算页。 */
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
    /* 触底 / 溢出那一下的闪朱（SPEC §2.1 归零/满 闪朱 2 次，各 ~200ms）：
       flashDim 是哪一维，flashOn 是这一下亮不亮。结束语由 flashStep 链式推进。 */
    @State var flashDim: Int64 = -1
    @State var flashOn: Bool = false
    /* 闪完两下才让结局卡出来（闪朱时主界还没压暗）。 */
    @State var endingShown: Bool = false
    /* 闪朱动画代次：换局 / 退出结局时 +1，让还挂着的 onFinish 直接失效。 */
    @State var flashGen: Int64 = 0
    /* 「看家谱」按钮的提示（家谱独立页不在本切片）：非空时页面底部露一行小字。 */
    @State var stubText: String = ""

    /* 冷启读档。新装 / 存档坏 → 新开局（phase 0 挑字页）。
       读档回来就是 phase 2 / 3（结局卡 / 代末结算）时不再闪朱、直接出卡。 */
    public func aboutToAppear(): Unit {
        this.run = RunStore.load()
        this.endingShown = this.run.phase != RUN_PHASE_HOME
    }

    /* 挑字落定：挑的字进字匣、phase 进主界，随即存档（杀掉再进回主界）。
       复制一份新状态赋回 @State —— class 类型的 @State 认的是引用变化，
       只改内部字段不保证触发重绘。 */
    func confirmPick(picked: Array<String>): Unit {
        let next = runAfterPick(this.run, picked)
        this.run = next
        RunStore.save(next)
        this.stubText = ""
        this.flashOn = false
        this.flashDim = -1
        this.endingShown = false
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
       落到 phase 2（结局）时先闪朱两下，再浮出结局卡（ui_ending.cj）。 */
    func pick(side: Int64): Unit {
        if (side == RUN_SIDE_LUOZI) {
            let next = applyLuozi(this.run, this.selectedSlot)
            /* 没落下（卡不允许 / 没选中可落的格）：状态、选中都别动。 */
            if (next.cardsSeen == this.run.cardsSeen) { return }
            this.run = next
            RunStore.save(next)
            this.selectedSlot = BOX_SLOT_NONE
            if (next.phase == RUN_PHASE_ENDING) { this.startFlash(next.endingDim) }
            return
        }
        let next = applyChoice(this.run, side)
        this.run = next
        RunStore.save(next)
        /* 选完这一张，字匣的选中跟着清掉（下一张重新挑）。 */
        this.selectedSlot = BOX_SLOT_NONE
        /* 落到结局：那一维的条先闪朱两下，然后主界压暗、结局卡升起。 */
        if (next.phase == RUN_PHASE_ENDING) { this.startFlash(next.endingDim) }
    }

    /* 调试入口「调试：粮归零」（DEBUG ONLY，默认关，见 game_rules.cj 的
       M2_DEBUG_FORCE_END）：把粮按到 0，再走完全正常的判结局路径。 */
    func debugZero(): Unit {
        let next = debugForceDimZero(this.run, 0)
        if (next.sameAs(this.run)) { return }
        this.run = next
        RunStore.save(next)
        this.selectedSlot = BOX_SLOT_NONE
        this.startFlash(next.endingDim)
    }

    /* —— 触底 / 溢出：那一维的条闪朱 2 次（SPEC §2.1 / §2.7）——
       亮 200ms → 暗 200ms → 亮 200ms → 暗，然后才让结局卡出来。
       计时用本仓库已验证的 getUIContext().animateTo(onFinish:) 链式推进
       （不引入 setInterval 这类未验证 API，同 ui_card.cj 的播放节奏）。 */
    func startFlash(dim: Int64): Unit {
        this.flashGen = this.flashGen + 1
        this.flashDim = dim
        this.flashOn = true
        this.endingShown = false
        this.flashStep(this.flashGen, 0)
    }

    func flashStep(g: Int64, n: Int64): Unit {
        this.getUIContext().animateTo(
            AnimateParam(duration: 200, onFinish: Some({ =>
                if (g == this.flashGen) {
                    this.flashTick(g, n)
                }
            })),
            { => }
        )
    }

    func flashTick(g: Int64, n: Int64): Unit {
        if (g != this.flashGen) { return }
        /* 三拍（暗 / 亮 / 暗）走完：收尾，出结局卡。 */
        if (n >= 3) {
            this.flashOn = false
            this.flashDim = -1
            this.endingShown = true
            return
        }
        this.flashOn = (n % 2 == 1)
        this.flashStep(g, n + 1)
    }

    /* 「往下传」：这一代写进家谱，开下一代（phase 0 开局挑字）并存档。 */
    func settleNext(): Unit {
        let next = settleAndNextGeneration(this.run)
        /* 没有结局（不该发生）时原样返回，界面停在结局卡。 */
        if (next.sameAs(this.run)) { return }
        this.flashGen = this.flashGen + 1
        this.flashOn = false
        this.flashDim = -1
        this.endingShown = true
        this.selectedSlot = BOX_SLOT_NONE
        this.run = next
        RunStore.save(next)
        this.stubText = ""
    }

    /* 「看家谱」：家谱独立页（设计稿 G）不在本切片，点了只落一句提示。 */
    func genealogyStub(): Unit {
        this.stubText = SETTLE_GENEALOGY_STUB
    }

    func openSub(i: Int64): Unit {
        this.sub = i
    }

    /* 这一局的结局标题（没有结局 → 空串）。 */
    func endingTitle(): String {
        match (endingOfState(this.run)) {
            case Some(info) => return info.title
            case None => return ""
        }
    }

    /* 这一局是不是善终（模板 B 换色 / 换文案用）。 */
    func endingGood(): Bool {
        match (endingOfState(this.run)) {
            case Some(info) => return info.good
            case None => return false
        }
    }

    /* 这一代留下的字（结局卡 40×40 那一排 + 代末页 44×44 那一排）。 */
    func keepGlyphs(): Array<String> {
        return landedGlyphs(this.run)
    }

    /* 家谱行：上一代（家谱里已有的）+ 本代，最老在上、最新在下。 */
    func genealogyRows(): Array<FamilyEntry> {
        return familyRows(this.run)
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

    /* 系统 Back：先关字匣详情弹层，再关二级界面；结局卡 / 代末结算页上
       一律拦下来返回 true（一代没传完，不能直接退回桌面）。 */
    protected override func onBackPress(): Bool {
        if (this.boxSheetOpen) {
            this.closeBoxSheet()
            return true
        }
        if (this.sub != 0) {
            this.sub = 0
            return true
        }
        if (this.run.phase == RUN_PHASE_ENDING || this.run.phase == RUN_PHASE_SETTLE) {
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
            } else if (this.run.phase == RUN_PHASE_SETTLE) {
                /* 代末结算页（SPEC §2.6；ui_settle.cj）。 */
                SettleScreen(
                    generation: this.run.generation,
                    title: this.endingTitle(),
                    good: this.endingGood(),
                    rows: this.genealogyRows(),
                    keepChars: this.keepGlyphs(),
                    onGenealogy: { => this.genealogyStub() },
                    onNext: { => this.settleNext() }
                )
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
                    flashDim: this.flashDim,
                    flashOn: this.flashOn,
                    onPick: {side => this.pick(side)},
                    onSelectSlot: {i => this.selectBoxSlot(i)},
                    onOpenZilu: { => this.openSub(1) },
                    onOpenEvo: { => this.openSub(2) },
                    onOpenCard: { => this.openSub(3) },
                    onDebugZero: { => this.debugZero() }
                )
            }
            }

            /* 字匣详情弹层：盖在首屏之上（遮罩 45% 黑 + 底部弹层）。
               只有主界开着才有；二级界面 / 挑字页 / 结算页都不出。 */
            if (this.boxSheetOpen && this.sub == 0 && this.run.phase == RUN_PHASE_HOME) {
                BoxSheet(
                    charId: this.boxSheetCharId(),
                    glyph: this.boxSheetGlyph(),
                    state: this.boxSheetState(),
                    onClose: { => this.closeBoxSheet() },
                    onLand: { => this.landFromSheet() }
                )
            }

            /* 结局卡：闪朱两下之后才浮起来，盖在压暗的主界之上（SPEC §2.7）。
               读档回来就是 phase 2 时 endingShown 已经是 true，直接出卡。 */
            if (this.run.phase == RUN_PHASE_ENDING && this.endingShown) {
                EndingOverlay(
                    generation: this.run.generation,
                    title: this.endingTitle(),
                    endingId: this.run.endingId,
                    dim: this.run.endingDim,
                    kind: this.run.endingKind,
                    good: this.endingGood(),
                    chars: this.keepGlyphs(),
                    onGenealogy: { => this.genealogyStub() },
                    onNext: { => this.settleNext() }
                )
            }

            /* 「看家谱」的提示（家谱独立页不在本切片）：非空时页面底部露一行小字。 */
            if (this.stubText.size > 0) {
                StubHint(text: this.stubText, onClose: { => this.stubText = "" })
            }
        }
        .width(100.percent)
        .height(100.percent)
        .backgroundColor(Theme.night900)
    }
}
