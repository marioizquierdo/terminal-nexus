// **Her voice in battle**: what Vasse says during a Battle Round, worked out from the round the kernel has
// already resolved (the owner, 2026-10-04, on her voice in battle: "yes that is fantastic! let's experiment with
// this to see if it gets into the battle or enhances the experience even more. A little strategic usage of our
// effect library should go a long way here too"; and once he had played it: "it looks cool when they "speak"
// during battle").
//
// Presentation, all of it, on the three-worlds line. The moments she answers are read off the round's events
// and states, as every effect is (`effects/derive.ts`); her lines are data in her army, found by her unit's id
// (`armies/vasse/army.json`, `src/armies/barks.ts`); which of a moment's lines she says is cosmetic randomness —
// a hash of the moment's identity (`effects/random.ts`), never a stream, so the gameplay generator and her voice
// can never touch. Nothing here can reach a state, an event or a hash: a round resolves identically whether she
// says anything or not.
//
// **She must not chatter.** The whole round is known before its first frame, so its lines are planned at once,
// the way the ending counts down to a stop it already knows:
//
//   - each moment at most once a round, and at most `VOICE.perRound` lines a round besides the two that cut in,
//     the moments that matter most chosen first (`PRIORITY`);
//   - a quiet gap of `VOICE.gapMs` between two of those, and a line that finds no room soon after its moment
//     (`VOICE.patienceMs`) is not said at all: a late reaction reads wrong;
//   - two moments cut in, whatever is showing: she falls (her last words), and the round is won. A line being
//     read when one comes ends there, and one that would be cut before it could be read (`VOICE.minShownMs`)
//     is not begun;
//   - nothing once she has fallen, and nothing in a round she sits out.
//
// A line types in, holds long enough to read, and thins out (dim) before it goes; reduced motion shows it whole
// for as long. It shows beside her on the map, and in the side panel whenever she or her line's place is out of
// view; the scene draws it (`pulse-scene.ts`), and the presenter (`pulse-live.ts`) asks this file what is said
// when.

import type { BarkMoment, Barks } from "../armies/barks.ts"
import { barkMapWidth, quoted } from "../armies/barks.ts"
import { ARMIES } from "../armies/index.ts"
import type { ContentRegistry } from "../content/index.ts"
import { commanderName } from "../content/cards.ts"
import type { DomainEvent } from "../events/types.ts"
import { footprintWithin, tilesOf } from "../grid/coords.ts"
import type { Coord, Footprint } from "../grid/types.ts"
import type { EntityState, MatchState, PlayerId } from "../state/types.ts"
import { buildFlightHoldTicks, flightHoldTicks } from "./effects/derive.ts"
import { cosmeticHash } from "./effects/random.ts"
import type { EffectInstance } from "./effects/types.ts"
import { battleMeasure } from "./snapshot.ts"

/**
 * Her voice's numbers: first guesses, watched on PERIMETER's rounds rather than measured, kept here beside the
 * code that reads them until the owner says how the voice feels.
 */
export const VOICE = {
  /** The start of a round's line comes a beat in, once the view has settled on the Nexus. */
  startDelayMs: 800,
  /** The round-won line comes a beat after the result stands. */
  wonDelayMs: 300,
  /** A line types in at this many milliseconds a character, never for longer than `typeMaxMs`. */
  typeMsPerChar: 30,
  typeMaxMs: 700,
  /** Then holds this long a character to be read in a busy fight, never less than `readMinMs`. */
  readMsPerChar: 55,
  readMinMs: 1600,
  /** And thins out — dim — for this long before it goes. */
  decayMs: 400,
  /** The quiet between two lines that do not cut in. */
  gapMs: 3500,
  /** How late after its moment a line may still come, when an earlier one is still being said. */
  patienceMs: 1200,
  /** How long a line must have been on screen before a moment that cuts in may end it: a line cut sooner is
   *  a flicker, and is not begun at all. */
  minShownMs: 1200,
  /** The most lines a round besides the two moments that cut in. */
  perRound: 3,
  /** Badly hurt: down to this share of her health, and still standing. */
  hurtFraction: 0.35,
  /** Near her, for a Commander with no aura to measure it by: this many tiles. */
  nearTiles: 3,
  /** How long the light on her lasts as she starts to speak (`fx.light.flash`, a placement's own length). */
  lightMs: 400,
} as const

