#!/usr/bin/env bash
# 把 App 里的纯逻辑 .cj 拷进 box 校验工程（幂等）。
# 只拷不 import kit/ohos 的文件：glyph_data.cj（GENERATED）、theme.cj、
# evo_model.cj、copy_text.cj、zilu_model.cj、run_state.cj。
# src/main.cj 由本目录的 main.cj 提供，反复 sync 不会丢驱动。
#
# 用法：cd tools/box_check && ./sync.sh && cjpm build && cjpm run
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="${REPO:-$(cd "$HERE/../.." && pwd)}"
SRC="$REPO/entry/src/main/cangjie"

FILES="glyph_data.cj theme.cj evo_model.cj copy_text.cj zilu_model.cj run_state.cj event_cards.cj game_rules.cj"

rm -rf "$HERE/src"
mkdir -p "$HERE/src"
for f in $FILES; do
  cp "$SRC/$f" "$HERE/src/$f"
done
cp "$HERE/main.cj" "$HERE/src/main.cj"

echo "synced from $SRC:"
find "$HERE/src" -name '*.cj' | sort | sed "s|$HERE/|  |"
