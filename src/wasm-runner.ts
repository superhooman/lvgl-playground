/**
 * Instantiates and executes a user WASM module compiled from C.
 *
 * Memory model
 * ───────────
 * The user WASM has its own linear memory (exported as `memory`).
 * The LVGL Emscripten module has its own separate Emscripten heap.
 *
 * - Numeric arguments (pointers, ints, enums) cross the boundary as plain
 *   i32 values. LVGL pointers returned by e.g. lv_obj_create() are just
 *   opaque integers from user code's perspective — it never dereferences them.
 *
 * - String arguments (lv_label_set_text, lv_checkbox_set_text, …) are
 *   bridged: we read the C string from user memory, hand it to ccall as a
 *   JS string, and ccall copies it into the LVGL Emscripten heap.
 *
 * - Color style setters are routed to our helper_set_*_color() wrappers
 *   which accept uint32_t instead of the real lv_color_t BGR struct,
 *   matching the stub header declaration.
 */

import type { EmscriptenModule } from "./lvgl";

// ── String bridge helper ───────────────────────────────────────────────────

function readCString(mem: WebAssembly.Memory, ptr: number): string {
  const bytes = new Uint8Array(mem.buffer);
  let end = ptr;
  while (end < bytes.length && bytes[end] !== 0) end++;
  return new TextDecoder("utf-8").decode(bytes.subarray(ptr, end));
}

// ── Import object builder ──────────────────────────────────────────────────

