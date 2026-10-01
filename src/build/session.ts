// The Build Phase's dispatch core — the state plus the one function a live terminal's stdin handler,
// a test, and an agent playtest all call. It *is* the real adapter dispatch rather than a parallel
// copy for tests, which is what makes the rule in docs/system-design/input.md ("the driver injects raw key and mouse
// events into the real adapters") true. `src/menu/session.ts` is the same shape for the menu.
//
// No stdin, no ANSI, no backend, no `src/view` import: composing the frame is `src/view/build.ts`'s
// job and wiring it to a terminal is `src/cli/build-phase.ts`'s.

import { decodeKeyEvent } from "../view/key-events.ts"
import type { KeyPhase } from "../view/key-events.ts"
import { keysFromChunk } from "../view/playback.ts"
import { PulsePresenter } from "../view/pulse-live.ts"
import type { ResolvedPulse } from "../view/pulse-live.ts"
import type { PulseFrame } from "../view/pulse-scene.ts"
import type { BuildLayout } from "./layout.ts"
import { escLabel } from "./layout.ts"
import { popupSpec, placePopup } from "./popup.ts"
import type { Camera, Viewport } from "./camera.ts"
import type { CursorKey } from "../menu/list-keys.ts"
import { cursorKeyOf } from "../menu/list-keys.ts"
import { buildKeyboardCommand } from "./keyboard.ts"
import type { Move } from "./motion.ts"
import { KeyMotion, moveTuning, pressTiles } from "./motion.ts"
import type { MouseEvent } from "./mouse.ts"
import { buildMouseCommand, parseMouseEvent } from "./mouse.ts"
import type { BuildContext, BuildState } from "./state.ts"
import { applyBuildCommand, cardEntry, createBuildState, exportText, nexusTile, withViewport } from "./state.ts"
import { setting } from "./all-settings.ts"
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
   * reducer never has (the owner: "export settings, and copy-paste them into a PR comment").
   * Called with the text each time the export popup is opened.
   */
  onExport?: (text: string) => void
  /** The player changed a setting in the Settings popup: the live loop redraws with it and saves it. */
  onSettingsChange?: (settings: Settings) => void
  /**
   * Resolves the Nexus Pulse the player has just committed to, or `null` when there is none to
   * start. **Injected, because `src/build` may never reach the kernel** (`tests/architecture.test.ts`):
   * the application shell owns that connection (`src/cli/pulse-run.ts`), and the session only hands it the
   * plan and plays what comes back. Absent — a hand-built session in a test — committing freezes the plan
   * and nothing more.
   */
  startPulse?: (context: BuildContext, state: BuildState) => ResolvedPulse | null
  /**
   * The Build Phase that follows a round the mission goes on from: the map Recall left, the
   * credits not spent, the next round's arrivals — or `null` when the mission is over. Injected for the
   * same reason as `startPulse`. Absent: a round's result is where the screen stops.
   */
  nextRound?: (context: BuildContext, state: BuildState, resolved: ResolvedPulse) => BuildContext | null
}>

/**
 * What a live input path knows about a key that a driver script does not have to: when it arrived
 * (milliseconds on any steady clock — the live loop's own, a test's injected number), which decides
 * how far a cursor key moves (taps counted, holds on the game's cadence, `src/build/motion.ts`) and how
 * often a held Shift+arrow jumps; and the camera the screen is drawing right now, which differs from
 * the state's while the view slides, so a click lands where the player saw it. Whether a key
 * was a press, a repeat or a release travels in its own bytes (`src/view/key-events.ts`).
 */
export type KeyTiming = Readonly<{ now?: number; camera?: Camera }>

