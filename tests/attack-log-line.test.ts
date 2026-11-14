// The levelled log's attack line says what landed (docs/system-design/sandboxes.md, reading a run): under an aura the
// swing and the hit differ, and the line must agree with its own hp change.

import { test } from "node:test"
import assert from "node:assert/strict"
import { buildLog } from "../src/report/index.ts"
import { playSandbox } from "./helpers.ts"

test("an attack under an aura logs the damage that landed, the base beside it, and agrees with its hp change", async () => {
  const { report } = await playSandbox("aura-by-the-book")
  const lines = buildLog(report, "info").filter((line) => line.includes(" attack "))
  const guarded = lines.filter((line) => line.includes("(base "))
  assert.ok(guarded.length > 0, "no attack was changed by the aura")
  for (const line of lines) {
    const match = /dmg (\d+)(?: \(base \d+\))?\s+hp (\d+)->(\d+)/.exec(line)
    if (match === null) continue
    const landed = Number(match[1])
    const dropped = Number(match[2]) - Number(match[3])
    assert.ok(dropped === landed || Number(match[3]) === 0, `the line disagrees with itself: ${line}`)
  }
})

test("the damage line reads source -> victim, as the attack line reads attacker -> target", async () => {
  const { report } = await playSandbox("melee-kill")
  const log = buildLog(report, "debug")
  const pairs = (kind: string) => log.filter((line) => line.includes(` ${kind} `)).map((line) => /(\S+)\s+-> (\S+)/.exec(line)?.slice(1, 3).join(">"))
  const attacks = new Set(pairs("attack"))
  assert.ok(attacks.size > 0)
  for (const pair of pairs("damage")) assert.ok(attacks.has(pair), `${pair} is not a pair an attack line has`)
})
