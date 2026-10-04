// A scripted playtest of the Build Phase: a campaign level's screen (`--at campaign?level=<id>&round=<n>`,
// PERIMETER's first round unless told otherwise), driven by a key script through the
// real adapters, with every step's frame kept. No terminal, no clock, no capture race — the frames are
// composed in-process by the very function the live screen presents (`composeBuildFrame`), so step N's
// frame is exactly what a player would see after pressing step N's key.
//
// `scripts/playtest.mjs` wraps this with a command line and turns frames into text, PNGs and a GIF.
// Another screen (the main menu, a `grid` battle) would get a sibling of this file with the same
// shape: take steps, return frames.

import { STARTER_START_CURSOR } from "../build/catalog.ts"
import { isGated } from "../build/camera.ts"
import type { BuildLayout } from "../build/layout.ts"
import { buildLayout } from "../build/layout.ts"
import { BuildSession } from "../view/build-session.ts"
import type { BuildContext, BuildState } from "../build/state.ts"
import { foresee, nextRound, startPulse } from "../cli/pulse-run.ts"
import type { MissionPlay } from "../cli/pulse-run.ts"
import { starterContext } from "../cli/starter.ts"
import { openRound } from "../cli/levels.ts"
import { BUILD_PHASE_ROUTE, parseRoute } from "../cli/route.ts"
import type { LevelDestination } from "../cli/route.ts"
import type { Coord } from "../grid/types.ts"
import { composeBuildFrame } from "../view/build.ts"
import type { ReadonlyCellFrame } from "../view/frame.ts"
import type { CapabilityMode } from "../view/roles.ts"
import type { Experiments } from "../build/experiments.ts"
import { DEFAULT_SETTINGS } from "../settings/types.ts"
import type { Settings } from "../settings/types.ts"
import type { GlyphPack } from "../view/theme.ts"
import type { Move } from "../build/motion.ts"
import type { ActivityLog } from "../log/activity.ts"
import { createActivityLog } from "../log/activity.ts"
import type { PlaytestStep } from "./keys.ts"
import { UNTIMED_GAP_MS, deliverStep } from "./deliver.ts"

export type BuildPlaytestOptions = Readonly<{
  steps: readonly PlaytestStep[]
  /** The terminal size. The acceptance floor, 80 x 24, unless said otherwise. */
  columns?: number
  rows?: number
  capability?: CapabilityMode
  glyphPack?: GlyphPack
  /** The player's settings to open with — an imported export's (`--settings`). `capability` and
   *  `glyphPack`, when given, win over these, as a command-line flag does. */
  settings?: Settings
  /** Experiments to open with instead of this build's defaults — an imported export's. */
  experiments?: Partial<Experiments>
  /**
   * The campaign level and round to open (`--at campaign?level=<id>&round=<n>`, `playtestOpening`): that round
   * as a player who builds nothing reaches it (`openRound`), the rounds before it played with this run's
   * settings and Experiments, and its rounds played on its own mission. PERIMETER's first round unless given;
   * `context` and `play`, when given, win.
   */
  at?: LevelDestination
  context?: BuildContext
  /** The mission the rounds are played on, when it is not the screen's own (PERIMETER): another mission's
   *  or a test map's `startPulse`, `nextRound` and, to see its raid's intent, `foresee` (`missionPlay`),
   *  with `context` its first round. */
  play?: Pick<MissionPlay, "startPulse" | "nextRound"> & Partial<Pick<MissionPlay, "foresee">>
  cursor?: Coord
  /**
   * Play a terminal that reports key presses, repeats and releases (the kitty keyboard protocol, which
   * the live loop asks for when the Key releases Experiment is on `auto`): a plain press is then known
   * to be a press, not guessed from timing. Defaults to on when the script has a phased step
   * (`Right/repeat`), and off otherwise — a classic terminal.
   */
  keyReleases?: boolean
  /** Whether a round that opens with a scene plays it in the dialog first, as the game does — on unless
   *  said otherwise, so a script starts where a player starts: PERIMETER's intro (`Esc` skips it). */
  scenes?: boolean
}>

export type PlaytestFrame = Readonly<{
  /** 0 is the screen as it opens, before any key; step N is the screen after the Nth step. */
  index: number
  /** The step's own name from the script, or "start". */
  label: string
  /** The exact bytes delivered for this step — what a terminal would have sent. */
  bytes: string
  state: BuildState
  frame: ReadonlyCellFrame
  /** What this step's cursor key did, as its kind and tiles (or rows) — `tap 1`, `tap 2`, `hold 1`,
   *  `hold 0` for a repeat the cadence dropped, `jump 10`, `release 0` — or `null` when the step was
   *  no cursor key. The playtest summary prints it. */
  moveKind: string | null
}>

export type BuildPlaytest = Readonly<{
  context: BuildContext
  layout: BuildLayout
  frames: readonly PlaytestFrame[]
  /**
   * What the run recorded in the Activity Logs — a log of its own, on the script's
   * clock, so its times are the steps' and two runs of one script log the same lines. The Activity logs
   * window shows it, and `scripts/playtest.mjs --activity` prints its export, so an agent sees what a
   * flow logged before asking a playtester to export it.
   */
  activity: ActivityLog
  /** Set when the script left the screen (`q`, or Esc with nothing armed); the steps after that one
   *  were not run, because there is no screen left for them to reach. */
  ended: Readonly<{ by: "quit"; atStep: number; skipped: number }> | null
}>

