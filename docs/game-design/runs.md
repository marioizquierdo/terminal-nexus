# Terminal Nexus — Challenge runs

_The whole run as a game: a route across the Grid that the player chooses a path through, an army that is drafted between battles, and a Nexus whose health has to last. What it borrows from the best roguelikes, what each layer asks of the player, and the numbers it starts with. [`game-modes.md`](game-modes.md) is the vocabulary and the place of Challenge beside the Campaign; this is the design of Challenge itself._

_Licence: structure and schemas Apache-2.0; names and fiction CC BY-SA 4.0. Unmarked statements are GUIDANCE; every number is a first guess, to be tuned on runs played._

## 1. The run in one paragraph

A run is one Commander's campaign across the Grid, from a seed. The Grid is a **route**: three acts, each a small map of stops
the player chooses a path through, ending in a named Commander. A stop is a battle, a harder battle, a place to trade, a place
to mend, or a signal that offers a bargain. A battle is a duel the game already plays (the Build Phase, the Nexus Pulse, the
Battle Round, up to six rounds against a scripted Commander Army). What a battle leaves behind is what the run is made of: the
**Nexus's health**, which does not come back for free; **requisition**, which buys cards; and a **draft** of new structures,
doctrines and Nexus powers that the army keeps. The player wins by reaching the last Commander with a Nexus still standing,
and the question each stop asks is the same: *what does this cost me, and what will I need next?*

## 2. What it borrows, and what it leaves

| From | The idea taken | How it fits Terminal Nexus |
| --- | --- | --- |
| **Slay the Spire** | A map of branching stops the player routes through; battle, elite, shop, rest and event stops; a draft of three after each fight; removal as a choice; health that carries from fight to fight | The route is the dynamic environment the player navigates. The Nexus's health is the run's health. Removal is real because a Nexus power pool is a pool the Pulse deals from, and a smaller pool deals the cards you want |
| **FTL** | Every choice spends a scarce thing; the map shows what each stop is before you go; a clock pushes you on | The route is shown whole, and a stop's opponent is shown one step ahead. The pressure is the Nexus's health, not a timer: a hard path pays well and costs health you cannot buy back cheaply |
| **Into the Breach** | The enemy's plan is shown before you commit, so a loss is always a lesson and never a surprise ("clarity over cool") | A stop says how its Commander plays (rushes, digs in, holds then attacks) before you enter, so the army you bring is an answer, not a guess. The report of a lost battle says what the enemy did |
| **Hades** | The reward of a door is shown on the door | A battle stop shows its reward kind (a draft, a rare draft, requisition) before you choose it |
| **Balatro, Super Auto Pets** | A shop whose prices climb, a currency worth saving, a tier schedule so an early run is about basics and a late run about combinations | The Exchange, requisition, and the tier schedule the game-modes design names (tier *t* from battle 2*t* − 1) |
| **Mechabellum** | A single-player run on a build-then-watch match | Proof the match this game already plays can carry a run |
| **Left out on purpose** | Permanent power between runs (Hades' mirror), a second battle-time resource, random numbers hidden from the player | Persisting *options* between runs is the design (unlocks); persisting *power* would break "understand why the battle unfolded" |

## 3. Three layers, and what each asks

| Layer | The player decides | Lasts | Built from |
| --- | --- | --- | --- |
| **The route** | Which stop next; whether to take a hard path for a rich reward; when to mend and when to spend | The run | This document |
| **The army** | Which card to take, which to refuse, which to remove; what to buy | The run | The Commander Army (`commander-armies.md`), the draft |
| **The battle** | Where to build, what to build, which Nexus power to keep, what to buy for a building | One duel of up to six rounds | The Build Phase, the Nexus Pulse and the Battle Round, unchanged |

**RULE: nothing below the run knows it is serving a run.** A battle is a duel; its army is a Commander Army with some powers
already kept and some cards left out; its Nexus may start hurt. Those three are all a run hands a battle, and each is data
the Build Phase and the duel already take (§7).

## 4. The route

**Shape.** A run is **three acts**. An act is **three steps** of two or three stops each, then its **boss**. From a stop the
player moves to a stop of the next step in the same lane or one lane over, so every step is a real choice but no path is
forced. A path through an act passes **four stops**: about two or three battles and a boss, with a place to mend or trade
between. A whole run is **ten battles and nine other stops**, an hour or a little more. A **short run** is one act (a quarter
hour to half an hour) and is what a first test plays.

**Stops.**

| Stop | What happens | Reward | Where it may be |
| --- | --- | --- | --- |
| **Skirmish** | A battle against the act's Commander | A draft of three, and requisition | Any step |
| **Stronghold** | A harder battle: the enemy starts with a card kept and more credits | A draft with a guaranteed uncommon or better, and more requisition | Steps two and three; never two in one step |
| **Exchange** | Spend requisition: three cards for sale, remove a card, mend the Nexus | What you buy | Steps two and three |
| **Workshop** | Mend the Nexus by a good part, **or** refit: take one card from a draft of three | Health or a card | Step three always has one; step two may |
| **Signal** | A bargain offered in the Grid's own voice: take something, pay something. Three templates to begin with (§8) | Either, or neither | Step two |
| **Boss** | A named Commander's army, with its signature cards kept | A rare draft, and half the Nexus's health mended | The end of each act |

The first step of an act is always Skirmishes: the act opens with a fight against the weakest of its Commander's plans. The
last step always offers a Workshop or an Exchange, so a player who planned for the boss can arrive ready.

**Seeing the route.** The whole act is drawn as soon as it opens, every stop by its kind. A battle stop shows its **intel** when
the player stands one step away: the Commander, how the army plays, and what it starts with. A farther stop shows only its
kind. Reading the intel and choosing the stop is the navigation the mode is for. A Nexus power of the `information` role
(there are some on the list of roles) widens the horizon; that comes with the cards, not now.

**The map is a function of the seed** (RULE): the same seed draws the same route, every stop's kind and intel and every offer
at every stop, whatever path the player takes. A stop's offers come from a stream of its own, derived from the seed and the
stop, so choosing a different path never moves what a stop would have offered. Two players on one seed see one run.

## 5. What carries from battle to battle

| Carries | Does not |
| --- | --- |
| The **army**: the structures, doctrines and Nexus powers owned | The Grid, the buildings, the units and the credits of the last battle |
| The **Nexus's health** at the end of the battle | The Commander's health: she is back as every battle opens |
| **Requisition**, the run's currency | Credits (the one resource inside a battle, which resets: the round curve's, as in every mode) |

