// How the Build Phase documents itself (the owner asked for it): **one line at the bottom
// of the screen**, and **a Controls and hotkeys page** in the game menu. Both are written here, as data
// a person can read top to bottom, so a new situation or a new key is one line added in one place.
//
// - The **bottom line** (`bottomLine`) is the last command's own answer while it has one — "Barracks
//   placed", "Cannot build here: rock in the way at 12,5." — and otherwise a **hint** (`hint`): what can
//   be done where the keyboard is, one line per situation (`HINTS`). It replaced the position readout
//   and the key help, which the owner found were not needed: "The only thing that is useful is having a
//   single row that offers contextual help ... an easy-to-use interface to show help as needed."
// - The **Controls page** (`controlsPage`) is every key and click, grouped by where the player is: "an
//   option for 'Controls and hotkeys' that opens a section that explains how to use the keyboard,
//   hotkeys and mouse clicks. This will be enough for offering help."
//
// Pure: no view, no clock. What a hint looks like is its tone's (`"hint"`, quieter than any answer),
// resolved in `src/view/status.ts` like every other tone. Every hint fits the 76 columns the bottom bar
// has at the 80-column floor, a test holds them to it.
//
// The words for keys are the screen's own: `[enter]`, `[esc]`, `[e]` in brackets, as the menu rows and
// the top bar write them; arrows, up/down and left/right as plain words, since they are directions.

import type { StatusMessage } from "./status.ts"
import { status } from "./status.ts"
import { cardText } from "./card.ts"
import type { ArmedPreview, BuildContext, BuildState } from "./state.ts"
import {
  displayName,
  mapMode,
  menuEntries,
  nexusPowers,
  pendingPicks,
  refusalText,
  remaining,
  structureAtTile,
} from "./state.ts"
import { WHEEL_TILES } from "./mouse.ts"
import { defaultValue, setting } from "./all-settings.ts"
import type { ConstructItem } from "./types.ts"

// ---------------------------------------------------------------------------------------------
// The bottom line
// ---------------------------------------------------------------------------------------------

/**
 * Where the player is, as far as a hint is concerned — one name per line in `HINTS`. The open popup
 * first (it holds the keyboard), then a committed plan, then the menu by what its highlighted row is,
 * then the map's three modes: placing, Explore Map (over a planned building or not), plain navigation.
 */
export type HintSituation =
  | "nexus-powers"
  | "battle-round"
  | "game-menu"
  | "settings"
  | "export"
  | "message"
  | "controls"
  | "activity-logs"
  | "dialog"
  | "committed"
  | "menu-mouse"
  | "menu-explore"
  | "menu-nexus"
  | "menu-building"
  | "menu-start"
  | "placing"
  | "explore"
  | "explore-planned"
  | "map"

export function hintSituation(context: BuildContext, state: BuildState): HintSituation {
  switch (state.popup) {
    case "nexus-powers":
    case "battle-round":
    case "settings":
    case "export":
    case "message":
    case "controls":
    case "activity-logs":
    case "game-menu":
    case "dialog":
      return state.popup
    default:
      break
  }
  if (state.committed) return "committed"
  switch (mapMode(state)) {
    case "menu": {
      // After the mouse worked the menu no row is highlighted, so there is no row to describe.
      if (state.highlightHidden) return "menu-mouse"
      const entry = menuEntries(context)[state.menuHighlight]
      if (entry === undefined || entry.kind === "explore") return "menu-explore"
      if (entry.kind === "nexus") return "menu-nexus"
      if (entry.kind === "start") return "menu-start"
      return "menu-building"
    }
    case "placing":
      return "placing"
    case "explore":
      return structureAtTile(context, state.planned, state.cursor)?.planned === true ? "explore-planned" : "explore"
    case "plain":
      return "map"
  }
}

/** Esc's own words in a popup: back to the popup this one was opened from, or closed. */
function escBack(state: BuildState): string {
  return state.popupUnder.length > 0 ? "[esc] goes back." : "[esc] closes."
}

/** The menu row the keyboard is on, as a catalog item, when it is one. */
function highlightedItem(context: BuildContext, state: BuildState): ConstructItem | undefined {
  const entry = menuEntries(context)[state.menuHighlight]
  return entry?.kind === "construct" ? context.catalog[entry.index] : undefined
}

