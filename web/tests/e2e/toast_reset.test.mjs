// P2-1 回归：重新开局时必须立刻收起残留 toast。
// 缺陷（9462842）：T03 锁拖提示 toast 弹出后，点菜单「重新开局」，由于 newGame 未调 hideToast，
//                  toast 在新一局的前 1.8 秒依然浮在卡片上。
// 三引擎 × {360×640 touch, 390×664 touch, 1280×800 mouse}。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, SEED, buildDist, startServer, collectErrors } from "./helpers/env.mjs";
import { phase, current, commit } from "./helpers/flow.mjs";

buildDist();

let server, browsers = {};
before(async () => {
  server = await startServer();
  for (const [name, type] of Object.entries(ENGINES)) browsers[name] = await type.launch();
});
after(async () => {
  for (const b of Object.values(browsers)) await b.close();
  server?.close();
});

const VIEWPORTS = [
  { name: "360x640", width: 360, height: 640, view: "mobile" },
  { name: "390x664", width: 390, height: 664, view: "mobile" },
  { name: "1280x800", width: 1280, height: 800, view: "desktop" },
];

async function pressCard(page, isMobile) {
  const box = await page.locator("#card").boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  if (isMobile) {
    await page.touchscreen.tap(cx, cy);
  } else {
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.up();
  }
}

