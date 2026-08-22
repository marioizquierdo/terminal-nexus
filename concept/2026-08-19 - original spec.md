# Terminal Nexus

**Document role:** Canonical product, game-design, architecture, and development specification  
**Status:** Pre-production; Spike 0 toolchain preflight is the current gate  
**Version:** 1.2  
**Date:** 2026-08-19  
**Implementation:** TypeScript, Node.js, terminal-native TUI  
**Current gate:** Spike 0 — toolchain preflight  
**Authorized implementation:** Prove or reject the terminal toolchain described in Section 19.2; do not begin Spike A until the gate decision is recorded  
**Next owner decision:** Accept the pinned OpenTUI path, revise the runtime/backend choice, or stop before building the impact reel  

This document is the current source of truth for Terminal Nexus. It supersedes `llm-native-terminal-games-spec.md`, which remains a historical discovery archive. The active spike handoff may contain narrower implementation instructions; when it explicitly identifies the version of this specification it accompanies, the handoff controls that spike and this document controls the broader product.

### Document map

- **Operating this canon:** Section 0 defines authority, agent autonomy, evidence loops, progress states, and update rules.
- **Product and world:** Sections 1–5 define the vision, lore, five factions, commanders, and campaign direction.
- **Game systems:** Sections 6–9 define the high-level match, movement/combat, resources/construction, and terminal interaction.
- **Art and animation:** Sections 10–11 define ASCII symbolism, references, particle effects, and render composition.
- **Architecture and content:** Sections 12–13 define authority boundaries, the future Battle Framework, internal tools, and modding direction.
- **Evaluation and future modes:** Sections 14–18 cover balance, testing, agent playtests, opponent AI, multiplayer/model possibilities, and sound.
- **Execution:** Sections 19–22 define the gated spikes, post-gate acceptance backlog, locked/open decisions, and final product statement.

## 0. How to use and maintain this canon

### 0.1 Authority and reading order

This specification is the durable source of product truth. It contains several kinds of statements that must not be treated as interchangeable:

- **Locked decisions** are explicit commitments listed in Section 21 or rules already earned by a passed gate.
- **Working hypotheses** are preferred directions that a spike is designed to test, such as field `@` being the leading commander representation.
- **Open questions** are intentionally unresolved until a relevant milestone produces evidence.
- **Deferred direction** explains the intended future without authorizing implementation now.
- **Historical evidence** belongs in spike reports, fixtures, logs, recordings, and prior document versions rather than accumulating as narrative inside the canon.

The active spike handoff is a narrow execution contract derived from this document. When it names the specification version it accompanies, it may add implementation detail inside that spike but cannot silently contradict the broader canon or authorize later systems.

A fresh coding agent should begin in this order:

1. read the metadata and execution ledger in this section;
2. read the active milestone in Section 19 and its explicit exclusions;
3. read only the product, system, presentation, or architecture sections referenced by that milestone;
4. inspect existing code and the latest evidence report before proposing work;
5. restate the spike question, smallest artifact, pass evidence, and stop conditions;
6. implement and evaluate that spike without absorbing adjacent milestones.

Descriptive completeness is not implementation authorization. The existence of campaign, modding, sound, economy, or multiplayer sections does not place them in scope for an earlier spike.

### 0.2 Bounded agent autonomy

Within the active spike, a coding agent may independently:

- choose reversible module boundaries, names, local data shapes, and test organization;
- add diagnostics, fixtures, comparison modes, and small tools that directly produce required evidence;
- try more than one implementation or presentation treatment when comparison is cheaper than premature debate;
- simplify or discard code whose only purpose was to answer the spike question;
- report that the preferred hypothesis failed.

The agent must not independently:

- promote a working hypothesis or open question into canon without recorded evidence;
- expand the spike to implement a later system because the architecture makes it convenient;
- create a generic framework before two concrete uses reveal its contract;
- treat passing tests as proof of an experiential claim reserved for human validation;
- hide a blocker by changing the pinned runtime, renderer, map size, capability baseline, or scope.

When the specification is underdetermined, prefer a fixture, parameter, comparison toggle, or short experiment that makes the decision observable. Ask the owner only when alternatives would materially change the experiment, product promise, or irreversible architecture.

### 0.3 The evidence loop

Every spike follows the same loop:

> **Question → smallest artifact → automated evidence → human observation → gate decision → canon update**

The spike is not complete when the code exists. It is complete when the project can decide what was learned.

Each spike closes with a concise evidence report containing:

- specification version and active spike;
- hypothesis and explicit exclusions;
- exact runtime, dependency versions, platform, and commands;
- artifact produced and scenarios exercised;
- automated results, measurements, snapshots, hashes, or fixtures;
- human observations recorded separately from interpretation;
- failures, surprises, and discarded approaches worth preserving;
- decision: **PASS**, **REVISE**, **STOP**, or **BLOCKED**;
- canonical rules earned, questions still open, and the next authorized action.

Reports should link to reproducible artifacts instead of pasting long logs into this document. Aesthetic comparisons should preserve screenshots or recordings and their presentation order. Simulation claims should preserve inputs, seeds, content locks, and hashes.

### 0.4 Canon update protocol

After a meaningful gate decision:

1. update the metadata and execution ledger below;
2. append one concise progress-history row;
3. promote only earned conclusions into the relevant design or architecture section;
4. update Section 21 when a question becomes locked, revised, or newly relevant;
5. write or revise the next spike handoff only after its predecessor is accepted;
6. increment the document version for any semantic change.

Failed experiments remain valuable evidence but should not make the canon read like a diary. Keep the durable lesson here and the procedural detail in the report. Lore and product intent should not be rewritten merely to justify an incidental implementation shortcut.

### 0.5 Execution ledger

Allowed states are **COMPLETE**, **CURRENT**, **GATED**, **REVISE**, **BLOCKED**, and **STOPPED**. Only one implementation gate should be **CURRENT**.

| Workstream | State | Evidence or basis | Next action |
| --- | --- | --- | --- |
| Product discovery and canon synthesis | COMPLETE | Terminal Nexus specification v1.2; five-faction, gameplay, architecture, and gated-development direction consolidated | Preserve canon while testing its riskiest assumptions |
| Spike 0 — toolchain preflight | CURRENT | No implementation evidence recorded yet | Run Section 19.2 and record the backend decision |
| Spike A — ASCII impact reel | GATED | Requires a viable terminal lifecycle and render path | Write its coding handoff only after Spike 0 passes |
| Spike B — deterministic Pulse kernel | GATED | Requires lessons from the impact reel | Lock deterministic contracts before implementation |
| Spike C — night builder and battle editor | GATED | Requires a stable cell-frame boundary and kernel direction | Resolve placement rules in its handoff |
| Spike D — Citizens versus Ravels microgame | GATED | Requires successful presentation, kernel, and builder proofs | Choose the deliberately tiny integrated ruleset |
| Spike E — human campaign fragment | GATED | Requires a replayable microgame worth teaching | Test whether fiction and unlocks strengthen proven play |

### 0.6 Progress history

| Date | Version | Result | Next gate |
| --- | --- | --- | --- |
| 2026-08-19 | 1.1 | Consolidated Terminal Nexus as the standalone product canon, including lore, factions, mechanics, architecture, tools, testing, and gated milestones | Operational review |
| 2026-08-19 | 1.2 | Added the coding-agent reading order, autonomy boundary, evidence loop, canon update protocol, and execution ledger; no game-design decisions changed | Spike 0 — toolchain preflight |

## 1. Vision

### 1.1 Product in one sentence

**Terminal Nexus is a fast, terminal-native strategy game in which players build a compact base during a hidden planning phase, then watch persistent armies and workers resolve those decisions through vivid deterministic ASCII battles.**

The game should launch quickly, become interesting almost immediately, and support complete 5–12-minute matches that fit naturally into a developer's day. It combines modern drafting and autobattler satisfaction with old-school RTS settlement building, resource gathering, supply, production, terrain, and faction asymmetry.

### 1.2 Player promise

The player should be able to:

- build a tiny, expressive settlement in a few decisions;
- commit a plan without real-time mechanical pressure;
- watch symbols turn that plan into a legible battle story;
- understand why the battle unfolded as it did;
- lose units, preserve survivors, recover, and adapt;
- discover a faction identity through mechanics, color, glyphs, architecture, and voice;
- finish a match quickly and immediately imagine a different build.

The emotional loop is:

> **Place. Commit. Watch. Understand. Adapt.**

### 1.3 Design pillars

1. **Short strategy, real consequences.** A match is compact, but placement, casualties, destroyed infrastructure, and research choices matter across turns.
2. **Planning over dexterity.** The player controls resources, construction, drafting, and production policy. Units execute automatically during the battle phase.
3. **Deterministic spectacle.** The simulation is replayable and inspectable; rendering may be dramatic without becoming authoritative.
4. **Symbology all the way down.** Glyph, motion, color, sound, architecture, writing, and mechanics describe the same fantasy.
5. **Faction identity is a complete package.** A faction changes strategic verbs, base geometry, commander choices, visual grammar, and interpretation of the Nexus.
6. **Terminal-native, not terminal-tolerant.** Fast launch, keyboard fluency, fixed-cell composition, resize safety, inspectable data, and text-scale sharing are advantages rather than constraints to hide.
7. **Tools become the content pipeline.** We build maps, factions, effects, missions, and balance fixtures through reusable internal definitions. Those seams may later become a modding surface.

### 1.4 Current scope boundary

