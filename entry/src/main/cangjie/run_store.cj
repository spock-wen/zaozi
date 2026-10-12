package ohos_app_cangjie_entry

import kit.AbilityKit.UIAbilityContext
import ohos.arkui.state_management.AppStorage
import ohos.data.preferences.*

/* 存档的平台胶水：整局状态序列化成一行字符串，存进 Preferences
   （库名 zaozi_run，key run_v1）。
   格式、版本、容错全在 run_state.cj（parseRunState 坏档 → None → 新开局），
   这里只保证「拿不到 context / Preferences 打不开 / 读写抛异常」都不崩：
   读失败当新开局，写失败就当这一局没存档（内存里照常玩）。
   context 由 main_ability.cj 在 onCreate 里塞进 AppStorage。 */

const RUN_PREF_NAME: String = "zaozi_run"
const RUN_PREF_KEY: String = "run_v1"
const RUN_PREF_CTX: String = "abilityContext"

public class RunStore {
    /* 打开过一次就缓存（Preferences 实例跟着 context 走，一次 Ability 只有一个）。 */
    static var store: Option<Preferences> = Option<Preferences>.None

    static func prefsOf(ctx: UIAbilityContext): Option<Preferences> {
        if (store.isSome()) {
            return store
        }
        try {
            store = Some(Preferences.getPreferences(ctx, RUN_PREF_NAME))
        } catch (e: Exception) {
            store = Option<Preferences>.None
        }
        return store
    }

    static func readRaw(st: Preferences): String {
        try {
            match (st.get(RUN_PREF_KEY, PreferencesValueType.StringData(""))) {
                case PreferencesValueType.StringData(v) => return v
                case _ => return ""
            }
        } catch (e: Exception) {
            return ""
        }
    }

    /* 读档：没有 / 坏档 / 拿不到 context → 新开局（phase 0 挑字页）。 */
    public static func load(ctx: UIAbilityContext): RunState {
        match (prefsOf(ctx)) {
            case Some(st) =>
                match (parseRunState(readRaw(st))) {
                    case Some(s) => return s
                    case None => return newRunState()
                }
            case None => return newRunState()
        }
    }

    /* 写档：put + flush，任何异常都吞掉（存档失败不该把界面带崩）。 */
    public static func save(ctx: UIAbilityContext, s: RunState): Unit {
        match (prefsOf(ctx)) {
            case Some(st) =>
                try {
                    st.put(RUN_PREF_KEY, PreferencesValueType.StringData(serializeRunState(s)))
                    st.flush()
                } catch (e: Exception) {
                    /* 只当没存上，界面状态不回流。 */
                }
            case None => ()
        }
    }

    /* 便捷版：从 AppStorage 拿 context（EntryView 用，拿不到就只在内存里跑）。 */
    public static func load(): RunState {
        match (AppStorage.get<UIAbilityContext>(RUN_PREF_CTX)) {
            case Some(ctx) => return RunStore.load(ctx)
            case None => return newRunState()
        }
    }

    public static func save(s: RunState): Unit {
        match (AppStorage.get<UIAbilityContext>(RUN_PREF_CTX)) {
            case Some(ctx) => RunStore.save(ctx, s)
            case None => ()
        }
    }
}
