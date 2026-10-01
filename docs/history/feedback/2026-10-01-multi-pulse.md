# The loop across rounds — the owner's verdict (2026-10-01)

Mario played PERIMETER as three rounds (step 6B), merged the Barracks that trains (step 6C) and sent one
message. It continues [`2026-10-01-feedback-loops.md`](2026-10-01-feedback-loops.md)'s numbering. He asked
for nothing to be built now ("we can address those at the right time") and for the next milestone to start,
so the items below are logged, placed where their work will be done, and the pull request that logs them is
the next milestone's first step. One was built after all, because the Commander made it urgent (F102). Status values: **Built**, **Scheduled**, **Open**, **Contested**.

### F97 — The loop across rounds

> Multi pulse was great! It feels like the game is starting to take shape.

**Built.** Step 6B, the round loop, is done. Step 6C, the Barracks that trains, was merged the same morning
and is counted done with it; Milestone 6 is complete. The four Experiments the two steps added (Next round,
Incoming wave, Barracks trains, Troopers a round) came back without a settings export, so they stay at their
first guesses until one arrives, as the menu spike's did.

### F98 — Balance can wait; the interface and the mechanics come first

> Don't worry too much about the first level being too easy or balanced. We will need to improve and balance
> the PERIMETER soon or later, but at this point we are still working on the basics of the game mechanics. I
> am more concerned about the UI/UX and quality of the mechanics so we can design levels and balance them
> under the restrictions of the game.

**Built.** Nothing in PERIMETER is retuned for balance. The edge step 6C found (at some Barracks paces a plan
that builds nothing wins) stays recorded rather than fixed, and PERIMETER's balance belongs to the milestone
that polishes it (First and Second Missions). The priority is written into the milestone sequence
(`docs/milestones/README.md`): the interface and the quality of the mechanics before any level's balance.

### F99 — See how many enemies are coming

> I would like, for example, that the enemies would have a spawner where the player can check how many
> enemies are coming. Or directly see them on the map with intentions.

**Open.** Half of this is there: the Build Phase draws the next round's raid on the map, see-through, and its
Explore Map card says what the group means to do (the Incoming wave Experiment, shown by default). What is
missing is a count in one place, and seeing it without going to look: in round 1 the raid stands at the
ridge, off the screen the round opens on. It also pulls against a line in the design: knowing what is coming
is meant to be something a player spends a Nexus power on ("Early Warning" on Vasse's card), not something the
screen gives away. Which of the two wins decides one of PERIMETER's two powers, so it is a question for the
Nexus draft step, registered with a recommendation (`docs/milestones/open-questions.md`, how much of what is
coming a player sees for free). The display itself is in the backlog's Pulse screen entry.

### F100 — Look at units during a Pulse

> I also notice there's no exploration feature during the pulse. I should be able to hover over units and see
> their details, same as with the Explore feature.

**Scheduled.** In the backlog (`docs/milestones/backlog.md`, the Pulse screen): pointing at a unit while a
Pulse plays shows the same card Explore Map shows in the Build Phase. Not in the Commander milestone unless
Mario pulls it in.

### F101 — Fewer numbers on the Pulse screen

> The pulse doesn't need to track that many stats,

**Scheduled.** Same backlog entry. Today the Pulse panel shows, for each side, a count of units, a health bar
and a health total, and a feed line for every shot and death; the entry asks which of these a player needs.

### F102 — Only the Nexus loses a round

> and the player should only lose when the nexus is destroyed or if there's a specific losing condition on
> the campaign level.

**Built.** This answers the open question about a side whose Grid Nexus stands losing because its units
died: no. A side whose Nexus stands is never wiped out; its Pulse goes on until the Nexus falls or time runs
out, and a mission may add a losing condition of its own. It was to wait for its own step, but Vasse made it
urgent: with her in the squads, the old rule let a plan that built nothing win PERIMETER, because her line
fell in the last round and the round stopped with the Nexus untouched. So it is built first, in its own
commit of the Commander's pull request (`src/pulse/victory.ts`, the map `nexus-stands`), and the Pulse
page's victory rule says so. On the starter map a lost round now always means the Nexus fell; a force
wiped out with the Nexus standing plays on to the time.

### F103 — On to the next milestone

> Anyway, we can address those at the right time.
>
> Get ready and start working on the next milestone stage! Let's go

**Built.** Milestone 6 is complete and moved to `docs/history/milestones/`. Milestone 8, the Commander, is
current, and its first step, the Commander herself (Vasse as a persistent unit who dies, is absent for a
round, and comes back), is the pull request this log arrived with.
