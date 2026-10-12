package ohos_app_cangjie_entry

/*
 * 造字人 v1.1.1 — 纯逻辑 box 校验（本机没有 ohos SDK，kit.* 编不了，
 * 所以只同步不 import kit/ohos 的文件：glyph_data.cj / theme.cj /
 * evo_model.cj / copy_text.cj / zilu_model.cj，见 sync.sh）。
 *
 * 用法：cd tools/box_check && ./sync.sh && cjpm build && cjpm run
 * 退出码 0 = 全过。
 *
 * 注意：所有被同步进来的文件都在同一个 package（ohos_app_cangjie_entry）
 * 里，所以这里不能再 `import ohos_app_cangjie_entry.*` —— cjpm 会报
 * "imports root package ... outputType executable"。
 * M2 起多同步一个 run_state.cj（RunState / 序列化 / 开局挑字规则）。
 */

import std.collection.ArrayList

class Check {
    public let failures = ArrayList<String>()
    public var checks: Int64 = 0

    func that(cond: Bool, what: String): Unit {
        this.checks = this.checks + 1
        if (!cond) {
            this.failures.add(what)
            println("  FAIL ${what}")
        }
    }

    func done(name: String): Unit {
        if (this.failures.size == 0) {
            println("PASS ${name} (${this.checks} assertions)")
        } else {
            println("FAIL ${name}: ${this.failures.size} broken of ${this.checks}")
        }
    }
}

/* 设计稿说「每行 ≤5 字」指的是 5 个汉字；Cangjie 的 String.size 是字节数
   （一个汉字 3 字节），所以自己数字码点。 */
func utf8Len(s: String): Int64 {
    var n: Int64 = 0
    for (b in s) {
        if ((b & 0xC0) != 0x80) {
            n = n + 1
        }
    }
    return n
}

func endsWithSvgOrPng(asset: String): Bool {
    if (asset.endsWith(".svg")) { return true }
    if (asset.endsWith(".png")) { return true }
    return false
}

/* 阶段名只用 SPEC §5 那七个词。 */
func isKnownStageName(name: String): Bool {
    if (name == "甲骨文") { return true }
    if (name == "金文") { return true }
    if (name == "小篆") { return true }
    if (name == "隶书") { return true }
    if (name == "繁简同形") { return true }
    if (name == "繁体") { return true }
    if (name == "简体") { return true }
    return false
}

func catalogShape(): Int64 {
    println("== 字形表：106 行 / 27 字 ==")
    let ck = Check()
    ck.that(GlyphCatalog.count() == 106, "行数 106（got ${GlyphCatalog.count()}）")
    ck.that(GlyphCatalog.charIds().size == 27, "27 字（got ${GlyphCatalog.charIds().size}）")
    var i: Int64 = 0
    while (i < GlyphCatalog.count()) {
        let r = GlyphCatalog.byIndex(i)
        ck.that(endsWithSvgOrPng(r.asset), "asset 后缀 ${r.asset}")
        ck.that(r.asset.size > 6, "asset 非空 ${r.asset}")
        ck.that(r.glyph.size > 0, "字非空 ${r.id}")
        ck.that(r.stageLabel.size > 0, "stage_label 非空 ${r.id}/${r.stage}")
        ck.that(r.sha1.size == 40, "sha1 40 位 ${r.id}/${r.stage}")
        i = i + 1
    }
    /* 每个字按 order 严格递增，从 1 开始 */
    var c: Int64 = 0
    while (c < GlyphCatalog.charIds().size) {
        let rows = GlyphCatalog.ofChar(GlyphCatalog.charIds()[c])
        ck.that(rows.size == 3 || rows.size == 4, "${rows[0].glyph} 有 3 或 4 个阶段")
        ck.that(rows[0].order == 1, "${rows[0].glyph} 从 order 1 起")
        var k: Int64 = 1
        while (k < rows.size) {
            ck.that(rows[k].order > rows[k - 1].order, "${rows[0].glyph} order 递增")
            k = k + 1
        }
        c = c + 1
    }
    /* asset 唯一 */
    var a: Int64 = 0
    while (a < GlyphCatalog.count()) {
        let asset = GlyphCatalog.byIndex(a).asset
        ck.that(GlyphCatalog.indexOfAsset(asset) == a, "asset 唯一 ${asset}")
        ck.that(GlyphCatalog.indexOfAsset("glyph/不存在.svg") == -1, "查无此 asset 返回 -1")
        a = a + 1
    }
    /* 27 字各阶段行数加总 = 106 */
    var sumRows: Int64 = 0
    var ci: Int64 = 0
    while (ci < GlyphCatalog.charIds().size) {
        sumRows = sumRows + GlyphCatalog.ofChar(GlyphCatalog.charIds()[ci]).size
        ci = ci + 1
    }
    ck.that(sumRows == 106, "27 字行数加总 106（got ${sumRows}）")
    ck.that(sumRows == GlyphCatalog.count(), "加总 = count()")
    ck.done("catalog")
    return ck.failures.size
}

func benAndMo(): Int64 {
    println("== 本 / 末：3 格，从金文起（甲骨文那格不出现）==")
    let ck = Check()
    var c: Int64 = 0
    while (c < 2) {
        let charId = if (c == 0) { "ben" } else { "mo" }
        let rows = GlyphCatalog.ofChar(charId)
        ck.that(rows.size == 3, "${charId} 3 行")
        ck.that(rows[0].stage == "bronze", "${charId} 首行是金文")
        ck.that(rows[0].stageLabel == "金文 · 商周", "${charId} 首行 金文 · 商周")
        /* 本/末没有甲骨文：表里不出现 oracle，演变条也不出甲骨文格。 */
        var r: Int64 = 0
        while (r < rows.size) {
            ck.that(rows[r].stage != "oracle", "${charId} 表里无甲骨文（got ${rows[r].stage}）")
            r = r + 1
        }
        ck.that(GlyphCatalog.ofChar(charId).size == 3, "${charId} ofChar 仍是 3")
        let strip = buildEvoStrip(charId, None)
        ck.that(strip.cells.size == 4, "${charId} 演变条 4 格（3 古字形 + 繁简同形）")
        ck.that(strip.cellAt(0).name == "金文", "${charId} 第 1 格阶段名 金文")
        ck.that(strip.cellAt(0).era == "商周", "${charId} 第 1 格时代 商周")
        var sn: Int64 = 0
        while (sn < strip.cells.size) {
            ck.that(strip.cellAt(sn).name != "甲骨文", "${charId} 演变条无甲骨文格")
            sn = sn + 1
        }
        ck.that(strip.cellAt(3).name == "繁简同形", "${charId} 最后 繁简同形")
        ck.that(strip.cellAt(3).era == "", "${charId} 最后一格不写时代")
        ck.that(strip.isTier(EvoTier.M), "${charId} 标准档 M")
        ck.that(strip.trackWidth == 304, "${charId} 轨道 304")
        ck.that(strip.usedWidth() == 4 * 56 + 3 * 6, "${charId} 实际占宽 242")
        ck.that(strip.usedWidth() < strip.trackWidth, "${charId} 少几格右边空着")
        c = c + 1
    }
    ck.done("ben-mo")
    return ck.failures.size
}

func xiuStrip(): Int64 {
    println("== 休：5 格 M 档（4 古字形 + 繁简同形，隶书用西汉）==")
    let ck = Check()
    let strip = buildEvoStrip("xiu", None)
    ck.that(strip.cells.size == 5, "5 格（got ${strip.cells.size}）")
    ck.that(strip.isTier(EvoTier.M), "标准档 M")
    ck.that(strip.cellSize == 56, "格 56")
    ck.that(strip.gap == 6, "间距 6")
    ck.that(strip.trackWidth == 304, "轨道 304")
    ck.that(strip.usedWidth() == 304, "5 格正好铺满 304（got ${strip.usedWidth()}）")
    let names = ["甲骨文", "金文", "小篆", "隶书", "繁简同形"]
    let eras = ["商", "商周", "秦", "西汉", ""]
    var i: Int64 = 0
    while (i < 5) {
        ck.that(strip.cellAt(i).name == names[i], "第 ${i} 格阶段名 ${names[i]}")
        ck.that(strip.cellAt(i).era == eras[i], "第 ${i} 格时代 ${eras[i]}")
        ck.that(strip.cellAt(i).baihua.size >= 1, "第 ${i} 格有白话")
        ck.that(strip.cellAt(i).baihua.size <= 2, "第 ${i} 格白话最多两行")
        var b: Int64 = 0
        while (b < strip.cellAt(i).baihua.size) {
            ck.that(utf8Len(strip.cellAt(i).baihua[b]) <= 5, "第 ${i} 格白话每行 ≤5 字（${strip.cellAt(i).baihua[b]}）")
            b = b + 1
        }
        ck.that(isKnownStageName(strip.cellAt(i).name), "阶段名在白名单里")
        ck.that(strip.cellAt(i).x == i * (strip.cellSize + strip.gap), "第 ${i} 格左偏移")
        i = i + 1
    }
    /* 前 4 格是古字形走资源，最后 1 格是今天的字 */
    var k: Int64 = 0
    while (k < 4) {
        ck.that(strip.cellAt(k).isOld(), "第 ${k} 格是古字形")
        ck.that(strip.cellAt(k).hasAsset(), "第 ${k} 格有 asset")
        k = k + 1
    }
    ck.that(!strip.cellAt(4).isOld(), "最后 1 格不是古字形")
    ck.that(strip.cellAt(4).glyph == "休", "最后 1 格显示 休")
    ck.that(strip.glyph == "休", "strip.glyph = 休")
    ck.that(strip.method == "会意", "休 是会意")
    ck.that(strip.cellAt(3).sourceLabel == "老子甲後283(隸) 西漢", "隶书出处标签")
    ck.that(strip.cellAt(3).license == "CC0 1.0", "隶书许可 CC0 1.0")
    ck.done("xiu")
    return ck.failures.size
}

func congStrip(): Int64 {
    println("== 从：6 格 S 档（繁体「從」/简体「从」分两格）==")
    let ck = Check()
    let strip = buildEvoStrip("cong", None)
    ck.that(strip.cells.size == 6, "6 格（got ${strip.cells.size}）")
    ck.that(strip.isTier(EvoTier.S), "紧凑档 S")
    ck.that(strip.cellSize == 46, "格 46")
    ck.that(strip.gap == 5, "间距 5")
    ck.that(strip.trackWidth == 301, "轨道 301")
    ck.that(strip.usedWidth() == 301, "6 格正好 301（got ${strip.usedWidth()}）")
    ck.that(strip.trackWidth <= 301, "轨道 ≤ 301")
    ck.that(strip.trad == "從", "繁体 從")
    ck.that(strip.cellAt(4).name == "繁体", "第 5 格 繁体")
    ck.that(strip.cellAt(4).glyph == "從", "第 5 格显示 從")
    ck.that(strip.cellAt(5).name == "简体", "第 6 格 简体")
    ck.that(strip.cellAt(5).glyph == "从", "第 6 格显示 从")
    ck.that(strip.cellAt(4).era == "", "繁体格不写时代")
    ck.that(strip.cellAt(5).era == "", "简体格不写时代")
    var i: Int64 = 0
    while (i < 4) {
        ck.that(strip.cellAt(i).isOld() && strip.cellAt(i).hasAsset(), "第 ${i} 格古字形有 asset")
        i = i + 1
    }
    ck.done("cong")
    return ck.failures.size
}

func sizeBuckets(): Int64 {
    println("== 档位分桶：默认条 ≤5 格 M(304)、≥6 格 S(301)；卡面强制 C(296) ==")
    let ck = Check()
    var mCount: Int64 = 0
    var sCount: Int64 = 0
    var c: Int64 = 0
    while (c < GlyphCatalog.charIds().size) {
        let charId = GlyphCatalog.charIds()[c]
        let strip = buildEvoStrip(charId, None)
        if (strip.cells.size >= 6) {
            sCount = sCount + 1
            ck.that(strip.isTier(EvoTier.S), "${charId} ≥6 格 → S")
            ck.that(strip.cellSize == 46 && strip.gap == 5, "${charId} S 格 46/5")
            ck.that(strip.trackWidth == 301, "${charId} S 轨道 301")
            ck.that(strip.trackWidth <= 301, "${charId} S 轨道 ≤301")
        } else {
            mCount = mCount + 1
            ck.that(strip.isTier(EvoTier.M), "${charId} ≤5 格 → M")
            ck.that(strip.cellSize == 56 && strip.gap == 6, "${charId} M 格 56/6")
            ck.that(strip.trackWidth == 304, "${charId} M 轨道 304")
        }
        ck.that(strip.usedWidth() <= strip.trackWidth, "${charId} used ≤ track")
        let card = buildCardStrip(charId)
        ck.that(card.isTier(EvoTier.C), "${charId} 卡面强制 C")
        ck.that(card.cellSize == 48 && card.gap == 14, "${charId} C 格 48/14")
        ck.that(card.trackWidth == 296, "${charId} C 轨道 296")
        c = c + 1
    }
    ck.that(mCount + sCount == 27, "分桶覆盖 27 字（M ${mCount} + S ${sCount}）")
    ck.that(mCount >= 1 && sCount >= 1, "M/S 两档都有字（M ${mCount} / S ${sCount}）")
    /* 从 是已知 S 档样例；休 / 本 / 末 是 M 档样例 */
    ck.that(buildEvoStrip("cong", None).isTier(EvoTier.S), "从 → S")
    ck.that(buildEvoStrip("xiu", None).isTier(EvoTier.M), "休 → M")
    ck.that(buildEvoStrip("ben", None).isTier(EvoTier.M), "本 → M")
    ck.that(buildEvoStrip("mo", None).isTier(EvoTier.M), "末 → M")
    ck.done("size-buckets")
    return ck.failures.size
}

func cardTier(): Int64 {
    println("== 卡面档 C：格 48 间距 14，轨道 296 ==")
    let ck = Check()
    let card = buildCardStrip("xiu")
    ck.that(card.isTier(EvoTier.C), "卡面档 C")
    ck.that(card.cellSize == 48, "格 48")
    ck.that(card.gap == 14, "间距 14")
    ck.that(card.trackWidth == 296, "轨道 296")
    ck.that(card.usedWidth() == 296, "5 格正好 296（got ${card.usedWidth()}）")
    ck.that(card.cells.size == 5, "5 格")
    let detail = buildDetailStrip("xiu")
    ck.that(detail.isTier(EvoTier.M), "字录详情标准档 M")
    ck.that(detail.trackWidth == 304, "字录详情轨道 304")
    ck.done("card-tier")
    return ck.failures.size
}

func emptyRule(): Int64 {
    println("== 空格规则：没有字形的阶段不出格，格子从左排 ==")
    let ck = Check()
    var c: Int64 = 0
    while (c < GlyphCatalog.charIds().size) {
        let charId = GlyphCatalog.charIds()[c]
        let rows = GlyphCatalog.ofChar(charId)
        let strip = buildEvoStrip(charId, None)
        ck.that(strip.cells.size == rows.size + 1 || strip.cells.size == rows.size + 2,
            "${charId} 格数 = 古字形数 + 繁简格数")
        ck.that(strip.cells.size <= 6, "${charId} 不超过 6 格")
        var i: Int64 = 0
        while (i < strip.cells.size) {
            let cell = strip.cellAt(i)
            if (cell.isOld()) {
                ck.that(cell.asset.size > 0, "${charId} 第 ${i} 格 asset 非空")
                ck.that(GlyphCatalog.indexOfAsset(cell.asset) >= 0,
                    "${charId} 第 ${i} 格 asset 在表里")
            } else {
                ck.that(cell.asset == "", "${charId} 第 ${i} 格（今天的字）不带 asset")
                ck.that(cell.glyph.size > 0, "${charId} 第 ${i} 格有字")
            }
            ck.that(cell.x == i * (strip.cellSize + strip.gap), "${charId} 第 ${i} 格左对齐")
            ck.that(isKnownStageName(cell.name), "${charId} 第 ${i} 格阶段名白名单")
            i = i + 1
        }
        /* 顺序固定：甲骨文 › 金文 › 小篆 › 隶书 › 繁简；
           但缺的阶段本来就不在表里（本/末 没有甲骨文），所以这里查的是
           「rows 是规范顺序的一个连续前缀」而不是逐位相等。 */
        let order = ["oracle", "bronze", "seal", "clerical"]
        var off: Int64 = -1
        var k: Int64 = 0
        while (k < order.size) {
            if (order[k] == rows[0].stage) {
                off = k
            }
            k = k + 1
        }
        ck.that(off >= 0, "${charId} 首个阶段 ${rows[0].stage} 在规范顺序里")
        var m: Int64 = 0
        while (m < rows.size) {
            ck.that(rows[m].stage == order[off + m],
                "${charId} 第 ${m} 个阶段是 ${order[off + m]}（got ${rows[m].stage}）")
            m = m + 1
        }
        c = c + 1
    }
    ck.done("empty-rule")
    return ck.failures.size
}

