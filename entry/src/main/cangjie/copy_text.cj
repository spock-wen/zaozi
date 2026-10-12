package ohos_app_cangjie_entry

/* 文案表。字符串全部抄自 /workspace/zaozi-formal/v1/src/ 下的设计稿生成脚本
   （common.py / build_card.py / build_zilu.py）：
   common.py 的 BAIHUA、build_card.py 的事签/弹层、build_zilu.py 的字义/典籍/
   小故事/效果），一字未改。
   只有 休/水/本/从 四个字有白话行；字义、典籍、小故事、效果设计稿只给了「休」
   （zilu_detail_v1），其余字取空 → 界面上那一行/那一块整块不显示（SPEC §4.2）。
   玩法数值（代次、记忆、骨片数）按 SPEC 只是版式占位。
   本文件不 import 任何 kit/ohos 模块，能在普通 Linux 上编译（tools/box_check）。 */

import std.collection.ArrayList

/* —— 造字卡（card_zaozi_v1）——
   CARD_BONE_PLAYING / CARD_BONE_SETTLED 是设计稿写死的两行（7 / 8 / 27）。
   界面现在走 zilu_model.cj 的 cardBoneText(settled) 按已造列表现算（种子开关
   打开时计数跟着变）；这两个常量留着当基线，box_check 断言默认值算出来
   跟它们一字不差。 */
public let CARD_GEN_LINE: String = "第 4 代 · 第 1 年冬夜"
public let CARD_BONE_PLAYING: String = "空骨片 2 · 字录 7 / 27"
public let CARD_BONE_SETTLED: String = "空骨片 2 · 字录 8 / 27"
public let CARD_TAG: String = "冬夜刻字 · 成字"
public let SHIQIAN_LABEL: String = "事签："
public let SHIQIAN_COUNT: String = "事签 1 / 1"
/* 设计稿用平衡换行，并把「一截老干」「遮着太阳」「天色转凉」设为不拆行；
    ArkUI 没有 text-wrap:balance，这里保留整句，由 Text 自行断行。 */
public let SHIQIAN_BODY: String =
    "晌午正热，赶路的背抵着一截老干，头顶叶子遮着太阳，一直待到天色转凉"
public let CARD_HINT: String = "古字形一步步变成今天的写法"
public let CARD_SKIP_HINT: String = "点一下跳过"
public let CARD_SHEET_KEY: String = "成字"
public let CARD_SHEET_TITLE: String = "「休」入字录"
public let CARD_SHEET_SUB: String = "人 ＋ 木 · 第 4 代第 1 年冬夜"
public let CARD_MEMORY_BAR: String = "63 → 69"
public let CARD_MEMORY_DELTA: String = "记 +6"
public let CARD_MEMORY_LABEL: String = "记忆"
public let CARD_SHEET_META: String = "骨片随字入录 · 空骨片仍是 2"
public let CARD_BTN_ZILU: String = "看字录"
public let CARD_BTN_CONTINUE: String = "继续"

/* —— 字录详情（zilu_detail_v1）——
   ZILU_NAV_COUNT / ZILU_GRID_SUMMARY 是设计稿写死的两行（8 / 27 / 未知 17）。
   界面现在走 zilu_model.cj 的 ziluNavCount() / ziluGridSummary() 按已造列表
   现算（种子开关打开时也跟着变）；常量留着当基线，box_check 有断言。 */
public let ZILU_TITLE: String = "字录"
public let ZILU_NAV_COUNT: String = "8 / 27"
public let ZILU_BACK: String = "‹"
public let ZILU_TAB_ALL: String = "全部"
public let ZILU_TAB_XIANG: String = "象形"
public let ZILU_TAB_HUIYI: String = "会意"
public let ZILU_TAB_ZHISHI: String = "指事"
/* 某一页已造的字一个都没有时的空态文案（指事 0 → 「暂无指事字」，
   造法名由 zilu_model.ziluTabEmptyText 拼；tab 0 与未知 tab 用这条）。 */
public let ZILU_TAB_EMPTY: String = "暂无此类字"
public let ZILU_REPLAY: String = "▶ 再看一次"
public let ZILU_SEC_MEANING: String = "白话字义"
public let ZILU_SEC_CLASSIC: String = "典籍"
public let ZILU_SEC_EVO: String = "古字形演变"
public let ZILU_SEC_EVO_HINT: String = "点一格可放大"
public let ZILU_SEC_STORY: String = "小故事"
public let ZILU_SEC_EFFECT: String = "效果"
public let ZILU_GRID_SUMMARY: String = "已造 8 · 手里有事签 1 · 有残片线索 1 · 未知 17"

