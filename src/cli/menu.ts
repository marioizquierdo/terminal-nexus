// `terminal-nexus`'s menu screens — milestone-03-game-menu.md. Gate 3A built the top-level menu and
// the three input adapters; Gate 3B adds Settings as a real second screen, reusing that same
// reusable list shape rather than inventing anything new for it. Campaign and Challenge are still
// honest stubs (Gate 3C builds their real destinations); Exit is real.
//
// The event loop here is deliberately unlike `watch.ts`'s: a menu has no ticks and nothing animates,
// so there is no per-frame timer — a redraw happens only in response to input or a resize.

import { MenuSession } from "../menu/session.ts"
import type { MenuItem } from "../menu/types.ts"
import { MOUSE_REPORTING_OFF, MOUSE_REPORTING_ON } from "../menu/mouse.ts"
import { composeMenuFrame, MENU_LAYOUT, MENU_SIZE } from "../view/menu.ts"
import { gateFrame, keysFromChunk } from "../view/index.ts"
import { AnsiBackend } from "../view/backends/ansi.ts"
import { selectBackend } from "../view/backends/index.ts"
import { createTerminalSession } from "./lifecycle.ts"
import { nextCapability, nextGlyphPack, nextTheme, toggleReducedMotion } from "../settings/types.ts"
import type { Settings, SettingsStore } from "../settings/index.ts"

/** Canon 2.11 named these four; Q43 withdrew a fifth ("choose your Commander") upfront screen. */
export const TOP_LEVEL_ITEMS: readonly MenuItem[] = [
  { id: "campaign", hotkey: "1", label: "Campaign" },
  { id: "challenge", hotkey: "2", label: "Challenge" },
  { id: "settings", hotkey: "3", label: "Settings" },
  { id: "exit", hotkey: "4", label: "Exit" },
]

/**
 * "Stub honestly rather than half-build" (milestone-03-game-menu.md Section 3) — every option not
 * built yet says plainly what it is waiting on, rather than silently doing nothing. Settings no
 * longer needs one: this gate builds it for real.
 */
const STUB_NOTICES: Readonly<Record<string, string>> = {
  campaign: "Campaign is not built yet - Milestone 4 adds the campaign menu.",
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
  backend: string
  stdout: NodeJS.WriteStream
  stdin: NodeJS.ReadStream
  /** Injectable for the same reason `watch.ts`'s is: a test drives quit paths through real code. */
  exit?: (code: number) => void
}>

type Screen = "top" | "settings"

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
  // The most recent write to the settings file still in flight, if any — awaited by the disposer so
  // the last thing a player changed is genuinely on disk before the process actually exits, not just
  // requested. Never allowed to reject: a settings file that failed to save is not a reason to fail
  // the whole session on the way out.
  let pendingSave: Promise<void> | null = null

  const session = createTerminalSession()
  const dispose = session.dispose
  const exit = options.exit ?? ((code: number): void => process.exit(code))

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
    const active = screen === "top" ? topMenu : settingsMenu
    const frame = gated
      ? gateFrame(stdout.columns ?? MENU_SIZE.width, stdout.rows ?? MENU_SIZE.height, MENU_SIZE)
      : composeMenuFrame(
          {
            state: active.state,
            notice: screen === "top" ? notice : null,
            glyphPack: settings.glyphPack,
            subtitle: screen === "top" ? "top-level menu" : "settings",
            showBack: screen === "settings",
          },
          settings.capability,
        )
    try {
      backend.present(frame)
    } catch (error) {
      failure = error
      leave()
    }
  }

  function goTo(next: Screen): void {
    screen = next
    render()
  }

  const topMenu = new MenuSession({
    items: TOP_LEVEL_ITEMS,
    onActivate: (item: MenuItem) => {
      if (item.id === "exit") {
        leave()
        return
      }
      if (item.id === "settings") {
        notice = null
        goTo("settings")
        return
      }
      notice = STUB_NOTICES[item.id] ?? null
      render()
    },
    onQuit: leave,
  })

  const settingsMenu = new MenuSession({
    items: settingsItems(settings),
    onActivate: (item: MenuItem) => {
      if (item.id === "back") {
        goTo("top")
        return
      }
      settings = withNextValue(settings, item.id)
      settingsMenu.setItems(settingsItems(settings))
      // Takes effect on the very next frame, without stopping and restarting the backend — the
      // point of Gate 3B's own `setPresentation` addition (src/view/frame.ts, src/view/backends/).
      backend.setPresentation?.(settings.capability, settings.theme)
      pendingSave = options.settingsStore.save(settings).catch(() => {
        /* a failed write is not a reason to crash or block the exit path */
      })
      render()
    },
    onQuit: leave,
    onBack: () => goTo("top"),
  })

  function onResize(): void {
    gated = (stdout.columns ?? 0) < MENU_SIZE.width || (stdout.rows ?? 0) < MENU_SIZE.height
    render()
  }

  function onData(data: Buffer): void {
    if (gated || leaving) return
    // Split here, and re-read `screen` before *every* key — not once for the whole chunk — because
    // a hotkey that changes screen and a second key typed right behind it can arrive in the same
    // stdin chunk. Fixing that on one screen through `active.handleData(rawChunk, ...)` would keep
    // dispatching every remaining key in the chunk to the screen that was current when the chunk
    // *started*, silently misrouting anything typed right after the switch to a session menu the
    // player can no longer see.
    for (const key of keysFromChunk(data.toString("utf8"))) {
      if (leaving) break
      const active = screen === "top" ? topMenu : settingsMenu
      active.handleKey(key, MENU_LAYOUT)
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

  try {
    await backend.start()
    stdout.write(MOUSE_REPORTING_ON)
    onResize()
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

  if (failure !== null) {
    process.stderr.write(`terminal-nexus failed: ${String(failure)}\n`)
    return 1
  }
  return 0
}

export { AnsiBackend }
