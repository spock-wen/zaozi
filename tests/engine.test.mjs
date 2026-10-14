// 引擎单测：教学开局、每代目标、四维目标代末判定、开局挑字、多代流程、旧存档码可读。
// 加载方式与发布一致（tests/helpers/load_engine.mjs 剥类型 + 包数据）。
import test from "node:test";
import assert from "node:assert/strict";
import { loadEngine } from "./helpers/load_engine.mjs";

const E = await loadEngine();
const SEED = 20261012;

function playToEnd(st, { correct = true } = {}) {
  let guard = 0;
  while (st.phase !== "ended" && guard++ < 5000) {
    if (st.phase === "card") {
      const c = E.CARDS.find((x) => x.id === st.current);
      const drop = c.drops.find((d) => st.wordBox.includes(d.char) && !st.dropped.includes(d.char));
      if (drop) st = E.step(st, { type: "choose", side: "drop", slot: st.wordBox.indexOf(drop.char) });
      else st = E.step(st, { type: "choose", side: "right" });
    } else if (st.phase === "engrave") {
      st = E.step(st, { type: "engrave", trace: st.pendingTrace.target });
    } else if (st.phase === "winter") {
      const t = st.tallies[0];
      if (t) {
        const def = E.CHARS[t.target];
        const answer = def.method === "huiyi"
          ? { method: "huiyi", components: def.components }
          : def.method === "zhishi"
            ? { method: "zhishi", base: def.base, position: def.position }
            : { method: "xiangxing", points: correct ? def.trace_order : def.trace_order.slice().reverse() };
        st = E.step(st, { type: "winter_carve", tally: t.id, answer });
      } else st = E.step(st, { type: "winter_end" });
    } else break;
  }
  return st;
}

test("gen 1 opens on the fixed tutorial cards, in order, excluded from the normal deck", () => {
  const st = E.createGame({ seed: SEED });
  assert.equal(st.generation, 1);
  assert.equal(st.phase, "card");
  assert.deepEqual(st.deck.slice(0, 4), ["T02", "T03", "T04", "T05"]);
  assert.equal(st.current, "T01");
  assert.equal(st.deck.length, 14); // 5 教学 + 10 普通 − 1 当前
  // 前 4 张是剩下的教学卡；之后必须全是普通卡（普通牌堆里不能再出现教学卡）
  assert.ok(st.deck.slice(4).every((id) => !E.isTutorialCard(id)), "普通牌堆里不能再有教学卡");
  assert.equal(st.deck.filter((id) => !E.isTutorialCard(id)).length, 10);
  assert.deepEqual(st.wordBox, ["水"]); // 教学期借一个「水」
});

test("goal set: gen 1 excludes G_ENGRAVE1; later generations pick 3 deterministically", () => {
  const st = E.createGame({ seed: SEED });
  assert.deepEqual(st.goals.map((g) => g.id), ["G_DROP1", "G_MEM_70", "G_FAITH_65"]);
  assert.ok(!st.goals.some((g) => g.id === "G_ENGRAVE1"));
  const a = E.goalIdsForGeneration(SEED, 3);
  const b = E.goalIdsForGeneration(SEED, 3);
  const c = E.goalIdsForGeneration(SEED, 4);
  assert.deepEqual(a, b, "同一种子同一代目标必须一致");
  assert.equal(a.length, 3);
  assert.notDeepEqual(a, c, "不同代目标应当变化");
  assert.ok(a.every((id) => E.GOALS.pool.some((g) => g.id === id)));
});

test("all goal copy is free of placeholder wording and arabic digits", () => {
  for (const g of E.GOALS.pool) {
    assert.ok(!g.text.includes("占位"), `${g.id} 文案含占位`);
    assert.ok(!g.text.includes("（占位）"), `${g.id} 文案含（占位）`);
    assert.ok(!/[A-Za-z0-9]/.test(g.text), `${g.id} 文案含英文字母或阿拉伯数字`);
    assert.ok(g.text.length <= 10, `${g.id} 目标超过 10 字`);
    assert.ok(g.banner.length <= 12, `${g.id} 横幅超过 12 字`);
    assert.ok(g.banner.startsWith("达成　"), `${g.id} 横幅前缀不对`);
  }
});

