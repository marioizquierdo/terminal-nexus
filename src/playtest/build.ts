// A scripted playtest of the Build Phase: a story mission's screen (`--at story?mission=<id>&round=<n>`,
// PERIMETER's first round unless told otherwise) or a Skirmish's (`--at skirmish?seed=<n>`, `--load <file>`), driven
// by a key script through the
// real adapters, with every step's frame kept. No terminal, no clock, no capture race — the frames are
// composed in-process by the very function the live screen presents (`composeBuildFrame`), so step N's
// frame is exactly what a player would see after pressing step N's key.
//
// `scripts/playtest.mjs` wraps this with a command line and turns frames into text, PNGs and a GIF.
// Another screen (the main menu, a `grid` battle) would get a sibling of this file with the same
// shape: take steps, return frames.

import { STARTER_START_CURSOR } from "../build/catalog.ts"
import { isGated, visibleRange } from "../build/camera.ts"
import type { BuildLayout } from "../build/layout.ts"
import { buildLayout } from "../build/layout.ts"
import { BuildSession } from "../view/build-session.ts"
import type { BuildContext, BuildState } from "../build/state.ts"
import { nexusTile } from "../build/state.ts"
import type { MissionPlay } from "../cli/pulse-run.ts"
import { readLaunch } from "../cli/launch.ts"
import type { LaunchText } from "../cli/launch.ts"
import type { LevelPlay } from "../cli/levels.ts"
import { DEFAULT_LEVEL, openRound } from "../cli/levels.ts"
import { DEFAULT_LEVEL_ROUTE, RouteError, formatRoute } from "../cli/route.ts"
import type { LevelDestination } from "../cli/route.ts"
import { openSkirmish } from "../cli/skirmish-open.ts"
import { readGameFile, savesFolder, skirmishSaver } from "../cli/skirmish-files.ts"
import type { Profiles, Slot } from "../skirmish/save.ts"
import type { Noter } from "../cli/notes.ts"
import { noteOf, noteOpening, noteText, readNote } from "../cli/notes.ts"
import { terminalNoter } from "../cli/note-files.ts"
import type { NoteMoment, PressedCommand } from "../view/build-session.ts"
import { frameToText } from "../view/frame.ts"
import type { GameStart } from "./game.ts"
import type { Coord } from "../grid/types.ts"
import { composeBuildFrame } from "../view/build.ts"
import { hasTrail } from "../view/build-grid.ts"
import { BannerClock, RegroupClock, RoomClock, TrailClock } from "../view/build-live.ts"
import type { ReadonlyCellFrame } from "../view/frame.ts"
import type { ColorDepth } from "../view/roles.ts"
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
  colors?: ColorDepth
  glyphPack?: GlyphPack
  /** The player's settings to open with — an imported export's (`--settings`). `colors` and
   *  `glyphPack`, when given, win over these, as a command-line flag does. */
  settings?: Settings
  /** Experiments to open with instead of this build's defaults — an imported export's. */
  experiments?: Partial<Experiments>
  /**
   * The story level and round to open (`--at story?mission=<id>&round=<n>`, `playtestOpening`): that round
   * as a player who builds nothing reaches it (`openRound`), the rounds before it played with this run's
   * settings and Experiments, and its rounds played on its own mission. PERIMETER's first round unless given;
   * `context` and `play`, when given, win.
   */
  at?: LevelDestination
  context?: BuildContext
  /** The mission the rounds are played on, when it is not the level's own: another mission's or a test
   *  map's `startPulse`, `nextRound` and, to see its raid's intent, `foresee` (`missionPlay`), with
   *  `context` its first round. */
  play?: Pick<MissionPlay, "startPulse"> & Pick<LevelPlay, "nextRound"> & Partial<Pick<MissionPlay, "foresee" | "keep">> & Partial<Pick<LevelPlay, "resume">>
  /**
   * Where Save game writes a name with no folder of its own: the game's saves folder (`savesFolder`) unless given. A
   * name with a folder (`tmp/mine`) is written there, from the working folder, as the game writes it.
   */
  savesFolder?: string
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
  /** The run's Activity Logs and the clock they read, when a longer run (`./game.ts`) shares them across screens. */
  activity?: ActivityLog
  clock?: PlaytestClock
  /** A Skirmish's result's Setup screen chosen: the run goes on at the title menu's New game (`./game.ts`). Absent: the
   *  result offers no such row. */
  onSetup?: (context: BuildContext) => void
  /** What a note (`!`) is written with: the notes folder unless given (`terminalNoter`). */
  noter?: Noter
  /** A note's moment to open at (`--note`): its commands replayed at their times before the first frame. */
  replay?: Readonly<{ pressed: readonly PressedCommand[]; until: number }>
}>

