# Terminal Nexus — game modes

**Document role:** Vocabulary and structure for the single-player modes — Campaign and Challenge — and the seam every later mode shares
**Status:** Canonical direction; structure is GUIDANCE until a milestone earns it
**Canon version:** 2.15
**Updated:** 2026-09-10
**License:** Apache-2.0 for structure and schemas; mode names and any fiction they carry are CC BY-SA 4.0

## 1. Why this document exists

**Owner direction, canon 2.11.** Mario, redirecting Milestone 2: "we should keep this milestone as
strictly design and orientation, but not strictly trying to define how campaigns work... An idea I
had recently that may be even better than the intended story-driven campaigns, is implementing
'runs', where each battle ends on a new draft upgrade or removals that further polish the build for
the next battle... This doesn't replace the basic campaigns, that work as cool tutorials and
world-building canon, but it helps remove pressure for what the campaign should offer or what the
duration should be. It helps it define more as 'first-time player experience'. I believe we should
be thinking about 'campaign' (tutorial) and 'challenge' (run) modes simultaneously."

This document gives those modes names, a shared vocabulary, and a structure precise enough that the
milestones building the game's experience and UX can build against it — without first deciding how
long a campaign is, what every mission teaches, or what a run's exact numbers are. Those are
decisions for playtesting once the UX exists, and the point of writing this down now is to make sure
nothing built before then forecloses either mode.

