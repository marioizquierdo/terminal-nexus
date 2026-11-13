// The duel's scripted players: plans worked out from the same brief a language model reads (`BriefData`), so a
// script, a model and a person all play from the same facts. None of them is a good player — each is one plain idea of
// how to spend a round, there to give a Commander something to fight in every seed and to measure against:
//
// - **balanced**: keeps the rarest card, builds the producers that train the most strength a credit, a supply building
//   before the army fills, holds two rounds and attacks from the third;
// - **rush**: keeps a card that brings troops or makes more of them, builds the cheapest producer forward with every
//   credit, and attacks every round;
// - **turtle**: builds two Turrets forward and its strongest producers behind them, and holds until the last two rounds.
//
// Each also plays with area damage (`rush-area`): one building whose units hit an area bought first each round
// (`withArea`); and upgrading its buildings (`balanced-upgrade`): what its plan leaves spent on its standing
// buildings' upgrades, the Barracks's production line first (`withUpgrades`).
//
// Each plays by a formation too (`rush-block`, `rush-apart`, `balanced-block` ...): the same plan, with every building
// that trains units set touching the others or set apart (`Formation`, `types.ts`), round where the plan puts its
// first one. Played by its bare name, a script names no formation and each building goes where the script says.
//
// Pure: a plan is a function of the brief.

import type { BriefBuilding, BriefCard, BriefData } from "./brief.ts"
import type { BuildingOrder, Formation, Placement, BuildActions, Stance, Zone } from "./types.ts"
import { FORMATIONS } from "./types.ts"

/** A player: a plan from a brief. */
export type Player = (brief: BriefData) => BuildActions

const RARITY = ["common", "uncommon", "rare", "legendary"]

/** The card of `hand` a key scores highest, the first on a tie: its number, or 0 for an empty hand. */
function bestCard(hand: readonly BriefCard[], score: (card: BriefCard) => number): number {
  let best: BriefCard | undefined
  for (const card of hand) if (best === undefined || score(card) > score(best)) best = card
  return best?.number ?? 0
}

/** The buildings it can build this round: open, and within `credits`. */
const affordable = (buildings: readonly BriefBuilding[], credits: number): BriefBuilding[] => buildings.filter((building) => building.open && building.cost <= credits)

/** Places to spread buildings over, round by round. */
const SPREAD: readonly Zone[] = ["forward", "north", "south", "nexus"]

/** Buildings bought from `credits` by `choose`, each placed in turn: until `choose` returns nothing affordable. */
function spend(credits: number, choose: (left: number, bought: readonly BriefBuilding[]) => BriefBuilding | undefined, zoneOf: (building: BriefBuilding, index: number) => Zone): Placement[] {
  const bought: BriefBuilding[] = []
  let left = credits
  for (let guard = 0; guard < 12; guard += 1) {
    const next = choose(left, bought)
    if (next === undefined || next.cost > left) break
    bought.push(next)
    left -= next.cost
  }
  return bought.map((building, index) => ({ building: building.id, at: zoneOf(building, index) }))
}

/** How many units its supply still has room for, counting what it already trains each round. */
const roomLeft = (brief: BriefData): number => (brief.supply.cap === null ? Number.POSITIVE_INFINITY : brief.supply.cap - brief.supply.used)

export const balanced: Player = (brief) => {
  const power = bestCard(brief.hand, (card) => RARITY.indexOf(card.rarity))
  const producers = (left: number): BriefBuilding[] => affordable(brief.buildings, left).filter((building) => building.spawns !== undefined)
  const supply = brief.buildings.find((building) => building.supply !== undefined && building.open)
  const build = spend(
    brief.credits,
    (left, bought) => {
      // Room first, when the army is close to full; then the producer that trains the most strength a credit, the
      // higher tier on a tie; one supply building a round at most.
      if (supply !== undefined && roomLeft(brief) < 8 && !bought.includes(supply) && supply.cost <= left) return supply
      const options = producers(left).sort((a, b) => b.strength / b.cost - a.strength / a.cost || b.tier - a.tier)
      return options[0]
    },
    (building, index) => (building.supply !== undefined ? "back" : (SPREAD[index % SPREAD.length] as Zone)),
  )
  return { power, build, stance: brief.round >= 3 ? "attack" : "hold", note: "balanced: strongest producers, room before the army fills, attack from round 3" }
}

export const rush: Player = (brief) => {
  const power = bestCard(brief.hand, (card) => (/join|wave|send/i.test(card.does) ? 10 : 0) + RARITY.indexOf(card.rarity))
  const cheapest = (left: number): BriefBuilding | undefined =>
    affordable(brief.buildings, left)
      .filter((building) => building.spawns !== undefined)
      .sort((a, b) => a.cost - b.cost)[0]
  const build = spend(brief.credits, (left) => cheapest(left), () => "forward")
  return { power, build, stance: "attack", note: "rush: cheapest producers, all forward, attack every round" }
}

