// Vasse's voice in battle and her aura's reach on screen (the owner, on her voice in battle in the Commander's
// fourth round: "yes that is fantastic! let's experiment with this to see if it gets into the battle or
// enhances the experience even more. A little strategic usage of our effect library should go a long way here
// too"; and "Vasse should provide boost to nearby units").
//
// What is said when is planned from the resolved round (`src/view/pulse-voice.ts`): the moments read off a known
// event stream, at most a few lines a round with a quiet gap between them, her fall and the round won cutting in,
// the line picked by a hash of the moment's identity. It shows beside her on the map — the owner settled it there:
// "it looks cool when they "speak" during battle" — and in the panel while she is out of view, and none of it
// can change what resolves. Played through the real session on PERIMETER, the screen's clock handed in as a
// number.

import { test } from "node:test"
import assert from "node:assert/strict"
import { BARK_MOMENTS, BARK_ROOM, barkProblem, quoted } from "../src/armies/barks.ts"
import type { Barks } from "../src/armies/barks.ts"
import { ARMIES } from "../src/armies/index.ts"
import {
  STARTER_ALLOTMENT,
  STARTER_CATALOG,
  STARTER_NEXUS_DRAFT,
  STARTER_STANDING,
  STARTER_START_CURSOR,
  starterGrid,
} from "../src/build/catalog.ts"
import type { BuildContext } from "../src/build/state.ts"
import { cellForTile } from "../src/build/layout.ts"
import { missionPlay, nextRound, startPulse } from "../src/cli/pulse-run.ts"
import { starterContext } from "../src/cli/starter.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import type { DomainEvent } from "../src/events/types.ts"
import { footprintWithin } from "../src/grid/coords.ts"
import type { Coord } from "../src/grid/types.ts"
import { DEFAULT_SETTINGS } from "../src/settings/types.ts"
import { ACTIVITY_FILTERS, filteredEntries } from "../src/log/activity.ts"
import { hashState } from "../src/state/serialize.ts"
import type { EntityState, MatchState, PlayerId } from "../src/state/types.ts"
import type { BuildSession } from "../src/view/build-session.ts"
import { cellAt, frameToText } from "../src/view/frame.ts"
import type { ReadonlyCellFrame } from "../src/view/frame.ts"
import { AURA_WASH } from "../src/view/pulse-scene.ts"
import type { PulseFrame } from "../src/view/pulse-scene.ts"
import type { Moment, Speaker, SpokenLine } from "../src/view/pulse-voice.ts"
import { CUTS_IN, PRIORITY, VOICE, lineLength, pickLine, planVoice, speakerOf, voiceAt, voiceMoments } from "../src/view/pulse-voice.ts"
import { CAPABILITY_MODES } from "../src/view/roles.ts"
import type { CapabilityMode } from "../src/view/roles.ts"
import { MINIMUM, buildSide, compose, panelLines } from "./build-helpers.ts"
import type { BuildSide } from "./build-helpers.ts"
import { COMMANDER_FALLS } from "./commander-fixture.ts"

const VASSE = "unit.citizen.vasse"
const TICK_MS = 1000 / 12

// --- A known event stream ------------------------------------------------------------------------------------

/** An entity as far as the voice reads one: who, whose, what, where. */
const entity = (ordinal: number, player: PlayerId, contentId: string, anchor: Coord, hp = 10): EntityState =>
  ({ ordinal, id: `${player}:${contentId.split(".").at(-1)}#${ordinal + 1}`, player, contentId, hp, anchor }) as EntityState

/** States for ticks 0 to `last`, each holding the cast that is still standing at it (`gone`: ordinal -> the tick it
 *  went). Only `tick` and `entities` are read by the voice. */
function statesOf(cast: readonly EntityState[], gone: ReadonlyMap<number, number>, last: number): MatchState[] {
  return Array.from({ length: last + 1 }, (_, tick) => ({ tick, entities: cast.filter((each) => (gone.get(each.ordinal) ?? Number.POSITIVE_INFINITY) > tick) }) as unknown as MatchState)
}

