// The Build Phase's dispatch core — the state plus the one function a live terminal's stdin handler,
// a test, and an agent playtest all call. It *is* the real adapter dispatch rather than a parallel
// copy for tests, which is what makes the rule in docs/system-design/input.md ("the driver injects raw key and mouse
// events into the real adapters") true. `src/title-menu/session.ts` is the same shape for the menu.
//
// No stdin, no ANSI, no backend: composing the frame is `src/view/build.ts`'s job and wiring it to a
// terminal is `src/cli/build-phase.ts`'s. It lives in the view because it owns the Pulse's presenter
// (`pulse-live.ts`); the reducer it drives (`src/build/`) never imports the view.
//
// **It records what happens into the Activity Logs**: every command and the bottom line's answer, a
// refusal and why, a building placed or removed, a popup opening, a setting changed, an export, the Pulse
// starting and its result, and how far each timed cursor key moved. All of it is read off the states
// before and after a command, never fed back in, so a log can never change what the reducer does; and a
// logger never throws.

import type { ActivityLog } from "../log/activity.ts"
import { activity as globalActivity } from "../log/activity.ts"
import { resultOf } from "./ending.ts"
import { decodeKeyEvent } from "../terminal/key-events.ts"
import type { KeyPhase } from "../terminal/key-events.ts"
import { keysFromChunk } from "../terminal/playback.ts"
import { PulsePresenter, outcomeOf } from "./pulse-live.ts"
import type { ResolvedPulse } from "./pulse-live.ts"
import type { PulseFrame } from "./pulse-scene.ts"
import type { BuildLayout } from "../build/layout.ts"
import { escLabel } from "../build/layout.ts"
import { popupSpec, placePopup } from "../build/popup.ts"
import type { Camera, Viewport } from "../build/camera.ts"
import type { CursorKey } from "../terminal/list-keys.ts"
import { cursorKeyOf } from "../terminal/list-keys.ts"
import { buildKeyboardCommand } from "../build/keyboard.ts"
import type { Move } from "../build/motion.ts"
import { KeyMotion, moveTuning, pressTiles } from "../build/motion.ts"
import type { MouseEvent } from "../build/mouse.ts"
import { buildMouseCommand, parseMouseEvent } from "../build/mouse.ts"
import type { BuildContext, BuildState } from "../build/state.ts"
import { applyBuildCommand, cardEntry, createBuildState, displayName, exportText, nexusTile, remaining, withViewport } from "../build/state.ts"
import { SHOWN_SETTINGS, setting } from "../build/all-settings.ts"
import { activityExportText, loggedTile, shownEntries } from "../build/activity.ts"
import { TUNING } from "../build/tuning.ts"
import type { BuildCommand, ExportKind, RaidForecast } from "../build/types.ts"
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
   * Called with the text and which export it is: the settings' each time their export popup opens, the
   * Activity Logs' each time the Activity logs window exports.
   */
  onExport?: (text: string, kind: ExportKind) => void
  /**
   * The log the session records what happens into: the game's global `activity`
   * unless a test, or a scripted playtest on its own clock, passes its own. What the Activity logs window
   * *shows* is the context's `activity`, which the live loop points at this same log.
   */
  activity?: ActivityLog
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
  /**
   * What each group of the raid the round brings goes for first, and the way it would go, on the plan as
   * it stands — the kernel's own first choice. Injected for the same reason as `startPulse`, and asked
   * only when the screen draws it (`raid`). Absent: no raid is foreseen.
   */
  foresee?: (context: BuildContext, state: BuildState) => RaidForecast
}>

/**
 * What a live input path knows about a key that a driver script does not have to: when it arrived
 * (milliseconds on any steady clock — the live loop's own, a test's injected number), which decides
 * how far a cursor key moves (taps counted, holds on the game's cadence, `src/build/motion.ts`) and how
 * often a held Shift+arrow jumps; and the camera the screen is drawing right now, which differs from
 * the state's while the view slides, so a click lands where the player saw it. Whether a key
 * was a press, a repeat or a release travels in its own bytes (`src/terminal/key-events.ts`).
 */
export type KeyTiming = Readonly<{ now?: number; camera?: Camera }>

export class BuildSession {
  private buildState: BuildState
  /** This round's context — replaced when the mission moves on to its next round. */
  private context: BuildContext
  /** Round 1's, which Restart and "Play again" go back to. */
  private readonly firstContext: BuildContext
  private readonly onQuit: () => void
  private readonly onExport: (text: string, kind: ExportKind) => void
  private readonly onSettingsChange: (settings: Settings) => void
  /** Where what happens is recorded (`BuildSessionOptions.activity`). */
  private readonly log: ActivityLog
  /** The Pulse on screen has had its result recorded, so watching it again does not record it twice. */
  private resultLogged = false
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
  private readonly foresee: ((context: BuildContext, state: BuildState) => RaidForecast) | null
  /** The raid last foreseen, and the round and plan it was foreseen on. */
  private foreseen: Readonly<{ context: BuildContext; planned: BuildState["planned"]; raid: RaidForecast }> | null = null

