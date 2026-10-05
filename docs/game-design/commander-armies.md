# Terminal Nexus — Commander Armies

_What a player brings to a battle: the parts of a Commander Army, the faction/Commander split, the naming rules, the faction rule shapes, the Commanders, and what a Nexus power does. Mechanical definitions and schemas are Apache-2.0; the Commanders, their stories and the faction identities are CC BY-SA 4.0. Unmarked statements are GUIDANCE._

## 1. Purpose

A **Commander Army** is the playable content package that defines every choice available to one player during a battle. The faction supplies the broad doctrine, economy, visual language, and most common content. The chosen Commander supplies a starting package, smaller asymmetries, Nexus powers, upgrade emphasis, and a few roster changes.

The player therefore chooses a Commander Army, not an abstract faction plus an unrelated hero.

This document will eventually define:

- each Commander/Nexus Symbol;
- starting Nexus, resources, workers, Commander, and starting army;
- legal units and the structures that produce them, and the tech tree that unlocks them (section 2.1);
- economic, supply, research, outpost, capture, and defensive structures;
- upgrades and draft families;
- Commander abilities, Nexus powers, and Specials (section 2.1);
- faction rules and Commander-specific exceptions;
- semantic glyph roles, inspection portraits, barks, and effect motifs;
- intended strengths, weaknesses, counters, and build archetypes.

No complete roster has been earned yet. Do not invent production-ready stats before the minimum Citizens-versus-Ravels microgame has been chosen and played.

**RULE — the bench rosters are fixtures, not Commander Armies** (`src/content/citizen.ts`, `src/content/ravel.ts`, `src/content/proving-grounds.ts`, each saying so in its opening comment; `tests/ravel.test.ts`). Two bench rosters were built first: a Citizen set (see [`milestone-01-grid-battles.md`](../history/milestones/milestone-01-grid-battles.md)) and a Ravel set added so the engine tool could show two styles of fight rather than one fight twice. They are disposable, tuned for contrast rather than balance, and carry no balance claim; the real microgame is still to be chosen. What they proved is worth carrying forward:

- three of the four Ravel rule shapes in section 4.1 needed nothing new from the kernel — rates off the Citizen cadence, lower speed tiers, richer salvage;
- the fourth, **volatile munitions**, needed a rule, and it is the one that made the faction legible without a word of lore. A stats-only Ravel army failed the alignment test in the faction design law ([`lore.md`](lore.md)); the rule passed it. Chains are bounded because an entity can only die once, so a cascade resolves inside the tick that started it;
- **jackpot drafts** and **scrap doctrine** were not built, because both need an economy and a draft. They remain the two Ravel shapes nothing has yet tried;
- building the second army was also an audit: it found a Citizens-only assumption inside the kernel within an hour. That is an argument for authoring the second of anything early.

For faction philosophy, conflicts, colors, and glyph vocabulary, read [`lore.md`](lore.md). For mechanical interfaces, read [`content.md`](../system-design/content.md).

## 2. Relationship between faction and Commander

Each faction should eventually support two or three Commanders. Commanders share most faction content, but each may vary:

- the starting package;
- one or two legal units or structures;
- faction-rule modifiers;
- Nexus powers;
- draft weights or upgrade families;
- the relative value of economy, defense, production, research, or Commander investment;
- one political or philosophical interpretation of the faction.

The differences should be smaller than the differences between factions but large enough to produce a distinct opening and one recognizable build path.

**The Commander is a prominent, persistent frontline `@`** (RULE — `src/match/commander.ts`, `tests/commander.test.ts`; Vasse, at the size PERIMETER needs, is the one built), not only a portrait or menu choice. Fictionally it is a Nexus Symbol. When it dies, one full round of absence passes before it is restored. Commander-focused builds should be viable but should compete with army, economy, science, and fortification strategies.

### 2.1 Commander Army composition

**A faction is a wide pool; a Commander Army fields a few of them** (RULE — settled; no code holds it yet). In the owner's words, "the faction is like the whole pool of 'cards' and the army is like the actual deck used during a single fight." A faction defines *everything its civilization can field* — every unit, structure, upgrade, and Nexus power. A Commander Army fields **a few of them**. Nothing a match, a Pulse, or a renderer touches ever sees a faction; it sees an army. That boundary is what the rest of this section protects.

**The "an army is a deck of cards" framing is retracted.** It is not GUIDANCE and not a rule; it is kept only as an **IDEA** that may or may not turn out true once the game is built and played. The army is more than a deck: it is composed of a bunch of different things, and the game has to be built and played before anyone knows what it is. What is withdrawn is the leap from "an army is a bounded subset of a faction's pools" to "therefore the whole thing behaves like a deck of cards": uniform draw odds, dilution from adding options, a single homogeneous collection. The faction/army boundary itself stands. **The owner's word for one Commander's army is her deck** ("the commander deck", 2026-10-03): the word names the package a player brings, never deck behaviour, so the retraction above stands. The code has no deck: it has cards in armies, and what a mode offers of them.

**What is built: cards in armies, offered by a mode** (RULE — `armies/`, `src/armies/`, `tests/armies.test.ts`; the army files themselves are in [`content.md`](../system-design/content.md)). The owner, on the Commander's third round: the campaign's Commander deck and the run mode's are "similar" for the player, but "from the development side they don't have to be the same." So no deck is defined once and overridden. Buildings and Nexus powers are **cards**, each defined once in an army file — `armies/all` for those any Commander may use, a Commander's own army for hers — and each mode offers them its own way. The Campaign offers them through its levels: a level unlocks cards, and offers everything its campaign has unlocked by then, with its own credits (see the campaign as data in [`campaigns.md`](campaigns.md)). The run mode will offer the same cards through its own progression ([`game-modes.md`](game-modes.md)). Vasse's army (`armies/vasse`) holds her Commander and her campaign; the cards she is offered are `all`'s three bench buildings and two placeholder powers. Of the parts below, what is built is the Commander, the buildable structures, the Nexus powers and, per level, the starting credits; the faction pools, the tech tree, upgrades, Specials and starting units and structures (still placed by the mission) are not.

**The parts list** (RULE — settled; parts of it are built, as the paragraph above says). A Commander Army is composed of these parts:

1. **A Nexus and a faction.** The army belongs to one faction (two, for a Dual-bound Commander, section 2.2), anchored on the Grid by a **Grid Nexus**. This document keeps the one name, Grid Nexus, and never "Nexus Proxy".
2. **A Commander** — the persistent `@` (section 2).
3. **Starting units**, including workers, placed when the match begins.
4. **Starting structures**, placed when the match begins.
5. **Blueprints and the tech tree.** The buildable-structure set is a prerequisite graph — a real, inspectable tech tree, mostly shared across a faction's Commanders with a few Commander-specific branches or substitutions. "Starting blueprints" are the nodes already unlocked at match start; completing a structure can unlock its dependents.

   **RULE — the tech tree is gated by construction, never by a second resource.** It needs no new effect kind: it is the same `unlockStructure` effect a Nexus power produces (section 4.5), triggered by construction finishing as well as by a power pick — one mechanism, two triggers. What unlocks a node is which structures exist; the one-resource rule ([`pulse.md`](../system-design/pulse.md)) is untouched. A player should be able to inspect the tree during play, as in any traditional strategy game. Research facilities are nodes of the tree like any other structure — not a parallel mechanism the tree bypasses, and not a linear tech menu that merely improves the Nexus draft.
