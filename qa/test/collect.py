#!/usr/bin/env python3
# R号: 汇总（R01–R24 各脚本产物 → 矩阵）。用法: python3 collect.py <out目录> <mode:quick|full> <tip>
# 产物: <out>/MATRIX.csv（列 块,项,R号,引擎,模式,视口,判定,原因,证据路径）、<out>/REPORT.md（含「总结论:」行）
import csv, glob, json, os, re, sys, collections
OUT, MODE, TIP = sys.argv[1], sys.argv[2], sys.argv[3]
rows = []
def add(blk, item, r, eng, mode, vp, v, why, ev): rows.append({"块": blk, "项": item, "R号": r, "引擎": eng, "模式": mode, "视口": vp, "判定": v, "原因": why, "证据路径": ev})
rel = lambda p: os.path.relpath(p, OUT)
def evs(d, shots, f): return " | ".join([rel(os.path.join(d, s)) for s in (shots or [])] + [rel(f)])
def load(f):
    try: return json.load(open(f, encoding="utf-8"))
    except Exception as e: return {"_err": str(e)}
# 1) P9-1
for f in sorted(glob.glob(f"{OUT}/p91/p91_*.json")):
    d = load(f); e, vp, m = (d.get("cfg") or os.path.basename(f)[4:-5]).split("_")[:3]
    if d.get("timeout") or d.get("_err"): add("P9-1 清队后飞出中触点入队", "脚本超时/输出损坏", "R10/R01", e, m, vp, "BLOCKED", "脚本未产出完整结果", rel(f)); continue
    for it in d["res"]:
        add("P9-1 清队后飞出中触点入队", f"{it['path']}·{it['variant']}#{it['k']}：飞出中触点卡片 → 入队并出锁定提示", "R10/R01", e, m, vp, "PASS" if it["pass"] else "FAIL",
            "" if it["pass"] else f"点卡后 queued={it.get('queuedAfterTap')} 提示={it.get('lockHint')} 终态 {it.get('state')}；飞出 50ms 卡 {it.get('midFlyCard')}", evs(os.path.dirname(f), it.get("shots"), f))
# 2) P2-1
for f in sorted(glob.glob(f"{OUT}/p21/p21_*.json")):
    d = load(f); e, vp, m = (d.get("cfg") or os.path.basename(f)[4:-5]).split("_")[:3]
    if d.get("timeout") or d.get("_err"): add("P2-1 飞出中重置不带入旧局←预览", "脚本超时/输出损坏", "R10", e, m, vp, "BLOCKED", "脚本未产出完整结果", rel(f)); continue
    for it in d["res"]:
        if not it: continue
        v = "PASS" if it["pass"] else ("FAIL" if it["valid"] else "BLOCKED")
        add("P2-1 飞出中重置不带入旧局←预览", f"{it['path']}#{it['k']}：飞出中{it['path']} → 新局无旧高亮，首次←只预览、再按←提交", "R10", e, m, vp, v,
            "" if v == "PASS" else (f"检查 {it.get('checks')}；重置后 {it.get('after')}；按1次← {it.get('oneLeft')}" if v == "FAIL" else "4 次都没能在飞出中触发重置（脚本时序），未判"), evs(os.path.dirname(f), it.get("shots"), f))
# 3) 键位条
for f in sorted(glob.glob(f"{OUT}/keybar/keybar_*.json")):
    d = load(f); c = (d.get("cfg") or os.path.basename(f)[7:-5]).split("_"); e, vp, m = c[0], c[1], "_".join(c[2:])
    if d.get("_err"): add("键位条/键位浮层", "输出损坏", "R12", e, m, vp, "BLOCKED", d["_err"], rel(f)); continue
    for it in d["res"]:
        add("键位条/键位浮层", f"{it['stage']}：刻字阶段无左右/←→、无「Enter 刻」、有 K 刻；不溢出", "R12/A-R7 P3-3/R14", e, m, vp, "PASS" if it["pass"] else "FAIL",
            "" if it["pass"] else f"检查 {it['chk']}；#keys「{(it.get('keys') or {}).get('text','')}」；浮层「{((it.get('pop') or {}).get('text') or '').replace(chr(10),' ')}」", evs(os.path.dirname(f), it.get("shots"), f))
