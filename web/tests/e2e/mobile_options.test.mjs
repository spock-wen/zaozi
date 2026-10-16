// e2e: 移动端与平板竖屏选项按钮覆盖（TASK A）。
// 视口：360×640 (mobile), 390×844 (mobile), 390×664 (mobile), 768×1024 (tablet-portrait), 1280×800 (desktop)。
// 三引擎全跑：验证左右选项按钮可见、在视口内、未被遮挡、文字正确、位于卡片下方（移动端与平板竖屏）、
// 点击提交推进卡片、拖拽预览高亮。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ENGINES, SEED, buildDist, startServer, collectErrors, DIST } from "./helpers/env.mjs";

buildDist();

const CARDS_DATA = JSON.parse(
  fs.readFileSync(path.join(DIST, "data", "year1_cards.json"), "utf8"),
).cards;
const cardById = (id) => CARDS_DATA.find((c) => c.id === id);

const VIEWPORTS = [
  { name: "360x640", width: 360, height: 640, view: "mobile" },
  { name: "390x844", width: 390, height: 844, view: "mobile" },
  { name: "390x664", width: 390, height: 664, view: "mobile" },
  { name: "768x1024", width: 768, height: 1024, view: "tablet-portrait" },
  { name: "1280x800", width: 1280, height: 800, view: "desktop" },
];

let server, browsers = {};
before(async () => {
  server = await startServer();
  for (const [name, type] of Object.entries(ENGINES)) browsers[name] = await type.launch();
});
after(async () => {
  for (const b of Object.values(browsers)) await b.close();
  server?.close();
});

