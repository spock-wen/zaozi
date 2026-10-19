// 单元（静态）：输入队列只有一个入队口、一个重放口；并锁住「什么能改出卡阶段的状态」的入口。
// 读 web/app.js 源码文本，防止以后有人绕过 enqueueInput/armDrain 另开一条重放路径，
// 把 drainKeys 这个分散约定加回来，或给拖拽/落字/提交另开一条绕过队列的直达入口。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const APP = path.join(ROOT, "web/app.js");
const src = fs.readFileSync(APP, "utf8");

// 顶层声明（function 或 const/let/var，本项目都写在行首）→ 名字到源码区间 [start, end)，
// 区间取到下一个顶层声明之前（末尾多带的注释/绑定不影响 token 断言）。
const decls = [...src.matchAll(/^(?:function\s+([A-Za-z0-9_$]+)\s*\(|(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=)/gm)]
  .map((m) => ({ name: m[1] || m[2], index: m.index }))
  .sort((a, b) => a.index - b.index);
const spans = new Map();
for (let i = 0; i < decls.length; i++) {
  spans.set(decls[i].name, [decls[i].index, i + 1 < decls.length ? decls[i + 1].index : src.length]);
}
function spanOf(name) {
  const s = spans.get(name);
  assert.ok(s, `源码里找不到顶层声明 ${name}`);
  return s;
}
const bodyOf = (name) => { const [a, b] = spanOf(name); return src.slice(a, b); };
const inside = (idx, name) => { const [a, b] = spanOf(name); return idx >= a && idx < b; };
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// 事件处理器区间：on($("id"), ...) 与 addEventListener("type", ...)，从开括号扫到配对闭括号。
function matchParen(s, open) {
  let d = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "(") d++;
    else if (s[i] === ")") { d--; if (d === 0) return i; }
  }
  return -1;
}
const handlers = [];
for (const m of src.matchAll(/^on\(\$\("([^"]+)"\)/gm)) {
  const close = matchParen(src, src.indexOf("(", m.index));
  if (close > 0) handlers.push({ name: `on($("${m[1]}")`, start: m.index, end: close + 1 });
}
for (const m of src.matchAll(/addEventListener\(/g)) {
  const t = /^addEventListener\(\s*"([^"]+)"/.exec(src.slice(m.index));
  if (!t) continue;
  const close = matchParen(src, m.index + "addEventListener".length);
  if (close > 0) handlers.push({ name: `addEventListener("${t[1]}")`, start: m.index, end: close + 1 });
}
// 某处代码的上下文：包含它的最内层事件处理器，否则最内层顶层声明，否则 "?"。
function contextOf(idx) {
  let h = null;
  for (const x of handlers) if (idx >= x.start && idx < x.end && (!h || x.start > h.start)) h = x;
  if (h) return { kind: "handler", name: h.name, text: src.slice(h.start, h.end) };
  let fn = null;
  for (const [name, [a, b]] of spans) if (idx >= a && idx < b && (!fn || a > fn.a)) fn = { name, a, b };
  if (fn) return { kind: "function", name: fn.name, text: src.slice(fn.a, fn.b) };
  return { kind: "top", name: "?", text: "" };
}
// 调用点：`name(` 出现处，排除 `function name(` 定义。
function callSites(name) {
  const re = new RegExp(`\\b${escape(name)}\\s*\\(`, "g");
  return [...src.matchAll(re)].map((m) => m.index).filter((i) => src.slice(i - 9, i) !== "function ");
}

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

test("drainStep 先等入场落定再走两帧 rAF，并在换阶段/浮层打开时清空队列", () => {
  const body = bodyOf("drainStep");
  assert.match(body, /whenCardEntryDone\s*\(/, "drainStep 应先等 whenCardEntryDone()");
  assert.match(body, /requestAnimationFrame\s*\([\s\S]*?requestAnimationFrame\s*\(/, "drainStep 应再等两帧嵌套 requestAnimationFrame");
  // 浮层检查：使用 modalOpen() 统领模态浮层
  assert.match(body, /modalOpen\s*\(/, "drainStep 应使用 modalOpen() 检查浮层");
});

test("handleKey 的 Escape 分支：通用分支清空整个队列，存档框分支不清", () => {
  assert.match(src, /function\s+clearQueue\s*\(/, "应有 function clearQueue");
  const body = bodyOf("handleKey");
  const escLines = body.split("\n").filter((l) => /e\.key\s*===\s*"Escape"/.test(l));
  assert.equal(escLines.length, 2, `handleKey 应有两个 Escape 分支，实为 ${escLines.length}`);
  const generic = escLines.find((l) => !/savedlg/.test(l));
  const dlg = escLines.find((l) => /savedlg/.test(l));
  assert.ok(generic, "应有不涉及 savedlg 的通用 Escape 分支");
  assert.ok(dlg, "应有 savedlg Escape 分支");
  assert.match(generic, /clearQueue\s*\(/, `通用 Escape 分支应先调用 clearQueue()：${generic.trim()}`);
  assert.ok(!/clearQueue\s*\(/.test(dlg), `存档框 Escape 分支不应调用 clearQueue()：${dlg.trim()}`);
});

test("浮层键盘：keydown 先判 modalOpen，再 Enter 守卫、再 inputBusy；Esc 关浮层不清队列", () => {
  assert.match(src, /function\s+modalOpen\s*\(/, "应有 function modalOpen");
  assert.match(src, /function\s+closeOverlay\s*\(/, "应有 function closeOverlay");
  assert.ok(!/clearQueue\s*\(/.test(bodyOf("closeOverlay")), "closeOverlay 不应调用 clearQueue（Esc 关浮层不清队列）");

  const kd = handlers.find((h) => h.name === 'addEventListener("keydown")');
  assert.ok(kd, '应有 addEventListener("keydown") 监听');
  const body = src.slice(kd.start, kd.end);
  const iModal = body.indexOf("modalOpen()");
  const iEnter = body.indexOf('e.key === "Enter"');
  const iBusy = body.indexOf("inputBusy()");
  assert.ok(iModal >= 0, "keydown 开头应先判 modalOpen()");
  assert.ok(iEnter > iModal, "modalOpen() 判定应在 Enter 守卫之前");
  assert.ok(iBusy > iModal, "modalOpen() 判定应在 inputBusy() 之前");
});

test("动画出口 flyOut / rebound 不再调用任何 drain", () => {
  assert.match(
    bodyOf("flyOut"),
    /if\s*\(\s*reducedPref\(\)\s*\)\s*\{[^}]*ui\.animating\s*=\s*true/,
    "flyOut 的减弱动画分支也应置 ui.animating = true",
  );
  for (const name of ["flyOut", "rebound"]) {
    const body = bodyOf(name);
    assert.ok(!/\bdrainKeys\b/.test(body), `${name} 不应调用 drainKeys`);
    assert.ok(!/\barmDrain\s*\(/.test(body), `${name} 不应调用 armDrain`);
    assert.ok(!/\bdrainStep\b/.test(body), `${name} 不应直接调用 drainStep`);
  }
});

// 出卡阶段能直接改状态的入口只有四个：commitSide（经 flyOut 回调）、onUp（拖拽松手）、
// handleKey 的出卡分支、dropSlot。每个入口及非出卡阶段的 dispatch( 调用点必须按调用处
// 严格匹配白名单及次数，防止通过白名单处理器偷偷新增绕过队列的直达调用（M3/M4）。
const EXPECTED_COMMITSIDE = {
  handleKey: 2,
  applyQueued: 1,
  'on($("opt-left")': 1,
  'on($("opt-right")': 1,
};

const EXPECTED_DISPATCH = {
  drainStep: 2,
  onUp: 2,
  commitSide: 1,
  handleKey: 5,
  dropSlot: 1,
  winterCarve: 1,
  pickClick: 1,
  pickToggle: 2,
  pickAction: 1,
  'on($("winter")': 2,
  'on($("card")': 1,
  'on($("bonecorner")': 1,
  'on($("elder")': 1,
};

const EXPECTED_DROPSLOT = {
  applyQueued: 1,
  'on($("wordbox")': 1,
};

test("出卡阶段只有四个状态变动入口，没有新的直达 dispatch（严格次数白名单）", () => {
  const commitCounts = new Map();
  for (const i of callSites("commitSide")) {
    const c = contextOf(i);
    commitCounts.set(c.name, (commitCounts.get(c.name) || 0) + 1);
  }
  assert.deepEqual(
    Object.fromEntries(commitCounts),
    EXPECTED_COMMITSIDE,
    "commitSide 调用点及次数必须完全匹配白名单（M4 守卫）"
  );

  const dropCounts = new Map();
  for (const i of callSites("dropSlot")) {
    const c = contextOf(i);
    dropCounts.set(c.name, (dropCounts.get(c.name) || 0) + 1);
  }
  assert.deepEqual(
    Object.fromEntries(dropCounts),
    EXPECTED_DROPSLOT,
    "dropSlot 调用点及次数必须完全匹配白名单"
  );
  for (const i of callSites("handleKey")) {
    const c = contextOf(i);
    const ok = c.name === "applyQueued" || (c.kind === "handler" && c.name === 'addEventListener("keydown")');
    assert.ok(ok, `handleKey( 出现在未许可的入口 ${c.name}（应只在 keydown 监听里，或 applyQueued）`);
  }

  const dispatchCounts = new Map();
  for (const i of callSites("dispatch")) {
    const c = contextOf(i);
    dispatchCounts.set(c.name, (dispatchCounts.get(c.name) || 0) + 1);
  }
  assert.deepEqual(
    Object.fromEntries(dispatchCounts),
    EXPECTED_DISPATCH,
    "dispatch( 调用点及次数必须完全匹配白名单（M3 守卫）"
  );
});

