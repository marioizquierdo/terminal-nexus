// `terminal-nexus --spike` — the Build Phase's live terminal loop.
//
// Built on the same pieces as `src/cli/menu.ts`: the shared idempotent disposer (`lifecycle.ts`),
// the same backend selection, the same opt-in SGR mouse reporting switched off on every exit path.
// What differs is that the frame's size follows the terminal's, because a bigger terminal shows more
// Grid — up to the 72 x 24 ceiling and not one tile past it.

import { FIXTURE_REGISTRY } from "../content/index.ts"
import { MOUSE_REPORTING_OFF, MOUSE_REPORTING_ON } from "../menu/mouse.ts"
import { BuildSession } from "../build/session.ts"
import {
  SPIKE_ALLOTMENT,
  SPIKE_CATALOG,
  SPIKE_EDGE_STYLE,
  SPIKE_NEXUS_DRAFT,
  SPIKE_STANDING,
  SPIKE_START_CURSOR,
  spikeGrid,
  spikePulse,
} from "../build/catalog.ts"
import { isGated } from "../build/camera.ts"
import { buildLayout } from "../build/layout.ts"
import type { BuildContext } from "../build/state.ts"
import { composeBuildFrame } from "../view/build.ts"
import { BuildAnimation, livePresentation, nextFrameDelay } from "../view/build-live.ts"
import { KeyReader } from "../view/key-reader.ts"
import { KeyboardProtocol, terminalReplyOf } from "../view/key-events.ts"
import type { TerminalReply } from "../view/key-events.ts"
import { gateFrame } from "../view/index.ts"
import { selectBackend } from "../view/backends/index.ts"
import type { NamedBackend } from "../view/backends/index.ts"
import { chunkText } from "../view/backends/ports.ts"
import type { TerminalInput, TerminalOutput } from "../view/backends/ports.ts"
import { PROCESS_HOST, createTerminalSession } from "./lifecycle.ts"
import type { Host } from "./lifecycle.ts"
import { startPulse } from "./pulse-run.ts"
import type { PlaytestStep } from "../playtest/keys.ts"
import { UNTIMED_GAP_MS, deliverStep } from "../playtest/deliver.ts"
import type { Settings, SettingsStore } from "../settings/types.ts"
import type { Experiments } from "../build/experiments.ts"
import { TUNING } from "../build/tuning.ts"
import type { ExportKind } from "../build/types.ts"
import type { ActivityLog } from "../log/activity.ts"
import { activity as globalActivity } from "../log/activity.ts"
import type { CapabilityMode } from "../view/roles.ts"

const ESC = "\u001b"
/** Written before a frame whose size just changed: the backend draws from the cursor home position
 *  outward, so a frame that shrank would otherwise leave the old one's right-hand and bottom edges
 *  on screen. The menu never needed this because its frame is a fixed 80 x 24. */
const CLEAR = `${ESC}[2J`

/** The floor the resize gate is measured against — engine.md 3.3's own "80 x 24 remains the floor
 *  and the acceptance target". */
export const SPIKE_MINIMUM = { width: 80, height: 24 } as const

/**
 * What an export does besides showing its text, told which export it is (`ExportKind`): the terminal
 * copies it to the clipboard and writes a file of its own beside the settings; the playtest page copies
 * it and shows it in the text box under the screen that is its own. `destination` is the sentence each
 * export's popup or message says about where its text went. Side effects stay here, in the adapter,
 * never in the reducer.
 */
export type Exporter = Readonly<{
  destination: Readonly<Record<ExportKind, string>>
  export: (text: string, kind: ExportKind) => Promise<void> | void
}>

/** Where a screen runs, as `session.start` says it: a terminal, or the browser playtest page. */
export type HostName = "terminal" | "web"

/** A colour depth as the Activity Logs write it (`session.start`'s `colours`). */
const COLOURS: Readonly<Record<CapabilityMode, string>> = {
  truecolor: "truecolor",
  color256: "256",
  color16: "16",
  monochrome: "mono",
}

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))

