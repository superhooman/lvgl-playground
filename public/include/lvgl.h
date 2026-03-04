/**
 * lvgl.h  —  Minimal LVGL v9 header for the in-browser playground.
 *
 * This header is compiled INTO the user's WASM module.
 * All lv_* functions are imported from the LVGL Emscripten runtime at link
 * time; the bridge in runtime.ts provides the actual implementations.
 *
 * Design notes:
 *  - lv_color_t is kept as uint32_t (RGB888 0xRRGGBB) — the bridge converts
 *    it to lv_color_t (RGB565) before calling into Emscripten LVGL.
 *  - Fonts are accessed via lv_get_font_montserrat_NN() getter functions
 *    (imported from the bridge), and the macros below let you use the
 *    standard  &lv_font_montserrat_24  syntax transparently.
 *  - All constants are plain #defines so they fold to literals at compile
 *    time and do NOT produce WASM imports.
 */

#ifndef LVGL_H
#define LVGL_H

/* ── Basic types ─────────────────────────────────────────────────────────── */
typedef unsigned char      uint8_t;
typedef unsigned short     uint16_t;
typedef unsigned int       uint32_t;
typedef signed int         int32_t;
typedef unsigned long long uint64_t;
typedef long long          int64_t;

typedef uint32_t size_t;
typedef int      bool;
#define true  1
#define false 0
#define NULL  ((void*)0)

/* ── LVGL opaque / simplified types ─────────────────────────────────────── */
typedef void     lv_obj_t;
typedef void     lv_font_t;
typedef void     lv_event_t;
typedef void     lv_anim_t;
typedef void     lv_style_t;
typedef uint32_t lv_color_t;          /* simplified: RGB888 0xRRGGBB         */
typedef int32_t  lv_coord_t;
typedef uint32_t lv_style_selector_t;
typedef uint8_t  lv_opa_t;
typedef uint16_t lv_anim_enable_t;

/* ── Color helpers (pure macros — produce zero WASM imports) ─────────────── */
#define lv_color_hex(c)        ((lv_color_t)(c))
#define lv_color_make(r, g, b) ((lv_color_t)(((uint32_t)(r) << 16) | ((uint32_t)(g) << 8) | (uint32_t)(b)))
#define lv_color_white()       ((lv_color_t)0xFFFFFF)
#define lv_color_black()       ((lv_color_t)0x000000)

/* ── Alignment ───────────────────────────────────────────────────────────── */
#define LV_ALIGN_DEFAULT           0
#define LV_ALIGN_TOP_LEFT          1
#define LV_ALIGN_TOP_MID           2
#define LV_ALIGN_TOP_RIGHT         3
#define LV_ALIGN_BOTTOM_LEFT       4
#define LV_ALIGN_BOTTOM_MID        5
#define LV_ALIGN_BOTTOM_RIGHT      6
#define LV_ALIGN_LEFT_MID          7
#define LV_ALIGN_RIGHT_MID         8
#define LV_ALIGN_CENTER            9
#define LV_ALIGN_OUT_TOP_LEFT      10
#define LV_ALIGN_OUT_TOP_MID       11
#define LV_ALIGN_OUT_TOP_RIGHT     12
#define LV_ALIGN_OUT_BOTTOM_LEFT   13
#define LV_ALIGN_OUT_BOTTOM_MID    14
#define LV_ALIGN_OUT_BOTTOM_RIGHT  15

/* ── Flex layout ─────────────────────────────────────────────────────────── */
#define LV_FLEX_FLOW_ROW             1
#define LV_FLEX_FLOW_COLUMN          2
#define LV_FLEX_FLOW_ROW_WRAP        5
#define LV_FLEX_FLOW_ROW_REVERSE     9
#define LV_FLEX_FLOW_COLUMN_WRAP     6
#define LV_FLEX_FLOW_COLUMN_REVERSE  10
#define LV_FLEX_ALIGN_START          0
#define LV_FLEX_ALIGN_END            1
#define LV_FLEX_ALIGN_CENTER         2
#define LV_FLEX_ALIGN_SPACE_EVENLY   3
#define LV_FLEX_ALIGN_SPACE_AROUND   4
#define LV_FLEX_ALIGN_SPACE_BETWEEN  5

/* ── Part selector ───────────────────────────────────────────────────────── */
#define LV_PART_MAIN       0x000000
#define LV_PART_SCROLLBAR  0x010000
#define LV_PART_INDICATOR  0x020000
#define LV_PART_KNOB       0x030000
#define LV_PART_SELECTED   0x040000
#define LV_PART_ITEMS      0x050000
#define LV_PART_CURSOR     0x060000

/* ── Object state ────────────────────────────────────────────────────────── */
#define LV_STATE_DEFAULT   0x0000
#define LV_STATE_CHECKED   0x0001
#define LV_STATE_FOCUSED   0x0002
#define LV_STATE_PRESSED   0x0020
#define LV_STATE_DISABLED  0x0080

/* ── Animation ───────────────────────────────────────────────────────────── */
#define LV_ANIM_OFF  0
#define LV_ANIM_ON   1

