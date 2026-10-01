# Terminal Nexus — portability notes

**Document role:** Where the game can run, what a host must provide, and the refactors that would make it cheaper
**Status:** WORKING — ideas and measurements, not canon. The rule that holds today (the browser page is a development tool, never a platform) is `specs/engine.md` 10.2
**Updated:** 2026-09-29
**License:** Apache-2.0

The Build Phase now runs in three places — a real terminal, the browser playtest page, and a scripted
playtest with no display at all — from the same screen code. That is a sign the seams are in roughly
the right places. Mario's observation (2026-09-29): a keyboard-and-click game with a grid of cells could
run on many more platforms, *as long as map navigation works well*. This note says what that takes.

## 1. What runs where today

```text
kernel (src/pulse, src/state)          the rules; no terminal, no clock          portable
reducer (src/build/state.ts)           state + commands -> state; no clock       portable
adapters (keyboard.ts, mouse.ts,       raw bytes -> named commands               terminal-shaped input
  session.ts, src/menu/*)
view (src/view/build.ts, compose.ts)   state + time -> a grid of styled cells    portable
backend (ansi / opentui / canvas)      a grid of cells -> a surface              one per surface
screen loop (src/cli/spike.ts, ...)    the only clock; input -> command -> draw  terminal-shaped ports
host (src/cli/terminalNexus.ts,        stdin/stdout, settings file, clipboard    per host
  src/web/host.ts)
```

- **The cell frame is the portability contract.** Cells carry style *roles*, never colours, so any
  surface that can draw a character on a coloured square can show the game. The terminal, a `<canvas>`
  and a PNG renderer already do.
- **The browser page runs the terminal's own loops unmodified** (`runMenu`, `runSpike`, `watchPulse`)
  and hands them a stand-in terminal; it converts only frames, key names, taps, settings storage and the
  export. That is why it needed almost no game code, and it is also the part that looks most like a
  workaround (below).

## 2. What a host must provide

1. **A grid of at least 80 × 24 cells** it can fill with a character, a foreground and a background,
   plus bold, dim, underline and inverse. (`TerminalBackend`, `src/view/backends/`.)
2. **Keys and a pointer**, delivered as the commands' raw form today (terminal bytes). Arrows,
   Enter/Space, Esc, Tab, Shift+arrow (or PageUp/PageDown), digits and a few letters; click, right
   click and wheel.
3. **A clock and a frame timer.** The screen loop reads time as a number and runs a timer only while
   something animates.
4. **Somewhere to keep settings**, and optionally a clipboard and a file for the export. Already
   injected (`settingsStore`, `exporter`), which is why the page could swap them.
5. **Passing the driver tests.** The scripted playtest is the acceptance test for any host: the same
   key script must produce the same frames.

"Do not label an untested platform supported" (`AGENTS.md` Section 5) still applies: everything below is
a direction, and only iTerm2 at 80 × 24 is the acceptance target.

## 3. Map navigation is the gate

Everything else on a platform is decoration; if the player cannot move around a map larger than the
screen and point at a tile, the game does not work there. Every host must supply, in whatever native form:

| Capability | Keyboard | Mouse / touch | Gamepad idea |
| --- | --- | --- | --- |
| step one tile | an arrow tap | (tap the tile) | d-pad tap |
| run | hold an arrow | — | hold the stick or d-pad; **analogue deflection is a natural speed** |
| jump 12 | Shift+arrow, PageUp/PageDown | wheel, a key-bar button | shoulder button |
| point at a tile | — | click / tap | cursor follows the stick |
| confirm | Enter, Space | second click, double-tap | A |
| back | Esc, `x` | right click, long-press, the top bar's `back [esc]` | B |

The canon forbids a separate pan mode ("the cursor drives the camera"), so a drag on the map should not
scroll a free camera; the idea that fits is **press-and-drag moves the cursor under the finger, and the
view follows at the margin** — a touch version of exactly what the arrow keys do. Not built.

