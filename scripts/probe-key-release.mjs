// Does this terminal tell us when a key is let go? (Mario, 2026-09-29: "Do we rely on the OS keyboard
// settings, or can we handle our key-press fate ourselves on the terminal? I really hope we can
// reliably manage key-press vs key-hold on all platforms".)
//
// A classic terminal sends bytes only when a key goes down — and, while it is held, the operating
// system's key repeat sends the same bytes again at the OS's own delay and rate. There is no "key up"
// in that stream, so a game can only guess "held" from the gaps between presses (what
// `src/build/motion.ts` does today). Two newer protocols add real key-up events:
//
//   - the **kitty keyboard protocol** (kitty, WezTerm, Ghostty, foot, Alacritty, and recent iTerm2 —
//     each to be measured, not assumed): push flags with `CSI > flags u`; flag 2 ("report event
//     types") marks every key event as a press (1), a repeat (2) or a release (3), e.g. Right held
//     then let go is `CSI 1;1:1 C` … `CSI 1;1:2 C` … `CSI 1;1:3 C`;
//   - **win32-input-mode** (Windows Terminal): `CSI ? 9001 h`, one `CSI … _` record per key down and
//     key up.
//
// This probe asks for the kitty protocol, says whether the terminal answered, then prints every key
// event with its kind and the milliseconds since the one before. Hold an arrow, let it go, tap it a few
// times; `q` quits. Run it in the terminal you play in:
//
//   node scripts/probe-key-release.mjs
//
// If the lines say "release", the game can know exactly when a key is held and when it is let go, and
// taps can move exactly one tile each whatever the OS repeat settings are. If they only say "legacy",
// this terminal gives presses and OS repeats only, and timing is all there is.

const ESC = "\u001b"
const out = (text) => process.stdout.write(`${text}\r\n`)

if (!process.stdin.isTTY) {
  out("probe-key-release: run this in a real terminal (stdin is not a TTY).")
  process.exit(1)
}

process.stdin.setRawMode(true)
process.stdin.resume()
process.stdin.setEncoding("binary")

// Ask what the terminal supports: the kitty query (`CSI ? u`), then Primary Device Attributes
// (`CSI c`), which every terminal answers — so an answer to the second with none to the first means
// "no kitty protocol here".
let kittyFlags = null
let answered = false
process.stdout.write(`${ESC}[?u${ESC}[c`)

const EVENT = { 1: "press", 2: "repeat", 3: "release" }
const NAMES = { A: "Up", B: "Down", C: "Right", D: "Left", H: "Home", F: "End", 13: "Enter", 27: "Esc", 32: "Space", 9: "Tab", 127: "Backspace" }
let last = null

function since() {
  const now = performance.now()
  const gap = last === null ? "" : ` +${Math.round(now - last)} ms`
  last = now
  return gap
}

function describe(sequence) {
  // CSI [number] ; [modifiers[:event]] final   — kitty's form, arrows and letters alike.
  const match = /^\u001b\[(\d*)(?:;(\d*)(?::(\d))?)?([A-Za-z~u])$/.exec(sequence)
  if (match !== null) {
    const [, number, modifiers, event, final] = match
    const key =
      final === "u" ? (NAMES[number] ?? String.fromCodePoint(Number(number))) : final === "~" ? `key ${number}` : (NAMES[final] ?? final)
    const shift = modifiers !== undefined && modifiers !== "" && ((Number(modifiers) - 1) & 1) === 1 ? "Shift+" : ""
    return `${shift}${key} ${event === undefined ? "press (no event type)" : (EVENT[event] ?? `event ${event}`)}`
  }
  return `legacy ${JSON.stringify(sequence)}`
}

function quit() {
  // Pop the flags we pushed, whatever they were, and leave the terminal as we found it.
  process.stdout.write(`${ESC}[<u`)
  process.stdin.setRawMode(false)
  out("probe-key-release done")
  process.exit(0)
}

process.stdin.on("data", (chunk) => {
  // Split a chunk into escape sequences and single characters.
  const parts = chunk.match(/\u001b\[[\d;:?]*[A-Za-z~u]|\u001b.|[\s\S]/g) ?? []
  for (const part of parts) {
    const query = /^\u001b\[\?(\d+)u$/.exec(part)
    if (query !== null) {
      kittyFlags = Number(query[1])
      continue
    }
    if (/^\u001b\[\?[\d;]*c$/.test(part)) {
      if (!answered) {
        answered = true
        if (kittyFlags === null) {
          out("This terminal did not answer the kitty keyboard query: presses and OS repeats only, no key-up.")
          out("Keys below are shown as they arrive; q quits.")
        } else {
          // Flags 1 (disambiguate) + 2 (report event types): press, repeat and release for every key.
          process.stdout.write(`${ESC}[>3u`)
          out(`Kitty keyboard protocol supported (current flags ${kittyFlags}); asked for press/repeat/release.`)
          out("Hold an arrow, let it go, tap it a few times; q quits.")
        }
      }
      continue
    }
    if (part === "q" || /^\u001b\[113(;\d*(:1)?)?u$/.test(part)) quit()
    if (/^\u001b\[113;\d*:3u$/.test(part)) continue
    out(`${describe(part).padEnd(34)}${since()}`)
  }
})

setTimeout(() => {
  if (!answered) out("No answer to the terminal queries after a second; keys below are shown as they arrive; q quits.")
}, 1000)
