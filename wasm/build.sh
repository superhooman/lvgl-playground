#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# build.sh  –  Compile LVGL + SDL2 + helpers to lvgl_playground.{js,wasm}
#              Output lands in  ../public/  (served as static assets by Vite).
#
# Run from anywhere:
#   bash wasm/build.sh
#
# emcc is installed automatically into <playground>/emsdk if not in PATH.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LVGL_DIR="$ROOT/lvgl"
WASM_DIR="$SCRIPT_DIR"
OUT_DIR="$ROOT/public"
BUILD_DIR="$ROOT/.wasm-build"

mkdir -p "$OUT_DIR" "$BUILD_DIR/objs"

# ── 0. Ensure emcc is available (install emsdk if needed) ───────────────────
EMSDK_DIR="$ROOT/emsdk"

if ! command -v emcc &>/dev/null; then
  echo "→ emcc not found — installing emsdk into $EMSDK_DIR …"
  if [[ ! -d "$EMSDK_DIR" ]]; then
    git clone https://github.com/emscripten-core/emsdk.git "$EMSDK_DIR"
  fi
  "$EMSDK_DIR/emsdk" install latest
  "$EMSDK_DIR/emsdk" activate latest
  # shellcheck source=/dev/null
  source "$EMSDK_DIR/emsdk_env.sh"
else
  echo "✓ emcc: $(emcc --version 2>&1 | head -1)"
fi

# If emcc was just installed via emsdk_env.sh it is in PATH now; if the user
# had it from a previous install but not sourced, try to source it.
if ! command -v emcc &>/dev/null && [[ -f "$EMSDK_DIR/emsdk_env.sh" ]]; then
  source "$EMSDK_DIR/emsdk_env.sh"
fi

command -v emcc &>/dev/null || { echo "ERROR: emcc still not found after emsdk setup."; exit 1; }

# ── 1. Clone LVGL if needed ─────────────────────────────────────────────────
if [[ ! -f "$LVGL_DIR/lvgl.h" ]]; then
  echo "→ Cloning LVGL v9.2 …"
  git clone --depth=1 --branch release/v9.2 \
    https://github.com/lvgl/lvgl.git "$LVGL_DIR"
fi
echo "✓ LVGL: $LVGL_DIR"

# ── 2. Generate lv_conf.h from LVGL template (first time only) ──────────────
LV_CONF="$WASM_DIR/lv_conf.h"
if [[ ! -f "$LV_CONF" ]]; then
  echo "→ Generating lv_conf.h …"
  WASM_DIR="$WASM_DIR" LVGL_DIR="$LVGL_DIR" python3 - <<'PYEOF'
import re, sys, os
from pathlib import Path
wasm_dir  = Path(os.environ["WASM_DIR"])
lvgl_dir  = Path(os.environ["LVGL_DIR"])
src = lvgl_dir / "lv_conf_template.h"
dst = wasm_dir / "lv_conf.h"
text = src.read_text()
text = text.replace('#if 0 /*Set it to "1" to enable content*/',
                    '#if 1 /*Set it to "1" to enable content*/', 1)
text = re.sub(r'#define LV_USE_SDL\s+0', '#define LV_USE_SDL 1', text)
for size in [8,10,12,14,16,18,20,22,24,28,32,36,48]:
    text = re.sub(rf'#define LV_FONT_MONTSERRAT_{size}\s+0',
                  f'#define LV_FONT_MONTSERRAT_{size} 1', text)
dst.write_text(text)
print(f"  wrote {dst}")
PYEOF
fi
echo "✓ lv_conf.h: $LV_CONF"

# ── 3. Pre-compile LVGL to a static library ──────────────────────────────────
LIBLVGL="$BUILD_DIR/liblvgl.a"
if [[ ! -f "$LIBLVGL" ]]; then
  echo "→ Pre-compiling LVGL (this takes a few minutes) …"
  WASM_DIR="$WASM_DIR" LVGL_DIR="$LVGL_DIR" BUILD_DIR="$BUILD_DIR" \
  python3 - <<'PYEOF'
import os, subprocess, sys
from pathlib import Path

lvgl_dir  = Path(os.environ["LVGL_DIR"])
wasm_dir  = Path(os.environ["WASM_DIR"])
build_dir = Path(os.environ["BUILD_DIR"])
objs_dir  = build_dir / "objs"
objs_dir.mkdir(parents=True, exist_ok=True)

skip = {"examples", "demos", "tests", "test"}
srcs = [p for p in lvgl_dir.rglob("*.c") if not any(d in skip for d in p.parts)]
print(f"  Compiling {len(srcs)} files …")

compiled = 0
for src in srcs:
    flat = str(src.relative_to(lvgl_dir)).replace("/","__").replace("\\","__")
    obj  = objs_dir / (flat + ".o")
    if obj.exists() and obj.stat().st_mtime >= src.stat().st_mtime:
        continue
    r = subprocess.run(
        ["emcc", f"-I{lvgl_dir}", f"-I{wasm_dir}",
         "-DLV_CONF_INCLUDE_SIMPLE", "-s", "USE_SDL=2", "-O1",
         "-c", str(src), "-o", str(obj)],
        capture_output=True, text=True)
    if r.returncode != 0:
        print(f"  WARN: {src.name}: {r.stderr[:120]}")
    else:
        compiled += 1

objs = list(objs_dir.glob("*.o"))
lib  = build_dir / "liblvgl.a"
subprocess.run(["emar", "rcs", str(lib)] + [str(o) for o in objs], check=True)
print(f"  → liblvgl.a  ({compiled} compiled, {len(objs)} total objects)")
PYEOF
fi
echo "✓ liblvgl.a: $LIBLVGL"

