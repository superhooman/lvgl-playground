/**
 * In-browser C compiler using the Wasmer SDK.
 *
 * Uses `clang/clang` from the Wasmer registry (~100 MB, cached by the browser
 * after the first download) to compile user C code to a bare wasm32 module.
 *
 * The output WASM:
 *  - Targets wasm32-unknown-unknown (no WASI runtime required)
 *  - Has undefined LVGL symbols as WASM imports (filled by wasm-runner.ts)
 *  - Exports `user_app` which is called to run the user's code
 */

import { init, Wasmer, Directory } from "@wasmer/sdk";
import { LVGL_STUB_H } from "./lvgl-stub";

type CompilerStatus =
  | { stage: "idle" }
  | { stage: "init" }        // Wasmer SDK loading
  | { stage: "download" }    // clang package downloading
  | { stage: "compile" }     // compilation running
  | { stage: "done"; wasm: Uint8Array }
  | { stage: "error"; message: string };

export type { CompilerStatus };

// ── Singletons (initialized once, reused across calls) ────────────────────
let sdkInitialized = false;
let clangPkg: Wasmer | null = null;

export type OnStatusChange = (s: CompilerStatus) => void;

async function ensureClang(onStatus: OnStatusChange): Promise<Wasmer> {
  if (!sdkInitialized) {
    onStatus({ stage: "init" });
    await init();
    sdkInitialized = true;
  }

  if (!clangPkg) {
    onStatus({ stage: "download" });
    clangPkg = await Wasmer.fromRegistry("clang/clang");
  }

  return clangPkg;
}

/**
 * Compile C source to a wasm32 binary.
 *
 * @param cSource   Full C source including #include "lvgl.h"
 * @param onStatus  Called as the pipeline progresses
 * @returns         Raw WASM bytes of the compiled module
 */
export async function compileC(
  cSource: string,
  onStatus: OnStatusChange = () => {}
): Promise<Uint8Array> {
  const clang = await ensureClang(onStatus);

  onStatus({ stage: "compile" });

  // Virtual directories mounted into the clang process
  const outDir = new Directory();

  const instance = await clang.entrypoint!.run({
    args: [
      // Target bare wasm32 — no WASI runtime, no system libs
      "--target=wasm32-unknown-unknown",
      "-nostdlib",
      // Linker flags
      "-Wl,--no-entry",           // no _start required
      "-Wl,--allow-undefined",    // LVGL symbols satisfied at JS instantiation
      "-Wl,--export=user_app",    // export the user's entry point
      // Compiler flags
      "-O1",
      "-Wall",
      "-Wno-unused-function",
      // Include path — /src contains lvgl.h
      "-I/src",
      // Input / output
      "/src/user.c",
      "-o", "/out/user.wasm",
    ],
    mount: {
      "/src": {
        "user.c":  cSource,
        "lvgl.h":  LVGL_STUB_H,
      },
      "/out": outDir,
    },
  });

  const result = await instance.wait();

  if (!result.ok) {
    const stderr = result.stderr.trim() || "(no compiler output)";
    throw new Error(stderr);
  }

  const wasm = await outDir.readFile("/user.wasm");
  onStatus({ stage: "done", wasm });
  return wasm;
}
