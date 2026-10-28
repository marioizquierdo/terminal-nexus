// The march (pulse.md, routes; movement.md, the three states and troop formation): an army walking for its side's goal
// sorts itself on the move by one rule — a unit walks at half speed while an ally of higher priority (flanker, melee,
// ranged; shorter range first; tank, fighter, support, siege) marches in its sight — so the melee arrive first and the
// guns behind them in order of range; the Commander is a regular troop and holds no one back; a higher unit passes a
// lower one in its way by swapping tiles, so a narrow gap never jams; a flanker goes for what stands behind the enemy's
// front; and a mirrored march stays a mirror.

import { test } from "node:test"
import assert from "node:assert/strict"
import { classOf, FIXTURE_REGISTRY, formationRank, lineOf, rectFootprint } from "../src/content/index.ts"
import type { ContentDef } from "../src/content/index.ts"
import type { DomainEvent } from "../src/events/types.ts"
import { footprintExtent } from "../src/grid/coords.ts"
import { measureScenario } from "../src/measure/index.ts"
import { lineTiles, moveStateOf } from "../src/pulse/march.ts"
import { accrueCredit, accrueSlowedCredit, stepCost } from "../src/pulse/movement.ts"
import { contextFor, stepTick } from "../src/pulse/index.ts"
import type { Actor } from "../src/pulse/shared.ts"
import { loadScenario } from "../src/scenario/index.ts"
import type { ScenarioDefinition } from "../src/scenario/index.ts"
import type { EntityState, MatchState } from "../src/state/types.ts"
import { loadScenarioFile } from "./helpers.ts"

/** Every state of a scenario's battle, and every event, on its own seed or `seed`. */
async function play(name: string, seed?: number, scenario?: ScenarioDefinition): Promise<Readonly<{ states: MatchState[]; events: DomainEvent[] }>> {
  const map = scenario ?? (await loadScenarioFile(`${name}.map.json`))
  return playMap(map, seed)
}

function playMap(map: ScenarioDefinition, seed?: number): Readonly<{ states: MatchState[]; events: DomainEvent[] }> {
  const loaded = loadScenario(map, { registry: FIXTURE_REGISTRY, seed: seed ?? map.seed })
  const context = contextFor(loaded.state, loaded.registry, map.pulseTicks)
  const states = [loaded.state]
  const events: DomainEvent[] = []
  let state = loaded.state
  while (state.outcome === null && state.tick < map.pulseTicks) {
    const result = stepTick(state, context)
    state = result.state
    states.push(state)
    events.push(...result.events)
  }
  return { states, events }
}

const of = (state: MatchState, player: "A" | "B", contentId: string): EntityState[] =>
  state.entities.filter((entity) => entity.player === player && entity.contentId === contentId)

const xs = (entities: readonly EntityState[]): number[] => entities.map((entity) => entity.anchor.x)

/** The first tick a unit of `player` strikes or shoots anything (of the kind `unit` names, when it does). */
function firstStrike(events: readonly DomainEvent[], player: "A" | "B", unit = ""): number {
  const strike = events.find((event) => event.kind === "attack.launched" && event.attacker.startsWith(`${player}:${unit}`))
  assert.ok(strike !== undefined, `${player} never struck`)
  return strike.tick
}

/** The ticks, up to `until`, at which a unit took a step. */
function stepTicks(states: readonly MatchState[], ordinal: number, until: number = states.length - 1): number[] {
  const ticks: number[] = []
  for (let tick = 1; tick <= until && tick < states.length; tick += 1) {
    const before = (states[tick - 1] as MatchState).entities.find((entity) => entity.ordinal === ordinal)
    const after = (states[tick] as MatchState).entities.find((entity) => entity.ordinal === ordinal)
    if (before !== undefined && after !== undefined && (before.anchor.x !== after.anchor.x || before.anchor.y !== after.anchor.y)) ticks.push(tick)
  }
  return ticks
}

/** The ticks between one step and the next. */
const gapsOf = (ticks: readonly number[]): number[] => ticks.slice(1).map((tick, index) => tick - (ticks[index] as number))

/** A definition of a unit with the given attack, for the priority list. */
function unit(overrides: Partial<ContentDef> & Readonly<{ attack?: ContentDef["attack"] }> = {}): ContentDef {
  return { id: "unit.test.some", short: "some", layer: "units", footprint: rectFootprint(1, 1), maxHp: 10, movementRate: { numerator: 10, denominator: 3 }, speedTier: 1, behavior: "advance", ...overrides } as ContentDef
}

