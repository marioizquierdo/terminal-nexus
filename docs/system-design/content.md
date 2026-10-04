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

The recipe the Pulse runs today (`ProductionRecipe` in `src/content/types.ts`) is the free part of this
one: `output`, `quantity`, `intervalTicks`, and a `perPulse` cap that stands in for the supply a
recipe will one day need. `cost` and `spawnRule` arrive with the worker economy. No content definition
carries a recipe; a mission opts a building in (see "Automatic production" in
[`pulse.md`](pulse.md)).

Upgrades, Nexus powers, Commanders, and Commander Armies follow the same pattern and are described in
[`commander-armies.md`](../game-design/commander-armies.md). A Commander today is a unit whose content says so
(`commander: true`, Vasse in `src/content/commanders.ts`), which only the rules between rounds read (see
"Commander" in [`pulse.md`](pulse.md)). A **Commander Army** is the playable content boundary:
the complete set of choices legally available to one player in one match — a Nexus and faction, a
Commander, starting units and structures, blueprints and a tech tree, upgrades, Nexus powers, and
Specials, bounded against its faction's pools (same document). The match, the Pulse, and every
renderer see an army; none of them ever sees a faction. What is built of one is smaller, and organized as
content bundles: the buildings and Nexus powers a player may be offered, a Commander, and a campaign whose
levels each offer what it has unlocked by then.

**Content is organized as bundles, data rather than code** (RULE — `bundles/`, `src/bundles/`,
`tests/bundles.test.ts`). A bundle is a folder under `bundles/` holding a `bundle.json`: its id and title,
the bundles it `requires`, `notes`, and any of five sections — `content` (the content ids it brings to the
Grid), `buildings` (a structure and its cost), `powers` (a Nexus power's name, its one line and its effect),
`commanders` (a name and her unit) and `campaigns` (a Commander and her levels in the order they are played,
each with a map by name, its credits, what it unlocks and its mission). **A bundle sees what it and the
bundles it requires bring, directly or through another, and nothing else**, so content forms a tree with a
campaign at the top: its levels, then the cards and units they use, from its own bundle or one beneath it.
`common` holds the buildings and Nexus powers any Commander may use; `vasse` requires it and holds her
Commander and her campaign. The loader (`src/bundles/load.ts`, pure: the content registry and the map table
are its arguments) refuses a broken bundle with every problem at once, each naming where by ids
(`campaigns[vasse].levels[vasse-test-2].mission.pulses`), and freezes what it hands the game. The kernel
never reads a bundle; the Build Phase's assembly reads what a level offers.

Still code, each named by id from a bundle: the content definitions themselves (stats and footprints, in
`src/content`; moving them into bundles is the next step), what a Nexus power's effect kinds do, the starter
map (`src/build/maps.ts`) and the mission vocabulary (`src/mission/`). The game reads only the bundles
`src/bundles/index.ts` lists, imported with the code: there is no mod loader looking for folders on disk.
**To add a Commander**: a folder requiring `common`, her unit's id in `content`, her `commanders` entry, a
campaign whose levels unlock `common`'s cards or her own, and one line in that list.

Prefer composable capabilities — health, movement, attack, production, storage, supply, worker slots,
radius, restoration, regroup anchor — over inheritance. Exceptional behaviour may register narrow
hooks that receive read-only context and return intents for the kernel to validate. A hook API
protects engine integrity; it is **not** a security sandbox, and installed TypeScript is arbitrary
local code. No hook API is built (**IDEA**).
