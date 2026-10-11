package ohos_app_cangjie_entry

import kit.ArkUI.*
import ohos.arkui.state_macro_manage.*

/* 主界（home_slide_v1）。M2 slice 1 铺了版式（代次/年 + 字匣三格 + 二级界面入口），
   slice 2 把 SPEC §2.1 四维条、§2.2 骨片行、§2.3 事件卡（拖动 / 按住看分量 /
   点选退路 / 落字灰态）填了进来；slice 3 接上字匣（§2.4 五种格子状态 + 详情弹层）
   与落字第三选项；slice 4 接上触底闪朱、结局卡与代末结算（ui_ending.cj /
   ui_settle.cj，路由在 index.cj）。四维条在 ui_hud.cj、骨片行在 ui_bones.cj、
   事件卡在 ui_event_card.cj、字匣在 ui_box.cj / ui_box_sheet.cj，
   本文件只管这一层的版式。
   同样拆成小 @Component（@Component 宏展开撑不住大 build()）。
   R1（e4c8def 烟测 FAIL：选卡后主界一点都不重绘）之后，本层及以下所有 @Prop
   只收原始值（Int64 / String / Bool / 闭包）：年份、四维、骨片、牌堆下标、
   字匣三格（id + 格数 + landed 位掩码）由 EntryView 从存档摊成一组原始 @State
   传下来（home_mirror.cj 的 HomeMirror），牌面文案 / 选项 / 落字条状态一律在
   收到原始值的那一层自己的成员函数里现算 —— class 字段与函数调用结果当 @Prop
   传不参与重绘跟踪，那就是旧版不刷新的根因。 */

/* 顶行：左「第 N 代 · 第 Y 年」，右「第 N 代记事人」（设计稿 .stat）。
   代次 / 年是原始字段，文案在子组件里拼。 */
@Component
public class HomeStatLine {
    @Prop var generation: Int64
    @Prop var year: Int64

    func genLine(): String {
        return HOME_GEN_LINE.replace("N", "${this.generation}").replace("Y", "${this.year}")
    }

    func recorder(): String {
        return HOME_RECORDER.replace("N", "${this.generation}")
    }

    func build() {
        Row {
            Text(this.genLine())
                .fontSize(Theme.fsStatus)
                .fontFamily(Theme.sans)
                .fontColor(Theme.onNight)
                .layoutWeight(1)
            Text(this.recorder())
                .fontSize(Theme.fsStatus)
                .fontFamily(Theme.sans)
                .fontColor(Theme.onNight2)
        }
        .width(100.percent)
        .height(44)
        .border(width: 1, color: Theme.nightLine)
        .padding(left: Theme.insetNight, right: Theme.insetNight)
    }
}

/* 二级界面入口：字录 / 演变条 / 造字卡（本 slice 的小文字按钮）。 */
@Component
public class HomeEntryBtns {
    @Prop var onOpenZilu: () -> Unit
    @Prop var onOpenEvo: () -> Unit
    @Prop var onOpenCard: () -> Unit

    func build() {
        Row(space: 12) {
            Text(HOME_BTN_ZILU)
                .fontSize(Theme.fsButton)
                .fontFamily(Theme.sans)
                .fontColor(Theme.onNight)
                .layoutWeight(1)
                .height(Theme.buttonH)
                .borderRadius(22)
                .border(width: 1, color: Theme.onNight2)
                .textAlign(TextAlign.Center)
                .onClick({event => this.onOpenZilu()})
            Text(HOME_BTN_EVO)
                .fontSize(Theme.fsButton)
                .fontFamily(Theme.sans)
                .fontColor(Theme.onNight)
                .layoutWeight(1)
                .height(Theme.buttonH)
                .borderRadius(22)
                .border(width: 1, color: Theme.onNight2)
                .textAlign(TextAlign.Center)
                .onClick({event => this.onOpenEvo()})
            Text(HOME_BTN_CARD)
                .fontSize(Theme.fsButton)
                .fontFamily(Theme.sans)
                .fontColor(Theme.onNight)
                .layoutWeight(1)
                .height(Theme.buttonH)
                .borderRadius(22)
                .border(width: 1, color: Theme.onNight2)
                .textAlign(TextAlign.Center)
                .onClick({event => this.onOpenCard()})
        }
        .width(100.percent)
        .margin(top: 20)
    }
}

