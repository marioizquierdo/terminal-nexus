// A sandbox is a testing ground, like a unit test's context (docs/system-design/sandboxes.md): a slice of the Grid,
// not the game. So every unit and building the game has must stand in the smallest slice there is, with none of what
// the game builds around it (a banner, a Nexus, an enemy Nexus, a Commander, credits, a round number, a lane), and
// run for some ticks without throwing, leaving a state hash that is the same every run. A new content id is covered
// the moment it exists: this test loops over the registry, so a unit that breaks in a sandbox fails the suite.
//
// Why no dependency needs a mock (each is a case here, and the page says how it is handled):
//   banner         the match layer sets a side's target from it (`src/match/banner.ts`); the kernel reads `targets`, and a side
//                  with none heads for the enemy Nexus, else engages the nearest enemy
//   Nexus          its march line starts at its Grid Nexus, and a side with none marches from where it stands
//   enemy Nexus    a side with none engages the nearest enemy
//   Commander      a Commander is a regular troop; `Body.commander` is read by abilities only
//   credits        an ability `note`s them as an event; the rules between rounds add them up, the kernel never reads them
//   round, lane    the kernel has neither: a round is the match layer's count, and the Grid has no lanes
//   Pulse          a sandbox's state starts the kernel directly

import { test } from "node:test"
import assert from "node:assert/strict"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import type { PlacementBlock, PlacementEntry, BattleOpening } from "../src/skirmish/opening/index.ts"
import { buildLog } from "../src/report/index.ts"
import { playSandboxRound } from "../src/skirmish/sandbox-round.ts"
import { ARMY_FILES } from "../src/shipped.ts"
import type { PlayerId, TargetArea } from "../src/state/types.ts"

const WIDTH = 48
const HEIGHT = 24
const TICKS = 120
const TROOPER = "unit.citizen.trooper"
const NEXUS: Readonly<Record<PlayerId, string>> = { A: "structure.citizen.nexus", B: "structure.ravel.nexus" }

type Side = Readonly<{ at: { x: number; y: number }; content: string }>

/** The smallest slice: open ground, and whatever each side is handed, a content id at a centre tile. */
function slice(id: string, sides: Readonly<Partial<Record<PlayerId, readonly Side[]>>>, targets: Readonly<Partial<Record<PlayerId, TargetArea>>> = {}): BattleOpening {
  const placements: Partial<Record<PlayerId, PlacementBlock>> = {}
  for (const player of ["A", "B"] as const) {
    const given = sides[player]
    if (given === undefined) continue
    // A legend of one symbol each, so the block needs no shared grid.
    const legend: Record<string, PlacementEntry> = {}
    const rows: string[][] = Array.from({ length: HEIGHT }, () => Array.from({ length: WIDTH }, () => " "))
    given.forEach((entry, index) => {
      const symbol = String.fromCharCode(97 + index)
      legend[symbol] = { content: entry.content }
      rows[entry.at.y]![entry.at.x] = symbol
    })
    placements[player] = { rows: rows.map((row) => row.join("").trimEnd()), legend }
  }
  return {
    id,
    name: id,
    grid: { width: WIDTH, height: HEIGHT },
    seed: 7,
    pulseTicks: TICKS,
    terrain: Array.from({ length: HEIGHT }, () => ".".repeat(WIDTH)),
    terrainLegend: { ".": "terrain.plain" },
    placements,
    ...(Object.keys(targets).length === 0 ? {} : { targets }),
  }
}

/** What a sandbox without the game around it can be missing, as the slice each case builds for `content` on side `side`. */
function cases(content: string, side: PlayerId): ReadonlyArray<readonly [string, BattleOpening]> {
  const other: PlayerId = side === "A" ? "B" : "A"
  // Side A stands west of the middle, side B east of it, each with its Nexus behind it and the other's across the Grid.
  const at = { x: side === "A" ? 16 : 31, y: 12 }
  const enemyAt = { x: side === "A" ? 28 : 19, y: 12 }
  const home = { x: side === "A" ? 6 : 41, y: 12 }
  const away = { x: side === "A" ? 41 : 6, y: 12 }
  const goal: TargetArea = { x: side === "A" ? 36 : 8, y: 10, width: 4, height: 4 }
  return [
    ["alone: no enemy, no Nexus, no banner", slice("spawn-alone", { [side]: [{ at, content }] })],
    ["against one trooper, no banner and no Nexus", slice("spawn-versus", { [side]: [{ at, content }], [other]: [{ at: enemyAt, content: TROOPER }] })],
    [
      "with both Nexuses",
      slice("spawn-nexuses", { [side]: [{ at, content }, { at: home, content: NEXUS[side] }], [other]: [{ at: away, content: NEXUS[other] }] }),
    ],
    ["sent to a target (a mock banner) with no enemy at all", slice("spawn-banner", { [side]: [{ at, content }] }, { [side]: goal })],
  ]
}

