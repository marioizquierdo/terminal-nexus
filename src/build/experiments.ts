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
// - the hold window (`holdWindowMs`) and key releases (`keyReleases`) decide how big a move the input
//   path sends: the session's ramp reads them beside the tuned steps (`src/build/motion.ts`), and the
//   reducer only ever sees an ordinary `move-cursor` of the size it chose;
// - the Battle Round pulse (`battleRoundPulseMs`) is presentation alone: the live loop keeps drawing
//   while the Battle Round screen is open and the view breathes its border;
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

/** Whether the game reads key presses, repeats and releases where the terminal reports them (the kitty
 *  keyboard protocol): `auto` asks for them and uses them if they come, `off` never asks, and a held key
 *  is guessed from the timing of the presses as before. */
export type KeyReleases = "auto" | "off"

export type Experiments = Readonly<{
  /** Terminals that report no key-up: a press of the same arrow at most this long after the one before
   *  is a held key's repeat rather than a tap. It depends on each keyboard's own repeat delay, so it
   *  stays live to retune on another machine. */
  holdWindowMs: number
  /** Whether to read key releases where the terminal reports them, or guess a hold from timing — the
   *  owner's comparison of the two (2026-09-30, third round). */
  keyReleases: KeyReleases
  /** How long one breath of the Battle Round screen's border takes, lighter then darker, in
   *  milliseconds; 0 is a still border (2026-09-30, third round: "a pulse effect on the border"). */
  battleRoundPulseMs: number
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

/** The flags, in the order the popup lists them: navigation first — the hold window, where `d` opens,
 *  and whether key releases are read — then the Battle Round's pulse, then the placeholder Pulse's raid
 *  and crew, where `d` opens while a Pulse is on screen. */
export const EXPERIMENT_FIELDS: readonly ExperimentSpec[] = [
  experiment({
    field: "holdWindowMs",
    label: "Hold window",
    question: "Arrow presses closer than this count as holding. It depends on your keyboard's repeat delay: retune it on a new machine.",
    values: [150, 200, 250, 350, 500],
    applies: "now",
  }),
  experiment({
    field: "keyReleases",
    label: "Key releases",
    question: "Auto: where your terminal reports when a key is let go, a tap is one tap and a hold is a hold. Off: guessed from timing.",
    values: ["auto", "off"],
    applies: "restart",
  }),
  experiment({
    field: "battleRoundPulseMs",
    label: "Battle Round pulse",
    question: "How long one slow breath of the Battle Round screen's border takes, lighter then darker. Off: a still border.",
    values: [0, 1200, 2000, 3000, 4000],
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
    values: ["some", "none"],
    applies: "now",
  }),
]

/** The defaults: the hold window the owner asked to try with the tap-counting ramp (2026-09-30, third
 *  round: "I would try holdWindowMs = 200ms"; his export had 250 with the old ramp); key releases read
 *  where the terminal offers them; a two-second breath on the Battle Round screen, a first guess; and
 *  the placeholder Pulse from his exports — a heavy raid, with units of his own. */
export const DEFAULT_EXPERIMENTS = {
  holdWindowMs: 200,
  keyReleases: "auto",
  battleRoundPulseMs: 2000,
  raid: "heavy",
  crew: "some",
} as const satisfies Experiments

/** The flags a screen opens with: this build's defaults. (The owner settled every other Experiment —
 *  the smart cursor's and "Opens on"'s on 2026-09-29, feedback F30 and F31; twenty-eight more on
 *  2026-09-30, and the focus arrow and the card reveal later that day, `src/build/tuning.ts` — and they
 *  were deleted.) */
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
