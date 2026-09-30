// The Build Phase's dispatch core — the state plus the one function a live terminal's stdin handler,
// a test, and an agent playtest all call. It *is* the real adapter dispatch rather than a parallel
// copy for tests, which is what makes engine.md 9.7's "the driver injects raw key and mouse events
// into the real adapters" true. `src/menu/session.ts` is the same shape for the menu.
//
// No stdin, no ANSI, no backend, no `src/view` import: composing the frame is `src/view/build.ts`'s
// job and wiring it to a terminal is `src/cli/spike.ts`'s.

import { keysFromChunk } from "../view/playback.ts"
import { PulsePresenter } from "../view/pulse-live.ts"
import type { ResolvedPulse } from "../view/pulse-live.ts"
import type { PulseFrame } from "../view/pulse-scene.ts"
import type { BuildLayout } from "./layout.ts"
import { escLabel } from "./layout.ts"
import { overlaySpec, placeOverlay } from "./overlay.ts"
import type { Camera, Viewport } from "./camera.ts"
import { buildKeyboardCommand, cursorKeyOf } from "./keyboard.ts"
import type { MoveKind } from "./motion.ts"
import { SpeedRamp, rampTuning } from "./motion.ts"
import { buildMouseCommand, parseMouseEvent } from "./mouse.ts"
import type { BuildContext, BuildState } from "./state.ts"
import { applyBuildCommand, cardShowing, createBuildState, exportText, nexusPowers, withViewport } from "./state.ts"
import { TUNING } from "./tuning.ts"
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
  /**
   * Resolves the Nexus Pulse the player has just committed to (gate 6A), or `null` when there is none to
   * start. **Injected, because `src/build` may never reach the kernel** (`tests/architecture.test.ts`):
   * the application shell owns that connection (`src/cli/pulse-run.ts`), and the session only hands it the
   * plan and plays what comes back. Absent — a hand-built session in a test — committing freezes the plan
   * and nothing more.
   */
  startPulse?: (context: BuildContext, state: BuildState) => ResolvedPulse | null
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
  private readonly startPulse: (context: BuildContext, state: BuildState) => ResolvedPulse | null
  /** The Nexus Pulse on screen, from the moment the plan is committed until the Build Phase starts over. */
  private presenter: PulsePresenter | null = null
  /** The screen's clock at the last thing the session heard of it, so a Pulse begun by a key press is at
   *  zero when that key arrived. `undefined` for a driver that never says. */
  private now: number | undefined

  constructor(options: BuildSessionOptions) {
    this.context = options.context
    this.buildState = createBuildState(options.context, options.cursor, options.viewport)
    this.onQuit = options.onQuit ?? ((): void => {})
    this.onExport = options.onExport ?? ((): void => {})
    this.onSettingsChange = options.onSettingsChange ?? ((): void => {})
    this.startPulse = options.startPulse ?? ((): null => null)
  }

  get state(): BuildState {
    return this.buildState
  }

  /** The Nexus Pulse on screen, or `null` — before the plan is committed, and after a restart. */
  get pulse(): PulsePresenter | null {
    return this.presenter
  }

  /**
   * Time passes (`now` is the screen's own clock, in milliseconds — never read here): the Pulse on screen
   * moves on with it, and whatever it asks of the screen in return — to look at the player's Nexus — is
   * done as the ordinary command it is. `hold` keeps the Pulse still while the clock moves on: the
   * terminal is too small to draw it.
   */
  advance(now: number, hold = false): void {
    this.now = now
    if (this.presenter === null) return
    this.presenter.advance(now, hold)
    for (const command of this.presenter.due()) this.dispatch(command)
  }

  /** What the Pulse on screen is showing right now, for the composer — or `undefined` when there is
   *  none. */
  pulseFrame(layout: BuildLayout): PulseFrame | undefined {
    if (this.presenter === null) return undefined
    const { settings } = this.buildState
    return this.presenter.frame({
      capability: settings.capability,
      tileWidth: layout.tileWidth,
      reducedMotion: settings.reducedMotion,
    })
  }

  /** The driver's direct-command path — "a scripted list of commands" (engine.md 9.7). */
  dispatch(command: BuildCommand): void {
    if (command.kind === "quit") {
      this.onQuit()
      return
    }
    // A playback control belongs to the Pulse's clock, not to the state: handed on like a quit. Pause has
    // nothing to pause once the result stands — and no row is drawn for it there — so it is not handed on.
    if (command.kind === "pulse") {
      const over = this.presenter?.phase() === "home"
      if (!(over && command.control === "toggle")) this.presenter?.apply(command.control)
      return
    }
    const before = this.buildState
    this.buildState = applyBuildCommand(this.context, before, command)
    // Side effects the reducer only records, handed to the adapter that owns them.
    if (this.buildState.settings !== before.settings) this.onSettingsChange(this.buildState.settings)
    if (this.buildState.overlay === "export" && before.overlay !== "export") {
      this.onExport(exportText(this.context, this.buildState))
    }
    // The plan was just committed: the Nexus Pulse starts. Or the Build Phase started over: it is gone.
    if (!before.committed && this.buildState.committed) this.beginPulse()
    else if (before.committed && !this.buildState.committed) this.presenter = null
  }

  /** Resolve the committed plan and put its Pulse on screen. A Pulse that cannot start — a plan that
   *  leaves no room for the units — undoes the commit and says why, so the player can fix the plan. */
  private beginPulse(): void {
    let resolved: ResolvedPulse | null
    try {
      resolved = this.startPulse(this.context, this.buildState)
    } catch (error) {
      this.dispatch({ kind: "pulse-failed", reason: error instanceof Error ? error.message : String(error) })
      return
    }
    if (resolved === null) return
    this.presenter = new PulsePresenter(resolved)
    // Started by a key that arrived at a known time: the Pulse is at zero from that moment.
    if (this.now !== undefined) this.presenter.advance(this.now)
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
    // Time passes before the key does: a pause pressed a second into a Pulse pauses it a second in.
    if (timing.now !== undefined) this.advance(timing.now)
    const mouse = parseMouseEvent(key)
    const state = this.buildState
    const spec = overlaySpec(this.context, state)
    let command =
      mouse !== null
        ? // A click lands on the tile drawn under the pointer: while the view is still sliding, that
          // is the drawn camera's tile, not the target's (gate 5H).
          buildMouseCommand(mouse, timing.camera ?? state.camera, layout, this.context.catalog, {
            ...(spec === null ? {} : { overlay: placeOverlay(layout, spec) }),
            cardPanel: cardShowing(state),
            escLabel: escLabel(state),
            pulse: this.presenter !== null,
          })
        : buildKeyboardCommand(key, {
            itemCount: this.context.catalog.length,
            armed: state.armed !== null,
            focus: state.focus,
            overlay: state.overlay,
            overlayPendingCount: nexusPowers(this.context, state).pending.length,
            overlayHighlight: state.overlayHighlight,
            pulse: this.presenter !== null,
          })
    if (mouse !== null && mouse.press && command?.kind === "click-tile") {
      // A double click places where its first click pointed. The reducer places on a second click of
      // the tile the cursor is on, so the second half of a quick double click on the same screen cell
      // is sent as a click on the first one's tile — exactly what a driver would send for "click it
      // again" — whatever the view did in between.
      const last = this.lastArmedClick
      const double =
        state.armed !== null &&
        timing.now !== undefined &&
        last !== null &&
        last.column === mouse.column &&
        last.row === mouse.row &&
        timing.now - last.at <= TUNING.doubleClickMs
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
    if (mouse === null && command?.kind === "highlight" && command.jump !== true && timing.now !== undefined) {
      // Up or Down in a list, from a live terminal: the map cursor's own ramp, with the same numbers
      // (owner, 2026-09-30, feedback F75: "Use the same timings, consistency here will be very
      // useful") — a run moves the hold step and, after `rampMs`, the fast step, and the reducer clamps
      // it at the list's end, so holding Down reaches the last row quickly and stays there. **A tap is
      // always one row**, whatever the map's tap step, so every row stays reachable by Up and Down.
      const direction = command.delta < 0 ? -1 : 1
      const rows = this.ramp.step({ dx: 0, dy: direction, fast: false }, timing.now, { ...rampTuning(state.debug.holdWindowMs), tapStep: 1 })
      command = { kind: "highlight", delta: direction * rows }
    } else if (cursorKey !== null) {
      // A cursor key on the Grid: how far is the ramp's call when the key's arrival time is known — a
      // live terminal — and otherwise a tap's (or a jump's), so a driver script and every test that
      // sends keys without a clock sees each key as its own press. A held jump's repeat that came too
      // soon moves nothing, and nothing is sent for it.
      const tiles =
        timing.now !== undefined
          ? this.ramp.step(cursorKey, timing.now, rampTuning(state.debug.holdWindowMs))
          : cursorKey.fast
            ? TUNING.jumpStep
            : TUNING.tapStep
      command = tiles === 0 ? null : { kind: "move-cursor", dx: cursorKey.dx * tiles, dy: cursorKey.dy * tiles }
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