func ziluShape(): Int64 {
    println("== 字录：27 格、计数 8/7/1/0、四种状态 ==")
    let ck = Check()
    let (all, xiang, huiyi, zhishi) = ziluCounts()
    ck.that(ZILU_TOTAL == 27, "ZILU_TOTAL 27")
    ck.that(ZILU_MADE_IDS.size == 8, "已造列表 8")
    ck.that(all == 8, "全部 8（got ${all}）")
    ck.that(xiang == 7, "象形 7（got ${xiang}）")
    ck.that(huiyi == 1, "会意 1（got ${huiyi}）")
    ck.that(zhishi == 0, "指事 0（got ${zhishi}）")
    ck.that(all == xiang + huiyi + zhishi, "计数 8 = 象形+会意+指事")
    let grid = ziluGrid()
    ck.that(grid.size == ZILU_TOTAL, "格数 = ZILU_TOTAL（got ${grid.size}）")
    ck.that(grid.size == 27, "27 格（got ${grid.size}）")
    ck.that(ziluUnknownCount() == 17, "未知 17（got ${ziluUnknownCount()}）")
    ck.that(ziluUnknownCount() == ZILU_TOTAL - ZILU_MADE_IDS.size - 2, "未知 = 总数−已造−事签−残片")
    var made: Int64 = 0
    var sign: Int64 = 0
    var frag: Int64 = 0
    var unk: Int64 = 0
    var sel: Int64 = 0
    var i: Int64 = 0
    while (i < grid.size) {
        let cell = grid[i]
        if (cell.stateIs(ZiluCellState.Made)) {
            made = made + 1
            ck.that(cell.glyph.size > 0, "已造格有字")
        } else if (cell.stateIs(ZiluCellState.HasSign)) {
            sign = sign + 1
            ck.that(cell.hint == "有事签", "有事签格小字")
        } else if (cell.stateIs(ZiluCellState.HasFragment)) {
            frag = frag + 1
            ck.that(cell.hint == "木 + ？", "残片格小字")
        } else {
            unk = unk + 1
            ck.that(cell.glyph.size == 0, "未知格没有字")
        }
        if (cell.isSelected) {
            sel = sel + 1
            ck.that(cell.charId == "xiu", "选中的是休")
        }
        i = i + 1
    }
    ck.that(made == 8, "已造 8（got ${made}）")
    ck.that(sign == 1, "有事签 1（got ${sign}）")
    ck.that(frag == 1, "残片线索 1（got ${frag}）")
    ck.that(unk == 17, "未知 17（got ${unk}）")
    ck.that(sel == 1, "只有一格选中")
    /* 计数文案按已造列表现算（原来是 copy_text 里写死的 8 / 27） */
    ck.that(ziluNavCount() == ZILU_NAV_COUNT, "默认 计数 = 原常量「${ZILU_NAV_COUNT}」（got ${ziluNavCount()}）")
    ck.that(ziluNavCountOf(ZILU_MADE_IDS) == "8 / 27", "计数 Of 版按传入列表算")
    ck.that(ziluGridSummary() == ZILU_GRID_SUMMARY, "默认 网格摘要 = 原常量（got ${ziluGridSummary()}）")
    ck.that(cardBoneText(false) == CARD_BONE_PLAYING, "默认 播放中骨片行 = 原常量（got ${cardBoneText(false)}）")
    ck.that(cardBoneText(true) == CARD_BONE_SETTLED, "默认 落定骨片行 = 原常量（got ${cardBoneText(true)}）")
    ck.that(ziluIsMade("xiu"), "休 已造")
    ck.that(!ziluIsMade("ben"), "本 未造")
    ck.that(ziluIndexOf("shui") == 0, "水 在第一位")
    ck.that(ziluIndexOf("ben") == -1, "本 不在已造列表")
    ck.done("zilu")
    return ck.failures.size
}

/* v1.1.1 修的分页筛选 / 造于行人：字录切 tab 用。 */
func tabFilterShape(): Int64 {
    println("== 分页筛选：ziluTabIds / ziluTabHasChar / ziluTabFirstId / hasMadeMeta ==")
    let ck = Check()
    ck.that(ziluTabName(0) == "", "tab 0 没有造法名（全部）")
    ck.that(ziluTabName(1) == "象形", "tab 1 象形")
    ck.that(ziluTabName(2) == "会意", "tab 2 会意")
    ck.that(ziluTabName(3) == "指事", "tab 3 指事")
    ck.that(ziluTabName(9) == "", "未知 tab 空串")
    ck.that(ziluTabIds(0).size == 8, "全部 8 个已造")
    ck.that(ziluTabIds(1).size == 7, "象形 7 个")
    ck.that(ziluTabIds(2).size == 1, "会意 1 个")
    ck.that(ziluTabIds(3).size == 0, "指事 0 个（空分页）")
    ck.that(ziluTabFirstId(1) == "shui", "象形第一个是 水")
    ck.that(ziluTabFirstId(2) == "xiu", "会意只有 休")
    ck.that(ziluTabFirstId(3) == "", "指事空分页返回空串")
    ck.that(ziluTabHasChar(2, "xiu"), "休 在会意里")
    ck.that(!ziluTabHasChar(2, "shui"), "水 不在会意里")
    ck.that(ziluTabHasChar(0, "shui"), "tab 0 恒真")
    ck.that(ziluHasId(ziluTabIds(1), "mu"), "ziluHasId 木 在象形里")
    ck.that(!ziluHasId(ziluTabIds(1), "xiu"), "ziluHasId 休 不在象形里")
    /* 已造的字每个都落在某个分页里（不会出现切了 tab 就找不到的字）。 */
    let made = ziluMadeIds()
    var i: Int64 = 0
    while (i < made.size) {
        let hit = ziluTabHasChar(1, made[i]) || ziluTabHasChar(2, made[i]) || ziluTabHasChar(3, made[i])
        ck.that(hit, "${made[i]} 落在某个分页里")
        i = i + 1
    }
    ck.that(hasMadeMeta("xiu"), "休 显示 造于/记事人")
    ck.that(!hasMadeMeta("shui"), "水 不显示 造于/记事人（设计稿没给，不编造）")
    ck.that(!hasMadeMeta(""), "空 id 不显示")
    ck.done("tabFilter")
    return ck.failures.size
}

/* DEBUG 种子：ZILU_DEBUG_SEED_ZHISHI 打开时追加指事字「本」。
   默认必须是 false（这里断言守着，防止带着 true 出包）；
   打开后的效果走参数化函数验，不改全局常量。 */
func ziluSeedShape(): Int64 {
    println("== 指事徽标种子（DEBUG ONLY，默认关）==")
    let ck = Check()
    ck.that(!ZILU_DEBUG_SEED_ZHISHI, "ZILU_DEBUG_SEED_ZHISHI 默认 false（禁止带着 true 出包）")
    ck.that(ZILU_BASE_MADE_IDS.size == 8, "基线列表 8 个（got ${ZILU_BASE_MADE_IDS.size}）")
    ck.that(ZILU_MADE_IDS.size == 8, "默认已造列表 8（got ${ZILU_MADE_IDS.size}）")
    ck.that(ZILU_DEBUG_SEED_CHAR_ID == "ben", "种子字是 本(ben)")
    /* 默认列表 = 基线列表，一个不多一个不少 */
    var b: Int64 = 0
    while (b < ZILU_BASE_MADE_IDS.size) {
        ck.that(ZILU_MADE_IDS[b] == ZILU_BASE_MADE_IDS[b], "默认第 ${b} 个 id 与基线一致")
        b = b + 1
    }
    /* 关：不开种子时一个 ben 都不加 */
    let off = ziluBuildMadeIds(false)
    ck.that(off.size == 8, "ziluBuildMadeIds(false) 还是 8（got ${off.size}）")
    ck.that(ziluIndexOfOf(off, "ben") == -1, "关种子时 本 不在已造列表")
    /* 开：追加本，指事分页不再是空的 */
    let on = ziluBuildMadeIds(true)
    ck.that(on.size == 9, "ziluBuildMadeIds(true) 9 个（got ${on.size}）")
    ck.that(ziluIndexOfOf(on, "ben") == 8, "本 追加在最后一位")
    ck.that(ziluIsMadeOf(on, "ben"), "开种子时 本 已造")
    var keep: Int64 = 0
    while (keep < ZILU_BASE_MADE_IDS.size) {
        ck.that(on[keep] == ZILU_BASE_MADE_IDS[keep], "开种子不丢基线第 ${keep} 个字")
        keep = keep + 1
    }
    /* 计数：全部 9 = 象形 7 + 会意 1 + 指事 1 */
    let (sAll, sXiang, sHuiyi, sZhishi) = ziluCountsOf(on)
    ck.that(sAll == 9, "种子 全部 9（got ${sAll}）")
    ck.that(sXiang == 7, "种子 象形 7（got ${sXiang}）")
    ck.that(sHuiyi == 1, "种子 会意 1（got ${sHuiyi}）")
    ck.that(sZhishi == 1, "种子 指事 1（got ${sZhishi}）")
    ck.that(sAll == sXiang + sHuiyi + sZhishi, "种子 9 = 象形+会意+指事")
    /* 分页：指事 tab 只有本，第一个也是本 */
    let zsIds = ziluTabIdsOf(on, 3)
    ck.that(zsIds.size == 1, "种子 指事分页 1 个字（got ${zsIds.size}）")
    ck.that(zsIds[0] == "ben", "种子 指事分页只有 本（got ${zsIds[0]}）")
    ck.that(ziluTabFirstIdOf(on, 3) == "ben", "种子 指事第一个字是 本")
    ck.that(ziluTabIdsOf(on, 0).size == 9, "种子 全部分页 9 个字")
    ck.that(ziluTabIdsOf(on, 1).size == 7, "种子 象形分页 7 个字")
    ck.that(ziluTabIdsOf(on, 2).size == 1, "种子 会意分页 1 个字")
    /* 空分页文案：指事 tab 有字了，但文案函数只按 tab 走，仍然可用 */
    ck.that(ziluTabName(3) == "指事", "tab 3 造法名 指事")
    ck.that(ziluTabEmptyText(3) == "暂无指事字", "指事空分页文案 暂无指事字")
    /* 徽标读的造法：本 是 指事 */
    ck.that(ziluMethodOf("ben") == "指事", "本 造法 指事（got ${ziluMethodOf("ben")}）")
    ck.that(ziluMethodOf("ben") == ziluTabName(3), "本 的造法 = tab 3 造法名")
    ck.that(ziluGlyphOf("ben") == "本", "本 的字形是 本")
    /* 27 格总览在 9 个已造下仍然铺满：9 + 事签 + 残片 + 16 未知 */
    let grid = ziluGridOf(on)
    ck.that(grid.size == ZILU_TOTAL, "种子 27 格（got ${grid.size}）")
    ck.that(ziluUnknownCountOf(on) == 16, "种子 未知 16（got ${ziluUnknownCountOf(on)}）")
    ck.that(ziluUnknownCountOf(on) >= 0, "种子 未知数不为负")
    var made: Int64 = 0
    var unk: Int64 = 0
    var sel: Int64 = 0
    var benSeen: Int64 = 0
    var g: Int64 = 0
    while (g < grid.size) {
        let cell = grid[g]
        if (cell.isMade()) {
            made = made + 1
            if (cell.charId == "ben") {
                benSeen = benSeen + 1
                ck.that(cell.glyph == "本", "种子 本 格显示 本")
            }
        } else if (cell.stateIs(ZiluCellState.Unknown)) {
            unk = unk + 1
        }
        if (cell.isSelected) {
            sel = sel + 1
            ck.that(cell.charId == "xiu", "种子 选中的仍是休")
        }
        g = g + 1
    }
    ck.that(made == 9, "种子 已造 9 格（got ${made}）")
    ck.that(unk == 16, "种子 未知 16 格（got ${unk}）")
    ck.that(benSeen == 1, "种子 本 在网格里只有一格")
    ck.that(sel == 1, "种子 只有一格选中")
    /* 默认那侧的旧行为一格不动 */
    ck.that(ziluGridOf(ZILU_MADE_IDS).size == 27, "默认 27 格")
    ck.that(ziluUnknownCountOf(ZILU_MADE_IDS) == 17, "默认 未知 17")
    /* 种子打开时标题 / 统计跟着变（原来是写死的 8 / 27） */
    ck.that(ziluNavCountOf(on) == "9 / 27", "种子 计数 9 / 27（got ${ziluNavCountOf(on)}）")
    ck.that(ziluGridSummaryOf(on) == "已造 9 · 手里有事签 1 · 有残片线索 1 · 未知 16",
        "种子 网格摘要（got ${ziluGridSummaryOf(on)}）")
    ck.that(cardBoneTextOf(on, true) == "空骨片 2 · 字录 9 / 27", "种子 落定骨片行（got ${cardBoneTextOf(on, true)}）")
    ck.that(cardBoneTextOf(on, false) == "空骨片 2 · 字录 8 / 27", "种子 播放中骨片行（got ${cardBoneTextOf(on, false)}）")
    /* 一个字都没造：不出负数 */
    let noneIds: Array<String> = []
    ck.that(cardBoneTextOf(noneIds, false) == "空骨片 2 · 字录 0 / 27",
        "没造过字 → 字录 0（got ${cardBoneTextOf(noneIds, false)}）")
    ck.that(ziluNavCountOf(noneIds) == "0 / 27", "没造过字 → 计数 0 / 27")
    ck.done("zilu-seed")
    return ck.failures.size
}

func copyShape(): Int64 {
    println("== 文案：白话 / 字义 / 典籍 / 效果 ==")
    let ck = Check()
    ck.that(baihuaLines("xiu", 0)[0] == "一人背靠", "休 甲骨文白话第一行")
    ck.that(baihuaLines("xiu", 4)[0] == "和今天一样", "休 繁简同形白话")
    ck.that(baihuaLines("cong", 3)[0] == "添了走路", "从 隶书白话")
    ck.that(baihuaLines("ben", 0).size == 2, "本 金文白话两行")
    ck.that(baihuaLines("shui", 2).size == 2, "水 小篆白话两行")
    ck.that(baihuaLines("ri", 0).size == 0, "日 没有白话（设计稿没给）")
    let copy = ziluCopyOf("xiu")
    ck.that(copy.hasMeaning(), "休 有白话字义")
    ck.that(copy.hasClassic(), "休 有典籍")
    ck.that(copy.classicSource == "《说文解字》卷六", "休 典籍出处")
    ck.that(copy.hasStory(), "休 有小故事")
    ck.that(copy.hasEffects(), "休 有效果")
    ck.that(copy.effects.size == 3, "休 3 条效果")
    ck.that(copy.effects[0].label == "落字", "休 效果第一条 落字")
    let none = ziluCopyOf("shui")
    ck.that(!none.hasClassic(), "水 没有典籍 → 整块不显示")
    ck.that(!none.hasMeaning(), "水 没有字义 → 整块不显示")
    ck.that(formulaParts("xiu").size == 2, "休 公式两个部件")
    ck.that(formulaText("shui") == "描迹 · 水", "水 公式 描迹")
    ck.that(formulaText("ben") == "底字 木 · 一在其下", "本 公式 指事")
    ck.that(SHIQIAN_BODY.size > 10, "事签文案在")
    ck.that(CARD_SHEET_TITLE == "「休」入字录", "弹层标题")
    ck.done("copy")
    return ck.failures.size
}

