// e2e: D4 / R21 restore() 渲染出错不得删存档
// 基于测试复现脚本 qa/test/d4_restore.mjs
// 3 引擎 (chromium, firefox, webkit) × 2 视口 (1920x1080 desk, 375x667 touch)
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
          Object.keys(before).find((k) => !/keyhelp|mute|\.bak$/.test(k) && /save|zaozi/.test(k)) || null;
        assert.ok(KEY, "应存在有效存档 key");

        // 注入：首次取 "dims" 时抛出渲染异常
        await p.addInitScript(() => {
          const orig = Document.prototype.getElementById;
          let hit = 0;
          window.__d4 = { thrown: 0 };
          Document.prototype.getElementById = function (id) {
            if (id === "dims" && !hit) {
              hit = 1;
              window.__d4.thrown = 1;
              throw new Error("D4 注入的渲染异常");
            }
            return orig.call(this, id);
          };
        });

        await p.reload({ waitUntil: "load" });
        await p.waitForTimeout(1500);

        const thrown = await p.evaluate(() => window.__d4?.thrown || 0);
        assert.equal(thrown, 1, "注入的渲染异常应成功触发");

        const after = await ls(p);
        const stAfter = await state(p);

        // 断言：存档 key 仍存在，内容字节一致，不得降级备份删除
        assert.ok(KEY in after, `异常后存档 key ${KEY} 仍须存在（不得被删除）`);
        assert.equal(after[KEY], before[KEY], "异常后存档内容须与异常前字节一致（不得被覆写或清空）");
        assert.ok(!Object.keys(after).some((k) => /\.bak$/.test(k)), "异常后不得产生 .bak 备份");

        // 断言：提示通知可见
        const toastText = await p.evaluate(() => document.getElementById("toast")?.textContent.trim() || "");
        assert.ok(toastText.length > 0, "渲染异常后应展示提示 notice");

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
