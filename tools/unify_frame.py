#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""unify_frame.py - GLYPH_PACK_V1 显示外框归一（GLYPH_PACK_V1.md §5.2）。

每行 CSV -> normalized/<id>_<stage>.<svg|png>：以墨迹 bbox（渲染后 alpha > 10）
裁掉留白 -> 以 bbox 中心为中心的正方形框，边长 = max(bbox_w, bbox_h)/0.86
（最长墨迹边占 86%）-> 300x300。SVG 复用 i_norm.py 的办法：只改根 <svg> 的
viewBox/width/height/preserveAspectRatio，其余字节不动（path d 属性逐个校验）；
PNG 用 PIL 重新合成后 LANCZOS 缩到 300x300。每个输出都在 160x160 上复测：
最长边占比 0.86±0.02，bbox 中心偏离画布中心 <= 2px。
"""
import csv, hashlib, io, json, os, re, sys
from datetime import datetime, timedelta, timezone

import cairosvg
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageFont

R = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(R, 'glyph', 'glyph_pack_v1.csv')
OUTDIR = os.path.join(R, 'normalized')
SCALE, FILL, THRESH, OUT_PX = 4, 0.86, 10, 160
EDGE_TOL, CENTER_TOL = 0.02, 2.0
STAGES = ('oracle', 'bronze', 'seal', 'clerical')
ROOT_TAG = re.compile(r'(?s)<svg\b.*?>')


# --------------------------------------------------------------- SVG helpers
def parse_root(text):
    m = ROOT_TAG.search(text)
    return m.group(0), m.start(), m.end()


def get_attr(tag, name):
    m = re.search(r'\b%s\s*=\s*"([^"]*)"' % name, tag)
    return m.group(1) if m else None


def set_attr(tag, name, value):
    """在 root 开始标签里替换/插入一个属性，其余字节不动。"""
    pat = re.compile(r'\b%s\s*=\s*"[^"]*"' % name)
    if pat.search(tag):
        return pat.sub('%s="%s"' % (name, value), tag, count=1)
    return tag[:-1] + '\n    %s="%s">' % (name, value)


def fmt(v):
    s = ('%.4f' % v).rstrip('0').rstrip('.')
    return s if s else '0'


def user_viewbox(text, name):
    tag, _, _ = parse_root(text)
    vb = get_attr(tag, 'viewBox')
    if vb:
        return tuple(float(x) for x in vb.replace(',', ' ').split())
    w, h = get_attr(tag, 'width'), get_attr(tag, 'height')
    assert w and h and re.fullmatch(r'[\d.]+', w) and re.fullmatch(r'[\d.]+', h), \
        '%s: 无 viewBox 且 width/height 带单位 %r %r' % (name, w, h)
    return 0.0, 0.0, float(w), float(h)


def render(text, w=None, h=None):
    kw = {'output_%s' % k: v for k, v in (('width', w), ('height', h)) if v}
    return Image.open(io.BytesIO(cairosvg.svg2png(
        bytestring=text.encode('utf-8'), **kw))).convert('RGBA')


def alpha_bbox(img):
    return img.getchannel('A').point(lambda a: 255 if a > THRESH else 0).getbbox()


def path_ds(text):
    return [el.attrib['d'] for el in ET.fromstring(text).iter() if 'd' in el.attrib]


def measure(text, name):
    """SVG 用户坐标下的墨迹 bbox（按原 viewBox ×SCALE 渲染）。"""
    vx, vy, vw, vh = user_viewbox(text, name)
    tag, s, e = parse_root(text)
    for k, v in (('viewBox', '%s %s %s %s' % (fmt(vx), fmt(vy), fmt(vw), fmt(vh))),
                 ('width', fmt(vw * SCALE)), ('height', fmt(vh * SCALE))):
        tag = set_attr(tag, k, v)
    img = render(text[:s] + tag + text[e:])
    bb = alpha_bbox(img)
    assert bb, '%s: 未找到非透明像素' % name
    kx, ky = img.width / vw, img.height / vh      # 渲染像素 / 用户单位
    l, t, r, b = bb
    return (vx + l / kx, vy + t / ky, vx + r / kx, vy + b / ky)


def frame(x0, y0, x1, y1):
    """以 bbox 中心为中心的正方形框 (x, y, side, side)。"""
    side = max(x1 - x0, y1 - y0) / FILL
    cx, cy = (x0 + x1) / 2.0, (y0 + y1) / 2.0
    return (cx - side / 2.0, cy - side / 2.0, side, side)

def norm_svg(text, name):
    x0, y0, x1, y1 = measure(text, name)
    nvb = frame(x0, y0, x1, y1)
    tag, s, e = parse_root(text)
    ntag = tag
    for k, v in (('viewBox', ' '.join(fmt(x) for x in nvb)), ('width', '300'),
                 ('height', '300'), ('preserveAspectRatio', 'xMidYMid meet')):
        ntag = set_attr(ntag, k, v)
    new = text[:s] + ntag + text[e:]
    old = get_attr(tag, 'viewBox')
    old_v = tuple(float(x) for x in old.replace(',', ' ').split()) if old else None
    delta = None if old_v is None else [round(n - o, 4) for n, o in zip(nvb, old_v)]
    return dict(text=new, new_vb=nvb, src_bbox=[round(v, 4) for v in (x0, y0, x1, y1)],
                old_vb=old, delta=delta,
                rest_same=text[:s] == new[:s] and text[e:] == new[s + len(ntag):],
                d_ok=path_ds(text) == path_ds(new))


def norm_png(im):
    """裁 alpha bbox -> 透明正方形画布 -> LANCZOS 到 300x300。"""
    bb = alpha_bbox(im)
    assert bb, 'PNG: 未找到非透明像素'
    l, t, r, b = bb
    bw, bh = r - l, b - t
    side = int(round(max(bw, bh) / FILL))
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(im.crop(bb), ((side - bw) // 2, (side - bh) // 2))
    return canvas.resize((300, 300), Image.LANCZOS), dict(
        crop_box=[l, t, r, b], canvas_side=side, scale=round(300.0 / side, 4),
        upscaled=side < 300)


def verify(img):
    """160x160 上复测：最长边占比 + bbox 中心偏离画布中心。"""
    bb = alpha_bbox(img)
    if not bb:
        return 0.0, [float(OUT_PX)] * 2, False
    l, t, r, b = bb
    edge = max(r - l, b - t) / float(OUT_PX)
    off = [(l + r) / 2.0 - OUT_PX / 2.0, (t + b) / 2.0 - OUT_PX / 2.0]
    return (round(edge, 4), [round(o, 3) for o in off],
            abs(edge - FILL) <= EDGE_TOL and max(map(abs, off)) <= CENTER_TOL)


def thumb(path, size):
    if path.lower().endswith('.svg'):
        return render(open(path, encoding='utf-8').read(), size, size)
    return Image.open(path).convert('RGBA').resize((size, size), Image.LANCZOS)


def contact_sheet(by_id):
    """一行为一个字，四列 oracle/bronze/seal/clerical，缺的阶段留空。"""
    cell, lab, gap, marg, head = 120, 64, 8, 10, 22
    sheet = Image.new('RGB', (marg + lab + gap + 4 * (cell + gap) + marg,
                              marg + head + len(by_id) * (cell + gap) + marg), 'white')
    dr, font = ImageDraw.Draw(sheet), ImageFont.load_default()
    for j, st in enumerate(STAGES):
        dr.text((marg + lab + gap + j * (cell + gap), marg + 5), st,
                fill=(110, 110, 110), font=font)
    for i, rid in enumerate(by_id):
        y = marg + head + i * (cell + gap)
        dr.text((marg, y + cell // 2 - 4), rid, fill='black', font=font)
        for j, st in enumerate(STAGES):
            x, p = marg + lab + gap + j * (cell + gap), by_id[rid].get(st)
            if p:
                tile = thumb(p, cell)
                bg = Image.new('RGB', (cell, cell), 'white')
                bg.paste(tile, (0, 0), tile)
                sheet.paste(bg, (x, y))
            else:
                dr.rectangle([x, y, x + cell - 1, y + cell - 1], fill=(246, 246, 246))
            dr.rectangle([x, y, x + cell - 1, y + cell - 1], outline=(198, 198, 198))
    out = os.path.join(OUTDIR, 'contact_sheet.png')
    sheet.save(out)
    return out, sheet.size

def main():
    rows = list(csv.DictReader(open(CSV_PATH, encoding='utf-8')))
    assert len(rows) == 106, 'CSV 行数 %d != 106' % len(rows)
    os.makedirs(OUTDIR, exist_ok=True)
    entries, fails, up, by_id = [], [], [], {}
    for row in rows:
        rid, stage, f = row['id'], row['stage'], row['format']
        ext = 'svg' if f == 'SVG' else 'png'
        label = '%s_%s' % (rid, stage)
        raw = open(os.path.join(R, row['path']), 'rb').read()
        npath = os.path.join(OUTDIR, '%s.%s' % (label, ext))
        e = dict(id=rid, char=row['char'], stage=stage, order=int(row['order']),
                 stage_label=row['stage_label'], format=f, source_path=row['path'],
                 source_sha1=hashlib.sha1(raw).hexdigest(),
                 sha_ok=hashlib.sha1(raw).hexdigest() == row['sha1'].strip().lower(),
                 normalized_path=os.path.relpath(npath, R).replace(os.sep, '/'))
        if ext == 'svg':
            info = norm_svg(raw.decode('utf-8'), label)
            with open(npath, 'w', encoding='utf-8', newline='') as fh:
                fh.write(info['text'])
            le, off, vok = verify(render(info['text'], OUT_PX, OUT_PX))
            e.update(src_bbox=info['src_bbox'], old_viewBox=info['old_vb'],
                     new_viewBox=' '.join(fmt(x) for x in info['new_vb']),
                     viewbox_delta=info['delta'], rest_same=info['rest_same'],
                     d_ok=info['d_ok'])
        else:
            out, info = norm_png(Image.open(io.BytesIO(raw)).convert('RGBA'))
            out.save(npath)
            le, off, vok = verify(Image.open(npath).convert('RGBA')
                                  .resize((OUT_PX, OUT_PX), Image.LANCZOS))
            e.update(src_bbox=info['crop_box'], crop_box=info['crop_box'],
                     canvas_side=info['canvas_side'], scale=info['scale'],
                     upscaled=info['upscaled'], d_ok=None)
            up += [(label, info['scale'])] if info['upscaled'] else []
        e.update(normalized_sha1=hashlib.sha1(open(npath, 'rb').read()).hexdigest(),
                 long_edge_160=le, center_off_160=off)
        e['ok'] = bool(e['sha_ok'] and vok and e.get('rest_same') is not False
                       and e.get('d_ok') is not False)
        fails += [label] if not e['ok'] else []
        entries.append(e)
        by_id.setdefault(rid, {})[stage] = npath
        print('%-22s %-3s edge=%.4f off=[%6.3f,%6.3f] %s'
              % (label, f, le, off[0], off[1], 'ok' if e['ok'] else 'FAIL'))

    with open(os.path.join(OUTDIR, 'normalized_manifest.json'), 'w',
              encoding='utf-8') as fh:
        json.dump(entries, fh, ensure_ascii=False, indent=1)
    mf = dict(pack='GLYPH_PACK_V1', count=len(rows),
              frame_rule='crop alpha>10 bbox; square centered; longest edge 86%; 300x300',
              generated_at=datetime.now(timezone(timedelta(hours=8))
                                         ).isoformat(timespec='seconds'),
              glyphs=[dict(id=e['id'], char=e['char'], trad=r['trad'], stage=e['stage'],
                           order=e['order'], stage_label=e['stage_label'],
                           format=e['format'], source=r['source'], license=r['license'],
                           credit_note=r['credit_note'], source_path=e['source_path'],
                           sha1=e['source_sha1'], normalized_path=e['normalized_path'],
                           normalized_sha1=e['normalized_sha1'])
                      for e, r in zip(entries, rows)])
    with open(os.path.join(R, 'MANIFEST.json'), 'w', encoding='utf-8') as fh:
        json.dump(mf, fh, ensure_ascii=False, indent=1)
    sheet, size = contact_sheet(by_id)

    nsvg = sum(1 for e in entries if e['format'] == 'SVG')
    edges = [abs(e['long_edge_160'] - FILL) for e in entries]
    coffs = [max(map(abs, e['center_off_160'])) for e in entries]
    norms = [e for e in entries if e['source_path'].startswith('glyph/img/norm/')]
    dmax = max([max(map(abs, e['viewbox_delta'])) for e in norms
                if e['viewbox_delta']], default=0.0)
    print('\n--- summary ---')
    print('rows=%d ok=%d fail=%d (svg=%d png=%d)' %
          (len(entries), len(entries) - len(fails), len(fails), nsvg, len(entries) - nsvg))
    print('source sha1 mismatches: %d' % sum(1 for e in entries if not e['sha_ok']))
    print('d_ok/rest_same failures: %d' %
          sum(1 for e in entries if e['d_ok'] is False or e.get('rest_same') is False))
    print('max |long_edge-0.86| = %.4f (tol %.2f); max |center off| = %.3f px @160 (tol %.1f)'
          % (max(edges), EDGE_TOL, max(coffs), CENTER_TOL))
    print('norm/ idempotence: %d files, max |dviewBox| = %.4f' % (len(norms), dmax))
    print('png upscaled (canvas_side<300): %d %s' % (len(up), up or ''))
    print('contact sheet -> %s %s' % (sheet, size))
    if fails:
        print('FAILED: %s' % fails)
        return 1
    print('RESULT: %d/%d PASS' % (len(entries), len(entries)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