func tokenShape(): Int64 {
    println("== token：色板 / 演变条尺寸 ==")
    let ck = Check()
    ck.that(Theme.night900 == 0X15171F, "night-900")
    ck.that(Theme.bone100 == 0XF1E8D4, "bone-100")
    ck.that(Theme.zhu600 == 0XB5432E, "zhu-600")
    ck.that(Theme.carve == 0X6E2F1F, "刻痕色")
    ck.that(Theme.evoCellC == 48 && Theme.evoGapC == 14, "C 档 48/14")
    ck.that(Theme.evoCellM == 56 && Theme.evoGapM == 6, "M 档 56/6")
    ck.that(Theme.evoCellS == 46 && Theme.evoGapS == 5, "S 档 46/5")
    ck.that(Theme.evoTrackC == 296 && Theme.evoTrackM == 304 && Theme.evoTrackS == 301, "轨道宽")
    ck.that(Theme.popW == 188 && Theme.popGlyphBox == 144, "放大卡 188/144")
    /* v1.1.1：放大卡白话 Serif 12（fsPopBaihua）；字体族占位 "serif"。 */
    ck.that(Theme.fsPopBaihua == 12, "放大卡白话字号 12（got ${Theme.fsPopBaihua}）")
    ck.that(Theme.serif == "serif", "serif 族占位")
    ck.that(Theme.serifTC == "serif", "serifTC 族占位")
    ck.that(Theme.gridCell == 60 && Theme.gridGap == 9 && Theme.gridPerRow == 5, "字录格子 60/9/5")
    let (c, g, t) = evoGeometry(EvoTier.M)
    ck.that(c == 56 && g == 6 && t == 304, "evoGeometry(M)")
    let (nm, er) = splitStageLabel("隶书 · 西汉")
    ck.that(nm == "隶书" && er == "西汉", "splitStageLabel 隶书 · 西汉")
    let (nm2, er2) = splitStageLabel("小篆 · 秦")
    ck.that(nm2 == "小篆" && er2 == "秦", "splitStageLabel 小篆 · 秦")
    ck.that(ZILU_TOTAL == 27, "字录总数 27")
    /* M2 slice 4：结局卡 / 代末结算 token（SPEC §2.6 / §2.7）。 */
    ck.that(Theme.endInset == 24 && Theme.endBandH == 8 && Theme.endRadius == 18,
        "结局卡 边距 24 / 色带 8 / 圆角 18")
    ck.that(Theme.endTitleFs == 40 && Theme.endLineFs == 16 && Theme.endLineLh == 28,
        "结局卡 标题 40 / 结局话 16/28")
    ck.that(Theme.endCharCell == 40 && Theme.endRiseMs == 320, "结局卡 字 40×40 / 升起 320ms")
    ck.that(Theme.dimFlashMs == 200, "闪朱一下 200ms")
    ck.that(Theme.familyDot == 10 && Theme.familyLine == 2, "家谱行 圆点 10 / 竖线 2")
    ck.that(Theme.familyCharCell == 24 && Theme.familyNewTagH == 16, "家谱行 字 24 / 新角标 16")
    ck.that(Theme.keepCharCell == 44 && Theme.settleRowH == 58, "代末页 留下的字 44 / 行高 58")
    ck.done("tokens")
    return ck.failures.size
}

/* 坏档（字段数不对 / 版本不符 / 有字段不是数 / 不自洽）一律 parse 成 None。 */
func runParseBad(raw: String): Bool {
    match (parseRunState(raw)) {
        case Some(_) => return false
        case None => return true
    }
}

/* M2 RunState：新开局数值 / 挑字落定 / 序列化往返 / 坏档容错 / 开局挑字规则。 */
func runStateShape(): Int64 {
    println("== M2 RunState：新开局 / 挑字落定 / 序列化往返 / 坏档 / 开局挑字 ==")
    let ck = Check()

    /* —— 新开局 —— */
    let s = newRunState()
    ck.that(s.generation == 1, "新开局 第 1 代（got ${s.generation}）")
    ck.that(s.year == 1, "新开局 第 1 年")
    ck.that(s.yearsLeft == 12, "新开局 余年 12（got ${s.yearsLeft}）")
    ck.that(s.dims.size == 4, "四维 4 个（got ${s.dims.size}）")
    var d: Int64 = 0
    while (d < s.dims.size) {
        ck.that(s.dims[d] == 50, "第 ${d} 维开局 50（got ${s.dims[d]}）")
        d = d + 1
    }
    ck.that(s.boneEmpty == 2, "新开局 空骨片 2（got ${s.boneEmpty}）")
    ck.that(s.boneShiqian == 0, "新开局 事签骨片 0")
    ck.that(s.boxChars.size == 0, "新开局 字匣空")
    ck.that(s.boxLanded.size == 0, "新开局 landed 空")
    ck.that(s.phase == RUN_PHASE_PICK, "新开局 phase 0 = 开局挑字页")
    ck.that(RUN_PHASE_HOME == 1 && RUN_PHASE_ENDING == 2 && RUN_PHASE_SETTLE == 3, "phase 取值 0..3")
    ck.that(s.cardIndex == 0 && s.cardsSeen == 0, "新开局 牌堆下标 0")
    ck.that(s.endingId == "" && s.endingDim == -1 && s.endingKind == "", "新开局 没有结局")
    ck.that(s.family.size == 0, "新开局 家谱空")

    /* —— 挑字落定 —— */
    let made: Array<String> = ["shui", "ri", "ren"]
    s.confirmPick(made)
    ck.that(s.boxChars.size == 3, "挑 3 个字进字匣（got ${s.boxChars.size}）")
    ck.that(s.boxChars[0] == "shui" && s.boxChars[2] == "ren", "字匣按挑选顺序排")
    ck.that(s.boxLanded.size == 3, "landed 与 chars 等长")
    var l: Int64 = 0
    while (l < s.boxLanded.size) {
        ck.that(!s.boxLanded[l], "第 ${l} 格本代未落")
        l = l + 1
    }
    ck.that(s.phase == RUN_PHASE_HOME, "落定后 phase 1 = 主界")
    ck.that(s.boxAt(0) == "shui" && s.boxAt(9) == "", "boxAt 越界返回空串")
    ck.that(!s.landedAt(9), "landedAt 越界 false")

    /* —— cloneRunState / runAfterPick：复制一份再改，@State 才认（引用变化）—— */
    s.generation = 3
    s.year = 5
    s.yearsLeft = 8
    s.dims = [11, 22, 33, 44]
    s.boneEmpty = 4
    s.boneShiqian = 1
    s.cardIndex = 2
    s.cardsSeen = 6
    s.endingId = ""
    s.endingDim = -1
    s.phase = RUN_PHASE_PICK
    let cloneChars: Array<String> = ["tian"]
    s.family = [FamilyEntry(2, "兵祸", false, cloneChars)]
    let clone = cloneRunState(s)
    ck.that(clone.sameAs(s), "cloneRunState 逐字段相等")
    ck.that(clone.boxChars.size == 3 && clone.boxChars[0] == "shui", "clone 字匣原样")
    ck.that(clone.family.size == 1 && clone.family[0].endingTitle == "兵祸", "clone 家谱原样")
    let afterPick = runAfterPick(clone, made)
    ck.that(afterPick.generation == 3 && afterPick.year == 5 && afterPick.yearsLeft == 8,
        "runAfterPick 只改字匣 / phase")
    ck.that(afterPick.dims[0] == 11 && afterPick.dims[3] == 44, "runAfterPick 四维不动")
    ck.that(afterPick.boneEmpty == 4 && afterPick.boneShiqian == 1, "runAfterPick 骨片不动")
    ck.that(afterPick.cardIndex == 2 && afterPick.cardsSeen == 6, "runAfterPick 牌堆不动")
    ck.that(afterPick.family.size == 1 && afterPick.family[0].endingTitle == "兵祸",
        "runAfterPick 家谱不动")
    ck.that(afterPick.boxChars.size == 3 && afterPick.boxChars[2] == "ren", "runAfterPick 字匣换成挑的")
    ck.that(afterPick.boxLanded.size == 3 && !afterPick.boxLanded[0] && !afterPick.boxLanded[2],
        "runAfterPick landed 全 false")
    ck.that(afterPick.phase == RUN_PHASE_HOME, "runAfterPick phase 进主界")
    /* 原对象不被改写（界面层靠这个换引用触发重绘） */
    ck.that(clone.phase == RUN_PHASE_PICK, "runAfterPick 不改原状态")
    ck.that(clone.sameAs(s), "原状态还是原样")

    /* —— 序列化往返（逐字段，含家谱）—— */
    s.generation = 2
    s.year = 7
    s.yearsLeft = 5
    s.dims = [40, 12, 88, 61]
    s.boneEmpty = 1
    s.boneShiqian = 3
    s.boxLanded = [true, false, true]
    s.phase = RUN_PHASE_HOME
    s.cardIndex = 4
    s.cardsSeen = 9
    s.endingId = "jinian"
    s.endingDim = 1
    s.endingKind = "dim_zero"
    let famChars: Array<String> = ["xiu", "ben"]
    s.family = [FamilyEntry(1, "饥年", false, famChars), FamilyEntry(2, "寿终传笔", true, [])]
    let raw = serializeRunState(s)
    ck.that(raw.startsWith("zaozi_run|v${RUN_SAVE_VERSION}"), "存档头带版本（got ${raw}）")
    match (parseRunState(raw)) {
        case Some(back) =>
            ck.that(back.sameAs(s), "往返后逐字段相等")
            ck.that(back.generation == 2 && back.year == 7 && back.yearsLeft == 5, "往返 代/年/余年")
            ck.that(back.dims[0] == 40 && back.dims[1] == 12 && back.dims[2] == 88 && back.dims[3] == 61,
                "往返 四维")
            ck.that(back.boneEmpty == 1 && back.boneShiqian == 3, "往返 骨片")
            ck.that(back.boxChars.size == 3 && back.boxChars[1] == "ri", "往返 字匣")
            ck.that(back.boxLanded[0] && !back.boxLanded[1] && back.boxLanded[2], "往返 landed")
            ck.that(back.phase == RUN_PHASE_HOME, "往返 phase")
            ck.that(back.cardIndex == 4 && back.cardsSeen == 9, "往返 牌堆")
            ck.that(back.endingId == "jinian" && back.endingDim == 1 && back.endingKind == "dim_zero",
                "往返 结局")
            ck.that(back.family.size == 2, "往返 家谱 2 条")
            ck.that(back.family[0].generation == 1 && back.family[0].endingTitle == "饥年",
                "往返 家谱第 1 条")
            ck.that(!back.family[0].endingGood && back.family[1].endingGood, "往返 家谱善终位")
            ck.that(back.family[0].chars.size == 2 && back.family[0].chars[1] == "ben",
                "往返 家谱留下的字")
            ck.that(back.family[1].chars.size == 0, "往返 家谱空字列表")
        case None => ck.that(false, "完整存档往返 parse 不该失败")
    }
    /* 新开局（全默认值）也要能原样往返 */
    match (parseRunState(serializeRunState(newRunState()))) {
        case Some(fresh) => ck.that(fresh.sameAs(newRunState()), "新开局原样往返")
        case None => ck.that(false, "新开局往返 parse 失败")
    }
    /* 空字匣 + 空家谱的存档串里没有空字段 */
    ck.that(!serializeRunState(newRunState()).contains("||"), "空列表写成 -，不出现空字段")

    /* —— 坏档 → None（调用方回退新开局，绝不崩）—— */
    ck.that(runParseBad(""), "空串 → None")
    ck.that(runParseBad("hello"), "垃圾串 → None")
    ck.that(runParseBad(raw.replace("v1", "v0")), "旧版本 → None")
    ck.that(runParseBad(raw.replace("|7|", "|abc|")), "年份不是数字 → None")
    ck.that(runParseBad(raw[0..raw.size - 4]), "整行被截断 → None")
    ck.that(runParseBad(raw.replace("40,12,88,61", "40,12,88")), "四维少一维 → None")
    ck.that(runParseBad(raw.replace("1,0,1", "1,0")), "landed 与 chars 不等长 → None")
    ck.that(runParseBad(raw.replace("1~饥年~0~xiu,ben;2~寿终传笔~1~-", "1~饥年~0")),
        "家谱字段数不对 → None")
    ck.that(runParseBad(raw.replace("2~寿终传笔~1~-", "2~寿终传笔~1")), "家谱最后一条被截断 → None")
    ck.that(runParseBad(raw.replace("zaozi_run", "other_run")), "存档头不对 → None")
    ck.that(runParseBad(raw.replace("|1|", "|9|").replace("|2|", "|9|")), "phase 越界 → None")

    /* —— startGeneration：代次 +1，其余归开局值，家谱留着 —— */
    let prev = newRunState()
    prev.generation = 4
    prev.year = 11
    prev.yearsLeft = 2
    prev.dims = [3, 99, 20, 71]
    prev.boneEmpty = 0
    prev.boneShiqian = 5
    prev.boxChars = ["shui"]
    prev.boxLanded = [true]
    prev.phase = RUN_PHASE_SETTLE
    prev.cardIndex = 6
    prev.cardsSeen = 12
    prev.endingId = "shisi"
    let keepFam: Array<String> = ["he"]
    prev.family = [FamilyEntry(3, "失祀", false, keepFam)]
    let next = startGeneration(prev)
    ck.that(next.generation == 5, "下一代 代次 +1（got ${next.generation}）")
    ck.that(next.year == 1 && next.yearsLeft == 12, "下一代 年 / 余年 归位")
    ck.that(next.dims[0] == 50 && next.dims[1] == 50 && next.dims[2] == 50 && next.dims[3] == 50,
        "下一代 四维归 50")
    ck.that(next.boneEmpty == 2 && next.boneShiqian == 0, "下一代 骨片归位")
    ck.that(next.boxChars.size == 0 && next.boxLanded.size == 0, "下一代 字匣清空")
    ck.that(next.phase == RUN_PHASE_PICK, "下一代 回开局挑字页")
    ck.that(next.cardIndex == 0 && next.cardsSeen == 0, "下一代 牌堆归零")
    ck.that(next.endingId == "" && next.endingDim == -1, "下一代 清掉上一代结局")
    ck.that(next.family.size == 1, "家谱留着（got ${next.family.size}）")
    ck.that(next.family[0].generation == 3 && next.family[0].endingTitle == "失祀",
        "家谱第 1 条还是第 3 代")

    /* —— 开局挑字规则 —— */
    ck.that(PICK_BTN_NEED == "还差 N 个字", "文案 还差 N 个字（got ${PICK_BTN_NEED}）")
    ck.that(PICK_BTN_GO == "就带这些开局", "文案 就带这些开局（got ${PICK_BTN_GO}）")
    ck.that(PICK_TITLE == "挑字入字匣", "挑字页标题")
    ck.that(PICK_GEN_LINE == "第 N 代 · 开局", "挑字页代次行（N 待替换）")
    let avail = pickAvailable()
    ck.that(avail == ZILU_MADE_IDS.size, "可挑的字 = 已造的字（got ${avail}）")
    let one = pickToggle([], "shui")
    ck.that(one.size == 1 && one[0] == "shui", "空格挑第一个")
    let two = pickToggle(one, "ri")
    ck.that(two.size == 2 && two[0] == "shui" && two[1] == "ri", "顺序 = 挑选顺序")
    let three = pickToggle(two, "ren")
    ck.that(three.size == 3, "挑满 3 个")
    let four = pickToggle(three, "mu")
    ck.that(four.size == 3 && four[2] == "ren", "满 3 个后第 4 个字收不进来")
    let back2 = pickToggle(three, "ri")
    ck.that(back2.size == 2 && back2[0] == "shui" && back2[1] == "ren", "收回后剩下的保持顺序")
    ck.that(pickToggle(three, "ren").size == 2, "收回最后一个")
    ck.that(pickToggle([], "shui").size == 1, "收回不存在的字等于挑上")
    ck.that(pickIndexOf(two, "ri") == 1, "ri 是第 2 个挑的（下标 1）")
    ck.that(pickIndexOf(two, "mu") == -1, "没挑的字下标 -1")
    ck.that(pickOrderOf(two, "shui") == 1 && pickOrderOf(two, "ri") == 2, "序号 1..3")
    ck.that(pickOrderOf(two, "mu") == 0, "没挑的字序号 0")
    ck.that(pickRemaining([], 8) == 3, "一个字没挑 → 还差 3")
    ck.that(pickRemaining(one, 8) == 2, "挑了 1 个 → 还差 2")
    ck.that(pickRemaining(two, 8) == 1, "挑了 2 个 → 还差 1")
    ck.that(pickRemaining(three, 8) == 0, "挑了 3 个 → 还差 0")
    ck.that(pickRemaining([], 2) == 2, "只造了 2 个字 → 还差 2")
    ck.that(pickRemaining(two, 2) == 0, "只造了 2 个字、挑了 2 个 → 还差 0")
    ck.that(pickRemaining([], 0) == 0, "一个字都没造 → 允许空着开局")
    ck.that(pickButtonText([], 8) == "还差 3 个字", "0 个 → 还差 3 个字")
    ck.that(pickButtonText(one, 8) == "还差 2 个字", "1 个 → 还差 2 个字")
    ck.that(pickButtonText(two, 8) == "还差 1 个字", "2 个 → 还差 1 个字")
    ck.that(pickButtonText(three, 8) == PICK_BTN_GO, "3 个 → 就带这些开局")
    ck.that(pickButtonText(two, 2) == PICK_BTN_GO, "可挑不足 3 个且挑满 → 就带这些开局")
    ck.that(pickButtonText([], 0) == PICK_BTN_GO, "没有字可挑 → 就带这些开局")
    ck.that(!pickCanConfirm([], 8), "没挑满不能确认")
    ck.that(!pickCanConfirm(two, 8), "差 1 个不能确认")
    ck.that(pickCanConfirm(three, 8), "挑满 3 个能确认")
    ck.that(pickCanConfirm(two, 2), "不足 3 个字时挑满就能确认")
    ck.that(pickCanConfirm([], 0), "没有字也能开局")
    /* 挑字网格 = 字录那个 27 格，选中态按 picked 算 */
    let cells = pickGridCells(three)
    ck.that(cells.size == ZILU_TOTAL, "挑字网格还是 ${ZILU_TOTAL} 格（got ${cells.size}）")
    var madeCells: Int64 = 0
    var selCells: Int64 = 0
    var newBadges: Int64 = 0
    var g: Int64 = 0
    while (g < cells.size) {
        let c = cells[g]
        if (c.isMade()) {
            madeCells = madeCells + 1
            ck.that(ziluIsMade(c.charId), "可挑格都是已造的字 ${c.charId}")
            ck.that(c.glyph.size > 0, "已造格有字 ${c.charId}")
            ck.that(c.isSelected == ziluIsMadeOf(three, c.charId), "选中态按 picked 算 ${c.charId}")
        } else {
            ck.that(!c.isSelected, "没造出来的格不能挑（下标 ${g}）")
        }
        if (c.isNew) { newBadges = newBadges + 1 }
        if (c.isSelected) { selCells = selCells + 1 }
        g = g + 1
    }
    ck.that(madeCells == ZILU_MADE_IDS.size, "可挑格 = 已造字数（got ${madeCells}）")
    ck.that(selCells == 3, "只有挑中的 3 格带选中态（got ${selCells}）")
    ck.that(newBadges == 0, "挑字网格不显示「新」角标")
    ck.done("run-state")
    return ck.failures.size
}