/* —— 开局挑字（ziku_pick_v1 D / SPEC §2.4、§3）——
   PICK_GEN_LINE / PICK_RECORDER / HOME_GEN_LINE 里的 N / Y 由界面替换。 */
public let PICK_TITLE: String = "挑字入字匣"
public let PICK_HINT: String =
    "带进字匣的字，这一代能落在卡上；落过的字这一代冬夜不能当部件。上一代传下的事签占 1 格。"
public let PICK_GEN_LINE: String = "第 N 代 · 开局"
public let PICK_RECORDER: String = "第 N 代记事人"
public let PICK_SLOT_EMPTY: String = "＋"
public let PICK_BTN_NEED: String = "还差 N 个字"
public let PICK_BTN_GO: String = "就带这些开局"
/* 第 2 代起挑字页第 1 格的事签骨片格（设计稿 D 屏 .big3 .slot.sq / .cap2）。
   事签本身是 stub：刻事签 / 传事签不在本里程碑，所以实际永远显示「未传」那一版。 */
public let PICK_SHIQIAN_CARRIED: String = "事签\n传下"
public let PICK_SHIQIAN_NONE: String = "事签\n未传"
public let PICK_SHIQIAN_CAP_CARRIED: String = "上一代传下\n不可换"
public let PICK_SHIQIAN_CAP_NONE: String = "上一代没传事签\n这格空着"

/* —— 主界（home_slide_v1；M2 slice 1 只有占位内容）—— */
public let HOME_GEN_LINE: String = "第 N 代 · 第 Y 年"
public let HOME_RECORDER: String = "第 N 代记事人"
public let HOME_BOX_TITLE: String = "字匣"
public let HOME_BOX_EMPTY: String = "这一代没有带字"
public let HOME_BTN_ZILU: String = "字录"
public let HOME_BTN_EVO: String = "演变条"
public let HOME_BTN_CARD: String = "造字卡"

/* —— 主界滑卡（M2 slice 2：四维条 / 骨片行 / 事件卡 / 按住看分量）——
   N / Y 由界面替换（见 HomeBonesRow / HomeHudDim 的成员函数）。 */
/* 骨片行：pip 前面的小标签。 */
public let HOME_BONES_LABEL: String = "骨片"
/* 「余年 N 年」，数字单独上 gold-400 Bold（SPEC §2.2）。 */
public let HOME_YEARS_LEFT: String = "余年 N 年"
/* 事件卡立绘区占位（SPEC §4 待确认 5：立绘风格另定）。 */
public let HOME_ART_PLACEHOLDER: String = "人物立绘区"
/* 事件卡操作提示（设计稿字匣条右下角那两行小字）：拖卡 / 长按各一行。 */
public let HOME_CARD_TIP_DRAG: String = "左右拖卡做决定"
public let HOME_CARD_TIP_HOLD: String = "按住卡片看分量"
/* 按住看分量：两排圆点左边的「左 / 右」（states_v1 ① .sd）。 */
public let HOME_HOLD_LEFT: String = "左"
public let HOME_HOLD_RIGHT: String = "右"
/* —— 字匣（M2 slice 3：五种格子状态 + 字匣详情弹层；SPEC §2.4）——
   设计稿 home_slide_v1 字匣条 / ziku_pick_v1 E 弹层。 */
/* 字匣条标题右边那行小字（点字可落 · 每字每代一次）。 */
public let HOME_BOX_HINT: String = "点字可落 · 每字每代一次"
/* 本代已落那一格下沿的小签。 */
public let HOME_BOX_TAG_LANDED: String = "已落"
/* 空格子里的「＋」（与挑字页大格同一个符号）。 */
public let BOX_SLOT_EMPTY_MARK: String = PICK_SLOT_EMPTY
/* 事签格：骨片形里写这两个字（本 slice 是 stub，见 game_rules 的 BOX_SHIQIAN_ID）。 */
public let BOX_SLOT_SHIQIAN_TEXT: String = "事签"
/* 详情弹层（ziku_pick_v1 E）：小标 / 主标 / 状态徽标三种。 */
public let BOX_SHEET_KEY: String = "字匣"
public let BOX_SHEET_TITLE: String = "这一代带着的三格"
public let BOX_STATE_OK: String = "可落"
public let BOX_STATE_LANDED: String = "本代已落"
public let BOX_STATE_SHIQIAN: String = "待刻"
/* 弹层里三种状态各一行小字（设计稿 E 的 .list .tx p）。 */
public let BOX_HINT_OK: String = "可落一次 · 落下后这一代冬夜不能当部件"
public let BOX_HINT_LANDED: String = "这一代已经落过 · 冬夜部件里置灰"
public let BOX_HINT_SHIQIAN: String = "占一格，不能落；冬夜可拿来刻字"
/* 弹层按钮：左「‹」关层，右「在卡上落字」（只有可落那一格有）。 */
public let BOX_SHEET_BACK: String = "‹"
public let BOX_SHEET_LAND: String = "在卡上落字"
/* 卡底落字条（SPEC §2.3 第三选项：朱底白字 Serif 15 Bold，再点一次确认）。 */
public let HOME_LUOZI_NEED: String = "先在字匣选一个字"
public let HOME_LUOZI_ARMED: String = "再点一次确认落字"
/* —— 结局卡 / 代末结算（M2 slice 4；SPEC §2.6 / §2.7；设计稿 end_fail_v1 H/I、
   settle_gen_v1 F）。N / Y 由界面替换（见 ui_ending.cj / ui_settle.cj）。 */
