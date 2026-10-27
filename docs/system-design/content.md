# Terminal Nexus — content interfaces

_How units, structures, factions and armies are described to the engine: declarative TypeScript definitions, composable capabilities, and the seams left open for modding._

## 1. Content interfaces

**Content is TypeScript-first and declarative** (RULE — `src/content/types.ts`). A unit, structure or
attack is a data record the kernel reads (`ContentDef` and its attack, detonation and spawn shapes),
registered by id in a content registry (`src/content/index.ts`); behaviour comes from capabilities
and bounded rule shapes on the record, never from code written per unit.

**A Grid Nexus is a flag on a content definition**, never a content id the kernel recognises (RULE —
`tests/ravel.test.ts`, `src/pulse/victory.ts`); see
[`pulse.md`](pulse.md).

**A building that carries an upgrade or a mode has a content id of its own** (RULE — `src/content/fitted.ts`,
`tests/building-upgrades.test.ts`): its base and what it carries, in its card's order
(`structure.citizen.barracks+production-line`). Its side's registry resolves it from the base with those actions'
effects applied, and keeps it (`ContentRegistry.fitter`, made by the army loader from the cards). So the kernel, the
hash, the regroup and the opening carry it as any content id, and nothing in the kernel knows a building was upgraded;
a building that carries nothing keeps its base id, and a state holds the bytes it always did. Art, card words and the
build menu read the base.

**Modding is a set of seams, not a feature**: keep the places a mod would plug in (definitions are
data, the registry is built from a list, the kernel takes the registry as an argument) but build no
loader and no stable SDK (RULE — `AGENTS.md`, which forbids building a mod loader).

The interfaces below are sketches. Names and shapes will change the first time real content touches
them, and that is expected; the shape built today is `ContentDef` in `src/content/types.ts`.
The content built so far is the bench rosters (Citizen, Ravel and Proving Grounds, used by the tests and
the engine tool) and the starter map's catalog; none of it is a Commander Army.
**Do not build these interfaces before content needs them.**

```ts
type ContentId = string
type EntityId = string
type Tick = number
type Rational = Readonly<{ numerator: number; denominator: number }>
type ResourceCost = Readonly<Record<ContentId, number>>

interface UnitDefinition {
  readonly id: ContentId
  readonly layer: "workers" | "units" | "air"
  readonly roleTags: readonly string[]
  readonly footprint: Footprint
  readonly maxHealth: number
  readonly supply: number
  readonly movementRate: Rational
  readonly speedTier: number
  readonly attack?: ContentId
  readonly capabilities: readonly ContentId[]
  readonly presentation: ContentId
}

interface AttackDefinition {
  readonly id: ContentId
  readonly range: number
  readonly damage: number
  readonly speedTier: number
  readonly cooldownTicks: number
  readonly targetRules: readonly ContentId[]
  readonly presentationCue: ContentId
}

interface StructureDefinition {
  readonly id: ContentId
  readonly roleTags: readonly string[]
  readonly level: 1 | 2 | 3
  readonly footprint: Footprint
  readonly maxHealth: number
  readonly cost: ResourceCost
  readonly buildRadius?: number
  readonly storage?: number
  readonly supply?: number
  readonly workerSlots?: number
  readonly production?: ProductionRecipe
  readonly attack?: ContentId
  readonly presentation: ContentId
}

interface ProductionRecipe {
  readonly output: ContentId
  readonly quantity: number
  readonly cost: ResourceCost
  readonly intervalTicks: number
  readonly spawnRule: ContentId
}
```

The sketch's `buildRadius` is built as `constructionRadius` on `ContentDef`: every building the player places
has one, the kernel never reads it, and while the "Build range" Experiment is felt its value stands in for
each ([`pulse.md`](pulse.md), construction territory).

