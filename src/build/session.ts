// The Build Phase's dispatch core — the state plus the one function a live terminal's stdin handler,
// a test, and an agent playtest all call. It *is* the real adapter dispatch rather than a parallel
// copy for tests, which is what makes engine.md 9.7's "the driver injects raw key and mouse events
// into the real adapters" true. `src/menu/session.ts` is the same shape for the menu.
//
// No stdin, no ANSI, no backend, no `src/view` import: composing the frame is `src/view/build.ts`'s
// job and wiring it to a terminal is `src/cli/spike.ts`'s.

import { keysFromChunk } from "../view/playback.ts"
import type { BuildLayout } from "./layout.ts"
import { overlaySpec, placeOverlay } from "./overlay.ts"
import type { Camera, Viewport } from "./camera.ts"
import { buildKeyboardCommand, cursorKeyOf } from "./keyboard.ts"
import type { MoveKind } from "./motion.ts"
import { SpeedRamp } from "./motion.ts"
import { buildMouseCommand, parseMouseEvent } from "./mouse.ts"
import type { BuildContext, BuildState } from "./state.ts"
import { applyBuildCommand, createBuildState, exploring, exportText, nexusPowers, withViewport } from "./state.ts"
import type { BuildCommand } from "./types.ts"
import type { Coord } from "../grid/types.ts"
import type { Settings } from "../settings/types.ts"

export type BuildSessionOptions = Readonly<{
  context: BuildContext
  cursor: Coord
  viewport: Viewport
  onQuit?: () => void
  /**
   * The export's side effects — copying the text to the clipboard, writing it to a file — which the
   * reducer never has (owner, 2026-09-28: "export settings, and copy-paste them into a PR comment").
   * Called with the text each time the export popup is opened.
   */
  onExport?: (text: string) => void
  /** The player changed a setting in the Settings popup: the live loop redraws with it and saves it. */
  onSettingsChange?: (settings: Settings) => void
}>

/**
 * What a live input path knows about a key that a driver script does not have to: when it arrived
 * (milliseconds on any steady clock — the live loop's own, a test's injected number), which
 * drives the held-key ramp and how often a held Shift+arrow jumps; and the camera the screen is drawing right now, which differs from
 * the state's while the view slides (gate 5H), so a click lands where the player saw it.
 */
export type KeyTiming = Readonly<{ now?: number; camera?: Camera }>

export class BuildSession {
  private buildState: BuildState
  private readonly context: BuildContext
  private readonly onQuit: () => void
  private readonly onExport: (text: string) => void
  private readonly onSettingsChange: (settings: Settings) => void
  /** The held-key ramp: input-path state, beside the reducer and never in it. */
  private readonly ramp = new SpeedRamp()
  /** The last left click on a Grid tile with a building armed: where on screen, when, and the tile it
   *  pointed at — so a double click places there even if the first click scrolled the view (F22). */
  private lastArmedClick: Readonly<{ column: number; row: number; at: number; tile: Coord }> | null = null

  constructor(options: BuildSessionOptions) {
    this.context = options.context
    this.buildState = createBuildState(options.context, options.cursor, options.viewport)
    this.onQuit = options.onQuit ?? ((): void => {})
    this.onExport = options.onExport ?? ((): void => {})
    this.onSettingsChange = options.onSettingsChange ?? ((): void => {})
  }

  get state(): BuildState {
    return this.buildState
  }

  /** The driver's direct-command path — "a scripted list of commands" (engine.md 9.7). */
  dispatch(command: BuildCommand): void {
    if (command.kind === "quit") {
      this.onQuit()
      return
    }
    const before = this.buildState
    this.buildState = applyBuildCommand(this.context, before, command)
    // Side effects the reducer only records, handed to the adapter that owns them.
    if (this.buildState.settings !== before.settings) this.onSettingsChange(this.buildState.settings)
    if (this.buildState.overlay === "export" && before.overlay !== "export") {
      this.onExport(exportText(this.context, this.buildState))
    }
  }

  /** A whole script at once, which is what an agent playtest actually looks like. */
  run(commands: readonly BuildCommand[]): void {
    for (const command of commands) this.dispatch(command)
  }

