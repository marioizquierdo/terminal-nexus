// A scripted playtest of the whole game, not one screen: it opens where a route says — the title menu (`menu`, the
// Skirmish screen `skirmish?setup`, New game, Load game) or a Build Phase (a story mission's, a Skirmish's) — and follows
// the script from screen to screen as a player would: New game's Start or a loaded save's Open hands the rest of the
// script to that battle's Build Phase (`BuildDriver`, `./build.ts`), and a result's Setup screen hands it back to New
// game, on the battle's setup. Every step's frame is kept, with which screen drew it.
//
// No terminal and no clock of its own: the title screens are `TitleScreens` (`src/cli/title-screens.ts`), the very
// screens the game's menu loop draws, and the saves Load game lists, the profiles and the seed's clock are handed in.

import type { BuildContext, BuildState } from "../build/state.ts"
import type { Experiments } from "../build/experiments.ts"
import type { LevelDestination, TitlePlace } from "../cli/route.ts"
import type { SaveEntry } from "../cli/title-screens.ts"
import { TitleScreens } from "../cli/title-screens.ts"
import { positionOf, isSkirmish } from "../cli/skirmish-play.ts"
import type { ActivityLog } from "../log/activity.ts"
import { createActivityLog } from "../log/activity.ts"
import type { Profiles, SaveSetup } from "../skirmish/save.ts"
import { SHIPPED_PROFILES } from "../skirmish/shipped-players.ts"
import { DEFAULT_PLAYER_NAME } from "../skirmish/setup.ts"
import type { Settings } from "../settings/types.ts"
import { DEFAULT_SETTINGS } from "../settings/types.ts"
import type { ReadonlyCellFrame } from "../view/frame.ts"
import { keysFromChunk } from "../terminal/playback.ts"
import { formatMouseClick } from "../title-menu/mouse.ts"
import { BuildDriver } from "./build.ts"
import type { PlaytestClock } from "./build.ts"
import { UNTIMED_GAP_MS } from "./deliver.ts"
import type { PlaytestStep } from "./keys.ts"

/** Where a game playtest opens: a title menu place, or a Build Phase. */
export type GameStart = Readonly<{ kind: "title"; place: TitlePlace; setup?: SaveSetup }> | LevelDestination

export type GamePlaytestOptions = Readonly<{
  steps: readonly PlaytestStep[]
  start: GameStart
  columns?: number
  rows?: number
  settings?: Settings
  experiments?: Partial<Experiments>
  /** The profiles New game offers and its slots play: the shipped ones unless given. */
  profiles?: Profiles
  /** The saves Load game lists: none unless given. */
  saves?: () => readonly SaveEntry[]
  /** The name a `Player` slot shows. */
  playerName?: string
  /** Milliseconds, for New game's seed: a fixed clock unless given, so a script plays the same battle each run. */
  now?: () => number
  /** Where Save game writes a bare name (`BuildPlaytestOptions.savesFolder`). */
  savesFolder?: string
}>

/** One step's screen: which screen drew it, the frame, and — on a Build Phase — its state. */
export type GameFrame = Readonly<{
  index: number
  label: string
  bytes: string
  screen: "title" | "build"
  frame: ReadonlyCellFrame
  /** The Build Phase's state, on a Build Phase; `null` on the title menu. */
  state: BuildState | null
  /** The title screen showing, on the title menu (`new-game`, `load-game`, ...). */
  title?: string
  settings: Settings
  moveKind: string | null
  /** The frame row the bottom line is on, on a Build Phase; on the title menu, what the summary says instead. */
  footerRow: number | null
  /** On the title menu: the screen, its highlighted row and its notice, in a line. */
  summary?: string
}>

export type GamePlaytest = Readonly<{
  frames: readonly GameFrame[]
  activity: ActivityLog
  /** The Build Phase's context when the run ended on one: its round, its Skirmish. */
  round: BuildContext | null
  /** Set when the script left the game (`q` on the title menu, the game menu's Quit). */
  ended: Readonly<{ atStep: number; skipped: number }> | null
}>

/** The clock New game's seed is read from when none is given: fixed, so the same script plays the same battle. */
export const PLAYTEST_NOW = 1_234_567_890

/**
 * **A key script played through the game's screens**, title menu and Build Phase alike, each step its frame. A key on
 * the title menu goes through its adapters as the bytes a terminal sends (a cell click as the SGR press); a grid tile
 * click (`click:X,Y`) means nothing there and stops the run, naming the step.
 */
