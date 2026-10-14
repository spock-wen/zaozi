// 存档码：把「种子 + 操作序列」编成一段可以复制的文本。纯函数，浏览器和 Node 里跑出来一样。
// 不存状态快照，存种子和操作序列：读档时用引擎重放，同种子同操作必然得到同一个状态（确定性）。
// 格式：ZZ1.<校验和>.<base64url(JSON)>，JSON 里有版本号、种子、操作序列。
                                         

export const SAVE_VERSION = 1;                     // 存档码格式版本；改了编码或引擎不兼容旧码就 +1
export const SAVE_PREFIX = "ZZ1.";                 // 认出是本游戏的存档码
export const SAVE_KEY = "zaozi.save.year1";        // localStorage 里的键

// FNV-1a 32 位，转 base36。只为发现抄漏/抄错字符，不是防篡改。
function checksum(s        )         {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

function b64encode(bytes            )         {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64decode(s        )             {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

                                                                                    

export function encodeSaveCode(seed        , actions          )         {
  return encodeSaveCodeWith(SAVE_VERSION, seed, actions);
}

// 指定版本号编码：只为测试「旧版存档码」这条路，正常存档一律走 encodeSaveCode。
export function encodeSaveCodeWith(version        , seed        , actions          )         {
  const body = JSON.stringify({ v: version, seed, actions });
  return SAVE_PREFIX + checksum(body) + "." + b64encode(new TextEncoder().encode(body));
}

export function decodeSaveCode(code        )           {
  const t = String(code).replace(/\s+/g, "");      // 容忍粘贴时带上的换行和空格
  if (!t.startsWith(SAVE_PREFIX)) throw new Error("不是本游戏的存档码");
  const rest = t.slice(SAVE_PREFIX.length);
  const dot = rest.indexOf(".");
  if (dot < 0) throw new Error("存档码不完整");
  const ck = rest.slice(0, dot);
  const body = new TextDecoder().decode(b64decode(rest.slice(dot + 1)));
  if (checksum(body) !== ck) throw new Error("存档码校验没过，可能抄漏了字符");
  const d = JSON.parse(body)            ;
  if (d.v !== SAVE_VERSION) throw new Error(`存档码是第 ${d.v} 版，这一版只认第 ${SAVE_VERSION} 版`);
  if (!Number.isInteger(d.seed) || !Array.isArray(d.actions)) throw new Error("存档码内容不对");
  return d;
}

// 本地自动存档：写的还是同一段存档码，读档和导入走同一条路。
export function saveToStorage(store         , seed        , actions          )       {
  store.setItem(SAVE_KEY, encodeSaveCode(seed, actions));
}
export function loadFromStorage(store         )                  {
  const code = store.getItem(SAVE_KEY);
  return code ? decodeSaveCode(code) : null;
}
