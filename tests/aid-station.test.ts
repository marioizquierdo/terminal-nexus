// The Aid Station: what Vasse's Aid Station Permit unlocks, a building that heals (commander-armies.md, her Nexus
// powers: "The Aid Station repairs the units beside it each Battle Round"). The story is the named scenario
// `scenarios/aid-station-repair.map.json`; here are the rule's edges, each on a few units placed to show one thing
// (the kernel's healer on a building: `behavior: "support"`, a heal attack, its layers), how a heal looks on
// screen, and its card at the 80 x 24 floor.

import { test } from "node:test"
import assert from "node:assert/strict"
import { currentCard } from "../src/build/card.ts"
import type { BuildContext } from "../src/build/state.ts"
import { CARD_FIRST_ROW, menuFloor } from "../src/build/layout.ts"
import { buildTimeline } from "../src/cli/timeline.ts"
import { starterContext } from "../src/cli/starter.ts"
import { CONTENT_ART, PLACEMENT_ART } from "../src/content/art.ts"
import { CARD_TEXT } from "../src/content/cards.ts"
import type { ContentDef } from "../src/content/index.ts"
import { createRegistry, FIXTURE_REGISTRY } from "../src/content/index.ts"
import type { DomainEvent } from "../src/events/types.ts"
import { contextFor, resolvePulse, stepTick } from "../src/pulse/index.ts"
import { loadScenario } from "../src/scenario/index.ts"
import type { PlacementBlock, ScenarioDefinition } from "../src/scenario/index.ts"
import type { MatchState, PlayerId } from "../src/state/types.ts"
import { placementRun } from "../src/view/placement.ts"
import { CAPABILITY_MODES, DEFAULT_PRESENTATION, EFFECT_RECIPES, MEND_GLYPH, STYLE_ROLES, cellAt, createView, gridOrigin, mendTile } from "../src/view/index.ts"
import type { EffectContext, EffectInstance, EffectRecipe } from "../src/view/index.ts"
import { MAXIMUM, MINIMUM, buildSide, compose, keys, panelLines } from "./build-helpers.ts"
import { loadScenarioFile, resolveScenario } from "./helpers.ts"

const AID = "structure.citizen.aidstation"

/** A trooper that stands where it is put: wounded or not, it only takes hits and patches. */
const STANDING: ContentDef = { ...FIXTURE_REGISTRY.get("unit.citizen.trooper"), id: "unit.test.standing", short: "standing", behavior: "static" }

/** A unit that stands where it is put and hits the nearest enemy beside it, every second, for `damage`. */
const striker = (id: string, damage: number): ContentDef => ({
  id,
  short: id.split(".").at(-1) ?? id,
  layer: "units",
  footprint: [{ x: 0, y: 0 }],
  maxHp: 200,
  speedTier: 2,
  attack: { kind: "melee", range: 1, damage, cooldownTicks: 12 },
  collidesWith: ["obstacles", "units"],
  behavior: "static",
  salvage: 0,
})

const REGISTRY = createRegistry([
  ...FIXTURE_REGISTRY.ids().map((id) => FIXTURE_REGISTRY.get(id)),
  STANDING,
  striker("unit.test.striker", 11),
  striker("unit.test.pricker", 1),
])

/** One placement: a content at a tile (a structure by its centre tile, as a map writes it), and its health. */
type Placed = readonly [x: number, y: number, content: string, hp?: number]

/** One side's placement block. */
function block(placed: readonly Placed[]): PlacementBlock {
  const symbols = "abcdefghijklmnopqrstuvwxyz"
  const rows: string[][] = []
  const legend: Record<string, { content: string; hp?: number }> = {}
  placed.forEach(([x, y, content, hp], index) => {
    const symbol = symbols[index] as string
    while (rows.length <= y) rows.push([])
    const row = rows[y] as string[]
    while (row.length <= x) row.push(" ")
    row[x] = symbol
    legend[symbol] = hp === undefined ? { content } : { content, hp }
  })
  return { rows: rows.map((row) => row.join("")), legend }
}

/** The raid's Nexus, alone in the far corner: it keeps a battle going to its last tick and is in nobody's reach. */
const FAR_NEXUS: Placed = [16, 8, "structure.ravel.nexus"]

