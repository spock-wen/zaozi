// 造字人一年里程碑的纯规则引擎：不碰界面，只吃动作、吐状态。
// 渲染壳只需要：createGame() 建局，step(state, action) 推进，读 state 画界面。
//
// 重做新增（不改玩法数值）：每代三个小目标、开局挑字、教学开局（固定顺序 + 第 3 张锁左右拖）、
// 多代流程（每代结束 → 先人 → 挑字 → 下一代）。数值仍全部来自 data/*.json。
import rules from "../data/rules.js";
import charsData from "../data/chars_slice.js";
import cardsData from "../data/year1_cards.js";
import goalsData from "../data/goals.js";
import tutorialData from "../data/tutorial.js";
import { mulberry32, shuffle } from "./rng.js";
import type { Card, GameState, Action, Tally, Ending, Legacy, Trace, DropItem } from "./types.js";

export const RULES = rules;
export const CHARS = charsData.chars as Record<string, any>;
export const CARDS = cardsData.cards as Card[];
export const GOALS = goalsData;
export const TUTORIAL = tutorialData;
export const PICK_CHARS = charsData.pick_chars as any[];
export const PICK_POOL = PICK_CHARS.map((x) => x.char);
const DIM_KEYS = rules.dims.keys as Dim[];
// 教学卡：只在第 1 代按 tutorial 号出现，不进普通牌堆
const TUTORIAL_CARDS = (CARDS as any[]).filter((c) => c.only_tutorial).sort((a, b) => a.tutorial - b.tutorial).map((c) => c.id);
const YEAR_CARDS = (CARDS as any[]).filter((c) => !c.only_tutorial);

export type DimKey = string ;
type Dim = any;
export interface GameStateInfo {            
  pendingTrace: Trace ;
  wordBox: string[] ;
  bones: number ;
}

function cardById(id: string, cards: Card[]): Card {
  const c = (cards as any[]).find((x) => x.id === id);
  if (!c) throw new Error(`没有这张卡：${id}`);
  return c as Card;
}

export function isTutorialCard(id: string | null): boolean {
  return !!id && TUTORIAL_CARDS.includes(id);
}
export function tutorialStepOf(id: string | null): any {
  if (!isTutorialCard(id)) return null;
  const c = cardById(id as string, CARDS) as any;
  return TUTORIAL.steps.find((s: any) => s.card === c.id) ?? null;
}

function buildYearDeck(seed: number, yearIndex: number, cards: Card[]): string[] {
  const rnd = mulberry32((seed ^ (yearIndex * 0x9e3779b1)) >>> 0);
  const out: string[] = [];
  for (const s of rules.year.seasons) {
    const ids = cards.filter((c) => c.season === s).map((c) => c.id);
    out.push(...shuffle(ids, rnd));
  }
  return out;
}

// ---- 每代目标：第 1 代固定（教学），第 2 代起按 (种子, 代数) 定序挑 3 个 ----
// debugGoal（?debug=1&debug_goal=…）：把一个目标硬塞进这一代，方便在网页上反复验它——
// 哪怕它本来被 generation1_exclude 排除、或这一代没抽到。正常玩法不传，结果与以前一样。
export function goalIdsForGeneration(seed: number, generation: number, debugGoal?: string | null): string[] {
  let ids: string[];
  if (generation <= 1) {
    // 第 1 代固定集；generation1_exclude（G_ENGRAVE1）只在这里生效——它不在 generation1_goals 里。
    ids = goalsData.generation1_goals.slice();
  } else {
    // 第 2 代起：全池可抽，G_ENGRAVE1 也回到池里（不再被 generation1_exclude 排除）。
    const pool = goalsData.pool.map((g: any) => g.id);
    const rnd = mulberry32((seed ^ (generation * 0x85ebca6b)) >>> 0);
    ids = shuffle(pool, rnd).slice(0, goalsData.per_generation);
  }
  if (debugGoal && goalsData.pool.some((g: any) => g.id === debugGoal) && !ids.includes(debugGoal)) {
    ids[ids.length - 1] = debugGoal;
  }
  return ids;
}
function goalDef(id: string): any { return goalsData.pool.find((g: any) => g.id === id); }
function makeGoals(seed: number, generation: number, debugGoal?: string | null) {
  return goalIdsForGeneration(seed, generation, debugGoal).map((id) => {
    const d = goalDef(id);
    return { id: d.id, kind: d.kind, dim: d.dim ?? null, min: d.min ?? null, text: d.text, banner: d.banner, achieved: false };
  });
}