function buildImports(
  mod: EmscriptenModule,
  /** Resolved lazily — set after WebAssembly.instantiate returns */
  getMemory: () => WebAssembly.Memory
): WebAssembly.Imports {
  const cc = mod.ccall.bind(mod);

  // Shorthand: call WASM fn returning a number (pointer / integer)
  const pN = (fn: string, ...args: number[]): number =>
    cc(fn, "number", args.map(() => "number") as "number"[], args) as number;

  // Shorthand: call WASM fn returning void, all args numbers
  const vN = (fn: string, ...args: number[]): void =>
    void cc(fn, null, args.map(() => "number") as "number"[], args);

  // Shorthand: call WASM fn returning void, first arg number, second string
  const vNS = (fn: string, obj: number, textPtr: number): void =>
    void cc(fn, null, ["number", "string"], [obj, readCString(getMemory(), textPtr)]);

  const env: Record<string, (...args: number[]) => number | void> = {
    // ── Screen ──────────────────────────────────────────────────────────
    lv_scr_act:   () => pN("helper_scr_act"),
    lv_layer_top: () => pN("helper_layer_top"),
    lv_layer_sys: () => pN("helper_layer_sys"),

    // ── Object lifecycle ─────────────────────────────────────────────────
    lv_obj_create: (p)    => pN("lv_obj_create", p),
    lv_obj_del:    (o)    => vN("lv_obj_delete", o),
    lv_obj_clean:  (o)    => vN("lv_obj_clean",  o),

    // ── Position / size ───────────────────────────────────────────────────
    lv_obj_set_pos:    (o, x, y)       => vN("lv_obj_set_pos",    o, x, y),
    lv_obj_set_size:   (o, w, h)       => vN("lv_obj_set_size",   o, w, h),
    lv_obj_set_width:  (o, w)          => vN("lv_obj_set_width",  o, w),
    lv_obj_set_height: (o, h)          => vN("lv_obj_set_height", o, h),
    lv_obj_center:     (o)             => vN("lv_obj_center",     o),
    lv_obj_align:      (o, a, x, y)    => vN("lv_obj_align",      o, a, x, y),
    lv_obj_align_to:   (o, b, a, x, y) => vN("lv_obj_align_to",  o, b, a, x, y),

    // ── Style — color (uint32_t via helper wrappers) ──────────────────────
    lv_obj_set_style_bg_color:      (o, c, s) => vN("helper_set_bg_color",      o, c, s),
    lv_obj_set_style_text_color:    (o, c, s) => vN("helper_set_text_color",    o, c, s),
    lv_obj_set_style_border_color:  (o, c, s) => vN("helper_set_border_color",  o, c, s),
    lv_obj_set_style_shadow_color:  (o, c, s) => vN("helper_set_shadow_color",  o, c, s),
    lv_obj_set_style_outline_color: (o, c, s) => vN("helper_set_outline_color", o, c, s),
    lv_obj_set_style_arc_color:     (o, c, s) => vN("helper_set_arc_color",     o, c, s),
    lv_obj_set_style_line_color:    (o, c, s) => vN("helper_set_line_color",    o, c, s),
    lv_obj_set_style_bg_grad_color: (o, c, s) => vN("helper_set_bg_grad_color", o, c, s),
    lv_obj_set_style_img_recolor:   (o, c, s) => vN("helper_set_img_recolor",   o, c, s),

    // ── Style — opacity ───────────────────────────────────────────────────
    lv_obj_set_style_opa:          (o, v, s) => vN("lv_obj_set_style_opa",          o, v, s),
    lv_obj_set_style_bg_opa:       (o, v, s) => vN("lv_obj_set_style_bg_opa",       o, v, s),
    lv_obj_set_style_bg_grad_dir:  (o, v, s) => vN("lv_obj_set_style_bg_grad_dir",  o, v, s),
    lv_obj_set_style_bg_main_stop: (o, v, s) => vN("lv_obj_set_style_bg_main_stop", o, v, s),
    lv_obj_set_style_bg_grad_stop: (o, v, s) => vN("lv_obj_set_style_bg_grad_stop", o, v, s),

    // ── Style — border ────────────────────────────────────────────────────
    lv_obj_set_style_border_width: (o, v, s) => vN("lv_obj_set_style_border_width", o, v, s),
    lv_obj_set_style_border_opa:   (o, v, s) => vN("lv_obj_set_style_border_opa",   o, v, s),
    lv_obj_set_style_radius:       (o, v, s) => vN("lv_obj_set_style_radius",       o, v, s),

    // ── Style — padding ───────────────────────────────────────────────────
    lv_obj_set_style_pad_all:    (o, v, s) => vN("helper_set_pad_all",          o, v, s),
    lv_obj_set_style_pad_top:    (o, v, s) => vN("lv_obj_set_style_pad_top",    o, v, s),
    lv_obj_set_style_pad_bottom: (o, v, s) => vN("lv_obj_set_style_pad_bottom", o, v, s),
    lv_obj_set_style_pad_left:   (o, v, s) => vN("lv_obj_set_style_pad_left",   o, v, s),
    lv_obj_set_style_pad_right:  (o, v, s) => vN("lv_obj_set_style_pad_right",  o, v, s),
    lv_obj_set_style_pad_gap:    (o, v, s) => vN("helper_set_pad_gap",          o, v, s),

    // ── Style — shadow ────────────────────────────────────────────────────
    lv_obj_set_style_shadow_width:    (o, v, s) => vN("lv_obj_set_style_shadow_width",    o, v, s),
    lv_obj_set_style_shadow_opa:      (o, v, s) => vN("lv_obj_set_style_shadow_opa",      o, v, s),
    lv_obj_set_style_shadow_spread:   (o, v, s) => vN("lv_obj_set_style_shadow_spread",   o, v, s),
    lv_obj_set_style_shadow_offset_x: (o, v, s) => vN("lv_obj_set_style_shadow_offset_x", o, v, s),
    lv_obj_set_style_shadow_offset_y: (o, v, s) => vN("lv_obj_set_style_shadow_offset_y", o, v, s),

    // ── Style — outline ───────────────────────────────────────────────────
    lv_obj_set_style_outline_width: (o, v, s) => vN("lv_obj_set_style_outline_width", o, v, s),
    lv_obj_set_style_outline_opa:   (o, v, s) => vN("lv_obj_set_style_outline_opa",   o, v, s),
    lv_obj_set_style_outline_pad:   (o, v, s) => vN("lv_obj_set_style_outline_pad",   o, v, s),

    // ── Style — arc ───────────────────────────────────────────────────────
    lv_obj_set_style_arc_width:   (o, v, s) => vN("lv_obj_set_style_arc_width",   o, v, s),
    lv_obj_set_style_arc_opa:     (o, v, s) => vN("lv_obj_set_style_arc_opa",     o, v, s),
    lv_obj_set_style_arc_rounded: (o, v, s) => vN("lv_obj_set_style_arc_rounded", o, v, s),

    // ── Style — line ──────────────────────────────────────────────────────
    lv_obj_set_style_line_width:      (o, v, s) => vN("lv_obj_set_style_line_width",      o, v, s),
    lv_obj_set_style_line_opa:        (o, v, s) => vN("lv_obj_set_style_line_opa",        o, v, s),
    lv_obj_set_style_line_rounded:    (o, v, s) => vN("lv_obj_set_style_line_rounded",    o, v, s),
    lv_obj_set_style_line_dash_width: (o, v, s) => vN("lv_obj_set_style_line_dash_width", o, v, s),
    lv_obj_set_style_line_dash_gap:   (o, v, s) => vN("lv_obj_set_style_line_dash_gap",   o, v, s),

    // ── Style — image ─────────────────────────────────────────────────────
    lv_obj_set_style_img_opa:         (o, v, s) => vN("lv_obj_set_style_img_opa",         o, v, s),
    lv_obj_set_style_img_recolor_opa: (o, v, s) => vN("lv_obj_set_style_img_recolor_opa", o, v, s),

    // ── Style — text ──────────────────────────────────────────────────────
    lv_obj_set_style_text_font:         (o, f, s) => vN("lv_obj_set_style_text_font",         o, f, s),
    lv_obj_set_style_text_align:        (o, v, s) => vN("lv_obj_set_style_text_align",        o, v, s),
    lv_obj_set_style_text_letter_space: (o, v, s) => vN("lv_obj_set_style_text_letter_space", o, v, s),
    lv_obj_set_style_text_line_space:   (o, v, s) => vN("lv_obj_set_style_text_line_space",   o, v, s),
    lv_obj_set_style_text_opa:          (o, v, s) => vN("lv_obj_set_style_text_opa",          o, v, s),
    lv_obj_set_style_text_decor:        (o, v, s) => vN("lv_obj_set_style_text_decor",        o, v, s),

    // ── Style — transform / translate ─────────────────────────────────────
    lv_obj_set_style_translate_x:        (o, v, s) => vN("lv_obj_set_style_translate_x",        o, v, s),
    lv_obj_set_style_translate_y:        (o, v, s) => vN("lv_obj_set_style_translate_y",        o, v, s),
    lv_obj_set_style_transform_rotation: (o, v, s) => vN("lv_obj_set_style_transform_rotation", o, v, s),
    lv_obj_set_style_transform_scale_x:  (o, v, s) => vN("lv_obj_set_style_transform_scale_x",  o, v, s),
    lv_obj_set_style_transform_scale_y:  (o, v, s) => vN("lv_obj_set_style_transform_scale_y",  o, v, s),

    // ── Style — size constraints ──────────────────────────────────────────
    lv_obj_set_style_min_width:  (o, v, s) => vN("lv_obj_set_style_min_width",  o, v, s),
    lv_obj_set_style_max_width:  (o, v, s) => vN("lv_obj_set_style_max_width",  o, v, s),
    lv_obj_set_style_min_height: (o, v, s) => vN("lv_obj_set_style_min_height", o, v, s),
    lv_obj_set_style_max_height: (o, v, s) => vN("lv_obj_set_style_max_height", o, v, s),

    // ── Flags / state ─────────────────────────────────────────────────────
    lv_obj_add_flag:    (o, f) => vN("lv_obj_add_flag",    o, f),
    lv_obj_clear_flag:  (o, f) => vN("lv_obj_remove_flag", o, f),  // v9 renamed
    lv_obj_add_state:   (o, s) => vN("lv_obj_add_state",   o, s),
    lv_obj_clear_state: (o, s) => vN("lv_obj_remove_state", o, s), // v9 renamed

    // ── Flex layout ───────────────────────────────────────────────────────
    lv_obj_set_flex_flow:  (o, f)          => vN("lv_obj_set_flex_flow",  o, f),
    lv_obj_set_flex_align: (o, m, c, t)    => vN("lv_obj_set_flex_align", o, m, c, t),
    lv_obj_set_flex_grow:  (o, g)          => vN("lv_obj_set_flex_grow",  o, g),

    // ── Getters ───────────────────────────────────────────────────────────
    lv_obj_get_width:       (o)    => pN("lv_obj_get_width",       o),
    lv_obj_get_height:      (o)    => pN("lv_obj_get_height",      o),
    lv_obj_get_x:           (o)    => pN("lv_obj_get_x",           o),
    lv_obj_get_y:           (o)    => pN("lv_obj_get_y",           o),
    lv_obj_get_child_count: (o)    => pN("lv_obj_get_child_count", o),
    lv_obj_get_child:       (o, i) => pN("lv_obj_get_child",       o, i),

    // ── Label ─────────────────────────────────────────────────────────────
    lv_label_create:       (p)         => pN("lv_label_create", p),
    lv_label_set_text:     (o, textPtr) => vNS("lv_label_set_text", o, textPtr),
    lv_label_set_long_mode:(o, m)      => vN("lv_label_set_long_mode", o, m),

    // ── Button (v9: lv_btn_create → lv_button_create) ────────────────────
    lv_btn_create: (p) => pN("lv_button_create", p),

    // ── Slider ────────────────────────────────────────────────────────────
    lv_slider_create:    (p)          => pN("lv_slider_create",    p),
    lv_slider_set_value: (o, v, anim) => vN("lv_slider_set_value", o, v, anim),
    lv_slider_set_range: (o, min, max)=> vN("lv_slider_set_range", o, min, max),
    lv_slider_get_value: (o)          => pN("lv_slider_get_value", o),

    // ── Switch ────────────────────────────────────────────────────────────
    lv_switch_create: (p) => pN("lv_switch_create", p),

    // ── Checkbox ──────────────────────────────────────────────────────────
    lv_checkbox_create:   (p)         => pN("lv_checkbox_create", p),
    lv_checkbox_set_text: (o, textPtr) => vNS("lv_checkbox_set_text", o, textPtr),

    // ── Arc ───────────────────────────────────────────────────────────────
    lv_arc_create:        (p)             => pN("lv_arc_create",        p),
    lv_arc_set_value:     (o, v)          => vN("lv_arc_set_value",     o, v),
    lv_arc_set_range:     (o, min, max)   => vN("lv_arc_set_range",     o, min, max),
    lv_arc_set_bg_angles: (o, start, end) => vN("lv_arc_set_bg_angles", o, start, end),
    lv_arc_set_angles:    (o, start, end) => vN("lv_arc_set_angles",    o, start, end),
    lv_arc_set_mode:      (o, m)          => vN("lv_arc_set_mode",      o, m),

    // ── Bar ───────────────────────────────────────────────────────────────
    lv_bar_create:    (p)          => pN("lv_bar_create",    p),
    lv_bar_set_value: (o, v, anim) => vN("lv_bar_set_value", o, v, anim),
    lv_bar_set_range: (o, min, max)=> vN("lv_bar_set_range", o, min, max),

    // ── Spinner ───────────────────────────────────────────────────────────
    lv_spinner_create: (p) => pN("lv_spinner_create", p),

    // ── Dropdown ──────────────────────────────────────────────────────────
    lv_dropdown_create:      (p)         => pN("lv_dropdown_create",       p),
    lv_dropdown_set_options: (o, optPtr) => vNS("lv_dropdown_set_options", o, optPtr),
    lv_dropdown_get_selected:(o)         => pN("lv_dropdown_get_selected", o),

    // ── Font pointer getters (return ptrs into LVGL heap) ─────────────────
    get_font_montserrat_8:  () => pN("get_font_montserrat_8"),
    get_font_montserrat_10: () => pN("get_font_montserrat_10"),
    get_font_montserrat_12: () => pN("get_font_montserrat_12"),
    get_font_montserrat_14: () => pN("get_font_montserrat_14"),
    get_font_montserrat_16: () => pN("get_font_montserrat_16"),
    get_font_montserrat_18: () => pN("get_font_montserrat_18"),
    get_font_montserrat_20: () => pN("get_font_montserrat_20"),
    get_font_montserrat_22: () => pN("get_font_montserrat_22"),
    get_font_montserrat_24: () => pN("get_font_montserrat_24"),
    get_font_montserrat_28: () => pN("get_font_montserrat_28"),
    get_font_montserrat_32: () => pN("get_font_montserrat_32"),
  };

  return { env };
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Instantiate a compiled user WASM and call its `user_app` export.
 *
 * Resets the LVGL screen before running.
 */
export async function runCompiledWasm(
  mod: EmscriptenModule,
  wasmBytes: Uint8Array
): Promise<void> {
  mod.ccall("reset_screen", null, [], []);

  let userMemory: WebAssembly.Memory | undefined;
  const getMemory = () => {
    if (!userMemory) throw new Error("user WASM memory not yet available");
    return userMemory;
  };

  const imports = buildImports(mod, getMemory);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (WebAssembly.instantiate as any)(wasmBytes.buffer, imports);
  const instance: WebAssembly.Instance = result.instance ?? result;

  // Capture memory export so string bridge can use it
  userMemory = instance.exports.memory as WebAssembly.Memory;

  const userApp = instance.exports.user_app as (() => void) | undefined;
  if (typeof userApp !== "function") {
    throw new Error(
      'Compiled WASM does not export "user_app". ' +
      "Make sure your code defines: void user_app(void) { … }"
    );
  }

  userApp();
}
