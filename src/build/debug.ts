// The **Experiments** (gate 5G's Debug Mode; the lower half of Settings since gate 5J): the Build
// Phase's live-editable development flags — an experiment harness that lets the owner feel two
// answers to an open question during a playtest, instead of reading a paragraph about them or asking
// for a new command-line flag (AGENTS.md Section 5, engine.md 9.7). The names `debug.ts`, `DebugFlags`
// and `BuildState.debug` are the harness's first ones and still stand; renaming them to say
// "experiments" is a pure-rename job for a pull request of its own (docs/next-steps.md).
//
// **Every flag names the question it serves, and is deleted once that question is answered.** A few
// may graduate into real settings; none of them is one yet, so nothing here is saved: the flags live
// in `BuildState.debug` for as long as the screen is open, and `--scroll-margin` still sets where the
// scroll margin starts.
//
// Where each flag is read:
//
// - `scrollMargin`, `clickScroll`, `clickZone`, `armedClickScrolls` and `fastRecentres` change what a command does, so the reducer reads them from the state it is handed
//   — never from a global — and a driver script replays them exactly;
// - the step sizes and key timings (`tapStep` through `jumpRepeatMs`, gate 5H, reworked after the
//   owner's 2026-09-28 playtest) decide how big a move the input path sends: the session's held-key
//   ramp reads them (`src/build/motion.ts`), and the reducer only ever sees an ordinary
//   `move-cursor` of the size they chose;
// - `easeMs`, `cursorGlideMs`, the flash durations, `refusedCursorMs` and `escTimeoutMs` are
//   presentation and input timing: the reducer stores them and nothing else, and the live loop
//   (`src/cli/spike.ts`, through `src/view/build-live.ts`) reads them;
// - the placement juice (`placeFramesMs`, `placeGlowMs`, `placeParticles`, `placeLight`, gate 5I) is
//   presentation alone: the reducer stores it, the live loop times it, and the Build Phase view draws
//   it (`src/view/placement.ts`). A plan is identical with every one of them on or off.
//
// - the Nexus Pulse's ending (`endAlarmLeadMs` through `endCentre`, gate 6A) is presentation alone: the
//   view times it from the Pulse's own clock (`src/view/ending.ts`) and the reducer stores the numbers.
//   `raid` and `crew` pick which placeholder Pulse the next commit starts (`src/build/catalog.ts`) — they
//   change what the kernel is handed, never how it resolves it.
//
// The map's edge is no longer an Experiment: the owner's playtest of 2026-09-29 settled its three
// (feedback F25), and they are the rule now — the map's own edge style (`BuildContext.edgeStyle`,
// `src/view/edge.ts`), the quieter edge colour, and the menu's divider as the Grid's west side
// (`src/build/layout.ts`).
//
// None of them reaches the simulation kernel (`src/pulse`, `src/state`): a Build Phase plan is a plan
// on a screen until the Pulse, and nothing here is part of it.

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

/** How big a raid the placeholder Nexus Pulse brings (gate 6A): none — nobody comes, so the time runs
 *  out; the probe the Build Phase is tuned against; or a heavy raid that needs a real defence. */
export type RaidSize = "none" | "probe" | "heavy"

/** Whether the player starts the placeholder Pulse with units of their own (gate 6A). None means the
 *  Nexus and what was built are all that stand between the raid and a lost Pulse. */
export type CrewSize = "some" | "none"

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
  /** Q58, F22: whether a click with a building armed scrolls the view as an exploring click does.
   *  Off: it moves the cursor only, so a confirming second click lands on the tile under the preview. */
  armedClickScrolls: boolean
  /** F22: two left clicks on the same screen cell at most this far apart, with a building armed, place
   *  it where the first click pointed — even when the first one scrolled the view. 0: off. The input
   *  path's (`BuildSession`), which alone knows when clicks arrive. */
  doubleClickMs: number
  /** How long the drawn view takes to slide to a new camera position, in milliseconds; 0 jumps. The
   *  live loop's alone — state and every command use the camera's target. */
  easeMs: number
  /** How long the drawn cursor takes to glide from its old tile to its new one, in milliseconds; 0
   *  jumps. Presentation alone, like `easeMs`: the state's cursor is already where it is going. */
  cursorGlideMs: number
  /** Whether a fast move (Shift, Option, PageUp/Home) re-centres the view on the cursor along the
   *  axis it moved, rather than only dragging it to the margin (engine.md 3.3). */
  fastRecentres: boolean
  /** The held-key ramp, in tiles per press: a tap; each press of a run (a held arrow's repeats, or
   *  fast tapping); each press once the run has lasted `rampMs`. */
  tapStep: number
  holdStep: number
  fastStep: number
  /** How far the fast move (Shift, Option, PageUp/PageDown, Home/End) jumps — a jump, not a speed. */
  jumpStep: number
  /** How long a run moves at the hold step before it moves at the fast step, in milliseconds. */
  rampMs: number
  /** Terminals send no key-up: a press of the same arrow at most this long after the one before is
   *  part of a run — the terminal's first repeat of a held key, or a quick tap. */
  holdWindowMs: number
  /** A held fast move jumps again at most this often; the terminal's repeats in between are dropped.
   *  0: every repeat jumps. */
  jumpRepeatMs: number
  /** How long the cursor flashes when a placement is tried and refused, in milliseconds. */
  refusedCursorMs: number
  /** How long a lone Esc at the end of a read waits for the rest of a key sequence before it counts
   *  as Esc, in milliseconds; 0 is not at all. */
  escTimeoutMs: number
  /** How long a menu row's "pressed" flash lasts, in milliseconds. */
  pressedFlashMs: number
  /** How long a menu row's "refused" flicker lasts, in milliseconds. */
  refusedFlashMs: number
  /** Gate 6A, the owner's ending sketch (milestone 6, Section 2.2): how long the alarm sounds before the
   *  fight is seen to stop, in milliseconds. 0 is no alarm — the fight simply stops. */
  endAlarmLeadMs: number
  /** How long after the fight stops the survivors wait before they start walking home. */
  endWalkPauseMs: number
  /** How long the walk home takes; the result appears when it ends. 0: they are simply home. */
  endWalkMs: number
  /** Whether the view slides to centre on the player's Grid Nexus when the alarm starts. */
  endCentre: boolean
  /** Which raid the next Nexus Pulse faces. */
  raid: RaidSize
  /** Whether the player starts the next Nexus Pulse with units of their own. */
  crew: CrewSize
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

