// The Proving Grounds — a third fixture roster, disposable bench content exactly like the Citizen and
// Ravel fixtures beside it (milestone-1-spike-battle.md 3.6, commander-armies.md Section 1): **not a
// Commander Army, not canon, not faction lore**. commander-armies.md still reserves real rosters for
// Milestone 4; a design here that does not pan out is discarded from this file, never reverted out of
// citizen.ts or ravel.ts, both of which carry tuned relationships other tests depend on.
//
// This roster exists for a different reason than the other two: not to characterise a faction, but to
// stress-test whether `ContentDef` plus the existing kernel rules can absorb a batch of genuinely
// different unit *mechanics* — an architecture spike Mario asked for directly, not gate work. Every
// content id below is namespaced `*.bench.*` rather than `*.citizen.*`/`*.ravel.*` for exactly that
// reason: no faction owns any of this.
//
// Per-design provenance (what each one needed from the kernel, if anything) is in
// `evidence/unit-architecture-spike.md`. The short version: most of this roster is `ContentDef` data
// and nothing else. Five designs needed one new, small, reusable kernel capability each — a hard
// targeting restriction (`targetLayers`), a soft targeting bias (`targetPreference`), a one-time
// windup before a first shot, an AOE attack (`splash`, the same `{radius,damage}` shape `detonation`
// already used), an ally-seeking heal behavior, and a combat-only spawn primitive (periodic and
// on-death) — and once built, several *other* designs below needed nothing further at all, composing
// those five capabilities with zero additional kernel code. That reuse is the actual finding.

import type { EntityLayer } from "../grid/types.ts"
import type { ContentDef } from "./types.ts"
import { rectFootprint } from "./types.ts"

const GROUND_UNIT_COLLISIONS: readonly EntityLayer[] = ["obstacles", "units"]
const STRUCTURE_COLLISIONS: readonly EntityLayer[] = ["obstacles", "workers", "units"]
const AIR_UNIT_COLLISIONS: readonly EntityLayer[] = ["air"]

/** Ground melee/ranged that should never be able to touch a flyer — the ground-air asymmetry rule
 * shape's other half: `targetLayers` is opt-in, so a unit that should stay grounded-blind says so. */
const GROUND_ONLY_TARGETS: readonly EntityLayer[] = ["obstacles", "workers", "units"]
/** Structures only — the hog-rider/wall-breaker rule shape: ignores every unit, ally or enemy, in
 * favour of beelining whatever it can actually knock down. */
const STRUCTURE_ONLY_TARGETS: readonly EntityLayer[] = ["obstacles"]

