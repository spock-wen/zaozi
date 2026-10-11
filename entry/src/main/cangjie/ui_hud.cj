package ohos_app_cangjie_entry

import kit.ArkUI.*
import ohos.arkui.state_macro_manage.*
import std.collection.ArrayList

/* 四维资源条（SPEC §2.1；设计稿 home_slide_v1 A / C）。两个小 @Component：
     HomeHudDim  一列：维名 + 数值 + 条
     HomeHud     四列等分、列间距 8、左右边距 16
   整条一色（hud-fill = on-night），没有每维一色（SPEC §4 待确认 3）；
   两端各 15% 是淡朱危险区，数值掉进去时填充和维名转朱（hud-warn）。
   数值 10fp 二级色、等宽数字；归零 / 满那一下由结局卡那一侧处理（slice 4）。 */

/* 一列。dims / at / flash 都是原始值（函数调用当 @Prop 传进来不参与重绘跟踪），
   取值、颜色、份数全在成员函数里算。
   flash = 触底 / 溢出那一下的「闪朱」（SPEC §2.1 归零/满 闪朱 2 次）：闪的时候
   维名与数值反转成朱底白字，两下各 ~200ms，由 EntryView 用 animateTo 推进。 */
@Component
public class HomeHudDim {
    @Prop var dims: Array<Int64>
    @Prop var at: Int64
    @Prop var flash: Bool

    func value(): Int64 {
        if (this.at < 0 || this.at >= this.dims.size) { return 0 }
        return this.dims[this.at]
    }

    func name(): String {
        return homeDimName(this.at)
    }

    func inDanger(): Bool {
        return dimInDanger(this.value())
    }

    func nameColor(): Int64 {
        if (this.flash) { return Theme.white }
        if (this.inDanger()) { return Theme.hudWarnName }
        return Theme.onNight
    }

    func fillColor(): Int64 {
        if (this.flash) { return Theme.zhu600 }
        if (this.inDanger()) { return Theme.zhu600 }
        return Theme.onNight
    }

    /* 闪朱时维名与数值那一行反转成朱底白字（SPEC §2.1 归零/满 闪朱）。 */
    func topBg(): Int64 {
        if (this.flash) { return Theme.zhu600 }
        return Theme.night900
    }

    func valueColor(): Int64 {
        if (this.flash) { return Theme.white }
        return Theme.onNight2
    }

    /* 填充占的份数（整条 100 份， clamp 过的值就是份数）。 */
    func fillWeight(): Int64 {
        return runClampDim(this.value())
    }

    func restWeight(): Int64 {
        return RUN_DIM_MAX - this.fillWeight()
    }

    func build() {
        Column {
            Row {
                Text(this.name())
                    .fontSize(14)
                    .fontFamily(Theme.serif)
                    .fontWeight(FontWeight.Bold)
                    .fontColor(this.nameColor())
                Text("${this.value()}")
                    .fontSize(10)
                    .fontFamily(Theme.sans)
                    .fontColor(this.valueColor())
            }
            .width(100.percent)
            .backgroundColor(this.topBg())

            /* 条：高 6、圆角 3。三层叠在一个 Stack 里（先画的在底下）：
               底整条 hud-track → 填充从左边长出来 → 两端各 15% 危险区淡朱底。
               三层都是整条宽、都是 6 高，所以 Stack 默认的居中叠出来就是对的。 */
            Stack {
                Text("")
                    .width(100.percent)
                    .height(6)
                    .backgroundColor(Theme.nightLine)
                    .borderRadius(3)
                Row {
                    Text("")
                        .layoutWeight(this.fillWeight())
                        .height(6)
                        .backgroundColor(this.fillColor())
                    Text("")
                        .layoutWeight(this.restWeight())
                        .height(6)
                }
                .width(100.percent)
                .height(6)
                Row {
                    Text("")
                        .layoutWeight(RUN_DANGER_LOW)
                        .height(6)
                        .backgroundColor(Theme.hudDangerZone)
                    Text("")
                        .layoutWeight(RUN_DIM_MAX - 2 * RUN_DANGER_LOW)
                        .height(6)
                    Text("")
                        .layoutWeight(RUN_DANGER_LOW)
                        .height(6)
                        .backgroundColor(Theme.hudDangerZone)
                }
                .width(100.percent)
                .height(6)
            }
            .width(100.percent)
            .height(6)
            .margin(top: 6)
        }
        .width(100.percent)
        .layoutWeight(1)
    }
}

/* 四列等分：列间距 8，左右边距 16（SPEC §2.1）。
   flashDim = 正在闪朱的那一维（-1 = 没有），flashOn = 这一下亮不亮。 */
@Component
public class HomeHud {
    @Prop var dims: Array<Int64>
    @Prop var flashDim: Int64
    @Prop var flashOn: Bool

    /* 四维的下标（0/1/2/3）。ArrayList 是为了跟仓库里其它 ForEach 调用一致。 */
    func indexes(): ArrayList<Int64> {
        let out = ArrayList<Int64>()
        out.add(0)
        out.add(1)
        out.add(2)
        out.add(3)
        return out
    }

    func flashAt(i: Int64): Bool {
        return this.flashOn && this.flashDim == i
    }

    func build() {
        Row(space: 8) {
            ForEach(this.indexes(), itemGeneratorFunc: {i: Int64, at: Int64 =>
                HomeHudDim(dims: this.dims, at: i, flash: this.flashAt(i))
            })
        }
        .width(100.percent)
        .padding(left: Theme.insetNight, right: Theme.insetNight)
    }
}
