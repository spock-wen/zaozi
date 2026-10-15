#!/usr/bin/env python3
"""verdict_gate.py <matrix.csv> <report.md>
Checks that a test report's overall verdict is consistent with its matrix."""
import csv, re, sys
from collections import Counter

VALID = {"PASS", "PARTIAL", "FAIL", "BLOCKED", "N/A"}
ALIAS = {"部分验证": "PARTIAL", "PARTIAL(部分验证)": "PARTIAL", "NA": "N/A", "不适用": "N/A",
         "通过": "PASS", "失败": "FAIL", "阻塞": "BLOCKED"}
VERDICT_COLS = ["判定", "verdict", "Verdict", "结果"]
CONCL_RE = re.compile(r"^\s*(?:[#>*\-\s]*)(?:\*\*)?(?:总结论|整体结论|结论|Verdict|Overall verdict)(?:\*\*)?\s*[:：]\s*(.+)$", re.I)

def norm_cell(v):
    v = (v or "").strip()
    if v in ALIAS: return ALIAS[v]
    u = v.upper()
    if u.startswith("PARTIAL"): return "PARTIAL"
    return ALIAS.get(u, u)

def classify_conclusion(text):
    t = text.strip().strip("*` ")
    tu = t.upper()
    if re.search(r"不过门|未过门|不通过|\bFAIL", tu): return "FAIL"
    if re.search(r"部分验证|PARTIAL", tu): return "PARTIAL"
    if re.search(r"BLOCKED|阻塞", tu): return "BLOCKED"
    if re.search(r"\bPASS\b|过门|通过", tu): return "PASS"
    return "UNKNOWN"

def main(argv):
    if len(argv) != 3:
        print(__doc__); return 2
    mpath, rpath = argv[1], argv[2]
    violations = []
    with open(mpath, newline="", encoding="utf-8-sig") as f:
        sample = f.read(4096); f.seek(0)
        delim = "|" if sample.count("|") > sample.count(",") else ","
        rows = list(csv.DictReader(f, delimiter=delim))
    if not rows:
        print("VIOLATION: 矩阵为空"); return 1
    cols = [c.strip() for c in rows[0].keys()]
    vcol = next((c for c in rows[0].keys() if c.strip() in VERDICT_COLS), None)
    rcol = next((c for c in rows[0].keys() if c.strip() in ("原因", "reason")), None)
    ecol = next((c for c in rows[0].keys() if c.strip() in ("证据路径", "evidence")), None)
    for need, c in (("判定", vcol), ("原因", rcol), ("证据路径", ecol)):
        if c is None: violations.append(f"矩阵缺列「{need}」(现有列: {cols})")
    if vcol is None:
        for v in violations: print("VIOLATION:", v)
        return 1
    dist = Counter()
    for i, r in enumerate(rows, start=2):
        v = norm_cell(r.get(vcol))
        if v not in VALID:
            violations.append(f"第{i}行 判定值非法: {r.get(vcol)!r}"); v = "INVALID"
        dist[v] += 1
        if v not in ("PASS", "N/A"):
            if not rcol or not (r.get(rcol) or "").strip():
                violations.append(f"第{i}行 判定 {v} 缺原因")
            if not ecol or not (r.get(ecol) or "").strip():
                violations.append(f"第{i}行 判定 {v} 缺证据路径")
    print(f"格总数 {sum(dist.values())} 分布 {dict(sorted(dist.items()))}")

    concl_raw = None
    with open(rpath, encoding="utf-8") as f:
        for line in f:
            m = CONCL_RE.match(line)
            if m: concl_raw = m.group(1).strip(); break
    print(f"结论字段: {concl_raw if concl_raw else '(未找到)'}")
    if concl_raw is None:
        violations.append("报告中找不到总结论行（形如「总结论: ...」）")
        concl = "UNKNOWN"
    else:
        concl = classify_conclusion(concl_raw)
        if concl == "UNKNOWN": violations.append(f"无法识别结论取值: {concl_raw!r}")

    non_pass = sum(n for k, n in dist.items() if k not in ("PASS", "N/A"))
    if concl == "PASS" and non_pass:
        violations.append(f"存在 {non_pass} 个非 PASS 格（不计 N/A），结论不得为 PASS/过门")
    if concl == "PASS" and (dist["BLOCKED"] or dist["N/A"]):
        violations.append(f"范围含 BLOCKED={dist['BLOCKED']} N/A={dist['N/A']}，不得写成整体过门")
    if dist["FAIL"] and concl != "FAIL":
        violations.append(f"存在 {dist['FAIL']} 个 FAIL 格，结论须为不过门/FAIL")
    if violations:
        for v in violations: print("VIOLATION:", v)
        return 1
    print("OK"); return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv))
