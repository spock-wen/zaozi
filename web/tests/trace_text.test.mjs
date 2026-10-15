// W3 回归（单元侧）：卡上的「迹」数据只有 target / tally_text，没有 text。
// 缺陷：app.js 读 st.pendingTrace.text → 渲染出「卡上出现一道迹：undefined」。
// 这里把数据与引擎侧的字段锁死，配合 tests/e2e/tutorial_text.test.mjs 的可见文案断言。
import test from "node:test";
import assert from "node:assert/strict";
import { loadEngine } from "./helpers/load_engine.mjs";

const E = await loadEngine();
const SEED = 20261012;

function eachTrace(fn) {
  for (const card of E.CARDS) {
    if (card.trace) fn(`card ${card.id}`, card.trace, card);
    for (const side of ["left", "right"]) {
      if (card[side]?.trace) fn(`${card.id}.${side}`, card[side].trace, card);
    }
  }
}

test("every trace carries target + tally_text and never a bare text field", () => {
  let seen = 0;
  eachTrace((where, trace) => {
    seen++;
    assert.equal(typeof trace.target, "string", `${where}: trace.target 应为字符串`);
    assert.ok(trace.target.length > 0, `${where}: trace.target 不能为空`);
    assert.equal(typeof trace.tally_text, "string", `${where}: trace.tally_text 应为字符串（壳读的就是它）`);
    assert.ok(trace.tally_text.length > 0, `${where}: trace.tally_text 不能为空`);
    assert.ok(!("text" in trace), `${where}: trace 不该有 text 字段（W3 的 undefined 就是这么来的）`);
  });
  assert.ok(seen >= 5, `迹样例太少（${seen}），数据可能被改动`);
});

test("engine T03 enters engrave with pendingTrace.tally_text set and no .text", () => {
  let st = E.createGame({ seed: SEED });
  st = E.step(st, { type: "choose", side: "left" });   // T01 → T02
  st = E.step(st, { type: "choose", side: "right" });  // T02 → T03（锁拖，进刻）
  assert.equal(st.current, "T03");
  assert.equal(st.phase, "engrave");
  assert.equal(st.pendingTrace.target, "休");
  assert.equal(st.pendingTrace.text, undefined, "pendingTrace 不该有 text（壳不能再读它）");
  assert.equal(typeof st.pendingTrace.tally_text, "string");
  assert.ok(st.pendingTrace.tally_text.length > 0);
});