/** A small Grid with each side placed as given, resolved tick by tick for `ticks`: every event, and every state. */
function run(sides: Readonly<Record<PlayerId, readonly Placed[]>>, ticks: number): { events: DomainEvent[]; states: MatchState[] } {
  const scenario: ScenarioDefinition = {
    id: "aid-station-edges",
    name: "aid station edges",
    grid: { width: 20, height: 10 },
    seed: 1,
    pulseTicks: ticks,
    terrain: Array.from({ length: 10 }, () => ".".repeat(20)),
    terrainLegend: { ".": "terrain.plain" },
    placements: { A: block(sides.A), B: block(sides.B) },
  }
  const loaded = loadScenario(scenario, { registry: REGISTRY })
  const context = contextFor(loaded.state, REGISTRY, ticks)
  const events: DomainEvent[] = []
  const states: MatchState[] = [loaded.state]
  let state = loaded.state
  while (state.outcome === null && state.tick < ticks) {
    const result = stepTick(state, context)
    state = result.state
    states.push(state)
    events.push(...result.events)
  }
  return { events, states }
}

type Heal = Extract<DomainEvent, { kind: "heal.applied" }>
const healsOf = (events: readonly DomainEvent[]): Heal[] => events.filter((event): event is Heal => event.kind === "heal.applied")
const at = (state: MatchState | undefined, x: number, y: number) => state?.entities.find((entity) => entity.anchor.x === x && entity.anchor.y === y)

// --- The content ---------------------------------------------------------------------------------------

test("the Aid Station is a one-tile building that heals the units of its side, and never moves", () => {
  const station = FIXTURE_REGISTRY.get(AID)
  assert.equal(station.layer, "obstacles")
  assert.equal(station.movementRate, undefined, "a building that heals has no way to move")
  assert.equal(station.behavior, "support", "it seeks wounded allies, never an enemy")
  assert.deepEqual(station.attack, { kind: "heal", range: 2, damage: 4, cooldownTicks: 18 })
  assert.deepEqual(station.targetLayers, ["workers", "units", "air"], "it mends units, never a building")
  assert.deepEqual(CONTENT_ART[AID], ["+"])
  // Its placement frames go up in place, then the finished cross.
  assert.deepEqual(placementRun(AID, station.footprint), PLACEMENT_ART[AID])
  assert.ok((PLACEMENT_ART[AID] ?? []).every((frame) => frame.length === 1 && frame[0]?.length === 1 && frame[0] !== "+"))
})

// --- The rule's edges ----------------------------------------------------------------------------------

test("it mends the wounded units of its side within its reach — beside it and two columns either side — nearest first, 4 a patch every second and a half, never past full", () => {
  // A row counts two columns: a reach of 2 is the four tiles touching it and two columns either side; its corners are
  // three away.
  const { events, states } = run(
    {
      A: [
        [5, 3, AID],
        [6, 3, "unit.test.standing", 31], // touching, east: the nearest
        [5, 4, "unit.test.standing", 35], // touching, below: two away
        [3, 3, "unit.test.standing", 35], // two columns west
        [6, 4, "unit.test.standing", 30], // its corner: three away
        [8, 3, "unit.test.standing", 30], // three columns east
        [5, 5, "unit.test.standing", 30], // two rows below: four away
      ],
      B: [FAR_NEXUS],
    },
    220,
  )
  const heals = healsOf(events)
  const final = states.at(-1)
  for (const [x, y] of [[6, 3], [5, 4], [3, 3]] as const) {
    assert.equal(at(final, x, y)?.hp, 40, `the unit at ${x},${y}, within its reach, was not mended to full`)
  }
  for (const [x, y] of [[6, 4], [8, 3], [5, 5]] as const) {
    assert.equal(at(final, x, y)?.hp, 30, `the unit at ${x},${y}, beyond its reach, was mended`)
  }
  // Nearest first: the one touching it is patched to full before any other, the last patch only what was missing.
  const east = at(states[0], 6, 3)?.id
  assert.deepEqual(heals.slice(0, 3).map((heal) => [heal.entity, heal.amount, heal.hpAfter]), [[east, 4, 35], [east, 4, 39], [east, 1, 40]])
  // One patch at a time, a second and a half apart, each at most 4 and never past full.
  heals.forEach((heal, index) => {
    assert.equal(heal.tick, 1 + 18 * index, `patch ${index + 1} came at tick ${heal.tick}`)
    assert.ok(heal.amount >= 1 && heal.amount <= 4 && heal.hpAfter <= 40)
  })
  assert.equal(heals.length, 3 + 2 + 2)
  const launched = events.filter((event) => event.kind === "attack.launched")
  assert.ok(launched.every((event) => event.kind === "attack.launched" && event.attackKind === "heal" && event.damage === 4))
})