/**
 * The moments that matter most, first: the order lines are chosen in when a round has more moments than room.
 * The first two cut in (`CUTS_IN`).
 */
export const PRIORITY: readonly BarkMoment[] = [
  "falls",
  "round-won",
  "badly-hurt",
  "nexus-hit",
  "building-lost",
  "unit-lost",
  "raid-arrives",
  "first-contact",
  "round-start",
]

/** The moments that cut in, whatever is showing, never held back by the gap or the count. */
export const CUTS_IN: ReadonlySet<BarkMoment> = new Set<BarkMoment>(["falls", "round-won"])

/** What the voice reads of a resolved round: its states and events, the content it ran on, its tick rate. */
export type VoiceTimeline = Readonly<{
  states: readonly MatchState[]
  events: readonly DomainEvent[]
  registry: ContentRegistry
  ticksPerSecond: number
}>

/** The Commander who speaks in a round: the player's, with her lines and what "hurt" and "near" mean for her. */
export type Speaker = Readonly<{
  ordinal: number
  contentId: string
  player: PlayerId
  /** Her name as the screen gives it: "Vasse". */
  name: string
  maxHp: number
  /** Near her, in tiles: her aura's reach, or `VOICE.nearTiles` without one. */
  near: number
  barks: Barks
}>

/** A Commander's lines by her unit's id, from the armies the game ships: none for a unit no army leads. */
export function shippedBarks(contentId: string): Barks {
  return ARMIES.commanders.find((commander) => commander.unit === contentId)?.barks ?? {}
}

/** A side's Commander in a round, as the first state she stands in has her — or `null` when she is not on the
 *  Grid in it (out for the round, or a mission with none). */
export function commanderOf(timeline: Pick<VoiceTimeline, "states" | "registry">, player: PlayerId = "A"): EntityState | null {
  for (const state of timeline.states) {
    const found = state.entities.find((entity) => entity.player === player && timeline.registry.get(entity.contentId).commander === true)
    if (found !== undefined) return found
  }
  return null
}

/**
 * The player's Commander in a round, with her lines — or `null` when she is not on the Grid this round or has
 * nothing to say.
 */
export function speakerOf(timeline: VoiceTimeline, barksOf: (contentId: string) => Barks = shippedBarks, player: PlayerId = "A"): Speaker | null {
  const commander = commanderOf(timeline, player)
  if (commander === null) return null
  const barks = barksOf(commander.contentId)
  if (Object.keys(barks).length === 0) return null
  const definition = timeline.registry.get(commander.contentId)
  return {
    ordinal: commander.ordinal,
    contentId: commander.contentId,
    player,
    name: commanderName(commander.contentId),
    maxHp: definition.maxHp,
    near: definition.aura?.radius ?? VOICE.nearTiles,
    barks,
  }
}

/** A moment she may answer: which, and when it shows on screen, in presentation milliseconds from the round's
 *  start. */
export type Moment = Readonly<{ moment: BarkMoment; atMs: number }>

/** How a round ended, as far as her voice cares: when its result stands — the shooting stopped and the
 *  survivors home — and whether her side won it (a victory, or the mission's goal met). */
export type RoundEnd = Readonly<{ resultMs: number; won: boolean }>

/** "Near her" is measured from her one tile to the one tile a unit fell on. */
const ONE_TILE: Footprint = [{ x: 0, y: 0 }]