export function runGamePlaytest(options: GamePlaytestOptions): GamePlaytest {
  const clock: PlaytestClock = { now: 0 }
  const activity = createActivityLog(() => clock.now)
  const settingsBase = options.settings ?? { ...DEFAULT_SETTINGS, colors: "truecolor" as const }
  const profiles = options.profiles ?? SHIPPED_PROFILES
  const now = options.now ?? ((): number => PLAYTEST_NOW)
  let settings = settingsBase
  let title: TitleScreens | null = null
  let build: BuildDriver | null = null
  let quit = false

  const openBuild = (at: LevelDestination): void => {
    title = null
    build = new BuildDriver({
      steps: [],
      at,
      settings,
      ...(options.columns === undefined ? {} : { columns: options.columns }),
      ...(options.rows === undefined ? {} : { rows: options.rows }),
      ...(options.experiments === undefined ? {} : { experiments: options.experiments }),
      ...(options.savesFolder === undefined ? {} : { savesFolder: options.savesFolder }),
      activity,
      clock,
      onSetup: (round) => {
        if (isSkirmish(round)) pending = positionOf(round).setup
      },
    })
  }
  /** A setup a result handed back, opened on New game once the step that chose it is drawn. */
  let pending: SaveSetup | null = null
  const openTitle = (place: TitlePlace, setup?: SaveSetup): void => {
    build = null
    title = new TitleScreens({
      settings,
      now,
      playerName: options.playerName ?? DEFAULT_PLAYER_NAME,
      profiles,
      saves: options.saves ?? ((): readonly SaveEntry[] => []),
      record: activity,
      ...(setup === undefined ? {} : { setup }),
      onOpen: (at) => {
        opening = at
      },
      onQuit: () => {
        quit = true
      },
      onSettingsChange: (changed) => {
        settings = changed
      },
    })
    title.follow(place)
  }
  /** A battle the title menu chose, opened once the step that chose it is done. */
  let opening: LevelDestination | null = null

  if (options.start.kind === "title") openTitle(options.start.place, options.start.setup)
  else openBuild(options.start)

  const frameNow = (index: number, label: string, bytes: string, moveKind: string | null = null): GameFrame => {
    const screens = title as TitleScreens | null
    if (screens !== null) {
      const row = screens.list.items[screens.list.highlighted]
      const summary = `${screens.screen.padEnd(10)} on ${row === undefined ? "-" : `[${row.hotkey}] ${row.label.replace(/\s+/gu, " ")}`}${screens.notice === null ? "" : `  | ${screens.notice}`}`
      return { index, label, bytes, screen: "title", frame: screens.frame(), state: null, title: screens.screen, settings, moveKind, footerRow: null, summary }
    }
    const driver = build as unknown as BuildDriver
    return { index, label, bytes, screen: "build", frame: driver.compose(), state: driver.build.state, settings: driver.build.state.settings, moveKind, footerRow: driver.layout.footerRow }
  }

  const frames: GameFrame[] = [frameNow(0, "start", "")]
  let ended: GamePlaytest["ended"] = null
  for (const [position, step] of options.steps.entries()) {
    const screens = title as TitleScreens | null
    let bytes = ""
    let moveKind: string | null = null
    if (screens !== null) {
      clock.now += step.afterMs ?? UNTIMED_GAP_MS
      bytes = titleBytes(step)
      for (const key of keysFromChunk(bytes)) {
        screens.handleKey(key)
        if (opening !== null || quit) break
      }
    } else {
      const driver = build as unknown as BuildDriver
      const done = driver.step(step)
      bytes = done.bytes
      moveKind = done.moveKind
      settings = driver.build.state.settings
      if (driver.leftBy === "quit") quit = true
    }
    // The screen a step chose opens at once: the step's frame is the screen it led to, as a player sees it.
    const chosen = opening as LevelDestination | null
    if (chosen !== null) {
      opening = null
      openBuild(chosen)
    } else if (pending !== null) {
      const setup: SaveSetup = pending
      pending = null
      openTitle("new-game", setup)
    }
    frames.push(frameNow(position + 1, step.label, bytes, moveKind))
    if (quit) {
      ended = { atStep: position + 1, skipped: options.steps.length - position - 1 }
      break
    }
  }
  const last = build as unknown as BuildDriver | null
  return { frames, activity, round: last === null ? null : last.build.round, ended }
}

/** A step as the bytes the title menu reads: a key's own, a cell click's SGR press. Waiting presses nothing. */
function titleBytes(step: PlaytestStep): string {
  if (step.kind === "wait") return ""
  if (step.kind === "key") return step.bytes
  if (step.target.kind === "tile") throw new Error(`"${step.label}": a Grid tile click means nothing on the title menu; click a cell, click@COL,ROW`)
  return formatMouseClick(step.target.column + 1, step.target.row + 1)
}