const melee = { kind: "melee", range: 1, damage: 5, cooldownTicks: 8 } as const
const gun = (range: number): NonNullable<ContentDef["attack"]> => ({ kind: "ranged", range, damage: 5, cooldownTicks: 8 })

// --- The priority list -----------------------------------------------------------------------------------------------

test("the formation's priority list: flanker, melee, ranged; then a shorter range; then tank, fighter, support, siege", () => {
  const rank = (definition: ContentDef): number => formationRank(definition) as number
  // Types.
  assert.ok(rank(unit({ attack: gun(4), line: "flanker" })) < rank(unit({ attack: melee })))
  assert.ok(rank(unit({ attack: melee })) < rank(unit({ attack: gun(2) })))
  // Range, within a type: a slinger before a marksman before a mortar of longer reach.
  assert.ok(rank(unit({ attack: gun(4) })) < rank(unit({ attack: gun(6) })))
  assert.ok(rank(unit({ attack: gun(6) })) < rank(unit({ attack: gun(10) })))
  // Class, within a type and a range.
  const classes = (["tank", "fighter", "support", "siege"] as const).map((each) => rank(unit({ attack: gun(4), class: each })))
  assert.deepEqual(classes, [...classes].sort((a, b) => a - b))
  assert.equal(new Set(classes).size, 4)
  // Equal in every respect: equal priority.
  assert.equal(rank(unit({ attack: gun(6) })), rank(unit({ attack: gun(6) })))
  // A longer range never outranks a type, and a class never outranks a range.
  assert.ok(rank(unit({ attack: melee, class: "siege" })) < rank(unit({ attack: gun(2), class: "tank" })))
  assert.ok(rank(unit({ attack: gun(4), class: "siege" })) < rank(unit({ attack: gun(6), class: "tank" })))
})

test("what the content does not say is derived from the attack: type, class, and no place without an attack", () => {
  assert.equal(lineOf(unit({ attack: melee })), "melee")
  assert.equal(lineOf(unit({ attack: gun(6) })), "ranged")
  assert.equal(lineOf(unit({ attack: { kind: "heal", range: 4, damage: 5, cooldownTicks: 8 } })), "ranged")
  assert.equal(lineOf(unit()), null)
  assert.equal(classOf(unit({ attack: { kind: "heal", range: 4, damage: 5, cooldownTicks: 8 } })), "support")
  assert.equal(classOf(unit({ attack: { ...gun(10), splash: { radius: 2, damage: 10 } } })), "siege")
  assert.equal(classOf(unit({ attack: { ...gun(10), burn: { radius: 2, damage: 1, everyTicks: 12, ticks: 36 } } })), "siege")
  assert.equal(classOf(unit({ attack: gun(6) })), "fighter")
  assert.equal(classOf(unit({ attack: gun(6), class: "tank" })), "tank")
  // No attack, a flyer and a structure keep no place.
  assert.equal(formationRank(unit()), null)
  assert.equal(formationRank(unit({ attack: gun(4), layer: "air" })), null)
  assert.equal(formationRank(unit({ attack: gun(4), layer: "obstacles" })), null)
  // The game's own: the Ravel bomber and the bench's runner are flankers, Vasse is ranged, the trooper melee, the mortar siege.
  const content = (id: string): ContentDef => FIXTURE_REGISTRY.get(id)
  assert.equal(lineOf(content("unit.bench.flanker")), "flanker")
  assert.equal(lineOf(content("unit.ravel.bomber")), "flanker")
  assert.equal(lineOf(content("unit.citizen.vasse")), "ranged")
  assert.equal(classOf(content("unit.citizen.mortar")), "siege")
  const order = ["unit.bench.flanker", "unit.citizen.trooper", "unit.citizen.vasse", "unit.citizen.marksman", "unit.citizen.mortar"].map((id) => formationRank(content(id)) as number)
  assert.deepEqual(order, [...order].sort((a, b) => a - b))
  assert.equal(new Set(order).size, order.length)
})

// --- The three states ------------------------------------------------------------------------------------------------

