// 目标可达性扫描：用引擎本身在大量种子上按几种打法跑完整代，统计每个目标
// 「被抽到（offered）」和「代末达成（achieved）」的次数，并为四维目标找一条
// 可复现的「种子 + 选择序列」。
//
// 为什么不用壳：引擎是纯函数（createGame/step），这里全部走引擎，和网页跑的是
// 同一份代码（tests/helpers/load_engine.mjs 与 build_dist 同一套剥类型 + 包数据）。
//
// 用法：
//   node tools/goal_sweep.mjs                      # 默认 2000 种子 × 4 代 × 全部打法
//   node tools/goal_sweep.mjs --seeds 500 --gens 5
//   node tools/goal_sweep.mjs --json
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadEngine, loadSavecode } from "../tests/helpers/load_engine.mjs";

// 与 src/rng.ts 相同的 mulberry32（内联一份，工具不依赖直接 import .ts）
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DIM_KEYS = ["food", "faith", "memory", "outsider"];
const clamp = (v) => Math.max(0, Math.min(100, v));

// ---- 打法 ----
// 每个打法给出：decide(选左/右/落字)、engrave(卡上有迹时刻不刻)、pick(开春挑三个字)。
function dimPolicy(E, dim) {
  return {
    id: `greedy-${dim}`,
    decide(st, card) {
      const opts = [{ action: { type: "choose", side: "left" }, delta: card.left.delta ?? {} },
                    { action: { type: "choose", side: "right" }, delta: card.right.delta ?? {} }];
      for (const d of card.drops ?? []) {
        if (st.wordBox.includes(d.char) && !st.dropped.includes(d.char)) {
          opts.push({ action: { type: "choose", side: "drop", slot: st.wordBox.indexOf(d.char) }, delta: d.delta ?? {} });
        }
      }
      const score = (o) => o.delta[dim] ?? 0;
      const safe = (o) => {
        const v = { ...st.dims };
        for (const k of DIM_KEYS) if (typeof o.delta[k] === "number") v[k] = clamp(v[k] + o.delta[k]);
        return DIM_KEYS.every((k) => v[k] >= 1 && v[k] <= 99);
      };
      const sorted = opts.slice().sort((a, b) => score(b) - score(a));
      return (sorted.find(safe) ?? sorted[0]).action;
    },
    engrave: () => false,
    pick: () => ["水", "火", "日"],
  };
}

function randomPolicy(E) {
  return {
    id: "random",
    decide(st, card, rng) {
      const opts = [{ type: "choose", side: "left" }, { type: "choose", side: "right" }];
      for (const d of card.drops ?? []) {
        if (st.wordBox.includes(d.char) && !st.dropped.includes(d.char)) opts.push({ type: "choose", side: "drop", slot: st.wordBox.indexOf(d.char) });
      }
      return opts[Math.floor(rng() * opts.length)];
    },
    engrave: (st, rng) => rng() < 0.5,
    pick: (st, rng) => E.PICK_POOL.slice().sort(() => rng() - 0.5).slice(0, 3),
  };
}

export function makePolicies(E) {
  return [
    dimPolicy(E, "food"),
    dimPolicy(E, "outsider"),
    dimPolicy(E, "memory"),
    dimPolicy(E, "faith"),
    randomPolicy(E),
  ];
}

const cardOf = (E, id) => E.CARDS.find((c) => c.id === id);

// 打一代（card → … → winter → ended），返回 { st, actions }。
export function playGeneration(E, start, policy, rng) {
  let st = start;
  const actions = [];
  const push = (a) => { actions.push(a); st = E.step(st, a); };
  let guard = 0;
  while (st.phase !== "ended" && guard++ < 1000) {
    if (st.phase === "card") {
      const card = cardOf(E, st.current);
      push(policy.decide(st, card, rng));
    } else if (st.phase === "engrave") {
      const wantEngrave = policy.engrave(st, rng);
      if (wantEngrave) {
        try { push({ type: "engrave", trace: st.pendingTrace.target }); }
        catch { push({ type: "skip_engrave" }); } // 没空骨片等：改不刻
      } else push({ type: "skip_engrave" });
    } else if (st.phase === "winter") {
      // 手里的事签尽量刻成（对 memory/faith 目标公平）；刻不了就留到明年。
      for (const t of st.tallies.slice()) {
        if (!st.tallies.some((x) => x.id === t.id)) continue;
        const def = E.CHARS[t.target];
        let ok = false;
        try {
          const answer = def.method === "huiyi" ? { method: "huiyi", components: def.components }
            : def.method === "zhishi" ? { method: "zhishi", base: def.base, position: def.position }
              : { method: "xiangxing", points: def.trace_order };
          push({ type: "winter_carve", tally: t.id, answer });
          ok = true;
        } catch { /* 部件不可用等：改留到明年 */ }
        if (!ok) push({ type: "winter_defer", tally: t.id });
      }
      push({ type: "winter_end" });
    } else {
      break; // pick / ended 由外层处理
    }
  }
  return { st, actions };
}