/* 第 2 代起挑字页第 1 格留给「上一代传下的事签」：玩家只挑 2 个字
   （SPEC §2.4 / 设计稿 ziku_pick_v1 D 屏）。刻事签 / 传事签不在本里程碑，
   所以 carried 恒 false —— 这一片把「等它落地时」的形状先定死。 */
func pickShiqianShape(): Int64 {
    println("== 事签格：第 2 代起只挑 2 个字（第 1 格不可换）==")
    let ck = Check()

    /* —— 预留格 / 上限 —— */
    ck.that(pickShiqianReserved(1) == 0, "第 1 代不预留事签格（got ${pickShiqianReserved(1)}）")
    ck.that(pickShiqianReserved(2) == 1, "第 2 代起预留 1 格")
    ck.that(pickShiqianReserved(5) == 1, "第 5 代照样预留 1 格")
    ck.that(pickShiqianReserved(0) == 0 && pickShiqianReserved(-3) == 0, "没有上一代就不预留")
    ck.that(pickCapFor(1) == 3, "第 1 代 cap 3（got ${pickCapFor(1)}）")
    ck.that(pickCapFor(2) == 2, "第 2 代 cap 2（got ${pickCapFor(2)}）")
    ck.that(pickCapFor(5) == 2, "第 5 代 cap 2（got ${pickCapFor(5)}）")
    ck.that(pickCapFor(2) == RUN_PICK_CAP - pickShiqianReserved(2), "cap = 3 − 预留格")

    /* —— cap 2 的挑字 / 按钮 / 序号 —— */
    let c1 = pickToggleCap([], "shui", 2)
    let c2 = pickToggleCap(c1, "ri", 2)
    ck.that(c2.size == 2 && c2[0] == "shui" && c2[1] == "ri", "cap 2 挑 2 个字")
    let c3 = pickToggleCap(c2, "ren", 2)
    ck.that(c3.size == 2 && c3[0] == "shui" && c3[1] == "ri", "cap 2 满之后第 3 个字点不进去")
    ck.that(pickCanConfirmCap(c2, 8, 2), "cap 2 挑满 2 个能确认")
    ck.that(!pickCanConfirmCap([], 8, 2) && !pickCanConfirmCap(c1, 8, 2), "没挑满 cap 不能确认")
    ck.that(pickRemainingCap([], 8, 2) == 2, "一个字没挑、cap 2 → 还差 2（got ${pickRemainingCap([], 8, 2)}）")
    ck.that(pickButtonTextCap([], 8, 2) == "还差 2 个字", "cap 2 空着 → 还差 2 个字（got ${pickButtonTextCap([], 8, 2)}）")
    ck.that(pickButtonTextCap(c1, 8, 2) == "还差 1 个字", "挑了 1 个 → 还差 1 个字")
    ck.that(pickButtonTextCap(c2, 8, 2) == PICK_BTN_GO, "挑满 cap → 就带这些开局")
    /* 可挑的字不足 cap：只造了 1 个字，挑 1 个就够 */
    ck.that(pickNeedCap(1, 2) == 1, "available 1、cap 2 → 只需要 1 个")
    ck.that(pickRemainingCap([], 1, 2) == 1, "available 1、cap 2 → 还差 1")
    ck.that(pickButtonTextCap(c1, 1, 2) == PICK_BTN_GO, "available 1 时挑 1 个就 就带这些开局")
    ck.that(pickCanConfirmCap(c1, 1, 2), "available 1 时挑 1 个能确认")
    ck.that(pickNeedCap(0, 2) == 0 && pickCanConfirmCap([], 0, 2), "一个字都没造 → 空着也能开局")
    /* 序号后移：事签占了第 1 格，挑的第 1 个字排第 2 格 */
    let p2: Array<String> = ["shui", "ri"]
    ck.that(pickOrderOfBase(p2, "shui", 1) == 2, "第 2 代第 1 个字序号 2（got ${pickOrderOfBase(p2, "shui", 1)}）")
    ck.that(pickOrderOfBase(p2, "ri", 1) == 3, "第 2 代第 2 个字序号 3")
    ck.that(pickOrderOfBase(p2, "mu", 1) == 0, "没挑的字序号还是 0")
    ck.that(pickOrderOfBase(p2, "shui", 0) == pickOrderOf(p2, "shui"), "orderBase 0 = 原来的序号")
    /* 不带 cap 的版本就是 cap = RUN_PICK_CAP：第 1 代行为一格不变 */
    let t1 = pickToggle([], "shui")
    let t2 = pickToggle(t1, "ri")
    let t3 = pickToggle(t2, "ren")
    ck.that(t3.size == 3, "不带 cap 还是能挑 3 个")
    ck.that(pickToggle(t3, "mu").size == 3, "不带 cap 满 3 个后第 4 个收不进来")
    let d1 = pickToggle(t2, "ren")
    let d2 = pickToggleCap(t2, "ren", RUN_PICK_CAP)
    ck.that(d1.size == d2.size && d1[0] == d2[0] && d1[1] == d2[1], "pickToggle 委托 cap 版")
    ck.that(pickNeed(8) == pickNeedCap(8, RUN_PICK_CAP), "pickNeed 委托 cap 版")
    ck.that(pickRemaining(t2, 8) == pickRemainingCap(t2, 8, RUN_PICK_CAP), "pickRemaining 委托 cap 版")
    ck.that(pickButtonText(t2, 8) == pickButtonTextCap(t2, 8, RUN_PICK_CAP), "pickButtonText 委托 cap 版")
    ck.that(pickCanConfirm(t2, 8) == pickCanConfirmCap(t2, 8, RUN_PICK_CAP), "pickCanConfirm 委托 cap 版")
    ck.that(PICK_SHIQIAN_CARRIED == "事签\n传下", "事签格文案 事签/传下（got ${PICK_SHIQIAN_CARRIED}）")
    ck.that(PICK_SHIQIAN_NONE == "事签\n未传", "事签格文案 事签/未传（got ${PICK_SHIQIAN_NONE}）")
    ck.that(PICK_SHIQIAN_CAP_CARRIED == "上一代传下\n不可换", "事签格说明 上一代传下/不可换")
    ck.that(PICK_SHIQIAN_CAP_NONE == "上一代没传事签\n这格空着", "事签格说明 上一代没传事签/这格空着")

    /* —— carried：现在没有任何代码传事签，恒 false —— */
    let signPrev = newRunState()
    signPrev.generation = 4
    signPrev.boneShiqian = 1
    let nextGen = startGeneration(signPrev)
    ck.that(nextGen.generation == 5, "startGeneration 到第 5 代")
    ck.that(nextGen.boneShiqian == 0, "startGeneration 把骨片清零")
    ck.that(!pickShiqianCarried(nextGen), "startGeneration 之后没传下事签（got carried）")
    ck.that(!pickShiqianCarried(newRunState()), "第 1 代没有上一代 → 不传")
    let noSign = newRunState()
    noSign.generation = 2
    ck.that(!pickShiqianCarried(noSign), "第 2 代但没事签骨片 → 不传")

    /* —— 手造一个「传下了事签」的第 2 代（等传事签落地时的形状）—— */
    let carried = newRunState()
    carried.generation = 2
    carried.boneShiqian = 1
    ck.that(pickShiqianCarried(carried), "第 2 代 + 事签骨片 → 传下了")
    let after = runAfterPickGen(carried, ["shui", "ri"])
    ck.that(after.generation == 2 && after.phase == RUN_PHASE_HOME, "runAfterPickGen 照常进主界")
    ck.that(after.boxChars.size == 3 && after.boxChars[0] == BOX_SHIQIAN_ID &&
        after.boxChars[1] == "shui" && after.boxChars[2] == "ri", "字匣 = [事签, 挑的字]（got ${after.boxChars.size}）")
    ck.that(after.boxLanded.size == 3 && !after.boxLanded[0], "事签格也算一格、本代未落")
    ck.that(boxSlotState(after, BOX_SLOT_NONE, 0) == BOX_SLOT_SHIQIAN, "字匣第 0 格是事签")
    ck.that(landedChars(after).size == 0, "事签格不算「留下的字」")
    after.boxLanded = [false, true, false]
    ck.that(landedChars(after).size == 1 && landedChars(after)[0] == "shui", "事签旁边那格落了才算数")
    /* 没传事签：字匣就是挑的那两个 */
    let plain = runAfterPickGen(noSign, ["shui", "ri"])
    ck.that(plain.boxChars.size == 2 && plain.boxChars[0] == "shui" && plain.boxChars[1] == "ri",
        "没传事签 → 字匣就是挑的那两个")
    /* 第 1 代：runAfterPickGen 与 runAfterPick 一模一样 */
    let g1 = newRunState()
    ck.that(runAfterPickGen(g1, ["shui", "ri", "ren"]).sameAs(runAfterPick(g1, ["shui", "ri", "ren"])),
        "第 1 代 runAfterPickGen ≡ runAfterPick")
    ck.that(runAfterPickGen(g1, []).sameAs(runAfterPick(g1, [])), "第 1 代一个字没挑也等价")
    ck.that(carried.boxChars.size == 0 && carried.phase == RUN_PHASE_PICK, "runAfterPickGen 不改原状态")
    ck.done("pick-shiqian")
    return ck.failures.size
}

/* ————— M2 事件卡 / 选卡 / 结局（game_rules.cj）————— */

/* Option<EventOption> 是不是空（落字那一选项没有时用）。 */
func optIsNone(o: Option<EventOption>): Bool {
    match (o) {
        case Some(_) => return false
        case None => return true
    }
}

/* 结局标题（没有结局 → 空串）。 */
func endingTitleOf(s: RunState): String {
    match (endingOfState(s)) {
        case Some(info) => return info.title
        case None => return ""
    }
}

/* 一个状态的结局是不是善终。 */
func endingIsGood(s: RunState): Bool {
    match (endingOfState(s)) {
        case Some(info) => return info.good
        case None => return false
    }
}

/* 找一张对第 d 维增减 ≤0 的 side（测「见底」用：见底那一维不能再往上加）。 */
func sideForBottom(d: Int64): Int64 {
    let pool = eventCardPool()
    var i: Int64 = 0
    while (i < pool.size) {
        let c = pool[i]
        if (c.left.deltaAt(d) <= 0) { return RUN_SIDE_LEFT }
        if (c.right.deltaAt(d) <= 0) { return RUN_SIDE_RIGHT }
        i = i + 1
    }
    return RUN_SIDE_LEFT
}

/* 找一张对第 d 维增减 ≥0 的 side（测「溢出」用：满的那一维不能再往下减）。 */
func sideForTop(d: Int64): Int64 {
    let pool = eventCardPool()
    var i: Int64 = 0
    while (i < pool.size) {
        let c = pool[i]
        if (c.left.deltaAt(d) >= 0) { return RUN_SIDE_LEFT }
        if (c.right.deltaAt(d) >= 0) { return RUN_SIDE_RIGHT }
        i = i + 1
    }
    return RUN_SIDE_LEFT
}

/* 一张开局后（挑过字）的状态，四维给的值。 */
func runWithDims(v0: Int64, v1: Int64, v2: Int64, v3: Int64): RunState {
    let s = runAfterPick(newRunState(), ["shui", "ri", "ren"])
    s.dims = [v0, v1, v2, v3]
    return s
}