  constructor(options: BuildSessionOptions) {
    this.context = options.context
    this.firstContext = options.context
    this.buildState = createBuildState(options.context, options.cursor, options.viewport)
    this.onQuit = options.onQuit ?? ((): void => {})
    this.onExport = options.onExport ?? ((): void => {})
    this.onSettingsChange = options.onSettingsChange ?? ((): void => {})
    this.startPulse = options.startPulse ?? ((): null => null)
    this.log = options.activity ?? globalActivity
    this.nextRound = options.nextRound ?? ((): null => null)
    this.foresee = options.foresee ?? null
  }

  /**
   * The raid this round brings and what each group goes for first, on the plan as it stands — for the
   * composer, which draws it in the Build Phase only. Worked out when first asked and kept until the round
   * or the plan changes, so a frame costs nothing more and placing, undoing or removing a building is seen
   * at once. `undefined` when the session was given no way to foresee one; empty when it cannot be
   * foreseen (a plan that leaves the raid no room says why when the Pulse is started).
   */
  raid(): RaidForecast | undefined {
    if (this.foresee === null) return undefined
    const { planned } = this.buildState
    const last = this.foreseen
    if (last !== null && last.context === this.context && last.planned === planned) return last.raid
    let raid: RaidForecast
    try {
      raid = this.foresee(this.context, this.buildState)
    } catch {
      raid = []
    }
    this.foreseen = { context: this.context, planned, raid }
    return raid
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
    this.noteResult()
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
      this.log.log("build.command", { command: command.kind })
      this.onQuit()
      return
    }
    // A playback control belongs to the Pulse's clock, not to the state: handed on like a quit. Pause has
    // nothing to pause once the result stands — and no row is drawn for it there — so it is not handed on.
    if (command.kind === "pulse") {
      const over = this.presenter?.phase() === "home"
      if (!(over && command.control === "toggle")) this.presenter?.apply(command.control)
      this.log.log("build.command", { command: command.kind })
      // A step can be what reaches the result.
      this.noteResult()
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
      this.onExport(exportText(this.context, this.buildState), "settings")
    }
    if (this.buildState.activityExports > before.activityExports) {
      this.onExport(activityExportText(this.context, this.buildState), "activity")
    }
    // Before the Pulse starts, so the log reads in the order it happened: the command, then the Pulse.
    this.record(before, command)
    // The plan was just committed: the Nexus Pulse starts. Or the Build Phase started over: it is gone.
    if (!before.committed && this.buildState.committed) this.beginPulse()
    else if (before.committed && !this.buildState.committed) this.presenter = null
  }

  /**
   * What a command did, into the Activity Logs — read off the states before and after
   * it, never off how the reducer got there, so recording can never change what the reducer does:
   *
   * - `build.command` always, with the bottom line's answer when the command gave a new one;
   * - `build.refused` when that answer is a refusal (`isRefusal`), with its tile when it names one;
   * - `build.placed` and `build.removed` from the plan's difference — a restart's emptied plan is the
   *   restart's own line, not one removal per building;
   * - `popup.open` when a popup opens — not when going back reveals the one under it;
   * - `setting.change` for every shown setting whose value changed, by the name an export writes;
   * - `export` for either export, and `session.error` when the Pulse could not start.
   */
  private record(before: BuildState, command: BuildCommand): void {
    try {
      const after = this.buildState
      const log = this.log
      const answer = after.status !== before.status && after.status.text !== "" ? after.status.text : null
      log.log("build.command", answer === null ? { command: command.kind } : { command: command.kind, answer })
      if (answer !== null && isRefusal(before, after, command)) {
        const tile = after.status.tile
        log.log("build.refused", { command: command.kind, reason: answer, ...(tile === undefined ? {} : { x: tile.x, y: tile.y }) })
      }
      if (command.kind === "pulse-failed") log.log("session.error", { where: "pulse", message: command.reason })
      if (command.kind !== "restart" && after.planned !== before.planned) this.recordPlan(before, after)
      if (after.popup !== null && opened(before, after)) log.log("popup.open", { popup: after.popup })
      if (after.settings !== before.settings || after.experiments !== before.experiments) {
        for (const spec of SHOWN_SETTINGS) {
          const value = setting(after, spec.field)
          if (value === setting(before, spec.field)) continue
          log.log("setting.change", { setting: spec.field, value: spec.format(value), tier: spec.tier })
        }
      }
      if (after.popup === "export" && before.popup !== "export") log.log("export", { kind: "settings" })
      if (after.activityExports > before.activityExports) {
        log.log("export", { kind: "activity", events: shownEntries(after).length })
      }
    } catch {
      // A log that could break the game would not be worth having.
    }
  }

  /** The plan's difference, as buildings placed and taken off it, each with its tile and what is left. */
  private recordPlan(before: BuildState, after: BuildState): void {
    const now = new Set(after.planned.map((placement) => placement.ordinal))
    const was = new Set(before.planned.map((placement) => placement.ordinal))
    const credits = remaining(this.context, after)
    const entry = (placement: BuildState["planned"][number]) => {
      const tile = loggedTile(placement.anchor, this.context.registry.get(placement.contentId).footprint)
      return { building: displayName(this.context, placement.contentId), x: tile.x, y: tile.y, credits }
    }
    for (const placement of before.planned) if (!now.has(placement.ordinal)) this.log.log("build.removed", entry(placement))
    for (const placement of after.planned) if (!was.has(placement.ordinal)) this.log.log("build.placed", entry(placement))
  }

  /** The Pulse on screen has reached its result, the first time: recorded once (`pulse.end`). */
  private noteResult(): void {
    const presenter = this.presenter
    if (presenter === null || this.resultLogged || presenter.phase() !== "home") return
    this.resultLogged = true
    try {
      const result = resultOf(outcomeOf(presenter.resolved.timeline))
      this.log.log("pulse.end", { result: RESULT_WORDS[result.headline] ?? result.headline.toLowerCase(), reason: result.reason })
      const trained = trainedIn(presenter.resolved)
      if (trained.buildings > 0) this.log.log("pulse.trained", { round: this.buildState.pulseNumber, ...trained })
    } catch {
      // Never let a log line stop a Pulse.
    }
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
    this.resultLogged = false
    this.log.log("pulse.start", { round: this.buildState.pulseNumber, buildings: this.buildState.planned.length })
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
      if (cursor !== null && now !== undefined) {
        this.motion.step(cursor, now, phase, moveTuning(this.buildState))
        this.logMove(cursor)
      }
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
      const tiles = this.motion.step(cursor, now as number, phase, tuning)
      this.logMove(cursor)
      return tiles
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

  /** The motion rules' call on the timed cursor key just read, into the Activity Logs (`move.step`): how
   *  far it moved the map cursor or a list's highlight, and why — tap, hold, jump or release. */
  private logMove(key: CursorKey): void {
    const move = this.motion.move
    // A held key repeats faster than the game's pace, and most repeats move nothing: logging those would
    // fill the log's memory in a couple of minutes of holding an arrow.
    if (move === null || (move.kind === "hold" && move.tiles === 0)) return
    this.log.log("move.step", { key: directionOf(key), move: move.kind, tiles: move.tiles })
  }

  /** A new terminal size. Not a command: nobody pressed anything. */
  resize(viewport: Viewport): void {
    this.buildState = withViewport(this.context, this.buildState, viewport)
  }
}