/* 结局卡小标（SPEC §2.7 模板 A/B 顶部小字）。 */
public let END_KEY: String = "第 N 代 · 结局"
/* 原因胶囊：「<维名> 见底 / 溢出」（维名来自 homeDimName）。 */
public let END_WHY_GOOD: String = "四维都在中间"
/* 家谱记下那一行：「家谱记下：第 N 代，<标题>」。 */
public let END_GENEALOGY: String = "家谱记下：第 N 代，"
/* 留下的字那一行：没有落过字时写「未成字」（SPEC §3）。 */
public let END_CHARS_NONE: String = "未成字"
/* 结局卡按钮：左描边、右朱（SPEC §2.7）。 */
public let END_BTN_GENEALOGY: String = "看家谱"
public let END_BTN_NEXT: String = "往下传"
/* 代末结算页（settle_gen_v1 F）。小标「代末」（设计稿 .st0 .k 写「一代终了」，
   这一版按切片说明用「代末」）。 */
public let SETTLE_KEY: String = "代末"
public let SETTLE_TITLE: String = "第 N 代记事人放下了刻刀"
public let SETTLE_SEC_GENEALOGY: String = "家谱 · 添一笔"
public let SETTLE_SEC_KEEP: String = "这一代留下"
/* 传事签块：事签是 stub（本 milestone 不传），整块不显示。 */
public let SETTLE_SEC_SHIQIAN: String = "传给下一代的事签（最多 1 张）"
/* 「这一代留下」后面那行小字：刻成几个字。 */
public let SETTLE_KEEP_META: String = "刻成 N 字"
/* 代末页按钮：左描边（家谱面板，见 ui_genealogy.cj）、右朱回开局挑字。 */
public let SETTLE_BTN_GENEALOGY: String = "看家谱"
public let SETTLE_BTN_NEXT: String = "下一代"
/* 家谱面板（结局卡 / 代末结算页的「看家谱」；ui_genealogy.cj）：
   小标 + 标题 + 一行小字 + 关闭按钮。完整家谱页（进度卡、主线段数、
   超过一屏分页）仍是 full version 的事，见 GENEALOGY_PANEL_NOTE。 */
public let GENEALOGY_PANEL_KEY: String = "家谱"
public let GENEALOGY_PANEL_TITLE: String = "历代记事人"
public let GENEALOGY_PANEL_NOTE: String = "完整家谱页（进度卡、主线段数）下一版做"
public let GENEALOGY_PANEL_CLOSE: String = "回去"
/* 调试按钮（M2_DEBUG_FORCE_END 打开才显示；见 game_rules.cj）。 */
public let HOME_DEBUG_ZERO: String = "调试：粮归零"

/* 结局话：每个结局 id 一句，Serif 16 / 行高 28，最多 3 行（SPEC §2.7 模板 A/B）。
   设计稿只给了「失祀」「寿终传笔」两句原文，其余是同一口径的占位文案，
   等玩法稿（/workspace/zaozi-formal/v2/INVENTORY.md 记的内容缺口）补真文案。 */
