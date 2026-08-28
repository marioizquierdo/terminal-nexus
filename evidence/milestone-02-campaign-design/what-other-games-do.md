# What other games do about unlocks and teaching

**Document role:** The research behind the rest of this folder
**Status:** Research notes
**Updated:** 2026-08-28
**License:** Apache-2.0

Nine games, each read for one specific thing rather than for general impressions. Everything is cited.
Where a source only supported a weaker claim than I wanted to make, the weaker claim is what is
written. Each one ends with **what I took** — a reference that changes no decision is decoration.

---

## Into the Breach — this is the important one

Subset Games built the whole game around showing every enemy attack before it happens. Their stated
goal was that "every death felt like your own fault," and enemy turn order is inspectable too, so the
player "know[s] the exact answer before you make the move" — which, as they put it, means players spend
less time working out how the game works and more time working out how to win.
([Subset Games](https://subsetgames.com/itb.html),
[Game Developer](https://www.gamedeveloper.com/game-platforms/road-to-the-igf-subset-games-i-into-the-breach-i-),
[GDC talk](https://gdcvault.com/play/1026333/-Into-the-Breach-Design))

This turned out to be the most load-bearing thing in the research, and it is not about unlocks at all.
Into the Breach's combat has the same property yours does: within a turn, the outcome is already
determined and you cannot interfere. The design consequence is the same too — the *only* thing that
makes an outcome you cannot steer feel like your own doing is that everything needed to predict it was
on screen before you committed.

**What I took:** the build phase has to telegraph the Pulse. Where the enemy comes from, roughly when,
and what every option actually does. Not a nicety layered on later — it is the thing that makes the
premise fair. This is written up in
[`what-a-mission-looks-like.md`](what-a-mission-looks-like.md) Section 2.

**What I refused, separately:** their unlock economy. Squads are bought with achievement coins — one
coin per achievement, three to six coins per squad, thirty for all seven
([wiki](https://intothebreach.fandom.com/wiki/Squads),
[GameFAQs](https://gamefaqs.gamespot.com/pc/205477-into-the-breach/faqs/76363/achievements)). That is
three systems to deliver one grant. A six-mission campaign needs none of them.

---

## Advance Wars — one named lesson per mission

The original's tutorial is a sequence of battles, each teaching one named topic: movement and attacking,
defensive terrain, capturing bases, joining damaged units, air units, then weather and commander
powers ([wiki](https://advancewars.fandom.com/wiki/Field_Training),
[playthrough archive](https://lparchive.org/Advance-Wars/Update%2003/)).

Two details matter more than the list. The lesson is the mission's *title* — somebody committed to one
idea per level in the naming, which is a discipline rather than a label. And the commander-power layer
arrives **last**, after the units and the ground are understood.

**What I took:** both. The one-new-idea-per-mission rule is this structure made explicit. And it is why
your commander can be standing on the map in mission one while the mechanic that makes commanders
special — dying and coming back — is not taught until mission three. Having the piece on the board is
not the same as teaching the rule, and Advance Wars separates those by four missions.

---

## Fire Emblem — the lesson and the character are the same beat

In *The Blazing Blade*, chapter one teaches the weapon triangle using a pair of knights, and chapter
four teaches recruitment through a mercenary character; each chapter builds on the last while focusing
on one new element ([Nintendo Life](https://www.nintendolife.com/reviews/gba/fire-emblem)). Later games
in the series add optional side chapters with self-contained stories and their own rewards
([wiki](https://fireemblem.fandom.com/wiki/Gaiden_chapter)).

**What I took:** teach mechanics *through people*. The strongest way to introduce your commander is not
a portrait and a paragraph — it is a mission where the thing she does is the thing the mission is
teaching.

**What I refused:** optional side chapters. They are a second authoring surface, a branch in the
progression, and a lesson the campaign cannot rely on the player having learned.

---

## StarCraft II — the unlock is a unit, permanent, and immediately usable

New units are acquired during missions and usable in every mission afterwards, and being able to
produce a particular unit "can dramatically alter the challenge of a given mission"
([wiki](https://starcraft.fandom.com/wiki/StarCraft_II:_Wings_of_Liberty),
[Liquipedia](https://liquipedia.net/starcraft2/Campaign)).

**What I took:** this is the model, nearly unmodified. An unlock is a concrete thing, granted for
finishing, permanent, and visible in the build menu next time. No currency, no shop, no tiers, no
rarity. It is also the model that makes an unlock *feel* like something, because the next mission is
measurably different with it.

Worth noting the scale it was designed for: that campaign runs 29 missions across seven subplots. The
"new unit per mission" pattern was built to carry something five times longer than your opening arc,
which is a good reason to take the mechanism and not the quantity.

---

## Slay the Spire — the warning

Cards and relics unlock progressively and are added to the **pool of things that might appear**, not to
your starting deck. The stated reason is to avoid overwhelming new players
([1](https://www.lagofast.com/en/blog/slay-the-spire-2-unlocks/),
[2](https://gamerblurb.com/articles/slay-the-spire-2-progression-guide)).

The useful half is the criticism. Players report that unlocking more cards "can make your runs more
difficult... often times making it mean that consistent decks become harder to build," and speedrunners
deliberately reset their accounts because a smaller pool makes the cards they want more likely to show
up ([Steam discussion](https://steamcommunity.com/app/646570/discussions/2/1696043263503477251/)).

**What I took, as a warning:** an unlock that dilutes a random pool is not unambiguously a reward. Your
upgrade choice is two or three options wide, where dilution hits far harder than in a game with
hundreds of cards. So unlocks go into the **build menu** — a list the player reads and chooses from —
and never into a random pool. Where the choice does widen, it widens by a specific named option at a
specific mission.

---

## FTL — earned by doing a particular thing, and chained

Most ships are unlocked by completing a specific event, and the variants chain: two of three
achievements on one layout unlocks the next, and the third layout is unreachable without the second
([wiki](https://ftl.fandom.com/wiki/Ship_Achievements),
[guide](https://steamcommunity.com/sharedfiles/filedetails/?id=121591275)).

**What I took:** the chain. "This needs that first" is how a game keeps the number of simultaneously
new things bounded without a tech tree — and a linear campaign already is one, for free.

**What I refused:** the discovery model. FTL's unlocks depend on a random event turning up, which is
right for a roguelike and wrong for a campaign whose next mission has to be able to assume what the
player has.

---

## Teamfight Tactics — three options, at fixed moments

Augments are offered at three specific, known points in a game, three choices each, one pick, with a
limited number of rerolls; the options are drawn from the same power tier so the choice is about
direction rather than spotting the obviously better one
([wiki](https://wiki.leagueoflegends.com/en-us/TFT:Augment),
[ProGameGuides](https://progameguides.com/teamfight-tactics/what-stages-do-you-get-augments-in-tft/)).

**What I took:** fixed moments, so the player can plan toward them; and comparable options, so the two
choices in your first mission should both be winning picks — the lesson there is "there is a pick," not
"pick correctly."

**What I refused:** rerolls, for the Citizens. Cheap redraws are already meant to be a Ravel trait, and
handing them to the Citizens spends a faction's signature on a convenience.

---

## Cogmind — legibility is a decision-making property

Grid Sage Games' own framing: ASCII "embodies the ideal roguelike interface: a simple easily readable
representation designed to facilitate decision-making," and readability of a *map* is a different
property from readability of *text* — a map font needs to produce "tactically readable" maps. Improving
readability was the single most requested change after their alpha launched
([1](https://www.gridsagegames.com/blog/2015/02/ascii-vs-tiles/),
[2](https://www.gridsagegames.com/blog/2015/07/readable-text-fonts-roguelikes/)).

**What I took:** an unlock's announcement can be terse text, but the unlocked thing has to be
recognisable at a glance on a moving screen. Which is also an argument for the one-per-mission limit:
one new silhouette per mission is roughly the rate a game made of symbols can actually teach.

---

## Dwarf Fortress — the counter-example

The standing reminder of how far symbol-only communication can be pushed and what it costs in reach:
when it finally shipped commercially it came with a graphical tileset and a tutorial, for an audience
the ASCII-only version had never reached, while the simulation underneath was unchanged.

I am citing this from general knowledge rather than a source I read for this pass, so treat it as the
weakest entry here. The design lesson stands on its own anyway, and it matches a rule the project
already has about visual effects never hiding the thing they are drawn over:

**What I took:** a symbol on the map may never be the *only* place a lesson lives. Whatever a mission
teaches must be readable in at least two channels — the map, and one of {a line of system text, a piece
of unit dialogue, the build menu's own description}. One authored line per lesson, and it is the
cheapest insurance the campaign can buy.

---

## What they agree on

Four claims, and they are what everything else in this folder leans on:

1. **The moment of decision has to be fully informed.** In a game you cannot steer once it starts, this
   is not polish.
2. **One new idea per level, and name it.** The discipline is in committing to the name.
3. **An unlock should be concrete, certain, and immediately usable** — not a currency, not a random
   pool addition, not something you might discover.
4. **Legibility is a budget on mechanics, not on art.** How many new things a mission can introduce is
   limited by how many symbols a player can learn, which is a much smaller number than how many the
   content system can express.

## What none of them answer

Nothing here tells you how to teach **base building for a fight you are locked out of**. Advance Wars,
Fire Emblem and Into the Breach are turn-based and directly controlled. StarCraft is real-time and
directly controlled. The only true autobattler in the list has no base at all — its preparation is
shopping and positioning. The intersection your game sits in — *build a base, then watch* — has no good
precedent here, which is why that curriculum in
[`unlocking-and-teaching.md`](unlocking-and-teaching.md) Section 3.2 is reasoned from scratch rather
than borrowed from anyone.

## Sources

- [Subset Games — Into the Breach](https://subsetgames.com/itb.html)
- [Game Developer — Road to the IGF: Subset Games' Into the Breach](https://www.gamedeveloper.com/game-platforms/road-to-the-igf-subset-games-i-into-the-breach-i-)
- [GDC Vault — 'Into the Breach' Design Postmortem](https://gdcvault.com/play/1026333/-Into-the-Breach-Design)
- [Into the Breach Wiki — Squads](https://intothebreach.fandom.com/wiki/Squads)
- [GameFAQs — Into the Breach achievements](https://gamefaqs.gamespot.com/pc/205477-into-the-breach/faqs/76363/achievements)
- [Advance Wars Wiki — Field Training](https://advancewars.fandom.com/wiki/Field_Training)
- [LP Archive — Advance Wars Field Training](https://lparchive.org/Advance-Wars/Update%2003/)
- [Nintendo Life — Fire Emblem: The Blazing Blade](https://www.nintendolife.com/reviews/gba/fire-emblem)
- [Fire Emblem Wiki — side chapters](https://fireemblem.fandom.com/wiki/Gaiden_chapter)
- [StarCraft Wiki — Wings of Liberty](https://starcraft.fandom.com/wiki/StarCraft_II:_Wings_of_Liberty)
- [Liquipedia — StarCraft II campaign](https://liquipedia.net/starcraft2/Campaign)
- [LagoFast — Slay the Spire 2 unlocks](https://www.lagofast.com/en/blog/slay-the-spire-2-unlocks/)
- [GamerBlurb — Slay the Spire 2 progression](https://gamerblurb.com/articles/slay-the-spire-2-progression-guide)
- [Steam — Slay the Spire meta progression discussion](https://steamcommunity.com/app/646570/discussions/2/1696043263503477251/)
- [FTL Wiki — ship achievements](https://ftl.fandom.com/wiki/Ship_Achievements)
- [Steam — FTL ship and layout unlocking guide](https://steamcommunity.com/sharedfiles/filedetails/?id=121591275)
- [League of Legends Wiki — TFT augments](https://wiki.leagueoflegends.com/en-us/TFT:Augment)
- [ProGameGuides — TFT augment stages](https://progameguides.com/teamfight-tactics/what-stages-do-you-get-augments-in-tft/)
- [Grid Sage Games — ASCII vs. Tiles](https://www.gridsagegames.com/blog/2015/02/ascii-vs-tiles/)
- [Grid Sage Games — Readable text fonts for roguelikes](https://www.gridsagegames.com/blog/2015/07/readable-text-fonts-roguelikes/)
