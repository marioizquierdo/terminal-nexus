// Debug Mode (gate 5G): the Build Phase's live-editable development flags — an experiment harness
// that lets the owner feel two answers to an open question during a playtest, instead of reading a
// paragraph about them or asking for a new command-line flag (AGENTS.md Section 5, engine.md 9.7).
//
// **Every flag names the question it serves, and is deleted once that question is answered.** A few
// may graduate into real settings; none of them is one yet, so nothing here is saved: the flags live
// in `BuildState.debug` for as long as the screen is open, and `--scroll-margin` still sets where the
// scroll margin starts.
//
// Where each flag is read:
//
// - `smartCursor`, `scrollMargin`, `startFocus`, `clickScroll`, `clickZone`, `armedClickScrolls` and
//   `fastRecentres` change what a command does, so the reducer reads them from the state it is handed
//   — never from a global — and a driver script replays them exactly;
// - the speed tiers and key timings (`slowStep` through `slowAfterTurn`, gate 5H) decide how big a
//   move the input path sends: the session's key-repeat tracker reads them (`src/build/motion.ts`),
//   and the reducer only ever sees an ordinary `move-cursor` of the size they chose;
// - `easeMs`, the flash durations, `refusedCursorMs` and `escTimeoutMs` are presentation and input
//   timing: the reducer stores them and nothing else, and the live loop (`src/cli/spike.ts`, through
//   `src/view/build-live.ts`) reads them;
// - the placement juice (`placeFramesMs`, `placeGlowMs`, `placeParticles`, `placeLight`, gate 5I) is
//   presentation alone: the reducer stores it, the live loop times it, and the Build Phase view draws
//   it (`src/view/placement.ts`). A plan is identical with every one of them on or off.
//
// None of them reaches the simulation kernel (`src/pulse`, `src/state`): a Build Phase plan is a plan
// on a screen until the Pulse, and nothing here is part of it.

import type { Focus } from "./types.ts"

/**
 * What a click on the map does to the view while nothing is armed (feedback F6, gate 5H):
 *
 * - `edges`: a click inside an edge zone scrolls, further the nearer the edge — at the very edge the
 *   clicked tile comes to the middle of the view, at the zone's inner boundary nothing moves;
 * - `centre`: every click centres the view on the clicked tile;
 * - `margin`: the scroll margin alone, as every gate before 5H did.
 */
export type ClickScroll = "edges" | "centre" | "margin"

/** How many sparks fly off a building as it finishes (gate 5I, feedback F9). */
export type PlaceParticles = "off" | "few" | "many"

/** The light on a building's characters as it finishes (gate 5I, feedback F9): a flash toward the
 *  theme's strongest ink that settles back, the theme's rainbow hues sweeping across it, or none. */
export type PlaceLight = "off" | "light" | "rainbow"

