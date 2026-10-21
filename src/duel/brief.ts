// What a duel side is told before it plans a round (`briefOf`): one brief, two forms — `data`, for a script, and `text`,
// the same facts written out for a language model (docs/system-design/duels.md, "Playing with a model"). Everything
// in it is what a player on the Build Phase screen could see: their own army, credits, hand and map; the enemy's
// buildings and units where they stand, its Nexus's health and the powers it has kept (kept powers are public:
// commander-armies.md, catch-up); and what happened last round. The enemy's plan for this round is never in it.
//
// Pure: the same duel gives the same brief. Presentation of the duel, so it may read the art and card tables.

import { abilityLines } from "../abilities/index.ts"
import type { PowerCard } from "../armies/index.ts"
import { artFor } from "../content/art.ts"
import { CARD_TEXT } from "../content/cards.ts"
import type { ContentDef, ContentRegistry } from "../content/index.ts"
import { supplyOf } from "../content/supply.ts"
import { tilesOf } from "../grid/coords.ts"
import { duelGrid } from "./maps.ts"
import type { DuelArmy } from "./sides.ts"
import { duelArmy, loadoutOf, powerOf } from "./sides.ts"
import { handOf, mapOf, other, standingOf, titleOf, zonePoint } from "./round.ts"
import type { DuelState, RoundReport, Side, SideReport } from "./types.ts"
import { APART_GAP, FORMATIONS, STANCES, ZONES } from "./types.ts"

/** A building the side can build: its card id, name, cost, what it needs standing, and what it does. */
export type BriefBuilding = Readonly<{
  id: string
  name: string
  cost: number
  tier: number
  needs: readonly string[]
  /** Whether what it needs stands as this round opens. */
  open: boolean
  spawns?: string
  /** What it trains a round, as one number: each unit's health times its damage a second, added up — the measure the
   *  power curve uses ("about three troopers"). 0 for a building that trains nothing. */
  strength: number
  supply?: number
  /** What it does on its own besides training, each ability's own sentence (`abilityLines`). */
  skills: readonly string[]
  about: string
}>

/** A card of the hand: its number in the plan, name, what it does, rarity. */
export type BriefCard = Readonly<{ number: number; id: string; name: string; does: string; rarity: string }>

/** Everything a side may know before it plans a round. */
export type BriefData = Readonly<{
  round: number
  rounds: number
  side: Side
  /** Where its base is: west or east. */
  base: "west" | "east"
  commander: Readonly<{ id: string; name: string; status: string; card: string; skills: readonly string[]; stats: string }>
  credits: number
  supply: Readonly<{ used: number; cap: number | null }>
  nexus: Readonly<{ health: number; most: number }>
  hand: readonly BriefCard[]
  buildings: readonly BriefBuilding[]
  kept: readonly string[]
  /** What stands for it as the round opens, and its units home after the last round, by name. */
  yours: Readonly<{ buildings: readonly string[]; units: Readonly<Record<string, number>> }>
  zones: Readonly<Record<string, Readonly<{ x: number; y: number }>>>
  enemy: Readonly<{
    commander: string
    nexus: Readonly<{ health: number; most: number }>
    kept: readonly string[]
    buildings: readonly string[]
    units: Readonly<Record<string, number>>
    /** What each building its army can build trains, and what those units do (its army is public, as its kept
     *  powers are): where to look for an attack that hits an area. */
    trains: readonly string[]
  }>
  map: readonly string[]
  last: RoundReport | null
  history: readonly string[]
}>

/** A side's brief: its data and its text. */
export type Brief = Readonly<{ data: BriefData; text: string }>

/** One plain line of a unit's numbers: health, attack and range, speed, and what of it hits an area — the damage a
 *  tight army pays for (`Formation`). */
