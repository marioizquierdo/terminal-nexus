# Terminal Nexus — authoring an army

_How to add a Commander, a faction or a campaign: the files, every field, the code that runs a new ability or a new kind of Nexus power, and the conventions that keep a new army from adding branches to the engine. The guide for a session that makes an army, and the reference a modder would start from._

The design of a Commander Army — what it is for, the power curve it is built against, what makes two Commanders
read apart — is [`commander-armies.md`](../game-design/commander-armies.md). This page is how one is written down.
The duel, where armies are played against each other, is [`duels.md`](duels.md).

## 1. The pieces

**Two kinds of file, both data** (RULE — `src/armies/load.ts`, `tests/armies.test.ts`):

| File | What it holds |
| --- | --- |
| `armies/<id>/army.json` | What a side can field: units and structures, building cards, Nexus powers, and at most one Commander. |
| `campaigns/<id>/campaign.json` | A Commander's levels in order: map, credits, unlocks, schedule, mission. |

**Armies stack by `requires`**, and each army sees what it requires and nothing else:

| Army | Kind | Holds |
| --- | --- | --- |
| `all` | shared | What any army may use: the neutral bench buildings (Hatchery, Turret) and War Chest, the owner's testing tool. |
| `citizen`, `ravel` | faction | A Nexus's units, buildings and the powers any of its Commanders may be dealt. |
| `vasse`, `averno`, `dob` | Commander | One Commander: her unit, her voice, her own cards, on top of her faction. |

A campaign names the armies its levels play with: the Commander's army and the raid's faction
(`"requires": ["vasse", "ravel"]`). The loader refuses anything a file names that it cannot see, every problem at
once, by path.

**What ships is one list** (`src/shipped.ts`): a new file is a folder and one import line there. Nothing looks for
folders on disk; there is no mod loader (AGENTS.md).

## 2. A Commander in one file

Everything that is the Commander is in her army file. Dob Hunter's, shortened:

```json
{
  "id": "dob", "title": "Dob Hunter", "requires": ["ravel"],
  "content": [
    {
      "id": "unit.ravel.dob", "layer": "units", "size": [1, 1], "commander": true, "roundsOut": 0, "supplyCost": 0,
      "maxHp": 60, "movementRate": { "numerator": 4, "denominator": 1 }, "speedTier": 1,
      "attack": { "kind": "ranged", "range": 4, "damage": 6, "cooldownTicks": 15, "projectileTilesPerTick": 3 },
      "detonation": { "radius": 2, "damage": 12 },
      "abilities": [
        { "kind": "bounty", "name": "Bounty", "radius": 6, "credits": 3, "structureCredits": 15 },
        { "kind": "loadedDice", "name": "Loaded Dice", "chanceIn": 4, "times": 3 }
      ],
      "card": { "title": "Dob", "subtitle": "Your Commander", "description": "...", "pronouns": { "subject": "he", "possessive": "his" } },
      "glyph": ["$"]
    }
  ],
  "powers": [
    { "id": "lucky-scrap", "name": "Lucky Scrap", "description": "Bounty pays 3 more for each kill.",
      "effect": { "modifyAbility": { "content": "unit.ravel.dob", "kind": "bounty", "add": { "credits": 3 } } },
      "rarity": "uncommon", "role": "economy" }
  ],
  "commander": {
    "id": "dob", "name": "Dob Hunter", "unit": "unit.ravel.dob", "lean": ["economy", "commander"],
    "start": [{ "unit": "unit.ravel.runner", "count": 5 }, { "unit": "unit.ravel.slinger", "count": 2 }],
    "portrait": [" ,$, ", "(^_~)", "/{$}\\"], "barks": { "appears": ["Dob. Bounties open."] }
  }
}
```

### Content: a unit or a structure as data

An entry of `content` is either a **string**, naming content the engine defines in TypeScript (the bench rosters in
`src/content/`, which the bench maps and kernel tests are written against), or an **object**, defining it here
(`src/content/data.ts`). An object is three things the game keeps apart: the **definition** the kernel reads, the
**card** a player reads, and the **glyph** only the view draws (the kernel never sees a glyph).