test("a unit is marching, in battle or retreating, worked out from what it chose to do", () => {
  const body = (contentId: string, player: "A" | "B", x: number): Actor => ({ ordinal: x, player, anchor: { x, y: 4 }, definition: FIXTURE_REGISTRY.get(contentId) }) as unknown as Actor
  const trooper = body("unit.citizen.trooper", "A", 10)
  const enemy = body("unit.citizen.trooper", "B", 12)
  const nexus = body("structure.bench.nexus", "B", 40)
  const worker = body("unit.citizen.worker", "A", 10)
  const area = { x: 30, y: 2, width: 4, height: 4 }
  // Walking for its side's target, or for a Nexus beyond its vision: marching.
  assert.equal(moveStateOf(trooper, { kind: "walk", goal: { kind: "area", area } }, null), "march")
  assert.equal(moveStateOf(trooper, { kind: "walk", goal: { kind: "unit", target: nexus, reach: { kind: "touch", steps: 1 } } }, nexus), "march")
  // Stepping off its roof first, holding at its target or with nothing to do: marching, too.
  assert.equal(moveStateOf(trooper, { kind: "walk", goal: { kind: "ground", toward: { x: 30, y: 4 } } }, null), "march")
  assert.equal(moveStateOf(trooper, { kind: "stand" }, null), "march")
  // Walking to an enemy, or standing to strike one: in battle.
  assert.equal(moveStateOf(trooper, { kind: "walk", goal: { kind: "unit", target: enemy, reach: { kind: "touch", steps: 1 } } }, enemy), "battle")
  assert.equal(moveStateOf(trooper, { kind: "stand" }, enemy), "battle")
  // The Nexus once it is within its vision is an enemy to fight.
  const near = body("structure.bench.nexus", "B", 14)
  assert.equal(moveStateOf(trooper, { kind: "walk", goal: { kind: "unit", target: near, reach: { kind: "touch", steps: 1 } } }, near), "battle")
  // Running from a threat: retreating.
  assert.equal(moveStateOf(worker, { kind: "flee", threat: enemy }, enemy), "retreat")
})

// --- Half speed ------------------------------------------------------------------------------------------------------

test("half speed is movement credit: a slowed unit accrues on every second tick, a step takes exactly twice as long, and it never stops", () => {
  for (const rate of [{ numerator: 10, denominator: 3 }, { numerator: 8, denominator: 3 }, { numerator: 4, denominator: 1 }, { numerator: 40, denominator: 9 }]) {
    const cost = stepCost(rate, "e")
    const ticksToStep = (accrue: (credit: number, tick: number) => number): number => {
      let credit = 0
      for (let tick = 1; tick < 1000; tick += 1) {
        credit = accrue(credit, tick)
        if (credit >= cost) return tick
      }
      return Infinity
    }
    const full = ticksToStep((credit) => accrueCredit(credit, rate))
    // The same two ticks in either runtime: it depends on nothing but the tick and the credit, in whole numbers.
    const slowed = ticksToStep((credit, tick) => accrueSlowedCredit(credit, rate, tick))
    assert.ok(slowed >= 2 * full - 1 && slowed <= 2 * full, `${rate.numerator}/${rate.denominator}: ${full} ticks a step, ${slowed} slowed`)
    assert.ok(Number.isInteger(slowed))
  }
})

/** Open field, side A's two units a row apart marching east on B's Nexus, and nothing else. */
function pair(rows: readonly string[], width = 70): ScenarioDefinition {
  const height = 9
  return {
    id: "pair",
    name: "pair",
    grid: { width, height },
    seed: 1,
    pulseTicks: 240,
    terrain: Array.from({ length: height }, () => ".".repeat(width)),
    terrainLegend: { ".": "terrain.plain" },
    placements: {
      A: { at: { x: 4, y: 3 }, rows: [...rows], legend: { t: { content: "unit.citizen.trooper" }, m: { content: "unit.citizen.marksman" }, u: { content: "unit.citizen.mortar" }, w: { content: "unit.citizen.worker" } } },
      B: { at: { x: width - 4, y: 3 }, rows: ["n"], legend: { n: { content: "structure.bench.nexus" } } },
    },
  }
}

