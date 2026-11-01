// 环4：C01–C10 / T01–T05 英文挂在年卡上；缺英不拿中文当过门。delta / target / bones / hidden_marker 不动。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { UI_COPY, lookupCopy } from "../web/ui_copy.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cards = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "year1_cards.json"), "utf8")).cards;
const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
const app = fs.readFileSync(path.join(ROOT, "web", "app.js"), "utf8");

const IDS = ["T01", "T02", "T03", "T04", "T05", "C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08", "C09", "C10"];
const CJK = /[\u4e00-\u9fff]/;

test("C01–C10 and T01–T05 expose English title/speaker/text/left/right", () => {
  for (const id of IDS) {
    const en = byId[id].en;
    assert.ok(en, id);
    for (const k of ["title", "speaker", "text", "left", "right"]) {
      assert.equal(typeof en[k], "string", `${id}.en.${k}`);
      assert.ok(en[k].trim(), `${id}.en.${k} empty`);
      assert.ok(!CJK.test(en[k]), `${id}.en.${k} still has Chinese: ${en[k]}`);
    }
  }
});

test("族长 is replaced; conflict copy stays clubs / bone knife", () => {
  const raw = JSON.stringify(cards);
  assert.ok(!raw.includes("族长"));
  assert.ok(!raw.includes("动刀"));
  assert.equal(byId.C01.speaker, "管事的老人");
  assert.ok(byId.C01.text.includes("管事的老人"));
  assert.equal(byId.C10.speaker, "管事的老人");
  assert.ok(byId.C10.text.includes("管事的老人"));
  assert.equal(byId.C01.en.speaker, "Elder in charge");
  assert.equal(byId.C10.en.speaker, "Elder in charge");
  assert.ok(byId.T01.text.includes("骨刀"));
  assert.ok(byId.T01.en.text.includes("bone carving knife"));
  assert.ok(byId.T05.text.includes("棍棒"));
  assert.ok(byId.T05.en.text.includes("clubs"));
  assert.ok(byId.T05.en.faces.hold.text.includes("clubs"));
});

test("gameplay numbers and targets are unchanged", () => {
  assert.deepEqual(byId.C01.left.delta, { food: 8, outsider: -4 });
  assert.deepEqual(byId.C01.right.delta, { food: -4, memory: 6 });
  assert.equal(byId.C02.right.trace.target, "本");
  assert.equal(byId.C05.left.trace.target, "休");
  assert.equal(byId.C07.left.trace.target, "力");
  assert.equal(byId.C08.left.bones, 1);
  assert.equal(byId.C09.left.bones, -1);
  assert.equal(byId.C09.right.hidden_marker, "witch_hostility");
  assert.equal(byId.C09.right.trace.target, "月");
  assert.deepEqual(byId.C04.drops[0].delta, { outsider: 4, food: -4 });
  assert.deepEqual(byId.C10.drops[0].delta, { faith: 4, food: -6 });
  assert.equal(byId.T03.lock_choice, true);
  assert.equal(byId.T03.trace.target, "休");
  assert.deepEqual(byId.T04.drops[0].delta, { outsider: 4, food: -4 });
  assert.deepEqual(byId.T05.left.delta, { food: 4, outsider: -8 });
  assert.deepEqual(byId.T05.right.delta, { food: -6, outsider: 6 });
  assert.equal(byId.C04.en.drops["水"].label, "Bound by the river");
  assert.equal(byId.T04.en.drops["水"].label, "Split the river flat");
  assert.equal(byId.C10.en.drops["火"].label, "Share fire, food, and sleep");
});

test("ui.choice.tip and lock note come from the lock table, no Chinese fallback in lookup for those keys", () => {
  assert.equal(lookupCopy("zh", "ui.choice.tip"), "有的选择两边都要付出。想好再松手。");
  assert.equal(lookupCopy("en", "ui.choice.tip"), "Some choices cost both sides. Think, then let go.");
  assert.equal(lookupCopy("zh", "ui.choice.locked"), "本步不选");
  assert.equal(lookupCopy("en", "ui.choice.locked"), "Locked step — no choice");
  assert.equal(UI_COPY.en["ui.choice.tip"], lookupCopy("en", "ui.choice.tip"));
  assert.ok(!CJK.test(UI_COPY.en["ui.choice.tip"]));
});

test("choice path is the buttons; card drag is not started", () => {
  assert.match(app, /function beginDrag\(\) \{\s*\/\/ 环4：卡面拖不再作为选择路径/);
  assert.match(app, /function choiceLocked\(\)/);
  assert.match(app, /ol\.disabled = or\.disabled = !isCard/);
  assert.match(app, /setAttribute\("aria-disabled", "true"\)/);
  assert.match(app, /ui\.choice\.locked/);
  assert.match(app, /ui\.choice\.tip/);
  assert.ok(!app.includes('"← " + leftLabel'), "buttons must not prefix a second script");
  assert.ok(!/enqueueInput\(\{ kind: "press"/.test(app), "card press must not be queued");
  const at = app.indexOf("卡面拖、卡面长按不再作为选择");
  assert.ok(at > 0, "stage pointerdown should record that card drag is gone");
  const down = app.slice(at, at + 400);
  assert.ok(!down.includes("onDown("), "stage pointerdown must not start a card drag");
  assert.ok(!down.includes("beginDrag("), "stage pointerdown must not begin a drag");
});
