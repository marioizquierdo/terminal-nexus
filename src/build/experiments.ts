// The **Experiments** (gate 5G's Debug Mode; the lower half of Settings since gate 5J): the Build
// Phase's live-editable development flags — an experiment harness that lets the owner feel two
// answers to an open question during a playtest, instead of reading a paragraph about them or asking
// for a new command-line flag (AGENTS.md Section 5, engine.md 9.7).
//
// **Every flag names the question it serves, and is deleted once that question is answered**: its
// value becomes a tuned value (`src/build/tuning.ts`), with who chose it and when. The owner settled
// twenty-eight of them at once on 2026-09-30 ("Many of those settings can be cleaned now, I feel good
// about them. Keep only the few that you think may be useful later"). What is left is still being felt,
// depends on the machine, or is placeholder data. A few may graduate into real settings; none of them is
// one yet, so nothing here is saved: the flags live in `BuildState.experiments` for as long as the screen is
// open.
//
// Where each flag is read:
//
// - the focus arrow (`focusArrowMs`, feedback F54) and the card reveal (`cardRevealMs`, F68) are
//   presentation alone: the reducer records when a menu row hands the keyboard to the map
//   (`BuildState.handoff`), the live loop times the arrow from it and watches the panel turn into a
//   card (`src/view/build-live.ts`), and the view draws both;
// - the hold window (`holdWindowMs`) decides how big a move the input path sends: the session's
//   held-key ramp reads it beside the tuned steps (`src/build/motion.ts`), and the reducer only ever
//   sees an ordinary `move-cursor` of the size it chose;
// - `raid` and `crew` pick which placeholder Nexus Pulse the next commit starts (`src/build/catalog.ts`)
//   — they change what the kernel is handed, never how it resolves it — until gate 6B's real mission
//   replaces them.
//
// None of them reaches the simulation kernel (`src/pulse`, `src/state`): a Build Phase plan is a plan
// on a screen until the Pulse, and nothing here is part of it.

/** How big a raid the placeholder Nexus Pulse brings (gate 6A): none — nobody comes, so the time runs
 *  out; the probe the Build Phase was first tuned against; or a heavy raid that needs a real defence. */
export type RaidSize = "none" | "probe" | "heavy"

/** Whether the player starts the placeholder Pulse with units of their own (gate 6A). None means the
 *  Nexus and what was built are all that stand between the raid and a lost Pulse. */
export type CrewSize = "some" | "none"

export type Experiments = Readonly<{
  /** F54: how long the focus arrow takes to fly from a menu row to the cursor when the row hands the
   *  keyboard to the map, in milliseconds; 0 is no arrow. */
  focusArrowMs: number
  /** F68: how long the menu takes to turn into a card when a building is armed or Explore Map opens —
   *  the other rows fade, the chosen row slides up to the header, the card types in — in
   *  milliseconds; 0 is at once. */
  cardRevealMs: number
  /** Terminals send no key-up: a press of the same arrow at most this long after the one before is
   *  part of a run — the terminal's first repeat of a held key, or a quick tap. It depends on each
   *  keyboard's own repeat delay, so it stays live to retune on another machine. */
  holdWindowMs: number
  /** Which raid the next Nexus Pulse faces. */
  raid: RaidSize
  /** Whether the player starts the next Nexus Pulse with units of their own. */
  crew: CrewSize
}>

export type ExperimentField = keyof Experiments

/** When a change is seen: at once, or only once the Build Phase starts over. */
export type ExperimentApplies = "now" | "restart"

type ExperimentSpec<F extends ExperimentField> = Readonly<{
  field: F
  /** The row's name, short enough for the narrowest popup. */
  label: string
  applies: ExperimentApplies
  /** The question the flag exists to answer, in plain words. Shown under the list for the
   *  highlighted row; the open-questions id, where there is one, in parentheses at the end. */
  question: string
  /** The values Left/Right walk, in order. A number the list does not hold (from a settings text)
   *  steps to its nearest neighbour in the direction asked. */
  values: readonly Experiments[F][]
  /** Whether stepping past either end comes round to the other. True for a choice, where "the next
   *  one" is the only thing either arrow can mean; false for a number, where the ends are real
   *  limits. */
  cycles: boolean
  format: (value: Experiments[F]) => string
}>

type AnyExperimentSpec = { [F in ExperimentField]: ExperimentSpec<F> }[ExperimentField]

const millis = (value: number): string => (value === 0 ? "off" : `${value} ms`)
const duration = (value: number): string => `${value} ms`