/** The script's own clock, in milliseconds: shared by every screen a run passes through. */
export type PlaytestClock = { now: number }

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
  ended: Readonly<{ by: "quit" | "setup"; atStep: number; skipped: number }> | null
}>


/** This step's cursor key's move as the summary prints it, `tap 2` — `null` when the step made none:
 *  another key, a click or a wait (every cursor key's move is a new record, so an unchanged one is the
 *  last step's). */
function moveLabel(move: Move | null, before: Move | null): string | null {
  return move === null || move === before ? null : `${move.kind} ${move.tiles}`
}

export function runBuildPlaytest(options: BuildPlaytestOptions): BuildPlaytest {
  const driver = new BuildDriver(options)
  const frames: PlaytestFrame[] = [{ index: 0, label: "start", bytes: "", state: driver.build.state, frame: driver.compose(), moveKind: null }]
  let ended: BuildPlaytest["ended"] = null
  for (const [position, step] of options.steps.entries()) {
    frames.push({ index: position + 1, ...driver.step(step) })
    if (driver.leftBy !== null) {
      ended = { by: driver.leftBy, atStep: position + 1, skipped: options.steps.length - position - 1 }
      break
    }
  }
  return { context: driver.build.round, layout: driver.layout, frames, ended, activity: driver.activity }
}

/**
 * **A Build Phase driven a step at a time**: the session, its layout and the clocks a frame is drawn at, on the script's
 * clock. `runBuildPlaytest` runs a whole script through one; the game's playtest (`./game.ts`) runs one while the
 * script is on the Build Phase and hands the rest of the script on when it leaves.
 */
export class BuildDriver {
  readonly build: BuildSession
  readonly layout: BuildLayout
  readonly activity: ActivityLog
  readonly clock: PlaytestClock
  /** Set once the script left the screen: `q` (quit) or the result's Setup screen. */
  leftBy: "quit" | "setup" | null = null
  private readonly compose_: () => ReadonlyCellFrame

