# Single battles: the modes, looked at again (2026-11-11)

_Research for the owner's question of 2026-11-11: should the game lean into single battles, with a quick-play mode
for any setup and a campaign that takes over what runs were for? Written to be listened to: no tables, plain
sentences, the sources at the end. Evidence and recommendations, not a decision; nothing in the game changed._

## The short version

Your doubt is right, and the numbers back it. A Terminal Nexus battle is now a ten to twenty minute thing. A
roguelike run strings many battles together, and every game that does that well has battles that last seconds or a
couple of minutes. Ten of our battles is an evening, not a run.

So my recommendation has four parts.

First, make the single battle the centre of the game, and build a quick-play mode next. I would call it Skirmish:
one battle against the computer, where you choose your Commander, the enemy's Commander, the map, the difficulty and
the starting conditions. Alongside the screen, a battle file that sets up anything the screen cannot, including units
already standing on the Grid. Most of the pieces exist today, because a Challenge battle is already a duel against a
scripted Commander Army.

Second, keep the name Versus for a battle between two people, later. In StarCraft, Versus means against people; Age of
Empires calls the single battle against the computer a Skirmish. Using both words keeps the menu honest.

Third, merge runs into the campaign, which becomes Story. The best ideas from runs survive: the draft between
battles becomes a technology choice between missions, a few of them exclusive, so the campaign branches by what you
research rather than by which missions you play. That keeps one story while the army you finish with is yours.

Fourth, notice that the roguelike did not disappear. It moved inside the battle. Every round already opens with the
Nexus dealing a hand of powers, and you keep one. That is a draft at the scale of a round. A thirty minute battle of
eight drafts, building upgrades and a banner is the run, with an opponent guessing at the same time.

## Where we are today

The runs milestone has built a lot. A run has a seed and three battles against Dob Hunter's army. Buildings have
actions: upgrades bought with credits, firing modes and orders. A run army is drafted between battles, with rarity, tier
and a pity offset. Survivors stay on the map and regroup between thirty-second rounds. Troop movement has its three
states, its vision and its commitment. The battle banner is built as a prototype and waits for your playtest.

What is still planned for the milestone is the stance, the banner finished, then the route with its acts and stops, the
opponents and bosses, the run's summary screen, and playing it.

Almost everything built so far serves single battles just as well. Building actions, the kept front, the regroup, troop
movement, the banner and the stance are all battle mechanics. The duel engine and its scripted players are exactly what
a Skirmish opponent needs. Only the run draft and the route are specific to runs, and the draft can live on in Story.

## What a battle really costs in time

A round has four parts. The Nexus Pulse takes a few seconds. The Build Phase has no timer, and a player who is
thinking takes somewhere between half a minute and a minute and a half. The Battle Round is thirty seconds of game time.
Its ending beats and the result add another ten or so. Call it a minute and a half to two and a half minutes a round.

A battle has up to eight rounds, and the duels measured last month lasted six or seven rounds on average. So a battle is
ten to seventeen minutes for a decisive player and twenty to thirty when the player takes their time, as you said.
The concept document still promises five to twelve minutes; that is already out of date.

Now multiply. The runs design asked for about ten battles in three acts. At fifteen minutes a battle that is two and a
half hours. The three-battle run we built is forty-five minutes to an hour and a half, and each of its choices between
battles comes only every fifteen minutes. In Slay the Spire, a fight takes a minute or three and you draft after each.
In Super Auto Pets and the other autobattlers, a battle plays in seconds. The run structure depends on that rhythm: many
small choices, quickly tested. Our rhythm is fewer, bigger choices, each tested by a long battle. That is an RTS rhythm,
which is the direction you named.

## What other games do

