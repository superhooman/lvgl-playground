/**
 * runtime.ts  —  LVGL Emscripten runtime loader + user-WASM bridge.
 *
 * Architecture
 * ────────────
 *  ┌──────────────────────────────────┐
 *  │   User C code (Monaco editor)    │
 *  │   compiled → user.wasm           │
 *  │   exports: user_app()            │
 *  │   imports: lv_*() from "env"     │
 *  └──────────┬───────────────────────┘
 *             │ WebAssembly.instantiate(userWasm, bridgeImports)
 *  ┌──────────▼───────────────────────┐
 *  │   JavaScript bridge (this file)  │
 *  │   • reads strings from user mem  │
 *  │   • calls Emscripten LVGL fns    │
 *  └──────────┬───────────────────────┘
 *             │ ccall / _lv_xxx()
 *  ┌──────────▼───────────────────────┐
 *  │   lvgl_playground.wasm           │
 *  │   (Emscripten + LVGL + SDL2)     │
 *  │   renders to <canvas id="canvas">│
 *  └──────────────────────────────────┘
 *
 * Memory model
 * ────────────
 * The user WASM and the Emscripten LVGL module have SEPARATE linear
 * memories.  LVGL pointers (lv_obj_t *, font pointers, …) live in the
 * Emscripten heap and are passed through JavaScript as opaque i32 handles.
 * String literals in user code live in the user WASM memory.  The bridge
 * reads them with TextDecoder and passes them to Emscripten's ccall(), which
 * allocates a temporary copy on Emscripten's stack for the duration of each
 * call — exactly how the current JS-binding approach already works.
 */

// ── Emscripten module shape ──────────────────────────────────────────────────
export interface LvglEmModule {
  // Runtime methods injected by Emscripten
  ccall(
    name: string,
    returnType: "number" | "string" | null,
    argTypes: Array<"number" | "string">,
    args: unknown[],
  ): unknown;
  canvas: HTMLCanvasElement;
  print?: (s: string) => void;
  printErr?: (s: string) => void;

