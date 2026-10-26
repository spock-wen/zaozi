// e2e: D4 / R21 restore() 渲染出错不得删存档
// 基于测试复现脚本 qa/test/d4_restore.mjs
// 3 引擎 (chromium, firefox, webkit) × 2 视口 (1920x1080 desk, 375x667 touch)
//
// 注入点（r3/B1 复审）：打在 restore() 内部的 hideToast()/toast() 上，而不是 render()。
// app.js 里 window.__zz 装配完成之后紧接着就是 restore()。
// 锚点取「存档已被 loadFromStorage 读出」，不是「boot 后第 N 次查找」：restore() 开头的
// resetInputState()→hideToast() 同样会查 #toast，而那次在两个 try 之外——抛在那儿会把整个
// boot 脚本掀掉（st 不恢复、render() 不跑、什么提示都没有），于是两种码都不删存档，
// 用例在修复前后以同一条断言失败，就 vacuous 了。锚在读出存档之后，第一次查找才真的落在 try 里：
//   · 现码：hideToast()/toast() 在第二个 try 内 → 只走「渲染出错」提示，存档一个字节都不动；
//   · 旧码（d4_mutation.patch 打回去）：这两个调用在第一个 try 内 → 落进 catch，
//     先备份再 removeItem(SAVE_KEY)。
// 两种码都会真的触发这一次抛出，所以这条用例在修复前后都有效（不会 vacuous）。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, buildDist, startServer } from "./helpers/env.mjs";

buildDist();

let server;
const browsers = {};

before(async () => {
  server = await startServer();
  for (const [name, type] of Object.entries(ENGINES)) {
    browsers[name] = await type.launch();
  }
});

after(async () => {
  for (const b of Object.values(browsers)) await b.close();
  server?.close();
});

const CONFIGS = [
  { name: "1920x1080 desk", width: 1920, height: 1080, touch: false },
  { name: "375x667 touch", width: 375, height: 667, touch: true },
];

const SEED = 20261016;

for (const engine of Object.keys(ENGINES)) {
  for (const cfg of CONFIGS) {
    test(`${engine} ${cfg.name}: restore() 渲染出错不得删存档，去注入后进度完整恢复`, async () => {
      const opt = {
        viewport: { width: cfg.width, height: cfg.height },
        hasTouch: cfg.touch,
      };
      if (cfg.touch) {
        Object.assign(
          opt,
          engine === "firefox"
            ? { deviceScaleFactor: 3 }
            : { isMobile: true, deviceScaleFactor: 3 },
        );
      }
      const ctx = await browsers[engine].newContext(opt);
      const ls = (p) =>
        p.evaluate(() =>
          Object.fromEntries(
            Object.keys(localStorage)
              .sort()
              .map((k) => [k, localStorage.getItem(k)]),
          ),
        );
      const state = (p) =>
        p.evaluate(() =>
          window.__zz
            ? {
                cur: __zz.st.current,
                ph: __zz.st.phase,
                n: __zz.actions.length,
                toast: document.getElementById("toast")?.textContent.trim(),
              }
            : null,
        );

      try {
        let p = await ctx.newPage();
        await p.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await p.evaluate(() => localStorage.clear());
        await p.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await p.waitForFunction(() => !!window.__zz);
        await p.waitForTimeout(900);

        // 选两张左选项到达 T03（刻字阶段）
        for (let i = 0; i < 2; i++) {
          await p.waitForFunction(() => !__zz.animating && !(__zz.queued > 0));
          await p.waitForTimeout(400);
          const c = await p.evaluate(() => {
            const r = document.getElementById("opt-left").getBoundingClientRect();
            return [r.left + r.width / 2, r.top + r.height / 2];
          });
          cfg.touch ? await p.touchscreen.tap(c[0], c[1]) : await p.mouse.click(c[0], c[1]);
        }
        await p.waitForTimeout(1200);

        const before = await ls(p);
        const stBefore = await state(p);
        assert.ok(stBefore, "局面状态存在");
        assert.equal(stBefore.cur, "T03", "两次左选后应到达 T03");
        assert.equal(stBefore.n, 2, "动作数应为 2");

        const KEY =
          Object.keys(before).find((k) => /save/.test(k) && !/\.bak$/.test(k)) || null;
        assert.ok(KEY, "应存在有效存档 key");

        // 注入：restore() 读出存档之后的第一次 #toast/#toast-live 查找抛一次（见文件头说明）。
        // 用「存档已被 loadFromStorage 读出」当锚点：boot 期间只有 restore() 读 SAVE_KEY，
        // 而 resetInputState()→hideToast() 那次查找发生在读存档之前，天然被排除在外。
        await p.addInitScript((saveKey) => {
          const orig = Document.prototype.getElementById;
          const origGet = Storage.prototype.getItem;
          window.__d4 = { thrown: 0, read: 0 };
          Storage.prototype.getItem = function (k) {
            const v = origGet.call(this, k);
            if (k === saveKey && v != null) window.__d4.read = 1;
            return v;
          };
          Document.prototype.getElementById = function (id) {
            if (window.__d4.read && !window.__d4.thrown && (id === "toast" || id === "toast-live")) {
              window.__d4.thrown = 1;
              throw new Error("D4 注入的 toast 异常");
            }
            return orig.call(this, id);
          };
        }, KEY);

        await p.reload({ waitUntil: "load" });
        await p.waitForTimeout(1500);

        const d4 = await p.evaluate(() => ({
          thrown: window.__d4?.thrown || 0,
          read: window.__d4?.read || 0,
        }));
        assert.equal(d4.read, 1, "注入锚点应就位：restore() 须先读出存档（loadFromStorage 读过 SAVE_KEY）");
        assert.equal(d4.thrown, 1, "注入的 toast 异常应成功触发（落在 restore() 的 hideToast/toast 上）");

        const after = await ls(p);
        const stAfter = await state(p);

        // 断言：存档 key 仍存在，内容字节一致，不得降级备份删除
        assert.ok(KEY in after, `异常后存档 key ${KEY} 仍须存在（不得被删除）`);
        assert.equal(after[KEY], before[KEY], "异常后存档内容须与异常前字节一致（不得被覆写或清空）");
        assert.ok(!Object.keys(after).some((k) => /\.bak$/.test(k)), "异常后不得产生 .bak 备份");

        // 断言：提示通知可见，且走的是「渲染出错」那条 catch（不是「存档读不出来」那条）
        const toastText = await p.evaluate(() => document.getElementById("toast")?.textContent.trim() || "");
        assert.ok(toastText.length > 0, "渲染异常后应展示提示 notice");
        assert.ok(/^渲染出错/.test(toastText), `提示应报渲染出错，实际：${toastText}`);

        // 正常重载（去注入）后，进度完全恢复
        await p.close();
        p = await ctx.newPage();
        await p.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await p.waitForFunction(() => !!window.__zz);
        await p.waitForTimeout(1500);

        const rec = await ls(p);
        const stRec = await state(p);
        assert.ok(stRec, "恢复后局面状态存在");
        assert.equal(stRec.cur, stBefore.cur, `恢复后当前卡应恢复为 ${stBefore.cur}`);
        assert.equal(stRec.n, stBefore.n, `恢复后动作计数应恢复为 ${stBefore.n}`);
        assert.equal(rec[KEY], before[KEY], "恢复后存档内容与之前完全一致");
      } finally {
        await ctx.close();
      }
    });
  }
}
