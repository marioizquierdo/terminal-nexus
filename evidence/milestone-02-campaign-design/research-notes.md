# Milestone 2 — research notes: how other games pace unlocks, teaching, and gating

**Document role:** Research input for Milestone 2's campaign-design pass — named references and what each one is worth to this project
**Status:** Research notes; nothing here is canon or authorization
**Updated:** 2026-08-27
**License:** Apache-2.0

Nine games, each read for one specific mechanism rather than for general vibes. Every claim below is
cited; where a source only supports a weaker claim than I wanted to make, the weaker claim is what is
written. Each entry ends with **Take** — what, concretely, Terminal Nexus should copy, adapt, or
refuse — because a reference that changes no decision is decoration.

---

## 1. Into the Breach — perfect information is what makes a non-interactive resolution fair

Subset Games built the game around telegraphed enemy attacks: every enemy attack is shown before it
happens, and the stated design goal was that "every death felt like your own fault." Turn order is
inspectable, so the player "know[s] the exact answer before you make the move," which lets them
"spend less time figuring out how the game works, and more time figuring out how to win."
([Subset Games](https://subsetgames.com/itb.html),
[Game Developer](https://www.gamedeveloper.com/game-platforms/road-to-the-igf-subset-games-i-into-the-breach-i-),
[GDC Vault — 'Into the Breach' Design Postmortem](https://gdcvault.com/play/1026333/-Into-the-Breach-Design))

This is the single most load-bearing reference in the pass, and it is not really about unlocks at
all. Terminal Nexus's Nexus Pulse is a **non-interactive resolution**: the player commits a plan and
then cannot steer it. Into the Breach's resolution is non-interactive in exactly the same way inside
a turn — the enemy's move is already determined and shown. The design consequence is identical: the
*only* thing that makes an un-steerable outcome feel like the player's own doing is that everything
needed to predict it was on screen before commit.

**Take.** The Build Phase must telegraph the Pulse. Concretely: the raid's arrival edge and its
arrival tick drawn on the Grid during Build Phase, and the construct/draft menus showing *effect*,
not only cost. This is not a nicety layered on later; it is the fairness precondition for the whole
autobattler premise. See `progression-system.md` Section 5.

Into the Breach's unlock economy is worth naming separately and **refusing**: squads are bought with
achievement coins, one coin per completed achievement, 3–6 coins per squad, 30 coins for all seven
([Into the Breach Wiki — Squads](https://intothebreach.fandom.com/wiki/Squads),
[GameFAQs — Achievements](https://gamefaqs.gamespot.com/pc/205477-into-the-breach/faqs/76363/achievements)).
That is three systems (achievements, a currency, a store screen) to deliver one outcome. A
six-mission linear campaign does not need any of them.

## 2. Advance Wars — one named lesson per mission, and the mission is named after the lesson

Field Training is the original's tutorial, and its structure is the cleanest existing statement of
the rule this milestone wants: Troop Orders (movement and attack), Terrain Intel (defensive terrain),
Base Capture (capturing), Unit Repair (the Join command), Copter Tactics (air units), Climate Status
(weather and CO Powers) — each a separate battle teaching one named topic
([Advance Wars Wiki — Field Training](https://advancewars.fandom.com/wiki/Field_Training),
[LP Archive — Field Training Missions 1 to 3](https://lparchive.org/Advance-Wars/Update%2003/)).

Two details matter more than the list. First, the lesson is the mission's *title* — the designer
committed to one idea per level in the naming, which is a discipline, not a label. Second, CO Powers
— the commander layer — arrive **last**, after the units and the terrain are understood.

**Take.** Both. The One Lesson Rule (`progression-system.md` Section 4) is Field Training's structure
made explicit and checkable. And the Commander-introduction pacing supports keeping Vasse's *death
and restoration cadence* at Mission 3, even though Milestone 8 builds her unit in Mission 1: having
the piece on the Grid is not the same as teaching the mechanic, and Advance Wars separates those two
by four missions.

## 3. Fire Emblem: The Blazing Blade — the lesson and the cast introduction are the same beat

Chapter 1 teaches the weapons triangle using a pair of knights; chapter 4 teaches recruitment through
a mercenary character; each successive chapter builds on prior concepts while focusing on one new
element ([Nintendo Life review](https://www.nintendolife.com/reviews/gba/fire-emblem)). Later games in
the series add gaiden/paralogue chapters — optional side chapters with contained stories, granting
items, recruitable characters, and experience
([Fire Emblem Wiki — Gaiden chapter](https://fireemblem.fandom.com/wiki/Gaiden_chapter)).

**Take, positive.** Teach mechanics *through* people. The strongest version of introducing Commander
Vasse is not a portrait and a paragraph — it is a mission where the thing she does is the thing the
mission is teaching. Applied in `story-and-cast.md` Section 3.

**Take, negative.** Refuse optional chapters. A gaiden chapter is a second authoring surface, a
branch in the progression graph, and a lesson the campaign cannot rely on the player having learned.
Six missions, no branches.

## 4. StarCraft II: Wings of Liberty — the unlock is a unit, permanent and additive

New units are acquired during missions and can then be used in any future mission, and the ability to
produce a particular unit "can dramatically alter the challenge of a given mission"
([StarCraft Wiki](https://starcraft.fandom.com/wiki/StarCraft_II:_Wings_of_Liberty),
[Liquipedia — Campaign](https://liquipedia.net/starcraft2/Campaign)). `campaigns.md` Section 3
already names the StarCraft and Warcraft campaigns as the inspiration for teaching structure, so this
is the reference the canon itself points at.

**Take.** This is the unlock model to adopt, nearly unmodified: an unlock is a **content id**, granted
on mission completion, permanent, additive, and immediately visible in the construct menu. It needs no
currency, no store, no tiers, and no rarity. It is also the model that makes an unlock *feel* like
something, because the next mission is measurably different with it.

The Wings of Liberty campaign also runs 29 missions with seven subplots — a scale reference for what
this project is explicitly **not** doing, and a useful reminder that the "new unit per mission" pattern
was designed to carry a campaign roughly five times longer than the belief ramp.

## 5. Slay the Spire — the unlock-into-a-pool trap, in its own community's words

Cards and relics unlock progressively from run XP and are added to the **pool of potential pickups**,
not to the starting deck; the stated rationale is that players are not overwhelmed by the full card
list at once
([LagoFast](https://www.lagofast.com/en/blog/slay-the-spire-2-unlocks/),
[GamerBlurb](https://gamerblurb.com/articles/slay-the-spire-2-progression-guide)).

The criticism is the useful half. Players report that unlocking cards "can make your runs more
difficult the more you unlock, often times making it mean that consistent decks become harder to
build," and speedrunners reset their game accounts specifically because a smaller pool makes the
wanted cards more likely to appear
([Steam Community — Improvements to the meta progression system](https://steamcommunity.com/app/646570/discussions/2/1696043263503477251/)).

**Take, and it is a warning.** An unlock that *dilutes a random pool* is not unambiguously a reward.
Terminal Nexus's Nexus draft is two or three options wide — dilution would hit far harder here than in
a game with hundreds of cards. So: **unlocks go to the construct menu, which is a deterministic list
the player reads, not into the draft's random pool.** Where the campaign does widen the draft, it
widens it by an authored, named option at a named mission, never by "adding to the pool."

## 6. FTL: Faster Than Light — earned by a specific act, and chained to bound breadth

Most cruisers are unlocked by completing a specific random event, and the layouts chain: unlocking two
of three achievements on an A layout grants the B layout, and the C layout is inaccessible without B
([FTL Wiki — Ship Achievements](https://ftl.fandom.com/wiki/Ship_Achievements),
[Steam Community — Ship and Layout Unlocking Guide](https://steamcommunity.com/sharedfiles/filedetails/?id=121591275)).

**Take, positive.** The chain. "C requires B" is how a game keeps the number of simultaneously-new
things bounded without a tech tree — it is a linear order expressed as a dependency, which is exactly
what a six-mission campaign already is for free.

**Take, negative.** Refuse the discovery model. FTL's unlocks depend on a random event appearing in a
run, which is right for a roguelike and wrong for a linear campaign whose next mission must be able to
*assume* what the player has. Our unlock trigger has to be deterministic: finish the mission, get the
thing.

## 7. Teamfight Tactics — three options, at fixed moments, is the settled autobattler shape

TFT offers augments at stages 2-1, 3-2 and 4-2, three choices each, one pick per armory, with limited
per-armory rerolls; each set of options is drawn at the same tier so the choices are comparable rather
than strictly ranked
([League of Legends Wiki — TFT:Augment](https://wiki.leagueoflegends.com/en-us/TFT:Augment),
[ProGameGuides](https://progameguides.com/teamfight-tactics/what-stages-do-you-get-augments-in-tft/)).

Two structural facts are worth more than the numbers: the choices are at **fixed, known moments**
(the player can plan toward them), and the options are **power-comparable** (the decision is about
direction, not about spotting the strictly better one).

**Take.** Fixed moment: one draft pick per Build Phase, always, so it is a rhythm rather than a
surprise. Power-comparable: the two options offered in Mission 1 must both be winning picks, because
the lesson there is "there is a pick," not "pick correctly." Refuse rerolls for the Citizens — the
canon already assigns cheap redraws to the Ravels' jackpot drafts as a *faction identity*
(`commander-armies.md` Section 4.1), so giving them to Citizens would spend a faction's signature on a
convenience.

## 8. Cogmind / Grid Sage Games — legibility is a decision-making property, not an aesthetic one

Grid Sage's own framing: ASCII "embodies the ideal roguelike interface: a simple easily readable
representation designed to facilitate decision-making," and readability of a *map* is a different
property from readability of *text* — a map font should produce "tactically readable" maps. Improving
readability was the single most requested change after Cogmind's alpha launch
([ASCII vs. Tiles](https://www.gridsagegames.com/blog/2015/02/ascii-vs-tiles/),
[Readable Text Fonts for Roguelikes](https://www.gridsagegames.com/blog/2015/07/readable-text-fonts-roguelikes/)).

**Take.** Two consequences for unlocks specifically. First, an unlock's *announcement* is text and can
be terse, but the unlocked thing's *presence on the Grid* has to be tactically readable at a glance —
which means an unlock that adds a glyph the player cannot distinguish mid-Pulse is not a reward, it is
noise. Second, this is an argument for the **one unlock per mission** limit: the player has one new
silhouette to learn per mission, which is roughly the rate a glyph-only game can actually teach.

## 9. Dwarf Fortress — the counter-example, and what it cost

Dwarf Fortress is the reference point for how far glyph-only communication can be pushed and what it
costs in reach: the 2022 commercial release shipped with a graphical tileset and a tutorial, changes
made for an audience the ASCII-only version had not reached, while the underlying simulation was
unchanged.

I am citing this from general knowledge rather than a source read this session, so treat it as the
weakest entry here — but the design lesson stands on its own and matches this project's own canon:
`AGENTS.md` Section 4's corruption law already says an effect "never remove[s] the only carrier of a
required semantic cue." The generalization is the teaching rule below.

**Take.** *A glyph may never be the only carrier of a lesson.* Whatever a mission teaches must be
legible in at least two channels — the Grid **and** one of {a system line, a bark, the construct
menu's own effect text}. This costs one authored line per lesson and is the cheapest insurance the
campaign can buy.

---

## What the nine references agree on

Stated as four claims, because these are what the design sections downstream actually lean on:

1. **The moment of decision must be fully informed** (Into the Breach; TFT's fixed, comparable
   options). In a game the player cannot steer mid-resolution, this is not polish.
2. **One new idea per level, named** (Advance Wars; Fire Emblem's chapter-by-chapter build-up). The
   discipline is in committing to the name, not in the idea being small.
3. **An unlock should be a concrete, deterministic, immediately-usable thing** (StarCraft II), not a
   currency (Into the Breach), not a random-pool addition (Slay the Spire), not a discovery (FTL).
4. **Legibility is a mechanic budget, not an art budget** (Cogmind; Dwarf Fortress). The number of
   new things per mission is limited by how many silhouettes a player can learn, which is a much
   lower number than how many the content system can express.

## What none of them answer

No reference here tells us how to teach **base-building for a resolution the player cannot enter**.
Advance Wars, Fire Emblem and Into the Breach are all turn-based and directly steered; StarCraft II is
real-time and directly steered; TFT is the only true autobattler in the list, and it has no base
building at all — its preparation is shopping and positioning. The intersection Terminal Nexus sits in
— *build a base, then watch* — has no strong precedent in this list, which is why
`progression-system.md` Section 6 derives that curriculum from first principles rather than from a
citation.

## Sources

- [Subset Games — Into the Breach](https://subsetgames.com/itb.html)
- [Game Developer — Road to the IGF: Subset Games' Into the Breach](https://www.gamedeveloper.com/game-platforms/road-to-the-igf-subset-games-i-into-the-breach-i-)
- [GDC Vault — 'Into the Breach' Design Postmortem](https://gdcvault.com/play/1026333/-Into-the-Breach-Design)
- [Into the Breach Wiki — Squads](https://intothebreach.fandom.com/wiki/Squads)
- [GameFAQs — Into the Breach Achievements](https://gamefaqs.gamespot.com/pc/205477-into-the-breach/faqs/76363/achievements)
- [Advance Wars Wiki — Field Training](https://advancewars.fandom.com/wiki/Field_Training)
- [LP Archive — Advance Wars, Field Training Missions 1 to 3](https://lparchive.org/Advance-Wars/Update%2003/)
- [Nintendo Life — Fire Emblem: The Blazing Blade review](https://www.nintendolife.com/reviews/gba/fire-emblem)
- [Fire Emblem Wiki — Gaiden chapter](https://fireemblem.fandom.com/wiki/Gaiden_chapter)
- [StarCraft Wiki — StarCraft II: Wings of Liberty](https://starcraft.fandom.com/wiki/StarCraft_II:_Wings_of_Liberty)
- [Liquipedia — StarCraft II Campaign](https://liquipedia.net/starcraft2/Campaign)
- [LagoFast — How to Unlock All Content in Slay the Spire 2](https://www.lagofast.com/en/blog/slay-the-spire-2-unlocks/)
- [GamerBlurb — Slay the Spire 2 Progression Guide](https://gamerblurb.com/articles/slay-the-spire-2-progression-guide)
- [Steam Community — Slay the Spire, improvements to the meta progression system](https://steamcommunity.com/app/646570/discussions/2/1696043263503477251/)
- [FTL Wiki — Ship Achievements](https://ftl.fandom.com/wiki/Ship_Achievements)
- [Steam Community — FTL: Ship and Layout Unlocking Guide](https://steamcommunity.com/sharedfiles/filedetails/?id=121591275)
- [League of Legends Wiki — TFT:Augment](https://wiki.leagueoflegends.com/en-us/TFT:Augment)
- [ProGameGuides — What stages do you get augments in TFT?](https://progameguides.com/teamfight-tactics/what-stages-do-you-get-augments-in-tft/)
- [Grid Sage Games — ASCII vs. Tiles](https://www.gridsagegames.com/blog/2015/02/ascii-vs-tiles/)
- [Grid Sage Games — Readable Text Fonts for Roguelikes](https://www.gridsagegames.com/blog/2015/07/readable-text-fonts-roguelikes/)
