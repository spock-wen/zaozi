package ohos_app_cangjie_entry

import std.collection.ArrayList

/* 演变条（evo_strip_v1）纯逻辑模型。规则全部来自 SPEC §5：
   - 空格规则：没有字形的阶段不出格，后面的格依次前移；格子从左排，
     宽度不拉伸，右边空出来的地方什么都不放，不写「暂缺」之类的文字。
   - 繁简合并：繁简同形 → 一格「繁简同形」；不同 → 「繁体」「简体」两格，
     并换紧凑档 S。
   - 档位：卡面 C 格 48 间距 14（只显示阶段名）；标准 M 格 56 间距 6；
     紧凑 S 格 46 间距 5（6 格时用）。轨道宽 C 296 / M 304 / S 301。
   - 阶段名只用：甲骨文、金文、小篆、隶书、繁简同形、繁体、简体。
   - 时代行：商 / 商周 / 秦 / 秦简 / 西汉 / 东汉，最后一格不写。
   本文件不 import 任何 kit/ohos 模块，能在普通 Linux 上编译（tools/box_check）。 */

public enum EvoTier {
    | C
    | M
    | S
}

/* Old = 古字形（走 rawfile 资源）；Trad/Simp = 今天的字（繁体 / 简体）。 */
public enum EvoCellKind {
    | Old
    | Trad
    | Simp
}

public class EvoCell {
    public let kind: EvoCellKind
    /* Old：rawfile 资源路径（glyph/<id>_<stage>.<ext>）；Trad/Simp 为空。 */
    public let asset: String
    /* Trad/Simp：要显示的字（繁体格用 trad）。 */
    public let glyph: String
    public let name: String
    public let era: String
    public let baihua: Array<String>
    public let sourceLabel: String
    public let license: String
    /* 在轨道里的左偏移（格宽 + 间距 累加），从左排、不拉伸。 */
    public let x: Int64

    public init(
        kind: EvoCellKind,
        asset: String,
        glyph: String,
        name: String,
        era: String,
        baihua: Array<String>,
        sourceLabel: String,
        license: String,
        x: Int64
    ) {
        this.kind = kind
        this.asset = asset
        this.glyph = glyph
        this.name = name
        this.era = era
        this.baihua = baihua
        this.sourceLabel = sourceLabel
        this.license = license
        this.x = x
    }

    /* Cangjie 的 enum 没有默认的 == 运算符，统一走这几个谓词。 */
    public func isOld(): Bool {
        return this.kindIs(EvoCellKind.Old)
    }

    public func kindIs(k: EvoCellKind): Bool {
        match (this.kind) {
            case EvoCellKind.Old => match (k) { case EvoCellKind.Old => true; case _ => false }
            case EvoCellKind.Trad => match (k) { case EvoCellKind.Trad => true; case _ => false }
            case EvoCellKind.Simp => match (k) { case EvoCellKind.Simp => true; case _ => false }
        }
    }

    public func hasAsset(): Bool {
        return this.asset.size > 0
    }
}

public class EvoStrip {
    public let charId: String
    public let glyph: String
    public let trad: String
    public let method: String
    public let cells: ArrayList<EvoCell>
    public let tier: EvoTier
    public let cellSize: Int64
    public let gap: Int64
    /* 轨道宽（档位固定值：C 296 / M 304 / S 301）。 */
    public let trackWidth: Int64

    public init(
        charId: String,
        glyph: String,
        trad: String,
        method: String,
        cells: ArrayList<EvoCell>,
        tier: EvoTier,
        cellSize: Int64,
        gap: Int64,
        trackWidth: Int64
    ) {
        this.charId = charId
        this.glyph = glyph
        this.trad = trad
        this.method = method
        this.cells = cells
        this.tier = tier
        this.cellSize = cellSize
        this.gap = gap
        this.trackWidth = trackWidth
    }

    /* 格子实际占掉的宽度（≤ trackWidth；少几格右边就空几格）。 */
    public func usedWidth(): Int64 {
        if (this.cells.size == 0) {
            return 0
        }
        return this.cells.size * this.cellSize + (this.cells.size - 1) * this.gap
    }

    public func cellAt(index: Int64): EvoCell {
        return this.cells[index]
    }

