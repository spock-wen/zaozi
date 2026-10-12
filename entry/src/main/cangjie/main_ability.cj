package ohos_app_cangjie_entry

import ohos.window.WindowStage
import kit.AbilityKit.*
import ohos.arkui.state_management.AppStorage

/* Official Empty Ability UIAbility. loadContent uses the @Entry class name.
   WindowStage: import ohos.window.WindowStage (OpenHarmony
   filemanagement_filemanagement_cangjie_wrapper test MainAbility).
   onCreate 里把 context 塞进 AppStorage：run_store.cj 的 RunStore 从那里取，
   才能在 EntryView 里读/写 Preferences（开局挑字落定即存档）。 */
class MainAbility <: UIAbility {
    public func onCreate(want: Want, launchParam: LaunchParam): Unit {
        AppStorage.setOrCreate<UIAbilityContext>("abilityContext", this.context)
    }

    public func onWindowStageCreate(windowStage: WindowStage): Unit {
        windowStage.loadContent("EntryView")
    }
}