  constructor(options: BuildPlaytestOptions) {
    const base = options.settings ?? { ...DEFAULT_SETTINGS, colors: "truecolor" as const }
    const settings: Settings = {
      ...base,
      ...(options.colors === undefined ? {} : { colors: options.colors }),
      ...(options.glyphPack === undefined ? {} : { glyphPack: options.glyphPack }),
    }
    // A clock of the script's own: each step arrives `afterMs` after the one before, or a second after it
    // when the script does not say — long enough that every untimed key is a tap that starts over, so taps
    // only speed up, and a key only reads as held, where a script times its steps (`Right~250*3`). The
    // run's Activity Logs read it too, so a line's time is its step's.
    const clock: PlaytestClock = options.clock ?? { now: 0 }
    const activity = options.activity ?? createActivityLog(() => clock.now)
    this.clock = clock
    this.activity = activity
    const at: LevelDestination = options.at ?? { kind: "level", level: DEFAULT_LEVEL, round: 1 }
    const opened =
      options.context ??
      openRound(at.level, at.round, undefined, {
        settings,
        ...(options.experiments === undefined ? {} : { experiments: options.experiments }),
      })
    const play = options.play ?? at.level.play
    const saver = skirmishSaver(options.savesFolder ?? savesFolder())
    const noter = options.noter ?? terminalNoter()
    const context: BuildContext = {
      ...opened,
      settings,
      saveDestination: saver.destination,
      noteDestination: noter.destination,
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
    // Laid out as the live screen lays out a terminal of this size.
    const layout = buildLayout(terminal, context.grid)
    this.layout = layout

    const build = new BuildSession({
      context,
      cursor: options.cursor ?? nexusTile(context) ?? STARTER_START_CURSOR,
      viewport: layout.viewport,
      onQuit: () => {
        this.leftBy = "quit"
      },
      ...(options.onSetup === undefined
        ? {}
        : {
            onSetup: (round: BuildContext) => {
              this.leftBy = "setup"
              options.onSetup?.(round)
            },
          }),
      startPulse: play.startPulse,
      activity,
      nextRound: play.nextRound,
      ...(play.keep === undefined ? {} : { keep: play.keep }),
      ...(play.resume === undefined ? {} : { resume: play.resume }),
      onSave: saver.onSave,
      // Another mission's raid is its own to foresee: PERIMETER's is not drawn over it.
      ...(play.foresee === undefined ? {} : { foresee: play.foresee }),
      captureScreen: () => frameToText(this.compose()),
      onNote: (moment: NoteMoment) => {
        const screen = moment.screenText ?? frameToText(composeBuildFrame({ context: moment.screen.context, state: moment.screen.state, layout, glyphPack: moment.screen.state.settings.glyphPack, reducedMotion: true }, "monochrome"))
        const note = noteOf(moment, at.level, { build: "scripted playtest", screen, activity: activity.entries(), startedAt: activity.startedAt })
        return noter.write(noteText(note))
      },
      scenes: options.scenes ?? true,
    })
    this.build = build
    // The round opens on the script's clock now: a note's times count from here.
    build.advance(clock.now)
    // A note's moment: its commands at their times on the script's clock, which then reads the moment.
    if (options.replay !== undefined) {
      build.replay(options.replay.pressed, options.replay.until, clock.now)
      clock.now += options.replay.until
    }
    build.setKeyReleases(options.keyReleases ?? options.steps.some((step) => step.kind === "key" && step.phase !== undefined))

    // The raid's trail's clock, as the live loop keeps one, on the script's clock; and the survivors' regroup's.
    const trail = new TrailClock()
    const regrouping = new RegroupClock()
    const rooming = new RoomClock()
    // The battle banner's pulse and planting, on the script's clock too: `wait~MS` steps show the planting's ring.
    const bannering = new BannerClock()
    // Drawn with the settings the script has reached: a step that changes the colour depth or the
    // symbols in Settings shows the change, as the live screen does.
    this.compose_ = (): ReadonlyCellFrame => {
      // Three things are drawn at the script's clock. A Battle Round on screen: the frame after a step shows the
      // Pulse as it is that long after it began. The raid's trail, which moves from the first frame that drew
      // it moving, as the live loop moves it (`TrailClock`): the same keys draw it in the same place, and
      // `wait~MS` steps show it moving. And the survivors' regroup as a duel's round opens (`RegroupClock`), from the
      // first frame that showed the round, and the units walking out from under a building just planned (`RoomClock`). Nothing else on this screen depends on time in a scripted playtest.
      const pulse = build.pulseFrame()
      const raid = build.raid()
      const inView = hasTrail(raid, visibleRange(build.state.camera, build.state.viewport))
      const raidTrail = trail.at(build.state, clock.now, { reducedMotion: build.state.settings.reducedMotion, raidTrail: inView })
      const regroup = pulse === undefined ? regrouping.at(build.round.field, clock.now, build.state.settings.reducedMotion) : null
      const room = pulse === undefined ? rooming.at(build.state.planned, clock.now, build.state.settings.reducedMotion) : []
      const { until: _until, ...banner } = bannering.at(build.state, clock.now, build.state.settings.reducedMotion)
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
          ...(raidTrail === null ? {} : { raidTrail }),
          ...(regroup === null ? {} : { regroup }),
          ...(room.length === 0 ? {} : { room }),
          ...(banner.pulseMs === undefined && banner.dropMs === undefined ? {} : { banner }),
        },
        build.state.settings.colors,
      )
    }

  }

  /** The frame the screen shows now, at the script's clock. */
  compose(): ReadonlyCellFrame {
    return this.compose_()
  }

  /** One step through the real adapters, the clock moved on first; then what the live loop's next render would do
   *  first — let a Battle Round on screen catch up with the clock — so the frame is the one a player sees. */
  step(step: PlaytestStep): Omit<PlaytestFrame, "index"> {
    this.clock.now += step.afterMs ?? UNTIMED_GAP_MS
    const moveBefore = this.build.lastMove
    const bytes = deliverStep(this.build, this.layout, step, this.clock.now)
    this.build.advance(this.clock.now)
    return { label: step.label, bytes, state: this.build.state, frame: this.compose(), moveKind: moveLabel(this.build.lastMove, moveBefore) }
  }
}

/** The save the scripted playtest opens when told nowhere: a new battle on the Crossing, Vasse against Dob Hunter. */
export const PLAYTEST_SAVE = "saves/crossing-new.save.json"

/**
 * **Where the game's scripted playtest opens** (`./game.ts`): a title menu route (`menu`, `skirmish?setup=new`) as that
 * screen, or anything `playtestOpening` opens, as its Build Phase. Refused, with every problem said, as that is.
 */