function statsOf(definition: ContentDef): string {
  const attack = definition.attack
  const seconds = (ticks: number): string => `${(ticks / 12).toFixed(1)}s`
  const struck = attack?.splash === undefined ? `${attack?.damage ?? 0}` : `${attack.splash.damage} to everyone within ${attack.splash.radius} of where it lands`
  const hit = attack === undefined ? "no attack" : `${attack.kind === "heal" ? "heals" : "hits"} ${struck} every ${seconds(attack.cooldownTicks)}, ${attack.kind === "melee" ? "melee" : `range ${attack.range}`}`
  const burn = attack?.burn === undefined ? "" : `, sets the ground within ${attack.burn.radius} burning (${attack.burn.damage} every ${seconds(attack.burn.everyTicks)} for ${seconds(attack.burn.ticks)} to whoever stands on it)`
  const aim = definition.aim === "crowd" ? ", aims at the thickest knot of enemies" : ""
  const burst = definition.detonation === undefined ? "" : `, bursts for ${definition.detonation.damage} within ${definition.detonation.radius} ${definition.detonation.triggerRange === undefined ? "when it dies" : "on contact"}`
  const speed = definition.movementRate === undefined ? "" : `, ${(definition.movementRate.numerator / definition.movementRate.denominator).toFixed(1)} tiles/s`
  return `health ${definition.maxHp}, ${hit}${burn}${aim}${burst}${speed}`
}

/** A unit's strength: its health times its damage a second, rounded down (the power curve's measure). */
export function strengthOf(definition: ContentDef): number {
  const attack = definition.attack
  if (attack === undefined || attack.kind === "heal") return 0
  return Math.floor((definition.maxHp * attack.damage * 12) / attack.cooldownTicks)
}

/** What a power does, in its card's own line. */
const cardOf = (card: PowerCard, number: number): BriefCard => ({ number, id: card.id, name: card.name, does: card.description, rarity: card.rarity })

/** The map as rows of text: ground, then every building and unit drawn with its glyph — your side in lower case, the
 *  enemy's in upper case — so the picture is the screen's. */
function picture(state: DuelState, registry: (side: Side) => ContentRegistry): string[] {
  const map = mapOf(state)
  const grid = duelGrid(map)
  const rows = map.rows.map((row) => [...row])
  const draw = (contentId: string, anchor: Readonly<{ x: number; y: number }>, side: Side): void => {
    const footprint = registry(side).get(contentId).footprint
    const art = artFor(contentId)
    for (const tile of tilesOf(anchor, footprint)) {
      if (tile.x < 0 || tile.y < 0 || tile.x >= grid.width || tile.y >= grid.height) continue
      const glyph = art?.[tile.y - anchor.y]?.[tile.x - anchor.x] ?? contentId.slice(contentId.lastIndexOf(".") + 1, contentId.lastIndexOf(".") + 2)
      ;(rows[tile.y] as string[])[tile.x] = side === "B" ? glyph.toUpperCase() : glyph.toLowerCase()
    }
  }
  if (state.carried === null) {
    for (const side of ["A", "B"] as const) for (const structure of standingOf(state, side)) draw(structure.contentId, structure.anchor, side)
  } else {
    for (const entity of state.carried.entities) draw(entity.contentId, entity.anchor, entity.player)
  }
  const header = `   ${Array.from({ length: grid.width }, (_, x) => (x % 10 === 0 ? String(x / 10) : " ")).join("")}`
  return [header, ...rows.map((row, y) => `${String(y).padStart(2, " ")} ${row.join("")}`)]
}

/** A side's round report as one line: what it built, kept, fielded, lost, dealt. */
function reportLine(label: string, report: SideReport): string {
  const counts = (record: Readonly<Record<string, number>>): string =>
    Object.entries(record)
      .map(([name, count]) => `${count} ${name}`)
      .join(", ") || "none"
  return [
    `${label} (${report.commander}): kept ${report.kept ?? "nothing"}; built ${report.built.length === 0 ? "nothing" : report.built.join(", ")}${report.formation === undefined ? "" : ` (formation ${report.formation})`}${report.refused.length === 0 ? "" : `; refused ${report.refused.join("; ")}`}; stance ${report.stance}.`,
    `  fielded ${counts(report.fielded)}; trained ${counts(report.trained)}; lost ${counts(report.lost)}.`,
    `  dealt ${report.dealt.units} to units, ${report.dealt.buildings} to buildings, ${report.dealt.nexus} to the Nexus; Nexus ${report.nexus.before} -> ${report.nexus.after} of ${report.nexus.most}${report.commanderFell ? "; the Commander fell" : ""}${report.earned > 0 ? `; earned ${report.earned} credits` : ""}${Object.keys(report.abilities).length === 0 ? "" : `; abilities ${counts(report.abilities)}`}.`,
  ].join("\n")
}