export type DebugFlags = Readonly<{
  /** F9: how long a placed building takes to rise through its placement frames, in milliseconds; 0
   *  shows it finished at once. */
  placeFramesMs: number
  /** F9: how long the light and the particles take to settle once the building is finished; 0 is
   *  neither. */
  placeGlowMs: number
  /** F9: the burst of particles around the footprint. */
  placeParticles: PlaceParticles
  /** F9: the light on the building's own characters. */
  placeLight: PlaceLight
  /** Q54: how close to the view's edge the cursor gets before the camera follows, as a **percentage**
   *  of the view's own width (for the sides) and height (for the top and bottom). A number of tiles
   *  until gate 5H. */
  scrollMargin: number
  /** F6: what a click does to the view while exploring. */
  clickScroll: ClickScroll
  /** F6: how deep each edge zone of `clickScroll: "edges"` is, as a percentage of the view. */
  clickZone: number
  /** Q58: whether a click with a building armed may scroll the view. Off: it moves the cursor only,
   *  so the confirming second click lands on the tile under the preview. */
  armedClickScrolls: boolean
  /** How long the drawn view takes to slide to a new camera position, in milliseconds; 0 jumps. The
   *  live loop's alone — state and every command use the camera's target. */
  easeMs: number
  /** Whether a fast move (Shift, Option, PageUp/Home) re-centres the view on the cursor along the
   *  axis it moved, rather than only dragging it to the margin (engine.md 3.3). */
  fastRecentres: boolean
  /** Q54's four speed tiers, in tiles per step: a tap (and a held arrow just after a turn); each
   *  repeat of a held arrow at first; each repeat once held for `rampMs`; and every fast move. */
  slowStep: number
  normalStep: number
  fastStep: number
  fasterStep: number
  /** How long an arrow has to be held before its repeats go from the normal step to the fast one. */
  rampMs: number
  /** Terminals send no key-up: two presses of one arrow at most this far apart are one held key. */
  repeatGapMs: number
  /** The longest pause a terminal leaves before it starts repeating a held key. A press of the same
   *  arrow within it may be the first repeat, so a slow-after-a-turn hold survives it; a press of a
   *  different arrow within it is a change of direction. */
  repeatDelayMs: number
  /** Whether a change of direction drops a held arrow to the slow step, for precise pointing, until
   *  the arrow is let go or anything else is pressed. */
  slowAfterTurn: boolean
  /** How long the cursor flashes when a placement is tried and refused, in milliseconds. */
  refusedCursorMs: number
  /** How long a lone Esc at the end of a read waits for the rest of a key sequence before it counts
   *  as Esc, in milliseconds; 0 is not at all. */
  escTimeoutMs: number
  /** Q55: arming from the menu moves the cursor beside the last thing planned. */
  smartCursor: boolean
  /** Which half of the screen has the keyboard when the Build Phase opens — a guess gate 5F made. */
  startFocus: Focus
  /** How long a menu row's "pressed" flash lasts, in milliseconds. */
  pressedFlashMs: number
  /** How long a menu row's "refused" flicker lasts, in milliseconds. */
  refusedFlashMs: number
}>

export type DebugField = keyof DebugFlags

/** When a change is seen: at once, or only once the Build Phase starts over. */
export type DebugApplies = "now" | "restart"

type FieldSpec<F extends DebugField> = Readonly<{
  field: F
  /** The row's name, short enough for the narrowest popup. */
  label: string
  applies: DebugApplies
  /** The question the flag exists to answer, in plain words. Shown under the list for the
   *  highlighted row; the open-questions id, where there is one, in parentheses at the end. */
  question: string
  /** The values Left/Right walk, in order. A number the list does not hold (a `--scroll-margin` of
   *  12, say) steps to its nearest neighbour in the direction asked. */
  values: readonly DebugFlags[F][]
  /** Whether stepping past either end comes round to the other. True for a choice of two, where
   *  "the next one" is the only thing either arrow can mean; false for a number, where the ends are
   *  real limits. */
  cycles: boolean
  format: (value: DebugFlags[F]) => string
}>

type AnyFieldSpec = { [F in DebugField]: FieldSpec<F> }[DebugField]

const tiles = (value: number): string => `${value} tile${value === 1 ? "" : "s"}`
const millis = (value: number): string => (value === 0 ? "off" : `${value} ms`)
const duration = (value: number): string => `${value} ms`
const percent = (value: number): string => `${value}%`
const onOff = (value: boolean): string => (value ? "on" : "off")

/** The owner's own "about 50 ms" (2026-09-27), the 90 and 140 the live loop was built with, and a
 *  spread either side to feel the difference against. */
const FLASH_VALUES = [0, 50, 90, 140, 250, 400] as const

/** The owner's own "about 20% of the height or width of the screen" (2026-09-26). */
export const DEFAULT_SCROLL_MARGIN_PERCENT = 20

/** The flags, in the order the popup lists them: gate 5I's placement juice first, since it is the
 *  newest thing waiting to be felt, then gate 5H's movement numbers, then gate 5G's. */
