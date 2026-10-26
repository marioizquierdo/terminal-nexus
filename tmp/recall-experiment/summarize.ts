// EXPERIMENT: summarize tmp/recall-experiment/out/*.jsonl into compact tables. node tmp/recall-experiment/summarize.ts
import { readdirSync, readFileSync } from "node:fs"

type Round = {
  round: number
  ended: "nexus" | "time"
  ticks: number
  stance: Record<"A" | "B", string>
  dealt: Record<"A" | "B", { units: number; buildings: number; nexus: number }>
  nexus: Record<"A" | "B", [number, number, number]>
  fielded: Record<"A" | "B", number>
  lost: Record<"A" | "B", number>
  end: Record<"A" | "B", { units: number; meanToEnemy: number | null; nearestToEnemy: number | null }>
  after: Record<"A" | "B", { units: number; meanToEnemy: number | null; nearestToEnemy: number | null }> | null
}
type Duel = { rule: string; ticks: number; seed: number; commanders: Record<"A" | "B", string>; players: Record<"A" | "B", string>; result: { winner: "A" | "B" | null; by: string; round: number }; rounds: Round[] }

const dir = "tmp/recall-experiment/out"
const duels: Duel[] = []
for (const file of readdirSync(dir).filter((f) => f.endsWith(".jsonl"))) {
  for (const line of readFileSync(`${dir}/${file}`, "utf8").split("\n")) if (line.trim() !== "") duels.push(JSON.parse(line))
}
const pct = (n: number, d: number): string => (d === 0 ? "  -" : `${Math.round((100 * n) / d)}%`.padStart(4))
const mean = (xs: number[]): string => (xs.length === 0 ? "-" : (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1))
const SIDES = ["A", "B"] as const
const configs = [...new Set(duels.map((d) => `${d.rule}|${d.ticks}`))].sort((a, b) => {
  const [ra, ta] = a.split("|")
  const [rb, tb] = b.split("|")
  const order = ["home", "fallback", "stay"]
  return Number(ta) - Number(tb) || order.indexOf(ra!) - order.indexOf(rb!)
})

console.log("## Outcomes")
console.log("rule      ticks   n  nexus  hp/dmg draw  meanEnd  meanEnd(nexus)  noNexusDmgAtAll")
for (const c of configs) {
  const [rule, ticks] = c.split("|")
  const ds = duels.filter((d) => `${d.rule}|${d.ticks}` === c)
  const nexus = ds.filter((d) => d.result.by === "nexus")
  const draws = ds.filter((d) => d.result.by === "draw")
  const clean = ds.filter((d) => d.rounds.every((r) => r.dealt.A.nexus === 0 && r.dealt.B.nexus === 0))
  console.log(
    `${rule!.padEnd(9)} ${ticks!.padStart(4)} ${String(ds.length).padStart(4)}  ${pct(nexus.length, ds.length)}   ${pct(ds.length - nexus.length - draws.length, ds.length)}  ${pct(draws.length, ds.length)}   ${mean(ds.map((d) => d.result.round)).padStart(5)}    ${mean(nexus.map((d) => d.result.round)).padStart(5)}         ${pct(clean.length, ds.length)}`,
  )
}

console.log("\n## Snowball: the side ahead on Nexus damage dealt (cumulative) after round k, in duels still going after round k")
console.log("rule      ticks  | after r1: lead/eligible  leader wins | after r2: lead/eligible leader wins | after r3")
for (const c of configs) {
  const [rule, ticks] = c.split("|")
  const ds = duels.filter((d) => `${d.rule}|${d.ticks}` === c)
  const cells: string[] = []
  for (const k of [1, 2, 3]) {
    const going = ds.filter((d) => d.result.round > k)
    let led = 0
    let won = 0
    for (const d of going) {
      const sum = (s: "A" | "B") => d.rounds.slice(0, k).reduce((a, r) => a + r.dealt[s].nexus, 0)
      if (sum("A") === sum("B")) continue
      led += 1
      const leader = sum("A") > sum("B") ? "A" : "B"
      if (d.result.winner === leader) won += 1
    }
    cells.push(`${String(led).padStart(4)}/${String(going.length).padEnd(4)} ${pct(won, led)} (${won})`)
  }
  console.log(`${rule!.padEnd(9)} ${ticks!.padStart(4)}  | ${cells.join(" | ")}`)
}