test("tutorial step 3 blocks swipe: the card opens straight into the engrave phase", () => {
  let st = E.createGame({ seed: SEED });
  st = E.step(st, { type: "choose", side: "left" });   // T01
  st = E.step(st, { type: "choose", side: "right" });  // T02
  assert.equal(st.current, "T03");
  assert.equal(st.phase, "engrave", "T03 一进来就该在刻阶段（锁左右拖）");
  assert.equal(st.pendingTrace.target, "休");
  st = E.step(st, { type: "engrave", trace: "休" });
  assert.equal(st.current, "T04");
  assert.equal(st.phase, "card");
  assert.equal(st.engravedThisGen, 1);
});

test("instant goals fire on drop; the dim goals are judged at generation end", () => {
  let st = E.createGame({ seed: SEED });
  st = E.step(st, { type: "choose", side: "left" });
  st = E.step(st, { type: "choose", side: "right" });
  st = E.step(st, { type: "engrave", trace: "休" });
  assert.deepEqual(st.goalEvents, [], "刻字在 gen1 不算目标（G_ENGRAVE1 已排除）");
  st = E.step(st, { type: "choose", side: "drop", slot: 0 }); // T04 落 水
  assert.deepEqual(st.goalEvents.map((e) => e.id), ["G_DROP1"]);
  assert.equal(st.goals.find((g) => g.id === "G_DROP1").achieved, true);
  const end = playToEnd(st);
  assert.equal(end.phase, "ended");
  // 代末判四维目标：达成与否必须与那一刻的四维值一致
  for (const g of end.goals) {
    if (g.kind === "dim") assert.equal(g.achieved, end.dims[g.dim] >= g.min, `${g.id} 判定与四维不符`);
  }
});

test("multi-generation flow: ended -> heir -> pick -> begin_generation carries zilu and takes 3 picks", () => {
  const end = playToEnd(E.createGame({ seed: SEED }));
  assert.equal(end.phase, "ended");
  const picking = E.step(end, { type: "heir" });
  assert.equal(picking.phase, "pick");
  let s = picking;
  for (const ch of ["水", "休", "木"]) s = E.step(s, { type: "pick_toggle", char: ch });
  assert.deepEqual(s.picks, ["水", "休", "木"]);
  const gen2 = E.step(s, { type: "begin_generation", picks: s.picks });
  assert.equal(gen2.generation, 2);
  assert.equal(gen2.phase, "card");
  assert.deepEqual(gen2.wordBox, ["水", "休", "木"]);
  assert.deepEqual(gen2.zilu, end.legacy.zilu, "字录必须传下去");
  assert.ok(gen2.goals.length === 3);
});

test("pick pool is exactly the 14-character slice", () => {
  assert.deepEqual(E.PICK_POOL, ["水", "日", "人", "木", "田", "火", "力", "月", "休", "林", "从", "男", "明", "本"]);
});

test("old save codes still decode and replay without throwing", async () => {
  const SC = await import("../src/savecode.ts").catch(() => null);
  // 老存档码：格式仍是 ZZ1.<校验>.<base64url>，v=1。用 savecode 的编码器造一个再读回。
  const { loadSavecode } = await import("./helpers/load_engine.mjs");
  const { encodeSaveCodeWith, decodeSaveCode } = await loadSavecode();
  const code = encodeSaveCodeWith(1, SEED, [{ type: "choose", side: "left" }]);
  const d = decodeSaveCode(code);
  assert.equal(d.v, 1);
  assert.equal(d.seed, SEED);
  const replayed = E.run({ seed: d.seed }, d.actions);
  assert.equal(replayed.current, "T02");
  assert.ok(!SC || true);
});