test("a ranged unit walks at half speed while a melee ally marches in its sight, and at full speed alone", () => {
  const alone = playMap(pair(["m"]))
  const together = playMap(pair(["m", "t"]))
  const marksman = (run: ReturnType<typeof playMap>): number => (run.states[0] as MatchState).entities.find((entity) => entity.contentId === "unit.citizen.marksman")?.ordinal as number
  const trooper = (run: ReturnType<typeof playMap>): number => (run.states[0] as MatchState).entities.find((entity) => entity.contentId === "unit.citizen.trooper")?.ordinal as number
  // Alone, every step of the marksman takes the beat of its rate: 4 ticks across.
  const free = gapsOf(stepTicks(alone.states, marksman(alone), 60))
  assert.ok(free.length >= 10 && free.every((gap) => gap === 4), `alone: ${free}`)
  // Beside a trooper, each takes twice that, and it never stops; the trooper walks on at its own pace.
  const slow = gapsOf(stepTicks(together.states, marksman(together), 28))
  assert.ok(slow.length >= 2 && slow.every((gap) => gap >= 8 && gap <= 9), `slowed: ${slow}`)
  const quick = gapsOf(stepTicks(together.states, trooper(together), 40))
  assert.ok(quick.length >= 8 && quick.every((gap) => gap === 4), `trooper: ${quick}`)
  // The trooper outwalks it beyond its sight (6 columns), and from then on it walks at its own pace again.
  const later = gapsOf(stepTicks(together.states, marksman(together), 200))
  assert.ok(later.slice(-5).every((gap) => gap === 4), `later: ${later}`)
  const end = together.states.at(-1) as MatchState
  assert.ok((end.entities.find((entity) => entity.ordinal === trooper(together)) as EntityState).anchor.x > (end.entities.find((entity) => entity.ordinal === marksman(together)) as EntityState).anchor.x)
})

test("equals never slow each other, a lower unit never slows a higher one, and a unit with no place slows no one", () => {
  const gaps = (rows: readonly string[], content: string, until: number): number[] => {
    const run = playMap(pair(rows))
    const first = (run.states[0] as MatchState).entities.find((entity) => entity.contentId === content)
    return gapsOf(stepTicks(run.states, (first as EntityState).ordinal, until))
  }
  // Two marksmen: equal priority.
  assert.ok(gaps(["m", "m"], "unit.citizen.marksman", 60).every((gap) => gap === 4))
  // A marksman beside a trooper: the trooper is not slowed.
  assert.ok(gaps(["m", "t"], "unit.citizen.trooper", 60).every((gap) => gap === 4))
  // A worker has no attack and no place: it slows no one and is slowed by no one.
  assert.ok(gaps(["m", "w"], "unit.citizen.marksman", 60).every((gap) => gap === 4))
  assert.ok(gaps(["t", "w"], "unit.citizen.worker", 60).every((gap) => gap === 3 || gap === 4))
  // A mortar (siege, range 10) sees ten columns: it slows for a marksman that is 8 away, which a marksman would not.
  const far = gaps(["u", "", "", "", "", "m"], "unit.citizen.mortar", 40)
  assert.ok(far.every((gap) => gap >= 8 || gap === 4), `mortar: ${far}`)
})

// --- The armies ------------------------------------------------------------------------------------------------------

test("march-lines: shooters that start ahead of the troopers arrive behind them, ordered by range, and nothing stands still", async () => {
  const { states, events } = await play("march-lines")
  const start = states[0] as MatchState
  assert.ok(Math.min(...xs(of(start, "A", "unit.citizen.marksman"))) > Math.max(...xs(of(start, "A", "unit.citizen.trooper"))), "the marksmen start ahead")
  // A marches east; on the tick its army first strikes, every trooper stands further east than every marksman, and
  // every marksman further than the mortar (range 10, behind the marksmen's 6).
  const contact = firstStrike(events, "A")
  const arrival = states[contact] as MatchState
  const troopers = xs(of(arrival, "A", "unit.citizen.trooper"))
  const marksmen = xs(of(arrival, "A", "unit.citizen.marksman"))
  const mortar = xs(of(arrival, "A", "unit.citizen.mortar"))
  assert.ok(Math.min(...troopers) > Math.max(...marksmen), `troopers ${troopers}, marksmen ${marksmen}`)
  assert.ok(Math.min(...marksmen) > Math.max(...mortar), `marksmen ${marksmen}, mortar ${mortar}`)
  // The troopers passed them by swapping tiles with the ones in their way, and said so.
  assert.ok(events.some((event) => event.kind === "march.made-way"))
  // Sorting is slowing, never stopping: before contact no unit goes more than a slowed step's time without stepping,
  // and the troopers are never slowed (4 ticks a step, a swap or a turn aside, never a wait).
  for (const unit of start.entities.filter((entity) => entity.player === "A" && entity.contentId !== "structure.bench.nexus")) {
    const gaps = gapsOf(stepTicks(states, unit.ordinal, contact - 8))
    const slowest = unit.contentId === "unit.citizen.mortar" ? 17 : 9
    assert.ok(gaps.length > 5 && Math.max(...gaps) <= slowest, `${unit.id}: gaps ${gaps}`)
    if (unit.contentId === "unit.citizen.trooper") assert.ok(Math.max(...gaps) <= 8, `${unit.id} was held up: ${gaps}`)
  }
})