for (const engine of Object.keys(ENGINES)) {
  for (const vp of VIEWPORTS) {
    test(`${engine} ${vp.name}: 重新开局立刻隐藏 toast`, async () => {
      const ctx = await browsers[engine].newContext({
        viewport: { width: vp.width, height: vp.height },
        hasTouch: vp.view === "mobile",
      });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);
      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz);

        await commit(page, "left");               // T01 → T02
        await commit(page, "right");              // T02 → T03（锁拖，进刻）
        assert.equal(await current(page), "T03");
        assert.equal(await phase(page), "engrave");

        // 按卡触发锁拖 toast
        await pressCard(page, vp.view === "mobile");
        assert.ok(
          await page.locator("#toast").evaluate((e) => e.classList.contains("on")),
          "按下卡后 #toast 应显示（锁拖提示）",
        );

        // 打开 ☰ 菜单并点击「重新开局」
        if (vp.view === "mobile") {
          await page.locator("#menubtn").tap();
          await page.locator("#menu-pop").waitFor({ state: "visible" });
          await page.locator("#menu-pop [data-menu='new']").tap();
        } else {
          await page.locator("#menubtn").click();
          await page.locator("#menu-pop").waitFor({ state: "visible" });
          await page.locator("#menu-pop [data-menu='new']").click();
        }

        // within 150ms assert #toast does not have class "on" and its computed visibility is "hidden"
        await page.waitForTimeout(100);
        const toast = await page.locator("#toast").evaluate((e) => ({
          on: e.classList.contains("on"),
          visibility: getComputedStyle(e).visibility,
        }));
        assert.equal(toast.on, false, "#toast 不应还带 .on");
        assert.equal(toast.visibility, "hidden", "#toast 计算 visibility 应为 hidden");

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });

    test(`${engine} ${vp.name} [guard]: 锁拖提示下导入有效存档替换为导入成功 toast`, async () => {
      const ctx = await browsers[engine].newContext({
        viewport: { width: vp.width, height: vp.height },
        hasTouch: vp.view === "mobile",
      });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);
      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz);

        await commit(page, "left");               // T01 → T02
        await commit(page, "right");              // T02 → T03（锁拖，进刻）
        assert.equal(await current(page), "T03");

        await pressCard(page, vp.view === "mobile");
        const lockText = await page.locator("#toast").textContent();
        assert.ok(lockText.includes("先点卡角那道迹，才能刻"), "锁拖提示应出现");

        // 导入有效存档码，并通过 MutationObserver 捕获 hideToast() 与 toast() 的序列变化
        const result = await page.evaluate(() => {
          const t = document.getElementById("toast");
          const tl = document.getElementById("toast-live");
          const obs = new MutationObserver(() => {});
          if (tl) obs.observe(tl, { childList: true });
          if (t) obs.observe(t, { attributes: true, attributeFilter: ["class", "style"], attributeOldValue: true });

          const code = window.__zz.code();
          window.__zz.importCode(code);

          const records = obs.takeRecords().map((r) => ({
            target: r.target.id,
            type: r.type,
            attr: r.attributeName,
            old: r.oldValue,
            added: r.addedNodes ? Array.from(r.addedNodes).map((n) => n.textContent) : [],
            removed: r.removedNodes ? Array.from(r.removedNodes).map((n) => n.textContent) : [],
          }));
          obs.disconnect();
          return { records, newText: t ? t.textContent : "" };
        });

        assert.ok(result.newText.startsWith("导入成功"), `toast 文案应为导入成功，得到：${result.newText}`);
        assert.notEqual(result.newText, lockText, "toast 文案不能仍是锁拖提示");

        // 必须观测到 hideToast() 在新消息前先清空旧 toast
        const clearIndex = result.records.findIndex(
          (r) => r.target === "toast-live" && r.type === "childList" && r.added.length === 0 && r.removed.length > 0
        );
        assert.ok(
          clearIndex !== -1,
          "importCode() 必须调用 hideToast() 清空旧 toast (#toast-live 应产生 childList 清空记录)",
        );
        const newMsgIndex = result.records.findIndex(
          (r) => r.target === "toast-live" && r.type === "childList" && r.added.some((s) => s.startsWith("导入成功"))
        );
        assert.ok(
          newMsgIndex !== -1,
          "#toast-live 应记录到新消息「导入成功」的写入",
        );
        assert.ok(
          clearIndex < newMsgIndex,
          `hideToast() 的清空动作（记录 #${clearIndex}）必须在新消息写入（记录 #${newMsgIndex}）之前发生`,
        );

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });

    test(`${engine} ${vp.name} [guard]: 锁拖提示下读回存档替换为读回进度 toast`, async () => {
      const ctx = await browsers[engine].newContext({
        viewport: { width: vp.width, height: vp.height },
        hasTouch: vp.view === "mobile",
      });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);
      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz);

        await commit(page, "left");               // T01 → T02
        await commit(page, "right");              // T02 → T03（锁拖，进刻）
        assert.equal(await current(page), "T03");

        await pressCard(page, vp.view === "mobile");
        const lockText = await page.locator("#toast").textContent();
        assert.ok(lockText.includes("先点卡角那道迹，才能刻"), "锁拖提示应出现");

        // 读回上次进度，并通过 MutationObserver 捕获 hideToast() 与 toast() 的序列变化
        const result = await page.evaluate(() => {
          const t = document.getElementById("toast");
          const tl = document.getElementById("toast-live");
          const obs = new MutationObserver(() => {});
          if (tl) obs.observe(tl, { childList: true });
          if (t) obs.observe(t, { attributes: true, attributeFilter: ["class", "style"], attributeOldValue: true });

          const ok = window.__zz.restore();

          const records = obs.takeRecords().map((r) => ({
            target: r.target.id,
            type: r.type,
            attr: r.attributeName,
            old: r.oldValue,
            added: r.addedNodes ? Array.from(r.addedNodes).map((n) => n.textContent) : [],
            removed: r.removedNodes ? Array.from(r.removedNodes).map((n) => n.textContent) : [],
          }));
          obs.disconnect();
          return { ok, records, newText: t ? t.textContent : "" };
        });

        assert.equal(result.ok, true, "restore() 应成功读回存档");
        assert.ok(result.newText.startsWith("读回上次的进度"), `toast 文案应为读回上次的进度，得到：${result.newText}`);
        assert.notEqual(result.newText, lockText, "toast 文案不能仍是锁拖提示");

        // 必须观测到 hideToast() 在新消息前先清空旧 toast
        const clearIndex = result.records.findIndex(
          (r) => r.target === "toast-live" && r.type === "childList" && r.added.length === 0 && r.removed.length > 0
        );
        assert.ok(
          clearIndex !== -1,
          "restore() 必须调用 hideToast() 清空旧 toast (#toast-live 应产生 childList 清空记录)",
        );
        const newMsgIndex = result.records.findIndex(
          (r) => r.target === "toast-live" && r.type === "childList" && r.added.some((s) => s.startsWith("读回上次的进度"))
        );
        assert.ok(
          newMsgIndex !== -1,
          "#toast-live 应记录到新消息「读回上次的进度」的写入",
        );
        assert.ok(
          clearIndex < newMsgIndex,
          `hideToast() 的清空动作（记录 #${clearIndex}）必须在新消息写入（记录 #${newMsgIndex}）之前发生`,
        );

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}