Every field of the definition is the `ContentDef` field of the same name (`src/content/types.ts` says what each
does), but:

| Field | Meaning, and the default when left out |
| --- | --- |
| `size` | `[width, height]` in tiles; the footprint. Required. |
| `short` | The name report lines use (`A:dob#4`). Default: the id's last part. |
| `speedTier` | Initiative, lower first. Default: 2 for anything that moves, 9 for a structure. |
| `collidesWith` | Default: what its layer collides with (a ground unit bumps buildings and units). |
| `behavior` | Default: `advance` for anything that moves, `static` for a structure. |
| `salvage` | Default: 0. |
| `card` | `title`, `subtitle`, `description`; a Commander's also `pronouns`. |
| `glyph` | Rows north to south, one character per tile, as wide and tall as `size`. Author lower case: side B is drawn upper case. |

**The loader holds an entry to the Grid's rules** (RULE — `tests/armies.test.ts`): every number a whole number; a
glyph exactly its size, plain ASCII, no spaces; **every reach 1 or even** (an attack's range, a radius, a build
range — a reach of R covers R / 2 rows, so an odd reach above 1 buys a column and no row, grid.md); a melee range of
1; `roundsOut` only on a Commander; a structure never moves; every ability a kind the game has, with its numbers.

### The Commander

`commander` names her unit (a content entry flagged `commander`) and what the game needs besides it:

