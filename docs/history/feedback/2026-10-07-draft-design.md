# The draft's design (2026-10-07)

With the Nexus draft merged (pull request 66), Mario paused the build for a design conversation in two messages:
first whether tech should be drafted or bought, with research into the games Terminal Nexus comes from; then a more
specific design for the Nexus draft, with examples drawn for three or four Commanders kept in the session, and
what to commit written into the design documents on a new pull request. These notes continue
[`2026-10-07-nexus-draft.md`](2026-10-07-nexus-draft.md)'s numbering. His words are voice transcription and are kept
as they arrived; a bracket says what a misheard word meant. Status values: **Built**, **Scheduled**, **Open**,
**Contested**.

### F144 — A tech tree, or a draft?

> Let's pause for a second to focus a little more on design and gameplay. At this time, we should be able to start
> seeing a little bit of the foundations that make this game tick. We have buildings, we have troops that
> automatically move towards the enemy nexus and will battle when they see each other. Perhaps we will have a post
> that allows to redirect troops to different locations, like maybe fighting for resources. But overall, the
> battles will be automated uh, and just directed towards the enemy nexus, just for simplicity. Because we want to
> keep this game a little bit light, although it's not getting light at all because we are having more components.
> But in essence, this game is based on Nexus Wars, the custom map from StarCraft II, Clash Royale, Warcraft,
> Rumble, and other similar auto battlers that feel more casual even though they have that strategy onto them. Uh,
> so let's focus a little bit on the elements that made this game strategical. One is the unit composition that
> will be dictated by the building's placement, similar to Nexus Wars. Another one will be the choosing what tech
> comes next, what units to unlock, what powers or science to unlock. And another one will be basically resource
> management, seeing if focusing more on resources or focusing more on army. So this creates a typical strategy,
> rock, paper, scissors, functionality, and I want to make sure that we have all of those components. So what I
> want to do now is hardly reevaluate if drafting Nexus powers is a good way to unlock science. Do we provide a
> tech tree that players will simply unlock with resources? Or do we lean into a drafting mechanic that sometimes
> can be fair and fair luck-based? My initial thought is that drafting works much better for shorter games,
> because if you get lucky, then okay, you just play another one. However, in this game, uh, we are we want to
> build resource management as well into it. So that means the the gameplay could last longer, like maybe 40
> minutes, maybe one hour. We will have campaign modes in which we can shorten it or focus it or edit or
> specifically allow to have certain draft decisions crafted. But the general long-term play for this game is
> going to be the run and possibly in the future multiplayer, where two players go uh, against each other with
> different commander armies. So what do you think, looking at other strategy games, what do you think is going to
> be more intuitive to unlock different tech that will be strategically countering what the player believes the
> enemy is going to throw at them next, which will be especially interesting in mirror matches or uh, PvP that
> happens in the future, or PvE where playing against AI as well is possible in the future. Please do a little bit
> of research and give me your game designer thoughts.