/**
 * The moments of a round she may answer, the first of each, in the order they show on screen. A blow that lands
 * after a shot's flight counts from when it lands, as its flash and its death do (`effects/derive.ts`).
 *
 * - **round-start**: a beat in, when she stands on the Grid as the round begins;
 * - **first-contact**: the first shot either side fires at the other;
 * - **raid-arrives**: the other side's units arriving after the round began (a building's training excluded);
 * - **unit-lost**: one of her side's units falls within `near` tiles of her (structures and Commanders aside),
 *   measured as her aura reaches, under the battle's own measure (`battleMeasure`, `footprintWithin`);
 * - **building-lost**: one of her side's buildings falls, the Grid Nexus aside (its fall ends the round);
 * - **badly-hurt**: a hit leaves her standing on `VOICE.hurtFraction` of her health or less;
 * - **nexus-hit**: her side's Grid Nexus is first hit;
 * - **falls**: she falls;
 * - **round-won**: a beat after the result stands, when her side won the round — her remark on the result,
 *   said where she stands once she is home, not where the walk home would leave it behind.
 */
export function voiceMoments(timeline: VoiceTimeline, speaker: Speaker, end: RoundEnd): Moment[] {
  const tickMs = 1000 / timeline.ticksPerSecond
  const holds = buildFlightHoldTicks(timeline.events)
  const landed = (tick: number, ordinal: number): number => (tick + flightHoldTicks(holds, tick, ordinal)) * tickMs
  const found = new Map<BarkMoment, Moment>()
  const add = (moment: BarkMoment, atMs: number): void => {
    if (!found.has(moment)) found.set(moment, { moment, atMs })
  }
  // Who each ordinal is: the round's opening cast, then whoever arrives or is trained or spawned.
  const cast = new Map<number, Readonly<{ contentId: string; player: PlayerId }>>()
  for (const entity of timeline.states[0]?.entities ?? []) cast.set(entity.ordinal, entity)
  for (const event of timeline.events) if (event.kind === "entity.spawned") cast.set(event.ordinal, event)
  const herAt = (tick: number): Coord | undefined => timeline.states[tick]?.entities.find((entity) => entity.ordinal === speaker.ordinal)?.anchor
  const measure = battleMeasure(timeline.states[0])
  const near = (her: Coord, at: Coord): boolean => footprintWithin(her, ONE_TILE, at, ONE_TILE, speaker.near, measure)

  if (timeline.states[0]?.entities.some((entity) => entity.ordinal === speaker.ordinal) === true) {
    add("round-start", VOICE.startDelayMs)
  }
  for (const event of timeline.events) {
    switch (event.kind) {
      case "attack.launched": {
        const from = cast.get(event.attackerOrdinal)?.player
        const to = cast.get(event.targetOrdinal)?.player
        if (from !== undefined && to !== undefined && from !== to) add("first-contact", event.tick * tickMs)
        break
      }
      case "entity.spawned":
        if (event.tick > 0 && event.player !== speaker.player && event.trainedBy === undefined) {
          add("raid-arrives", event.tick * tickMs)
        }
        break
      case "damage.applied": {
        if (event.ordinal === speaker.ordinal) {
          if (event.hpAfter > 0 && event.hpAfter <= speaker.maxHp * VOICE.hurtFraction) {
            add("badly-hurt", landed(event.tick, event.ordinal))
          }
          break
        }
        const hit = cast.get(event.ordinal)
        if (hit !== undefined && hit.player === speaker.player && timeline.registry.get(hit.contentId).nexus === true) {
          add("nexus-hit", landed(event.tick, event.ordinal))
        }
        break
      }
      case "entity.died": {
        if (event.ordinal === speaker.ordinal) {
          add("falls", landed(event.tick, event.ordinal))
          break
        }
        if (event.player !== speaker.player) break
        const definition = timeline.registry.get(event.contentId)
        if (definition.layer === "obstacles" || definition.commander === true) break
        const her = herAt(event.tick) ?? herAt(event.tick - 1)
        if (her !== undefined && near(her, event.at)) add("unit-lost", landed(event.tick, event.ordinal))
        break
      }
      case "structure.destroyed":
        if (event.player === speaker.player && timeline.registry.get(event.contentId).nexus !== true) {
          add("building-lost", landed(event.tick, event.ordinal))
        }
        break
      default:
        break
    }
  }
  if (end.won) add("round-won", end.resultMs + VOICE.wonDelayMs)
  const rank = (moment: Moment): number => PRIORITY.indexOf(moment.moment)
  return [...found.values()].sort((a, b) => a.atMs - b.atMs || rank(a) - rank(b))
}

