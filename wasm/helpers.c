/**
 * LVGL Playground WASM helpers + entry point.
 *
 * All EMSCRIPTEN_KEEPALIVE functions are callable from JS via Module.ccall().
 *
 * Why wrappers exist:
 *  - v9 renamed several v8 API symbols (lv_scr_act → lv_screen_active, etc.)
 *  - Some convenience functions are static inline (pad_all, pad_gap) so can't
 *    be exported directly from the WASM binary.
 *  - lv_color_t is a BGR struct; we accept uint32_t to avoid ABI issues.
 */

#include "lvgl.h"
#include "src/drivers/sdl/lv_sdl_window.h"
#include "src/drivers/sdl/lv_sdl_mouse.h"
#include <SDL2/SDL.h>
#include <emscripten.h>

/* ── Entry point ──────────────────────────────────────────────────────────── */

static void main_loop(void)
{
    lv_tick_inc(16);
    lv_timer_handler();
}

int main(void)
{
    /* Restrict SDL keyboard listeners to #canvas so they don't swallow
       keydown events meant for the Monaco editor outside the canvas. */
    SDL_SetHint(SDL_HINT_EMSCRIPTEN_KEYBOARD_ELEMENT, "#canvas");

    lv_init();

    lv_display_t *disp = lv_sdl_window_create(480, 320);
    lv_display_set_default(disp);

    lv_indev_t *mouse = lv_sdl_mouse_create();
    (void)mouse;

    /* simulate=0: non-blocking; main() returns, loop runs via rAF */
    emscripten_set_main_loop(main_loop, 60, 0);

    return 0;
}

/* ── Screen reset ─────────────────────────────────────────────────────────── */

EMSCRIPTEN_KEEPALIVE
void reset_screen(void)
{
    lv_obj_t *scr = lv_screen_active();
    lv_obj_clean(scr);
    lv_obj_set_style_bg_color(scr, lv_color_black(), 0);
    lv_obj_set_style_bg_opa(scr, LV_OPA_COVER, 0);
}

/* ── v9 API wrappers (v8-renamed or require display parameter) ────────────── */

EMSCRIPTEN_KEEPALIVE
lv_obj_t *helper_scr_act(void)
    { return lv_screen_active(); }

EMSCRIPTEN_KEEPALIVE
lv_obj_t *helper_layer_top(void)
    { return lv_display_get_layer_top(lv_display_get_default()); }

EMSCRIPTEN_KEEPALIVE
lv_obj_t *helper_layer_sys(void)
    { return lv_display_get_layer_sys(lv_display_get_default()); }

/* ── Inline style wrappers (static inline → can't be WASM-exported directly) */

EMSCRIPTEN_KEEPALIVE
void helper_set_pad_all(lv_obj_t *obj, int32_t v, lv_style_selector_t sel)
    { lv_obj_set_style_pad_all(obj, v, sel); }

EMSCRIPTEN_KEEPALIVE
void helper_set_pad_gap(lv_obj_t *obj, int32_t v, lv_style_selector_t sel)
    { lv_obj_set_style_pad_gap(obj, v, sel); }

/* ── Color helpers (uint32_t → lv_color_t BGR struct) ────────────────────── */

static inline lv_color_t u32_to_color(uint32_t c)
{
    lv_color_t col;
    col.blue  = (uint8_t)((c)       & 0xFF);
    col.green = (uint8_t)((c >>  8) & 0xFF);
    col.red   = (uint8_t)((c >> 16) & 0xFF);
    return col;
}

EMSCRIPTEN_KEEPALIVE
void helper_set_bg_color(lv_obj_t *obj, uint32_t color, lv_style_selector_t sel)
    { lv_obj_set_style_bg_color(obj, u32_to_color(color), sel); }

EMSCRIPTEN_KEEPALIVE
void helper_set_text_color(lv_obj_t *obj, uint32_t color, lv_style_selector_t sel)
    { lv_obj_set_style_text_color(obj, u32_to_color(color), sel); }

EMSCRIPTEN_KEEPALIVE
void helper_set_border_color(lv_obj_t *obj, uint32_t color, lv_style_selector_t sel)
    { lv_obj_set_style_border_color(obj, u32_to_color(color), sel); }

EMSCRIPTEN_KEEPALIVE
void helper_set_shadow_color(lv_obj_t *obj, uint32_t color, lv_style_selector_t sel)
    { lv_obj_set_style_shadow_color(obj, u32_to_color(color), sel); }

EMSCRIPTEN_KEEPALIVE
void helper_set_outline_color(lv_obj_t *obj, uint32_t color, lv_style_selector_t sel)
    { lv_obj_set_style_outline_color(obj, u32_to_color(color), sel); }

EMSCRIPTEN_KEEPALIVE
void helper_set_arc_color(lv_obj_t *obj, uint32_t color, lv_style_selector_t sel)
    { lv_obj_set_style_arc_color(obj, u32_to_color(color), sel); }

EMSCRIPTEN_KEEPALIVE
void helper_set_line_color(lv_obj_t *obj, uint32_t color, lv_style_selector_t sel)
    { lv_obj_set_style_line_color(obj, u32_to_color(color), sel); }

EMSCRIPTEN_KEEPALIVE
void helper_set_bg_grad_color(lv_obj_t *obj, uint32_t color, lv_style_selector_t sel)
    { lv_obj_set_style_bg_grad_color(obj, u32_to_color(color), sel); }

EMSCRIPTEN_KEEPALIVE
void helper_set_img_recolor(lv_obj_t *obj, uint32_t color, lv_style_selector_t sel)
    { lv_obj_set_style_img_recolor(obj, u32_to_color(color), sel); }

/* ── Font pointer getters ─────────────────────────────────────────────────── */

#define FONT_GETTER(size) \
    EMSCRIPTEN_KEEPALIVE \
    const lv_font_t *get_font_montserrat_##size(void) \
    { return &lv_font_montserrat_##size; }

FONT_GETTER(8)
FONT_GETTER(10)
FONT_GETTER(12)
FONT_GETTER(14)
FONT_GETTER(16)
FONT_GETTER(18)
FONT_GETTER(20)
FONT_GETTER(22)
FONT_GETTER(24)
FONT_GETTER(28)
FONT_GETTER(32)
