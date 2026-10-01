// **Every setting, in one list** (owner, 2026-09-30, feedback F85: "Refactor the code to account for the
// hierarchy of settings, some are experimental (for me), some are in-game user-facing settings, and some
// are constants in code only. We may promote settings to be user-facing, change sections, move them into
// constants (so we can still refer and update them), and at some point cleanup and solidify the
// constants and move them closer to their code module").
//
// Each setting names its **tier** — the rung it stands on:
//
//   - `player` — a setting the player sees in Settings and keeps: saved with the title menu's settings
//     (`src/settings/types.ts`);
//   - `experiment` — for the owner's playtests: shown in Settings, never saved, written into the export
//     he pastes into a pull request (`settings-export.ts`), and normally settled before its pull request
//     is accepted (AGENTS.md Section 5);
//   - `tuned` — a constant in code, not shown: the owner's settled value, with who chose it and when.
//
// **The experiment tier is how an agent asks the owner a question during a demo** (feedback F89;
// `docs/ui-patterns.md` section 15, the feedback loop). Unsure whether a flash should last 220 ms or
// 300, or whether a new behaviour should exist at all? Add an `experiment` defaulting to the
// recommended answer, with a question he can read in Settings ("How long each flash lasts…"), and ask in
// the pull request: "press `d`, set Battle Round flash to 300 ms, tell me which you prefer, and paste
// the export". His export comes back as `name = value` lines; `--settings "<text>"` replays what he
// had; his value becomes the default and the tier becomes `tuned`. The Activity Logs
// (`src/log/activity.ts`) are the same idea for "what happened?".
//
// and, when Settings shows it, its **section** — the titled group it is listed under — its label, the
// plain question it answers (shown under the list while the row is highlighted), the values Left and
// Right walk, its default, and when a change is seen (`applies`, "now" unless it says "restart").
//
// **Moving a setting is a one-word edit**: change its `tier` (or its `section`) and, at most, its
// `default` — the popup, the export, the old-export reader and the types all follow. A `tuned` setting
// may keep its label, question and values for the day it is shown again; one that never had them needs
// them written before it can be promoted (the type below refuses it otherwise). Promoting a setting to
// `player` also needs a field in the saved settings (`src/settings/types.ts`), since that is what keeps
// it — the check at the end of this file fails until it has one.
//
// **Reading a value never cares about the tier**: `setting(state, name)` returns the live Experiment,
// the saved player setting, or the tuned constant. Pure code with no state to hand (the view's timings)
// reads the tuned tier as a table, `TUNING` (`src/build/tuning.ts`); a setting promoted off that tier
// drops out of the table, so the compiler names every reader that must now read it live.
//
// Never copy a number from here into prose (a comment, a help line, a document): point at the setting,
// or read it, as the Controls page reads `jumpStep`.
//
// Pure data: nothing here reads a clock, a file or a flag, so the reducer, the input path and the view
// may all read it.

import type { Settings } from "../settings/types.ts"
import { CAPABILITY_MODES, THEMES } from "../view/roles.ts"
import { GLYPH_PACKS } from "../view/theme.ts"

/** Where a setting stands: shown and saved, shown for playtests, or a constant in code. */
export type Tier = "player" | "experiment" | "tuned"

/** The titled groups Settings lists its rows under, in order, with a blank line between them. */
export type Section = "display" | "keyboard" | "effects" | "pulse"

export const SECTIONS: readonly Readonly<{ section: Section; title: string }>[] = [
  { section: "display", title: "DISPLAY" },
  { section: "keyboard", title: "KEYBOARD NAVIGATION" },
  { section: "effects", title: "EFFECTS" },
  { section: "pulse", title: "PLACEHOLDER PULSE" },
]

/** When a change is seen: at once, or only once the Build Phase starts over. */
export type Applies = "now" | "restart"

/** What a number counts, for how its row reads: milliseconds (0 reads "off"), tiles, taps, or a share
 *  of the view. */
export type Unit = "ms" | "tiles" | "taps" | "percent"

type Value = number | string | boolean

/** How the rows Settings shows are described: the section, the label (short enough for the narrowest
 *  popup), the question in plain words — no feedback or question numbers in it — and the values Left and
 *  Right walk, in order. */
type Description = Readonly<{
  section: Section
  label: string
  question: string
  values: readonly Value[]
  applies?: Applies
  /** A choice's value as its row shows it, where that is not its own name ("16" for `color16`). */
  names?: Readonly<Record<string, string>>
}>

