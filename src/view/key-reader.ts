// Terminal input split into keys, with a short timeout for a lone Esc (gate 5H).
//
// `keysFromChunk` splits one read. What it cannot know is whether an ESC at the very end of a read is
// the Esc key or the first byte of a sequence still on its way — Option+Left over a slow SSH link, a
// mouse report split between two reads. Every terminal program answers this the same way (vim's
// `ttimeout`, tmux's `escape-time`): hold the unfinished tail for a few milliseconds; if the rest
// arrives in that time it is one key, and if nothing does, the ESC was Esc.
//
// The other half of the old trap — Esc and the next key arriving in the *same* read — has no timing
// inside it to go on. `keysFromChunk` now keeps `ESC` + a printable character whole only for the Meta
// keys something binds (`ESC b`, `ESC f`), so Esc then `1` is two keys; Esc then an arrow in one read
// still looks exactly like Option+Arrow, which is what a Mac sends for it, so anything sending keys
// programmatically leaves a pause longer than this timeout after an Esc.
//
// Pure: the caller says what time it is, and schedules the flush — the live loop with its own timer, a
// test with a number.

import { incompleteEscapeAt, keysFromChunk } from "./playback.ts"

export class KeyReader {
  private pending = ""
  private pendingAt = 0

  /**
   * One read from the terminal, arriving at `now`: the keys that are complete. A tail that could still
   * be the start of a sequence is held back — for up to `timeoutMs` — unless the timeout is 0.
   */
  feed(chunk: string, now: number, timeoutMs: number): string[] {
    const keys: string[] = []
    let text = chunk
    if (this.pending !== "") {
      // The rest of a held sequence, in time: one key. Too late: the held bytes were keys of their own.
      if (now - this.pendingAt <= timeoutMs) text = this.pending + chunk
      else keys.push(...keysFromChunk(this.pending))
      this.pending = ""
    }
    const cut = timeoutMs > 0 ? incompleteEscapeAt(text) : -1
    if (cut >= 0) {
      this.pending = text.slice(cut)
      this.pendingAt = now
      text = text.slice(0, cut)
    }
    keys.push(...keysFromChunk(text))
    return keys
  }

  /** Whether a tail is being held, and when it will count as keys of its own. */
  deadline(timeoutMs: number): number | null {
    return this.pending === "" ? null : this.pendingAt + timeoutMs
  }

  /** The timeout ran out: whatever was held is keys of its own — a lone ESC is Esc. */
  flush(): string[] {
    const held = this.pending
    this.pending = ""
    return keysFromChunk(held)
  }
}