| Field | What it is |
| --- | --- |
| `lean` | One or two of `units`, `nexus`, `structures`, `commander`, `economy`: what the build leans on (commander-armies.md). |
| `start` | Her starting package: units that walk out with her where a mode scripts none (a duel's first round). |
| `run` | What a Challenge run starts her army with: `buildings` (card ids on the build menu) and `powers` (Nexus power ids in the pool). Everything else her army can field waits in the run's draft. Absent: the whole of her army (`docs/game-design/runs.md`). |
| `schedule` | How her army bends the Nexus Pulse, in every mode (Averno's: a card from the Ravel Nexus in rounds 2 and 4). A level's own schedule replaces it. |
| `barks`, `portrait`, `portraitFalls` | Her voice in battle and her face (`src/armies/barks.ts`, `src/view/commander-moments.ts`), checked to fit the panel at 80 x 24. |

How long she is out when she falls is her unit's `roundsOut`; her skills are her unit's `abilities`.

### Building cards and the tech tree

A building card names a structure, its cost, and what it spawns each Battle Round in waves (`spawns`: the unit, how
many a wave, how many waves, the seconds between). `tier` and `requires` place it in the tech tree: a building above
tier 1 requires one of the tier below, standing as the Build Phase opens. Every mode offers the same cards by the same
rule; a mode decides only which.

**To be dealt by a run's draft** a building card also carries `rarity` and `role`, both or neither (the loader checks); its `tier` is the tech tree's, and a run's draft deals tier *t* from the battle 2*t* − 1. A card with neither is part of an army from its start but never offered.

**A building's actions** (`actions`, `src/armies/actions.ts`; the rule is
[`commander-armies.md`](../game-design/commander-armies.md), what changes between rounds). A building card may list
what a building of it lets the player do in a Build Phase, in the order its card shows them. Each has an `id`, a
`kind` (`upgrade`, `mode` or `order`) and a `label` of at most 18 glyphs. An **upgrade** has a `cost` and `effects`,
and is kept by that one building. A **mode** belongs to a `set`; the first of a set is the building as written, and
changes nothing and costs nothing. An **order** names one of the game's orders (`hold`, Hold production). `effects`
are Nexus power effects naming this building, the kinds with a building form: `addWaves`, `addPerWave`,
`modifyAbility`, `modifyAttack`, `setTargetPreference`. `requires` may name the building's own upgrades and buildings
standing; `notes` says why its numbers are what they are. Keys: the order's own (`z`), then `c v b f` by position, at
most four upgrades and modes. One card gives a structure its actions.

```json
"actions": [
  {"id": "hold", "kind": "order", "label": "Hold production", "order": "hold"},
  {"id": "production-line", "kind": "upgrade", "label": "Production line", "cost": 15,
   "effects": [{"addPerWave": {"building": "barracks", "perWave": 1}}]}
]
```

## 3. Nexus powers: a table of effects

A power is a name, one line of description, a rarity and a role for the dealer, and **one effect**. A power with `"doctrine": true` is a **Doctrine**, a standing order: the Nexus Pulse never deals it, a run's draft offers it, and once taken it is kept from the first round of every battle of the run (so it cannot also be offered beside every hand, from another Nexus, an upgrade, or dealt by chance or requirements). `tier` (1 to 3, default 1) is the earliest tier of a run it is offered in. Each kind of
effect is one entry of `EFFECTS` (`src/armies/effects.ts`) that says everything about it: its JSON shape, what the
loader refuses, what keeping it changes in a side's loadout, whether it stays kept, and the credits it adds. **No
reader branches on an effect's kind**: the campaign keeps a power with `applyEffect`, the duel with the same function.

| Kind | Holds | Keeping it |
| --- | --- | --- |
| `spawnUnits` | `unit`, `count` | Units join at the Nexus as this round's battle starts, and stay. Spent. |
| `addWaves` | `building`, `waves` | Every building of that card sends more waves a round. |
| `addPerWave` | `building`, `perWave` | Every building of that card sends more units a wave. |
| `modifyAttack` | `content`, and `damage`, `range` or `cooldownTicks` | That unit's or building's attack changes by those numbers. |
| `setTargetPreference` | `content`, `prefer` | That unit or building shoots the layers it prefers first. |
| `addBuilding` | `building` | The card joins the build menu. |
| `setDetonation` | `unit`, `detonation` | That unit bursts when it dies. |
| `modifyAbility` | `content`, `kind`, `add` | That unit's or building's ability of that kind gains the numbers in `add` (Standing Order: `{ "radius": 4 }`). |
| `credits` | a number | Credits to spend this Build Phase. Spent. |

**A new kind** is a new entry in `EFFECTS`: its shape (`src/content/shape.ts` combinators), its `problems` (with the
`EffectSight` the loader hands it: what the army can see), its `apply` on a `Loadout`, and `lasts`. Add its line to
the union in `src/armies/types.ts` and its row here.

## 4. Abilities: what a unit does on its own

An ability is how a Commander or a unit does something besides fighting — an aura, a bounty, a lucky hit — written once
as an `AbilityKind` (`src/abilities/`) and named by data, `{ "kind": "aura", ... }`. A kind declares its numbers
(checked when the army is loaded), the sentence its card says, how far it reaches (for the view to draw), and any of
four **hooks**, which the kernel calls at fixed moments (RULE — `src/pulse/abilities.ts`, `tests/abilities.test.ts`):

| Hook | When | What it may do |
| --- | --- | --- |
| `damageModifiers` | Once a tick, as the attacks begin | Offer the units it covers a share of what they deal or take; each keeps the strongest offer of each kind. |
| `hitDealt` | Each attack its bearer makes, before auras | Return what that attack deals instead. Never a blast. |
| `tick` | Once a tick, after the attacks, before deaths settle | Heal, damage, push, note. |
| `death` | Once for each unit that died, after a tick's deaths | Heal, damage, note; earn credits for its side. |

| Kind | Numbers | Hook |
| --- | --- | --- |
| `aura` | `name`, `radius`, `damageTakenPercent` (a guard, below 100) or `damageDealtPercent` (a boost, above 100) | `damageModifiers` |
| `bounty` | `name`, `radius`, `credits`, `structureCredits` | `death`: notes the credits; the rules between rounds add them to its side's next Build Phase (`src/match/earnings.ts`) |
| `loadedDice` | `name`, `chanceIn`, `times` | `hitDealt`, rolling the battle's own seeded stream |
| `shove` | `name`, `tiles`, `everyTicks` | `tick`: pushes each enemy touching the bearer `tiles` away, by the kernel's rule for a unit that did not walk (the bench bulwark's; [`pulse.md`](pulse.md), routes) |