# 4) carve_dwell
for f in sorted(glob.glob(f"{OUT}/carve/cd_*.json")):
    _, e, leg, vp = os.path.basename(f)[:-5].split("_"); d = load(f)
    if isinstance(d, dict): add("排队 K 进刻字卡等落定+250ms", "输出损坏", "R08/R02", e, leg, vp, "BLOCKED", d.get("_err", ""), rel(f)); continue
    win = all(x.get("kAfterSettle") is not None and 60 <= x["kAfterSettle"] < 230 for x in d); ok = all(x.get("pass") for x in d)
    raw = "；".join(f"{x.get('how')} q{x.get('queuedBefore')}→{x.get('queuedAfter')} K@{x.get('kAfterSettle')}ms 刻@{x.get('engraveAfterSettle')}ms" for x in d)
    v = "PASS" if (ok and win) else ("FAIL" if win else "BLOCKED")
    add("排队 K 进刻字卡等落定+250ms", "T02 飞出排 →→，T03 落定 +100ms 现场 K×3/骨片×2 → 排队、≥落定+230ms 才刻", "R08/R02", e, leg, vp, v, raw if v != "PASS" else "", f"{rel(f)} | {rel(f[:-5] + '.png')}")
# 5) D4
for f in sorted(glob.glob(f"{OUT}/d4/d4_*.json")):
    d = load(f); c = (d.get("cfg") or os.path.basename(f)[3:-5]).split("_"); e, vp, m = c[0], c[1], c[2]
    if d.get("_err"): add("D4 渲染异常不删存档", "输出损坏", "E1-D4/R21", e, m, vp, "BLOCKED", d["_err"], rel(f)); continue
    v = "PASS" if d["pass"] else ("FAIL" if d["thrown"] else "BLOCKED")
    add("D4 渲染异常不删存档", "有存档 → 注入启动渲染异常刷新 → 存档键在且未变；去注入恢复同一局", "E1-D4/R21", e, m, vp, v,
        "" if v == "PASS" else (f"异常后 键={list(d['afterError']['ls'])} 内容同={d['keptSame']}；恢复后 {d['recovered']['st']}" if v == "FAIL" else "注入未生效，未判"), evs(os.path.dirname(f), d.get("shots"), f))
# 6) 太矮条
for f in sorted(glob.glob(f"{OUT}/short/too_short_*.json")):
    d = load(f); c = (d.get("cfg") or "").split("_"); e, vp, ex = c[0], c[1], c[2]
    for it in d.get("res", []):
        v = "N/A" if it["pass"] is None else ("PASS" if it["pass"] else "FAIL")
        add("R15 太矮条", f"{it['scene']}：期望 {ex}", "R15", e, ex, vp, v, ("只记录（PM T1）：" if v == "N/A" else "") + ("" if v == "PASS" else json.dumps(it["probe"], ensure_ascii=False)), evs(os.path.dirname(f), it.get("shots"), f))
# 6b) p7 审查条目（P2-2①②/P3-3/P3-4/toast）
for f in sorted(glob.glob(f"{OUT}/p7/*/p7_*.csv")):
    for r in csv.DictReader(open(f, encoding="utf-8")):
        ev = " | ".join(rel(os.path.join(os.path.dirname(f), x.strip())) for x in (r.get("证据路径") or "").split("|") if x.strip()) or rel(f)
        add("飞出/停留/重置·" + r["块"], r["项"], "R02/R01/R08/R10", r["引擎"], r["模式"], r["视口"], r["判定"], r.get("原因", ""), ev)
# 7) 版式
for f in sorted(glob.glob(f"{OUT}/layout/MATRIX_layout_checks.csv")):
    for r in csv.DictReader(open(f, encoding="utf-8")):
        ev = " | ".join(rel(os.path.join(OUT, "layout", x.strip())) for x in (r.get("证据路径") or "").split("|") if x.strip()) or rel(f)
        add("版式·" + r["块"], r["项"], "R13/R14/R16/R18", r["引擎"], "-", r["视口"], r["判定"], r.get("原因", ""), ev)
