package ohos_app_cangjie_entry

import ohos.window.WindowStage
import kit.AbilityKit.*

/* Official Empty Ability UIAbility. loadContent uses the @Entry class name.
   WindowStage: import ohos.window.WindowStage (OpenHarmony
   filemanagement_filemanagement_cangjie_wrapper test MainAbility). */
class MainAbility <: UIAbility {
    public func onCreate(want: Want, launchParam: LaunchParam): Unit {
    }

    public func onWindowStageCreate(windowStage: WindowStage): Unit {
        windowStage.loadContent("EntryView")
    }
}
