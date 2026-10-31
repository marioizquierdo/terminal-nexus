// Trials (docs/system-design/testing-ground.md): the variants a trial makes of a map, and what a trial's battles say.

import { test } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { playTrial, playTrialBattle, trialCells, trialLines, unmet, watchCommand, wilson } from "../src/measure/index.ts"
import type { TrialSpec } from "../src/measure/index.ts"
import { applyVariant, loadScenario, mirrored, shuffled, tuned, VariantError, withArmy } from "../src/scenario/index.ts"
import type { ScenarioDefinition } from "../src/scenario/index.ts"
import { loadScenarioFile, REPO_ROOT } from "./helpers.ts"

/** Who stands where with what, a side at a time: what two openings must share to be the same battle. */
function opening(scenario: ScenarioDefinition): string[] {
  const { state } = loadScenario(scenario, { registry: FIXTURE_REGISTRY })
  return state.entities.map((entity) => `${entity.player} ${entity.contentId} ${entity.anchor.x},${entity.anchor.y}`).sort()
}

test("a map mirrored twice is the map again, multi-tile units and targets included", async () => {
  for (const name of ["heavies-clash.map.json", "engage-lanes-melee-vs-mix.map.json", "small-multicell-skirmish.map.json", "aid-station-repair.map.json"]) {
    const map = await loadScenarioFile(name)
    const twice = mirrored(mirrored(map, FIXTURE_REGISTRY), FIXTURE_REGISTRY)
    assert.deepEqual(opening(twice), opening(map), name)
    assert.deepEqual(twice.targets, map.targets, name)
    assert.deepEqual(twice.terrain, map.terrain, name)
  }
})

test("mirroring swaps the sides end for end: side A's army stands where side B's stood, mirrored", async () => {
  const map = await loadScenarioFile("engage-open-melee-vs-mix.map.json")
  const flipped = mirrored(map, FIXTURE_REGISTRY)
  const width = 48
  const mirror = (line: string): string => {
    const [player, content, at] = line.split(" ") as [string, string, string]
    const [x, y] = at.split(",").map(Number) as [number, number]
    // An anchor is a footprint's north-west tile: mirrored, the footprint's east tile becomes its west one.
    const wide = Math.max(...FIXTURE_REGISTRY.get(content).footprint.map((offset) => offset.x)) + 1
    return `${player === "A" ? "B" : "A"} ${content} ${width - wide - x},${y}`
  }
  assert.deepEqual(opening(flipped), opening(map).map(mirror).sort())
  assert.deepEqual(flipped.targets?.A, { ...map.targets?.B, x: width - (map.targets?.B?.x ?? 0) - (map.targets?.B?.width ?? 0) })
})

test("a shuffle keeps each side's army and its places, and changes who stands where by the seed", async () => {
  // Two kinds of melee unit and one ranged: a shuffle swaps units of a line among that line's places alone.
  const map = withArmy(await loadScenarioFile("engage-gap6-mix-mirror.map.json"), FIXTURE_REGISTRY, "A", [
    { content: "trooper", count: 3 },
    { content: "pikeman", count: 3 },
    { content: "marksman", count: 6 },
  ])
  const places = (lines: string[]): string[] => lines.map((line) => line.replace(/ \S+ /, " ")).sort()
  const kinds = (lines: string[]): string[] => lines.map((line) => line.split(" ").slice(0, 2).join(" ")).sort()
  const one = opening(shuffled(map, FIXTURE_REGISTRY, 1))
  const two = opening(shuffled(map, FIXTURE_REGISTRY, 2))
  assert.deepEqual(places(one), places(opening(map)))
  assert.deepEqual(kinds(one), kinds(opening(map)))
  assert.notDeepEqual(one, two, "two seeds shuffled alike")
  assert.deepEqual(opening(shuffled(map, FIXTURE_REGISTRY, 1)), one, "a shuffle is not a function of its seed")
  // The marksmen keep the places that were the ranged ones', behind; the Nexus keeps its place.
  const ranged = (lines: string[]): string[] => lines.filter((line) => line.includes("marksman")).sort()
  assert.deepEqual(ranged(one), ranged(opening(map)))
  assert.ok(one.includes(opening(map).find((line) => line.includes("nexus") && line.startsWith("A")) as string))
})