/** The brief side `side` reads before it plans the duel's next round. */
export function briefOf(state: DuelState, side: Side): Brief {
  const enemy = other(side)
  const army: DuelArmy = duelArmy(state.sides[side].commander)
  const enemyArmy: DuelArmy = duelArmy(state.sides[enemy].commander)
  const loadout = loadoutOf(army, state.sides[side])
  const enemyLoadout = loadoutOf(enemyArmy, state.sides[enemy])
  const registryOf = (who: Side): ContentRegistry => (who === side ? loadout.registry : enemyLoadout.registry)
  const commanderDef = loadout.registry.get(army.commander.unit)
  const card = CARD_TEXT[army.commander.unit]
  const pronouns = card?.pronouns ?? { subject: "they", possessive: "their" }
  const absence = state.sides[side].absent.find((entry) => entry.player === side)
  const status =
    absence === undefined
      ? "on the Grid"
      : absence.returnsInRound <= state.round
        ? "restored beside the Nexus as this round opens"
        : `out this round: ${pronouns.subject} fell in round ${absence.fellInRound} and is back for round ${absence.returnsInRound}`
  const standing = standingOf(state, side)
  const standingIds = new Set(standing.map((structure) => structure.contentId))
  const buildings: BriefBuilding[] = loadout.catalog.map((item) => {
    const building = army.buildings.find((candidate) => candidate.structure === item.contentId)
    const definition = loadout.registry.get(item.contentId)
    const needs = item.needs ?? []
    return {
      id: building?.id ?? item.contentId,
      name: item.label,
      cost: item.cost,
      tier: building?.tier ?? 1,
      needs: needs.map(titleOf),
      open: needs.every((contentId) => standingIds.has(contentId)),
      ...(item.spawns === undefined ? {} : { spawns: `${item.spawns.perWave * item.spawns.waves} ${titleOf(item.spawns.unit)} a round (${statsOf(loadout.registry.get(item.spawns.unit))})` }),
      strength: item.spawns === undefined ? 0 : item.spawns.perWave * item.spawns.waves * strengthOf(loadout.registry.get(item.spawns.unit)),
      ...(definition.supplyProvided === undefined ? {} : { supply: definition.supplyProvided }),
      skills: abilityLines(definition, { subject: "it", possessive: "its" }),
      about: CARD_TEXT[item.contentId]?.description ?? "",
    }
  })
  const hand = handOf(state, side).map((power, index) => cardOf(power, index + 1))
  const ours = state.carried === null ? [] : state.carried.entities.filter((entity) => entity.player === side)
  const supply = supplyOf([...ours.map((entity) => loadout.registry.get(entity.contentId)), ...(state.carried === null ? standing.map((structure) => loadout.registry.get(structure.contentId)) : [])])
  const nexusEntity = (who: Side) => (state.carried === null ? undefined : state.carried.entities.find((entity) => entity.player === who && registryOf(who).get(entity.contentId).nexus === true))
  const nexusHealth = (who: Side): Readonly<{ health: number; most: number }> => {
    const most = registryOf(who).get(duelArmy(state.sides[who].commander).nexus).maxHp
    return { health: state.carried === null ? most : (nexusEntity(who)?.hp ?? 0), most }
  }
  const unitsOf = (who: Side): Record<string, number> => {
    const units: Record<string, number> = {}
    for (const entity of state.carried?.entities ?? []) {
      if (entity.player !== who || registryOf(who).get(entity.contentId).layer === "obstacles") continue
      units[titleOf(entity.contentId)] = (units[titleOf(entity.contentId)] ?? 0) + 1
    }
    return units
  }
  const theirUnits = unitsOf(enemy)
  const zones = Object.fromEntries(ZONES.map((zone) => [zone, zonePoint(state, side, zone, loadout.registry)]))
  const last = state.history.at(-1) ?? null
  const data: BriefData = {
    round: state.round,
    rounds: state.setup.rounds,
    side,
    base: side === "A" ? "west" : "east",
    commander: {
      id: army.commander.id,
      name: army.commander.name,
      status,
      card: card?.description ?? "",
      skills: abilityLines(commanderDef, pronouns),
      stats: statsOf(commanderDef),
    },
    credits: state.sides[side].credits,
    supply,
    nexus: nexusHealth(side),
    hand,
    buildings,
    kept: state.sides[side].kept.flatMap((id) => powerOf(army, id)?.name ?? []),
    yours: { buildings: standing.map((structure) => `${titleOf(structure.contentId)} at ${structure.anchor.x},${structure.anchor.y}`), units: unitsOf(side) },
    zones,
    enemy: {
      commander: enemyArmy.commander.name,
      nexus: nexusHealth(enemy),
      kept: state.sides[enemy].kept.flatMap((id) => powerOf(enemyArmy, id)?.name ?? []),
      buildings: standingOf(state, enemy).map((structure) => `${titleOf(structure.contentId)} at ${structure.anchor.x},${structure.anchor.y}`),
      units: theirUnits,
      trains: enemyLoadout.catalog.flatMap((item) =>
        item.spawns === undefined ? [] : [`${item.label}: ${item.spawns.perWave * item.spawns.waves} ${titleOf(item.spawns.unit)} a round (${statsOf(enemyLoadout.registry.get(item.spawns.unit))})`],
      ),
    },
    map: picture(state, registryOf),
    last,
    history: state.history.map((report) => {
      const ours = report.sides[side]
      const theirs = report.sides[enemy]
      return `round ${report.round}: you dealt ${ours.dealt.units + ours.dealt.buildings + ours.dealt.nexus} and lost ${Object.values(ours.lost).reduce((sum, count) => sum + count, 0)} things; they dealt ${theirs.dealt.units + theirs.dealt.buildings + theirs.dealt.nexus} and lost ${Object.values(theirs.lost).reduce((sum, count) => sum + count, 0)}; your Nexus ${ours.nexus.after}, theirs ${theirs.nexus.after}.`
    }),
  }
  return { data, text: briefText(data) }
}

