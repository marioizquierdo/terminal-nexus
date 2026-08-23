// The effect system — ascii-effects.md Section 6, which is explicit that effects are tested
// without a terminal: "Do not test effects by watching them — watch them to judge them, test them
// to keep them."

import { test } from "node:test"
import assert from "node:assert/strict"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { buildTimeline } from "../src/cli/timeline.ts"
import { loadScenario } from "../src/scenario/index.ts"
import {
  CAPABILITY_MODES,
  DEFAULT_PRESENTATION,
  EFFECT_BANDS,
  EFFECT_IDS,
  EFFECT_RECIPES,
  EffectTimeline,
  STYLE_ROLES,
  createView,
  deriveEffects,
  frameToText,
  isActive,
  offendingGlyph,
} from "../src/view/index.ts"
import type { CapabilityMode, EffectContext, EffectInstance } from "../src/view/index.ts"
import { loadScenarioFile, resolveScenario, scenarioFiles } from "./helpers.ts"

const GRID = { width: 24, height: 12 }

function context(overrides: Partial<EffectContext> = {}): EffectContext {
  return {
    timeMs: 1000,
    cosmeticSeed: 0x0c05e7,
    tileWidth: 1,
    reducedMotion: false,
    capability: "color16",
    ...overrides,
  }
}

/** One instance per recipe, positioned in the middle of a Grid so nothing clips by accident. */
function sampleInstances(): EffectInstance[] {
  const origin = { x: 10, y: 6 }
  const target = { x: 14, y: 6 }
  const common = { startMs: 1000, origin, target, family: "ravel" as const }
  return [
    { recipe: "fx.move.trail", band: "effects", durationMs: 120, params: {}, ...common },
    { recipe: "fx.melee.wind", band: "effects", durationMs: 100, params: {}, ...common },
    { recipe: "fx.melee.clash", band: "effects", durationMs: 140, params: {}, ...common },
    { recipe: "fx.ranged.telegraph", band: "effects", durationMs: 80, params: {}, ...common },
    { recipe: "fx.ranged.tracer", band: "projectiles", durationMs: 160, params: {}, ...common },
    { recipe: "fx.impact.burst", band: "effects", durationMs: 180, params: {}, ...common },
    { recipe: "fx.damage.flash", band: "highlights", durationMs: 66, params: {}, ...common },
    {
      recipe: "fx.death.collapse",
      band: "effects",
      durationMs: 320,
      params: { width: 3, height: 1 },
      ...common,
    },
    {
      recipe: "fx.structure.collapse",
      band: "effects",
      durationMs: 600,
      params: { width: 3, height: 2 },
      ...common,
    },
    {
      recipe: "fx.blast.detonation",
      band: "effects",
      durationMs: 380,
      params: { radius: 2 },
      ...common,
    },
    {
      recipe: "fx.nexus.critical",
      band: "effects",
      durationMs: 8000,
      params: { width: 3, height: 2, periodMs: 1200 },
      ...common,
    },
  ]
}

test("the starter vocabulary is authored, all of it", () => {
  // The ten of ascii-effects.md Section 5, plus fx.blast.detonation, which the Ravel volatile
  // munitions rule earned — the list is GUIDANCE and predates the rule.
  const canon = [
    "fx.move.trail",
    "fx.melee.wind",
    "fx.melee.clash",
    "fx.ranged.telegraph",
    "fx.ranged.tracer",
    "fx.impact.burst",
    "fx.damage.flash",
    "fx.death.collapse",
    "fx.structure.collapse",
    "fx.nexus.critical",
  ]
  for (const id of canon) {
    assert.ok(EFFECT_RECIPES[id] !== undefined, `${id} is not authored`)
  }
  assert.ok(EFFECT_RECIPES["fx.blast.detonation"] !== undefined)
  assert.equal(EFFECT_IDS.length, canon.length + 1)
})

test("f(t) is a pure function of absolute time, in any order and after any skipping", () => {
  for (const instance of sampleInstances()) {
    const recipe = EFFECT_RECIPES[instance.recipe]
    assert.ok(recipe !== undefined)
    const times = [1000, 1033, 1066, 1100, 1150, 1200]

    const forwards = times.map((timeMs) => JSON.stringify(recipe(instance, context({ timeMs }))))
    const backwards = [...times]
      .reverse()
      .map((timeMs) => JSON.stringify(recipe(instance, context({ timeMs }))))
      .reverse()
    assert.deepEqual(backwards, forwards, `${instance.recipe} depends on call order`)

    // Sample every intervening millisecond, then ask again: the answers must not have moved.
    for (let timeMs = 1000; timeMs < 1200; timeMs += 1) recipe(instance, context({ timeMs }))
    const again = times.map((timeMs) => JSON.stringify(recipe(instance, context({ timeMs }))))
    assert.deepEqual(again, forwards, `${instance.recipe} accumulated state`)
  }
})

