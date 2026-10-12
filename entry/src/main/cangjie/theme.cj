package ohos_app_cangjie_entry

/* 造字人 v1.1.1 设计 token。来源：/workspace/zaozi-formal/v1/SPEC.md §1 色板、
   §2 字号层级、§3 布局尺寸、§5 演变条 token。数值与设计稿一致，勿手改。
   本文件不 import 任何 kit/ohos 模块，能在普通 Linux 上编译（tools/box_check）。 */

public class Theme {
    /* —— §1 色板 —— */
    public static let night900: Int64 = 0X15171F
    public static let night800: Int64 = 0X1E2230
    public static let night700: Int64 = 0X2B3042
    public static let nightLine: Int64 = 0X3A4057
    public static let bone100: Int64 = 0XF1E8D4
    public static let bone200: Int64 = 0XE4D6B8
    public static let bone300: Int64 = 0XCDBB94
    public static let boneCrack: Int64 = 0XB9A57C
    public static let paper50: Int64 = 0XFAF6EC
    public static let paper100: Int64 = 0XF3ECDD
    public static let paper200: Int64 = 0XE6DCC6
    public static let paperLine: Int64 = 0XD8CCB2
    public static let ink900: Int64 = 0X2A241D
    public static let ink600: Int64 = 0X5C5346
    public static let ink400: Int64 = 0X766C5E
    public static let carve: Int64 = 0X6E2F1F
    public static let glyphNight: Int64 = 0XEADFC6
    public static let zhu600: Int64 = 0XB5432E
    public static let zhu100: Int64 = 0XF3DED6
    public static let gold400: Int64 = 0XD8B46A
    public static let jade600: Int64 = 0X4E6E66
    public static let jade100: Int64 = 0XDDE6E1
    public static let zhishi600: Int64 = 0X5B4A72
    public static let zhishi100: Int64 = 0XE9E1F0
    public static let onNight: Int64 = 0XEEE7D8
    public static let onNight2: Int64 = 0XA8A193
    public static let unknownMark: Int64 = 0XA99F8D
    public static let white: Int64 = 0XFFFFFF

    /* 弹层遮罩 45% 黑（SPEC §4.1「弹层」行）。 */
    public static let scrimBlack45: Int64 = 0X73000000

    /* —— v2 SPEC §1 追加 token（值全部取自 v1 已有色，没有新色）——
       M2 主界滑卡：四维条 / 骨片行 / 事件卡 / 按住看分量。 */
    /* 四维条危险区维名 #E9A08F（§1 hud-warn 行）。 */
    public static let hudWarnName: Int64 = 0XE9A08F
    /* 四维条两端各 15% 危险区底：zhu-600 35%。 */
    public static let hudDangerZone: Int64 = 0X59B5432E
    /* 事件卡阴影 0 12 28 rgba(0,0,0,.4) —— 本版先当描边用，见 ui_event_card.cj 说明。 */
    public static let cardShadow: Int64 = 0X66000000
    /* 事件卡「下一张」垫在后面的透明度 55%。 */
    public static let cardUnderOpacity: Float64 = 0.55
    /* 事件卡「下一张」缩到 96%。 */
    public static let cardUnderScale: Float64 = 0.96
    /* 按住看分量：卡片外圈 gold-400 2 + rgba(216,180,106,.18) 8。 */
    public static let holdGlow: Int64 = 0X2ED8B46A
    /* 卡顶选项条 night-900 86%。 */
    public static let optBarNight: Int64 = 0XDB15171F
    /* 拖卡阈值（vp）：过了就在卡顶露出这一侧的选项条。 */
    public static let swipeThreshold: Int64 = 60
    /* 拖卡最大位移 / 最大倾斜（SPEC §2.3：位移 ±14、旋转 ±5°）。 */
    public static let swipeShift: Int64 = 14
    public static let swipeTiltDeg: Int64 = 5
    /* 按住看分量圆点三档（states_v1 ①）。 */
    public static let dotSmall: Int64 = 5
    public static let dotMid: Int64 = 8
    public static let dotLarge: Int64 = 12
    /* 骨片 pip 16×20，间距 6，共 5 位（SPEC §2.2）。 */
    public static let bonePipW: Int64 = 16
    public static let bonePipH: Int64 = 20
    public static let bonePipGap: Int64 = 6
    /* 事件卡 296×384、圆角 16；立绘区 184；卡文 Serif 16 / 行高 26、内边距 18。
       卡高改成跟可用高度走（lay_b0.json：主界事件卡那一块只有 ~357vp，
       写死 384 会把卡片和垫底那张一起压到下方「先种粟 / 先献祭」按钮上）。
       cardUnderDrop 是「下一张」露在下面那一条的高度；cardMinH 是卡面内容
       的实占高度（立绘区 + 卡文 3 行 + 内边距 + 落字条 + 卡底边距），
       可用高度不够时按 home_mirror.cj 的 cardFitsLuozi 判，box_check 有断言。 */
    public static let cardW: Int64 = 296
    public static let cardH: Int64 = 384
    public static let cardArtH: Int64 = 184
    public static let cardBodyFs: Int64 = 16
    public static let cardBodyLh: Int64 = 26
    public static let cardBodyPad: Int64 = 18
    /* 事件卡「下一张」露在下面那一条：8vp（原来 margin(top: 8) 的同一个值）。 */
    public static let cardUnderDrop: Int64 = 8
    /* 卡面内容实占高度：立绘区 184 + 卡文内边距 18 + 卡文 3 行（26×3 = 78）
       + 落字条 48 + 落字条下边距 12 = 340。384 的卡高装得下，窄一档的
       主界（357 − 8 = 349）也装得下。 */
    public static let cardMinH: Int64 = 340
    /* 点选退路（「先种粟 / 先献祭」）上边距：12vp（原来写死在 HomeOptBtns 里）。 */
    public static let homeOptGapTop: Int64 = 12
    /* 事件卡人物胶囊 24 高 / 季节序号 11（SPEC §2.3）。 */
    public static let whoCapsuleH: Int64 = 24
    public static let whoFs: Int64 = 12
    public static let seasonFs: Int64 = 11
    /* 卡顶选项条 64 高（过拖拽阈值时出现）。 */
    public static let optBarH: Int64 = 64
    /* 落字第三选项条 48 高、圆角 12（朱底白字 Serif 15 Bold；再点一次确认）。 */
    public static let luoziBarH: Int64 = 48

