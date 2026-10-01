// The Build Phase's Settings popup (the owner: "Let's solidify this as Settings"; in sections, "make
// more groups, and leave an extra space between sections"): every setting the list shows (`src/build/all-settings.ts`) — the player's own, saved the same way as the
// title menu's Settings screen, and the Experiments, which are for playtesting and never saved — under
// titled sections with a blank line between them, then "Export settings". One row shape (a value Left
// and Right change), and one way out of it for the owner's feedback: the export (`settings-export.ts`).
//
// **Rows.** `BuildState.popupHighlight` is an index into `SETTINGS_ROWS`, the rows the keyboard can be
// on, in the order the popup draws them and Up/Down walk them, as it is an index into every other
// popup's list. Section titles and the blank lines between sections are drawn by the popup
// (`src/build/popup.ts`) and are never rows here, so Up and Down step over them and the title's count
// counts only these. Starting over is not a Settings row: it is the game menu's `[r] Restart`, and
// a setting that only takes effect then is announced by a message popup when Settings closes
// (`pendingRestart`, `restartMessage`).

import type { Settings } from "../settings/types.ts"
import type { Section, ShownName, ShownSetting } from "./all-settings.ts"
import { SHOWN_SETTINGS, shownSetting, stepValue } from "./all-settings.ts"
import type { ExperimentApplies, ExperimentField, Experiments } from "./experiments.ts"
import { EXPERIMENT_FIELDS } from "./experiments.ts"
import type { PopupMessage } from "./types.ts"

export type PlayerField = keyof Settings

/** A player setting, as Settings reads it. */
export type PlayerSpec = ShownSetting<PlayerField>

/** The player's settings, in the order Settings lists them. Every one applies at once. */
export const PLAYER_FIELDS: readonly PlayerSpec[] = SHOWN_SETTINGS.filter((spec): spec is PlayerSpec => spec.tier === "player")

export function playerSpec(field: PlayerField): PlayerSpec {
  return shownSetting(field)
}

export function formatPlayerValue(settings: Settings, field: PlayerField): string {
  return playerSpec(field).format(settings[field])
}

/** One Left (`-1`) or Right (`+1`) on a player setting. A choice comes round at both ends. */
export function adjustSetting(settings: Settings, field: PlayerField, step: -1 | 1): Settings {
  const spec = playerSpec(field)
  const next = stepValue(spec.values, settings[field], step, spec.cycles)
  return next === null ? settings : { ...settings, [field]: next }
}

// --- The game menu ----------------------------------------------------------------------------------

/**
 * The game menu's rows, in order (the owner: "When pressing [esc] or explicitly opening the
 * main menu, there should be an option for '[s] Settings' along with '[q] Quit'"), `[c] Controls and
 * hotkeys` right after Settings, `[a] Activity logs` after it, `[r] Restart` — starting the Build Phase
 * over with every setting kept — and Quit. **No `[esc] Back to the game` row** (the owner: "the general
 * esc on the top right is contextual and already says 'close'"): Esc, `x`, the top bar's `close [esc]`
 * and a click outside close it, as they close every popup. `popupHighlight` indexes this list while the
 * game menu is open.
 */
export const GAME_MENU_ROWS = ["settings", "controls", "activity", "restart", "quit"] as const
export type GameMenuRow = (typeof GAME_MENU_ROWS)[number]

/** What the game menu's `[c] Controls and hotkeys` row says under its name. */
export const CONTROLS_DESCRIPTION = "Keys and mouse"

/** What the game menu's `[a] Activity logs` row says under its name: what the window is for, in a
 *  playtester's words. */
export const ACTIVITY_DESCRIPTION = "What happened, to export for feedback"

/** What the game menu's `[r] Restart` row says under its name. */
export const RESTART_DESCRIPTION = "Start over; the plan is lost."

// --- Settings that apply after a restart -------------------------------------------------------------

/** What `pendingRestart` needs of an experiment's spec: `EXPERIMENT_FIELDS` itself, or a test's own list. */
export type RestartFieldSpec = Readonly<{ field: ExperimentField; label: string; applies: ExperimentApplies }>

/**
 * The names of the settings changed since this Build Phase started that only take effect when it
 * starts over — every field marked `applies: "restart"` whose value differs from `started`, the flags
 * the running Build Phase was created with. Empty when there are none, or when each was put back.
 * Pure, and over any spec list, so the mechanism is tested even while no Experiment needs a restart.
 */
export function pendingRestart(
  started: Experiments,
  current: Experiments,
  fields: readonly RestartFieldSpec[] = EXPERIMENT_FIELDS,
): readonly string[] {
  return fields
    .filter((spec) => spec.applies === "restart" && started[spec.field] !== current[spec.field])
    .map((spec) => spec.label)
}

/** The message popup that says so (the owner: "it's just a warning message ...
 *  The user may decide to keep playing and restart later"). */
export function restartMessage(labels: readonly string[]): PopupMessage {
  return {
    title: "RESTART NEEDED",
    text:
      `Some settings apply only after a restart: ${labels.join(", ")}. ` +
      "Choose [r] Restart in the menu when you're ready - the plan starts over.",
  }
}

// --- The popup's rows -------------------------------------------------------------------------------

export type SettingsRow = Readonly<{ kind: "setting"; field: ShownName }> | Readonly<{ kind: "export" }>

/** Settings' rows, in the order the popup draws them and Up/Down walk them: every shown setting, section
 *  by section, and "Export settings" last. `popupHighlight` indexes this list. */
export const SETTINGS_ROWS: readonly SettingsRow[] = [
  ...SHOWN_SETTINGS.map((spec): SettingsRow => ({ kind: "setting", field: spec.field })),
  { kind: "export" },
]

/** The row of setting `field`, a player setting or an Experiment. */
export function settingRow(field: ShownName): number {
  return SETTINGS_ROWS.findIndex((row) => row.kind === "setting" && row.field === field)
}

/** The section row `row` is listed under, or `null` for "Export settings", which stands apart. */
export function sectionOfRow(row: number): Section | null {
  const entry = SETTINGS_ROWS[row]
  return entry === undefined || entry.kind === "export" ? null : shownSetting(entry.field).section
}

/** Where the game menu's `[s] Settings` opens the popup: its first row. */
export const FIRST_SETTING_ROW = 0

/** Where `d` opens it: the first Experiment in the list — Keyboard navigation's first while that section
 *  leads the Experiments. */
export const FIRST_EXPERIMENT_ROW = SETTINGS_ROWS.findIndex(
  (row) => row.kind === "setting" && shownSetting(row.field).tier === "experiment",
)

/** "Export settings", the list's last row. */
export const SETTINGS_EXPORT_ROW = SETTINGS_ROWS.length - 1

/** Where `d` opens Settings while a Nexus Pulse is on screen: the mission's section, which is what
 *  someone watching a round wants to change, rather than the Build Phase's first Experiment. */
export const FIRST_PULSE_EXPERIMENT_ROW = SETTINGS_ROWS.findIndex((_, row) => sectionOfRow(row) === "mission")