  /**
   * One already-split raw key or mouse report through both real adapters: tried first as an SGR
   * mouse report, then as a key, and whichever recognises it produces the command. Exposed
   * separately from `handleData` so a caller juggling more than one screen can re-check which screen
   * is current between keys of the same chunk — the bug Gate 3B found and fixed for the menu, which
   * would be exactly as easy to reintroduce here.
   */
  handleKey(key: string, layout: BuildLayout, timing: KeyTiming = {}): void {
    const mouse = parseMouseEvent(key)
    const state = this.buildState
    const spec = overlaySpec(this.context, state)
    let command =
      mouse !== null
        ? // A click lands on the tile drawn under the pointer: while the view is still sliding, that
          // is the drawn camera's tile, not the target's (gate 5H).
          buildMouseCommand(mouse, timing.camera ?? state.camera, layout, this.context.catalog, {
            ...(spec === null ? {} : { overlay: placeOverlay(layout, spec) }),
            explorePanel: exploring(state),
          })
        : buildKeyboardCommand(key, {
            itemCount: this.context.catalog.length,
            armed: state.armed !== null,
            focus: state.focus,
            overlay: state.overlay,
            overlayPendingCount: nexusPowers(this.context, state).pending.length,
            overlayHighlight: state.overlayHighlight,
            jumpStep: state.debug.jumpStep,
          })
    if (mouse !== null && mouse.press && command?.kind === "click-tile") {
      // A double click places where its first click pointed. The reducer places on a second click of
      // the tile the cursor is on, so the second half of a quick double click on the same screen cell
      // is sent as a click on the first one's tile — exactly what a driver would send for "click it
      // again" — whatever the view did in between.
      const last = this.lastArmedClick
      const window = state.debug.doubleClickMs
      const double =
        state.armed !== null &&
        timing.now !== undefined &&
        window > 0 &&
        last !== null &&
        last.column === mouse.column &&
        last.row === mouse.row &&
        timing.now - last.at <= window
      if (double) {
        command = { kind: "click-tile", x: last.tile.x, y: last.tile.y }
        this.lastArmedClick = null
      } else {
        this.lastArmedClick =
          state.armed !== null && timing.now !== undefined
            ? { column: mouse.column, row: mouse.row, at: timing.now, tile: { x: command.x, y: command.y } }
            : null
      }
    } else if (mouse !== null && mouse.press) {
      this.lastArmedClick = null
    }
    const cursorKey = mouse === null && command?.kind === "move-cursor" ? cursorKeyOf(key) : null
    if (cursorKey !== null) {
      // A cursor key on the Grid: how far is the ramp's call when the key's arrival time is known — a
      // live terminal — and otherwise a tap's (or a jump's), so a driver script and every test that
      // sends keys without a clock sees each key as its own press. A held jump's repeat that came too
      // soon moves nothing, and nothing is sent for it.
      const tiles =
        timing.now !== undefined
          ? this.ramp.step(cursorKey, timing.now, state.debug)
          : cursorKey.fast
            ? state.debug.jumpStep
            : state.debug.tapStep
      command =
        tiles === 0
          ? null
          : {
              kind: "move-cursor",
              dx: cursorKey.dx * tiles,
              dy: cursorKey.dy * tiles,
              ...(cursorKey.fast ? { fast: true } : {}),
            }
    } else if (command !== null) {
      // Anything else pressed: the next arrow starts from scratch (the owner's "doing anything else
      // returns to normal").
      this.ramp.reset()
    }
    if (command !== null) this.dispatch(command)
  }

  /** The driver's raw-bytes path — "a scripted list of... raw key and mouse events" — and what a
   *  live terminal's `data` handler calls. */
  handleData(rawChunk: string, layout: BuildLayout, timing: KeyTiming = {}): void {
    for (const key of keysFromChunk(rawChunk)) this.handleKey(key, layout, timing)
  }

  /** The kind of move the last timed cursor key made — tap, hold, fast or jump — or `null` before
   *  any. */
  get moveKind(): MoveKind | null {
    return this.ramp.kind
  }

  /** A new terminal size. Not a command: nobody pressed anything. */
  resize(viewport: Viewport): void {
    this.buildState = withViewport(this.context, this.buildState, viewport)
  }
}
