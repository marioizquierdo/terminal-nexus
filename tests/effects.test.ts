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
  deathExtraTicks,
  deathRingOutset,
  deriveEffects,
  frameToText,
  isActive,
  mergeEffectCells,
  offendingGlyph,
} from "../src/view/index.ts"
import type {
  CapabilityMode,
  EffectCellSource,
  EffectContext,
  EffectInstance,
  PositionedCell,
} from "../src/view/index.ts"
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

/**
 * One instance per recipe, positioned in the middle of a Grid so nothing clips by accident - two
 * for `fx.death.collapse`, since `deathRingOutset` branches its tail on footprint size and the
 * shared invariant tests below (purity, band legality, one-cell ASCII glyphs, all three forms)
 * should exercise `bigDeathScatter` exactly as they exercise everything else, not just the
 * hand-authored tests written specifically for it.
 */
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
      // outset 2 (deathRingOutset(3, 3)) - the colossus-scale bigDeathScatter path, held to the
      // same scaled duration deriveEffects itself would compute (320 + deathExtraTicks * tickMs).
      recipe: "fx.death.collapse",
      band: "effects",
      durationMs: 320 + deathExtraTicks(3, 3) * (1000 / 12),
      params: { width: 3, height: 3 },
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

  // Tick 25, not 37: the 2026-08-23 speed pass (owner playtest, "raise movement speed by another
  // 50-70%") moved the cascade's first blast earlier again, for the same reason the 2026-08-22 pass
  // already moved it once (every mover in the fixture reaches contact sooner).
  const timeMs = 25 * (1000 / 12) + 40
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

test("a large footprint's death ring reads heavier than a 1x1's, not the same fixed halo", () => {
  // Owner playtest, 2026-08-23: "when a large unit is destroyed, it should leave more derby in the
  // ground." Before this, fx.death.collapse's expanding ring was eight fixed offsets regardless of
  // footprint size - proportionally weaker the bigger the unit, exactly backwards from what a large
  // death should read as.
  const deathRecipe = EFFECT_RECIPES["fx.death.collapse"]
  assert.ok(deathRecipe !== undefined)
  const peakCells = (width: number, height: number): number => {
    const instance: EffectInstance = {
      recipe: "fx.death.collapse",
      band: "effects",
      startMs: 0,
      durationMs: 320,
      origin: { x: 10, y: 6 },
      family: "citizen",
      params: { width, height },
    }
    let peak = 0
    for (let timeMs = 0; timeMs < 320; timeMs += 5) {
      peak = Math.max(peak, deathRecipe(instance, context({ timeMs, reducedMotion: false })).length)
    }
    return peak
  }

  const small = peakCells(1, 1)
  const colossus = peakCells(3, 3)
  const leviathan = peakCells(5, 2)
  assert.ok(
    colossus > small * 2,
    `a 3x3 death (${colossus} cells) is not comfortably heavier than a 1x1's (${small})`,
  )
  assert.ok(
    leviathan > colossus,
    `a 5x2 death (${leviathan} cells) is not heavier than a 3x3's (${colossus}) - the widest thing ` +
      "on the bench should leave the most",
  )
})

test("content with DEATH_ART plays its own frames across the collapse, not the generic fill", () => {
  const deathRecipe = EFFECT_RECIPES["fx.death.collapse"]
  assert.ok(deathRecipe !== undefined)
  const instance: EffectInstance = {
    recipe: "fx.death.collapse",
    band: "effects",
    startMs: 0,
    durationMs: 320,
    origin: { x: 10, y: 6 },
    family: "citizen",
    params: { width: 3, height: 3, contentId: "unit.citizen.colossus" },
  }
  const glyphsAt = (timeMs: number): Set<string> =>
    new Set(deathRecipe(instance, context({ timeMs, reducedMotion: false })).map((cell) => cell.glyph))

  // The frame drawn early (an "x" crack in the sealed head) should not still be there once the
  // sequence has moved on to its later frames (settled rubble, "." and "=").
  const early = glyphsAt(10)
  const late = glyphsAt(300)
  assert.ok(early.has("x"), `the first death frame's crack glyph never appeared: ${[...early]}`)
  assert.ok(!late.has("["), `the intact bracket is still drawn at ${[...late]} long after the frame should have moved on`)

  // Content with no DEATH_ART entry is completely unaffected - the plain per-tile fill this recipe
  // has always drawn for everything else on the bench.
  const plain: EffectInstance = { ...instance, params: { width: 1, height: 1, contentId: "unit.citizen.trooper" } }
  const plainCells = deathRecipe(plain, context({ timeMs: 10, reducedMotion: false }))
  assert.ok(plainCells.length > 0, "a trooper's death produced no cells at all")
  assert.ok(
    plainCells.every((cell) => cell.glyph !== "x" && cell.glyph !== "["),
    "a trooper's death drew a colossus death-frame glyph - contentId leaked across content",
  )
})

