# Campaign design — start here

**Document role:** Reading guide for the campaign design pass
**Status:** Draft for Mario to react to
**Updated:** 2026-08-28
**License:** Apache-2.0 for the analysis; story material is CC BY-SA 4.0

You said three things are undecided: **how the missions look**, **who the general is**, and **where
to start**. This folder is one attempt at each, plus the research behind them.

Nothing here is settled and nothing here is built. It is written to be argued with.

---

## The short version

**Where to start.** Build the raid defence first — the pyramid is up, a Ravel raiding party is
inbound, you hold the line and keep your workers alive. It teaches the two things a player can only
decide *before* the fight starts, and it needs nothing the engine cannot already do. But put a
two-minute scene in front of it where the pyramid wakes up and nothing attacks anyone, so the first
thing the player meets is the machine, not a war.

**Who leads.** Make her an engineering officer, not a line officer — she commands the perimeter
because she built it. Then the person giving orders is doing the same job the player is doing
(placing things and hoping), and the faction's "we are builders" identity arrives through a character
instead of a description. Keep a second, non-commanding character — the scientist who studied the
buried ruin for fourteen years — as the voice that wonders what the thing is, so the commander never
has to.

**How missions look.** Every mission is the same five beats: a page of briefing, a build phase where
you place things and pick one upgrade, the Pulse you watch and cannot touch, everyone walking home,
and a debrief that tells you what you just unlocked. What varies between missions is **exactly one
new idea**, and the mission is named after it.

**What the player unlocks.** One thing per mission, always a unit or a structure or an upgrade, always
granted for finishing, always visible in the build menu the very next mission. No currency, no
achievements, no skill tree, no random rewards. Why it stays that small is in
[`unlocking-and-teaching.md`](unlocking-and-teaching.md), and it is the strongest recommendation in
this folder.

**The one thing I did not expect to find.** The Pulse is a fight the player cannot steer. That only
feels fair if the build phase shows them what is coming — which raiders, from which edge, at roughly
what moment. This is the most important design constraint I found, it applies to every mission the
game will ever have, and nothing had written it down. Details in
[`what-a-mission-looks-like.md`](what-a-mission-looks-like.md).

---

## What I need from you

Five decisions. Each is written up properly in the document named, with the alternatives and what
they cost. One-line versions:

| # | Decision | My recommendation |
| --- | --- | --- |
| **A** | **Where does the campaign start?** Four openings, genuinely different | Raid defence as the first mission you build, with the pyramid-wakes-up scene in front of it → [`where-to-start.md`](where-to-start.md) |
| **B** | **Who is the Citizen commander?** Four options for what she *does for a living*, which matters more than her name | The engineering officer → [`who-leads-and-what-happens.md`](who-leads-and-what-happens.md) |
| **C** | **Is a mission's unlock fixed, or does the player pick one of two?** | Fixed. A teaching campaign needs to know what the player has → [`unlocking-and-teaching.md`](unlocking-and-teaching.md) |
| **D** | **Do you want the "big battle you are meant to lose" opening?** And if so, where does it go? | Design it now, build it much later, and put it *after* the first six missions rather than before them — the loss hits harder when the army was one the player actually built → [`where-to-start.md`](where-to-start.md) |
| **E** | **Does a second commander appear, and when?** | Yes, but as a voice around mission four, and playable only after the opening arc → [`who-leads-and-what-happens.md`](who-leads-and-what-happens.md) |

A and B block everything else. C is cheap to answer and shapes the campaign menu. D and E are far
enough out that they only need a direction, not an answer.

---

## Reading order

| Document | What is in it |
| --- | --- |
| [`where-to-start.md`](where-to-start.md) | Four ways to open the campaign, side by side, and the "you lose the first battle" idea explored properly. The one to read if you only read one |
| [`who-leads-and-what-happens.md`](who-leads-and-what-happens.md) | Who the commander is, how she is introduced, how the war with the Ravels escalates over six missions, and where a second commander fits |
| [`what-a-mission-looks-like.md`](what-a-mission-looks-like.md) | The anatomy of a mission, then a fully worked example — an actual map with actual coordinates, an actual enemy schedule, and what the player does minute by minute |
| [`unlocking-and-teaching.md`](unlocking-and-teaching.md) | The unlock system, the one-new-idea-per-mission rule, and how to teach the two decisions that actually matter in an autobattler |
| [`what-other-games-do.md`](what-other-games-do.md) | The research: nine games, what each does about unlocks and teaching, and what I took or refused from each. Skim the bold bits |
| [`player-and-developer.md`](player-and-developer.md) | Every recommendation checked twice — good for the player, and cheap to build and iterate on? Five places where one wins at the other's cost |
| [`report.md`](report.md) | The process write-up the repository asks for at the end of a milestone. You do not need to read it |
| [`notes-for-the-next-agent.md`](notes-for-the-next-agent.md) | Cross-references, loose ends, and the internal shorthand, for whoever picks this up next. Not for you |

---

## What I deliberately did not do

- **No new units, structures, or numbers.** Every unlock below is described by its *job* ("a
  defensive structure"), never invented as a real thing with hit points. Choosing the actual roster is
  separate work, and doing it early would lock in balance nobody has played.
- **No code, and no map file added to the game.** The map in
  [`what-a-mission-looks-like.md`](what-a-mission-looks-like.md) is drawn out with real coordinates so
  it is concrete, but it is a sketch to react to, not a file the game loads.
- **No second faction beyond the Ravels**, no extra campaign, no save system, no sound, no packaging.
- **I did not treat the earlier plan as settled.** You said not to, and I have not — the raid-defence
  opening is recommended below because it wins on its own merits against three alternatives, not
  because somebody already wrote it down.