const ids = FIXTURE_REGISTRY.ids()

test("the registry holds every unit and building the army files name", () => {
  // The loop below covers what the registry holds; this keeps it from quietly covering less than the game has.
  const named = new Set<string>()
  const walk = (value: unknown): void => {
    if (typeof value === "string") {
      if (/^(unit|structure)\.[a-z]+\.[a-z]+$/.test(value)) named.add(value)
    } else if (Array.isArray(value)) value.forEach(walk)
    else if (value !== null && typeof value === "object") Object.values(value).forEach(walk)
  }
  ARMY_FILES.forEach(walk)
  assert.ok(named.size > 20, "the walk found almost nothing: has the army files' shape changed?")
  const missing = [...named].filter((id) => !FIXTURE_REGISTRY.has(id))
  assert.deepEqual(missing, [], `named by an army file and not in the registry: ${missing.join(", ")}`)
})

test("every content id stands in a sandbox with nothing of the game around it, on either side, and runs without throwing", { timeout: 120_000 }, () => {
  for (const content of ids) {
    for (const side of ["A", "B"] as const) {
      for (const [label, opening] of cases(content, side)) {
        const where = `${content} as side ${side}, ${label}`
        let round
        try {
          round = playSandboxRound(opening)
        } catch (error) {
          assert.fail(`${where}: threw ${error instanceof Error ? error.message : String(error)}`)
        }
        const final = round.run.finalState
        assert.ok(final.tick <= TICKS, `${where}: ran past its ticks`)
        const lines = buildLog(round.report, "warn")
        assert.ok(!lines.some((line) => line.includes(" ERROR ")), `${where}: the report has an ERROR:\n${lines.join("\n")}`)
        const ordinals = new Set<number>()
        for (const entity of final.entities) {
          assert.ok(!ordinals.has(entity.ordinal), `${where}: ordinal ${entity.ordinal} twice`)
          ordinals.add(entity.ordinal)
          const definition = FIXTURE_REGISTRY.get(entity.contentId)
          assert.ok(entity.hp > 0 && entity.hp <= definition.maxHp, `${where}: ${entity.id} has ${entity.hp} health`)
          assert.ok(entity.anchor.x >= 0 && entity.anchor.y >= 0 && entity.anchor.x < WIDTH && entity.anchor.y < HEIGHT, `${where}: ${entity.id} left the Grid`)
        }
      }
    }
  }
})

test("every content id's sandbox leaves the same state and event hashes on every run", { timeout: 120_000 }, () => {
  // Two runs in one process prove the run repeats. That Node and Bun agree is the suite's two runtimes' to show
  // (`npm test`, `npm run test:bun`): a digest of every hash below was equal on both when this test was written, and is
  // not pinned, since a new unit would move it.
  for (const content of ids) {
    for (const side of ["A", "B"] as const) {
      for (const [label, opening] of cases(content, side)) {
        const first = playSandboxRound(opening).run
        const again = playSandboxRound(opening).run
        assert.equal(again.stateHash, first.stateHash, `${content} as side ${side}, ${label}: the state hash moved between two runs`)
        assert.equal(again.eventsHash, first.eventsHash, `${content} as side ${side}, ${label}: the events hash moved between two runs`)
      }
    }
  }
})

test("a unit alone with no enemy and no target idles where it stands, and a side sent to a target goes there", () => {
  const trooper = (label: string): BattleOpening => cases(TROOPER, "A").find(([name]) => name.startsWith(label))![1]
  const alone = playSandboxRound(trooper("alone")).run
  assert.deepEqual(alone.finalState.entities[0]!.anchor, { x: 16, y: 12 }, "a trooper with nothing to do moved")
  assert.equal(alone.finalState.outcome?.reason, "tick-limit", "a lone side ended the round any way but by its ticks: there is no enemy to beat")
  const banner = playSandboxRound(trooper("sent")).run
  const [at] = banner.finalState.entities
  assert.ok(at !== undefined && at.anchor.x >= 30, `a side sent to its target did not go: it stands at x=${at?.anchor.x}`)
})