test("reduced motion holds a death frame's final pose, not a mid-collapse one", () => {
  // ascii-effects.md 4: reduced motion keeps impact and settle, drops drift - the frame sequence is
  // exactly the drift here, so it should hold on the last frame rather than animate through them.
  const deathRecipe = EFFECT_RECIPES["fx.death.collapse"]
  assert.ok(deathRecipe !== undefined)
  const instance: EffectInstance = {
    recipe: "fx.death.collapse",
    band: "effects",
    startMs: 0,
    durationMs: 320,
    origin: { x: 10, y: 6 },
    family: "citizen",
    params: { width: 3, height: 3, contentId: "unit.citizen.colossus" },
  }
  const early = deathRecipe(instance, context({ timeMs: 10, reducedMotion: true }))
  const late = deathRecipe(instance, context({ timeMs: 300, reducedMotion: true }))
  const glyphsOf = (cells: readonly { glyph: string }[]): string =>
    cells.map((cell) => cell.glyph).sort().join("")
  assert.equal(
    glyphsOf(early),
    glyphsOf(late),
    "reduced motion still animates through the death frames instead of holding the last one",
  )
})

test("deathExtraTicks is zero up to a 2-tile body, and scales with the ring past it", () => {
  // Owner playtest, 2026-08-23: "for the giant colossus, it needs to take multiple turns, perhaps
  // even 6 or 12 turns to complete." 1x1/2x1/2x2 keep fx.death.collapse's original duration exactly;
  // the 3x3 colossus and 5x2 leviathan land on the owner's own two numbers, not tuned to hit them
  // after the fact - deathExtraTicks' own doc comment derives both from deathRingOutset.
  assert.equal(deathExtraTicks(1, 1), 0)
  assert.equal(deathExtraTicks(2, 1), 0)
  assert.equal(deathExtraTicks(2, 2), 0)
  assert.equal(deathExtraTicks(3, 3), 4)
  assert.equal(deathExtraTicks(5, 2), 8)
})

test("a small footprint's death ring is unaffected: still silent past the loudest 45%", () => {
  // Regression guard for the outset<=1 branch bigDeathScatter must never touch - fx.death.collapse's
  // ring has always stopped at progress 0.45 for everything up to a 2-tile body, and this is the
  // one invariant a big-body branch point placed just above that line could quietly break.
  const deathRecipe = EFFECT_RECIPES["fx.death.collapse"]
  assert.ok(deathRecipe !== undefined)
  for (const [width, height] of [
    [1, 1],
    [2, 1],
    [2, 2],
  ] as const) {
    const instance: EffectInstance = {
      recipe: "fx.death.collapse",
      band: "effects",
      startMs: 0,
      durationMs: 320,
      origin: { x: 10, y: 6 },
      family: "citizen",
      params: { width, height },
    }
    const settled: number = deathRecipe(instance, context({ timeMs: 200, reducedMotion: false })).length
    assert.equal(
      settled,
      width * height,
      `a ${width}x${height} death painted ${settled} cells past progress 0.45, expected exactly ` +
        `${width * height} (the interior fill alone, no ring)`,
    )
  }
})

