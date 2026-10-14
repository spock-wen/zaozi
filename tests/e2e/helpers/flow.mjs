// e2e 主流程公共动作：键盘提交、打到冬夜、拖卡。给 flow / touch 两个套件复用。
export const phase = (page) => page.evaluate(() => window.__zz.st.phase);
export const current = (page) => page.evaluate(() => window.__zz.st.current);

export async function commit(page, dir) {
  const k = dir === "left" ? "ArrowLeft" : "ArrowRight";
  // 等上一张的飞出动画结束再按（动画中按键会被重置吞掉），提交后等状态真的前进，不靠定时。
  await page.waitForFunction(() => !window.__zz.animating, null, { timeout: 5000 });
  const before = await page.evaluate(() => window.__zz.actions.length);
  await page.keyboard.press(k);
  await page.keyboard.press(k);
  await page.waitForFunction((n) => window.__zz.actions.length > n && !window.__zz.animating, before, { timeout: 5000 });
}

export async function playToWinter(page) {
  for (let i = 0; i < 80; i++) {
    const ph = await phase(page);
    if (ph === "winter") return;
    if (ph === "engrave") { await page.keyboard.press("s"); await page.waitForTimeout(260); continue; }
    if (ph !== "card") return;
    await commit(page, "left");
  }
}

// 第 1 代教学：T01→T02→T03（锁定，一进来就是刻）→刻→落水→T05→第一张普通卡。
export async function clearTutorial(page) {
  await commit(page, "left");                 // T01 → T02
  await commit(page, "right");                // T02 → T03（engrave）
  await page.locator("#bonecorner").click();  // 刻 → T04
  await page.waitForTimeout(300);
  await page.locator("#wordbox .slot.ok").first().click();  // 落「水」→ T05
  await page.waitForTimeout(300);
  await commit(page, "left");                 // → 第一张普通卡
}

// 从开局一路点到挑字阶段（触控用 tap）：教学 → 冬夜 → 天亮了 → 先人 → 交给第 2 代 → 挑字。
export async function toPick(page) {
  await clearTutorial(page);
  await playToWinter(page);
  await page.locator("#winter-end").tap();
  await page.locator("#endseq").waitFor({ state: "visible", timeout: 12000 });
  await page.locator("#endseq [data-do=elder]").tap();
  await page.locator("#elder").waitFor({ state: "visible" });
  await page.locator("#elder [data-do=heir]").tap();
  await page.locator("#pick").waitFor({ state: "visible" });
}

// 桌面/键鼠：从开局点到挑字阶段（pointer/键盘用 click，不用 tap）。
export async function toPickDesktop(page) {
  await clearTutorial(page);
  await playToWinter(page);
  await page.locator("#winter-end").click();
  await page.locator("#endseq").waitFor({ state: "visible", timeout: 12000 });
  await page.locator("#endseq [data-do=elder]").click();
  await page.locator("#elder").waitFor({ state: "visible" });
  await page.locator("#elder [data-do=heir]").click();
  await page.locator("#pick").waitFor({ state: "visible" });
}

export async function dragCard(page) {
  const c = await page.locator("#card").boundingBox();
  const cx = c.x + c.width / 2, cy = c.y + c.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + c.width * 0.5, cy, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(120);
}

// 当前可见文本（[hidden] 走 display:none，innerText 会自动排除）。
export const visibleText = (page) => page.evaluate(() => document.body.innerText);