/** The flags, in the order the popup lists them: the two still being felt first — the focus arrow
 *  (feedback F54), where `d` opens, and the card reveal (F68) — then the hold window, then the
 *  placeholder Pulse's raid and crew, where `d` opens while a Pulse is on screen. */
export const EXPERIMENT_FIELDS: readonly AnyExperimentSpec[] = [
  {
    field: "focusArrowMs",
    label: "Focus arrow",
    applies: "now",
    question: "When a menu row hands the keyboard to the map, an arrow flies from it to the cursor, taking this long. Off: no arrow. (F54)",
    values: [0, 120, 180, 250, 350, 500],
    cycles: false,
    format: millis,
  },
  {
    field: "cardRevealMs",
    label: "Card reveal",
    applies: "now",
    question: "How long the menu takes to turn into a card: the other rows fade, the row slides up, the card types in. Off: at once. (F68)",
    values: [0, 100, 150, 250, 400, 800],
    cycles: false,
    format: millis,
  },
  {
    field: "holdWindowMs",
    label: "Hold window",
    applies: "now",
    question: "Arrow presses closer than this count as holding. It depends on your keyboard's repeat delay: retune it on a new machine.",
    values: [150, 250, 350, 500, 700, 900],
    cycles: false,
    format: duration,
  },
  // The placeholder Nexus Pulse (gate 6A), until gate 6B's real mission. While a Pulse is on screen, `d`
  // opens Settings straight at the first of these.
  {
    field: "raid",
    label: "Raid",
    applies: "now",
    question: "Which raid the next Pulse faces: none (the time runs out), the probe, or a heavy one. Restart to build again.",
    values: ["heavy", "probe", "none"],
    cycles: true,
    format: (value: RaidSize) => value,
  },
  {
    field: "crew",
    label: "Your units",
    applies: "now",
    question: "Whether you start the next Pulse with units of your own. None: only the Nexus and what you built stand against the raid.",
    values: ["none", "some"],
    cycles: true,
    format: (value: CrewSize) => value,
  },
]

/** The defaults: the focus arrow fast ("This animation should be fast", feedback F54), a first guess
 *  for him to feel; the card reveal within his "100 or 150 ms" (F68); the hold window and the placeholder
 *  Pulse from his settings export of 2026-09-30 — a heavy raid, and no units of his own. */
export const DEFAULT_EXPERIMENTS = {
  focusArrowMs: 180,
  cardRevealMs: 150,
  holdWindowMs: 350,
  raid: "heavy",
  crew: "none",
} as const satisfies Experiments

/** The flags a screen opens with: this build's defaults. (The owner settled every other Experiment —
 *  the smart cursor's and "Opens on"'s on 2026-09-29, feedback F30 and F31; twenty-eight more on
 *  2026-09-30, `src/build/tuning.ts` — and they were deleted.) */
export function defaultExperiments(): Experiments {
  return { ...DEFAULT_EXPERIMENTS }
}

export function experimentSpec(field: ExperimentField): AnyExperimentSpec {
  return EXPERIMENT_FIELDS.find((spec) => spec.field === field) as AnyExperimentSpec
}

export function experimentRow(field: ExperimentField): number {
  return EXPERIMENT_FIELDS.findIndex((spec) => spec.field === field)
}

/** Where `d` opens Settings while a Nexus Pulse is on screen: the placeholder Pulse's own Experiments,
 *  which are what someone watching it wants to change, rather than the Build Phase's first. */
export const FIRST_PULSE_EXPERIMENT_ROW = experimentRow("raid")

/** A flag's current value, as the popup shows it. */
export function formatExperimentValue(flags: Experiments, field: ExperimentField): string {
  const spec = experimentSpec(field) as ExperimentSpec<ExperimentField>
  return (spec.format as (value: Experiments[ExperimentField]) => string)(flags[field])
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

export type ExperimentAdjustment = Readonly<{ flags: Experiments; changed: boolean }>

/** One Left (`-1`) or Right (`+1`) on a flag. A number at the end of its range stays put and says
 *  so (`changed: false`); a choice comes round. */
export function stepExperiment(flags: Experiments, field: ExperimentField, step: -1 | 1): ExperimentAdjustment {
  const spec = experimentSpec(field) as ExperimentSpec<ExperimentField>
  const next = stepValue<Experiments[ExperimentField]>(spec.values, flags[field], step, spec.cycles)
  if (next === null || next === flags[field]) return { flags, changed: false }
  return { flags: { ...flags, [field]: next }, changed: true }
}