export const DEBUG_FIELDS: readonly AnyFieldSpec[] = [
  {
    field: "placeFramesMs",
    label: "Build animation",
    applies: "now",
    question: "How long a new building takes to rise through its frames. Off: it appears finished at once. (F9)",
    values: [0, 200, 300, 450, 600, 900],
    cycles: false,
    format: millis,
  },
  {
    field: "placeLight",
    label: "Lighting",
    applies: "now",
    question: "Light on a building's characters as it finishes: a flash that settles, a rainbow, or none. (F9)",
    values: ["light", "rainbow", "off"],
    cycles: true,
    format: (value: PlaceLight) => value,
  },
  {
    field: "placeParticles",
    label: "Particles",
    applies: "now",
    question: "Sparks thrown out around a building as it finishes: a few, many, or none. (F9)",
    values: ["few", "many", "off"],
    cycles: true,
    format: (value: PlaceParticles) => value,
  },
  {
    field: "placeGlowMs",
    label: "Glow time",
    applies: "now",
    question: "How long the light and the sparks take to settle once the building is finished. (F9)",
    values: [0, 150, 250, 400, 600, 900],
    cycles: false,
    format: millis,
  },
  {
    field: "scrollMargin",
    label: "Scroll margin",
    applies: "now",
    question: "How near the edge the cursor gets before the map scrolls, as a share of the view. Asked for: about 20%. (Q54)",
    values: [0, 5, 10, 15, 20, 25, 30, 35, 40],
    cycles: false,
    format: percent,
  },
  {
    field: "clickScroll",
    label: "Explore click",
    applies: "now",
    question: "Exploring, a click near an edge: edges scrolls more the nearer it is; centres always centres; margin: as before. (F6)",
    values: ["edges", "centre", "margin"],
    cycles: true,
    format: (value: ClickScroll) => (value === "centre" ? "centres" : value),
  },
  {
    field: "clickZone",
    label: "Click edge zone",
    applies: "now",
    question: "How deep the edges are where a click scrolls the view (Explore click: edges), as a share of the view. (F6)",
    values: [15, 20, 25, 33, 40, 50],
    cycles: false,
    format: percent,
  },
  {
    field: "armedClickScrolls",
    label: "Armed click scrolls",
    applies: "now",
    question: "With a building armed, may a click scroll the view? Off: the second click always lands under the preview. (Q58)",
    values: [false, true],
    cycles: true,
    format: onOff,
  },
  {
    field: "easeMs",
    label: "View slide",
    applies: "now",
    question: "How long the view takes to slide to where it scrolled. Off: it jumps, as before.",
    values: [0, 50, 100, 150, 200, 300, 500],
    cycles: false,
    format: millis,
  },
  {
    field: "fastRecentres",
    label: "Fast move centres",
    applies: "now",
    question: "Shift+arrow (or Option, PageUp, Home) brings the view along so the cursor stays mid-screen, not at the margin.",
    values: [true, false],
    cycles: true,
    format: onOff,
  },
  {
    field: "slowStep",
    label: "Slow step",
    applies: "now",
    question: "How far a tap moves, and a held arrow just after a change of direction. Asked for: 1. (Q54)",
    values: [1, 2, 3],
    cycles: false,
    format: tiles,
  },
  {
    field: "normalStep",
    label: "Normal step",
    applies: "now",
    question: "How far each repeat of a held arrow moves at first. Asked for: 2. (Q54)",
    values: [1, 2, 3, 4],
    cycles: false,
    format: tiles,
  },
  {
    field: "fastStep",
    label: "Fast step",
    applies: "now",
    question: "How far each repeat moves once the arrow has been held a while (Held to go fast). Asked for: 4. (Q54)",
    values: [2, 3, 4, 5, 6, 8],
    cycles: false,
    format: tiles,
  },
  {
    field: "fasterStep",
    label: "Shift step",
    applies: "now",
    question: "How far Shift+arrow moves, and Option+arrow, PageUp and Home. Asked for: 8; it was 5. (Q54)",
    values: [3, 4, 5, 6, 8, 10, 12, 16],
    cycles: false,
    format: tiles,
  },
  {
    field: "rampMs",
    label: "Held to go fast",
    applies: "now",
    question: "How long an arrow is held before it speeds up from the normal step to the fast one. (Q54)",
    values: [0, 150, 300, 500, 800, 1200],
    cycles: false,
    format: duration,
  },
  {
    field: "repeatGapMs",
    label: "Repeat gap",
    applies: "now",
    question: "Presses of one arrow closer than this count as holding it. Too low: it never speeds up. Too high: quick taps do. (Q54)",
    values: [50, 80, 120, 160, 200, 300],
    cycles: false,
    format: duration,
  },
  {
    field: "repeatDelayMs",
    label: "Repeat delay",
    applies: "now",
    question: "The pause before your terminal repeats a held key. Another arrow within it is a change of direction. (Q54)",
    values: [250, 400, 550, 700, 1000, 1500],
    cycles: false,
    format: duration,
  },
  {
    field: "slowAfterTurn",
    label: "Slow after a turn",
    applies: "now",
    question: "Changing direction drops a held arrow to the slow step, for precise pointing, until you let go. (Q54)",
    values: [true, false],
    cycles: true,
    format: onOff,
  },
  {
    field: "refusedCursorMs",
    label: "Refused cursor",
    applies: "now",
    question: "How long the building under the cursor flashes when you try to build where you cannot.",
    values: [0, 100, 150, 250, 400, 600],
    cycles: false,
    format: millis,
  },
  {
    field: "escTimeoutMs",
    label: "Esc timeout",
    applies: "now",
    question: "How long a lone Esc waits for the rest of a key (Option+arrow over a slow link) before it counts as Esc.",
    values: [0, 10, 25, 50, 100, 200],
    cycles: false,
    format: millis,
  },
  {
    field: "smartCursor",
    label: "Smart cursor",
    applies: "now",
    question:
      "Picking a building from the menu puts the cursor beside the last thing you planned. Off: it stays put. (Q55)",
    values: [true, false],
    cycles: true,
    format: onOff,
  },
  {
    field: "startFocus",
    label: "Opens on",
    applies: "restart",
    question: "Where the keyboard is when the Build Phase opens: the menu, or the map. Built as the menu, a guess.",
    values: ["menu", "grid"],
    cycles: true,
    format: (value: Focus) => (value === "grid" ? "map" : "menu"),
  },
  {
    field: "pressedFlashMs",
    label: "Pressed flash",
    applies: "now",
    question: "How long a menu row flashes when you choose it. Asked for: about 50 ms.",
    values: FLASH_VALUES,
    cycles: false,
    format: millis,
  },
  {
    field: "refusedFlashMs",
    label: "Refused flicker",
    applies: "now",
    question: "How long a row flickers when a key reaches it but does nothing: Left on the menu, or a row you cannot afford.",
    values: FLASH_VALUES,
    cycles: false,
    format: millis,
  },
]

