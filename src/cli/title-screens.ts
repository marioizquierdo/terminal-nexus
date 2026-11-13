// The title menu's screens as one driveable thing, with no terminal: the top-level menu, Settings, Story's placeholder,
// About, and the Skirmish screens — the Skirmish screen (New game, Load game), New game's setup and Load game's list
// of saves and the loaded save's changes (docs/system-design/ui-patterns.md, "The setup screen"). A key in, the next
// screen and whatever it asked for out (a battle to open, the settings changed, leaving), and the frame it shows now.
//
// `runMenu` (`./menu.ts`) wires it to a terminal, the browser page to a canvas, and the scripted playtest
// (`src/playtest/game.ts`) to a key script — three hosts of one set of screens, so what a playtest presses is what a
// player presses. It reads no file and no clock of its own: the saves it lists, the profiles it offers, the name a
// `Player` slot shows and the clock a seed comes from are handed in.
//
// **Every row is a command**: its hotkey, Enter on it and a click on it do one thing (`MenuSession`, the title menu's
// adapters), and the setup's rows come round to their next value when chosen, as a Settings row does. The seed is the
// one row typed into: chosen, its digits type and Enter keeps them.

import type { ActivityLog } from "../log/activity.ts"
import type { Profiles, SaveFile, SaveSetup } from "../skirmish/save.ts"
import { SAVE_FORMAT, SLOTS, controllerKind, readSave } from "../skirmish/save.ts"
import { SHIPPED_SAVES } from "../skirmish/shipped-players.ts"
import type { SetupField } from "../skirmish/setup.ts"
import { cursorKeyOf } from "../terminal/list-keys.ts"
import { LOAD_GAME_FIELDS, NEW_GAME_FIELDS, fieldAbout, fieldDimmed, fieldText, nextValue, setupDefaults, startProblem } from "../skirmish/setup.ts"
import { clockSeed, commanderNameOf, isSkirmishSeed, mapNameOf, SKIRMISH_SEED_LIMIT } from "../skirmish/words.ts"
import { nextColorDepth, nextGlyphPack, nextTheme, toggleReducedMotion } from "../settings/types.ts"
import type { Settings } from "../settings/index.ts"
import { aboutSections } from "../title-menu/about.ts"
import type { TextSection } from "../title-menu/about.ts"
import type { MenuLayout } from "../title-menu/layout.ts"
import { MenuSession } from "../title-menu/session.ts"
import type { MenuItem } from "../title-menu/types.ts"
import { parseMouseClick } from "../title-menu/mouse.ts"
import { shownSetting } from "../build/all-settings.ts"
import type { ReadonlyCellFrame } from "../view/frame.ts"
import { composeMenuFrame, MENU_LAYOUT } from "../view/menu.ts"
import { frameToText } from "../view/frame.ts"
import type { Destination, LevelDestination, TitlePlace } from "./route.ts"
import { parseRoute } from "./route.ts"
import { skirmishLevel } from "./skirmish-play.ts"

/** Five rows (the owner, 2026-11-11: Skirmish is "the center stone for game design and testing", so it comes first).
 *  About sits above Exit, so Exit's digit is 5 — the digits stay one sequence in walking order, and `q` still leaves
 *  from every title screen. Each row but Exit names the route it opens. */
export const TOP_LEVEL_ITEMS: readonly MenuItem[] = [
  { id: "skirmish", hotkey: "1", label: "Skirmish", route: "skirmish?setup" },
  { id: "story", hotkey: "2", label: "Story", route: "story" },
  { id: "settings", hotkey: "3", label: "Settings", route: "settings" },
  { id: "about", hotkey: "4", label: "About", route: "about" },
  { id: "exit", hotkey: "5", label: "Exit" },
]

/** The Skirmish screen: New game, Load game, and the way back. */
export const SKIRMISH_ITEMS: readonly MenuItem[] = [
  { id: "new-game", hotkey: "1", label: "New game", route: "skirmish?setup=new" },
  { id: "load-game", hotkey: "2", label: "Load game", route: "skirmish?setup=load" },
  { id: "back", hotkey: "3", label: "Back" },
]