/* 调试按钮「调试：粮归零」（DEBUG ONLY：M2_DEBUG_FORCE_END 打开才显示，
   默认 false，见 game_rules.cj）。点一下把「粮」按到 0，然后走完全正常的
   纯逻辑路径进结局卡 —— 不抄近路改 phase，测的就是真链路。 */
@Component
public class HomeDebugBtn {
    @Prop var onTap: () -> Unit

    func build() {
        Text(HOME_DEBUG_ZERO)
            .fontSize(Theme.fsNote)
            .fontFamily(Theme.sans)
            .fontColor(Theme.onNight2)
            .height(28)
            .padding(left: 10, right: 10)
            .borderRadius(14)
            .border(width: 1, color: Theme.nightLine)
            .textAlign(TextAlign.Center)
            .margin(top: 10)
            .onClick({event => this.onTap()})
    }
}

/* 点选退路：左右两条常显选项按钮（SPEC §2.3「点一下即选」）。
   拖动 / 长按在 ArkUI-Cangjie 这一版没验过的前提下，这两条就是保底的那条路。
   R1 之后只收 cardIndex 一个原始值，两条文案在成员函数里按牌堆现算
   （函数调用结果当 @Prop 传不参与重绘跟踪，换卡后文案会停在旧的那一条）。 */
@Component
public class HomeOptBtns {
    @Prop var cardIndex: Int64
    @Prop var onPick: (Int64) -> Unit

    func leftLabel(): String {
        return eventCardAt(this.cardIndex).left.label
    }

    func rightLabel(): String {
        return eventCardAt(this.cardIndex).right.label
    }

    func build() {
        Row(space: 12) {
            Text(this.leftLabel())
                .fontSize(Theme.fsButton)
                .fontFamily(Theme.sans)
                .fontColor(Theme.onNight)
                .backgroundColor(Theme.night800)
                .height(Theme.buttonH)
                .borderRadius(12)
                .border(width: 1, color: Theme.nightLine)
                .layoutWeight(1)
                .textAlign(TextAlign.Center)
                .onClick({event => this.onPick(RUN_SIDE_LEFT)})
            Text(this.rightLabel())
                .fontSize(Theme.fsButton)
                .fontFamily(Theme.sans)
                .fontColor(Theme.onNight)
                .backgroundColor(Theme.night800)
                .height(Theme.buttonH)
                .borderRadius(12)
                .border(width: 1, color: Theme.nightLine)
                .layoutWeight(1)
                .textAlign(TextAlign.Center)
                .onClick({event => this.onPick(RUN_SIDE_RIGHT)})
        }
        .width(100.percent)
        .margin(top: 12)
        .padding(left: Theme.insetNight, right: Theme.insetNight)
    }
}

/* 主界下半截：点选退路 + 操作提示 + 字匣 + 二级界面入口 + 调试按钮。
   从 HomeScreen 的 build 里拆出来（@Component 宏展开撑不住大 build()）。
   props 全是原始值 / 闭包（R1：不出现 class 字段、函数调用结果、数组）。 */
@Component
public class HomeBottomBlock {
    @Prop var cardIndex: Int64
    /* 字匣三格的字 id + 有几格有字 + 哪些格本代已落（位掩码）+ 选中态。 */
    @Prop var box0: String
    @Prop var box1: String
    @Prop var box2: String
    @Prop var boxCount: Int64
    @Prop var landedMask: Int64
    @Prop var selectedSlot: Int64
    @Prop var onPick: (Int64) -> Unit
    @Prop var onSelectSlot: (Int64) -> Unit
    @Prop var onOpenZilu: () -> Unit
    @Prop var onOpenEvo: () -> Unit
    @Prop var onOpenCard: () -> Unit
    /* 调试入口（M2_DEBUG_FORCE_END 打开才显示按钮）。 */
    @Prop var onDebugZero: () -> Unit