The one architectural claim here is small and load-bearing: **a mode is data over one match loop and
one army shape.** The match loop is [`engine.md`](engine.md) Section 5 (Build Phase, Nexus Pulse,
repeat, until a result). The army shape is [`commander-armies.md`](commander-armies.md) Section 2.1
(a deck drawn from a faction's pool). A mode decides which matches are played, in what order,
against whom, and what happens to the army between them. Nothing below the mode — the kernel, the
Pulse, the Build Phase screen, the renderer — knows which mode it is serving.

## 2. Vocabulary — RULE for the names, so every document and screen uses the same ones

| Term | Means |
| --- | --- |
| **Match** | One Grid, one or more Build Phase / Nexus Pulse cycles, one result. The unit of play; 5–12 minutes ([`terminal-nexus-concept.md`](terminal-nexus-concept.md)). Nothing above a match is visible to the kernel |
| **Battle** | A match played inside a mode. "Battle" is the player-facing word; "match" is the engine's |
| **Mission** | A battle with authored triggers, text, and a teaching goal — the Campaign's unit ([`campaigns.md`](campaigns.md) Section 2.1) |
| **Run** | An ordered series of battles in which the army changes between them — the Challenge mode's unit. One attempt, start to finish, win or lose |
| **Act** | A segment of a run ending in a harder, named battle. A run is a small number of acts |
| **Card** | Any content item an army can hold or be offered: a structure, a Nexus power, an upgrade, a Commander variant. The deck metaphor of `commander-armies.md` 2.1, generalised. A unit is not a card — units come from the structures that produce them |
| **Pool / Deck** | The faction's whole catalogue / the army's chosen subset (`commander-armies.md` 2.1) |
| **Draft** | Choosing from an offered hand. **The Nexus draft** happens inside a match, at each Build Phase, from the army's Nexus power pool. **The run draft** happens between battles, from the faction pool, and changes the army |
| **Rarity** | How often a card is offered when a draft is dealt: `common`, `uncommon`, `rare` |
| **Tier** | The earliest depth at which a card may be offered: `1`, `2`, `3`. Tier gates *when*; rarity weights *how often* |
| **Unlock** | A card added to the player's available pool, granted by the Campaign; what the unlock record of Q31 stores |
| **Seed** | A run is deterministic from its seed: the same seed deals the same offers and the same opponents in the same order, exactly as a match is deterministic from its seed |
| **Opponent policy** | What plays the other side of a battle: a trigger list (a scripted mission), or a local heuristic policy driving a Commander Army ([`campaigns.md`](campaigns.md) Section 6) |

Rarity and tier are **two axes on purpose**: a tier-1 rare is a strong early card that is seldom
offered; a tier-3 common is an ordinary late card. Collapsing them into one "quality" number is the
mistake this vocabulary exists to prevent, because both modes need both axes — a Campaign mission
unlocks by tier, a run deals by rarity.

## 3. The modes

Four are named so the seams stay visible; two are designed here. The other two are deliberately
sketches.

### 3.1 Campaign — the first-time player experience and the world's canon — GUIDANCE

The Campaign is the game's **on-ramp and its lore**: a short, linear sequence of authored missions
that teaches the match loop one mechanic at a time and tells the story `campaigns.md` already
carries (the Operator belief ramp, Section 4.1 there). It is judged on two things only: **does a new
player come out of it able to play a run, and does the world feel real.** It carries no burden of
length, breadth, or replay value — that burden moved to Challenge, which is the reason this section
can be short.

Mechanically, the Campaign is the mode that **grows the player's pool**. Each mission introduces a
few cards and unlocks them; by the end, the player's available pool is the faction's tier-1 and
tier-2 catalogue, and they have drafted from it at least once. The Campaign's last mission is a
small, guided run in all but name — which is what makes the handoff to Challenge invisible.

Missions are trigger lists (`campaigns.md` Section 2.1). Everything about their authored content —
text, cast, cutscenes, the scripted opponent — stays in `campaigns.md`; this document only says
what the mode *is for*. Three things about its shape belong here, because Challenge depends on them
(`campaigns.md` Section 4.3, [`commander-armies.md`](commander-armies.md) Section 4.6, Q43 answered):

- **The Campaign starts with one Commander (Vasse), no choice screen.** Completing her mission 1
  unlocks two more campaign rows — Averno (near-identical Citizen build) and Dob Hunter (Ravel) —
  each its own opening on the same maps. A second opening is content, not a second campaign, and
  neither is shown before the player has played the first.
- **Progress is per save slot**, each slot naming its Commander, and a player may start another
  campaign at any time without losing one in progress.
- **Every mission has a main goal and usually a bonus goal** ([`campaigns.md`](campaigns.md) Section
  2.2 has the objective shape), and the bonus goal is what **unlocks content for Challenge** — a
  Commander, a card, a starting variant. That is the coupling between the two modes: the Campaign is
  where a run's options are earned, and neither mode owns the other.

### 3.2 Challenge — runs — GUIDANCE, the numbers explicitly so

A **run** is the replayable mode: a seeded series of battles, each followed by a **run draft** that
changes the army — add a card, remove a card, or upgrade one — so that the build is polished, and
narrowed, battle by battle, and the last battle is fought with an army that did not exist at the
first. The structure is the one that has proven itself across a decade of roguelike deckbuilders and
autobattlers (Section 5), taken at the size Terminal Nexus's 5–12-minute match affords.

**Shape (the starting guess, retuned on evidence by Milestone 11):**

| Element | Starting value | Why this and not another |
| --- | --- | --- |
| Battles per run | **6–9**, in **2–3 acts** | A match is 5–12 minutes; a run under an hour is one sitting, and a run over two is a different product. Three acts of three is the roguelike-deckbuilder default; two acts of three is the fallback if battles run long |
| Starting army | **pick an unlocked Commander at run start**; the deck begins as that Commander's starting package (Q46) | Campaign unlocks matter to Challenge without Challenge waiting on them, and "which Commander do I run today" is most of a run mode's replay value. Drafting the army itself before battle one is the same shape with one more step, kept possible and not built |
| Between battles | **one run draft**: add one of three offered cards, **or** remove one card, **or** upgrade one card (structures already carry levels 1–3, `engine.md` 5.2) | Add/remove/upgrade is the minimum set every reference game converged on. Removal matters as much as adding: a deck that only grows dilutes its own plan |
| Offer dealing | three cards, weighted by **rarity**, gated by **tier** against the battle index; a **pity offset** raises the rare chance each time no rare is offered and resets when one is | Slay the Spire's mechanism, verbatim in spirit: fair variance without a dead run |
| Tier schedule | tier *t* becomes available at battle **2t − 1**: tier 1 from battle 1, tier 2 from battle 3, tier 3 from battle 5 | Super Auto Pets' schedule, which makes the run's early third about fundamentals and its last third about combinations |
| Opponents | **another Commander Army with a heuristic policy**, escalating by act; each act ends in a **named Commander** as its boss | Reuses the army shape and the opponent tiers `campaigns.md` Section 6 already names. A boss is a deck with a signature, not a stat multiplier |
| Between runs | **unlocks into the pool** only; no permanent stat buffs (Q41) | Into the Breach and Hades both persist *options* across runs; persisting *power* would break "understand why the battle unfolded" (`terminal-nexus-concept.md`) |
| Within a run | **the deck and the Commander persist; the Grid, structures, and units do not** (Q40) | Each battle starts from a fresh Grid with the army's starting package. The alternative — veterans carrying over — is registered as the observable experiment it is, not assumed |
| Seed | shown, shareable, replayable | A run is a match's determinism at the next scale up: same seed, same run — the daily-run and "try my seed" modes fall out for free |
| Failure | a lost battle ends the run; the summary shows the deck, the seed, and every draft taken | Reading a lost run is how the mode teaches; the summary is the mode's report |

**Design consequences a session should hold onto:**

- **The run draft is the Nexus draft's sibling, not its replacement.** Inside a battle, the Nexus
  still deals a hand from the army's power pool at every Build Phase. Between battles, the run draft
  changes what that pool — and the structure list — contains. One dealing mechanism, two scales.
- **Removal is a first-class offer.** Every run draft screen offers removal alongside adding, at the
  same cost of "this is your one choice." A build that cannot shed its early common structures cannot
  become a build.
- **Bosses are named armies.** The Commander proposals in `commander-armies.md` Section 4.4 are the
  boss roster in waiting: a Ravel act ends in Speaker Corvane or Old Marrow, and a player learns to
  read a Commander's doctrine from what the deck does — the alignment test of
  `terminal-nexus-lore.md` 8.6, applied to opponents.
- **Runs need no writing.** That is the whole reason this mode can be built early. Text in a run is
  the interface's own voice (`terminal-nexus-lore.md` Section 10.2) and Commander barks — nothing
  authored per run.

### 3.3 Skirmish — one battle, any legal army, any opponent — sketch

One match against a local policy, with every legal Commander Army exposed without campaign completion
(`commander-armies.md` Section 6). Cheap the moment a run exists — it is a run of length one — and
useful long before then as the fixture every UX milestone actually plays. Not designed further here.

### 3.4 Multiplayer — later, and more intuitive once the rest exists — sketch

Hidden simultaneous plans and deterministic resolution already fit asynchronous and live play
([`project-governance.md`](project-governance.md) Section 10). Mario: "Multi-player seems more
intuitive and I believe we can come out with it later." Nothing here is designed; the seam it needs is
that a match takes two committed plans from anywhere, which the kernel already does.

## 4. Designing content for both fronts — GUIDANCE

Every card carries three tags from the day it is authored, and the authoring template in
`commander-armies.md` Section 5 asks for them:

```ts
interface CardTags {
  readonly rarity: "common" | "uncommon" | "rare"
  readonly tier: 1 | 2 | 3
  readonly role: readonly string[]   // economy, producer, defence, tempo, control, ... — for draft variety
}
```

Three rules of thumb, borrowed from where they were proven:

1. **Commons must be enough to win with.** A run dealt only commons should be winnable at base
   difficulty. Commons are the fundamentals; uncommons help you win; rares *just win* (Rosewater's
   rarity doctrine, Section 5). If a rare is required, the balance is wrong, not the rarity.
2. **Complexity lives at uncommon and rare.** A common does one readable thing. A card that needs
   a paragraph is not common, whatever its power.
3. **Every card has a role tag, and the dealer reads it.** Three offers of the same role is a dead
   draft; the dealer prefers variety across roles before it weighs rarity. This is cheap to build and
   the single largest quality-of-run lever a small catalogue has.

Balance in both modes is **measured, then judged**: pick rate and win rate per card, per tier, per
act, from runs played by the driver ([`engine.md`](engine.md) Section 9.7) as much as by people —
the metrics-driven loop Slay the Spire's team described, with the same warning they gave: metrics
diagnose, they do not define fun (`project-governance.md` Section 9 already says so).

## 5. References

Cited by name in Sections 3–4; a session needs these only to go deeper than the mechanism already
named there, never to re-derive it. A few (marked †) could not be opened directly from this session's
network and rest on search extracts rather than a full read.

| Source | Cited for |
| --- | --- |
| **Slay the Spire** — Giovannetti, *Metrics Driven Design and Balance*, GDC 2019 ([talk](https://www.gdcvault.com/play/1025731/-Slay-the-Spire-Metrics)); [card rewards](https://slay-the-spire.fandom.com/wiki/Card_Rewards) | pick-one-of-three-or-skip; merchant removal; the rarity pity offset; ascension as a difficulty ladder; pick-rate/win-rate balancing |
| **Super Auto Pets** ([basics](https://superautopets.wiki.gg/wiki/The_Basics)) † | tier-by-turn gating (`2t − 1`); a five-slot team |
| **Mechabellum** ([site](https://store.steampowered.com/app/669330/Mechabellum/), [review](https://monstervine.com/2025/04/mechabellum-review/)) | Survival mode as precedent for a single-player run on a build-then-watch match; per-round upgrade offers |
| **Into the Breach** — postmortem, GDC 2019 ([talk](https://www.gdcvault.com/play/1025772/-Into-the-Breach-Design)) †; [time-traveller pilot](https://www.pcgamesn.com/into-the-breach/permadeath) | "clarity over cool"; persisting one pilot and unlocked squads — options, not power — between runs |
| **Hades** — Kasavin, GDC Podcast ep. 16 ([episode](https://gdconf.com/article/roguelikes-and-narrative-design-with-hades-creative-director-greg-kasavin-gdc-podcast-ep-16/)) †; [Mirror of Night](https://hades.fandom.com/wiki/Mirror_of_Night) † | narrative delivered per run rather than in chapters; the contrast case for persisted *power*, rejected here (Q41) |
| **Teamfight Tactics** ([shop odds](https://www.metatft.com/tables/shop-odds)) | the fully quantified version of tier-gates-when / rarity-weights-how-often |
| **Mark Rosewater** — *Nuts & Bolts #4: Higher Rarities*, *Quite the Rarity* ([Wizards](https://magic.wizards.com/en/news/making-magic/nuts-bolts-higher-rarities-2012-02-27)) † | the rarity doctrine of Section 4 |
| **Roguebook** ([interview](https://www.gamedeveloper.com/design/tackling-deckbuilding-design-in-abrakam-s-roguebook)) † | second worked example of deckbuilder-meets-roguelite, beside Slay the Spire |
| **Short & Adams (eds.), *Procedural Storytelling in Game Design*** (CRC Press 2019, [publisher](https://www.routledge.com/Procedural-Storytelling-in-Game-Design/Short-Adams/p/book/9781138595309)) | how a run tells something without authored chapters |

## 6. What this document does not decide

- The exact numbers in Section 3.2's table — battles, acts, offer size, tier schedule — are starting
  values for Milestone 11 to retune on runs actually played.
- Two decisions that shape the screens rather than the numbers are still registered rather than
  assumed: **Q45** (is the draft pick mandatory, skippable, or bankable) and **Q46** (where a run's
  starting army comes from). Each carries a recommendation, and each is cheap now and expensive after
  Milestone 5. Q42 (what a Nexus power may do), Q43 (which starting Commanders ship), Q44 (mission
  length), Q47 (the mirrored-map mechanic), and Q48 (bonus-goal visibility) were answered at canon
  2.13–2.14.
- What persists between battles within a run beyond the deck and the Commander (Q40), and whether
  anything but unlocks persists between runs (Q41).
- Difficulty ladders (ascension-style), daily seeds, leaderboards, and any online feature: real
  ideas, none designed, all downstream of a run that plays end to end.
- Mod-defined modes. The claim that a mode is data over one loop and one army shape is what keeps
  them possible; nothing here builds a loader or promises a stable contract
  (`engine.md` Section 11).