export type SpikeOptions = Readonly<{
  settings: Settings
  /** A backend name, or a backend itself (the browser playtest page's canvas). */
  backend: string | NamedBackend
  stdout: TerminalOutput
  stdin: TerminalInput
  /** Interrupts, exit and error reporting; a terminal program's `process` unless given. */
  host?: Host
  exit?: (code: number) => void
  /** `--scroll-margin`, so the margin can be felt against another number: a percentage of the view
   *  since gate 5H. Omitted means the owner's tuned margin (`TUNING.scrollMargin`). */
  scrollMargin?: number
  /** The screen's clock, in milliseconds. `Date.now` unless a test injects one. */
  now?: () => number
  /** Where a change made in the Settings popup is saved — the same store the title menu's Settings
   *  screen uses (a file for the terminal, browser storage for the playtest page). Absent: changes
   *  apply for this run only. */
  settingsStore?: SettingsStore
  /** Experiments to open with instead of this build's defaults: an imported export (`--settings`). */
  experiments?: Partial<Experiments>
  /** The commit this build is, named at the top of an export. */
  buildId?: string
  /**
   * A key script to play before the player gets the keyboard (`--keys`, or `#keys=` on the browser
   * page): the Build Phase opens already in the state those keys reach — a power picked, a building
   * placed — through the same adapters a player's keys go through (`src/playtest/deliver.ts`). For
   * demos and for reproducing a report. A step that cannot be delivered (a click on a tile off screen)
   * stops the script there, and the reason is reported when the screen closes.
   */
  startKeys?: readonly PlaytestStep[]
  /** What an export does besides showing its text — the settings' and the Activity Logs' (`Exporter`). */
  exporter?: Exporter
  /**
   * The Activity Logs this screen records into and its Activity logs window shows (owner, 2026-10-01,
   * feedback F90-F91): the game's global `activity` unless a test passes its own. The browser page
   * shares the global across its screens, so a playtester's export holds the whole visit.
   */
  activity?: ActivityLog
  /** Where the screen runs, as `session.start` records it: `terminal` unless the playtest page says `web`. */
  hostName?: HostName
}>

export function spikeContext(scrollMargin?: number, extra: Partial<BuildContext> = {}): BuildContext {
  return {
    grid: spikeGrid(),
    registry: FIXTURE_REGISTRY,
    catalog: SPIKE_CATALOG,
    standing: SPIKE_STANDING,
    allotment: SPIKE_ALLOTMENT,
    nexusDraft: SPIKE_NEXUS_DRAFT,
    edgeStyle: SPIKE_EDGE_STYLE,
    pulse: spikePulse,
    ...(scrollMargin === undefined ? {} : { scrollMargin }),
    ...extra,
  }
}