    func build() {
        Column {
            /* 点选退路。 */
            HomeOptBtns(
                cardIndex: this.cardIndex,
                onPick: {side => this.onPick(side)}
            )

            HomeCardTip()

            /* 字匣：104 高一条，3 格五种状态。 */
            HomeBoxBar(
                box0: this.box0,
                box1: this.box1,
                box2: this.box2,
                boxCount: this.boxCount,
                landedMask: this.landedMask,
                selectedSlot: this.selectedSlot,
                onSelect: {i => this.onSelectSlot(i)}
            )

            HomeEntryBtns(
                onOpenZilu: { => this.onOpenZilu() },
                onOpenEvo: { => this.onOpenEvo() },
                onOpenCard: { => this.onOpenCard() }
            )

            /* 调试：粮归零（DEBUG ONLY，默认关）。 */
            if (M2_DEBUG_FORCE_END) {
                HomeDebugBtn(onTap: { => this.onDebugZero() })
            }
        }
        .width(100.percent)
    }
}

/* 操作提示：拖卡 / 长按两行小字（设计稿字匣条右下角）。
   手势走 .onTouch 手算（见 ui_event_card.cj 文件头），这两行就是告诉玩家
   「卡片可以拖、可以按住」的兜底说明。 */
@Component
public class HomeCardTip {
    func build() {
        Column {
            Text(HOME_CARD_TIP_DRAG)
                .fontSize(Theme.fsNote)
                .fontFamily(Theme.sans)
                .fontColor(Theme.onNight2)
            Text(HOME_CARD_TIP_HOLD)
                .fontSize(Theme.fsNote)
                .fontFamily(Theme.sans)
                .fontColor(Theme.onNight2)
        }
        .width(100.percent)
        .margin(top: 10)
        .padding(left: Theme.insetNight, right: Theme.insetNight)
    }
}

/* 事件卡那一块：把牌面字段从牌堆里取出来递给 EventCardView。
   单独拆一层是为了让 HomeScreen 的 build() 保持小块（@Component 宏展开
   撑不住大 build()）。
   R1/R3 之后这里只做「原始值转发」：牌面按 cardIndex 在 EventCardView 里现算，
   落字条按字匣原始值在 CardLuoziBar 里现算 —— 中间层不算文案、不算状态。 */
@Component
public class HomeCardStage {
    @Prop var cardIndex: Int64
    /* 字匣三格的字 id + 有几格有字 + 哪些格本代已落（位掩码）+ 选中态。 */
    @Prop var box0: String
    @Prop var box1: String
    @Prop var box2: String
    @Prop var boxCount: Int64
    @Prop var landedMask: Int64
    @Prop var selectedSlot: Int64
    /* 「准备落」记在哪个格子、哪张卡上（界面态）。 */
    @Prop var armedSlot: Int64
    @Prop var armedCard: Int64
    @Prop var onHoldChange: (Bool) -> Unit
    @Prop var onPick: (Int64) -> Unit
    @Prop var onLuozi: () -> Unit

    func build() {
        Column {
            EventCardView(
                cardIndex: this.cardIndex,
                box0: this.box0,
                box1: this.box1,
                box2: this.box2,
                boxCount: this.boxCount,
                landedMask: this.landedMask,
                selectedSlot: this.selectedSlot,
                armedSlot: this.armedSlot,
                armedCard: this.armedCard,
                onLuozi: { => this.onLuozi() },
                onHoldChange: {v => this.onHoldChange(v)},
                onPick: {side => this.onPick(side)}
            )
        }
        .width(100.percent)
    }
}

