// 造字人一年版 · Service Worker。这一份由 tools/build_dist.mjs 从模板生成（预缓存清单和版本哈希在构建时算好），不要手改。
// 行为：装上就把发布目录里的全部文件预缓存进 Cache Storage；之后同一版本的请求一律先读缓存，读不到才走网络，
// 断网时导航请求回落到应用外壳（缓存键 "./"）。换版本（哈希变）就删掉旧缓存。
// Cloudflare Pages 会把 /index.html 308 跳到 /、/credits.html 308 跳到 /credits。被跳过的响应带 redirected=true，
// 直接塞进 Cache Storage 或喂给导航请求，Chromium 会 ERR_FAILED、WebKit 会报 "Response served by service
// worker has redirections"。所以凡是进缓存/回给浏览器的响应，都要先 rewrap 掉跳转。
const VERSION = "7dc14fa2ab57";
const CACHE = "zaozi-year1-" + VERSION;
const FILES = [
  "./app.js", "./credits.html", "./data/chars_slice.js", "./data/chars_slice.json",
  "./data/input_map.js", "./data/input_map.json", "./data/rules.js", "./data/rules.json",
  "./data/year1_cards.js", "./data/year1_cards.json", "./glyph/glyph_pack_v1.csv", "./glyph/img/commons/ben_bronze.svg",
  "./glyph/img/commons/ben_seal.svg", "./glyph/img/commons/hao_bronze.svg", "./glyph/img/commons/hao_oracle.svg", "./glyph/img/commons/hao_seal.svg",
  "./glyph/img/commons/he_bronze.svg", "./glyph/img/commons/he_oracle.svg", "./glyph/img/commons/he_seal.svg", "./glyph/img/commons/huo_bronze.svg",
  "./glyph/img/commons/huo_clerical.svg", "./glyph/img/commons/huo_oracle.svg", "./glyph/img/commons/huo_seal.svg", "./glyph/img/commons/ji_bronze.svg",
  "./glyph/img/commons/ji_oracle.svg", "./glyph/img/commons/ji_seal.svg", "./glyph/img/commons/jian_bronze.svg", "./glyph/img/commons/jian_oracle.svg",
  "./glyph/img/commons/jian_seal.svg", "./glyph/img/commons/li_bronze.svg", "./glyph/img/commons/li_clerical.svg", "./glyph/img/commons/li_oracle.svg",
  "./glyph/img/commons/li_seal.svg", "./glyph/img/commons/lin_bronze.svg", "./glyph/img/commons/lin_oracle.svg", "./glyph/img/commons/lin_seal.svg",
  "./glyph/img/commons/men_bronze.svg", "./glyph/img/commons/men_clerical.svg", "./glyph/img/commons/men_oracle.svg", "./glyph/img/commons/men_seal.svg",
  "./glyph/img/commons/mi_bronze.svg", "./glyph/img/commons/mi_clerical.svg", "./glyph/img/commons/mi_oracle.svg", "./glyph/img/commons/mi_seal.svg",
  "./glyph/img/commons/ming_bronze.svg", "./glyph/img/commons/ming_oracle.svg", "./glyph/img/commons/ming_seal.svg", "./glyph/img/commons/mo_bronze.svg",
  "./glyph/img/commons/mo_seal.svg", "./glyph/img/commons/muye_bronze.svg", "./glyph/img/commons/muye_clerical.svg", "./glyph/img/commons/muye_oracle.svg",
  "./glyph/img/commons/muye_seal.svg", "./glyph/img/commons/niao_bronze.svg", "./glyph/img/commons/niao_oracle.svg", "./glyph/img/commons/niao_seal.svg",
  "./glyph/img/commons/nv_bronze.svg", "./glyph/img/commons/nv_clerical.svg", "./glyph/img/commons/nv_oracle.svg", "./glyph/img/commons/nv_seal.svg",
  "./glyph/img/commons/shui_bronze.svg", "./glyph/img/commons/shui_clerical.svg", "./glyph/img/commons/shui_oracle.svg", "./glyph/img/commons/shui_seal.svg",
  "./glyph/img/commons/tian_bronze.svg", "./glyph/img/commons/tian_clerical.svg", "./glyph/img/commons/tian_oracle.svg", "./glyph/img/commons/tian_seal.svg",
  "./glyph/img/commons/yi_bronze.svg", "./glyph/img/commons/yi_clerical.svg", "./glyph/img/commons/yi_oracle.svg", "./glyph/img/commons/yi_seal.svg",
  "./glyph/img/commons/yu_bronze.svg", "./glyph/img/commons/yu_clerical.svg", "./glyph/img/commons/yu_oracle.svg", "./glyph/img/commons/yu_seal.svg",
  "./glyph/img/commons/yue_bronze.svg", "./glyph/img/commons/yue_oracle.svg", "./glyph/img/commons/yue_seal.svg", "./glyph/img/commons/zi_bronze.svg",
  "./glyph/img/commons/zi_oracle.svg", "./glyph/img/commons/zi_seal.svg", "./glyph/img/norm/cong_bronze.svg", "./glyph/img/norm/cong_oracle.svg",
  "./glyph/img/norm/cong_seal.svg", "./glyph/img/norm/mu_bronze.svg", "./glyph/img/norm/mu_oracle.svg", "./glyph/img/norm/mu_seal.svg",
  "./glyph/img/norm/nan_bronze.svg", "./glyph/img/norm/nan_oracle.svg", "./glyph/img/norm/nan_seal.svg", "./glyph/img/norm/ren_bronze.svg",
  "./glyph/img/norm/ren_oracle.svg", "./glyph/img/norm/ren_seal.svg", "./glyph/img/norm/ren_slip.svg", "./glyph/img/norm/ri_bronze.svg",
  "./glyph/img/norm/ri_oracle.svg", "./glyph/img/norm/ri_seal.svg", "./glyph/img/norm/xiu_bronze.svg", "./glyph/img/norm/xiu_oracle.svg",
  "./glyph/img/norm/xiu_seal.svg", "./glyph/img/xiaoxue/ben_lishu_raw.png", "./glyph/img/xiaoxue/cong_lishu_raw.png", "./glyph/img/xiaoxue/hao_lishu_raw.png",
  "./glyph/img/xiaoxue/he_lishu_raw.png", "./glyph/img/xiaoxue/ji_lishu_raw.png", "./glyph/img/xiaoxue/jian_lishu_raw.png", "./glyph/img/xiaoxue/lin_lishu_raw.png",
  "./glyph/img/xiaoxue/ming_lishu_raw.png", "./glyph/img/xiaoxue/mo_lishu_raw.png", "./glyph/img/xiaoxue/mu_lishu_raw.png", "./glyph/img/xiaoxue/nan_lishu_raw.png",
  "./glyph/img/xiaoxue/niao_lishu_raw.png", "./glyph/img/xiaoxue/ri_lishu_raw.png", "./glyph/img/xiaoxue/xiu_lishu_raw.png", "./glyph/img/xiaoxue/yue_lishu_raw.png",
  "./glyph/img/xiaoxue/zi_lishu_raw.png", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon.svg",
  "./", "./manifest.webmanifest", "./src/engine.js", "./src/rng.js",
  "./src/savecode.js", "./src/types.js", "./src/validator.js", "./style.css",
];
const U = (p) => new URL(p, self.registration.scope).href;   // 清单是相对路径，按本 SW 的作用域解析