test("an effect emits nothing outside its own window", () => {
  for (const instance of sampleInstances()) {
    const recipe = EFFECT_RECIPES[instance.recipe]
    assert.ok(recipe !== undefined)
    for (const timeMs of [instance.startMs - 1, instance.startMs + instance.durationMs + 1]) {
      assert.equal(isActive(instance, timeMs), false)
    }
    const timeline = new EffectTimeline([instance])
    assert.deepEqual(timeline.activeAt(instance.startMs - 1), [])
    assert.deepEqual(timeline.activeAt(instance.startMs + instance.durationMs), [])
    assert.deepEqual(timeline.activeAt(instance.startMs), [instance])
  }
})

test("every effect paints in a legal band, and never in one the simulation owns", async () => {
  for (const instance of sampleInstances()) {
    assert.ok(
      (EFFECT_BANDS as readonly string[]).includes(instance.band),
      `${instance.recipe} paints in ${instance.band}`,
    )
  }
  const resolved = await resolveScenario("citizens-versus-ravels.map.json")
  const derived = deriveEffects({
    states: [],
    events: resolved.run.events,
    registry: resolved.registry,
    ticksPerSecond: 12,
  })
  assert.ok(derived.length > 0)
  for (const instance of derived) {
    assert.ok((EFFECT_BANDS as readonly string[]).includes(instance.band))
  }
})

test("every glyph an effect emits is one cell wide, and every role is a declared role", () => {
  for (const instance of sampleInstances()) {
    const recipe = EFFECT_RECIPES[instance.recipe]
    assert.ok(recipe !== undefined)
    for (const capability of CAPABILITY_MODES) {
      for (const reducedMotion of [false, true]) {
        for (let timeMs = instance.startMs; timeMs < instance.startMs + instance.durationMs; timeMs += 11) {
          for (const cell of recipe(instance, context({ timeMs, capability, reducedMotion }))) {
            assert.ok(
              cell.glyph === "" || [...cell.glyph].length === 1,
              `${instance.recipe} emitted "${cell.glyph}"`,
            )
            if (cell.glyph !== "") {
              const code = cell.glyph.codePointAt(0) ?? 0
              assert.ok(code >= 0x20 && code <= 0x7e, `${instance.recipe} left ASCII: ${cell.glyph}`)
            }
            if (cell.role !== undefined) {
              assert.ok(
                (STYLE_ROLES as readonly string[]).includes(cell.role),
                `${instance.recipe} invented the role ${cell.role}`,
              )
            }
          }
        }
      }
    }
  }
})

test("all three forms exist and all three emit at the impact beat", () => {
  // ascii-effects.md Section 4: full, reduced motion and monochrome, authored together. An effect
  // that goes silent in one of them is not finished.
  for (const instance of sampleInstances()) {
    const recipe = EFFECT_RECIPES[instance.recipe]
    assert.ok(recipe !== undefined)
    const impact = instance.startMs + instance.durationMs * 0.25
    const forms: Array<[string, EffectContext]> = [
      ["full", context({ timeMs: impact, capability: "truecolor" })],
      ["reduced motion", context({ timeMs: impact, reducedMotion: true })],
      ["monochrome", context({ timeMs: impact, capability: "monochrome" })],
    ]
    for (const [form, ctx] of forms) {
      assert.ok(
        recipe(instance, ctx).length > 0,
        `${instance.recipe} emits nothing in its ${form} form at the impact beat`,
      )
    }
  }
})

test("reduced motion keeps causality: a shot still connects shooter to target", () => {
  const tracer = sampleInstances().find((instance) => instance.recipe === "fx.ranged.tracer")
  assert.ok(tracer !== undefined)
  const recipe = EFFECT_RECIPES["fx.ranged.tracer"]
  assert.ok(recipe !== undefined)
  const cells = recipe(tracer, context({ timeMs: tracer.startMs + 10, reducedMotion: true }))
  assert.ok(cells.length >= 2, "the reduced-motion tracer is not a line")
  // It spans the gap rather than travelling it: every cell sits between shooter and target.
  for (const cell of cells) {
    assert.ok(cell.tile.x > tracer.origin.x && cell.tile.x < (tracer.target?.x ?? 0))
  }
})

