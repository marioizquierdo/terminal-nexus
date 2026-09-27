// Stands in for `src/view/backends/opentui.ts` in the browser build (`scripts/lib/web-bundle.mjs`).
// OpenTUI draws to a real terminal through native code, so it cannot be bundled for a browser — and
// the page never asks for it: it hands every screen loop its canvas backend by object, never by name.

import type { BackendOptions, NamedBackend } from "../view/backends/index.ts"

export async function createOpenTuiBackend(options: BackendOptions): Promise<NamedBackend> {
  void options
  throw new Error("OpenTUI draws to a real terminal; the browser page presents through its canvas")
}
