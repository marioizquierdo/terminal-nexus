// **Tuned values** — the settings on the tuned tier, as a table (docs/system-design/ui-patterns.md, "Experiments and
// tuned values"). They are declared with every other setting in `src/build/all-settings.ts`, each with
// who chose it and when; this file is the table pure code with no state to hand reads — the view's
// timings, the reducer's arming rules — and the names an old settings export may still use.
//
// Each tuned value began, or may begin again, as an Experiment: a live row in Settings the owner could
// feel two answers to. Once he settles it, its tier becomes `tuned` and its value the default, so
// Settings shows only what is still being felt and a new Experiment stands out. A setting moved off this
// tier drops out of `TUNING`, so the compiler names every reader that must now read it live
// (`setting(state, name)`).
//
// The settled *choices* are not in the list, because they are no longer choices: the code simply does
// them. Settled at the same time, from the owner's settings export:
//
//   - an exploring click near an edge scrolls further the nearer the edge it lands, in an
//     edge zone `clickZone` deep — "centres every click" and "margin only" are gone;
//   - a click with a building armed scrolls the view as an exploring click does,
//     and a quick double click places where its first click pointed;
//   - a fast move (Shift, Option, PageUp/PageDown, Home/End) drags the view at the margin like any other
//     move and no longer re-centres it;
//   - a building as it finishes is lit by a flash that settles and throws a few sparks —
//     the rainbow and "many" stay as the effect recipes' own palettes, but nothing in the game picks them;
//   - when a Nexus Pulse's last seconds begin, the view slides to centre on the player's Nexus; and the
//     map's border flashes a faint red when that Nexus is hurt.
//
// Pure data: nothing here reads a clock, a file or a flag, so the reducer, the input path and the view
// may all read it.

import type { SettingName, Tuned } from "./all-settings.ts"
import { defaultsOn, namesOn } from "./all-settings.ts"

/** The table's shape — every tuned setting and its value — so a test can hand a function a variation
 *  of it. */
export type Tuning = Tuned

export const TUNING: Tuning = defaultsOn("tuned")

/** The names the settled *choices* had as Experiments (the list at the top of this file): they have no
 *  setting any more, because the code simply does what the owner chose. */
const SETTLED_CHOICES = [
  "placeParticles",
  "placeLight",
  "clickScroll",
  "armedClickScrolls",
  "fastRecentres",
  "endCentre",
  "redAlerts",
  // The Incoming wave: the next round's raid is always shown, with what it goes for first (the owner, after
  // the Commander's pull request: "the enemy units should be visible without nexus powers").
  "incoming",
] as const

/** Tuned values since retired, because the rule they tuned is gone: the held-key ramp's hold step,
 *  fast step and ramp time (2 tiles a repeat, then 4), replaced by counting taps and a hold cadence (the
 *  owner reported the old ramp felt wrong). An old export still names them (they were
 *  Experiments once). */
const RETIRED_TUNING = ["holdStep", "fastStep", "rampMs"] as const

/** Experiments retired because what they chose became a mission's data: the placeholder Pulse's Raid and
 *  Your units, replaced by PERIMETER's waves and starting squads (`bundles/vasse/bundle.json`). */
const RETIRED_EXPERIMENTS = ["raid", "crew"] as const

/**
 * The names the settled Experiments had in a settings export: every tuned setting's — derived from the
 * list, so an Experiment that settles onto the tuned tier is covered as it lands — every settled
 * choice's, and every retired tuned value's. An old export still names them; reading one skips these
 * quietly (`settings-export.ts`), since the value they held is now the code's own (or means nothing any
 * more), rather than reporting them as names it does not know. (A tuned number that never was an
 * Experiment, like `placeSparks`, is here too, harmlessly: no export names it.)
 */
export const SETTLED_EXPERIMENTS: ReadonlySet<string> = new Set<string>([
  ...namesOn("tuned"),
  ...SETTLED_CHOICES,
  ...RETIRED_TUNING,
  ...RETIRED_EXPERIMENTS,
])

/**
 * Settings that changed their name, by the name an old export uses: read as the setting they are now,
 * on whatever tier it stands. The Battle Round screen's pulse became every popup's when the menus
 * were merged.
 */
export const RENAMED_SETTINGS: Readonly<Record<string, SettingName>> = {
  battleRoundPulseMs: "popupPulseMs",
}