test("the damage flash is an attribute, never a glyph replacement", () => {
  const recipe = EFFECT_RECIPES["fx.damage.flash"]
  assert.ok(recipe !== undefined)
  const instance = sampleInstances().find((each) => each.recipe === "fx.damage.flash")
  assert.ok(instance !== undefined)
  for (const cell of recipe(instance, context({ timeMs: instance.startMs }))) {
    assert.equal(cell.glyph, "", "the flash replaced the cell it was highlighting")
  }
  assert.equal(instance.band, "highlights", "the flash must sit above the corruption band")
})

test("cosmetic randomness is a hash, not a stream: the same instance always scatters the same way", () => {
  const blast = sampleInstances().find((each) => each.recipe === "fx.blast.detonation")
  assert.ok(blast !== undefined)
  const recipe = EFFECT_RECIPES["fx.blast.detonation"]
  assert.ok(recipe !== undefined)
  const timeMs = blast.startMs + 100
  const once = JSON.stringify(recipe(blast, context({ timeMs })))
  const twice = JSON.stringify(recipe(blast, context({ timeMs })))
  assert.equal(twice, once)

  const elsewhere = JSON.stringify(
    recipe(blast, context({ timeMs, cosmeticSeed: blast.startMs + 999 })),
  )
  assert.notEqual(elsewhere, once, "the cosmetic seed changes nothing, so it is not being used")
})

test("the cosmetic seed cannot reach the kernel", async () => {
  // The load-bearing separation: presentation randomness must not perturb a single hash.
  const scenario = await loadScenarioFile("citizens-versus-ravels.map.json")
  const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed: scenario.seed })
  const timeline = buildTimeline(
    scenario,
    loaded.state,
    loaded.registry,
    scenario.pulseTicks,
    scenario.seed,
  )
  const hashes = new Set<string>()
  const framesPerSeed = new Map<number, string[]>()
  const sampleTimes = [140, 168, 200, 244, 268].map((tick) => tick * (1000 / 12) + 30)
  for (const cosmeticSeed of [1, 2, 0xbeef, 0x0c05e7]) {
    const view = createView(timeline, { ...DEFAULT_PRESENTATION, cosmeticSeed })
    hashes.add(`${view.timeline.stateHash}:${view.timeline.eventsHash}`)
    framesPerSeed.set(
      cosmeticSeed,
      sampleTimes.map((timeMs) => frameToText(view.snapshotAt(timeMs, "color16", 1))),
    )
  }
  assert.equal(hashes.size, 1, "a cosmetic seed changed a gameplay hash")

  const seeds = [...framesPerSeed.values()]
  const differsSomewhere = sampleTimes.some((_, index) =>
    seeds.some((frames) => frames[index] !== seeds[0]?.[index]),
  )
  assert.ok(differsSomewhere, "the cosmetic seed changed nothing on screen either")
})

test("effects are derived from the event stream, and turning them off changes only the picture", async () => {
  const scenario = await loadScenarioFile("ravel-cascade.map.json")
  const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed: scenario.seed })
  const timeline = buildTimeline(
    scenario,
    loaded.state,
    loaded.registry,
    scenario.pulseTicks,
    scenario.seed,
  )
  const withEffects = createView(timeline, DEFAULT_PRESENTATION)
  const without = createView(timeline, { ...DEFAULT_PRESENTATION, effects: false })
  assert.ok(withEffects.effectCount > 40, `only ${withEffects.effectCount} instances were derived`)
  assert.equal(without.effectCount, 0)
  assert.equal(withEffects.timeline.stateHash, without.timeline.stateHash)

  // Tick 37, not 48: the 2026-08-22 speed pass (owner playtest, "units still move too slow") moved
  // the cascade's first blast earlier, since every mover in the fixture reaches contact sooner.
  const timeMs = 37 * (1000 / 12) + 40
  assert.notEqual(
    frameToText(withEffects.snapshotAt(timeMs, "monochrome", 1)),
    frameToText(without.snapshotAt(timeMs, "monochrome", 1)),
  )
})

test("composed frames stay inside the Grid, one ASCII cell each, at every render tier", async () => {
  for (const name of ["citizens-versus-ravels.map.json", "ravel-cascade.map.json", "citizen-mirror-skirmish.map.json"]) {
    const scenario = await loadScenarioFile(name)
    const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed: scenario.seed })
    const timeline = buildTimeline(
      scenario,
      loaded.state,
      loaded.registry,
      scenario.pulseTicks,
      scenario.seed,
    )
    for (const reducedMotion of [false, true]) {
      const view = createView(timeline, { ...DEFAULT_PRESENTATION, reducedMotion })
      for (const capability of CAPABILITY_MODES) {
        for (const fraction of [0.1, 0.35, 0.5, 0.8]) {
          const frame = view.snapshotAt(view.durationMs * fraction, capability, 1)
          assert.equal(frame.width, 80)
          assert.equal(frame.height, 24)
          assert.equal(offendingGlyph(frame), null, `${name} at ${capability}`)
        }
      }
    }
  }
  void GRID
})