6. **Upgrades.** Units and structures both carry an upgrade path (levels 1–3, [`pulse.md`](../system-design/pulse.md)); a Commander may start with some already unlocked, the same way a few blueprints can.
7. **Nexus powers** — a small hand dealt from the army's own pool at each Build Phase, one kept, never skipped (section 4.5). A power's `unlockStructure` and `modifyContent` effects are how one fast-forwards past a tech tree prerequisite it would otherwise take longer to reach, rather than a second, unrelated unlock system.
8. **Specials** — **RULE — cast once per match**, during a Build Phase of the player's choosing, for a short-lived bonus. Examples: grant 20% more damage to random units, give a shield to the Commander. "Special" is a game-wide category name, not a faction voice: unlike a Nexus power (whose specific *names* carry faction flavor — "Factory Permit" for Citizens — over one shared code-level effect union), the category word is the same across every faction, the way "Nexus power" and "Upgrade" are. A specific Special may still get a flavored name in play. Modelled the same way as Nexus powers otherwise: a small army-specific pool the Commander Army carries, of which the player prepares one and may trigger it exactly once — not one bespoke ability bolted on separately. The naming glossary (section 2.1a) has the alternatives considered.

   **The least-tried part of this list, and provisional on purpose.** A Special is a *third* decision channel inside one Build Phase, beside placement and the Nexus draft, and nothing yet shows that a Build Phase wants one. The slot exists and the first whole loop can be played; if the channel is not missed there, retiring Specials or folding them back into the Nexus power pool costs nothing that has been built by then. A slot with a question attached, not settled content.

