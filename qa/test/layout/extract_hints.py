#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从造字人 web 应用里提取「提示文案」字符串（只用标准库）。

用法:
    python3 extract_hints.py <应用根目录> > hints.json

- app.js / index.html 可能在根目录或 web/ 子目录（都找，优先根目录）。
- data/*.json 可能在根目录 data/ 或上一级 ../data/（都找，优先根目录 data/）。
- 只保留「含中文」且「含指向词」的字符串，长度 > 120 的跳过。
- 输出 JSON 数组，按 file、where 排序，(file, text) 去重。
- 条数打印到 stderr，保证 stdout 只有 JSON。
"""

import json
import os
import re
import sys
from html.parser import HTMLParser

CJK_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")

POINT_WORDS = [
    "点", "拖", "按住", "长按", "卡角", "骨片", "刻", "落",
    "松手", "上拉", "下拉", "滑", "按 ", "点击", "轻点", "挑",
]

MAX_LEN = 120

# 出现在这些字符之后时，'/' 视为正则字面量的开始（否则是除号）。
_REGEX_PREV = set("(,=:[!&|?{};+-*%^~<>")


def is_hint(s):
    if not s or len(s) > MAX_LEN:
        return False
    if not CJK_RE.search(s):
        return False
    return any(w in s for w in POINT_WORDS)


def read_text(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


class JSStringExtractor(object):
    """扫描 JS 源码，收集字符串字面量，跳过注释。

    模板串里的 ${...} 统一替换成 {*}。
    """

    def __init__(self, src):
        self.s = src
        self.n = len(src)
        self.i = 0
        self.line = 1
        self.prev = None  # 最近一个有效字符，用于区分正则 / 除号
        self.out = []     # [(line, text)]

    def peek(self, k=0):
        j = self.i + k
        return self.s[j] if j < self.n else ""

    def advance(self):
        c = self.s[self.i]
        self.i += 1
        if c == "\n":
            self.line += 1
        return c

    def run(self):
        while self.i < self.n:
            c = self.peek()
            if c in " \t\r\n":
                self.advance()
                continue
            if c == "/" and self.peek(1) == "/":
                while self.i < self.n and self.peek() != "\n":
                    self.advance()
                continue
            if c == "/" and self.peek(1) == "*":
                self.advance()
                self.advance()
                while self.i < self.n and not (self.peek() == "*" and self.peek(1) == "/"):
                    self.advance()
                if self.i < self.n:
                    self.advance()
                    self.advance()
                self.prev = None
                continue
            if c == "/":
                if self.prev is None or self.prev in _REGEX_PREV:
                    self.read_regex()
                    self.prev = None
                else:
                    self.advance()
                    self.prev = "/"
                continue
            if c == '"' or c == "'":
                self.read_string()
                self.prev = c
                continue
            if c == "`":
                self.read_template()
                self.prev = "`"
                continue
            self.prev = c
            self.advance()
        return self.out

    def read_regex(self):
        self.advance()  # 开头的 /
        in_class = False
        while self.i < self.n:
            c = self.peek()
            if c == "\\":
                self.advance()
                self.advance()
                continue
            if c == "\n":
                break
            if c == "[":
                in_class = True
            elif c == "]":
                in_class = False
            elif c == "/" and not in_class:
                self.advance()
                while self.i < self.n and self.peek().isalpha():
                    self.advance()
                return
            self.advance()

    def read_string(self):
        start_line = self.line
        q = self.advance()  # 开引号
        buf = []
        while self.i < self.n:
            c = self.peek()
            if c == "\\":
                self.advance()
                if self.i < self.n:
                    nxt = self.peek()
                    if nxt == "\n":
                        self.advance()
                        continue
                    if nxt == "\r":
                        self.advance()
                        if self.peek() == "\n":
                            self.advance()
                        continue
                    buf.append(nxt)
                    self.advance()
                continue
            if c == q:
                self.advance()
                break
            if c == "\n":
                break
            buf.append(c)
            self.advance()
        self.out.append((start_line, "".join(buf)))

    def read_template(self):
        start_line = self.line
        self.advance()  # 开反引号
        buf = []
        while self.i < self.n:
            c = self.peek()
            if c == "\\":
                self.advance()
                if self.i < self.n:
                    nxt = self.peek()
                    if nxt == "\n":
                        self.advance()
                        continue
                    if nxt == "\r":
                        self.advance()
                        if self.peek() == "\n":
                            self.advance()
                        continue
                    buf.append(nxt)
                    self.advance()
                continue
            if c == "`":
                self.advance()
                break
            if c == "$" and self.peek(1) == "{":
                self.advance()
                self.advance()
                self.skip_expr()
                buf.append("{*}")
                continue
            buf.append(c)
            self.advance()
        self.out.append((start_line, "".join(buf)))

    def skip_expr(self):
        """跳过模板插值 ${...} 的内容（含嵌套花括号与字符串）。"""
        depth = 1
        while self.i < self.n and depth > 0:
            c = self.peek()
            if c in " \t\r\n":
                self.advance()
                continue
            if c == "/" and self.peek(1) == "/":
                while self.i < self.n and self.peek() != "\n":
                    self.advance()
                continue
            if c == "/" and self.peek(1) == "*":
                self.advance()
                self.advance()
                while self.i < self.n and not (self.peek() == "*" and self.peek(1) == "/"):
                    self.advance()
                if self.i < self.n:
                    self.advance()
                    self.advance()
                continue
            if c == '"' or c == "'":
                self.read_string()
                continue
            if c == "`":
                self.read_template()
                continue
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
            self.advance()


class HintHTMLParser(HTMLParser):
    """收集文本节点 + title / aria-label 属性值，带行号。"""

    ATTRS = ("title", "aria-label")

    def __init__(self):
        HTMLParser.__init__(self, convert_charrefs=True)
        self.items = []  # [(line, text)]

    def _attrs(self, attrs):
        line = self.getpos()[0]
        for name, val in attrs:
            if name in self.ATTRS and val:
                self.items.append((line, val))

    def handle_starttag(self, tag, attrs):
        self._attrs(attrs)

    def handle_startendtag(self, tag, attrs):
        self._attrs(attrs)

    def handle_data(self, data):
        text = data.strip()
        if text:
            self.items.append((self.getpos()[0], text))


def find_in_root_or_web(root, name):
    for cand in (os.path.join(root, name), os.path.join(root, "web", name)):
        if os.path.isfile(cand):
            return cand
    return None


def find_data_dir(root):
    for cand in (os.path.join(root, "data"), os.path.join(root, "..", "data")):
        if os.path.isdir(cand):
            norm = os.path.normpath(cand)
            if norm != os.path.normpath(root):
                return norm
    return None


def walk_json(obj, path, out):
    if isinstance(obj, str):
        out.append((path if path else "$", obj))
    elif isinstance(obj, dict):
        for k, v in obj.items():
            walk_json(v, (path + "." + k) if path else k, out)
    elif isinstance(obj, list):
        for idx, v in enumerate(obj):
            walk_json(v, "%s[%d]" % (path, idx), out)


def rel(root, path):
    return os.path.relpath(path, root).replace(os.sep, "/")


def collect(root):
    records = []  # (file, where, text)

    p = find_in_root_or_web(root, "app.js")
    if p:
        f = rel(root, p)
        for line, text in JSStringExtractor(read_text(p)).run():
            records.append((f, "line %d" % line, text))

    p = find_in_root_or_web(root, "index.html")
    if p:
        f = rel(root, p)
        parser = HintHTMLParser()
        parser.feed(read_text(p))
        for line, text in parser.items:
            records.append((f, "line %d" % line, text))

    data_dir = find_data_dir(root)
    if data_dir:
        for name in sorted(os.listdir(data_dir)):
            if not name.endswith(".json"):
                continue
            jpath = os.path.join(data_dir, name)
            if not os.path.isfile(jpath):
                continue
            f = rel(root, jpath)
            try:
                with open(jpath, "r", encoding="utf-8") as fh:
                    doc = json.load(fh)
            except (ValueError, OSError) as exc:
                sys.stderr.write("跳过 %s: %s\n" % (f, exc))
                continue
            pairs = []
            walk_json(doc, "", pairs)
            for where, text in pairs:
                records.append((f, where, text))

    return records


def sort_key(rec):
    f, where, _ = rec
    m = re.match(r"^line (\d+)$", where)
    if m:
        return (f, 0, int(m.group(1)), "")
    return (f, 1, 0, where)


def main():
    if len(sys.argv) != 2:
        sys.stderr.write("用法: python3 extract_hints.py <应用根目录>\n")
        return 2

    root = os.path.abspath(sys.argv[1])
    if not os.path.isdir(root):
        sys.stderr.write("不是目录: %s\n" % root)
        return 2

    records = [r for r in collect(root) if is_hint(r[2])]
    records.sort(key=sort_key)

    seen = set()
    out = []
    for f, where, text in records:
        key = (f, text)
        if key in seen:
            continue
        seen.add(key)
        out.append({"file": f, "where": where, "text": text})

    json.dump(out, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    sys.stderr.write("提取 %d 条\n" % len(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