/* 主界外壳（SPEC §2.1–§2.4；设计稿 home_slide_v1）：
     顶行   第 N 代 · 第 Y 年 / 第 N 代记事人
     按住   四维条上方两排圆点（states_v1 ①，长按卡片才出现）
     四维   粮 信 记 外四条资源条
     骨片   5 位 pip + 余年
     事件卡 296×384，下一张垫在后面；左右拖动 / 长按看分量 / 两条点选按钮 /
             落字第三选项（字匣选中一个可落的字才有）
     字匣   104 高一条，3 格五种状态（可落 / 选中 / 本代已落 / 事签 / 空）
     入口   字录 / 演变条 / 造字卡
   props 全是原始值（Int64 / String / Bool）：R1 烟测的根因就是 class 类型
   @State 的字段（this.run.year / this.run.dims / this.run.boxChars）与函数调用
   结果当 @Prop 传不参与重绘跟踪 —— 选卡之后主界年份 / 四维 / 卡面 / 落字条
   一律停在旧值。现在 EntryView 把存档摊成一组原始 @State（home_mirror.cj 的
   HomeMirror）传进来，下游每一层都只收原始值、自己现算。
   字匣的选中态是界面状态（selectedSlot，-1 = 没有选中），存在 EntryView 里
   ——详情弹层的开关也要被 onBackPress 看见。 */
@Component
public class HomeScreen {
    @Prop var generation: Int64
    @Prop var year: Int64
    @Prop var yearsLeft: Int64
    /* 四维逐个传（数组 @Prop 没验过）。 */
    @Prop var dim0: Int64
    @Prop var dim1: Int64
    @Prop var dim2: Int64
    @Prop var dim3: Int64
    @Prop var boneEmpty: Int64
    @Prop var boneShiqian: Int64
    /* 事件牌堆下标（卡面 / 选项 / 落字许不许可都按它现算）。 */
    @Prop var cardIndex: Int64
    /* 字匣三格的字 id + 有几格有字 + 哪些格本代已落（位掩码）。 */
    @Prop var box0: String
    @Prop var box1: String
    @Prop var box2: String
    @Prop var boxCount: Int64
    @Prop var landedMask: Int64
    /* 字匣选中态（-1 = 没有选中）。 */
    @Prop var selectedSlot: Int64
    /* 触底 / 溢出闪朱（SPEC §2.1）：正在闪的那一维 + 这一下亮不亮。
       EntryView 用 animateTo 推进两下（各 ~200ms）。 */
    @Prop var flashDim: Int64
    @Prop var flashOn: Bool
    /* 提交过一次存档就 +1：兜底让本层重绘（原始值没变但状态确实换了的情况）。 */
    @Prop var rev: Int64
    /* 选定一个选项（0 左 / 1 右 / 2 落字）：EntryView 负责 applyChoice / applyLuozi + 存档。 */
    @Prop var onPick: (Int64) -> Unit
    /* 点字匣某一格：EntryView 决定选中谁、开不开详情弹层。 */
    @Prop var onSelectSlot: (Int64) -> Unit
    @Prop var onOpenZilu: () -> Unit
    @Prop var onOpenEvo: () -> Unit
    @Prop var onOpenCard: () -> Unit
    /* 调试入口（M2_DEBUG_FORCE_END 打开才显示按钮）。 */
    @Prop var onDebugZero: () -> Unit

    /* 按住看分量中：卡片长按置 true，两排圆点才排在四维条上方。 */
    @State var held: Bool = false
    /* 「准备落字」记在哪个格子、哪张卡上：换了选中或换了卡就自动不算准备过
       （不用监听 prop 变化，比较两个数就够）。 */
    @State var armedSlot: Int64 = BOX_SLOT_NONE
    @State var armedCard: Int64 = -1

    /* —— 当前这一张卡（牌堆循环，读档回到同一张）—— */
    func card(): EventCard {
        return eventCardAt(this.cardIndex)
    }

    func allowsLuozi(): Bool {
        return this.card().allowsLuozi
    }

    /* 原始值 → HomeMirror（落字判定用；纯逻辑在 home_mirror.cj）。 */
    func mirror(): HomeMirror {
        let m = HomeMirror()
        m.boxCount = this.boxCount
        m.box0 = this.box0
        m.box1 = this.box1
        m.box2 = this.box2
        m.landedMask = this.landedMask
        return m
    }

    /* 落字条能不能点：卡允许落字、并且字匣里选中了一个可落的字。 */
    func luoziReady(): Bool {
        return canLuoziOf(homeMirrorBoxIds(this.mirror()), homeMirrorBoxLanded(this.mirror()),
            this.allowsLuozi(), this.selectedSlot)
    }

