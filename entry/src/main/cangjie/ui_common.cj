package ohos_app_cangjie_entry

import kit.ArkUI.*
import ohos.arkui.state_macro_manage.*

/* 三套界面共用的小组件。全部放在根包 ohos_app_cangjie_entry 里，
   与 index.cj 同一个包，@Component 才能被 @Entry 直接当控件用。
   这里只用 yilu-bios/entry/src/main/cangjie/index.cj 里已验证过的
   ArkUI 属性（width/height/backgroundColor/borderRadius/border/
   fontSize/fontColor/fontFamily/fontWeight/onClick/opacity/...）。 */

/* 顶部三段切换：造字 / 演变条 / 字录（SPEC 允许用分段切换器做首版）。 */
@Component
public class TopSwitcher {
    @Prop var screen: Int64
    @Prop var onSwitch: (Int64) -> Unit

    func build() {
        Row {
            Text("造字")
                .fontSize(14)
                .fontFamily(Theme.sans)
                .fontWeight(if (this.screen == 0) { FontWeight.Bold } else { FontWeight.Normal })
                .fontColor(if (this.screen == 0) { Theme.gold400 } else { Theme.onNight2 })
                .layoutWeight(1)
                .textAlign(TextAlign.Center)
                .onClick({event => this.onSwitch(0)})
            Text("演变条")
                .fontSize(14)
                .fontFamily(Theme.sans)
                .fontWeight(if (this.screen == 1) { FontWeight.Bold } else { FontWeight.Normal })
                .fontColor(if (this.screen == 1) { Theme.gold400 } else { Theme.onNight2 })
                .layoutWeight(1)
                .textAlign(TextAlign.Center)
                .onClick({event => this.onSwitch(1)})
            Text("字录")
                .fontSize(14)
                .fontFamily(Theme.sans)
                .fontWeight(if (this.screen == 2) { FontWeight.Bold } else { FontWeight.Normal })
                .fontColor(if (this.screen == 2) { Theme.gold400 } else { Theme.onNight2 })
                .layoutWeight(1)
                .textAlign(TextAlign.Center)
                .onClick({event => this.onSwitch(2)})
        }
        .width(100.percent)
        .height(44)
        .backgroundColor(Theme.night900)
        .justifyContent(FlexAlign.Center)
        .alignItems(VerticalAlign.Center)
    }
}

/* 造法徽标：会意朱、象形青、指事紫灰（SPEC §4.1）。 */
public func methodBadgeFg(method: String): Int64 {
    if (method == "会意") {
        return Theme.zhu600
    }
    if (method == "象形") {
        return Theme.jade600
    }
    return Theme.zhishi600
}

public func methodBadgeBg(method: String): Int64 {
    if (method == "会意") {
        return Theme.zhu100
    }
    if (method == "象形") {
        return Theme.jade100
    }
    return Theme.zhishi100
}

@Component
public class MethodBadge {
    @Prop var method: String

    func build() {
        Text(this.method)
            .fontSize(Theme.fsBadge)
            .fontFamily(Theme.sans)
            .fontWeight(FontWeight.Bold)
            .fontColor(methodBadgeFg(this.method))
            .backgroundColor(methodBadgeBg(this.method))
            .height(22)
            .padding(left: 8, right: 8)
            .borderRadius(6)
            .textAlign(TextAlign.Center)
    }
}

/* 公式行里的部件小方块（休 = 人 ＋ 木）。 */
@Component
public class PartChip {
    @Prop var glyph: String

    func build() {
        Text(this.glyph)
            .fontSize(18)
            .fontFamily(Theme.serif)
            .fontWeight(FontWeight.Bold)
            .fontColor(Theme.ink900)
            .backgroundColor(Theme.paper50)
            .width(32)
            .height(32)
            .borderRadius(8)
            .border(width: 1, color: Theme.paperLine)
            .textAlign(TextAlign.Center)
    }
}

/* 区块标题：字录详情里「白话字义 / 典籍 / 古字形演变 ...」。 */
@Component
public class SectionHead {
    @Prop var title: String
    @Prop var hint: String

    func build() {
        Row {
            Text(this.title)
                .fontSize(Theme.fsSectionTitle)
                .fontFamily(Theme.sans)
                .fontWeight(FontWeight.Bold)
                .fontColor(Theme.ink400)
                .layoutWeight(1)
            if (this.hint.size > 0) {
                Text(this.hint)
                    .fontSize(Theme.fsNote)
                    .fontFamily(Theme.sans)
                    .fontColor(Theme.zhu600)
            }
        }
        .width(100.percent)
    }
}

/* 描边按钮（看字录 / 继续 的幽灵按钮，弹层里用）。 */
@Component
public class GhostButton {
    @Prop var label: String
    @Prop var onTap: () -> Unit

    func build() {
        Text(this.label)
            .fontSize(Theme.fsButton)
            .fontFamily(Theme.sans)
            .fontWeight(FontWeight.Bold)
            .fontColor(Theme.ink900)
            .height(Theme.buttonH)
            .width(100.percent)
            .borderRadius(22)
            .border(width: 1, color: Theme.ink400)
            .textAlign(TextAlign.Center)
            .onClick({event => this.onTap()})
    }
}

/* 实心主按钮（朱色）。 */
@Component
public class PrimaryButton {
    @Prop var label: String
    @Prop var onTap: () -> Unit

    func build() {
        Text(this.label)
            .fontSize(Theme.fsButton)
            .fontFamily(Theme.sans)
            .fontWeight(FontWeight.Bold)
            .fontColor(Theme.white)
            .backgroundColor(Theme.zhu600)
            .height(Theme.buttonH)
            .width(100.percent)
            .borderRadius(22)
            .textAlign(TextAlign.Center)
            .onClick({event => this.onTap()})
    }
}
