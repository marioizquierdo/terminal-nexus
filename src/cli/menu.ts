// `terminal-nexus`'s menu screens: the top-level menu and the three input adapters, plus Settings as
// a real second screen that reuses the same list shape rather than inventing anything new. Campaign
// has its own placeholder screen (the same reuse again) because the campaign menu isn't built yet,
// and Challenge is dimmed in place on the top-level menu because the run screen isn't either;
// Settings and Exit are real. About is the same reuse once more: who made the game, where its code
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
import { AnsiBackend } from "../view/backends/ansi.ts"
import { selectBackend } from "../view/backends/index.ts"
import type { NamedBackend } from "../view/backends/index.ts"
import { chunkText } from "../view/backends/ports.ts"
import type { TerminalInput, TerminalOutput } from "../view/backends/ports.ts"
import { PROCESS_HOST, createTerminalSession } from "./lifecycle.ts"
import type { Host } from "./lifecycle.ts"
import { nextCapability, nextGlyphPack, nextTheme, toggleReducedMotion } from "../settings/types.ts"
import type { Settings, SettingsStore } from "../settings/index.ts"
import { formatRoute, parseRoute } from "./route.ts"
import type { TitleDestination, TitlePlace } from "./route.ts"

/** Five rows; a sixth, choosing a Commander upfront, was considered and rejected: a new player starts the
 *  first mission directly. About sits above Exit, so Exit's digit is 5 — the digits stay one sequence in
 *  walking order, and `q` still leaves from every title screen. Each row but Exit names the route it opens. */
export const TOP_LEVEL_ITEMS: readonly MenuItem[] = [
  { id: "campaign", hotkey: "1", label: "Campaign", route: "campaign" },
  // Dimmed and already saying why: the run screen hasn't landed, and a disabled item shows its
  // reason in the label a player sees before ever pressing anything, not only after.
  { id: "challenge", hotkey: "2", label: "Challenge (Milestone 11)", disabled: true, route: "challenge" },
  { id: "settings", hotkey: "3", label: "Settings", route: "settings" },
  { id: "about", hotkey: "4", label: "About", route: "about" },
  { id: "exit", hotkey: "5", label: "Exit" },
]

/** A screen with only words to show — Campaign's placeholder and About — has exactly one row, the way
 *  back, so Up, Down and Enter alone still leave it, as every menu must allow. */
const BACK_ONLY_ITEMS: readonly MenuItem[] = [{ id: "back", hotkey: "1", label: "Back" }]

const CAMPAIGN_PLACEHOLDER = "Campaign is not built yet - Milestone 4 adds the campaign menu."

/**
 * Stub honestly rather than half-build: an option not built yet says plainly what it is waiting
 * on, rather than silently doing nothing. Settings and Campaign have real screens and need no
 * notice (Campaign's is the placeholder above) — only Challenge still shows one, on top of its label already
 * saying why, whether its row was chosen or its route followed.
 */
const STUB_NOTICES: Readonly<Partial<Record<TitlePlace, string>>> = {
  challenge: "Challenge is not built yet - Milestone 11 adds the run screen.",
}

/**
 * The Settings screen's five rows, rebuilt fresh from the current values every time one changes.
 * Picking a row (its hotkey, arrows and Enter, or a click — the identical gesture the top-level
 * menu already uses to run an action) cycles that row's own value to the next choice instead; "Back"
 * is the one row that changes screen rather than a value.
 */
