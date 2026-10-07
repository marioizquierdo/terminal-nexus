// What each thing on the Grid says about itself on a card (Mario, 2026-09-30: "the cards
// have title, subtitle, description, stats"): its name, one short line on what it is for, and two or
// three plain sentences with a little more detail. Keyed by the same ids as the content definitions and
// the terrain — like the art table beside it (`art.ts`), a table the kernel never reads, so the words a
// player reads live with the content they describe and not in the view that draws them. A card's
// numbers are not here: they come from the content definition and the catalog (`src/build/card.ts`).
//
// Written to the side panel's width at the 80-column floor, where it is narrowest (27 glyphs): a
// subtitle sits beside the icon, under the title, and should fit on that one line; a description wraps
// between words and should leave the card's numbers room above the Start Battle Round row.
// `tests/build-card.test.ts` draws every card at 80 x 24 and fails if either does not fit.
//
// Plain and short, in the game's voice, and honest: a card says what the thing does in the game as it
// stands — never a mechanic the game does not have yet. Lore is a platform, not a plot; the Grid wins.

/** A card's words: its name, one line on what it is for, and a few sentences more. */
export type CardText = Readonly<{ title: string; subtitle: string; description: string }>

export const CARD_TEXT: Readonly<Record<string, CardText>> = {
  // --- What the Build Phase can build (the catalog's rows; the title is the menu row's label) --------
  "structure.citizen.barracks": {
    title: "Barracks",
    subtitle: "Trains troopers",
    description: "Trains a wave of troopers, all at once, a few seconds into each Battle Round. They join the fight, and come home to it after.",
  },
  "structure.bench.hatchery": {
    title: "Hatchery",
    subtitle: "Spawns swarmers",
    description: "Breeds a wave of small biting swarmers a few seconds into each Battle Round, all at once. They rush the enemy.",
  },
  "structure.bench.beamturret": {
    title: "Turret",
    subtitle: "Shoots what comes close",
    description: "A gun on a single tile. Its beam hits harder the longer it holds one target, up to three times as hard.",
  },

  // --- Already on the map ---------------------------------------------------------------------------
  "structure.citizen.nexus": {
    title: "Citizen Nexus",
    subtitle: "Your base: guard it",
    description: "The heart of everything you build. If it falls, the battle is lost: put your defences in front of it.",
  },

  // --- On the map between rounds: survivors of both sides, the raid's camp, what is coming ---
  "unit.citizen.trooper": {
    title: "Trooper",
    subtitle: "Your foot soldier",
    description: "Fights in melee and holds the line. You start with a squad; a Barracks trains more.",
  },
  "unit.citizen.vasse": {
    title: "Vasse",
    subtitle: "Your Commander",
    description: "Commander Edda Vasse leads from just behind the line. If she falls, she misses the next round; then the Nexus restores her.",
  },
  "unit.citizen.marksman": {
    title: "Marksman",
    subtitle: "Shoots from far back",
    description: "Hits from further away than a trooper, but falls quickly if the raid reaches it.",
  },
  "unit.bench.spawnling": {
    title: "Swarmer",
    subtitle: "From your Hatchery",
    description: "Small and quick. It rushes the enemy, and a Hatchery breeds more every Battle Round.",
  },
  "unit.ravel.runner": {
    title: "Runner",
    subtitle: "Fast raid biter",
    description: "Quick and light. It runs at the nearest thing of yours and bites, and explodes when it dies.",
  },
  "unit.ravel.raider": {
    title: "Raider",
    subtitle: "Heavy raid brawler",
    description: "Long and tough. It crashes into whatever of yours is nearest and hits hard in melee.",
  },
  "unit.ravel.slinger": {
    title: "Slinger",
    subtitle: "Raid's ranged thrower",
    description: "Throws from a few tiles away, so it can hurt a building from behind the others.",
  },
  "structure.ravel.den": {
    title: "Den",
    subtitle: "Raid's forward camp",
    description: "Scrap welded into a shelter. Easier to destroy than a Barracks.",
  },

  // --- Bare ground ----------------------------------------------------------------------------------
  "terrain.plain": {
    title: "Open ground",
    subtitle: "Buildings can go here",
    description: "Flat and empty. Nothing stands in the way of a building or a unit.",
  },
  "terrain.rock": {
    title: "Rock",
    subtitle: "Blocks everything",
    description: "Nothing can be built on it and no unit can cross it, so it shapes where a fight can go.",
  },
  "terrain.deposit": {
    title: "Deposit",
    subtitle: "Resources lie here",
    description: "A seam of the resources you spend, under the same mark. For now you can build and walk on it.",
  },
}

/** A Commander's name as a player reads it — her card's title — for the lines that say she fell, is out
 *  or is back. */
export function commanderName(contentId: string): string {
  return CARD_TEXT[contentId]?.title ?? "Your Commander"
}
