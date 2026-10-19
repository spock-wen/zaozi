// P2-5 回归：按阶段区分键盘文案（无骨片不提 K/刻字/骨片）。
// 缺陷（9462842）：普通卡阶段（卡角无骨片）的 #keys、#gesture-hint 与 keyhelp 浮层中依然出现
//                  「K 刻字」、「K/Enter」、「刻字（或点卡角骨片）」、「骨片」等文案。
// 三引擎 × {1280×800 mouse (tier N), 1280×700 mouse (tier A), 1280×600 mouse (tier B)}。
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
  { name: "1280x800", width: 1280, height: 800, tier: "N" },
  { name: "1280x700", width: 1280, height: 700, tier: "A" },
  { name: "1280x600", width: 1280, height: 600, tier: "B" },
];

async function assertVisible(locator, label) {
  assert.ok(await locator.isVisible(), `${label} Playwright isVisible 应为 true`);
  const metrics = await locator.evaluate((el) => {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const inViewport =
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.left < window.innerWidth &&
      rect.top < window.innerHeight;
    return {
      display: cs.display,
      visibility: cs.visibility,
      opacity: parseFloat(cs.opacity || "1"),
      rect: { width: rect.width, height: rect.height, x: rect.x, y: rect.y },
      inViewport,
    };
  });
  assert.notEqual(metrics.display, "none", `${label} computed display 不能为 none`);
  assert.notEqual(metrics.visibility, "hidden", `${label} computed visibility 不能为 hidden`);
  assert.ok(metrics.opacity > 0, `${label} computed opacity 必须大于 0`);
  assert.ok(metrics.inViewport, `${label} bounding box 必须非零且在视口内`);
}