export const turtle: Player = (brief) => {
  const power = bestCard(brief.hand, (card) => RARITY.indexOf(card.rarity))
  const turret = brief.buildings.find((building) => building.spawns === undefined && building.supply === undefined && building.open)
  const build = spend(
    brief.credits,
    (left, bought) => {
      if (turret !== undefined && bought.filter((building) => building === turret).length < 2 && turret.cost <= left) return turret
      return affordable(brief.buildings, left)
        .filter((building) => building.spawns !== undefined)
        .sort((a, b) => b.strength - a.strength)[0]
    },
    (building) => (building === turret ? "forward" : "back"),
  )
  return { power, build, stance: brief.round >= brief.rounds - 1 ? "attack" : "hold", note: "turtle: turrets forward, producers behind, attack in the last two rounds" }
}

/**
 * **reader**: a player that reads the battle (`src/duel/reading.ts`) before it plans, where the others follow a fixed
 * idea. It builds as `balanced` does, and then:
 *
 * - **the stance from the last round's trade**: it attacks while its attacks win the trade, holds when an attack lost
 *   it, and pushes out again when a hold won it by a third; it attacks a Nexus brought under half, holds a lead on Nexus
 *   health in the last round, and attacks when behind on it;
 * - **a Turret when the enemy reached its Nexus** (a hit, or an enemy within 8 tiles), placed by the Nexus, first;
 * - **apart against area damage**: its buildings that train units set apart once the enemy has a building standing
 *   whose units aim at the thickest knot; otherwise each where `balanced` puts it (a block was tried, and on the
 *   Pocket's small build range it left credits unspent).
 *
 * Still one plain idea, read a round at a time: it plans nothing more than one round ahead, and is no good player.
 */
export const reader: Player = (brief) => {
  const enemy = brief.side === "A" ? "B" : "A"
  const last = brief.last
  const read = last?.reading?.sides[brief.side]
  const total = (side: "A" | "B"): number => (last === null ? 0 : last.sides[side].dealt.units + last.sides[side].dealt.buildings + last.sides[side].dealt.nexus)
  const ours = total(brief.side)
  const theirs = total(enemy)
  const wasAttacking = last?.sides[brief.side].stance === "attack"
  const enemyShare = brief.enemy.nexus.most === 0 ? 1 : brief.enemy.nexus.health / brief.enemy.nexus.most
  const lastRound = brief.round >= brief.rounds
  const decided = ((): Readonly<{ stance: Stance; because: string }> => {
    if (enemyShare <= 0.5) return { stance: "attack", because: "their Nexus is under half" }
    if (lastRound && brief.score.leader === brief.side && brief.score.by === "health") return { stance: "hold", because: "the last round, ahead on Nexus health" }
    if (brief.score.leader === enemy && brief.score.by === "health") return { stance: "attack", because: "behind on Nexus health" }
    if (last === null) return { stance: "hold", because: "round 1: gathering" }
    if (wasAttacking) return ours >= theirs ? { stance: "attack", because: "its attack won the trade" } : { stance: "hold", because: "its attack lost the trade" }
    return ours >= theirs * 1.34 ? { stance: "attack", because: "its hold won the trade by a third" } : { stance: "hold", because: "holding" }
  })()
  const stance = decided.stance
  const why: string[] = [decided.because]

  const threatened = read !== undefined && (Object.keys(read.nexusHits).length > 0 || (read.closest !== null && read.closest <= 8))
  const turret = brief.buildings.find((building) => building.spawns === undefined && building.supply === undefined && building.open)
  const first = threatened && turret !== undefined && turret.cost <= brief.credits ? turret : undefined
  if (first !== undefined) why.push("a Turret by the Nexus, since the enemy reached it")
  const plan = balanced({ ...brief, credits: brief.credits - (first?.cost ?? 0) })

  const knots = brief.enemy.trains.filter((line) => /thickest knot/u.test(line)).map((line) => line.slice(0, line.indexOf(":")))
  const facesArea = knots.some((name) => brief.enemy.buildings.some((standing) => standing.startsWith(`${name} at`)))
  if (facesArea) why.push("apart, against their area damage")
  return {
    ...plan,
    build: first === undefined ? plan.build : [{ building: first.id, at: "nexus" }, ...plan.build],
    ...(facesArea ? { formation: "apart" as const } : {}),
    stance,
    note: `reader: ${why.join("; ")}`,
  }
}

/**
 * A player that plays `player`'s plan with area damage: each round it buys one building whose units hit an area and aim
 * at the thickest knot (`BriefBuilding.area`: the Ravels' Fuse Shed, the Citizens' Battery) first, when one is open and
 * affordable, placed where the script puts its producers, and spends what is left as `player` would. The scripts value
 * a building by health times damage, which scores a unit that only bursts at nothing, so without this none of them
 * ever buys one (the owner, 2026-10-21: "let's start testing area of damage versus clamping").
 */