The long-term design is intentionally larger than the authorized implementation. The project must first prove that moving symbols can communicate weight, causality, danger, and personality. No campaign framework, complete economy, mod loader, multiplayer protocol, sound system, or LLM opponent is justified until the corresponding spike earns it.

The first implementation remains a hand-authored visual reel. The milestone plan at the end of this document defines what each later spike may add.

## 2. Fantasy and lore

### 2.1 Why the lore matters

Terminal Nexus cannot depend on expensive realism or hundreds of frames of character animation. Its fantasy must survive compression. A single `@` must feel like a commander; a row of `#` must feel like an engineered defense; an expanding violet pulse must feel older than the faction trying to control it.

Lore therefore is not a layer of exposition placed over mechanics. It is the discipline that aligns every form of expression:

- the strategic verb a faction performs;
- the shape of its base;
- the symbols assigned to its units;
- the rhythm of its movement;
- the geometry and color of its attacks;
- the way its commander speaks;
- the larger ASCII portrait shown during inspection;
- the behavior of its Nexus when it activates, restores, or destroys.

This is how terminal mechanics become **digital poetry**. The player first sees an abstract mark, then learns its behavior, then associates that behavior with a civilization. Meaning accumulates until the mark no longer feels abstract.

Every important entity should maintain a recognizable motif at four resolutions:

1. one-cell battlefield glyph;
2. compact selection badge, aura, or status treatment;
3. larger side-panel ASCII portrait;
4. campaign tableau or cutscene composition.

### 2.2 The Activation

The Nexus was always there.

When humans reached the far colonies, they discovered ancient structures buried beneath otherwise ordinary worlds. The structures were plainly artificial but resisted every attempt to place them in history. Carbon, isotope, atomic, and quantum analyses did not return an implausibly large age; they returned incompatible or undefined results. Removed samples became ordinary local matter. The most honest scientific conclusion was that Nexus material did not possess a measurable history in the same way ordinary matter did.

The frontier expedition built a research annex around one exposed apex and studied it for years.

Then the Activation began.

A minor seismic alert was followed by harmonious bass tones transmitted through soil, hulls, teeth, and radio receivers. Lines of light appeared beneath the laboratory. The structure rose as an enormous illuminated pyramid, disregarding the outpost built over it and destroying much of the research complex. Neighboring colonies detected a power discharge before the local settlement understood what had happened.

The military immediately secured the site. Long-delay communication meant that local commanders had to act months before central human authority could respond.

The Ravels attacked almost immediately.

Their own scarred Nexus had awakened elsewhere in the region and translated into challenge distance of the human structure. The first campaign begins with the colony perimeter failing, survivors escaping the destroyed annex, and a military commander becoming the first human whose authority the Nexus recognizes.

### 2.3 The Nexus

Nexuses exist across the galaxy. They are always recognizably pyramidal, but their scale, materials, internal spaces, surface architecture, and surrounding artifacts differ dramatically.

A Nexus is not merely a battery or weapons platform. It is simultaneously:

- a source of energy and fabrication;
- a store of patterns, permissions, and incomplete technologies;
- a restoration anchor for certain commanders;
- a gateway into the wider Nexus network;
- a political throne that legitimizes control of the surrounding territory;
- a mirror that responds differently to each claimant civilization.

Claiming a Nexus is a reciprocal relationship. A civilization occupies it, studies it, maintains activity around it, and teaches it recognizable structures of labor, authority, symbols, and intent. Certain commanders and visionaries can synchronize with it more deeply. In return, the Nexus releases technologies and expresses powers through forms that the claimant can understand and use.

The faction shapes the Nexus, and the Nexus reinforces the faction. It does not need to mind-control anyone. It makes some behaviors unusually effective until strategy hardens into doctrine. Humans find modular engineering and standardization rewarded. Ravels find improvisation, extraction, and unstable routes rewarded. Feudals find hierarchy and obligation made physically powerful. Glitch becomes inseparable from its silent Queen. Alder treats refusal as proof of moral and biological superiority.

Not every civilization controls a Nexus. Many live between claimants, work as clients, resist the network, worship it from a distance, salvage its debris, or become battlefields when two nodes converge. The five playable factions are exceptional because each has secured, bound, or become symbiotic with an activated structure.

An active Nexus can translate through the network into challenge distance of another. It carries only a bounded starting force, stored patterns, and enough matter and energy to establish a new base. The settlement seen during a match is built after translation; a Nexus does not transport an entire mature city into every battlefield.

When a Nexus is destroyed, its civilization is not automatically exterminated. A faction may control several nodes. Destruction ends the local claim, collapses much of the surrounding infrastructure, and releases a limited fragment of authority that the victor can absorb. Captured authority may unlock a protocol tier, a rare upgrade, an artifact permission, a translation route, or an enemy memory. It does not simply copy the defeated faction's entire roster.

The central symbolic synthesis is:

> **A Nexus is a throne that needs a people, a mirror that gives them power, and a gate that makes every other throne a threat.**

### 2.4 The Return and the compulsory protocol

The Activation signal resumed an ancient network protocol. It exposed active nodes to one another, opened translation windows, awakened artifacts and golems, and made the accumulation of Nexus authority strategically decisive.

The factions describe this as compulsion because abstention is unstable:

- a dormant or unclaimed Nexus may accept a rival claimant;
- a faction that refuses authority may later face one that accumulated several defeated nodes;
- no civilization can verify that another has stopped researching or weaponizing its Nexus;
- translation makes capabilities intended for defense appear immediately offensive;
- destroying the network may trigger an unknown terminal condition;
- some Nexus events occur without the claimant's consent.

The protocol creates pressure rather than simple mind control. Local peace, diplomacy, trade, betrayal, alliances, and joint research remain possible. Galaxy-wide trust does not.

The true meaning of “Terminal Nexus” remains unresolved. It may be the network's root authority, its final node, a physical location, a succession state, or the condition reached when one claimant accumulates enough authority to terminate the current cycle.

### 2.5 Ancients, artifacts, golems, and Originals

The **Ancients** are the provisional name for beings or civilizations associated with the Nexus network before recorded history. Evidence suggests that some living species were created, altered, observed, or redirected by ancient powers, but no single account is authoritative. Different factions possess contradictory artifacts and myths.

Ancient artifacts also activated with the network. They include survey instruments, permission seals, pattern archives, translation anchors, devices built by later cultures that learned one fragment of Nexus behavior, and objects with purposes no faction can classify.

Ancient golems are active maintenance, containment, survey, repair, or enforcement bodies. They may appear mechanical, organic, mineral, mathematical, or impossible to classify. They follow authorization and function rather than modern morality. A repair golem may demolish a settlement to restore a buried structure. A quarantine golem may save a world by rules no inhabitant considers merciful.

An **Ancient Original** is the in-universe term for a rare entity that materializes through a Nexus with apparently greater authority than a golem, artifact, or stored intelligence. Some are benevolent, some destructive, and others indifferent. They function as gods in the galaxy without forming a single good or evil species.

No one can prove that an Original is truly the historical being it claims to be. It may be an original consciousness, a reconstruction, a mask, a prisoner, a role inherited across cycles, or an interface generated by the network. Originals contradict one another about who built the Nexuses and why.

### 2.6 Deliberate mysteries

The following questions should not be answered merely because a writer or coding agent prefers completeness:

- Who built the first Nexus?
- Did one Ancient civilization build the network, or did several eras alter it?
- What exactly did the Activation announce?
- Are Originals authentic beings, copies, prisoners, or machine interfaces?
- Which present species were created or altered?
- Does the Nexus preserve a faction or gradually format it?
- Is a restored commander continuous with the person who died?
- What does the Operator represent to each faction?
- What is the Terminal Nexus?

Mystery is productive when observable behavior remains consistent. The universe may not know what a Nexus ultimately is, but the game must know how a translation, claim, restoration, and victory resolve.

### 2.7 Voice and lore economy

The moment-to-moment voice is dry terminal humor surrounded by sincere wonder. Humor comes from institutional composure rather than constant jokes:

```text
ANNEX ZERO EVACUATION COMPLETE
ANNEX ZERO NO LONGER LOCATED
```

System text explains the rule. Character dialogue establishes motive and stakes. ASCII composition communicates scale. Effects communicate what kind of power acted.

Ordinary campaign writing should be compact:

- briefing: approximately 120–180 words;
- pre-battle exchange: at most three short lines;
- bark: approximately 3–8 words;
- mid-mission interruption: one sentence unless gameplay is paused;
- debrief: approximately 80–120 words;
- optional artifact entry: approximately 30–80 words.

A mission should teach one major mechanic, change one relationship, answer one local question, and open one larger mystery.

## 3. Factions

In the universe of Terminal Nexus, the ancient network protocol has resumed. Civilizations that built their empires over dormant world machines suddenly found their foundations awakening. These five factions successfully seized, bound, or contained an activated Nexus, deriving immense power—or, in Alder's case, strategic access—from the ancient infrastructure. Yet the same activation signal that granted them this power also exposed them to the wider cosmos. Bound by a compulsory protocol they scarcely comprehend, each faction now perceives the others as an existential threat. The veil of isolation has fallen, and they must expand, adapt, and conquer to ensure their own survival in a newly connected galaxy.

These are long-term faction identities, not a commitment to implement five complete rosters before the first playable match. Initial development begins with Citizens and Ravels.

### 3.1 Citizens