    /* 第一次点只是准备，再点一次才真的落。 */
    func luoziArmed(): Bool {
        return this.armedSlot == this.selectedSlot && this.armedCard == this.cardIndex
    }

    func luoziTap(): Unit {
        if (!this.luoziReady()) { return }
        if (!this.luoziArmed()) {
            this.armedSlot = this.selectedSlot
            this.armedCard = this.cardIndex
            return
        }
        this.armedSlot = BOX_SLOT_NONE
        this.pick(RUN_SIDE_LUOZI)
    }

    func pick(side: Int64): Unit {
        /* 选定就把分量圆点收起来（长按中点了选项按钮的情况）。 */
        this.held = false
        this.onPick(side)
    }

    /* 卡片长按状态回传（EventCardView 自己管手势，圆点排在这一层）。 */
    func holdChange(v: Bool): Unit {
        this.held = v
    }

    func build() {
        Column {
            HomeStatLine(generation: this.generation, year: this.year)

            /* 按住看分量：两排圆点（上左 / 下右），只在长按中出现。 */
            if (this.held) {
                /* 自建组件不能挂链式属性（@Component 宏不认），套一层 Column
                   把 margin 放容器上（同 ui_card.cj 的 GhostButton）。 */
                Column {
                    HomeWeightDots(cardIndex: this.cardIndex)
                }
                /* 容器也要给宽度：Column 默认 alignItems 是 Center，不写 100%
                   会缩成内容宽，里面 HomeWeightDots 的 100% 就没有基准了。 */
                .width(100.percent)
                .margin(top: 10)
            }

            /* 四维资源条。 */
            Column {
                HomeHud(
                    dim0: this.dim0,
                    dim1: this.dim1,
                    dim2: this.dim2,
                    dim3: this.dim3,
                    flashDim: this.flashDim,
                    flashOn: this.flashOn
                )
            }
            /* 容器也要给宽度：Column 默认 alignItems 是 Center，不写 100%
               会缩成内容宽，里面 HomeHud 的 100% 就没有基准了。 */
            .width(100.percent)
            .margin(top: 12)

            /* 骨片行 + 余年。 */
            HomeBonesRow(
                boneEmpty: this.boneEmpty,
                boneShiqian: this.boneShiqian,
                yearsLeft: this.yearsLeft
            )

            /* 事件卡：中间剩下的地方都归它（牌面在 EventCardView 里现算）。
               layoutWeight 挂在外层容器上（自建组件不能自己挂链式属性），
               容器拉伸后卡片照旧贴在剩下的高度顶上，跟原来的排法一致。 */
            Column {
                HomeCardStage(
                    cardIndex: this.cardIndex,
                    box0: this.box0,
                    box1: this.box1,
                    box2: this.box2,
                    boxCount: this.boxCount,
                    landedMask: this.landedMask,
                    selectedSlot: this.selectedSlot,
                    armedSlot: this.armedSlot,
                    armedCard: this.armedCard,
                    onHoldChange: {v => this.holdChange(v)},
                    onPick: {side => this.pick(side)},
                    onLuozi: { => this.luoziTap() }
                )
            }
            .layoutWeight(1)
            /* 容器也要给宽度：Column 默认 alignItems 是 Center，不写 100%
               会缩成内容宽，里面 HomeCardStage 的 100% 就没有基准了。 */
            .width(100.percent)

            /* 点选退路 / 操作提示 / 字匣 / 二级界面入口 / 调试按钮。 */
            HomeBottomBlock(
                cardIndex: this.cardIndex,
                box0: this.box0,
                box1: this.box1,
                box2: this.box2,
                boxCount: this.boxCount,
                landedMask: this.landedMask,
                selectedSlot: this.selectedSlot,
                onPick: {side => this.pick(side)},
                onSelectSlot: {i => this.onSelectSlot(i)},
                onOpenZilu: { => this.onOpenZilu() },
                onOpenEvo: { => this.onOpenEvo() },
                onOpenCard: { => this.onOpenCard() },
                onDebugZero: { => this.onDebugZero() }
            )
        }
        .width(100.percent)
        .height(100.percent)
        .backgroundColor(Theme.night900)
        .padding(bottom: 16)
    }
}