/** A line she says: what it answers, the words, when it starts and when it is gone. */
export type SpokenLine = Readonly<{
  moment: BarkMoment
  text: string
  startMs: number
  /** When it is gone: its own length after it starts, or sooner, where a moment that cuts in takes its place. */
  endMs: number
  /** When it would have gone uncut, which its thinning out is timed back from. */
  fullEndMs: number
  /** It cut in (she fell, or the round was won): it was never held back by the gap or the count. */
  cutIn: boolean
}>

/** How long a line takes to type in, and how long it is on screen in all: typed, read, then thinned out. */
export function lineLength(text: string): Readonly<{ typeMs: number; totalMs: number }> {
  const characters = quoted(text).length
  const typeMs = Math.min(VOICE.typeMaxMs, characters * VOICE.typeMsPerChar)
  const readMs = Math.max(VOICE.readMinMs, characters * VOICE.readMsPerChar)
  return { typeMs, totalMs: typeMs + readMs + VOICE.decayMs }
}

/**
 * Which of a moment's lines she says: cosmetic randomness, a hash of the moment's identity — which moment, in
 * which round (a moment comes once a round) — under the view's cosmetic seed: where in her list the moment
 * starts is the hash, and each round steps one line on from it, so she never says the same line at the same
 * moment two rounds running. Never a stream: the same round always says the same lines, at any speed, in any
 * order of frames, however the fight went.
 */
export function pickLine(lines: readonly string[], moment: BarkMoment, round: number, cosmeticSeed: number): string {
  const hash = cosmeticHash(cosmeticSeed, `voice.${moment}`, 0, 0, 0, 0)
  return lines[(hash + Math.max(0, round)) % lines.length] as string
}

type Placed = { moment: BarkMoment; text: string; startMs: number; endMs: number; cutIn: boolean }

/** The earliest a line `lengthMs` long, for a moment at `atMs`, can start among the lines already placed — or
 *  `null` when it finds no room before its patience runs out, or before she falls (`silentFromMs`). Against
 *  another line that does not cut in it keeps the gap either side; against one that cuts in it starts after it,
 *  or far enough before it (`VOICE.minShownMs`) to be read before it is cut there. */
function earliestStart(atMs: number, lengthMs: number, placed: readonly Placed[], silentFromMs: number): number | null {
  const candidates = [atMs, ...placed.map((line) => line.endMs + (line.cutIn ? 0 : VOICE.gapMs))]
    .filter((start) => start >= atMs && start <= atMs + VOICE.patienceMs)
    .sort((a, b) => a - b)
  for (const start of candidates) {
    if (start >= silentFromMs) return null
    const end = start + lengthMs
    const clear = placed.every((line) =>
      line.cutIn
        ? start >= line.endMs || line.startMs - start >= VOICE.minShownMs
        : end + VOICE.gapMs <= line.startMs || start >= line.endMs + VOICE.gapMs,
    )
    if (clear) return start
  }
  return null
}

/**
 * What she says in a round, and when — planned once, from its moments (`voiceMoments`) and her lines: the
 * moments that cut in where they come, then the rest by `PRIORITY`, each at the first moment it fits, at most
 * `VOICE.perRound` of them; nothing after she falls but her last words, and nothing for a moment she has no line
 * for. In the order they start; a line a cut-in begins over ends where the cut-in begins.
 */
