#!/usr/bin/env bash
set -u

# Ensure Node 22 is first on PATH if present
if [ -d "/workspace/node22/node-v22.23.3-linux-x64/bin" ]; then
  export PATH="/workspace/node22/node-v22.23.3-linux-x64/bin:$PATH"
fi

# Verify Node version >= 22
if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] node is not installed or not found on PATH" >&2
  exit 2
fi

NODE_VER=$(node -v 2>/dev/null || echo "")
NODE_MAJOR=$(echo "$NODE_VER" | sed -E 's/^v([0-9]+).*/\1/')
if [ -z "$NODE_MAJOR" ] || [ "$NODE_MAJOR" -lt 22 ]; then
  echo "[ERROR] Node.js version >= 22 is required, but found $NODE_VER" >&2
  exit 2
fi

# 1. Locate repository root
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || true)
if [ -z "$REPO_ROOT" ]; then
  echo "[ERROR] Not inside a git repository" >&2
  exit 2
fi

# Parse CLI options
QUICK_FLAG=""
ENGINES_VAL="chromium,firefox,webkit"
SUBMISSION_VAL=""
BASE_VAL=""
ONLY_VAL=""

while [ $# -gt 0 ]; do
  case "$1" in
    --quick)
      QUICK_FLAG="--quick"
      shift
      ;;
    --engines)
      ENGINES_VAL="$2"
      shift 2
      ;;
    --engines=*)
      ENGINES_VAL="${1#*=}"
      shift
      ;;
    --submission)
      SUBMISSION_VAL="$2"
      shift 2
      ;;
    --submission=*)
      SUBMISSION_VAL="${1#*=}"
      shift
      ;;
    --base)
      BASE_VAL="$2"
      shift 2
      ;;
    --base=*)
      BASE_VAL="${1#*=}"
      shift
      ;;
    --only)
      ONLY_VAL="$2"
      shift 2
      ;;
    --only=*)
      ONLY_VAL="${1#*=}"
      shift
      ;;
    -h|--help)
      echo "Usage: bash qa/review/run.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --quick                  Only test 375x667, 360x800, 1920x1080 (PM rule T4)"
      echo "  --engines ENGINES        Browsers: chromium,firefox,webkit (default all three)"
      echo "  --submission FILE        Path to submission markdown file (e.g. PR body)"
      echo "  --base REF               Base git ref for commits check (default: merge-base)"
      echo "  --only ITEMS             Comma-separated items: c1,c2,c3,c4,c5,c6"
      echo "  -h, --help               Show this help message"
      exit 0
      ;;
    *)
      echo "[ERROR] Unknown option: $1" >&2
      exit 2
      ;;
  esac
done

# Compute default base ref if not provided
if [ -z "$BASE_VAL" ]; then
  BASE_VAL=$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null || git rev-parse HEAD~1 2>/dev/null || echo "HEAD~1")
fi

# 2. Ensure web/node_modules exists (else npm ci in web)
if [ ! -d "$REPO_ROOT/web/node_modules" ]; then
  echo "[run.sh] web/node_modules not found, running npm ci..."
  (cd "$REPO_ROOT/web" && npm ci) || {
    echo "[ERROR] npm ci failed in web/" >&2
    exit 2
  }
fi

# 3. Build dist
echo "[run.sh] Building web dist..."
(cd "$REPO_ROOT/web" && node tools/build_dist.mjs) || {
  echo "[ERROR] Failed to build dist/" >&2
  exit 2
}

# 4. Prepare output directories
SHORTSHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
OUT_DIR="$REPO_ROOT/qa/review/out/$SHORTSHA"
LATEST_DIR="$REPO_ROOT/qa/review/out/latest"
rm -rf "$OUT_DIR"   # 清掉同 sha 上次的结果，免得检查器崩了还读到旧 json
mkdir -p "$OUT_DIR/shots"
mkdir -p "$LATEST_DIR"

# 5. Start static server on a free port
FREE_PORT=$(node -e 'import("node:net").then(({ createServer }) => { const s = createServer(); s.listen(0, "127.0.0.1", () => { console.log(s.address().port); s.close(); }); });')
if [ -z "$FREE_PORT" ]; then
  FREE_PORT=5179
fi

SERVER_PID=""
cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