test("it never mends an enemy, a building or itself, and never moves", () => {
  // A wounded raid unit stands beside it and pricks it every second; a wounded Barracks of its own side touches it.
  const { events, states } = run(
    {
      A: [
        [3, 3, "structure.citizen.barracks", 50], // its tiles 2..4, 3..4: touching the station
        [5, 3, AID],
        [9, 7, "unit.test.standing"], // the side's one unit, unhurt and far away
      ],
      B: [[6, 3, "unit.test.pricker", 20], FAR_NEXUS],
    },
    150,
  )
  assert.deepEqual(healsOf(events), [], "the station mended something")
  const station = states[0]?.entities.find((entity) => entity.contentId === AID)
  assert.ok(station !== undefined)
  assert.ok(
    !events.some(
      (event) =>
        (event.kind === "target.selected" && event.ordinal === station.ordinal) || (event.kind === "attack.launched" && event.attackerOrdinal === station.ordinal),
    ),
    "it chose something to mend",
  )
  const final = states.at(-1)
  const after = final?.entities.find((entity) => entity.ordinal === station.ordinal)
  assert.ok(after !== undefined && after.hp < 60, "the raid unit never wounded the station")
  assert.equal(final?.entities.find((entity) => entity.contentId === "structure.citizen.barracks")?.hp, 50)
  assert.equal(final?.entities.find((entity) => entity.player === "B" && entity.contentId === "unit.test.pricker")?.hp, 20)
  // It stands where it was placed, every tick.
  for (const state of states) assert.deepEqual(state.entities.find((entity) => entity.ordinal === station.ordinal)?.anchor, { x: 5, y: 3 })
  assert.ok(!events.some((event) => (event.kind === "entity.moved" || event.kind === "move.intended") && event.entity === station.id))
})

test("a patch lands after the tick's blows: a unit a blow kills is never saved by it", () => {
  // The trooper beside it has 5 health and a striker beside it: the blow and the patch come in the same tick, the
  // blow first, so the trooper falls and the patch is never made.
  const { events, states } = run({ A: [[5, 3, AID], [6, 3, "unit.test.standing", 5], [9, 7, "unit.test.standing"]], B: [[7, 3, "unit.test.striker"], FAR_NEXUS] }, 30)
  const station = states[0]?.entities.find((entity) => entity.contentId === AID)
  const fell = events.find(
    (event): event is Extract<DomainEvent, { kind: "entity.died" }> => event.kind === "entity.died" && event.contentId === "unit.test.standing",
  )
  assert.equal(fell?.tick, 1, "the trooper beside it did not fall to the first blow")
  // It had chosen the trooper to mend that tick; the blow came first.
  assert.ok(events.some((event) => event.kind === "target.selected" && event.tick === 1 && event.entity === station?.id && event.target === fell?.entity))
  assert.deepEqual(healsOf(events), [], "a patch was made on a unit a blow killed")
})

// --- The named scenario --------------------------------------------------------------------------------

test("aid-station-repair: the trooper beside the station wins its duel and is mended to full; the same duel beyond its reach is a mutual kill", async () => {
  const { run: battle } = await resolveScenario("aid-station-repair.map.json")
  const opening = battle.initialState.entities
  const station = opening.find((entity) => entity.contentId === AID)
  const barracks = opening.find((entity) => entity.contentId === "structure.citizen.barracks")
  assert.ok(station !== undefined && barracks !== undefined)
  const heals = healsOf(battle.events)
  assert.ok(heals.length > 0, "the station mended nobody")
  // Every patch lands on the trooper beside it, from it, 4 at a time and never past full; the last only what was missing.
  for (const heal of heals) {
    assert.deepEqual([heal.entity, heal.source], ["A:trooper#3", station.id], `a patch at tick ${heal.tick} went elsewhere`)
    assert.ok(heal.amount <= 4 && heal.hpAfter <= 40)
  }
  assert.deepEqual([heals.at(-1)?.amount, heals.at(-1)?.hpAfter], [2, 40], "the last patch was not only what was missing")
  // The duel beside it is won; the same duel five rows below, beyond its reach, ends with both down at once.
  const fell = (entity: string): number | undefined => battle.events.find((event) => event.kind === "entity.died" && event.entity === entity)?.tick
  assert.equal(fell("A:trooper#3"), undefined, "the trooper beside the station fell")
  assert.equal(fell("B:trooper#4"), fell("A:trooper#5"))
  assert.equal(fell("A:trooper#5"), fell("B:trooper#6"))
  const final = battle.finalState.entities
  assert.equal(final.find((entity) => entity.id === "A:trooper#3")?.hp, 40, "the trooper beside it was not mended to full")
  // Never the raid's wounded trooper inside its reach, never the wounded Barracks beside it, and it never moves.
  assert.ok(battle.events.some((event) => event.kind === "damage.applied" && event.entity === "B:trooper#4"))
  assert.equal(final.find((entity) => entity.id === barracks.id)?.hp, 60)
  assert.deepEqual(final.find((entity) => entity.id === station.id)?.anchor, station.anchor)
  assert.deepEqual([battle.finalState.outcome?.winner, battle.finalState.outcome?.reason], [null, "tick-limit"])
})

