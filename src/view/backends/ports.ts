// The terminal as the screen loops actually use it — written down, not invented (engine.md 10.2).
//
// `terminal-nexus`'s menu, its Build Phase, and `grid watch` each need a handful of things from a
// terminal: its size, a way to write bytes, word when it resizes, and the bytes a player types. Node's
// own `process.stdout` and `process.stdin` already have exactly this shape, so the terminal path is
// unchanged. The browser playtest page (`src/web/`) is the second implementation: a stand-in that
// takes the bytes the page's keys and taps produce, and a canvas that paints each finished frame.
// Nothing here decides what the game shows or does — only how bytes and frames get in and out.

/** Where frames and escape sequences go, and where the screen's size comes from. */
export type TerminalOutput = {
  readonly isTTY?: boolean
  readonly columns?: number
  readonly rows?: number
  write(text: string): unknown
  on(event: "resize", listener: () => void): unknown
  off(event: "resize", listener: () => void): unknown
}

/** Where the player's keys and mouse reports come from — as a terminal would send them. The three
 *  raw-mode methods only exist on a real terminal; a backend that needs them checks first. */
export type TerminalInput = {
  readonly isTTY?: boolean
  setRawMode?(mode: boolean): unknown
  resume?(): unknown
  pause?(): unknown
  on(event: "data", listener: (chunk: string | Uint8Array) => void): unknown
  off(event: "data", listener: (chunk: string | Uint8Array) => void): unknown
}

const decoder = new TextDecoder()

/** One read from the input as text. A terminal hands over bytes (a Node `Buffer` is a `Uint8Array`);
 *  the browser page hands over the same bytes already as a string. */
export function chunkText(chunk: string | Uint8Array): string {
  return typeof chunk === "string" ? chunk : decoder.decode(chunk)
}