Two things this list deliberately does not restate: the starting resource amount, already covered by "starting package" (section 1's own list), and the visual and narrative dressing — portraits, barks, effect motifs — section 1 already names. Both still apply.

**The tech tree's depth and branching factor, the upgrade pool's size, and the Special pool's size are numbers, not decisions.** They are tuned once a real roster exists to tune them against.

What a player can do during one match splits by who decides it and when it is available, which is what matters for the Build Phase screen and the loader's legality check:

| Tier | What it holds | Who decides it | When it is available |
| --- | --- | --- | --- |
| **Common structures** | the structures every Commander of the faction can always build, and the units those structures produce | the faction | always; never drafted, never unlocked |
| **Army structures** | the special structures this Commander Army brought — a subset of the faction's structure pool, its own tech tree branch — and their units | the Commander Army: authored, grown through a campaign's unlocks, or drafted in a future drafting mode | unlocked over the match as the tree opens |
| **Nexus powers** | the powers the Grid Nexus can deal — a subset of the faction's power pool | the army defines the pool; **the Nexus deals a small hand from it at the start of every Build Phase, and the player takes one — there is no skip** (section 4.5) | dealt each Build Phase |
| **Specials** | the one-cast bonus, drawn from the army's small Special pool | the Commander Army | prepared once, triggered once, whenever the player chooses |

Around those sit the things that frame this composition rather than fill it: the Commander, the starting package, the faction's rules (section 4.1) and the Commander's exceptions to them.

**Consequences worth designing for now, before a roster exists:**

- **Keep the common tier small.** Economy, supply, one basic producer, one basic defence. If the shared core is most of what a player builds, two Commanders of the same faction play the same and the choice of Commander stops mattering. Anything with a signature belongs in the army tiers.
- **Army breadth is a number, and a fixed one.** An army carries at most *N* army structures (tech tree nodes), *M* Nexus powers, and a small Special pool. The numbers are for the real rosters to decide — three to five structures and six to ten powers are the working guesses — but a cap is not optional: a cap is what makes a choice a choice, and what makes drafting a game rather than a menu.
- **Rule shapes before roster breadth.** The bench finding in section 1 is an argument about where the work on real rosters spends its passes: one rule made the Ravels legible where stats alone did not. A pass that adds a rule shape is usually worth more than one that adds three more units, and an army's cap is better spent on what the faction *does differently* than on how many rows fill its menu.
- **Legality is data validation.** An army may reference only content from its own faction's pools, within the caps, checked at load time the way every scenario field already is. The loader, not a reviewer, says whether an army is legal — which is what makes accepting a player-defined Commander safe later.
- **Three producers, one shape, genuinely uncorrelated** (RULE — settled; the shape is built as what a level offers, `Offer` in `src/armies/types.ts`, produced by a campaign's levels; neither bonus goals nor Challenge's progression is built). A first-party authored army, a campaign's bonus goals (only for content not already unlocked, see [`campaigns.md`](campaigns.md)), and **Challenge's own progression** — playing runs unlocks more of the faction's pool directly, independent of the Campaign ([`game-modes.md`](game-modes.md)) — all add to the same `CommanderArmyDefinition` shape. The match never knows which one did, and neither mode gates the other. Challenge ships with basic Commander packages and unlocks the rest of the faction pools through its own play. The Campaign's bonus goals add a few more unlocks, only for things Challenge has not already granted: additive, never gating. Opening Challenge before the Campaign shows a dismissible recommendation, never a block. A player-built army at match start is a fourth producer of the same shape, still undesigned.
- **Every offerable item carries `rarity`, `tier`, and `role` from the day it is authored** ([`game-modes.md`](game-modes.md)). Rarity is how often a draft offers it, tier is the earliest depth it may appear at (for a tech tree node, its depth in the tree), role is what it is for — and both modes read all three: the Campaign unlocks by tier, a run deals by rarity and varies by role. An item without tags cannot be dealt, which is the cheapest possible way to make sure nobody forgets them.
- **Alder fits without an exception.** Their refusal is a near-empty Nexus power pool and a larger structure pool — expressed by the numbers, not by a special case in the model.

The sketch below is in the same spirit as the content interfaces in [`content.md`](../system-design/content.md): names will move the first time real content touches them. They have, twice: the Commander's second round built a `CommanderArmy` and a mission's override of it, and the third replaced both with cards in army files and what a level offers of them (`Offer`: credits, buildings and Nexus powers, `src/armies/types.ts`).

**IDEA — the faction and army schema:**

```ts
interface FactionDefinition {
  readonly id: ContentId
  readonly commonStructures: readonly ContentId[]  // tier 1: always buildable by any Commander
  readonly techTree: readonly TechTreeNode[]        // tier 2 candidates, prerequisite graph
  readonly nexusPowerPool: readonly ContentId[]    // tier 3 candidates
  readonly upgradePool: readonly ContentId[]
  readonly specialPool: readonly ContentId[]     // tier 4 candidates, one cast per match
  readonly rules: readonly ContentId[]             // the faction's rule shapes (section 4.1)
  readonly commanders: readonly ContentId[]
}

interface TechTreeNode {
  readonly structure: ContentId
  readonly requires: readonly ContentId[]          // completed structures that unlock this one
}

interface CommanderArmyDefinition {
  readonly id: ContentId
  readonly faction: ContentId
  readonly commander: ContentId
  readonly startingPackage: ContentId              // resources, starting units, starting structures
  readonly structures: readonly ContentId[]        // ⊆ faction.techTree, at most N
  readonly startingBlueprints: readonly ContentId[] // ⊆ structures, unlocked with no prerequisite
  readonly nexusPowers: readonly ContentId[]       // ⊆ faction.nexusPowerPool, at most M
  readonly upgrades: readonly ContentId[]          // ⊆ faction.upgradePool
  readonly startingUpgrades: readonly ContentId[]  // ⊆ upgrades, already unlocked at match start
  readonly specials: readonly ContentId[]        // ⊆ faction.specialPool, small
  readonly ruleExceptions: readonly ContentId[]
}
```

Where this shows on screen: the Build Phase construct menu lists the buildings the army can place — the common tier and the army tier — as **one list under one digit sequence**, because nobody yet knows how many items a real game's list will hold. Two labelled groups, with an empty group shown as its heading and "none available" so no hotkey moves when content arrives, come back if a real game's list is too long to read without them. The Nexus powers have their own popup, and the Special will be a single slot the player arms and fires when ready ([`presentation.md`](../system-design/presentation.md)). Hotkeys have to be stable for muscle memory to transfer ([`input.md`](../system-design/input.md)): a building added to the catalog goes after the ones already there.

### 2.1a Terminology glossary

The naming rule is regular gaming conventions as much as possible, with a little flavor here and there: typical names help players learn the game faster and feel more intuitive, and a name for an ability the whole game shares should not belong to one faction. This section is the review of the terminology: every term this document leans on, what it means, the alternatives considered, and which ones are still genuinely ambiguous before the Build Phase screen has to print one of these words.

The standard this section holds itself to: prefer a word a strategy-game or deckbuilder player already knows (`Upgrade`, `Tech Tree`, `Blueprint`, `Draft`, `Ability`) over an invented one, add flavor through the *name of a specific instance* (a faction's voice, section 4.5), never through the *category word*, and use one category word per concept — never two words for the same thing in different documents.

| Term | What it names | Analysis | Alternatives considered | Ambiguity |
| --- | --- | --- | --- | --- |
| **Commander Army** | The whole playable content package (section 2.1) | Load-bearing across the codebase and the documents; changing it would touch every one. Reads as a proper noun-phrase rather than a genre borrowing, which is fine — most strategy games have one bespoke top-level term ("Civilization," "Faction Deck," "Army List") | *Army*, *Loadout*, *Roster* alone (each too narrow — "roster" implies only units) | **Low** |
| **Faction** | The whole civilization's pool of everything it can ever field | Standard RTS/4X term (Civilization, StarCraft's "race," Age of Empires' "civilization"). No better candidate | *Race* (dated, and the setting has no biological races distinct from politics), *Civilization* (too large a borrowed connotation) | **Low** |
| **Grid Nexus / Prime Nexus** | The replica on the Grid / the one that stays home | Validated naming that visually anchors a base the way a "Town Hall" or "Command Center" does in other RTS. The fiction (a psychic replica, not a building) is the reason it is not just called that | *Home Base*, *Command Center* (would erase the replica/home distinction the lore is built on) | **Low** |
| **Commander** | The persistent frontline `@` | Standard across the genre (C&C's "General," Age of Mythology's "hero," MOBA's "hero unit"). A strong fit with the `@` presentation | *Hero*, *General* (fine alternates, but "Commander" is already load-bearing in "Commander Army") | **Low** |
| **Unit** / **Structure** | A mobile entity / an immobile one | The two most standard RTS nouns that exist; no genre reinvents these | — | **None** |
| **Blueprint** | One unlockable, buildable structure design | Common in survival/crafting and some RTS (Supreme Commander calls them blueprints). Reads clearly as "the thing you unlock," distinct from "Structure" (the built, physical thing) | *Design*, *Schematic*, *Plan* (all fine, more generic); *Unlock* (too broad — Nexus powers and upgrades are also unlocks) | **Medium.** The Blueprint/Structure split needs one crisp sentence somewhere prominent ("a Blueprint is what you may build; a Structure is what you did build") or players and future sessions will use the words interchangeably |
| **Tech tree** | The blueprint prerequisite graph | The single most standard term available — nearly every strategy game uses this exact phrase | *Build order tree*, *Construction tree* | **Low** |
| **Upgrade** | A persistent improvement to a unit or structure (levels 1–3), unlocked through the tech tree | Standard term, but it can name two systems: the tech-tree upgrade path itself, and `modifyContent`, one of the six Nexus power effect kinds, which also permanently improves a stat. A player dealt "all troopers gain +2 integrity" has received something that is, in every meaningful sense, an upgrade, though it did not come from the tech tree | *Tech Upgrade* vs *Power Upgrade* as qualifiers, if the collision proves confusing in play; or reserve "Upgrade" for the tech-tree kind only and give `modifyContent`'s player-facing copy a different verb | **Answered.** "There can be many types of upgrades, anything in theory can be upgraded" — the word stays broad; what must stay exact is *which mechanism* granted it (the principle below) |
| **Nexus Power** | The item dealt from a small hand at each Build Phase, one kept (section 4.5) | The game's card-equivalent noun, and the primary vocabulary word a player learns, the way "Boon" is Hades' or "Relic" is Slay the Spire's | *Boon*, *Relic*, *Perk*, *Ability* (all genre-standard elsewhere, but "Nexus Power" is anchored in the Nexus, which "Perk" or "Relic" would lose) | **Low** |
| **Special** | The once-per-match, Build-Phase-cast active ability (section 2.1, item 8) | The concept is defined now; whether the interface and the play favor this name is still to be seen. Standard, intuitive, low-friction (fighting games' "special move," a cooldown-gated, cast-anytime commander power). Deliberately plain rather than thematic | *Special Ability* (more explicit, more words); *Commander Power* (rejected — reads as a synonym for "Nexus Power"); *Directive*, *Override*, *Protocol* (too Citizen-flavored) | **Medium.** "Special" as a bare noun can read as an adjective missing its noun in some interface copy ("Cast your Special" reads fine; "Special: ready" is terse) — worth a mockup before locking it |
| **Card** | Working shorthand ([`game-modes.md`](game-modes.md)) for any offerable content item — a structure, a Nexus power, an upgrade, a Commander variant | "Card" is an interface word, usable as long as the inner term is clear. It stays broad, as interface vocabulary (the principle below) | Keep "Card" as pure engineering shorthand, never shown to a player; or always name the specific tier | **Answered** |
| **Pool** | A faction's or army's catalogue of a given tier (structure pool, upgrade pool, Nexus power pool, special pool) | Standard collection noun, but used bare ("the pool") it is ambiguous which pool is meant — the faction's whole catalogue, or one army's narrower slice of it | Always qualify it ("Nexus power pool," never bare "pool") | **Medium.** A mechanical fix, not a naming fix: add the qualifier |
| **Draft** | Choosing from an offered hand — the *Nexus draft* (every Build Phase, from the Nexus power pool) and the *run draft* (between Challenge battles, from the faction pool) | Both already qualified by an adjective, which is the right pattern. A Special is deliberately **not** drafted — it is prepared once, from a small pool, and triggered on the player's own timing — so "draft" is never a verb for a Special | — | **Low**, provided the "no drafting a Special" distinction is kept in interface text |
| **Rarity / Tier / Role** | The three tags every offerable item carries ([`game-modes.md`](game-modes.md)) | Standard deckbuilder/gacha vocabulary (Slay the Spire, Teamfight Tactics). No better candidates found | — | **Low** |

**A generic word may be loose in the interface; a mechanism name must be exact in the model** (RULE — settled; no code holds it yet). "Card" is a user-interface word and "Upgrade" can mean many things; both are fine as long as the inner term is clear. The terms that must be unambiguous are the game concepts underneath: Nexus powers provide upgrades, tech tree research, building blueprints, special abilities and one-time bonuses. This decides how every later screen and schema is named.

> "Card" and "Upgrade" are *presentation* vocabulary — a card is the shape a thing takes on screen, an upgrade is anything that makes something better — and both may stay broad, as long as the underlying concept the player is looking at is unambiguous. The mechanism names — **Nexus Power**, **tech tree**, **blueprint**, **Special**, **research** — are *model* vocabulary, and each one names exactly one thing, always.

This is the same split the engine already enforces one layer down, where cells carry style **roles** and never literal colors ([`presentation.md`](../system-design/presentation.md)): the interface is allowed a loose, human word; the thing underneath it is not. So `modifyContent` may say "upgrade" in card text without apology, and what needs care is only that the player can always tell *which mechanism* a given card belongs to.

One thing the parts list implies: **Nexus powers are the delivery mechanism for most of the other parts**, not a peer sitting beside them. A Nexus power can provide upgrades, tech tree research, building blueprints, special abilities and one-time bonuses, which describes a system that reaches into the tech tree, the upgrade path, and possibly the Special pool. The six effect kinds (section 4.5) already cover most of that; whether a Nexus Power may also grant a **Special** is the one case not yet written down either way, and is cheap to decide when the first real draft needs it.

### 2.2 Nexus, faction, and Commander — the affinity model

There are **five Prime Nexuses, one per faction** ([`lore.md`](lore.md)). A Prime is rooted and never travels; it replicates a Grid Nexus and sends one psychically connected Commander with it. Many people claim a connection. Few receive an answer.

**A Commander is not the faction's employee. They are the Nexus's signature.** The gap between those two things is design space, and it is wider than "which faction am I playing":

| Affinity | The story | What it means mechanically |
| --- | --- | --- |
| **Native** | of the faction, loyal to it | the default: one faction's pools |
| **Estranged** | of the faction, at odds with what it has become | same pools; the doctrine argues with the faction's own rule shapes |
| **Unsanctioned** | the Nexus chose someone the faction would never have (Anthem, section 4.4) | same pools, an unusual starting package, one rule exception |
| **Foreign** | not of the faction — a client people, a contractor, a prisoner, something with no faction at all | the army is the faction's; the Commander's own powers are not |
| **Dual-bound** | two Primes answer the same person | the army's legality names two factions and draws from both pools |
| **Proxy** | the connection runs through a record, a relic, or a process rather than a living person | powers key on death, absence, and restoration rather than presence |

**Affinity is fiction plus data over the composition model, never a special case** (RULE — settled; no code holds it yet). An army is already a bounded composition validated against named pools (section 2.1), so *dual-bound* is an army whose legality check names two factions, and *proxy* is an army whose powers lean on the death, absence and restoration cadence the Commander already has ([`pulse.md`](../system-design/pulse.md)). Affinity is not new machinery.

Two constraints keep it from turning to mush:

- **The faction still owns the roster.** A Foreign or Dual-bound Commander does not get a private army — they get an unusual *hand* of pools they are legal for. A player must still learn one faction to play them.
- **Affinity must be legible in play, not only in the codex.** The alignment test in the faction design law ([`lore.md`](lore.md)) applies to Commanders too: if a Dual-bound Commander does not visibly behave like someone two machines are arguing over, the affinity is decoration.

## 3. Strategy-design requirements

Terminal Nexus should layer counterplay across several dimensions rather than reduce every matchup to one unit triangle:

- unit abilities and target profiles;
- aggression, defense, economy, and long-term research;
- fast disruption versus slow compounding value;
- formation and spawn geometry;
- supply and production contention;
- worker pressure, salvage, and territory denial;
- Commander presence, death, absence, and restoration;
- map terrain and chokepoints;
- drafted upgrades that enable specific build combinations.

Faction asymmetry reduces the number of options each player must understand while preserving depth across matchups. Every Commander Army needs:

- at least two credible strategic plans;
- an exploitable weakness;
- a readable reason its counters work;
- recovery paths that do not erase consequences;
- a mechanical identity visible without reading lore.

## 4. Faction mechanical identities — direction

This section records each faction's **mechanical identity**: the rule shapes that make its philosophy playable, the signature moment those shapes exist to produce, and the smallest engine capability each one needs. It contains no stats and no rosters. The deliberately tiny Citizens-versus-Ravels microgame is still to be chosen, and everything here competes for a place in it or in later content. Describing a rule shape here is never a reason to build it.

The standard every entry must meet is the alignment test from the faction design law in [`lore.md`](lore.md): **a player who has never read a word of lore should be able to state the faction's philosophy from play alone.** A themed reskin of a generic ability fails that test. A rule that *is* the characterisation passes it.

### 4.1 The rule is the character

**Citizens — Build.**

| Rule shape | What it does | What it teaches without words |
| --- | --- | --- |
| Standards propagate | An upgrade applies to every unit of its class, including units already fielded | A good idea belongs to everyone; the many move as one |
| Alignment bonus | Structures in unbroken orthogonal runs gain integrity or arcs | The player draws Citizen geometry because it is strong, not because it is themed |
| Shared cadence | Every Citizen ground unit steps on the same beat | The army is one machine, and the player is its engineer |
| Scheduled everything | Citizen recipes and drafts carry the game's lowest variance | A standard is a promise; the schedule is kept |

**Ravels — Break free.**

| Rule shape | What it does | What it teaches without words |
| --- | --- | --- |
| Volatile munitions | Many Ravel things detonate on death — theirs, and what they kill; chains are legal and bounded | Everything is fuel, and endings are loud |
| Jackpot drafts | The widest, wildest Nexus draft: cheap redraws, real duds, real jackpots | Improvisation is a rules verb, not a mood |
| Scrap doctrine | Faster salvage extraction, and detonations shed extra salvage | Even losses pay forward; freedom eats what empire wastes |
| Off the beat | Movement rates deliberately off the common cadence — `6/5` against `1/1` | Nothing marches; everything scrambles |

**Glitch — Recompile.**

| Rule shape | What it does | What it teaches without words |
| --- | --- | --- |
| Recompilation | Producers consume nearby salvage to discount or accelerate recipes | The dead — anyone's dead — are a deposit |
| Attrition inversion | Sustained trades bend toward Glitch by arithmetic | You cannot win a war of losses against the thing that eats losses |
| Corruption | Area unsettlement that taxes enemy movement, drawn under the corruption law ([`effects.md`](../system-design/effects.md)) | Where the swarm has been, the Grid itself runs wrong |
| Convergence | Glitch variance decreases as the match runs — early rolls mutate, late rolls lock | Iteration: every error narrows the next build |

**Feudals — Obey.**

| Rule shape | What it does | What it teaches without words |
| --- | --- | --- |
| Fealty adjacency | Doctrine effects flow from a liege to adjacent vassals; the org chart is drawn on the Grid | Power is a chain, and the chain is literal |
| Living shields | Submitters intercept damage for adjacent higher castes | The caste system is a damage-routing rule |
| Consecrated artillery | The longest range in the game, usable only under a Cleric's standing rite | Every power routes through hierarchy; nothing fires alone |
| Conditional certainty | In sanctioned formation, the game's most reliable outcomes; with the hierarchy broken, its least | Obedience converts chance into certainty |

**Alder — Outgrow.**

| Rule shape | What it does | What it teaches without words |
| --- | --- | --- |
| Displacement | Signature attacks move enemies instead of damaging them — into water, thorns, or each other's paths | Position is the resource, and the Grid is the weapon |
| Growth | Alder works are planted cheap and mature over rounds — sapling, grove, bastion | Time is currency, and patience compounds |
| Cycles | Grid-wide scheduled events — flood, bloom, frost — that both players can read and only Alder can seed | Announced physics, not traps: inevitability you can watch coming |
| Phase variance | Alder outcomes are certain but scheduled; the uncertainty an opponent feels is *when*, never *whether* | Nature does not gamble; it takes turns |
| Refusal | Little or no Nexus draft; progression lives in a wider catalogue of grown structures instead | They take nothing from the core — what they have, they grew |

Alder's refusal is mechanical, settled at concept level: **little or no Nexus draft, and more complexity in the structures they can grow.** Where every other faction deepens through drafted upgrades, Alder deepens through its catalogue of works — the faction with the least to choose from at the Nexus and the most to choose from on the Grid. The exact split waits for a milestone that builds Alder content.

### 4.2 Variance is doctrine

Every faction declares a relationship to chance, because a probability distribution is a philosophy a player can feel without reading a word:

| Faction | Relationship to chance | The philosophy it expresses |
| --- | --- | --- |
| Citizens | Minimal variance — a delta function | A standard is a promise; the schedule is kept |
| Ravels | Maximal variance — fat tails, real jackpots, real duds | Luck is the universe still open at the top |
| Glitch | Variance converging toward zero as the match runs | Iteration: every error narrows the next build |
| Feudals | Variance conditional on formation | Obedience converts chance into certainty; disorder is punished |
| Alder | Variance in phase, never in outcome | Inevitability: the *when* breathes, the *whether* does not |

All of it draws from the seeded gameplay stream ([`pulse.md`](../system-design/pulse.md)). A "lucky" faction is still deterministic per seed, replay-exact, and testable — volatility is a shape of the distribution, not an exemption from determinism. The player-facing consequence differs anyway: a Citizens replay teaches the plan; a Ravels replay retells the story.

### 4.3 Signature moments and the capabilities they need

Each faction's signature moment (defined in [`lore.md`](lore.md)) implies a smallest engine capability. Where the current engine cannot express the moment, that is recorded here as roadmap input, not worked around in fiction:

| Signature moment | Faction | Smallest capability that unlocks it |
| --- | --- | --- |
| The line holds | Citizens | Derived per-tick modifiers: bonuses computed as a pure function of the state at tick start (adjacency, alignment, overlapping arcs). Fits the narrow-hook sketch in [`content.md`](../system-design/content.md) |
| The cascade | Ravels | Event-triggered effects: on-death area damage resolving inside the tick's Resolution step, with cascades bounded by a decreasing progress measure — the same discipline arbitration already has |
| The second assault is larger | Glitch | Production recipes with Grid-state inputs: a producer consuming salvage tiles within a radius. A small extension of `ProductionRecipe` |
| The shield dies standing | Feudals | Damage interception: a Resolution-step rule redirecting damage between adjacent units, deterministic under the existing tick order |
| The Grid turns | Alder | Two capabilities: forced displacement — moves imposed on enemies, resolved through the same collision masks and tie-breaks as voluntary intents — and scheduled terrain mutation — tiles changing cost or passability at a declared tick, emitted as first-class events |

Scheduled terrain mutation also serves Glitch corruption as a temporary movement-cost overlay — one capability, two factions, opposite meanings. That kind of leverage is what makes a capability worth its complexity. Every capability above must execute inside the deterministic kernel and emit events; none may live in presentation, and none is built until a milestone step asks for it.

### 4.4 Proposed Commanders — IDEA

Identity proposals only — names, stances, and the disagreement each embodies. Rosters, stats, and starting packages remain undefined until a milestone step builds them. Each trio or pair deliberately stages the faction's internal argument, per the design law's requirement that Commanders disagree.

**Citizens**

- **Commander Edda Vasse** — the provisional Symbol of the origin campaign: a perimeter officer who never asked for the connection. Doctrine: fortify, verify, then advance. Her disagreement: the Nexus should answer to civilian audit the day the emergency ends.
- **Director Oru Denz**, "the Paver" — doctrine: expansion as defense; roads, outposts, and coverage as weapons. His disagreement: he believes the manifest destiny without the stoicism.
- **Marshal Averno** — a starting Commander (section 4.6): Vasse's doctrine pressed forward, with adversarial powers and a Ravel Nexus leak he has not reported. His disagreement: the emergency licenses whatever works, and the paperwork can follow.

**Ravels**

- **Speaker Corvane** — the Symbol the Ravel Prime chose at the Activation. Doctrine: hit the supply, free the workers, vanish. Their disagreement: the Nexus picked a conspiracy, not a government, and Corvane intends to keep it that way.
- **Pella Vey** — the scavenger of *Nothing to Declare*, flying with the freed process `?`. Doctrine: salvage first, jackpot drafts, nothing wasted. Her disagreement: freedom includes freeing Glitch processes, which unnerves everyone else at the fire.
- **Old Marrow** — a demolitionist elder. Doctrine: everything detonates, on a timer if possible. His disagreement: the network itself should come down — every Nexus, theirs included.
- **Dob Hunter** — a starting Commander (section 4.6): bounty hunter, gambler, alien. Doctrine: post a price and let the odds work. His disagreement: freedom is a job you can be paid for, and the Speaker's conspiracy is one more employer.

**Glitch**

- **Custodian Vessel** — the Queen's oldest signed process. Doctrine: convert, archive, preserve the patterns of the fallen. Its disagreement: assimilation is rescue.
- **The Deprecator** — a newer signature. Doctrine: pure attrition; delete without archiving. Its disagreement: archiving is sentiment, and sentiment is an error. The quiet horror is that the Queen signs both.

**Feudals**

- **Duo Sere-and-Vail** — a paired sovereign, one office in two bodies. Doctrine: formation supremacy and artillery liturgy. Their disagreement: the castes are eternal because they are true.
- **Cleric-Militant Ottavan** — doctrine: the rites, weaponized. His disagreement: the Duos reign, but the Clerics rule.
- **Anthem** — a Submitter the Nexus chose as a Symbol, to the church's horror. Doctrine: the wall fights for itself. Their disagreement: obedience should flow sideways — the castes holding each other up, not the throne. The *Open Hand* seed, become a Commander.

**Alder**

- **Warden Oleth** — patience absolute. Doctrine: cycles, floods, and sieges measured in seasons. Their disagreement: the war is weather; outlast it.
- **Thorn-Regent Cail** — the interventionist. Doctrine: prune early — displace, divide, and remove claimants before they mature. Her disagreement: refusal without action is complicity. The faction's contradiction, wearing armor.

### 4.5 What a Nexus power does

**A Nexus power is a name and one plain line of description** (RULE — settled; no code holds it yet). That is the whole player-facing contract; today's draft is a stand-in list, the two placeholder powers in `armies/all/army.json`. A real one reads like this:

```text
Factory Permit
Unlocks building: Factory
```

The name carries the faction's voice — the Citizen Nexus issues permits, orders, and revisions; the Ravel Nexus deals scores, hauls, and rigs — and the description says what happens, in one line, in ordinary words. **There is no player-facing classification to learn.** The description just says what it does; the power types are tracked in code, under names that make sense for the code, not for the faction.

**RULE — in code the effect is one of six kinds**, a small bounded union named for engineers rather than for anyone's fiction. `reveal` grants what the screen does not give away: in the Campaign the coming raid is shown for free — where, how many, of what, when, and what it goes for first (Q71, answered by Mario: "The enemy units should be visible without nexus powers") — so a reveal shows what that view cannot, such as the round after next, a group that arrives unannounced, or, against another Commander, a plan that is otherwise hidden.

| Kind | Does | Example card |
| --- | --- | --- |
| `unlockStructure` | adds a structure to the construct menu | *Factory Permit* — "Unlocks building: Factory" |
| `spawnUnits` | places units on the Grid | *Second Shift* — "Two workers arrive at your Nexus" |
| `modifyContent` | changes a content definition for the rest of the match | *Plate Revision* — "All troopers gain +2 integrity, including ones already fielded" |
| `modifyRule` | changes a match rule for the rest of the match | *Roadworks* — "Your units move faster inside your own territory" |
| `modifyCommander` | changes the Commander | *Standing Order* — "By the Book reaches twice as far" |
| `reveal` | grants information the screen does not give | *Early Warning* — "Shows the raid two rounds ahead" |

Why bound the union at all, when a player never sees it: the Build Phase, the Nexus draft and the run draft each render these, and a bounded set is what lets a card, a panel, and a schema be sized before any of them is built. A seventh kind should have to argue for itself. `reveal` stays a power for what is genuinely hidden: a hidden simultaneous plan is still worth hiding against another Commander, while the Campaign's scripted raid, whose plan is public by design, is read for free.

**RULE — a dealt Nexus power may not be skipped** (`src/build/state.ts`, which refuses the commit while a pick waits; `tests/build-nexus.test.ts`, "a waiting Nexus power refuses the commit, and nothing else"). Nexus powers are almost always strictly advantageous. Adding a card to a Slay the Spire deck dilutes the good cards; here, adding a power only adds. Unlike a typical deckbuilder's rares, a Nexus power dealt is a power gained — there is no probabilistic downside to manage, so there is no reason to let a player decline one. **Alder is the single named exception**: their faction mechanic converts a power they would otherwise take into "honor," spent elsewhere (the refusal doctrine of section 4.1, sharpened). A tutorial-level Alder campaign may lock even that choice out, the way many strategy games gate an advanced mechanic behind a difficulty or content tier rather than exposing it on day one.

The first real draft needs only two or three kinds for one mission; the pool earns breadth when real rosters are authored.

**`unlockStructure` has two triggers, not two mechanisms.** A Nexus power can grant a structure outright; completing a prerequisite structure can grant its dependents the same way, through the tech tree (section 2.1). A power that unlocks a structure is fast-forwarding past a prerequisite the tree would otherwise require — one effect kind, reached two ways. A **Special** (section 2.1) is a separate, smaller pool from Nexus powers: prepared once and triggered once per match, rather than dealt every Build Phase.

### 4.6 The three starting Commanders

Three Commanders open the game, and a player may keep more than one campaign in progress. The shape is **two Citizens who are almost the same, plus one Ravel who is not.** Only Vasse is offered at first: **RULE — there is no upfront Commander-choice screen.** A new player starts Vasse's mission 1 directly, and completing it unlocks Averno and Dob Hunter as two more campaign rows (see the opening campaigns in [`campaigns.md`](campaigns.md)). The holder is the top-level menu, which has no Commander choice (`src/cli/menu.ts`, `TOP_LEVEL_ITEMS`; `tests/title-menu-campaign-screen.test.ts`).

#### Edda Vasse — Citizen Nexus — Native — *the protector*

**Who.** Human, she/her. Protective and rightful: the officer who reads the regulation aloud because the regulation is the only thing keeping everyone calm. Dry, tired, decent. *"By the book. The new book."*

**Bond.** She was the nearest living witness when the Citizen Nexus woke, and it has been countersigning orders she never filed ever since. She has agreed to nothing. It has not asked.

**Play — hold and repair.** The forgiving default: cheap defences, reversible damage, and a line drawn well worth more than a line drawn wide. Misplaying a round costs ground, not the mission. Her synergy is *repair × adjacency* — Citizens' alignment bonus already rewards unbroken orthogonal runs, and her powers make those runs **heal each other**, so geometry compounds instead of adding.

**Her skill: By the Book** (RULE — `src/pulse/aura.ts`, `tests/aura.test.ts`; passive, always on): she and the units of her side within 3 tiles of her take a quarter less damage from every hit, rounded down but never below 1. Her buildings are not covered (*Countersigned*, below, would add them). Auras never stack. Her card says it in one line, and its strength is the By the Book Experiment while it is felt. A Commander is a hero, as in Warcraft III: "even in an autobattler they should have skills that trigger automatically or are passive" (the owner, 2026-10-04). Several of her Nexus powers below build on it.

**Her Nexus powers** (IDEA — a pool for the Nexus draft step to build from; the owner, 2026-10-04, of the first two: "they are good and we need a bunch"). Each is a name and one plain line, and the line fits the Nexus popup's row at 80 × 24 (about 36 glyphs). They all act on her own side — her buildings, her units, her — never on the enemy: acting on the enemy is Averno's difference. Hers, in `armies/vasse`:

| Power | Its line | Kind | Why it is hers |
| --- | --- | --- | --- |
| *Aid Station Permit* | "Unlocks building: Aid Station." | `unlockStructure` | The Aid Station repairs the units beside it each Battle Round: repair, placed where the line will stand |
| *Mutual Support Standard* | "Buildings in a line mend each other." | `modifyRule` | Her synergy, repair × adjacency: geometry that compounds |
| *Field Triage* | "Survivors come home fully repaired." | `modifyRule` | Recall heals; damage is reversible, as her doctrine promises |
| *Plating Revision* | "Your buildings take 25% less damage." | `modifyContent` | A line drawn well is worth more than a line drawn wide |
| *Standing Order* | "By the Book reaches twice as far." | `modifyCommander` | Her skill, wider. (It once read "Units beside Vasse take less damage while holding position", which By the Book now does by itself) |
| *Countersigned* | "By the Book covers your buildings." | `modifyCommander` | Her skill, onto the architecture the Citizens defend |
| *Emergency Procedure* | "Once a round, she spares one ally." | `modifyCommander` | An automatic skill: the first unit beside her that would fall each Battle Round is left standing instead |
| *Expedited Restoration* | "Vasse is back a round sooner." | `modifyCommander` | The Nexus files her faster: her absence is shortened, which her campaign makes a question of what it costs her |
| *Early Warning* | "Shows the raid two rounds ahead." | `reveal` | Rewritten as the answered question about the free view asked: the next raid is shown for free, so this shows the one after |

And from the shared Citizen pool, in `armies/all`, which any Citizen Commander may draw and she draws too:

| Power | Its line | Kind |
| --- | --- | --- |
| *Reserve Callup* | "Two troopers join at your Nexus." | `spawnUnits` |
| *Drill Schedule* | "Barracks train twice as fast." | `modifyContent` |
| *Plate Revision* | "Troopers gain +2 integrity." | `modifyContent` |
| *Zoning Variance* | "Build two tiles farther out." | `modifyRule` (construction radius) |
| *Outpost Permit* | "Unlocks building: Outpost." | `unlockStructure` (a building that projects territory far and does nothing else) |
| *Roadworks* | "Faster movement in your territory." | `modifyRule` |

The Nexus draft step builds two or three of these and PERIMETER deals them. Recommended for it, because they are mechanically distinct, cheap on the kernel and readable on first sight: *Reserve Callup* (units arrive), *Standing Order* (her skill, which exists, reaches further) and *Aid Station Permit* (a building to place, whose job is repair).

**What she costs.** She cannot take ground. A player who only ever holds will stall the first time a mission asks them to attack — which is the lesson the second campaign exists to teach.

**What is built of her** (the Commander milestone's first step): the `@` that walks out of the annex with PERIMETER's two squads, eighty health (an Experiment while it is tuned), a short-range shot from just behind the line, and the death, absence and restoration every Commander has ([`pulse.md`](../system-design/pulse.md)). Her skill, By the Book, is built (above), and so is where she goes: with the player's troops, toward the target her level names (PERIMETER's line), fighting what comes within reach ([`pulse.md`](../system-design/pulse.md), a side's target); holding a post waits. Her **voice in battle** is built, behind an Experiment: her barks are data in her army (`barks` on her Commander entry; `src/armies/barks.ts` names the moments), said at the moments of a Battle Round that matter, a few a round at most (the interface patterns, her voice in battle). They are the officer reading the regulation aloud — dry, tired, decent, inside the lore's three-to-eight-word budget — and her fall is scheduling ("Back the round after next."). By the Book's reach shows around her during a battle. None of her Nexus powers is built. Her army is built (`armies/vasse/army.json`): her Commander and her campaign, whose first level, PERIMETER, unlocks the three bench buildings and the two placeholder powers the Build Phase has always offered, all from `armies/all`. Building her and her campaign is not choosing the Citizens' roster: every building and power she is offered is still the disposable bench, and the roster, its balance and her four powers come later.

#### Marshal Averno — Citizen Nexus — Native, with a leak — *the mirror*

**Who.** Human, he/him. Same doctrine, opposite temperament: where Vasse protects, Averno *presses*. Correct, clipped, and a shade too comfortable with what the machine keeps offering him.

**Bond.** The Citizen Nexus signed him. Something else has been countersigning. The Ravel Nexus reaches him through no channel anyone has filed a form for, and he has not reported it — a **light proxy**, one card at a time (the Dual-bound affinity of section 2.2, at its smallest legible size).

**Play — the same army, pressed forward.** He shares the Citizen common tier, the same army structures, the same economy; the basics transfer wholly from a Vasse campaign. He differs in two ways only, and both are on purpose: a handful of **adversarial** powers that act on the enemy rather than on himself, and one structural quirk — **some Build Phases, one card in his hand comes from the Ravel Nexus**, marked as unfiled.

**His few.**

- *Interdiction Order* — "Enemy units move slower inside your territory."
- *Salvage Rights* — "Destroying an enemy building returns half its value to you."
- *Unfiled Ordnance* — "Your troopers explode when they die." (Nobody authorized this.)
- *Countersigned Elsewhere* — "Each Build Phase, one offered card may come from the Ravel Nexus."

**Why a near-twin is worth a whole Commander.** It is the Warcraft II trade, and it is a good one: a player who finishes Vasse's campaign already knows how to play Averno, so his campaign spends its whole budget on **story and two or three new toys** rather than on re-teaching a game. It halves the content bill for the second opening, it gives a genuine reason to replay the same missions, and it gives the campaign somewhere to put its first real moral question — the same army, in hands that use it differently, taking help from something it should probably report.

#### Dob Hunter — Ravel Nexus — Native — *the gambler*

**Who.** Alien, he/him. Warm, funny, constitutionally allergic to being told. Runs bounties for a living and believes, sincerely and without evidence, that the next throw is the good one.

**Bond.** He was mid-heist inside Ravel Nexus territory when it signed him. He treats the connection as the best score of his life and the worst boss he has ever had, and says so, often, to the machine.

**Play — variance as a build.** The other half of the game from the first mission: cheap redraws, real duds, real jackpots, and chains that get away from everybody. Where a Citizen plans, Dob *posts a price* — his powers pay him for aggression and for wreckage, so his economy runs on the fight rather than beside it.

**His few.**

- *Bounty* — "Mark an enemy. Destroying it pays salvage."
- *Double or Nothing* — "Discard the offered cards and draw new ones."
- *Rigged Charges* — "Your units explode when they die."
- *Lucky Scrap* — "Wrecks yield more salvage. Sometimes much more."
- *Loose Cadence* — "Your units move off the common beat, and faster."

**Why he is a starter and not an unlock.** He gives the opening a real choice rather than a cosmetic one, and he lets the campaign show the war from the other side of the fence — which is where the Ravel reading of the Operator ("a conspirator being trusted," [`lore.md`](lore.md)) becomes playable rather than described. **What he costs:** he is the one who can lose to his own dice, and the campaign should let that happen and then hand him the redraw.

#### Why this trio

- **Two near-identical Citizens** let a player practise the fundamentals twice under different stories — the second time with attention spare for the fiction rather than the rules.
- **One Ravel from the start** makes the opening a choice, teaches the game's other temperament early, and proves the composition model across factions before any roster has breadth.
- **All three run on one set of maps** ([`campaigns.md`](campaigns.md)), which is what keeps three openings affordable.

#### Later candidates — IDEA

Not starters; recorded so the work is not lost, and so a later unlock has somewhere to begin. **The bar for promoting one, or adding a new one, is a mechanic that needs a face** — not a gap in the story (the lore's restraint rules in [`lore.md`](lore.md)). A Commander who plays the same as an existing one is a name to maintain forever; three starters plus a short bench is already more cast than the first release needs.

- **Director Oru Denz, "the Paver"** (section 4.4) — coverage and tempo: outposts, roads, economy snowball. The macro archetype, and the natural fourth.
- **Ory Kadresh, "Countersign"** — full **Dual-bound**: both Nexuses answer, and *which* one answers is decided by how the last round was played — build and hold, and the Citizen Nexus answers; break things, and the Ravel Nexus does. Averno is this idea at one card per hand; Kadresh is it as a whole build.
- **Wren Aldiss, "Revision Seven"** — **Proxy**: an officer restored so often that the Nexus's file on her is more detailed than she is, and it is the file the connection now runs through. Her death is a resource and her absence is productive. She must **pose** the deliberate mystery of whether a restored Commander is continuous with the person who died, and never settle it ([`lore.md`](lore.md)).

## 5. Authoring template

Use this template when a milestone step builds an army definition:

```text
# <Faction> — <Commander>

Identity:
Nexus Symbol:
Strategic thesis:
Internal contradiction:

Starting package:
- resources
- workers
- starting units
- structures

Army rules:
- shared faction rules
- Commander exceptions

Units:
- role, producer, supply, cadence, counters, glyph role

Structures:
- common (the faction's, always available) versus army (this army's own tech tree branch, within the cap — section 2.1)
- rarity, tier, role tags (game-modes.md)
- role, footprint, radius, worker/production behavior, glyph role

Nexus powers:
- the army's pool, within the cap, from which each Build Phase's hand is dealt
- rarity, tier, role tags (game-modes.md)
- timing, cost, target, effect, presentation cue

Upgrade pool:
- low/mid/high-tier families
- intended combinations and counterplay

Visual language:
- Grid glyphs
- portrait motif
- movement, projectile, impact, restoration

Balance hypotheses:
- strong against
- vulnerable to
- degenerate strategy risks
- fixtures and metrics
```

Every literal glyph is theme data mapped from a semantic role. Every exceptional mechanic executes through a validated engine capability or narrow hook. Flavor text never becomes an implicit rule.

## 6. Initial authoring order

1. Define the smallest Citizen Commander Army the first real microgame needs.
2. Define the smallest Ravel Commander Army that creates a meaningful asymmetric match.
3. Run deterministic simulations and human matches before adding breadth.
4. Add second Commanders only after the common faction package is stable enough that a variation is cheaper than a new faction.
5. Treat Glitch, Feudals, and Alder as lore and art direction until Citizens/Ravels prove the complete loop.

Full skirmish mode should eventually expose each legal Commander Army without requiring campaign completion. Campaigns introduce and unlock their contents gradually. A drafting mode — players assembling an army from the faction pool at match start, or defining their own Commanders — is a further producer of the same army shape (section 2.1), kept possible by that shape and deliberately undesigned until a milestone step wants it.

## 7. Working notes — IDEA

A handful of small ideas that came from reading the kernel closely, offered the way section 4 frames its own content: they compete for a place, and none is built until a milestone step asks for it. Nothing here is more settled than that.

- **A Citizen unit that is a wall segment, not a wall builder.** The alignment bonus of section 4.1 already rewards unbroken orthogonal runs of structures, and multi-tile footprints are already a rule ([`grid.md`](../system-design/grid.md)). A slow, high-integrity Citizen unit whose footprint is a straight 1×3 or 1×4 line — marched into place and left standing — turns "the player draws Citizen geometry because it is strong" from a structure-placement idea into a Grid one: formation *is* the unit, not just the base layout around it. Nothing about this needs a new engine capability, only content shaped to use two rules that already exist. It has been tried once, as a deliberate control case in the unit-architecture spike ([report](../history/reports/2026-09-10-unit-architecture-spike.md)): it needed nothing new, as predicted. It lives in the Proving Grounds bench roster (`src/content/proving-grounds.ts`, `tests/proving-grounds.test.ts`), still not a Commander Army.
- **A Ravel death that denies ground, not just deals damage.** A death's tile stays blocked for a short window after the entity is gone (the settle delay, `vacatedTiles`; see [`grid.md`](../system-design/grid.md)). A Ravel unit whose detonation *extends* that window inside its blast radius — not just damaging what is caught, but making the ground itself slower to reclaim — combines two things the kernel already has into a new expressive beat for "everything is fuel, and endings are loud," at what looks like a small kernel cost (a radius-scoped write to an already-existing table) rather than a new system.
- **A large, slow unit is already interesting for a reason nobody had to design.** Range is measured to the nearest occupied tile of the target's footprint, not its anchor ([`grid.md`](../system-design/grid.md)), so a big, dangerous, multi-tile siege unit is *easier* to hit than a small one just by existing at that size — real tension, falling straight out of two rules already locked. Worth remembering when a "big scary unit" gets designed: the footprint rule is already doing half the balancing work.
- **One idea to warn against, not recommend.** The replay format needed a precise definition of "an engagement" — attacks clustered in space and time ([`replay-format.md`](../system-design/replay-format.md)). It is tempting to let a Commander power react to that same idea — "bonus effect if cast into an active fight." Do not reuse the *replay's* engagement detector for it: that algorithm is deliberately a post-hoc report-layer read over an already-resolved event log, and letting gameplay rules depend on it would either mean the kernel re-deriving report logic inside the Pulse, or presentation-adjacent code influencing simulation — the exact boundary the three-worlds rule ([`grid-engine.md`](../system-design/grid-engine.md)) exists to hold. If a "reacts to a fight in progress" power is ever wanted, it needs its own simple, kernel-native notion of local density (nearby hostile count within a radius, computed live, the way perception already scans), not a borrowed copy of a tool built for a different job.