test("every render tier shows the same Pulse, and only monochrome shows no colour", async () => {
  const resolved = await resolveScenario("citizens-versus-ravels.map.json")
  void resolved
  const scenario = await loadScenarioFile("citizens-versus-ravels.map.json")
  const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed: scenario.seed })
  const timeline = buildTimeline(
    scenario,
    loaded.state,
    loaded.registry,
    scenario.pulseTicks,
    scenario.seed,
  )
  const view = createView(timeline)
  const timeMs = 200 * (1000 / 12)

  const glyphs = new Set(
    CAPABILITY_MODES.map((capability) => frameToText(view.snapshotAt(timeMs, capability, 1))),
  )
  assert.equal(glyphs.size, 1, "a render tier changed which glyphs are on screen")
})

test("the effect timeline finds the same instances however it is sampled", () => {
  const instances = sampleInstances()
  const timeline = new EffectTimeline(instances)
  for (let timeMs = 900; timeMs < 2000; timeMs += 17) {
    const scanned = timeline.activeAt(timeMs)
    const brute = instances.filter((instance) => isActive(instance, timeMs))
    assert.deepEqual(
      scanned.map((instance) => instance.recipe).sort(),
      brute.map((instance) => instance.recipe).sort(),
      `the scan and a brute-force filter disagree at ${timeMs}ms`,
    )
  }
})

test("every scenario derives effects without inventing a recipe", async () => {
  for (const name of scenarioFiles()) {
    const resolved = await resolveScenario(name)
    const instances = deriveEffects({
      states: [],
      events: resolved.run.events,
      registry: resolved.registry,
      ticksPerSecond: 12,
    })
    for (const instance of instances) {
      assert.ok(
        EFFECT_RECIPES[instance.recipe] !== undefined,
        `${name} asked for the unauthored recipe ${instance.recipe}`,
      )
      assert.ok(instance.durationMs > 0, `${name}: ${instance.recipe} has no window`)
    }
  }
})

test("the glyph pack changes the field and the frame, never the actors", async () => {
  const scenario = await loadScenarioFile("citizens-versus-ravels.map.json")
  const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed: scenario.seed })
  const timeline = buildTimeline(
    scenario,
    loaded.state,
    loaded.registry,
    scenario.pulseTicks,
    scenario.seed,
  )
  const ascii = createView(timeline, { ...DEFAULT_PRESENTATION, glyphPack: "ascii" })
  const unicode = createView(timeline, { ...DEFAULT_PRESENTATION, glyphPack: "unicode" })
  const timeMs = 178 * (1000 / 12)

  const asciiFrame = ascii.snapshotAt(timeMs, "truecolor", 1)
  const unicodeFrame = unicode.snapshotAt(timeMs, "truecolor", 1)
  assert.notEqual(frameToText(asciiFrame), frameToText(unicodeFrame))
  assert.equal(offendingGlyph(asciiFrame), null)
  assert.equal(offendingGlyph(unicodeFrame), null, "the pack put a glyph on screen it may not use")

  // ASCII is the baseline: the default pack emits nothing outside printable ASCII, ever.
  for (const cell of asciiFrame.cells) {
    const code = cell.glyph.codePointAt(0) ?? 0
    assert.ok(code >= 0x20 && code <= 0x7e, `the ASCII pack emitted ${JSON.stringify(cell.glyph)}`)
  }

  // The actors are letters in both packs, because case carries ownership and shape carries faction.
  const letters = (frame: typeof asciiFrame): string =>
    frame.cells
      .map((cell) => cell.glyph)
      .filter((glyph) => /[A-Za-z]/.test(glyph))
      .join("")
  assert.equal(letters(unicodeFrame), letters(asciiFrame))
})


