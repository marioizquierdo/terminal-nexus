// The Shift+Arrow survey — Milestone 5 gate 5A, and the one assumption in `engine.md` 9.7's keymap
// that a terminal can silently break. The input model binds Shift+Arrow to a five-tile cursor jump
// and says, in the same breath, that modified arrows "are swallowed or remapped on some terminal and
// multiplexer configurations" and that the spike must check rather than assume.
//
//   node scripts/probe-modified-keys.mjs
//
// Two legs, because neither one alone is honest:
//
//   claimed   every terminal description installed on this machine, read straight out of terminfo
//             (`infocmp -x`). `kUP`/`kDN`/`kLFT`/`kRIT` are the shifted arrows; a terminal that does
//             not define them is telling you it has none. This covers terminals nobody here can run.
//   delivered one real pseudo-terminal, driven for real: tmux runs a raw-mode key echo, the keys are
//             sent by name, and what the program actually received is read back off the pane. This
//             covers exactly one configuration, and says so.
//
// A terminal that appears in neither leg is untested, and the report says untested — not "supported".

import { execFileSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { killSession, pane, tmux, waitFor } from "./lib/terminal-capture.mjs"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const SESSION = "terminal-nexus-keyprobe"

/**
 * The terminal descriptions worth asking about: the emulators and multiplexers a terminal game is
 * realistically launched from, plus the two consoles that are the interesting negative cases. Each
 * entry that is not installed here is reported as such rather than guessed at.
 */
const TERMINFO_NAMES = [
  "xterm",
  "xterm-256color",
  "screen",
  "screen-256color",
  "tmux",
  "tmux-256color",
  "linux",
  "vt100",
  "vt220",
  "ansi",
  "rxvt",
  "rxvt-unicode-256color",
  "putty",
  "alacritty",
  "xterm-kitty",
  "wezterm",
  "xterm-ghostty",
  "iterm2",
  "vte-256color",
  "ms-terminal",
  "konsole-256color",
  "foot",
]

/** Terminfo capability names: the shifted arrows first, then the modifier-free fallback candidates. */
const CAPABILITIES = [
  ["kUP", "Shift+Up"],
  ["kDN", "Shift+Down"],
  ["kLFT", "Shift+Left"],
  ["kRIT", "Shift+Right"],
  ["kpp", "PageUp"],
  ["knp", "PageDown"],
  ["khome", "Home"],
  ["kend", "End"],
]

function readable(value) {
  return value.replace(/\\E/g, "ESC ").replace(/\\s/g, " ").trim()
}

function terminfoFor(name) {
  let dump = ""
  try {
    dump = execFileSync("infocmp", ["-x", "-1", name], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
  } catch {
    return null
  }
  const found = {}
  for (const line of dump.split("\n")) {
    const match = /^\s*([A-Za-z0-9]+)=(.*?),?\s*$/.exec(line)
    if (match === null) continue
    found[match[1]] = readable(match[2])
  }
  return found
}

console.log("## Leg 1 — what each terminal description claims it sends (infocmp -x)\n")
const header = ["terminal", ...CAPABILITIES.map(([, label]) => label)]
const rows = [header]
const missing = []
for (const name of TERMINFO_NAMES) {
  const found = terminfoFor(name)
  if (found === null) {
    missing.push(name)
    continue
  }
  rows.push([name, ...CAPABILITIES.map(([capability]) => found[capability] ?? "—")])
}
const widths = header.map((_, column) => Math.max(...rows.map((row) => row[column].length)))
for (const [index, row] of rows.entries()) {
  console.log(row.map((cell, column) => cell.padEnd(widths[column])).join("  "))
  if (index === 0) console.log(widths.map((width) => "-".repeat(width)).join("  "))
}
if (missing.length > 0) {
  console.log(`\nNo terminfo entry installed here, so not surveyed: ${missing.join(", ")}`)
}

console.log("\n## Leg 2 — what one real pseudo-terminal actually delivered (tmux 3.4)\n")

/** tmux key names, and the plain-English name of what a person would press. */
const SENT = [
  ["Up", "Up"],
  ["S-Up", "Shift+Up"],
  ["S-Down", "Shift+Down"],
  ["S-Left", "Shift+Left"],
  ["S-Right", "Shift+Right"],
  ["PPage", "PageUp"],
  ["NPage", "PageDown"],
  ["Home", "Home"],
  ["End", "End"],
  ["C-Up", "Ctrl+Up"],
]

killSession(repoRoot, SESSION)
tmux(repoRoot, [
  "new-session",
  "-d",
  "-s",
  SESSION,
  "-x",
  "80",
  "-y",
  "40",
  "node scripts/lib/key-echo.mjs",
])
waitFor(repoRoot, SESSION, (text) => text.includes("key-echo ready"), "the key echo to start")

for (const [key] of SENT) {
  tmux(repoRoot, ["send-keys", "-t", SESSION, key])
  waitFor(
    repoRoot,
    SESSION,
    (text) => text.split("\n").filter((line) => line.startsWith("GOT ")).length >= 1,
    `a reply to ${key}`,
  )
  // One line per key: read the pane after each send rather than all at once, so a key that delivers
  // nothing at all shows up as a missing line rather than silently shifting every later row up.
  const lines = pane(repoRoot, SESSION).split("\n").filter((line) => line.startsWith("GOT "))
  const last = lines[lines.length - 1] ?? ""
  console.log(`${key.padEnd(9)} ${SENT.find(([name]) => name === key)[1].padEnd(12)} ${last.slice(4)}`)
}
tmux(repoRoot, ["send-keys", "-t", SESSION, "-l", "q"])
killSession(repoRoot, SESSION)

console.log(`\nTERM inside the pane: ${execFileSync("tmux", ["-V"], { encoding: "utf8" }).trim()}, default configuration, no tmux.conf.`)
console.log("Every line above is one measurement, on one machine. Nothing here says what an untested emulator does.")