export function settingsItems(settings: Settings): readonly MenuItem[] {
  return [
    { id: "capability", hotkey: "1", label: `Colour depth: ${settings.capability}` },
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
    case "capability":
      return { ...settings, capability: nextCapability(settings.capability) }
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
   * comes back to it as it would for a player who had chosen it.
   */
  at?: TitleDestination
}>

type Screen = "top" | "settings" | "campaign" | "about"

/** What each screen's frame says about itself — the one place that grows when a screen is added,
 *  instead of a `screen === "x" ? ... : screen === "y" ? ...` chain repeated at every call site. */
const SCREEN_INFO: Readonly<Record<Screen, Readonly<{ subtitle: string; showBack: boolean }>>> = {
  top: { subtitle: "top-level menu", showBack: false },
  settings: { subtitle: "settings", showBack: true },
  campaign: { subtitle: "campaign", showBack: true },
  about: { subtitle: "about", showBack: true },
}

/** The screen each title menu place opens: Challenge, not built, stays on the top-level menu with its notice. */
const PLACE_SCREENS: Readonly<Record<TitlePlace, Screen>> = {
  menu: "top",
  campaign: "campaign",
  challenge: "top",
  settings: "settings",
  about: "about",
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

  const backend = await selectBackend(options.backend, {
    stdout,
    stdin,
    capability: options.settings.capability,
    theme: options.settings.theme,
    width: MENU_SIZE.width,
    height: MENU_SIZE.height,
  })

  let settings = options.settings
  let screen: Screen = "top"
  let notice: string | null = null
  let gated = false
  let leaving = false
  let failure: unknown = null
  let settleSession: (() => void) | null = null
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
    const active = sessionFor(screen)
    const info = SCREEN_INFO[screen]
    const frame = gated
      ? gateFrame(stdout.columns ?? MENU_SIZE.width, stdout.rows ?? MENU_SIZE.height, MENU_SIZE)
      : composeMenuFrame(
          {
            state: active.state,
            notice: screen === "top" ? notice : screen === "campaign" ? CAMPAIGN_PLACEHOLDER : null,
            glyphPack: settings.glyphPack,
            subtitle: info.subtitle,
            showBack: info.showBack,
            ...(screen === "about" ? { body: about } : {}),
          },
          settings.capability,
        )
    try {
      backend.present(frame)
    } catch (error) {
      failure = error
      record.log("session.error", { where: "render", message: messageOf(error) })
      leave()
    }
  }

  function goTo(next: Screen): void {
    screen = next
    render()
  }

  /** Where a title menu route leads: the one way a chosen row and an opening `--at` both change screen. Draws
   *  nothing; the caller does once it has finished. */
  function follow(place: TitlePlace): void {
    screen = PLACE_SCREENS[place]
    notice = STUB_NOTICES[place] ?? null
  }

  /** Which session is listening on the current screen — the one place this switches, so a caller
   *  juggling more than one screen (`onData` below) never repeats the same branch. */
  function sessionFor(current: Screen): MenuSession {
    if (current === "top") return topMenu
    if (current === "settings") return settingsMenu
    if (current === "about") return aboutMenu
    return campaignMenu
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
        // Challenge too: a dimmed, disabled row that already says why in its own label, still activatable
        // (`input.md`: a displayed hotkey always works), whose route shows the fuller notice.
        follow(placeOf(item.route))
        render()
        return
      }
      // Exit, the one row that opens no place.
      if (item.id === "exit") leave()
    }),
    onQuit: leave,
  })

  const campaignMenu = new MenuSession({
    items: BACK_ONLY_ITEMS,
    onActivate: picked("campaign", (item) => {
      if (item.id === "back") goTo("top")
    }),
    onQuit: leave,
    onBack: () => goTo("top"),
  })

  // The About screen's words never change while it runs; only the build it names comes from outside.
  const about = aboutSections(options.buildId)
  const aboutMenu = new MenuSession({
    items: BACK_ONLY_ITEMS,
    onActivate: picked("about", (item) => {
      if (item.id === "back") goTo("top")
    }),
    onQuit: leave,
    onBack: () => goTo("top"),
  })

  const settingsMenu = new MenuSession({
    items: settingsItems(settings),
    onActivate: picked("settings", (item) => {
      if (item.id === "back") {
        goTo("top")
        return
      }
      settings = withNextValue(settings, item.id)
      settingsMenu.setItems(settingsItems(settings))
      // Takes effect on the very next frame, without stopping and restarting the backend — the
      // point of `setPresentation` (src/view/frame.ts, src/view/backends/).
      backend.setPresentation?.(settings.capability, settings.theme)
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
    onBack: () => goTo("top"),
  })

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
      sessionFor(screen).handleKey(key, MENU_LAYOUT)
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
    colours: settings.capability,
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
  return 0
}

/** An error's own message, for a log entry. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export { AnsiBackend }
