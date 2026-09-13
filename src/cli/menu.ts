// `terminal-nexus`'s top-level menu — milestone-03-game-menu.md Gate 3A: the smallest screen that
// exercises the whole input model of engine.md 9.7. Campaign, Challenge, and Settings are honest
// stubs (3B and 3C build their real destinations); Exit is the one item that is real, because the
// shared disposer is this gate's own scope.
//
// The event loop here is deliberately unlike `watch.ts`'s: a menu has no ticks and nothing animates,
// so there is no per-frame timer — a redraw happens only in response to input or a resize.

import { MenuSession } from "../menu/session.ts"
import type { MenuItem } from "../menu/types.ts"
import { MOUSE_REPORTING_OFF, MOUSE_REPORTING_ON } from "../menu/mouse.ts"
import { composeMenuFrame, MENU_LAYOUT, MENU_SIZE } from "../view/menu.ts"
import { gateFrame } from "../view/index.ts"
import type { CapabilityMode, Theme } from "../view/roles.ts"
import type { GlyphPack } from "../view/theme.ts"
import { AnsiBackend } from "../view/backends/ansi.ts"
import { selectBackend } from "../view/backends/index.ts"
import { createTerminalSession } from "./lifecycle.ts"

/** Canon 2.11 named these four; Q43 withdrew a fifth ("choose your Commander") upfront screen. */
export const TOP_LEVEL_ITEMS: readonly MenuItem[] = [
  { id: "campaign", hotkey: "1", label: "Campaign" },
  { id: "challenge", hotkey: "2", label: "Challenge" },
  { id: "settings", hotkey: "3", label: "Settings" },
  { id: "exit", hotkey: "4", label: "Exit" },
]

/**
 * "Stub honestly rather than half-build" (milestone-03-game-menu.md Section 3) — every option not
 * built at this gate says plainly what it is waiting on, rather than silently doing nothing.
 */
const STUB_NOTICES: Readonly<Record<string, string>> = {
  campaign: "Campaign is not built yet - Milestone 4 adds the campaign menu.",
  challenge: "Challenge is not built yet - Milestone 11 adds the run screen.",
  settings: "Settings is not built yet - Gate 3B adds capability, theme, and glyphs here.",
}

export type MenuOptions = Readonly<{
  capability: CapabilityMode
  theme?: Theme
  glyphPack?: GlyphPack
  backend: string
  stdout: NodeJS.WriteStream
  stdin: NodeJS.ReadStream
  /** Injectable for the same reason `watch.ts`'s is: a test drives quit paths through real code. */
  exit?: (code: number) => void
}>

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
    capability: options.capability,
    ...(options.theme === undefined ? {} : { theme: options.theme }),
    width: MENU_SIZE.width,
    height: MENU_SIZE.height,
  })

  let notice: string | null = null
  let gated = false
  let leaving = false
  let failure: unknown = null
  let settleSession: (() => void) | null = null

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
    const frame = gated
      ? gateFrame(stdout.columns ?? MENU_SIZE.width, stdout.rows ?? MENU_SIZE.height, MENU_SIZE)
      : composeMenuFrame(
          {
            state: menu.state,
            notice,
            ...(options.glyphPack === undefined ? {} : { glyphPack: options.glyphPack }),
          },
          options.capability,
        )
    try {
      backend.present(frame)
    } catch (error) {
      failure = error
      leave()
    }
  }

  const menu = new MenuSession({
    items: TOP_LEVEL_ITEMS,
    onActivate: (item: MenuItem) => {
      if (item.id === "exit") {
        leave()
        return
      }
      notice = STUB_NOTICES[item.id] ?? null
      render()
    },
    onQuit: leave,
  })

  function onResize(): void {
    gated = (stdout.columns ?? 0) < MENU_SIZE.width || (stdout.rows ?? 0) < MENU_SIZE.height
    render()
  }

  function onData(data: Buffer): void {
    if (gated || leaving) return
    menu.handleData(data.toString("utf8"), MENU_LAYOUT)
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
