/**
 * Transforms a C LVGL snippet into JavaScript that can be eval'd against
 * the LVGL WASM API context.
 *
 * The user writes a standard C function, optionally preceded by file-scope
 * type definitions and static variables:
 *
 *   typedef struct { lv_obj_t *arc; uint8_t val; } my_ctx_t;
 *   static my_ctx_t ctx;
 *
 *   void user_app(void) { ... }
 *
 * We strip type definitions, convert variable declarations to `let`, and
 * unwrap the function wrapper — leaving a JS body where every identifier
 * (lv_btn_create, LV_ALIGN_CENTER, …) is provided by the LVGL API object.
 */

export function transformCtoJS(cCode: string): string {
  let code = cCode;

  // ── 1. Strip preprocessor lines (#include, #define …) ─────────────────
  code = code.replace(/^\s*#[^\n]*/gm, "");

  // ── 2. Strip typedef struct { … } name; blocks ────────────────────────
  //   Handles simple (non-nested) struct definitions.
  //   Uses a brace-balanced approach: match from 'typedef struct' through
  //   the closing '} name;'
  code = code.replace(/\btypedef\s+struct\b[^{]*\{[^{}]*\}\s*\w+\s*;/g, "");

  // ── 3. Strip the 'static' keyword from variable declarations ──────────
  code = code.replace(/\bstatic\b\s+/g, "");

  // ── 4. Unwrap  void user_app(void) { … }  ─────────────────────────────
  //   Remove the function signature
  code = code.replace(/\bvoid\s+user_app\s*\(\s*(?:void)?\s*\)\s*\{/, "");
  //   Remove the *last* closing brace (end of user_app)
  const lastBrace = code.lastIndexOf("}");
  if (lastBrace !== -1) code = code.slice(0, lastBrace) + code.slice(lastBrace + 1);

  // ── 5. Address-of on font / palette globals:  &lv_font_*  →  lv_font_* ─
  code = code.replace(/&\s*(lv_font_\w+|lv_palette_\w+)/g, "$1");

  // ── 6. Struct zero-initializer: = {0} → = {} ──────────────────────────
  //   In C, {0} zero-inits a struct; map to an empty JS object so field
  //   access like ctx.arc = … works without errors.
  code = code.replace(/=\s*\{\s*0\s*\}/g, "= {}");

  // ── 7. Variable declarations: strip type, keep name ───────────────────
  //   TYPE pattern covers:
  //     • Any _t-suffixed identifier (lv_obj_t, uint8_t, my_ctx_t, …)
  //     • Plain C primitives (bool, char, int, unsigned, size_t)
  //     • Optional leading 'const'
  const DECL_RE =
    /(?<=^|;|\})\s*(?:const\s+)?(?:\w+_t|bool|char|int|unsigned|size_t)\s*\*?\s*(\w+)\s*=/gm;
  const DECL_NO_INIT_RE =
    /(?<=^|;|\})\s*(?:const\s+)?(?:\w+_t|bool|char|int|unsigned|size_t)\s*\*?\s*(\w+)\s*;/gm;

  // Declarations with initializer:  lv_obj_t *foo = …  →  let foo =
  code = code.replace(DECL_RE, (_, name) => `\nlet ${name} =`);
  // Declarations without init:      lv_obj_t *foo;     →  let foo;
  code = code.replace(DECL_NO_INIT_RE, (_, name) => `\nlet ${name};`);

  // ── 8. Replace C keywords that differ from JS ─────────────────────────
  code = code.replace(/\bNULL\b/g, "0");
  code = code.replace(/\btrue\b/g, "true");   // already JS-valid
  code = code.replace(/\bfalse\b/g, "false");

  // ── 9. Remove dangling `(void) expr;` statements ─────────────────────
  code = code.replace(/^\s*\(void\)[^;]*;\s*$/gm, "");

  // ── 10. Remove bare `return;` ─────────────────────────────────────────
  code = code.replace(/\breturn\s*;/g, "");

  return code;
}