export const PROVING_GROUND_CONTENT: readonly ContentDef[] = [
  // --- Pure content: absorbed with nothing new at all ------------------------------------------
  {
    // The glass cannon: nothing here needed a new capability, only an `AttackDef` shaped like every
    // other ranged unit's, tuned toward one extreme (`sniper-crossfire.map.json`). Kept slow and
    // fragile on purpose - a long reach is the whole design, and it should cost something.
    id: "unit.bench.sniper",
    short: "sniper",
    layer: "units",
    footprint: rectFootprint(1, 1),
    maxHp: 14,
    movementRate: { numerator: 3, denominator: 2 },
    speedTier: 1,
    attack: { kind: "ranged", range: 9, damage: 22, cooldownTicks: 40, projectileTilesPerTick: 6 },
    collidesWith: GROUND_UNIT_COLLISIONS,
    behavior: "advance",
    salvage: 10,
  },

  // --- The ground-air asymmetry (`sky-ground-asymmetry.map.json`) -------------------------------
  {
    // "Ground units cannot reach air" is not automatic - the layer model deliberately lets a ground
    // and an air entity share a tile (Q8), and nothing in `attacks()` ever checked layer compatibility
    // before this spike. `targetLayers` closes exactly that gap, opt-in per unit rather than a new
    // default, so every existing Citizen/Ravel hash is untouched.
    id: "unit.bench.grunt",
    short: "grunt",
    layer: "units",
    footprint: rectFootprint(1, 1),
    maxHp: 34,
    movementRate: { numerator: 3, denominator: 1 },
    speedTier: 2,
    attack: { kind: "melee", range: 1, damage: 9, cooldownTicks: 12 },
    collidesWith: GROUND_UNIT_COLLISIONS,
    behavior: "advance",
    salvage: 12,
    targetLayers: GROUND_ONLY_TARGETS,
  },
  {
    // The counter, and proof `targetLayers` is a real choice rather than a hardcoded law: this is an
    // otherwise ordinary ranged trooper, `targetLayers` left undefined (its default is "every layer"),
    // so it can already hit the skyraider with no new content field at all.
    id: "unit.bench.flaktrooper",
    short: "flak",
    layer: "units",
    footprint: rectFootprint(1, 1),
    maxHp: 26,
    movementRate: { numerator: 5, denominator: 2 },
    speedTier: 1,
    attack: { kind: "ranged", range: 4, damage: 7, cooldownTicks: 18, projectileTilesPerTick: 3 },
    collidesWith: GROUND_UNIT_COLLISIONS,
    behavior: "advance",
    salvage: 12,
  },
  {
    // "Goes to the nearest enemy and starts shooting and following" is already exactly what `behavior:
    // "advance"` plus an `attack` does for *any* content - the air layer and its own mask
    // (`collidesWith: ["air"]`, ignoring terrain) were proven in Gate 1B already. Nothing about being
    // a flyer needed new kernel work; only the *ground's* inability to reach it did.
    id: "unit.bench.skyraider",
    short: "skyraider",
    layer: "air",
    footprint: rectFootprint(1, 1),
    maxHp: 26,
    movementRate: { numerator: 5, denominator: 1 },
    speedTier: 1,
    attack: { kind: "ranged", range: 3, damage: 8, cooldownTicks: 14, projectileTilesPerTick: 3 },
    collidesWith: AIR_UNIT_COLLISIONS,
    behavior: "advance",
    salvage: 16,
  },

  // --- Contact detonation (`spitter-contact.map.json`) ------------------------------------------
  {
    // The baneling rule shape: existing `detonation` only ever fired on death, which is a different
    // thing than a unit *choosing* to blow up on approach - a Ravel runner still has to be killed
    // first. `triggerRange` is the smallest addition that makes the choice itself the attack, with no
    // `attack` field at all: it carries no weapon, the same flavour `unit.ravel.fuelwagon` already
    // uses, just triggered by proximity instead of by dying.
    id: "unit.bench.spitter",
    short: "spitter",
    layer: "units",
    footprint: rectFootprint(1, 1),
    maxHp: 12,
    movementRate: { numerator: 4, denominator: 1 },
    speedTier: 1,
    collidesWith: GROUND_UNIT_COLLISIONS,
    behavior: "advance",
    salvage: 6,
    detonation: { radius: 2, damage: 16, triggerRange: 1 },
  },

  // --- Pure composition: zero new kernel code, reusing the two capabilities above ----------------
  {
    // Hog Rider: `targetLayers: ["obstacles"]` alone - the exact mechanism the grunt uses to lose a
    // layer, pointed at a different one - makes a unit ignore every enemy soldier entirely and beeline
    // whatever it can knock down. No new capability; `bench-siege-composition.map.json`.
    id: "unit.bench.hogrider",
    short: "hog",
    layer: "units",
    footprint: rectFootprint(1, 1),
    maxHp: 46,
    movementRate: { numerator: 6, denominator: 1 },
    speedTier: 1,
    attack: { kind: "melee", range: 1, damage: 14, cooldownTicks: 10 },
    collidesWith: GROUND_UNIT_COLLISIONS,
    behavior: "advance",
    salvage: 18,
    targetLayers: STRUCTURE_ONLY_TARGETS,
  },
  {
    // Wall-Breaker: `targetLayers` (structures only) plus `detonation.triggerRange` (contact
    // self-destruct) together, composed with no glue code between them - perception already resolves
    // a contact-detonator's target through the same `targetLayers` filter an armed unit uses, since
    // both read from the one candidate list. Two capabilities built for two different designs meeting
    // for free is the actual finding this unit exists to demonstrate.
    id: "unit.bench.saboteur",
    short: "saboteur",
    layer: "units",
    footprint: rectFootprint(1, 1),
    maxHp: 20,
    movementRate: { numerator: 9, denominator: 2 },
    speedTier: 1,
    collidesWith: GROUND_UNIT_COLLISIONS,
    behavior: "advance",
    salvage: 10,
    targetLayers: STRUCTURE_ONLY_TARGETS,
    detonation: { radius: 2, damage: 30, triggerRange: 1 },
  },
  {
    // Balloon: a third composition of already-proven pieces - the `air` layer, `targetLayers`
    // restricted to structures, a normal `attack` for its bombing run, and a plain death-only
    // `detonation` (no `triggerRange`) so a bomber shot down before it arrives still goes out loud.
    // Every one of those four fields already existed before this unit was designed.
    id: "unit.bench.bomber",
    short: "bomber",
    layer: "air",
    footprint: rectFootprint(1, 1),
    maxHp: 20,
    movementRate: { numerator: 4, denominator: 1 },
    speedTier: 2,
    attack: { kind: "ranged", range: 2, damage: 10, cooldownTicks: 20, projectileTilesPerTick: 4 },
    collidesWith: AIR_UNIT_COLLISIONS,
    behavior: "advance",
    salvage: 14,
    targetLayers: STRUCTURE_ONLY_TARGETS,
    detonation: { radius: 2, damage: 14 },
  },
  {
    // The control case commander-armies.md Section 7 already predicted: "nothing about this needs a
    // new engine capability, only content shaped to use two rules that already exist" - a straight
    // 4x1 footprint (multi-tile is RULE, engine.md 3.5) and `behavior: "static"` (an armed structure
    // never chased anything before this spike either, and did not need to start). Placed already
    // standing, it blocks a whole corridor and fights back at anything that reaches it, but never
    // advances - `bench-siege-composition.map.json` places it as the line the rushers above have to
    // get through, or fly over.
    id: "unit.bench.wallsegment",
    short: "wall",
    layer: "units",
    footprint: rectFootprint(4, 1),
    maxHp: 140,
    speedTier: 3,
    attack: { kind: "melee", range: 1, damage: 6, cooldownTicks: 14 },
    collidesWith: GROUND_UNIT_COLLISIONS,
    behavior: "static",
    salvage: 40,
  },

  // --- Siege crawler: windup + splash (`siege-crawler-windup.map.json`) --------------------------
  {
    // "Moves, then anchors with a delay, then shoots with explosive AOE" needed two small, reusable
    // additions: `windupTicks` (a one-time hold before the first shot after arriving, spent only while
    // genuinely holding position - see `EntityState.windup`) and `splash` (the `detonation` shape
    // reused as an attack's own AOE instead of a death's). Two tiles wide on purpose: engine.md 3.5's
    // "range measures to the nearest occupied tile" already makes a body this size easier to hit just
    // by existing, before the windup adds a second, deliberate downside on top.
    id: "unit.bench.siegecrawler",
    short: "siege",
    layer: "units",
    footprint: rectFootprint(2, 1),
    maxHp: 70,
    movementRate: { numerator: 4, denominator: 3 },
    speedTier: 3,
    attack: {
      kind: "ranged",
      range: 6,
      damage: 20,
      cooldownTicks: 30,
      projectileTilesPerTick: 4,
      windupTicks: 30,
      splash: { radius: 2, damage: 14 },
    },
    collidesWith: GROUND_UNIT_COLLISIONS,
    behavior: "advance",
    salvage: 30,
  },

  // --- Siege giant: targetPreference, a soft bias (`ram-breach.map.json`) ------------------------
  {
    // "Targets buildings" needed a *soft* bias, not `targetLayers`'s hard restriction: a giant that
    // could never fight back once every building fell would be a worse unit for the same idea.
    // `targetPreference` narrows `selectTarget`'s candidate list to preferred layers only when
    // something on one is actually in sight, falling back to the ordinary nearest-enemy scan
    // otherwise - the giant keeps fighting normally once the walls are down.
    id: "unit.bench.ram",
    short: "ram",
    layer: "units",
    footprint: rectFootprint(2, 2),
    maxHp: 130,
    movementRate: { numerator: 5, denominator: 6 },
    speedTier: 4,
    attack: { kind: "melee", range: 1, damage: 20, cooldownTicks: 18 },
    collidesWith: GROUND_UNIT_COLLISIONS,
    behavior: "advance",
    salvage: 50,
    targetPreference: STRUCTURE_ONLY_TARGETS,
  },

  // --- Healer: ally-seeking support (`medic-support.map.json`) -----------------------------------
  {
    // The biggest single gap on this bench: every existing behavior seeks the nearest *hostile*.
    // `behavior: "support"` is a fourth value that tells perception to seek wounded *allies* instead
    // (reusing `selectTarget`'s own nearest-first scoring unchanged - only the candidate list differs),
    // and `AttackKind: "heal"` plus `applyHeal` (shared.ts) is `applyDamage`'s mirror: clamped at
    // `maxHp` instead of zero, reported as its own `heal.applied` event rather than a negative
    // `damage.applied`, because a heal is a different *meaning*, not just a different sign
    // (engine.md 7). Flying on purpose - Clash of Clans' own Healer is a flyer - so its own scenario
    // doubles as an integration check: the medic answers whether ally-targeting composes cleanly with
    // the ground-air asymmetry built for the skyraider, not just whether it works in isolation.
    id: "unit.bench.medic",
    short: "medic",
    layer: "air",
    footprint: rectFootprint(1, 1),
    maxHp: 30,
    movementRate: { numerator: 4, denominator: 1 },
    speedTier: 2,
    attack: { kind: "heal", range: 3, damage: 7, cooldownTicks: 10 },
    collidesWith: AIR_UNIT_COLLISIONS,
    behavior: "support",
    salvage: 14,
  },

  // --- Spawner: a combat-only summon primitive (`hatchery-spawn.map.json`) -----------------------
  {
    // "Large unit that creates smaller units" needed real, new machinery: nothing in the kernel could
    // create an entity after tick 0 before this spike. `ContentDef.spawn` plus `pulse/spawn.ts`'s
    // `spawning()` phase is scoped deliberately narrow - no cost, no resource, nothing the empty
    // `economyAndProduction` phase would recognise as its own - specifically so it reads as a combat
    // ability (a Clash Royale Graveyard, a StarCraft Broodmother) rather than the production system
    // Milestone 2 still owns. `specs/open-questions.md` Q26 registers exactly that boundary for Mario.
    id: "structure.bench.hatchery",
    short: "hatch",
    layer: "obstacles",
    footprint: rectFootprint(2, 2),
    maxHp: 100,
    speedTier: 4,
    collidesWith: STRUCTURE_COLLISIONS,
    behavior: "static",
    salvage: 40,
    spawn: { contentId: "unit.bench.spawnling", intervalTicks: 50, maxAlive: 3 },
  },
  {
    // The disposable minion both the hatchery (periodically, while alive) and the shard-giant
    // (once, on death) create - one small combatant serving two different triggers is itself part of
    // the finding: the spawn *primitive* generalised to a second trigger for free; only the trigger
    // moment (`spawn` vs `splitOnDeath`) needed its own field.
    id: "unit.bench.spawnling",
    short: "spawnling",
    layer: "units",
    footprint: rectFootprint(1, 1),
    maxHp: 8,
    movementRate: { numerator: 3, denominator: 1 },
    speedTier: 2,
    attack: { kind: "melee", range: 1, damage: 3, cooldownTicks: 10 },
    collidesWith: GROUND_UNIT_COLLISIONS,
    behavior: "advance",
    salvage: 2,
  },
  {
    // The golem rule shape: `splitOnDeath` reuses `spawn.ts`'s own construction primitive
    // (`spawnOneNear`) from a second trigger, death instead of a periodic timer - proof the spawn
    // primitive is a primitive and not a one-off wired to the hatchery specifically. Three tiles long
    // on purpose, a third distinct multi-tile shape on the bench (2x1 crawler, 2x2 giant, 3x1 here).
    id: "unit.bench.shardgiant",
    short: "shard",
    layer: "units",
    footprint: rectFootprint(3, 1),
    maxHp: 90,
    movementRate: { numerator: 5, denominator: 6 },
    speedTier: 4,
    attack: { kind: "melee", range: 1, damage: 16, cooldownTicks: 16 },
    collidesWith: GROUND_UNIT_COLLISIONS,
    behavior: "advance",
    salvage: 34,
    splitOnDeath: { contentId: "unit.bench.spawnling", count: 2 },
  },

  // --- Focus turret: damage that ramps with a held lock (`beamturret-focus.map.json`) ------------
  {
    // The Inferno-Tower rule shape needed one thing nothing on the bench had before: per-actor combat
    // *memory* beyond a cooldown - `EntityState.focusStreak`, reset the instant perception reassigns a
    // target (including losing one), incremented on every landed hit. `AttackDef.focusRamp` reads it
    // to scale `attack.damage`. Also the bench's first static structure with a real `attack` at all -
    // the schema already allowed it (`isMobile`/`intents()` only ever gated *movement* on behavior,
    // never firing), nobody had authored one yet.
    id: "structure.bench.beamturret",
    short: "beam",
    layer: "obstacles",
    footprint: rectFootprint(1, 1),
    maxHp: 60,
    speedTier: 2,
    attack: {
      kind: "ranged",
      range: 6,
      damage: 6,
      cooldownTicks: 10,
      projectileTilesPerTick: 5,
      focusRamp: { perHitPercent: 50, maxPercent: 300 },
    },
    collidesWith: STRUCTURE_COLLISIONS,
    behavior: "static",
    salvage: 24,
  },
]
