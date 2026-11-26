// What a round took away, said as the next one opens (the owner, 2026-11-26: "some buildings were canceled at the end
// of battle/beginning of the next build phase; but I'm pretty sure I placed them at the right location"). Nothing the
// screen accepts is refused by the round but a clash (both sides chose the same ground: neither built, both paid back),
// and nothing else takes a building away but the battle. Each is said in one short line: the clash once, counted,
// looking at the ground; the buildings the battle destroyed, counted by name, the count matching the battle's events.

import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { buildLayout } from "../src/build/layout.ts"
import type { BuildContext } from "../src/build/state.ts"
import { createBuildState, nexusTile, withoutScene } from "../src/build/state.ts"
import { readBuildActions, scriptedPlayer } from "../src/battle/index.ts"
import type { Player } from "../src/battle/index.ts"
import { newSkirmishLevel, planOnRound, playedOf, scriptedRound, skirmishLevel } from "../src/cli/skirmish-play.ts"
import { readSave } from "../src/skirmish/save.ts"
import { SHIPPED_PROFILES } from "../src/skirmish/shipped-players.ts"
import { readProfiles } from "../src/skirmish/profile-files.ts"

test("a clash is said once, counted, with the refund, looking at the ground", { timeout: 120_000 }, () => {
  // Round 7, Vasse against the agro script: the plan's Turret at 22,16 is where the enemy builds this round.
  const profiles = readProfiles()
  const read = readSave(readFileSync(new URL("./fixtures/clash-turret.save.json", import.meta.url), "utf8"), profiles)
  assert.ok(read.save !== null, read.problems.join("; "))
  const level = skirmishLevel(read.save, {}, { profiles })
  const context = withoutScene(level.firstRound())
  const viewport = buildLayout({ columns: 80, rows: 24 }, context.terrain).viewport
  const opened = createBuildState(context, nexusTile(context) ?? { x: 0, y: 0 }, viewport)
  const plan = readBuildActions(read.save.draft?.p1 ?? {}).actions
  const planned = planOnRound(context, opened, plan, level.play.keep as NonNullable<typeof level.play.keep>)
  const resolved = level.play.startPulse(planned.context, planned.state)
  assert.ok(resolved !== null)
  const played = playedOf(resolved)
  assert.ok(played !== undefined)
  const clashes = played.report.clashes.filter((clash) => clash.side === "A")
  assert.ok(clashes.length > 0, "the fixture no longer clashes: the enemy script built elsewhere")
  const next = level.play.nextRound(planned.context, planned.state, resolved)
  assert.ok(next !== null)
  const lines = (next.scene ?? []).map((line) => line.text)
  const said = lines.filter((text) => /not built: the enemy chose the same ground at the same moment\. Paid back\./u.test(text))
  assert.equal(said.length, 1, lines.join(" | "))
  assert.ok(lines.every((text) => !/the enemy built there at the same moment/u.test(text)), "the clash is still listed by tile")
  const clashLine = (next.scene ?? []).find((line) => line.text === said[0])
  assert.deepEqual(clashLine?.focus?.tile, clashes[0]?.anchor, "the line does not look at the ground")
})

test("buildings the battle destroyed are said as the next round opens, counted as the battle's events count them", { timeout: 180_000 }, () => {
  // The rush script builds forward, where the agro script's army meets it: some of its buildings fall.
  const level = newSkirmishLevel(1, { newSeed: () => 4242, profiles: SHIPPED_PROFILES })
  const rush = scriptedPlayer("rush") as Player
  let context: BuildContext = withoutScene(level.firstRound())
  let checked = 0
  for (let round = 1; round <= 6; round += 1) {
    const planned = scriptedRound(context, rush, level.play)
    const resolved = level.play.startPulse(planned.context, planned.state)
    assert.ok(resolved !== null)
    const played = playedOf(resolved)
    assert.ok(played !== undefined)
    if (played.battle.result !== null) break
    const destroyed = resolved.timeline.events.filter((event) => event.kind === "structure.destroyed" && event.player === "A").length
    const next = level.play.nextRound(planned.context, planned.state, resolved)
    assert.ok(next !== null)
    const lost = (next.scene ?? []).map((line) => line.text).find((text) => text.startsWith("Lost in the battle: "))
    if (destroyed === 0) assert.equal(lost, undefined, `round ${round}: a loss said with none destroyed`)
    else {
      assert.ok(lost !== undefined, `round ${round}: ${destroyed} destroyed, nothing said`)
      const counted = lost
        .slice("Lost in the battle: ".length, -1)
        .split(", ")
        .reduce((sum, part) => sum + (part.startsWith("a ") ? 1 : Number(part.split(" ")[0])), 0)
      assert.equal(counted, destroyed, `round ${round}: "${lost}" against ${destroyed} destroyed`)
      checked += 1
    }
    context = withoutScene(next)
  }
  assert.ok(checked > 0, "no building was destroyed in six rounds: the test proves nothing")
})