for (const [engine] of Object.entries(ENGINES)) {
  for (const vp of VIEWPORTS) {
    test(`${engine} ${vp.name}: mobile / tablet options buttons & commit flow`, async () => {
      const ctx = await browsers[engine].newContext({
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);

      try {
        // 1. 打开首页，等待 window.__zz 初始化，断言 phase === "card" 与 body.dataset.view
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz && !!window.__zz.st);
        assert.equal(await page.evaluate(() => window.__zz.st.phase), "card", "开局应在 card 阶段");
        assert.equal(await page.evaluate(() => document.body.dataset.view), vp.view, "布局档位应与预期一致");

        // 2. #opt-left 与 #opt-right：可见、包围盒在视口内、尺寸 ≥ 44×44、未被其他元素覆盖
        const optL = page.locator("#opt-left");
        const optR = page.locator("#opt-right");
        assert.ok(await optL.isVisible(), "#opt-left 必须可见");
        assert.ok(await optR.isVisible(), "#opt-right 必须可见");

        const boxL = await optL.boundingBox();
        const boxR = await optR.boundingBox();
        assert.ok(boxL, "#opt-left 必须有包围盒");
        assert.ok(boxR, "#opt-right 必须有包围盒");

        assert.ok(
          boxL.x >= -1 && boxL.y >= -1 && boxL.x + boxL.width <= vp.width + 1 && boxL.y + boxL.height <= vp.height + 1,
          `#opt-left 应完全在视口内: ${JSON.stringify(boxL)} (视口 ${vp.width}×${vp.height})`,
        );
        assert.ok(
          boxR.x >= -1 && boxR.y >= -1 && boxR.x + boxR.width <= vp.width + 1 && boxR.y + boxR.height <= vp.height + 1,
          `#opt-right 应完全在视口内: ${JSON.stringify(boxR)} (视口 ${vp.width}×${vp.height})`,
        );

        assert.ok(boxL.width >= 44 && boxL.height >= 44, `#opt-left 尺寸 ${boxL.width}×${boxL.height} < 44`);
        assert.ok(boxR.width >= 44 && boxR.height >= 44, `#opt-right 尺寸 ${boxR.width}×${boxR.height} < 44`);

        const hitL = await page.evaluate(() => {
          const el = document.querySelector("#opt-left");
          const r = el.getBoundingClientRect();
          const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return top ? (top === el || el.contains(top) ? "self" : (top.id || top.className || top.tagName)) : "none";
        });
        assert.equal(hitL, "self", `#opt-left 中心点不应被其他元素覆盖，实际命中: ${hitL}`);

        const hitR = await page.evaluate(() => {
          const el = document.querySelector("#opt-right");
          const r = el.getBoundingClientRect();
          const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return top ? (top === el || el.contains(top) ? "self" : (top.id || top.className || top.tagName)) : "none";
        });
        assert.equal(hitR, "self", `#opt-right 中心点不应被其他元素覆盖，实际命中: ${hitR}`);

        // 3. 按钮文字匹配当前卡片数据（T01）
        const curId = await page.evaluate(() => window.__zz.st.current);
        const cardT01 = cardById(curId);
        assert.ok(cardT01, `找不到卡片数据: ${curId}`);
        const textL = await optL.innerText();
        const textR = await optR.innerText();
        assert.ok(
          textL.includes(cardT01.left.label),
          `#opt-left 应包含 "${cardT01.left.label}"，实际为 "${textL}"`,
        );
        assert.ok(
          textR.includes(cardT01.right.label),
          `#opt-right 应包含 "${cardT01.right.label}"，实际为 "${textR}"`,
        );

        // 4. 在手机与平板竖屏下，两按钮均在卡片正下方：box.y >= #cardwrap bottom - 1
        if (vp.view === "mobile" || vp.view === "tablet-portrait") {
          const wrapBox = await page.locator("#cardwrap").boundingBox();
          assert.ok(wrapBox, "#cardwrap 必须有包围盒");
          assert.ok(
            boxL.y >= wrapBox.y + wrapBox.height - 1,
            `#opt-left 必须在卡片下方: boxL.y=${boxL.y}, wrapBottom=${wrapBox.y + wrapBox.height}`,
          );
          assert.ok(
            boxR.y >= wrapBox.y + wrapBox.height - 1,
            `#opt-right 必须在卡片下方: boxR.y=${boxR.y}, wrapBottom=${wrapBox.y + wrapBox.height}`,
          );
          assert.ok(
            boxR.x + boxR.width - boxL.x >= wrapBox.width - 1,
            `选项行跨度应至少达到卡片宽度: ${boxR.x + boxR.width - boxL.x} >= ${wrapBox.width - 1}`,
          );
        }

        // 6. 拖拽高亮检查（针对 390×844 和 360×640）
        if (vp.name === "360x640" || vp.name === "390x844") {
          const cardBox = await page.locator("#card").boundingBox();
          assert.ok(cardBox, "#card 必须有包围盒");
          const cx = cardBox.x + cardBox.width / 2;
          const cy = cardBox.y + cardBox.height / 2;
          const dragDist = cardBox.width * 0.25;

          await page.mouse.move(cx, cy);
          await page.mouse.down();

          // 向左移动 ~25%（未达 35% 提交阈值）
          await page.mouse.move(cx - dragDist, cy, { steps: 5 });
          await page.waitForFunction(() => document.querySelector("#opt-left")?.classList.contains("on"));
          assert.ok(
            await page.evaluate(() => document.querySelector("#opt-left")?.classList.contains("on")),
            "向左拖动时 #opt-left 应有 on 高亮类",
          );
          assert.ok(
            !(await page.evaluate(() => document.querySelector("#opt-right")?.classList.contains("on"))),
            "向左拖动时 #opt-right 不应有 on 高亮类",
          );
          assert.ok(await optL.isVisible(), "拖动过程中 #opt-left 保持可见");
          assert.ok(await optR.isVisible(), "拖动过程中 #opt-right 保持可见");

          // 向右移动 ~25%
          await page.mouse.move(cx + dragDist, cy, { steps: 10 });
          await page.waitForFunction(() => document.querySelector("#opt-right")?.classList.contains("on"));
          assert.ok(
            !(await page.evaluate(() => document.querySelector("#opt-left")?.classList.contains("on"))),
            "向右拖动时 #opt-left 不应有 on 高亮类",
          );
          assert.ok(
            await page.evaluate(() => document.querySelector("#opt-right")?.classList.contains("on")),
            "向右拖动时 #opt-right 应有 on 高亮类",
          );
          assert.ok(await optL.isVisible(), "拖动过程中 #opt-left 保持可见");
          assert.ok(await optR.isVisible(), "拖动过程中 #opt-right 保持可见");

          // 回移到起点并释放（不触发提交）
          await page.mouse.move(cx, cy, { steps: 5 });
          await page.mouse.up();
          await page.waitForFunction(() => !window.__zz.animating, null, { timeout: 3000 });
          assert.equal(
            await page.evaluate(() => window.__zz.st.current),
            "T01",
            "未达阈值释放后不应提交，保持 T01",
          );
        }

        // 5. 点击 #opt-left（真实 click）-> 飞出结算后 st.current 变为 T02，选项更新为 T02 文本
        await optL.click();
        await page.waitForFunction(() => window.__zz.st.current === "T02", null, { timeout: 5000 });
        await page.waitForFunction(() => !window.__zz.animating, null, { timeout: 5000 });

        const stAfterLeft = await page.evaluate(() => ({
          dims: window.__zz.st.dims,
          log: window.__zz.st.log,
        }));
        assert.equal(stAfterLeft.dims.faith, 56, "T01 左选后 faith 应增加到 56");
        assert.ok(
          stAfterLeft.log[stAfterLeft.log.length - 1].includes("左"),
          `st.log 应包含向左提交记录: ${stAfterLeft.log}`,
        );

        const cardT02 = cardById("T02");
        const t02TextL = await optL.innerText();
        const t02TextR = await optR.innerText();
        assert.ok(
          t02TextL.includes(cardT02.left.label),
          `T02 #opt-left 应显示 "${cardT02.left.label}"，实际为 "${t02TextL}"`,
        );
        assert.ok(
          t02TextR.includes(cardT02.right.label),
          `T02 #opt-right 应显示 "${cardT02.right.label}"，实际为 "${t02TextR}"`,
        );

        // 5 (续). 新独立上下文测试：点击 #opt-right on T01 -> 验证右选项提交推进与数值变化（memory 变为 56）
        const ctxR = await browsers[engine].newContext({
          viewport: { width: vp.width, height: vp.height },
        });
        const pageR = await ctxR.newPage();
        collectErrors(pageR, errs);
        try {
          await pageR.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
          await pageR.waitForFunction(() => !!window.__zz && window.__zz.st?.current === "T01");
          await pageR.locator("#opt-right").click();
          await pageR.waitForFunction(() => window.__zz.st.current === "T02", null, { timeout: 5000 });
          await pageR.waitForFunction(() => !window.__zz.animating, null, { timeout: 5000 });

          const stAfterRight = await pageR.evaluate(() => ({
            dims: window.__zz.st.dims,
            log: window.__zz.st.log,
          }));
          assert.equal(stAfterRight.dims.memory, 56, "T01 右选后 memory 应增加到 56");
          assert.ok(
            stAfterRight.log[stAfterRight.log.length - 1].includes("右"),
            `st.log 应包含向右提交记录: ${stAfterRight.log}`,
          );
        } finally {
          await ctxR.close();
        }

        // 7. 无页面报错
        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}

// ---------- TOUCH 测试覆盖（手机真实触控场景） ----------
const TOUCH_TAP_VIEWPORTS = [
  { name: "360x640", width: 360, height: 640, view: "mobile" },
  { name: "390x844", width: 390, height: 844, view: "mobile" },
  { name: "390x664", width: 390, height: 664, view: "mobile" },
  { name: "768x1024", width: 768, height: 1024, view: "tablet-portrait" },
];

const TOUCH_DRAG_VIEWPORTS = [
  { name: "360x640", width: 360, height: 640 },
  { name: "390x844", width: 390, height: 844 },
];

// 1. 各引擎 x 手机/平板竖屏视口：locator.tap() 触控提交左右选项
for (const [engine] of Object.entries(ENGINES)) {
  for (const vp of TOUCH_TAP_VIEWPORTS) {
    test(`${engine} ${vp.name}: touch tap options buttons commit flow`, async () => {
      const ctx = await browsers[engine].newContext({
        viewport: { width: vp.width, height: vp.height },
        hasTouch: true,
      });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);

      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz && !!window.__zz.st);
        assert.equal(await page.evaluate(() => window.__zz.st.current), "T01", "开局应在 T01");

        const optL = page.locator("#opt-left");
        const optR = page.locator("#opt-right");
        assert.ok(await optL.isVisible(), "#opt-left 必须可见");
        assert.ok(await optR.isVisible(), "#opt-right 必须可见");

        // on T01 locator("#opt-left").tap() commits left
        await optL.tap();
        await page.waitForFunction(() => window.__zz.st.current === "T02", null, { timeout: 5000 });
        await page.waitForFunction(() => !window.__zz.animating, null, { timeout: 5000 });

        const stAfterLeft = await page.evaluate(() => ({
          dims: window.__zz.st.dims,
          log: window.__zz.st.log,
        }));
        assert.equal(stAfterLeft.dims.faith, 56, "T01 左选后 faith 应增加到 56");
        assert.ok(
          stAfterLeft.log[stAfterLeft.log.length - 1].includes("左"),
          `st.log 应包含向左提交记录: ${stAfterLeft.log}`,
        );

        const cardT02 = cardById("T02");
        const t02TextL = await optL.innerText();
        const t02TextR = await optR.innerText();
        assert.ok(
          t02TextL.includes(cardT02.left.label),
          `T02 #opt-left 应显示 "${cardT02.left.label}"，实际为 "${t02TextL}"`,
        );
        assert.ok(
          t02TextR.includes(cardT02.right.label),
          `T02 #opt-right 应显示 "${cardT02.right.label}"，实际为 "${t02TextR}"`,
        );

        // in a fresh hasTouch context, tap #opt-right commits right
        const ctxR = await browsers[engine].newContext({
          viewport: { width: vp.width, height: vp.height },
          hasTouch: true,
        });
        const pageR = await ctxR.newPage();
        collectErrors(pageR, errs);
        try {
          await pageR.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
          await pageR.waitForFunction(() => !!window.__zz && window.__zz.st?.current === "T01");
          await pageR.locator("#opt-right").tap();
          await pageR.waitForFunction(() => window.__zz.st.current === "T02", null, { timeout: 5000 });
          await pageR.waitForFunction(() => !window.__zz.animating, null, { timeout: 5000 });

          const stAfterRight = await pageR.evaluate(() => ({
            dims: window.__zz.st.dims,
            log: window.__zz.st.log,
          }));
          assert.equal(stAfterRight.dims.memory, 56, "T01 右选后 memory 应增加到 56");
          assert.ok(
            stAfterRight.log[stAfterRight.log.length - 1].includes("右"),
            `st.log 应包含向右提交记录: ${stAfterRight.log}`,
          );
        } finally {
          await ctxR.close();
        }

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}

// 2. 触控拖拽高亮检查（360×640 与 390×844，hasTouch: true）
for (const [engine] of Object.entries(ENGINES)) {
  for (const vp of TOUCH_DRAG_VIEWPORTS) {
    test(`${engine} ${vp.name}: touch drag highlight & release on #card`, async () => {
      const ctx = await browsers[engine].newContext({
        viewport: { width: vp.width, height: vp.height },
        hasTouch: true,
      });
      const page = await ctx.newPage();
      const errs = [];
      collectErrors(page, errs);

      try {
        await page.goto(`${server.origin}/?seed=${SEED}`, { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__zz && window.__zz.st?.current === "T01");

        // 若 app 处理器内 setPointerCapture 在合成事件下抛错（例如 Firefox 无效 pointerId），在此安全包装
        await page.evaluate(() => {
          const orig = Element.prototype.setPointerCapture;
          Element.prototype.setPointerCapture = function (...args) {
            try {
              return orig.apply(this, args);
            } catch {
              // 忽略合成指针捕获异常
            }
          };
        });

        const cardLocator = page.locator("#card");
        const cardBox = await cardLocator.boundingBox();
        assert.ok(cardBox, "#card 必须有包围盒");
        const cx = cardBox.x + cardBox.width / 2;
        const cy = cardBox.y + cardBox.height / 2;
        const cardWidth = cardBox.width;
        const optL = page.locator("#opt-left");
        const optR = page.locator("#opt-right");

        // pointerdown at card centre on #card
        await page.evaluate(({ cx, cy }) => {
          const card = document.querySelector("#card");
          card.dispatchEvent(new PointerEvent("pointerdown", {
            pointerId: 1,
            pointerType: "touch",
            isPrimary: true,
            clientX: cx,
            clientY: cy,
            bubbles: true,
            cancelable: true,
          }));
        }, { cx, cy });

        // several pointermove to cx - 0.25*cardWidth (app.js 在 window 上监听 pointermove)
        await page.evaluate(({ cx, cy, cardWidth }) => {
          const targetX = cx - 0.25 * cardWidth;
          for (let i = 1; i <= 5; i++) {
            const curX = cx + (targetX - cx) * (i / 5);
            window.dispatchEvent(new PointerEvent("pointermove", {
              pointerId: 1,
              pointerType: "touch",
              isPrimary: true,
              clientX: curX,
              clientY: cy,
              bubbles: true,
              cancelable: true,
            }));
          }
        }, { cx, cy, cardWidth });

        // assert #opt-left has class "on" and #opt-right not and both visible
        await page.waitForFunction(() => document.querySelector("#opt-left")?.classList.contains("on"));
        assert.ok(
          await page.evaluate(() => document.querySelector("#opt-left")?.classList.contains("on")),
          "向左触控拖动时 #opt-left 应有 on 高亮类",
        );
        assert.ok(
          !(await page.evaluate(() => document.querySelector("#opt-right")?.classList.contains("on"))),
          "向左触控拖动时 #opt-right 不应有 on 高亮类",
        );
        assert.ok(await optL.isVisible(), "触控拖动中 #opt-left 保持可见");
        assert.ok(await optR.isVisible(), "触控拖动中 #opt-right 保持可见");

        // pointermove to cx + 0.25*cardWidth (app.js 在 window 上监听 pointermove)
        await page.evaluate(({ cx, cy, cardWidth }) => {
          const startX = cx - 0.25 * cardWidth;
          const targetX = cx + 0.25 * cardWidth;
          for (let i = 1; i <= 10; i++) {
            const curX = startX + (targetX - startX) * (i / 10);
            window.dispatchEvent(new PointerEvent("pointermove", {
              pointerId: 1,
              pointerType: "touch",
              isPrimary: true,
              clientX: curX,
              clientY: cy,
              bubbles: true,
              cancelable: true,
            }));
          }
        }, { cx, cy, cardWidth });

        // assert the opposite
        await page.waitForFunction(() => document.querySelector("#opt-right")?.classList.contains("on"));
        assert.ok(
          !(await page.evaluate(() => document.querySelector("#opt-left")?.classList.contains("on"))),
          "向右触控拖动时 #opt-left 不应有 on 高亮类",
        );
        assert.ok(
          await page.evaluate(() => document.querySelector("#opt-right")?.classList.contains("on")),
          "向右触控拖动时 #opt-right 应有 on 高亮类",
        );
        assert.ok(await optL.isVisible(), "触控拖动中 #opt-left 保持可见");
        assert.ok(await optR.isVisible(), "触控拖动中 #opt-right 保持可见");

        // pointermove back to cx, pointerup (app.js 在 window 上监听 pointermove 与 pointerup)
        await page.evaluate(({ cx, cy, cardWidth }) => {
          const startX = cx + 0.25 * cardWidth;
          for (let i = 1; i <= 5; i++) {
            const curX = startX + (cx - startX) * (i / 5);
            window.dispatchEvent(new PointerEvent("pointermove", {
              pointerId: 1,
              pointerType: "touch",
              isPrimary: true,
              clientX: curX,
              clientY: cy,
              bubbles: true,
              cancelable: true,
            }));
          }
          window.dispatchEvent(new PointerEvent("pointerup", {
            pointerId: 1,
            pointerType: "touch",
            isPrimary: true,
            clientX: cx,
            clientY: cy,
            bubbles: true,
            cancelable: true,
          }));
        }, { cx, cy, cardWidth });

        // after release st.current is still T01
        await page.waitForFunction(() => !window.__zz.animating, null, { timeout: 3000 });
        assert.equal(
          await page.evaluate(() => window.__zz.st.current),
          "T01",
          "未达阈值释放后不应提交，保持 T01",
        );

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}
