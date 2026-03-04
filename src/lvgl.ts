/**
 * LVGL WASM loader + JavaScript API bindings.
 *
 * The Emscripten-generated lvgl_playground.js is loaded from /public.
 * It uses MODULARIZE=1 so `createLvglModule` is placed on `window`.
 *
 * After `initLvgl(canvas)` resolves you can call `runUserApp(jsCode)` to
 * execute transformed C code against the live LVGL instance.
 */

// ── Emscripten module interface ─────────────────────────────────────────────
export interface EmscriptenModule {
  ccall(
    name: string,
    returnType: "number" | "string" | null,
    argTypes: Array<"number" | "string" | "boolean">,
    args: unknown[]
  ): unknown;
  canvas: HTMLCanvasElement;
  onRuntimeInitialized?: () => void;
  print?: (s: string) => void;
  printErr?: (s: string) => void;
}

declare global {
  interface Window {
    createLvglModule?: (opts: Partial<EmscriptenModule>) => Promise<EmscriptenModule>;
  }
}

// ── Singleton module ─────────────────────────────────────────────────────────
let _mod: EmscriptenModule | null = null;

export async function initLvgl(canvas: HTMLCanvasElement): Promise<EmscriptenModule> {
  if (_mod) return _mod;

  // Load the Emscripten JS (puts createLvglModule on window)
  await loadScript("/lvgl_playground.js");

  if (!window.createLvglModule) {
    throw new Error(
      "createLvglModule not found"
    );
  }

  _mod = await window.createLvglModule({
    canvas,
    print:    (s) => console.log("[lvgl]", s),
    printErr: (s) => console.warn("[lvgl]", s),
  });

  return _mod;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = Object.assign(document.createElement("script"), {
      src,
      onload:  () => resolve(),
      onerror: () => reject(new Error(`Failed to load ${src}`)),
    });
    document.head.appendChild(s);
  });
}

