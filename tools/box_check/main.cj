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

main(): Int64 {
    println("造字人 box check — 纯逻辑（无 kit/ohos 依赖）")
    println("")
    let bad = catalogShape() + benAndMo() + xiuStrip() + congStrip() +
        sizeBuckets() + cardTier() + emptyRule() + ziluShape() + copyShape() + tokenShape() +
        tabFilterShape() + ziluSeedShape() + runStateShape() + gameRulesShape() + boxRulesShape()
    println("")
    if (bad != 0) {
        println("HARNESS RESULT: FAIL (${bad} broken assertions)")
        return 1
    }
    println("HARNESS RESULT: PASS")
    return 0
}