    public func isTier(t: EvoTier): Bool {
        match (this.tier) {
            case EvoTier.C => match (t) { case EvoTier.C => true; case _ => false }
            case EvoTier.M => match (t) { case EvoTier.M => true; case _ => false }
            case EvoTier.S => match (t) { case EvoTier.S => true; case _ => false }
        }
    }
}

/* 档位 → (格子, 间距, 轨道宽)。 */
public func evoGeometry(tier: EvoTier): (Int64, Int64, Int64) {
    match (tier) {
        case EvoTier.C => return (Theme.evoCellC, Theme.evoGapC, Theme.evoTrackC)
        case EvoTier.M => return (Theme.evoCellM, Theme.evoGapM, Theme.evoTrackM)
        case EvoTier.S => return (Theme.evoCellS, Theme.evoGapS, Theme.evoTrackS)
    }
}

/* 「甲骨文 · 商」→ (甲骨文, 商)；没有「 · 」时时代为空。 */
public func splitStageLabel(label: String): (String, String) {
    let parts = label.split(" · ")
    if (parts.size >= 2) {
        return (parts[0], parts[1])
    }
    return (label, "")
}

/* 建一条演变条。tierOverride 传 Some(EvoTier.C) 就是造字卡卡面档；
   不传则按 SPEC：6 格（繁简不同）用紧凑档 S，否则标准档 M。 */
public func buildEvoStrip(charId: String, tierOverride: Option<EvoTier>): EvoStrip {
    let rows = GlyphCatalog.ofChar(charId)
    /* 字表里没有这个 id（切分页 / 换字那一瞬 charId 可能还是空串）时
       rows[0] 会越界把界面炸掉 → 返回一条空格子，由界面层 hasCells()
       判断整块不画（SPEC §5 空格规则：什么都没有就什么都不放）。 */
    if (rows.size == 0) {
        let (cell0, gap0, track0) = evoGeometry(EvoTier.M)
        return EvoStrip(charId, "", "", "", ArrayList<EvoCell>(), EvoTier.M, cell0, gap0, track0)
    }
    let first = rows[0]
    /* 繁简写法是否相同：trad == 简体 → 一格「繁简同形」。 */
    let sameForm = (first.trad == first.glyph)
    let tailCount: Int64 = if (sameForm) { 1 } else { 2 }
    let total = rows.size + tailCount

    var tier: EvoTier
    match (tierOverride) {
        case Some(t) => tier = t
        case None => tier = if (total >= 6) { EvoTier.S } else { EvoTier.M }
    }
    let (cell, gap, track) = evoGeometry(tier)

    let cells = ArrayList<EvoCell>()
    var i: Int64 = 0
    while (i < rows.size) {
        let r = rows[i]
        let (name, era) = splitStageLabel(r.stageLabel)
        cells.add(
            EvoCell(
                EvoCellKind.Old,
                r.asset,
                "",
                name,
                era,
                baihuaLines(charId, i),
                r.sourceLabel,
                r.license,
                i * (cell + gap)
            )
        )
        i = i + 1
    }
    /* 最后一格（繁简）不写时代。 */
    if (sameForm) {
        cells.add(
            EvoCell(
                EvoCellKind.Simp,
                "",
                first.glyph,
                "繁简同形",
                "",
                baihuaLines(charId, cells.size),
                "",
                "",
                cells.size * (cell + gap)
            )
        )
    } else {
        cells.add(
            EvoCell(
                EvoCellKind.Trad,
                "",
                first.trad,
                "繁体",
                "",
                baihuaLines(charId, cells.size),
                "",
                "",
                cells.size * (cell + gap)
            )
        )
        cells.add(
            EvoCell(
                EvoCellKind.Simp,
                "",
                first.glyph,
                "简体",
                "",
                baihuaLines(charId, cells.size),
                "",
                "",
                cells.size * (cell + gap)
            )
        )
    }

    return EvoStrip(charId, first.glyph, first.trad, first.method, cells, tier, cell, gap, track)
}

/* 造字卡骨片底部那一行：卡面档 C，只显示阶段名（白话/时代由界面不渲染）。 */
public func buildCardStrip(charId: String): EvoStrip {
    return buildEvoStrip(charId, Some(EvoTier.C))
}

/* 字录详情「古字形演变」：标准档 M。 */
public func buildDetailStrip(charId: String): EvoStrip {
    return buildEvoStrip(charId, Some(EvoTier.M))
}
