// The view — milestone-1-spike-battle.md 3.9, "The view".

import { test } from "node:test"
import assert from "node:assert/strict"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { tilesOf } from "../src/grid/index.ts"
import { buildTimeline } from "../src/cli/timeline.ts"
import { loadScenario } from "../src/scenario/index.ts"
import {
  STYLE_ROLES,
  compositionSize,
  createView,
  entityGlyph,
  frameToAnsi,
  frameToText,
  gateFrame,
  gridOrigin,
  offendingGlyph,
} from "../src/view/index.ts"
import type { CapabilityMode, PulseTimeline, TileWidth } from "../src/view/index.ts"
import type { PlayerId } from "../src/state/types.ts"
import { loadScenarioFile, scenarioFiles } from "./helpers.ts"

async function timelineFor(name: string): Promise<PulseTimeline> {
  const scenario = await loadScenarioFile(name)
  const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed: scenario.seed })
  return buildTimeline(scenario, loaded.state, loaded.registry, scenario.pulseTicks, scenario.seed)
}

test("frames are exactly the composition size, at both tile widths", async () => {
  const timeline = await timelineFor("citizen-mirror-skirmish.map.json")
  const view = createView(timeline)
  for (const tileWidth of [1, 2] as const) {
    const size = compositionSize(tileWidth)
    assert.deepEqual(size, { width: tileWidth === 1 ? 80 : 128, height: 24 })
    const frame = view.snapshotAt(1000, "color16", tileWidth)
    assert.equal(frame.width, size.width)
    assert.equal(frame.height, size.height)
    assert.equal(frame.cells.length, size.width * size.height)
  }
})

test("every glyph in every scenario is one printable ASCII cell", async () => {
  for (const name of scenarioFiles()) {
    const view = createView(await timelineFor(name))
    for (const fraction of [0, 0.25, 0.5, 0.9]) {
      const timeMs = view.durationMs * fraction
      for (const capability of ["monochrome", "color16"] as const) {
        const frame = view.snapshotAt(timeMs, capability, 1)
        assert.equal(offendingGlyph(frame), null, `${name}: a cell was not one ASCII character`)
      }
    }
  }
})

test("identical arguments produce identical frames, and skipping frames changes nothing", async () => {
  const view = createView(await timelineFor("citizen-mirror-skirmish.map.json"))
  const times = [0, 137.5, 1000, 4321.9, 9999]
  const once = times.map((time) => frameToText(view.snapshotAt(time, "color16", 1)))

  // Sample every frame up to the same moments; the frames at those moments must be unchanged.
  for (let step = 0; step < 400; step += 1) view.snapshotAt(step * (1000 / 30), "color16", 1)
  const again = times.map((time) => frameToText(view.snapshotAt(time, "color16", 1)))
  assert.deepEqual(again, once)

  // And in the other direction: sampling backwards produces the same frames too.
  const backwards = [...times].reverse().map((time) => frameToText(view.snapshotAt(time, "color16", 1)))
  assert.deepEqual(backwards, [...once].reverse())
})

test("at a tick boundary every entity stands on the tile the kernel put it on", async () => {
  // The check that catches a compositor with a transposed axis or an off-by-one band: it would pass
  // every other test in this file while drawing a deterministic, correctly sized picture of the
  // wrong fight. Asserted against the event stream, not against the compositor's own inputs.
  for (const name of ["citizen-mirror-skirmish.map.json", "hauler-three-tile-gap.map.json"]) {
    const timeline = await timelineFor(name)
    const view = createView(timeline)
    const positions = new Map<number, { x: number; y: number }>()
    const alive = new Map<number, { contentId: string; player: PlayerId }>()

    for (const event of timeline.events) {
      if (event.kind === "entity.spawned") {
        positions.set(event.ordinal, event.at)
        alive.set(event.ordinal, { contentId: event.contentId, player: event.player })
      }
    }

    const origin = gridOrigin(timeline.grid, 1)
    for (let tick = 0; tick <= view.lastTick; tick += 1) {
      // Replay this tick's events onto the shadow model the assertion trusts.
      for (const event of timeline.events) {
        if (event.tick !== tick) continue
        if (event.kind === "entity.moved") positions.set(event.ordinal, event.to)
        if (event.kind === "entity.died" || event.kind === "structure.destroyed") {
          alive.delete(event.ordinal)
        }
      }
      if (tick % 7 !== 0 && tick !== view.lastTick) continue

      const frame = view.snapshotAt(tick * view.tickDurationMs, "monochrome", 1)
      for (const [ordinal, { contentId, player }] of alive) {
        const anchor = positions.get(ordinal)
        if (anchor === undefined) continue
        const definition = FIXTURE_REGISTRY.get(contentId)
        for (const offset of definition.footprint) {
          const tileX: number = anchor.x + offset.x
          const tileY: number = anchor.y + offset.y
          const cell = frame.cells[(origin.row + tileY) * frame.width + (origin.column + tileX)]
          assert.ok(cell !== undefined, `${name}: no cell at ${tileX},${tileY}`)
          // The exact glyph the art table says belongs on this tile of this body, not merely
          // "something letter-shaped": the old character class had to be widened by hand every time
          // a unit was drawn with a new symbol, and a class wide enough to cover `[b]`, `/_\` and
          // `<*=*>` stops excluding much of anything. The corruption law guarantees no effect can
          // overwrite it (engine.md 9.4), so this is exact.
          assert.equal(
            cell.glyph,
            entityGlyph(contentId, player, offset),
            `${name}: tick ${tick}: entity #${ordinal} (${contentId}) is drawn wrong at ` +
              `(${tileX},${tileY})`,
          )
        }
      }
    }
  }
})