    /* —— v2 SPEC §2.4 字匣（M2 slice 3）——
       主界底部字匣条 104 高；3 格 48×48、圆角 12、间距 12；格内字 Serif 26 Bold。
       选中 = 朱 2 描边 + 3 外发光；本代已落 = night-700 底、字 38%、下沿「已落」
       小签 16 高；空格 1.5 虚线（只在本代带的字不足 3 个时出现）。 */
    public static let boxBarH: Int64 = 104
    public static let boxSlotCell: Int64 = 48
    public static let boxSlotRadius: Int64 = 12
    public static let boxSlotGap: Int64 = 12
    public static let boxSlotFs: Int64 = 26
    /* 字匣条底色 night-900 60%（设计稿 .ziku）、上边一线 night-line。 */
    public static let boxBarBg: Int64 = 0X9915171F
    /* 选中格外发光：zhu-600 25%（设计稿 box-shadow 0 0 0 3px rgba(181,67,46,.25)）。
       本仓库的 shadow 没验过，用一圈同色圆角块垫在格子背后顶（见 ui_box.cj）。 */
    public static let boxSelGlow: Int64 = 0X40B5432E
    /* 本代已落：字 38% 透明。 */
    public static let boxLandedOpacity: Float64 = 0.38
    /* 下沿「已落」小签：16 高、圆角 5、10 Bold。 */
    public static let boxTagH: Int64 = 16
    public static let boxTagRadius: Int64 = 5
    public static let boxTagFs: Int64 = 10
    /* 空格虚线边（SPEC 写 1.5；本仓库 border 的 Length 只验过整数，取 1）。 */
    public static let boxEmptyBorder: Int64 = 1
    /* 事签格：骨片形（不等圆角）、carve 字 11 Bold。 */
    public static let boxShiqianFs: Int64 = 11

    /* —— §2 字体 ——
       TODO(字体)：SPEC 用 Noto Serif CJK SC/TC 与 HarmonyOS Sans SC，包体原因
       本版不内置字体文件。先用系统 generic family 占位；后续用
       font.registerFont 注册 rawfile 下的 Noto Serif CJK 后把这里换掉。
       serifTC 预留给「繁体」格（SPEC §5：繁体格用 Noto Serif CJK TC）。 */
    public static let serif: String = "serif"
    public static let serifTC: String = "serif"
    public static let sans: String = "sans-serif"

