// `terminal-nexus`'s title menu on a terminal: the screens themselves — the top-level menu, Settings, Story's
// placeholder, About, and the Skirmish screens with New game's setup and Load game — are `TitleScreens`
// (`./title-screens.ts`), which has no terminal; this file is their live loop. A battle chosen there (New game's Start,
// a loaded save's Open) hands the terminal to its Build Phase (`runBuildPhase`); a battle's result offers the setup
// screen again, which comes back here, on New game with that battle's setup.
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

import { activity } from "../log/activity.ts"
import type { ActivityLog, HostName } from "../log/activity.ts"
import { MOUSE_REPORTING_OFF, MOUSE_REPORTING_ON } from "../title-menu/mouse.ts"
import { MENU_SIZE } from "../view/menu.ts"
import { keysFromChunk } from "../terminal/playback.ts"
import { gateFrame } from "../view/index.ts"
import { selectBackend } from "../view/backends/index.ts"
import type { NamedBackend } from "../view/backends/index.ts"
import { chunkText } from "../view/backends/ports.ts"
import type { TerminalInput, TerminalOutput } from "../view/backends/ports.ts"
import { PROCESS_HOST, createTerminalSession } from "./lifecycle.ts"
import type { Host } from "./lifecycle.ts"
import type { Settings, SettingsStore } from "../settings/index.ts"
import { formatRoute } from "./route.ts"
import type { LevelDestination, TitleDestination } from "./route.ts"
import { runBuildPhase } from "./build-phase.ts"
import type { BuildPhaseOptions, Exporter } from "./build-phase.ts"
import { openSkirmish } from "./skirmish-open.ts"
import type { SaveSetup, Profiles } from "../skirmish/save.ts"
import { SHIPPED_PROFILES } from "../skirmish/shipped-players.ts"
import { DEFAULT_PLAYER_NAME } from "../skirmish/setup.ts"
import type { SaveEntry } from "./title-screens.ts"
import { TitleScreens } from "./title-screens.ts"
import type { Noter } from "./notes.ts"
import { noteText, titleNoteOf } from "./notes.ts"

export { SKIRMISH_ITEMS, TOP_LEVEL_ITEMS, settingsItems } from "./title-screens.ts"

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
   * comes back to it as it would for a player who had chosen it.
   */
  at?: TitleDestination
  /** The clock a new Skirmish's seed is chosen from, in milliseconds: `Date.now` unless a test injects one. */
  now?: () => number
  /** What an export does in the Build Phase a Skirmish opens on (`runBuildPhase`'s `exporter`). */
  exporter?: Exporter
  /** What Save game does in that Build Phase (`runBuildPhase`'s `saver`). */
  saver?: BuildPhaseOptions["saver"]
  /**
   * What opens a Skirmish once the menu has handed the terminal back: the Build Phase on its first round, with this
   * session's settings, backend and terminal (`runBuildPhase`) unless a host opens it its own way — the browser page,
   * which shows the Build Phase's keys under the screen. What it returns is what the menu returns.
   */
  open?: (at: LevelDestination, settings: Settings, toSetup: (setup: SaveSetup) => void) => Promise<number>
  /** The script profiles New game offers: the shipped ones unless the host reads `players/scripts/` (a terminal). */
  profiles?: Profiles
  /** The name a `Player` slot shows: the account's user name in a terminal; `player` unless given. */
  playerName?: string
  /** The saves Load game lists (`listSaves`, `./skirmish-files.ts`, in a terminal): none unless given. */
  saves?: () => readonly SaveEntry[]
  /** Where the saves folder is, as Load game says it. */
  savesShown?: string
  /** What a save opened from Load game is read with, for a loaded save's build file: not needed by the list itself. */
  readFile?: (path: string) => string
  /** A setup New game opens on, in place of the defaults: the battle a result's Setup screen came from. */
  setup?: SaveSetup
  /** What a note (`!`) is written with, here and in the Build Phase a Skirmish opens: absent, a note cannot be written. */
  noter?: Noter
}>