/** The label of the building a planned placement under the cursor is. */
function plannedLabel(context: BuildContext, state: BuildState): string {
  const structure = structureAtTile(context, state.planned, state.cursor)
  return structure === null ? "building" : displayName(context, structure.contentId)
}

/**
 * **The one list of hints** — a line for every situation, in plain words, each short enough for the
 * bottom bar at the 80-column floor. Add a situation to `HintSituation` and TypeScript asks for its
 * line here.
 */
export const HINTS: Readonly<Record<HintSituation, (context: BuildContext, state: BuildState) => string>> = {
  // --- Popups ---
  "nexus-powers": (context, state) =>
    nexusPowers(context, state).pending.length > 0
      ? "Pick one: up/down and [enter], or its number. [esc] closes without a pick."
      : "The Nexus powers you have. [esc] closes.",
  "battle-round": (_context, state) =>
    `Battle Round ${state.pulseNumber}: [enter] or [s] starts it, [esc] goes back to the plan.`,
  "game-menu": () => "Up/down and [enter] choose, or press a row's key. [esc] back to the game.",
  settings: (_context, state) => `Left/right change a value, [e] exports them all. ${escBack(state)}`,
  export: (_context, state) => `Paste this into the pull request. Up/down scroll. ${escBack(state)}`,
  message: () => "Read it, then [esc] or a click outside closes it.",
  controls: (_context, state) => `Every key and click, by where you are. Up/down scroll. ${escBack(state)}`,
  "activity-logs": (_context, state) => `Left/right change the filter, [e] exports, up/down read. ${escBack(state)}`,
  // The dialog's two keys, and how far through the scene it is.
  dialog: (context, state) => {
    const of = context.scene?.length ?? 0
    const line = (state.dialog?.line ?? 0) + 1
    if (of <= 1) return "[enter] or [esc] closes it."
    return line < of ? `Line ${line} of ${of}. [enter] next line, [esc] skips the rest.` : `Line ${line} of ${of}. [enter] or [esc] closes it.`
  },

  // --- A committed plan with no Pulse on screen (a Pulse says its own line) ---
  committed: () => "The plan is locked in. [esc] opens the menu.",

  // --- The menu, by the highlighted row ---
  "menu-mouse": () => "Click a row or press its key - or use up/down and [enter].",
  "menu-explore": () => "Explore Map: look around and read what is on each tile. [enter] opens it.",
  // A dealt power is optional for now (the owner, round 5: "it's easier for testing if I can just start a
  // round"): the hints say one is waiting, never that it must be picked.
  "menu-nexus": (context, state) =>
    pendingPicks(context, state) > 0
      ? "Nexus powers: one is waiting to be picked. [enter] opens them."
      : "Nexus powers: read the powers you have. [enter] opens them.",
  "menu-building": (context, state) => {
    const item = highlightedItem(context, state)
    if (item === undefined) return "Pick a building to place."
    const left = remaining(context, state)
    const effect = cardText(context, item.contentId).subtitle.replace(/\.$/u, "")
    return item.cost > left
      ? `${item.label} - ${effect}. Costs ${item.cost}, only ${left} left.`
      : `${item.label} - ${effect}. Costs ${item.cost}. [enter] to place one.`
  },
  "menu-start": (context, state) =>
    pendingPicks(context, state) > 0
      ? setting(state, "powerPick") === "required"
        ? `Start Battle Round ${state.pulseNumber}: pick a Nexus power first, [n] opens them.`
        : `Start Battle Round ${state.pulseNumber} without a Nexus power? [n] picks one, [enter] begins.`
      : `Start Battle Round ${state.pulseNumber}: lock in your plan and fight. [enter] to begin.`,

  // --- The map ---
  // Its own key cancels it, as Esc does; another building waits until it is placed or
  // cancelled, which the refusal itself says when it is tried.
  placing: (context, state) => {
    const item = state.armed === null ? undefined : context.catalog[state.armed]
    const cancelKeys = item === undefined ? "[esc]" : `[${item.hotkey}] or [esc]`
    return `Place the ${item?.label ?? "building"}: arrows move, [enter] places, ${cancelKeys} cancels.`
  },
  explore: () => "Explore Map: arrows move, the panel shows what is here. [esc] goes back.",
  "explore-planned": (context, state) =>
    `Planned ${plannedLabel(context, state)}: [bksp] removes it, [u] undoes the last. [esc] goes back.`,
  // Opened from the map, Explore Map leaves the cursor where it is — it only looks for clear ground on
  // the hand-off from the menu — so Enter reads what is here.
  map: () => "Arrows move the cursor, [enter] explores here, a number selects a building.",
}

