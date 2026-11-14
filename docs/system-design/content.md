# Terminal Nexus — content interfaces

_How units, structures, factions and armies are described to the engine: declarative TypeScript definitions, composable capabilities, and the seams left open for modding._

## 1. Content interfaces

**Content is TypeScript-first and declarative** (RULE — `src/content/types.ts`). A unit, structure or
attack is a data record the kernel reads (`ContentDef` and its attack, detonation and spawn shapes),
registered by id in a content registry (`src/content/index.ts`); behaviour comes from capabilities
and bounded rule shapes on the record, never from code written per unit.

**A Grid Nexus is a flag on a content definition**, never a content id the kernel recognises (RULE —
[`grid-engine.md`](grid-engine.md), invariants).

**A building that carries an upgrade or a mode has a content id of its own** (RULE — `src/content/fitted.ts`,
`tests/building-upgrades.test.ts`): its base and what it carries, in its card's order
(`structure.citizen.barracks+production-line`). Its side's registry resolves it from the base with those actions'
effects applied, and keeps it (`ContentRegistry.fitter`, made by the army loader from the cards). So the kernel, the
hash, the regroup and the opening carry it as any content id, and nothing in the kernel knows a building was upgraded;
a building that carries nothing keeps its base id, and a state holds the bytes it always did. Art, card words and the
build menu read the base.

**Modding is a set of seams, not a feature**: definitions are data, the registry is built from a list and the
kernel takes the registry as an argument, so a mod could plug in; no loader and no stable SDK is built (RULE —
[`runtime.md`](runtime.md), tools and modding).

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

**An army is data, not code** (RULE — `armies/`, `stories/`, `src/armies/`, `tests/armies.test.ts`). The files, every
field, how armies stack and the checklist for a new Commander are in [`army-authoring.md`](army-authoring.md); the
shape is this. **An army sees what it and the armies it requires bring, and nothing else.** A unit or a structure is
written in an army's `content` as data (stats, footprint, card text, glyph) with the engine's defaults filled in
(`src/content/army-content.ts`); a few long-standing ids are still defined in `src/content` and named by id. The
loader (`src/armies/load.ts`, pure) refuses a broken army with every problem at once and freezes what it hands the
game. A Commander's arsenal is her own army and her faction chain: she deals and builds only from those, and a
card another Nexus slips into her hand is marked `from` that faction. The kernel never reads an army; it reads content definitions, each side's own. The game reads only the armies
and stories `src/shipped.ts` lists: there is no mod loader looking for folders on disk.

Prefer composable capabilities — health, movement, attack, production, storage, supply, worker slots,
radius, restoration, regroup anchor — over inheritance. **Exceptional behaviour is an ability kind** (RULE —
`src/abilities/`, `tests/abilities.test.ts`; the hooks and the kinds are in [`army-authoring.md`](army-authoring.md),
abilities, and the kernel's calls in [`pulse.md`](pulse.md), tick order), so the kernel stays pure and every run
hashes the same. The table is a seam, not a security sandbox: installed TypeScript is arbitrary local code.
