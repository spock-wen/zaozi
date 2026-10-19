// R号: R02（落定+250ms）R01（缓冲顺序）R08（刻字卡停留窗口）R10（重置时 toast/清队顺序）— A-R6 P2-2①②/P3-3/P3-4/toast-live
// PR9 r7（fb1439a）工程审核 r6 条目的动态验证：node p7_audit.mjs <engine> <leg:desk|touch> <baseURL> <outdir>
//  desk = 1280x800 键盘+鼠标；touch = 390x844 hasTouch（chromium/webkit isMobile，DPR3）真 touchscreen.tap + 键盘
//  A  P2-2②：飞出中排队提交（键 →→ / 点右选项），下一张落定后 250ms 内现场再输入（←← / 点左选项）→ 排队项先执行（B 交 right），现场项不插队、不丢
//  B  P2-2①：重新开局 / 读档(restore) / 同码重复导入 后立即输入 → 若排队，须在独立落定后 ≥230ms 才提交（settleKey 重置）
//  C  P3-3：刻字卡上现场 ←/→/Enter 弹锁定提示、不提交；上一张飞出中排的 →→ 进刻字卡只弹一次提示；飞出中按 K 不入队、不刻
//  D  P3-4：刻字卡入场中（T02 刚交出、T03 未落定）点骨片 / 点先不刻 / 按 K / 按 S → 入队，T03 独立落定后 ≥230ms 才执行，且只执行一次
//  E  toast 与清队顺序：T03 拦截提示在场 + 队列非空（含挂起停留）时 重新开局/导入/读档 → 150ms 起 2.5s 内无锁定提示回弹；#toast-live 随 toast 写入/清空
import { chromium, firefox, webkit } from "playwright"; import fs from "node:fs";
const [engine, LEG, BASE, OUT] = process.argv.slice(2); const touch = LEG === "touch";
const VP = touch ? (process.env.VP_TOUCH || "390x844") : (process.env.VP_DESK || "1280x800"); const [W, H] = VP.split("x").map(Number); const cfg = `${engine}_${VP}_${LEG}`;
fs.mkdirSync(`${OUT}/shots/${cfg}`, { recursive: true });
const opt = { viewport: { width: W, height: H }, hasTouch: touch }; if (touch) Object.assign(opt, engine === "firefox" ? { deviceScaleFactor: 3 } : { isMobile: true, deviceScaleFactor: 3 });
const rows = [], raw = []; const cell = (s) => String(s ?? "").replace(/[\n\r]+/g, " ").replace(/,/g, "，").slice(0, 700);
const rec = (blk, item, res, why, ev) => { rows.push([blk, item, engine, touch ? "touch" : "desk", VP, "主流", "r6审查", res, why, ev]); console.log(res.padEnd(5), blk, item, "|", String(why).slice(0, 260)); };
const flush = () => { fs.writeFileSync(`${OUT}/p7_${cfg}.csv`, "块,项,引擎,模式,视口,范围,遗留,判定,原因,证据路径\n" + rows.map((r) => r.map(cell).join(",")).join("\n") + "\n"); fs.writeFileSync(`${OUT}/p7_${cfg}.json`, JSON.stringify(raw, null, 1)); };
const hard = setTimeout(() => { rec("流程", "总超时", "FAIL", "超过 560s", ""); flush(); process.exit(3); }, 560000);
const B = await { chromium, firefox, webkit }[engine].launch(); const ctx = await B.newContext(opt); const p = await ctx.newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message.slice(0, 120)));
let seq = 0; const shot = async (n) => { const f = `shots/${cfg}/${String(++seq).padStart(3, "0")}_${n}.png`; await p.screenshot({ path: `${OUT}/${f}`, fullPage: true }).catch(() => {}); return f; };
const center = (s) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width > 0 ? [r.left + r.width / 2, r.top + r.height / 2] : null; }, s);
const tapXY = async (x, y) => { if (touch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y); };
const tap = async (s) => { const c = await center(s); if (!c) throw new Error(s + " 无盒"); await tapXY(c[0], c[1]); };
const still = async (ms = 400) => { await p.waitForFunction(() => !__zz.animating && !(__zz.queued > 0) && !document.getElementById("card").getAnimations().some((a) => a.playState === "running"), null, { timeout: 9000, polling: 30 }).catch(() => {}); await p.waitForTimeout(ms); };
const imp = async (c) => { await p.evaluate((c) => __zz.importCode(c), c); await p.waitForTimeout(300); await still(500); await mon(); };
const Z = () => p.evaluate(() => ({ cur: __zz.st.current, ph: __zz.st.phase, n: __zz.actions.length, q: __zz.queued, anim: __zz.animating, toast: document.getElementById("toast").classList.contains("on") ? document.getElementById("toast").textContent.trim() : "", live: document.getElementById("toast-live")?.textContent ?? null }));
// 页内监视：rAF 帧（是否在动画）、actions.push 时刻、toast 显示事件
const mon = () => p.evaluate(() => {
  // 帧监视（不挂 actions.push：重新开局/导入会换掉 actions 数组）：每帧记 是否在动画、动作数、当前卡、末动作；动作数增加的那一帧 = 提交
  if (window.__M) window.__M.on = false; const M = window.__M = { fr: [], pc: [], ts: [], on: true };
  const t = document.getElementById("toast"); if (window.__MO) window.__MO.disconnect(); window.__MO = new MutationObserver(() => { if (t.classList.contains("on")) M.ts.push({ t: performance.now(), text: t.textContent.trim() }); }); window.__MO.observe(t, { attributes: true, childList: true, characterData: true, subtree: true });
  let pn = __zz.actions.length, pcur = __zz.st.current;
  const loop = () => { if (!M.on) return; const z = __zz; const n = z.actions.length, cur = z.st.current, now = performance.now();
    if (n > pn) { const la = z.actions[n - 1] || {}; M.pc.push({ t: now, on: pcur, cur, x: [la.side || la.type] }); }
    pn = n; pcur = cur; M.fr.push({ t: now, a: !!(z.animating || document.getElementById("card").getAnimations().some((x) => x.playState === "running")), cur }); requestAnimationFrame(loop); }; requestAnimationFrame(loop); });
