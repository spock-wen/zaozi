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
  assert.match(body, /phase\s*!==\s*"card"/, `drainStep 应在 phase !== "card" 时清空队列`);
  assert.match(body, /savedlg/, "drainStep 应在存档框打开时清空队列");
  assert.match(body, /menuOpen/, "drainStep 应在菜单打开时清空队列");
  assert.match(body, /panelOpen/, "drainStep 应在目标面板打开时清空队列");
  assert.match(body, /drawer/, "drainStep 应在抽屉打开时清空队列");
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
// handleKey 的出卡分支、dropSlot。其余 dispatch( 调用点必须落在非出卡阶段的白名单里；
// 有新的调用点没被归类就报出来（可能是新开的绕过队列的直达入口）。
const CARD_CHANGERS = new Set(["commitSide", "onUp", "handleKey", "dropSlot"]);
const NON_CARD_ALLOW = [
  "winterCarve", "pickClick", "pickToggle", "pickAction", "restore", "newGame",
  'on($("winter")', 'on($("card")', 'on($("bonecorner")', 'on($("pick")',
  'on($("elder")', 'on($("endseq")', 'on($("menu-pop")',
];

test("出卡阶段只有四个状态变动入口，没有新的直达 dispatch", () => {
  for (const i of callSites("commitSide")) {
    const c = contextOf(i);
    const ok = c.name === "handleKey" || c.name === "applyQueued" || (c.kind === "handler" && c.text.includes("inputBusy()"));
    assert.ok(ok, `commitSide( 出现在未许可的入口 ${c.name}（应只在 handleKey / applyQueued 或含 inputBusy() 的处理器里）`);
  }
  for (const i of callSites("dropSlot")) {
    const c = contextOf(i);
    const ok = c.name === "applyQueued" || (c.kind === "handler" && c.text.includes("inputBusy()"));
    assert.ok(ok, `dropSlot( 出现在未许可的入口 ${c.name}（应只在 applyQueued 或含 inputBusy() 的处理器里）`);
  }
  for (const i of callSites("handleKey")) {
    const c = contextOf(i);
    const ok = c.name === "applyQueued" || (c.kind === "handler" && c.text.includes("inputBusy()"));
    assert.ok(ok, `handleKey( 出现在未许可的入口 ${c.name}（应只在含 inputBusy() 的 keydown 监听里，或 applyQueued）`);
  }
  const unclassified = [];
  for (const i of callSites("dispatch")) {
    const c = contextOf(i);
    if (CARD_CHANGERS.has(c.name) || NON_CARD_ALLOW.includes(c.name)) continue;
    unclassified.push(`${c.name}@${src.slice(0, i).split("\n").length}`);
  }
  assert.deepEqual(unclassified, [], `有 dispatch( 调用点没被归类，可能是新开的直达入口：${unclassified.join(" ; ")}`);
});
