// The view — docs/system-design/presentation.md. A Pulse drawn as the game draws it: the Build Phase screen's
// Battle Round (`tests/battle-round-frame.ts`).

import { test } from "node:test"
import assert from "node:assert/strict"
import { MIN_VIEWPORT } from "../src/build/camera.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { buildTimeline } from "../src/cli/timeline.ts"
import { openBattle } from "../src/skirmish/opening/index.ts"
import { STYLE_ROLES, entityGlyph, frameToAnsi, frameToText, gateFrame, offendingGlyph } from "../src/view/index.ts"
import type { PulseTimeline } from "../src/view/index.ts"
import { MENU_SIZE } from "../src/view/menu.ts"
import type { PlayerId } from "../src/engine/state/types.ts"
import { battleRoundScreen } from "./battle-round-frame.ts"
import { isColourCode, loadSandbox, sandboxFiles, sgrCodes } from "./helpers.ts"

async function timelineFor(name: string): Promise<PulseTimeline> {
  const opening = await loadSandbox(name)
  const loaded = openBattle(opening, { registry: FIXTURE_REGISTRY, seed: opening.seed })
  return buildTimeline(opening, loaded.state, loaded.registry, opening.pulseTicks, opening.seed)
}

test("a Battle Round at the 80 x 24 floor is exactly 80 x 24, a column for each tile, the minimum viewport whole", async () => {
  const timeline = await timelineFor("small-multicell-skirmish.save.json")
  const screen = battleRoundScreen(timeline)
  const frame = screen.frameAt(1000, "color256")
  assert.deepEqual([frame.width, frame.height], [MENU_SIZE.width, MENU_SIZE.height])
  assert.equal(frame.cells.length, MENU_SIZE.width * MENU_SIZE.height)
  // The sandbox's 48 x 16 Grid is the minimum viewport, all of it on screen, one cell a tile.
  assert.deepEqual([timeline.grid.width, timeline.grid.height], [MIN_VIEWPORT.width, MIN_VIEWPORT.height])
  assert.ok(screen.layout.viewport.width >= MIN_VIEWPORT.width && screen.layout.viewport.height >= MIN_VIEWPORT.height)
  const north = screen.cellOf({ x: 0, y: 0 })
  const south = screen.cellOf({ x: timeline.grid.width - 1, y: timeline.grid.height - 1 })
  assert.deepEqual([south.x - north.x + 1, south.y - north.y + 1], [timeline.grid.width, timeline.grid.height])
  assert.ok(north.x > 0 && north.y > 0 && south.x < frame.width - 1 && south.y < frame.height - 1)
})

test("every glyph in every sandbox is one printable ASCII cell", async () => {
  for (const name of sandboxFiles()) {
    const timeline = await timelineFor(name)
    const screen = battleRoundScreen(timeline)
    const durationMs = timeline.states.length * (1000 / timeline.ticksPerSecond)
    for (const fraction of [0, 0.25, 0.5, 0.9]) {
      const timeMs = durationMs * fraction
      for (const colors of ["monochrome", "color256"] as const) {
        const frame = screen.frameAt(timeMs, colors)
        assert.equal(offendingGlyph(frame), null, `${name}: a cell was not one ASCII character`)
      }
    }
  }
})

test("identical arguments produce identical frames, and skipping frames changes nothing", async () => {
  const screen = battleRoundScreen(await timelineFor("citizen-mirror-skirmish.save.json"))
  const times = [0, 137.5, 1000, 4321.9, 9999]
  const once = times.map((time) => frameToText(screen.frameAt(time, "color256")))

  // Sample every frame up to the same moments; the frames at those moments must be unchanged.
  for (let step = 0; step < 400; step += 1) screen.frameAt(step * (1000 / 30), "color256")
  const again = times.map((time) => frameToText(screen.frameAt(time, "color256")))
  assert.deepEqual(again, once)

  // And in the other direction: sampling backwards produces the same frames too.
  const backwards = [...times].reverse().map((time) => frameToText(screen.frameAt(time, "color256")))
  assert.deepEqual(backwards, [...once].reverse())
})