// ── Build the API context injected into user code ───────────────────────────
export function buildLvglAPI(mod: EmscriptenModule): Record<string, unknown> {
  // Shortcuts
  const N = "number" as const;
  const S = "string" as const;

  /** call a WASM function that returns a pointer / integer */
  const p = (fn: string, ...args: number[]) =>
    mod.ccall(fn, N, args.map(() => N) as "number"[], args) as number;

  /** call a WASM function that returns void */
  const v = (fn: string, types: Array<"number"|"string">, args: unknown[]) =>
    mod.ccall(fn, null, types, args);

  // Font pointer getter helper (defined in wasm/helpers.c)
  const font = (name: string) => () => p(`get_font_${name}`);

  return {
    // ── Screen (v9 renamed: lv_scr_act→lv_screen_active, layers need disp) ─
    lv_scr_act:   () => p("helper_scr_act"),
    lv_layer_top: () => p("helper_layer_top"),
    lv_layer_sys: () => p("helper_layer_sys"),

    // ── Object lifecycle ─────────────────────────────────────────────────
    lv_obj_create:   (parent: number) => p("lv_obj_create", parent),
    lv_obj_del:      (obj: number)    => v("lv_obj_delete",      [N], [obj]),  // v9 rename
    lv_obj_clean:    (obj: number)    => v("lv_obj_clean",       [N], [obj]),

    // ── Position / size ───────────────────────────────────────────────────
    lv_obj_set_pos:    (o: number, x: number, y: number)    => v("lv_obj_set_pos",    [N,N,N], [o,x,y]),
    lv_obj_set_size:   (o: number, w: number, h: number)    => v("lv_obj_set_size",   [N,N,N], [o,w,h]),
    lv_obj_set_width:  (o: number, w: number)               => v("lv_obj_set_width",  [N,N],   [o,w]),
    lv_obj_set_height: (o: number, h: number)               => v("lv_obj_set_height", [N,N],   [o,h]),
    lv_obj_center:     (o: number)                          => v("lv_obj_center",     [N],     [o]),
    lv_obj_align: (o: number, align: number, xOfs: number, yOfs: number) =>
      v("lv_obj_align", [N,N,N,N], [o, align, xOfs, yOfs]),
    lv_obj_align_to: (o: number, base: number, align: number, xOfs: number, yOfs: number) =>
      v("lv_obj_align_to", [N,N,N,N,N], [o, base, align, xOfs, yOfs]),

    // ── Style setters (helpers use uint32_t for colors to avoid ABI issues) ─
    lv_obj_set_style_bg_color:      (o: number, c: number, sel: number) => v("helper_set_bg_color",      [N,N,N], [o,c,sel]),
    lv_obj_set_style_text_color:    (o: number, c: number, sel: number) => v("helper_set_text_color",    [N,N,N], [o,c,sel]),
    lv_obj_set_style_border_color:  (o: number, c: number, sel: number) => v("helper_set_border_color",  [N,N,N], [o,c,sel]),
    lv_obj_set_style_shadow_color:  (o: number, c: number, sel: number) => v("helper_set_shadow_color",  [N,N,N], [o,c,sel]),
    lv_obj_set_style_outline_color: (o: number, c: number, sel: number) => v("helper_set_outline_color", [N,N,N], [o,c,sel]),
    lv_obj_set_style_arc_color:     (o: number, c: number, sel: number) => v("helper_set_arc_color",     [N,N,N], [o,c,sel]),
    lv_obj_set_style_line_color:    (o: number, c: number, sel: number) => v("helper_set_line_color",    [N,N,N], [o,c,sel]),
    lv_obj_set_style_bg_grad_color: (o: number, c: number, sel: number) => v("helper_set_bg_grad_color", [N,N,N], [o,c,sel]),
    lv_obj_set_style_img_recolor:   (o: number, c: number, sel: number) => v("helper_set_img_recolor",   [N,N,N], [o,c,sel]),

    // ── General opacity ───────────────────────────────────────────────────
    lv_obj_set_style_opa:          (o: number, opa: number, sel: number) => v("lv_obj_set_style_opa",          [N,N,N], [o,opa,sel]),

    // ── Background ────────────────────────────────────────────────────────
    lv_obj_set_style_bg_opa:       (o: number, opa: number, sel: number) => v("lv_obj_set_style_bg_opa",       [N,N,N], [o,opa,sel]),
    lv_obj_set_style_bg_grad_dir:  (o: number, dir: number, sel: number) => v("lv_obj_set_style_bg_grad_dir",  [N,N,N], [o,dir,sel]),
    lv_obj_set_style_bg_main_stop: (o: number, v2: number, sel: number)  => v("lv_obj_set_style_bg_main_stop", [N,N,N], [o,v2,sel]),
    lv_obj_set_style_bg_grad_stop: (o: number, v2: number, sel: number)  => v("lv_obj_set_style_bg_grad_stop", [N,N,N], [o,v2,sel]),

    // ── Border ────────────────────────────────────────────────────────────
    lv_obj_set_style_border_width: (o: number, w: number, sel: number)   => v("lv_obj_set_style_border_width", [N,N,N], [o,w,sel]),
    lv_obj_set_style_border_opa:   (o: number, opa: number, sel: number) => v("lv_obj_set_style_border_opa",   [N,N,N], [o,opa,sel]),
    lv_obj_set_style_radius:       (o: number, r: number, sel: number)   => v("lv_obj_set_style_radius",       [N,N,N], [o,r,sel]),

    // ── Padding ───────────────────────────────────────────────────────────
    lv_obj_set_style_pad_all:    (o: number, pad: number, sel: number) => v("helper_set_pad_all",          [N,N,N], [o,pad,sel]), // static inline
    lv_obj_set_style_pad_top:    (o: number, pad: number, sel: number) => v("lv_obj_set_style_pad_top",    [N,N,N], [o,pad,sel]),
    lv_obj_set_style_pad_bottom: (o: number, pad: number, sel: number) => v("lv_obj_set_style_pad_bottom", [N,N,N], [o,pad,sel]),
    lv_obj_set_style_pad_left:   (o: number, pad: number, sel: number) => v("lv_obj_set_style_pad_left",   [N,N,N], [o,pad,sel]),
    lv_obj_set_style_pad_right:  (o: number, pad: number, sel: number) => v("lv_obj_set_style_pad_right",  [N,N,N], [o,pad,sel]),
    lv_obj_set_style_pad_gap:    (o: number, pad: number, sel: number) => v("helper_set_pad_gap",          [N,N,N], [o,pad,sel]), // static inline

    // ── Shadow ────────────────────────────────────────────────────────────
    lv_obj_set_style_shadow_width:    (o: number, w: number, sel: number)   => v("lv_obj_set_style_shadow_width",    [N,N,N], [o,w,sel]),
    lv_obj_set_style_shadow_opa:      (o: number, opa: number, sel: number) => v("lv_obj_set_style_shadow_opa",      [N,N,N], [o,opa,sel]),
    lv_obj_set_style_shadow_spread:   (o: number, v2: number, sel: number)  => v("lv_obj_set_style_shadow_spread",   [N,N,N], [o,v2,sel]),
    lv_obj_set_style_shadow_offset_x: (o: number, v2: number, sel: number)  => v("lv_obj_set_style_shadow_offset_x", [N,N,N], [o,v2,sel]),
    lv_obj_set_style_shadow_offset_y: (o: number, v2: number, sel: number)  => v("lv_obj_set_style_shadow_offset_y", [N,N,N], [o,v2,sel]),

    // ── Outline ───────────────────────────────────────────────────────────
    lv_obj_set_style_outline_width: (o: number, w: number, sel: number)   => v("lv_obj_set_style_outline_width", [N,N,N], [o,w,sel]),
    lv_obj_set_style_outline_opa:   (o: number, opa: number, sel: number) => v("lv_obj_set_style_outline_opa",   [N,N,N], [o,opa,sel]),
    lv_obj_set_style_outline_pad:   (o: number, pad: number, sel: number) => v("lv_obj_set_style_outline_pad",   [N,N,N], [o,pad,sel]),

    // ── Arc style ─────────────────────────────────────────────────────────
    lv_obj_set_style_arc_width:   (o: number, w: number, sel: number)       => v("lv_obj_set_style_arc_width",   [N,N,N], [o,w,sel]),
    lv_obj_set_style_arc_opa:     (o: number, opa: number, sel: number)     => v("lv_obj_set_style_arc_opa",     [N,N,N], [o,opa,sel]),
    lv_obj_set_style_arc_rounded: (o: number, rounded: number, sel: number) => v("lv_obj_set_style_arc_rounded", [N,N,N], [o,rounded,sel]),

    // ── Line style ────────────────────────────────────────────────────────
    lv_obj_set_style_line_width:     (o: number, w: number, sel: number)       => v("lv_obj_set_style_line_width",     [N,N,N], [o,w,sel]),
    lv_obj_set_style_line_opa:       (o: number, opa: number, sel: number)     => v("lv_obj_set_style_line_opa",       [N,N,N], [o,opa,sel]),
    lv_obj_set_style_line_rounded:   (o: number, rounded: number, sel: number) => v("lv_obj_set_style_line_rounded",   [N,N,N], [o,rounded,sel]),
    lv_obj_set_style_line_dash_width:(o: number, w: number, sel: number)       => v("lv_obj_set_style_line_dash_width",[N,N,N], [o,w,sel]),
    lv_obj_set_style_line_dash_gap:  (o: number, g: number, sel: number)       => v("lv_obj_set_style_line_dash_gap",  [N,N,N], [o,g,sel]),

    // ── Image style ───────────────────────────────────────────────────────
    lv_obj_set_style_img_opa:        (o: number, opa: number, sel: number) => v("lv_obj_set_style_img_opa",        [N,N,N], [o,opa,sel]),
    lv_obj_set_style_img_recolor_opa:(o: number, opa: number, sel: number) => v("lv_obj_set_style_img_recolor_opa",[N,N,N], [o,opa,sel]),

    // ── Text style ────────────────────────────────────────────────────────
    lv_obj_set_style_text_font:         (o: number, font: number, sel: number)  => v("lv_obj_set_style_text_font",         [N,N,N], [o,font,sel]),
    lv_obj_set_style_text_align:        (o: number, align: number, sel: number) => v("lv_obj_set_style_text_align",        [N,N,N], [o,align,sel]),
    lv_obj_set_style_text_letter_space: (o: number, sp: number, sel: number)    => v("lv_obj_set_style_text_letter_space", [N,N,N], [o,sp,sel]),
    lv_obj_set_style_text_line_space:   (o: number, sp: number, sel: number)    => v("lv_obj_set_style_text_line_space",   [N,N,N], [o,sp,sel]),
    lv_obj_set_style_text_opa:          (o: number, opa: number, sel: number)   => v("lv_obj_set_style_text_opa",          [N,N,N], [o,opa,sel]),
    lv_obj_set_style_text_decor:        (o: number, decor: number, sel: number) => v("lv_obj_set_style_text_decor",        [N,N,N], [o,decor,sel]),

    // ── Transform / translate ─────────────────────────────────────────────
    lv_obj_set_style_translate_x:        (o: number, v2: number, sel: number) => v("lv_obj_set_style_translate_x",        [N,N,N], [o,v2,sel]),
    lv_obj_set_style_translate_y:        (o: number, v2: number, sel: number) => v("lv_obj_set_style_translate_y",        [N,N,N], [o,v2,sel]),
    lv_obj_set_style_transform_rotation: (o: number, v2: number, sel: number) => v("lv_obj_set_style_transform_rotation", [N,N,N], [o,v2,sel]),
    lv_obj_set_style_transform_scale_x:  (o: number, v2: number, sel: number) => v("lv_obj_set_style_transform_scale_x",  [N,N,N], [o,v2,sel]),
    lv_obj_set_style_transform_scale_y:  (o: number, v2: number, sel: number) => v("lv_obj_set_style_transform_scale_y",  [N,N,N], [o,v2,sel]),

    // ── Size constraints ──────────────────────────────────────────────────
    lv_obj_set_style_min_width:  (o: number, w: number, sel: number) => v("lv_obj_set_style_min_width",  [N,N,N], [o,w,sel]),
    lv_obj_set_style_max_width:  (o: number, w: number, sel: number) => v("lv_obj_set_style_max_width",  [N,N,N], [o,w,sel]),
    lv_obj_set_style_min_height: (o: number, h: number, sel: number) => v("lv_obj_set_style_min_height", [N,N,N], [o,h,sel]),
    lv_obj_set_style_max_height: (o: number, h: number, sel: number) => v("lv_obj_set_style_max_height", [N,N,N], [o,h,sel]),

    // ── Flags / state (v9 renamed clear→remove) ───────────────────────────
    lv_obj_add_flag:    (o: number, flag: number)  => v("lv_obj_add_flag",      [N,N], [o,flag]),
    lv_obj_clear_flag:  (o: number, flag: number)  => v("lv_obj_remove_flag",   [N,N], [o,flag]),
    lv_obj_add_state:   (o: number, state: number) => v("lv_obj_add_state",     [N,N], [o,state]),
    lv_obj_clear_state: (o: number, state: number) => v("lv_obj_remove_state",  [N,N], [o,state]),

    // ── Flex layout ───────────────────────────────────────────────────────
    lv_obj_set_flex_flow:  (o: number, flow: number) => v("lv_obj_set_flex_flow", [N,N], [o,flow]),
    lv_obj_set_flex_align: (o: number, main: number, cross: number, track: number) =>
      v("lv_obj_set_flex_align", [N,N,N,N], [o, main, cross, track]),
    lv_obj_set_flex_grow: (o: number, grow: number) => v("lv_obj_set_flex_grow", [N,N], [o,grow]),

    // ── Label ─────────────────────────────────────────────────────────────
    lv_label_create:   (parent: number)             => p("lv_label_create", parent),
    lv_label_set_text: (o: number, text: string)    => v("lv_label_set_text", [N,S], [o,text]),
    lv_label_set_long_mode: (o: number, mode: number) => v("lv_label_set_long_mode", [N,N], [o,mode]),

    // ── Button (v9 renamed lv_btn_create → lv_button_create) ─────────────
    lv_btn_create: (parent: number) => p("lv_button_create", parent),

    // ── Slider ────────────────────────────────────────────────────────────
    lv_slider_create:    (parent: number)                           => p("lv_slider_create", parent),
    lv_slider_set_value: (o: number, val: number, anim: number)    => v("lv_slider_set_value", [N,N,N], [o,val,anim]),
    lv_slider_set_range: (o: number, min: number, max: number)     => v("lv_slider_set_range", [N,N,N], [o,min,max]),
    lv_slider_get_value: (o: number)                               => p("lv_slider_get_value", o),

    // ── Switch ────────────────────────────────────────────────────────────
    lv_switch_create: (parent: number) => p("lv_switch_create", parent),

    // ── Checkbox ──────────────────────────────────────────────────────────
    lv_checkbox_create:   (parent: number)          => p("lv_checkbox_create", parent),
    lv_checkbox_set_text: (o: number, t: string)    => v("lv_checkbox_set_text", [N,S], [o,t]),

    // ── Arc ───────────────────────────────────────────────────────────────
    lv_arc_create:        (parent: number)                            => p("lv_arc_create", parent),
    lv_arc_set_value:     (o: number, val: number)                    => v("lv_arc_set_value",     [N,N],   [o,val]),
    lv_arc_set_range:     (o: number, min: number, max: number)       => v("lv_arc_set_range",     [N,N,N], [o,min,max]),
    lv_arc_set_bg_angles: (o: number, start: number, end: number)     => v("lv_arc_set_bg_angles", [N,N,N], [o,start,end]),
    lv_arc_set_angles:    (o: number, start: number, end: number)     => v("lv_arc_set_angles",    [N,N,N], [o,start,end]),
    lv_arc_set_mode:      (o: number, mode: number)                   => v("lv_arc_set_mode",      [N,N],   [o,mode]),

    // ── Bar ───────────────────────────────────────────────────────────────
    lv_bar_create:    (parent: number)                          => p("lv_bar_create", parent),
    lv_bar_set_value: (o: number, val: number, anim: number)   => v("lv_bar_set_value", [N,N,N], [o,val,anim]),
    lv_bar_set_range: (o: number, min: number, max: number)    => v("lv_bar_set_range", [N,N,N], [o,min,max]),

    // ── Spinner ───────────────────────────────────────────────────────────
    lv_spinner_create: (parent: number) => p("lv_spinner_create", parent),

    // ── Dropdown ──────────────────────────────────────────────────────────
    lv_dropdown_create:      (parent: number)        => p("lv_dropdown_create", parent),
    lv_dropdown_set_options: (o: number, s: string)  => v("lv_dropdown_set_options", [N,S], [o,s]),
    lv_dropdown_get_selected:(o: number)             => p("lv_dropdown_get_selected", o),

    // ── Object getters ────────────────────────────────────────────────────
    lv_obj_get_width:       (o: number) => p("lv_obj_get_width",  o),
    lv_obj_get_height:      (o: number) => p("lv_obj_get_height", o),
    lv_obj_get_x:           (o: number) => p("lv_obj_get_x",      o),
    lv_obj_get_y:           (o: number) => p("lv_obj_get_y",      o),
    lv_obj_get_child_count: (o: number) => p("lv_obj_get_child_count", o),
    lv_obj_get_child:       (o: number, idx: number) => p("lv_obj_get_child", o, idx),

    // ── Color helpers ─────────────────────────────────────────────────────
    // lv_color_t is { uint8_t blue, green, red } — a 3-byte BGR struct.
    // Our C helpers accept a uint32_t: bits [23:16]=R [15:8]=G [7:0]=B.
    lv_color_hex:   (c: number) => c & 0xFFFFFF,
    lv_color_make:  (r: number, g: number, b: number) => (r << 16) | (g << 8) | b,
    lv_color_white: () => 0xFFFFFF,
    lv_color_black: () => 0x000000,

    // ── Font pointers (via getter helpers in helpers.c) ───────────────────
    get lv_font_montserrat_8()  { return font("montserrat_8")();  },
    get lv_font_montserrat_10() { return font("montserrat_10")(); },
    get lv_font_montserrat_12() { return font("montserrat_12")(); },
    get lv_font_montserrat_14() { return font("montserrat_14")(); },
    get lv_font_montserrat_16() { return font("montserrat_16")(); },
    get lv_font_montserrat_18() { return font("montserrat_18")(); },
    get lv_font_montserrat_20() { return font("montserrat_20")(); },
    get lv_font_montserrat_22() { return font("montserrat_22")(); },
    get lv_font_montserrat_24() { return font("montserrat_24")(); },
    get lv_font_montserrat_28() { return font("montserrat_28")(); },
    get lv_font_montserrat_32() { return font("montserrat_32")(); },

    // ── Alignment constants ───────────────────────────────────────────────
    LV_ALIGN_DEFAULT:       0,
    LV_ALIGN_TOP_LEFT:      1,
    LV_ALIGN_TOP_MID:       2,
    LV_ALIGN_TOP_RIGHT:     3,
    LV_ALIGN_BOTTOM_LEFT:   4,
    LV_ALIGN_BOTTOM_MID:    5,
    LV_ALIGN_BOTTOM_RIGHT:  6,
    LV_ALIGN_LEFT_MID:      7,
    LV_ALIGN_RIGHT_MID:     8,
    LV_ALIGN_CENTER:        9,
    LV_ALIGN_OUT_TOP_LEFT:  10,
    LV_ALIGN_OUT_TOP_MID:   11,
    LV_ALIGN_OUT_TOP_RIGHT: 12,
    LV_ALIGN_OUT_BOTTOM_LEFT:  13,
    LV_ALIGN_OUT_BOTTOM_MID:   14,
    LV_ALIGN_OUT_BOTTOM_RIGHT: 15,

    // ── Flex ─────────────────────────────────────────────────────────────
    LV_FLEX_FLOW_ROW:              1,
    LV_FLEX_FLOW_COLUMN:           2,
    LV_FLEX_FLOW_ROW_WRAP:         5,
    LV_FLEX_FLOW_ROW_REVERSE:      9,
    LV_FLEX_FLOW_COLUMN_WRAP:      6,
    LV_FLEX_FLOW_COLUMN_REVERSE:   10,
    LV_FLEX_ALIGN_START:           0,
    LV_FLEX_ALIGN_END:             1,
    LV_FLEX_ALIGN_CENTER:          2,
    LV_FLEX_ALIGN_SPACE_EVENLY:    3,
    LV_FLEX_ALIGN_SPACE_AROUND:    4,
    LV_FLEX_ALIGN_SPACE_BETWEEN:   5,

    // ── Part selector ─────────────────────────────────────────────────────
    LV_PART_MAIN:      0x000000,
    LV_PART_SCROLLBAR: 0x010000,
    LV_PART_INDICATOR: 0x020000,
    LV_PART_KNOB:      0x030000,
    LV_PART_SELECTED:  0x040000,
    LV_PART_ITEMS:     0x050000,
    LV_PART_CURSOR:    0x060000,

    // ── State ─────────────────────────────────────────────────────────────
    LV_STATE_DEFAULT:  0x0000,
    LV_STATE_CHECKED:  0x0001,
    LV_STATE_FOCUSED:  0x0002,
    LV_STATE_PRESSED:  0x0020,
    LV_STATE_DISABLED: 0x0080,

    // ── Anim ──────────────────────────────────────────────────────────────
    LV_ANIM_OFF: 0,
    LV_ANIM_ON:  1,

    // ── Opacity ───────────────────────────────────────────────────────────
    LV_OPA_TRANSP: 0,
    LV_OPA_10:     25,
    LV_OPA_20:     51,
    LV_OPA_30:     76,
    LV_OPA_40:     102,
    LV_OPA_50:     127,
    LV_OPA_60:     153,
    LV_OPA_70:     178,
    LV_OPA_80:     204,
    LV_OPA_90:     229,
    LV_OPA_COVER:  255,

    // ── Size specials ─────────────────────────────────────────────────────
    LV_SIZE_CONTENT: 0x1FFFFFFF,
    LV_PCT: (x: number) => (x | 0x20000000) >>> 0,

    // ── Object flags ─────────────────────────────────────────────────────
    LV_OBJ_FLAG_HIDDEN:       0x0001,
    LV_OBJ_FLAG_CLICKABLE:    0x0002,
    LV_OBJ_FLAG_SCROLLABLE:   0x0200,

    // ── Text align ───────────────────────────────────────────────────────
    LV_TEXT_ALIGN_AUTO:   0,
    LV_TEXT_ALIGN_LEFT:   1,
    LV_TEXT_ALIGN_CENTER: 2,
    LV_TEXT_ALIGN_RIGHT:  3,

    // ── Label long mode ──────────────────────────────────────────────────
    LV_LABEL_LONG_WRAP:   0,
    LV_LABEL_LONG_DOT:    1,
    LV_LABEL_LONG_SCROLL: 2,
    LV_LABEL_LONG_CLIP:   3,

    // ── Gradient direction ────────────────────────────────────────────────
    LV_GRAD_DIR_NONE:  0,
    LV_GRAD_DIR_VER:   1,
    LV_GRAD_DIR_HOR:   2,

    // ── Arc mode ──────────────────────────────────────────────────────────
    LV_ARC_MODE_NORMAL:    0,
    LV_ARC_MODE_SYMMETRICAL: 1,
    LV_ARC_MODE_REVERSE:   2,

    // ── Border side ───────────────────────────────────────────────────────
    LV_BORDER_SIDE_NONE:   0x00,
    LV_BORDER_SIDE_BOTTOM: 0x01,
    LV_BORDER_SIDE_TOP:    0x02,
    LV_BORDER_SIDE_LEFT:   0x04,
    LV_BORDER_SIDE_RIGHT:  0x08,
    LV_BORDER_SIDE_FULL:   0x0F,
    LV_BORDER_SIDE_INTERNAL: 0x10,

    // ── Text decoration ───────────────────────────────────────────────────
    LV_TEXT_DECOR_NONE:         0x00,
    LV_TEXT_DECOR_UNDERLINE:    0x01,
    LV_TEXT_DECOR_STRIKETHROUGH:0x02,

    // ── Direction ─────────────────────────────────────────────────────────
    LV_DIR_NONE:   0x00,
    LV_DIR_LEFT:   0x01,
    LV_DIR_RIGHT:  0x02,
    LV_DIR_TOP:    0x04,
    LV_DIR_BOTTOM: 0x08,
    LV_DIR_HOR:    0x03,
    LV_DIR_VER:    0x0C,
    LV_DIR_ALL:    0x0F,

    // ── Misc ─────────────────────────────────────────────────────────────
    NULL: 0,
  };
}

/**
 * Clear the LVGL screen and run the provided JS body (transformed from C).
 * The body runs inside `with (lvglAPI) { … }` so all LVGL symbols are in scope.
 */
export function runUserApp(mod: EmscriptenModule, jsBody: string): void {
  // Reset screen via our helper function
  mod.ccall("reset_screen", null, [], []);

  const api = buildLvglAPI(mod);

  // eslint-disable-next-line no-new-func
  const fn = new Function(...Object.keys(api), jsBody);
  fn(...Object.values(api));
}