/** A round on PERIMETER's content: her Grid Nexus, Vasse, a trooper beside her and one far off, a Barracks, a raider. */
const NEXUS = entity(0, "A", "structure.citizen.nexus", { x: 5, y: 10 }, 400)
const HER = entity(1, "A", VASSE, { x: 10, y: 10 }, 80)
const BESIDE = entity(2, "A", "unit.citizen.trooper", { x: 11, y: 10 })
const FAR = entity(3, "A", "unit.citizen.trooper", { x: 30, y: 30 })
const BARRACKS = entity(4, "A", "structure.citizen.barracks", { x: 14, y: 12 }, 100)
const RAIDER = entity(5, "B", "unit.ravel.raider", { x: 20, y: 10 })
const CAST = [NEXUS, HER, BESIDE, FAR, BARRACKS, RAIDER]

const spawned = (tick: number, who: EntityState, trainedBy?: string): DomainEvent => ({
  kind: "entity.spawned",
  tick,
  entity: who.id,
  ordinal: who.ordinal,
  player: who.player,
  contentId: who.contentId,
  at: who.anchor,
  hp: who.hp,
  ...(trainedBy === undefined ? {} : { trainedBy }),
})
const attack = (tick: number, from: EntityState, to: EntityState, ranged = false): DomainEvent => ({
  kind: "attack.launched",
  tick,
  attacker: from.id,
  attackerOrdinal: from.ordinal,
  target: to.id,
  targetOrdinal: to.ordinal,
  attackKind: ranged ? "ranged" : "melee",
  damage: 5,
  distance: 1,
  flightWindowTicks: ranged ? 3 : 0,
})
const hit = (tick: number, who: EntityState, hpBefore: number, hpAfter: number): DomainEvent => ({
  kind: "damage.applied",
  tick,
  entity: who.id,
  ordinal: who.ordinal,
  source: RAIDER.id,
  sourceOrdinal: RAIDER.ordinal,
  amount: hpBefore - hpAfter,
  hpBefore,
  hpAfter,
})
const died = (tick: number, who: EntityState): DomainEvent => ({
  kind: who.contentId.startsWith("structure.") ? "structure.destroyed" : "entity.died",
  tick,
  entity: who.id,
  ordinal: who.ordinal,
  player: who.player,
  contentId: who.contentId,
  at: who.anchor,
  killer: RAIDER.id,
})

/** Every moment, once, with what must not count beside each: a trained unit and an opening arrival are not the
 *  raid arriving, a unit falling far from her is not near her, a hit leaving her half her health is not badly
 *  hurt. She falls last, to a shot that lands three ticks after it is fired. */
function knownRound(): Readonly<{ timeline: Parameters<typeof voiceMoments>[0]; speaker: Speaker }> {
  const LATE = entity(6, "B", "unit.ravel.raider", { x: 25, y: 10 })
  const TRAINED = entity(7, "B", "unit.ravel.raider", { x: 26, y: 12 })
  const events: DomainEvent[] = [
    ...CAST.map((each) => spawned(0, each)),
    attack(6, RAIDER, BESIDE),
    attack(12, BESIDE, RAIDER),
    // A building of the raid's training is not the raid arriving; a group coming in seconds in is.
    spawned(20, TRAINED, "B:den#9"),
    spawned(24, LATE),
    died(30, FAR),
    died(36, BESIDE),
    died(48, BARRACKS),
    hit(54, HER, 80, 40),
    hit(60, HER, 40, 20),
    hit(66, NEXUS, 400, 395),
    attack(72, RAIDER, HER, true),
    hit(72, HER, 20, 0),
    died(72, HER),
  ]
  const gone = new Map([
    [FAR.ordinal, 30],
    [BESIDE.ordinal, 36],
    [BARRACKS.ordinal, 48],
    [HER.ordinal, 72],
  ])
  const timeline = { states: statesOf([...CAST, LATE, TRAINED], gone, 90), events, registry: FIXTURE_REGISTRY, ticksPerSecond: 12 }
  const speaker = speakerOf(timeline, () => ARMIES.commanders[0]?.barks ?? {})
  assert.ok(speaker !== null, "Vasse is not found to speak")
  return { timeline, speaker }
}

