package ohos_app_cangjie_entry

import kit.ArkUI.*
import ohos.arkui.state_macro_manage.*
import std.collection.ArrayList

/* 骨片行（SPEC §2.2；设计稿 home_slide_v1 A）。两个小 @Component：
     BonePip      一个骨片位 16×20：空骨片 / 事签骨片（两道 carve 刻痕）/ 上限空位（虚线）
     HomeBonesRow 一行：「骨片」小标签 + 5 位 pip + 右侧「余年 N 年」
   5 位怎么排是纯逻辑（game_rules.bonePipKinds），这里只照着摆。
   「第 N 代 · 第 Y 年」不在这行里画：它在页面顶行（ui_home.cj 的 HomeStatLine），
   同一行里出现两遍会重复。
   裂（刻错时出现 600ms 后移除）属于冬夜刻字那一侧，本 slice 不出。 */

/* 一个骨片位。kind 见 game_rules.cj 的 BONE_PIP_*。 */
@Component
public class BonePip {
    @Prop var kind: Int64

    func isEmpty(): Bool {
        return this.kind == BONE_PIP_EMPTY
    }

    func isShiqian(): Bool {
        return this.kind == BONE_PIP_SHIQIAN
    }

    func isCap(): Bool {
        return this.kind == BONE_PIP_CAP
    }

    func build() {
        Stack {
            /* 骨片底：上限空位没有底，只有一道虚线（SPEC §2.2）。 */
            if (!this.isCap()) {
                Text("")
                    .width(Theme.bonePipW)
                    .height(Theme.bonePipH)
                    .backgroundColor(Theme.bone100)
                    .borderRadius(6)
            } else {
                Text("")
                    .width(Theme.bonePipW)
                    .height(Theme.bonePipH)
                    .borderRadius(6)
                    .border(width: 1, color: Theme.nightLine, style: BorderStyle.Dashed)
            }

            /* 事签骨片：两道 carve 刻痕。 */
            if (this.isShiqian()) {
                Column {
                    Text("")
                        .width(8)
                        .height(2)
                        .backgroundColor(Theme.carve)
                        .borderRadius(1)
                    Text("")
                        .width(8)
                        .height(2)
                        .backgroundColor(Theme.carve)
                        .borderRadius(1)
                        .margin(top: 4)
                }
            }
        }
        .width(Theme.bonePipW)
        .height(Theme.bonePipH)
    }
}

/* 一行骨片。boneEmpty / boneShiqian / yearsLeft 都是原始字段。 */
@Component
public class HomeBonesRow {
    @Prop var boneEmpty: Int64
    @Prop var boneShiqian: Int64
    @Prop var yearsLeft: Int64

    /* 5 位的排法（纯逻辑在 game_rules.cj）。 */
    func kinds(): Array<Int64> {
        return bonePipKinds(this.boneEmpty, this.boneShiqian)
    }

    /* ForEach 要的列表。 */
    func kindList(): ArrayList<Int64> {
        let out = ArrayList<Int64>()
        let ks = this.kinds()
        var i: Int64 = 0
        while (i < ks.size) {
            out.add(ks[i])
            i = i + 1
        }
        return out
    }

    /* 「余年 N 年」：数字单独 gold-400 Bold（SPEC §2.2）。 */
    func yearsNumber(): String {
        return "${this.yearsLeft}"
    }

    func build() {
        Row {
            Text(HOME_BONES_LABEL)
                .fontSize(Theme.fsBadge)
                .fontFamily(Theme.sans)
                .fontColor(Theme.onNight2)
                .margin(right: 8)
            Row(space: Theme.bonePipGap) {
                ForEach(this.kindList(), itemGeneratorFunc: {k: Int64, i: Int64 =>
                    BonePip(kind: k)
                })
            }
            Blank()
            Row {
                Text("余年 ")
                    .fontSize(Theme.fsBadge)
                    .fontFamily(Theme.sans)
                    .fontColor(Theme.onNight2)
                Text(this.yearsNumber())
                    .fontSize(Theme.fsBadge)
                    .fontFamily(Theme.sans)
                    .fontWeight(FontWeight.Bold)
                    .fontColor(Theme.gold400)
                Text(" 年")
                    .fontSize(Theme.fsBadge)
                    .fontFamily(Theme.sans)
                    .fontColor(Theme.onNight2)
            }
        }
        .width(100.percent)
        .margin(top: 12)
        .padding(left: Theme.insetNight, right: Theme.insetNight)
    }
}
