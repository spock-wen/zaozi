// e2e 主流程：教学（T01–T05、第 3 张锁左右拖）→ 落字 → 抵达普通卡（卡面图 <picture> webp）→
// 目标小签/清单（打开不立刻收起，B8）→ 冬夜 → 结局 → 先人（无卡面图）→ 挑字（14 字池、键位）→ 第 2 代。
// 另含 D1/D2 双触发回归与「天亮了」不穿透（B7）。三引擎各跑 390 / 1280 / 1440。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ENGINES, SEED, ROOT, buildDist, startServer, collectErrors, firePointerThenClick } from "./helpers/env.mjs";
import { phase, current, commit, playToWinter, dragCard } from "./helpers/flow.mjs";

buildDist();

// 期望的达成横幅直接取自 goals.json，避免把文案抄死在测试里（P1：横幅必须是 banner）。
const GOALS = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "goals.json"), "utf8"));
const BANNER_DROP1 = GOALS.pool.find((g) => g.id === "G_DROP1").banner;

let server, browsers = {};
before(async () => {
  server = await startServer();
  for (const [name, type] of Object.entries(ENGINES)) browsers[name] = await type.launch();
});
after(async () => {
  for (const b of Object.values(browsers)) await b.close();
  server?.close();
});

const FLOW_VIEWPORTS = [
  { name: "390", width: 390, height: 844, hasTouch: true },
  { name: "1280", width: 1280, height: 800, hasTouch: false },
  { name: "1440", width: 1440, height: 900, hasTouch: false },
];

for (const [engine] of Object.entries(ENGINES)) {
  for (const vp of FLOW_VIEWPORTS) {
    test(`${engine} ${vp.name}: tutorial → card art → goals → winter → elder → pick → gen2`, async () => {
      const ctx = await browsers[engine].newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.hasTouch });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);
      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz);
        assert.equal(await current(page), "T01");
        assert.ok(await page.locator("#coach").isVisible(), "T01 应有教学气泡");

        await commit(page, "left");               // T01 → T02
        assert.equal(await current(page), "T02");
        await commit(page, "right");              // T02 → T03（锁定，一进来就是刻）
        assert.equal(await current(page), "T03");
        assert.equal(await phase(page), "engrave");

        // 锁卡拖动 → 专属提示；toast 不能盖住字匣（B11）
        await dragCard(page);
        const toastTxt = await page.locator("#toast").textContent();
        assert.ok(toastTxt.includes("骨片"), `锁卡提示应有「骨片」，得到：${toastTxt}`);
        const toast = await page.locator("#toast").boundingBox();
        const wb = await page.locator("#wordbox-bar").boundingBox();
        assert.ok(toast.y + toast.height <= wb.y + 2, "toast 不能盖住字匣");

        await page.locator("#bonecorner").click(); // 刻 → T04
        await page.waitForTimeout(300);
        assert.equal(await current(page), "T04");
        await page.locator("#wordbox .slot.ok").first().click(); // 落「水」→ T05
        await page.waitForTimeout(300);
        assert.equal(await current(page), "T05");
        // P1：落字达成 G_DROP1，屏幕上的横幅必须是 goals.json 的 banner（「达成　落一个字」），不是目标正文。
        await page.locator("#banner").waitFor({ state: "visible", timeout: 3000 });
        assert.equal(
          (await page.locator("#banner").textContent()).trim(),
          BANNER_DROP1,
          `达成横幅应显示 banner：「${BANNER_DROP1}」`,
        );
        await commit(page, "left");               // → 第一张普通卡

        // 卡面图：<picture> + webp（手机/桌面各选对应源）
        assert.ok(await page.locator("#card-art").isVisible(), "普通卡应有卡面图");
        assert.ok(await page.locator("#card-art picture").count() > 0, "卡面图应为 <picture>");
        assert.ok(await page.locator("#card-art source[type='image/webp']").count() > 0, "应有 webp source");
        await page.waitForFunction(() => {
          const i = document.querySelector("#card-art img");
          return i && i.complete && i.naturalWidth > 0;
        }, { timeout: 5000 });
        const src = await page.evaluate(() => document.querySelector("#card-art img").currentSrc);
        assert.match(src, /\.webp$/, `实际加载的卡面图应是 webp：${src}`);

        // 目标：小签可点，弹层打开后不会立刻被关掉（B8）。
        // 1440 侧栏默认展开，小签让位给侧栏里的目标清单，改在侧栏验目标存在。
        if (await page.locator("#goals-slip").isVisible()) {
          await page.locator("#goals-slip").click();
          await page.locator("#goals-panel").waitFor({ state: "visible", timeout: 2000 });
          await page.waitForTimeout(500);
          assert.ok(await page.locator("#goals-panel").isVisible(), "目标弹层打开后不能立刻收起");
          await page.evaluate(() => document.body.click());
          await page.waitForTimeout(100);
          assert.ok(!(await page.locator("#goals-panel").isVisible()), "点外面应收起目标弹层");
        } else {
          assert.ok((await page.locator("#sidebar-body").innerText()).length > 0, "侧栏展开时应有目标清单");
        }

        // 打到冬夜
        await playToWinter(page);
        assert.equal(await phase(page), "winter");

        // 点「天亮了」不能穿透到新翻出的「交给第2代」（B7）
        await page.locator("#winter-end").click();
        await page.waitForTimeout(80);
        assert.equal(await phase(page), "ended");
        assert.ok(!(await page.locator("#elder").isVisible()), "点天亮了不应立刻跳进先人");
        await page.locator("#endseq").waitFor({ state: "visible", timeout: 12000 });

        // 先人：无卡面图
        await page.locator("#endseq [data-do=elder]").click();
        await page.locator("#elder").waitFor({ state: "visible" });
        assert.equal(await page.locator("#elder picture, #elder .card-art, #elder img").count(), 0, "先人卡不能有卡面图");

        // 挑字：14 字池、季节标签已填、D1 单次选中
        await page.locator("#elder [data-do=heir]").click();
        await page.locator("#pick").waitFor({ state: "visible" });
        assert.equal(await page.locator("#pick .cand").count(), 14, "挑字候选应为 14 字池");
        assert.equal((await page.locator("#season-chip").textContent()).trim(), "春", "挑字阶段季节标签要填上");

        // gf5：挑字提示按档位（桌面 ← → / Space；手机点选引导），出发键文案为 gf5 两态之一
        const pickView = await page.evaluate(() => document.body.dataset.view);
        const pickHint = (await page.locator("#pick .season-note").textContent()).trim();
        const goEmpty = (await page.locator("#pick .go").textContent()).trim();
        assert.ok(["还差字", "带这三个字出发"].includes(goEmpty), `出发键文案应为 gf5 两态之一，得到：${goEmpty}`);
        assert.equal(goEmpty, "还差字", "未选满时应显示「还差字」");
        assert.ok(!(await page.locator("#pick .go").isEnabled()), "未选满时出发键应不可用");
        if (pickView === "desktop") {
          assert.ok(pickHint.includes("←") && pickHint.includes("→") && pickHint.includes("Space"), `桌面挑字提示应含 ← → 与 Space，得到：${pickHint}`);
        } else {
          assert.ok(pickHint.includes("再点一次带上"), `手机挑字提示应为点选引导，得到：${pickHint}`);
        }
        await firePointerThenClick(page, "#pick .cand[data-char='水']");
        await page.waitForTimeout(80);
        assert.deepEqual(await page.evaluate(() => window.__zz.st.picks), ["水"], "一次点击只能选一个字");
        await page.locator("#pick .cand[data-char='休']").click();
        await page.locator("#pick .cand[data-char='木']").click();
        await page.waitForTimeout(80);
        assert.ok(await page.locator("#pick .go").isEnabled(), "选满三个后出发键可用");
        assert.equal((await page.locator("#pick .go").textContent()).trim(), "带这三个字出发", "选满三个后按钮应为「带这三个字出发」");

        // 满了再点第 4 个：不该改动已选
        await firePointerThenClick(page, "#pick .cand[data-char='日']");
        await page.waitForTimeout(80);
        assert.equal((await page.evaluate(() => window.__zz.st.picks)).length, 3, "选满后不能再加");

        await page.locator("#pick .go").click();
        await page.waitForTimeout(400);
        assert.equal(await page.evaluate(() => window.__zz.st.generation), 2);
        assert.equal(await phase(page), "card");
        assert.deepEqual(await page.evaluate(() => window.__zz.st.wordBox), ["水", "休", "木"]);
        assert.equal((await page.evaluate(() => window.__zz.st.goals)).length, 3);

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}