export function createGame(cfg: GameConfig): GameState {
  const cards = cfg.cards ?? CARDS;
  const generation = cfg.generation ?? 1;
  const dims = Object.fromEntries(DIM_KEYS.map((k) => [k, rules.dims.start])) as Dims;
  const deck = generation <= 1
    ? TUTORIAL_CARDS.concat(buildYearDeck(cfg.seed, 0, YEAR_CARDS))
    : buildYearDeck(cfg.seed, 0, YEAR_CARDS);
  const wordBox = cfg.wordBox ?? (generation <= 1 ? ["水"] : charsData.milestone_word_box);
  const st: GameState = {
    seed: cfg.seed,
    generation,
    debugGoal: cfg.debugGoal ?? null,
    phase: "card",
    dims,
    bones: rules.bones.start,
    bonesGainedThisGen: 0,
    yearsLeft: cfg.years ?? rules.generation.milestone_years_override,
    deck: deck.slice(1),
    current: deck[0],
    pendingTrace: null,
    tallies: [],
    zilu: (cfg.startZilu ?? charsData.milestone_start_zilu).slice(),
    newThisGen: [],
    wordBox: wordBox.slice(0, rules.word_box.slots),
    dropped: [],
    clues: {},
    hiddenMarkers: {},
    ending: null,
    legacy: null,
    goals: makeGoals(cfg.seed, generation, cfg.debugGoal),
    goalEvents: [],
    engravedThisGen: 0,
    tutorialDone: generation > 1,
    log: [`开局：种子 ${cfg.seed}，第 ${generation} 代，第一张 ${deck[0]}`],
  };
  enterCard(st);
  return st;
}

function clone(st: GameState): GameState {
  return structuredClone(st);
}

function applyDelta(st: GameState, delta: Partial<Dims>) {
  for (const k of DIM_KEYS) {
    const d = delta[k];
    if (typeof d === "number") st.dims[k] = Math.max(rules.dims.min, Math.min(rules.dims.max, st.dims[k] + d));
  }
}

function checkFail(st: GameState): boolean {
  for (const k of DIM_KEYS) {
    const v = st.dims[k];
    const e = (rules.endings_fail as End)[k];
    if (v <= rules.dims.min) { st.ending = { kind: "fail", name: e.low }; break; }
    if (v >= rules.dims.max) { st.ending = { kind: "fail", name: e.high }; break; }
  }
  if (st.ending) {
    st.phase = "ended";
    st.legacy = settleGeneration(st);
    st.log.push(`结局：${st.ending.name}`);
    return true;
  }
  return false;
}

function settleGeneration(st: GameState): GenerationCarryOver {
  // 代结算：字录（含这一代新造的）、隐藏线标记留下；最多传 1 张事签；四维、骨片重置
  // 代末判四维目标（本代最后一个冬夜结束时）；达成事件排进 goalEvents
  for (const g of st.goals as any[]) {
    if (g.kind === "dim" && !g.achieved && st.dims[g.dim] >= g.min) {
      g.achieved = true; st.goalEvents.push({ id: g.id, text: g.text, banner: g.banner });
      st.log.push(`达成：${g.text}`);
    }
  }
  return {
    zilu: st.zilu.slice(),
    carriedTally: st.tallies.length > 0 && rules.generation.max_tally_carry > 0 ? st.tallies[0] : null,
    hiddenMarkers: { ...st.hiddenMarkers },
  };
}

function totalBones(st: GameState) { return st.bones + st.tallies.length; }

function applyBones(st: GameState, n: number) {
  if (n > 0) {
    const room = rules.bones.max_per_generation - totalBones(st);
    const add = Math.max(0, Math.min(n, room));
    st.bones += add; st.bonesGainedThisGen += add;
    st.log.push(`骨片 +${add}`);
  } else if (n < 0) {
    for (let i = 0; i < -n; i++) {
      if (st.bones > 0) { st.bones -= 1; st.log.push("交出一片空骨片"); }
      else if (st.tallies.length > 0) { const t = st.tallies.shift() ; st.log.push(`没有空骨片，交出事签 ${t.id} 的骨片，事签作废`); }
      else throw new Error("没有骨片可交，这个选项不可选");
    }
  }
}

function achieveInstant(st: GameState, kind: string) {
  for (const g of st.goals as any[]) {
    if (g.kind === kind && !g.achieved) {
      g.achieved = true; st.goalEvents.push({ id: g.id, text: g.text, banner: g.banner });
      st.log.push(`达成：${g.text}`);
    }
  }
}

// 进入一张卡：教学第 3 张「带迹」且锁左右拖，一进来就进「刻」阶段
function enterCard(st: GameState) {
  const card = cardById(st.current as string, CARDS) as any;
  st.phase = "card";
  if (card.only_tutorial) {
    const step = tutorialStepOf(card.id);
    if (step && step.lock_drag && card.trace) {
      st.pendingTrace = card.trace;
      st.phase = "engrave";
    }
  }
}

