// 单元（静态）：输入队列只有一个入队口、一个重放口。
// 读 web/app.js 源码文本锁结构，防止以后有人绕过 enqueueInput/armDrain 另开一条重放路径，
// 或把 drainKeys 这个分散约定又加回来。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const APP = path.join(ROOT, "web/app.js");
const src = fs.readFileSync(APP, "utf8");

// 顶层 function 声明（本项目都写在行首）→ 名字到源码区间 [start, end)。
const decls = [...src.matchAll(/^function\s+([A-Za-z0-9_$]+)\s*\(/gm)];
const spans = new Map();
for (let i = 0; i < decls.length; i++) {
  spans.set(decls[i][1], [decls[i].index, i + 1 < decls.length ? decls[i + 1].index : src.length]);
}
function spanOf(name) {
  const s = spans.get(name);
  assert.ok(s, `源码里找不到顶层 function ${name}`);
  return s;
}
const bodyOf = (name) => { const [a, b] = spanOf(name); return src.slice(a, b); };
const inside = (idx, name) => { const [a, b] = spanOf(name); return idx >= a && idx < b; };
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test("入队只有一个口：唯一的 keyQueue.push 落在 enqueueInput 里", () => {
  const hits = [...src.matchAll(/keyQueue\.push\s*\(/g)];
  assert.equal(hits.length, 1, `keyQueue.push( 只应出现一次，实为 ${hits.length} 次`);
  assert.match(src, /function\s+enqueueInput\s*\(/, "应有 function enqueueInput");
  assert.ok(inside(hits[0].index, "enqueueInput"), "唯一的 keyQueue.push( 必须落在 function enqueueInput 内");
});

test("armDrain 是逐项重放函数的唯一调用者", () => {
  assert.match(src, /function\s+armDrain\s*\(/, "应有 function armDrain");
  const drain = bodyOf("armDrain");
  // armDrain 里调用到的、本文件顶层声明过的函数（重放函数就在其中）。
  const declared = new Set(spans.keys());
  for (const m of src.matchAll(/^(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=/gm)) declared.add(m[1]);
  const called = new Set();
  for (const m of drain.matchAll(/([A-Za-z0-9_$]+)\s*\(/g)) {
    if (declared.has(m[1]) && m[1] !== "armDrain") called.add(m[1]);
  }
  assert.ok(called.size > 0, "armDrain 里应调用本文件声明的重放函数");
  const onlyFromDrain = [...called].filter((name) => {
    const re = new RegExp(`\\b${escape(name)}\\s*\\(`, "g");
    const at = [...src.matchAll(re)].map((m) => m.index);
    return at.length > 0 && at.every((i) => inside(i, "armDrain"));
  });
  assert.ok(onlyFromDrain.length > 0, `应有重放函数只被 armDrain 调用，实见 armDrain 调用的：${[...called].join(", ")}`);
});

test("drainKeys 这个分散约定已删除", () => {
  assert.ok(!/\bdrainKeys\b/.test(src), "不应再有 drainKeys 标识符");
});

test("动画出口 flyOut / rebound 不再调用任何 drain", () => {
  for (const name of ["flyOut", "rebound"]) {
    const body = bodyOf(name);
    assert.ok(!/\bdrainKeys\b/.test(body), `${name} 不应调用 drainKeys`);
    assert.ok(!/\barmDrain\s*\(/.test(body), `${name} 不应调用 armDrain`);
  }
});