test("the moments she answers are read off the round's events, the first of each, when each shows on screen", () => {
  const { timeline, speaker } = knownRound()
  assert.equal(speaker.ordinal, HER.ordinal)
  assert.equal(speaker.name, "Vasse")
  // Near her is her aura's reach, read from the content.
  assert.equal(speaker.near, FIXTURE_REGISTRY.get(VASSE).aura?.radius)
  const moments = voiceMoments(timeline, speaker, { resultMs: 90 * TICK_MS, won: true })
  assert.deepEqual(
    moments.map((moment) => [moment.moment, Math.round(moment.atMs)]),
    [
      ["first-contact", 500],
      ["round-start", VOICE.startDelayMs],
      ["raid-arrives", 2000],
      ["unit-lost", 3000],
      ["building-lost", 4000],
      ["badly-hurt", 5000],
      ["nexus-hit", 5500],
      // Her fall shows when the shot that fells her lands, three ticks after it is fired.
      ["falls", Math.round(75 * TICK_MS)],
      ["round-won", Math.round(90 * TICK_MS + VOICE.wonDelayMs)],
    ],
  )
  // Every moment the armies can name is one the view can find.
  assert.deepEqual([...PRIORITY].sort(), [...BARK_MOMENTS].sort())
  // A round lost, or one she is not in, has no round-won and nothing at all.
  assert.ok(!voiceMoments(timeline, speaker, { resultMs: 90 * TICK_MS, won: false }).some((moment) => moment.moment === "round-won"))
  const without = { ...timeline, states: timeline.states.map((state) => ({ ...state, entities: state.entities.filter((each) => each.ordinal !== HER.ordinal) })) }
  assert.equal(speakerOf(without, () => ARMIES.commanders[0]?.barks ?? {}), null)
  // A Commander with nothing to say is not a speaker.
  assert.equal(speakerOf(timeline, () => ({})), null)
})

// --- What she says, and when ---------------------------------------------------------------------------------

/** Lines of one short sentence for every moment, so each line's length is known: "A." takes `SHORT` ms. */
const SHORT_LINES: Barks = Object.fromEntries(BARK_MOMENTS.map((moment) => [moment, ["A."]]))
const SHORT = lineLength("A.").totalMs
const at = (moment: Moment["moment"], atMs: number): Moment => ({ moment, atMs })
const plan = (moments: readonly Moment[], round = 1): SpokenLine[] => planVoice(moments, SHORT_LINES, { round, cosmeticSeed: 7 })
const said = (lines: readonly SpokenLine[]): Array<[string, number, number]> => lines.map((line) => [line.moment, Math.round(line.startMs), Math.round(line.endMs)])

test("she does not chatter: a quiet gap between two lines, the one that matters more said, and a few lines a round at most", () => {
  // Two moments a second apart: the arrival matters more, so it is said and the first shot is not — it could
  // only come after the arrival's line and its gap, long after it happened.
  assert.deepEqual(said(plan([at("first-contact", 1000), at("raid-arrives", 2000)])), [["raid-arrives", 2000, 2000 + SHORT]])
  // A moment that comes while a line is still being said waits for the gap, if it can come soon enough after.
  const soon = SHORT + VOICE.gapMs - VOICE.patienceMs / 2
  assert.deepEqual(said(plan([at("raid-arrives", 0), at("first-contact", soon)])), [
    ["raid-arrives", 0, SHORT],
    ["first-contact", SHORT + VOICE.gapMs, SHORT + VOICE.gapMs + SHORT],
  ])
  // Far apart, every moment has room, but no more than `perRound` lines are said: the ones that matter most.
  const spread = (["round-start", "first-contact", "raid-arrives", "unit-lost", "building-lost", "badly-hurt", "nexus-hit"] as const).map((moment, index) =>
    at(moment, index * 10_000),
  )
  assert.deepEqual(
    plan(spread).map((line) => line.moment),
    ["building-lost", "badly-hurt", "nexus-hit"],
  )
  assert.equal(plan(spread).length, VOICE.perRound)
  // Any two lines that do not cut in are a gap apart, in a long round full of moments.
  const busy = plan(spread.map((moment, index) => at(moment.moment, index * 1500)))
  for (let index = 1; index < busy.length; index += 1) {
    assert.ok((busy[index] as SpokenLine).startMs >= (busy[index - 1] as SpokenLine).endMs + VOICE.gapMs, "two lines are closer than the gap")
  }
})