/** A screen with only words to show — Story's placeholder and About — has exactly one row, the way back. */
const BACK_ONLY_ITEMS: readonly MenuItem[] = [{ id: "back", hotkey: "1", label: "Back" }]

/** The Settings screen's rows, rebuilt from the current values every time one changes. */
export function settingsItems(settings: Settings): readonly MenuItem[] {
  return [
    { id: "colors", hotkey: "1", label: `Colours: ${shownSetting("colors").format(settings.colors)}` },
    { id: "theme", hotkey: "2", label: `Background: ${settings.theme}` },
    { id: "glyphPack", hotkey: "3", label: `Symbols: ${settings.glyphPack}` },
    { id: "reducedMotion", hotkey: "4", label: `Reduced motion: ${settings.reducedMotion ? "on" : "off"}` },
    { id: "back", hotkey: "5", label: "Back" },
  ]
}

function withNextValue(settings: Settings, id: string): Settings {
  switch (id) {
    case "colors":
      return { ...settings, colors: nextColorDepth(settings.colors) }
    case "theme":
      return { ...settings, theme: nextTheme(settings.theme) }
    case "glyphPack":
      return { ...settings, glyphPack: nextGlyphPack(settings.glyphPack) }
    case "reducedMotion":
      return { ...settings, reducedMotion: toggleReducedMotion(settings.reducedMotion) }
    default:
      return settings
  }
}

/** Every title screen. */
export type TitleScreen = "top" | "settings" | "story" | "about" | "skirmish" | "new-game" | "load-game" | "load-edit"

/** The rows of the setup screens are a row a line, from the fourth: thirteen of them fit above the lines that explain. */
export const SETUP_LAYOUT: MenuLayout = { column: 4, row: 4, rowStep: 1 }

/** Each screen's subtitle, layout, and whether it has somewhere to go back to. */
const SCREEN_INFO: Readonly<Record<TitleScreen, Readonly<{ subtitle: string; showBack: boolean; layout: MenuLayout }>>> = {
  top: { subtitle: "main menu", showBack: false, layout: MENU_LAYOUT },
  settings: { subtitle: "settings", showBack: true, layout: MENU_LAYOUT },
  story: { subtitle: "story", showBack: true, layout: MENU_LAYOUT },
  about: { subtitle: "about", showBack: true, layout: MENU_LAYOUT },
  skirmish: { subtitle: "skirmish", showBack: true, layout: MENU_LAYOUT },
  "new-game": { subtitle: "skirmish - new game", showBack: true, layout: SETUP_LAYOUT },
  "load-game": { subtitle: "skirmish - load game", showBack: true, layout: SETUP_LAYOUT },
  "load-edit": { subtitle: "skirmish - load game", showBack: true, layout: SETUP_LAYOUT },
}

/** The screen each title menu place opens, and the line it says there. */
const PLACE_SCREENS: Readonly<Record<TitlePlace, Readonly<{ screen: TitleScreen; notice?: string }>>> = {
  menu: { screen: "top" },
  story: { screen: "story", notice: "Story is not built yet - its menu is coming soon." },
  settings: { screen: "settings" },
  about: { screen: "about" },
  skirmish: { screen: "skirmish" },
  "new-game": { screen: "new-game" },
  "load-game": { screen: "load-game" },
}

/** Where each screen's Back (and Esc) goes. */
const BACK_TO: Readonly<Record<TitleScreen, TitleScreen>> = {
  top: "top",
  settings: "top",
  story: "top",
  about: "top",
  skirmish: "top",
  "new-game": "skirmish",
  "load-game": "skirmish",
  "load-edit": "load-game",
}

