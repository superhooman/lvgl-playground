/**
 * Transforms a C LVGL snippet into JavaScript that can be eval'd against
 * the LVGL WASM API context.
 *
 * The user writes a standard C function:
 *   void user_app(void) { ... }
 *
 * We strip the function wrapper + type declarations, leaving a JS body
 * where every identifier (lv_btn_create, LV_ALIGN_CENTER, …) is provided
 * by the LVGL API object injected as a `with` context.
 */

export function transformCtoJS(cCode: string): string {
  let code = cCode;

  // ── 1. Strip preprocessor lines (#include, #define …) ─────────────────
  code = code.replace(/^\s*#[^\n]*/gm, "");

  // ── 2. Unwrap  void user_app(void) { … }  ─────────────────────────────
  //   Remove the function signature
  code = code.replace(/\bvoid\s+user_app\s*\(\s*(?:void)?\s*\)\s*\{/, "");
  //   Remove the *last* closing brace (end of user_app)
  const lastBrace = code.lastIndexOf("}");
  if (lastBrace !== -1) code = code.slice(0, lastBrace) + code.slice(lastBrace + 1);

  // ── 3. Address-of on font / palette globals:  &lv_font_*  →  lv_font_* ─
  code = code.replace(/&\s*(lv_font_\w+|lv_palette_\w+)/g, "$1");

  // ── 4. Variable declarations: strip type, keep name ───────────────────
  //   Handles:  lv_obj_t *foo = …   uint32_t n = …   bool flag = …
  //             const lv_style_t style = …   int x = …
  const TYPE_RE =
    /\b(?:const\s+)?(?:lv_\w+|u?int(?:8|16|32|64)?_t|bool|char|int|unsigned|size_t)\s*\*?\s*(?=\w)/g;
  // Repeatedly strip leading types from declaration-like statements.
  // We need to anchor on the start of a statement (after newline or `;`).
  code = code.replace(
    /(?<=^|;|\})\s*(?:const\s+)?(?:lv_\w+|u?int(?:8|16|32|64)?_t|bool|char|int|unsigned|size_t)\s*\*?\s*(\w+)\s*=/gm,
    (_, name) => `\nlet ${name} =`
  );
  // Declarations without init:  lv_obj_t *foo;
  code = code.replace(
    /(?<=^|;|\})\s*(?:const\s+)?(?:lv_\w+|u?int(?:8|16|32|64)?_t|bool|char|int|unsigned|size_t)\s*\*?\s*(\w+)\s*;/gm,
    (_, name) => `\nlet ${name};`
  );
  void TYPE_RE; // suppress unused warning

  // ── 5. Replace C keywords that differ from JS ─────────────────────────
  code = code.replace(/\bNULL\b/g, "0");
  code = code.replace(/\btrue\b/g, "true");   // already JS-valid
  code = code.replace(/\bfalse\b/g, "false");

  // ── 6. Remove dangling `(void) expr;` statements ─────────────────────
  code = code.replace(/^\s*\(void\)[^;]*;\s*$/gm, "");

  // ── 7. Remove bare `return;` ──────────────────────────────────────────
  code = code.replace(/\breturn\s*;/g, "");

  return code;
}