test("at a tick boundary every entity stands on the tile the kernel put it on", async () => {
  // The check that catches a compositor with a transposed axis or an off-by-one band: it would pass
  // every other test in this file while drawing a deterministic, correctly sized picture of the
  // wrong fight. Asserted against the event stream, not against the compositor's own inputs.
  for (const name of ["citizen-mirror-skirmish.save.json", "hauler-three-tile-gap.save.json"]) {
    const timeline = await timelineFor(name)
    const screen = battleRoundScreen(timeline)
    const tickDurationMs = 1000 / timeline.ticksPerSecond
    const lastTick = timeline.states.length - 1
    const positions = new Map<number, { x: number; y: number }>()
    const alive = new Map<number, { contentId: string; player: PlayerId }>()

    for (const event of timeline.events) {
      if (event.kind === "entity.spawned") {
        positions.set(event.ordinal, event.at)
        alive.set(event.ordinal, { contentId: event.contentId, player: event.player })
      }
    }

    for (let tick = 0; tick <= lastTick; tick += 1) {
      // Replay this tick's events onto the shadow model the assertion trusts.
      for (const event of timeline.events) {
        if (event.tick !== tick) continue
        if (event.kind === "entity.moved") positions.set(event.ordinal, event.to)
        if (event.kind === "entity.died" || event.kind === "structure.destroyed") {
          alive.delete(event.ordinal)
        }
      }
      if (tick % 7 !== 0 && tick !== lastTick) continue

      const frame = screen.frameAt(tick * tickDurationMs, "monochrome")
      for (const [ordinal, { contentId, player }] of alive) {
        const anchor = positions.get(ordinal)
        if (anchor === undefined) continue
        const definition = FIXTURE_REGISTRY.get(contentId)
        for (const offset of definition.footprint) {
          const tileX: number = anchor.x + offset.x
          const tileY: number = anchor.y + offset.y
          const at = screen.cellOf({ x: tileX, y: tileY })
          const cell = frame.cells[at.y * frame.width + at.x]
          assert.ok(cell !== undefined, `${name}: no cell at ${tileX},${tileY}`)
          // The exact glyph the art table says belongs on this tile of this body, not merely
          // "something letter-shaped": the old character class had to be widened by hand every time
          // a unit was drawn with a new symbol, and a class wide enough to cover `[b]`, `/_\` and
          // `<*=*>` stops excluding much of anything. The corruption law guarantees no effect can
          // overwrite it (docs/system-design/presentation.md, the cell frame), so this is exact.
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

test("monochrome renders every sandbox, and no cell depends on colour to exist", async () => {
  for (const name of sandboxFiles()) {
    const timeline = await timelineFor(name)
    const screen = battleRoundScreen(timeline)
    const timeMs = (timeline.states.length * (1000 / timeline.ticksPerSecond)) / 2
    const mono = screen.frameAt(timeMs, "monochrome")
    const colour = screen.frameAt(timeMs, "color256")
    assert.equal(
      frameToText(mono),
      frameToText(colour),
      `${name}: the glyphs differ between monochrome and colour`,
    )
    // Monochrome keeps attributes — bold and dim are not colour — but must emit no colour code.
    assert.ok(
      !sgrCodes(frameToAnsi(mono, "monochrome")).some(isColourCode),
      `${name}: monochrome emitted a colour code`,
    )
    assert.ok(
      sgrCodes(frameToAnsi(colour, "color256")).some(isColourCode),
      `${name}: colour emitted no colour at all`,
    )
  }
})

test("frameToAnsi resolves CellStyle.fade only at color256/truecolor, never at monochrome", () => {
  // The transparency scalar (docs/system-design/presentation.md, the cell frame), tested at the actual ANSI-conversion
  // boundary rather than only at sgrFor directly (roles.test.ts) - a hand-built one-cell frame, the
  // same way this file's other frame-shaped tests do, so this exercises frame.ts's own sgrOf reading
  // `style.fade` and forwarding it, not just roles.ts's function in isolation.
  const cellWithFade = (fade: number) => ({
    width: 1,
    height: 1,
    cells: [{ glyph: "@", style: { fgRole: "fx.flash" as const, fade } }],
  })
  const unfaded = frameToAnsi(cellWithFade(0), "truecolor")
  const faded = frameToAnsi(cellWithFade(1), "truecolor")
  assert.notEqual(unfaded, faded, "truecolor did not change output between fade 0 and fade 1")

  assert.notEqual(frameToAnsi(cellWithFade(0), "color256"), frameToAnsi(cellWithFade(1), "color256"), "color256 did not change output between fade 0 and fade 1")
  assert.equal(
    frameToAnsi(cellWithFade(0), "monochrome"),
    frameToAnsi(cellWithFade(1), "monochrome"),
    "monochrome should render identically at fade 0 and fade 1 - it has no representable effect there",
  )
})

test("the resize gate is drawn below the 80 x 24 floor", () => {
  const required = MENU_SIZE
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
  const timeline = await timelineFor("structure-destruction.save.json")
  const frame = battleRoundScreen(timeline).frameAt(timeline.states.length * (1000 / timeline.ticksPerSecond) * 0.9, "color256")
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

// It plays every map in sandboxes/ twice, once headless and once for the view: longer than Bun's five seconds a
// test, so it says how long it may take.
test("the view and the headless run agree on the fight they describe", { timeout: 60_000 }, async () => {
  const { playSandbox } = await import("./helpers.ts")
  for (const name of sandboxFiles()) {
    const headless = await playSandbox(name)
    const timeline = await timelineFor(name)
    assert.equal(timeline.stateHash, headless.run.stateHash, `${name}: watch and run disagree`)
    assert.equal(timeline.eventsHash, headless.run.eventsHash, `${name}: watch and run disagree`)
  }
})

test("interpolation is presentation only: a mid-tick frame never changes the timeline", async () => {
  const timeline = await timelineFor("citizen-mirror-skirmish.save.json")
  const screen = battleRoundScreen(timeline)
  const tickDurationMs = 1000 / timeline.ticksPerSecond
  const before = timeline.states.map((state) => state.tick).join(",")
  const tick = 100
  const onBoundary = frameToText(screen.frameAt(tick * tickDurationMs, "monochrome"))
  const midTick = frameToText(screen.frameAt((tick + 0.75) * tickDurationMs, "monochrome"))
  assert.notEqual(midTick, onBoundary, "nothing moved between ticks, so nothing was interpolated")
  assert.equal(timeline.states.map((state) => state.tick).join(","), before)
  assert.equal(
    frameToText(screen.frameAt(tick * tickDurationMs, "monochrome")),
    onBoundary,
    "sampling mid-tick changed a later frame",
  )
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
  const { playSandbox } = await import("./helpers.ts")
  const resolved = await playSandbox("citizens-versus-ravels.save.json")
  const timeline = await timelineFor("citizens-versus-ravels.save.json")
  const screen = battleRoundScreen(timeline)
  const tickMs = 1000 / timeline.ticksPerSecond

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
    const at = screen.cellOf(death.at)
    const cellAt = (timeMs: number): string => {
      const frame = screen.frameAt(timeMs, "monochrome")
      return frame.cells[at.y * frame.width + at.x]?.glyph ?? ""
    }

    const deathAtMs = death.tick * tickMs
    const impactAtMs = (death.tick + launch.flightWindowTicks) * tickMs
    // Two shots that kill it on one tick can fly for different times: it is held until the last of them lands.
    const lastFlight = Math.max(
      ...launches.flatMap((other) =>
        other.kind === "attack.launched" && other.tick === launch.tick && other.targetOrdinal === launch.targetOrdinal ? [other.flightWindowTicks] : [],
      ),
    )
    const lastImpactAtMs = (death.tick + lastFlight) * tickMs
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
    // By its glyph and its style both: the impact's own burst may land on the tile in the unit's own letter (an "X",
    // a runner's), and that is the shot landing, not the unit still standing.
    const cellKeyAt = (timeMs: number): string => {
      const frame = screen.frameAt(timeMs, "monochrome")
      const cell = frame.cells[at.y * frame.width + at.x]
      return JSON.stringify([cell?.glyph, cell?.style])
    }
    assert.notEqual(
      cellKeyAt(lastImpactAtMs + 1),
      cellKeyAt(deathAtMs + 1),
      `${death.entity} was still drawn after the impact beat it should have vanished at`,
    )
    checked += 1
  }
  assert.ok(checked > 0, "the fixture produced no same-tick ranged kill to check")
})