test("a big body's death moves through a shockwave, then flying debris, before it settles", () => {
  // Owner playtest, 2026-08-23: "an explosion that goes from the middle towards the radius, then
  // smaller explosions, and pieces being broken around, ending up in multiple debris." Three beats,
  // asserted in order, on the 3x3 colossus footprint - the smallest body that earns bigDeathScatter.
  const deathRecipe = EFFECT_RECIPES["fx.death.collapse"]
  assert.ok(deathRecipe !== undefined)
  const width = 3
  const height = 3
  const origin = { x: 10, y: 6 }
  const tickMs = 1000 / 12
  const durationMs = 320 + deathExtraTicks(width, height) * tickMs
  const instance: EffectInstance = {
    recipe: "fx.death.collapse",
    band: "effects",
    startMs: 0,
    durationMs,
    origin,
    family: "citizen",
    params: { width, height },
  }

  const outsideFootprint = (tile: { x: number; y: number }): boolean =>
    tile.x < origin.x || tile.x >= origin.x + width || tile.y < origin.y || tile.y >= origin.y + height

  // The same dx/dy footprintRing itself uses, so "beyond the old ring" means exactly what the ring
  // it is being compared against means.
  const outsetOf = (tile: { x: number; y: number }): number => {
    const dx =
      tile.x < origin.x
        ? origin.x - tile.x
        : tile.x >= origin.x + width
          ? tile.x - (origin.x + width - 1)
          : 0
    const dy =
      tile.y < origin.y
        ? origin.y - tile.y
        : tile.y >= origin.y + height
          ? tile.y - (origin.y + height - 1)
          : 0
    return Math.max(dx, dy)
  }

  const cellsAt = (timeMs: number): readonly PositionedCell[] =>
    deathRecipe(instance, context({ timeMs, reducedMotion: false }))
  const outsideTilesAt = (timeMs: number): Set<string> =>
    new Set(
      cellsAt(timeMs)
        .filter((cell) => outsideFootprint(cell.tile))
        .map((cell) => `${cell.tile.x},${cell.tile.y}`),
    )

  // Beat 1 - the shockwave: debris outside the footprint appears almost immediately, well before
  // the loudest-hit window (progress 0.45) a small body's flat ring is confined to.
  const shockwave = outsideTilesAt(durationMs * 0.05)
  assert.ok(shockwave.size > 0, "no shockwave cell appeared in the first 5% of a big body's death")

  // Beat 2 - flying pieces: the set of off-footprint tiles keeps changing shape as progress moves
  // through the launch/flight window, which a static ring never does.
  const samples = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7].map((fraction) => outsideTilesAt(durationMs * fraction))
  const distinctFrames = new Set(samples.map((tiles) => [...tiles].sort().join("|"))).size
  assert.ok(
    distinctFrames > 1,
    "the off-footprint debris never changes shape - it reads as a static ring, not flying pieces",
  )

  // Beat 3 - settled: once every piece has long finished travelling, some debris has come to rest
  // beyond the old fixed ring radius, not swept into the same tidy circle every death used to draw.
  // Owner playtest: "some debris may even spam on tiles next to the original unit occupy tiles."
  const outset = deathRingOutset(width, height)
  const settled = cellsAt(durationMs * 0.99)
  assert.ok(
    settled.some((cell) => outsetOf(cell.tile) > outset),
    `no settled debris landed beyond the old ring radius (outset ${outset})`,
  )
})

test("reduced motion drops a big body's shockwave and flight, but keeps its debris landed", () => {
  // ascii-effects.md 4: reduced motion keeps impact and settle, drops travel and drift - the
  // shockwave and the flying-debris beats are exactly that, so both should vanish, and every piece
  // should already read as landed, unmoving, for the whole window.
  const deathRecipe = EFFECT_RECIPES["fx.death.collapse"]
  assert.ok(deathRecipe !== undefined)
  const width = 5
  const height = 2
  const origin = { x: 10, y: 6 }
  const tickMs = 1000 / 12
  const durationMs = 320 + deathExtraTicks(width, height) * tickMs
  const instance: EffectInstance = {
    recipe: "fx.death.collapse",
    band: "effects",
    startMs: 0,
    durationMs,
    origin,
    family: "ravel",
    params: { width, height },
  }
  const outsideFootprint = (tile: { x: number; y: number }): boolean =>
    tile.x < origin.x || tile.x >= origin.x + width || tile.y < origin.y || tile.y >= origin.y + height

  const debrisTilesAt = (timeMs: number): string[] =>
    deathRecipe(instance, context({ timeMs, reducedMotion: true }))
      .filter((cell) => outsideFootprint(cell.tile))
      .map((cell) => `${cell.tile.x},${cell.tile.y}`)
      .sort()

  const early = debrisTilesAt(durationMs * 0.01)
  const late = debrisTilesAt(durationMs * 0.99)
  assert.ok(early.length > 0, "reduced motion shows no scattered debris at all for a big body's death")
  assert.deepEqual(early, late, "reduced motion still animates the scatter instead of holding it settled")
})

test("mergeEffectCells passes a lone cell through untouched", () => {
  // By far the common case, most tiles most ticks: nothing to resolve, nothing should change.
  const lone: EffectCellSource = {
    band: "effects",
    cell: { tile: { x: 3, y: 4 }, glyph: "*", role: "fx.blast", bold: true },
  }
  assert.deepEqual(mergeEffectCells([lone]), [lone])
})