export class BuildSession {
  private buildState: BuildState
  /** This round's context — replaced when the mission moves on to its next round. */
  private context: BuildContext
  /** Round 1's, which Restart and "Play again" go back to. */
  private readonly firstContext: BuildContext
  private readonly onQuit: () => void
  private readonly onExport: (text: string) => void
  private readonly onSettingsChange: (settings: Settings) => void
  /** How far cursor keys move — taps counted, holds on the game's cadence: input-path state, beside the
   *  reducer and never in it. */
  private readonly motion = new KeyMotion()
  /** Whether the terminal is marking presses, repeats and releases right now (the kitty keyboard
   *  protocol, pushed by the live loop): then a plain press is known to be a press, not guessed. */
  private keyReleases = false
  /** The last left click on a Grid tile with a building armed: where on screen, when, and the tile it
   *  pointed at — so a double click places there even if the first click scrolled the view. */
  private lastArmedClick: Readonly<{ column: number; row: number; at: number; tile: Coord }> | null = null
  /** The last left click that placed a building: where on screen and when — so the second half of a
   *  double click on the ghost's own tile, which the first half already placed by the second-click
   *  rule, is swallowed rather than read as a fresh click on the map. */
  private lastPlacingClick: Readonly<{ column: number; row: number; at: number }> | null = null
  private readonly startPulse: (context: BuildContext, state: BuildState) => ResolvedPulse | null
  private readonly nextRound: (context: BuildContext, state: BuildState, resolved: ResolvedPulse) => BuildContext | null
  /** The Nexus Pulse on screen, from the moment the plan is committed until the Build Phase starts over. */
  private presenter: PulsePresenter | null = null
  /** The screen's clock at the last thing the session heard of it, so a Pulse begun by a key press is at
   *  zero when that key arrived. `undefined` for a driver that never says. */
  private now: number | undefined

  constructor(options: BuildSessionOptions) {
    this.context = options.context
    this.firstContext = options.context
    this.buildState = createBuildState(options.context, options.cursor, options.viewport)
    this.onQuit = options.onQuit ?? ((): void => {})
    this.onExport = options.onExport ?? ((): void => {})
    this.onSettingsChange = options.onSettingsChange ?? ((): void => {})
    this.startPulse = options.startPulse ?? ((): null => null)
    this.nextRound = options.nextRound ?? ((): null => null)
  }

  get state(): BuildState {
    return this.buildState
  }

  /** This round's context: what stands on the map, the credits, the round's number. */
  get round(): BuildContext {
    return this.context
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

  /** The driver's direct-command path — "a scripted list of commands" (docs/system-design/input.md). */
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
    if (command.kind === "next-round") {
      this.moveOn()
      return
    }
    // Restart is the mission's, from round 1: the reducer starts a Build Phase over on the context it is
    // given, so it is given the first round's.
    if (command.kind === "restart") this.context = this.firstContext
    const before = this.buildState
    this.buildState = applyBuildCommand(this.context, before, command)
    // Side effects the reducer only records, handed to the adapter that owns them.
    if (this.buildState.settings !== before.settings) this.onSettingsChange(this.buildState.settings)
    if (this.buildState.popup === "export" && before.popup !== "export") {
      this.onExport(exportText(this.context, this.buildState))
    }
    // The plan was just committed: the Nexus Pulse starts. Or the Build Phase started over: it is gone.
    if (!before.committed && this.buildState.committed) this.beginPulse()
    else if (before.committed && !this.buildState.committed) this.presenter = null
  }

