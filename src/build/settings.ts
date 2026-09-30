// The Build Phase's Settings popup (owner, 2026-09-28: "Let's solidify this as Settings"): the
// player's own settings first — the four the title menu's Settings screen already has, saved the same
// way — and then **Experiments**, every Experiment (`src/build/experiments.ts`), which are for
// playtesting and are never saved. Two lists in one popup, one row shape (a value Left and Right
// change), and one way out of it for the owner's feedback: the export (`settings-export.ts`).
//
// This file holds the player half and the popup's row order. The flags themselves stay in
// `experiments.ts`, whose spec list the Experiments section wraps unchanged.
//
// **Rows.** `BuildState.popupHighlight` is an index into `SETTINGS_ROWS`, the rows in the order the
// popup draws them and Up/Down walk them, as it is an index into every other popup's list: the
// player's settings, then the experiments, then Export settings, the list's last row (feedback F35).
// Starting over is not a Settings row any more: it is the game menu's `[r] Restart` (F34), and a
// setting that only takes effect then is announced by a message popup when Settings closes
// (`pendingRestart`, `restartMessage`).

import type { Settings } from "../settings/types.ts"
import { CAPABILITY_MODES, THEMES } from "../view/roles.ts"
import type { CapabilityMode, Theme } from "../view/roles.ts"
import { GLYPH_PACKS } from "../view/theme.ts"
import type { GlyphPack } from "../view/theme.ts"
import type { ExperimentApplies, ExperimentField, Experiments } from "./experiments.ts"
import { EXPERIMENT_FIELDS } from "./experiments.ts"
import type { PopupMessage } from "./types.ts"

export type PlayerField = keyof Settings

type PlayerSpec<F extends PlayerField> = Readonly<{
  field: F
  label: string
  /** What the setting is for, in plain words — shown under the list while it is highlighted. */
  question: string
  values: readonly Settings[F][]
  format: (value: Settings[F]) => string
}>

type AnyPlayerSpec = { [F in PlayerField]: PlayerSpec<F> }[PlayerField]

const CAPABILITY_NAMES: Readonly<Record<CapabilityMode, string>> = {
  monochrome: "none",
  color16: "16",
  color256: "256",
  truecolor: "millions",
}

/** The player's settings, in the order the popup lists them. Every one applies at once. */
export const PLAYER_FIELDS: readonly AnyPlayerSpec[] = [
  {
    field: "theme",
    label: "Background",
    question: "Dark or light: match your terminal's own background.",
    values: THEMES,
    format: (value: Theme) => value,
  },
  {
    field: "capability",
    label: "Colour depth",
    question: "How many colours the screen uses. Pick fewer if colours look wrong in your terminal; none is black and white.",
    values: CAPABILITY_MODES,
    format: (value: CapabilityMode) => CAPABILITY_NAMES[value],
  },
  {
    field: "glyphPack",
    label: "Symbols",
    question: "Plain keyboard characters (ascii), or Unicode lines and blocks where your font has them.",
    values: GLYPH_PACKS,
    format: (value: GlyphPack) => value,
  },
  {
    field: "reducedMotion",
    label: "Reduced motion",
    question: "On: a new building appears finished at once, with no light and no sparks.",
    values: [false, true],
    format: (value: boolean) => (value ? "on" : "off"),
  },
]

export function playerSpec(field: PlayerField): AnyPlayerSpec {
  return PLAYER_FIELDS.find((spec) => spec.field === field) as AnyPlayerSpec
}

export function formatPlayerValue(settings: Settings, field: PlayerField): string {
  const spec = playerSpec(field) as PlayerSpec<PlayerField>
  return (spec.format as (value: Settings[PlayerField]) => string)(settings[field])
}

/** One Left (`-1`) or Right (`+1`) on a player setting. Every one is a choice, so both ends come
 *  round. */
export function adjustSetting(settings: Settings, field: PlayerField, step: -1 | 1): Settings {
  const spec = playerSpec(field) as PlayerSpec<PlayerField>
  const values = spec.values as readonly Settings[PlayerField][]
  const index = Math.max(0, values.indexOf(settings[field]))
  const next = values[(index + step + values.length) % values.length] as Settings[PlayerField]
  return { ...settings, [field]: next }
}

// --- The game menu ----------------------------------------------------------------------------------

/**
 * The game menu's rows, in order (owner, 2026-09-28: "When pressing [esc] or explicitly opening the
 * main menu, there should be an option for '[s] Settings' along with '[q] Quit'"), `[c] Controls and
 * hotkeys` right after Settings (feedback F60), `[r] Restart` — starting the Build Phase over with
 * every setting kept, moved here from Settings (feedback F34) — and Quit. **No `[esc] Back to the
 * game` row** (owner, 2026-09-30, feedback F73: "the general esc on the top right is contextual and
 * already says 'close'"): Esc, `x`, the top bar's `close [esc]` and a click outside close it, as they
 * close every popup. `popupHighlight` indexes this list while the game menu is open.
 */
export const GAME_MENU_ROWS = ["settings", "controls", "restart", "quit"] as const
export type GameMenuRow = (typeof GAME_MENU_ROWS)[number]

/** What the game menu's `[c] Controls and hotkeys` row says under its name. */
export const CONTROLS_DESCRIPTION = "Keys and mouse"

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

/** The message popup that says so (owner, 2026-09-29, feedback F34: "it's just a warning message ...
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

export type SettingsRow =
  | Readonly<{ kind: "player"; field: PlayerField }>
  | Readonly<{ kind: "experiment"; field: ExperimentField }>
  | Readonly<{ kind: "export" }>

/** Settings' rows, in the order the popup draws them and Up/Down walk them: the player's own settings,
 *  the Experiments, and "Export settings" last. `popupHighlight` indexes this list. */
export const SETTINGS_ROWS: readonly SettingsRow[] = [
  ...PLAYER_FIELDS.map((spec): SettingsRow => ({ kind: "player", field: spec.field })),
  ...EXPERIMENT_FIELDS.map((spec): SettingsRow => ({ kind: "experiment", field: spec.field })),
  { kind: "export" },
]

/** The row of player setting `field`. */
export function playerRow(field: PlayerField): number {
  return SETTINGS_ROWS.findIndex((row) => row.kind === "player" && row.field === field)
}

/** The row of Experiment `field`. */
export function experimentRow(field: ExperimentField): number {
  return SETTINGS_ROWS.findIndex((row) => row.kind === "experiment" && row.field === field)
}

/** The first row of each section — where the game menu's `[s] Settings` and `d` open the popup — and
 *  "Export settings", the last. */
export const FIRST_SETTING_ROW = 0
export const FIRST_EXPERIMENT_ROW = PLAYER_FIELDS.length
export const SETTINGS_EXPORT_ROW = SETTINGS_ROWS.length - 1

/** Where `d` opens Settings while a Nexus Pulse is on screen: the placeholder Pulse's own Experiments,
 *  which are what someone watching it wants to change, rather than the Build Phase's first. */
export const FIRST_PULSE_EXPERIMENT_ROW = experimentRow("raid")