lr = f"{OUT}/layout/run.log"
if os.path.exists(lr):
    for line in open(lr, encoding="utf-8", errors="replace"):
        m = re.match(r"^FAIL-RUN (\S+) (\S+)", line)
        if m: add("版式·脚本未跑完", f"layout_checks {m.group(1)} {m.group(2)}", "R13/R14/R16/R18", m.group(1), "-", m.group(2), "BLOCKED", "layout_checks.mjs 异常退出，见 layout/run.log", rel(lr))
# 8) e2e（TAP 顶层用例）
for f in sorted(glob.glob(f"{OUT}/e2e/e2e_*.tap")):
    e = os.path.basename(f)[4:-4]; n = 0
    for line in open(f, encoding="utf-8", errors="replace"):
        m = re.match(r"^(not ok|ok) \d+ - (.*?)(\s+# (SKIP|TODO).*)?$", line.rstrip())
        if not m: continue
        n += 1; v = "N/A" if m.group(3) else ("PASS" if m.group(1) == "ok" else "FAIL")
        add("e2e web/tests/e2e", m.group(2)[:200], "R01–R12（按文件）", e, "-", "-", v, ("" if v == "PASS" else ("跳过" if v == "N/A" else "e2e 用例失败，见 TAP")), rel(f))
    if n == 0: add("e2e web/tests/e2e", "整套", "R01–R12", e, "-", "-", "BLOCKED", "TAP 里没有用例行（未跑起来）", rel(f))
# 9) 任务级异常（脚本 rc≠0 且无产物）
jf = f"{OUT}/jobs.tsv"
if os.path.exists(jf):
    for line in open(jf, encoding="utf-8"):
        p = line.rstrip("\n").split("\t")
        if len(p) >= 4 and p[1] not in ("0",) and p[3] == "noout": add("任务异常", p[0], "-", "-", "-", "-", "BLOCKED", f"rc={p[1]}，无产物", rel(p[2]) if p[2] else "jobs.tsv")
# 10) 未测（--quick）
if MODE == "quick":
    add("未测·中间轮", "R14 门内 15 格全量、R15 边界、版式全量", "R14/R15", "-", "-", "-", "N/A", "未测：--quick 只跑 375x667/360x800 触屏 + 1920x1080 桌面；全量用 --full（合并版）", "REPORT.md")
cols = ["块", "项", "R号", "引擎", "模式", "视口", "判定", "原因", "证据路径"]
with open(f"{OUT}/MATRIX.csv", "w", encoding="utf-8", newline="") as fh:
    w = csv.DictWriter(fh, fieldnames=cols); w.writeheader(); w.writerows(rows)
cnt = collections.Counter(r["判定"] for r in rows); blk = collections.defaultdict(collections.Counter)
for r in rows: blk[r["块"]][r["判定"]] += 1
nonpass = sum(v for k, v in cnt.items() if k not in ("PASS", "N/A"))
if cnt["FAIL"]: concl = "不过门"
elif nonpass or MODE == "quick": concl = "部分验证（中间轮增量，全量留合并版）" if MODE == "quick" else "部分验证"
elif cnt["N/A"]: concl = "部分验证"
else: concl = "PASS"
with open(f"{OUT}/REPORT.md", "w", encoding="utf-8") as fh:
    fh.write(f"总结论: {concl}\n\n# qa/run_all.sh --{MODE} · tip {TIP}\n\n矩阵 MATRIX.csv：{len(rows)} 格 {dict(cnt)}\n\n| 块 | 判定分布 |\n|---|---|\n")
    for b, c in blk.items(): fh.write(f"| {b} | {dict(c)} |\n")
    fails = [r for r in rows if r["判定"] in ("FAIL", "BLOCKED")]
    if fails:
        fh.write("\n## FAIL / BLOCKED（前 40 条）\n")
        for r in fails[:40]: fh.write(f"- {r['判定']} [{r['R号']}] {r['块']}｜{r['项'][:80]}｜{r['引擎']} {r['视口']}｜{r['原因'][:160]}｜{r['证据路径'][:160]}\n")
    if MODE == "quick": fh.write("\n未测范围：R14 门内全量 15 格、R15 边界（--full 才跑）。版式未验（全量留合并版）。\n")
print(f"MATRIX {len(rows)} {dict(cnt)} → 总结论: {concl}")