**Build, then watch, round after round.** Mechabellum is the closest commercial game to what you describe. Two players
spend a supply budget each round on units, technology and abilities, unspent supply carries over, and the round is
fought out automatically. Technology is bought per unit type, and the two sides see each other's choices only when the
round plays. Its single-player modes exist, but the game lives on one-against-one battles. Castle Fight, the old Warcraft
3 custom map, is our most direct ancestor: you place buildings, the buildings spawn units, and the units march on the
enemy castle on their own. Legion TD 2 is the same family, with games of around twenty minutes by one player's account.
None of these is a run of many battles. Each is one long battle of many rounds.

**The short RTS.** Battle Aces, by StarCraft veterans, tried to make an RTS for everyone: matches capped near ten
minutes, and before the match each player chose eight units from about fifty, a deck. Its testers liked it, and it was
still cancelled in May 2025. The lesson for us is not that the idea fails. It is that a single-battle game lives on its
battle being worth replaying, and on enough people to play against or a good enough computer opponent.

**Hidden simultaneous plans.** Frozen Synapse is the classic. Both players plan at leisure, the plans resolve together
in five seconds of action, and then both plan again. Two of its ideas fit us. The game previews how your plan will play,
and it lets you plan the enemy's moves too, to test a guess. Its sequel added a one-turn mode: you commit a plan and see
it play against many other players' plans. That is close to our duels by files, where a plan can come from anywhere.

**Campaigns that branch by technology.** StarCraft II's Wings of Liberty campaign is the model for what you described.
Between missions, the player spends credits on armory upgrades and spends research points on a lab where each step is a
choice between two technologies, and you cannot have both. Three times the story offers two missions and you play one.
The story stays one story; the army becomes yours. Dawn of War's Dark Crusade went further, with a territory map, a
skirmish battle for each province, and honour guard units that survive to the next attack. ZeroSpace, in early access
since July this year, makes you choose mercenary groups that add units and heroes. One critic said its story choices
are close to cosmetic, a warning that branches have to change the army, not just the dialogue.

**Replaying single battles.** StarCraft II's co-op mode shows how a single mission stays fresh for years. Each Commander
levels up and then earns mastery points. Every week a mutation applies a fixed set of mutators to one mission, and
players can later stack up to ten mutators on any mission. Slay the Spire's ascension does the same job for a run. For a
Skirmish mode, this is the cheapest replay value there is: the same battle under new rules.

## Each mode: what it gives and what it costs