/**
 * Whether a command's answer is a refusal, for `build.refused`: an answer in a warning or danger tone —
 * the tones the reducer refuses in (`editLock`, an unaffordable row, a refused placement, "already
 * picked") — except arming that found no room nearby, which warns but did arm, and the Pulse failing to
 * start, which is the shell's failure rather than the player's refusal (`session.error` says it).
 */
function isRefusal(before: BuildState, after: BuildState, command: BuildCommand): boolean {
  const tone = after.status.tone
  if (tone !== "warning" && tone !== "danger") return false
  if (command.kind === "pulse-failed") return false
  return !(after.armed !== null && after.armed !== before.armed)
}

/** Whether a popup opened — over nothing, over another, or in place of one — rather than coming back into
 *  view because the one over it closed. */
function opened(before: BuildState, after: BuildState): boolean {
  if (after.popup === null || after.popup === before.popup) return false
  const wentBack = before.popupUnder.length === after.popupUnder.length + 1 && before.popupUnder.at(-1)?.popup === after.popup
  return !wentBack
}

/** A Pulse's result as `pulse.end` names it, by the headline the player read. */
const RESULT_WORDS: Readonly<Record<string, string>> = {
  VICTORY: "won",
  DEFEAT: "lost",
  DRAW: "drawn",
  "TIME'S UP": "timed out",
}

/** A cursor key's direction, as `move.step` names it. */
function directionOf(key: CursorKey): string {
  if (key.dy !== 0) return key.dy < 0 ? "up" : "down"
  return key.dx < 0 ? "left" : "right"
}

/** What the player's buildings trained in a resolved Pulse, read from its events and its states as the
 *  `pulse.trained` entry records it: how many buildings could train, how many troopers they did, the
 *  second the first came, how many of them Recall brought home, and the second the fighting stopped. */
function trainedIn(resolved: ResolvedPulse): Readonly<{ buildings: number; trained: number; first?: number; home: number; ended: number }> {
  const { timeline } = resolved
  const opening = timeline.states[0]
  const final = timeline.states[timeline.states.length - 1]
  const buildings = (opening?.entities ?? []).filter(
    (entity) => entity.player === "A" && timeline.registry.get(entity.contentId).production !== undefined,
  ).length
  const trained = timeline.events.filter((event) => event.kind === "entity.spawned" && event.trainedBy !== undefined && event.player === "A")
  const ordinals = new Set(trained.map((event) => (event.kind === "entity.spawned" ? event.ordinal : -1)))
  const home = resolved.recall.moves.filter((move) => ordinals.has(move.ordinal)).length
  const seconds = (tick: number): number => Math.round(tick / timeline.ticksPerSecond)
  const first = trained[0]
  return {
    buildings,
    trained: trained.length,
    ...(first === undefined ? {} : { first: seconds(first.tick) }),
    home,
    ended: seconds(final?.tick ?? 0),
  }
}