/** A save file Load game lists: where it is, as a person reads it, and what it holds — or why it cannot be loaded. */
export type SaveEntry = Readonly<{
  /** The path the file was read from. */
  path: string
  /** The path as the list shows it, and as Save game then offers it back: `~/.terminal-nexus/saves/mine.save.json`, `saves/crossing-new.save.json`. */
  shown: string
  save: SaveFile | null
  /** Why it cannot be loaded, when `save` is `null`: the loader's first problem. */
  problem?: string
}>

/** The hotkeys a list's rows take, in order: the digits, then the letters `b` (Back) and `q` (quit) leave free. */
const LIST_KEYS = [..."1234567890acdefghijklmnoprstuvwxyz"]

/** How many saves Load game lists at once: the rows that fit above the lines that explain, the last being Back. */
export const LOAD_ROWS = 12

export type TitleScreensOptions = Readonly<{
  settings: Settings
  /** The commit this build is, for About. */
  buildId?: string
  /** Milliseconds, for a new battle's seed: New game's, and a result's New seed. */
  now: () => number
  /** The name a `Player` slot shows (`Player: marioiz`). */
  playerName: string
  /** The script profiles the setup offers: `players/scripts/` in a terminal, the shipped ones on the browser page. */
  profiles: Profiles
  /** The saves Load game lists, newest first: the player's saves folder, then the examples. Asked each time it opens. */
  saves: () => readonly SaveEntry[]
  /** Where the saves folder is, as Load game says it. */
  savesShown?: string
  /** A battle to open, chosen here: the host hands the terminal to its Build Phase. */
  onOpen: (at: LevelDestination) => void
  /** A Skirmish route (`skirmish`, `skirmish?seed=7`) chosen from a row that names one: opened by the host. */
  onSkirmishRoute?: (destination: Extract<Destination, { kind: "skirmish" }>) => void
  onQuit: () => void
  onSettingsChange?: (settings: Settings) => void
  /** Where a row picked is recorded (`menu.select`). */
  record?: ActivityLog
  /** A setup to open New game on, in place of the defaults: the battle a result's "Setup screen" came from. */
  setup?: SaveSetup
  /** **A note** (`!`): the line typed, the screen's route and the screen as text, to be written by the host, which says
   *  how it went. Absent: the note says this screen cannot write one. */
  onNote?: (line: string, at: string, screen: string) => Readonly<{ ok: boolean; text: string }>
}>

/** The route each screen is at, for a note. */
const SCREEN_ROUTES: Readonly<Record<TitleScreen, string>> = {
  top: "menu",
  settings: "settings",
  story: "story",
  about: "about",
  skirmish: "skirmish?setup",
  "new-game": "skirmish?setup=new",
  "load-game": "skirmish?setup=load",
  "load-edit": "skirmish?setup=load",
}

/**
 * **The title menu's screens**: one `MenuSession` a screen, the setup's rows rebuilt from the setup each time one
 * changes, and the frame `composeMenuFrame` draws. A host feeds it keys (`handleKey`, a key at a time, so a key that
 * changes screen and the one typed right behind it each reach the screen current for it) and draws `frame()`.
 */
export class TitleScreens {
  private screenNow: TitleScreen = "top"
  private noticeNow: string | null = null
  private settingsNow: Settings
  private readonly options: TitleScreensOptions
  private readonly sessions: Record<TitleScreen, MenuSession>
  /** New game's setup as chosen so far. */
  private setup: SaveSetup
  /** The seed being typed, while the Seed row takes digits; `null` otherwise. */
  private seedText: string | null = null
  /** The note being typed (`!`), and the screen as it stood when it opened; `null` otherwise. */
  private noteLine: Readonly<{ line: string; screen: string }> | null = null
  /** The saves Load game lists, as last asked for. */
  private saves: readonly SaveEntry[] = []
  /** The save chosen in Load game, and its setup as changed so far. */
  private loading: Readonly<{ entry: SaveEntry; save: SaveFile; setup: SaveSetup }> | null = null