/* ── Opacity ─────────────────────────────────────────────────────────────── */
#define LV_OPA_TRANSP  0
#define LV_OPA_10      25
#define LV_OPA_20      51
#define LV_OPA_30      76
#define LV_OPA_40      102
#define LV_OPA_50      127
#define LV_OPA_60      153
#define LV_OPA_70      178
#define LV_OPA_80      204
#define LV_OPA_90      229
#define LV_OPA_COVER   255

/* ── Size specials ───────────────────────────────────────────────────────── */
#define LV_SIZE_CONTENT  0x1FFFFFFF
#define LV_PCT(x)        ((int32_t)(x) | 0x20000000)

/* ── Object flags ────────────────────────────────────────────────────────── */
#define LV_OBJ_FLAG_HIDDEN       0x0001
#define LV_OBJ_FLAG_CLICKABLE    0x0002
#define LV_OBJ_FLAG_SCROLLABLE   0x0200

/* ── Text / label ────────────────────────────────────────────────────────── */
#define LV_TEXT_ALIGN_AUTO    0
#define LV_TEXT_ALIGN_LEFT    1
#define LV_TEXT_ALIGN_CENTER  2
#define LV_TEXT_ALIGN_RIGHT   3

#define LV_LABEL_LONG_WRAP    0
#define LV_LABEL_LONG_DOT     1
#define LV_LABEL_LONG_SCROLL  2
#define LV_LABEL_LONG_CLIP    3

/* ── Font getter functions (provided by the runtime bridge) ──────────────── */
/*
 * Use these like:  lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, 0);
 * The macros expand  &lv_font_montserrat_24  →  lv_get_font_montserrat_24()
 * which is a regular imported function returning a font pointer.
 */
const lv_font_t *lv_get_font_montserrat_8(void);
const lv_font_t *lv_get_font_montserrat_10(void);
const lv_font_t *lv_get_font_montserrat_12(void);
const lv_font_t *lv_get_font_montserrat_14(void);
const lv_font_t *lv_get_font_montserrat_16(void);
const lv_font_t *lv_get_font_montserrat_18(void);
const lv_font_t *lv_get_font_montserrat_20(void);
const lv_font_t *lv_get_font_montserrat_22(void);
const lv_font_t *lv_get_font_montserrat_24(void);
const lv_font_t *lv_get_font_montserrat_28(void);
const lv_font_t *lv_get_font_montserrat_32(void);

#define lv_font_montserrat_8   (*lv_get_font_montserrat_8())
#define lv_font_montserrat_10  (*lv_get_font_montserrat_10())
#define lv_font_montserrat_12  (*lv_get_font_montserrat_12())
#define lv_font_montserrat_14  (*lv_get_font_montserrat_14())
#define lv_font_montserrat_16  (*lv_get_font_montserrat_16())
#define lv_font_montserrat_18  (*lv_get_font_montserrat_18())
#define lv_font_montserrat_20  (*lv_get_font_montserrat_20())
#define lv_font_montserrat_22  (*lv_get_font_montserrat_22())
#define lv_font_montserrat_24  (*lv_get_font_montserrat_24())
#define lv_font_montserrat_28  (*lv_get_font_montserrat_28())
#define lv_font_montserrat_32  (*lv_get_font_montserrat_32())

/* ── Screen & layers ─────────────────────────────────────────────────────── */
lv_obj_t *lv_scr_act(void);
lv_obj_t *lv_screen_active(void);
lv_obj_t *lv_layer_top(void);
lv_obj_t *lv_layer_sys(void);

/* ── Object lifecycle ────────────────────────────────────────────────────── */
lv_obj_t *lv_obj_create(lv_obj_t *parent);
void      lv_obj_delete(lv_obj_t *obj);
void      lv_obj_clean(lv_obj_t *obj);

/* ── Position / size ─────────────────────────────────────────────────────── */
void lv_obj_set_pos(lv_obj_t *obj, int32_t x, int32_t y);
void lv_obj_set_size(lv_obj_t *obj, int32_t w, int32_t h);
void lv_obj_set_width(lv_obj_t *obj, int32_t w);
void lv_obj_set_height(lv_obj_t *obj, int32_t h);
void lv_obj_center(lv_obj_t *obj);
void lv_obj_align(lv_obj_t *obj, int32_t align, int32_t x_ofs, int32_t y_ofs);
void lv_obj_align_to(lv_obj_t *obj, lv_obj_t *base, int32_t align, int32_t x_ofs, int32_t y_ofs);

