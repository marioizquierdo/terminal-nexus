// **Tuned values** — the numbers the owner has settled (docs/ui-patterns.md, "Experiments and tuned
// values"). Each one began as an Experiment (`src/build/debug.ts`): a live flag in Settings he could
// feel two answers to. Once he settles it, his value becomes the default here, with who chose it and
// when, and the Experiment is deleted — so Settings shows only what is still being felt, and a new
// Experiment stands out.
//
// The settled *choices* are not in this table, because they are no longer choices: the code simply
// does them. Settled at the same time (the owner's settings export, 2026-09-30):
//
//   - an exploring click near an edge scrolls further the nearer the edge it lands (feedback F6), in an
//     edge zone `clickZone` deep — "centres every click" and "margin only" are gone;
//   - a click with a building armed scrolls the view as an exploring click does (the owner's 2026-09-28
//     playtest, F22), and a quick double click places where its first click pointed;
//   - a fast move (Shift, Option, PageUp/PageDown, Home/End) drags the view at the margin like any other
//     move and no longer re-centres it;
//   - a building as it finishes is lit by a flash that settles and throws a few sparks (gate 5I, F9) —
//     the rainbow and "many" stay as the effect recipes' own palettes, but nothing in the game picks them;
//   - when a Nexus Pulse's last seconds begin, the view slides to centre on the player's Nexus; and the
//     map's border flashes a faint red when that Nexus is hurt (gate 6A, F45).
//
// Never copy a number from here into prose (a comment, a help line, a document): point at the table, or
// read it, as the Controls page reads `jumpStep`.
//
// Pure data: nothing here reads a clock, a file or a flag, so the reducer, the input path and the view
// may all read it.

const TUNED = {
  // --- Moving the cursor and the view ---------------------------------------------------------------

  /** How near the view's edge the cursor gets before the map scrolls, as a percentage of the view's width (sides) and height (top and bottom); the owner's settings export, 2026-09-30 (25% before; `--scroll-margin` overrides it for one run). */
  scrollMargin: 30,
  /** How deep each edge zone is where an exploring or armed click scrolls the view, as a percentage of the view; the owner's settings export, 2026-09-30. */
  clickZone: 25,
  /** Two left clicks on one screen cell at most this far apart, with a building armed, place it where the first pointed (ms); first guess (gate 5J), kept by the owner, 2026-09-30. */
  doubleClickMs: 400,
  /** How long the drawn view slides to a new camera position (ms); the owner's settings export, 2026-09-30. */
  easeMs: 100,
  /** How long the drawn cursor glides to its new tile (ms); the owner's settings export, 2026-09-30. */
  cursorGlideMs: 100,
  /** How far one press of an arrow moves (tiles); the owner's 2026-09-28 playtest. */
  tapStep: 1,
  /** How far each press of a run moves — a held arrow's repeats, or quick taps (tiles); the owner's 2026-09-28 playtest. */
  holdStep: 2,
  /** How far each press moves once a run has lasted `rampMs` (tiles); the owner's 2026-09-28 playtest. */
  fastStep: 4,
  /** How long a run moves at the hold step before the fast step (ms); the owner's settings export, 2026-09-30 (300 from his 2026-09-28 playtest before). */
  rampMs: 200,
  /** How far the fast move jumps — Shift or Option with an arrow, PageUp/PageDown, Home/End (tiles); the owner's settings export, 2026-09-30 (12 before). */
  jumpStep: 10,
  /** A held fast move jumps again at most this often, so each jump is seen to land (ms); the owner's settings export, 2026-09-30. */
  jumpRepeatMs: 100,
  /** How long a lone Esc at the end of a read waits for the rest of a key sequence before it counts as Esc (ms); the owner's settings export, 2026-09-30. */
  escTimeoutMs: 50,

  // --- Acknowledgements --------------------------------------------------------------------------

  /** How long a menu row flashes when it is chosen, and each "on" of the cursor's blink (ms); gate 5F's number, kept by the owner, 2026-09-30. */
  pressedFlashMs: 90,
  /** How long a row flickers when a key reaches it but does nothing (ms); the owner's settings export, 2026-09-30. */
  refusedFlashMs: 90,
  /** How long the building under the cursor flashes when a placement there is refused (ms); the owner's settings export, 2026-09-29, kept 2026-09-30. */
  refusedCursorMs: 150,
  /** How many times the cursor blinks when the focus arrow lands; the owner's "blink twice in quick succession" (feedback F54), kept 2026-09-30. */
  cursorBlinks: 2,

  // --- A building going up ---------------------------------------------------------------------------

  /** How long a new building takes to rise through its placement frames (ms); the owner's settings export, 2026-09-29, kept 2026-09-30. */
  placeFramesMs: 300,
  /** How long the light and the sparks take to settle once the building is finished (ms); the owner's settings export, 2026-09-30 (250 before). */
  placeGlowMs: 400,
  /** How many sparks a finished (or removed) building throws — "few"; first guess (gate 5I), kept by the owner, 2026-09-30. */
  placeSparks: 6,

  // --- The end of a Nexus Pulse ------------------------------------------------------------------

  /** How long before the fight is seen to stop its timer flashes and a light sweeps the border (ms); the owner's "the last 3 seconds" (feedback F43, 2026-09-29). */
  endWarnMs: 3000,
  /** How long after the fight stops the survivors wait before walking home (ms); the owner's settings export, 2026-09-30. */
  endWalkPauseMs: 500,
  /** How long the walk home takes; the result shows when it ends (ms); the owner's settings export, 2026-09-30. */
  endWalkMs: 1000,
} as const

/** The table's shape with plain numbers, so a test can hand a function a variation of it. */
export type Tuning = { readonly [K in keyof typeof TUNED]: number }

export const TUNING: Tuning = TUNED

/**
 * The names the settled Experiments had in a settings export — every one of them, the choices as well as
 * the numbers. An old export still names them; reading one skips these quietly (`settings-export.ts`),
 * since the value they held is now the code's own, rather than reporting them as names it does not know.
 */
export const SETTLED_EXPERIMENTS: readonly string[] = [
  "cursorBlinks",
  "placeFramesMs",
  "placeGlowMs",
  "placeParticles",
  "placeLight",
  "scrollMargin",
  "clickScroll",
  "clickZone",
  "armedClickScrolls",
  "doubleClickMs",
  "easeMs",
  "cursorGlideMs",
  "fastRecentres",
  "tapStep",
  "holdStep",
  "fastStep",
  "rampMs",
  "jumpStep",
  "jumpRepeatMs",
  "refusedCursorMs",
  "escTimeoutMs",
  "pressedFlashMs",
  "refusedFlashMs",
  "endWarnMs",
  "endWalkPauseMs",
  "endWalkMs",
  "endCentre",
  "redAlerts",
]
