// `terminal-nexus`'s menu screens — milestone-03-game-menu.md. Gate 3A built the top-level menu and
// the three input adapters; Gate 3B added Settings as a real second screen, reusing that same
// reusable list shape rather than inventing anything new for it. Gate 3C gives Campaign its own
// placeholder screen (the same reuse again) now that Milestone 4 isn't built yet, and dims Challenge
// in place on the top-level menu instead, since Milestone 11 isn't either; Settings and Exit are
// unchanged. About (owner, 2026-10-01, feedback F93) is the same reuse once more: who made the game,
// where its code lives, how to contribute, and which build this is.
//
// The event loop here is deliberately unlike `watch.ts`'s: a menu has no ticks and nothing animates,
// so there is no per-frame timer — a redraw happens only in response to input or a resize.
//
// It records into the Activity Logs (`src/log/activity.ts`): `session.start` once, `menu.select` for
// every row picked, and a resize or a failure — so the browser page's log, shared across its screens,
// shows how a playtester reached the Build Phase.

import { aboutSections } from "../menu/about.ts"
import { MenuSession } from "../menu/session.ts"
import type { MenuItem } from "../menu/types.ts"
import { MOUSE_REPORTING_OFF, MOUSE_REPORTING_ON } from "../menu/mouse.ts"
import { activity } from "../log/activity.ts"
import type { ActivityLog } from "../log/activity.ts"
import { composeMenuFrame, MENU_LAYOUT, MENU_SIZE } from "../view/menu.ts"
import { gateFrame, keysFromChunk } from "../view/index.ts"
import { AnsiBackend } from "../view/backends/ansi.ts"
import { selectBackend } from "../view/backends/index.ts"
import type { NamedBackend } from "../view/backends/index.ts"
import { chunkText } from "../view/backends/ports.ts"
import type { TerminalInput, TerminalOutput } from "../view/backends/ports.ts"
import { PROCESS_HOST, createTerminalSession } from "./lifecycle.ts"
import type { Host } from "./lifecycle.ts"
import { nextCapability, nextGlyphPack, nextTheme, toggleReducedMotion } from "../settings/types.ts"
import type { CapabilityMode } from "../view/roles.ts"
import type { Settings, SettingsStore } from "../settings/index.ts"

/** Canon 2.11 named four; Q43 withdrew a fifth ("choose your Commander") upfront screen. About joined
 *  them above Exit (owner, 2026-10-01, feedback F93), so Exit's digit moved from 4 to 5 — the digits
 *  stay one sequence in walking order, and `q` still leaves from every title screen. */
export const TOP_LEVEL_ITEMS: readonly MenuItem[] = [
  { id: "campaign", hotkey: "1", label: "Campaign" },
  // Dimmed and already saying why (Gate 3C) - Milestone 11 hasn't landed, and "disabled with the
  // reason shown" (milestone-03-game-menu.md Section 2) means the reason belongs in the label a
  // player sees before ever pressing anything, not only after.
  { id: "challenge", hotkey: "2", label: "Challenge (Milestone 11)", disabled: true },
  { id: "settings", hotkey: "3", label: "Settings" },
  { id: "about", hotkey: "4", label: "About" },
  { id: "exit", hotkey: "5", label: "Exit" },
]

/** A screen with only words to show — Campaign's placeholder (Gate 3C) and About (F93) — has exactly
 *  one row: the way back, so Up, Down and Enter alone still leave it, as every menu must allow. */
const BACK_ONLY_ITEMS: readonly MenuItem[] = [{ id: "back", hotkey: "1", label: "Back" }]

const CAMPAIGN_PLACEHOLDER = "Campaign is not built yet - Milestone 4 adds the campaign menu."

/**
 * "Stub honestly rather than half-build" (milestone-03-game-menu.md Section 3) — an option not built
 * yet says plainly what it is waiting on, rather than silently doing nothing. Settings no longer
 * needs one (Gate 3B built it for real); Campaign no longer does either (Gate 3C gave it its own
 * screen, above) — only Challenge still shows one, on top of its label already saying why.
 */
const STUB_NOTICES: Readonly<Record<string, string>> = {
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
   *  command-line override, by `terminalNexus.ts`. */
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
  /** The commit this build is — `terminalNexus.ts` reads the checkout, the browser page its build
   *  stamp — shown on the About screen and recorded at `session.start`. Absent: not known. */
  buildId?: string
  /** Where this runs, for the Activity Logs: `web` from the browser playtest page, else `terminal`. */
  hostName?: "terminal" | "web"
  /** The Activity Logs this session records into: the program's own unless a test passes another. */
  activity?: ActivityLog
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

/** A colour depth in the words `session.start`'s schema uses for it (`src/log/activity.ts`). */
const COLOURS: Readonly<Record<CapabilityMode, string>> = {
  truecolor: "truecolor",
  color256: "256",
  color16: "16",
  monochrome: "mono",
}

export async function runMenu(options: MenuOptions): Promise<number> {
  const { stdout, stdin } = options

  // Non-TTY: there is no interactive menu to show without a terminal, and nothing to wait for.
  // engine.md 10.1: one readable line, no escape sequences.
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
      record.log("menu.select", { screen: on, item: item.id })
      act(item)
    }

  const topMenu = new MenuSession({
    items: TOP_LEVEL_ITEMS,
    onActivate: picked("top", (item) => {
      if (item.id === "exit") {
        leave()
        return
      }
      if (item.id === "settings" || item.id === "campaign" || item.id === "about") {
        notice = null
        goTo(item.id)
        return
      }
      // Only Challenge reaches here now — a dimmed, disabled row that already says why in its own
      // label (Gate 3C), still activatable per engine.md 9.7, still showing the fuller notice it
      // always has since Gate 3A.
      notice = STUB_NOTICES[item.id] ?? null
      render()
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
      // point of Gate 3B's own `setPresentation` addition (src/view/frame.ts, src/view/backends/).
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

  /** Below the 80 x 24 floor the gate frame stands in for the menu (engine.md 9.6). */
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
  // The mouse-reporting half of engine.md 10.1's disposer: "once the mouse adapter exists, it
  // switches terminal mouse reporting off on the same paths" as raw mode and the alternate screen.
  session.onDispose(() => {
    stdout.write(MOUSE_REPORTING_OFF)
  })
  session.onDispose(() => pendingSave)
  session.onDispose(() => backend.stop())

  record.log("session.start", {
    screen: "menu",
    ...(options.buildId === undefined ? {} : { build: options.buildId }),
    host: options.hostName ?? "terminal",
    columns: stdout.columns ?? null,
    rows: stdout.rows ?? null,
    colours: COLOURS[settings.capability],
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
