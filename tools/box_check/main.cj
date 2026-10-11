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

main(): Int64 {
    println("造字人 box check — 纯逻辑（无 kit/ohos 依赖）")
    println("")
    let bad = catalogShape() + benAndMo() + xiuStrip() + congStrip() +
        sizeBuckets() + cardTier() + emptyRule() + ziluShape() + copyShape() + tokenShape() +
        tabFilterShape()
    println("")
    if (bad != 0) {
        println("HARNESS RESULT: FAIL (${bad} broken assertions)")
        return 1
    }
    println("HARNESS RESULT: PASS")
    return 0
}