test("march-commander: the Commander is a regular troop - the troopers pass her, nobody waits for her, and she is slowed like anyone", async () => {
  const { states, events } = await play("march-commander")
  const start = states[0] as MatchState
  const contact = firstStrike(events, "A", "trooper")
  const arrival = states[contact] as MatchState
  const vasse = of(arrival, "A", "unit.citizen.vasse")[0] as EntityState
  // At contact her troopers are ahead of her and her marksmen (range 6, a lower priority than her 4) behind her.
  assert.ok(Math.min(...xs(of(arrival, "A", "unit.citizen.trooper"))) > vasse.anchor.x, `troopers ${xs(of(arrival, "A", "unit.citizen.trooper"))}, Vasse ${vasse.anchor.x}`)
  assert.ok(Math.max(...xs(of(arrival, "A", "unit.citizen.marksman"))) < vasse.anchor.x, `marksmen ${xs(of(arrival, "A", "unit.citizen.marksman"))}, Vasse ${vasse.anchor.x}`)
  // The flanker, first in the list, outwalks everyone and strikes first.
  assert.ok(firstStrike(events, "A", "flanker") < contact, "the flanker did not arrive first")
  // Nobody waits for her: before contact no trooper stands still, whatever she does (steps of 4 ticks, or 8 while the
  // flanker is in their sight), and she herself walks at 8 while a trooper is in hers, never stopping.
  for (const trooper of of(start, "A", "unit.citizen.trooper")) {
    const gaps = gapsOf(stepTicks(states, trooper.ordinal, contact - 8))
    assert.ok(gaps.length > 20 && Math.max(...gaps) <= 8, `${trooper.id}: gaps ${gaps}`)
  }
  const hers = gapsOf(stepTicks(states, (of(start, "A", "unit.citizen.vasse")[0] as EntityState).ordinal, contact - 8))
  assert.ok(hers.some((gap) => gap >= 8), `Vasse was never slowed: ${hers}`)
  assert.ok(Math.max(...hers) <= 9 + 8, `Vasse stopped: ${hers}`)
  assert.equal(states.at(-1)?.outcome?.winner, "A")
})

test("march-narrow-gap: troopers swap past the slower marksmen in a one-wide corridor, a raider waits behind its marksman, and nothing jams", async () => {
  const scenario = await loadScenarioFile("march-narrow-gap.map.json")
  for (const seed of [1, 2, 3, 4]) {
    const { battle } = measureScenario(scenario, seed)
    assert.equal(battle.winner, "A", `seed ${seed}: ${battle.reason} at ${battle.ticks}`)
    assert.equal(battle.reason, "nexus-destroyed")
    assert.equal(battle.sides.A.stalled, 0, `seed ${seed}: a unit stood still for good`)
    assert.ok(battle.sides.A.longestBlocked < 24, `seed ${seed}: a unit stood blocked ${battle.sides.A.longestBlocked} ticks`)
  }
  const { states, events } = await play("march-narrow-gap")
  const madeWay = events.filter((event) => event.kind === "march.made-way")
  // Three troopers past two marksmen in the north corridor: six swaps at least, the marksman stepping back each time.
  assert.ok(madeWay.filter((event) => event.ally.includes("trooper")).length >= 6, `${madeWay.length} swaps`)
  // The raider, too wide to swap, passes no one: it is not the one that gets by.
  assert.ok(madeWay.every((event) => !event.ally.includes("raider")))
  // Every trooper leaves the north corridor (it ends at column 37) before either marksman does.
  const out = (contentId: string): number[] =>
    of(states[0] as MatchState, "A", contentId)
      .filter((entity) => entity.anchor.y === 2)
      .map((entity) => states.findIndex((state) => (state.entities.find((other) => other.ordinal === entity.ordinal)?.anchor.x ?? 0) > 37))
  assert.ok(Math.max(...out("unit.citizen.trooper")) < Math.min(...out("unit.citizen.marksman")), `troopers out at ${out("unit.citizen.trooper")}, marksmen at ${out("unit.citizen.marksman")}`)
})