  // Direct WASM function exports (via EXPORTED_FUNCTIONS)
  _reset_screen(): void;
  _helper_scr_act(): number;
  _helper_layer_top(): number;
  _helper_layer_sys(): number;
  _lv_obj_create(parent: number): number;
  _lv_obj_delete(obj: number): void;
  _lv_obj_clean(obj: number): void;
  _lv_obj_set_pos(o: number, x: number, y: number): void;
  _lv_obj_set_size(o: number, w: number, h: number): void;
  _lv_obj_set_width(o: number, w: number): void;
  _lv_obj_set_height(o: number, h: number): void;
  _lv_obj_center(o: number): void;
  _lv_obj_align(o: number, align: number, x: number, y: number): void;
  _lv_obj_align_to(o: number, base: number, align: number, x: number, y: number): void;
  _lv_obj_set_style_bg_opa(o: number, opa: number, sel: number): void;
  _lv_obj_set_style_border_width(o: number, w: number, sel: number): void;
  _lv_obj_set_style_border_opa(o: number, opa: number, sel: number): void;
  _lv_obj_set_style_radius(o: number, r: number, sel: number): void;
  _lv_obj_set_style_pad_top(o: number, v: number, sel: number): void;
  _lv_obj_set_style_pad_bottom(o: number, v: number, sel: number): void;
  _lv_obj_set_style_pad_left(o: number, v: number, sel: number): void;
  _lv_obj_set_style_pad_right(o: number, v: number, sel: number): void;
  _lv_obj_set_style_shadow_width(o: number, w: number, sel: number): void;
  _lv_obj_set_style_text_font(o: number, font: number, sel: number): void;
  _lv_obj_set_style_text_align(o: number, align: number, sel: number): void;
  _lv_obj_set_style_text_letter_space(o: number, sp: number, sel: number): void;
  _lv_obj_set_style_text_line_space(o: number, sp: number, sel: number): void;
  _lv_obj_add_flag(o: number, flag: number): void;
  _lv_obj_remove_flag(o: number, flag: number): void;
  _lv_obj_add_state(o: number, state: number): void;
  _lv_obj_remove_state(o: number, state: number): void;
  _lv_obj_set_flex_flow(o: number, flow: number): void;
  _lv_obj_set_flex_align(o: number, main: number, cross: number, track: number): void;
  _lv_obj_set_flex_grow(o: number, grow: number): void;
  _lv_label_create(parent: number): number;
  _lv_label_set_long_mode(o: number, mode: number): void;
  _lv_button_create(parent: number): number;
  _lv_slider_create(parent: number): number;
  _lv_slider_set_value(o: number, val: number, anim: number): void;
  _lv_slider_set_range(o: number, min: number, max: number): void;
  _lv_slider_get_value(o: number): number;
  _lv_switch_create(parent: number): number;
  _lv_checkbox_create(parent: number): number;
  _lv_arc_create(parent: number): number;
  _lv_arc_set_value(o: number, val: number): void;
  _lv_arc_set_range(o: number, min: number, max: number): void;
  _lv_arc_set_bg_angles(o: number, start: number, end: number): void;
  _lv_arc_set_angles(o: number, start: number, end: number): void;
  _lv_bar_create(parent: number): number;
  _lv_bar_set_value(o: number, val: number, anim: number): void;
  _lv_bar_set_range(o: number, min: number, max: number): void;
  _lv_spinner_create(parent: number): number;
  _lv_dropdown_create(parent: number): number;
  // Color / style helpers (uint32 RGB888 → lv_color_t inside C)
  _helper_set_bg_color(o: number, color: number, sel: number): void;
  _helper_set_text_color(o: number, color: number, sel: number): void;
  _helper_set_border_color(o: number, color: number, sel: number): void;
  _helper_set_shadow_color(o: number, color: number, sel: number): void;
  _helper_set_outline_color(o: number, color: number, sel: number): void;
  _helper_set_pad_all(o: number, v: number, sel: number): void;
  _helper_set_pad_gap(o: number, v: number, sel: number): void;
  // Font pointer getters
  _get_font_montserrat_8(): number;
  _get_font_montserrat_10(): number;
  _get_font_montserrat_12(): number;
  _get_font_montserrat_14(): number;
  _get_font_montserrat_16(): number;
  _get_font_montserrat_18(): number;
  _get_font_montserrat_20(): number;
  _get_font_montserrat_22(): number;
  _get_font_montserrat_24(): number;
  _get_font_montserrat_28(): number;
  _get_font_montserrat_32(): number;
}

declare global {
  interface Window {
    createLvglModule?: (
      opts: Partial<LvglEmModule>,
    ) => Promise<LvglEmModule>;
  }
}

// ── LVGL runtime loader ──────────────────────────────────────────────────────
let _mod: LvglEmModule | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = Object.assign(document.createElement("script"), {
      src,
      onload: () => resolve(),
      onerror: () => reject(new Error(`Failed to load ${src}`)),
    });
    document.head.appendChild(s);
  });
}

export async function initLvgl(
  canvas: HTMLCanvasElement,
): Promise<LvglEmModule> {
  if (_mod) return _mod;

  await loadScript("/lvgl_playground.js");

  if (!window.createLvglModule) {
    throw new Error("createLvglModule not found on window");
  }

  _mod = await window.createLvglModule({
    canvas,
    print: (s: string) => console.log("[lvgl]", s),
    printErr: (s: string) => console.warn("[lvgl]", s),
  });

  return _mod;
}

// ── String bridge helpers ────────────────────────────────────────────────────
/**
 * Read a null-terminated UTF-8 string from a WebAssembly linear memory.
 * Used to bridge string literals from user WASM memory → JavaScript.
 */