/* ── Style setters ───────────────────────────────────────────────────────── */
void lv_obj_set_style_bg_color(lv_obj_t *obj, lv_color_t color, lv_style_selector_t sel);
void lv_obj_set_style_bg_opa(lv_obj_t *obj, lv_opa_t opa, lv_style_selector_t sel);
void lv_obj_set_style_text_color(lv_obj_t *obj, lv_color_t color, lv_style_selector_t sel);
void lv_obj_set_style_text_font(lv_obj_t *obj, const lv_font_t *font, lv_style_selector_t sel);
void lv_obj_set_style_text_align(lv_obj_t *obj, int32_t align, lv_style_selector_t sel);
void lv_obj_set_style_text_letter_space(lv_obj_t *obj, int32_t space, lv_style_selector_t sel);
void lv_obj_set_style_text_line_space(lv_obj_t *obj, int32_t space, lv_style_selector_t sel);
void lv_obj_set_style_border_color(lv_obj_t *obj, lv_color_t color, lv_style_selector_t sel);
void lv_obj_set_style_border_width(lv_obj_t *obj, int32_t width, lv_style_selector_t sel);
void lv_obj_set_style_border_opa(lv_obj_t *obj, lv_opa_t opa, lv_style_selector_t sel);
void lv_obj_set_style_radius(lv_obj_t *obj, int32_t radius, lv_style_selector_t sel);
void lv_obj_set_style_pad_all(lv_obj_t *obj, int32_t pad, lv_style_selector_t sel);
void lv_obj_set_style_pad_top(lv_obj_t *obj, int32_t pad, lv_style_selector_t sel);
void lv_obj_set_style_pad_bottom(lv_obj_t *obj, int32_t pad, lv_style_selector_t sel);
void lv_obj_set_style_pad_left(lv_obj_t *obj, int32_t pad, lv_style_selector_t sel);
void lv_obj_set_style_pad_right(lv_obj_t *obj, int32_t pad, lv_style_selector_t sel);
void lv_obj_set_style_pad_gap(lv_obj_t *obj, int32_t pad, lv_style_selector_t sel);
void lv_obj_set_style_shadow_color(lv_obj_t *obj, lv_color_t color, lv_style_selector_t sel);
void lv_obj_set_style_shadow_width(lv_obj_t *obj, int32_t width, lv_style_selector_t sel);
void lv_obj_set_style_outline_color(lv_obj_t *obj, lv_color_t color, lv_style_selector_t sel);

/* ── Flags & state ───────────────────────────────────────────────────────── */
void lv_obj_add_flag(lv_obj_t *obj, uint32_t flag);
void lv_obj_remove_flag(lv_obj_t *obj, uint32_t flag);
void lv_obj_add_state(lv_obj_t *obj, uint32_t state);
void lv_obj_remove_state(lv_obj_t *obj, uint32_t state);

/* ── Flex layout ─────────────────────────────────────────────────────────── */
void lv_obj_set_flex_flow(lv_obj_t *obj, int32_t flow);
void lv_obj_set_flex_align(lv_obj_t *obj, int32_t main_place, int32_t cross_place, int32_t track_cross_place);
void lv_obj_set_flex_grow(lv_obj_t *obj, uint8_t grow);

/* ── Label ───────────────────────────────────────────────────────────────── */
lv_obj_t *lv_label_create(lv_obj_t *parent);
void      lv_label_set_text(lv_obj_t *label, const char *text);
void      lv_label_set_long_mode(lv_obj_t *label, int32_t mode);

/* ── Button ──────────────────────────────────────────────────────────────── */
lv_obj_t *lv_button_create(lv_obj_t *parent);
lv_obj_t *lv_btn_create(lv_obj_t *parent);   /* alias for lv_button_create */

/* ── Slider ──────────────────────────────────────────────────────────────── */
lv_obj_t *lv_slider_create(lv_obj_t *parent);
void      lv_slider_set_value(lv_obj_t *slider, int32_t value, int32_t anim);
void      lv_slider_set_range(lv_obj_t *slider, int32_t min, int32_t max);
int32_t   lv_slider_get_value(lv_obj_t *slider);

/* ── Switch ──────────────────────────────────────────────────────────────── */
lv_obj_t *lv_switch_create(lv_obj_t *parent);

/* ── Checkbox ────────────────────────────────────────────────────────────── */
lv_obj_t *lv_checkbox_create(lv_obj_t *parent);
void      lv_checkbox_set_text(lv_obj_t *cb, const char *text);

/* ── Arc ─────────────────────────────────────────────────────────────────── */
lv_obj_t *lv_arc_create(lv_obj_t *parent);
void      lv_arc_set_value(lv_obj_t *arc, int32_t value);
void      lv_arc_set_range(lv_obj_t *arc, int32_t min, int32_t max);
void      lv_arc_set_bg_angles(lv_obj_t *arc, uint16_t start, uint16_t end);
void      lv_arc_set_angles(lv_obj_t *arc, uint16_t start, uint16_t end);

/* ── Bar ─────────────────────────────────────────────────────────────────── */
lv_obj_t *lv_bar_create(lv_obj_t *parent);
void      lv_bar_set_value(lv_obj_t *bar, int32_t value, int32_t anim);
void      lv_bar_set_range(lv_obj_t *bar, int32_t min, int32_t max);

/* ── Spinner ─────────────────────────────────────────────────────────────── */
lv_obj_t *lv_spinner_create(lv_obj_t *parent);

/* ── Dropdown ────────────────────────────────────────────────────────────── */
lv_obj_t *lv_dropdown_create(lv_obj_t *parent);
void      lv_dropdown_set_options(lv_obj_t *dropdown, const char *options);

#endif /* LVGL_H */