test("an army fills a side's one-tile places from the front, and is refused when it is bigger than they are", async () => {
  const map = await loadScenarioFile("engage-open-melee-vs-mix.map.json")
  const made = withArmy(map, FIXTURE_REGISTRY, "A", [
    { content: "skyraider", count: 2 },
    { content: "trooper", count: 3 },
  ])
  const units = opening(made).filter((line) => line.startsWith("A") && !line.includes("nexus"))
  assert.equal(units.length, 5)
  const frontmost = Math.max(...units.map((line) => Number((line.split(" ")[2] as string).split(",")[0])))
  for (const line of units.filter((each) => each.includes("skyraider"))) assert.equal(Number((line.split(" ")[2] as string).split(",")[0]), frontmost)
  assert.throws(() => withArmy(map, FIXTURE_REGISTRY, "A", [{ content: "trooper", count: 13 }]), VariantError)
})

test("a tune changes one number of one content, and a misspelt one is refused", () => {
  const registry = tuned(FIXTURE_REGISTRY, { "trooper.maxHp": "60", "marksman.attack.range": "8" })
  assert.equal(registry.get("unit.citizen.trooper").maxHp, 60)
  assert.equal(registry.get("unit.citizen.marksman").attack?.range, 8)
  assert.equal(FIXTURE_REGISTRY.get("unit.citizen.trooper").maxHp === 60, false, "the shared content changed")
  assert.throws(() => tuned(FIXTURE_REGISTRY, { "trooper.hp": "60" }), /has no "hp"/)
  assert.throws(() => tuned(FIXTURE_REGISTRY, { "nobody.maxHp": "60" }), VariantError)
})

test("a set swaps a side's symbol, or every symbol of a content, for another unit", async () => {
  const map = await loadScenarioFile("engage-gap2-melee-vs-mix.map.json")
  const made = applyVariant(map, FIXTURE_REGISTRY, { set: { "B.marksman": "skyraider" } }).scenario
  const b = opening(made).filter((line) => line.startsWith("B"))
  assert.ok(!b.some((line) => line.includes("marksman")))
  assert.equal(b.filter((line) => line.includes("skyraider")).length, opening(map).filter((line) => line.startsWith("B") && line.includes("marksman")).length)
})

test("a win rate's interval is wide over a few battles and narrows over many", () => {
  const few = wilson(3, 4)
  const many = wilson(75, 100)
  assert.ok(few.low < 0.35 && few.high > 0.95)
  assert.ok(many.low > 0.65 && many.high < 0.83)
})

test("a trial plays every seed from both ends, names each battle's sides by army, and checks what it expects", async () => {
  const map = await loadScenarioFile("engage-gap2-melee-vs-mix.map.json")
  const spec: TrialSpec = {
    id: "wrong-army",
    maps: [map.id],
    seeds: [1, 2],
    swap: true,
    shuffle: true,
    variants: { "as built": {}, flyers: { army: { A: "trooper:6,skyraider:6" } } },
    expect: [
      { variant: "as built", measure: "winB", atLeast: 1 },
      { variant: "flyers", measure: "struckA", atLeast: 0.9 },
      { variant: "flyers", measure: "winA", atMost: 0.1 },
    ],
  }
  const battles = playTrial(spec, new Map([[map.id, map]]))
  assert.equal(battles.length, 8)
  assert.deepEqual(
    battles.filter((battle) => battle.variant === "as built").map((battle) => [battle.seed, battle.swapped]),
    [[1, false], [1, true], [2, false], [2, true]],
  )
  // The melee army is side A's at either end: it loses every one.
  assert.ok(battles.filter((battle) => battle.variant === "as built").every((battle) => battle.battle.winner === "B"))
  const cells = trialCells(battles)
  const failures = unmet(spec, cells)
  assert.equal(failures.length, 1, failures.join("; "))
  assert.match(failures[0] as string, /flyers: winA is 1, expected at most 0.1/)
  const lines = trialLines(spec, cells).join("\n")
  assert.match(lines, /as built +0%/)
})