/** The owner's own "about 20% of the height or width of the screen" (2026-09-26), then 25% after
 *  playing it (his settings export, 2026-09-29). */
export const DEFAULT_SCROLL_MARGIN_PERCENT = 25

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
    question: "How near the edge the cursor gets before the map scrolls, as a share of the view. Picked after playing: 25%. (Q54)",
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
    question: "With a building armed, does a click near an edge scroll the view? Off: never, so any second click places. (F22)",
    values: [false, true],
    cycles: true,
    format: onOff,
  },
  {
    field: "doubleClickMs",
    label: "Double click",
    applies: "now",
    question: "Two clicks this close on one spot place the building where the first pointed, even if the view scrolled. (F22)",
    values: [0, 250, 300, 400, 500, 700],
    cycles: false,
    format: millis,
  },
  {
    field: "easeMs",
    label: "View slide",
    applies: "now",
    question: "How long the view takes to slide to where it scrolled, by mouse or keyboard. Off: it jumps, as before.",
    values: [0, 50, 100, 150, 200, 300, 500],
    cycles: false,
    format: millis,
  },
  {
    field: "cursorGlideMs",
    label: "Cursor glide",
    applies: "now",
    question: "How long the cursor takes to glide to its new tile, so a Shift jump or a far click reads as motion. Off: it jumps.",
    values: [0, 50, 80, 100, 150, 200, 300],
    cycles: false,
    format: millis,
  },
  {
    field: "fastRecentres",
    label: "Shift centres",
    applies: "now",
    question: "Shift+arrow (or Option, PageUp, Home) brings the view along so the cursor lands mid-screen, not at the margin.",
    values: [true, false],
    cycles: true,
    format: onOff,
  },
  {
    field: "tapStep",
    label: "Tap step",
    applies: "now",
    question: "How far a single press of an arrow moves. Asked for: 1.",
    values: [1, 2, 3],
    cycles: false,
    format: tiles,
  },
  {
    field: "holdStep",
    label: "Hold step",
    applies: "now",
    question: "How far each press moves once you hold the arrow, or tap it quickly. Asked for: 2.",
    values: [1, 2, 3, 4],
    cycles: false,
    format: tiles,
  },
  {
    field: "fastStep",
    label: "Fast step",
    applies: "now",
    question: "How far each press moves once you have held the arrow a moment (Held to go fast). Asked for: 4.",
    values: [2, 3, 4, 5, 6, 8],
    cycles: false,
    format: tiles,
  },
  {
    field: "rampMs",
    label: "Held to go fast",
    applies: "now",
    question: "How long a held arrow moves at the hold step before it speeds up to the fast step. Asked for: 300 ms.",
    values: [0, 150, 200, 300, 400, 500, 800],
    cycles: false,
    format: duration,
  },
  {
    field: "holdWindowMs",
    label: "Hold window",
    applies: "now",
    question: "Arrow presses closer than this count as holding. Too low: quick taps stay slow. Too high: careful taps speed up.",
    values: [150, 250, 350, 500, 700, 900],
    cycles: false,
    format: duration,
  },
  {
    field: "jumpStep",
    label: "Shift jump",
    applies: "now",
    question: "How far Shift+arrow jumps the cursor, and Option+arrow, PageUp and Home. Asked for: 12.",
    values: [4, 6, 8, 10, 12, 16, 20, 24],
    cycles: false,
    format: tiles,
  },
  {
    field: "jumpRepeatMs",
    label: "Jump repeat",
    applies: "now",
    question: "Holding Shift+arrow jumps again at most this often, so each jump is seen to land. Off: every key repeat jumps.",
    values: [0, 100, 150, 200, 300, 500],
    cycles: false,
    format: millis,
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
  // Gate 6A: the Nexus Pulse's ending, then which Pulse to watch it on. While a Pulse is on screen, `d`
  // opens Settings straight at the first of these.
  {
    field: "endAlarmLeadMs",
    label: "Alarm lead",
    applies: "now",
    question: "How long the alarm sounds before the fight is seen to stop. Off: no alarm. Sketched: 3-5 s. (Milestone 6)",
    values: [0, 1000, 2000, 3000, 4000, 5000, 6000, 8000],
    cycles: false,
    format: millis,
  },
  {
    field: "endWalkPauseMs",
    label: "Walk-back delay",
    applies: "now",
    question: "How long after the fight stops before the survivors start walking home. Sketched: 1 second. (Milestone 6)",
    values: [0, 500, 1000, 1500, 2000, 3000],
    cycles: false,
    format: millis,
  },
  {
    field: "endWalkMs",
    label: "Walk-back time",
    applies: "now",
    question: "How long the walk home takes; the result shows when it ends. Off: they are simply home. Sketched: 2 seconds. (Milestone 6)",
    values: [0, 1000, 2000, 3000, 4000, 6000],
    cycles: false,
    format: millis,
  },
  {
    field: "endCentre",
    label: "Centre on Nexus",
    applies: "now",
    question: "When the alarm starts, does the view slide to centre on your Nexus, so the next Build Phase starts at your base? (Milestone 6)",
    values: [true, false],
    cycles: true,
    format: onOff,
  },
  {
    field: "raid",
    label: "Raid",
    applies: "now",
    question: "Which raid the next Pulse faces: none (the time runs out), the probe, or a heavy one. Restart to build again.",
    values: ["probe", "none", "heavy"],
    cycles: true,
    format: (value: RaidSize) => value,
  },
  {
    field: "crew",
    label: "Your units",
    applies: "now",
    question: "Whether you start the next Pulse with units of your own. None: only the Nexus and what you built stand against the raid.",
    values: ["some", "none"],
    cycles: true,
    format: (value: CrewSize) => value,
  },
]

