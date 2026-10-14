// 造字人一年里程碑的纯规则引擎：不碰界面，只吃动作、吐状态。
// 渲染壳只需要：createGame() 建局，step(state, action) 推进，读 state 画界面。
import rules from "../data/rules.js";
import charsData from "../data/chars_slice.js";
import cardsData from "../data/year1_cards.js";
import { mulberry32, shuffle } from "./rng.js";
import type { Card, GameState, Action, Tally, Ending, Legacy, Trace, DropItem } from "./types.js";

export const RULES = rules;
export const CHARS = charsData.chars as Record<string, any>;
export const CARDS = cardsData.cards as Card[];
const DIM_KEYS = rules.dims.keys as Dim[];

export type DimKey = string ;
type Dim = any;
export interface GameStateInfo {            
  pendingTrace: Trace ;
  wordBox: string[] ;
  bones: number ;
}

function cardById(id: string, cards: Card[]): Card {
  const c = cards.find((x) => x.id === id);
  if (!c) throw new Error(`没有这张卡：${id}`);
  return c;
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

export function createGame(cfg: GameConfig): GameState {
  const cards = cfg.cards ?? CARDS;
  const dims = Object.fromEntries(DIM_KEYS.map((k) => [k, rules.dims.start])) as Dims;
  const deck = buildYearDeck(cfg.seed, 0, cards);
  const st: GameState = {
    seed: cfg.seed,
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
    wordBox: (cfg.wordBox ?? charsData.milestone_word_box).slice(0, rules.word_box.slots),
    dropped: [],
    clues: {},
    hiddenMarkers: {},
    ending: null,
    legacy: null,
    log: [`开局：种子 ${cfg.seed}，第一张 ${deck[0]}`],
  };
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

function advance(st: GameState) {
  // 一张卡（含刻不刻）处理完之后：判结局，再翻下一张或进冬夜
  if (checkFail(st)) return;
  if (st.deck.length > 0) {
    st.current = st.deck.shift() ;
    st.phase = "card";
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
  if (prev.phase === "ended") throw new Error("这一代已经结束");
  const st = clone(prev);
  switch (action.type) {
    case "choose": {
      if (st.phase !== "card" || !st.current) throw new Error("现在不是选卡的时候");
      if (action.expectCard && action.expectCard !== st.current) throw new Error(`期望卡 ${action.expectCard}，实际是 ${st.current}`);
      const card = cardById(st.current, CARDS);
      let opt: Option | null = null;
      if (action.side === "drop") {
        const ch = st.wordBox[action.slot];
        if (!ch) throw new Error(`字匣第 ${action.slot + 1} 格是空的`);
        if (st.dropped.includes(ch)) throw new Error(`${ch} 这一代已经落过`);
        if (!usableChar(st, ch)) throw new Error(`${ch} 这一代不能用`);
        const d = card.drops.find((x) => x.char === ch);
        if (!d) throw new Error(`这张卡不能落 ${ch}`);
        st.dropped.push(ch);
        applyDelta(st, d.delta);
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
      const idx = st.tallies.findIndex((t) => t.id === action.tally);
      if (idx < 0) throw new Error(`手里没有事签 ${action.tally}`);
      const t = st.tallies[idx];
      const r = judge(st, t.target, action.answer);
      st.tallies.splice(idx, 1);
      if (r.ok) {
        applyDelta(st, rules.winter_night.correct_delta as Partial<Dims>);
        st.zilu.push(t.target);
        st.newThisGen.push(t.target);
        st.log.push(`冬夜刻成 ${t.target}`);
      } else {
        applyDelta(st, rules.winter_night.wrong_delta as Partial<Dims>);
        st.log.push(`冬夜刻错 ${t.target}，骨片裂`);
      }
      if (r.clue) (st.clues[r.clue[0]] ??= []).push(r.clue[1]);
      return st;
    }
    case "winter_defer": {
      if (st.phase !== "winter") throw new Error("现在不是冬夜");
      if (!st.tallies.some((t) => t.id === action.tally)) throw new Error(`手里没有事签 ${action.tally}`);
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
      const deck = buildYearDeck(st.seed, 1, CARDS);
      st.current = deck[0]; st.deck = deck.slice(1); st.phase = "card";
      st.log.push("新的一年");
      return st;
    }
  }
}

export function run(cfg: GameConfig, actions: Action[]): GameState {
  let st = createGame(cfg);
  for (const a of actions) st = step(st, a);
  return st;
}

// 回归用的快照：只取验收关心的字段，日志也带上，方便对比出错位置
export function snapshot(st: GameState) {
  return {
    phase: st.phase, dims: st.dims, bones: st.bones, tallies: st.tallies.map((t) => t.id),
    zilu: st.zilu, newThisGen: st.newThisGen, dropped: st.dropped, clues: st.clues,
    hiddenMarkers: st.hiddenMarkers, ending: st.ending,
    legacy: st.legacy ? { zilu: st.legacy.zilu, carriedTally: st.legacy.carriedTally?.id ?? null } : null,
    log: st.log,
  };
}
