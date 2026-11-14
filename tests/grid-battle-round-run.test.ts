// What a tester reads from `grid` on a sandbox's Battle Round (docs/system-design/sandboxes.md): the end of each entity
// on request, the options it reads, a start that still says the removed `phase`, and a fitted building refused.

import { test } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { join } from "node:path"
import { openBattle } from "../src/skirmish/opening/index.ts"
import type { BattleOpening } from "../src/skirmish/opening/index.ts"
import { readSave } from "../src/skirmish/save.ts"
import { REPO_ROOT, loadSandbox } from "./helpers.ts"

const GRID_BIN = join(REPO_ROOT, "bin", "grid.ts")
const grid = (args: readonly string[]) => {
  const r = spawnSync(process.execPath, [GRID_BIN, ...args], { cwd: REPO_ROOT, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } })
  return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr }
}

test("a Battle Round shows its end states only when asked (--end-states), so its default output is unchanged", () => {
  assert.doesNotMatch(grid(["melee-kill", "--headless"]).stdout, / end /)
  assert.match(grid(["melee-kill", "--headless", "--end-states"]).stdout, / WARN {2}end {6}/)
})

test("--ticks is read for a Battle Round, and grid --help no longer names a sandbox phase", () => {
  assert.equal(grid(["melee-kill", "--headless", "--ticks", "5"]).status, 0)
  const help = grid(["--help"]).stdout
  assert.match(help, /--end-states/)
  assert.doesNotMatch(help, /start\.phase|build-phase/)
})

test("a start that still says `phase` is refused, with what to do", async () => {
  const { readFile } = await import("node:fs/promises")
  const text = await readFile(new URL("../sandboxes/rules/melee-kill.save.json", import.meta.url), "utf8")
  const bad = readSave(text.replace(/"start": \{/, '"start": {\n    "phase": "build-phase",'))
  assert.equal(bad.save, null)
  assert.match(bad.problems.join("\n"), /start\.phase: removed; a sandbox is one Battle Round, remove the field/)
})

test("a fitted building in a sandbox is refused with the reason", async () => {
  const base = await loadSandbox("melee-kill")
  const sideA = base.placements["A"]
  assert.ok(sideA !== undefined)
  const fitted: BattleOpening = {
    ...base,
    placements: { ...base.placements, A: { ...sideA, legend: { ...sideA.legend, [Object.keys(sideA.legend)[0] ?? "t"]: { content: "structure.citizen.barracks+production-line" } } } },
  }
  assert.throws(() => openBattle(fitted), /fitted building.*cannot stand in a sandbox/)
})