/** The brief written out, for a reader that reads words. */
export function briefText(data: BriefData): string {
  const lines: string[] = []
  lines.push(`# Duel, round ${data.round} of ${data.rounds}: you are side ${data.side}, base in the ${data.base}`)
  lines.push("")
  lines.push(`You lead ${data.commander.name} (${data.commander.stats}). ${data.commander.card}`)
  for (const skill of data.commander.skills) lines.push(`- ${skill}`)
  lines.push(`Your Commander is ${data.commander.status}.`)
  lines.push("")
  lines.push(`Your buildings: ${data.yours.buildings.join(", ")}. Your units home: ${Object.entries(data.yours.units).map(([name, count]) => `${count} ${name}`).join(", ") || "none"}.`)
  lines.push(`Credits to spend: ${data.credits}. Supply: ${data.supply.used} of ${data.supply.cap ?? "unlimited"} places used (a building stops training while the army is full).`)
  lines.push(`Your Nexus: ${data.nexus.health} of ${data.nexus.most}. Theirs (${data.enemy.commander}): ${data.enemy.nexus.health} of ${data.enemy.nexus.most}. A side whose Nexus falls loses.`)
  lines.push("")
  lines.push("## The Nexus Pulse's hand: keep one (by its number), or none")
  for (const card of data.hand) lines.push(`${card.number}. ${card.name} (${card.rarity}): ${card.does}`)
  if (data.kept.length > 0) lines.push(`Kept so far: ${data.kept.join(", ")}.`)
  lines.push("")
  lines.push("## What you can build (by id)")
  for (const building of data.buildings) {
    const locked = building.open ? "" : ` LOCKED: needs ${building.needs.join(" and ")} standing as the round opens.`
    const does = [building.spawns === undefined ? "" : `trains ${building.spawns}`, building.supply === undefined ? "" : `room for ${building.supply} more units`].filter((part) => part !== "").join("; ")
    const worth = building.strength === 0 ? "" : ` Strength trained a round ${building.strength} (${Math.round(building.strength / building.cost)} a credit).`
    lines.push(`- ${building.id}: ${building.name}, ${building.cost} credits, tier ${building.tier}${does === "" ? "" : `, ${does}`}.${locked}${worth} ${building.about}${building.skills.map((skill) => ` ${skill}`).join("")}`)
  }
  lines.push("")
  lines.push("## The map (your things lower case, theirs upper case; # rock, . open ground)")
  lines.push("```")
  lines.push(...data.map)
  lines.push("```")
  lines.push(`Places you can name for a building (it goes to the legal spot nearest): ${Object.entries(data.zones).map(([zone, tile]) => `${zone} (${tile.x},${tile.y})`).join(", ")}. "forward" is ahead of your furthest building, so a base pushed forward builds further forward. You may give x and y instead.`)
  lines.push(`You build within 6 of your Nexus and of buildings linked to it (a row counting two columns); buildings may touch.`)
  lines.push("")
  lines.push("## How tight your army fights")
  lines.push("Units come out on the roofs of the buildings that trained them, so where you put those buildings decides how tight your army fights.")
  lines.push("- Built touching, in a block, their waves come off the roofs together and meet the enemy as one: a tight army wins a clash of lines, but an attack that hits an area (a shell that bursts or sets the ground burning, a unit that bursts, one that aims at the thickest knot) catches many of them at once.")
  lines.push("- Built apart, the waves come out apart and reach the fight one after another, to be beaten one at a time by an army that arrives together; but an area attack catches few at once.")
  lines.push("What the enemy's buildings train, and whether any of it hits an area, is under The enemy, below.")
  lines.push("")
  lines.push("## The enemy")
  lines.push(`${data.enemy.commander}. Buildings: ${data.enemy.buildings.join(", ") || "none"}. Units home after the last round: ${Object.entries(data.enemy.units).map(([name, count]) => `${count} ${name}`).join(", ") || "none"}. Powers kept: ${data.enemy.kept.join(", ") || "none"}.`)
  if (data.enemy.trains.length > 0) lines.push(`What their buildings can train: ${data.enemy.trains.join("; ")}.`)
  if (data.last !== null) {
    lines.push("")
    lines.push(`## Last round (round ${data.last.round}, ended ${data.last.ended === "nexus" ? "when a Nexus fell" : "on time"})`)
    const enemy = data.side === "A" ? "B" : "A"
    lines.push(reportLine("You", data.last.sides[data.side]))
    lines.push(reportLine("They", data.last.sides[enemy]))
  }
  if (data.history.length > 1) {
    lines.push("")
    lines.push("## Every round so far")
    lines.push(...data.history)
  }
  lines.push("")
  lines.push("## Your plan")
  lines.push("Answer with one JSON object and nothing else:")
  lines.push("```json")
  lines.push(`{ "power": 1, "build": [ { "building": "${data.buildings[0]?.id ?? "barracks"}", "at": "forward" } ], "formation": "block", "stance": "attack", "note": "one sentence on why" }`)
  lines.push("```")
  lines.push(`- "power": the number of the card you keep, or 0 for none.`)
  lines.push(`- "build": buildings in the order you want them, while credits last; "at" is one of ${ZONES.map((zone) => `"${zone}"`).join(", ")}, or give "x" and "y". What you cannot afford or place is refused and said in the next brief.`)
  lines.push(
    `- "formation" (you may leave it out): "block" sets every building you build this round that trains units touching another, round where you ask for the first of them; "apart" sets each at least ${APART_GAP} from the others (a row counting two columns), as near there as that allows; "zones", or none, puts each where its own "at" or "x" and "y" says. Buildings that train nothing always go where they say. One of ${FORMATIONS.map((name) => `"${name}"`).join(", ")}.`,
  )
  lines.push(`- "stance": ${STANCES.map((stance) => `"${stance}"`).join(" or ")}: your troops march on their Nexus, or hold the ground in front of yours. Units that survive come home and fight again next round.`)
  return lines.join("\n")
}
