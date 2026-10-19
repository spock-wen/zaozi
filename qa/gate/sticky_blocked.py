#!/usr/bin/env python3
"""sticky_blocked.py <report.md> [--ledger PATH]
Ledger BLOCKED items stay blocked: if a report mentions a BLOCKED id and calls it
PASS/过门 on the same line, it needs an `UNBLOCK:<id> <evidence paths>` line."""
import os, re, sys

PASSY = re.compile(r"\bPASS\b|过门|已通过|通过", re.I)
NEG = re.compile(r"不过门|未过门|不通过|未通过|非\s*PASS|NOT\s+PASS", re.I)

def load_ledger(path):
    items = []
    with open(path, encoding="utf-8") as f:
        for n, line in enumerate(f, 1):
            line = line.rstrip("\n")
            if not line.strip() or line.startswith("#"): continue
            parts = line.split("\t")
            if parts[0] == "id": continue
            if len(parts) < 2: raise SystemExit(f"ledger 第{n}行格式错误: {line!r}")
            items.append((parts[0].strip(), parts[1].strip().upper(), parts[2] if len(parts) > 2 else ""))
    return items

def main(argv):
    args = argv[1:]
    ledger = os.path.join(os.path.dirname(os.path.abspath(__file__)), "BLOCKED_LEDGER.tsv")
    if "--ledger" in args:
        i = args.index("--ledger"); ledger = args[i + 1]; del args[i:i + 2]
    if len(args) != 1:
        print(__doc__); return 2
    items = load_ledger(ledger)
    text = open(args[0], encoding="utf-8").read()
    lines = text.splitlines()
    errors = []
    for iid, status, note in items:
        if status != "BLOCKED": continue
        unblock = re.search(rf"^\s*UNBLOCK:{re.escape(iid)}\s+\S+", text, re.M)
        for ln, line in enumerate(lines, 1):
            if iid in line and not line.strip().startswith("UNBLOCK:") \
               and PASSY.search(line) and not NEG.search(line) and not unblock:
                errors.append(f"{iid}（{note}）第{ln}行被写成 PASS/过门，但无 `UNBLOCK:{iid} <paths>` 行: {line.strip()}")
    for e in errors: print("VIOLATION:", e)
    if errors: return 1
    print(f"sticky_blocked: {len(items)} 项在账, OK"); return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv))