test("her fall and the round won cut in: whatever is showing ends where they begin, and nothing comes after her fall", () => {
  // The first shot's line is still being read when she falls: it ends where her last words begin. After her
  // fall she says nothing more, the round won included.
  const fell = plan([at("first-contact", 1000), at("falls", 2500), at("raid-arrives", 9000), at("round-won", 12_000)])
  assert.deepEqual(said(fell), [
    ["first-contact", 1000, 2500],
    ["falls", 2500, 2500 + SHORT],
  ])
  assert.deepEqual(
    fell.map((line) => line.cutIn),
    [false, true],
  )
  // Cut, not thinned out: it is whole to its last frame.
  assert.equal(voiceAt(fell, 2499, false)?.fading, false)
  // A line her fall would cut before it could be read is not begun at all: a flicker says nothing.
  assert.deepEqual(
    plan([at("first-contact", 1000), at("falls", 1000 + VOICE.minShownMs - 1)]).map((line) => line.moment),
    ["falls"],
  )
  // The round won comes whatever the gap and the count: right after another line, and as a fourth.
  const won = plan([at("raid-arrives", 1000), at("unit-lost", 9000), at("building-lost", 17_000), at("round-won", 17_000 + SHORT + 100)])
  assert.deepEqual(
    won.map((line) => line.moment),
    ["raid-arrives", "unit-lost", "building-lost", "round-won"],
  )
  assert.ok([...CUTS_IN].every((moment) => PRIORITY.indexOf(moment) < 2), "the moments that cut in are not the ones that matter most")
  // A moment with no lines is a moment she stays quiet at.
  assert.deepEqual(planVoice([at("round-start", 800)], { falls: ["A."] }, { round: 1, cosmeticSeed: 7 }), [])
})

test("which line she says is a hash of the moment's identity: the same every time, and another line the next round", () => {
  const lines = ["One.", "Two.", "Three."]
  for (const moment of BARK_MOMENTS) {
    const picks = [1, 2, 3, 4].map((round) => pickLine(lines, moment, round, 7))
    // The same moment of the same round always says the same line, however often it is asked.
    assert.deepEqual(picks, [1, 2, 3, 4].map((round) => pickLine(lines, moment, round, 7)))
    // Two rounds running never say the same line at the same moment.
    for (let index = 1; index < picks.length; index += 1) assert.notEqual(picks[index], picks[index - 1], moment)
  }
  // The cosmetic seed moves where each moment starts in its list — the view's own seed, never the kernel's.
  const seeded = (seed: number): string[] => BARK_MOMENTS.map((moment) => pickLine(lines, moment, 1, seed))
  assert.notDeepEqual(seeded(7), seeded(8))
})

// --- On screen, through the real session ------------------------------------------------------------------

/** PERIMETER's first round, the Nexus power picked and nothing built, its Pulse started and its clock at zero —
 *  Vasse with her own lines, or, `silent`, with none at all: the test's own way to quiet her, since the player
 *  has no switch for it. */
function perimeter(extra: Partial<BuildContext> = {}, silent = false): BuildSide {
  const side = buildSide({
    context: starterContext(undefined, extra),
    cursor: STARTER_START_CURSOR,
    startPulse,
    nextRound,
    ...(silent ? { barksOf: (): Barks => ({}) } : {}),
  })
  side.build.dispatch({ kind: "pick-nexus", index: 0 })
  side.build.run([{ kind: "open-battle-round" }, { kind: "start-pulse" }])
  assert.ok(side.build.pulse !== null, "the round's Pulse did not start")
  side.build.advance(0)
  return side
}

/** What she says this round, as planned. */
const spokenIn = (build: BuildSession): readonly SpokenLine[] => build.pulse?.spoken ?? []

/** The map's rows, the panel cut away; the panel's, the map cut away. */
const mapOf = (frame: ReadonlyCellFrame, side: BuildSide): string =>
  frameToText(frame)
    .split("\n")
    .map((line) => line.slice(side.layout.dividerColumn + 1, side.layout.gridBox.right))
    .join("\n")
const panelOf = (frame: ReadonlyCellFrame, side: BuildSide): string => panelLines(side, frame).map((line) => line.trim()).join("\n")

/** The first line of the round, whole on screen: typed in, and not yet thinning out. */
function firstLineShowing(side: BuildSide): SpokenLine {
  const line = spokenIn(side.build)[0]
  assert.ok(line !== undefined, "she says nothing in PERIMETER's first round")
  side.build.advance(line.startMs + lineLength(line.text).typeMs + 50)
  return line
}