/** What can be done where the keyboard is, in the quiet `hint` tone — never about a tile, so it never
 *  lapses on its own: the bottom line shows it whenever no command has anything to say. */
export function hint(context: BuildContext, state: BuildState): StatusMessage {
  return status(HINTS[hintSituation(context, state)](context, state), "hint")
}

/**
 * The last command's own answer — `state.status` — and, when it said nothing while the armed ghost sits
 * on a tile Enter would refuse, that refusal, naming the tile: quietly while the player is only
 * looking, and in the reducer's own red once they actually try (see docs/system-design/presentation.md), which is an answer of
 * its own. **A command's answer comes first**, so a key refused while a building is
 * armed says why ("Place the Barracks or cancel it first") even with the ghost on rock; the
 * ghost's refusal comes back at the next command that says nothing, since an answer lapses then. While
 * arming's ghost shows (`noSpotFound`), what arming said about why the cursor moved stands instead.
 */
export function commandAnswer(state: BuildState, preview: ArmedPreview | null): StatusMessage {
  if (state.status.text !== "" || preview === null || preview.refusal === null || state.noSpotFound) return state.status
  return status(refusalText(preview.refusal))
}

/**
 * **The bottom bar's one line**: the last command's answer while it has one, otherwise
 * the hint for where the keyboard is. An answer lapses at the next command that says nothing
 * (`applyBuildCommand`), so the hint comes back on its own. A Nexus Pulse on screen says its own line
 * instead (`pulseStatus`), unless a popup over it holds the keyboard.
 */
export function bottomLine(context: BuildContext, state: BuildState, preview: ArmedPreview | null): StatusMessage {
  // The dialog names its two keys while it is open; the answer the round opened with waits under it, and is
  // the line again once the scene is over.
  if (state.popup === "dialog") return hint(context, state)
  const answer = commandAnswer(state, preview)
  return answer.text === "" ? hint(context, state) : answer
}

// ---------------------------------------------------------------------------------------------
// The Controls and hotkeys page
// ---------------------------------------------------------------------------------------------

export const CONTROLS_TITLE = "CONTROLS AND HOTKEYS"

/** One line of the page: the keys (or the click) on the left, what they do on the right — or, with no keys,
 *  a line of a group that has none: how the game reads, in the text's column, wrapped by hand to its width. */
export type ControlsLine = Readonly<{ keys: string; text: string }>
export type ControlsSection = Readonly<{ heading: string; lines: readonly ControlsLine[] }>

/** How wide the keys' column is, space included: the longest keys ("click outside") and a gap. Each
 *  line's text fits the 28 columns left beside it at the 80-column floor, a test holds it to it. */
export const CONTROLS_KEYS_WIDTH = 14

/**
 * **The Controls and hotkeys page, as one table** — every key and click the Build Phase and its Nexus
 * Pulse answer, grouped by where the player is, in the words the rows and the top bar use. Accurate to
 * the adapters (`src/build/keyboard.ts`, `src/build/mouse.ts`); the Shift jump is the "Jump distance"
 * setting as it is now (`jumpStep`; its default without one), so the page says what Shift does. `?` opens it from the game
 * — a shortcut named only here, under ANYWHERE.
 *
 * One group has no keys: THE GROUND, after THE MAP, the one thing on the page that is not a key — that units
 * stand tall, so more fit side by side than one behind another, and a row up or down counts two steps across
 * (the rule every range on the map is drawn by, `src/grid/reach.ts`). It is the page that
 * teaches how to play, so how the ground is counted is said here once.
 */