/** The popup's last row, after the flags: start the Build Phase over, keeping them. */
export const DEBUG_RESTART_ROW = DEBUG_FIELDS.length
/** How many rows Up/Down walk in the popup: every flag, then the restart. */
export const DEBUG_ROW_COUNT = DEBUG_FIELDS.length + 1
export const DEBUG_RESTART_QUESTION =
  "Starts this Build Phase over with the settings above, so one marked restart takes effect. The plan is lost."

/** The live loop's flash durations as gate 5F built them — the starting values of the two flags. */
export const DEFAULT_FLASH_MS = { pressed: 90, refused: 140 } as const

/** Gate 5H's movement numbers as built: the owner's own tiers (slow 1, normal 2, fast 4, faster 8),
 *  and this session's first guesses at the timings, for him to retune by feel. */
export const DEFAULT_MOVEMENT = {
  clickScroll: "edges",
  clickZone: 33,
  armedClickScrolls: false,
  easeMs: 150,
  fastRecentres: true,
  slowStep: 1,
  normalStep: 2,
  fastStep: 4,
  fasterStep: 8,
  rampMs: 300,
  repeatGapMs: 120,
  repeatDelayMs: 700,
  slowAfterTurn: true,
  refusedCursorMs: 250,
  escTimeoutMs: 50,
} as const satisfies Partial<DebugFlags>