SERVER_LOG="$OUT_DIR/server.log"
(cd "$REPO_ROOT/web" && node web/serve_pages.mjs --port "$FREE_PORT") > "$SERVER_LOG" 2>&1 &
SERVER_PID=$!

# Wait for server to be ready
READY=0
for _ in $(seq 1 50); do
  if grep -q "http://localhost" "$SERVER_LOG" 2>/dev/null; then
    READY=1
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    break
  fi
  sleep 0.1
done

if [ "$READY" -ne 1 ]; then
  echo "[ERROR] serve_pages failed to start on port $FREE_PORT" >&2
  cat "$SERVER_LOG" >&2
  exit 2
fi

echo "[run.sh] Static server started on port $FREE_PORT (PID: $SERVER_PID)"
echo "[run.sh] Output directory: $OUT_DIR"

# Filter functions for checkers
should_run() {
  local target="$1"
  if [ -z "$ONLY_VAL" ]; then
    return 0
  fi
  local lower_only
  lower_only=$(echo "$ONLY_VAL" | tr '[:upper:]' '[:lower:]')
  for item in $(echo "$lower_only" | tr ',' ' '); do
    if [ "$item" = "$target" ]; then
      return 0
    fi
  done
  return 1
}

TOOL_ERROR=0

# 6. Run Checkers

# C4a: static_check
if should_run "c4" || should_run "c4a"; then
  echo "[run.sh] Running static_check.mjs (C4a / R20)..."
  node "$REPO_ROOT/qa/review/static_check.mjs" \
    --repo-root "$REPO_ROOT" \
    --out-dir "$OUT_DIR" || true
fi

# C1, C2, C3, C4b: ui_gate
if should_run "c1" || should_run "c2" || should_run "c3" || should_run "c4" || should_run "c4b"; then
  echo "[run.sh] Running ui_gate.mjs (C1, C2, C3, C4b)..."
  UI_ARGS=(
    --repo-root "$REPO_ROOT"
    --out-dir "$OUT_DIR"
    --port "$FREE_PORT"
    --engines "$ENGINES_VAL"
  )
  if [ -n "$QUICK_FLAG" ]; then
    UI_ARGS+=("$QUICK_FLAG")
  fi
  if [ -n "$ONLY_VAL" ]; then
    UI_ARGS+=(--only "$ONLY_VAL")
  fi
  node "$REPO_ROOT/qa/review/ui_gate.mjs" "${UI_ARGS[@]}" || true
fi

# C5: cli_model_check
if should_run "c5"; then
  echo "[run.sh] Running cli_model_check.mjs (C5 / R24)..."
  CLI_ARGS=(
    --repo-root "$REPO_ROOT"
    --out-dir "$OUT_DIR"
    --base "$BASE_VAL"
  )
  if [ -n "$SUBMISSION_VAL" ]; then
    CLI_ARGS+=(--submission "$SUBMISSION_VAL")
  fi
  node "$REPO_ROOT/qa/review/cli_model_check.mjs" "${CLI_ARGS[@]}" || true
fi

# C6: data_safety
if should_run "c6"; then
  echo "[run.sh] Running data_safety.mjs (C6 / 数据安全)..."
  SAFETY_ARGS=(
    --repo-root "$REPO_ROOT"
    --out-dir "$OUT_DIR"
    --port "$FREE_PORT"
    --engines "$ENGINES_VAL"
  )
  node "$REPO_ROOT/qa/review/data_safety.mjs" "${SAFETY_ARGS[@]}" || true
fi

# 7. Summary and Report Generation
echo "[run.sh] Aggregating results..."
SUMMARY_ARGS=(
  --repo-root "$REPO_ROOT"
  --out-dir "$OUT_DIR"
)
if [ -n "$ONLY_VAL" ]; then
  SUMMARY_ARGS+=(--only "$ONLY_VAL")
fi

node "$REPO_ROOT/qa/review/summary.mjs" "${SUMMARY_ARGS[@]}"
SUMMARY_EXIT=$?

# Copy summary files to out/latest/
cp "$OUT_DIR/summary.json" "$LATEST_DIR/summary.json" 2>/dev/null || true
cp "$OUT_DIR/summary.md" "$LATEST_DIR/summary.md" 2>/dev/null || true

if [ "$SUMMARY_EXIT" -eq 0 ]; then
  exit 0
else
  exit 1
fi