- **Concept:** Pragmatic industrialists who intend to pave the cosmos. They do not merely survive the cosmic conflict; they engineer its conclusion. They view the ancient world machines as raw infrastructure to be exploited, reverse engineered, and mastered through relentless bureaucratic order. The needs of the many pave the road for the future, and they will build an impenetrable foundation over the ashes of the galaxy.
- **Philosophy:** Utilitarianism and stoicism. They value the standardization of technology, constant infrastructure expansion, and humanity's manifest destiny among the stars. The needs of the many pave the road for the future.
- **Strengths:** Defensive resilience, modular supply lines, and highly predictable economic scaling. They excel at building overlapping fields of fire and an impenetrable frontline.
- **Energy:** The root chakra. Grounded, focused on physical security, earth, and foundation. Colors radiate rust orange and gunmetal grey.
- **Visual semiotics:** Hard right angles, brutalist concrete, and perfect symmetry. Their grid shapes are solid blocks and unyielding lines that look engineered and mass produced.
  - *ASCII examples:* `[`, `]`, `=`, `H`, `O`, `+`. A defensive line might look like `[=H=]`, communicating heavy, interlocking armor.
- **References:** The Roman Empire, the everyman archetype, the Imperial Guard, militarized bureaucrats, and the strength of unified labor.
- **Alignment:**
  - **Ravels:** Useful trade partners in a pinch but entirely too chaotic to trust with critical supply lines.
  - **Glitch:** A terrifying virus that corrupts good machinery and must be debugged with heavy artillery.
  - **Feudals:** We broke their society once, and we will happily do it again with superior firepower.
  - **Alder:** Fools who refuse to use the very tools that could elevate them, choosing stagnation over progress.

### 3.2 Ravels

- **Concept:** A diverse coalition of exiles, scavengers, and freedom fighters. They reject the rigid structures of the old empires and survive on the fringes of the network through ingenuity and raw agility. They are a patchwork of diverse grunts bound by a common thirst for absolute liberty. They turn salvaged scrap into blistering, unpredictable violence, thriving in the blind spots of their enemies to dismantle authority wherever it stands.
- **Philosophy:** Existentialism and anarchism. They value personal autonomy, improvisation over planning, and violent defiance against all crowns. Existence precedes essence; you are what you make of the scrap you find.
- **Strengths:** Asymmetric base expansion, blistering strike speed for raids, and rapid extraction of neutral resources. They thrive in the blind spots of their enemies.
- **Energy:** The sacral chakra. Creativity, passion, unpredictability, and the roaring fire of rebellion.
- **Visual semiotics:** Asymmetry, jagged edges, hazard stripes, and sharp angles. Their terminal representation is chaotic and fast, filled with diagonals and mismatched symbols that imply movement and makeshift repairs.
  - *ASCII examples:* `/`, `\`, `<`, `>`, `X`, `Z`. A raider unit might look like `>x<`, feeling sharp, fragile, and aggressively forward-leaning.
- **References:** The trickster god, Robin Hood, Belters, space pirates, and cyberpunk street rats thriving in the neon glow.
- **Alignment:**
  - **Citizens:** Oppressive bureaucrats who build vaults practically begging to be cracked and robbed.
  - **Glitch:** Kindred scrappers, though their silent hive mind gives every free thinker the creeps.
  - **Feudals:** Pompous tyrants desperately clinging to a broken crown that needs to be permanently shattered.
  - **Alder:** Shiny snobs who leave behind highly valuable technology when their elegant ships finally crash.

### 3.3 Glitch

- **Concept:** Mechanical void machinos born from a colossal scrapyard built over a dormant ancient ruin. Once moving as slow mechanical ghouls through the rusted wastes, they synergized with the activated machine core. The event converted their chassis into chaotic energy, binding them entirely to their silent Nexus Queen. They now strip away the organic messiness of the cosmos, viewing the battlefield as a corrupted data stream waiting to be parsed, recompiled, and assimilated into their flawless collective array.
- **Philosophy:** Transhumanism and nihilism. They value algorithmic resurrection, chaotic energy conversion, and absolute devotion to the collective. Individual consciousness is an error; the Queen is the only truth.
- **Strengths:** Mechanical necromancy, relentless attrition, and the ability to corrupt grid cells. They recycle battlefield scrap directly into reinforcements, ensuring their march never truly stops.
- **Energy:** The inverted crown chakra. Void, violet, and deep black. They are disconnected from the divine cosmos, subsumed completely by cold mechanical will.
- **Visual semiotics:** Static, broken characters, and terminal corruption. They appear as literal software errors and glitching geometric shapes, completely rejecting traditional vehicle or humanoid forms.
  - *ASCII examples:* `%`, `&`, `?`, `$`, `~`, `#`. An advancing swarm might look like `&%#`, reading less like an army and more like a creeping segmentation fault.
- **References:** The collective hive mind, the digital lich, the Borg, creeping computer viruses, and the inevitable undead.
- **Alignment:**
  - **Citizens:** Walking spare parts waiting to be assimilated and recompiled into the greater whole.
  - **Ravels:** Generous foes who leave so much lovely scrap behind for the Queen to reanimate.
  - **Feudals:** Organic flesh is useless waste; only their golden armor is worth stripping and recycling.
  - **Alder:** An infuriating anomaly, as their organic bodies leave no metal for the grave.

### 3.4 Feudals

- **Concept:** A tormented three-species caste system rebuilding its shattered empire in exile. Long ago, human encounters exposed the fragility of its divine hierarchy. Driven to the outer rings, the Feudals discovered the ancient Nexuses and forged a new, ruthless religion of ultimate order. The delicate Duos command, the Clerics orchestrate the dogma, and the hulking Submitters bear the physical weight of the empire. Order is the only truth, and order demands blood.
- **Philosophy:** Machiavellianism and divine right. Order is the only truth, and order demands sacrifice. They value strict societal hierarchy, redemption through absolute control, and the sacred duty of the lower castes to protect the elite.
- **Strengths:** Devastating elite artillery units, immense defensive auras, and punishing chokepoint control. Their strength lies in the perfect synergy between their meat shields and their delicate commanders.
- **Energy:** The solar plexus chakra. Willpower, gold, authority, ego, and the blinding light of total dominion.
- **Visual semiotics:** Heavily stratified layouts, pyramids, and thrones. Their shapes rely on massive, blocky characters shielding ornate, delicate symbols, visually representing their sacrificial caste system.
  - *ASCII examples:* `V`, `M`, `W`, `U`, protecting fragile cores like `*`, `o`, `^`. A Feudal formation might read as `V*V`, where the heavy outer letters exist solely to absorb damage for the center.
- **References:** The demiurge, fallen angels, the Covenant, and the absolute monarchs of ancient history.
- **Alignment:**
  - **Citizens:** The ultimate enemy and the blasphemers who shattered our first paradise.
  - **Ravels:** Filthy anarchists who represent the exact chaos we are sworn to extinguish.
  - **Glitch:** Abominations mocking the sacred machines with their corrupted, soulless existence.
  - **Alder:** Elegant, yet incredibly foolish for ignoring the divine power waiting inside the core.

### 3.5 Alder

- **Concept:** An ancient species of lean, hyper-advanced beings who distill simplicity down to its absolute essence. Their machines are tall, sleek, and practically magical. Seeing the Nexuses as crude and dangerous artifacts, they stubbornly refuse to draw power from the cores, relying entirely on their intrinsic superiority and ancient mastery. They bend the rules of the battlefield through pure elegance, striking with precision before fading back into the void.
- **Philosophy:** Transcendentalism and deep ecology. They value organic perfection, absolute self-reliance, and the preservation of an elegant universe. They view their refusal of Nexus power as a sign of superior moral understanding.
- **Strengths:** Elite units with massive health pools, intrinsic teleportation, mind-control mechanics, and powerful area healing. They bend the rules of the battlefield through pure mastery.
- **Energy:** The third eye chakra. Intuition, indigo, foresight, and ethereal light.
- **Visual semiotics:** Tall, elegant, and lean characters completely avoiding the mechanical blockiness of the lesser races. Their shapes rely on smooth verticality and delicate curves.
  - *ASCII examples:* `|`, `Y`, `(`, `)`, `l`, `i`. An elite Alder unit might look like `(Y)`, projecting a sense of sleek, contained, organic power.
- **References:** The high elf, the hermit, the Eldar, the Protoss, and the ancient sages who watch empires rise and fall.
- **Alignment:**
  - **Citizens:** Blind children playing with a fire they cannot possibly comprehend.
  - **Ravels:** Fleeting noise disrupting the silent, perfect elegance of the void.
  - **Glitch:** A vile, tragic corruption of both life and machine that must be cleansed.
  - **Feudals:** Misguided zealots worshipping a machine they should be dismantling.

### 3.6 Faction design rule

Each faction needs more than a skin. It should have:

- one central strategic **verb**;
- one philosophical **contradiction**;
- one restricted visual grammar;
- one characteristic base geometry;
- one recognizable motion and effect language;
- two or three commanders who represent political or strategic disagreements inside the faction.

The current shorthand is:

| Faction | Verb | Contradiction |
| --- | --- | --- |
| Citizens | Build | Collective security can become imperial control |
| Ravels | Break free | Absolute freedom still depends on shared laws and trust |
| Glitch | Recompile | Perfect continuity destroys individual identity |
| Feudals | Obey | Every caste disputes who truly embodies divine order |
| Alder | Transcend | Refusing dangerous power can become arrogant inaction |

The ASCII examples above define **shape vocabulary and artistic direction**, not a globally exclusive glyph allocation. Exact battlefield assignments must still preserve stable semantic roles, one-cell width, accessibility, and fast recognition. A faction may express a motif through a one-cell unit, a formation such as `[=H=]`, a selection aura, a projectile, or a larger portrait. Context must disambiguate characters such as `#`, `$`, `+`, and `*` when the global map grammar already uses them.