  constructor(options: TitleScreensOptions) {
    this.options = options
    this.settingsNow = options.settings
    this.setup = options.setup ?? setupDefaults(clockSeed(options.now()), options.playerName, options.profiles)
    const leave = (): void => options.onQuit()
    const back = (): void => this.back()
    this.sessions = {
      top: new MenuSession({ items: TOP_LEVEL_ITEMS, onActivate: this.picked("top", (item) => this.topRow(item)), onQuit: leave }),
      settings: new MenuSession({ items: settingsItems(this.settingsNow), onActivate: this.picked("settings", (item) => this.settingsRow(item)), onQuit: leave, onBack: back }),
      story: new MenuSession({ items: BACK_ONLY_ITEMS, onActivate: this.picked("story", back), onQuit: leave, onBack: back }),
      about: new MenuSession({ items: BACK_ONLY_ITEMS, onActivate: this.picked("about", back), onQuit: leave, onBack: back }),
      skirmish: new MenuSession({ items: SKIRMISH_ITEMS, onActivate: this.picked("skirmish", (item) => this.skirmishRow(item)), onQuit: leave, onBack: back }),
      "new-game": new MenuSession({ items: [], onActivate: this.picked("new-game", (item) => this.newGameRow(item)), onQuit: leave, onBack: back }),
      "load-game": new MenuSession({ items: [], onActivate: this.picked("load-game", (item) => this.loadRow(item)), onQuit: leave, onBack: back }),
      "load-edit": new MenuSession({ items: [], onActivate: this.picked("load-edit", (item) => this.loadEditRow(item)), onQuit: leave, onBack: back }),
    }
    this.refreshSetup()
  }

  /** The screen showing. */
  get screen(): TitleScreen {
    return this.screenNow
  }

  /** The line under the rows, when one is said. */
  get notice(): string | null {
    return this.noticeNow
  }

  get settings(): Settings {
    return this.settingsNow
  }

  /** New game's setup as chosen so far. */
  get newGame(): SaveSetup {
    return this.setup
  }

  /** The loaded save's setup as changed so far, on Load game's second screen. */
  get loadedSetup(): SaveSetup | null {
    return this.loading?.setup ?? null
  }

  /** Where the current screen's rows are drawn, which the mouse reads too. */
  get layout(): MenuLayout {
    return SCREEN_INFO[this.screenNow].layout
  }

  /** The current screen's rows and highlight. */
  get list(): MenuSession["state"] {
    return this.sessions[this.screenNow].state
  }

  /** Whether the Seed row is being typed into. */
  get typingSeed(): boolean {
    return this.seedText !== null
  }

  private picked(on: TitleScreen, act: (item: MenuItem) => void): (item: MenuItem) => void {
    return (item) => {
      this.options.record?.log("menu.select", { screen: on, item: item.id, ...(item.route === undefined ? {} : { route: item.route }) })
      act(item)
    }
  }

  /**
   * **A title menu place, opened**: its screen, the row that names it highlighted on the screens before it (so Esc
   * comes back to it as it would for a player who had chosen it), and its line.
   */
  follow(place: TitlePlace): void {
    const opens = PLACE_SCREENS[place]
    this.show(opens.screen)
    this.noticeNow = opens.notice ?? null
    const highlight = (screen: TitleScreen, id: string): void => {
      const index = this.sessions[screen].state.items.findIndex((item) => item.id === id)
      if (index >= 0) this.sessions[screen].dispatch({ kind: "highlight", index })
    }
    if (opens.screen !== "top") highlight("top", ["new-game", "load-game"].includes(opens.screen) ? "skirmish" : opens.screen)
    if (opens.screen === "new-game" || opens.screen === "load-game") highlight("skirmish", opens.screen)
  }

  private show(screen: TitleScreen): void {
    this.screenNow = screen
    this.noticeNow = null
    this.seedText = null
    if (screen === "load-game") this.listSaves()
    if (screen === "new-game") this.refreshSetup()
  }

  private back(): void {
    const to = BACK_TO[this.screenNow]
    if (this.screenNow === "load-edit") this.loading = null
    this.show(to)
  }