/** A setting as written in the list: its tier, its default, and — for a number — its unit (milliseconds
 *  unless it says). A shown one (player or experiment) must be described; a tuned one may be. */
type SettingSpec = Readonly<{ default: Value; unit?: Unit }> &
  (Readonly<{ tier: "tuned" } & Partial<Description>> | (Readonly<{ tier: "player" | "experiment" }> & Description))

const RAIDS = ["heavy", "probe", "none"] as const
const CREWS = ["some", "none"] as const

export const ALL_SETTINGS = {
  // --- Display: the player's own, saved with the title menu's Settings -----------------------------

  theme: {
    tier: "player",
    section: "display",
    label: "Background",
    question: "Dark or light: match your terminal's own background.",
    values: THEMES,
    default: "dark",
  },
  capability: {
    tier: "player",
    section: "display",
    label: "Colour depth",
    question: "How many colours the screen uses. Pick fewer if colours look wrong in your terminal; none is black and white.",
    values: CAPABILITY_MODES,
    names: { monochrome: "none", color16: "16", color256: "256", truecolor: "millions" },
    default: "color16",
  },
  glyphPack: {
    tier: "player",
    section: "display",
    label: "Symbols",
    question: "Plain keyboard characters (ascii), or Unicode lines and blocks where your font has them.",
    values: GLYPH_PACKS,
    default: "ascii",
  },
  reducedMotion: {
    tier: "player",
    section: "display",
    label: "Reduced motion",
    question: "On: a new building appears finished at once, with no light and no sparks.",
    values: [false, true],
    default: false,
  },

  // --- Keyboard navigation -------------------------------------------------------------------------
  // Taps speed up by counting and a hold runs at the game's own cadence (the owner's third round,
  // 2026-09-30, feedback F79; the rules are `src/build/motion.ts`). Back as Experiments for the
  // navigation polish round (F85: "add a few more settings back, preparing for the upcoming round of
  // polish for keyboard navigation"), each at the value it was tuned to.

  /** Where the terminal does not say which key events are repeats: a press of the same arrow at most
   *  this long after the one before is a held key's repeat, and anything slower a tap. It depends on each
   *  keyboard's own repeat delay, so it stays live to retune on another machine; 200 is the owner's
   *  (2026-09-30, third round: "I would try holdWindowMs = 200ms"). */
  holdWindowMs: {
    tier: "experiment",
    section: "keyboard",
    label: "Hold window",
    question: "Arrow presses closer than this are a hold when the terminal can't tell; slower are taps. Keep it above your repeat delay.",
    values: [150, 200, 250, 350, 500],
    default: 200,
  },
  /** Whether to read key presses, repeats and releases where the terminal reports them (the kitty
   *  keyboard protocol), or guess a hold from timing — the owner's comparison of the two (2026-09-30,
   *  third round). Applied at once: the live loop asks for them, or stops, as it changes. */
  keyReleases: {
    tier: "experiment",
    section: "keyboard",
    label: "Key releases",
    question: "Auto: if your terminal reports when a key is let go, a tap is always a tap and a hold a hold. Off: guessed from the timing.",
    values: ["auto", "off"],
    default: "auto",
  },
  /** How far a tap of an arrow moves, and every run of taps starts from; the owner's 2026-09-28 playtest. */
  tapStep: { tier: "tuned", unit: "tiles", default: 1 },
  /** Taps of one arrow at most this far apart are a run, which keeps its speed; a longer gap starts over
   *  at one. First guess, 2026-09-30, from the owner's third round — his own number, "a double-tap (400ms)". */
  doubleTapMs: {
    tier: "experiment",
    section: "keyboard",
    label: "Tap run window",
    question: "Taps of one arrow closer than this are a run and keep its speed; a longer gap starts over at one tile.",
    values: [250, 300, 350, 400, 500, 600],
    default: 400,
  },
  /** A tap at most this soon after the one before is a quick one, which may double the run's speed. First
   *  guess, 2026-09-30, from the owner's third round — his own number, "a fast-double-tap (300ms)". */
  fastTapMs: {
    tier: "experiment",
    section: "keyboard",
    label: "Quick tap",
    question: "A tap this soon after the one before counts as quick; only a quick tap can double a run's speed.",
    values: [150, 200, 250, 300, 350, 400],
    default: 300,
  },
  /** Every this many taps since the speed last changed, the last one quick, doubles it. First guess,
   *  2026-09-30, from the owner's third round — his own "tap 3 times at least before activating speed". */
  tapsToSpeedUp: {
    tier: "experiment",
    section: "keyboard",
    label: "Taps to speed up",
    question: "How many taps in a run, the last one quick, before its speed doubles - and again after as many more.",
    values: [2, 3, 4, 5],
    unit: "taps",
    default: 3,
  },
  /** The fastest a run of taps goes. First guess, 2026-09-30, from the owner's third round — his
   *  "4-tiles speed (fast)". */
  tapTopStep: {
    tier: "experiment",
    section: "keyboard",
    label: "Fastest tap",
    question: "The most tiles one tap moves once a run has sped up. 1 tile: taps never speed up.",
    values: [1, 2, 4, 8],
    unit: "tiles",
    default: 4,
  },
  /** A held arrow moves the cursor at most once this often, whatever the keyboard's repeat rate — about
   *  16 moves a second, close enough to the cursor's glide that the drawn cursor keeps up. First guess,
   *  2026-09-30, from the owner's third round ("limit the scroll speed"). */
  holdMoveMs: {
    tier: "experiment",
    section: "keyboard",
    label: "Hold pace",
    question: "A held arrow moves at most once this often, however fast your keyboard repeats. Smaller is faster.",
    values: [30, 40, 50, 60, 80, 100, 120],
    default: 60,
  },
  /** How far each of a held arrow's moves goes at first. First guess, 2026-09-30, from the owner's third
   *  round (the retired `holdStep` moved 2 at every repeat, the owner's 2026-09-28 playtest). */
  holdFirstStep: { tier: "tuned", unit: "tiles", default: 1 },
  /** How long an arrow repeats before its moves go `holdLongStep` — about ten tiles at the first step,
   *  more than "a position a few tiles away". First guess, 2026-09-30, from the owner's third round. */
  holdLongMs: {
    tier: "experiment",
    section: "keyboard",
    label: "Hold goes faster",
    question: "How long an arrow is held before each of its moves goes the faster hold step.",
    values: [300, 400, 600, 800, 1000, 1500],
    default: 600,
  },
  /** How far each of a held arrow's moves goes once it has been repeating for `holdLongMs`. First guess,
   *  2026-09-30, from the owner's third round. */
  holdLongStep: {
    tier: "experiment",
    section: "keyboard",
    label: "Faster hold step",
    question: "How many tiles each move of a held arrow goes once the hold has gone faster. 1 tile: it never does.",
    values: [1, 2, 3, 4],
    unit: "tiles",
    default: 2,
  },
  /** How far the fast move jumps — Shift or Option with an arrow, PageUp/PageDown, Home/End; the owner's
   *  settings export, 2026-09-30 (12 before). */
  jumpStep: {
    tier: "experiment",
    section: "keyboard",
    label: "Jump distance",
    question: "How far Shift or Option with an arrow, PageUp/PageDown and Home/End jump.",
    values: [5, 8, 10, 12, 15, 20],
    unit: "tiles",
    default: 10,
  },
  /** A held fast move jumps again at most this often, so each jump is seen to land; the owner's settings
   *  export, 2026-09-30. */
  jumpRepeatMs: { tier: "tuned", default: 100 },
  /** How long a lone Esc at the end of a read waits for the rest of a key sequence before it counts as
   *  Esc; the owner's settings export, 2026-09-30. */
  escTimeoutMs: { tier: "tuned", default: 50 },

  // --- Moving the cursor and the view --------------------------------------------------------------

  /** How near the view's edge the cursor gets before the map scrolls, as a share of the view's width
   *  (sides) and height (top and bottom); the owner's settings export, 2026-09-30 (25% before;
   *  `--scroll-margin` overrides it for one run). */
  scrollMargin: { tier: "tuned", unit: "percent", default: 30 },
  /** How deep each edge zone is where an exploring or armed click scrolls the view, as a share of the
   *  view; the owner's settings export, 2026-09-30. */
  clickZone: { tier: "tuned", unit: "percent", default: 25 },
  /** Two left clicks on one screen cell at most this far apart, with a building armed, place it where
   *  the first pointed; first guess (gate 5J), kept by the owner, 2026-09-30. */
  doubleClickMs: { tier: "tuned", default: 400 },
  /** How long the drawn view slides to a new camera position; the owner's settings export, 2026-09-30. */
  easeMs: { tier: "tuned", default: 100 },
  /** How long the drawn cursor glides to its new tile; the owner's settings export, 2026-09-30. */
  cursorGlideMs: { tier: "tuned", default: 100 },

  // --- Where arming puts a building ----------------------------------------------------------------

  /** How far arming looks for a spot when the building cannot go where the cursor is, in tiles from the
   *  cursor along each axis; the owner's "if there's no empty space in 12 tiles around, it should stay"
   *  (feedback F30, 2026-09-29). */
  armSearchTiles: { tier: "tuned", unit: "tiles", default: 12 },
  /** What one tile up or down costs against one tile sideways when arming ranks the spots it found, so a
   *  run of the same building grows into a row; for the owner's "in most cases this should move the
   *  cursor only a few tiles to the right" (feedback F30, 2026-09-29). */
  armVerticalCost: { tier: "tuned", unit: "tiles", default: 2 },

  // --- Hand-offs and cards -------------------------------------------------------------------------

  /** How long the focus arrow (a building) or the see-through cursor (Explore Map) takes to fly from a
   *  menu row to the map cursor; the owner's settings export, 2026-09-30, third round (180 before). */
  focusArrowMs: { tier: "tuned", default: 250 },
  /** How long the menu takes to turn into a card: the other rows fade, the chosen row slides up, the card
   *  types in; the owner's settings export, 2026-09-30, third round (150 before). */
  cardRevealMs: { tier: "tuned", default: 400 },

  // --- Effects --------------------------------------------------------------------------------------

  /** How long one breath of a popup's border takes, lighter then darker; 0 is a still border. Began as
   *  the Battle Round screen's alone (2026-09-30, third round: "a pulse effect on the border"; a first
   *  guess of two seconds), and became every popup's at the menu spike's merge (feedback F84). An old
   *  export's `battleRoundPulseMs` reads as this (`RENAMED_SETTINGS`, `src/build/tuning.ts`). */
  popupPulseMs: {
    tier: "experiment",
    section: "effects",
    label: "Popup pulse",
    question: "How long one slow breath of every popup's border takes, lighter then darker. Off: a still border.",
    values: [0, 1200, 2000, 3000, 4000],
    default: 2000,
  },
  /** How long each of the Battle Round screen's two opening flashes lasts; 0 is no flash. A first
   *  guess (2026-09-30, the owner's notes at the merge, F83: "an initial double flash pulse, with more
   *  contrast range, that works as a highlight"). */
  popupFlashMs: {
    tier: "experiment",
    section: "effects",
    label: "Battle Round flash",
    question: "How long each of the two flashes lasts as the Battle Round screen opens, before it breathes. Off: no flash.",
    values: [0, 150, 220, 300, 400],
    default: 220,
  },
  /** How far each opening flash goes toward the title's colour, where the breath goes 40%. A first guess
   *  (F83: "with more contrast range"). */
  popupFlashPeak: {
    tier: "experiment",
    section: "effects",
    label: "Flash strength",
    question: "How far the Battle Round flash brightens the border; the everyday breath goes to 40%.",
    unit: "percent",
    values: [50, 65, 80, 95],
    default: 80,
  },

  // --- Acknowledgements ----------------------------------------------------------------------------

  /** How long a menu row flashes when it is chosen, and each "on" of the cursor's blink; gate 5F's
   *  number, kept by the owner, 2026-09-30. */
  pressedFlashMs: { tier: "tuned", default: 90 },
  /** How long a row flickers when a key reaches it but does nothing; the owner's settings export,
   *  2026-09-30. */
  refusedFlashMs: { tier: "tuned", default: 90 },
  /** How long the building under the cursor flashes when a placement there is refused; the owner's
   *  settings export, 2026-09-29, kept 2026-09-30. */
  refusedCursorMs: { tier: "tuned", default: 150 },
  /** How many times the cursor blinks when the focus arrow lands; the owner's "blink twice in quick
   *  succession" (feedback F54), kept 2026-09-30. */
  cursorBlinks: { tier: "tuned", unit: "taps", default: 2 },

  // --- A building going up -------------------------------------------------------------------------

  /** How long a new building takes to rise through its placement frames; the owner's settings export,
   *  2026-09-29, kept 2026-09-30. */
  placeFramesMs: { tier: "tuned", default: 300 },
  /** How long the light and the sparks take to settle once the building is finished; the owner's
   *  settings export, 2026-09-30 (250 before). */
  placeGlowMs: { tier: "tuned", default: 400 },
  /** How many sparks a finished (or removed) building throws — "few"; first guess (gate 5I), kept by the
   *  owner, 2026-09-30. */
  placeSparks: { tier: "tuned", unit: "taps", default: 6 },

  // --- The end of a Nexus Pulse --------------------------------------------------------------------

  /** How long before the fight is seen to stop its timer flashes and a light sweeps the border; the
   *  owner's "the last 3 seconds" (feedback F43, 2026-09-29). */
  endWarnMs: { tier: "tuned", default: 3000 },
  /** How long after the fight stops the survivors wait before walking home; the owner's settings export,
   *  2026-09-30. */
  endWalkPauseMs: { tier: "tuned", default: 500 },
  /** How long the walk home takes; the result shows when it ends; the owner's settings export,
   *  2026-09-30. */
  endWalkMs: { tier: "tuned", default: 1000 },

  // --- The placeholder Nexus Pulse (gate 6A), until gate 6B's real mission --------------------------
  // They pick what the kernel is handed (`src/build/catalog.ts`), never how it resolves it. While a
  // Pulse is on screen, `d` opens Settings at the first of them. The defaults are the owner's exports.

  /** How big a raid the placeholder Pulse brings: none — nobody comes, so the time runs out; the probe the
   *  Build Phase was first tuned against; or a heavy raid that needs a real defence. */
  raid: {
    tier: "experiment",
    section: "pulse",
    label: "Raid",
    question: "Which raid the next Pulse faces: none (the time runs out), the probe, or a heavy one. Restart to build again.",
    values: RAIDS,
    default: "heavy",
  },
  /** Whether the player starts the placeholder Pulse with units of their own. None means the Nexus and
   *  what was built are all that stand between the raid and a lost Pulse. */
  crew: {
    tier: "experiment",
    section: "pulse",
    label: "Your units",
    question: "Whether you start the next Pulse with units of your own. None: only the Nexus and what you built stand against the raid.",
    values: CREWS,
    default: "some",
  },
} as const satisfies Readonly<Record<string, SettingSpec>>