test("the Aid Station's battle hashes the same every run, and it is pinned: a change to it is a change on purpose", async () => {
  const runs = await Promise.all([1, 2, 3].map(() => resolveScenario("aid-station-repair.map.json")))
  for (const { run: battle } of runs) assert.deepEqual([battle.stateHash, battle.eventsHash], PINNED_AID_STATION)
  // One call and tick by tick agree.
  const scenario = await loadScenarioFile("aid-station-repair.map.json")
  const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY })
  const whole = resolvePulse({ initialState: loaded.state, registry: loaded.registry, pulseTicks: scenario.pulseTicks, seed: scenario.seed })
  assert.deepEqual([whole.stateHash, whole.eventsHash], PINNED_AID_STATION)
})

test("the bench medic, the one healer before buildings could heal, heals exactly as it did: its battle is the one it always was", async () => {
  // A healer's wounded allies are now narrowed by its layers (`perception.ts`); the medic names none, so nothing it
  // does may move. These are its battle's hashes from before the Aid Station.
  const { run: battle } = await resolveScenario("bench-medic-support.map.json")
  assert.deepEqual([battle.stateHash, battle.eventsHash], PINNED_MEDIC)
})

const PINNED_AID_STATION = [
  "81f2d4de6a136420014eafcff90baefcd47f30e47d39655c5f43a5e64be71af3",
  "4f9602c34e41efda28e1407e2aab36d892197d01b5be69b9c81c264da4835a93",
]
const PINNED_MEDIC = [
  "08a556835c0c4b1fefda99b52da283d385f530db7f071db9a5ace6ec14fa951e",
  "7c803a0bcaf4dfaa106d39b5968bc05b88ffe23fa9c12b1aedd980acdc2637ec",
]

// --- How a heal looks ----------------------------------------------------------------------------------

test("a heal shows on screen: a cross of light beside the mended unit, then risen a row and dim — never on a unit, never as bold as the station; reduced motion holds it", async () => {
  const scenario = await loadScenarioFile("aid-station-repair.map.json")
  const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed: scenario.seed })
  const timeline = buildTimeline(scenario, loaded.state, loaded.registry, scenario.pulseTicks, scenario.seed)
  // A patch with nothing else happening: the duels are over, the trooper beside the station stands at the line.
  const patch = timeline.events.find((event) => event.kind === "heal.applied" && event.tick > 70)
  assert.ok(patch !== undefined && patch.kind === "heal.applied")
  const mended = timeline.states[patch.tick]?.entities.find((entity) => entity.ordinal === patch.ordinal)
  assert.ok(mended !== undefined)
  const origin = gridOrigin(timeline.grid)
  const cellOf = (x: number, y: number) => ({ x: origin.column + x, y: origin.row + y })
  const above = cellOf(mended.anchor.x, mended.anchor.y - 1)
  const higher = cellOf(mended.anchor.x, mended.anchor.y - 2)
  const own = cellOf(mended.anchor.x, mended.anchor.y)
  for (const capability of ["monochrome", "truecolor"] as const) {
    const view = createView(timeline)
    const landing = view.snapshotAt((patch.tick + 1) * view.tickDurationMs, capability)
    assert.equal(cellAt(landing, above.x, above.y).glyph, MEND_GLYPH, `${capability}: no cross above the mended unit`)
    assert.deepEqual(cellAt(landing, above.x, above.y).style, { fgRole: "fx.flash" })
    assert.equal(cellAt(landing, own.x, own.y).glyph, "t", "the mended unit's own glyph was replaced")
    const rising = view.snapshotAt((patch.tick + 3) * view.tickDurationMs, capability)
    assert.equal(cellAt(rising, higher.x, higher.y).glyph, MEND_GLYPH, `${capability}: the cross did not rise`)
    assert.deepEqual(cellAt(rising, higher.x, higher.y).style, { fgRole: "fx.flash", dim: true })
    // Reduced motion: the cross held where it landed, no rise.
    const still = createView(timeline, { ...DEFAULT_PRESENTATION, reducedMotion: true })
    const held = still.snapshotAt((patch.tick + 3) * still.tickDurationMs, capability)
    assert.equal(cellAt(held, above.x, above.y).glyph, MEND_GLYPH, `${capability}: reduced motion dropped the cross`)
    assert.notEqual(cellAt(held, higher.x, higher.y).glyph, MEND_GLYPH, `${capability}: reduced motion still rose`)
  }
  // With effects off, the same moment shows nothing there: the cross is the heal's, and only presentation's.
  const off = createView(timeline, { ...DEFAULT_PRESENTATION, effects: false })
  assert.notEqual(cellAt(off.snapshotAt((patch.tick + 1) * off.tickDurationMs, "monochrome"), above.x, above.y).glyph, MEND_GLYPH)
})