The Nexus's health is the run's attrition. A battle won in round three with the Nexus untouched costs nothing; a battle won
with the Nexus at a quarter is won and costly. A Nexus that falls ends the run, as the rule has always been ("a lost battle
ends the run"). Inside a battle the Nexus still mends a little each round, so the carried number is where it starts and
never where it must end. **It mends between battles only at a Workshop, an Exchange, a Signal that offers it, and after a
boss.** Requisition is a second currency, but never a second *battle* resource: it does not appear in a battle, only on the route.

## 6. The army

A run begins with a **small** army, so that everything drafted changes what the player can do. For Vasse (the first Commander
played): the structures Barracks, Supply Depot and Turret; the Nexus powers Reserve Callup and Drill Schedule in the pool; no
doctrines. Averno and Dob start from their own equivalents.

**Three families of card**, each a different kind of decision:

| Family | What it is | Why it is a choice |
| --- | --- | --- |
| **Structure** | A building added to the build menu: Hatchery, Garrison, Battery | It broadens options and costs the player's credits each battle; a weak structure is a distraction at a menu that fills |
| **Doctrine** | A standing order: an effect kept from the first round of every battle, with nothing to pick (heavier rounds in every Turret, a trooper more in each Barracks wave). A Doctrine is a power already kept: the effects table (`src/armies/effects.ts`) is what it runs on | The strongest family, so the rarest; it fixes the player's plan in place |
| **Nexus power** | A card added to the pool the Pulse deals from each round | It adds variety to the hand and **dilutes** it: more cards means less of any one. Taking one is a bet on the late battle; removing one is how a hand is focused |

**The draft** (after a won battle, free): three cards, **or** remove one card the army holds, **or** take **15 requisition**
instead. The three are dealt by the dealer the game-modes design describes: rarity weights, the tier schedule against the
battle's place in the run, the pity offset after battles without a rare, and a family or role the offer lacks before rarity.
A card already owned is not offered; a pool with fewer than three cards left offers fewer; the draft is never empty, because
removal and requisition always stand.

**Every card carries `rarity`, `tier` and `role`** (`game-modes.md`), and a Doctrine and a Structure card are authored in an
army file beside the Nexus powers. **Commons must be enough to win**: a run that only ever takes commons is winnable at the
base difficulty, and the milestone checks it with a driver-played run.

**Content is thin, on purpose and for now.** The Citizens' pool today holds three more structures, three Nexus powers and no
Doctrine, so a short run drafts nearly all of it. The first Doctrines are written from effects that exist; the real rosters
are the content milestone's work. The pull request says the run plays on bench content so nobody takes it for a judgement of
balance.

## 7. The opponents

Every enemy is a Commander Army planned by a scripted duel player (`src/duel/players.ts`) under the Build Phase's own rules.
A run varies an enemy by four dials, all of which exist:

| Dial | What it changes |
| --- | --- |
| **Commander** | Whose army: act one Dob Hunter (Ravel), act two Averno (a Citizen with a Ravel card), act three whichever of the three the player is not, or the player's own Commander as a mirror when none is left |
| **Plan** | The scripted player: `rush`, `balanced`, `turtle`, then with upgrades bought, with area damage, tight or spread in formation. Later acts mix plans |
| **Kit** | Nexus powers already kept as the battle opens: none in act one, one in act two, two in act three; a Stronghold adds one, a boss its signature cards |
| **Credits** | More to spend each round: a Stronghold and a boss start ahead |

**Bosses are armies with a signature, not a stat multiplier.** A boss is a Commander whose own cards are kept from round one
and whose plan is the one that exercises them: Dob with loaded dice and his runners exploding harder; Averno charging with his
aura. A player who has read the intel brings the answer.

## 8. Rewards, prices, signals — starting values

| Thing | Starting value |
| --- | --- |
| Requisition for a won battle | Skirmish 20, Stronghold 35, boss 50; **plus 10** when the Nexus was never hit, **plus 5** for each round the battle did not need (of six) |
| A card at the Exchange | Common 25, uncommon 40, rare 65 |
| Remove a card | 20 at the Exchange, **plus 10** each time within a run; free as a draft's choice |
| Mend a quarter of the Nexus | 30 at the Exchange |
| A Workshop | Mends two fifths of the Nexus, or a draft of three |
| After a boss | Half the Nexus mended, and a rare draft |
| Take requisition instead of a draft | 15 |
| Nexus health at the start of a run | Full |

**Signals** are three templates, written once, filled from the seed: *a convoy* (take 40 requisition; the next battle's enemy
starts with a card kept), *a wreck* (lose a quarter of the Nexus's health; take a card of a rarity above the act's), and
*a deal* (remove a card for free; the next draft is one card smaller). The words are the interface's own voice
(`lore.md`); no signal needs an author.

## 9. How a run ends and what it leaves

A run ends when a Nexus falls or the last boss does. Its **summary** is the mode's report: the Commander and seed, the route
taken with every stop's outcome, every draft taken and every card refused, the Nexus's health as each battle opened and
closed, and the report of the battle that was lost — how the enemy played and what it killed. **A lost run reads like a
lesson**, not a score. The summary offers a new run on the seed this one names, so a chain of runs replays from its first
seed.

## 10. What is not decided

- Run length, requisition, and the Nexus's health carrying are the owner's to confirm; the design proceeds under the
  recommendations in the register of open questions.
- Unlocks between runs, difficulty ladders, daily seeds and leaderboards (`game-modes.md`, out of scope).
- Veterans carrying between battles: the Nexus's health is the only thing from the Grid that carries.
- More Commanders to fight and more cards to draft: the content milestone.
- Refits as a family of their own (a building action opened for the run, applied to every building of its kind as it is
  built). The Doctrine family covers the same ground with effects that exist today, so refits wait.
