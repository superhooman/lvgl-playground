import { useRef, useState, useCallback, useEffect } from "react";
import MonacoEditor from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { initLvgl, runUserWasm, type LvglEmModule } from "./runtime";
import { compileC, CompileError } from "./compiler";

import "./styles/app.css";

// ── Default example ───────────────────────────────────────────────────────────
const DEFAULT_CODE = `#include "lvgl.h"

void user_app(void)
{
    lv_obj_t *scr = lv_scr_act();
    lv_obj_set_style_bg_color(scr, lv_color_hex(0x000000), LV_PART_MAIN);

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
    lv_obj_t *btn = lv_button_create(scr);
    lv_obj_set_size(btn, 130, 44);
    lv_obj_align(btn, LV_ALIGN_CENTER, 0, 60);

    lv_obj_t *lbl = lv_label_create(btn);
    lv_label_set_text(lbl, "Click me!");
    lv_obj_center(lbl);
}
`;

// ── Status type ───────────────────────────────────────────────────────────────
type Status =
  | { kind: "idle" }
  | { kind: "loading-lvgl" }
  | { kind: "compiling"; progress: string }
  | { kind: "running" }
  | { kind: "error"; msg: string; isCompile: boolean };

// ── Component ─────────────────────────────────────────────────────────────────
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modRef = useRef<LvglEmModule | null>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  const [status, setStatus] = useState<Status>({ kind: "loading-lvgl" });

  // ── Load LVGL Emscripten runtime once ──────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    initLvgl(canvas)
      .then((mod) => {
        modRef.current = mod;
        setStatus({ kind: "idle" });
      })
      .catch((e: Error) =>
        setStatus({ kind: "error", msg: e.message, isCompile: false }),
      );
  }, []);

  // ── Compile + run ──────────────────────────────────────────────────────
  const handleRun = useCallback(async () => {
    const mod = modRef.current;
    if (!mod) return;

    const code = editorRef.current?.getValue() ?? DEFAULT_CODE;

    try {
      const result = await compileC(code, (progress) =>
        setStatus({ kind: "compiling", progress }),
      );

      setStatus({ kind: "compiling", progress: "Instantiating…" });
      await runUserWasm(result.wasm, mod);
      setStatus({ kind: "running" });
    } catch (e) {
      if (e instanceof CompileError) {
        setStatus({ kind: "error", msg: e.stderr, isCompile: true });
      } else {
        setStatus({
          kind: "error",
          msg: e instanceof Error ? e.message : String(e),
          isCompile: false,
        });
      }
    }
  }, []);

  // ── Keyboard shortcut: Ctrl/Cmd + Enter ───────────────────────────────
  const handleEditorMount = useCallback(
    (editor: Monaco.editor.IStandaloneCodeEditor) => {
      editorRef.current = editor;
      editor.addCommand(
        // CtrlCmd=2048, Enter=3
        (1 << 11) | 3,
        () => void handleRun(),
      );
    },
    [handleRun],
  );

  // ── Derived UI state ──────────────────────────────────────────────────
  const isLoading = status.kind === "loading-lvgl";
  const isCompiling = status.kind === "compiling";
  const isError = status.kind === "error";
  const canRun = !isLoading && !isCompiling && !!modRef.current;

  const statusLabel =
    status.kind === "idle" ? "Ready" :
    status.kind === "loading-lvgl" ? "Loading LVGL…" :
    status.kind === "compiling" ? status.progress :
    status.kind === "running" ? "Running" :
    "Error";

  const statusColor =
    isError ? "#f85149" :
    isLoading || isCompiling ? "#58a6ff" :
    status.kind === "running" ? "#3fb950" :
    "#8b949e";

  return (
    <div className="root">
      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div className="header">
        <div className="header-flex">
          <span className="logo">⚡ LVGL Playground</span>
          <span className="status" style={{ color: statusColor }}>
            {statusLabel}
          </span>
        </div>
        <div className="header-flex">
          <button
            className="button"
            disabled={!canRun}
            onClick={() => void handleRun()}
          >
            {isCompiling ? "⏳" : "▶"}&nbsp;{isCompiling ? "Compiling…" : "Run"}
          </button>
          <span className="hint">Ctrl+Enter</span>
        </div>
      </div>

      {/* ── Split layout ─────────────────────────────────────────────── */}
      <div className="layout">
        {/* Editor pane */}
        <div className="side">
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

          {/* Compiler output panel */}
          {isError && (status as Extract<Status, { kind: "error" }>).isCompile && (
            <pre className="compile-output">
              {(status as Extract<Status, { kind: "error" }>).msg}
            </pre>
          )}
        </div>

        {/* Preview pane */}
        <div className="side">
          <div className="side-header">Preview · 480 × 320</div>
          <div className="canvas-wrapper">
            {isLoading && (
              <div className="overlay">Loading LVGL runtime…</div>
            )}
            {isError &&
              !(status as Extract<Status, { kind: "error" }>).isCompile && (
                <div className="overlay overlay-error">
                  {(status as Extract<Status, { kind: "error" }>).msg}
                </div>
              )}
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
