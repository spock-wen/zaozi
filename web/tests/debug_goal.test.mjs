// 调试目标单测：?debug=1&debug_goal=… 背后的引擎开关 createGame({ debugGoal })。
// 目的：把一个目标硬塞进这一代，方便在网页上反复验某个目标（哪怕它本来被排除、或没抽到）。
// 正常玩法不传 debugGoal，结果必须和以前一模一样。
import test from "node:test";
import assert from "node:assert/strict";
import { loadEngine } from "./helpers/load_engine.mjs";

const E = await loadEngine();
const SEED = 20261012;
const DEFAULT_GEN1 = ["G_DROP1", "G_MEM_70", "G_FAITH_65"];

function playToEnd(st) {
  let guard = 0;
  while (st.phase !== "ended" && guard++ < 5000) {
    if (st.phase === "card") {
      const c = E.CARDS.find((x) => x.id === st.current);
      const drop = c.drops.find((d) => st.wordBox.includes(d.char) && !st.dropped.includes(d.char));
      st = drop
        ? E.step(st, { type: "choose", side: "drop", slot: st.wordBox.indexOf(drop.char) })
        : E.step(st, { type: "choose", side: "right" });
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
            : { method: "xiangxing", points: def.trace_order };
        st = E.step(st, { type: "winter_carve", tally: t.id, answer });
      } else st = E.step(st, { type: "winter_end" });
    } else break;
  }
  return st;
}

test("debugGoal forces the goal into gen 1, replacing the last slot (still 3)", () => {
  const st = E.createGame({ seed: SEED, debugGoal: "G_FOOD_65" });
  assert.equal(st.goals.length, 3);
  assert.deepEqual(st.goals.map((g) => g.id), ["G_DROP1", "G_MEM_70", "G_FOOD_65"]);
  // 塞进来的仍是正常目标定义（四维目标照代末判定）
  const g = st.goals.find((x) => x.id === "G_FOOD_65");
  assert.equal(g.kind, "dim");
  assert.equal(g.dim, "food");
  assert.equal(g.min, 65);
  assert.equal(g.achieved, false);
});

test("debugGoal can force a goal that gen 1 normally excludes (G_ENGRAVE1)", () => {
  const st = E.createGame({ seed: SEED, debugGoal: "G_ENGRAVE1" });
  assert.ok(st.goals.some((g) => g.id === "G_ENGRAVE1"), "被 generation1_exclude 排除的目标也要能调试塞进来");
  assert.equal(st.goals.length, 3);
  assert.ok(!DEFAULT_GEN1.includes("G_ENGRAVE1"));
});

test("debugGoal is carried into the next generation (heir -> pick -> begin_generation)", () => {
  let st = E.createGame({ seed: SEED, debugGoal: "G_OUT_65" });
  assert.deepEqual(st.goals.map((g) => g.id), ["G_DROP1", "G_MEM_70", "G_OUT_65"]);
  const end = playToEnd(st);
  assert.equal(end.phase, "ended");
  let s = E.step(end, { type: "heir" });
  for (const ch of ["水", "火", "日"]) s = E.step(s, { type: "pick_toggle", char: ch });
  const gen2 = E.step(s, { type: "begin_generation", picks: s.picks });
  assert.equal(gen2.generation, 2);
  assert.equal(gen2.goals.length, 3);
  assert.ok(gen2.goals.some((g) => g.id === "G_OUT_65"), "下一代也要带着调试目标");
  assert.equal(gen2.debugGoal, "G_OUT_65", "debugGoal 随状态传承");
});

test("unknown debugGoal is ignored: goals are exactly the normal ones", () => {
  const st = E.createGame({ seed: SEED, debugGoal: "G_NOPE" });
  assert.deepEqual(st.goals.map((g) => g.id), DEFAULT_GEN1);
});

test("goalIdsForGeneration: debug forces into a gen-N draw, stays 3, deterministic", () => {
  const a = E.goalIdsForGeneration(SEED, 4, "G_FOOD_65");
  const b = E.goalIdsForGeneration(SEED, 4, "G_FOOD_65");
  assert.deepEqual(a, b, "同种子同代同 debug 必须一致");
  assert.equal(a.length, 3);
  assert.ok(a.includes("G_FOOD_65"));
  assert.deepEqual(E.goalIdsForGeneration(SEED, 4), E.goalIdsForGeneration(SEED, 4), "不传 debug 时与旧行为一致（两两相等）");
});
