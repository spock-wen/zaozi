package ohos_app_cangjie_entry

import ohos.resource.AppResource

/* Local shim: @r(...) expands to __GenerateResource__(...) but current
   @Entry/@Component macros do not inject the helper. Needed for Image(@r). */
func __GenerateResource__(
    bundleName: String,
    moduleType: String,
    moduleName: String,
    id: UInt32,
    name: String,
    params: Array<Any>,
    resType: Int32
): AppResource {
    return AppResource(bundleName, moduleName, id, params: params, resType: resType)
}