Supply: `supplyProvided`, how many more units a structure lets its side field at once (the Grid Nexus 12, a Supply
Depot 8), and `supplyCost`, the places a unit takes (1 when absent; a Commander's is 0). The kernel reads both, in
production only ([`pulse.md`](pulse.md), supply).

A building that heals is the kernel's healer on a structure: `behavior: "support"` with a heal `attack`, and
`targetLayers` naming what it heals, which narrows a healer's wounded allies as it narrows an attacker's enemies.
The Aid Station names the units' layers, so it never heals a building ([`pulse.md`](pulse.md), a healer).

The recipe the Pulse runs today (`ProductionRecipe` in `src/content/types.ts`) is the free part of this one,
in waves: `output`, `perWave`, `waves` (a cap that stands in for the supply a recipe will one day need),
`firstTicks` and `intervalTicks`, the gap between waves. `cost` and `spawnRule` arrive with the worker
economy. No content definition carries a recipe; a battle opts a building in from what its card in the army
spawns (see "Automatic production" in [`pulse.md`](pulse.md)).

Upgrades, Nexus powers, Commanders, and Commander Armies follow the same pattern and are described in
[`commander-armies.md`](../game-design/commander-armies.md). A **Commander Army** is the playable content boundary:
the complete set of choices legally available to one player in one match — a Nexus and faction, a
Commander, starting units and structures, blueprints and a tech tree, upgrades, Nexus powers, and
Specials, bounded against its faction's pools (same document). The match, the Pulse, and every
renderer see an army; none of them ever sees a faction.

**An army is data, not code** (RULE — `armies/`, `campaigns/`, `src/armies/`, `tests/armies.test.ts`). How to write
one, field by field, with its conventions and a checklist for a new Commander, is
[`army-authoring.md`](army-authoring.md); what follows is the shape. Armies stack: `armies/all` holds what any
Commander may use (the Hatchery, the Turret, War Chest); a faction army (`armies/citizen`, `armies/ravel`) requires
it and holds that faction's Nexus, units, buildings and powers; a Commander army (`armies/vasse`, `armies/averno`,
`armies/dob`) requires her faction and holds her unit, her `commanders` entry (her faction, lean, portrait, barks,
starting package and Nexus Pulse schedule) and her own powers. Campaigns are their own folders under `campaigns/`,
requiring the armies they play; a level may extend another and change its mission. **An army sees what it and the
armies it requires bring, and nothing else.** A unit or a structure is written in an army's `content` as data —
its stats, its footprint, its card text and its glyph — with the engine's defaults filled in
(`src/content/army-content.ts`); a few long-standing ids are still defined in `src/content` and named by id.

What a Nexus power does is one entry of a table (`EFFECTS`, `src/armies/effects.ts`), and what a unit does on its
own — an aura, a bounty, loaded dice — one entry of another (`ABILITIES`, `src/abilities/`), each with its shape,
its checks and its card line in one place. The loader (`src/armies/load.ts`, pure) refuses a broken army with
every problem at once, each naming where by ids, and freezes what it hands the game. A Commander's arsenal is her
own army and her faction chain: she deals and builds only from those, and a card another Nexus slips into her hand
is marked `from` that faction. The kernel never reads an army; it reads content definitions, each side's own.
The game reads only the armies and campaigns `src/shipped.ts` lists, imported with the code: there is no mod
loader looking for folders on disk.

Prefer composable capabilities — health, movement, attack, production, storage, supply, worker slots,
radius, restoration, regroup anchor — over inheritance. **Exceptional behaviour is an ability kind** (RULE —
`src/abilities/`, `src/pulse/abilities.ts`, `tests/abilities.test.ts`): a kind registers narrow hooks (damage
modifiers decided on a read-only view, a hit dealt, a tick, a death), and each hook changes the world only
through what it is handed (a seeded draw, a heal, a damage, a note), so the kernel stays pure and every run
hashes the same. The table is a seam, not a security sandbox: installed TypeScript is arbitrary local code.