export function controlsPage(jumpStep: number = defaultValue("jumpStep")): readonly ControlsSection[] {
  return [
    {
      heading: "THE MENU",
      lines: [
        { keys: "up/down", text: "choose a row" },
        { keys: "enter/space", text: "press the chosen row" },
        { keys: "1 2 3 ...", text: "select a building, anywhere" },
        { keys: "e", text: "Explore Map" },
        { keys: "n", text: "the Nexus powers" },
        { keys: "s", text: "Start Battle Round (or p)" },
        { keys: "u", text: "undo the last building" },
        { keys: "tab", text: "go to the map" },
        { keys: "esc", text: "the game menu" },
        { keys: "x", text: "nothing (x x x ends here)" },
      ],
    },
    {
      heading: "THE MAP",
      lines: [
        { keys: "arrows", text: "move; hold one to go faster" },
        { keys: "shift+arrow", text: `jump ${jumpStep} tiles` },
        { keys: "option+arrow", text: "the same jump" },
        { keys: "pgup/pgdn", text: "jump up or down" },
        { keys: "home/end", text: "jump left or right" },
        { keys: "enter/space", text: "Explore Map here" },
        { keys: "bksp/delete", text: "remove what is planned here" },
        { keys: "tab/esc/x", text: "back to the menu" },
      ],
    },
    {
      // No keys: how the ground is counted, a row as two columns, which every range is drawn by.
      heading: "THE GROUND",
      lines: [
        { keys: "", text: "rows count double: a row up" },
        { keys: "", text: "or down is 2 tiles of range" },
        { keys: "", text: "or movement, so range 6" },
        { keys: "", text: "reaches 3 rows up and down" },
      ],
    },
    {
      heading: "PLACING A BUILDING",
      lines: [
        { keys: "arrows", text: "move the building" },
        { keys: "enter/space", text: "place it" },
        { keys: "its own key", text: "cancel" },
        { keys: "esc/x", text: "cancel" },
        { keys: "1 2 3 ... e s", text: "wait: place or cancel first" },
      ],
    },
    {
      heading: "EXPLORE MAP",
      lines: [
        { keys: "arrows", text: "look at another tile" },
        { keys: "bksp/delete", text: "remove what is planned here" },
        { keys: "u", text: "undo the last building" },
        { keys: "e/esc/x", text: "go back" },
      ],
    },
    {
      heading: "POPUPS",
      lines: [
        { keys: "up/down", text: "choose a row, or scroll" },
        { keys: "enter/space", text: "press the chosen row" },
        { keys: "a row's key", text: "press that row" },
        { keys: "left/right", text: "change a setting" },
        { keys: "esc/x", text: "go back, or close" },
      ],
    },
    {
      // The dialog at the bottom of the map, as a round opens with a scene.
      heading: "THE DIALOG",
      lines: [
        { keys: "enter/space", text: "the next line" },
        { keys: "click", text: "the next line, anywhere" },
        { keys: "esc/x", text: "skip the rest" },
      ],
    },
    {
      heading: "ANY LIST",
      lines: [
        { keys: "up/down", text: "a row; stops at the ends" },
        { keys: "hold up/down", text: "faster, as on the map" },
        { keys: "shift+up/down", text: "the first or last row" },
        { keys: "pgup/home", text: "the first row" },
        { keys: "pgdn/end", text: "the last row" },
      ],
    },
    {
      heading: "THE MOUSE",
      lines: [
        { keys: "click a row", text: "press it" },
        { keys: "click the map", text: "move the cursor there" },
        { keys: "click again", text: "place it (the same tile)" },
        { keys: "double click", text: "place where you pointed" },
        { keys: "wheel", text: `move ${WHEEL_TILES} tiles, or scroll` },
        { keys: "right click", text: "go back, like x" },
        { keys: "top bar [esc]", text: "the same as esc" },
        { keys: "click outside", text: "close the popup" },
      ],
    },
    {
      heading: "THE BATTLE ROUND",
      lines: [
        { keys: "space", text: "pause or resume" },
        { keys: "[ and ]", text: "slower, faster" },
        { keys: ". and ,", text: "step a frame, a tick" },
        { keys: "r", text: "replay" },
        { keys: "arrows", text: "look around the map" },
      ],
    },
    {
      heading: "ANYWHERE",
      lines: [
        { keys: "esc", text: "go back one step" },
        { keys: "x", text: "go back; stops at the menu" },
        { keys: "h j k l", text: "the arrows, as in vim" },
        { keys: "H J K L", text: "shift+arrow, the jump" },
        { keys: "q", text: "the game menu" },
        { keys: "d", text: "the Experiments (playtests)" },
        { keys: "?", text: "this page" },
        { keys: "ctrl+c", text: "quit at once" },
      ],
    },
  ]
}

/** How many key lines the page has — what Up/Down walk, headings left out. */
export function controlsLineCount(): number {
  return controlsPage().reduce((count, section) => count + section.lines.length, 0)
}
