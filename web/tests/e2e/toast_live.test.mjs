// P2-2 回归：常驻屏幕阅读器 live region。
// 缺陷（9462842）：唯一带 aria-live="polite" 的是 #toast，且在闲置时 visibility:hidden，
//                  导致 live region 从可访问性树中移出，读屏软件可能无法在后续更新时播报。
// 断言：
//   1) 闲置时（页面加载 + 2.5s 确保开局 restore toast 消失）：存在自身及祖先 computed display != "none"
//      且 visibility != "hidden" 的 [aria-live] 或 [role=status] 元素；
//   2) 在 Chromium 下通过 CDP Accessibility.getFullAXTree 断言闲置时至少存在一个 live="polite" 节点；
//   3) T03 触发锁拖 toast：该 live 元素的 textContent 等于 toast 文本；
//   4) toast 消失后（等待 2.5s）：该 live 元素依然可见（按同等判断），且其文本已清空。
// 三引擎 × {390×844, 1280×800}。
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
  { name: "390x844", width: 390, height: 844, view: "mobile" },
  { name: "1280x800", width: 1280, height: 800, view: "desktop" },
];

async function getVisibleLiveElement(page) {
  return await page.evaluate(() => {
    const el = document.getElementById("toast-live");
    if (!el) return null;
    let cur = el;
    let visible = true;
    while (cur && cur !== document.documentElement) {
      const cs = getComputedStyle(cur);
      if (cs.display === "none" || cs.visibility === "hidden") {
        visible = false;
        break;
      }
      cur = cur.parentElement;
    }
    return {
      id: el.id,
      tag: el.tagName,
      text: el.textContent,
      role: el.getAttribute("role"),
      live: el.getAttribute("aria-live"),
      visible,
    };
  });
}

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
    test(`${engine} ${vp.name}: 常驻屏幕阅读器 live region`, async () => {
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

        // 闲置状态：等待 2.5s 确保读档 toast 消失
        await page.waitForTimeout(2500);

        // 断言 #toast 自身不再携带 aria-live 属性（避免读屏双重播报）
        const toastAriaLive = await page.locator("#toast").getAttribute("aria-live");
        assert.equal(toastAriaLive, null, "#toast 本身不应携带 aria-live 属性");

        // 1) 闲置时应存在未被隐藏的 #toast-live 元素 (role=status, aria-live=polite, 祖先及自身可见)
        const idleLive = await getVisibleLiveElement(page);
        assert.ok(idleLive, "闲置状态下 #toast-live 元素应存在");
        assert.equal(idleLive.id, "toast-live", "元素 ID 必须为 toast-live");
        assert.equal(idleLive.role, "status", "#toast-live role 应为 status");
        assert.equal(idleLive.live, "polite", "#toast-live aria-live 应为 polite");
        assert.equal(idleLive.visible, true, "#toast-live 自身及祖先均不能为 display:none 或 visibility:hidden");

        // 在 chromium 下使用 CDP 定位 #toast-live 节点并检查其 AX live 属性
        if (engine === "chromium") {
          const client = await ctx.newCDPSession(page);
          const doc = await client.send("DOM.getDocument");
          const { nodeId } = await client.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "#toast-live" });
          const desc = await client.send("DOM.describeNode", { nodeId });
          const backendNodeId = desc.node.backendNodeId;
          const ax = await client.send("Accessibility.getPartialAXTree", { backendNodeId });
          const targetNode = ax.nodes.find((n) => n.backendDOMNodeId === backendNodeId);
          assert.ok(targetNode, "Chromium AX 树中应能定位到 #toast-live 节点");
          const liveProp = targetNode.properties?.find((p) => p.name === "live");
          const liveValue = liveProp?.value?.value ?? liveProp?.value ?? targetNode.live?.value;
          assert.equal(liveValue, "polite", "#toast-live 节点的 AX live 属性应为 polite");
        }

        // 进入 T03
        await commit(page, "left");               // T01 → T02
        await commit(page, "right");              // T02 → T03
        assert.equal(await current(page), "T03");
        assert.equal(await phase(page), "engrave");

        // 触发锁拖 toast
        await pressCard(page, vp.view === "mobile");
        assert.ok(
          await page.locator("#toast").evaluate((e) => e.classList.contains("on")),
          "按下卡后 #toast 应显示（锁拖提示）",
        );
        const toastText = (await page.locator("#toast").textContent()) || "";
        assert.ok(toastText.length > 0, "toast 文本应非空");

        // 2) 弹 toast 时：#toast-live 元素 textContent 等于 toast 文本
        const activeLive = await getVisibleLiveElement(page);
        assert.ok(activeLive, "toast 显示时 #toast-live 应存在");
        assert.equal(activeLive.visible, true, "toast 显示时 #toast-live 祖先及自身应可见");
        assert.equal(activeLive.text, toastText, "#toast-live textContent 应等于 toast 文本");

        // 3) 等待 toast 收起（2.5s）
        await page.waitForTimeout(2500);
        const toastOn = await page.locator("#toast").evaluate((e) => e.classList.contains("on"));
        assert.equal(toastOn, false, "#toast 应已收起");

        // #toast-live 依然可见，且其文本已清空
        const afterLive = await getVisibleLiveElement(page);
        assert.ok(afterLive, "toast 收起后 #toast-live 应依然存在");
        assert.equal(afterLive.visible, true, "toast 收起后 #toast-live 祖先及自身应依然可见");
        assert.equal(afterLive.text, "", "toast 收起后 #toast-live 文本应清空");

        assert.deepEqual(errs, [], "页面不应有报错：" + errs.join(" | "));
      } finally {
        await ctx.close();
      }
    });
  }
}