// --- Names, values and tiers, as types --------------------------------------------------------------

type List = typeof ALL_SETTINGS

export type SettingName = keyof List

/** A number is any number and a yes/no either; a choice keeps its own names. */
type Widen<V> = V extends number ? number : V extends boolean ? boolean : V
type Listed<S> = S extends Readonly<{ values: readonly (infer V)[] }> ? V : never

/** The values setting `K` can take: its listed values and its default, a number widened to any. */
export type SettingValue<K extends SettingName> = Widen<List[K]["default"] | Listed<List[K]>>

/** The names of the settings on tier `T`. */
export type NamesOn<T extends Tier> = { [K in SettingName]: List[K]["tier"] extends T ? K : never }[SettingName]

/** The settings Settings shows: the player's and the Experiments. */
export type ShownName = NamesOn<"player" | "experiment">

/** The live Experiments: every setting on the experiment tier, and its value now. */
export type Experiments = { readonly [K in NamesOn<"experiment">]: SettingValue<K> }

/** The constants: every setting on the tuned tier, and its value. */
export type Tuned = { readonly [K in NamesOn<"tuned">]: SettingValue<K> }

/** Where a value is read from: the live Experiments and the saved player settings — a Build Phase's
 *  state has both. */
export type SettingSource = Readonly<{ experiments: Experiments; settings: Settings }>