  /** One key: typed into the seed while it is being typed, or through the screen's own adapters. */
  handleKey(key: string): void {
    if (this.noteLine !== null) return this.typeNote(key)
    if (key === "!" && this.seedText === null) {
      this.noteLine = { line: "", screen: frameToText(this.frame()) }
      return
    }
    if (this.seedText !== null && this.typeSeed(key)) return
    if (this.stepRow(key)) return
    this.sessions[this.screenNow].handleKey(key, this.layout)
  }

  /** Left and Right on a setup row (New game, or a loaded save's): the value before or after, as the Settings rows step
   *  theirs. Returns whether the key was one. */
  private stepRow(key: string): boolean {
    if (this.screenNow !== "new-game" && this.screenNow !== "load-edit") return false
    const arrow = cursorKeyOf(key)
    if (arrow === null || arrow.dx === 0 || arrow.dy !== 0) return false
    const state = this.sessions[this.screenNow].state
    const item = state.items[state.highlighted]
    const fields = this.screenNow === "new-game" ? NEW_GAME_FIELDS : LOAD_GAME_FIELDS
    const field = fields.find((candidate) => fieldId(candidate) === item?.id)
    if (field === undefined || field.kind === "seed" || field.kind === "goal" || item?.disabled === true) return true
    const step = arrow.dx < 0 ? -1 : 1
    if (this.screenNow === "new-game") {
      this.setup = nextValue(this.setup, field, this.options.playerName, this.options.profiles, step)
      this.noticeNow = null
      this.refreshSetup()
    } else if (this.loading !== null) {
      this.loading = { ...this.loading, setup: nextValue(this.loading.setup, field, this.options.playerName, this.options.profiles, step) }
      this.noticeNow = null
      this.refreshLoad()
    }
    return true
  }

  // --- The rows ----------------------------------------------------------------------------------------------------

  private topRow(item: MenuItem): void {
    if (item.route !== undefined) {
      const destination = parseRoute(item.route)
      if (destination.kind === "title") this.follow(destination.place)
      else if (destination.kind === "skirmish") this.options.onSkirmishRoute?.(destination)
      return
    }
    if (item.id === "exit") this.options.onQuit()
  }

  private settingsRow(item: MenuItem): void {
    if (item.id === "back") {
      this.back()
      return
    }
    this.settingsNow = withNextValue(this.settingsNow, item.id)
    this.sessions.settings.setItems(settingsItems(this.settingsNow))
    this.options.onSettingsChange?.(this.settingsNow)
  }

  private skirmishRow(item: MenuItem): void {
    if (item.id === "back") this.back()
    else this.follow(item.id === "new-game" ? "new-game" : "load-game")
  }

  /** New game's rows: each field with its hotkey, then Start and Back. */
  private refreshSetup(): void {
    const { playerName, profiles } = this.options
    const keys = [..."1234567890"]
    const rows: MenuItem[] = NEW_GAME_FIELDS.map((field, index) => {
      const { name, value } = fieldText(this.setup, field, playerName, profiles)
      const shown = field.kind === "seed" && this.seedText !== null ? `${this.seedText}_` : value
      return { id: fieldId(field), hotkey: keys[index] ?? "e", label: `${name.padEnd(24)}${shown}`, ...(fieldDimmed(this.setup, field) ? { disabled: true } : {}) }
    })
    const problem = startProblem(this.setup)
    rows.push({ id: "start", hotkey: "s", label: problem === null ? "Start" : "Start (not yet: see below)", ...(problem === null ? {} : { disabled: true }) })
    rows.push({ id: "back", hotkey: "b", label: "Back" })
    const session = this.sessions["new-game"]
    const first = session.state.items.length === 0
    session.setItems(rows)
    // Every row has a default, so the screen opens on Start: Enter starts at once.
    if (first) session.dispatch({ kind: "highlight", index: rows.length - 2 })
  }

