// EXPERIMENT: the bench under each recall rule. Usage:
//   node scripts/recall-experiment/run.ts --rule stay --ticks 600 --seeds 1-12 --out tmp/recall-experiment/out/stay-600.jsonl
// One JSON line per duel: the setup, the result, and per round how it ended, the Nexus damage each side dealt, and how
// far each side's units stood from the enemy Nexus when the battle ended (and after the between-rounds rule).
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { briefOf, newDuel, playRound } from "../../src/duel/index.ts"
import { scriptedPlayer } from "../../src/duel/players.ts"
import type { DuelSetup, Side } from "../../src/duel/types.ts"
import { DUEL_MAPS } from "../../src/duel/maps.ts"
import { gridDistance } from "../../src/grid/coords.ts"
import type { MatchState } from "../../src/state/types.ts"
import type { ContentRegistry } from "../../src/content/index.ts"
import { centreTile } from "../../src/match/index.ts"

const args = new Map<string, string>()
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i]!.replace(/^--/, ""), process.argv[i + 1]!)
const rule = (args.get("rule") ?? "home") as "home" | "fallback" | "stay"
const ticks = Number(args.get("ticks") ?? 600)
const [s0, s1] = (args.get("seeds") ?? "1-12").split("-").map(Number) as [number, number]
const commanders = (args.get("commanders") ?? "vasse,averno,dob").split(",")
const players = (args.get("players") ?? "balanced,rush,turtle").split(",")
const rounds = Number(args.get("rounds") ?? 8)
const out = args.get("out") ?? `tmp/recall-experiment/out/${rule}-${ticks}.jsonl`
const verbose = args.has("verbose")
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, "")

const map = DUEL_MAPS["crossing"]!

type Front = { units: number; meanToEnemy: number | null; nearestToEnemy: number | null; meanX: number | null }
function fronts(state: MatchState, sides: Readonly<Record<Side, ContentRegistry>>): Record<Side, Front> {
  const out = {} as Record<Side, Front>
  for (const side of ["A", "B"] as const) {
    const enemy = side === "A" ? "B" : "A"
    const enemyNexus = state.entities.find((e) => e.player === enemy && sides[enemy].get(e.contentId).nexus === true)
    const target = enemyNexus === undefined ? centreTile(map.nexus[enemy], [{ x: 0, y: 0 }]) : centreTile(enemyNexus.anchor, sides[enemy].get(enemyNexus.contentId).footprint)
    const units = state.entities.filter((e) => e.player === side && sides[side].get(e.contentId).layer !== "obstacles")
    const d = units.map((u) => gridDistance(centreTile(u.anchor, sides[side].get(u.contentId).footprint), target))
    out[side] = {
      units: units.length,
      meanToEnemy: d.length === 0 ? null : d.reduce((a, b) => a + b, 0) / d.length,
      nearestToEnemy: d.length === 0 ? null : Math.min(...d),
      meanX: units.length === 0 ? null : units.reduce((a, u) => a + u.anchor.x, 0) / units.length,
    }
  }
  return out
}

let count = 0
const t0 = Date.now()
for (const a of commanders) {
  for (const b of commanders) {
    if (a === b && !args.has("mirrors")) continue
    for (const pa of players) {
      for (const pb of players) {
        for (let seed = s0; seed <= s1; seed += 1) {
          const setup: DuelSetup = { map: "crossing", seed, rounds, pulseTicks: ticks, commanders: { A: a, B: b }, ...(rule === "home" ? {} : { recall: rule }) }
          let state = newDuel(setup)
          const pA = scriptedPlayer(pa)!
          const pB = scriptedPlayer(pb)!
          const roundsOut: unknown[] = []
          while (state.result === null) {
            let last: MatchState | null = null
            let sidesSeen: Readonly<Record<Side, ContentRegistry>> | null = null
            const plans = { A: pA(briefOf(state, "A").data), B: pB(briefOf(state, "B").data) }
            const played = playRound(state, plans, (battle, _e, _r, sides) => {
              last = battle
              sidesSeen = sides
            })
            const r = played.report
            const end = fronts(last as unknown as MatchState, sidesSeen as unknown as Readonly<Record<Side, ContentRegistry>>)
            const after = played.state.carried === null ? null : fronts(played.state.carried, sidesSeen as unknown as Readonly<Record<Side, ContentRegistry>>)
            roundsOut.push({
              round: r.round,
              ended: r.ended,
              ticks: r.ticks,
              stance: { A: r.sides.A.stance, B: r.sides.B.stance },
              dealt: { A: r.sides.A.dealt, B: r.sides.B.dealt },
              nexus: { A: [r.sides.A.nexus.before, r.sides.A.nexus.after, r.sides.A.nexus.most], B: [r.sides.B.nexus.before, r.sides.B.nexus.after, r.sides.B.nexus.most] },
              fielded: { A: Object.values(r.sides.A.fielded).reduce((x, y) => x + y, 0), B: Object.values(r.sides.B.fielded).reduce((x, y) => x + y, 0) },
              lost: { A: Object.values(r.sides.A.lost).reduce((x, y) => x + y, 0), B: Object.values(r.sides.B.lost).reduce((x, y) => x + y, 0) },
              end,
              after,
            })
            state = played.state
          }
          appendFileSync(out, `${JSON.stringify({ rule, ticks, seed, commanders: { A: a, B: b }, players: { A: pa, B: pb }, result: state.result, rounds: roundsOut })}\n`)
          count += 1
          if (verbose) console.log(`${count} ${a}/${pa} v ${b}/${pb} s${seed}: ${JSON.stringify(state.result)} ${((Date.now() - t0) / 1000).toFixed(1)}s`)
        }
      }
    }
  }
}
console.log(`${rule} ${ticks}: ${count} duels in ${((Date.now() - t0) / 1000).toFixed(0)}s -> ${out}`)