  /**
   * The result stands, and the player (or the Pulse, on its own) goes on: to the next round's Build Phase
   * if the mission goes on, or to the mission again from round 1 if it is over. A fresh Build Phase either
   * way — the settings, the Experiments and the view carried over, the cursor on the Grid Nexus — and the
   * Pulse is gone. Before the result stands it is nothing: a key must never skip the ending.
   */
  private moveOn(): void {
    const presenter = this.presenter
    if (presenter === null || presenter.phase() !== "home") return
    const next = this.nextRound(this.context, this.buildState, presenter.resolved)
    if (next === null && presenter.resolved.mission === undefined) return
    const before = this.buildState
    this.context = next ?? this.firstContext
    const cursor = nexusTile(this.context) ?? before.startCursor
    const fresh = createBuildState(this.context, cursor, before.viewport, before.experiments, before.settings)
    // The sequences keep counting up, so the live loop never mistakes a new one for one it has shown.
    this.buildState = { ...fresh, ack: before.ack, refusedTry: before.refusedTry, handoff: before.handoff }
    this.presenter = null
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
    this.presenter = new PulsePresenter(resolved, undefined, {
      autoNextMs: setting(this.buildState, "nextRound") === "auto" ? TUNING.autoNextRoundMs : null,
    })
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
   * is current between keys of the same chunk — a bug once found and fixed for the menu, which
   * would be exactly as easy to reintroduce here.
   */
  handleKey(key: string, layout: BuildLayout, timing: KeyTiming = {}): void {
    // Time passes before the key does: a pause pressed a second into a Pulse pauses it a second in.
    if (timing.now !== undefined) this.advance(timing.now)
    // The kitty keyboard protocol's forms become the keys the adapters read, with the phase they carry;
    // a terminal's answer to the live loop's question is not a key at all.
    const event = decodeKeyEvent(key)
    if (event === null) return
    const mouse = parseMouseEvent(event.key)
    if (mouse === null) {
      this.handleKeyEvent(event.key, event.phase ?? (this.reportsReleases() ? "press" : null), timing.now)
      return
    }
    const clicked = this.mouseCommand(mouse, layout, timing.camera)
    // Anything but a cursor key: the next arrow starts from scratch (the owner's "doing anything else
    // returns to normal").
    if (clicked !== null) this.motion.reset()
    const command = mouse.press ? this.resolveDoubleClick(mouse, clicked, timing.now) : clicked
    if (command === null) return
    const before = this.buildState
    this.dispatch(command)
    if (mouse.press && timing.now !== undefined && this.buildState.planned.length > before.planned.length) {
      this.lastPlacingClick = { column: mouse.column, row: mouse.row, at: timing.now }
    }
  }

  /**
   * The host says whether the terminal is marking presses, repeats and releases right now — the live
   * loop, once the kitty keyboard protocol's flags are pushed (or popped again). It counts only while
   * the Key releases Experiment is on `auto`: `off` means timing decides, whatever the terminal does.
   */
  setKeyReleases(reported: boolean): void {
    this.keyReleases = reported
  }

  /** Whether a plain press is known to be a press: the terminal marks key events, and the player has
   *  not switched that off. */
  private reportsReleases(): boolean {
    return this.keyReleases && this.buildState.experiments.keyReleases === "auto"
  }

  /**
   * One key, and the phase the terminal gave it (or `null`: timing decides). **A release sends no
   * command**: it only ends the hold of the key it names (`src/build/motion.ts`), and a release of any
   * other key is nothing at all — never a second press. A repeat of anything but a cursor key is a press
   * again, as a classic terminal's auto-repeat always was.
   */
  private handleKeyEvent(key: string, phase: KeyPhase | null, now: number | undefined): void {
    if (phase === "release") {
      const cursor = cursorKeyOf(key)
      if (cursor !== null && now !== undefined) this.motion.step(cursor, now, phase, moveTuning(this.buildState))
      return
    }
    const command = this.keyCommand(key, now, phase)
    if (command !== null) this.dispatch(command)
  }

  /**
   * A key through the keyboard adapter. **How far a cursor key moves, and how many rows Up or Down
   * move a list, is the motion rules' call** when the key's arrival time is known — a live terminal
   * (`src/build/motion.ts`: taps counted, holds on the game's own cadence); otherwise every key is a
   * press on its own, so a driver script and every test that sends keys without a clock sees each as its
   * own press. Up and Down in a list follow the map cursor's own rules, with the same numbers (the owner:
   * "Use the same timings, consistency here will be very useful"; "The same is happening with the menu
   * now") — so a first tap is always one row and every row stays
   * reachable. Any other key starts the rules over.
   */
  private keyCommand(key: string, now: number | undefined, phase: KeyPhase | null): BuildCommand | null {
    const state = this.buildState
    const tuning = moveTuning(state)
    let moved = false
    const move = (cursor: CursorKey): number => {
      moved = true
      return this.motion.step(cursor, now as number, phase, tuning)
    }
    const command = buildKeyboardCommand(key, {
      itemCount: this.context.catalog.length,
      armed: state.armed !== null,
      focus: state.focus,
      popup: state.popup,
      popupSpec: popupSpec(this.context, state),
      pulse: this.presenter !== null,
      pulseOver: this.presenter?.phase() === "home",
      // Without a clock every key is a press on its own — a tap, or the fast move's jump as far as the
      // setting says now.
      ...(now === undefined
        ? { moveTiles: (cursor: CursorKey) => pressTiles(cursor, tuning) }
        : {
            moveTiles: move,
            listRows: (direction: -1 | 1) => move({ dx: 0, dy: direction, jump: false }),
          }),
    })
    if (command !== null && !moved) this.motion.reset()
    return command
  }

  /** A mouse report through the mouse adapter, against what is on screen: the open popup, placed;
   *  the card, if one shows; the top bar's Esc label; and the camera as drawn — while the view is still
   *  sliding, a click lands on the tile drawn under the pointer, not the target's. */
  private mouseCommand(mouse: MouseEvent, layout: BuildLayout, camera: Camera | undefined): BuildCommand | null {
    const state = this.buildState
    const spec = popupSpec(this.context, state)
    return buildMouseCommand(mouse, camera ?? state.camera, layout, this.context.catalog, {
      ...(spec === null ? {} : { popup: placePopup(layout, spec) }),
      card: cardEntry(state),
      escLabel: escLabel(state),
      pulse: this.presenter !== null,
      pulseOver: this.presenter?.phase() === "home",
    })
  }

  /**
   * A double click, resolved from when the presses came — the input path's call, since only it knows.
   * The reducer places on a second click of the tile the cursor is on, so for a click on the map:
   *
   * - the second half of a double click whose first half already placed — a double click on the ghost's
   *   own tile, where one click is enough — is swallowed: read as a fresh click it would take the
   *   keyboard to the map and lapse the placement's answer;
   * - the second half of a quick double click on the same screen cell with a building armed is sent as
   *   a click on the first one's tile — exactly what a driver would send for "click it again" —
   *   whatever the view did in between.
   */
  private resolveDoubleClick(mouse: MouseEvent, command: BuildCommand | null, now: number | undefined): BuildCommand | null {
    const placing = this.lastPlacingClick
    const armedClick = this.lastArmedClick
    this.lastPlacingClick = null
    this.lastArmedClick = null
    if (command?.kind !== "click-tile" || now === undefined) return command
    const again = (last: Readonly<{ column: number; row: number; at: number }> | null): boolean =>
      last !== null && last.column === mouse.column && last.row === mouse.row && now - last.at <= TUNING.doubleClickMs
    if (again(placing)) return null
    if (this.buildState.armed === null) return command
    if (armedClick !== null && again(armedClick)) return { kind: "click-tile", x: armedClick.tile.x, y: armedClick.tile.y }
    this.lastArmedClick = { column: mouse.column, row: mouse.row, at: now, tile: { x: command.x, y: command.y } }
    return command
  }

  /** The driver's raw-bytes path — "a scripted list of... raw key and mouse events" — and what a
   *  live terminal's `data` handler calls. */
  handleData(rawChunk: string, layout: BuildLayout, timing: KeyTiming = {}): void {
    for (const key of keysFromChunk(rawChunk)) this.handleKey(key, layout, timing)
  }

  /** The move the last timed cursor key made — a tap at its run's speed, a hold's move, a jump, a
   *  release — and how many tiles or rows; `null` before any, and once anything else was pressed. */
  get lastMove(): Move | null {
    return this.motion.move
  }

  /** A new terminal size. Not a command: nobody pressed anything. */
  resize(viewport: Viewport): void {
    this.buildState = withViewport(this.context, this.buildState, viewport)
  }
}