function specOf(name: SettingName): SettingSpec {
  return ALL_SETTINGS[name] as SettingSpec
}

/** Every setting's name, in the order the list is written. */
export const SETTING_NAMES = Object.keys(ALL_SETTINGS) as readonly SettingName[]

/** The tier setting `name` stands on. */
export function tierOf(name: SettingName): Tier {
  return specOf(name).tier
}

/** Whether a name is one of this build's settings. */
export function isSettingName(name: string): name is SettingName {
  return Object.hasOwn(ALL_SETTINGS, name)
}

/** The names on tier `T`, in the order the list is written. */
export function namesOn<T extends Tier>(tier: T): readonly NamesOn<T>[] {
  return SETTING_NAMES.filter((name) => tierOf(name) === tier) as unknown as readonly NamesOn<T>[]
}

/** Setting `name`'s default — this build's value before anyone changes it. */
export function defaultValue<K extends SettingName>(name: K): SettingValue<K> {
  return ALL_SETTINGS[name].default as SettingValue<K>
}

/**
 * **Setting `name`'s value, whatever its tier**: the live Experiment, the saved player setting, or the
 * tuned constant. The one way to read a setting that may move between tiers.
 */
export function setting<K extends SettingName>(from: SettingSource, name: K): SettingValue<K> {
  const tier = tierOf(name)
  if (tier === "experiment") return (from.experiments as Readonly<Record<string, unknown>>)[name] as SettingValue<K>
  if (tier === "player") return (from.settings as Readonly<Record<string, unknown>>)[name] as SettingValue<K>
  return defaultValue(name)
}