export function gameOpening(
  text: LaunchText,
  keysFrom = "--keys",
  skirmish: Readonly<{ load?: string; note?: string; slots?: Partial<Record<Slot, string>>; now?: () => number; profiles?: Profiles }> = {},
): Readonly<{ start: GameStart; steps: readonly PlaytestStep[]; settings?: string }> {
  // A note: its moment, the settings it was played with unless a settings text is given, and the keys after it.
  if (skirmish.note !== undefined) {
    if (skirmish.load !== undefined || text.at !== undefined) throw new Error("--note opens a note's moment: no --at or --load beside it")
    const { note, problems } = readNote(readGameFile(skirmish.note), skirmish.profiles)
    if (note === null) throw new Error(`${skirmish.note} is not a note the game can open:\n  ${problems.join("\n  ")}`)
    const { launch, problems: keyProblems } = readLaunch({ keys: text.keys, settings: text.settings ?? note.settings }, DEFAULT_LEVEL_ROUTE)
    if (keyProblems.length > 0) throw new Error(keyProblems.map(({ error }) => `${keysFrom}: ${error.message}`).join("\n"))
    const opened = noteOpening(note, skirmish.profiles === undefined ? {} : { profiles: skirmish.profiles })
    const start: GameStart = opened.kind === "title" ? { kind: "title", place: opened.at.place } : { ...opened.at, replay: { pressed: opened.pressed, until: opened.until } }
    return { start, steps: launch.keys ?? [], ...(launch.settings === undefined ? {} : { settings: launch.settings }) }
  }
  if (skirmish.load === undefined && text.at !== undefined) {
    const { launch, problems } = readLaunch(text, DEFAULT_LEVEL_ROUTE)
    if (problems.length === 0 && launch.destination.kind === "title") {
      if (Object.keys(skirmish.slots ?? {}).length > 0) throw new Error("--p1 and --p2 name who plays a Skirmish's slots: try --load <file> or --at skirmish")
      const { settings, keys = [] } = launch
      return { start: { kind: "title", place: launch.destination.place }, steps: keys, ...(settings === undefined ? {} : { settings }) }
    }
  }
  // Told nowhere, the scripted playtest starts from a save, as testing the battle does (the Skirmish milestone): the
  // Crossing's new battle, Vasse against Dob Hunter, seed 7. A mission is opened by its route.
  const told = skirmish.load !== undefined || text.at !== undefined
  const opened = playtestOpening(text, keysFrom, told ? skirmish : { ...skirmish, load: PLAYTEST_SAVE })
  return { start: opened.at, steps: opened.steps, ...(opened.settings === undefined ? {} : { settings: opened.settings }) }
}

/**
 * Where a scripted playtest opens and what it starts from (`runBuildPlaytest`'s `at` and `steps`), read from its
 * command line's texts as the game reads its own (`src/cli/launch.ts`): PERIMETER's first round unless `at` names
 * another, or `skirmish.load` a save file (the game's `--load`), with `skirmish.slots` who plays each slot (`--p1`,
 * `--p2`). Refused, with every problem said, when the route is not a place, a key the script names does not exist
 * (`keysFrom` says where the script came from), the save cannot be opened, or the place is on the title menu: a
 * scripted playtest plays a Build Phase. `skirmish.now` is the clock a seedless `skirmish` takes its seed from.
 */
export function playtestOpening(
  text: LaunchText,
  keysFrom = "--keys",
  skirmish: Readonly<{ load?: string; slots?: Partial<Record<Slot, string>>; now?: () => number; profiles?: Profiles }> = {},
): Readonly<{ at: LevelDestination; steps: readonly PlaytestStep[]; settings?: string }> {
  if (skirmish.load !== undefined && text.at !== undefined) throw new Error("--load opens a save and --at a place: give one of them")
  const at = skirmish.load === undefined ? text.at : `skirmish?load=${encodeURIComponent(skirmish.load)}`
  const { launch, problems } = readLaunch({ ...text, at }, DEFAULT_LEVEL_ROUTE)
  if (problems.length > 0) {
    throw new Error(problems.map(({ error }) => (error instanceof RouteError ? `--at ${error.message}` : `${keysFrom}: ${error.message}`)).join("\n"))
  }
  const { destination, settings, keys = [] } = launch
  if (destination.kind === "title") {
    throw new Error(
      `--at ${formatRoute(destination)} is on the title menu, and the scripted playtest plays a Build Phase: ` +
        `try --at '${DEFAULT_LEVEL_ROUTE}&round=2' or --at 'skirmish?seed=1'`,
    )
  }
  const hasSlots = Object.keys(skirmish.slots ?? {}).length > 0
  if (destination.kind !== "skirmish") {
    if (hasSlots) throw new Error("--p1 and --p2 name who plays a Skirmish's slots: try --load <file> or --at skirmish")
    return { at: destination, steps: keys, ...(settings === undefined ? {} : { settings }) }
  }
  const opened = openSkirmish(destination, {
    readFile: readGameFile,
    ...(skirmish.slots === undefined ? {} : { slots: skirmish.slots }),
    ...(skirmish.now === undefined ? {} : { now: skirmish.now }),
    ...(skirmish.profiles === undefined ? {} : { profiles: skirmish.profiles }),
  })
  return { at: opened, steps: keys, ...(settings === undefined ? {} : { settings }) }
}
