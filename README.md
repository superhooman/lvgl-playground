# ⚡ LVGL Playground

An in-browser playground for [LVGL](https://lvgl.io/) — write C-style LVGL code in a Monaco editor and see it render live on an embedded 480×320 display, all powered by WebAssembly.

![Stack: LVGL v9.2 · Emscripten · React · Vite](https://img.shields.io/badge/LVGL_v9.2-Emscripten_%2B_React_%2B_Vite-blue)

## How It Works

1. **LVGL + SDL2** are compiled to WebAssembly via Emscripten. The WASM binary runs a real LVGL instance that renders to an HTML `<canvas>` through SDL2.
2. A **C-to-JS transpiler** (`transform.ts`) strips type annotations, `#include` directives, and function wrappers from user-written C code, producing a JavaScript body.
3. The JS body is executed against a **binding layer** (`lvgl.ts`) that maps familiar LVGL API calls (`lv_label_create`, `lv_obj_align`, `lv_color_hex`, …) to `Module.ccall()` invocations into the WASM module.
4. The result: you type standard LVGL C, hit **Run** (or <kbd>Ctrl</kbd>+<kbd>Enter</kbd>), and the canvas updates instantly.

## Prerequisites

- **Node.js** ≥ 18 and **pnpm** (or npm/yarn)
- **Python 3** (used by the WASM build script)
- **Emscripten** — installed automatically by `wasm/build.sh` if `emcc` is not in `PATH`

## Quick Start

```bash
# 1. Install JS dependencies
pnpm install

# 2. Clone / update emsdk & LVGL repos
pnpm setup

# 3. Build LVGL → WebAssembly (first run takes a few minutes)
pnpm build:wasm

# 4. Start the dev server
pnpm dev
```

Open the URL printed by Vite (typically `http://localhost:5173`). The default example renders immediately.

## Project Structure

```
├── index.html                  Vite entry point
├── vite.config.ts              Vite config (COOP/COEP headers for SharedArrayBuffer)
├── src/
│   ├── main.tsx                React root
│   ├── App.tsx                 Split-pane UI: Monaco editor + canvas preview
│   ├── lvgl.ts                 WASM loader & JS ↔ LVGL API bindings
│   ├── transform.ts            C → JS transpiler
│   └── styles/app.css          Layout styles
├── wasm/
│   ├── build.sh                End-to-end WASM build (emsdk → liblvgl.a → playground)
│   ├── helpers.c               C entry point, screen reset, v9 API wrappers
│   └── lv_conf.h               Generated LVGL config (created by build.sh)
├── public/
│   └── lvgl_playground.{js,wasm}  Build output served as static assets
├── lvgl/                       LVGL v9.2 source (cloned by build.sh)
└── emsdk/                      Emscripten SDK (installed by build.sh)
```

## WASM Build Details

`wasm/build.sh` performs these steps:

1. **Install emsdk** — clones and activates the Emscripten SDK if `emcc` is missing.
2. **Clone LVGL** — shallow-clones `release/v9.2` into `lvgl/` if not present.
3. **Generate `lv_conf.h`** — enables SDL2 driver and all Montserrat font sizes (8–48).
4. **Compile `liblvgl.a`** — incrementally compiles all LVGL `.c` files to a static archive.
5. **Link** — produces `public/lvgl_playground.{js,wasm}` with `MODULARIZE=1` so the module is loaded on demand.

To rebuild after changing `helpers.c` or LVGL config:

```bash
bash wasm/build.sh
```

Object files are cached in `.wasm-build/` — only changed sources are recompiled.

## Supported LVGL API

The playground exposes a subset of the LVGL v9 API. Write a standard `void user_app(void)` function using:

| Category | Functions |
|---|---|
| **Screen** | `lv_scr_act`, `lv_layer_top`, `lv_layer_sys` |
| **Objects** | `lv_obj_create`, `lv_obj_del`, `lv_obj_clean` |
| **Layout** | `lv_obj_set_pos`, `lv_obj_set_size`, `lv_obj_center`, `lv_obj_align` |
| **Flex** | `lv_obj_set_flex_flow`, `lv_obj_set_flex_align`, `lv_obj_set_flex_grow` |
| **Styles** | `lv_obj_set_style_bg_color`, `lv_obj_set_style_text_color`, `lv_obj_set_style_radius`, padding, borders, shadows, … |
| **Widgets** | `lv_label_create`, `lv_btn_create`, `lv_slider_create`, `lv_switch_create`, `lv_checkbox_create`, `lv_arc_create`, `lv_bar_create`, `lv_spinner_create`, `lv_dropdown_create` |
| **Colors** | `lv_color_hex`, `lv_color_make`, `lv_color_white`, `lv_color_black` |
| **Fonts** | `lv_font_montserrat_8` through `lv_font_montserrat_32` |
| **Constants** | `LV_ALIGN_*`, `LV_FLEX_*`, `LV_PART_*`, `LV_STATE_*`, `LV_ANIM_*`, `LV_OPA_*` |

## Example

```c
#include "lvgl.h"

void user_app(void)
{
    lv_obj_t *scr = lv_scr_act();
    lv_obj_set_style_bg_color(scr, lv_color_hex(0x000), LV_PART_MAIN);

    lv_obj_t *title = lv_label_create(scr);
    lv_label_set_text(title, "Hello, LVGL!");
    lv_obj_set_style_text_font(title, &lv_font_montserrat_24, LV_PART_MAIN);
    lv_obj_set_style_text_color(title, lv_color_hex(0xe94560), LV_PART_MAIN);
    lv_obj_align(title, LV_ALIGN_CENTER, 0, -60);

    lv_obj_t *slider = lv_slider_create(scr);
    lv_obj_set_width(slider, 200);
    lv_slider_set_value(slider, 60, LV_ANIM_OFF);
    lv_obj_align(slider, LV_ALIGN_CENTER, 0, 0);

    lv_obj_t *btn = lv_btn_create(scr);
    lv_obj_set_size(btn, 130, 44);
    lv_obj_align(btn, LV_ALIGN_CENTER, 0, 60);

    lv_obj_t *lbl = lv_label_create(btn);
    lv_label_set_text(lbl, "Click me!");
    lv_obj_center(lbl);
}
```

## Scripts

| Command | Description |
|---|---|
| `pnpm setup` | Clone/update emsdk & LVGL repos |
| `pnpm dev` | Start Vite dev server with HMR |
| `pnpm build` | Type-check + production build |
| `pnpm build:wasm` | Compile LVGL to WebAssembly |
| `pnpm preview` | Preview the production build |

## License

LVGL is licensed under the [MIT License](https://github.com/lvgl/lvgl/blob/master/LICENCE.txt).
