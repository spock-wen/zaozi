// zaozi_locale_v1 + SYSTEM_MENU_COPY 取串：缺英回落 zh，非法值当 zh。
import test from "node:test";
import assert from "node:assert/strict";
import { LOCALE_KEY, UI_COPY, readLocale, lookupCopy } from "../web/ui_copy.js";

test("LOCALE_KEY is zaozi_locale_v1", () => {
  assert.equal(LOCALE_KEY, "zaozi_locale_v1");
});

test("lookupCopy en takes English; missing key falls back to zh then key", () => {
  assert.equal(lookupCopy("en", "ui.menu.mute"), "Mute");
  assert.equal(lookupCopy("zh", "ui.menu.mute"), "静音");
  assert.equal(lookupCopy("en", "ui.lang.zh"), "中文");
  assert.equal(lookupCopy("en", "ui.top.gen", { n: 3 }), "Gen 3 · Keeper");
  assert.equal(lookupCopy("zh", "ui.top.gen", { n: 3 }), "第 3 代 · 记事人");
  // 故意缺键：不空白
  assert.equal(lookupCopy("en", "ui.never.exists"), "ui.never.exists");
});

test("readLocale: only zh|en; garbage → zh; does not write", () => {
  const g = globalThis;
  const store = new Map();
  const fake = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
  };
  const prev = g.localStorage;
  Object.defineProperty(g, "localStorage", { value: fake, configurable: true });
  try {
    assert.equal(readLocale(), "zh");
    fake.setItem(LOCALE_KEY, "en");
    assert.equal(readLocale(), "en");
    fake.setItem(LOCALE_KEY, "EN");
    assert.equal(readLocale(), "zh");
    assert.equal(fake.getItem(LOCALE_KEY), "EN"); // 读取不改写
  } finally {
    if (prev === undefined) delete g.localStorage;
    else Object.defineProperty(g, "localStorage", { value: prev, configurable: true });
  }
});

test("SYSTEM_MENU_COPY packs cover settings + core chrome keys", () => {
  for (const k of [
    "ui.lang.label", "ui.lang.zh", "ui.lang.en",
    "ui.menu.group.settings", "ui.menu.mute", "ui.menu.unmute",
    "ui.dims.food", "ui.dims.food.tip", "ui.carve.ok", "ui.winter.title",
  ]) {
    assert.ok(UI_COPY.zh[k], `zh missing ${k}`);
    assert.ok(UI_COPY.en[k], `en missing ${k}`);
  }
  assert.ok(Object.keys(UI_COPY.zh).length >= 150);
});
