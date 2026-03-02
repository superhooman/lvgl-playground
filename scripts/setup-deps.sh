#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# setup-deps.sh  –  Clone / update emsdk and LVGL repos.
#
# Usage:
#   bash scripts/setup-deps.sh        # from project root
#   pnpm setup                         # via package.json script
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EMSDK_DIR="$ROOT/emsdk"
LVGL_DIR="$ROOT/lvgl"

EMSDK_REPO="https://github.com/emscripten-core/emsdk.git"
LVGL_REPO="https://github.com/lvgl/lvgl.git"
LVGL_BRANCH="release/v9.2"

# ── emsdk ────────────────────────────────────────────────────────────────────
if [[ -d "$EMSDK_DIR/.git" ]]; then
  echo "→ Updating emsdk …"
  git -C "$EMSDK_DIR" pull --ff-only
else
  echo "→ Cloning emsdk …"
  git clone "$EMSDK_REPO" "$EMSDK_DIR"
fi

echo "→ Installing & activating latest emsdk …"
"$EMSDK_DIR/emsdk" install latest
"$EMSDK_DIR/emsdk" activate latest
echo "✓ emsdk ready: $EMSDK_DIR"

# ── LVGL ─────────────────────────────────────────────────────────────────────
if [[ -d "$LVGL_DIR/.git" ]]; then
  echo "→ Updating LVGL ($LVGL_BRANCH) …"
  git -C "$LVGL_DIR" fetch origin "$LVGL_BRANCH"
  git -C "$LVGL_DIR" reset --hard "origin/${LVGL_BRANCH#*/}"
else
  echo "→ Cloning LVGL ($LVGL_BRANCH) …"
  git clone --depth=1 --branch "$LVGL_BRANCH" "$LVGL_REPO" "$LVGL_DIR"
fi
echo "✓ LVGL ready: $LVGL_DIR"

echo ""
echo "Done! Next steps:"
echo "  pnpm build:wasm   # compile LVGL to WebAssembly"
echo "  pnpm dev           # start dev server"