test("PERIMETER's first round: she speaks a few times, in order, each line hers, and the raid breaking last when it breaks", () => {
  const side = perimeter()
  const spoken = spokenIn(side.build)
  assert.ok(spoken.length >= 2 && spoken.length <= VOICE.perRound + CUTS_IN.size, `she says ${spoken.length} lines`)
  const barks = ARMIES.commanders.find((commander) => commander.unit === VASSE)?.barks ?? {}
  for (const [index, line] of spoken.entries()) {
    assert.ok(barks[line.moment]?.includes(line.text), `"${line.text}" is not one of her lines for ${line.moment}`)
    if (index > 0) assert.ok(line.startMs >= (spoken[index - 1] as SpokenLine).endMs, "two lines at once")
  }
  if (side.build.pulse?.resolved.timeline.states.at(-1)?.outcome?.winner === "A") assert.equal(spoken.at(-1)?.moment, "round-won")
})

test("beside her: the line on the map, a few rows from her and whole, and the panel keeps only the feed", () => {
  const side = perimeter()
  const line = firstLineShowing(side)
  const frame = compose(side)
  const words = quoted(line.text)
  const map = mapOf(frame, side)
  const panel = panelOf(frame, side)
  // On the map, a few rows from hers (she may have stepped since it began), whole — clear of what stands there.
  assert.ok(map.includes(words), `the line is not on the map:\n${map}`)
  assert.ok(!panel.includes("@ VASSE"), "the line is in the panel too")
  assert.match(panel, /RECENT/)
  const rows = map.split("\n")
  const lineRow = rows.findIndex((row) => row.includes(words))
  const herRow = rows.findIndex((row) => row.includes("@"))
  assert.ok(herRow >= 0 && lineRow !== herRow && Math.abs(lineRow - herRow) <= 5, `the line is ${lineRow - herRow} rows from her`)
})

test("beside her, out of view: the words go to the panel under the feed, so a line is never lost to the camera", () => {
  const side = perimeter()
  const line = firstLineShowing(side)
  // The view slides to the far corner of the map, away from her and the base.
  side.build.dispatch({ kind: "look-at", x: 95, y: 39 })
  const frame = compose(side)
  const panel = panelOf(frame, side)
  // Under the feed: her glyph and name, as the dialog titles her, then the words, quoted, wrapped.
  assert.match(panel, /RECENT/)
  assert.ok(panel.includes("@ VASSE"), `no name in the panel:\n${panel}`)
  assert.ok(panel.replace(/\n/g, " ").includes(quoted(line.text)), "her line is lost while she is out of view")
  assert.ok(!mapOf(frame, side).includes(quoted(line.text)))
})

/** The cell her line opens on, beside her on the map: the first opening quote in the map's cells. */
function openingQuote(side: BuildSide, frame: ReadonlyCellFrame): ReturnType<typeof cellAt> {
  const { layout } = side
  for (let y = layout.origin.row; y < layout.origin.row + layout.viewport.height; y += 1) {
    for (let x = layout.origin.column; x < layout.origin.column + layout.viewport.width; x += 1) {
      if (cellAt(frame, x, y).glyph === '"') return cellAt(frame, x, y)
    }
  }
  assert.fail("her line is not on the map")
}

test("she types her line in beside her, holds it, and it thins out before it goes; reduced motion shows it whole and steady", () => {
  const side = perimeter()
  const line = spokenIn(side.build)[0]
  assert.ok(line !== undefined)
  const words = quoted(line.text)
  const shown = (): string => mapOf(compose(side), side)
  side.build.advance(line.startMs + 1)
  assert.ok(!shown().includes(words) && shown().includes('"'), "the line did not type in")
  side.build.advance(line.startMs + lineLength(line.text).typeMs + 1)
  assert.ok(shown().includes(words))
  assert.equal(openingQuote(side, compose(side)).style.bold, true, "the line is not bold while it is read")
  // Thinning out: drawn dim in its last moments, then gone.
  side.build.advance(line.endMs - 100)
  assert.equal(openingQuote(side, compose(side)).style.dim, true, "the line does not thin out")
  side.build.advance(line.endMs + 1)
  assert.ok(!shown().includes(words), "the line outstays its time")

  // Reduced motion: the whole line from its first frame to its last, never dim; the light on her is the steady one.
  const still = perimeter({ settings: { ...DEFAULT_SETTINGS, reducedMotion: true } })
  const first = spokenIn(still.build)[0]
  assert.ok(first !== undefined)
  still.build.advance(first.startMs + 1)
  assert.ok(mapOf(compose(still), still).includes(quoted(first.text)), "reduced motion types the line in")
  still.build.advance(first.endMs - 1)
  assert.notEqual(openingQuote(still, compose(still)).style.dim, true, "reduced motion fades the line")
})