// 桌面 1440：教学气泡距侧栏 ≥16px，且不压在四维行上（B3）
test("chromium 1440: tutorial bubble keeps clear of the dim row and the sidebar", async () => {
  const ctx = await browsers.chromium.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  try {
    await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
    await page.waitForFunction(() => !!window.__zz);
    await page.locator("#coach").waitFor({ state: "visible", timeout: 3000 });
    const coach = await page.locator("#coach").boundingBox();
    const dims = await page.locator("#dims-desktop").boundingBox();
    const sidebar = await page.locator("#sidebar").boundingBox();
    assert.ok(coach.y >= dims.y + dims.height - 1, `气泡不能压在四维行上：coach.y=${coach.y} dims底=${dims.y + dims.height}`);
    assert.ok(coach.x + coach.width <= sidebar.x - 16 + 1, `气泡距侧栏应 ≥16px：右缘 ${coach.x + coach.width}，侧栏 ${sidebar.x}`);
  } finally {
    await ctx.close();
  }
});

// 手机横屏：必须显示转竖屏提示（BREAKPOINTS）。用 <600 宽的窄屏横放（如 568×320）。
test("chromium 568×320: phone landscape shows rotate-to-portrait hint", async () => {
  const ctx = await browsers.chromium.newContext({ viewport: { width: 568, height: 320 } });
  const page = await ctx.newPage();
  try {
    await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
    await page.waitForFunction(() => !!window.__zz);
    assert.equal(await page.evaluate(() => document.body.dataset.view), "mobile");
    assert.equal(await page.evaluate(() => document.body.dataset.orient), "landscape");
    assert.ok(await page.locator("#rotate-hint").isVisible(), "手机横屏应显示转竖屏提示");
  } finally {
    await ctx.close();
  }
});