func gameRulesShape(): Int64 {
    println("== M2 事件卡 / applyChoice / 结局：牌堆 / 分量 / 年数 / 八败一善 ==")
    let ck = Check()

    /* —— 牌堆 —— */
    let pool = eventCardPool()
    ck.that(pool.size >= 10, "牌堆 ≥10 张（got ${pool.size}）")
    ck.that(eventCardCount() == pool.size, "eventCardCount = 牌堆大小（got ${eventCardCount()}）")
    ck.that(eventCardAt(0).id == pool[0].id, "eventCardAt(0) = 第一张")
    ck.that(eventCardAt(-1).id == pool[0].id, "eventCardAt 负下标归到第一张")
    ck.that(eventCardAt(pool.size).id == pool[pool.size - 1].id, "eventCardAt 越界归到最后一张")
    ck.that(eventCardNext(pool.size - 1) == 0, "最后一张的下一张回到第 0 张（牌堆循环）")
    ck.that(eventCardNext(0) == 1, "第 0 张的下一张是第 1 张")
    ck.that(eventCardNext(-1) == 0, "eventCardNext 负下标归零")
    /* id 不重复 */
    var dup: Int64 = 0
    var i: Int64 = 0
    while (i < pool.size) {
        var j: Int64 = i + 1
        while (j < pool.size) {
            if (pool[i].id == pool[j].id) { dup = dup + 1 }
            j = j + 1
        }
        i = i + 1
    }
    ck.that(dup == 0, "卡 id 不重复")
    /* 每张卡的形状：who / season / body 非空，body ≤40 字，左右各 4 个增减 */
    var luoziCards: Int64 = 0
    i = 0
    while (i < pool.size) {
        let c = pool[i]
        ck.that(c.who.size > 0, "${c.id} 有人物胶囊")
        ck.that(c.season.size > 0, "${c.id} 有季节")
        ck.that(utf8Len(c.body) <= 40, "${c.id} 卡文 ≤40 字（got ${utf8Len(c.body)}）")
        ck.that(c.left.label.size > 0, "${c.id} 左选项有文案")
        ck.that(c.right.label.size > 0, "${c.id} 右选项有文案")
        ck.that(c.left.deltas.size == 4, "${c.id} 左选项 4 个增减（got ${c.left.deltas.size}）")
        ck.that(c.right.deltas.size == 4, "${c.id} 右选项 4 个增减（got ${c.right.deltas.size}）")
        ck.that(!optIsNone(c.optionOf(RUN_SIDE_LEFT)), "${c.id} 左选项取得到")
        ck.that(!optIsNone(c.optionOf(RUN_SIDE_RIGHT)), "${c.id} 右选项取得到")
        ck.that(c.left.deltaAt(-1) == 0 && c.left.deltaAt(9) == 0, "${c.id} deltaAt 越界当 0")
        if (c.allowsLuozi) {
            luoziCards = luoziCards + 1
            ck.that(c.luozi.label.size > 0, "${c.id} 落字选项有文案")
            ck.that(c.luozi.deltas.size == 4, "${c.id} 落字 4 个增减（got ${c.luozi.deltas.size}）")
            ck.that(!optIsNone(c.optionOf(RUN_SIDE_LUOZI)), "${c.id} 落字是第三选项")
        } else {
            ck.that(optIsNone(c.optionOf(RUN_SIDE_LUOZI)), "${c.id} 不允许落字 → 没有第三选项")
        }
        /* 一张两边都不动的卡是死卡 */
        var moved: Int64 = 0
        var d: Int64 = 0
        while (d < RUN_DIM_COUNT) {
            if (c.left.deltaAt(d) != 0 || c.right.deltaAt(d) != 0) { moved = moved + 1 }
            d = d + 1
        }
        ck.that(moved > 0, "${c.id} 至少有一维在动")
        i = i + 1
    }
    ck.that(luoziCards >= 1, "至少有卡能落字（got ${luoziCards}）")
    ck.that(pool[0].seasonLabel(0, 10) == "春 · 1 / 10", "卡面右上「季节 · 序号」（got ${pool[0].seasonLabel(0, 10)}）")
    ck.that(pool[3].seasonLabel(9, 10) == "夏 · 10 / 10", "最后一张的序号（got ${pool[3].seasonLabel(9, 10)}）")

    /* —— 按住看分量：三档 5 / 8 / 12，没有增减不画点 —— */
    ck.that(weightTier(0) == RUN_WEIGHT_NONE, "0 → 不画点（got ${weightTier(0)}）")
    ck.that(weightTier(1) == RUN_WEIGHT_SMALL, "±1 → 小点 5")
    ck.that(weightTier(5) == RUN_WEIGHT_SMALL, "±5 → 小点 5（got ${weightTier(5)}）")
    ck.that(weightTier(-5) == RUN_WEIGHT_SMALL, "−5 → 小点 5（不分涨跌）")
    ck.that(weightTier(6) == RUN_WEIGHT_MID, "±6 → 中点 8（got ${weightTier(6)}）")
    ck.that(weightTier(10) == RUN_WEIGHT_MID, "±10 → 中点 8")
    ck.that(weightTier(-10) == RUN_WEIGHT_MID, "−10 → 中点 8")
    ck.that(weightTier(11) == RUN_WEIGHT_LARGE, "±11 → 大点 12（got ${weightTier(11)}）")
    ck.that(weightTier(-99) == RUN_WEIGHT_LARGE, "−99 → 大点 12")
    ck.that(weightTier(100) == RUN_WEIGHT_LARGE, "±100 → 大点 12")
    let tiers = weightTiersOf([0, 3, 9, 40])
    ck.that(tiers.size == 4, "一排 4 个圆点（got ${tiers.size}）")
    ck.that(runSameInts(tiers, [0, 5, 8, 12]), "圆点档位 0/5/8/12（got ${tiers[0]},${tiers[1]},${tiers[2]},${tiers[3]}）")
    ck.that(weightTierOf(pool[0].left, 0) == RUN_WEIGHT_MID, "第一张左选项粮维中点 10 → 8（got ${weightTierOf(pool[0].left, 0)}）")
    ck.that(weightTierOf(pool[8].left, 0) == RUN_WEIGHT_LARGE, "第九张左选项粮维 +12 → 大点")
    ck.that(weightTierOf(pool[0].left, 2) == RUN_WEIGHT_NONE, "第一张左选项记维不画点")

    /* —— 危险区 / 触底溢出 —— */
    ck.that(dimInDanger(0), "0 在危险区")
    ck.that(dimInDanger(RUN_DANGER_LOW), "15 在危险区（含）")
    ck.that(dimInDanger(RUN_DANGER_HIGH), "85 在危险区（含）")
    ck.that(dimInDanger(100), "100 在危险区")
    ck.that(!dimInDanger(16), "16 不在危险区")
    ck.that(!dimInDanger(84), "84 不在危险区")
    ck.that(!dimInDanger(50), "50 不在危险区")
    ck.that(dimEnds(0) == RUN_END_BOTTOM, "0 → 见底")
    ck.that(dimEnds(-5) == RUN_END_BOTTOM, "负数 → 见底")
    ck.that(dimEnds(RUN_DIM_MAX) == RUN_END_TOP, "100 → 溢出")
    ck.that(dimEnds(101) == RUN_END_TOP, "101 → 溢出")
    ck.that(dimEnds(1) == RUN_END_NONE, "1 → 没事")
    ck.that(dimEnds(99) == RUN_END_NONE, "99 → 没事")
    ck.that(runClampDim(-7) == 0, "runClampDim 下限")
    ck.that(runClampDim(120) == RUN_DIM_MAX, "runClampDim 上限（got ${runClampDim(120)}）")
    ck.that(runClampDim(37) == 37, "runClampDim 界内不动")

    /* —— 骨片行 5 位怎么排 —— */
    ck.that(bonePipKinds(2, 0).size == RUN_BONE_CAP, "骨片 5 位（got ${bonePipKinds(2, 0).size}）")
    ck.that(bonePipKinds(2, 0)[0] == BONE_PIP_EMPTY, "空骨片排前面")
    ck.that(bonePipKinds(2, 0)[4] == BONE_PIP_CAP, "剩下的都是上限空位")
    ck.that(bonePipKinds(0, 3)[0] == BONE_PIP_SHIQIAN, "没有空骨片时事签排前面")
    ck.that(bonePipKinds(0, 3)[3] == BONE_PIP_CAP, "事签后面补空位")
    ck.that(bonePipKinds(2, 1)[2] == BONE_PIP_SHIQIAN, "2 空骨片 + 1 事签 + 2 空位")
    ck.that(bonePipKinds(9, 9).size == RUN_BONE_CAP, "超上限也只出 5 位")
    ck.that(bonePipKinds(-1, -1)[0] == BONE_PIP_CAP, "负数当 0（全空位）")

    /* —— 选一张卡：增减 / 计数 / 牌堆前进一步 —— */
    let base = runAfterPick(newRunState(), ["shui", "ri", "ren"])
    let afterL = applyChoice(base, RUN_SIDE_LEFT)
    ck.that(afterL.dims[0] == 60, "左选项 粮 +10 → 60（got ${afterL.dims[0]}）")
    ck.that(afterL.dims[1] == 46, "左选项 信 −4 → 46（got ${afterL.dims[1]}）")
    ck.that(afterL.dims[2] == 50 && afterL.dims[3] == 50, "没动的维不动")
    ck.that(afterL.cardsSeen == 1, "cardsSeen +1（got ${afterL.cardsSeen}）")
    ck.that(afterL.cardIndex == 1, "牌堆前进一步（got ${afterL.cardIndex}）")
    ck.that(afterL.year == 1 && afterL.yearsLeft == 12, "3 张卡才过一年")
    ck.that(afterL.phase == RUN_PHASE_HOME, "没触底还是主界")
    ck.that(base.dims[0] == 50 && base.cardsSeen == 0, "applyChoice 不改原状态")
    let afterR = applyChoice(base, RUN_SIDE_RIGHT)
    ck.that(afterR.dims[0] == 46 && afterR.dims[1] == 58, "右选项 −4/+8（got ${afterR.dims[0]},${afterR.dims[1]}）")

    /* 落字第三选项：允许的卡照算，不允许的卡这一下不算选过 */
    let lz = runAfterPick(newRunState(), ["shui"])
    let lz2 = applyChoice(lz, RUN_SIDE_LUOZI)
    ck.that(lz2.cardsSeen == 1 && lz2.cardIndex == 1, "落字也算选过一次")
    ck.that(lz2.dims[0] == 56 && lz2.dims[1] == 56, "落字增减照算（got ${lz2.dims[0]},${lz2.dims[1]}）")
    /* 牌堆第 2 张（lie_hu）不允许落字 → 这一下不算选过，原样返回 */
    let noLz = runAfterPick(newRunState(), ["shui"])
    noLz.cardIndex = 1
    let noLz2 = applyChoice(noLz, RUN_SIDE_LUOZI)
    ck.that(noLz2.sameAs(noLz) && noLz2.cardsSeen == 0, "这一张不允许落字 → 原样返回")
    let noSide = applyChoice(lz, 9)
    ck.that(noSide.sameAs(lz), "不认识的 side → 原样返回")

    /* 钳制：上限 100、下限 0 */
    let hi = runWithDims(95, 60, 60, 60)
    let hi2 = applyChoice(hi, RUN_SIDE_LEFT)
    ck.that(hi2.dims[0] == RUN_DIM_MAX, "上限钳到 100（got ${hi2.dims[0]}）")
    let lo = runWithDims(3, 60, 60, 60)
    let lo2 = applyChoice(lo, RUN_SIDE_RIGHT)
    ck.that(lo2.dims[0] == 0, "下限钳到 0（got ${lo2.dims[0]}）")
    let over = runWithDims(60, 60, 60, 60)
    over.dims = [60, 60, 60, 200]
    let over2 = applyChoice(over, RUN_SIDE_LEFT)
    ck.that(over2.dims[3] == RUN_DIM_MAX, "离谱的入参也钳回 100（got ${over2.dims[3]}）")

    /* 3 张卡 = 1 年 */
    var yr = runAfterPick(newRunState(), ["shui"])
    yr.yearsLeft = 12
    var n: Int64 = 0
    while (n < 3) {
        yr.dims = [50, 50, 50, 50]
        yr = applyChoice(yr, RUN_SIDE_RIGHT)
        n = n + 1
    }
    ck.that(yr.cardsSeen == 3, "看了 3 张（got ${yr.cardsSeen}）")
    ck.that(yr.year == 2, "进到第 2 年（got ${yr.year}）")
    ck.that(yr.yearsLeft == 11, "余年 −1（got ${yr.yearsLeft}）")
    ck.that(yr.phase == RUN_PHASE_HOME, "这才 3 张，不结局")

    /* 牌堆循环：走完一整轮回到第 0 张 */
    var cyc = runAfterPick(newRunState(), ["shui"])
    cyc.yearsLeft = 99
    var k: Int64 = 0
    while (k < pool.size) {
        cyc.dims = [50, 50, 50, 50]
        cyc = applyChoice(cyc, RUN_SIDE_LEFT)
        k = k + 1
    }
    ck.that(cyc.cardIndex == 0, "走完一整轮牌堆回到第 0 张（got ${cyc.cardIndex}）")
    ck.that(cyc.cardsSeen == pool.size, "cardsSeen 累计（got ${cyc.cardsSeen}）")
    ck.that(cyc.year == 1 + pool.size / RUN_CARDS_PER_YEAR, "年数按 3 张一年走（got ${cyc.year}）")

    /* 结局表：每一维的见底 / 溢出 */
    let bottomIds = ["jinian", "shisi", "jiushui", "binghuo"]
    let bottomTitles = ["饥年", "失祀", "旧水重来", "兵祸"]
    let topIds = ["cangman", "fenggu", "suyuan", "bingzu"]
    let topTitles = ["仓满招寇", "封骨", "宿怨", "并族"]
    var d: Int64 = 0
    while (d < RUN_DIM_COUNT) {
        /* 见底 */
        let b = runWithDims(50, 50, 50, 50)
        b.dims[d] = 0
        let be = applyChoice(b, sideForBottom(d))
        ck.that(be.phase == RUN_PHASE_ENDING, "第 ${d} 维见底 → 进结局")
        ck.that(be.endingDim == d, "第 ${d} 维见底 endingDim（got ${be.endingDim}）")
        ck.that(be.endingKind == RUN_KIND_BOTTOM, "第 ${d} 维见底 kind（got ${be.endingKind}）")
        ck.that(be.endingId == bottomIds[d], "第 ${d} 维见底 id ${bottomIds[d]}（got ${be.endingId}）")
        ck.that(endingTitleOf(be) == bottomTitles[d], "第 ${d} 维见底标题 ${bottomTitles[d]}（got ${endingTitleOf(be)}）")
        ck.that(!endingIsGood(be), "第 ${d} 维见底不是善终")
        /* 溢出 */
        let t = runWithDims(50, 50, 50, 50)
        t.dims[d] = RUN_DIM_MAX
        let te = applyChoice(t, sideForTop(d))
        ck.that(te.phase == RUN_PHASE_ENDING, "第 ${d} 维溢出 → 进结局")
        ck.that(te.endingDim == d, "第 ${d} 维溢出 endingDim（got ${te.endingDim}）")
        ck.that(te.endingKind == RUN_KIND_TOP, "第 ${d} 维溢出 kind（got ${te.endingKind}）")
        ck.that(te.endingId == topIds[d], "第 ${d} 维溢出 id ${topIds[d]}（got ${te.endingId}）")
        ck.that(endingTitleOf(te) == topTitles[d], "第 ${d} 维溢出标题 ${topTitles[d]}（got ${endingTitleOf(te)}）")
        /* 见底优先于溢出之外没有任何歧义：结局信息与 endingOf 一致 */
        let info = endingOf(d, RUN_END_BOTTOM)
        ck.that(info.id == bottomIds[d] && info.title == bottomTitles[d], "endingOf(${d}, 见底) 表一致")
        let infoT = endingOf(d, RUN_END_TOP)
        ck.that(infoT.id == topIds[d] && infoT.title == topTitles[d], "endingOf(${d}, 溢出) 表一致")
        d = d + 1
    }
    /* 活着的状态没有结局 */
    ck.that(endingTitleOf(base) == "", "活着 → 没有结局标题")
    ck.that(!endingIsGood(base), "活着 → 不是善终")

    /* 余年走完 → 善终 寿终传笔 */
    let good = endingGood()
    ck.that(good.id == "shouzhong" && good.title == "寿终传笔", "善终 id / 标题（got ${good.id}/${good.title}）")
    ck.that(good.good && good.kind == RUN_KIND_GOOD, "善终标记 / kind（got ${good.good}/${good.kind}）")
    ck.that(good.dim == -1, "善终没有原因维")
    let g = runAfterPick(newRunState(), ["shui"])
    g.yearsLeft = 1
    g.cardsSeen = 2
    let g2 = applyChoice(g, RUN_SIDE_LEFT)
    ck.that(g2.yearsLeft == 0, "余年归零（got ${g2.yearsLeft}）")
    ck.that(g2.phase == RUN_PHASE_ENDING, "余年归零 → 进结局")
    ck.that(g2.endingId == "shouzhong", "余年归零 → 寿终传笔（got ${g2.endingId}）")
    ck.that(g2.endingKind == RUN_KIND_GOOD && g2.endingDim == -1, "善终 kind / dim")
    ck.that(endingIsGood(g2), "这一局算善终")
    /* 四维触底比余年归零更硬：同一张卡两个都中时按见底记 */
    let both = runAfterPick(newRunState(), ["shui"])
    both.yearsLeft = 1
    both.cardsSeen = 2
    both.dims = [50, 0, 50, 50]
    let both2 = applyChoice(both, sideForBottom(1))
    ck.that(both2.endingId == "shisi", "两个都中时按四维记（got ${both2.endingId}）")

    /* 结局状态照样能存档往返（字段没加，格式还是 17 段） */
    ck.that(RUN_FIELD_COUNT == 17, "存档字段数没变（got ${RUN_FIELD_COUNT}）")
    ck.that(RUN_SAVE_VERSION == 1, "存档版本没变（got ${RUN_SAVE_VERSION}）")
    let raw = serializeRunState(lo2)
    ck.that(raw.split("|").size == RUN_FIELD_COUNT, "结局存档还是 17 段（got ${raw.split("|").size}）")
    match (parseRunState(raw)) {
        case Some(back) =>
            ck.that(back.sameAs(lo2), "选过卡、进了结局的状态照样往返")
            ck.that(back.endingId == lo2.endingId && back.endingKind == lo2.endingKind, "往返 结局字段")
            ck.that(back.dims[0] == lo2.dims[0] && back.dims[3] == lo2.dims[3], "往返 四维")
            ck.that(back.cardIndex == lo2.cardIndex && back.cardsSeen == lo2.cardsSeen, "往返 牌堆")
        case None => ck.that(false, "结局存档往返 parse 失败")
    }
    /* 主界中段的存档也照样往返 */
    match (parseRunState(serializeRunState(afterL))) {
        case Some(back2) => ck.that(back2.sameAs(afterL), "主界中段的存档往返")
        case None => ck.that(false, "主界存档往返 parse 失败")
    }
    ck.done("game-rules")
    return ck.failures.size
}