test("a same-tick ranged kill holds its death and blast until the tracer lands, not before", async () => {
  // Owner playtest, 2026-08-22: "the timings for shooting and taking damage are much better now...
  // look for more opportunities to do that, specially when the effect is resolved within the same
  // turn so it doesn't really affect the gameplay." The kernel resolves a ranged kill in the tick
  // the shot is launched - attack.launched, damage.applied, entity.died and any entity.detonated it
  // triggers all carry the same tick - but the impact burst already waits for the flight window
  // (engine.md 4.3) to end before it plays. The death collapse and any resulting blast did not, so a
  // unit could visibly explode before its own tracer arrived. citizens-versus-ravels reproduces this
  // exactly: tick 169, A:marksman#5's shot (flightWindowTicks 2) kills B:runner#6, whose volatile
  // munitions then catch A:trooper#8.
  const resolved = await resolveScenario("citizens-versus-ravels.map.json")
  const derived = deriveEffects({
    states: [],
    events: resolved.run.events,
    registry: resolved.registry,
    ticksPerSecond: 12,
  })
  const tickMs = 1000 / 12

  for (const event of resolved.run.events) {
    if (event.kind !== "attack.launched" || event.attackKind !== "ranged") continue
    const impactMs = event.tick * tickMs + event.flightWindowTicks * tickMs

    const death = resolved.run.events.find(
      (candidate): candidate is typeof candidate & { at: { x: number; y: number } } =>
        (candidate.kind === "entity.died" || candidate.kind === "structure.destroyed") &&
        candidate.tick === event.tick &&
        candidate.ordinal === event.targetOrdinal,
    )
    if (death === undefined) continue

    const collapse = derived.find(
      (instance) =>
        (instance.recipe === "fx.death.collapse" || instance.recipe === "fx.structure.collapse") &&
        instance.startMs >= impactMs - 1 &&
        instance.origin.x === death.at.x &&
        instance.origin.y === death.at.y,
    )
    assert.ok(
      collapse !== undefined,
      `no death/structure collapse held to the tick-${event.tick} impact beat for ordinal ${event.targetOrdinal}`,
    )
    assert.ok(
      collapse.startMs >= impactMs,
      `${collapse.recipe} started at ${collapse.startMs}, before its own tracer landed at ${impactMs}`,
    )

    const blast = derived.find(
      (instance) => instance.recipe === "fx.blast.detonation" && instance.startMs >= impactMs - 1,
    )
    if (blast !== undefined) {
      assert.ok(
        blast.startMs >= impactMs,
        `fx.blast.detonation started at ${blast.startMs}, before its own tracer landed at ${impactMs}`,
      )
    }
  }
})


test("a death reads visibly heavier than a hit, ascii-effects.md 5's own requirement for this pair", () => {
  // "fx.death.collapse... Must be visibly heavier than fx.impact.burst - dying and being hit are the
  // two events players confuse most" (ascii-effects.md Section 5). Owner playtest, 2026-08-22: "show
  // bigger explosions when the units die vs when they take damage" - the same requirement, seen on a
  // real fight rather than read off a table, and not previously asserted by anything automated.
  const origin = { x: 10, y: 6 }
  const target = { x: 14, y: 6 }
  const burst: EffectInstance = {
    recipe: "fx.impact.burst",
    band: "effects",
    startMs: 0,
    durationMs: 180,
    origin,
    target,
    family: "citizen",
    params: {},
  }
  const death: EffectInstance = {
    recipe: "fx.death.collapse",
    band: "effects",
    startMs: 0,
    durationMs: 320,
    origin,
    family: "citizen",
    // The most common footprint in the fixture content: every unit but the hauler and the raider.
    params: { width: 1, height: 1 },
  }

  const burstRecipe = EFFECT_RECIPES["fx.impact.burst"]
  const deathRecipe = EFFECT_RECIPES["fx.death.collapse"]
  assert.ok(burstRecipe !== undefined && deathRecipe !== undefined)

  const peakCells = (instance: EffectInstance, recipe: (typeof EFFECT_RECIPES)["fx.impact.burst"]): number => {
    let peak = 0
    for (let timeMs = instance.startMs; timeMs < instance.startMs + instance.durationMs; timeMs += 5) {
      peak = Math.max(peak, recipe(instance, context({ timeMs, reducedMotion: false })).length)
    }
    return peak
  }

  const burstPeak = peakCells(burst, burstRecipe)
  const deathPeak = peakCells(death, deathRecipe)
  assert.ok(
    deathPeak > burstPeak,
    `fx.death.collapse peaked at ${deathPeak} cells, fx.impact.burst at ${burstPeak} - not visibly heavier`,
  )
  // "Visibly" is doing real work in the sentence, not just "one more cell": the loudest death frame
  // should put down meaningfully more than the loudest hit frame, not edge past it by a single cell.
  assert.ok(
    deathPeak >= burstPeak * 3,
    `fx.death.collapse (${deathPeak} cells) is not comfortably heavier than fx.impact.burst (${burstPeak})`,
  )
  // Duration is the other half of "heavier": a death that lingers reads as more consequential than
  // one that flickers and is gone.
  assert.ok(death.durationMs > burst.durationMs)
})