**Built**, as an answer in the session, from research into Mechabellum, Legion TD 2, Teamfight Tactics, Stellaris,
Against the Storm, Age of Mythology, Age of Empires IV and Nexus Wars: both, with different jobs. The answers to a
threat come from a tech tree bought with the same resources as an army, so they are always reachable, visible on the
Grid a round before they arrive, and a strategy an opponent can punish; the draft stays as what makes each game and
each Commander different. Long games draft happily when the draft never decides whether a threat can be answered,
and a dealt hand is luck you plan around, unlike a roll after you commit. For two players: the same hand for both,
kept powers shown once the battle starts, luck chosen by choosing an army. His F147 and F148 turned this into
rules. How long a match is (his 40 minutes to an hour, against the concept's 5 to 12) is **Open**, as Q75, since how
many picks a match deals depends on it. The post that redirects troops is the order question already in the
register (Q69).

### F145 — A pick each round; a rare hand every few rounds, later

> Thank you for the thorough research. Let's try to turn this into a more specific design for Nexus drafting. Uh,
> so basically, we're going to keep the same idea of offering a Nexus power to draft a month read on, at the
> beginning of each round. Now, every few rounds, we can offer like a rare draft, and here we can encode something
> more powerful, but let's leave that for later. But yes, I can see how limiting the amount of important
> decisions, depending on how many rounds the game will have, is important, so we can tune that later.

**Built**, as design: one pick each Build Phase stays, and the rare hand is written down as an idea for later — every
few rounds a hand of rares instead, how often and what a rare may do waiting for the number of rounds a match has
(Q75).

### F146 — Examples for three or four Commanders, kept in the session

> I would like to see examples of drafts and how they could be interesting.

> Yes. Thank you. Try to give me some examples. For examples, I would like to see draft examples of three or four
> commanders. Keep this on the session only. We don't need to commit to any of this design. I just wanted to do it
> to visualize.

**Built**, in the session and not committed: a page drew the shared shape and a match of drafts for Edda Vasse (the
Citizen hand filed a round early), Marshal Averno (a card from the Ravel Nexus that is never on file, the leak
widening as he takes them), Dob Hunter (hands of three, rares any round, redraws bought with resources) and Warden
Oleth of the Alder (no ordinary hands, works growing instead, a bloom every third round announced to both players).
What survived into the design is the short list of what a Commander may bend, not the examples.

### F147 — Hard counters in the tree, soft counters in the draft

> I like these ideas of hard counters being part of the tech tree and sub counters [soft counters] or things that
> can lean you into a specific strategy being part of the draft. Uh, like adding a few units seems part of the
> draft. Um, I like those rules. We should definitely write them down in the design, and this is a good time to do
> that after we implemented a few of those.

**Built**, as design: the answers to a threat are tree buildings, reached by building and never by luck; a power
leans a plan and never adds a hard counter; hard counters stay few. The rules from F144 for two players are written
beside it, as guidance for when multiplayer comes.

### F148 — Only the tree unlocks; a power adds

> Now, a power that unlocks a building should probably not be called unlock because we should keep that for the
> tech tree. And the tech tree will be specific to buildings and building upgrades. Um, perhaps the powers just need
> to say adds a new building to your to your uh, construction menu, and or this type of unit gets plus one attack,
> things like that that are not necessarily part of a texture [tech tree].

**Built**: Aid Station Permit now reads "Adds building: Aid Station.", beside War Chest's "Adds 2000 resources to
spend.", and the effect's name in code is `addBuilding`. The tree holds buildings and building upgrades; a kind of
unit is made better by a power, never by the tree; a building a power adds is one the tree does not hold. A
campaign level still unlocks cards for the levels after it: that happens between missions, never inside a match.

### F149 — The deck's own mechanics

> And last but not least, uh, should the deck itself have some sort of mechanic? If we're assuming all of the cards
> have the same cost, will that make it difficult to balance? So we add a few uncommon, a few rares in the in the
> drafts, and so we increase the rarity chance per round, for example. So that will create a little bit of a ramp
> up. So we have certain cards that are unlocked after playing a previous card, uh, or we should call it card
> upgrades, for example. So if you picked certain thing, then later you have a chance to get the upgrade as well.

**Built**, as design, with one choice for him to reverse: the ramp is a schedule, which rarity each card of a hand is
dealt from in which round, rather than a chance that rises, because a player can count on a schedule (F150). Picks
stay free, and rarity and timing are the price; an upgrade joins the pool one rarity up once its power is kept, and
replaces that power when kept. Vasse's powers carry a first-guess rarity, with two upgrades named.

### F150 — A predictable structure that Commanders use

> I would like to build a specific structure so it's more predictable how draft works, which makes it more
> interesting. And then the different factions or different commanders can fit into this predictability to take
> advantage of certain strategies. That seems more interesting without being heavy.

**Built**, as design: how the Nexus draft deals, in nine parts, and the short list of what a Commander may bend —
hand size, the schedule, redraws and their cost, a second pool, how much of the next hand shows, whether ordinary
rounds deal at all.

### F151 — Decide, write it down, open a pull request

> And after you're done visualizing, then do one more round thinking about the specific design that we want to
> commit for now. Obviously, keep it a little flexible so we can change it in the future. But we need to start
> taking some decisions here so we can move forward with the campaign design as well. And then write the design
> down, use that last round to update our designs, make a CR, a PR with that.

**Built**: the design documents carry the decisions, their numbers marked as first guesses; the campaign says which
part of the draft each mission brings, and mission 1's stale note (no real draft) is corrected. On a new pull
request as step 8B's second round.
