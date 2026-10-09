#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 GLYPH_PACK_V1 的字形资源同步进 App，并重新生成 glyph_data.cj。

    python3 tools/sync_glyphs.py [--bundle /workspace/zaozi-smoke/glyphs]
                                  [--csv PATH] [--dry-run]

做的事：
  1. <bundle>/glyph/glyph_pack_v1.csv → entry/src/main/resources/rawfile/glyph/glyph_pack_v1.csv
  2. <bundle>/MANIFEST.json → rawfile/glyph/MANIFEST.json（存在才拷）
  3. <bundle>/normalized/<id>_<stage>.<svg|png> → rawfile/glyph/<id>_<stage>.<svg|png>
  4. 校验：CSV 106 行；(id, stage) 不重复；每行 CSV 的 path 恰好对应一个
     normalized 文件；MANIFEST 里认得出来的 normalized_sha1 逐个比对。
  5. 重新生成 entry/src/main/cangjie/glyph_data.cj 与 glyph_res.cj
     （tools/gen_glyph_catalog.py）

任何校验不通过 → 退出码非 0。normalized/ 不存在时仍然生成 (5)，只打 WARNING
（这时 App 里没有字形图，跑起来会缺图，但纯逻辑和 catalog 是对的）。

纯 stdlib。
"""
import argparse
import hashlib
import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import gen_glyph_catalog as gen  # noqa: E402

DEFAULT_BUNDLE = "/workspace/zaozi-smoke/glyphs"
DEST_GLYPH_DIR = os.path.join(REPO, "entry", "src", "main", "resources", "rawfile", "glyph")


def sha1_of(path):
    h = hashlib.sha1()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def load_manifest_sha1(manifest_path):
    """尽量从 MANIFEST.json 里取出 {normalized 文件名: sha1}。

    schema 由 coordinator 侧定义、这里没有约定，所以做宽容解析：
    能认出就返回 dict，认不出就返回 None（调用方只打 WARNING，不因此失败）。
    """
    try:
        with open(manifest_path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except Exception as exc:  # noqa: BLE001
        print("WARNING: MANIFEST.json 读不了（%s），跳过 sha1 校验" % exc)
        return None

    def pick(rec):
        name = None
        for key in ("normalized_path", "normalized", "file", "filename", "name",
                    "asset", "path", "target"):
            v = rec.get(key)
            if isinstance(v, str) and v:
                name = os.path.basename(v)
                break
        digest = None
        for key in ("normalized_sha1", "sha1", "display_sha1", "norm_sha1"):
            v = rec.get(key)
            if isinstance(v, str) and len(v) == 40:
                digest = v
                break
        if name and digest:
            return name, digest
        return None

    out = {}
    records = None
    if isinstance(data, dict):
        for key in ("glyphs", "files", "entries", "rows", "items"):
            if isinstance(data.get(key), list):
                records = data[key]
                break
        if records is None:
            # 也可能是 {文件名: {sha1: ...}} 直接映射
            for k, v in data.items():
                if isinstance(v, dict):
                    got = pick(dict(v, name=k))
                    if got:
                        out[got[0]] = got[1]
                elif isinstance(v, str) and len(v) == 40:
                    out[os.path.basename(k)] = v
    elif isinstance(data, list):
        records = data
    if records:
        for rec in records:
            if isinstance(rec, dict):
                got = pick(rec)
                if got:
                    out[got[0]] = got[1]
    if not out:
        print("WARNING: MANIFEST.json 结构不认识，跳过 normalized_sha1 校验")
        return None
    return out


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--bundle", default=DEFAULT_BUNDLE,
                    help="字形包目录（含 glyph/glyph_pack_v1.csv 与 normalized/）")
    ap.add_argument("--csv", default=None, help="覆盖 CSV 路径")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)

    bundle = os.path.abspath(args.bundle)
    csv_src = os.path.abspath(args.csv) if args.csv else os.path.join(bundle, "glyph", "glyph_pack_v1.csv")
    norm_dir = os.path.join(bundle, "normalized")
    manifest_src = os.path.join(bundle, "MANIFEST.json")
    errors = []

    if not os.path.isfile(csv_src):
        print("ERROR: 找不到 CSV：%s" % csv_src)
        return 1
    rows = gen.read_rows(csv_src)
    csv_errs = gen.check_rows(rows)
    for e in csv_errs:
        errors.append("CSV: %s" % e)
    if errors:
        for e in errors:
            print("  - %s" % e)
        return 1
    print("CSV 行数：%d（期望 %d）" % (len(rows), gen.EXPECTED_ROWS))

    if not args.dry_run:
        os.makedirs(DEST_GLYPH_DIR, exist_ok=True)
        shutil.copyfile(csv_src, os.path.join(DEST_GLYPH_DIR, "glyph_pack_v1.csv"))
    print("CSV → %s" % os.path.join(DEST_GLYPH_DIR, "glyph_pack_v1.csv"))

    if os.path.isfile(manifest_src):
        if not args.dry_run:
            shutil.copyfile(manifest_src, os.path.join(DEST_GLYPH_DIR, "MANIFEST.json"))
        print("MANIFEST.json → %s" % os.path.join(DEST_GLYPH_DIR, "MANIFEST.json"))
    else:
        print("WARNING: %s 不存在，不拷 MANIFEST.json" % manifest_src)

    # 每行 CSV 的 path 必须恰好对应一个 normalized 文件
    # （bundle 里文件名 = asset 去掉 "glyph/" 前缀，即 <id>_<stage>.<ext>）
    expected = {}
    for row in rows:
        expected.setdefault(os.path.basename(gen.asset_name(row)),
                            []).append(row["path"].strip())
    dup = {k: v for k, v in expected.items() if len(v) > 1}
    if dup:
        for k, v in dup.items():
            errors.append("asset %s 被多行 CSV 指向：%s" % (k, v))

    if not os.path.isdir(norm_dir):
        print("WARNING: %s 不存在，字形图未同步（App 里会缺图），仍从 CSV 生成 catalog"
              % norm_dir)
    else:
        present = sorted(os.listdir(norm_dir))
        manifest_sha1 = load_manifest_sha1(manifest_src) if os.path.isfile(manifest_src) else None
        copied = 0
        for name in sorted(expected):
            src = os.path.join(norm_dir, name)
            if not os.path.isfile(src):
                errors.append("normalized/ 缺文件：%s（CSV path %s）"
                              % (name, expected[name][0]))
                continue
            if manifest_sha1 is not None and name in manifest_sha1:
                got = sha1_of(src)
                if got != manifest_sha1[name]:
                    errors.append("sha1 不一致：%s（文件 %s，MANIFEST %s）"
                                  % (name, got, manifest_sha1[name]))
            if not args.dry_run:
                shutil.copyfile(src, os.path.join(DEST_GLYPH_DIR, name))
            copied += 1
        extra = [n for n in present if n not in expected]
        if extra:
            print("WARNING: normalized/ 里有 %d 个 CSV 未引用的文件（不拷）：%s%s"
                  % (len(extra), ", ".join(extra[:5]), " …" if len(extra) > 5 else ""))
        print("字形图：拷贝 %d / 期望 %d（normalized/ 实有 %d 个文件）"
              % (copied, len(expected), len(present)))

    if errors:
        print("ERROR: 校验未过 %d 项：" % len(errors))
        for e in errors:
            print("  - %s" % e)
        return 1

    if args.dry_run:
        print("dry-run：不写文件")
        return 0

    rc = gen.main([
        "--csv", csv_src,
        "--out", os.path.join(REPO, "entry", "src", "main", "cangjie", "glyph_data.cj"),
        "--res-out", os.path.join(REPO, "entry", "src", "main", "cangjie", "glyph_res.cj"),
    ])
    if rc != 0:
        return rc
    print("OK: glyph 同步完成")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