**Skirmish.** This gives the most for the least. It is the playable loop as soon as it exists. It is the testing tool,
because any setup becomes a battle we can play, show and measure. It exercises every Commander against every other. What
exists already: the duel engine, three scripted players (rush, balanced, turtle and their variants), three Commanders,
the Crossing map, and scenario files that put units on the Grid. What it needs: a setup screen (your Commander, the
enemy's Commander and player, the map, the rounds, the starting credits), a battle file read with a command-line option
for everything else, and a sense of difficulty. Difficulty is the weak part. The scripts differ in plan, not in skill, so
difficulty would start as a handicap: more or fewer starting credits, or a stronger starting hand. The other weak part is
the computer opponent itself. The rush and turtle scripts never reach each other's Nexus, and a player will find that
out in an evening. The stance and the banner steps, already planned, are what give the scripts an answer. I would call
it a small milestone of three or four steps.

**Story, with technology branches.** This gives the teaching, the lore and the reasons to replay a campaign, with the
bonus goals and achievements you described. It costs the most, because writing, cut-scenes and level design are the
slowest work. The mission cut-scenes milestone and the first two missions are still to build, and branching multiplies
content. The way to keep it affordable is the StarCraft way. Branch by technology, which is just data in an army file,
and only rarely by mission. The draft we built for runs already deals cards with rarity and tier, so a choice between two
technologies after a mission is a smaller version of it. Exclusive pairs, where taking one closes the other, are new
and cheap.

**Rogue.** If it is merged into Story, the route, the acts, the stops and the bosses can be dropped, and the steps for them
come off the plan. If you want to keep a small version, a short run of three battles with a draft between them is
already built and plays today; it could stay as a challenge in the Skirmish menu. I would leave it parked, not deleted,
until Skirmish and Story say whether anyone misses it.

**Versus between people.** It gives the real test of hidden simultaneous plans. It costs networking, which no milestone
allows yet. But one version is surprisingly cheap: the duel already plays through files, one plan a round, so a
correspondence battle, where each player sends a plan and waits, is close. It stays later.

## What it would change in the plan

The runs milestone's question, whether a seeded run with a draft between battles plays, would close where it is: the
stance and the banner finish it, because single battles need them most. Its route, opponents, shell and playing steps
would be retired. A new Skirmish milestone would come next: the setup screen, the battle file, opponents by Commander and
script, and a difficulty handicap. The campaign milestones would then take the technology choice between missions.

Some written rules would change with it. The concept page's five to twelve minutes. The game-modes page's rule that
there are two single-player modes, Campaign and Challenge, designed together, and that replay value lives in Challenge.
The rename to Story, Skirmish and Versus would land in the same pull request as the decision.

## Questions for you, each with my recommendation

**The name.** Skirmish, Quick Play or Versus for the single battle against the computer? I recommend Skirmish, and
keeping Versus for two people.

**The Build Phase clock.** The Build Phase has no timer, and it is most of a battle's length. A soft clock in Skirmish,
off in Story, would bring a battle near fifteen minutes and add the tension of an RTS. I recommend trying it as an
Experiment in Skirmish once it exists, not before.

**Technology inside a battle.** You described choosing what technology to develop next round while the enemy chooses
theirs. Today that is the Nexus power kept from each hand, and building upgrades bought with credits. Is that enough, or
do you want a small research tree in the battle? I recommend playing Skirmish with what exists before adding one; the
Nexus Pulse milestone is the natural home for it.

**Runs.** Retire them, or park the three-battle run as a Skirmish challenge? I recommend parking.

**Order.** Skirmish before the campaign shell? I recommend it: it is cheaper, it is playable sooner, and every campaign
mission is a Skirmish with a script and some words around it.

## Sources

- Mechabellum, beginners' guides and PC Gamer: https://gamepretty.com/mechabellum-beginners-guide/ and
  https://www.pcgamer.com/i-cant-stop-playing-this-autobattling-strategy-masterpiece
- Battle Aces: https://en.wikipedia.org/wiki/Battle_Aces and
  https://sg.news.yahoo.com/battle-aces-lets-play-full-205248675.html
- Legion TD 2: https://legiontd2.fandom.com/wiki/Matchmaking and https://store.steampowered.com/app/469600
- Castle Fight: https://maps.w3reforged.com/featured-maps/castle-fight
- Frozen Synapse: https://giantbomb.com/wiki/Games/Frozen_Synapse and https://www.mobygames.com/game/113838
- StarCraft II's campaign research and choice missions: https://liquipedia.net/starcraft2/Campaign and
  https://starcraft.fandom.com/wiki/Tech_reactor
- StarCraft II co-op mutations and mastery: https://www.pcgamesn.com/starcraft-ii-legacy-of-the-void/starcraft-2-patch-33
  and https://news.blizzard.com/en-gb/article/20245429/patch-3-6-preview-custom-mutators
- Dawn of War, Dark Crusade: https://en.wikipedia.org/wiki/Warhammer_40,000:_Dawn_of_War_%E2%80%93_Dark_Crusade
- ZeroSpace: https://store.steampowered.com/app/1605850/ZeroSpace and
  https://pcper.com/2026/06/zerospace-hopes-to-combine-rts-with-rpg-and-4x/
- Our own: the runs milestone (`docs/milestones/milestone-11-challenge-runs.md`), the game modes
  (`docs/game-design/game-modes.md`), and the between-rounds measurement
  (`docs/history/reports/2026-10-26-between-rounds.md`), where battles averaged about 6.7 rounds.

Not confirmed by the search: Mechabellum's and Castle Fight's typical match length. The timings for our own rounds
are estimates from how the rounds are built, not a measurement of a person playing.