/** The defaults of the settings on tier `T`, as a record. */
export function defaultsOn<T extends Tier>(tier: T): { readonly [K in NamesOn<T>]: SettingValue<K> } {
  return Object.fromEntries(namesOn(tier).map((name) => [name, defaultValue(name)])) as { readonly [K in NamesOn<T>]: SettingValue<K> }
}

// --- A shown setting, as Settings and the export read it -------------------------------------------

/**
 * A setting Settings shows: written as its tier, section, label, question, values and when a change is
 * seen, and two things that follow from its values: whether stepping past either end comes round to the
 * other — a choice comes round, a number stops at its ends (docs/ui-patterns.md, "a setting row") — and
 * how a value reads.
 */
export type ShownSetting<N extends ShownName = ShownName> = Readonly<{
  field: N
  tier: "player" | "experiment"
  section: Section
  label: string
  question: string
  values: readonly Value[]
  applies: Applies
  cycles: boolean
  format: (value: Value) => string
}>

function formatNumber(value: number, unit: Unit): string {
  switch (unit) {
    case "ms":
      return value === 0 ? "off" : `${value} ms`
    case "tiles":
      return value === 1 ? "1 tile" : `${value} tiles`
    case "taps":
      return `${value} taps`
    case "percent":
      return `${value}%`
  }
}