export { UNTIMED_GAP_MS } from "./deliver.ts"

/** This step's cursor key's move as the summary prints it, `tap 2` — `null` when the step made none:
 *  another key, a click or a wait (every cursor key's move is a new record, so an unchanged one is the
 *  last step's). */
function moveLabel(move: Move | null, before: Move | null): string | null {
  return move === null || move === before ? null : `${move.kind} ${move.tiles}`
}

export function runBuildPlaytest(options: BuildPlaytestOptions): BuildPlaytest {
  const base = options.settings ?? { ...DEFAULT_SETTINGS, capability: "truecolor" as const }
  const settings: Settings = {
    ...base,
    ...(options.capability === undefined ? {} : { capability: options.capability }),
    ...(options.glyphPack === undefined ? {} : { glyphPack: options.glyphPack }),
  }
  // A clock of the script's own: each step arrives `afterMs` after the one before, or a second after it
  // when the script does not say — long enough that every untimed key is a tap that starts over, so taps
  // only speed up, and a key only reads as held, where a script times its steps (`Right~250*3`). The
  // run's Activity Logs read it too, so a line's time is its step's.
  let clock = 0
  const activity = createActivityLog(() => clock)
  const opened =
    options.context ??
    (options.at === undefined
      ? starterContext()
      : openRound(options.at.level, options.at.round, undefined, {
          settings,
          ...(options.experiments === undefined ? {} : { experiments: options.experiments }),
        }))
  const play = options.play ?? options.at?.level.play
  const context: BuildContext = {
    ...opened,
    settings,
    exportDestination: "Not copied anywhere: this is a scripted playtest.",
    activity,
    activityExportDestination: "Not copied anywhere: this is a scripted playtest.",
    ...(options.experiments === undefined ? {} : { experiments: options.experiments }),
  }
  const terminal = { columns: options.columns ?? 80, rows: options.rows ?? 24 }
  // Below the floor the live screen shows its "terminal too small" notice instead of this one, so
  // a playtest there would be of a different screen.
  if (isGated(terminal, context.grid)) {
    throw new Error(`${terminal.columns}x${terminal.rows} is below the Build Phase's 80x24 floor`)
  }
  const layout = buildLayout(terminal, context.grid)

  let leftBy: "quit" | null = null
  const build = new BuildSession({
    context,
    cursor: options.cursor ?? STARTER_START_CURSOR,
    viewport: layout.viewport,
    onQuit: () => {
      leftBy = "quit"
    },
    startPulse: play?.startPulse ?? startPulse,
    activity,
    nextRound: play?.nextRound ?? nextRound,
    // Another mission's raid is its own to foresee: PERIMETER's is not drawn over it.
    ...(play === undefined ? { foresee } : play.foresee === undefined ? {} : { foresee: play.foresee }),
    scenes: options.scenes ?? true,
  })
  build.setKeyReleases(options.keyReleases ?? options.steps.some((step) => step.kind === "key" && step.phase !== undefined))

  // Drawn with the settings the script has reached: a step that changes the colour depth or the
  // symbols in Settings shows the change, as the live screen does.
  const compose = (): ReadonlyCellFrame => {
    // A Nexus Pulse on screen is drawn at the script's clock: the frame after a step shows the Pulse as it
    // is that long after it began. Nothing else on this screen depends on time in a scripted playtest.
    const pulse = build.pulseFrame(layout)
    const raid = build.raid()
    return composeBuildFrame(
      {
        // This round's: what stands on the map changes from round to round.
        context: build.round,
        state: build.state,
        layout,
        glyphPack: build.state.settings.glyphPack,
        reducedMotion: build.state.settings.reducedMotion,
        ...(pulse === undefined ? {} : { pulse }),
        ...(raid === undefined ? {} : { raid }),
      },
      build.state.settings.capability,
    )
  }

  const frames: PlaytestFrame[] = [{ index: 0, label: "start", bytes: "", state: build.state, frame: compose(), moveKind: null }]
  let ended: BuildPlaytest["ended"] = null

  for (const [position, step] of options.steps.entries()) {
    clock += step.afterMs ?? UNTIMED_GAP_MS
    const moveBefore = build.lastMove
    const bytes = deliverStep(build, layout, step, clock)
    // What the live loop's next render would do first: let a Nexus Pulse on screen catch up with the clock
    // (and, the moment it starts, look at the player's Nexus), so the frame is the one a player sees.
    build.advance(clock)
    frames.push({ index: position + 1, label: step.label, bytes, state: build.state, frame: compose(), moveKind: moveLabel(build.lastMove, moveBefore) })
    if (leftBy !== null) {
      ended = { by: leftBy, atStep: position + 1, skipped: options.steps.length - position - 1 }
      break
    }
  }

  return { context: build.round, layout, frames, ended, activity }
}

/**
 * The campaign level and round `--at <route>` names for a scripted playtest (`runBuildPlaytest`'s `at`). A
 * scripted playtest plays a campaign level's Build Phase, so a route to the title menu is refused, saying so;
 * a route that is not a place is refused with every problem (`RouteError`).
 */
export function playtestOpening(route: string): LevelDestination {
  const destination = parseRoute(route)
  if (destination.kind === "level") return destination
  throw new Error(
    `--at ${route} is on the title menu, and the scripted playtest plays a campaign level's Build Phase: ` +
      `try --at '${BUILD_PHASE_ROUTE}&round=2'`,
  )
}
