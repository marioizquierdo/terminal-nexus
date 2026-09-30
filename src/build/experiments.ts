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

/** Any Experiment's value: a number (milliseconds, 0 for off) or the name of a choice. */
export type ExperimentValue = Experiments[ExperimentField]

/**
 * An Experiment, as the popup and the export read it. Written as five things — which flag, its name on
 * the row, the question it serves, the values Left/Right walk, and when a change is seen — and two
 * that follow from its values (`experiment`): whether it comes round, and how a value reads.
 */
export type ExperimentSpec = Readonly<{
  field: ExperimentField
  /** The row's name, short enough for the narrowest popup. */
  label: string
  /** The question the flag exists to answer, in plain words the owner reads under the list while the
   *  row is highlighted — so no feedback or question numbers in it. */
  question: string
  /** The values Left/Right walk, in order. A number the list does not hold (from a settings text)
   *  steps to its nearest neighbour in the direction asked. */
  values: readonly ExperimentValue[]
  applies: ExperimentApplies
  /** Whether stepping past either end comes round to the other: a choice comes round, a number stops
   *  at its ends (docs/ui-patterns.md, "a setting row"). */
  cycles: boolean
  /** A value as the row shows it: a number in milliseconds, 0 as "off"; a choice by its name. */
  format: (value: ExperimentValue) => string
}>

const millis = (value: ExperimentValue): string => (value === 0 ? "off" : `${value} ms`)

/** An Experiment from what is written about it, its values checked against its field's own type, and
 *  what follows from them derived: a number's list stops at its ends and reads in milliseconds, a
 *  choice comes round and reads as its name. */
function experiment<F extends ExperimentField>(
  written: Readonly<{ field: F; label: string; question: string; values: readonly Experiments[F][]; applies: ExperimentApplies }>,
): ExperimentSpec {
  const numeric = typeof written.values[0] === "number"
  return { ...written, cycles: !numeric, format: numeric ? millis : String }
}

/** The flags, in the order the popup lists them: the two still being felt first — the focus arrow
 *  (feedback F54), where `d` opens, and the card reveal (F68) — then the hold window, then the
 *  placeholder Pulse's raid and crew, where `d` opens while a Pulse is on screen. */
export const EXPERIMENT_FIELDS: readonly ExperimentSpec[] = [
  experiment({
    field: "focusArrowMs",
    label: "Focus arrow",
    question: "When a menu row hands the keyboard to the map, an arrow flies from it to the cursor, taking this long. Off: no arrow.",
    values: [0, 120, 180, 250, 350, 500],
    applies: "now",
  }),
  experiment({
    field: "cardRevealMs",
    label: "Card reveal",
    question: "How long the menu takes to turn into a card: the other rows fade, the row slides up, the card types in. Off: at once.",
    values: [0, 100, 150, 250, 400, 800],
    applies: "now",
  }),
  experiment({
    field: "holdWindowMs",
    label: "Hold window",
    question: "Arrow presses closer than this count as holding. It depends on your keyboard's repeat delay: retune it on a new machine.",
    values: [150, 250, 350, 500, 700, 900],
    applies: "now",
  }),
  // The placeholder Nexus Pulse (gate 6A), until gate 6B's real mission. While a Pulse is on screen, `d`
  // opens Settings straight at the first of these.
  experiment({
    field: "raid",
    label: "Raid",
    question: "Which raid the next Pulse faces: none (the time runs out), the probe, or a heavy one. Restart to build again.",
    values: ["heavy", "probe", "none"],
    applies: "now",
  }),
  experiment({
    field: "crew",
    label: "Your units",
    question: "Whether you start the next Pulse with units of your own. None: only the Nexus and what you built stand against the raid.",
    values: ["none", "some"],
    applies: "now",
  }),
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

export function experimentSpec(field: ExperimentField): ExperimentSpec {
  return EXPERIMENT_FIELDS.find((spec) => spec.field === field) as ExperimentSpec
}

/** A flag's current value, as the popup shows it. */
export function formatExperimentValue(flags: Experiments, field: ExperimentField): string {
  return experimentSpec(field).format(flags[field])
}

/** The value one step from `current`, or `null` at the end of a list that does not cycle. */
function stepValue(values: readonly ExperimentValue[], current: ExperimentValue, step: -1 | 1, cycles: boolean): ExperimentValue | null {
  const index = values.indexOf(current)
  if (index >= 0) {
    const next = index + step
    if (next >= 0 && next < values.length) return values[next] ?? null
    return cycles ? (values[(next + values.length) % values.length] ?? null) : null
  }
  // A number the list does not hold: its nearest neighbour in the direction asked.
  if (typeof current !== "number") return values[0] ?? null
  const numbers = values.filter((value): value is number => typeof value === "number")
  const found = step > 0 ? numbers.find((value) => value > current) : [...numbers].reverse().find((value) => value < current)
  return found ?? null
}

export type ExperimentAdjustment = Readonly<{ flags: Experiments; changed: boolean }>

/** One Left (`-1`) or Right (`+1`) on a flag. A number at the end of its range stays put and says
 *  so (`changed: false`); a choice comes round. */
export function stepExperiment(flags: Experiments, field: ExperimentField, step: -1 | 1): ExperimentAdjustment {
  const spec = experimentSpec(field)
  const next = stepValue(spec.values, flags[field], step, spec.cycles)
  if (next === null || next === flags[field]) return { flags, changed: false }
  return { flags: { ...flags, [field]: next }, changed: true }
}