/** The Pulse frame the session hands the composer right now. */
const pulseFrameOf = (side: BuildSide): PulseFrame => {
  const frame = side.build.pulseFrame()
  assert.ok(frame !== undefined)
  return frame
}

test("a light on her marks the moment she speaks: the effect library's own, on her tile, and none when she has nothing to say", () => {
  const side = perimeter()
  const line = spokenIn(side.build)[0]
  assert.ok(line !== undefined)
  side.build.advance(line.startMs + 50)
  const frame = pulseFrameOf(side)
  const lights = frame.sample.effects.filter((effect) => effect.instance.recipe === "fx.light.flash")
  assert.equal(lights.length, 1, "no light on her as she speaks")
  assert.deepEqual(lights[0]?.instance.origin, frame.voice?.at)
  // Shading: glyphless, so her @ keeps its glyph — and gone a moment later.
  assert.ok(lights[0]?.cells.every((cell) => cell.glyph === ""))
  side.build.advance(line.startMs + VOICE.lightMs + 1)
  assert.ok(!pulseFrameOf(side).sample.effects.some((effect) => effect.instance.recipe === "fx.light.flash"))
  // The light belongs to her words, not to her standing there: a Commander with no lines is never lit.
  const silent = perimeter({}, true)
  assert.deepEqual(spokenIn(silent.build), [])
  silent.build.advance(line.startMs + 50)
  assert.ok(!pulseFrameOf(silent).sample.effects.some((effect) => effect.instance.recipe === "fx.light.flash"), "a light with nothing said")
  assert.equal(pulseFrameOf(silent).voice, undefined)
})

test("her voice changes nothing that resolves: the same round, the same states, events and Recall whether she speaks or not", () => {
  const sides = [perimeter(), perimeter({}, true)]
  const fingerprint = (side: BuildSide) => {
    const resolved = side.build.pulse?.resolved
    assert.ok(resolved !== undefined)
    return [resolved.timeline.stateHash, resolved.timeline.eventsHash, hashState(resolved.recall.state)]
  }
  const [heard, silent] = sides.map(fingerprint)
  assert.deepEqual(silent, heard)
  assert.ok(spokenIn((sides[0] as BuildSide).build).length > 0, "she says nothing, so nothing is compared")
  // And played to its end, the round goes on to the same next round either way.
  for (const side of sides) side.build.advance((side.build.pulse?.times.homeMs ?? 0) + 4000)
  const next = sides.map((side) => {
    side.build.dispatch({ kind: "next-round" })
    return JSON.stringify(side.build.round.field ?? [])
  })
  assert.equal(new Set(next).size, 1, "what she said changed what the next round opens on")
})

test("the Activity Logs record what she said and when, once a line, and where it showed: beside her, or in the panel while she was out of view", () => {
  const lines = (side: BuildSide) => side.activity.entries().filter((entry) => entry.event === "voice.line").map((entry) => entry.props)
  const side = perimeter()
  const end = side.build.pulse?.times.homeMs ?? 0
  for (let ms = 0; ms <= end + 3000; ms += 250) side.build.advance(ms)
  const spoken = spokenIn(side.build)
  assert.deepEqual(
    lines(side),
    spoken.map((line) => ({ speaker: "Vasse", round: 1, second: Math.round(line.startMs / 100) / 10, moment: line.moment, line: line.text, shown: "beside" })),
  )
  // Watching it again says it all again on screen, and records nothing new.
  side.build.dispatch({ kind: "pulse", control: "restart" })
  for (let ms = end + 3250; ms <= 2 * end + 6000; ms += 250) side.build.advance(ms)
  assert.equal(lines(side).length, spoken.length)
  // With the view far from her as a line begins, it was shown in the panel, and is recorded so.
  const away = perimeter()
  away.build.dispatch({ kind: "look-at", x: 95, y: 39 })
  for (let ms = 0; ms <= end + 3000; ms += 250) away.build.advance(ms)
  assert.equal(lines(away)[0]?.["shown"], "panel")
  // The game's other filters still carry her lines: what the player did and what the game said.
  const interactions = ACTIVITY_FILTERS.find((filter) => filter.name === "Interactions")
  assert.ok(interactions !== undefined)
  assert.equal(filteredEntries(side.activity.entries(), interactions).filter((entry) => entry.event === "voice.line").length, spoken.length)
})