export function withArea(player: Player): Player {
  return (brief) => {
    const area = brief.buildings.find((building) => building.area === true)
    if (area === undefined) return player(brief)
    // Open: buy it. Locked: buy what it needs standing (the Barracks for a Battery, the Den for a Fuse Shed), so it opens
    // next round, unless that already stands.
    const first = area.open ? area : brief.buildings.find((building) => area.needs.includes(building.name) && building.open)
    if (first === undefined || first.cost > brief.credits) return player(brief)
    const rest = player({ ...brief, credits: brief.credits - first.cost })
    const at = rest.build.find((placement) => brief.buildings.find((building) => building.id === placement.building)?.spawns !== undefined)?.at ?? "forward"
    const words = first === area ? `one ${area.name} first, for area damage` : `a ${first.name} first, so a ${area.name} can follow`
    return { ...rest, build: [{ building: first.id, at }, ...rest.build], note: rest.note === undefined ? words : `${rest.note}; ${words}` }
  }
}

/**
 * A player that plays `player`'s plan and then upgrades its buildings with what the plan leaves (`balanced-upgrade`):
 * after its buildings are paid for, each upgrade its standing buildings offer and do not carry yet, cheapest first and
 * then in the order its buildings stand, while the credits last — the Barracks's production line, a Turret's heavy
 * rounds. A building's upgrade is its alone (commander-armies.md, a building's actions), so a script that never buys one
 * leaves a part of the power curve unplayed; this is the one that plays it.
 */
export function withUpgrades(player: Player): Player {
  return (brief) => {
    const plan = player(brief)
    const costOf = (id: string): number => brief.buildings.find((building) => building.id === id)?.cost ?? 0
    let left = brief.credits - plan.build.reduce((sum, placement) => sum + costOf(placement.building), 0)
    const offered = brief.actions.filter((action) => action.kind === "upgrade" && action.has !== true).sort((a, b) => a.cost - b.cost)
    const bought: BuildingOrder[] = []
    for (const action of offered) {
      if (action.cost > left) continue
      left -= action.cost
      bought.push({ x: action.x, y: action.y, action: action.action })
    }
    if (bought.length === 0) return plan
    const words = `then ${bought.length} upgrade${bought.length === 1 ? "" : "s"} with what was left`
    return { ...plan, actions: [...(plan.actions ?? []), ...bought], note: plan.note === undefined ? words : `${plan.note}; ${words}` }
  }
}

/** Every scripted player, by name: each script, each with area damage (`rush-area`), and each upgrading its buildings
 *  with what is left (`balanced-upgrade`). */
export const SCRIPTED: Readonly<Record<string, Player>> = {
  balanced,
  rush,
  turtle,
  reader,
  "balanced-area": withArea(balanced),
  "rush-area": withArea(rush),
  "turtle-area": withArea(turtle),
  "balanced-upgrade": withUpgrades(balanced),
  "rush-upgrade": withUpgrades(rush),
  "turtle-upgrade": withUpgrades(turtle),
}

/** A player that plays `player`'s plan by `formation`. */
export function inFormation(player: Player, formation: Formation): Player {
  const words = formation === "zones" ? "each building where the script says" : formation === "block" ? "built as a block" : "built apart"
  return (brief) => {
    const plan = player(brief)
    return { ...plan, formation, note: plan.note === undefined ? words : `${plan.note}; ${words}` }
  }
}

/** A scripted player's name read: the script and the formation it plays by, `rush-block` the rush in a block; a bare
 *  name none. `undefined` for a script or a formation there is not. */
export function scriptedName(name: string): Readonly<{ script: string; formation?: Formation }> | undefined {
  if (SCRIPTED[name] !== undefined) return { script: name }
  const dash = name.lastIndexOf("-")
  const script = dash < 0 ? name : name.slice(0, dash)
  const formation = dash < 0 ? undefined : name.slice(dash + 1)
  if (SCRIPTED[script] === undefined) return undefined
  if (formation === undefined) return { script }
  return (FORMATIONS as readonly string[]).includes(formation) ? { script, formation: formation as Formation } : undefined
}

/** A scripted player by its name, `rush` or `rush-block`: `undefined` for none. */
export function scriptedPlayer(name: string): Player | undefined {
  const named = scriptedName(name)
  if (named === undefined) return undefined
  const player = SCRIPTED[named.script] as Player
  return named.formation === undefined ? player : inFormation(player, named.formation)
}

/** Every name a scripted player answers to, in words for an error. */
export const scriptedNames = (): string => `${Object.keys(SCRIPTED).join(", ")}, each also with -${FORMATIONS.join(", -")} (rush-block)`