export async function runMenu(options: MenuOptions): Promise<number> {
  const { stdout, stdin } = options

  // Non-TTY: there is no interactive menu to show without a terminal, and nothing to wait for.
  // One readable line, no escape sequences (the `runtime.md` rule for a non-interactive run).
  if (!stdout.isTTY || !stdin.isTTY) {
    stdout.write("terminal-nexus needs an interactive terminal for its menu.\n")
    return 0
  }

  const backend = await selectBackend(options.backend, {
    stdout,
    stdin,
    colors: options.settings.colors,
    theme: options.settings.theme,
    width: MENU_SIZE.width,
    height: MENU_SIZE.height,
  })

  let gated = false
  let leaving = false
  let failure: unknown = null
  let settleSession: (() => void) | null = null
  /** The Skirmish the menu is handing the terminal to, once one is chosen: opened when the menu has gone. */
  let handoff: LevelDestination | null = null
  // The tail of every settings write so far, chained rather than fired independently — awaited by
  // the disposer so the last thing a player changed is genuinely on disk before the process actually
  // exits, not just requested. Chaining matters: two changes picked in quick succession each start a real
  // filesystem write with no ordering guarantee of its own, so the last write in the chain always saves
  // whatever the settings hold by then, never a value some other write has since replaced.
  let pendingSave: Promise<void> = Promise.resolve()
  // The most recent save failure, if any, surfaced once the terminal is back in its normal state rather
  // than mid-session, where writing to stderr would land inside the alternate screen.
  let settingsSaveError: unknown = null

  const host = options.host ?? PROCESS_HOST
  const session = createTerminalSession(host)
  const dispose = session.dispose
  const exit = options.exit ?? host.exit
  const record = options.activity ?? activity
  const now = options.now ?? Date.now

  const leave = (): void => {
    if (leaving) return
    leaving = true
    void dispose().then(() => {
      exit(0)
      settleSession?.()
    })
  }

  /** A battle chosen: the menu leaves without exiting, and the battle's Build Phase opens on the same terminal. */
  const handOff = (at: LevelDestination): void => {
    if (leaving) return
    handoff = at
    leaving = true
    void dispose().then(() => settleSession?.())
  }

  const screens = new TitleScreens({
    settings: options.settings,
    ...(options.buildId === undefined ? {} : { buildId: options.buildId }),
    now,
    playerName: options.playerName ?? DEFAULT_PLAYER_NAME,
    profiles: options.profiles ?? SHIPPED_PROFILES,
    saves: options.saves ?? ((): readonly SaveEntry[] => []),
    ...(options.savesShown === undefined ? {} : { savesShown: options.savesShown }),
    ...(options.setup === undefined ? {} : { setup: options.setup }),
    ...(options.noter === undefined
      ? {}
      : {
          onNote: (line: string, at: string, screen: string) => {
            const note = titleNoteOf(line, at, { written: new Date(now()).toISOString(), ...(options.buildId === undefined ? {} : { build: options.buildId }), screen, activity: record.entries(), startedAt: record.startedAt })
            return (options.noter as Noter).write(noteText(note))
          },
        }),
    record,
    onOpen: handOff,
    onSkirmishRoute: (destination) => {
      try {
        handOff(openSkirmish(destination, { now, ...(options.readFile === undefined ? {} : { readFile: options.readFile }) }))
      } catch (error) {
        record.log("session.error", { where: "skirmish", message: messageOf(error) })
      }
    },
    onQuit: leave,
    onSettingsChange: (settings) => {
      // Takes effect on the very next frame, without stopping and restarting the backend.
      backend.setPresentation?.(settings.colors, settings.theme)
      pendingSave = pendingSave.then(() =>
        options.settingsStore.save(settings).catch((error: unknown) => {
          settingsSaveError = error
          record.log("session.error", { where: "save", message: messageOf(error) })
        }),
      )
    },
  })

  function render(): void {
    if (leaving) return
    const frame = gated ? gateFrame(stdout.columns ?? MENU_SIZE.width, stdout.rows ?? MENU_SIZE.height, MENU_SIZE) : screens.frame()
    try {
      backend.present(frame)
    } catch (error) {
      failure = error
      record.log("session.error", { where: "render", message: messageOf(error) })
      leave()
    }
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
    // Split here, and hand the screens one key at a time: a hotkey that changes screen and a second key typed right
    // behind it can arrive in the same chunk, and the second belongs to the screen current after the first.
    for (const key of keysFromChunk(chunkText(data))) {
      if (leaving) break
      screens.handleKey(key)
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

  // Opening at a route: its screen, the row that names it highlighted, as a player who chose it would leave it. Not a
  // pick, so not recorded as one: nobody chose it on this screen.
  if (options.at !== undefined) screens.follow(options.at.place)

  record.log("session.start", {
    screen: "menu",
    ...(options.buildId === undefined ? {} : { build: options.buildId }),
    host: options.hostName ?? "terminal",
    columns: stdout.columns ?? null,
    rows: stdout.rows ?? null,
    colors: screens.settings.colors,
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
    // Reported, not swallowed, once the terminal is back to normal.
    host.reportError(`terminal-nexus: could not save settings: ${String(settingsSaveError)}\n`)
  }

  if (failure !== null) {
    host.reportError(`terminal-nexus failed: ${String(failure)}\n`)
    return 1
  }
  if (handoff === null) return 0
  const settings = screens.settings
  // The battle's Build Phase; its result's Setup screen comes back here, on New game with that battle's setup.
  let back: SaveSetup | null = null
  const code = await openBattle(handoff, settings, (setup) => {
    back = setup
  })
  const returned = back as SaveSetup | null
  if (returned === null) return code
  const latest = (await options.settingsStore.load().catch(() => null)) ?? settings
  return runMenu({ ...options, settings: latest, at: { kind: "title", place: "new-game" }, setup: returned })

  /** The Skirmish's Build Phase, on this terminal, with the settings as the menu leaves them. */
  function openBattle(at: LevelDestination, settings: Settings, toSetup: (setup: SaveSetup) => void): Promise<number> {
    if (options.open !== undefined) return options.open(at, settings, toSetup)
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
      ...(options.saver === undefined ? {} : { saver: options.saver }),
      ...(options.noter === undefined ? {} : { noter: options.noter }),
      onSetup: toSetup,
      at,
    })
  }
}

/** An error's own message, for a log entry. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