test("a heal's mark keeps the effect contract: a pure function of time, one ASCII cell in a declared role, all three forms at the impact beat", () => {
  const found = EFFECT_RECIPES["fx.impact.burst"]
  assert.ok(found !== undefined)
  const recipe: EffectRecipe = found
  const instance: EffectInstance = {
    recipe: "fx.impact.burst",
    band: "effects",
    startMs: 1000,
    durationMs: 360,
    origin: { x: 10, y: 5 },
    family: "citizen",
    params: { amount: 4, heal: 1 },
  }
  const context = (overrides: Partial<EffectContext> = {}): EffectContext => ({ timeMs: 1000, cosmeticSeed: 0x0c05e7, reducedMotion: false, capability: "color16", ...overrides })
  const times = [1000, 1090, 1179, 1180, 1270, 1359]
  const forwards = times.map((timeMs) => JSON.stringify(recipe(instance, context({ timeMs }))))
  const backwards = [...times].reverse().map((timeMs) => JSON.stringify(recipe(instance, context({ timeMs })))).reverse()
  assert.deepEqual(backwards, forwards)
  for (const capability of CAPABILITY_MODES) {
    for (const reducedMotion of [false, true]) {
      for (let timeMs = instance.startMs; timeMs < instance.startMs + instance.durationMs; timeMs += 11) {
        const cells = recipe(instance, context({ timeMs, capability, reducedMotion }))
        assert.equal(cells.length, 1)
        for (const cell of cells) {
          assert.equal(cell.glyph, MEND_GLYPH)
          assert.ok(cell.role !== undefined && (STYLE_ROLES as readonly string[]).includes(cell.role))
          assert.equal(cell.role, "fx.flash", "a heal is drawn as light, in no side's colour")
          assert.notEqual(cell.bold, true, "a heal's cross took a building's weight, as the Aid Station beside it is drawn")
          assert.equal(cell.fade, undefined, "a heal's mark thins, it does not fade")
        }
      }
    }
  }
  const impact = instance.startMs + instance.durationMs * 0.25
  for (const ctx of [context({ timeMs: impact, capability: "truecolor" }), context({ timeMs: impact, reducedMotion: true }), context({ timeMs: impact, capability: "monochrome" })]) {
    assert.deepEqual(recipe(instance, ctx), [{ tile: { x: 10, y: 5 }, glyph: MEND_GLYPH, role: "fx.flash" }])
  }
  // A hit is still a hit: without the heal form, the burst is the impact it always was.
  const { heal: _heal, ...hit } = instance.params
  assert.notEqual(recipe({ ...instance, params: hit }, context({ timeMs: impact }))[0]?.glyph, undefined)
  assert.notDeepEqual(recipe({ ...instance, params: hit }, context({ timeMs: impact })), recipe(instance, context({ timeMs: impact })))
})