export function planVoice(
  moments: readonly Moment[],
  barks: Barks,
  options: Readonly<{ round: number; cosmeticSeed: number }>,
): SpokenLine[] {
  const silentFromMs = moments.find((moment) => moment.moment === "falls")?.atMs ?? Number.POSITIVE_INFINITY
  const said = (moment: Moment): Readonly<{ text: string; totalMs: number }> | null => {
    const lines = barks[moment.moment]
    if (lines === undefined || lines.length === 0) return null
    const text = pickLine(lines, moment.moment, options.round, options.cosmeticSeed)
    return { text, totalMs: lineLength(text).totalMs }
  }
  const placed: Placed[] = []
  for (const moment of moments) {
    if (!CUTS_IN.has(moment.moment)) continue
    if (moment.moment !== "falls" && moment.atMs >= silentFromMs) continue
    const line = said(moment)
    if (line === null) continue
    placed.push({ moment: moment.moment, text: line.text, startMs: moment.atMs, endMs: moment.atMs + line.totalMs, cutIn: true })
  }
  const rank = (moment: Moment): number => PRIORITY.indexOf(moment.moment)
  const ordinary = moments.filter((moment) => !CUTS_IN.has(moment.moment)).sort((a, b) => rank(a) - rank(b) || a.atMs - b.atMs)
  let count = 0
  for (const moment of ordinary) {
    if (count >= VOICE.perRound) break
    const line = said(moment)
    if (line === null) continue
    const startMs = earliestStart(moment.atMs, line.totalMs, placed, silentFromMs)
    if (startMs === null) continue
    placed.push({ moment: moment.moment, text: line.text, startMs, endMs: startMs + line.totalMs, cutIn: false })
    count += 1
  }
  placed.sort((a, b) => a.startMs - b.startMs)
  return placed.map((line, index) => {
    const next = placed[index + 1]
    const endMs = next !== undefined && next.startMs < line.endMs ? next.startMs : line.endMs
    return { ...line, endMs, fullEndMs: line.endMs }
  })
}

/** A line on screen at one instant: which, how many characters of it (quoted) are typed, and whether it is
 *  thinning out. */
export type VoiceAt = Readonly<{ line: SpokenLine; typed: number; fading: boolean }>

/** The line on screen at `timeMs`, or `null`: typed in from its start, whole once typed, dim in its last
 *  moments. Reduced motion shows it whole and steady from its first frame to its last. A pure function of time. */
export function voiceAt(lines: readonly SpokenLine[], timeMs: number, reducedMotion: boolean): VoiceAt | null {
  const line = lines.find((each) => timeMs >= each.startMs && timeMs < each.endMs)
  if (line === undefined) return null
  const total = quoted(line.text).length
  if (reducedMotion) return { line, typed: total, fading: false }
  const elapsed = timeMs - line.startMs
  const { typeMs } = lineLength(line.text)
  const typed = elapsed >= typeMs ? total : Math.min(total, Math.floor((elapsed / typeMs) * total) + 1)
  return { line, typed, fading: timeMs >= line.fullEndMs - VOICE.decayMs }
}

/**
 * The light on her as she starts to speak — the effect library's own light (`fx.light.flash`, shading): her
 * cell pulled toward the theme's strongest ink and back, a moment long, glyphless, so her `@` keeps its glyph.
 * Reduced motion is the recipe's steady half light; monochrome shows none, and the words carry the cue.
 */
export function voiceLight(line: SpokenLine, at: Coord): EffectInstance {
  return {
    recipe: "fx.light.flash",
    band: "highlights",
    startMs: line.startMs,
    durationMs: VOICE.lightMs,
    origin: at,
    family: "neutral",
    params: { palette: "flash" },
  }
}

/** The rows beside her a line may sit on, as rows from hers, nearest first and above before below. */
export const LABEL_ROWS: readonly number[] = [-1, 1, -2, 2, -3, 3]