// 拿一个不带跳转标记的响应： redirected 的重新包一份（blob 会把重定向后的实体读出来）
async function clean(r) {
  if (!r || !r.redirected) return r;
  return new Response(await r.blob(), { status: r.status, statusText: r.statusText, headers: r.headers });
}
// 只有「能存」的响应才进 Cache Storage：ok 的 basic 是同源直连，default 是 rewrap 出来的；
// opaqueredirect（redirect:'manual' 的请求）之类存进去会抛错，错误页也不值得存，直接跳过。
function storable(r) { return !!r && r.ok && (r.type === "basic" || r.type === "default"); }
async function putClean(cache, req, r) {
  const c = await clean(r);
  if (storable(c)) await cache.put(req, c.clone());   // 存的是副本：body 只能被读一次，clone 掉才留得下没消耗的 c
  return c;                                          // 交出去的 c 仍是完整的——install 要拿它再存一个键，fetch 路径要原样回给页面
}

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // 逐个 fetch（不用 addAll：addAll 里一条 308 就把整批带成 redirected，且失败信息不好定位）
    for (const f of FILES) {
      const r = await fetch(U(f));                              // 清单里 "./" 这种键本身就可能是跳转目标
      if (!r.ok) throw new Error(`预缓存失败 ${f}：HTTP ${r.status}`);
      const cc = await putClean(c, U(f), r);                    // 按清单键原样存（键即缓存匹配的 URL）
      // credits 只 fetch 一次：Pages 上 /credits.html 会 308 到 /credits，两个地址都得能命中，同一份响应存两个键
      if (f === "./credits.html" && cc) await c.put(U("./credits"), cc.clone());
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

// 导航请求按 URL 分派：只有站点根（/ 与 /index.html，带 ?seed= 之类也算）给游戏外壳；
// /credits、/credits.html 给字源版权页；别的导航一律只按精确 URL 找缓存、找不到走网络，绝不用外壳兜底。
const SHELL_KEY = U("./");                                     // 应用外壳（Pages 上 "/" 服务的就是 index.html）
const SHELL_PATHS = new Set([new URL(SHELL_KEY).pathname, new URL(U("./index.html")).pathname]);
const CREDITS_HTML = U("./credits.html");                      // 构建期 credits 的缓存键（.html 原样）
const CREDITS_CLEAN = U("./credits");                          // 以及 Pages 规范化后的 /credits
const CREDITS_PATHS = new Set([new URL(CREDITS_HTML).pathname, new URL(CREDITS_CLEAN).pathname]);

// 返回 null 表示「这个 URL 没有专门的缓存条目，走网络」——注意任何情况下都不拿游戏外壳兜底。
async function navFromCache(c, req) {
  const p = new URL(req.url).pathname;
  if (SHELL_PATHS.has(p)) return clean(await c.match(SHELL_KEY, { ignoreSearch: false }));
  if (CREDITS_PATHS.has(p)) {
    return clean(await c.match(CREDITS_HTML, { ignoreSearch: false }) || await c.match(CREDITS_CLEAN, { ignoreSearch: false }));
  }
  return clean(await c.match(req, { ignoreSearch: false }));    // 别的页面：只认它自己的精确 URL
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;      // 不碰跨域请求
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    if (req.mode === "navigate") {
      const hit = await navFromCache(c, req);                        // 先读缓存（含断网），读不到再走网络
      if (hit) return hit;
    } else {
      const hit = await c.match(req, { ignoreSearch: false });        // 只认精确 URL，不拿带 ?seed= 的变体糊弄
      if (hit) return clean(hit);
    }
    try {
      return await putClean(c, req, await fetch(req));                // 同源新文件顺手进缓存（同样去掉跳转）
    } catch (err) {
      if (req.mode === "navigate") {                                  // 断网：导航还有一次按 URL 直接命中的机会
        const hit = await c.match(req, { ignoreSearch: false });
        if (hit) return clean(hit);
      }
      throw err;
    }
  })());
});
