package ohos_app_cangjie_entry

import ohos.resource.AppResource

/* Local shim: @r(...) expands to __GenerateResource__(...) but current
   @Entry/@Component macros do not inject the helper. Needed for Image(@r).
   不能删：删了 @rawfile / @r 展开出来的调用就没有定义，直接编不过。 */
func __GenerateResource__(
    bundleName: String,
    moduleType: String,
    moduleName: String,
    id: UInt32,
    name: String,
    params: Array<Any>,
    resType: Int32
): AppResource {
    /* 兜底不丢 name：@rawfile("glyph/x.svg") 展开时文件名在 name 里、params 是空数组，
       旧版只把 params 往下传，AppResource 就拿不到资源路径 → 演变条/放大卡的古字形全空白。
       所以 params 为空时用 name 顶上；rawfile 的 resType 是 30000，同样兜底。 */
    var ps: Array<Any> = params
    if (ps.size == 0 && name.size > 0) {
        ps = Array<Any>(1, {i: Int64 => name})
    }
    if (resType == 30000 && ps.size == 0) {
        ps = Array<Any>(1, {i: Int64 => name})
    }
    return AppResource(bundleName, moduleName, id, params: ps, resType: resType)
}