    /* —— §2 字号 —— */
    public static let fsGlyphHero: Int64 = 150
    public static let fsZiluBig: Int64 = 92
    public static let fsPageTitle: Int64 = 22
    public static let fsSheetTitle: Int64 = 24
    public static let fsGridChar: Int64 = 30
    public static let fsBody: Int64 = 15
    public static let fsQuote: Int64 = 15
    public static let fsShiqian: Int64 = 14
    public static let fsEffect: Int64 = 14
    public static let fsButton: Int64 = 15
    public static let fsStatus: Int64 = 13
    public static let fsSectionTitle: Int64 = 12
    public static let fsBadge: Int64 = 12
    public static let fsStageName: Int64 = 11
    public static let fsStageNameCard: Int64 = 10
    public static let fsEra: Int64 = 10
    public static let fsBaihua: Int64 = 10
    public static let fsNote: Int64 = 11
    public static let fsPopTitle: Int64 = 14
    public static let fsPopBaihua: Int64 = 12
    public static let fsPopSource: Int64 = 10

    /* —— §3 布局尺寸（360vp）—— */
    public static let insetNight: Int64 = 16
    public static let insetPaper: Int64 = 12
    public static let cardPad: Int64 = 16
    public static let cardRadius: Int64 = 16
    public static let sheetRadius: Int64 = 20
    public static let boneW: Int64 = 328
    public static let boneH: Int64 = 356
    public static let boneGlyphBox: Int64 = 176
    public static let boneGlyphTop: Int64 = 22
    public static let gridCell: Int64 = 60
    public static let gridRadius: Int64 = 12
    public static let gridGap: Int64 = 9
    public static let gridPerRow: Int64 = 5
    public static let ziluBigBox: Int64 = 112
    public static let buttonH: Int64 = 44

    /* —— §5 演变条 token —— */
    public static let evoCellC: Int64 = 48
    public static let evoGapC: Int64 = 14
    public static let evoCellM: Int64 = 56
    public static let evoGapM: Int64 = 6
    public static let evoCellS: Int64 = 46
    public static let evoGapS: Int64 = 5
    public static let evoTrackC: Int64 = 296
    public static let evoTrackM: Int64 = 304
    public static let evoTrackS: Int64 = 301
    public static let evoRadius: Int64 = 10
    public static let evoGlyphRatio: Int64 = 86
    public static let evoTodayRatio: Int64 = 80
    public static let evoDimOpacity: Float64 = 0.38
    public static let evoSelectedBorder: Int64 = 2
    public static let evoLabelGap: Int64 = 6

    /* 放大卡（§5）：宽 188，字形区 144×144 圆角 14。 */
    public static let popW: Int64 = 188
    public static let popGlyphBox: Int64 = 144
    public static let popGlyphRadius: Int64 = 14

    /* 造字卡播放节奏（SPEC §4.1 / 设计稿节奏表）。 */
    public static let playStepMs: Int64 = 600
    public static let playFadeMs: Int64 = 300
    public static let sheetUpMs: Int64 = 240

    /* —— v2 SPEC §2.6 代末结算 / §2.7 结局卡（M2 slice 4）——
       结局卡：paper-50、左右边距 24、顶部色带 8 高、标题 Serif 40 Bold 字距 .06em、
       原因胶囊 26 高、结局话 Serif 16 / 行高 28、留下的字 40×40。
       代末页：paper-100；家谱行一行一代（圆点 10、竖线 2、名称 Serif 13 Bold、
       字 24×24 圆角 6、结局字 11 Medium、「新」角标 16 高）；留下的字 44×44 朱 2。 */
    /* 结局卡左右边距 24、上圆角 18、顶部色带 8 高。 */
    public static let endInset: Int64 = 24
    public static let endRadius: Int64 = 18
    public static let endBandH: Int64 = 8
    /* 结局卡标题 Serif 40 Bold（SPEC §2.7 模板 A/B）。 */
    public static let endTitleFs: Int64 = 40
    /* 结局话 Serif 16 / 行高 28（SPEC §2.7）。 */
    public static let endLineFs: Int64 = 16
    public static let endLineLh: Int64 = 28
    /* 结局卡「留下的字」40×40。 */
    public static let endCharCell: Int64 = 40
    /* 结局卡从下方升起 320ms（SPEC §2.7 触发链）。 */
    public static let endRiseMs: Int64 = 320
    /* 触底 / 满 闪朱：一下 200ms，共两下（SPEC §2.1 / §2.7）。 */
    public static let dimFlashMs: Int64 = 200
    /* 家谱行：一行一代，行高定死 58（圆点 10 + 竖线 2 按行高连下来）。 */
    public static let settleRowH: Int64 = 58
    /* 家谱行圆点 10、竖线 2。 */
    public static let familyDot: Int64 = 10
    public static let familyLine: Int64 = 2
    /* 家谱行「留下的字」24×24 圆角 6。 */
    public static let familyCharCell: Int64 = 24
    /* 「新」角标 16 高。 */
    public static let familyNewTagH: Int64 = 16
    /* 代末页「这一代留下」44×44。 */
    public static let keepCharCell: Int64 = 44
}