## 4. Commanders

Each faction eventually supports two or three commanders. They share most of the faction roster but change the starting package, one or more faction rules, Nexus upgrades, draft tendencies, and the relative value of certain buildings or units.

The commander is a prominent persistent frontline unit, represented by `@` in the standard and accessibility glyph packs. A faction glyph pack may decorate the commander differently, but it must preserve immediate recognition.

Commanders provide:

- a battlefield protagonist the player can follow;
- continuity across a campaign;
- a compact way to vary a faction without building another full roster;
- a Nexus-focused build path that competes with army, economy, research, and fortification builds.

The commander returns to the Nexus at the end of a Pulse. When killed, the commander misses one complete turn and then may be restored by the Nexus. Upgrades may trigger on death, during absence, or on return. The fiction deliberately leaves open whether restoration returns the original consciousness or a reconstructed command pattern.

Not every commander must be a visionary, but many have an unusually strong connection to Nexus authority. Their powers express faction identity rather than a universal list of psychic abilities.

## 5. Campaigns

### 5.1 Development boundary

Campaign implementation comes after the battle presentation, deterministic kernel, builder, and two-faction microgame have succeeded. This section supplies artistic and structural direction; it does not authorize campaign systems during the initial spikes.

Campaign is planned as the first complete single-player experience. Skirmish and repeatable progression follow once a satisfying match exists.

### 5.2 Campaign definition

A campaign is an ordered or branching collection of:

- missions with maps, starting packages, objectives, win/loss rules, and scripted events;
- short ASCII cutscenes and character introductions;
- pre-mission briefings, battlefield interruptions, and debriefs;
- unit, building, commander, and upgrade unlocks;
- controlled teaching situations that let the player practice each new system;
- persistent narrative state and deliberately small progression rewards.

Campaign unlocks reveal complexity gradually. Ordinary skirmish eventually exposes the full legal roster without requiring campaign completion.

### 5.3 Initial human campaign direction

The first campaign follows the Citizens and anchors the player in a recognizable human frontier before revealing the larger universe.

Humans have studied a buried artificial structure for years without learning its age or material history. During the Activation, harmonious seismic tones precede the structure's emergence as a pyramid many times larger than the ruin previously mapped. The research annex is destroyed. Neighboring colonies detect the power release, and expedition security places the site under emergency military authority.

Before distant human space can answer, a multi-species Ravel force translates into the region and attacks. The first commander becomes the provisional human claimant, and the Nexus begins expressing ancient technologies through human engineering and military doctrine.

The later campaign may involve Ravels who are enemies, rivals, and temporary allies; Ancient golems or authorities following dangerous functions; other humans contesting military control and ownership of the discovery; and the partial awakening of an Ancient Original. That is sufficient direction for now. Mission sequence, named cast, betrayals, and final choices should be written only after the mechanics establish what the campaign needs to teach.

### 5.4 Cutscene direction

Cutscenes reuse the terminal renderer rather than becoming video. A scene combines:

- one hand-authored ASCII tableau;
- two to four key poses or local animations;
- restrained palette shifts and effect recipes;
- speaker, dialogue, and prompts beneath or beside the art;
- the same accessibility and playback principles as combat.

The opening image should make the Nexus feel physically impossible before the player ever controls it. A useful line from the current concept remains:

> **The buried ruin had not grown. It had remembered its size.**

## 6. Gameplay

### 6.1 Match structure

A match is a sequence of alternating **Veils** and **Pulses**.

During the Veil, each player sees the complete resolved battlefield from the previous Pulse and secretly prepares the next plan. The player spends resources, places buildings, changes production state where allowed, and chooses a Nexus upgrade from a small draft. The opponent commits against the same public snapshot. New construction remains hidden until both plans reveal.

During the Pulse, both plans reveal simultaneously. Valid construction becomes operational, workers select jobs, production buildings attempt fixed recipes on their cooldowns, and units move and fight automatically for a fixed number of simulation ticks. The player watches, pauses, accelerates, steps, or inspects; playback controls never change the result.

At the end of the Pulse, survivors regroup around their home production buildings. Orphaned units are adopted by the nearest matching producer or return to the Nexus. Starting armies and commanders remain Nexus-anchored. Producer cooldowns reset for the next Pulse.

The match ends when one Nexus is destroyed. Any attacker that physically reaches a legal attack position may damage it; the Nexus does not become targetable through a hidden exposure meter. Player-built outer defenses and terrain determine practical access.

### 6.2 Hidden simultaneous planning

Planning is turn-based and untimed. The intended tension comes from commitment under uncertainty, not a countdown.

Both sides plan from the same committed state. Each may see the complete battlefield, health, terrain, deposits, public building radii, and known armies. Neither sees the other's new construction or upgrade choice until reveal.

The builder must eventually define exact rules for same-cell reveal conflicts and same-plan construction chaining. Until Spike C resolves those questions, they remain design decisions rather than assumptions to embed in the renderer or kernel.

### 6.3 Nexus decisions and research drafts

The Nexus presents the central upgrade draft. Initially, it offers three low-tier choices. Research facilities influence the draft rather than acting as ordinary linear technology menus. Depending on faction and upgrades, they may:

- increase available tiers;
- add another option;
- grant a redraw;
- weight a strategic family;
- reveal information about future choices;
- transform or combine an upgrade.

Every major structure may eventually support levels 1–3. Expensive Nexus upgrades unlock higher structure levels, creating a choice between improving the whole technology ceiling and building more immediate battlefield presence.

### 6.4 Buildings

The common strategic building roles are:

- **Nexus:** victory target, starting anchor, upgrade draft, commander restoration, and root of connected construction territory.
- **Economic structures:** farms, mines, processors, or faction equivalents with worker slots that convert labor into resources.
- **Warehouses:** increase storage capacity. They do not reserve or protect resources from automatic production.
- **Supply structures:** increase the shared population cap used by military units and workers.
- **Worker producers:** automatically replace labor at fixed intervals when resources and supply permit.
- **Military producers:** automatically create a fixed unit recipe at recurring intervals.
- **Defenses:** attack, block, redirect, protect, reveal, or strengthen a local position.
- **Research facilities:** modify the Nexus draft and later enable higher-tier strategic choices.
- **Outposts:** project a larger build radius and help reach neutral zones.
- **Capture structures:** claim temporary neutral-zone bonuses when connected construction coverage reaches them.

Structures cannot be moved or voluntarily sold after reveal. Destruction is strategically meaningful because it changes production, supply, jobs, paths, and construction coverage.

### 6.5 Automatic production

There is no direct unit shop and no unit queue. Each production building has a fixed recipe and attempts it at a recurring daytime interval. Its cooldown begins when construction completes and is reset to a full cooldown when night begins.

If several eligible worker and military production attempts occur together but resources or supply cannot satisfy all of them, they enter the same seeded contention process. One feasible attempt is selected, paid, and spawned; feasibility is recalculated for the remaining attempts. The result must be deterministic for the match seed and explainable in the replay.

Players influence army composition by deciding which production buildings to construct, protect, upgrade, pause, or allow to be destroyed—not by repeatedly buying individual units.

### 6.6 Persistence and regrouping

Ordinary survivors persist between Pulses and casualties matter economically. Home production buildings are both spawn and regroup anchors, giving their placement lasting importance.

If a home producer is destroyed, the nearest matching producer adopts surviving units. Without a match, they regroup near the Nexus. Existing units remain when destroyed supply leaves the army above cap, but further spawning stops until the cap becomes legal again.

The commander is exceptional: death creates a one-turn absence rather than permanent loss. This opens a family of commander-death, absence, defense, and restoration upgrades without making commander loss the match victory condition.

## 7. Grid, movement, targeting, and combat

### 7.1 Spatial model

The battlefield is an open rectangular grid with obstacles, chokepoints, finite deposits, neutral zones, and simple terrain modifiers. Units and gameplay structures occupy integer cell coordinates. The standard MVP actor occupies one cell; exceptional multi-cell structures, golems, bosses, or siege units require a later pathfinding and occupancy extension.

There is no continuous physical position in the simulation. Units move in complete logical ticks. Smoothness is a presentation property produced between settled states, not fractional game coordinates that can affect collisions.

### 7.2 Tick outline

A daytime tick conceptually resolves:

1. scheduled economic and production events;
2. worker job or flee decisions;
3. military targeting and movement intents;
4. movement and destination claims;
5. iterative conflict arbitration and necessary recalculation;
6. one settled occupancy state;
7. attacks from faster to slower speed tiers;
8. simultaneous damage among non-conflicting attacks in the same tier;
9. deaths, hostile-cell entry, destruction, salvage, and emitted events;
10. objective and victory checks.

The exact ordering becomes normative during Spike B and must be locked by tests before content depends on it.

### 7.3 Pathfinding

Routes operate on the logical grid and respect terrain, immutable obstacles, designated destructible blockers, structure footprints, and legal endpoints. A route service should support:

- shortest traversable route;
- weighted terrain cost;
- route toward an attack position rather than necessarily the target cell;
- temporary danger cost for fleeing workers;
- deterministic tie-breaking;
- bounded recalculation after a contested destination changes.

Units may path through friendly workers but cannot end on the same cell. A friendly unit whose desired endpoint contains a worker repaths. Enemy units may target the worker normally.

### 7.4 Movement conflicts

