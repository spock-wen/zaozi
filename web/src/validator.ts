// 内容校验器骨架（GAMEPLAY §2.5 的 5 条）。V2、V3、V5 已实现；V1、V4 先占位，返回 todo。
import charsData from "../data/chars_slice.js";
import cardsData from "../data/year1_cards.js";
import type { Card } from "./types.js";

import type { Issue, GameState, Action, Tally, Ending, Legacy, Trace, DropItem, Rule } from "./types.js";

const CHARS = charsData.chars as Record<string, any>;

function forbiddenFor(target: string): string[] {
  const def = CHARS[target];
  if (!def) return [];
  const words = new Set<string>(def.forbidden ?? []);
  const parts: string[] = def.components ?? (def.base ? [def.base] : []);
  for (const p of parts) for (const w of CHARS[p]?.forbidden ?? [p]) words.add(w);
  return [...words];
}

export function validateContent(cards: Card[] = cardsData.cards as Card[]): Issue[] {
  const out: Issue[] = [];
  // V1 每个字至少有落字或解锁之一：需要全量字效果表，先占位
  out.push({ rule: "V1", level: "todo", where: "chars", message: "待接字效果表（落字 / 解锁）后实现" });
  for (const c of cards) {
    // V2 落字选项至少一项为负
    for (const d of c.drops) {
      if (!Object.values(d.delta).some((v) => (v as number) < 0))
        out.push({ rule: "V2", level: "error", where: `${c.id} 落字 ${d.char}`, message: "落字选项的数值变化里没有负数" });
    }
    // V3 事签禁用词
    for (const side of ["left", "right"] as const) {
      const tr = c[side].trace;
      if (!tr) continue;
      if (!CHARS[tr.target]) { out.push({ rule: "V3", level: "error", where: `${c.id}.${side}`, message: `迹的目标字 ${tr.target} 不在字表` }); continue; }
      for (const w of forbiddenFor(tr.target))
        if (tr.tally_text.includes(w)) out.push({ rule: "V3", level: "error", where: `${c.id}.${side}`, message: `事签出现禁用词「${w}」（目标 ${tr.target}）` });
    }
  }
  // V4 会意字事签出现时，部件里至少已有 2 个近似字：需要近似字表，先占位
  out.push({ rule: "V4", level: "todo", where: "chars", message: "待接近似字表后实现；一年里程碑开局字录只有水日人木田火，没有大、禾这类近似字" });
  // V5 指事字底字在首版字表里
  for (const [k, v] of Object.entries(CHARS)) {
    if (v.method === "zhishi" && !charsData.first_edition_chars.includes(v.base))
      out.push({ rule: "V5", level: "error", where: k, message: `底字 ${v.base} 不在首版字表` });
  }
  return out;
}