// 打几代：ended → heir → pick → begin_generation → 下一代。
// 返回 { gens, allActions }：allActions 是从 createGame(startSeed) 起可完整重放的序列。
export function playGame(E, startSeed, generations, policy) {
  const rng = mulberry32((startSeed * 2654435761) >>> 0);
  const gens = [];
  const allActions = [];
  let st = E.createGame({ seed: startSeed });
  for (let g = 1; g <= generations; g++) {
    const offered = st.goals.map((x) => x.id);
    const { st: ended, actions } = playGeneration(E, st, policy, rng);
    allActions.push(...actions);
    const achieved = ended.goals.filter((x) => x.achieved).map((x) => x.id);
    gens.push({ generation: g, offered, achieved, actions, dims: { ...ended.dims }, endedPhase: ended.phase, startSeed, endIndex: allActions.length });
    if (g === generations) break;
    if (ended.phase !== "ended") break;
    const heir = { type: "heir" };
    st = E.step(ended, heir); allActions.push(heir);
    const picks = policy.pick(st, rng).slice(0, E.RULES.word_box.slots);
    const toggles = picks.map((ch) => ({ type: "pick_toggle", char: ch }));
    for (const a of toggles) st = E.step(st, a);
    allActions.push(...toggles);
    const begin = { type: "begin_generation", picks };
    st = E.step(st, begin); allActions.push(begin);
  }
  return { gens, allActions };
}

// 扫一批种子 × 打法，统计 offered / achieved。
export function sweep(E, { seeds = 2000, generations = 4 } = {}) {
  const policies = makePolicies(E);
  const allIds = E.GOALS.pool.map((g) => g.id);
  const stat = Object.fromEntries(allIds.map((id) => [id, { offered: 0, achieved: 0 }]));
  const perPolicy = {};
  let generationsPlayed = 0;
  for (const policy of policies) {
    perPolicy[policy.id] = Object.fromEntries(allIds.map((id) => [id, { offered: 0, achieved: 0 }]));
    for (let s = 0; s < seeds; s++) {
      for (const gen of playGame(E, s, generations, policy).gens) {
        generationsPlayed++;
        for (const id of gen.offered) { stat[id].offered++; perPolicy[policy.id][id].offered++; }
        for (const id of gen.achieved) { stat[id].achieved++; perPolicy[policy.id][id].achieved++; }
      }
    }
  }
  return { seeds, generations, generationsPlayed, stat, perPolicy };
}

// 找一条能达成 goalId 的「种子 + 打法 + 选择序列」。
// 序列只取到「达成那一代的代末」（hit.endIndex）：四维目标在代末判定，再往后打的
// 几代会把 goals 换成新的一批，整段重放就看不到这个目标了（旧版的错）。
export function findAchievement(E, goalId, { seeds = 2000, generations = 4 } = {}) {
  const policies = makePolicies(E);
  for (const policy of policies) {
    for (let s = 0; s < seeds; s++) {
      const { gens, allActions } = playGame(E, s, generations, policy);
      const hit = gens.find((g) => g.achieved.includes(goalId));
      if (hit) return { goalId, seed: s, policy: policy.id, generation: hit.generation, dims: hit.dims, offered: hit.offered, actions: allActions.slice(0, hit.endIndex) };
    }
  }
  return null;
}