test("monochrome renders every scenario, and no cell depends on colour to exist", async () => {
  for (const name of scenarioFiles()) {
    const view = createView(await timelineFor(name))
    const timeMs = view.durationMs / 2
    const mono = view.snapshotAt(timeMs, "monochrome", 1)
    const colour = view.snapshotAt(timeMs, "color16", 1)
    assert.equal(
      frameToText(mono),
      frameToText(colour),
      `${name}: the glyphs differ between monochrome and colour`,
    )
    // Monochrome keeps attributes — bold and dim are not colour — but must emit no colour code.
    const escape = String.fromCharCode(27)
    const codes = (text: string): number[] =>
      [...text.matchAll(new RegExp(`${escape}\\[([0-9;]*)m`, "g"))].flatMap((match) =>
        (match[1] ?? "").split(";").filter((part) => part !== "").map(Number),
      )
    const isColour = (code: number): boolean =>
      (code >= 30 && code <= 49) || (code >= 90 && code <= 107)
    assert.ok(
      !codes(frameToAnsi(mono, "monochrome")).some(isColour),
      `${name}: monochrome emitted a colour code`,
    )
    assert.ok(
      codes(frameToAnsi(colour, "color16")).some(isColour),
      `${name}: colour emitted no colour at all`,
    )
  }
})

test("the resize gate is drawn below the composition size", () => {
  const required = compositionSize(1)
  const frame = gateFrame(40, 12, required)
  assert.equal(frame.width, 40)
  assert.equal(frame.height, 12)
  const text = frameToText(frame)
  assert.match(text, /TERMINAL TOO SMALL/)
  assert.match(text, /need 80 x 24/)
  assert.match(text, /have 40 x 12/)
  assert.equal(offendingGlyph(frame), null)
})

test("the compositor only ever emits roles from the committed vocabulary", async () => {
  const view = createView(await timelineFor("structure-destruction.map.json"))
  const frame = view.snapshotAt(view.durationMs * 0.9, "color16", 1)
  const roles = new Set<string>()
  for (const cell of frame.cells) {
    if (cell.style.fgRole !== undefined) roles.add(cell.style.fgRole)
    if (cell.style.bgRole !== undefined) roles.add(cell.style.bgRole)
  }
  assert.ok(roles.size > 3)
  for (const role of roles) {
    assert.ok(
      (STYLE_ROLES as readonly string[]).includes(role),
      `the compositor invented the role "${role}"`,
    )
  }
})

test("the view and the headless run agree on the fight they describe", async () => {
  const { resolveScenario } = await import("./helpers.ts")
  for (const name of scenarioFiles()) {
    const headless = await resolveScenario(name)
    const timeline = await timelineFor(name)
    assert.equal(timeline.stateHash, headless.run.stateHash, `${name}: watch and run disagree`)
    assert.equal(timeline.eventsHash, headless.run.eventsHash, `${name}: watch and run disagree`)
  }
})

