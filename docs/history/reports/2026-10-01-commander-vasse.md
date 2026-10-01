# Report — The Commander: Vasse falls, sits a round out, and comes back

---

## 1. Frame — written before coding

- **Milestone and step:** Milestone 8, the Commander; step 8A, the Commander mechanic. Made current by Mario on
  2026-10-01 after he played PERIMETER across three rounds ([his words](../feedback/2026-10-01-multi-pulse.md)).
- **Question this step answers:** can Commander Vasse exist as a persistent `@` with the death, absence and
  restoration cadence the Pulse page describes, on a named scenario that hashes the same every run, and can a
  player tell what her death did?
- **Smallest artifact that can answer it:** a Commander flag on content; Vasse at the size PERIMETER needs; the
  absence carried from round to round beside the state; restoration beside the Grid Nexus as a round begins;
  words where the player is already looking; a three-round test map that spends the whole cadence.
- **Automated evidence planned:** the test map's three rounds pinned on Node and Bun; her content and the
  mission's validation; restoration's edges (early, no Nexus, a later round); the screens, played through the
  real session.
- **Human observation planned:** Mario finds the `@` in PERIMETER, turns her health down, and watches her fall
  and the round after.
- **Explicit exclusions:** her powers and the Nexus draft (step 8B); her doctrine's behaviour, which needs an
  order the kernel can keep (Q69); the Citizens' Commander Army (Q34); any other Commander; the third mission's
  story beat.

## 2. What was built

- **A Commander flag** on content (`commander`), read only by the rules between rounds and the screen. The kernel
  sees a unit like any other, so she fights and dies by the ordinary rules and her death decides nothing.
- **Vasse** (`src/content/commanders.ts`): an `@` on the units layer, the squads' pace, eighty health, a short
  shot (5 every 1.5 seconds, range 3) from just behind the line, and no salvage. She walks out of the annex with
  PERIMETER's two squads, listed first so she takes the muster's centre.
- **The cadence** (`src/match/commander.ts`): `fallen` reads a round's death events for Commanders; the round
  loop carries each as an absence (whose, which, the round she fell in, the round she is due); as a round begins,
  after Recall and before its Build Phase, `restoreCommanders` sets every Commander who is due on the free tile
  nearest her side's Grid Nexus, a new body at full health. A side with no Grid Nexus standing keeps her absent
  until it has one. A mission may bring its Commander once.
- **Her health is an Experiment** (**Vasse's health**, 20 to 150, first guess 80), read when a round's Pulse
  starts and by her card; a Commander carried into a round never has more health than it allows.
- **The words**: her card ("Vasse — Your Commander"); the feed (`5.9s Vasse falls`); the result under Recall
  (`Vasse fell: out for round 2, back for round 3.`); the next Build Phase's bottom line and its Battle Round
  screen (`Vasse is out this round.`); and the round she returns, `Vasse is back beside the Nexus.`
- **Built first, in its own commit:** Mario's answer that only the Nexus falling loses a round. A side whose
  Grid Nexus stands is never wiped out; a new map, `nexus-stands`, shows it in the engine tool.

## 3. Surprises, first

1. **Vasse made the old rule decide the mission.** With her in the squads and a round ending the moment the
   player's units were all dead, every plan measured won PERIMETER, building nothing included: her line fell in
   round 3 and the round stopped with the Nexus untouched, which the mission counts as held. Mario had just
   answered the question; it was to wait for a step of its own, and was built first instead.
2. **How hard she hits decides whether the Barracks trains in round 1.** At eight a shot she ended round 1 with
   nothing built at 9.8 seconds, two ticks before the Barracks's first trooper (ten seconds in, the default
   pace), so round 2 opened with nobody trained: the whole point of the Barracks step, undone. At five a shot the
   round lasts 11 seconds again.
3. **Her place in the spawn list moves every squad member.** Units are set down in list order; listed first she
   takes the muster's centre with the squads around her, listed last she stands at their edge. At the edge she
   fell in round 2 behind every Turret plan measured, at every health up to 120.
4. **She cannot fall in PERIMETER's first round.** The probe dies before it reaches her at any health, even 1,
   so the earliest she falls is round 2, and her return would be in a round 4 that does not exist. PERIMETER
   shows her fall and her absence; only the test map shows her return.
5. **A test that watched a Pulse in one-second steps stepped over the half-second cease fire** once round 1's
   length moved. It now watches in quarter seconds.

## 4. Outcomes measured

PERIMETER, round by round as the screen plays it (training at its default pace, Recall, the Commander restored),
with Vasse first in the squads and five a shot. "Turrets" is the defending plan the mission tests use (two Turrets
and a Hatchery, a Turret more each round); "a Turret a round" adds one each round; "a Barracks" builds one in
round 1 and nothing else.

| Vasse's health | Nothing built | Turrets | A Barracks | A Turret a round |
| --- | --- | --- | --- | --- |
| 20 | falls in round 2; mission lost in round 3 | falls in round 2; held | falls in round 2; held | falls in round 2; held |
| 40 | falls in round 2; lost | falls in round 3; held | falls in round 3; held | falls in round 3; held |
| 60 | falls in round 3; lost | falls in round 3; held | falls in round 3; held | falls in round 3; held |
| **80** | **falls in round 3; lost** | **falls in round 3; held** | **falls in round 3; held** | **falls in round 3; held** |
| 100 | falls in round 3; lost (the Nexus falls one tick before the end) | held | held | held |
| 150 | falls in round 3; **held on time** | held | held | held |

- The rule alone, without Vasse: nothing built loses in round 3 (the Nexus falls 16 seconds in); every other plan
  is held. Before the rule it lost the same way, but round 2 ended the moment the squads fell.
- Round 1's length with Vasse: nothing built, 11.1 seconds (the Barracks trains one); Turrets, 9.8 seconds (it
  trains none at the default pace); the playtest's two Turrets and a Hatchery, 13.1 seconds.
- The test map (`tests/commander-fixture.ts`): Vasse alone in front of the base and two raiders beside her, five
  troopers at the muster. She falls at tick 71 of round 1, the troopers finish the raid, round 2 is played without
  her from its Build Phase to its end, and round 3 opens with her on the tile north of the Nexus at full health.
  The mission is held. Its three final states are pinned and match on Node and Bun.

## 5. Interpretation

The cadence is a few dozen lines because the state already said almost everything: a dead unit is gone, Recall
sends anyone without a producer home to the Nexus, and a round's opening already keeps a carried unit's identity
and health. What the state could not say was that she had fallen and when, and that is the only thing the round
loop now carries.

The first guess of 80 health is the value where PERIMETER keeps the shape step 6B gave it, measured rather than
chosen: she comes out of the first two rounds in every plan, and a plan that builds nothing still loses. Whether a
Commander should be that safe is Mario's to feel; the Experiment runs from 20, where she falls in round 2 whatever
is built, to 150, where she wins the last round on time by herself.

**What is left:** her powers and the Nexus draft (step 8B, which should first settle how much of what is coming
the screen gives away for free, Q71); her doctrine's behaviour (Q69); and whether building her answers the
question about authoring the Citizens' army early (Q34: it does not, and the pull request says so).
