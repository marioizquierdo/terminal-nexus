// A status line's own semantic vocabulary — shared by every screen that has one (the Build Phase
// today, the Nexus Pulse view later), so "what just happened, or why it did not" stays one small,
// consistent type rather than each screen inventing its own plain string. Deliberately view-agnostic:
// nothing here imports a style role or a colour. `src/view/status.ts` is the one place a tone
// resolves onto how it actually looks.

import type { Coord } from "./grid/types.ts"

/** How a status message reads, not what colour it is — the renderer decides that. */
export type StatusTone = "neutral" | "success" | "warning" | "danger"

export type StatusMessage = Readonly<{
  text: string
  /** Defaults to `"neutral"` wherever omitted, so every existing plain-string message becomes one of
   *  these without having to name a tone for the common case. */
  tone?: StatusTone
  /** The tile this message is about, when it is about one — a refused placement, so far. Such a
   *  message lapses the moment the cursor leaves that tile, because the screen above it has already
   *  moved on; every other message is about the last action and stays until the next one. Carried on
   *  the message itself rather than beside it, so the two can never disagree about which is which. */
  tile?: Coord
}>

export const NO_STATUS: StatusMessage = { text: "" }

/** The common case: a plain, neutral line — `status("Disarmed.")` reads exactly like the string it
 *  replaces at every call site that does not need a tone. */
export function status(text: string, tone?: StatusTone, tile?: Coord): StatusMessage {
  return {
    text,
    ...(tone === undefined ? {} : { tone }),
    ...(tile === undefined ? {} : { tile }),
  }
}
