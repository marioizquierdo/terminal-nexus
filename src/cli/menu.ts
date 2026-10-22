// `terminal-nexus`'s menu screens: the top-level menu and the three input adapters, plus Settings as
// a real second screen that reuses the same list shape rather than inventing anything new. Campaign
// has its own placeholder screen (the same reuse again) because the campaign menu isn't built yet;
// Challenge starts a run, handing the terminal to the Build Phase (`runBuildPhase`) on a seed the game
// chooses; Settings and Exit are real. About is the same reuse once more: who made the game, where its code
// lives, how to contribute, and which build this is.
//
// The event loop here is deliberately unlike `watch.ts`'s: a menu has no ticks and nothing animates,
// so there is no per-frame timer — a redraw happens only in response to input or a resize.
//
// It records into the Activity Logs (`src/log/activity.ts`): `session.start` once, `menu.select` for
// every row picked, and a resize or a failure — so the browser page's log, shared across its screens,
// shows how a playtester reached the Build Phase.
//
// **Its rows are routes** (`./route.ts`): each row that opens a place names the route it opens, and choosing
// the row follows that route — the same `follow` an opening `--at settings` takes — so a route and a row can
// never lead to two different screens.

import { aboutSections } from "../title-menu/about.ts"
import { MenuSession } from "../title-menu/session.ts"
import type { MenuItem } from "../title-menu/types.ts"
import { MOUSE_REPORTING_OFF, MOUSE_REPORTING_ON } from "../title-menu/mouse.ts"
import { activity } from "../log/activity.ts"
import type { ActivityLog, HostName } from "../log/activity.ts"
import { composeMenuFrame, MENU_LAYOUT, MENU_SIZE } from "../view/menu.ts"
import { keysFromChunk } from "../terminal/playback.ts"
import { gateFrame } from "../view/index.ts"
import { selectBackend } from "../view/backends/index.ts"
import type { NamedBackend } from "../view/backends/index.ts"
import { chunkText } from "../view/backends/ports.ts"
import type { TerminalInput, TerminalOutput } from "../view/backends/ports.ts"
import { PROCESS_HOST, createTerminalSession } from "./lifecycle.ts"
import type { Host } from "./lifecycle.ts"
import { nextColorDepth, nextGlyphPack, nextTheme, toggleReducedMotion } from "../settings/types.ts"
import type { Settings, SettingsStore } from "../settings/index.ts"
import { formatRoute, parseRoute } from "./route.ts"
import { shownSetting } from "../build/all-settings.ts"
import type { LevelDestination, TitleDestination, TitlePlace } from "./route.ts"
import { runBuildPhase } from "./build-phase.ts"
import type { Exporter } from "./build-phase.ts"
import { DEFAULT_RUN_COMMANDER } from "../run/index.ts"
import { clockSeed, runLevel } from "./run-play.ts"

/** Five rows; a sixth, choosing a Commander upfront, was considered and rejected: a new player starts the
 *  first mission directly. About sits above Exit, so Exit's digit is 5 — the digits stay one sequence in
 *  walking order, and `q` still leaves from every title screen. Each row but Exit names the route it opens. */
export const TOP_LEVEL_ITEMS: readonly MenuItem[] = [
  { id: "campaign", hotkey: "1", label: "Campaign", route: "campaign" },
  // A run of three battles, on a seed the game chooses and shows as the run opens.
  { id: "challenge", hotkey: "2", label: "Challenge", route: "challenge" },
  { id: "settings", hotkey: "3", label: "Settings", route: "settings" },
  { id: "about", hotkey: "4", label: "About", route: "about" },
  { id: "exit", hotkey: "5", label: "Exit" },
]

/** A screen with only words to show — Campaign's placeholder and About — has exactly one row, the way
 *  back, so Up, Down and Enter alone still leave it, as every menu must allow. */
const BACK_ONLY_ITEMS: readonly MenuItem[] = [{ id: "back", hotkey: "1", label: "Back" }]

/**
 * The Settings screen's five rows, rebuilt fresh from the current values every time one changes.
 * Picking a row (its hotkey, arrows and Enter, or a click — the identical gesture the top-level
 * menu already uses to run an action) cycles that row's own value to the next choice instead; "Back"
 * is the one row that changes screen rather than a value.
 */