export async function runSpike(options: SpikeOptions): Promise<number> {
  const { stdout, stdin } = options

  if (!stdout.isTTY || !stdin.isTTY) {
    stdout.write("terminal-nexus --spike needs an interactive terminal.\n")
    return 0
  }

  const log = options.activity ?? globalActivity
  const context = spikeContext(options.scrollMargin, {
    settings: options.settings,
    // The Activity logs window shows the log this screen records into (feedback F91).
    activity: log,
    ...(options.experiments === undefined ? {} : { experiments: options.experiments }),
    ...(options.buildId === undefined ? {} : { buildId: options.buildId }),
    ...(options.exporter === undefined
      ? {}
      : { exportDestination: options.exporter.destination.settings, activityExportDestination: options.exporter.destination.activity }),
  })
  const terminalSize = (): { columns: number; rows: number } => ({
    columns: stdout.columns ?? SPIKE_MINIMUM.width,
    rows: stdout.rows ?? SPIKE_MINIMUM.height,
  })
  // The first line of a playtest's story: which screen, from which build, where, and at what size.
  let loggedSize = terminalSize()
  log.log("session.start", {
    screen: "build",
    ...(options.buildId === undefined ? {} : { build: options.buildId }),
    host: options.hostName ?? "terminal",
    columns: loggedSize.columns,
    rows: loggedSize.rows,
    colours: COLOURS[options.settings.capability],
  })

  let layout = buildLayout(terminalSize(), context.grid)
  const backend = await selectBackend(options.backend, {
    stdout,
    stdin,
    capability: options.settings.capability,
    theme: options.settings.theme,
    width: layout.frame.width,
    height: layout.frame.height,
  })

  let gated = false
  let leaving = false
  let failure: unknown = null
  let settleSession: (() => void) | null = null
  /** The frame size last presented, so a redraw only clears when the size genuinely changed. */
  let lastFrame = { width: layout.frame.width, height: layout.frame.height }

  const host = options.host ?? PROCESS_HOST
  const session = createTerminalSession(host)
  const dispose = session.dispose
  const exit = options.exit ?? host.exit

  const leave = (): void => {
    if (leaving) return
    leaving = true
    void dispose().then(() => {
      exit(0)
      settleSession?.()
    })
  }

  // Saving works as the title menu's Settings screen does (`src/cli/menu.ts`): each write chained on
  // the last, so the last change is the one on disk, and awaited by the disposer before the process
  // exits; a failure is reported once the terminal is back to normal, never mid-screen.
  let pendingSave: Promise<void> = Promise.resolve()
  let sideEffectError: unknown = null
  const saveSettings = (settings: Settings): void => {
    // A new colour depth or background is drawn on the very next frame, without restarting the
    // backend (`setPresentation`, gate 3B).
    backend.setPresentation?.(settings.capability, settings.theme)
    const store = options.settingsStore
    if (store === undefined) return
    pendingSave = pendingSave.then(() =>
      store.save(settings).catch((error: unknown) => {
        sideEffectError = error
        log.log("session.error", { where: "save", message: messageOf(error) })
      }),
    )
  }
  const exportText = (text: string, kind: ExportKind): void => {
    const exporter = options.exporter
    if (exporter === undefined) return
    // Started at once, inside the key press or tap that asked for it — a browser allows a clipboard
    // write only then — and awaited by the disposer like a save.
    let started: Promise<void>
    try {
      started = Promise.resolve(exporter.export(text, kind))
    } catch (error) {
      started = Promise.reject(error)
    }
    const done = started.catch((error: unknown) => {
      sideEffectError = error
      log.log("session.error", { where: "export", message: messageOf(error) })
    })
    pendingSave = pendingSave.then(() => done)
  }

  const build = new BuildSession({
    context,
    cursor: SPIKE_START_CURSOR,
    viewport: layout.viewport,
    onQuit: leave,
    onSettingsChange: saveSettings,
    onExport: exportText,
    startPulse,
    activity: log,
  })

  // Start in a state: the script's own clock, a second between untimed steps as in a scripted
  // playtest, so each key is its own press; the live clock that follows is far past it.
  let startKeysError: string | null = null
  if (options.startKeys !== undefined) {
    let clock = 0
    for (const step of options.startKeys) {
      clock += step.afterMs ?? UNTIMED_GAP_MS
      try {
        deliverStep(build, layout, step, clock)
      } catch (error) {
        startKeysError = messageOf(error)
        log.log("session.error", { where: "start-keys", message: startKeysError })
        break
      }
      if (leaving) break
    }
  }

  // **The screen's clock lives here, never in the reducer** (gate 5H). Everything that moves between
  // commands — the view sliding to a new position, the cursor gliding to a new tile, a menu row's
  // flash, the cursor's flash on a refused placement, a building going up (gate 5I), the focus arrow
  // and the cursor's blink (feedback F54), the menu turning into a card (F68), a popup's
  // border flashing and breathing (F80, F83) — is
  // `BuildAnimation`'s pure function of the state and the time read here, and the frame timer below
  // runs only while one of them is still moving; an idle screen draws once per input, as it always
  // has. The same clock times how far a cursor key moves — taps counted, holds on the game's cadence —
  // (passed with each key) and the lone-Esc timeout (`KeyReader`).
  const clock = options.now ?? ((): number => Date.now())
  // A Nexus Pulse the start keys began was timed on the script's clock, a few seconds from nothing; from
  // here it runs on the live one. Rebase without letting any time pass: it opens at zero.
  build.advance(clock(), true)
  const animation = new BuildAnimation()
  const reader = new KeyReader()
  let frameTimer: ReturnType<typeof setTimeout> | null = null
  let escapeTimer: ReturnType<typeof setTimeout> | null = null

  function scheduleFrame(busyUntil: number | null, now: number, frameMs?: number): void {
    if (frameTimer !== null) clearTimeout(frameTimer)
    frameTimer = null
    const delay = nextFrameDelay(busyUntil, now, frameMs)
    if (delay === null) return
    frameTimer = setTimeout(() => {
      frameTimer = null
      render()
    }, delay)
  }

  function render(): void {
    if (leaving) return
    const size = terminalSize()
    const now = clock()
    // Time passes for a Nexus Pulse on screen — and holds while the terminal is too small to draw it, so
    // resizing back resumes from the same instant. Before the animations are read: the Pulse may have just
    // asked the view to look at the player's Nexus.
    build.advance(now, gated)
    // The player's settings as the Settings popup last left them — changed live, mid-screen.
    const settings = build.state.settings
    const live = gated
      ? null
      : animation.frame(build.state, now, {
          reducedMotion: settings.reducedMotion,
          capability: settings.capability,
          footprintOf: (contentId) => context.registry.get(contentId).footprint,
        })
    const pulse = gated ? undefined : build.pulseFrame(layout)
    const frame =
      gated || live === null
        ? gateFrame(size.columns, size.rows, SPIKE_MINIMUM)
        : composeBuildFrame(
            {
              context,
              state: build.state,
              layout,
              glyphPack: settings.glyphPack,
              // Everything time-dependent this frame shows — the slide, the glide, the flashes, the
              // buildings going up, the hand-off, the card reveal — through the one converter.
              ...livePresentation(live),
              reducedMotion: settings.reducedMotion,
              ...(pulse === undefined ? {} : { pulse }),
            },
            settings.capability,
          )
    // The frame timer runs while anything is still moving: an animation, or a Pulse that is playing (which
    // wants the very next frame, a frame's length away, whatever an animation says). A popup
    // border's breath alone asks for fewer frames (`frameMs`).
    const pulseBusyUntil = gated ? null : (build.pulse?.busyUntil(now) ?? null)
    scheduleFrame(pulseBusyUntil ?? live?.busyUntil ?? null, now, pulseBusyUntil === null ? live?.frameMs : undefined)
    if (frame.width !== lastFrame.width || frame.height !== lastFrame.height) {
      stdout.write(CLEAR)
      lastFrame = { width: frame.width, height: frame.height }
    }
    try {
      backend.present(frame)
    } catch (error) {
      failure = error
      log.log("session.error", { where: "render", message: messageOf(error) })
      leave()
    }
  }

  function onResize(): void {
    const size = terminalSize()
    if (size.columns !== loggedSize.columns || size.rows !== loggedSize.rows) {
      loggedSize = size
      log.log("session.resize", { columns: size.columns, rows: size.rows })
    }
    const wasGated = gated
    gated = isGated(size, context.grid)
    // A Nexus Pulse holds still while the terminal is too small to draw it, and resumes from the same
    // instant (engine.md 9.6). No frame timer runs behind the gate, so nothing would tell the Pulse the
    // time had passed: the moment the gate closes or opens, the clock is moved on without the Pulse.
    if (wasGated || gated) build.advance(clock(), true)
    if (!gated) {
      layout = buildLayout(size, context.grid)
      build.resize(layout.viewport)
      animation.snap(build.state, clock())
    }
    render()
  }

  // **Key releases, where the terminal reports them** (the Key releases Experiment; the owner's third
  // round, 2026-09-30, F79). On `auto` the screen asks the terminal whether it speaks the kitty keyboard
  // protocol and, if it answers, pushes the flags that make it mark every key as a press, a repeat or a
  // release — so a tap is known to be a tap and a hold a hold (`src/build/motion.ts`). On `off`, or with
  // no answer, nothing is pushed and timing decides, as before. Changed in Settings, it applies at once.
  // **The flags are popped on every way out**, through the one disposer below — a terminal left in this
  // mode would send the shell `ESC [ 99 ; 5 u` for Ctrl+C.
  const protocol = new KeyboardProtocol()
  function syncKeyProtocol(): void {
    if (leaving) return
    const bytes = protocol.want(build.state.experiments.keyReleases === "auto")
    if (bytes !== "") stdout.write(bytes)
    build.setKeyReleases(protocol.active)
  }
  function hearReply(reply: TerminalReply): void {
    if (leaving) return
    const bytes = protocol.hear(reply)
    if (bytes !== "") stdout.write(bytes)
    build.setKeyReleases(protocol.active)
  }

  function handleKeys(keys: readonly string[], now: number): void {
    for (const key of keys) {
      if (leaving) break
      // The terminal's answers to the question above arrive as input; they are not keys, and they are
      // heard even behind the resize gate, where keys are not.
      const reply = terminalReplyOf(key)
      if (reply !== null) {
        hearReply(reply)
        continue
      }
      if (gated) continue
      const camera = animation.cameraAt(build.state, now, { reducedMotion: build.state.settings.reducedMotion })
      build.handleKey(key, layout, { now, camera })
    }
    // A key may have changed the Key releases Experiment.
    syncKeyProtocol()
  }

  function onData(data: string | Uint8Array): void {
    if (leaving) return
    const now = clock()
    const timeout = TUNING.escTimeoutMs
    if (escapeTimer !== null) clearTimeout(escapeTimer)
    escapeTimer = null
    handleKeys(reader.feed(chunkText(data), now, timeout), now)
    // A lone Esc (or any unfinished sequence) at the end of the read waits for the rest of itself;
    // when nothing comes, it is a key of its own.
    const deadline = reader.deadline(timeout)
    if (deadline !== null) {
      escapeTimer = setTimeout(() => {
        escapeTimer = null
        if (leaving) return
        handleKeys(reader.flush(), clock())
        render()
      }, Math.max(0, deadline - now))
    }
    render()
  }

  session.onDispose(() => {
    stdin.off("data", onData)
    if (frameTimer !== null) clearTimeout(frameTimer)
    if (escapeTimer !== null) clearTimeout(escapeTimer)
  })
  session.onDispose(() => {
    stdout.off("resize", onResize)
  })
  session.onSignal(leave)
  session.onDispose(() => {
    stdout.write(MOUSE_REPORTING_OFF)
  })
  // Before the backend leaves the alternate screen: the protocol keeps a stack of modes per screen.
  session.onDispose(() => {
    const pop = protocol.release()
    if (pop !== "") stdout.write(pop)
  })
  session.onDispose(() => pendingSave)
  session.onDispose(() => backend.stop())

  try {
    await backend.start()
    stdout.write(MOUSE_REPORTING_ON)
    stdin.on("data", onData)
    stdout.on("resize", onResize)
    // Asked once the answer has somewhere to arrive, and before the first frame, so the frame is the
    // last thing written while the screen waits for the player.
    syncKeyProtocol()
    onResize()
    await new Promise<void>((settle) => {
      settleSession = settle
    })
  } catch (error) {
    failure = error
  } finally {
    await dispose()
  }

  if (startKeysError !== null) {
    host.reportError(`terminal-nexus: --keys stopped early: ${startKeysError}\n`)
  }
  if (sideEffectError !== null) {
    host.reportError(`terminal-nexus: could not save settings or the export: ${String(sideEffectError)}\n`)
  }
  if (failure !== null) {
    host.reportError(`terminal-nexus --spike failed: ${String(failure)}\n`)
    return 1
  }
  return 0
}