# ── 4. Build the playground WASM ─────────────────────────────────────────────
echo "→ Linking lvgl_playground.{js,wasm} …"

# Explicit export list — more reliable than EXPORT_ALL in Emscripten 5.x.
# Our own helpers use EMSCRIPTEN_KEEPALIVE; LVGL public API is listed here.
EXPORTED_FUNCTIONS='[
  "_main",
  "_reset_screen",
  "_helper_scr_act","_helper_layer_top","_helper_layer_sys",
  "_helper_set_bg_color","_helper_set_text_color",
  "_helper_set_border_color","_helper_set_shadow_color","_helper_set_outline_color",
  "_helper_set_arc_color","_helper_set_line_color",
  "_helper_set_bg_grad_color","_helper_set_img_recolor",
  "_helper_set_pad_all","_helper_set_pad_gap",
  "_get_font_montserrat_8","_get_font_montserrat_10","_get_font_montserrat_12",
  "_get_font_montserrat_14","_get_font_montserrat_16","_get_font_montserrat_18",
  "_get_font_montserrat_20","_get_font_montserrat_22","_get_font_montserrat_24",
  "_get_font_montserrat_28","_get_font_montserrat_32",
  "_lv_obj_create","_lv_obj_delete","_lv_obj_clean",
  "_lv_obj_set_pos","_lv_obj_set_size","_lv_obj_set_width","_lv_obj_set_height",
  "_lv_obj_center","_lv_obj_align","_lv_obj_align_to",
  "_lv_obj_set_style_opa",
  "_lv_obj_set_style_bg_opa",
  "_lv_obj_set_style_bg_grad_dir","_lv_obj_set_style_bg_main_stop","_lv_obj_set_style_bg_grad_stop",
  "_lv_obj_set_style_border_width","_lv_obj_set_style_border_opa",
  "_lv_obj_set_style_radius",
  "_lv_obj_set_style_pad_top","_lv_obj_set_style_pad_bottom",
  "_lv_obj_set_style_pad_left","_lv_obj_set_style_pad_right",
  "_lv_obj_set_style_shadow_width","_lv_obj_set_style_shadow_opa",
  "_lv_obj_set_style_shadow_spread",
  "_lv_obj_set_style_shadow_offset_x","_lv_obj_set_style_shadow_offset_y",
  "_lv_obj_set_style_outline_width","_lv_obj_set_style_outline_opa",
  "_lv_obj_set_style_outline_pad",
  "_lv_obj_set_style_arc_width","_lv_obj_set_style_arc_opa","_lv_obj_set_style_arc_rounded",
  "_lv_obj_set_style_line_width","_lv_obj_set_style_line_opa","_lv_obj_set_style_line_rounded",
  "_lv_obj_set_style_line_dash_width","_lv_obj_set_style_line_dash_gap",
  "_lv_obj_set_style_img_opa","_lv_obj_set_style_img_recolor_opa",
  "_lv_obj_set_style_text_font","_lv_obj_set_style_text_align",
  "_lv_obj_set_style_text_letter_space","_lv_obj_set_style_text_line_space",
  "_lv_obj_set_style_text_opa","_lv_obj_set_style_text_decor",
  "_lv_obj_set_style_translate_x","_lv_obj_set_style_translate_y",
  "_lv_obj_set_style_transform_rotation",
  "_lv_obj_set_style_transform_scale_x","_lv_obj_set_style_transform_scale_y",
  "_lv_obj_set_style_min_width","_lv_obj_set_style_max_width",
  "_lv_obj_set_style_min_height","_lv_obj_set_style_max_height",
  "_lv_obj_add_flag","_lv_obj_remove_flag",
  "_lv_obj_add_state","_lv_obj_remove_state",
  "_lv_obj_set_flex_flow","_lv_obj_set_flex_align","_lv_obj_set_flex_grow",
  "_lv_label_create","_lv_label_set_text","_lv_label_set_long_mode",
  "_lv_button_create",
  "_lv_slider_create","_lv_slider_set_value","_lv_slider_set_range","_lv_slider_get_value",
  "_lv_switch_create",
  "_lv_checkbox_create","_lv_checkbox_set_text",
  "_lv_arc_create","_lv_arc_set_value","_lv_arc_set_range",
  "_lv_arc_set_bg_angles","_lv_arc_set_angles","_lv_arc_set_mode",
  "_lv_bar_create","_lv_bar_set_value","_lv_bar_set_range",
  "_lv_spinner_create",
  "_lv_dropdown_create","_lv_dropdown_set_options","_lv_dropdown_get_selected",
  "_lv_obj_get_style_width","_lv_obj_get_style_height",
  "_lv_obj_get_width","_lv_obj_get_height","_lv_obj_get_x","_lv_obj_get_y",
  "_lv_obj_get_child_count","_lv_obj_get_child"
]'

emcc \
  -I"$LVGL_DIR" \
  -I"$WASM_DIR" \
  -DLV_CONF_INCLUDE_SIMPLE \
  "$WASM_DIR/helpers.c" \
  "$LIBLVGL" \
  -s USE_SDL=2 \
  -s WASM=1 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORTED_FUNCTIONS="$EXPORTED_FUNCTIONS" \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \
  -s MODULARIZE=1 \
  -s EXPORT_NAME="createLvglModule" \
  -s SDL2_IMAGE_FORMATS='[]' \
  -s FORCE_FILESYSTEM=0 \
  -O1 \
  -o "$OUT_DIR/lvgl_playground.js"

echo ""
echo "✓ Done!  public/lvgl_playground.{js,wasm} are ready."
echo ""
echo "Start the dev server:"
echo "  npm run dev"