/** A state as rows of side, content, place and health, each side's seen from the other end when `mirrored`. */
function rows(state: MatchState, width: number, mirrored: boolean): string[] {
  return state.entities
    .map((entity) => {
      const extent = footprintExtent(FIXTURE_REGISTRY.get(entity.contentId).footprint)
      const player = mirrored ? (entity.player === "A" ? "B" : "A") : entity.player
      const x = mirrored ? width - entity.anchor.x - extent.width : entity.anchor.x
      return `${player} ${entity.contentId} ${x},${entity.anchor.y} ${entity.hp}`
    })
    .sort()
}

test("march-mirror: two mirrored armies sort themselves and march at each other, a mirror tick for tick", async () => {
  const scenario = await loadScenarioFile("march-mirror.map.json")
  const { states, events } = await play("march-mirror")
  const width = "width" in scenario.grid ? scenario.grid.width : 0
  states.forEach((state, tick) => assert.deepEqual(rows(state, width, false), rows(state, width, true), `parted at tick ${tick}`))
  // Both sides' marksmen stepped back for their troopers, as many times each.
  const swaps = (player: "A" | "B"): number => events.filter((event) => event.kind === "march.made-way" && event.entity.startsWith(`${player}:`)).length
  assert.ok(swaps("A") > 0)
  assert.equal(swaps("A"), swaps("B"))
})

test("a march with its sides' names swapped is the same march: nothing favours A for being A", async () => {
  const scenario = await loadScenarioFile("march-lines.map.json")
  const swapped: ScenarioDefinition = {
    ...scenario,
    placements: { A: scenario.placements.B ?? { rows: [], legend: {} }, B: scenario.placements.A ?? { rows: [], legend: {} } },
    targets: { ...(scenario.targets?.B === undefined ? {} : { A: scenario.targets.B }), ...(scenario.targets?.A === undefined ? {} : { B: scenario.targets.A }) },
  }
  const once = await play("march-lines")
  const twice = await play("march-lines", undefined, swapped)
  const named = (state: MatchState, swap: boolean): string[] =>
    state.entities.map((entity) => `${swap ? (entity.player === "A" ? "B" : "A") : entity.player} ${entity.contentId} ${entity.anchor.x},${entity.anchor.y} ${entity.hp}`).sort()
  assert.equal(once.states.length, twice.states.length)
  once.states.forEach((state, tick) => assert.deepEqual(named(state, false), named(twice.states[tick] as MatchState, true), `parted at tick ${tick}`))
})

test("the guide line covers mirrored tiles from either end, both tiles where it falls exactly between two", () => {
  const width = 40
  const mirror = (tile: Readonly<{ x: number; y: number }>): string => `${width - 1 - tile.x},${tile.y}`
  // In half tiles: from the middle of a tile at (3,4) to between (30,9) and (31,9).
  const west = lineTiles({ x: 6, y: 8 }, { x: 61, y: 18 })
  const east = lineTiles({ x: 2 * (width - 1) - 6, y: 8 }, { x: 2 * (width - 1) - 61, y: 18 })
  assert.deepEqual(west.map(mirror).sort(), east.map((tile) => `${tile.x},${tile.y}`).sort())
  assert.ok(west.some((tile) => tile.x === 30 && tile.y === 9) && west.some((tile) => tile.x === 31 && tile.y === 9))
})

test("a flanker goes for the shooter behind the enemy's front, where any other unit fights the trooper nearest it", () => {
  // A flanker (the bench's runner that goes beyond the line) above a trooper, an enemy trooper two columns ahead of it
  // and a marksman three behind that.
  const scenario: ScenarioDefinition = {
    id: "flanker",
    name: "flanker",
    grid: { width: 30, height: 9 },
    seed: 1,
    pulseTicks: 60,
    terrain: Array.from({ length: 9 }, () => ".".repeat(30)),
    terrainLegend: { ".": "terrain.plain" },
    placements: {
      A: { at: { x: 8, y: 4 }, rows: ["r", "t"], legend: { r: { content: "unit.bench.flanker" }, t: { content: "unit.citizen.trooper" } } },
      B: { at: { x: 10, y: 4 }, rows: ["t  m"], legend: { t: { content: "unit.citizen.trooper" }, m: { content: "unit.citizen.marksman" } } },
    },
  }
  const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed: 1 })
  const context = contextFor(loaded.state, loaded.registry, 60)
  const { events } = stepTick(loaded.state, context)
  const chose = (who: string): string => {
    const chosen = events.find((event) => event.kind === "target.selected" && event.entity.startsWith(who))
    return chosen?.kind === "target.selected" ? chosen.target : ""
  }
  assert.match(chose("A:flanker"), /marksman/)
  assert.match(chose("A:trooper"), /trooper/)
})