/** Setting `name`'s value as a row shows it: a number with its unit (0 milliseconds as "off"), a yes/no
 *  as on/off, a choice by its name or the name its row gives it. */
export function formatValue(name: SettingName, value: Value): string {
  const spec = specOf(name)
  const shown = spec.names?.[String(value)]
  if (shown !== undefined) return shown
  if (typeof value === "boolean") return value ? "on" : "off"
  if (typeof value === "number") return formatNumber(value, spec.unit ?? "ms")
  return value
}

/** Setting `name` as Settings shows it. Only a shown setting has one. */
export function shownSetting<N extends ShownName>(name: N): ShownSetting<N> {
  const spec = specOf(name) as SettingSpec & Description & Readonly<{ tier: "player" | "experiment" }>
  return {
    field: name,
    tier: spec.tier,
    section: spec.section,
    label: spec.label,
    question: spec.question,
    values: spec.values,
    applies: spec.applies ?? "now",
    cycles: typeof spec.values[0] !== "number",
    format: (value) => formatValue(name, value),
  }
}

/** Every setting Settings shows, in the order it lists them: section by section (`SECTIONS`), and within
 *  a section in the order the list is written. */
export const SHOWN_SETTINGS: readonly ShownSetting[] = SECTIONS.flatMap(({ section }) =>
  SETTING_NAMES.filter((name): name is ShownName => tierOf(name) !== "tuned" && specOf(name).section === section).map((name) =>
    shownSetting(name),
  ),
)

/** The value one step from `current` along `values`, or `null` at the end of a list that does not
 *  cycle. A number the list does not hold (from a settings text) steps to its nearest neighbour in the
 *  direction asked; a choice it does not hold, to the list's first. */
export function stepValue(values: readonly Value[], current: Value, step: -1 | 1, cycles: boolean): Value | null {
  const index = values.indexOf(current)
  if (index >= 0) {
    const next = index + step
    if (next >= 0 && next < values.length) return values[next] ?? null
    return cycles ? (values[(next + values.length) % values.length] ?? null) : null
  }
  if (typeof current !== "number") return values[0] ?? null
  const numbers = values.filter((value): value is number => typeof value === "number")
  const found = step > 0 ? numbers.find((value) => value > current) : [...numbers].reverse().find((value) => value < current)
  return found ?? null
}

// --- The player tier is the saved settings ----------------------------------------------------------

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false

/**
 * The player tier is exactly what the saved settings keep, name for name and value for value. A setting
 * promoted to `player` fails here until `src/settings/types.ts` keeps it too (its field, its default and
 * its line in `parseSettings`); one moved off `player` fails until that field is retired.
 */
const PLAYER_TIER_IS_SAVED: Same<{ readonly [K in NamesOn<"player">]: SettingValue<K> }, Settings> = true
void PLAYER_TIER_IS_SAVED
