import { useRef, useState, useCallback, useEffect } from "react";
import MonacoEditor from "@monaco-editor/react";
import * as Monaco from "monaco-editor";
import { initLvgl, type EmscriptenModule } from "./lvgl";
import { compileC, type CompilerStatus } from "./compiler";
import { runCompiledWasm } from "./wasm-runner";

import "./styles/app.css";

// ── Default example ───────────────────────────────────────────────────────────
const DEFAULT_CODE = `#include "lvgl.h"

void user_app(void)
{
    lv_obj_t *scr = lv_scr_act();
    lv_obj_set_style_bg_color(scr, lv_color_hex(0x000), LV_PART_MAIN);

    /* Title */
    lv_obj_t *title = lv_label_create(scr);
    lv_label_set_text(title, "Hello, LVGL!");
    lv_obj_set_style_text_font(title, &lv_font_montserrat_24, LV_PART_MAIN);
    lv_obj_set_style_text_color(title, lv_color_hex(0xe94560), LV_PART_MAIN);
    lv_obj_align(title, LV_ALIGN_CENTER, 0, -60);

    /* Slider */
    lv_obj_t *slider = lv_slider_create(scr);
    lv_obj_set_width(slider, 200);
    lv_slider_set_value(slider, 60, LV_ANIM_OFF);
    lv_obj_align(slider, LV_ALIGN_CENTER, 0, 0);

    /* Button */
    lv_obj_t *btn = lv_btn_create(scr);
    lv_obj_set_size(btn, 130, 44);
    lv_obj_align(btn, LV_ALIGN_CENTER, 0, 60);

    lv_obj_t *lbl = lv_label_create(btn);
    lv_label_set_text(lbl, "Click me!");
    lv_obj_center(lbl);
}
`;

// ── Status ────────────────────────────────────────────────────────────────────
type AppStatus =
  | { kind: "idle" }
  | { kind: "loading";    msg: string }
  | { kind: "running" }
  | { kind: "error";      msg: string };

function statusFromCompiler(s: CompilerStatus): AppStatus {
  switch (s.stage) {
    case "init":     return { kind: "loading", msg: "Initialising compiler…" };
    case "download": return { kind: "loading", msg: "Downloading clang (~100 MB, one-time)…" };
    case "compile":  return { kind: "loading", msg: "Compiling…" };
    default:         return { kind: "idle" };
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function App() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const modRef       = useRef<EmscriptenModule | null>(null);
  const editorRef    = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const layoutRef    = useRef<HTMLDivElement>(null);
  const editorPaneRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<AppStatus>({ kind: "idle" });
  const [splitPct, setSplitPct] = useState(50);

  useEffect(() => {});

  // ── Load LVGL WASM once the canvas is mounted ────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setStatus({ kind: "loading", msg: "Loading LVGL…" });
    initLvgl(canvas)
      .then((mod) => {
        modRef.current = mod;
        setStatus({ kind: "idle" });
        // Auto-run the default example on startup
        doRun(mod, DEFAULT_CODE);
      })
      .catch((e: Error) =>
        setStatus({ kind: "error", msg: e.message })
      );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Core run logic (compile C → instantiate WASM → call user_app) ───────
  const doRun = useCallback(
    async (mod: EmscriptenModule, cCode: string) => {
      try {
        const wasmBytes = await compileC(cCode, (s) => {
          setStatus(statusFromCompiler(s));
        });
        await runCompiledWasm(mod, wasmBytes);
        setStatus({ kind: "running" });
      } catch (e) {
        setStatus({ kind: "error", msg: String(e) });
      }
    },
    []
  );

  // ── Run handler (called by button / Ctrl+Enter) ───────────────────────────
  const handleRun = useCallback(() => {
    const mod = modRef.current;
    if (!mod) return;
    const code = editorRef.current?.getValue() ?? DEFAULT_CODE;
    doRun(mod, code);
  }, [doRun]);

  // ── Keyboard shortcut: Ctrl/Cmd + Enter ─────────────────────────────────
  const handleEditorMount = useCallback(
    (editor: Monaco.editor.IStandaloneCodeEditor) => {
      editorRef.current = editor;
      editor.addCommand(
        /* Monaco.KeyMod.CtrlCmd | Monaco.KeyCode.Enter */
        (1 << 11) | 3,
        handleRun,
      );
    },
    [handleRun],
  );

  // ── Derived UI state ─────────────────────────────────────────────────────
  const isLoading = status.kind === "loading";
  const isError   = status.kind === "error";
  const canRun    = status.kind !== "loading" && !!modRef.current;

  const statusText =
    status.kind === "loading" ? status.msg :
    status.kind === "running" ? "Running" :
    status.kind === "error"   ? "Error" :
                                "Ready";

  return (
    <div className="root">
      {/* ── Toolbar ── */}
      <div className="header">
        <div className="header-flex">
          <span className="logo">⚡ LVGL Playground</span>
          <span
            className="status"
            style={{
              color: isError   ? "#f85149"
                   : isLoading ? "#58a6ff"
                   : "#3fb950",
            }}
          >
            {statusText}
          </span>
        </div>
        <div className="header-flex">
          <button className="button" disabled={!canRun} onClick={handleRun}>
            ▶&nbsp;Run
          </button>
          <span className="hint">Ctrl+Enter to run</span>
        </div>
      </div>

      {/* ── Main split layout ── */}
      <div ref={layoutRef} className="layout">
        {/* Editor pane */}
        <div ref={editorPaneRef} className="side">
          <div className="side-header">main.c</div>
          <div className="editor-wrapper">
            <MonacoEditor
              defaultLanguage="c"
              defaultValue={DEFAULT_CODE}
              theme="vs-dark"
              onMount={handleEditorMount}
              options={{
                fontSize: 13,
                lineHeight: 20,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 8, bottom: 8 },
                renderLineHighlight: "all",
                tabSize: 4,
              }}
            />
          </div>
        </div>

        {/* Preview pane */}
        <div className="side">
          <div className="side-header">Preview · 480 × 320</div>
          <div className="canvas-wrapper">
            {isLoading && (
              <div className="overlay">{(status as { kind: "loading"; msg: string }).msg}</div>
            )}
            {isError && (
              <div className="overlay overlay-error">
                {(status as { kind: "error"; msg: string }).msg}
              </div>
            )}
            {/* Canvas is always mounted so SDL can bind to it */}
            <canvas
              ref={canvasRef}
              id="canvas"
              width={480}
              height={320}
              className="canvas"
              style={{ opacity: isLoading ? 0 : 1 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