test("grid plays a map over seeds and a trial file, and fails a trial whose expectation does not hold", { timeout: 60_000 }, () => {
  const grid = (args: string[]) => spawnSync(process.execPath, ["bin/grid.ts", ...args], { cwd: REPO_ROOT, encoding: "utf8" })
  const adHoc = grid(["engage-gap2-melee-vs-mix", "--seeds", "1", "--army-a", "trooper:6,skyraider:6", "--json"])
  assert.equal(adHoc.status, 0, adHoc.stderr)
  const result = JSON.parse(adHoc.stdout) as { cells: { variant: string; battles: number }[] }
  assert.deepEqual(result.cells.map((cell) => [cell.variant, cell.battles]), [["as built", 1], ["as given", 1]])
  const bad = grid(["engage-gap2-melee-vs-mix", "--seeds", "1", "--tune", "trooper.hp=60"])
  assert.notEqual(bad.status, 0)
  assert.match(bad.stderr, /has no "hp"/)
})

test("a battle's record counts idle units, target switches, and what each stall was queued behind", async () => {
  // A squad that reaches its target and stands there with nothing in reach is idle: never blocked, never trying.
  const standing = await loadScenarioFile("target-head-engage-stand.map.json")
  const stood = playTrialBattle(standing, {}, standing.seed).battle.sides.A
  assert.equal(stood.idle, 4)
  assert.equal(stood.stalled, 0)
  // At a two-row gap the wrong army stalls; each stall's queue is followed to its head, and a switch is a choice.
  const gap = await loadScenarioFile("engage-gap2-melee-vs-mix.map.json")
  const side = playTrialBattle(gap, {}, 1).battle.sides.A
  assert.ok(side.stalled > 0)
  const heads = Object.values(side.stallHeads ?? {}).reduce((sum, count) => sum + count, 0)
  assert.ok(heads >= side.stalled, `${heads} stall heads for ${side.stalled} stalled units`)
  assert.ok((side.switches ?? 0) <= (side.targetsChosen ?? 0))
})

test("a trial split across processes plays exactly the battles one process does, route work and all", { timeout: 60_000 }, () => {
  const grid = (args: string[]) => spawnSync(process.execPath, ["bin/grid.ts", ...args], { cwd: REPO_ROOT, encoding: "utf8" })
  const cells = (jobs: string) => {
    const run = grid(["engage-gap2-melee-vs-mix", "--seeds", "1-2", "--swap", "--profile", "--json", "--jobs", jobs])
    assert.equal(run.status, 0, run.stderr)
    return (JSON.parse(run.stdout) as { cells: { cost?: { msPerTick?: number } }[] }).cells.map((cell) => ({ ...cell, cost: { ...cell.cost, msPerTick: 0 } }))
  }
  assert.deepEqual(cells("2"), cells("1"))
})

test("the command a trial prints to watch a battle replays that very battle", { timeout: 60_000 }, async () => {
  const map = await loadScenarioFile("engage-gap2-melee-vs-mix.map.json")
  const spec: TrialSpec = { id: "watch", maps: [map.id], seeds: [3], swap: true, shuffle: true, variants: { flyers: { army: { A: "trooper:6,skyraider:6" } } } }
  const [, mirroredBattle] = playTrial(spec, new Map([[map.id, map]]))
  assert.ok(mirroredBattle !== undefined && mirroredBattle.swapped)
  const command = watchCommand(spec, mirroredBattle)
  assert.equal(command, "grid engage-gap2-melee-vs-mix --seed 3 --shuffle --swap --army-a trooper:6,skyraider:6")
  const run = spawnSync(process.execPath, ["bin/grid.ts", ...command.split(" ").slice(1), "--headless", "--json"], { cwd: REPO_ROOT, encoding: "utf8" })
  assert.equal(run.status, 0, run.stderr)
  const summary = JSON.parse(run.stdout) as { ticks: number; outcome: { winner: string | null } }
  // The command plays the mirrored map, where the army of the map's side A stands as B.
  const asPlayed = mirroredBattle.battle.winner === "A" ? "B" : mirroredBattle.battle.winner === "B" ? "A" : null
  assert.deepEqual([summary.ticks, summary.outcome.winner], [mirroredBattle.battle.ticks, asPlayed])
})