  private newGameRow(item: MenuItem): void {
    if (item.id === "back") return this.back()
    if (item.id === "start") return this.startNew()
    const field = NEW_GAME_FIELDS.find((candidate) => fieldId(candidate) === item.id)
    if (field === undefined) return
    if (field.kind === "seed") {
      this.seedText = ""
      this.noticeNow = "Type the seed's digits, then Enter; Esc keeps the one it was."
    } else if (field.kind === "goal") {
      this.noticeNow = "Elimination is the only goal built so far."
    } else {
      this.setup = nextValue(this.setup, field, this.options.playerName, this.options.profiles)
      this.noticeNow = null
    }
    this.refreshSetup()
  }

  /** Whether a note is being typed. */
  get typingNote(): boolean {
    return this.noteLine !== null
  }

  /** A key while the note is typed: a character types, Backspace takes one off, Enter saves it, Esc goes back. */
  private typeNote(key: string): void {
    const note = this.noteLine
    if (note === null) return
    if (key === "\u001b") {
      this.noteLine = null
      this.noticeNow = "No note saved."
    } else if (key === "\r" || key === "\n") {
      const answer = this.options.onNote?.(note.line.trim(), SCREEN_ROUTES[this.screenNow], note.screen) ?? { ok: false, text: "This screen cannot write a note." }
      this.options.record?.log("game.note", { line: note.line.trim(), saved: answer.ok, answer: answer.text })
      this.noteLine = null
      this.noticeNow = answer.text
    } else if (key === "\u007f" || key === "\b") {
      this.noteLine = { ...note, line: note.line.slice(0, -1) }
    } else if ([...key].length === 1 && key >= " ") {
      this.noteLine = { ...note, line: `${note.line}${key}`.slice(0, 200) }
    }
  }

  /** A key while the seed is typed: a digit types, Backspace takes one off, Enter keeps it, Esc keeps the old one. A
   *  key that is none of those is the screen's (`false`). */
  private typeSeed(key: string): boolean {
    const text = this.seedText ?? ""
    if (/^[0-9]$/u.test(key)) {
      if (text.length < String(SKIRMISH_SEED_LIMIT - 1).length) this.seedText = text + key
    } else if (key === "\u007f" || key === "\b") {
      this.seedText = text.slice(0, -1)
    } else if (key === "\r" || key === "\n") {
      const seed = Number(text)
      if (text !== "" && isSkirmishSeed(seed)) this.setup = { ...this.setup, seed }
      this.seedText = null
      this.noticeNow = text === "" ? "The seed is as it was." : `Seed ${this.setup.seed}.`
    } else if (key === "\u001b") {
      this.seedText = null
      this.noticeNow = "The seed is as it was."
    } else {
      return parseMouseClick(key) === null ? true : ((this.seedText = null), false)
    }
    this.refreshSetup()
    return true
  }

  /** Start: the setup, opened as a new battle — or refused, saying why. */
  private startNew(): void {
    const problem = startProblem(this.setup)
    if (problem !== null) {
      this.noticeNow = problem
      return
    }
    const save: SaveFile = { format: SAVE_FORMAT, setup: this.setup }
    this.open(save, {})
  }

  private open(save: SaveFile, source: Readonly<{ file?: string }>): void {
    const level = skirmishLevel(save, source, { newSeed: () => clockSeed(this.options.now()), profiles: this.options.profiles })
    this.options.onOpen({ kind: "level", level, round: 1 })
  }

  // --- Load game ---------------------------------------------------------------------------------------------------

  private listSaves(): void {
    this.saves = this.options.saves()
    const shown = this.saves.slice(0, LOAD_ROWS)
    const rows: MenuItem[] = shown.map((entry, index) => ({
      id: `save:${index}`,
      hotkey: LIST_KEYS[index] ?? "",
      label: saveLine(entry),
      ...(entry.save === null ? { disabled: true } : {}),
    }))
    rows.push({ id: "back", hotkey: "b", label: "Back" })
    this.sessions["load-game"].setItems(rows)
    if (this.saves.length > LOAD_ROWS) this.noticeNow = `${this.saves.length - LOAD_ROWS} older saves are not listed${this.options.savesShown === undefined ? "" : ` (in ${this.options.savesShown})`}.`
    else if (this.saves.length === 0) this.noticeNow = "No saves yet: Save game, on a Skirmish's game menu (Esc), writes one."
  }