public func endingLine(id: String): String {
    if (id == "jinian") { return "仓里见底的那天，雪还没停。族人把最后一点粮种也煮了。" }
    if (id == "shisi") { return "没人再信祭祀，族人说是你的刻骨招来了灾，把你赶走。" }
    if (id == "jiushui") { return "河又改道，旧水重来，骨片沉在泥里，一块也没捞上来。" }
    if (id == "binghuo") { return "外头打进来了，你抱着字匣躲在树洞，刀没有丢。" }
    if (id == "cangman") { return "粮仓堆到顶，外头的人闻着味来了，一把火烧了个干净。" }
    if (id == "fenggu") { return "人人都来求字，字被当成符咒封进骨匣，再没人肯问它的意思。" }
    if (id == "suyuan") { return "旧年的字翻出来对质，两姓各执一义，结下了解不开的怨。" }
    if (id == "bingzu") { return "外姓的人搬了进来，说了算，你的字被并进了他们的写法。" }
    if (id == "shouzhong") { return "这一冬没有大事。你把刻刀交给徒弟，骨片收进了树洞。" }
    /* 认不出的结局 id：给一句通用的收尾，界面不空、也不崩。 */
    return "这一代到此为止，字匣收进了树洞。"
}

/* 原因胶囊文案：善终给 END_WHY_GOOD，失败给「<维名> <见底/溢出>」。
   dim / kind 都是 RunState 的原始字段（结束语见 endingOfState）。 */
public func endingWhyText(dim: Int64, kind: String): String {
    if (kind == RUN_KIND_GOOD) { return END_WHY_GOOD }
    let name = homeDimName(dim)
    if (name.size == 0) { return kind }
    return name + " " + kind
}

/* 「家谱记下：第 N 代，<标题>」。 */
public func endingGenealogyText(generation: Int64, title: String): String {
    return END_GENEALOGY.replace("N", "${generation}") + title
}

/* 结局卡小标「第 N 代 · 结局」（N 由界面替换）。 */
public func endingKeyText(generation: Int64): String {
    return END_KEY.replace("N", "${generation}")
}

/* 代末页主标「第 N 代记事人放下了刻刀」。 */
public func settleTitleText(generation: Int64): String {
    return SETTLE_TITLE.replace("N", "${generation}")
}

/* 家谱行的名称「第 N 代记事人」（一律不起人名，SPEC §2.6）。 */
public func familyRowName(generation: Int64): String {
    return "第 ${generation} 代记事人"
}

/* 家谱面板标题下面那行「第 X – Y 代」（最老一代到最新一代，最老在上）。
   rows 是空的（不该发生）时退回 thisGen，界面不空、也不崩。 */
public func genealogyPanelRange(rows: Array<FamilyEntry>, thisGen: Int64): String {
    var first = thisGen
    var last = thisGen
    if (rows.size > 0) {
        first = rows[0].generation
        last = rows[rows.size - 1].generation
    }
    return "第 ${first} – ${last} 代"
}

/* 「这一代留下」那行小字：刻成几个字。 */
public func settleKeepMeta(count: Int64): String {
    return SETTLE_KEEP_META.replace("N", "${count}")
}

/* 四维名（粮 信 记 外，与 RunState.dims 顺序一致）。认不出的下标给空串。 */
public func homeDimName(i: Int64): String {
    if (i == 0) { return "粮" }
    if (i == 1) { return "信" }
    if (i == 2) { return "记" }
    if (i == 3) { return "外" }
    return ""
}

/* 「余年 N 年」把 N 替成实数。 */
public func homeYearsText(yearsLeft: Int64): String {
    return HOME_YEARS_LEFT.replace("N", "${yearsLeft}")
}

/* 卡底落字条：选中的那个字叫什么（设计稿 C「落「水」· 以河为界」，
   这里只写「落「X」字」，具体选项的说明在卡面数据里）。 */
public func homeLuoziLabel(glyph: String): String {
    if (glyph.size == 0) { return HOME_LUOZI_NEED }
    return "落「${glyph}」字"
}

/* 字匣详情弹层的状态徽标文案（状态码见 game_rules 的 BOX_SLOT_*）。
   空格没有详情，给空串。 */
public func boxStateText(state: Int64): String {
    if (state == BOX_SLOT_SELECTED) { return BOX_STATE_OK }
    if (state == BOX_SLOT_LANDED) { return BOX_STATE_LANDED }
    if (state == BOX_SLOT_SHIQIAN) { return BOX_STATE_SHIQIAN }
    if (state == BOX_SLOT_EMPTY) { return "" }
    return BOX_STATE_OK
}

/* 字匣详情弹层里那一行状态说明（设计稿 E 的三行小字）。空格给空串。 */
public func boxStateHint(state: Int64): String {
    if (state == BOX_SLOT_LANDED) { return BOX_HINT_LANDED }
    if (state == BOX_SLOT_SHIQIAN) { return BOX_HINT_SHIQIAN }
    if (state == BOX_SLOT_EMPTY) { return "" }
    return BOX_HINT_OK
}