/** Gate 5I's placement juice as built: this session's first guesses, for the owner to retune by feel. */
export const DEFAULT_PLACEMENT = {
  placeFramesMs: 450,
  placeGlowMs: 400,
  placeParticles: "few",
  placeLight: "light",
} as const satisfies Partial<DebugFlags>

/** The flags a screen opens with: what the context asks for (`--scroll-margin`, a test's
 *  `smartCursor: false`), and otherwise what gates 5F-5H built. */
export function initialDebugFlags(
  context: Readonly<{ scrollMargin?: number; smartCursor?: boolean }>,
): DebugFlags {
  return {
    ...DEFAULT_PLACEMENT,
    ...DEFAULT_MOVEMENT,
    smartCursor: context.smartCursor ?? true,
    scrollMargin: context.scrollMargin ?? DEFAULT_SCROLL_MARGIN_PERCENT,
    startFocus: "menu",
    pressedFlashMs: DEFAULT_FLASH_MS.pressed,
    refusedFlashMs: DEFAULT_FLASH_MS.refused,
  }
}

export function fieldSpec(field: DebugField): AnyFieldSpec {
  return DEBUG_FIELDS.find((spec) => spec.field === field) as AnyFieldSpec
}

/** The flag on popup row `row`, or `null` for the restart row (or anything past it). */
export function fieldAtRow(row: number): DebugField | null {
  return DEBUG_FIELDS[row]?.field ?? null
}

export function rowOfField(field: DebugField): number {
  return DEBUG_FIELDS.findIndex((spec) => spec.field === field)
}

/** A flag's current value, as the popup shows it. */
export function formatDebugValue(flags: DebugFlags, field: DebugField): string {
  const spec = fieldSpec(field) as FieldSpec<DebugField>
  return (spec.format as (value: DebugFlags[DebugField]) => string)(flags[field])
}

/** The value one step from `current`, or `null` at the end of a list that does not cycle. */
function stepValue<T>(values: readonly T[], current: T, step: -1 | 1, cycles: boolean): T | null {
  const index = values.indexOf(current)
  if (index >= 0) {
    const next = index + step
    if (next >= 0 && next < values.length) return values[next] as T
    return cycles ? (values[(next + values.length) % values.length] as T) : null
  }
  // A number the list does not hold: its nearest neighbour in the direction asked.
  if (typeof current !== "number") return values[0] ?? null
  const numbers = values as readonly number[]
  const found = step > 0 ? numbers.find((value) => value > current) : [...numbers].reverse().find((value) => value < current)
  return (found ?? null) as T | null
}

export type DebugAdjustment = Readonly<{ flags: DebugFlags; changed: boolean }>

/** One Left (`-1`) or Right (`+1`) on a flag. A number at the end of its range stays put and says
 *  so (`changed: false`); a choice of two comes round. */
export function adjustDebug(flags: DebugFlags, field: DebugField, step: -1 | 1): DebugAdjustment {
  const spec = fieldSpec(field) as FieldSpec<DebugField>
  const next = stepValue<DebugFlags[DebugField]>(spec.values, flags[field], step, spec.cycles)
  if (next === null || next === flags[field]) return { flags, changed: false }
  return { flags: { ...flags, [field]: next }, changed: true }
}

/** How long the live loop shows an acknowledgement of this kind. Zero means not at all. */
export function flashDuration(flags: DebugFlags, kind: "pressed" | "refused"): number {
  return kind === "pressed" ? flags.pressedFlashMs : flags.refusedFlashMs
}