/** What a line's place beside her is weighed by: a unit or a building it would cover at any moment of the line
 *  (a letter would be left out there), the rock or deposit it would hide, how many rows from hers it is, below
 *  rather than above, and each tile it is slid sideways off centre. */
const LABEL_COST = { standing: 100, terrain: 3, row: 4, below: 1, aside: 0.5 } as const

/** How far sideways a line beside her may slide off centre to find clear ground, in tiles, and in what steps. */
const LABEL_SLIDE = { most: 16, step: 2 } as const

/**
 * Where on the map a line beside her is shown: the tile it is centred on, its row included. It **holds still
 * while it is read** — text that hops a row each time she steps cannot be read — so it is chosen once a line,
 * from everything the line will be shown over, which the resolved round already knows: of the rows near her
 * (`LABEL_ROWS`), centred on her or slid a little to either side (`LABEL_SLIDE`), the place whose span — the
 * quoted line and a blank either side, at one column a tile, its widest — covers least of what stands there
 * while the line shows, hides least rock, and is nearest her, above before below (`LABEL_COST`). Kept on the
 * map. A letter that would still cover a unit or a building is left out when it is drawn (the corruption law,
 * `pulse-scene.ts`).
 *
 * `over` is the states the line is shown over, every one weighed alike; `grid` the map, for its terrain; `within`
 * the tiles it must stay inside — the part of the map in view as the line begins, or the whole map.
 */
export function labelPlace(
  text: string,
  her: Coord,
  over: readonly MatchState[],
  registry: ContentRegistry,
  grid: Readonly<{ width: number; height: number; tiles: readonly string[] }>,
  within: Readonly<{ firstX: number; lastX: number; firstY: number; lastY: number }> = {
    firstX: 0,
    lastX: grid.width - 1,
    firstY: 0,
    lastY: grid.height - 1,
  },
): Coord {
  const width = barkMapWidth(text)
  const half = Math.floor(width / 2)
  const centres: Array<Readonly<{ x: number; aside: number }>> = []
  for (let slide = 0; slide <= LABEL_SLIDE.most; slide += LABEL_SLIDE.step) {
    centres.push({ x: her.x + slide, aside: slide })
    if (slide > 0) centres.push({ x: her.x - slide, aside: slide })
  }
  // How many of the moments the line is shown at something stands on each tile, counted once for every span.
  const covered = new Int32Array(grid.width * grid.height)
  for (const state of over) {
    for (const entity of state.entities) {
      for (const tile of tilesOf(entity.anchor, registry.get(entity.contentId).footprint)) {
        if (tile.x < 0 || tile.x >= grid.width || tile.y < 0 || tile.y >= grid.height) continue
        const index = tile.y * grid.width + tile.x
        covered[index] = (covered[index] ?? 0) + 1
      }
    }
  }
  let best: Coord = { x: her.x, y: her.y + (LABEL_ROWS[0] as number) }
  let cheapest = Number.POSITIVE_INFINITY
  for (const row of LABEL_ROWS) {
    const y = her.y + row
    if (y < within.firstY || y > within.lastY) continue
    for (const centre of centres) {
      // Kept inside: a span that would run off an edge is moved back onto it.
      const left = Math.max(within.firstX, Math.min(centre.x - half, within.lastX - width + 1))
      let cost = Math.abs(row) * LABEL_COST.row + (row > 0 ? LABEL_COST.below : 0) + centre.aside * LABEL_COST.aside
      for (let x = left; x < left + width; x += 1) {
        if (x < 0 || x >= grid.width) {
          cost += LABEL_COST.terrain
          continue
        }
        if (grid.tiles[y * grid.width + x] !== "terrain.plain") cost += LABEL_COST.terrain
        cost += (covered[y * grid.width + x] ?? 0) * LABEL_COST.standing
      }
      if (cost < cheapest) {
        cheapest = cost
        best = { x: left + half, y }
      }
    }
  }
  return best
}
