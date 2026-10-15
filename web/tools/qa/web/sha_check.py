#!/usr/bin/env python3
"""
Compute SHA256 checksums and image dimensions for card art assets across:
1. Store assets: /cursor/stores/store-a39b3a5b-baf8-4319-bd0f-2caefb6dae75/zaozi-formal/v5_cardart/assets/
2. Web img: /workspace/qa-zaozi-web-f6f799e/src/web/img/cardart/
3. Dist img: /workspace/qa-zaozi-web-f6f799e/src/dist/img/cardart/

Verify each listed file against the store's SHA256SUMS file.
Output CSV to /workspace/qa-zaozi-web-f6f799e/cardart/sha_compare.csv with columns:
name,store_sha,web_sha,dist_sha,sumsfile_ok,width,height,match

Print summary of counts.
"""

import os
import sys
import csv
import hashlib
import struct

try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

STORE_ASSETS_DIR = "/cursor/stores/store-a39b3a5b-baf8-4319-bd0f-2caefb6dae75/zaozi-formal/v5_cardart/assets"
WEB_IMG_DIR = "/workspace/qa-zaozi-web-f6f799e/src/web/img/cardart"
DIST_IMG_DIR = "/workspace/qa-zaozi-web-f6f799e/src/dist/img/cardart"
STORE_SUMS_FILE = "/cursor/stores/store-a39b3a5b-baf8-4319-bd0f-2caefb6dae75/zaozi-formal/v5_cardart/SHA256SUMS"
OUTPUT_CSV_FILE = "/workspace/qa-zaozi-web-f6f799e/cardart/sha_compare.csv"


def compute_sha256(filepath):
    """Compute sha256 hex string for a given file, or return empty string if missing."""
    if not os.path.isfile(filepath):
        return ""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def read_image_dimensions(filepath):
    """
    Read (width, height) of PNG or WebP image.
    Uses PIL if available; otherwise parses raw header bytes.
    """
    if not os.path.isfile(filepath):
        return "", ""

    if HAS_PIL:
        try:
            with Image.open(filepath) as img:
                return img.size[0], img.size[1]
        except Exception:
            pass

    # Fallback to header parsing
    try:
        with open(filepath, "rb") as f:
            data = f.read(32)

        # PNG: IHDR chunk at offset 12..16, width at 16..20, height at 20..24
        if len(data) >= 24 and data[:8] == b"\x89PNG\r\n\x1a\n" and data[12:16] == b"IHDR":
            w, h = struct.unpack(">II", data[16:24])
            return w, h

        # WebP: RIFF header
        if len(data) >= 30 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
            chunk = data[12:16]
            if chunk == b"VP8 ":  # Lossy VP8
                if data[23:26] == b"\x9d\x01\x2a":
                    w = struct.unpack("<H", data[26:28])[0] & 0x3FFF
                    h = struct.unpack("<H", data[28:30])[0] & 0x3FFF
                    return w, h
            elif chunk == b"VP8L":  # Lossless VP8L
                if data[20] == 0x2F:
                    val = struct.unpack("<I", data[21:25])[0]
                    w = 1 + (val & 0x3FFF)
                    h = 1 + ((val >> 14) & 0x3FFF)
                    return w, h
            elif chunk == b"VP8X":  # Extended VP8X
                w = 1 + data[24] + (data[25] << 8) + (data[26] << 16)
                h = 1 + data[27] + (data[28] << 8) + (data[29] << 16)
                return w, h
    except Exception:
        pass

    return "", ""


def parse_sha256sums(sums_path):
    """Parse SHA256SUMS file into dictionary mapping normalized paths/basenames to hash."""
    sums = {}
    if not os.path.isfile(sums_path):
        return sums

    with open(sums_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split(None, 1)
            if len(parts) == 2:
                sha, rel_path = parts
                # Store multiple forms for robust lookup
                sums[rel_path] = sha
                clean_path = rel_path.lstrip("./")
                sums[clean_path] = sha
                sums[os.path.basename(rel_path)] = sha
    return sums


def main():
    sums_dict = parse_sha256sums(STORE_SUMS_FILE)

    # Collect files from all three directories
    store_files = set(os.listdir(STORE_ASSETS_DIR)) if os.path.isdir(STORE_ASSETS_DIR) else set()
    web_files = set(os.listdir(WEB_IMG_DIR)) if os.path.isdir(WEB_IMG_DIR) else set()
    dist_files = set(os.listdir(DIST_IMG_DIR)) if os.path.isdir(DIST_IMG_DIR) else set()

    all_file_names = sorted(store_files | web_files | dist_files)

    rows = []
    store_count = 0
    web_count = 0
    dist_count = 0
    sumsfile_ok_count = 0
    match_count = 0

    for name in all_file_names:
        store_path = os.path.join(STORE_ASSETS_DIR, name)
        web_path = os.path.join(WEB_IMG_DIR, name)
        dist_path = os.path.join(DIST_IMG_DIR, name)

        store_sha = compute_sha256(store_path)
        web_sha = compute_sha256(web_path)
        dist_sha = compute_sha256(dist_path)

        if store_sha:
            store_count += 1
        if web_sha:
            web_count += 1
        if dist_sha:
            dist_count += 1

        # Check against SHA256SUMS
        expected_sha = sums_dict.get(name) or sums_dict.get(f"./assets/{name}") or sums_dict.get(f"assets/{name}")
        if expected_sha and store_sha:
            sumsfile_ok = (store_sha == expected_sha)
        elif expected_sha and (web_sha or dist_sha):
            sumsfile_ok = ((web_sha or dist_sha) == expected_sha)
        else:
            sumsfile_ok = False

        if sumsfile_ok:
            sumsfile_ok_count += 1

        # Read image pixel dimensions (try store, web, dist in order)
        width, height = "", ""
        for candidate_path in (store_path, web_path, dist_path):
            if os.path.isfile(candidate_path):
                w, h = read_image_dimensions(candidate_path)
                if w and h:
                    width, height = w, h
                    break

        # Match check: all copies present and equal, matching sumsfile
        is_match = bool(store_sha and web_sha and dist_sha and store_sha == web_sha == dist_sha and sumsfile_ok)
        if is_match:
            match_count += 1

        rows.append({
            "name": name,
            "store_sha": store_sha,
            "web_sha": web_sha,
            "dist_sha": dist_sha,
            "sumsfile_ok": sumsfile_ok,
            "width": width,
            "height": height,
            "match": is_match,
        })

    # Ensure output directory exists
    os.makedirs(os.path.dirname(OUTPUT_CSV_FILE), exist_ok=True)

    fieldnames = ["name", "store_sha", "web_sha", "dist_sha", "sumsfile_ok", "width", "height", "match"]
    with open(OUTPUT_CSV_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    # Print summary of counts
    total_files = len(all_file_names)
    print("=" * 60)
    print("SHA CHECK & COMPARISON SUMMARY")
    print("=" * 60)
    print(f"Total unique filenames checked: {total_files}")
    print(f"Files present in store assets : {store_count} / {total_files}")
    print(f"Files present in web img      : {web_count} / {total_files}")
    print(f"Files present in dist img     : {dist_count} / {total_files}")
    print(f"Files verified against SUMS   : {sumsfile_ok_count} / {total_files} (sumsfile_ok=True)")
    print(f"Files with full 3-way match   : {match_count} / {total_files} (match=True)")
    print(f"Mismatches or missing files   : {total_files - match_count}")
    print(f"Output CSV written to         : {OUTPUT_CSV_FILE}")
    print("=" * 60)


if __name__ == "__main__":
    main()