// --- At the floor --------------------------------------------------------------------------------------------

test("at 80 x 24: the room the armies' lines are checked against is the screen's, and every line she has fits it", () => {
  const side = perimeter()
  assert.deepEqual([side.layout.frame.width, side.layout.frame.height], [MINIMUM.columns, MINIMUM.rows])
  // The panel's prose width, one column in from the divider; the map's width, a column a tile.
  assert.equal(side.layout.panelLimit - 1, BARK_ROOM.panelColumns)
  assert.equal(side.layout.viewport.width, BARK_ROOM.mapColumns)
  // Her lines: a few for every moment, each fitting both places, none saying a word the game no longer uses.
  const barks = ARMIES.commanders.find((commander) => commander.unit === VASSE)?.barks ?? {}
  assert.deepEqual(Object.keys(barks).sort(), [...BARK_MOMENTS].sort())
  for (const [moment, lines] of Object.entries(barks)) {
    assert.ok((lines?.length ?? 0) >= 3, `${moment} has fewer than three lines`)
    for (const line of lines ?? []) {
      assert.equal(barkProblem(line), null, line)
      assert.doesNotMatch(line, /\b(pulse|wave)s?\b/i, line)
      const words = line.split(" ").length
      assert.ok(words >= 3 && words <= 8, `"${line}" is ${words} words: a bark is three to eight`)
    }
  }
})

// A whole round's frames twice over: its cost grows with the round, so Bun's per-test limit is lifted.
test("at 80 x 24, her line in the panel stops above the controls, and beside her it stays on the map", { timeout: 120_000 }, () => {
  for (const away of [true, false]) {
    const side = perimeter()
    // Looking far from her, her lines go to the panel until the view comes back for the round's last seconds.
    if (away) side.build.dispatch({ kind: "look-at", x: 95, y: 39 })
    const end = side.build.pulse?.times.homeMs ?? 0
    for (let ms = 0; ms <= end + 3000; ms += 150) {
      side.build.advance(ms)
      const frame = compose(side)
      const text = frameToText(frame).split("\n")
      // The controls are where they always are, whole.
      const controls = text.slice(side.layout.panelLastRow - 1, side.layout.panelLastRow + 1).map((row) => row.slice(side.layout.panelColumn, side.layout.dividerColumn).trim())
      assert.match(controls[0] ?? "", /^\[(space|enter)\] (Pause|Resume|Next round)$/, `at ${ms} ms the controls read "${controls[0]}"`)
      assert.match(controls[1] ?? "", /^\[r\] Watch again$/)
      // The frame's own lines are untouched: the map's border and the panel's divider.
      for (let row = side.layout.gridBox.top; row <= side.layout.gridBox.bottom; row += 1) {
        assert.match(text[row]?.[side.layout.gridBox.right] ?? "", /[|+]/, `at ${ms} ms something covers the map's east side`)
        assert.match(text[row]?.[side.layout.dividerColumn] ?? "", /[|+]/, `at ${ms} ms something covers the divider`)
      }
    }
  }
})

// --- Her aura's reach ----------------------------------------------------------------------------------------

