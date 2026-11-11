# 2026-11-11 — Showing the game to a possible investor

The owner asked for a demo to show a friend who may invest: a mirror of the Nexuses against a scripted, easy enemy, the
Commander talking, and a large army fighting a large army, in two to five minutes. A mirror level and a battle were built
and shown; their code is not kept in the game (the pull request that merged this note removed it, and the commit that
added it stays in the branch's history). What follows is what he said after showing them.

### F244

> The demo was great. My friend really liked it, and it really helped to have the large army battle for him to see the way the units move and attack each other.

**Noted.** The large battle is what a stranger understood at once: the units, how they move and strike. It is the best
single picture of the game today.

### F245

> The strategic components are still not so clear because it's kind of obvious what to do. Just place some buildings and use your money. My hope is that it really improves once we have worker economy and once we have a variety of units that can counter other units.

**Noted.** With one resource and units that do not counter each other, the best plan is to buy what you can afford, so a
person has nothing to weigh. Nothing was changed to hide that: the worker economy ([milestone 7](../../milestones/milestone-07-worker-economy.md))
and units with counters ([milestone 12](../../milestones/milestone-12-content-iteration.md)) are what answer it.

### F246

> I'm thinking it's important to see what the enemy is building at the beginning of the battle, but not what they're building, because obviously the game is supposed to be asymmetric ... you should be able to build your part, and when the battle begins, see what they built, and now be able to freely move the camera around as the battle happens and inspect things that are happening, with the ability to pause and rewind and go forward. ... And then after what you saw happen, what you saw they build, you can now go back and analyze their base and see what they're doing. And from there, decide your next turn based on the amount of money that you collected, where your army is positioned, the formation, and the bets you want to make and the current nexus power versus where you want to put the banner to move the unit, the armies, and what is the status of your commander. ... we're not there yet.

**Written down, not built:** the loop he describes, in [the backlog](../../milestones/backlog.md) ("Reading the battle, then the
enemy's base"). He said it waits for the game to take shape, and that no pull request is needed for the demo.