const grab = () => p.evaluate(() => ({ fr: window.__M.fr, pc: window.__M.pc, ts: window.__M.ts, now: performance.now() }));
// t 之前最后一段连续静止帧的起点（= 独立落定时刻）
const settleBefore = (fr, t) => { let s = null; for (const f of fr) { if (f.t > t) break; if (f.a) s = null; else if (s === null) s = f.t; } return s; };
const LOCK = /先点卡角|骨片|刻下/;
// 停留：提交 t 之前（tPrev 之后）最后一段连续静止帧的长度。提交在飞出结束时记账，所以取「飞出开始前」那段静止；若提交前一直静止（刻/跳过即时执行），取到 t 为止
const dwellBefore = (fr, t, tPrev = -1) => { let s = null, e = null, last = null; for (const f of fr) { if (f.t <= tPrev) continue; if (f.t > t) break; if (!f.a) { if (s === null) s = f.t; e = f.t; } else if (s !== null) { last = e - s + 16; s = null; } } if (s !== null) last = t - s; return last === null ? null : Math.round(last); };
const animsNow = () => p.evaluate(() => document.getElementById("card").getAnimations().filter((a) => a.playState === "running").map((a) => a.animationName || a.transitionProperty || a.constructor.name).join("|") + (__zz.animating ? "|js" : ""));
const open = async () => { await p.goto(`${BASE}/?seed=20261016`, { waitUntil: "load" }); await p.evaluate(() => localStorage.clear()); await p.goto(`${BASE}/?seed=20261016`, { waitUntil: "load" }); await p.waitForFunction(() => !!window.__zz); await p.waitForTimeout(900); };
const dir = async (side) => { if (touch) await tap(side === "left" ? "#opt-left" : "#opt-right"); else { const k = side === "left" ? "ArrowLeft" : "ArrowRight"; await p.keyboard.press(k); await p.keyboard.press(k); } };
try {
  await open(); const version = await p.evaluate(async () => (((await (await fetch("sw.js", { cache: "no-store" })).text()).match(/VERSION = "([^"]+)"/) || [])[1]));
  const codes = {}; for (let i = 0; i < 3; i++) { await still(); const z = await p.evaluate(() => ({ cur: __zz.st.current, c: __zz.code() })); codes[z.cur] = z.c; if (z.cur === "T03") break; await tap("#opt-left"); }
  raw.push({ version, codes: Object.keys(codes) });
  // ---------- A ----------
  for (let rep = 0; rep < 2; rep++) {
    await imp(codes.T01); await dir("left"); await p.waitForTimeout(50); await dir("right"); const q1 = (await Z()).q;
    // 等 T02 独立落定，立即现场输入
    await p.waitForFunction(() => __zz.st.current === "T02" && !__zz.animating && !document.getElementById("card").getAnimations().some((a) => a.playState === "running"), null, { timeout: 5000, polling: "raf" }).catch(() => {});
    await p.waitForTimeout(+(process.env.A_DELAY ?? 100)); const tLive = await p.evaluate(() => performance.now()); await dir("left"); const qLive = (await Z()).q;
    await p.waitForTimeout(2500); await still(); const g = await grab(); const z = await Z(); const ev = await shot(`A_order_${rep}`);
    const seqA = g.pc.map((c) => `${c.on}:${c.x.join("+")}`); const bCommit = g.pc.find((c) => c.on === "T02");
    const iB = g.pc.indexOf(bCommit); const dB = bCommit ? dwellBefore(g.fr, bCommit.t, iB > 0 ? g.pc[iB - 1].t : -1) : null;
    const sB = iB > 0 ? settleBefore(g.fr.filter((f) => f.t > g.pc[iB - 1].t), tLive) : null; const liveAfterSettle = sB ? Math.round(tLive - sB) : null; const third = g.pc[2];
    const liveOK = third ? (third.x.includes("left") && third.on !== "T02") : (z.ph === "engrave" && g.ts.some((t) => LOCK.test(t.text)));
    const ok = bCommit && bCommit.x.includes("right") && g.pc[0]?.x.includes("left") && liveOK && dB >= 230 && liveAfterSettle !== null && liveAfterSettle < 250;
    raw.push({ blk: "A", rep, q1, qLive, seqA, dB, liveAfterSettle, z, ts: g.ts });
    rec("P2-2②", `飞出中排队 ${touch ? "点右选项" : "→→"}，下一张落定后 ${liveAfterSettle}ms 现场 ${touch ? "点左选项" : "←←"}（#${rep}）`, ok ? "PASS" : (liveAfterSettle !== null && liveAfterSettle >= 250 ? "BLOCKED" : "FAIL"),
      `提交序列 ${seqA.join(" → ")}；T02 提交=${bCommit?.x}（期望 right，排队项先）距独立落定 ${dB}ms；现场项${third ? "作用于 " + third.on + ":" + third.x : "（落到刻字卡：提示 " + g.ts.map((t) => t.text).join("/") + "）"}；排队数 ${q1}/${qLive}；版本 ${version}`, ev);
  }
  if (process.env.P7_ONLY !== "A") {
  // ---------- B ----------
  const paths = [["重新开局", async () => p.evaluate(() => { document.getElementById("menubtn").click(); document.querySelector("#menu-pop [data-menu=new]")?.click(); })],
    ["读档(restore)", async () => p.evaluate(() => { __zz.restore(); __zz.render(); })],
    ["同码重复导入", async () => p.evaluate((c) => __zz.importCode(c), codes.T01)]];
  for (const [lab, act0] of paths) {
    // 第 1 轮：T01 起飞 + 排队 → 在 T02 上排空（settleKey 记下 T02）；然后 重置 回到 T01；第 2 轮同样操作，T02 上的排队提交须重新等满停留
    await imp(codes.T01); const snap = await p.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage))));
    await dir("left"); await p.waitForTimeout(50); await dir("right"); await p.waitForTimeout(1500); await still();
    const r1 = await Z();
    if (lab === "读档(restore)") await p.evaluate((sn) => { const o = JSON.parse(sn); localStorage.clear(); for (const k in o) localStorage.setItem(k, o[k]); __zz.restore(); __zz.render(); }, snap); else await act0();
    await p.waitForTimeout(400); await still(); const r0 = await Z(); await mon();
    await dir("left"); await p.waitForTimeout(50); await dir("right"); const qIn = (await Z()).q;
    await p.waitForTimeout(1800); await still(); const g = await grab(); const z = await Z(); const ev = await shot(`B_${lab}`);
    const i = g.pc.findIndex((c) => c.on === "T02"); const c = g.pc[i]; const d = c ? dwellBefore(g.fr, c.t, i > 0 ? g.pc[i - 1].t : -1) : null;
    const ok = r0.cur === "T01" && c && c.x.includes("right") && d >= 230;
    raw.push({ blk: "B", lab, r1, r0, qIn, d, pc: g.pc, z });
    rec("P2-2①", `${lab}后（此前已在 T02 排空过队列）再飞出排队：T02 上排队提交距独立落定 ≥230ms（settleKey 已重置）`, ok ? "PASS" : (r0.cur !== "T01" ? "BLOCKED" : "FAIL"),
      `第1轮终态 ${r1.cur}；重置后 ${r0.cur}/${r0.ph}；第2轮排队=${qIn}；提交 ${g.pc.map((x) => x.on + ":" + x.x).join(" → ")}；T02 提交距独立落定 ${d}ms；终态 ${z.cur}/${z.ph}`, ev);
  }
  // ---------- C ----------
  for (const k of ["ArrowLeft", "ArrowRight", "Enter"]) {
    await imp(codes.T03); const n0 = (await Z()).n; await p.keyboard.press(k);
    const hint = await p.waitForFunction(() => { const t = document.getElementById("toast"); return t.classList.contains("on") && /先点卡角|骨片|刻下/.test(t.textContent); }, null, { timeout: 800, polling: 20 }).then(() => true).catch(() => false);
    const z = await Z(); const ev = await shot(`C_live_${k}`);
    rec("P3-3", `刻字卡落定后现场按 ${k}：弹锁定提示、不提交`, hint && z.n === n0 && z.ph === "engrave" ? "PASS" : "FAIL", `提示=${hint}「${z.toast}」；动作数 ${n0}→${z.n}；阶段 ${z.ph}；live「${z.live}」`, ev);
  }
  { await imp(codes.T02); await dir("left"); await p.waitForTimeout(50); await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowRight"); const q = (await Z()).q;
    await p.waitForTimeout(1800); await still(); const g = await grab(); const z = await Z(); const ev = await shot("C_queued_arrows");
    const hints = g.ts.filter((t) => LOCK.test(t.text)); const firstHint = hints[0]; const sT3 = firstHint ? settleBefore(g.fr, firstHint.t) : null;
    const distinct = new Set(); let shows = 0, prevOn = false; for (const t of hints) { if (!distinct.has(Math.round(t.t / 100))) shows++; distinct.add(Math.round(t.t / 100)); }
    rec("P3-3", "上一张飞出中排 →→ 进刻字卡：只弹一次锁定提示、不提交、队列清空", firstHint && z.ph === "engrave" && z.cur === "T03" && z.q === 0 && g.pc.length === 1 ? "PASS" : "FAIL",
      `排队数 ${q}；提示事件 ${hints.length} 条（首条距 T03 独立落定 ${firstHint && sT3 ? Math.round(firstHint.t - sT3) : "—"}ms）；提交 ${g.pc.map((c) => c.on + ":" + c.x).join(",")}；终态 ${z.cur}/${z.ph} q=${z.q}`, ev);
    raw.push({ blk: "C-queued", q, hints, pc: g.pc, z }); }
  { await imp(codes.T02); await dir("left"); await p.waitForTimeout(50); const q0 = (await Z()).q; await p.keyboard.press("k"); const q1 = (await Z()).q;
    await p.waitForTimeout(1500); await still(); const g = await grab(); const z = await Z(); const ev = await shot("C_K_during_fly");
    rec("P3-3", "上一张飞出中按 K：不入队、到刻字卡后不自动刻", q1 === q0 && z.ph === "engrave" && !g.pc.some((c) => c.x.includes("engrave")) ? "PASS" : "FAIL", `K 前后排队 ${q0}→${q1}；提交 ${g.pc.map((c) => c.on + ":" + c.x).join(",")}；终态 ${z.cur}/${z.ph}`, ev); }
  // ---------- D ----------
  // 入场中的卡在移动（从侧面滑入），按坐标点下去可能落到已移开的位置：以 click 事件的真实目标为准，没点中就换时延重试（≤4 次）；
  // 仍点不中则第二方法：入场中对目标元素程序化 el.click()（只验门逻辑，不验命中）。
  for (const how of ["点骨片", "点先不刻", "按K", "按S"]) {
    const isKey = how.startsWith("按"); const sel = how === "点骨片" ? "#bonecorner" : "#card [data-do=skip]"; const tgt = how === "点骨片" ? "click:bonecorner" : "click:skip";
    const delays = isKey ? [0, 0, 0] : [0, 40, 90, 150, 20, 60, -1]; let done = false;
    for (const delay of delays) {
      if (done) break;
      await imp(codes.T02);
      await p.evaluate(() => { window.__EV = []; if (!window.__evh) { window.__evh = 1; for (const ty of ["pointerdown", "pointerup", "click", "keydown"]) addEventListener(ty, (e) => { const t = e.target; const busy = !!(__zz.animating || document.getElementById("card").getAnimations().some((a) => a.playState === "running")); window.__EV.push(ty + ":" + (t.id || (t.dataset && t.dataset.do) || t.className || t.tagName) + (busy ? "@入场中" : "@静止")); }, true); } });
      await dir("left");
      await p.waitForFunction(() => __zz.st.current === "T03", null, { timeout: 3000, polling: "raf" }).catch(() => {});
      const pre = await p.evaluate(() => performance.now()); if (delay > 0) await p.waitForTimeout(delay);
      await p.evaluate(() => { window.__EV = []; });
      const tClick = await p.evaluate(() => performance.now()); const animAtClick = await animsNow(); let hitInfo = "", method = "";
      if (how === "按K") { await p.keyboard.press("k"); method = "键盘"; } else if (how === "按S") { await p.keyboard.press("s"); method = "键盘"; }
      else if (delay === -1) { method = "程序化 el.click()（第二方法）"; await p.evaluate((s) => document.querySelector(s)?.click(), sel); }
      else { method = touch ? "真 touch" : "鼠标"; const c = await center(sel); hitInfo = c ? `@${c.map(Math.round)}` : "无盒"; if (c) await tapXY(c[0], c[1]); }
      const tAfter = await p.evaluate(() => ({ t: performance.now(), q: __zz.queued }));
      const evs = await p.evaluate(() => window.__EV.slice()); const hit = isKey || delay === -1 || evs.includes(tgt + "@入场中");
      await p.waitForTimeout(1500); await still(); const g = await grab(); const z = await Z();
      const inEntry = isKey ? evs.some((e) => e.startsWith("keydown") && e.endsWith("@入场中")) : delay === -1 ? animAtClick.length > 0 : evs.includes(tgt + "@入场中");
      const want = how === "点骨片" || how === "按K" ? "engrave" : "skip_engrave"; const acts = g.pc.filter((c) => c.x.some((x) => /engrave/.test(x)));
      const a = acts[0]; const d = a ? dwellBefore(g.fr, a.t, tClick) : null;
      raw.push({ blk: "D", how, delay, method, hit, inEntry, tAfter, acts, d, z, evs });
      if (!hit || !inEntry) { console.log("retry", how, delay, "hit=" + hit, "inEntry=" + inEntry, evs.join(" ")); continue; }
      done = true; const ev = await shot(`D_${how}`); const ok = acts.length === 1 && a.x.includes(want) && d >= 230;
      rec("P3-4", `刻字卡入场中${how}（${method}，T03 出现后 ${Math.round(tClick - pre)}ms）：入队，落定后 ≥230ms 才执行一次`, ok ? "PASS" : "FAIL",
        `入场中「${animAtClick}」，输入后排队=${tAfter.q}；执行 ${acts.map((c) => c.on + ":" + c.x).join(",") || "无"}（期望 ${want}）距 T03 独立落定 ${d}ms；终态 ${z.cur}/${z.ph}；事件 ${evs.join(" ")}${hitInfo}；未命中重试 ${delays.indexOf(delay)} 次`, ev);
    }
    if (!done) rec("P3-4", `刻字卡入场中${how}`, "BLOCKED", "各时延都未在入场中命中目标（见 raw）", await shot(`D_${how}_blocked`));
  }
  // ---------- E ----------
  const epaths = [["重新开局", () => p.evaluate(() => { document.getElementById("menubtn").click(); document.querySelector("#menu-pop [data-menu=new]")?.click(); }), null],
    ["导入", () => p.evaluate((c) => { document.getElementById("menubtn").click(); document.querySelector("#menu-pop [data-menu=import]")?.click(); document.getElementById("dlgtext").value = c; document.getElementById("dlgapply").click(); }, codes.T01), /导入成功/],
    ["读档(restore)", () => p.evaluate(() => { __zz.restore(); __zz.render(); }), /读回/]];
  for (const [lab, act, legit] of epaths) {
    await imp(codes.T03); const cc = await center("#card"); await tapXY(cc[0], cc[1] + 30); await p.waitForTimeout(150);
    const t0 = await Z(); const liveOn = t0.live; await p.keyboard.press("s"); await p.waitForTimeout(30); for (const k of ["ArrowLeft", "ArrowLeft", "ArrowRight", "ArrowRight"]) await p.keyboard.press(k);
    const qPre = (await Z()).q; await mon(); const tAct = await p.evaluate(() => performance.now()); await act();
    const samples = []; for (let i = 0; i < 80; i++) { samples.push(await p.evaluate(() => ({ t: performance.now(), on: document.getElementById("toast").classList.contains("on"), text: document.getElementById("toast").textContent.trim(), live: document.getElementById("toast-live")?.textContent ?? null }))); await p.waitForTimeout(30); }
    const ev = await shot(`E_${lab}`); const z = await Z();
    const bad = samples.filter((s) => s.t - tAct >= 150 && s.on && LOCK.test(s.text)); const liveBad = samples.filter((s) => s.t - tAct >= 150 && !s.on && s.live && s.live.length && (s.t - tAct) > 2100);
    const legitSeen = legit ? samples.some((s) => s.on && legit.test(s.text)) : true;
    const liveMirror = samples.filter((s) => s.on).every((s) => s.live === s.text);
    raw.push({ blk: "E", lab, qPre, t0, samples: samples.filter((_, i) => i % 5 === 0), z });
    rec("toast/清队顺序", `${lab}（拦截提示在场，队列 ${qPre}）后 150ms–2.5s 无锁定提示回弹`, t0.toast && LOCK.test(t0.toast) && qPre > 0 ? (bad.length || !legitSeen ? "FAIL" : "PASS") : "BLOCKED",
      `操作前 toast「${t0.toast}」live「${liveOn}」；回弹样本 ${bad.length} 个${bad[0] ? "（首个 +" + Math.round(bad[0].t - tAct) + "ms「" + bad[0].text + "」）" : ""}；自身提示${legit ? (legitSeen ? "出现" : "未出现") : "无要求"}；终态 ${z.cur}/${z.ph} q=${z.q}`, ev);
    rec("toast-live", `${lab}：#toast-live 与 toast 同步写入/收起后清空`, liveMirror && liveBad.length === 0 && liveOn === t0.toast ? "PASS" : "FAIL", `toast 在场时 live 与文字一致=${liveMirror}；收起后残留=${liveBad.length}；操作前 live「${liveOn}」`, ev);
  }
  }
  rec("流程", "页面错误", errs.length ? "FAIL" : "PASS", errs.join(" ; ") || "无 pageerror", "");
} catch (e) { rec("流程", "脚本异常", "BLOCKED", String(e).slice(0, 300), await shot("exception")); }
flush(); clearTimeout(hard); await B.close();
