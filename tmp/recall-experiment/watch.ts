// EXPERIMENT: one duel under a recall rule, the map as each Build Phase opens (side A's brief picture) and each round's
// numbers. node tmp/recall-experiment/watch.ts <rule> <ticks> <a> <playerA> <b> <playerB> <seed>
import { briefOf, newDuel, playRound } from "../../src/duel/index.ts"
import { scriptedPlayer } from "../../src/duel/players.ts"

const [rule = "stay", ticks = "600", a = "vasse", pa = "balanced", b = "dob", pb = "rush", seed = "3"] = process.argv.slice(2)
let state = newDuel({ map: "crossing", seed: Number(seed), rounds: 8, pulseTicks: Number(ticks), commanders: { A: a, B: b }, ...(rule === "home" ? {} : { recall: rule as "stay" | "fallback" }) })
const players = { A: scriptedPlayer(pa)!, B: scriptedPlayer(pb)! }
while (state.result === null) {
  const brief = { A: briefOf(state, "A").data, B: briefOf(state, "B").data }
  console.log(`\n=== Build Phase of round ${state.round} (A=${a}/${pa} lower case, B=${b}/${pb} upper case) ===`)
  console.log(brief.A.map.join("\n"))
  const played = playRound(state, { A: players.A(brief.A), B: players.B(brief.B) })
  const r = played.report
  for (const side of ["A", "B"] as const) {
    const s = r.sides[side]
    console.log(`  ${side} ${s.stance.padEnd(6)} fielded ${Object.values(s.fielded).reduce((x, y) => x + y, 0)} trained ${Object.values(s.trained).reduce((x, y) => x + y, 0)} lost ${Object.values(s.lost).reduce((x, y) => x + y, 0)} dealt nexus ${s.dealt.nexus} units ${s.dealt.units} bldg ${s.dealt.buildings}; own nexus ${s.nexus.before}->${s.nexus.after}/${s.nexus.most}; built ${s.built.length}`)
  }
  console.log(`  round ${r.round} ended ${r.ended} at tick ${r.ticks}`)
  state = played.state
}
console.log(`\nRESULT ${JSON.stringify(state.result)}`)