/* ————— M2 字匣（game_rules.cj：五种格子状态 / 落字第三选项）————— */

/* 一张开局后（挑过 3 个字）的状态。 */
func boxRun(): RunState {
    return runAfterPick(newRunState(), ["shui", "ri", "ren"])
}

/* 字匣规则：格子状态 / canLuozi / applyLuozi / 落完不能落第二次。 */
func boxRulesShape(): Int64 {
    println("== M2 字匣：五种格子状态 / 可落判定 / 落字 / 存档往返 ==")
    let ck = Check()
    let pool = eventCardPool()

    /* —— 格子状态：可落 / 选中 / 本代已落 / 事签 / 空 —— */
    let s = boxRun()
    ck.that(s.boxChars.size == 3, "开局挑了 3 个字（got ${s.boxChars.size}）")
    ck.that(boxSlotState(s, BOX_SLOT_NONE, 0) == BOX_SLOT_OK, "没选中 → 可落")
    ck.that(boxSlotState(s, BOX_SLOT_NONE, 1) == BOX_SLOT_OK, "第 2 格也可落")
    ck.that(boxSlotState(s, BOX_SLOT_NONE, 2) == BOX_SLOT_OK, "第 3 格也可落")
    /* 选中是界面状态：只按 selectedSlot 变，不进存档 */
    ck.that(boxSlotState(s, 1, 0) == BOX_SLOT_OK, "选中别格时这一格还是可落")
    ck.that(boxSlotState(s, 1, 1) == BOX_SLOT_SELECTED, "选中的那一格 → 选中")
    ck.that(boxSlotState(s, 2, 2) == BOX_SLOT_SELECTED, "选第 3 格 → 选中")
    /* 已落压过选中：落过的格再怎么点也是已落 */
    s.boxLanded = [false, true, false]
    ck.that(boxSlotState(s, 1, 1) == BOX_SLOT_LANDED, "落过的格 → 本代已落（压过选中）")
    ck.that(boxSlotState(s, 1, 0) == BOX_SLOT_OK, "旁边没落的格照旧可落")
    ck.that(boxSlotState(s, BOX_SLOT_NONE, 2) == BOX_SLOT_OK, "没选中时第 3 格可落")
    /* 事签占一格（stub：现在还没有代码往字匣里写这个 id） */
    let sq = boxRun()
    sq.boxChars = ["shiqian", "ri", "ren"]
    ck.that(boxSlotState(sq, BOX_SLOT_NONE, 0) == BOX_SLOT_SHIQIAN, "事签格 → 事签")
    ck.that(boxSlotState(sq, 0, 0) == BOX_SLOT_SHIQIAN, "事签格点了也不变选中")
    ck.that(boxSlotIsShiqianId(BOX_SHIQIAN_ID), "事签占位 id 认得出")
    ck.that(!boxSlotIsShiqianId("shui"), "普通的字不是事签占位")
    ck.that(boxSlotState(sq, BOX_SLOT_NONE, 1) == BOX_SLOT_OK, "事签旁边那格照旧可落")
    /* 空格：本代带的字不足 3 个才出现（SPEC §3） */
    let two = runAfterPick(newRunState(), ["shui", "ri"])
    ck.that(boxSlotState(two, BOX_SLOT_NONE, 1) == BOX_SLOT_OK, "带了 2 个字，前两格有字")
    ck.that(boxSlotState(two, BOX_SLOT_NONE, 2) == BOX_SLOT_EMPTY, "第 3 格空着 → 空")
    ck.that(boxSlotState(two, 2, 2) == BOX_SLOT_EMPTY, "空格点不出选中态")
    ck.that(boxSlotState(newRunState(), BOX_SLOT_NONE, 0) == BOX_SLOT_EMPTY, "一个字没带 → 空格")
    /* 越界一律当空格（界面不判空） */
    ck.that(boxSlotState(s, BOX_SLOT_NONE, -1) == BOX_SLOT_EMPTY, "负下标 → 空")
    ck.that(boxSlotState(s, BOX_SLOT_NONE, 3) == BOX_SLOT_EMPTY, "第 4 格（越界）→ 空")
    ck.that(boxSlotState(s, BOX_SLOT_NONE, 99) == BOX_SLOT_EMPTY, "大下标 → 空")
    /* 界面那条路（传数组）与读 RunState 那条路结果一致 */
    var i: Int64 = 0
    while (i < RUN_PICK_CAP + 2) {
        ck.that(boxSlotStateOf(s.boxChars, s.boxLanded, 1, i) == boxSlotState(s, 1, i),
            "数组版与 RunState 版一致（第 ${i} 格）")
        i = i + 1
    }
    /* 五种状态码互不重复 */
    ck.that(BOX_SLOT_OK == 0 && BOX_SLOT_SELECTED == 1 && BOX_SLOT_LANDED == 2 &&
        BOX_SLOT_SHIQIAN == 3 && BOX_SLOT_EMPTY == 4, "状态码 0..4")
    ck.that(BOX_SLOT_NONE == -1, "没有选中格 = -1")

    /* —— canLuozi —— */
    let ok = pool[0]   /* he_di：允许落字 */
    let no = pool[1]   /* lie_hu：不允许落字 */
    let base = boxRun()
    ck.that(canLuozi(base, ok, 0), "卡允许落字 + 选中可落的格 → 能落")
    ck.that(canLuozi(base, ok, 2), "选第 3 格也能落")
    ck.that(!canLuozi(base, ok, BOX_SLOT_NONE), "没选中 → 不能落")
    ck.that(!canLuozi(base, no, 0), "这一张不允许落字 → 不能落")
    ck.that(!canLuozi(base, no, BOX_SLOT_NONE), "不允许 + 没选中 → 不能落")
    ck.that(!canLuozi(base, ok, 3), "选中越界 → 不能落")
    ck.that(!canLuozi(base, ok, 99), "选中大下标 → 不能落")
    /* 空格不能落（本代只带了 2 个字） */
    ck.that(!canLuozi(two, ok, 2), "空格不能落")
    /* 事签格不能落 */
    ck.that(!canLuozi(sq, ok, 0), "事签格不能落")
    /* 已落的格不能落 */
    let landed = boxRun()
    landed.boxLanded = [false, true, false]
    ck.that(!canLuozi(landed, ok, 1), "本代已落的格不能再落")
    ck.that(canLuozi(landed, ok, 0), "同一次里没落的格照样能落")
    /* 数组版与 RunState 版一致（界面层走数组版） */
    ck.that(canLuoziOf(base.boxChars, base.boxLanded, ok.allowsLuozi, 0), "数组版 能落")
    ck.that(!canLuoziOf(base.boxChars, base.boxLanded, no.allowsLuozi, 0), "数组版 卡不允许 → 不能落")
    ck.that(!canLuoziOf(base.boxChars, base.boxLanded, ok.allowsLuozi, BOX_SLOT_NONE),
        "数组版 没选中 → 不能落")
    ck.that(!canLuoziOf(two.boxChars, two.boxLanded, ok.allowsLuozi, 2), "数组版 空格不能落")
    ck.that(canLuoziOf(landed.boxChars, landed.boxLanded, ok.allowsLuozi, 0), "数组版 已落旁格能落")
    ck.that(!canLuoziOf(landed.boxChars, landed.boxLanded, ok.allowsLuozi, 1), "数组版 已落格不能落")

    /* —— applyLuozi：标记已落 + 增减照算 + 牌堆前进 —— */
    let lz = applyLuozi(base, 1)
    ck.that(!lz.sameAs(base), "applyLuozi 返回新状态")
    ck.that(lz.boxLanded.size == 3, "landed 还是 3 个（got ${lz.boxLanded.size}）")
    ck.that(!lz.boxLanded[0] && lz.boxLanded[1] && !lz.boxLanded[2], "只有落的那一格标记已落")
    ck.that(!base.boxLanded[1], "原状态的 landed 不被改写（数组不能共享引用）")
    ck.that(lz.dims[0] == 56 && lz.dims[1] == 56, "落字增减照算（got ${lz.dims[0]},${lz.dims[1]}）")
    ck.that(lz.dims[2] == 50 && lz.dims[3] == 50, "没动的维不动")
    ck.that(lz.cardsSeen == 1 && lz.cardIndex == 1, "落字也算选过一次、牌堆前进")
    ck.that(lz.boxChars[1] == "ri", "落过的字还留在字匣里（这一代冬夜置灰）")
    /* 落不下去：原样返回，什么都不动 */
    let badCard = boxRun()
    badCard.cardIndex = 1   /* lie_hu 不允许落字 */
    let bad2 = applyLuozi(badCard, 0)
    ck.that(bad2.sameAs(badCard) && bad2.cardsSeen == 0, "这一张不允许落字 → 原样返回")
    ck.that(!bad2.boxLanded[0], "没落下就不标记已落")
    let noSel = applyLuozi(base, BOX_SLOT_NONE)
    ck.that(noSel.sameAs(base), "没选中 → 原样返回")
    let emptySlot = applyLuozi(two, 2)
    ck.that(emptySlot.sameAs(two), "空格 → 原样返回")
    let again = applyLuozi(lz, 1)
    ck.that(again.sameAs(lz), "落过的格再落一次 → 原样返回")
    ck.that(again.cardsSeen == lz.cardsSeen, "再落一次不算选过（cardsSeen 不动）")

    /* 一次会话里连落两格：两格都标记，其它格子照旧。
       第二下落在一张同样允许落字的卡上（第 3 张 wu_gu）。 */
    let nextCard = cloneRunState(lz)
    nextCard.cardIndex = 2
    let twice = applyLuozi(nextCard, 2)
    ck.that(twice.boxLanded[1] && twice.boxLanded[2] && !twice.boxLanded[0], "两格落过（got ${twice.boxLanded[0]},${twice.boxLanded[1]},${twice.boxLanded[2]}）")
    ck.that(twice.cardsSeen == 2 && twice.cardIndex == 3, "落两次 → 看了 2 张、牌堆前进（got ${twice.cardsSeen},${twice.cardIndex}）")
    ck.that(!nextCard.boxLanded[2], "原状态第 3 格还是没落")

    /* 落字也走同一套结局判定（这一张落「水」信 +6，95 → 溢出） */
    let over = boxRun()
    over.dims = [50, 95, 50, 50]
    let over2 = applyLuozi(over, 0)
    ck.that(over2.dims[1] == RUN_DIM_MAX, "信 95 + 6 钳到 100（got ${over2.dims[1]}）")
    ck.that(over2.phase == RUN_PHASE_ENDING, "落字也能把这一代送进结局")
    ck.that(over2.endingId == "fenggu", "信 溢出 → 封骨（got ${over2.endingId}）")
    ck.that(over2.boxLanded[0], "进了结局那一格照样标记已落")

    /* —— 存档往返：落过的字读档回来还是落过的 —— */
    ck.that(RUN_FIELD_COUNT == 17, "存档字段数没变（got ${RUN_FIELD_COUNT}）")
    let raw = serializeRunState(twice)
    ck.that(raw.split("|").size == RUN_FIELD_COUNT, "落过字的存档还是 17 段")
    match (parseRunState(raw)) {
        case Some(back) =>
            ck.that(back.sameAs(twice), "落过两格的状态照样往返")
            ck.that(back.boxLanded.size == 3 && back.boxLanded[1] && back.boxLanded[2],
                "往返 landed 标记不丢")
            ck.that(!back.boxLanded[0], "往返 没落过的那格还是没落")
            ck.that(back.boxChars[1] == "ri" && back.boxChars[2] == "ren", "往返 字匣还是那三个字")
        case None => ck.that(false, "落过字的存档往返 parse 失败")
    }
    /* 事签占位 id 也能往返（stub，先把格式走通） */
    let rawSq = serializeRunState(sq)
    match (parseRunState(rawSq)) {
        case Some(backSq) =>
            ck.that(boxSlotState(backSq, BOX_SLOT_NONE, 0) == BOX_SLOT_SHIQIAN, "事签格往返回来还是事签")
        case None => ck.that(false, "事签占位存档往返 parse 失败")
    }

    /* —— 文案：落字条 / 状态徽标 / 状态说明 —— */
    ck.that(homeLuoziLabel("水") == "落「水」字", "落字条文案 落「水」字（got ${homeLuoziLabel("水")}）")
    ck.that(homeLuoziLabel("") == HOME_LUOZI_NEED, "没有字 → 先在字匣选一个字")
    ck.that(HOME_LUOZI_NEED == "先在字匣选一个字", "文案 先在字匣选一个字")
    ck.that(HOME_LUOZI_ARMED == "再点一次确认落字", "文案 再点一次确认落字")
    ck.that(boxStateText(BOX_SLOT_OK) == BOX_STATE_OK && boxStateText(BOX_SLOT_SELECTED) == BOX_STATE_OK,
        "可落 / 选中 徽标都写 可落")
    ck.that(boxStateText(BOX_SLOT_LANDED) == BOX_STATE_LANDED, "已落徽标 本代已落")
    ck.that(boxStateText(BOX_SLOT_SHIQIAN) == BOX_STATE_SHIQIAN, "事签徽标 待刻")
    ck.that(boxStateText(BOX_SLOT_EMPTY).size == 0, "空格没有徽标")
    ck.that(boxStateHint(BOX_SLOT_OK).size > 0 && boxStateHint(BOX_SLOT_LANDED).size > 0,
        "可落 / 已落 各有一行说明")
    ck.that(boxStateHint(BOX_SLOT_EMPTY).size == 0, "空格没有说明")
    ck.that(HOME_BOX_TAG_LANDED == "已落", "已落小签 已落")
    ck.that(BOX_SHEET_LAND == "在卡上落字", "弹层按钮 在卡上落字")
    ck.that(BOX_SHEET_BACK == "‹", "弹层返回 ‹")
    ck.that(Theme.boxBarH == 104 && Theme.boxSlotCell == 48 && Theme.boxSlotGap == 12,
        "字匣条 104 / 格 48 / 间距 12")
    ck.that(Theme.boxSlotRadius == 12 && Theme.boxSlotFs == 26, "格 圆角 12 / 字 26")
    ck.that(Theme.boxTagH == 16 && Theme.boxTagFs == 10, "已落小签 16 高 / 10 号")
    ck.that(Theme.boxLandedOpacity == 0.38, "已落字 38% 透明")
    ck.that(Theme.sheetRadius == 20, "弹层上圆角 20")
    ck.that(Theme.scrimBlack45 == 0X73000000, "遮罩 45% 黑")
    ck.done("box-rules")
    return ck.failures.size
}

/* ————— M2 slice 4 代末结算（game_rules.cj / copy_text.cj）————— */

/* 一个「本代落过两个字」的状态（字匣 shui/ri/ren，落了前两格）。 */
func settleRun(): RunState {
    let s = runAfterPick(newRunState(), ["shui", "ri", "ren"])
    s.generation = 3
    s.boxLanded = [true, true, false]
    return s
}

