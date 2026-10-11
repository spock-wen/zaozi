#!/usr/bin/env python3
"""Verify bundle source files against glyph/glyph_pack_v1.sha1 (sha1sum format).
Also cross-checks that CSV `path`/`sha1` columns agree with the .sha1 list.
Usage: python3 verify_sha1.py [bundle_root]
       (default bundle_root = /workspace/zaozi-smoke/glyphs)
Exit 0 only if all 106 OK."""
import csv, hashlib, os, sys
DEFAULT_BUNDLE = "/workspace/zaozi-smoke/glyphs"
root = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_BUNDLE)
EXPECTED = 106
lst = os.path.join(root, 'glyph', 'glyph_pack_v1.sha1')
entries = []
for line in open(lst, encoding='utf-8'):
    line = line.rstrip('\n')
    if not line.strip():
        continue
    h, p = line.split(None, 1)
    entries.append((h.lower(), p.lstrip('*').strip()))
ok, bad = 0, []
for h, p in entries:
    fp = os.path.join(root, p)
    if not os.path.isfile(fp):
        bad.append((p, 'MISSING')); continue
    got = hashlib.sha1(open(fp, 'rb').read()).hexdigest()
    if got == h: ok += 1
    else: bad.append((p, 'MISMATCH got %s want %s' % (got, h)))
rows = list(csv.DictReader(open(os.path.join(root, 'glyph', 'glyph_pack_v1.csv'), encoding='utf-8')))
lstmap = dict((p, h) for h, p in entries)
csv_mismatch = [r['path'] for r in rows if lstmap.get(r['path']) != r['sha1'].lower()]
for p, why in bad: print('FAIL', p, why)
for p in csv_mismatch: print('CSV/SHA1 DISAGREE', p)
print('entries=%d ok=%d fail=%d csv_rows=%d csv_disagree=%d' % (len(entries), ok, len(bad), len(rows), len(csv_mismatch)))
good = ok == EXPECTED == len(entries) == len(rows) and not bad and not csv_mismatch
print('RESULT: %d/%d %s' % (ok, EXPECTED, 'PASS' if good else 'FAIL'))
sys.exit(0 if good else 1)
