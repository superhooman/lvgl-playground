/**
 * Synthetic lvgl.h provided to clang during in-browser compilation.
 *
 * Design constraints:
 *  - No system headers (compiled with -nostdlib / bare wasm32 target)
 *  - lv_color_t is uint32_t (packed 0xRRGGBB) — matches our helper_set_*_color exports
 *  - Font globals become macros that call imported get_font_montserrat_N() functions
 *    so that `&lv_font_montserrat_24` compiles cleanly without data-segment issues
 *  - All extern function names match the keys in buildUserWasmImports()
 */
export const LVGL_STUB_H = /* c */ `
#pragma once

/* ── Integer types (no <stdint.h> since we use -nostdlib) ─────────────────── */
typedef unsigned char       uint8_t;
typedef unsigned short      uint16_t;
typedef unsigned int        uint32_t;
typedef signed char         int8_t;
typedef signed short        int16_t;
typedef signed int          int32_t;
typedef unsigned long long  uint64_t;
#ifndef NULL
#define NULL ((void*)0)
#endif

/* ── Core LVGL types ─────────────────────────────────────────────────────── */
typedef struct _lv_obj   lv_obj_t;
typedef uint32_t         lv_color_t;        /* packed 0xRRGGBB — not the real BGR struct */
typedef struct _lv_font  lv_font_t;
typedef uint32_t         lv_style_selector_t;
typedef int32_t          lv_coord_t;
typedef int32_t          lv_anim_enable_t;

/* ── Color helpers (inline — no WASM import needed) ──────────────────────── */
static inline lv_color_t lv_color_hex(uint32_t c) { return c & 0xFFFFFFU; }
static inline lv_color_t lv_color_make(uint8_t r, uint8_t g, uint8_t b) {
    return ((uint32_t)r << 16) | ((uint32_t)g << 8) | (uint32_t)b;
}
static inline lv_color_t lv_color_white(void) { return 0xFFFFFFU; }
static inline lv_color_t lv_color_black(void) { return 0x000000U; }

/* ── Size helpers ────────────────────────────────────────────────────────── */
#define LV_SIZE_CONTENT  ((int32_t)0x1FFFFFFF)
static inline int32_t LV_PCT(int32_t x) { return x | (int32_t)0x20000000; }

/* ── Part selectors ──────────────────────────────────────────────────────── */
#define LV_PART_MAIN        0x000000U
#define LV_PART_SCROLLBAR   0x010000U
#define LV_PART_INDICATOR   0x020000U
#define LV_PART_KNOB        0x030000U
#define LV_PART_SELECTED    0x040000U
#define LV_PART_ITEMS       0x050000U
#define LV_PART_CURSOR      0x060000U

/* ── State ───────────────────────────────────────────────────────────────── */
#define LV_STATE_DEFAULT    0x0000U
#define LV_STATE_CHECKED    0x0001U
#define LV_STATE_FOCUSED    0x0002U
#define LV_STATE_PRESSED    0x0020U
#define LV_STATE_DISABLED   0x0080U

/* ── Alignment ───────────────────────────────────────────────────────────── */
#define LV_ALIGN_DEFAULT          0
#define LV_ALIGN_TOP_LEFT         1
#define LV_ALIGN_TOP_MID          2
#define LV_ALIGN_TOP_RIGHT        3
#define LV_ALIGN_BOTTOM_LEFT      4
#define LV_ALIGN_BOTTOM_MID       5
#define LV_ALIGN_BOTTOM_RIGHT     6
#define LV_ALIGN_LEFT_MID         7
#define LV_ALIGN_RIGHT_MID        8
#define LV_ALIGN_CENTER           9
#define LV_ALIGN_OUT_TOP_LEFT     10
#define LV_ALIGN_OUT_TOP_MID      11
#define LV_ALIGN_OUT_TOP_RIGHT    12
#define LV_ALIGN_OUT_BOTTOM_LEFT  13
#define LV_ALIGN_OUT_BOTTOM_MID   14
#define LV_ALIGN_OUT_BOTTOM_RIGHT 15

/* ── Flex ────────────────────────────────────────────────────────────────── */
#define LV_FLEX_FLOW_ROW              1
#define LV_FLEX_FLOW_COLUMN           2
#define LV_FLEX_FLOW_ROW_WRAP         5
#define LV_FLEX_FLOW_ROW_REVERSE      9
#define LV_FLEX_FLOW_COLUMN_WRAP      6
#define LV_FLEX_FLOW_COLUMN_REVERSE   10
#define LV_FLEX_ALIGN_START           0
#define LV_FLEX_ALIGN_END             1
#define LV_FLEX_ALIGN_CENTER          2
#define LV_FLEX_ALIGN_SPACE_EVENLY    3
#define LV_FLEX_ALIGN_SPACE_AROUND    4
#define LV_FLEX_ALIGN_SPACE_BETWEEN   5

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

/* ── Object flags ────────────────────────────────────────────────────────── */
#define LV_OBJ_FLAG_HIDDEN       0x0001U
#define LV_OBJ_FLAG_CLICKABLE    0x0002U
#define LV_OBJ_FLAG_SCROLLABLE   0x0200U

/* ── Text ────────────────────────────────────────────────────────────────── */
#define LV_TEXT_ALIGN_AUTO    0
#define LV_TEXT_ALIGN_LEFT    1
#define LV_TEXT_ALIGN_CENTER  2
#define LV_TEXT_ALIGN_RIGHT   3

#define LV_LABEL_LONG_WRAP    0
#define LV_LABEL_LONG_DOT     1
#define LV_LABEL_LONG_SCROLL  2
#define LV_LABEL_LONG_CLIP    3

#define LV_TEXT_DECOR_NONE            0x00
#define LV_TEXT_DECOR_UNDERLINE       0x01
#define LV_TEXT_DECOR_STRIKETHROUGH   0x02

/* ── Gradient ────────────────────────────────────────────────────────────── */
#define LV_GRAD_DIR_NONE  0
#define LV_GRAD_DIR_VER   1
#define LV_GRAD_DIR_HOR   2

/* ── Arc ─────────────────────────────────────────────────────────────────── */
#define LV_ARC_MODE_NORMAL        0
#define LV_ARC_MODE_SYMMETRICAL   1
#define LV_ARC_MODE_REVERSE       2

/* ── Border ──────────────────────────────────────────────────────────────── */
#define LV_BORDER_SIDE_NONE      0x00
#define LV_BORDER_SIDE_BOTTOM    0x01
#define LV_BORDER_SIDE_TOP       0x02
#define LV_BORDER_SIDE_LEFT      0x04
#define LV_BORDER_SIDE_RIGHT     0x08
#define LV_BORDER_SIDE_FULL      0x0F
#define LV_BORDER_SIDE_INTERNAL  0x10

/* ── Direction ───────────────────────────────────────────────────────────── */
#define LV_DIR_NONE    0x00
#define LV_DIR_LEFT    0x01
#define LV_DIR_RIGHT   0x02
#define LV_DIR_TOP     0x04
#define LV_DIR_BOTTOM  0x08
#define LV_DIR_HOR     0x03
#define LV_DIR_VER     0x0C
#define LV_DIR_ALL     0x0F

/* ── Fonts ───────────────────────────────────────────────────────────────── */
/* Declared as imported functions; macros turn &lv_font_X into get_font_X()  */
extern const lv_font_t *get_font_montserrat_8(void);
extern const lv_font_t *get_font_montserrat_10(void);
extern const lv_font_t *get_font_montserrat_12(void);
extern const lv_font_t *get_font_montserrat_14(void);
extern const lv_font_t *get_font_montserrat_16(void);
extern const lv_font_t *get_font_montserrat_18(void);
extern const lv_font_t *get_font_montserrat_20(void);
extern const lv_font_t *get_font_montserrat_22(void);
extern const lv_font_t *get_font_montserrat_24(void);
extern const lv_font_t *get_font_montserrat_28(void);
extern const lv_font_t *get_font_montserrat_32(void);

/* &lv_font_montserrat_N  →  get_font_montserrat_N() */
#define lv_font_montserrat_8   (*get_font_montserrat_8())
#define lv_font_montserrat_10  (*get_font_montserrat_10())
#define lv_font_montserrat_12  (*get_font_montserrat_12())
#define lv_font_montserrat_14  (*get_font_montserrat_14())
#define lv_font_montserrat_16  (*get_font_montserrat_16())
#define lv_font_montserrat_18  (*get_font_montserrat_18())
#define lv_font_montserrat_20  (*get_font_montserrat_20())
#define lv_font_montserrat_22  (*get_font_montserrat_22())
#define lv_font_montserrat_24  (*get_font_montserrat_24())
#define lv_font_montserrat_28  (*get_font_montserrat_28())
#define lv_font_montserrat_32  (*get_font_montserrat_32())

/* ── Screen ──────────────────────────────────────────────────────────────── */
extern lv_obj_t *lv_scr_act(void);
extern lv_obj_t *lv_layer_top(void);
extern lv_obj_t *lv_layer_sys(void);

/* ── Object lifecycle ────────────────────────────────────────────────────── */
extern lv_obj_t *lv_obj_create(lv_obj_t *parent);
extern void      lv_obj_del(lv_obj_t *obj);
extern void      lv_obj_clean(lv_obj_t *obj);

/* ── Position / size ─────────────────────────────────────────────────────── */
extern void lv_obj_set_pos(lv_obj_t *obj, int32_t x, int32_t y);
extern void lv_obj_set_size(lv_obj_t *obj, int32_t w, int32_t h);
extern void lv_obj_set_width(lv_obj_t *obj, int32_t w);
extern void lv_obj_set_height(lv_obj_t *obj, int32_t h);
extern void lv_obj_center(lv_obj_t *obj);
extern void lv_obj_align(lv_obj_t *obj, int align, int32_t x_ofs, int32_t y_ofs);
extern void lv_obj_align_to(lv_obj_t *obj, lv_obj_t *base, int align,
                             int32_t x_ofs, int32_t y_ofs);

/* ── Style — colors (uint32_t packed RGB, routed to helper_set_*) ─────────── */
extern void lv_obj_set_style_bg_color(lv_obj_t *obj, lv_color_t c, lv_style_selector_t s);
extern void lv_obj_set_style_text_color(lv_obj_t *obj, lv_color_t c, lv_style_selector_t s);
extern void lv_obj_set_style_border_color(lv_obj_t *obj, lv_color_t c, lv_style_selector_t s);
extern void lv_obj_set_style_shadow_color(lv_obj_t *obj, lv_color_t c, lv_style_selector_t s);
extern void lv_obj_set_style_outline_color(lv_obj_t *obj, lv_color_t c, lv_style_selector_t s);
extern void lv_obj_set_style_arc_color(lv_obj_t *obj, lv_color_t c, lv_style_selector_t s);
extern void lv_obj_set_style_line_color(lv_obj_t *obj, lv_color_t c, lv_style_selector_t s);
extern void lv_obj_set_style_bg_grad_color(lv_obj_t *obj, lv_color_t c, lv_style_selector_t s);
extern void lv_obj_set_style_img_recolor(lv_obj_t *obj, lv_color_t c, lv_style_selector_t s);

/* ── Style — opacity / alpha ────────────────────────────────────────────── */
extern void lv_obj_set_style_opa(lv_obj_t *obj, uint8_t opa, lv_style_selector_t s);
extern void lv_obj_set_style_bg_opa(lv_obj_t *obj, uint8_t opa, lv_style_selector_t s);
extern void lv_obj_set_style_bg_grad_dir(lv_obj_t *obj, int dir, lv_style_selector_t s);
extern void lv_obj_set_style_bg_main_stop(lv_obj_t *obj, uint8_t v, lv_style_selector_t s);
extern void lv_obj_set_style_bg_grad_stop(lv_obj_t *obj, uint8_t v, lv_style_selector_t s);

/* ── Style — border / radius / padding / shadow / outline ──────────────── */
extern void lv_obj_set_style_border_width(lv_obj_t *obj, int32_t w, lv_style_selector_t s);
extern void lv_obj_set_style_border_opa(lv_obj_t *obj, uint8_t opa, lv_style_selector_t s);
extern void lv_obj_set_style_radius(lv_obj_t *obj, int32_t r, lv_style_selector_t s);

extern void lv_obj_set_style_pad_all(lv_obj_t *obj, int32_t pad, lv_style_selector_t s);
extern void lv_obj_set_style_pad_top(lv_obj_t *obj, int32_t pad, lv_style_selector_t s);
extern void lv_obj_set_style_pad_bottom(lv_obj_t *obj, int32_t pad, lv_style_selector_t s);
extern void lv_obj_set_style_pad_left(lv_obj_t *obj, int32_t pad, lv_style_selector_t s);
extern void lv_obj_set_style_pad_right(lv_obj_t *obj, int32_t pad, lv_style_selector_t s);
extern void lv_obj_set_style_pad_gap(lv_obj_t *obj, int32_t pad, lv_style_selector_t s);

extern void lv_obj_set_style_shadow_width(lv_obj_t *obj, int32_t w, lv_style_selector_t s);
extern void lv_obj_set_style_shadow_opa(lv_obj_t *obj, uint8_t opa, lv_style_selector_t s);
extern void lv_obj_set_style_shadow_spread(lv_obj_t *obj, int32_t v, lv_style_selector_t s);
extern void lv_obj_set_style_shadow_offset_x(lv_obj_t *obj, int32_t v, lv_style_selector_t s);
extern void lv_obj_set_style_shadow_offset_y(lv_obj_t *obj, int32_t v, lv_style_selector_t s);

extern void lv_obj_set_style_outline_width(lv_obj_t *obj, int32_t w, lv_style_selector_t s);
extern void lv_obj_set_style_outline_opa(lv_obj_t *obj, uint8_t opa, lv_style_selector_t s);
extern void lv_obj_set_style_outline_pad(lv_obj_t *obj, int32_t pad, lv_style_selector_t s);

/* ── Style — arc / line ──────────────────────────────────────────────────── */
extern void lv_obj_set_style_arc_width(lv_obj_t *obj, int32_t w, lv_style_selector_t s);
extern void lv_obj_set_style_arc_opa(lv_obj_t *obj, uint8_t opa, lv_style_selector_t s);
extern void lv_obj_set_style_arc_rounded(lv_obj_t *obj, int rounded, lv_style_selector_t s);

extern void lv_obj_set_style_line_width(lv_obj_t *obj, int32_t w, lv_style_selector_t s);
extern void lv_obj_set_style_line_opa(lv_obj_t *obj, uint8_t opa, lv_style_selector_t s);
extern void lv_obj_set_style_line_rounded(lv_obj_t *obj, int rounded, lv_style_selector_t s);
extern void lv_obj_set_style_line_dash_width(lv_obj_t *obj, int32_t w, lv_style_selector_t s);
extern void lv_obj_set_style_line_dash_gap(lv_obj_t *obj, int32_t g, lv_style_selector_t s);

/* ── Style — image ───────────────────────────────────────────────────────── */
extern void lv_obj_set_style_img_opa(lv_obj_t *obj, uint8_t opa, lv_style_selector_t s);
extern void lv_obj_set_style_img_recolor_opa(lv_obj_t *obj, uint8_t opa, lv_style_selector_t s);

/* ── Style — text ────────────────────────────────────────────────────────── */
extern void lv_obj_set_style_text_font(lv_obj_t *obj, const lv_font_t *font,
                                       lv_style_selector_t s);
extern void lv_obj_set_style_text_align(lv_obj_t *obj, int align, lv_style_selector_t s);
extern void lv_obj_set_style_text_letter_space(lv_obj_t *obj, int32_t sp, lv_style_selector_t s);
extern void lv_obj_set_style_text_line_space(lv_obj_t *obj, int32_t sp, lv_style_selector_t s);
extern void lv_obj_set_style_text_opa(lv_obj_t *obj, uint8_t opa, lv_style_selector_t s);
extern void lv_obj_set_style_text_decor(lv_obj_t *obj, int decor, lv_style_selector_t s);

/* ── Style — transform / translate ──────────────────────────────────────── */
extern void lv_obj_set_style_translate_x(lv_obj_t *obj, int32_t v, lv_style_selector_t s);
extern void lv_obj_set_style_translate_y(lv_obj_t *obj, int32_t v, lv_style_selector_t s);
extern void lv_obj_set_style_transform_rotation(lv_obj_t *obj, int32_t v, lv_style_selector_t s);
extern void lv_obj_set_style_transform_scale_x(lv_obj_t *obj, int32_t v, lv_style_selector_t s);
extern void lv_obj_set_style_transform_scale_y(lv_obj_t *obj, int32_t v, lv_style_selector_t s);

/* ── Style — size constraints ────────────────────────────────────────────── */
extern void lv_obj_set_style_min_width(lv_obj_t *obj, int32_t w, lv_style_selector_t s);
extern void lv_obj_set_style_max_width(lv_obj_t *obj, int32_t w, lv_style_selector_t s);
extern void lv_obj_set_style_min_height(lv_obj_t *obj, int32_t h, lv_style_selector_t s);
extern void lv_obj_set_style_max_height(lv_obj_t *obj, int32_t h, lv_style_selector_t s);

/* ── Flags / state ───────────────────────────────────────────────────────── */
extern void lv_obj_add_flag(lv_obj_t *obj, uint32_t flag);
extern void lv_obj_clear_flag(lv_obj_t *obj, uint32_t flag);
extern void lv_obj_add_state(lv_obj_t *obj, uint32_t state);
extern void lv_obj_clear_state(lv_obj_t *obj, uint32_t state);

/* ── Flex layout ─────────────────────────────────────────────────────────── */
extern void lv_obj_set_flex_flow(lv_obj_t *obj, int flow);
extern void lv_obj_set_flex_align(lv_obj_t *obj, int main_place, int cross_place,
                                  int track_cross_place);
extern void lv_obj_set_flex_grow(lv_obj_t *obj, uint8_t grow);

/* ── Object getters ──────────────────────────────────────────────────────── */
extern int32_t   lv_obj_get_width(lv_obj_t *obj);
extern int32_t   lv_obj_get_height(lv_obj_t *obj);
extern int32_t   lv_obj_get_x(lv_obj_t *obj);
extern int32_t   lv_obj_get_y(lv_obj_t *obj);
extern int32_t   lv_obj_get_child_count(lv_obj_t *obj);
extern lv_obj_t *lv_obj_get_child(lv_obj_t *obj, int32_t id);

/* ── Label ───────────────────────────────────────────────────────────────── */
extern lv_obj_t *lv_label_create(lv_obj_t *parent);
extern void      lv_label_set_text(lv_obj_t *obj, const char *text);
extern void      lv_label_set_long_mode(lv_obj_t *obj, int mode);

/* ── Button ──────────────────────────────────────────────────────────────── */
extern lv_obj_t *lv_btn_create(lv_obj_t *parent);

/* ── Slider ──────────────────────────────────────────────────────────────── */
extern lv_obj_t *lv_slider_create(lv_obj_t *parent);
extern void      lv_slider_set_value(lv_obj_t *obj, int32_t value, lv_anim_enable_t anim);
extern void      lv_slider_set_range(lv_obj_t *obj, int32_t min, int32_t max);
extern int32_t   lv_slider_get_value(lv_obj_t *obj);

/* ── Switch ──────────────────────────────────────────────────────────────── */
extern lv_obj_t *lv_switch_create(lv_obj_t *parent);

/* ── Checkbox ────────────────────────────────────────────────────────────── */
extern lv_obj_t *lv_checkbox_create(lv_obj_t *parent);
extern void      lv_checkbox_set_text(lv_obj_t *obj, const char *text);

/* ── Arc ─────────────────────────────────────────────────────────────────── */
extern lv_obj_t *lv_arc_create(lv_obj_t *parent);
extern void      lv_arc_set_value(lv_obj_t *obj, int32_t value);
extern void      lv_arc_set_range(lv_obj_t *obj, int32_t min, int32_t max);
extern void      lv_arc_set_bg_angles(lv_obj_t *obj, uint16_t start, uint16_t end);
extern void      lv_arc_set_angles(lv_obj_t *obj, uint16_t start, uint16_t end);
extern void      lv_arc_set_mode(lv_obj_t *obj, int mode);

/* ── Bar ─────────────────────────────────────────────────────────────────── */
extern lv_obj_t *lv_bar_create(lv_obj_t *parent);
extern void      lv_bar_set_value(lv_obj_t *obj, int32_t value, lv_anim_enable_t anim);
extern void      lv_bar_set_range(lv_obj_t *obj, int32_t min, int32_t max);

/* ── Spinner ─────────────────────────────────────────────────────────────── */
extern lv_obj_t *lv_spinner_create(lv_obj_t *parent);

/* ── Dropdown ────────────────────────────────────────────────────────────── */
extern lv_obj_t *lv_dropdown_create(lv_obj_t *parent);
extern void      lv_dropdown_set_options(lv_obj_t *obj, const char *options);
extern int32_t   lv_dropdown_get_selected(lv_obj_t *obj);
`;