public func baihuaLines(charId: String, cellIndex: Int64): Array<String> {
    /* 与设计稿 common.py 的 BAIHUA 一致：每阶段一行，竖线是手动断行，
       每行 ≤5 字；下标含最后那格繁简。 */
    if (charId == "xiu") {
        if (cellIndex == 0) { return ["一人背靠", "一棵树"] }
        if (cellIndex == 1) { return ["人形多了", "一道短笔"] }
        if (cellIndex == 2) { return ["笔画变成", "匀称弧线"] }
        if (cellIndex == 3) { return ["弧线拉成", "横竖"] }
        if (cellIndex == 4) { return ["和今天一样"] }
        return []
    }
    if (charId == "shui") {
        if (cellIndex == 0) { return ["中间曲线", "两旁水点"] }
        if (cellIndex == 1) { return ["中线弯曲", "加深"] }
        if (cellIndex == 2) { return ["两旁点", "拉成长线"] }
        if (cellIndex == 3) { return ["中线变直", "成撇捺"] }
        if (cellIndex == 4) { return ["和今天一样"] }
        return []
    }
    if (charId == "ben") {
        if (cellIndex == 0) { return ["树根加粗", "成一团"] }
        if (cellIndex == 1) { return ["根部变成", "一短横"] }
        if (cellIndex == 2) { return ["横画平直", "有波势"] }
        if (cellIndex == 3) { return ["和今天一样"] }
        return []
    }
    if (charId == "cong") {
        if (cellIndex == 0) { return ["两人", "一前一后"] }
        if (cellIndex == 1) { return ["两人笔画", "加粗"] }
        if (cellIndex == 2) { return ["两人站直", "并排"] }
        if (cellIndex == 3) { return ["添了走路", "的部件"] }
        if (cellIndex == 4) { return ["保留走路", "部件"] }
        if (cellIndex == 5) { return ["回到", "两个人"] }
        return []
    }
    return []
}

/* 「造于 …」「记事人 阿禾」这两行：设计稿只在「休」那一张给了（zilu_detail_v1），
   其余字没有这条记录。不编造数据 → 别的字不显示这两行。 */
public func hasMadeMeta(charId: String): Bool {
    return charId == ZILU_SELECTED_ID
}

/* 会意写两个部件（SPEC §4.1）；设计稿只给了「休 = 人 + 木」。 */
public func formulaParts(charId: String): Array<String> {
    if (charId == "xiu") { return ["人", "木"] }
    return []
}

/* 象形写「描迹」，指事写「底字 木 · 一在其下」（SPEC §4.1，示例取「本」）。 */
public func formulaText(charId: String): String {
    if (charId == "shui") { return "描迹 · 水" }
    if (charId == "ben") { return "底字 木 · 一在其下" }
    return ""
}

public class EffectRow {
    public let label: String
    public let text: String

    public init(label: String, text: String) {
        this.label = label
        this.text = text
    }
}

/* 一个字录详情卡的文案。空字段 → 界面不显示那一行/那一块。 */
public class ZiluCopy {
    public let meaning: String
    public let classic: String
    public let classicSource: String
    public let story: String
    public let effects: ArrayList<EffectRow>

    public init(
        meaning: String,
        classic: String,
        classicSource: String,
        story: String,
        effects: ArrayList<EffectRow>
    ) {
        this.meaning = meaning
        this.classic = classic
        this.classicSource = classicSource
        this.story = story
        this.effects = effects
    }

    public func hasMeaning(): Bool {
        return this.meaning.size > 0
    }

    public func hasClassic(): Bool {
        return this.classic.size > 0
    }

    public func hasStory(): Bool {
        return this.story.size > 0
    }

    public func hasEffects(): Bool {
        return this.effects.size > 0
    }
}

public func ziluCopyOf(charId: String): ZiluCopy {
    if (charId == "xiu") {
        let effects = ArrayList<EffectRow>()
        effects.add(EffectRow("落字", "「歇一季」：跳过这张卡，粮 −6，另外三维各向 50 回 3"))
        effects.add(EffectRow("解锁", "东岸「休战」事件链进入牌堆"))
        effects.add(EffectRow("部件", "可作更复杂的字的部件，不消耗"))
        return ZiluCopy(
            "人靠着树歇息；引申为停下。",
            "休，息止也。从人依木。",
            "《说文解字》卷六",
            "东岸的孩子受了伤，走不动了。你留下他，给了他一口吃的。秋天，他父亲带着东岸的人来道谢。",
            effects
        )
    }
    let empty = ArrayList<EffectRow>()
    return ZiluCopy("", "", "", "", empty)
}