test("interpolation is presentation only: a mid-tick frame never changes the timeline", async () => {
  const timeline = await timelineFor("citizen-mirror-skirmish.map.json")
  const view = createView(timeline)
  const before = timeline.states.map((state) => state.tick).join(",")
  const tick = 100
  const onBoundary = frameToText(view.snapshotAt(tick * view.tickDurationMs, "monochrome", 1))
  const midTick = frameToText(view.snapshotAt((tick + 0.75) * view.tickDurationMs, "monochrome", 1))
  assert.notEqual(midTick, onBoundary, "nothing moved between ticks, so nothing was interpolated")
  assert.equal(timeline.states.map((state) => state.tick).join(","), before)
  assert.equal(
    frameToText(view.snapshotAt(tick * view.tickDurationMs, "monochrome", 1)),
    onBoundary,
    "sampling mid-tick changed a later frame",
  )
})

test("tile width two draws the same tiles, twice as wide", async () => {
  const view = createView(await timelineFor("melee-kill.map.json"))
  const capability: CapabilityMode = "monochrome"
  const narrow = view.snapshotAt(2000, capability, 1 as TileWidth)
  const wide = view.snapshotAt(2000, capability, 2 as TileWidth)
  const narrowOrigin = gridOrigin({ width: 24, height: 12, tiles: [] }, 1)
  const wideOrigin = gridOrigin({ width: 24, height: 12, tiles: [] }, 2)
  for (let x = 0; x < 24; x += 1) {
    const narrowCell = narrow.cells[narrowOrigin.row * narrow.width + narrowOrigin.column + x]
    const wideCell = wide.cells[wideOrigin.row * wide.width + wideOrigin.column + x * 2]
    assert.equal(narrowCell?.glyph, wideCell?.glyph, `column ${x} differs between tile widths`)
  }
})


test("a ranged kill's target stays on screen until its own tracer lands", async () => {
  // Owner playtest, 2026-08-22: "I still see projectiles set from 'm' (marksman) but the enemy dies
  // instantly while the projectile arrives later." `state.entities` drops a dead entity the instant
  // it dies, but `fx.ranged.tracer` keeps travelling for the rest of the flight window the kernel
  // recorded on the attack - so without a held corpse, the target's glyph vanished before the shot
  // that killed it visibly arrived. Walks every same-tick ranged kill in citizens-versus-ravels
  // (there is always at least one - the fixture is built to be a real, populated fight) and checks
  // the target's own glyph is still drawn through the hold, then gone the instant the impact beat
  // that fx.death.collapse/fx.impact.burst already wait for arrives.
  const { resolveScenario } = await import("./helpers.ts")
  const resolved = await resolveScenario("citizens-versus-ravels.map.json")
  const timeline = await timelineFor("citizens-versus-ravels.map.json")
  const view = createView(timeline)
  const tickMs = view.tickDurationMs
  const origin = gridOrigin(timeline.grid, 1)

  const launches = resolved.run.events.filter(
    (event) => event.kind === "attack.launched" && event.attackKind === "ranged",
  )
  const deaths = new Map(
    resolved.run.events
      .filter((event) => event.kind === "entity.died" || event.kind === "structure.destroyed")
      .map((event) => [event.ordinal, event]),
  )

  let checked = 0
  for (const launch of launches) {
    if (launch.kind !== "attack.launched") continue
    const death = deaths.get(launch.targetOrdinal)
    if (death === undefined || (death.kind !== "entity.died" && death.kind !== "structure.destroyed")) {
      continue
    }
    if (death.tick !== launch.tick || launch.flightWindowTicks <= 0) continue

    const definition = resolved.registry.get(death.contentId)
    const expectedGlyph = entityGlyph(death.contentId, death.player, { x: 0, y: 0 })
    const cellAt = (timeMs: number): string => {
      const frame = view.snapshotAt(timeMs, "monochrome", 1)
      const row = origin.row + death.at.y
      const column = origin.column + death.at.x
      return frame.cells[row * frame.width + column]?.glyph ?? ""
    }

    const deathAtMs = death.tick * tickMs
    const impactAtMs = (death.tick + launch.flightWindowTicks) * tickMs
    assert.equal(
      cellAt(deathAtMs + 1),
      expectedGlyph,
      `${death.entity} was not drawn just after dying, still in flight`,
    )
    assert.equal(
      cellAt(impactAtMs - 1),
      expectedGlyph,
      `${death.entity} disappeared before its own tracer landed`,
    )
    assert.notEqual(
      cellAt(impactAtMs + 1),
      expectedGlyph,
      `${death.entity} was still drawn after the impact beat it should have vanished at`,
    )
    checked += 1
  }
  assert.ok(checked > 0, "the fixture produced no same-tick ranged kill to check")
})
