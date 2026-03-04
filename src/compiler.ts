/**
 * compiler.ts  —  In-browser C → WASM compiler using @wasmer/sdk.
 *
 * Uses the "clang/clang" package from the Wasmer registry, which is a full
 * Clang toolchain compiled to run as a WASI binary inside Wasmer's runtime.
 *
 * The compilation target is wasm32 (bare metal, no WASI runtime needed for
 * the output).  All LVGL symbols are left as undefined imports — the runtime
 * bridge provides them at WebAssembly.instantiate() time.
 */

import { init, Wasmer, Directory } from "@wasmer/sdk";

// ── Singleton state ──────────────────────────────────────────────────────────
let _wasmerInitialized = false;
let _clangPkg: Awaited<ReturnType<typeof Wasmer.fromRegistry>> | null = null;

async function ensureWasmer(): Promise<typeof _clangPkg> {
  if (!_wasmerInitialized) {
    await init();
    _wasmerInitialized = true;
  }
  if (!_clangPkg) {
    _clangPkg = await Wasmer.fromRegistry("clang/clang");
  }
  return _clangPkg;
}

// ── LVGL header content ──────────────────────────────────────────────────────
// Fetched once and reused across compilations.
let _lvglHeader: string | null = null;

async function getLvglHeader(): Promise<string> {
  if (_lvglHeader) return _lvglHeader;
  const resp = await fetch("/include/lvgl.h");
  if (!resp.ok) throw new Error(`Failed to fetch lvgl.h: ${resp.status}`);
  _lvglHeader = await resp.text();
  return _lvglHeader;
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface CompileResult {
  wasm: Uint8Array;
  stderr: string;
}

export class CompileError extends Error {
  constructor(
    public readonly stderr: string,
    message?: string,
  ) {
    super(message ?? stderr);
    this.name = "CompileError";
  }
}

/**
 * Compile a C source string to a WebAssembly binary.
 *
 * The resulting WASM module:
 *  - exports `user_app` (the function the user defined)
 *  - imports all called LVGL functions from the "env" namespace
 *  - has its own linear memory (separate from the LVGL runtime)
 *
 * @param code        C source code containing `void user_app(void) { … }`
 * @param onProgress  Optional status callback for UI progress messages
 */
export async function compileC(
  code: string,
  onProgress?: (msg: string) => void,
): Promise<CompileResult> {
  onProgress?.("Initializing compiler…");
  const clang = await ensureWasmer();

  onProgress?.("Fetching LVGL headers…");
  const lvglH = await getLvglHeader();

  onProgress?.("Compiling…");

  // Virtual directory shared between JS and the running clang process
  const workDir = new Directory();
  await workDir.writeFile("user.c", code);

  const instance = await clang!.entrypoint!.run({
    args: [
      // argv[0] — the program name
      "clang",
      // Input / output
      "/work/user.c",
      "-o", "/work/user.wasm",
      // Target: bare wasm32, no OS, no libc
      "-target", "wasm32",
      "-nostdlib",
      // Linker flags passed through to wasm-ld
      "-Wl,--no-entry",         // no _start/_main required
      "-Wl,--allow-undefined",  // LVGL symbols resolved at JS instantiation
      "-Wl,--export=user_app",  // only export the user entry point
      // Include path for our minimal lvgl.h
      "-I/include",
      // Optimise lightly — fast compile, decent output
      "-O1",
    ],
    mount: {
      "/work": workDir,
      "/include": {
        "lvgl.h": lvglH,
      },
    },
  });

  const output = await instance.wait();

  const stderr = output.stderr ?? "";

  if (!output.ok) {
    throw new CompileError(stderr);
  }

  onProgress?.("Reading output…");
  const wasm = await workDir.readFile("user.wasm");

  return { wasm, stderr };
}