/** The live loop's flash durations as gate 5F built them — the starting values of the two flags. */
export const DEFAULT_FLASH_MS = { pressed: 90, refused: 140 } as const

/** The movement numbers: the owner's own (a tap 1, a held or quickly tapped arrow 2, then 4 after
 *  300 ms, Shift a jump of 12 — his playtest of 2026-09-28; the cursor glide, hold window, refused
 *  cursor and Esc timeout from his settings export of 2026-09-29), and first guesses at the rest, for
 *  him to retune by feel. */
export const DEFAULT_MOVEMENT = {
  clickScroll: "edges",
  clickZone: 33,
  armedClickScrolls: true,
  doubleClickMs: 400,
  easeMs: 150,
  cursorGlideMs: 80,
  fastRecentres: true,
  tapStep: 1,
  holdStep: 2,
  fastStep: 4,
  jumpStep: 12,
  rampMs: 300,
  holdWindowMs: 150,
  jumpRepeatMs: 150,
  refusedCursorMs: 150,
  escTimeoutMs: 100,
} as const satisfies Partial<DebugFlags>

/** Gate 5I's placement juice: the two durations are the owner's own (his settings export,
 *  2026-09-29), the particles and the light still the first guesses he kept. */
export const DEFAULT_PLACEMENT = {
  placeFramesMs: 300,
  placeGlowMs: 250,
  placeParticles: "few",
  placeLight: "light",
} as const satisfies Partial<DebugFlags>

/** Gate 6A's ending, as the owner sketched it (milestone 6, Section 2.2): an alarm about four seconds
 *  before the shooting stops ("3-5 seconds"), one second to the walk home, two seconds of walking. First
 *  guesses at his numbers, for him to retune by feel. */
export const DEFAULT_ENDING = {
  endAlarmLeadMs: 4000,
  endWalkPauseMs: 1000,
  endWalkMs: 2000,
  endCentre: true,
} as const satisfies Partial<DebugFlags>

/** The placeholder Pulse the spike starts: the probe, against a player with units of their own. */
export const DEFAULT_PULSE = { raid: "probe", crew: "some" } as const satisfies Partial<DebugFlags>

/** The flags a screen opens with: what the context asks for (`--scroll-margin`), and otherwise what
 *  gates 5F-6A built. (The smart cursor's and "Opens on"'s flags were settled by the owner on
 *  2026-09-29, feedback F30 and F31, and deleted.) */
export function initialDebugFlags(context: Readonly<{ scrollMargin?: number }>): DebugFlags {
  return {
    ...DEFAULT_PLACEMENT,
    ...DEFAULT_MOVEMENT,
    ...DEFAULT_ENDING,
    ...DEFAULT_PULSE,
    scrollMargin: context.scrollMargin ?? DEFAULT_SCROLL_MARGIN_PERCENT,
    pressedFlashMs: DEFAULT_FLASH_MS.pressed,
    refusedFlashMs: DEFAULT_FLASH_MS.refused,
  }
}

export function fieldSpec(field: DebugField): AnyFieldSpec {
  return DEBUG_FIELDS.find((spec) => spec.field === field) as AnyFieldSpec
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