test("mergeEffectCells: two lighting cells on one tile stack brighter than either alone", () => {
  // Owner playtest, 2026-08-23: "pure lighting effects... can stack with intensity and duration...
  // the white color can stack and take longer to resolve, then dim slowly."
  const tile = { x: 5, y: 5 }
  const single = mergeEffectCells([
    { band: "highlights", cell: { tile, glyph: "", role: "fx.flash", bold: true } },
  ])
  const stacked = mergeEffectCells([
    { band: "highlights", cell: { tile, glyph: "", role: "fx.flash", bold: true } },
    { band: "highlights", cell: { tile, glyph: "", role: "fx.flash", bold: true } },
  ])
  assert.equal(single.length, 1)
  assert.equal(stacked.length, 1)
  const singleCell = single[0]?.cell
  const stackedCell = stacked[0]?.cell
  assert.ok(singleCell !== undefined && stackedCell !== undefined)
  assert.equal(singleCell.inverse ?? false, false, "one flash alone should not already be at max weight")
  assert.equal(stackedCell.inverse, true, "two simultaneous flashes should read at the top of the scale")
  assert.equal(stackedCell.glyph, "", "a stacked lighting cell is still glyphless - an attribute, never a glyph")

  // Three stacked, all dim, never exceed the same ceiling - "stacking" saturates, it does not run away.
  const dim = { tile, glyph: "", role: "fx.flash" as const, dim: true }
  const manyDim = mergeEffectCells([1, 2, 3].map(() => ({ band: "highlights" as const, cell: dim })))
  assert.equal(manyDim.length, 1)
  assert.equal(manyDim[0]?.cell.dim, false, "three simultaneous dim flashes should already be brighter than one dim flash")
})

test("mergeEffectCells: a single lighting cell keeps its own weight, not an inflated one", () => {
  const dim: EffectCellSource = {
    band: "highlights",
    cell: { tile: { x: 1, y: 1 }, glyph: "", role: "fx.flash", dim: true },
  }
  const resolved = mergeEffectCells([dim])[0]?.cell
  assert.ok(resolved !== undefined)
  assert.equal(resolved.dim, true)
  assert.equal(resolved.bold ?? false, false)
  assert.equal(resolved.inverse ?? false, false)
})

test("mergeEffectCells: two particles merge through the table when a pair is defined", () => {
  const tile = { x: 8, y: 2 }
  const merged = mergeEffectCells([
    { band: "effects", cell: { tile, glyph: ".", role: "fx.debris", dim: true } },
    { band: "effects", cell: { tile, glyph: ":", role: "fx.debris" } },
  ])
  assert.equal(merged.length, 1)
  assert.equal(merged[0]?.cell.glyph, ";", "the owner's own example pair - '.' and ':' - did not merge")

  // Sorted-pair lookup: order of submission should not change which merge fires.
  const reversed = mergeEffectCells([
    { band: "effects", cell: { tile, glyph: ":", role: "fx.debris" } },
    { band: "effects", cell: { tile, glyph: ".", role: "fx.debris", dim: true } },
  ])
  assert.equal(reversed[0]?.cell.glyph, ";")
})

test("mergeEffectCells: an undefined particle pair falls back to the later cell winning", () => {
  // "when they don't stack, then the latest one renders on top" - the owner's own fallback rule,
  // and exactly composeBands' pre-existing behaviour for anything this table has no entry for.
  const tile = { x: 9, y: 9 }
  const older: EffectCellSource = {
    band: "effects",
    cell: { tile, glyph: "=", role: "fx.debris", dim: true },
  }
  const newer: EffectCellSource = {
    band: "effects",
    cell: { tile, glyph: "z", role: "fx.debris", bold: true },
  }
  const merged = mergeEffectCells([older, newer])
  assert.deepEqual(merged, [newer], "an unmapped pair should be indistinguishable from today's last-write-wins")
})

test("mergeEffectCells: different tiles and different bands never interact", () => {
  const a: EffectCellSource = { band: "effects", cell: { tile: { x: 0, y: 0 }, glyph: "*", role: "fx.blast" } }
  const b: EffectCellSource = { band: "effects", cell: { tile: { x: 1, y: 0 }, glyph: "*", role: "fx.blast" } }
  const c: EffectCellSource = {
    band: "projectiles",
    cell: { tile: { x: 0, y: 0 }, glyph: "-", role: "fx.kinetic" },
  }
  const merged = mergeEffectCells([a, b, c])
  assert.equal(merged.length, 3, "cells on different tiles or bands should never be folded together")
})

test("every glyph PARTICLE_MERGE_TABLE can produce is one printable ASCII character", () => {
  // Same obligation every other glyph this system emits already carries (offendingGlyph, frame.ts).
  const tile = { x: 0, y: 0 }
  const pairs: ReadonlyArray<readonly [string, string]> = [
    [".", ":"],
    [",", "'"],
    ["*", "*"],
    ["/", "\\"],
    ["-", "|"],
  ]
  for (const [a, b] of pairs) {
    const merged = mergeEffectCells([
      { band: "effects", cell: { tile, glyph: a } },
      { band: "effects", cell: { tile, glyph: b } },
    ])
    const glyph = merged[0]?.cell.glyph ?? ""
    assert.equal([...glyph].length, 1, `"${a}"+"${b}" merged to "${glyph}", not one character`)
    const code = glyph.codePointAt(0) ?? 0
    assert.ok(code >= 0x21 && code <= 0x7e, `"${a}"+"${b}" merged to "${glyph}", not printable ASCII`)
  }
})
