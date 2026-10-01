// The **Experiments** (rows of Settings): the settings on the
// experiment tier — live-editable rows that let the owner feel two answers to an open question during a
// playtest, instead of reading a paragraph about them or asking for a new command-line flag (the Experiments rule in
// AGENTS.md; docs/system-design/input.md). They are declared with every other setting, each with its section, label,
// question and values, in `src/build/all-settings.ts`; this file is what the reducer and the export need
// of that tier: its defaults, one step of a value, and how a value reads.
//
// **Every Experiment names the question it serves, and is normally settled before its pull request is
// accepted**: its tier becomes `tuned` and his value its default, with who chose it and when. Nothing
// here is saved: the values live in `BuildState.experiments` for as long as the screen is open, and
// leave only through the export.
//
// Where they are read, always through `setting(state, name)` or `BuildState.experiments`:
//
// - keyboard navigation — the hold window, key releases, and the tap, hold and jump numbers — decides
//   how big a move the input path sends (`src/build/motion.ts`), and the reducer only ever sees an
//   ordinary `move-cursor` of the size it chose. Key releases also tells the live loop whether to ask
//   the terminal for key events at all (`src/cli/build-phase.ts`), switched on and off as it changes;
// - the popup pulse (`popupPulseMs`) is presentation alone: the view breathes a popup's border;
// - the mission's two: `nextRound` — whether a round's result waits for the player or the next
//   Build Phase begins on its own (read by the Pulse's presenter, `src/view/pulse-live.ts`) — and
//   `incoming` — whether the Build Phase draws the next round's arrivals (the view). Neither changes what
//   the kernel is handed.
//
// None of them reaches the simulation kernel (`src/pulse`, `src/state`): a Build Phase plan is a plan
// on a screen until the Pulse, and nothing here is part of it.

import type { Applies, Experiments, NamesOn, SettingValue, ShownSetting } from "./all-settings.ts"
import { SHOWN_SETTINGS, defaultsOn, stepValue } from "./all-settings.ts"

export type { Experiments } from "./all-settings.ts"

export type ExperimentField = NamesOn<"experiment">

/** What starts the next Build Phase once a round's result is on screen. */
export type NextRound = SettingValue<"nextRound">

/** Whether the game reads key presses, repeats and releases where the terminal reports them. */
export type KeyReleases = SettingValue<"keyReleases">

/** When a change is seen: at once, or only once the Build Phase starts over. */
export type ExperimentApplies = Applies

/** Any Experiment's value: a number (milliseconds, 0 for off; tiles; taps) or the name of a choice. */
export type ExperimentValue = Experiments[ExperimentField]

/** An Experiment, as Settings and the export read it. */
export type ExperimentSpec = ShownSetting<ExperimentField>

/** The Experiments, in the order Settings lists them (section by section). */
export const EXPERIMENT_FIELDS: readonly ExperimentSpec[] = SHOWN_SETTINGS.filter(
  (spec): spec is ExperimentSpec => spec.tier === "experiment",
)

/** This build's defaults — each the owner's value where he gave one, else a first guess. */
export const DEFAULT_EXPERIMENTS: Experiments = defaultsOn("experiment")

/** The values a screen opens with: this build's defaults. (The owner settled every other Experiment —
 *  the smart cursor's and "Opens on"'s first; twenty-eight more later, then the focus arrow and the
 *  card reveal — and they moved onto the tuned tier, or were deleted.) */
export function defaultExperiments(): Experiments {
  return { ...DEFAULT_EXPERIMENTS }
}

export function experimentSpec(field: ExperimentField): ExperimentSpec {
  return EXPERIMENT_FIELDS.find((spec) => spec.field === field) as ExperimentSpec
}

/** An Experiment's current value, as its row shows it. */
export function formatExperimentValue(flags: Experiments, field: ExperimentField): string {
  return experimentSpec(field).format(flags[field])
}

export type ExperimentAdjustment = Readonly<{ flags: Experiments; changed: boolean }>

/** One Left (`-1`) or Right (`+1`) on an Experiment. A number at the end of its range stays put and
 *  says so (`changed: false`); a choice comes round. */
export function stepExperiment(flags: Experiments, field: ExperimentField, step: -1 | 1): ExperimentAdjustment {
  const spec = experimentSpec(field)
  const next = stepValue(spec.values, flags[field], step, spec.cycles)
  if (next === null || next === flags[field]) return { flags, changed: false }
  return { flags: { ...flags, [field]: next }, changed: true }
}