export function settingsItems(settings: Settings): readonly MenuItem[] {
  return [
    { id: "colors", hotkey: "1", label: `Colours: ${shownSetting("colors").format(settings.colors)}` },
    { id: "theme", hotkey: "2", label: `Background: ${settings.theme}` },
    { id: "glyphPack", hotkey: "3", label: `Symbols: ${settings.glyphPack}` },
    {
      id: "reducedMotion",
      hotkey: "4",
      label: `Reduced motion: ${settings.reducedMotion ? "on" : "off"}`,
    },
    { id: "back", hotkey: "5", label: "Back" },
  ]
}

/** The next value for whichever row's own id activated — "back" never reaches here (the caller
 *  changes screen for that one instead of touching a value). */
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

export type MenuOptions = Readonly<{
  /** The settings this session starts showing — already resolved from the saved file plus any
   *  command-line override, by `terminal-nexus.ts`. */
  settings: Settings
  /** Where a change made on the Settings screen is written back to. */
  settingsStore: SettingsStore
  /** A backend name, or a backend itself (the browser playtest page's canvas). */
  backend: string | NamedBackend
  stdout: TerminalOutput
  stdin: TerminalInput
  /** Interrupts, exit and error reporting; a terminal program's `process` unless given. */
  host?: Host
  /** Injectable for the same reason `watch.ts`'s is: a test drives quit paths through real code. */
  exit?: (code: number) => void
  /** The commit this build is — `terminal-nexus.ts` reads the checkout, the browser page its build
   *  stamp — shown on the About screen and recorded at `session.start`. Absent: not known. */
  buildId?: string
  /** Where this runs, for the Activity Logs: `web` from the browser playtest page, else `terminal`. */
  hostName?: HostName
  /** The Activity Logs this session records into: the program's own unless a test passes another. */
  activity?: ActivityLog
  /**
   * Where to open (`--at settings`, a title menu route): the top-level menu unless given. Opening at a place
   * follows its route exactly as choosing the row that names it does, and leaves that row highlighted, so Esc
   * comes back to it as it would for a player who had chosen it — or, for Challenge, starts a run at once.
   */
  at?: TitleDestination
  /** The clock a new run's seed is chosen from, in milliseconds: `Date.now` unless a test injects one. */
  now?: () => number
  /** What an export does in the Build Phase a run opens on (`runBuildPhase`'s `exporter`). */
  exporter?: Exporter
  /**
   * What opens a run once the menu has handed the terminal back: the Build Phase on the run's first round, with this
   * session's settings, backend and terminal (`runBuildPhase`) unless a host opens it its own way — the browser page,
   * which shows the Build Phase's keys under the screen. What it returns is what the menu returns.
   */
  open?: (at: LevelDestination, settings: Settings) => Promise<number>
}>

type Screen = "top" | "settings" | "campaign" | "about"

/** What each screen's frame says about itself — the one place that grows when a screen is added,
 *  instead of a `screen === "x" ? ... : screen === "y" ? ...` chain repeated at every call site. */
const SCREEN_INFO: Readonly<Record<Screen, Readonly<{ subtitle: string; showBack: boolean }>>> = {
  top: { subtitle: "main menu", showBack: false },
  settings: { subtitle: "settings", showBack: true },
  campaign: { subtitle: "campaign", showBack: true },
  about: { subtitle: "about", showBack: true },
}

/**
 * The screen each title menu place opens, and the line it says there. Stub honestly rather than half-build: an
 * option not built yet says plainly what it is waiting on, rather than silently doing nothing — Campaign on a
 * placeholder screen of its own, whether its row was chosen or its route followed. Challenge opens no screen here:
 * it starts a run.
 */
const PLACE_SCREENS: Readonly<Record<TitlePlace, Readonly<{ screen: Screen; notice?: string }>>> = {
  menu: { screen: "top" },
  campaign: { screen: "campaign", notice: "Campaign is not built yet - its menu is coming soon." },
  // Not a screen of the menu's: following it starts a run (`startRun`), and the menu hands the terminal over.
  challenge: { screen: "top" },
  settings: { screen: "settings" },
  about: { screen: "about" },
}