console.log("\n## Battle Rounds: how each ended, and the fronts (attacking sides only; Grid distance to the enemy Nexus's middle; the Crossing's Nexuses are ~57 columns apart)")
console.log("rule      ticks rounds  byNexus meanTicks | at round end: mean dist  nearest unit  units | as next Build Phase opens: mean dist  nearest")
for (const c of configs) {
  const [rule, ticks] = c.split("|")
  const ds = duels.filter((d) => `${d.rule}|${d.ticks}` === c)
  const rounds = ds.flatMap((d) => d.rounds)
  const endMean: number[] = []
  const endNear: number[] = []
  const endUnits: number[] = []
  const aftMean: number[] = []
  const aftNear: number[] = []
  for (const r of rounds) {
    for (const s of SIDES) {
      if (r.stance[s] !== "attack") continue
      endUnits.push(r.end[s].units)
      if (r.end[s].meanToEnemy !== null) endMean.push(r.end[s].meanToEnemy as number)
      if (r.end[s].nearestToEnemy !== null) endNear.push(r.end[s].nearestToEnemy as number)
      if (r.ended === "time" && r.after !== null) {
        if (r.after[s].meanToEnemy !== null) aftMean.push(r.after[s].meanToEnemy as number)
        if (r.after[s].nearestToEnemy !== null) aftNear.push(r.after[s].nearestToEnemy as number)
      }
    }
  }
  console.log(
    `${rule!.padEnd(9)} ${ticks!.padStart(4)} ${String(rounds.length).padStart(5)}   ${pct(rounds.filter((r) => r.ended === "nexus").length, rounds.length)}   ${mean(rounds.map((r) => r.ticks)).padStart(6)}  |        ${mean(endMean).padStart(5)}        ${mean(endNear).padStart(5)}    ${mean(endUnits).padStart(5)} |                         ${mean(aftMean).padStart(5)}    ${mean(aftNear).padStart(5)}`,
  )
}

console.log("\n## Win rate by Commander (all duels; off-mirror only) and by script (duels between different scripts)")
const commanders = [...new Set(duels.flatMap((d) => [d.commanders.A, d.commanders.B]))].sort()
const scripts = [...new Set(duels.flatMap((d) => [d.players.A, d.players.B]))].sort()
console.log(`rule      ticks | ${commanders.map((c) => c.padEnd(7)).join(" ")}| ${scripts.map((s) => s.padEnd(9)).join(" ")}| rush v turtle  balanced v rush  balanced v turtle (row's win %)`)
for (const c of configs) {
  const [rule, ticks] = c.split("|")
  const ds = duels.filter((d) => `${d.rule}|${d.ticks}` === c)
  const rate = (pick: (d: Duel, s: "A" | "B") => boolean, among: Duel[]): string => {
    let n = 0
    let w = 0
    for (const d of among) for (const s of SIDES) if (pick(d, s)) {
      n += 1
      if (d.result.winner === s) w += 1
    }
    return pct(w, n)
  }
  const cmd = commanders.map((name) => rate((d, s) => d.commanders[s] === name && d.commanders.A !== d.commanders.B, ds).padEnd(7))
  const diff = ds.filter((d) => d.players.A !== d.players.B)
  const scr = scripts.map((name) => rate((d, s) => d.players[s] === name, diff).padEnd(9))
  const vs = (x: string, y: string): string => rate((d, s) => d.players[s] === x && d.players[s === "A" ? "B" : "A"] === y, ds)
  console.log(`${rule!.padEnd(9)} ${ticks!.padStart(4)} | ${cmd.join(" ")}| ${scr.join(" ")}|     ${vs("rush", "turtle")}          ${vs("balanced", "rush")}            ${vs("balanced", "turtle")}`)
}

console.log("\n## Degenerate checks")
for (const c of configs) {
  const ds = duels.filter((d) => `${d.rule}|${d.ticks}` === c)
  // A side that won having attacked in no round (held every round).
  const passive = ds.filter((d) => d.result.winner !== null && d.rounds.every((r) => r.stance[d.result.winner as "A" | "B"] === "hold")).length
  // A side that won having dealt no Nexus damage at all (won on its own Nexus's health or damage).
  const noNexus = ds.filter((d) => d.result.winner !== null && d.rounds.every((r) => r.dealt[d.result.winner as "A" | "B"].nexus === 0)).length
  // Rounds where an attacking side ended with units but none nearer than 20 to the enemy Nexus (a line stalled in the field).
  const atk = ds.flatMap((d) => d.rounds.flatMap((r) => SIDES.filter((s) => r.stance[s] === "attack" && r.ended === "time").map((s) => r.end[s])))
  const stalled = atk.filter((e) => e.units > 0 && (e.nearestToEnemy ?? 0) > 20).length
  // Survivors piling up: mean and max units a side carries into a Build Phase.
  const carried = ds.flatMap((d) => d.rounds.flatMap((r) => (r.after === null ? [] : SIDES.map((s) => r.after![s].units))))
  console.log(
    `${c.padEnd(14)} winners that never attacked ${pct(passive, ds.length)}  winners that dealt no Nexus damage ${pct(noNexus, ds.length)}  attacking lines ending on time >20 from the Nexus ${pct(stalled, atk.length)}  survivors carried: mean ${mean(carried)} max ${Math.max(...carried)}`,
  )
}
