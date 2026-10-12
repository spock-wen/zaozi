#!/usr/bin/env bash
# 语法 / 类型检查（本机没有 ohos SDK，这是能拿到的最强一档）。
#
#   bash tools/box_check/parse_check.sh [日志路径]
#
# 两趟：
#
#   趟 A —— 逐文件 parser 检查（覆盖所有 .cj，含 index.cj / ui_*.cj）
#     cjc 先跑 parser；parser 失败就不会往下做 import 解析和语义分析。
#     所以把「本机缺包」「单文件编译没有 main」「单文件看不到同包其它文件」
#     这三类本机/隔离造成的错误剔掉，剩下的 error 就是文件自己的词法/语法错误。
#
#   趟 B —— 整包类型检查（只覆盖不 import kit/ohos 的纯逻辑文件）
#     把这些文件一次性交给 cjc，让语义分析真的跑起来。这一趟能查出
#     未声明标识符、类型不匹配、运算符不存在等真错误。
#     （box_check 用 cjpm 编译同一批文件，两者互为交叉验证。）
#
# 两趟都证明不了的（只能在 DevEco + ohos SDK 上验）：
#   - @Entry / @Component / @State / @Prop / @Builder / @r / @rawfile 宏的展开
#   - kit.ArkUI 控件的类型、属性、事件签名是否真的存在
#   - 整个 App 能不能链接、能不能装到设备上
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="${REPO:-$(cd "$HERE/../.." && pwd)}"
SRC="$REPO/entry/src/main/cangjie"
LOG="${1:-/workspace/zaozi-smoke/parse_check_run.log}"

if ! command -v cjc >/dev/null 2>&1; then
  for env in /home/box/.cangjie-sdk/*/cangjie/envsetup.sh; do
    if [ -f "$env" ]; then
      # shellcheck disable=SC1090
      source "$env"
      break
    fi
  done
fi
if ! command -v cjc >/dev/null 2>&1; then
  echo "ERROR: 找不到 cjc，请先 source <cangjie-sdk>/envsetup.sh" >&2
  exit 2
fi

# 全篇输出同时写终端和日志文件：用自身重跑一次并 tee。
# PARSE_CHECK_TEE 是防递归的哨兵；退出码取 tee 左边那一段（PIPESTATUS[0]）。
if [ -z "${PARSE_CHECK_TEE:-}" ]; then
  mkdir -p "$(dirname "$LOG")"
  PARSE_CHECK_TEE=1 "$0" "$@" 2>&1 | tee "$LOG"
  exit "${PIPESTATUS[0]}"
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

CJC_FLAGS=(--dump-ast --dump-to-screen -Woff all --error-count-limit all)

# 本机环境 / 单文件隔离造成的、不算源码问题的错误。
is_ignorable() {
  case "$1" in
    "can not find package "*) return 0 ;;   # 没有 ohos SDK
    "'main' is missing"*) return 0 ;;       # 单文件编译没有入口
    "'main' function is missing"*) return 0 ;;
    "undeclared identifier"*) return 0 ;;   # 同包其它文件里的符号，单文件看不到
    # 同上，但出现在类型名位置（如 run_state.cj 里用 zilu_model.cj 的 ZiluGridCell）。
    # 这类真错误趟 B 照样抓得到（趟 B 把所有纯逻辑文件一起编）。
    "undeclared type name"*) return 0 ;;
    *) return 1 ;;
  esac
}

# 从一份 cjc 输出里抽出真错误（剔掉可忽略的）。
collect_real_errors() {
  printf '%s\n' "$1" | grep '^error:' | while IFS= read -r line; do
    msg="${line#error: }"
    msg="${msg%% ==>*}"
    msg="$(printf '%s' "$msg" | sed 's/[[:space:]]*$//')"
    if ! is_ignorable "$msg"; then
      printf '%s\n' "$msg"
    fi
  done
}

mapfile -t files < <(find "$SRC" -name '*.cj' -type f | sort)

echo "造字人 parse check — cjc parser + 整包类型检查"
echo "cjc: $(cjc -v 2>&1 | head -1)"
echo "扫描目录：$SRC"
echo ""

# ---------- 趟 A：逐文件 parser ----------
echo "== 趟 A：逐文件 parser（${#files[@]} 个文件）=="
pass=0
fail=0
declare -a failed_files=()
declare -A missing_pkgs=()

for f in "${files[@]}"; do
  rel="${f#"$REPO"/}"
  out="$(cd "$TMP" && cjc "${CJC_FLAGS[@]}" "$f" 2>&1 | sed 's/\x1b\[[0-9;]*m//g')"
  mapfile -t errs < <(collect_real_errors "$out")
  if [ "${#errs[@]}" -eq 0 ]; then
    echo "OK   $rel"
    pass=$((pass + 1))
  else
    echo "FAIL $rel"
    for e in "${errs[@]}"; do echo "       - $e"; done
    fail=$((fail + 1))
    failed_files+=("$rel")
  fi
  # 顺手记一下哪些包本机没有（纯信息）
  while IFS= read -r line; do
    pkg="$(printf '%s' "$line" | sed "s/^error: can not find package '\(.*\)'.*/\1/")"
    [ -n "$pkg" ] && missing_pkgs["$pkg"]=1
  done < <(printf '%s\n' "$out" | grep "^error: can not find package " || true)
done
echo ""
echo "趟 A：通过 $pass / ${#files[@]}，失败 $fail"
[ "$fail" -gt 0 ] && echo "趟 A 失败文件：${failed_files[*]}"
if [ "${#missing_pkgs[@]}" -gt 0 ]; then
  echo "本机解析不到的 import（缺 ohos SDK，已忽略）:"
  for p in "${!missing_pkgs[@]}"; do echo "  - $p"; done
fi

# ---------- 趟 B：整包类型检查（纯逻辑文件） ----------
echo ""
echo "== 趟 B：整包类型检查（不 import kit/ohos 的文件）=="
pure=()
for f in "${files[@]}"; do
  if ! grep -qE '^[[:space:]]*(import|internal import)[[:space:]]+(kit\.|ohos\.)' "$f"; then
    pure+=("$f")
  fi
done
echo "参与编译的文件 ${#pure[@]} 个："
for f in "${pure[@]}"; do echo "  - ${f#"$REPO"/}"; done
out="$(cd "$TMP" && cjc "${CJC_FLAGS[@]}" "${pure[@]}" 2>&1 | sed 's/\x1b\[[0-9;]*m//g')"
mapfile -t perrs < <(collect_real_errors "$out")
if [ "${#perrs[@]}" -eq 0 ]; then
  echo "趟 B：PASS（0 error）"
  bfail=0
else
  echo "趟 B：FAIL（${#perrs[@]} error）"
  for e in "${perrs[@]}"; do echo "       - $e"; done
  bfail=1
fi

# ---------- 总结 ----------
echo ""
echo "—— 汇总 ——"
echo "趟 A 逐文件 parser ：$pass / ${#files[@]} 通过，$fail 失败"
if [ "$bfail" -eq 0 ]; then
  echo "趟 B 整包类型检查 ：PASS（${#pure[@]} 个纯逻辑文件）"
else
  echo "趟 B 整包类型检查 ：FAIL"
fi
if [ "$fail" -gt 0 ] || [ "$bfail" -ne 0 ]; then
  echo "PARSE CHECK RESULT: FAIL"
  exit 1
fi
echo "PARSE CHECK RESULT: PASS"