/* 结局卡 / 代末结算：留下的字、家谱行、settleAndNextGeneration、调试开关。 */
func settleShape(): Int64 {
    println("== M2 结算：留下的字 / 家谱行 / 下一代 / 调试开关 ==")
    let ck = Check()

    /* —— 调试开关默认关（禁止带着 true 出包）—— */
    ck.that(!M2_DEBUG_FORCE_END, "M2_DEBUG_FORCE_END 默认 false（禁止带着 true 出包）")

    /* —— 留下的字 = 字匣里落过的那几格 —— */
    let s = settleRun()
    ck.that(landedChars(s).size == 2, "落下 2 个字（got ${landedChars(s).size}）")
    ck.that(landedChars(s)[0] == "shui" && landedChars(s)[1] == "ri", "留下的字按字匣顺序（got ${landedChars(s)[0]},${landedChars(s)[1]}）")
    ck.that(landedGlyphs(s).size == 2 && landedGlyphs(s)[0] == "水", "留下的字给字形（界面直接画）")
    let none = runAfterPick(newRunState(), ["shui", "ri"])
    ck.that(landedChars(none).size == 0, "一个字没落 → 空（界面写「未成字」）")
    let sq = runAfterPick(newRunState(), ["shiqian", "ri"])
    sq.boxLanded = [true, false]
    ck.that(landedChars(sq).size == 0, "事签格不算「留下的字」")

    /* —— debugForceDimZero：把某一维按到 0，再走正常判结局路径 —— */
    let home = runAfterPick(newRunState(), ["shui"])
    let dz = debugForceDimZero(home, 0)
    ck.that(dz.dims[0] == 0, "调试把粮按到 0（got ${dz.dims[0]}）")
    ck.that(dz.phase == RUN_PHASE_ENDING, "调试也进结局（phase 2）")
    ck.that(dz.endingId == "jinian", "粮 见底 → 饥年（got ${dz.endingId}）")
    ck.that(dz.endingDim == 0 && dz.endingKind == RUN_KIND_BOTTOM, "调试结局带原因维 / kind")
    ck.that(home.dims[0] == 50 && home.phase == RUN_PHASE_HOME, "debugForceDimZero 不改原状态")
    let dz2 = debugForceDimZero(home, 1)
    ck.that(dz2.endingId == "shisi" && dz2.endingDim == 1, "换一维就是另一个结局（got ${dz2.endingId}）")
    let dzBad = debugForceDimZero(home, 9)
    ck.that(dzBad.endingDim == 0, "认不出的维按「粮」算（got ${dzBad.endingDim}）")
    let dzNeg = debugForceDimZero(home, -3)
    ck.that(dzNeg.endingDim == 0, "负维按「粮」算（got ${dzNeg.endingDim}）")
    let dzTwice = debugForceDimZero(dz, 0)
    ck.that(dzTwice.sameAs(dz), "已经在结局里 → 原样返回")
    let dzSettle = debugForceDimZero(home, 0)
    dzSettle.phase = RUN_PHASE_SETTLE
    ck.that(debugForceDimZero(dzSettle, 0).sameAs(dzSettle), "结算页上 → 原样返回")
    /* 四维各按一遍：每一维的见底结局都对得上（溢出那一侧走 applyChoice，
       在 game-rules 里已经断言过，这里只验「按到 0」这一条调试路径）。 */
    var dd: Int64 = 0
    while (dd < RUN_DIM_COUNT) {
        let z = debugForceDimZero(home, dd)
        ck.that(z.dims[dd] == 0, "第 ${dd} 维被按到 0（got ${z.dims[dd]}）")
        ck.that(z.phase == RUN_PHASE_ENDING, "第 ${dd} 维按到 0 → 进结局")
        ck.that(z.endingDim == dd, "第 ${dd} 维 endingDim（got ${z.endingDim}）")
        ck.that(z.endingKind == RUN_KIND_BOTTOM, "第 ${dd} 维 kind 见底（got ${z.endingKind}）")
        dd = dd + 1
    }

    /* —— 家谱行：上一代 + 本代 —— */
    let withFam = settleRun()
    withFam.dims = [0, 50, 50, 50]
    withFam.phase = RUN_PHASE_ENDING
    withFam.endingId = "jinian"
    withFam.endingDim = 0
    withFam.endingKind = RUN_KIND_BOTTOM
    let prevChars: Array<String> = ["mu"]
    withFam.family = [FamilyEntry(1, "兵祸", false, prevChars), FamilyEntry(2, "寿终传笔", true, [])]
    let rows = familyRows(withFam)
    ck.that(rows.size == 3, "家谱行 = 上一代 2 条 + 本代（got ${rows.size}）")
    ck.that(rows[0].generation == 1 && rows[2].generation == 3, "最老在上、本代在最下")
    ck.that(rows[2].endingTitle == "饥年" && !rows[2].endingGood, "本代那行写这一代的结局")
    ck.that(rows[2].chars.size == 2 && rows[2].chars[0] == "shui", "本代那行带这一代留下的字")
    ck.that(familyEntryGlyphs(rows[2])[0] == "水", "家谱行的字给字形（24×24 那一排）")
    ck.that(familyIsThisGen(rows[2], 3) && !familyIsThisGen(rows[0], 3), "「新」角标只画本代那一行")
    ck.that(familyRowName(3) == "第 3 代记事人", "家谱行名称一律「第 N 代记事人」（got ${familyRowName(3)}）")
    ck.that(familyRows(newRunState()).size == 0, "没有结局也没有家谱 → 空列表")
    let alive = runAfterPick(newRunState(), ["shui"])
    alive.family = [FamilyEntry(1, "兵祸", false, prevChars)]
    ck.that(familyRows(alive).size == 1, "主界中段（没结局）只列存档里的家谱")

    /* —— settleAndNextGeneration —— */
    let next = settleAndNextGeneration(withFam)
    ck.that(next.generation == 4, "下一代 代次 +1（got ${next.generation}）")
    ck.that(next.phase == RUN_PHASE_PICK, "下一代 回开局挑字页（phase 0）")
    ck.that(next.family.size == 3, "家谱多一条（got ${next.family.size}）")
    ck.that(next.family[2].generation == 3, "新的一条是刚结束的这一代")
    ck.that(next.family[2].endingTitle == "饥年" && !next.family[2].endingGood, "新的一条记结局")
    ck.that(next.family[2].chars.size == 2 && next.family[2].chars[1] == "ri", "新的一条记留下的字")
    ck.that(next.family[0].generation == 1 && next.family[1].generation == 2, "老家谱原样留着")
    ck.that(next.dims[0] == 50 && next.dims[1] == 50 && next.dims[2] == 50 && next.dims[3] == 50,
        "下一代 四维归 50")
    ck.that(next.year == 1 && next.yearsLeft == 12, "下一代 年 / 余年 归位")
    ck.that(next.boneEmpty == 2 && next.boneShiqian == 0, "下一代 骨片归位")
    ck.that(next.boxChars.size == 0 && next.boxLanded.size == 0, "下一代 字匣清空")
    ck.that(next.cardIndex == 0 && next.cardsSeen == 0, "下一代 牌堆归零")
    ck.that(next.endingId == "" && next.endingDim == -1 && next.endingKind == "",
        "下一代 清掉上一代结局字段")
    ck.that(withFam.family.size == 2 && withFam.phase == RUN_PHASE_ENDING,
        "settleAndNextGeneration 不改原状态")
    /* 没有结局时原样返回（界面层靠这个拦住误点） */
    ck.that(settleAndNextGeneration(alive).sameAs(alive), "主界中段不能结算 → 原样返回")
    ck.that(settleAndNextGeneration(newRunState()).sameAs(newRunState()), "新开局不能结算 → 原样返回")
    /* 家谱连续三代：一代一代往下传，家谱一条条长 */
    var chain = newRunState()
    var g: Int64 = 0
    while (g < 3) {
        let st = runAfterPick(chain, ["shui"])
        st.boxLanded = [true]
        st.dims = [0, 50, 50, 50]
        st.phase = RUN_PHASE_ENDING
        st.endingId = "jinian"
        st.endingDim = 0
        st.endingKind = RUN_KIND_BOTTOM
        chain = settleAndNextGeneration(st)
        g = g + 1
    }
    ck.that(chain.generation == 4, "连传三代到第 4 代（got ${chain.generation}）")
    ck.that(chain.family.size == 3, "家谱 3 条（got ${chain.family.size}）")
    ck.that(chain.family[0].generation == 1 && chain.family[2].generation == 3, "家谱按代排")
    ck.that(familyRows(chain).size == 3, "第 4 代开局前家谱还是 3 行")

    /* 善终那一版：模板 B 只换色和文案，规则一模一样 */
    let good = runAfterPick(newRunState(), ["shui", "ri"])
    good.boxLanded = [true, false]
    good.generation = 2
    good.yearsLeft = 0
    good.phase = RUN_PHASE_ENDING
    good.endingId = "shouzhong"
    good.endingDim = -1
    good.endingKind = RUN_KIND_GOOD
    let goodEntry = familyEntryOf(good)
    match (goodEntry) {
        case Some(e) =>
            ck.that(e.generation == 2 && e.endingTitle == "寿终传笔" && e.endingGood, "善终家谱条")
            ck.that(e.chars.size == 1 && e.chars[0] == "shui", "善终家谱条记留下的字")
        case None => ck.that(false, "善终状态该有家谱条")
    }
    let goodNext = settleAndNextGeneration(good)
    ck.that(goodNext.generation == 3 && goodNext.family.size == 1, "善终也照样开下一代")
    ck.that(goodNext.family[0].endingGood, "家谱里这条记的是善终")
    /* 家谱条存档往返（2+ 代，含善终与失败、有字与没字） */
    let roundTrip = serializeRunState(goodNext)
    match (parseRunState(roundTrip)) {
        case Some(back) =>
            ck.that(back.sameAs(goodNext), "结算后的状态照样往返")
            ck.that(back.family.size == 1 && back.family[0].endingTitle == "寿终传笔", "往返 善终家谱条")
            ck.that(back.family[0].chars.size == 1 && back.family[0].chars[0] == "shui", "往返 家谱留下的字")
            ck.that(back.generation == 3 && back.phase == RUN_PHASE_PICK, "往返 代次 / phase")
        case None => ck.that(false, "结算后的状态往返 parse 失败")
    }
    /* phase 2 / 3 的存档也能往返（杀掉再进回原页） */
    match (parseRunState(serializeRunState(withFam))) {
        case Some(end) =>
            ck.that(end.phase == RUN_PHASE_ENDING && end.endingId == "jinian", "结局状态往返")
            ck.that(end.family.size == 2 && end.family[0].endingTitle == "兵祸", "结局状态往返 家谱")
            ck.that(familyRows(end).size == 3, "读档回来家谱行还是 3 行")
        case None => ck.that(false, "结局状态往返 parse 失败")
    }
    match (parseRunState(serializeRunState(next))) {
        case Some(st) =>
            ck.that(st.phase == RUN_PHASE_SETTLE || st.phase == RUN_PHASE_PICK, "结算后 phase 在界内")
            ck.that(st.family.size == 3, "结算后家谱 3 条往返不丢")
        case None => ck.that(false, "结算后状态往返 parse 失败")
    }

    /* —— 结局卡文案 —— */
    ck.that(endingLine("shisi").size > 0, "失祀 有结局话")
    ck.that(endingLine("shouzhong").size > 0, "寿终传笔 有结局话")
    ck.that(endingLine("不存在").size > 0, "认不出的结局 id 也给一句兜底（界面不空）")
    ck.that(endingWhyText(1, RUN_KIND_BOTTOM) == "信 见底", "原因胶囊 信 见底（got ${endingWhyText(1, RUN_KIND_BOTTOM)}）")
    ck.that(endingWhyText(0, RUN_KIND_TOP) == "粮 溢出", "原因胶囊 粮 溢出（got ${endingWhyText(0, RUN_KIND_TOP)}）")
    ck.that(endingWhyText(-1, RUN_KIND_GOOD) == END_WHY_GOOD, "善终原因胶囊（got ${endingWhyText(-1, RUN_KIND_GOOD)}）")
    ck.that(endingGenealogyText(6, "失祀") == "家谱记下：第 6 代，失祀",
        "家谱记下一行（got ${endingGenealogyText(6, "失祀")}）")
    ck.that(endingKeyText(6) == "第 6 代 · 结局", "结局卡小标（got ${endingKeyText(6)}）")
    ck.that(settleTitleText(4) == "第 4 代记事人放下了刻刀", "代末主标（got ${settleTitleText(4)}）")
    ck.that(settleKeepMeta(2) == "刻成 2 字", "「这一代留下」小字（got ${settleKeepMeta(2)}）")
    ck.that(END_CHARS_NONE == "未成字", "没成字写 未成字")
    ck.that(END_BTN_NEXT == "往下传" && SETTLE_BTN_NEXT == "下一代", "两个出口按钮")
    ck.that(SETTLE_KEY == "代末", "代末页小标 代末")
    ck.that(HOME_DEBUG_ZERO == "调试：粮归零", "调试按钮文案（got ${HOME_DEBUG_ZERO}）")

    /* —— 家谱面板（ui_genealogy.cj 的 GenealogyPanel）—— */
    ck.that(GENEALOGY_PANEL_KEY == "家谱", "家谱面板小标（got ${GENEALOGY_PANEL_KEY}）")
    ck.that(GENEALOGY_PANEL_TITLE == "历代记事人", "家谱面板标题（got ${GENEALOGY_PANEL_TITLE}）")
    ck.that(GENEALOGY_PANEL_NOTE.size > 10, "家谱面板那行小字在")
    ck.that(GENEALOGY_PANEL_CLOSE == "回去", "家谱面板关闭按钮（got ${GENEALOGY_PANEL_CLOSE}）")
    ck.that(END_BTN_GENEALOGY == SETTLE_BTN_GENEALOGY, "两处「看家谱」文案一致")
    ck.that(genealogyPanelRange(rows, 3) == "第 1 – 3 代",
        "家谱面板代次行（got ${genealogyPanelRange(rows, 3)}）")
    let noRows: Array<FamilyEntry> = []
    ck.that(genealogyPanelRange(noRows, 7) == "第 7 – 7 代", "家谱空 → 代次行退回本代")
    ck.done("settle")
    return ck.failures.size
}

/* ————— M2 烟测 R1/R2/R3：主界刷新镜子 / 拖卡决策 / 落字条状态机 ————— */

/* landed 位掩码：字匣三格「本代已落」↔ Int64（数组 @Prop 没验过，用原始值）。 */
func landedMaskShape(): Int64 {
    println("== R1 landed 位掩码：三格 ↔ Int64 位掩码 ==")
    let ck = Check()
    ck.that(runLandedMaskEncode([false, false, false]) == 0, "一个没落 → 0")
    ck.that(runLandedMaskEncode([true, false, false]) == 1, "只落第 1 格 → 1")
    ck.that(runLandedMaskEncode([false, true, false]) == 2, "只落第 2 格 → 2")
    ck.that(runLandedMaskEncode([false, false, true]) == 4, "只落第 3 格 → 4")
    ck.that(runLandedMaskEncode([true, true, true]) == 7, "三格全落 → 7")
    ck.that(runLandedMaskEncode([true, true, false]) == 3, "落前两格 → 3")
    ck.that(runLandedMaskEncode([]) == 0, "空字匣 → 0")
    /* 只认前 3 格（字匣上限 RUN_PICK_CAP），多出来的忽略 */
    ck.that(runLandedMaskEncode([true, true, true, true]) == 7, "第 4 格不编码")
    /* 掩码 → 逐格读回来，与编码前一致 */
    var cases: Array<Array<Bool>> = [[false, false, false], [true, false, false],
        [false, true, false], [false, false, true], [true, true, false], [true, false, true],
        [false, true, true], [true, true, true]]
    var c: Int64 = 0
    while (c < cases.size) {
        let mask = runLandedMaskEncode(cases[c])
        var i: Int64 = 0
        while (i < cases[c].size) {
            ck.that(runLandedAtMask(mask, i) == cases[c][i],
                "掩码 ${mask} 第 ${i} 格读回 ${cases[c][i]}")
            i = i + 1
        }
        c = c + 1
    }
    /* 越界一律没落（界面不判空） */
    ck.that(!runLandedAtMask(7, -1), "掩码 7 负下标 → 没落")
    ck.that(!runLandedAtMask(7, 3), "掩码 7 第 4 格 → 没落")
    ck.that(!runLandedAtMask(0, 0), "掩码 0 → 没落")
    ck.that(runLandedBit(0) == 1 && runLandedBit(1) == 2 && runLandedBit(2) == 4, "位权 1/2/4")
    ck.done("landed-mask")
    return ck.failures.size
}