  private loadRow(item: MenuItem): void {
    if (item.id === "back") return this.back()
    const entry = this.saves[Number(item.id.slice("save:".length))]
    if (entry === undefined) return
    if (entry.save === null) {
      this.noticeNow = `${entry.shown} cannot be loaded: ${entry.problem ?? "not a save"}`
      return
    }
    this.loading = { entry, save: entry.save, setup: entry.save.setup }
    this.show("load-edit")
    this.refreshLoad(true)
  }

  private refreshLoad(first = false): void {
    const loading = this.loading
    if (loading === null) return
    const { playerName, profiles } = this.options
    const rows: MenuItem[] = LOAD_GAME_FIELDS.map((field, index) => {
      const { name, value } = fieldText(loading.setup, field, playerName, profiles)
      return { id: fieldId(field), hotkey: String(index + 1), label: `${name.padEnd(24)}${value}`, ...(fieldDimmed(loading.setup, field) ? { disabled: true } : {}) }
    })
    const problem = loading.save.start !== undefined ? "a sandbox" : startProblem(loading.setup)
    rows.push({ id: "open", hotkey: "s", label: problem === null ? "Open" : "Open (not yet: see below)", ...(problem === null ? {} : { disabled: true }) })
    rows.push({ id: "back", hotkey: "b", label: "Back" })
    const session = this.sessions["load-edit"]
    session.setItems(rows)
    if (first) session.dispatch({ kind: "highlight", index: rows.length - 2 })
  }

  private loadEditRow(item: MenuItem): void {
    const loading = this.loading
    if (loading === null) return
    if (item.id === "back") return this.back()
    if (item.id === "open") return this.openLoaded()
    const field = LOAD_GAME_FIELDS.find((candidate) => fieldId(candidate) === item.id)
    if (field === undefined) return
    this.loading = { ...loading, setup: nextValue(loading.setup, field, this.options.playerName, this.options.profiles) }
    this.noticeNow = null
    this.refreshLoad()
  }

  /** Open: the save with its changed setup, at its Build Phase; p1's draft dropped when p1 is no longer a player. */
  private openLoaded(): void {
    const loading = this.loading
    if (loading === null) return
    if (loading.save.start !== undefined) {
      this.noticeNow = "A sandbox plays one Battle Round in grid: grid <file>, not here."
      return
    }
    const problem = startProblem(loading.setup)
    if (problem !== null) {
      this.noticeNow = problem
      return
    }
    const { draft, ...rest } = loading.save
    const kept = draft?.p1 !== undefined && controllerKind(loading.setup.slots.p1.controller) === "player" ? { draft: { p1: draft.p1 } } : {}
    this.open({ ...rest, setup: loading.setup, ...kept }, { file: loading.entry.shown })
  }

  // --- The frame ---------------------------------------------------------------------------------------------------

  /** The line that explains the highlighted row of a setup screen, or a save's notes on Load game. */
  private detail(): string | undefined {
    const { items, highlighted } = this.list
    const item = items[highlighted]
    if (item === undefined) return undefined
    if (this.screenNow === "new-game" || this.screenNow === "load-edit") {
      const setup = this.screenNow === "new-game" ? this.setup : (this.loading?.setup ?? this.setup)
      if (item.id === "start" || item.id === "open") {
        const problem = this.screenNow === "load-edit" && this.loading?.save.start !== undefined ? "A sandbox plays in grid, not here." : startProblem(setup)
        if (problem !== null) return problem
        const watching = SLOTS.every((slot) => controllerKind(setup.slots[slot].controller) !== "player")
        return `${commanderNameOf(setup.slots.p1.commander)} against ${commanderNameOf(setup.slots.p2.commander)} on ${mapNameOf(setup.map)}, seed ${setup.seed}${watching ? ": both scripts, a battle to watch." : "."}`
      }
      if (item.id === "back") return undefined
      const field = [...NEW_GAME_FIELDS, ...LOAD_GAME_FIELDS].find((candidate) => fieldId(candidate) === item.id)
      return field === undefined ? undefined : fieldAbout(setup, field, this.options.profiles)
    }
    if (this.screenNow === "load-game" && item.id.startsWith("save:")) {
      const entry = this.saves[Number(item.id.slice("save:".length))]
      if (entry === undefined) return undefined
      return entry.save === null ? `Cannot be loaded: ${entry.problem ?? "not a save"}` : `${entry.shown}${entry.save.notes === undefined ? "" : ` - ${entry.save.notes}`}`
    }
    if (this.screenNow === "skirmish") {
      return item.id === "new-game" ? "Choose the map, the Commanders and who plays each side, then Start." : item.id === "load-game" ? "Carry on a saved battle, with other players in its slots if you like." : undefined
    }
    return undefined
  }