test("her aura's reach: a diamond of the content's radius around her, washed on the ground under everything, while the fight is on", () => {
  // Silent, so no line of hers is drawn over the ground her aura reaches.
  const side = perimeter({}, true)
  side.build.advance(2000)
  const pulse = pulseFrameOf(side)
  const aura = pulse.aura
  assert.ok(aura !== undefined, "no aura while the fight is on")
  assert.equal(aura.radius, FIXTURE_REGISTRY.get(VASSE).aura?.radius)
  const her = pulse.sample.state.entities.find((each) => each.contentId === VASSE)
  assert.ok(her !== undefined)
  assert.deepEqual(aura.at, pulse.positions.get(her.ordinal), "the reach does not move with her as she is drawn")
  const frame = compose(side, {}, "truecolor")
  const washed = (cell: Coord): boolean => {
    const style = cellAt(frame, cell.x, cell.y).style
    return style.seeThrough?.role === "player.a" && style.seeThrough.alpha === AURA_WASH
  }
  const camera = side.build.state.camera
  const cellOf = (tile: Coord): Coord => cellForTile(side.layout, camera, tile)
  const key = (tile: Coord): string => `${tile.x},${tile.y}`
  // What stands, and what an effect is drawing a glyph on: both are drawn over the ground, wash and all.
  const covered = new Set([
    ...pulse.sample.state.entities.flatMap((each) => {
      const anchor = pulse.positions.get(each.ordinal) ?? each.anchor
      return FIXTURE_REGISTRY.get(each.contentId).footprint.map((offset) => key({ x: anchor.x + offset.x, y: anchor.y + offset.y }))
    }),
    ...pulse.sample.effects.flatMap((effect) => effect.cells.filter((cell) => cell.glyph !== "").map((cell) => key(cell.tile))),
    key(side.build.state.cursor),
  ])
  let lit = 0
  const { at: centre, radius } = aura
  for (let dy = -radius - 1; dy <= radius + 1; dy += 1) {
    for (let dx = -radius - 1; dx <= radius + 1; dx += 1) {
      const tile: Coord = { x: centre.x + dx, y: centre.y + dy }
      // In reach as range is measured: a row counts two columns, so the diamond is twice as wide as it is tall.
      const inside = footprintWithin(centre, [{ x: 0, y: 0 }], tile, [{ x: 0, y: 0 }], radius)
      if (covered.has(key(tile))) {
        // A unit in her reach keeps every colour of its own: it stands in the glow, untinted.
        if (pulse.sample.state.entities.some((each) => key(pulse.positions.get(each.ordinal) ?? each.anchor) === key(tile))) {
          assert.equal(washed(cellOf(tile)), false, `the unit at ${key(tile)} is washed`)
        }
        continue
      }
      assert.equal(washed(cellOf(tile)), inside, `${key(tile)} is ${inside ? "in reach and not" : "out of reach and"} washed`)
      if (inside) lit += 1
    }
  }
  assert.ok(lit > 5, "the reach is barely drawn")
  // A glyphless write: every tier shows the same glyphs with the aura as without it.
  const { aura: _aura, ...withoutAura } = pulse
  for (const capability of CAPABILITY_MODES) {
    assert.equal(frameToText(compose(side, {}, capability)), frameToText(compose(side, { pulse: withoutAura }, capability)))
  }
  // Gone at cease fire: it guards a fight, and the walk home is not one.
  side.build.advance((side.build.pulse?.times.stopMs ?? 0) + 10)
  assert.equal(pulseFrameOf(side).aura, undefined)
})

test("her aura goes when she falls, and so does every line but her last words", () => {
  // The Commander's cadence level: she stands alone out in front, and the ambush beside her fells her in round 1.
  const play = missionPlay(COMMANDER_FALLS)
  const context = play.firstRound({
    grid: starterGrid(),
    registry: FIXTURE_REGISTRY,
    catalog: STARTER_CATALOG,
    standing: STARTER_STANDING,
    allotment: STARTER_ALLOTMENT,
    nexusDraft: STARTER_NEXUS_DRAFT,
  })
  const side = buildSide({ context, cursor: STARTER_START_CURSOR, startPulse: play.startPulse, nextRound: play.nextRound })
  side.build.dispatch({ kind: "pick-nexus", index: 0 })
  side.build.run([{ kind: "open-battle-round" }, { kind: "start-pulse" }])
  side.build.advance(0)
  const spoken = spokenIn(side.build)
  const last = spoken.at(-1)
  assert.ok(last !== undefined && last.moment === "falls", `her last line is not her last words: ${spoken.map((line) => line.moment).join(", ")}`)
  side.build.advance(last.startMs + lineLength(last.text).typeMs + 50)
  const pulse = pulseFrameOf(side)
  assert.equal(pulse.aura, undefined, "her aura outlives her")
  // Her last words are said where she fell, and no light marks them: she is gone from the tile.
  assert.equal(pulse.voice?.text, last.text)
  assert.ok(!pulse.sample.effects.some((effect) => effect.instance.recipe === "fx.light.flash"))
  for (const capability of ["monochrome", "truecolor"] as const satisfies readonly CapabilityMode[]) {
    assert.ok(mapOf(compose(side, {}, capability), side).includes(quoted(last.text)))
  }
})