function advance(st: GameState) {
  // 一张卡（含刻不刻）处理完之后：判结局，再翻下一张或进冬夜
  if (checkFail(st)) return;
  if (st.deck.length > 0) {
    st.current = st.deck.shift() ;
    enterCard(st);
  } else {
    st.current = null;
    st.phase = "winter";
    st.log.push("冬夜");
  }
}

function usableChar(st: GameState, c: string) {
  return st.zilu.includes(c) && !st.newThisGen.includes(c);
}

function componentPool(st: GameState): string[] {
  return st.zilu.filter((c) => usableChar(st, c) && !st.dropped.includes(c));
}

const sortKey = (a: string[]) => a.slice().sort().join("+");

function judge(st: GameState, target: string, ans: WinterAnswer): { ok: boolean; clue?: [string, string] } {
  const def = CHARS[target];
  if (!def) throw new Error(`字表里没有 ${target}`);
  if (def.method !== ans.method) throw new Error(`${target} 是 ${def.method}，答法给的是 ${ans.method}`);
  const pool = componentPool(st);
  if (ans.method === "huiyi") {
    for (const c of ans.components) if (!pool.includes(c)) throw new Error(`部件 ${c} 这一代不能用`);
    if (sortKey(ans.components) === sortKey(def.components)) return { ok: true };
    // 拼出别的真字：在那个字的格子记一条
    const other = Object.entries(CHARS).find(([k, v]: [string, any]) => k !== target && v.method === "huiyi" && sortKey(v.components) === sortKey(ans.components));
    if (other) return { ok: false, clue: [other[0], `${ans.components.join(" + ")} 是一个字`] };
    // 对一半：记残片线索
    const need = def.components.slice();
    const hit = ans.components.find((c) => need.includes(c));
    if (hit) return { ok: false, clue: [target, `${hit} + ？`] };
    return { ok: false };
  }
  if (ans.method === "zhishi") {
    if (!pool.includes(ans.base)) throw new Error(`底字 ${ans.base} 这一代不能用`);
    return { ok: ans.base === def.base && ans.position === def.position };
  }
  // 象形：依次点三个亮点
  return { ok: ans.points.join(",") === (def.trace_order as string[]).join(",") };
}