  /** What the loaded save is, above its rows' explanation: the battle so far, which its map and Commanders fix. */
  private body(): readonly TextSection[] | undefined {
    if (this.screenNow === "about") return aboutSections(this.options.buildId)
    if (this.screenNow !== "load-edit" || this.loading === null) return undefined
    const { save, entry } = this.loading
    const round = save.state?.round ?? 1
    const over = save.state?.result !== undefined && save.state.result !== null
    return [
      {
        text: [
          `${entry.shown}: ${over ? "the battle over" : `round ${round} of ${save.setup.rounds}`}, ${commanderNameOf(save.setup.slots.p1.commander)} against ${commanderNameOf(save.setup.slots.p2.commander)} on ${mapNameOf(save.setup.map)}, seed ${save.setup.seed}. Who plays each side may change; the map and the Commanders stay.`,
        ],
        quiet: true,
      },
    ]
  }

  frame(): ReadonlyCellFrame {
    const info = SCREEN_INFO[this.screenNow]
    const typing = this.noteLine
    const detail = typing === null ? this.detail() : "Note: what did you notice? One line; Enter saves it with this screen, Esc goes back."
    const body = this.body()
    return composeMenuFrame(
      {
        state: this.list,
        notice: typing === null ? this.noticeNow : `> ${typing.line}_`,
        glyphPack: this.settingsNow.glyphPack,
        subtitle: info.subtitle,
        showBack: info.showBack,
        layout: info.layout,
        ...(detail === undefined ? {} : { detail }),
        ...(body === undefined ? {} : { body }),
      },
      this.settingsNow.colors,
    )
  }
}

/** A field's row id. */
function fieldId(field: SetupField): string {
  if (field.kind === "commander" || field.kind === "controller" || field.kind === "credits") return `${field.kind}:${field.slot}`
  if (field.kind === "modifier") return `modifier:${field.modifier}`
  return field.kind
}

/** The example saves the game ships, as Load game lists them on a host with no files (the browser page). */
export function shippedSaves(profiles: Profiles): readonly SaveEntry[] {
  return [...SHIPPED_SAVES].map(([path, text]) => {
    const { save, problems } = readSave(text, profiles)
    return save === null ? { path, shown: path, save: null, problem: problems[0] ?? "not a save" } : { path, shown: path, save }
  })
}

/** A save as Load game lists it: its name, its round and its Commanders. */
export function saveLine(entry: SaveEntry): string {
  const save = entry.save
  const name = entry.shown.slice(entry.shown.lastIndexOf("/") + 1).replace(/\.save\.json$|\.json$/u, "")
  if (save === null) return `${name.padEnd(26)}cannot be loaded`
  const round = save.state?.result !== undefined && save.state.result !== null ? "over" : `round ${save.state?.round ?? 1}`
  const who = save.start !== undefined ? "sandbox" : `${commanderNameOf(save.setup.slots.p1.commander)} v ${commanderNameOf(save.setup.slots.p2.commander)}`
  return `${name.slice(0, 25).padEnd(26)}${round.padEnd(9)}${who}`
}