function readCString(mem: WebAssembly.Memory, ptr: number): string {
  const bytes = new Uint8Array(mem.buffer);
  let end = ptr;
  while (bytes[end] !== 0) end++;
  return new TextDecoder().decode(bytes.subarray(ptr, end));
}

// ── User WASM runner ─────────────────────────────────────────────────────────
/**
 * Instantiate the user's compiled WASM module with the LVGL bridge as its
 * import object, then invoke `user_app()`.
 *
 * The bridge maps every LVGL symbol the user's code imports (namespace "env")
 * to the corresponding Emscripten LVGL export.  String arguments are read
 * from the user WASM's own memory and passed through Emscripten's ccall(),
 * which handles temporary allocation in the LVGL heap automatically.
 */
export async function runUserWasm(
  userWasmBytes: Uint8Array,
  mod: LvglEmModule,
): Promise<void> {
  // We'll capture the user instance's memory after instantiation so that
  // string bridge closures can read from it.
  let userMem: WebAssembly.Memory | null = null;

  const str = (ptr: number): string => {
    if (!userMem) throw new Error("user WASM memory not ready");
    return readCString(userMem, ptr);
  };

  // ccall with a 'string' argument type writes the JS string into Emscripten's
  // stack temporarily for the duration of the call.  LVGL always copies string
  // content internally (lv_label_set_text, etc.), so this is safe.
  const callStr1 = (fn: string, obj: number, strPtr: number) =>
    mod.ccall(fn, null, ["number", "string"], [obj, str(strPtr)]);

  const imports: WebAssembly.Imports = {
    env: {
      // ── Screen / layers ──────────────────────────────────────────────────
      lv_scr_act: () => mod._helper_scr_act(),
      lv_screen_active: () => mod._helper_scr_act(),
      lv_layer_top: () => mod._helper_layer_top(),
      lv_layer_sys: () => mod._helper_layer_sys(),

      // ── Object lifecycle ─────────────────────────────────────────────────
      lv_obj_create: (p: number) => mod._lv_obj_create(p),
      lv_obj_delete: (o: number) => mod._lv_obj_delete(o),
      lv_obj_clean: (o: number) => mod._lv_obj_clean(o),

      // ── Position / size ──────────────────────────────────────────────────
      lv_obj_set_pos: (o: number, x: number, y: number) =>
        mod._lv_obj_set_pos(o, x, y),
      lv_obj_set_size: (o: number, w: number, h: number) =>
        mod._lv_obj_set_size(o, w, h),
      lv_obj_set_width: (o: number, w: number) => mod._lv_obj_set_width(o, w),
      lv_obj_set_height: (o: number, h: number) =>
        mod._lv_obj_set_height(o, h),
      lv_obj_center: (o: number) => mod._lv_obj_center(o),
      lv_obj_align: (o: number, al: number, x: number, y: number) =>
        mod._lv_obj_align(o, al, x, y),
      lv_obj_align_to: (
        o: number,
        b: number,
        al: number,
        x: number,
        y: number,
      ) => mod._lv_obj_align_to(o, b, al, x, y),

      // ── Style — colors (uint32 RGB888 via helper) ────────────────────────
      lv_obj_set_style_bg_color: (o: number, c: number, s: number) =>
        mod._helper_set_bg_color(o, c, s),
      lv_obj_set_style_text_color: (o: number, c: number, s: number) =>
        mod._helper_set_text_color(o, c, s),
      lv_obj_set_style_border_color: (o: number, c: number, s: number) =>
        mod._helper_set_border_color(o, c, s),
      lv_obj_set_style_shadow_color: (o: number, c: number, s: number) =>
        mod._helper_set_shadow_color(o, c, s),
      lv_obj_set_style_outline_color: (o: number, c: number, s: number) =>
        mod._helper_set_outline_color(o, c, s),

      // ── Style — numeric ──────────────────────────────────────────────────
      lv_obj_set_style_bg_opa: (o: number, opa: number, s: number) =>
        mod._lv_obj_set_style_bg_opa(o, opa, s),
      lv_obj_set_style_border_width: (o: number, w: number, s: number) =>
        mod._lv_obj_set_style_border_width(o, w, s),
      lv_obj_set_style_border_opa: (o: number, opa: number, s: number) =>
        mod._lv_obj_set_style_border_opa(o, opa, s),
      lv_obj_set_style_radius: (o: number, r: number, s: number) =>
        mod._lv_obj_set_style_radius(o, r, s),
      lv_obj_set_style_pad_all: (o: number, v: number, s: number) =>
        mod._helper_set_pad_all(o, v, s),
      lv_obj_set_style_pad_top: (o: number, v: number, s: number) =>
        mod._lv_obj_set_style_pad_top(o, v, s),
      lv_obj_set_style_pad_bottom: (o: number, v: number, s: number) =>
        mod._lv_obj_set_style_pad_bottom(o, v, s),
      lv_obj_set_style_pad_left: (o: number, v: number, s: number) =>
        mod._lv_obj_set_style_pad_left(o, v, s),
      lv_obj_set_style_pad_right: (o: number, v: number, s: number) =>
        mod._lv_obj_set_style_pad_right(o, v, s),
      lv_obj_set_style_pad_gap: (o: number, v: number, s: number) =>
        mod._helper_set_pad_gap(o, v, s),
      lv_obj_set_style_shadow_width: (o: number, w: number, s: number) =>
        mod._lv_obj_set_style_shadow_width(o, w, s),
      lv_obj_set_style_text_font: (o: number, font: number, s: number) =>
        mod._lv_obj_set_style_text_font(o, font, s),
      lv_obj_set_style_text_align: (o: number, al: number, s: number) =>
        mod._lv_obj_set_style_text_align(o, al, s),
      lv_obj_set_style_text_letter_space: (o: number, sp: number, s: number) =>
        mod._lv_obj_set_style_text_letter_space(o, sp, s),
      lv_obj_set_style_text_line_space: (o: number, sp: number, s: number) =>
        mod._lv_obj_set_style_text_line_space(o, sp, s),

      // ── Flags / state ────────────────────────────────────────────────────
      lv_obj_add_flag: (o: number, f: number) => mod._lv_obj_add_flag(o, f),
      lv_obj_remove_flag: (o: number, f: number) =>
        mod._lv_obj_remove_flag(o, f),
      lv_obj_add_state: (o: number, st: number) =>
        mod._lv_obj_add_state(o, st),
      lv_obj_remove_state: (o: number, st: number) =>
        mod._lv_obj_remove_state(o, st),

      // ── Flex ─────────────────────────────────────────────────────────────
      lv_obj_set_flex_flow: (o: number, fl: number) =>
        mod._lv_obj_set_flex_flow(o, fl),
      lv_obj_set_flex_align: (
        o: number,
        m: number,
        c: number,
        t: number,
      ) => mod._lv_obj_set_flex_align(o, m, c, t),
      lv_obj_set_flex_grow: (o: number, g: number) =>
        mod._lv_obj_set_flex_grow(o, g),

      // ── Label (string bridge!) ───────────────────────────────────────────
      lv_label_create: (p: number) => mod._lv_label_create(p),
      lv_label_set_text: (o: number, ptr: number) =>
        callStr1("lv_label_set_text", o, ptr),
      lv_label_set_long_mode: (o: number, m: number) =>
        mod._lv_label_set_long_mode(o, m),

      // ── Button ───────────────────────────────────────────────────────────
      lv_button_create: (p: number) => mod._lv_button_create(p),
      lv_btn_create: (p: number) => mod._lv_button_create(p),

      // ── Slider ───────────────────────────────────────────────────────────
      lv_slider_create: (p: number) => mod._lv_slider_create(p),
      lv_slider_set_value: (o: number, v: number, a: number) =>
        mod._lv_slider_set_value(o, v, a),
      lv_slider_set_range: (o: number, mn: number, mx: number) =>
        mod._lv_slider_set_range(o, mn, mx),
      lv_slider_get_value: (o: number) => mod._lv_slider_get_value(o),

      // ── Switch ───────────────────────────────────────────────────────────
      lv_switch_create: (p: number) => mod._lv_switch_create(p),

      // ── Checkbox (string bridge!) ────────────────────────────────────────
      lv_checkbox_create: (p: number) => mod._lv_checkbox_create(p),
      lv_checkbox_set_text: (o: number, ptr: number) =>
        callStr1("lv_checkbox_set_text", o, ptr),

      // ── Arc ──────────────────────────────────────────────────────────────
      lv_arc_create: (p: number) => mod._lv_arc_create(p),
      lv_arc_set_value: (o: number, v: number) => mod._lv_arc_set_value(o, v),
      lv_arc_set_range: (o: number, mn: number, mx: number) =>
        mod._lv_arc_set_range(o, mn, mx),
      lv_arc_set_bg_angles: (o: number, s: number, e: number) =>
        mod._lv_arc_set_bg_angles(o, s, e),
      lv_arc_set_angles: (o: number, s: number, e: number) =>
        mod._lv_arc_set_angles(o, s, e),

      // ── Bar ──────────────────────────────────────────────────────────────
      lv_bar_create: (p: number) => mod._lv_bar_create(p),
      lv_bar_set_value: (o: number, v: number, a: number) =>
        mod._lv_bar_set_value(o, v, a),
      lv_bar_set_range: (o: number, mn: number, mx: number) =>
        mod._lv_bar_set_range(o, mn, mx),

      // ── Spinner ──────────────────────────────────────────────────────────
      lv_spinner_create: (p: number) => mod._lv_spinner_create(p),

      // ── Dropdown (string bridge!) ────────────────────────────────────────
      lv_dropdown_create: (p: number) => mod._lv_dropdown_create(p),
      lv_dropdown_set_options: (o: number, ptr: number) =>
        callStr1("lv_dropdown_set_options", o, ptr),

      // ── Font getters ─────────────────────────────────────────────────────
      lv_get_font_montserrat_8: () => mod._get_font_montserrat_8(),
      lv_get_font_montserrat_10: () => mod._get_font_montserrat_10(),
      lv_get_font_montserrat_12: () => mod._get_font_montserrat_12(),
      lv_get_font_montserrat_14: () => mod._get_font_montserrat_14(),
      lv_get_font_montserrat_16: () => mod._get_font_montserrat_16(),
      lv_get_font_montserrat_18: () => mod._get_font_montserrat_18(),
      lv_get_font_montserrat_20: () => mod._get_font_montserrat_20(),
      lv_get_font_montserrat_22: () => mod._get_font_montserrat_22(),
      lv_get_font_montserrat_24: () => mod._get_font_montserrat_24(),
      lv_get_font_montserrat_28: () => mod._get_font_montserrat_28(),
      lv_get_font_montserrat_32: () => mod._get_font_montserrat_32(),
    },
  };

  // Instantiate the user's WASM with the bridge imports.
  // Cast via unknown because TypeScript's lib overloads resolve to Instance
  // when the first arg is assignable to Module; the runtime behaviour when
  // passing a Uint8Array always returns WebAssemblyInstantiatedSource.
  const { instance } = (await WebAssembly.instantiate(
    userWasmBytes,
    imports,
  ) as unknown) as WebAssembly.WebAssemblyInstantiatedSource;

  // Capture user memory so string bridge closures can read from it
  userMem = instance.exports.memory as WebAssembly.Memory;

  // Reset LVGL screen before invoking user's UI code
  mod._reset_screen();

  // Call the user's entry point
  (instance.exports.user_app as CallableFunction)();
}
