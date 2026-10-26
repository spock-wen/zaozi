#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""静态：源码提示文案 → hint_map.json 覆盖率（只用标准库）。

用法:
    python3 static_coverage.py <hints_extracted.json> <hint_map.json>

- 只看 static_scope.files 里的文件（按 file 字段精确匹配）。
- where 命中 exclude_where_regex 的跳过。
- text 去 HTML 标签、{*} → …、压缩空白后，按 entries 顺序取第一条命中。
- stdout 打印汇总 + 逐条；同目录写 static_rows.csv（无表头）。
- 退出码：有未映射 1，否则 0。
"""

import json
import os
import re
import sys

DEFAULT_FILES = ["app.js", "index.html", "data/tutorial.json", "data/goals.json"]


def clean_text(t):
    s = re.sub(r"<[^>]+>", "", t)
    s = s.replace("{*}", "…")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def csv_cell(s):
    return str(s).replace(",", "，").replace("\n", " ").replace("\r", " ")


def main():
    if len(sys.argv) != 3:
        sys.stderr.write("用法: python3 static_coverage.py <hints_extracted.json> <hint_map.json>\n")
        return 2

    hints_path, map_path = sys.argv[1], sys.argv[2]
    with open(hints_path, encoding="utf-8") as fh:
        hints = json.load(fh)
    with open(map_path, encoding="utf-8") as fh:
        data = json.load(fh)

    entries = data.get("entries", []) or []
    scope = data.get("static_scope") or {}
    files = scope.get("files") or DEFAULT_FILES
    files_set = set(files)
    ex = scope.get("exclude_where_regex")
    ex_re = re.compile(ex) if ex else None

    compiled = []
    for e in entries:
        pat = e.get("match")
        if not pat:
            continue
        try:
            compiled.append((e.get("id"), re.compile(pat)))
        except re.error as err:
            sys.stderr.write("忽略非法正则 %s: %s\n" % (e.get("id"), err))

    records = []
    for h in hints:
        f = h.get("file", "")
        if f not in files_set:
            continue
        where = h.get("where", "")
        if ex_re is not None and ex_re.search(where):
            continue
        records.append((f, where, clean_text(h.get("text", ""))))

    mapped = 0
    out_lines = []
    fail_rows = []
    for f, where, text in records:
        hit = None
        for eid, rx in compiled:
            if rx.search(text):
                hit = eid
                break
        if hit is not None:
            mapped += 1
            out_lines.append("已映射\t%s\t%s %s\t%s" % (hit, f, where, text))
        else:
            out_lines.append("未映射\t-\t%s %s\t%s" % (f, where, text))
            fail_rows.append("静态 提示映射,%s,-,-,FAIL,未映射：%s,%s" % (
                csv_cell("%s %s" % (f, where)), csv_cell(text),
                csv_cell(os.path.basename(hints_path))))

    total = len(records)
    unmapped = total - mapped
    print("静态提示 %d 条，已映射 %d 条，未映射 %d 条" % (total, mapped, unmapped))
    for line in out_lines:
        print(line)

    out_csv = os.path.join(os.path.dirname(os.path.abspath(hints_path)), "static_rows.csv")
    with open(out_csv, "w", encoding="utf-8") as fh:
        if unmapped:
            fh.write("".join(r + "\n" for r in fail_rows))
        else:
            fh.write("静态 提示映射,源码提示文案 %d 条,-,-,PASS,全部已映射到 hint_map.json,%s\n" % (
                total, csv_cell(os.path.basename(hints_path))))

    return 1 if unmapped else 0


if __name__ == "__main__":
    sys.exit(main())