// 把选择序列写成人类可读的走法，便于 QA 照着手打。
export function describe(E, seed, actions) {
  const lines = [];
  let st = E.createGame({ seed });
  const mark = (d, before) => {
    const parts = DIM_KEYS.filter((k) => d[k] !== before[k]).map((k) => `${k}${d[k] >= before[k] ? "+" : ""}${d[k] - before[k]}`);
    return parts.length ? ` (${parts.join(" ")})` : "";
  };
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    const before = { ...st.dims };
    let tag = `${st.generation}代 ${st.current ?? st.phase}`;
    if (a.type === "choose") tag += a.side === "drop" ? ` 落字 ${st.wordBox[a.slot]}` : ` 选${a.side === "left" ? "左" : "右"}`;
    else if (a.type === "engrave") tag += ` 刻 ${a.trace}`;
    else if (a.type === "skip_engrave") tag += " 不刻";
    else if (a.type === "winter_carve") tag += ` 冬夜刻 ${a.tally}`;
    else if (a.type === "winter_defer") tag += ` 留到明年 ${a.tally}`;
    else if (a.type === "winter_end") tag += " 天亮了";
    else if (a.type === "heir") tag += " 先人";
    else if (a.type === "pick_toggle") tag += ` 挑字 ${a.char}`;
    else if (a.type === "begin_generation") tag += ` 出发（${a.picks.join("")}）`;
    st = E.step(st, a);
    lines.push(`${String(i + 1).padStart(2)}. ${tag}${mark(st.dims, before)}`);
  }
  return lines;
}

// ---- CLI ----
function fmtPct(n, d) { return d ? `${((n / d) * 100).toFixed(1)}%` : "—"; }

async function main() {
  const argv = process.argv.slice(2);
  const num = (flag, def) => { const i = argv.indexOf(flag); return i >= 0 ? Number(argv[i + 1]) : def; };
  const seeds = num("--seeds", 2000);
  const generations = num("--gens", 4);
  const asJson = argv.includes("--json");
  const showIdx = argv.indexOf("--show");
  const E = await loadEngine();

  if (showIdx >= 0) {
    const goalId = argv[showIdx + 1];
    const a = findAchievement(E, goalId, { seeds, generations });
    if (!a) { console.log(`${goalId}: 未找到可复现达成（${seeds} 种子 × ${generations} 代）`); return; }
    // 重放校验：整段序列走完，目标必须在代末达成。
    const replayed = E.run({ seed: a.seed }, a.actions);
    const ok = replayed.goals.find((g) => g.id === goalId)?.achieved === true;
    console.log(`${goalId}: seed=${a.seed} 打法=${a.policy} 第${a.generation}代 代末四维=${JSON.stringify(a.dims)}`);
    console.log(`重放校验：${ok ? "达成 ✓" : "未达成 ✗"}（actions=${a.actions.length} 步）`);
    const SC = await loadSavecode();
    console.log(`存档码（网页里「导入存档码」粘贴即复现）：${SC.encodeSaveCode(a.seed, a.actions)}`);
    console.log(`打开方式：/?debug=1&debug_goal=${goalId}&seed=${a.seed}`);
    console.log("\n走法：");
    for (const line of describe(E, a.seed, a.actions)) console.log("  " + line);
    return;
  }

  const res = sweep(E, { seeds, generations });
  if (asJson) { console.log(JSON.stringify(res, null, 2)); return; }
  console.log(`goal_sweep: ${res.seeds} 种子 × ${res.generations} 代 × ${Object.keys(res.perPolicy).length} 打法 = ${res.generationsPlayed} 代`);
  console.log("目标              抽到     达成    达成/抽到");
  for (const g of E.GOALS.pool) {
    const s = res.stat[g.id];
    console.log(`${g.id.padEnd(16)} ${String(s.offered).padStart(6)} ${String(s.achieved).padStart(7)}   ${fmtPct(s.achieved, s.offered)}`);
  }
  console.log("\n分打法（达成/抽到）：");
  const ids = E.GOALS.pool.map((g) => g.id);
  console.log("打法".padEnd(18) + ids.map((i) => i.replace("G_", "").padStart(13)).join(""));
  for (const [p, st] of Object.entries(res.perPolicy)) {
    console.log(p.padEnd(18) + ids.map((i) => `${st[i].achieved}/${st[i].offered}`.padStart(13)).join(""));
  }
  console.log("\n可复现达成样例：");
  for (const id of ["G_FOOD_65", "G_OUT_65", "G_MEM_70", "G_FAITH_65", "G_DROP1", "G_ENGRAVE1"]) {
    const a = findAchievement(E, id, { seeds, generations });
    if (a) console.log(`  ${id}: seed=${a.seed} 打法=${a.policy} 第${a.generation}代 代末四维=${JSON.stringify(a.dims)} 步数=${a.actions.length}`);
    else console.log(`  ${id}: 未找到（${seeds} 种子 × ${generations} 代）`);
  }
}

if (import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? "")).href) {
  await main();
}