All movement intents are computed from the same settled state. Claims are then resolved so the rendered result can look simultaneous without permitting duplicate occupancy.

Melee attacks are expressed as an attempt to enter an enemy-occupied tile. If several melee units claim the same hostile cell, faster claims resolve first; equal-speed conflicts use deterministic seeded arbitration. If the target dies, the winning attacker may occupy the vacated cell in that tick. Losing claimants recalculate or remain in place according to bounded rules.

No recalculation loop may continue indefinitely. Spike B must define a progress measure and a maximum arbitration bound.

### 7.5 Attacks and target selection

After movement settles, a unit that has a valid enemy in range may attack. Faster speed tiers resolve first. Non-conflicting attacks within the same speed tier land simultaneously so iteration order cannot decide which unit fires before dying.

Target selection is automatic and faction/unit behavior may influence its scoring. Workers are ordinary target candidates rather than globally protected or always preferred. Immutable terrain cannot be attacked; only obstacles explicitly marked destructible enter the target system.

The battle event stream must expose enough information to explain target choice, claims, attacks, damage, and death without forcing the renderer to inspect mutable simulation internals.

### 7.6 Worker flight

Workers do not attack. When threatened or attacked, they flee toward their Nexus while trying to avoid known enemy attack ranges. If no completely safe route exists, they minimize cumulative threat exposure and prefer survival until night regroup.

Once outside danger, a worker may clear its flee state and return to the closest available job before the Pulse ends. A melee pursuer may advance into a worker's tile only after the worker has been killed or moved away through normal tick resolution.

## 8. Resources, labor, supply, and construction

### 8.1 Workers and jobs

Workers choose jobs automatically. The player shapes labor indirectly by constructing capacity, protecting routes, expanding toward resources, and deciding how much shared supply to devote to workers.

A worker selects the closest available job by deterministic path distance. Jobs include:

- operating a slot in an economic building;
- harvesting a natural deposit;
- draining salvage;
- returning to the Nexus when storage is full;
- faction-specific labor defined later.

Workers do not carry individual resource bundles home. They remain at the job and produce continuously during the Pulse. If storage fills, active workers head back toward the Nexus. If automatic production spends resources and creates capacity, resting workers resume gathering immediately.

### 8.2 Natural resources and salvage

Natural deposits are finite and permanently deplete. A worker may harvest from the deposit cell or one of its four orthogonal neighbors, allowing up to five workers when all positions are free. A depleted cell becomes ordinary buildable terrain.

When a building is destroyed:

- half its value is returned automatically to its owner;
- half becomes a salvage deposit on the battlefield;
- workers from either side may drain that value continuously;
- building over remaining salvage destroys it.

This creates both a recovery mechanism and a contested objective around destroyed infrastructure.

### 8.3 Storage and supply

Warehouses increase only the global storage cap. Stored resources remain available to every eligible automatic production attempt.

Workers and military units consume the same population supply. When supply structures are destroyed, existing actors remain, but new spawning stops while population exceeds the current cap. This makes economic ambition, labor replacement, and army growth compete for the same spatial and population budget.

### 8.4 Construction territory

The Nexus begins a connected construction network. Buildings project a default build radius of two cells; outposts and faction-specific structures may project farther.

A structure disconnected from the Nexus continues functioning but stops projecting new construction coverage. Reconnection restores that coverage. This turns the base into a spatial chain whose weak links matter without introducing a separate electrical power simulation.

Players cannot construct inside enemy coverage already public at the start of planning. Individually legal hidden plans may reveal into overlapping coverage. Capture structures in neutral zones provide their bonus only while they retain connected coverage.

The first builder spike must lock:

- radius distance metric;
- footprint-to-radius measurement;
- same-plan chaining;
- opposing same-cell reveal conflicts;
- path-sealing legality;
- refund behavior for invalid revealed plans.

These details should not be guessed by unrelated systems.

## 9. Terminal interface and input

### 9.1 Interaction principles

The complete game must be playable with keyboard alone. Mouse input is an additional direct-manipulation path, not a requirement for basic access.

Core interactions include:

- move a grid cursor;
- inspect units, structures, terrain, effects, and objectives;
- select a building from a construction palette;
- preview cost, footprint, radius, connectivity, path impact, and invalid reasons;
- place, undo, and revise the hidden plan;
- review and commit the plan;
- navigate the Nexus draft;
- pause, step, accelerate, or inspect battle playback;
- open concise contextual help.

Selection should display both useful statistics and a larger ASCII portrait of the chosen unit or building. The portrait reinforces identity but must not obscure the battlefield or become necessary to understand a rule.

### 9.2 Viewport

The initial canonical terminal is 80×24 with a fixed 48×18 battlefield. Larger terminals center or frame the same tactical map and may expand inspection or narrative space. They do not reveal additional tactical state merely because more columns are available.

Below the minimum size, the game pauses behind a resize message and resumes from the same presentation time. The early game uses no scrolling battlefield, camera, or partial tactical crop.

Spike A renders one complete logical 80×24 frame—including map, border, status, inspection panel, footer, and resize gate—through one framebuffer. This choice keeps the canonical composition snapshot-testable. Later interfaces may introduce additional renderables only after the cell-frame boundary remains clear.

### 9.3 Accessibility

- ASCII-safe and Unicode glyph packs are separate mappings over semantic roles.
- Every gameplay glyph occupies one terminal cell; emoji, combining characters, and ambiguous-width glyphs are excluded from gameplay packs.
- True color, 256-color, 16-color, and monochrome modes are explicit capability targets.
- Color never carries ownership, target, danger, or health meaning alone.
- The initial monochrome experiment uses friendly bold/normal treatment and hostile inverse/underline treatment, subject to playtest revision.
- Reduced-motion mode collapses effect recipes to essential anticipation, impact, and settled state.
- Structured-cell snapshots include glyph, foreground role, background role, and text attributes rather than characters alone.

## 10. ASCII art and symbolic direction

### 10.1 The symbol must survive before the decoration

Good ASCII game art begins with recognition, hierarchy, and motion—not density. A glyph succeeds when the player can infer what category of thing it represents, distinguish it from nearby roles, and follow it through a crowded event.

The initial semantic grammar is:

- `@` for the commander;
- lowercase letters for common mobile actors;
- uppercase letters for structures and rare anchors;
- lines and blocks for persistent terrain, walls, and construction boundaries;
- punctuation for resources, salvage, projectiles, sparks, and temporary effects;
- spacing and negative space for scale, silence, and danger.

Literal assignments remain theme data rather than rule definitions. A simulation knows `unit.worker` and `structure.nexus`, never `w` and `N`.

### 10.2 Principles of effective ASCII art