/** The title menu place a row's route names. Every row's route is a title menu place
 *  (`tests/route.test.ts`); a row naming any other would be a screen this loop cannot open. */
function placeOf(route: string): TitlePlace {
  const destination = parseRoute(route)
  if (destination.kind !== "title") throw new Error(`a title menu row names "${route}", which is not on the title menu`)
  return destination.place
}


export async function runMenu(options: MenuOptions): Promise<number> {
  const { stdout, stdin } = options

  // Non-TTY: there is no interactive menu to show without a terminal, and nothing to wait for.
  // One readable line, no escape sequences (the `runtime.md` rule for a non-interactive run).
  if (!stdout.isTTY || !stdin.isTTY) {
    stdout.write("terminal-nexus needs an interactive terminal for its menu.\n")
    return 0
  }
  // Opening at Challenge starts its run at once: there is no menu to show first.
  if (options.at?.place === "challenge") return openRun(runLevelAt(options.at), options.settings)

  const backend = await selectBackend(options.backend, {
    stdout,
    stdin,
    colors: options.settings.colors,
    theme: options.settings.theme,
    width: MENU_SIZE.width,
    height: MENU_SIZE.height,
  })

  let settings = options.settings
  let screen: Screen = "top"
  /** The line under the screen's rows: the one its place says (`PLACE_SCREENS`), until the screen changes. */
  let notice: string | null = null
  let gated = false
  let leaving = false
  let failure: unknown = null
  let settleSession: (() => void) | null = null
  /** The run the menu is handing the terminal to (Challenge), once one is chosen: opened when the menu has gone. */
  let handoff: LevelDestination | null = null
  // The tail of every settings write so far, chained rather than fired independently — awaited by
  // the disposer so the last thing a player changed is genuinely on disk before the process actually
  // exits, not just requested. Chaining (not just tracking the latest promise) matters: two changes
  // picked in quick succession each start a real filesystem write with no ordering guarantee of its
  // own, so an unchained pair can finish in either order and the earlier value can land on disk
  // *after* the later one, silently reverting the player's last choice. Each write here only starts
  // once the previous one has settled, so the last write in the chain — whenever it actually runs —
  // always saves whatever `settings` holds by then, never a value some other write has since replaced.
  let pendingSave: Promise<void> = Promise.resolve()
  // The most recent save failure, if any, surfaced once the terminal is back in its normal state
  // (Section "if (failure..." below) rather than mid-session, where writing to stderr would land
  // inside the alternate screen and corrupt whatever the menu is showing.
  let settingsSaveError: unknown = null

  const host = options.host ?? PROCESS_HOST
  const session = createTerminalSession(host)
  const dispose = session.dispose
  const exit = options.exit ?? host.exit
  const record = options.activity ?? activity

  const leave = (): void => {
    if (leaving) return
    leaving = true
    void dispose().then(() => {
      exit(0)
      settleSession?.()
    })
  }

  function render(): void {
    if (leaving) return
    const info = SCREEN_INFO[screen]
    const frame = gated
      ? gateFrame(stdout.columns ?? MENU_SIZE.width, stdout.rows ?? MENU_SIZE.height, MENU_SIZE)
      : composeMenuFrame(
          {
            state: sessions[screen].state,
            notice,
            glyphPack: settings.glyphPack,
            subtitle: info.subtitle,
            showBack: info.showBack,
            ...(screen === "about" ? { body: about } : {}),
          },
          settings.colors,
        )
    try {
      backend.present(frame)
    } catch (error) {
      failure = error
      record.log("session.error", { where: "render", message: messageOf(error) })
      leave()
    }
  }

  /**
   * **Challenge**: a run on a seed the game chooses from the clock (`clockSeed`), shown as the run opens so it can be
   * shared and played again (`--at 'challenge?seed=<n>'`), with the Commander the route named or Vasse. The menu
   * leaves without exiting, and the run's Build Phase opens on the same terminal.
   */
  function startRun(commander: string | undefined): void {
    if (leaving) return
    const seed = clockSeed((options.now ?? Date.now)())
    handoff = { kind: "level", level: runLevel({ seed, commander: commander ?? DEFAULT_RUN_COMMANDER }), round: 1 }
    leaving = true
    void dispose().then(() => settleSession?.())
  }

  /** Where a title menu route leads: the one way a chosen row and an opening `--at` both change screen. Draws
   *  nothing; the caller does once it has finished. */
  function follow(place: TitlePlace, commander?: string): void {
    if (place === "challenge") {
      startRun(commander)
      return
    }
    const opens = PLACE_SCREENS[place]
    screen = opens.screen
    notice = opens.notice ?? null
  }

  /** Back to the top-level menu, from a screen's Back row or Esc: the menu's own route, followed. */
  function back(): void {
    follow("menu")
    render()
  }

  /** A screen's own row handler, with the pick recorded first (`menu.select`) — first, so a row that
   *  leaves the program (Exit) is in the log too. Esc is not a pick and is not recorded as one. */
  const picked =
    (on: Screen, act: (item: MenuItem) => void) =>
    (item: MenuItem): void => {
      record.log("menu.select", { screen: on, item: item.id, ...(item.route === undefined ? {} : { route: item.route }) })
      act(item)
    }

  const topMenu = new MenuSession({
    items: TOP_LEVEL_ITEMS,
    onActivate: picked("top", (item) => {
      if (item.route !== undefined) {
        follow(placeOf(item.route))
        render()
        return
      }
      // Exit, the one row that opens no place.
      if (item.id === "exit") leave()
    }),
    onQuit: leave,
  })

  /** A screen with only words to show: its one row, Back, and Esc both go back to the top-level menu. */
  const wordsOnly = (on: Screen): MenuSession =>
    new MenuSession({ items: BACK_ONLY_ITEMS, onActivate: picked(on, back), onQuit: leave, onBack: back })

  // The About screen's words never change while it runs; only the build it names comes from outside.
  const about = aboutSections(options.buildId)

  const settingsMenu = new MenuSession({
    items: settingsItems(settings),
    onActivate: picked("settings", (item) => {
      if (item.id === "back") {
        back()
        return
      }
      settings = withNextValue(settings, item.id)
      settingsMenu.setItems(settingsItems(settings))
      // Takes effect on the very next frame, without stopping and restarting the backend — the
      // point of `setPresentation` (src/view/frame.ts, src/view/backends/).
      backend.setPresentation?.(settings.colors, settings.theme)
      pendingSave = pendingSave.then(() =>
        options.settingsStore.save(settings).catch((error: unknown) => {
          // A failed write is not a reason to crash or block the exit path, but it should not vanish
          // without a trace either — recorded here, reported once the session actually ends.
          settingsSaveError = error
          record.log("session.error", { where: "save", message: messageOf(error) })
        }),
      )
      render()
    }),
    onQuit: leave,
    onBack: back,
  })

  /** Which session listens on each screen — the one place this is said, so a caller juggling more than one
   *  screen (`onData` below) never repeats the same branch. */
  const sessions: Readonly<Record<Screen, MenuSession>> = {
    top: topMenu,
    settings: settingsMenu,
    campaign: wordsOnly("campaign"),
    about: wordsOnly("about"),
  }

  /** Below the 80 x 24 floor the too-small frame stands in for the menu. */
  function fitToTerminal(): void {
    gated = (stdout.columns ?? 0) < MENU_SIZE.width || (stdout.rows ?? 0) < MENU_SIZE.height
    render()
  }

  /** The size last recorded: the browser page signals a resize whenever its window changes shape,
   *  though the terminal it stands in for may not have, and a log should say only what happened. */
  let loggedSize = `${stdout.columns ?? "?"}x${stdout.rows ?? "?"}`
  function onResize(): void {
    const size = `${stdout.columns ?? "?"}x${stdout.rows ?? "?"}`
    if (size !== loggedSize) {
      loggedSize = size
      record.log("session.resize", { columns: stdout.columns ?? null, rows: stdout.rows ?? null })
    }
    fitToTerminal()
  }

  function onData(data: string | Uint8Array): void {
    if (gated || leaving) return
    // Split here, and re-read `screen` before *every* key — not once for the whole chunk — because
    // a hotkey that changes screen and a second key typed right behind it can arrive in the same
    // stdin chunk. Fixing that on one screen through `active.handleData(rawChunk, ...)` would keep
    // dispatching every remaining key in the chunk to the screen that was current when the chunk
    // *started*, silently misrouting anything typed right after the switch to a session menu the
    // player can no longer see.
    for (const key of keysFromChunk(chunkText(data))) {
      if (leaving) break
      sessions[screen].handleKey(key, MENU_LAYOUT)
    }
    render()
  }

  session.onDispose(() => {
    stdin.off("data", onData)
  })
  session.onDispose(() => {
    stdout.off("resize", onResize)
  })
  session.onSignal(leave)
  // The mouse-reporting half of the disposer (`runtime.md`): mouse reporting is switched
  // off on the same exit paths as raw mode and the alternate screen.
  session.onDispose(() => {
    stdout.write(MOUSE_REPORTING_OFF)
  })
  session.onDispose(() => pendingSave)
  session.onDispose(() => backend.stop())

  // Opening at a route: the row that names it highlighted, as a player who chose it would leave it, and its
  // route followed. Not a pick, so not recorded as one: nobody chose it on this screen.
  if (options.at !== undefined) {
    const place = options.at.place
    const row = TOP_LEVEL_ITEMS.findIndex((item) => item.route !== undefined && placeOf(item.route) === place)
    if (row >= 0) topMenu.dispatch({ kind: "highlight", index: row })
    follow(place)
  }

  record.log("session.start", {
    screen: "menu",
    ...(options.buildId === undefined ? {} : { build: options.buildId }),
    host: options.hostName ?? "terminal",
    columns: stdout.columns ?? null,
    rows: stdout.rows ?? null,
    colors: settings.colors,
    ...(options.at === undefined ? {} : { at: formatRoute(options.at) }),
  })

  try {
    await backend.start()
    stdout.write(MOUSE_REPORTING_ON)
    fitToTerminal()
    stdin.on("data", onData)
    stdout.on("resize", onResize)
    await new Promise<void>((settle) => {
      settleSession = settle
    })
  } catch (error) {
    failure = error
  } finally {
    await dispose()
  }

  if (settingsSaveError !== null) {
    // Reported, not swallowed — a settings file that silently never saves would otherwise be
    // invisible until someone thinks to check it by hand. Written only now, after `dispose()` has
    // already restored the terminal to its normal state, so it lands as a plain line rather than
    // inside whatever the alternate screen was showing.
    host.reportError(`terminal-nexus: could not save settings: ${String(settingsSaveError)}\n`)
  }

  if (failure !== null) {
    host.reportError(`terminal-nexus failed: ${String(failure)}\n`)
    return 1
  }
  return handoff === null ? 0 : openRun(handoff, settings)

  /** The run's Build Phase, on this terminal, with the settings as the menu leaves them. */
  function openRun(at: LevelDestination, settings: Settings): Promise<number> {
    if (options.open !== undefined) return options.open(at, settings)
    return runBuildPhase({
      settings,
      settingsStore: options.settingsStore,
      backend: options.backend,
      stdout,
      stdin,
      ...(options.host === undefined ? {} : { host: options.host }),
      ...(options.exit === undefined ? {} : { exit: options.exit }),
      ...(options.buildId === undefined ? {} : { buildId: options.buildId }),
      ...(options.hostName === undefined ? {} : { hostName: options.hostName }),
      ...(options.activity === undefined ? {} : { activity: options.activity }),
      ...(options.exporter === undefined ? {} : { exporter: options.exporter }),
      at,
    })
  }

  /** The run an opening `--at challenge` starts: on a seed from the clock, with the Commander it names. */
  function runLevelAt(at: TitleDestination): LevelDestination {
    const seed = clockSeed((options.now ?? Date.now)())
    return { kind: "level", level: runLevel({ seed, commander: at.commander ?? DEFAULT_RUN_COMMANDER }), round: 1 }
  }
}

/** An error's own message, for a log entry. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