/* R1：RunState → 主界那一组原始值（HomeMirror）。 */
func homeMirrorShape(): Int64 {
    println("== R1 主界刷新：RunState → 原始值镜子 ==")
    let ck = Check()
    /* 新开局（还没挑字）：镜子就是开局值，字匣 0 格 */
    let fresh = homeMirrorOf(newRunState())
    ck.that(fresh.generation == 1 && fresh.year == 1 && fresh.yearsLeft == 12, "开局 代/年/余年")
    ck.that(fresh.dim0 == 50 && fresh.dim1 == 50 && fresh.dim2 == 50 && fresh.dim3 == 50, "开局 四维 50")
    ck.that(fresh.boneEmpty == 2 && fresh.boneShiqian == 0, "开局 骨片")
    ck.that(fresh.cardIndex == 0, "开局 牌堆下标 0")
    ck.that(fresh.boxCount == 0, "开局 字匣 0 格")
    ck.that(fresh.box0 == "" && fresh.box1 == "" && fresh.box2 == "", "开局 三格都空")
    ck.that(fresh.landedMask == 0, "开局 一格都没落")

    /* 挑过 3 个字：三格有 id，都没有落 */
    let s = runAfterPick(newRunState(), ["shui", "ri", "ren"])
    let m = homeMirrorOf(s)
    ck.that(m.boxCount == 3, "挑了 3 个字 → 3 格（got ${m.boxCount}）")
    ck.that(m.box0 == "shui" && m.box1 == "ri" && m.box2 == "ren", "三格按挑选顺序")
    ck.that(m.landedMask == 0, "刚挑完一字未落")
    ck.that(homeMirrorBoxId(m, 0) == "shui" && homeMirrorBoxId(m, 2) == "ren", "按格取 id")
    ck.that(homeMirrorBoxId(m, -1) == "" && homeMirrorBoxId(m, 3) == "", "越界取 id → 空串")

    /* 只带 2 个字：第 3 格是空格，boxCount 说了算 */
    let two = homeMirrorOf(runAfterPick(newRunState(), ["shui", "ri"]))
    ck.that(two.boxCount == 2, "带 2 个字 → 2 格（got ${two.boxCount}）")
    ck.that(two.box2 == "", "第 3 格没有字")
    ck.that(homeMirrorBoxId(two, 2) == "", "只带了 2 个字时第 3 格取 id → 空串")
    ck.that(homeBoxSlotState(two, BOX_SLOT_NONE, 1) == BOX_SLOT_OK, "第 2 格可落")
    ck.that(homeBoxSlotState(two, BOX_SLOT_NONE, 2) == BOX_SLOT_EMPTY, "第 3 格空格")

    /* 选过卡之后：年份 / 四维 / 牌堆 / 余年全部跟上（R1 就是不刷新这些） */
    let played = applyChoice(s, RUN_SIDE_LEFT)
    let pm = homeMirrorOf(played)
    ck.that(pm.year == 1 && pm.yearsLeft == 12, "3 张卡才过一年")
    ck.that(pm.dim0 == 60 && pm.dim1 == 46, "四维跟上（got ${pm.dim0}/${pm.dim1}）")
    ck.that(pm.cardIndex == 1, "牌堆下标跟上（got ${pm.cardIndex}）")
    ck.that(!homeMirrorSame(m, pm), "选过卡镜子变了（R1 修的正是这个）")
    var three: RunState = played
    var n: Int64 = 0
    while (n < 2) {
        three = applyChoice(three, RUN_SIDE_LEFT)
        n = n + 1
    }
    let tm = homeMirrorOf(three)
    ck.that(tm.year == 2 && tm.yearsLeft == 11, "看满 3 张 → 第 2 年、余年 11（got ${tm.year}/${tm.yearsLeft}）")
    ck.that(tm.cardIndex == 3, "牌堆走到第 3 张（got ${tm.cardIndex}）")
    ck.that(homeMirrorSame(homeMirrorOf(three), tm), "同一个状态镜子是稳定的")

    /* 落过字：掩码那一位立起来，字匣格子状态跟着变 */
    let lz = applyLuozi(s, 1)
    let lm = homeMirrorOf(lz)
    ck.that(lm.landedMask == 2, "落了第 2 格 → 掩码 2（got ${lm.landedMask}）")
    ck.that(homeBoxSlotState(lm, BOX_SLOT_NONE, 1) == BOX_SLOT_LANDED, "第 2 格 本代已落")
    ck.that(homeBoxSlotState(lm, BOX_SLOT_NONE, 0) == BOX_SLOT_OK, "旁边没落的格照旧可落")
    ck.that(lm.boxCount == 3 && lm.box1 == "ri", "落过的字还留在字匣里")
    ck.that(lm.cardIndex == 1, "落字牌堆也前进（got ${lm.cardIndex}）")

    /* 镜子逐格状态与 game_rules 那条路（boxSlotState）完全一致 */
    var i: Int64 = 0
    while (i < RUN_PICK_CAP + 2) {
        ck.that(homeBoxSlotState(m, 1, i) == boxSlotState(s, 1, i), "镜子版与 RunState 版一致（第 ${i} 格）")
        ck.that(homeBoxSlotState(lm, 2, i) == boxSlotState(lz, 2, i), "落过后镜子版一致（第 ${i} 格）")
        i = i + 1
    }

    /* 事签占一格（stub）：镜子照样带得出事签态 */
    let sq = runAfterPick(newRunState(), ["shiqian", "ri"])
    let sqm = homeMirrorOf(sq)
    ck.that(homeBoxSlotState(sqm, BOX_SLOT_NONE, 0) == BOX_SLOT_SHIQIAN, "事签格 → 事签")
    ck.that(homeBoxSlotState(sqm, BOX_SLOT_NONE, 1) == BOX_SLOT_OK, "事签旁边可落")

    /* 选卡刷新之后 old/new 两个镜子逐字段都该不一样（界面靠这个换引用） */
    ck.that(homeMirrorSame(homeMirrorOf(newRunState()), fresh), "新开局镜子可重复")

    /* 事件卡高度跟可用高度走（lay_b0.json：357vp 那一档放不放得下落字条） */
    ck.that(Theme.cardUnderDrop == 8, "垫底那一条 8vp（got ${Theme.cardUnderDrop}）")
    ck.that(Theme.cardMinH == Theme.cardArtH + Theme.cardBodyPad + 3 * Theme.cardBodyLh +
        Theme.luoziBarH + 12, "cardMinH = 立绘区 + 卡文 3 行 + 内边距 + 落字条 + 12")
    ck.that(Theme.cardMinH == 340, "cardMinH 340（got ${Theme.cardMinH}）")
    ck.that(Theme.cardMinH <= Theme.cardH, "384 的卡高装得下 cardMinH（got ${Theme.cardMinH}）")
    ck.that(Theme.homeOptGapTop == 12 && Theme.homeOptGapTop > 0, "点选退路上边距 12 且为正")
    ck.that(cardFitsLuozi(357), "可用 357vp 放得下落字条（lay_b0.json 实测那一档）")
    ck.that(cardFitsLuozi(Theme.cardH + Theme.cardUnderDrop), "卡高 + 垫底那一条照样放得下")
    ck.that(!cardFitsLuozi(Theme.cardMinH), "再少 1vp 就放不下（下沿是含等于的）")
    ck.that(!cardFitsLuozi(Theme.cardMinH + Theme.cardUnderDrop - 1), "够不着 cardMinH → 放不下")
    ck.that(cardFitsLuozi(Theme.cardMinH + Theme.cardUnderDrop), "正好 cardMinH + 垫底 → 放得下")
    ck.done("home-mirror")
    return ck.failures.size
}

/* R2：拖卡决策（dx → 侧 / 钳位移 / 阈值）。 */
func dragShape(): Int64 {
    println("== R2 拖卡：位移 → 选侧 / 钳位 / 阈值 ==")
    let ck = Check()
    /* 侧：右正左负，0 算右边 */
    ck.that(dragSideOf(0.0) == RUN_SIDE_RIGHT, "dx 0 → 右边")
    ck.that(dragSideOf(1.0) == RUN_SIDE_RIGHT, "往右拖 → 右边")
    ck.that(dragSideOf(999.0) == RUN_SIDE_RIGHT, "拖很远也是右边")
    ck.that(dragSideOf(-0.5) == RUN_SIDE_LEFT, "往左拖 → 左边")
    ck.that(dragSideOf(-999.0) == RUN_SIDE_LEFT, "往左拖很远 → 左边")
    /* 位移钳到 ±Theme.swipeShift（14） */
    ck.that(dragClampShift(0.0, Theme.swipeShift) == 0, "没拖不动")
    ck.that(dragClampShift(7.0, Theme.swipeShift) == 7, "小位移原样")
    ck.that(dragClampShift(-7.0, Theme.swipeShift) == -7, "负小位移原样")
    ck.that(dragClampShift(14.0, Theme.swipeShift) == Theme.swipeShift, "正好到上限")
    ck.that(dragClampShift(80.0, Theme.swipeShift) == Theme.swipeShift, "超过上限钳住")
    ck.that(dragClampShift(-80.0, Theme.swipeShift) == -Theme.swipeShift, "负的也钳住")
    ck.that(dragClampShift(1000.0, 5) == 5, "换一个上限照钳")
    /* 阈值 ±Theme.swipeThreshold（60） */
    ck.that(!dragPastThreshold(0.0, Theme.swipeThreshold), "没拖不过阈值")
    ck.that(!dragPastThreshold(59.0, Theme.swipeThreshold), "差 1 不过阈值")
    ck.that(dragPastThreshold(60.0, Theme.swipeThreshold), "正好 60 过阈值（含）")
    ck.that(dragPastThreshold(61.0, Theme.swipeThreshold), "超过 60 过阈值")
    ck.that(!dragPastThreshold(-59.0, Theme.swipeThreshold), "负差 1 不过")
    ck.that(dragPastThreshold(-60.0, Theme.swipeThreshold), "负正好 60 过")
    ck.that(dragPastThreshold(-200.0, Theme.swipeThreshold), "负很远也过")
    /* 过阈值的那一下，侧别与位移方向一致（松手选中的就是这一侧） */
    ck.that(dragSideOf(80.0) == RUN_SIDE_RIGHT && dragPastThreshold(80.0, Theme.swipeThreshold),
        "往右拖过阈值 → 松手选右")
    ck.that(dragSideOf(-80.0) == RUN_SIDE_LEFT && dragPastThreshold(-80.0, Theme.swipeThreshold),
        "往左拖过阈值 → 松手选左")
    ck.that(Theme.swipeThreshold == 60 && Theme.swipeShift == 14, "SPEC §2.3 阈值 60 / 位移 14")
    ck.done("drag")
    return ck.failures.size
}

/* R3：卡底落字条状态机（原始值 → NEED / READY / ARMED + 文案）。 */
func luoziBarShape(): Int64 {
    println("== R3 落字条：没选中灰态 / 选中可落朱态 / 再点一次武装 ==")
    let ck = Check()
    let pool = eventCardPool()
    let ok = pool[0]   /* he_di：允许落字 */
    let no = pool[1]   /* lie_hu：不允许落字 */
    let s = runAfterPick(newRunState(), ["shui", "ri", "ren"])
    let m = homeMirrorOf(s)

    /* 没选中 → 灰态 */
    ck.that(luoziBarStateOf(m, ok.allowsLuozi, BOX_SLOT_NONE, BOX_SLOT_NONE, -1, 0) == LUOZI_BAR_NEED,
        "没选中 → 灰态")
    ck.that(!luoziBarEnabled(LUOZI_BAR_NEED), "灰态点了不动")
    ck.that(luoziBarLabelOf(LUOZI_BAR_NEED, "水") == HOME_LUOZI_NEED, "灰态文案 先在字匣选一个字")
    /* 选中一个可落的字 → 朱态，文案带字形 */
    ck.that(luoziBarStateOf(m, ok.allowsLuozi, 0, BOX_SLOT_NONE, -1, 0) == LUOZI_BAR_READY,
        "选中可落的字 → 朱态")
    ck.that(luoziBarEnabled(LUOZI_BAR_READY), "朱态可点")
    ck.that(luoziBarLabelOf(LUOZI_BAR_READY, "水") == "落「水」字", "朱态文案 落「水」字（got ${luoziBarLabelOf(LUOZI_BAR_READY, "水")}）")
    ck.that(luoziBarStateOf(m, ok.allowsLuozi, 2, BOX_SLOT_NONE, -1, 0) == LUOZI_BAR_READY,
        "选第 3 格也是朱态")
    /* 再点一次（武装记在这一个格子、这一张卡上）→ 武装态 */
    ck.that(luoziBarStateOf(m, ok.allowsLuozi, 1, 1, 0, 0) == LUOZI_BAR_ARMED, "同格同卡再点 → 武装态")
    ck.that(luoziBarEnabled(LUOZI_BAR_ARMED), "武装态照样可点（点了才真落）")
    ck.that(luoziBarLabelOf(LUOZI_BAR_ARMED, "日") == HOME_LUOZI_ARMED, "武装态文案 再点一次确认落字")
    /* 换了格子 / 换了卡就不算武装过 */
    ck.that(luoziBarStateOf(m, ok.allowsLuozi, 0, 1, 0, 0) == LUOZI_BAR_READY, "换了选中格 → 回到朱态")
    ck.that(luoziBarStateOf(m, ok.allowsLuozi, 1, 1, 3, 0) == LUOZI_BAR_READY, "换了卡 → 回到朱态")
    /* 卡不允许落字 → 灰态（界面整条隐藏） */
    ck.that(luoziBarStateOf(m, no.allowsLuozi, 0, 0, 0, 0) == LUOZI_BAR_NEED, "这一张不允许落字 → 灰态")
    ck.that(luoziBarStateOf(m, no.allowsLuozi, BOX_SLOT_NONE, BOX_SLOT_NONE, -1, 0) == LUOZI_BAR_NEED,
        "不允许 + 没选中 → 灰态")
    /* 空格 / 事签格 / 已落格 → 灰态 */
    let two = homeMirrorOf(runAfterPick(newRunState(), ["shui", "ri"]))
    ck.that(luoziBarStateOf(two, ok.allowsLuozi, 2, BOX_SLOT_NONE, -1, 0) == LUOZI_BAR_NEED, "空格 → 灰态")
    let sq = homeMirrorOf(runAfterPick(newRunState(), ["shiqian", "ri"]))
    ck.that(luoziBarStateOf(sq, ok.allowsLuozi, 0, 0, 0, 0) == LUOZI_BAR_NEED, "事签格 → 灰态")
    let lz = homeMirrorOf(applyLuozi(s, 1))
    ck.that(luoziBarStateOf(lz, ok.allowsLuozi, 1, 1, 1, 1) == LUOZI_BAR_NEED, "本代已落的格 → 灰态")
    ck.that(luoziBarStateOf(lz, ok.allowsLuozi, 0, BOX_SLOT_NONE, -1, 1) == LUOZI_BAR_READY,
        "已落旁边那格照样朱态")
    /* 落字条状态机与 game_rules 的 canLuozi 一致（朱态 ⟺ 落得下去） */
    ck.that(luoziBarEnabled(luoziBarStateOf(m, ok.allowsLuozi, 0, BOX_SLOT_NONE, -1, 0)) ==
        canLuozi(s, ok, 0), "朱态 ⟺ canLuozi（选中第 1 格）")
    ck.that(luoziBarEnabled(luoziBarStateOf(m, ok.allowsLuozi, BOX_SLOT_NONE, BOX_SLOT_NONE, -1, 0)) ==
        canLuozi(s, ok, BOX_SLOT_NONE), "灰态 ⟺ 落不下去（没选中）")
    ck.that(luoziBarEnabled(luoziBarStateOf(m, no.allowsLuozi, 0, BOX_SLOT_NONE, -1, 0)) ==
        canLuozi(s, no, 0), "灰态 ⟺ 落不下去（卡不允许）")
    /* 三种状态码互不重复 */
    ck.that(LUOZI_BAR_NEED != LUOZI_BAR_READY && LUOZI_BAR_READY != LUOZI_BAR_ARMED &&
        LUOZI_BAR_NEED != LUOZI_BAR_ARMED, "状态码 0/1/2 互不重复")
    ck.done("luozi-bar")
    return ck.failures.size
}

main(): Int64 {
    println("造字人 box check — 纯逻辑（无 kit/ohos 依赖）")
    println("")
    let bad = catalogShape() + benAndMo() + xiuStrip() + congStrip() +
        sizeBuckets() + cardTier() + emptyRule() + ziluShape() + copyShape() + tokenShape() +
        tabFilterShape() + ziluSeedShape() + runStateShape() + pickShiqianShape() +
        gameRulesShape() + boxRulesShape() +
        settleShape() + landedMaskShape() + homeMirrorShape() + dragShape() + luoziBarShape()
    println("")
    if (bad != 0) {
        println("HARNESS RESULT: FAIL (${bad} broken assertions)")
        return 1
    }
    println("HARNESS RESULT: PASS")
    return 0
}