export function step(prev: GameState, action: Action): GameState {
  if (prev.phase === "ended" && action.type !== "heir" && action.type !== "begin_generation" && action.type !== "restart") {
    throw new Error("这一代已经结束");
  }
  const st = clone(prev);
  switch (action.type) {
    case "choose": {
      if (st.phase !== "card" || !st.current) throw new Error("现在不是选卡的时候");
      const card = cardById(st.current, CARDS) as any;
      let opt: Option | null = null;
      if (action.side === "drop") {
        const ch = st.wordBox[action.slot];
        if (!ch) throw new Error(`字匣第 ${action.slot + 1} 格是空的`);
        if (st.dropped.includes(ch)) throw new Error(`${ch} 这一代已经落过`);
        if (!usableChar(st, ch)) throw new Error(`${ch} 这一代不能用`);
        const d = card.drops.find((x: any) => x.char === ch);
        if (!d) throw new Error(`这张卡不能落 ${ch}`);
        st.dropped.push(ch);
        applyDelta(st, d.delta);
        achieveInstant(st, "drop");
        st.log.push(`${card.id} 落字 ${ch}`);
        advance(st);
        return st;
      }
      opt = action.side === "left" ? card.left : card.right;
      applyDelta(st, opt.delta);
      if (opt.bones) applyBones(st, opt.bones);
      if (opt.hidden_marker) st.hiddenMarkers[opt.hidden_marker] = (st.hiddenMarkers[opt.hidden_marker] ?? 0) + 1;
      st.log.push(`${card.id} ${action.side === "left" ? "左" : "右"}`);
      if (opt.trace) {
        st.pendingTrace = opt.trace;
        st.phase = "engrave";
        return st;
      }
      advance(st);
      return st;
    }
    case "engrave": {
      if (st.phase !== "engrave" || !st.pendingTrace) throw new Error("现在没有迹可刻");
      if (action.trace !== st.pendingTrace.target) throw new Error(`这张卡上的迹是 ${st.pendingTrace.target}`);
      if (st.bones < rules.engrave_tally.bone_cost) throw new Error("没有空骨片");
      st.bones -= rules.engrave_tally.bone_cost;
      applyDelta(st, rules.engrave_tally.delta as Partial<Dims>);
      const t: Tally = { id: `T${st.tallies.length + 1}-${st.pendingTrace.target}`, target: st.pendingTrace.target, text: st.pendingTrace.tally_text, fromCard: st.current  };
      st.tallies.push(t);
      st.engravedThisGen += 1;
      achieveInstant(st, "engrave");
      st.log.push(`刻事签 ${t.id}`);
      st.pendingTrace = null;
      advance(st);
      return st;
    }
    case "skip_engrave": {
      if (st.phase !== "engrave") throw new Error("现在没有迹可刻");
      st.pendingTrace = null;
      st.log.push("不刻");
      advance(st);
      return st;
    }
    case "winter_carve": {
      if (st.phase !== "winter") throw new Error("现在不是冬夜");
      const idx = st.tallies.findIndex((t: Tally) => t.id === action.tally);
      if (idx < 0) throw new Error(`手里没有事签 ${action.tally}`);
      const t = st.tallies[idx];
      const r = judge(st, t.target, action.answer);
      st.tallies.splice(idx, 1);
      if (r.ok) {
        applyDelta(st, rules.winter_night.correct_delta as Partial<Dims>);
        st.zilu.push(t.target);
        st.newThisGen.push(t.target);
        st.log.push(`冬夜刻成 ${t.target}`);
        if (!st.tutorialDone && st.generation <= 1) st.tutorialDone = true;
      } else {
        applyDelta(st, rules.winter_night.wrong_delta as Partial<Dims>);
        st.log.push(`冬夜刻错 ${t.target}，骨片裂`);
      }
      if (r.clue) (st.clues[r.clue[0]] ??= []).push(r.clue[1]);
      return st;
    }
    case "winter_defer": {
      if (st.phase !== "winter") throw new Error("现在不是冬夜");
      if (!st.tallies.some((t: Tally) => t.id === action.tally)) throw new Error(`手里没有事签 ${action.tally}`);
      st.log.push(`事签 ${action.tally} 留到明年`);
      return st;
    }
    case "winter_end": {
      if (st.phase !== "winter") throw new Error("现在不是冬夜");
      if (checkFail(st)) return st;
      st.yearsLeft -= 1;
      if (st.yearsLeft <= 0) {
        st.ending = { kind: "good", name: rules.endings_good.years_used_up };
        st.phase = "ended";
        st.legacy = settleGeneration(st);
        st.log.push(`余年用完：${st.ending.name}`);
        return st;
      }
      const deck = buildYearDeck(st.seed, 1, YEAR_CARDS);
      st.current = deck[0]; st.deck = deck.slice(1); enterCard(st);
      st.log.push("新的一年");
      return st;
    }
    case "pick_toggle": {
      // 开局挑字：加/减一个字（最多 3 个）
      if (st.phase !== "pick") throw new Error("现在不是挑字的时候");
      const picks: string[] = (action.picks ?? st.picks ?? []).slice();
      const ch = action.char;
      const i = picks.indexOf(ch);
      if (i >= 0) picks.splice(i, 1);
      else if (picks.length < rules.word_box.slots) picks.push(ch);
      st.picks = picks;
      return st;
    }
    case "heir": {
      if (st.phase !== "ended") throw new Error("这一代还没结束");
      st.phase = "pick";
      st.picks = [];
      st.log.push("出发挑字");
      return st;
    }
    case "begin_generation": {
      if (st.phase !== "pick") throw new Error("现在不是挑字的时候");
      const picks: string[] = action.picks ?? st.picks ?? [];
      if (picks.length !== rules.word_box.slots) throw new Error("要挑三个字");
      const legacy = st.legacy as GenerationCarryOver;
      const seed = (st.seed + 0x9e3779b1) >>> 0;
      const next = createGame({ seed, generation: (st.generation as number) + 1, startZilu: legacy.zilu, wordBox: picks, debugGoal: st.debugGoal });
      next.tallies = legacy.carriedTally ? [legacy.carriedTally] : [];
      return next;
    }
  }
  throw new Error(`不认识的 action：${(action as any).type}`);
}

export function run(cfg: GameConfig, actions: Action[]): GameState {
  let st = createGame(cfg);
  for (const a of actions) st = step(st, a);
  return st;
}

// 回归用的快照：只取验收关心的字段，日志也带上，方便对比出错位置
export function snapshot(st: GameState) {
  return {
    phase: st.phase, generation: st.generation, dims: st.dims, bones: st.bones, tallies: st.tallies.map((t: Tally) => t.id),
    zilu: st.zilu, newThisGen: st.newThisGen, dropped: st.dropped, clues: st.clues,
    hiddenMarkers: st.hiddenMarkers, ending: st.ending,
    goals: (st.goals as any[]).map((g) => ({ id: g.id, achieved: g.achieved })),
    goalEvents: (st.goalEvents as any[]).map((e) => e.id),
    legacy: st.legacy ? { zilu: st.legacy.zilu, carriedTally: st.legacy.carriedTally?.id ?? null } : null,
    log: st.log,
  };
}