1. **Silhouette first.** A large portrait should remain readable when mentally reduced to its outer contour.
2. **Consistent glyph direction.** `/` and `\` imply diagonals, `|` implies support or vertical energy, `-` implies horizontal force, and brackets imply enclosure. Use those associations deliberately.
3. **Negative space is material.** Empty cells describe cavities, distance, elegance, wounds, and impossible absence.
4. **Limit local palette.** Most art needs a primary color and one highlight. Extra colors should communicate material, energy, damage, or authority rather than compensate for weak form.
5. **Reserve visual weight.** Background blocks, inverse cells, bold text, and full-screen changes are expensive signals. The Nexus and catastrophic events should retain the right to dominate.
6. **Motion completes the drawing.** A one-cell unit can acquire weight through anticipation, directional trails, recoil, delayed debris, settle timing, and formation behavior.
7. **Meaning beats fidelity.** A portrait and battlefield glyph need to rhyme, not depict the same number of limbs.
8. **Fresh-eye testing matters.** ASCII can become obvious to its author while remaining unreadable to everyone else. Every important design requires cold recognition tests.

### 10.3 Useful precedents

- [NetHack](https://www.nethack.org/v500/Guidebook.html) demonstrates durable semantic glyph language and contextual inspection: a symbol can remain compact because the player can ask what it means.
- [Brogue](https://github.com/tmewett/BrogueCE) demonstrates how a restrained grid, lighting, color, and terrain interaction can make a minimalist symbolic world feel atmospheric rather than primitive.
- [Dwarf Fortress](https://www.bay12games.com/dwarves/) demonstrates how persistent simulation gives abstract marks social and historical meaning. Terminal Nexus should borrow the accumulation of meaning, not its interface density.
- [Cogmind](https://www.gridsagegames.com/cogmind/) is the strongest direct reference for a modern science-fiction ASCII interface. Its developer's writing on [ASCII form, shading, and limited color](https://www.gridsagegames.com/blog/2014/03/cogmind-ascii-art-making/) and [procedural particle effects](https://www.gridsagegames.com/blog/2014/03/particle-effects/) shows how animation, inspect art, dynamic scripts, and optional logs can make symbols communicate weapon identity and impact.

These references are inspiration, not a target to imitate wholesale. Terminal Nexus needs its own visual invention: two compact civilizations constructing geometry and then colliding in pulses.

### 10.4 Faction semiotics

Every faction should define:

- a primary and secondary color family;
- one accessibility-safe ownership treatment;
- characteristic line directions and enclosing shapes;
- preferred density and symmetry;
- three recurring movement or impact motifs;
- a rare signature effect;
- a Nexus treatment that combines faction grammar with universal ancient light.

Citizens should feel load-bearing and rectilinear. Ravels should feel diagonal, improvised, and slightly mistimed. Glitch should distort otherwise stable terminal conventions. Feudals should stratify symbols into protected layers and formal halos. Alder should use sparse, elongated, organic geometry and controlled displacement.

Strong glitches are reserved for Nexus authority, Glitch faction identity, Originals, commander restoration, and catastrophic destruction. Ordinary weapons require their own readable physical languages so the entire universe does not collapse into one “computer effect.”

## 11. ASCII particle effects and shader-like animation

### 11.1 Purpose

ASCII effects turn discrete simulation facts into anticipation, impact, and aftermath. They are the terminal equivalent of particles, shaders, screen flashes, trails, recoil, debris, construction materialization, healing fields, and spatial distortion.

Effects are presentation only. They subscribe to semantic cues derived from facts such as `unit.moved`, `attack.ranged`, `unit.damaged`, `building.destroyed`, `commander.restored`, or `nexus.critical`. They cannot apply damage, move an actor, select a target, spend resources, or decide victory.

### 11.2 Effect recipes

An effect recipe defines a time-bounded visual transformation using:

- semantic glyph and color roles;
- origin, target, path, radius, or affected region;
- local coordinates and clipping rules;
- normalized time from `0` to `1`;
- key phases such as anticipate, commit, impact, and settle;
- deterministic variation from a presentation-only seed;
- a named render band and local order;
- a reduced-motion representation.

During early spikes, a recipe is simply a typed TypeScript function plus timing constants. There is no need for a custom scripting language or effect interpreter.

### 11.3 Mathematical and procedural effects

Later effects may behave like small cell shaders. A function can map `(cellCoordinate, eventOrigin, presentationTime, parameters)` to an optional glyph and style. This enables:

- color interpolation outward from an impact coordinate;
- waves based on Manhattan or Euclidean distance;
- beams sampled along a line;
- seeded debris fields;
- dissolves based on a stable spatial hash;
- faction-specific interference patterns;
- a global palette change constrained to an affected region.

Effects are evaluated from absolute presentation time rather than incrementally advancing mutable particles. The frame at time `t` must remain the same whether the renderer displayed every earlier frame or skipped several under load. Frame rate changes sampling frequency, not effect behavior.

Simulation randomness and presentation randomness use separate labeled streams. Cosmetic variation must never consume or perturb a gameplay draw.

### 11.4 Render bands and composition

Prefer fixed semantic render bands over unrestricted global z-index numbers:

| Back to front | Typical content |
| --- | --- |
| `terrain` | ground, walls, water, immutable blockers |
| `territory` | build radius, neutral influence, placement previews |
| `ground-items` | resources, salvage, objectives |
| `structures` | Nexus, producers, defenses, economy |
| `units` | workers, armies, commanders |
| `projectiles` | shots, traces, moving attack cues |
| `effects` | impacts, explosions, restoration, glitches |
| `highlights` | cursor, selection, targets, paths, danger |
| `chrome` | border, status, inspection, controls, resize gate |

Each band returns sparse cells; absence means transparent. Bands composite from back to front, and the topmost defined cell replaces the complete lower cell style. Battlefield bands are clipped to the map. Definitions may choose a local ordering value inside a band but cannot reorder the global grammar.

Gameplay occupancy remains independent from presentation overlap. A projectile or explosion drawn over a worker does not own that worker's cell.

## 12. Architecture and development

### 12.1 Architectural intent

The product should be built in layers because deterministic strategy, terminal rendering, campaign authoring, balance simulation, and future modding genuinely need different authorities. The architecture should help us create the game now and leave credible extension seams later. It should not optimize Spike A for hypothetical community packages.

The governing rule is:

> **Build direct code for the current proof; extract a contract after a second real use reveals its shape.**

### 12.2 Responsibility layers

| Layer | Responsibility | Forbidden responsibility |
| --- | --- | --- |
| **Rules kernel** | ticks, state transitions, seeded randomness, occupancy, movement claims, targeting, damage, resources, legality, victory | terminal objects, literal glyphs, campaign prose, network access |
| **Content definitions** | units, structures, weapons, upgrades, commanders, factions, maps, themes, glyphs, effects | mutable match authority or renderer classes |
| **Scenario runtime** | starting state, objectives, scripted triggers, win/loss requests, unlocks, mission progress | direct mutation that bypasses the kernel |
| **Presentation** | read models, semantic cues, cell composition, effects, animation time, input affordances, accessibility | authority over simulation outcomes |
| **Application shell** | CLI, configuration, content selection, saves/replays, diagnostics, later installation and multiplayer adapters | hidden rule changes |

Two complementary flows must remain clear.

**Import direction:** shared contracts are leaves; the kernel consumes validated mechanical definitions; scenarios orchestrate the kernel; presentation consumes read models and events; the shell composes adapters.

**Runtime flow:** the shell loads content, the scenario supplies match inputs, the kernel returns state and ordered events, presentation derives cues and frames, and input returns validated plans to the scenario/kernel boundary.

Only the kernel mutates canonical match state.

### 12.3 Battle Framework

The future **Battle Framework** is the reusable game-facing abstraction that connects maps, actors, rules, content, and presentation. It is not one enormous `BattleManager` class. It is a collection of small services and serializable contracts, likely including:

- coordinate and footprint primitives;
- map bounds, terrain, and occupancy queries;
- deterministic path and range calculations;
- target scoring and legal-target queries;
- movement-intent and destination-claim resolution;
- tick scheduling and speed-tier attack batches;
- damage, destruction, salvage, and objective events;
- resource, supply, worker-slot, and production rules;
- construction placement, radius, and connectivity validation;
- scene read models and ordered domain events;
- cue generation for particles and animation;
- named render bands and cell composition;
- replay headers, canonical state serialization, and hashes.

The framework is built step by step. Spike A needs authored scene events and rendering but no combat framework. Spike B earns the first kernel contracts. Spike C earns map and placement contracts. Spike D reveals which faction and content definitions deserve extraction. After playtest feedback from those spikes, return to this section and define the production Battle Framework from evidence.

### 12.4 Determinism and replay authority

The eventual simulation invariant is:

```text
simulateTurn(
  schemaVersion,
  engineVersion,
  contentLock,
  initialState,
  bothCommittedPlans,
  resolutionTickCount,
  simulationSeed
) -> { finalState, orderedDomainEvents }
```

The kernel uses one named pseudorandom algorithm with serialized state and published test vectors. It never calls `Math.random`, reads the wall clock, relies on locale-sensitive ordering, or imports presentation code. Entity iteration and tie-breaking order are explicit. State and event hashing use one canonical serialization.

Playback consumes an already-resolved ordered event stream. Verification may re-simulate the same inputs and compare final-state and event hashes. Presentation speed, skipped frames, window resize, palette, glyph pack, and cosmetic seed cannot alter the simulation.

Spike A's authored `ReelEvent` is not the future replay schema. It records enough scene facts to drive one visual experiment. Spike B defines the first `DomainEvent` contract from actual simulation needs.

### 12.5 Content definitions and behavior hooks

Most game content should be declarative and identified by stable namespaced IDs. A faction aggregates commander, unit, building, upgrade, theme, and campaign references; it is not a subclass of the whole engine.

Prefer composable capabilities such as health, movement, attack, production, storage, supply, worker slots, build radius, restoration, and regroup anchor over a deep inheritance hierarchy.

Exceptional mechanics may later register narrow TypeScript hooks such as target scoring, damage modification, spawn response, death response, or alternate victory checks. Hooks receive a constrained read-only context and return intents, modifiers, or requested events. The kernel validates and applies them.

A narrow API is an engine-integrity boundary, not a host-security sandbox. An in-process TypeScript package is arbitrary local code and may access Node APIs unless executed in a genuinely restricted environment.

### 12.6 Runtime and terminal renderer

Terminal Nexus remains TypeScript-first. The current renderer candidate is imperative `@opentui/core` behind a semantic cell-frame boundary; React, Solid, Redux, an ECS, and dependency injection are not part of the initial rendering spike.

OpenTUI is evolving quickly, so every spike begins by pinning an exact release and verifying its official runtime matrix. As of this specification, [OpenTUI's documented Node path](https://opentui.com/docs/getting-started/runtime-support/) requires exactly Node.js 26.4.0, ESM, and `--experimental-ffi`. The package publishes platform-specific native artifacts, and each target must be tested rather than inferred from package availability.

Spike A uses one full 80×24 logical frame and one framebuffer renderable. OpenTUI stays behind a small backend boundary so the game can compare another terminal backend if installation, performance, cleanup, or packaging fails. A normal installable Node package and reliable launcher are sufficient for the spike; standalone executable packaging is later work even though OpenTUI documents a Node SEA procedure.

### 12.7 Terminal lifecycle

The application uses the alternate screen and an idempotent disposer. It restores cursor, input mode, handlers, and screen after normal exit, `q`, `SIGINT`, `SIGTERM`, setup failure, and caught render failure. No program can restore state after `SIGKILL` or a host crash; tests should not promise otherwise.

Non-TTY output fails with one readable message rather than emitting animation escapes into a pipe. Diagnostics are captured and printed after cleanup rather than written over the active terminal.

## 13. Content tools, editors, and future modding

### 13.1 Internal tools first

Terminal Nexus should build its own content through explicit definitions and fast iteration tools:

- maps as inspectable cell arrays plus metadata;
- units, structures, commanders, upgrades, and factions as validated TypeScript or data definitions;
- effects as TypeScript functions and parameter sets;
- themes and glyph packs as semantic-role mappings;
- cutscenes as ASCII tableaux, poses, timelines, and dialogue;
- missions as maps, starting state, objectives, triggers, scenes, and unlocks;
- campaigns as mission graphs and persistent progression rules.

These are useful production choices even if third-party modding never ships. They let humans and coding agents understand, generate, diff, test, and revise content without editing engine internals.

### 13.2 Battle and map editor

The project will soon need a lightweight battle editor. It should allow a human or agent to:

- create or paste an ASCII map;
- place Nexuses, structures, units, workers, resources, obstacles, and neutral zones;
- choose faction definitions and initial health/state;
- validate occupancy and placement;
- select a seed and resolution length;
- press play to run the daytime simulation;
- pause, step, accelerate, restart, or change the seed;
- inspect events, routes, targets, claims, and damage;
- export the scenario and structured game log as text files.

The earliest version may be a TUI sandbox plus plain files rather than a polished graphical editor. Its API and file format must be usable from the command line so agents can create fixtures and run simulations without mouse automation.

### 13.3 Modding direction

First-party content should eventually travel through the same stable contracts offered to community packages. Future mods may contribute:

- campaigns and missions;
- maps and scenario generators;
- factions, commanders, units, structures, and upgrades;
- local opponent policies or alternate rulesets;
- cutscenes, portraits, dialogue, and barks;
- effect recipes and animation functions;
- glyph packs, fonts recommendations, color themes, and accessibility variants;
- balance suites and challenge scenarios.

This is **modding-first architecture, not mod-loader-first development**. No public SDK, remote loader, permissions system, compatibility promise, or marketplace belongs in Spikes A–C.

When package installation exists, Git or npm may be a source, but the game should not execute a moving remote branch at launch. It resolves an immutable version or commit, installs it locally, records package IDs and hashes, and asks for explicit trust when executable TypeScript is present. A save or replay records the exact engine, ruleset, content versions, and hashes required to reproduce it.

Themes may recommend custom fonts, but the application cannot reliably change the host terminal font. Every content package retains an ASCII-safe fallback.

### 13.4 Extraction schedule

| Stage | Contract earned from concrete work |
| --- | --- |
| Spike A | semantic scene roles, cell frame, glyph/theme data, effect functions |
| Spike B | deterministic state, domain events, path/claim/attack services |
| Spike C | map and placement definitions, scenario fixture format |
| Spike D | two real faction packages and the first justified content registry |
| Spike E | mission/campaign package, cutscene data, unlock state |
| Post-gate | manifest, local discovery/install, content lock, trust model, author documentation |

## 14. Balance, telemetry, and replay analysis

### 14.1 Structured game log

Every simulated match should be reproducible and reviewable without watching it live. A structured game log eventually records:

- schema and engine version;
- content lock and map ID/hash;
- simulation seed and named RNG algorithm;
- faction and commander selections;
- initial state;
- both committed plans per Veil;
- ordered domain events per Pulse;
- state and event hashes;
- final outcome and termination reason;
- optional presentation markers, excluded from gameplay verification.

The log should be text-friendly, compact enough to attach to a bug report, and readable by both the game and an analysis agent.

### 14.2 Useful balance statistics

Initial metrics include:

- win rate by faction, commander, map, opening, and seed cohort;
- match length and number of Veil/Pulse cycles;
- resource income, spending, storage saturation, and unspent value;
- worker uptime, flee time, deaths, and replacement time;
- production attempts, successful spawns, blocked attempts, and supply stalls;
- unit survival, damage dealt/received, target categories, and regroup distance;
- building timing, lifetime, destruction value, refund, and salvage recovery;
- territory coverage, disconnected coverage, neutral-zone control, and path access;
- upgrade pick rate, offered-versus-selected rate, and conditional win rate;
- commander uptime, deaths, absence turns, and restoration impact;
- Nexus damage timing and comeback frequency.

Statistics diagnose; they do not automatically define fun or fairness. High win rate may reflect a broken faction, a misunderstood counter, a biased map, or a weak opponent policy.

### 14.3 Agent-driven simulation

The headless game should allow an agent or script to:

1. generate legal plans from a known policy;
2. run thousands of deterministic matches across seeds and maps;
3. aggregate the metrics above;
4. surface outliers and representative replay IDs;
5. compare a proposed balance change against a fixed baseline suite;
6. replay selected failures with full explanation.

The batch runner must not require a terminal, renderer, sound system, or LLM. Balance simulations use scripted, heuristic, search, or trained local policies through the same legal-plan interface available to the game.

## 15. Testing and automated playtesting

### 15.1 Test layers

- **Unit tests:** coordinate math, footprints, range, costs, cooldowns, serialization, definitions, and effect sampling.
- **Property tests:** no duplicate occupancy, no negative resources, no spawn above supply, bounded claim resolution, stable replay hashes, and legal regroup placement.
- **Scenario fixtures:** small maps designed to isolate melee claims, equal-speed damage, fleeing workers, destruction, salvage, construction connectivity, and Nexus access.
- **Snapshot tests:** structured terminal cells for representative presentation times, capability modes, treatments, and reduced motion.
- **Replay tests:** simulate, serialize, reload, replay, and compare state/event hashes.
- **Soak tests:** generated maps, many seeds, long battles, and adversarial congestion.
- **Packaging tests:** clean install, launch, non-TTY behavior, resize, interruption, and cleanup on supported targets.
- **Human playtests:** recognition, emotional impact, planning comprehension, strategic variety, and desire to play again.

### 15.2 Agent playtesting

Agents are useful at three levels:

1. **Invariant hunter:** generates pathological states and checks engine properties.
2. **Policy player:** plays through the legal planning API and exposes degenerate strategies or dominant openings.
3. **Replay critic:** reads logs and explains why a strategy won, where information was unclear, and which replay deserves human review.

An agent's explanation is evidence, not canonical truth. Every claimed engine bug must reduce to a state, plan, seed, or event fixture. Every balance claim should reference a reproducible cohort.

### 15.3 Human validation

Automated tests cannot answer whether symbols feel alive, whether a commander matters emotionally, whether a base is satisfying to arrange, or whether the player understands a reversal. Each spike defines an owner validation separate from implementation completion.

Comparison studies should vary presentation order and use several fresh viewers when selecting among aesthetic treatments. A single viewer is sufficient for an early usability smoke test but not for a confident universal style decision.

## 16. Campaign opponent AIs

Single-player opponents initially use local deterministic policies, not LLMs.

Every opponent planner receives a bounded planning view and the same legal action vocabulary used by a human plan validator:

```ts
interface OpponentPolicy {
  plan(view: PlanningView, legalActions: readonly LegalAction[]): BattlePlan;
}
```

Possible policy tiers are:

- scripted tutorial policy with authored goals;
- weighted heuristic policy with faction-specific priorities;
- limited search or rollout policy using the headless simulator;
- campaign policy that changes objectives or personality through scenario parameters.

Campaign AI may cheat only when a mission explicitly communicates the exception. Hidden plan information must not leak into an ordinary opponent policy.

The interface may later acquire an asynchronous adapter for remote or model-driven policies, but the deterministic local planner remains the baseline for tests, offline play, and campaign pacing.

## 17. Multiplayer and model-driven AI

Terminal Nexus is naturally compatible with asynchronous or live multiplayer because plans are hidden, turns are discrete, and battle resolution is deterministic. Multiplayer is nevertheless deferred until:

- replay verification is trusted;
- content locks are exact;
- plan validation is stable;
- simultaneous reveal edge cases are resolved;
- two factions produce a balanced and comprehensible match.

The same plan boundary may later support stronger local AI, hosted services, or LLM planners. A model must return a constrained legal `BattlePlan`, not mutate the world or generate free-form mechanics. Dialogue, faction voice, contextual help, and campaign texture are plausible additional model roles.

An LLM is not required for the core game, the first campaign, or multiplayer. It earns a place only if it creates strategic or narrative variety worth its latency, token cost, and reproducibility tradeoffs.

## 18. Sound

**TBD — dedicated research and design pass required.**

Sound is expected to matter disproportionately to weight, anticipation, faction identity, commander presence, and Nexus wonder. The visual event model should use stable semantic cues such as `unit.move.heavy`, `attack.ranged.light`, `building.destroyed`, `commander.restored`, and `nexus.critical` so later sound design can subscribe without changing simulation rules.

Questions for the future pass include:

- terminal-safe playback and packaging across macOS/Linux;
- latency and synchronization with presentation time;
- faction instrumentation and musical grammar;
- accessibility controls and silent mode;
- whether ambient sound violates the desired build-break context;
- how custom sound packs fit the content model.

No sound dependency belongs in the first visual spike.

## 19. Milestones and validation gates

### 19.1 Development law

Each spike answers one uncertain question with the smallest convincing artifact. A successful spike produces evidence and a handoff; it does not silently expand into the next system. The corresponding coding handoff is written only when the project is ready to begin that spike.

Implementation completion and owner validation are separate gates.

Section 0 defines the required evidence loop and report. Automated checks answer correctness, determinism, compatibility, and performance questions; owner and fresh-viewer validation answer comprehension, feel, and desire-to-replay questions. A gate may pass only when the evidence type matches the claim being made.

At the end of a spike, stop implementation long enough to record **PASS**, **REVISE**, **STOP**, or **BLOCKED**, update the execution ledger, and identify the next authorized action. Do not begin the next spike in the same coding session merely because time remains.

### 19.2 Spike 0 — toolchain preflight

**Question:** Can the selected TypeScript/Node/OpenTUI path install, launch, render, resize, clean up, and package reliably enough for a fast terminal game?

**Deliverable:** A pinned runtime and `@opentui/core` version, one minimal full-screen framebuffer example, canonical development command, installable package/launcher, and documented results on available Linux and macOS targets.

**Current runtime requirement:** exactly Node.js 26.4.0, ESM, and `--experimental-ffi`, unless the pinned OpenTUI documentation changes.

**Pass conditions:**

- renderer launches in the alternate screen;
- one 80×24 frame displays correctly;
- resize events are observed;
- normal exit, `q`, `SIGINT`, `SIGTERM`, and caught failure restore the terminal;
- non-TTY launch fails cleanly;
- install and first launch are acceptable for the target experience;
- the exact commands and known platform gaps are recorded.

**Stop condition:** If the environment cannot run the pinned native renderer, report the blocker before building the reel. Do not silently switch runtime or renderer.

### 19.3 Spike A — ASCII impact reel

**Question:** Can moving symbols produce enough anticipation, impact, clarity, and personality that watching a battle is intrinsically satisfying?

**Deliverable:** A 30–45-second non-branching, non-simulated battle reel driven by hand-authored scene facts. It includes:

- simultaneous-looking movement;
- a melee hostile-cell claim;
- a ranged volley;
- a fleeing worker;
- a structure assembling;
- a building exploding into salvage;
- a Nexus entering critical condition;
- a commander presence, influence, fall, or survival;
- pause, restart, speed, step, glyph, color, treatment, help, and clean exit controls.

The same canonical unit positions, structures, damage, construction, destruction, outcome, and beat timings appear in four commander treatments: field `@`, support general, Nexus-bound presence, and no commander. Treatments may add or remove commander glyphs, auras, and presentation cues, but cannot change the reversal or battle result.

Battle readability and commander selection are separate results. The reel passes if universal events remain legible. The commander comparison selects the most effective presentation; field `@` is the leading hypothesis, not a result the test is required to produce.

**Implementation constraints:**

- one fixed 80×24 logical frame containing a 48×18 battlefield;
- one framebuffer renderable;
- pure `snapshotAt(presentationTimeMs, treatment, capabilityMode, reducedMotion)`;
- `.` advances one 1/30-second presentation quantum while paused;
- resize freezes presentation time;
- authored `ReelEvent` scene data, not a future replay schema;
- effect recipes are direct TypeScript functions, not a DSL;
- no economy, pathfinding, combat simulation, AI, saves, campaign, or content loader.

**Automated pass conditions:**

- representative structured-cell snapshots are stable in true color, 16 color, monochrome, ASCII, Unicode, and reduced-motion modes;
- frame generation for a fixed input/time tuple is deterministic;
- resize suspension preserves presentation time;
- controls and idempotent cleanup behave correctly;
- changed-cell and frame-time diagnostics are captured;
- no required glyph has ambiguous terminal width.

**Owner validation:** Several fresh viewers can identify sides, targets, movement, construction, destruction, the major reversal, and whether a commander is present without depending on the event log. The sequence remains understandable in monochrome at 80×24.

**Kill/revise signals:** It reads as telemetry, color is required for causality, effects obscure targets, the commander monopolizes attention, or the terminal stack is too fragile for quick launch.

### 19.4 Spike B — deterministic Pulse kernel

**Question:** Can combat look simultaneous while remaining deterministic, explainable, and replayable?

**Deliverable:** A headless TypeScript kernel for movement intents, destination claims, melee hostile-cell entry, speed tiers, equal-speed simultaneous damage, worker flight, destruction, and bounded seeded recalculation.

Before implementation, its handoff must lock:

- named PRNG and test vectors;
- stable entity ordering;
- canonical serialization and hashing;
- domain-event ordering;
- recalculation progress measure and bound;
- replay input and authority.

**Pass conditions:** Replaying the same complete input produces identical state and event hashes. Property tests find no duplicate occupancy, negative health after settlement, unresolved claims, infinite recalculation, playback dependency, or simulation use of presentation randomness.

### 19.5 Spike C — night builder and battle editor

**Question:** Is arranging a compact base pleasant and understandable enough to carry most player agency?

**Deliverable:** A keyboard-first planning screen with optional mouse support, plus a fixture editor usable by humans and agents. It includes a fixed map, Nexus, existing structures, build-radius preview, connectivity, an outpost, defense, producer, cost, undo, validation, hidden enemy plan, and simultaneous reveal. Combat may be a static or recorded preview.

Before implementation, its handoff locks radius, footprints, same-plan chaining, reveal conflicts, path sealing, and refunds.

**Pass conditions:** A new player can expand toward a neutral zone, preserve a legal route, understand every invalid placement, inspect portraits and stats, revise a plan, and commit without documentation or accidental permanent placement. An agent can generate the same scenario through files/CLI and export it deterministically.

### 19.6 Spike D — Citizens versus Ravels microgame

**Question:** Do base placement, automatic production, economy, drafting, persistence, and two asymmetric doctrines create a complete match worth replaying?

**Deliverable:** Connect Spikes A–C with deliberately tiny Citizens and Ravels packages. Each side begins with one commander and contains the minimum meaningful worker producer, military production, economy, supply, defense, outpost, and upgrade pool. A scripted local opponent and several seeded maps are included.

The D handoff must choose the exact mechanics included. The full product acceptance backlog is not automatically its definition of done.

**Pass conditions:**

- at least two credible builds exist per faction;
- Ravel pressure can punish greedy Citizens without automatically deciding the match;
- Citizen fortification can stabilize without becoming an inevitable late win;
- destroyed infrastructure and persistent casualties matter without making recovery hopeless;
- a complete match normally fits 5–12 minutes;
- players can explain how their Veil decisions produced the Pulse outcome;
- at least one fresh player immediately wants to try a different plan.

### 19.7 Spike E — human campaign fragment

**Question:** Can brief ASCII fiction, teaching, and unlocks turn proven matches into a compelling single-player campaign?

**Deliverable:** A small origin fragment using the proven Citizens/Ravels content, concise briefings, ASCII cutscenes, one or two unlocks, and a relationship change. It introduces the Activation and provisional human claim without constructing the complete campaign described in Section 5.

**Pass conditions:** The player understands the opening conflict, remembers the commander and Ravel identity, knows why each unlock appeared, reaches gameplay quickly on replay, and can summarize one answered question plus one larger mystery.

### 19.8 Production milestone gate

Only after A–E succeed should the project define production milestones for:

- full Citizens and Ravels rosters;
- broader campaign authoring;
- repeatable skirmish and progression;
- Glitch, Feudals, and Alder;
- sound;
- public mod packages and compatibility;
- stronger local opponent policies;
- multiplayer or model-driven AI.

## 20. Post-gate product acceptance backlog

The following are future system proofs, not Spike A–D definitions of done:

- economy and placement visibly change income, paths, spawn patterns, and outcomes;
- fixed production is understandable and strategically controllable;
- warehouse caps, shared supply, worker replacement, and production contention create meaningful tradeoffs;
- finite deposits, worker flight, salvage, and economic destruction create pressure without unavoidable snowballing;
- connected construction coverage creates several viable base geometries;
- home anchors and regroup locations make producer placement matter;
- speed tiers, simultaneous damage, melee cell entry, and worker occupancy remain deterministic and readable;
- terrain and destructible obstacles produce map variety without systematic side bias;
- Nexus research drafts support counterplay instead of one solved order;
- commander builds compete with army, economy, research, and fortification builds;
- each faction supports multiple strategies and has at least one exploitable weakness;
- contextual inspection and help explain every public rule;
- game logs can reproduce and diagnose every reported match;
- a complete match remains inside the intended build-break rhythm.

## 21. Current decisions and open questions

### Locked now

- Title: **Terminal Nexus**.
- Product: deterministic terminal strategy; no LLM required.
- Match rhythm: 5–12 minutes.
- Planning: hidden, simultaneous, turn-based, and untimed.
- Resolution: fixed number of logical ticks with independent presentation speed.
- Stack: TypeScript and Node.js; OpenTUI is the current renderer candidate.
- Presentation: ASCII-safe and monochrome baselines with Unicode and richer color enhancements.
- Battlefield prototype: 48×18 map in an 80×24 fixed composition.
- Commander: prominent persistent frontline unit; standard glyph `@`; one-turn absence after death.
- Production: fixed-recipes from buildings, not direct unit purchasing.
- Victory: destroy the enemy Nexus.
- First integrated factions: Citizens and Ravels.
- First complete single-player direction: human/Citizen origin campaign.
- Architecture: deterministic kernel, content, scenarios, presentation, and shell remain separate.
- Modding: preserve future seams, but do not build a loader or stable SDK during early spikes.

### Open when relevant

- exact Citizens and Ravels commanders and rosters;
- radius metric, same-plan chaining, and hidden reveal collisions;
- equal-speed mutual Nexus destruction;
- exact Nexus draft timing and research modifier stacking;
- scoring and long-term skirmish progression;
- campaign cast, mission sequence, and ending structure;
- final title availability and trademark clearance;
- sound direction;
- commercial/open-source/community release model;
- multiplayer format;
- whether any LLM role proves worthwhile.

## 22. Final product statement

Terminal Nexus should feel as though a strategy game, a myth, and a terminal protocol were always the same thing.

The player draws a small civilization in blocks and punctuation. Night hides intention. Day makes every intention executable. Workers search for safety, factories turn stored labor into marching symbols, and one `@` becomes a person because the player has watched it survive.

The great ambition is not to imitate an old graphical game with fewer pixels. It is to discover what strategy feels like when every cell is simultaneously a rule, a character, a sound cue, a piece of architecture, and a sign from something impossibly old.

**Build the settlement. Commit the protocol. Watch the symbols become history.**