## 4. Where the code is more terminal-shaped than it needs to be

Ordered by payoff over cost. None is urgent; each is a candidate for a small gate of its own.

1. **An input event that knows about presses and releases.** Today every host turns its input into
   terminal bytes — the page formats a tap as an SGR mouse report and a key-bar press as escape
   sequences — and the adapters decode them again. It works, but bytes carry no "key released", which
   is exactly what Q66 needs, and a gamepad or a touch-hold has no byte form. A small
   `InputEvent` (`{ kind: "key", key, modifiers, phase: "press" | "repeat" | "release" }` and a pointer
   one), with the terminal byte decoder as *one producer* and the browser's `keydown`/`keyup` as
   another, would let the movement ramp use real releases where a host reports them and fall back to
   timing where it does not (`docs/next-steps.md`, Q66's design). Highest payoff.
2. **A host interface for the live loop.** `runSpike` takes `stdout`- and `stdin`-shaped objects
   (`TerminalOutput` / `TerminalInput`, `src/view/backends/ports.ts`) and the browser fakes a TTY to
   satisfy them. A named `ScreenHost` — `present(frame)`, `onInput(cb)`, `size()`, `now()`,
   `requestFrame(cb)`, `storage`, `clipboard` — would let a native or embedded host implement the
   ports directly, and let `requestFrame` be `requestAnimationFrame` on the web instead of `setTimeout`.
3. **`src/cli/spike.ts` does five jobs** (~360 lines): the live loop and the clock, settings saving,
   the export, `--keys`, and layout switching on resize. The loop is portable; the rest is the terminal
   host. Splitting it into a `screenLoop` and a thin terminal wrapper is the cheap first step of (2).
4. **Layout knows cells, not pixels.** Hit targets are counted in cells (the setting's value box is 6
   cells wide "so a finger can hit it"). A host with a different cell-to-pixel ratio wants a minimum
   *physical* size as a layout input.
5. **`capability` is terminal detection.** Settings' `monochrome | color16 | color256 | truecolor` is
   what a terminal can do; a graphical host is always truecolour and should not present the choice.
   Let the host declare which settings it exposes.
6. **Box-drawing in a browser uses the phone's own font**, so the map edge's joins may not tile. A
   canvas backend that draws line and block glyphs itself (as a terminal does) fixes it.
7. **One launch-options module** for `--settings`, `--keys` and friends, shared by the command line and
   the page's address, so a new option cannot reach one and not the other (`--keys` was silently
   dropped once).

## 5. Platform ideas

| Idea | What it needs | Notes |
| --- | --- | --- |
| Phone / tablet (the page) | a hold-repeat for the key bar; landscape layout | the page already knows `pointerdown`/`pointerup`, so a held key-bar arrow can repeat at the game's own cadence with no OS repeat at all |
| Desktop app (Tauri / Electron around the page) | almost nothing | real `keyup`, a real file for the export, distribution without a terminal |
| Steam Deck / gamepad | an adapter from buttons and stick to commands | keyboard-shaped focus already; analogue speed is free |
| Windows Terminal | win32-input-mode for releases | unmeasured; the timing fallback works meanwhile |
| SSH / tmux | nothing | key releases will probably not pass through; the timing tier applies |
| Screen readers | a text adapter | the status line and the Explore Map card are already plain sentences; `scripts/playtest.mjs` prints a frame as text, which is most of one |
| Chat-bot turns (Discord and the like) | render a frame to PNG; commands from messages | the Build Phase is turn-shaped — plan, then Pulse — so asynchronous play fits |
| A native graphical renderer | a `TerminalBackend` that draws sprites | already an adapter by design |

## 6. What not to do

- Do not give the browser page a game loop of its own; it is a way to *see* the terminal's loops.
- Do not let a host reach into the reducer or add commands: hosts translate, the vocabulary stays one.
- Do not require the enhanced path (releases, a pointer, colour); the plain one is the floor.