test("a heal's mark goes on the first open tile beside the mended unit: above, right, left, then below — never on a unit, rock or off the Grid", () => {
  const scenario: ScenarioDefinition = {
    id: "mend-tile",
    name: "mend tile",
    grid: { width: 8, height: 6 },
    seed: 1,
    pulseTicks: 1,
    terrain: ["........", "...#....", "........", "........", "........", "........"],
    terrainLegend: { ".": "terrain.plain", "#": "terrain.rock" },
    placements: {
      A: block([[3, 2, "unit.test.standing"], [4, 2, "unit.test.standing"], [2, 2, "unit.test.standing"], [0, 0, "unit.test.standing"], [5, 4, "unit.citizen.hauler"]]),
    },
  }
  const { state } = loadScenario(scenario, { registry: REGISTRY })
  const footprint = REGISTRY.get("unit.test.standing").footprint
  // Rock above, a unit on either side: below.
  assert.deepEqual(mendTile(state, REGISTRY, { x: 3, y: 2 }, footprint), { x: 3, y: 3 })
  // Open above.
  assert.deepEqual(mendTile(state, REGISTRY, { x: 4, y: 2 }, footprint), { x: 4, y: 1 })
  // In the corner: off the Grid above and to the left, so to the right.
  assert.deepEqual(mendTile(state, REGISTRY, { x: 0, y: 0 }, footprint), { x: 1, y: 0 })
  // A three-tile hauler (anchored at 4,4): above the middle of it.
  assert.deepEqual(mendTile(state, REGISTRY, { x: 4, y: 4 }, REGISTRY.get("unit.citizen.hauler").footprint), { x: 5, y: 3 })
  // Every side taken: nowhere.
  const boxed: ScenarioDefinition = { ...scenario, terrain: ["........", "........", "........", "........", "........", "........"], placements: { A: block([[3, 2, "unit.test.standing"], [3, 1, "unit.test.standing"], [4, 2, "unit.test.standing"], [2, 2, "unit.test.standing"], [3, 3, "unit.test.standing"]]) } }
  assert.equal(mendTile(loadScenario(boxed, { registry: REGISTRY }).state, REGISTRY, { x: 3, y: 2 }, footprint), null)
})

// --- Its card --------------------------------------------------------------------------------------------

/** PERIMETER's Build Phase with the Aid Station on its construct menu, as Aid Station Permit puts it: the fourth
 *  row, after the buildings already there. */
function withAidStation(): BuildContext {
  const context = starterContext()
  const hotkey = String(context.catalog.length + 1)
  return { ...context, catalog: [...context.catalog, { hotkey, contentId: AID, label: CARD_TEXT[AID]?.title ?? AID, cost: 25 }] }
}

test("the Aid Station's card fits the panel whole — its subtitle on one line, its description never cut, every number above the floor — at 80x24 and 104x32, in ASCII and Unicode", () => {
  for (const terminal of [MINIMUM, MAXIMUM]) {
    for (const pack of ["ascii", "unicode"] as const) {
      const where = `${terminal.columns}x${terminal.rows}, ${pack}`
      const context = withAidStation()
      const side = buildSide({ context, terminal })
      keys(side, context.catalog.at(-1)?.hotkey ?? "")
      const card = currentCard(side.context, side.build.state)
      assert.ok(card !== null && card.icon.kind === "entity" && card.icon.contentId === AID, `${where}: the Aid Station's card is not showing`)
      assert.equal(card.title, "Aid Station")
      const lines = panelLines(side, compose(side, { glyphPack: pack }))
      assert.match(lines[CARD_FIRST_ROW] as string, /^\+ +Aid Station/, `${where}: the icon and title`)
      assert.equal(lines[CARD_FIRST_ROW + 1]?.trim().endsWith(card.subtitle), true, `${where}: the subtitle is not on one line under the title`)
      const body = lines.slice(CARD_FIRST_ROW + 2).map((line) => line.trim()).filter((line) => line !== "")
      assert.ok(body.join(" ").startsWith(card.description), `${where}: the description is cut`)
      for (const stat of card.stats) {
        assert.ok(body.some((line) => line.startsWith(stat.label) && line.endsWith(stat.value)), `${where}: ${stat.label} is missing`)
      }
      for (const label of ["COST", "HEALTH", "SIZE", "RANGE", "BUILD RANGE"]) {
        assert.ok(card.stats.some((stat) => stat.label === label), `${where}: no ${label} row`)
      }
      const top = side.layout.panelRow
      for (let row = menuFloor(side.layout) + 1; row <= side.layout.panelLastRow; row += 1) {
        assert.equal(lines[row - top]?.trim(), "", `${where}: the card runs into row ${row}`)
      }
    }
  }
})