for (const engine of Object.keys(ENGINES)) {
  for (const vp of VIEWPORTS) {
    test(`${engine} ${vp.name} (tier ${vp.tier}): 键盘文案仅在刻字阶段（有骨片）出现 K/刻/骨片`, async () => {
      const ctx = await browsers[engine].newContext({
        viewport: { width: vp.width, height: vp.height },
        hasTouch: false,
      });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);
      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz);

        // 1) 检查普通卡阶段（T01，phase="card"，卡角骨片不可见）
        assert.equal(await current(page), "T01");
        assert.equal(await phase(page), "card");

        // P3-2：断言 #bonecorner 存在于 DOM 中，且计算 display 为 "none"
        const bonecorner = page.locator("#bonecorner");
        assert.equal(await bonecorner.count(), 1, "#bonecorner 元素应存在于 DOM 中");
        const bonecornerHidden = await bonecorner.evaluate((bc) => getComputedStyle(bc).display === "none");
        assert.ok(bonecornerHidden, "普通卡阶段 #bonecorner 应隐藏（computed display 为 'none'）");

        const keysLocator = page.locator("#keys");
        const gestureLocator = page.locator("#gesture-hint");

        // P2-7 part 2：根据不同 tier 检验真正向用户展示键位提示的元素可见性与文案
        if (vp.tier === "N") {
          // tier N (1280x800)：#keys 与 #gesture-hint 均对用户可见
          await assertVisible(keysLocator, "普通阶段 tier N #keys");
          await assertVisible(gestureLocator, "普通阶段 tier N #gesture-hint");

          const keysTextNormal = (await keysLocator.textContent()) || "";
          const gestureTextNormal = (await gestureLocator.textContent()) || "";

          // 正向检查：可见的键位提示元素内容非空
          assert.ok(keysTextNormal.trim().length > 0, "普通阶段 tier N #keys 文本应非空");
          assert.ok(gestureTextNormal.trim().length > 0, "普通阶段 tier N #gesture-hint 文本应非空");

          for (const forbidden of ["K 刻字", "K刻", "骨片"]) {
            assert.ok(!keysTextNormal.includes(forbidden), `普通阶段 #keys 不应包含「${forbidden}」，实际为：${keysTextNormal}`);
          }
          assert.ok(!gestureTextNormal.includes("K 刻字"), `普通阶段 #gesture-hint 不应包含「K 刻字」，实际为：${gestureTextNormal}`);
          assert.ok(!gestureTextNormal.includes("骨片"), `普通阶段 #gesture-hint 不应包含「骨片」，实际为：${gestureTextNormal}`);
        } else if (vp.tier === "A") {
          // tier A (1280x700)：#gesture-hint 为 display:none，向用户展示键位的是 #keys
          const gestureDisplay = await gestureLocator.evaluate((el) => getComputedStyle(el).display);
          assert.equal(gestureDisplay, "none", "tier A 矮屏下 #gesture-hint 应为 display:none");

          await assertVisible(keysLocator, "普通阶段 tier A #keys");
          const keysTextNormal = (await keysLocator.textContent()) || "";

          // 正向检查：可见的键位行内容非空
          assert.ok(keysTextNormal.trim().length > 0, "普通阶段 tier A #keys 文本应非空");

          for (const forbidden of ["K 刻字", "K刻", "骨片"]) {
            assert.ok(!keysTextNormal.includes(forbidden), `普通阶段 #keys 不应包含「${forbidden}」，实际为：${keysTextNormal}`);
          }
        } else if (vp.tier === "B") {
          // tier B (1280x600)：#keys 与 #gesture-hint 均为 display:none，向用户展示键位的是顶栏「?」浮层
          if (await page.locator("#keyhelp-pop").isHidden()) {
            await page.locator("#keyhelp-btn").click();
          }
          await page.locator("#keyhelp-pop").waitFor({ state: "visible" });
          await assertVisible(page.locator("#keyhelp-pop"), "普通阶段 tier B #keyhelp-pop 浮层");

          const popText = (await page.locator("#keyhelp-pop").innerText()) || "";
          assert.ok(popText.trim().length > 0, "普通阶段 keyhelp 浮层文本应非空");

          const popRows = await page.$$eval("#keyhelp-pop .kh-row", (els) =>
            els.map((e) => ({ key: e.querySelector("b")?.textContent?.trim() || "", desc: e.querySelector("span")?.textContent?.trim() || "" }))
          );
          // P3-2：在 some/!some 检查前先断言 popRows.length > 0
          assert.ok(popRows.length > 0, "普通阶段 keyhelp 浮层行数应大于 0");

          for (const forbidden of ["K 刻字", "K刻", "刻字（或点卡角骨片）", "骨片"]) {
            assert.ok(!popText.includes(forbidden), `普通阶段 keyhelp 浮层不应包含「${forbidden}」，实际为：${popText}`);
          }
          const hasKRow = popRows.some((r) => r.key === "K");
          assert.ok(!hasKRow, "普通阶段 keyhelp 浮层不应包含按键为 K 的行");
        }

        // 2) 前进到 T03（刻字阶段，骨片可见）
        await commit(page, "left");               // T01 → T02
        await commit(page, "right");              // T02 → T03
        assert.equal(await current(page), "T03");
        assert.equal(await phase(page), "engrave");

        // P3-2：断言 #bonecorner 存在于 DOM 中且可见
        assert.equal(await bonecorner.count(), 1, "#bonecorner 元素应存在于 DOM 中");
        await assertVisible(bonecorner, "T03 刻字阶段 #bonecorner");

        const keysTextEngrave = (await keysLocator.textContent()) || "";
        const gestureTextEngrave = (await gestureLocator.textContent()) || "";

        // 刻字阶段 (T03)：断言 K 提示在各 tier (N/A/B) 均对用户真实可见
        if (vp.tier === "N") {
          await assertVisible(keysLocator, "刻字阶段 tier N #keys");
          await assertVisible(gestureLocator, "刻字阶段 tier N #gesture-hint");
          assert.ok(keysTextEngrave.includes("K 刻字"), `刻字阶段 tier N #keys 应包含「K 刻字」，实际为：${keysTextEngrave}`);
          assert.ok(gestureTextEngrave.includes("K 刻字"), `刻字阶段 tier N #gesture-hint 应包含「K 刻字」，实际为：${gestureTextEngrave}`);
          assert.ok(!keysTextEngrave.includes("Enter 刻"), `刻字阶段 tier N #keys 不应声明 Enter 刻，实际为：${keysTextEngrave}`);
        } else if (vp.tier === "A") {
          await assertVisible(keysLocator, "刻字阶段 tier A #keys");
          assert.ok(keysTextEngrave.includes("K刻"), `刻字阶段 tier A #keys 应包含「K刻」，实际为：${keysTextEngrave}`);
          assert.ok(!keysTextEngrave.includes("Enter"), `刻字阶段 tier A #keys 绝不应声明 Enter 刻，实际为：${keysTextEngrave}`);
        } else if (vp.tier === "B") {
          if (await page.locator("#keyhelp-pop").isHidden()) {
            await page.locator("#keyhelp-btn").click();
          }
          await page.locator("#keyhelp-pop").waitFor({ state: "visible" });
          await assertVisible(page.locator("#keyhelp-pop"), "刻字阶段 tier B #keyhelp-pop 浮层");

          const popRows = await page.$$eval("#keyhelp-pop .kh-row", (els) =>
            els.map((e) => ({ key: e.querySelector("b")?.textContent?.trim() || "", desc: e.querySelector("span")?.textContent?.trim() || "" }))
          );
          // P3-2：在 some/!some 检查前先断言 popRows.length > 0
          assert.ok(popRows.length > 0, "刻字阶段 keyhelp 浮层行数应大于 0");

          const hasKRow = popRows.some((r) => r.key === "K" && r.desc.includes("刻"));
          assert.ok(hasKRow, "刻字阶段 keyhelp 浮层应包含按键为 K 的刻字行");
          const hasEnterRow = popRows.some((r) => r.key === "Enter" && r.desc.includes("刻"));
          assert.ok(!hasEnterRow, "刻字阶段 keyhelp 浮层绝不应声明按键为 Enter 的刻字行");
          const hasSRow = popRows.some((r) => r.key === "S" && r.desc.includes("先不刻"));
          assert.ok(hasSRow, "刻字阶段 keyhelp 浮层应包含按键为 S 的先不刻行");

          // 断言浮层中包含 K 的提示行对用户真实可见
          const kRowLocator = page.locator("#keyhelp-pop .kh-row").filter({ has: page.locator("b", { hasText: "K" }) });
          await assertVisible(kRowLocator, "刻字阶段 tier B #keyhelp-pop 中的 K 提示行");
        }

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}

// P3-3: 校验 390x844, 360x800 和 1280x720 视口下 T03 提示不宣称 Enter 刻且文本无溢出 (scrollWidth <= clientWidth)
const FIT_VIEWPORTS = [
  { name: "390x844", width: 390, height: 844, isMobile: true },
  { name: "360x800", width: 360, height: 800, isMobile: true },
  { name: "1280x720", width: 1280, height: 720, isMobile: false },
];

for (const engine of Object.keys(ENGINES)) {
  for (const vp of FIT_VIEWPORTS) {
    test(`${engine} ${vp.name}: T03 刻字阶段按键提示不宣称 Enter 刻且文本无溢出 (scrollWidth <= clientWidth)`, async () => {
      const ctx = await browsers[engine].newContext({
        viewport: { width: vp.width, height: vp.height },
        hasTouch: vp.isMobile,
      });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);

      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.evaluate(() => localStorage.clear());
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz && window.__zz.st?.phase === "card");

        // 前进到 T03（刻字阶段）
        await commit(page, "left");
        await commit(page, "right");
        assert.equal(await current(page), "T03");
        assert.equal(await phase(page), "engrave");

        if (vp.isMobile) {
          // 移动端：手势提示行与卡下落字框
          const hint = page.locator("#gesture-hint");
          const hintText = (await hint.textContent()) || "";
          assert.ok(!hintText.includes("Enter 刻") && !hintText.includes("Enter刻"), `手势提示不应宣称 Enter 刻：${hintText}`);
          const hintFits = await hint.evaluate((el) => el.scrollWidth <= el.clientWidth);
          assert.ok(hintFits, `#gesture-hint 文本无溢出 (scrollWidth <= clientWidth)`);

          const drops = page.locator(".card-drops");
          const dropsFits = await drops.evaluate((el) => el.scrollWidth <= el.clientWidth);
          assert.ok(dropsFits, `.card-drops 文本无溢出 (scrollWidth <= clientWidth)`);
        } else {
          // 桌面 1280x720 (tier A)：底部键位行
          const keys = page.locator("#keys");
          const keysText = (await keys.textContent()) || "";
          assert.ok(keysText.includes("K刻"), `1280x720 tier A #keys 应包含「K刻」：${keysText}`);
          assert.ok(!keysText.includes("Enter"), `1280x720 tier A #keys 不应包含 Enter 刻：${keysText}`);
          const keysFits = await keys.evaluate((el) => el.scrollWidth <= el.clientWidth);
          assert.ok(keysFits, `#keys 键位行文本无溢出 (scrollWidth <= clientWidth)`);
        }

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}