**An ability never touches the kernel's state.** It reads `Body`s and acts through the `AbilityWorld` it is handed —
`bodies`, `within`, `random`, `heal`, `damage`, `push`, `note` — each of which goes through the kernel's own rules and leaves
an event, so an ability is deterministic, hashed and replayed like everything else. `src/abilities/` imports nothing
of the kernel (RULE — `tests/architecture.test.ts`): a mod's kind needs only that folder's types.

**A new kind** is a module in `src/abilities/` and one line in `ABILITIES` (`src/abilities/index.ts`). The kernel also
takes a table of kinds as an argument (`PulseContext.abilities`), which is the seam a mod's kinds would come through;
`tests/abilities.test.ts` runs one that the game does not ship.

## 5. Campaigns

A campaign file names its Commander, the armies it requires and its levels in order. A level gives a map, credits,
what it unlocks, a schedule if it bends the default, and a mission (`docs/game-design/campaigns.md`).

- **A mission brings the campaign's Commander as `"@commander"`**, so one level serves every Commander who plays it.
- **A level may extend another**, its own campaign's or another's: `"extends": "vasse-test-3"`, then only what
  differs. Fields it gives replace the extended level's; its `mission` changes the extended one's, a field at a time,
  and its triggers as a whole list or `{ "remove": [ids], "replace": [triggers] }` (`src/armies/levels.ts`). Averno's
  level is Vasse's third with five rounds.

## 6. Conventions

- **One table per open set.** Effect kinds (`EFFECTS`), ability kinds (`ABILITIES`), duel maps (`DUEL_MAPS`), scripted
  players (`SCRIPTED`), the shipped files (`src/shipped.ts`). A new member is a new entry; code that reads them asks
  the entry, never `if (kind === ...)`. A branch on a kind outside its table is a bug to fix.
- **Data first.** A Commander, her units, her buildings and her powers are JSON. TypeScript is for a new *kind* of
  thing (an effect, an ability), never for one more of a kind.
- **The loader is the reviewer.** Every rule an army must keep is checked when it loads, every problem said at once,
  by path. A rule that is only written here is a rule to move into the loader.
- **Each side owns its content.** What a side's kept powers change is that side's alone (`PulseContext.sides`); two
  armies of one faction never share a change.
- **Pure.** The loader, the effects, the abilities and the duel's rules read no clock, no disk and no randomness but
  the battle's seeded stream.
- **Numbers carry their reason.** A content entry's `notes` say why each number is what it is, and that it is a first
  guess until it is measured.

## 7. Adding a Commander: the checklist

1. `armies/<id>/army.json`: `requires` her faction (and any army whose cards leak to her); her unit as a content entry,
   with its card (pronouns) and glyph; her own powers; her `commander` with `lean`, `start`, and her voice.
2. A new skill that no kind expresses: a module in `src/abilities/` and a line in `ABILITIES`, with a test.
3. A new kind of power: an entry in `EFFECTS` and its line in the `PowerEffect` union, with a test.
4. One line in `src/shipped.ts`. Run `npm test`: the loader says what is wrong.
5. Play her: `node bin/duel.ts play --a <id> --b vasse` (`duels.md`), and a campaign when she has one
   (`campaigns/<id>/campaign.json`, its levels extending existing ones where they can).
6. A test that she reads apart from the others where it counts (`tests/averno.test.ts` is the pattern).

## 8. What a modder can and cannot do today

Can, with data alone: new units and structures, Commanders, factions, building cards, powers of the kinds above,
campaigns and levels. Needs code: a new kind of ability or effect, a new map, a new duel player. Cannot: load files
from outside the repository (no mod loader, by rule), change the kernel's phases, or read presentation from the
rules.
