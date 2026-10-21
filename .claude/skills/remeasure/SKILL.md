---
name: remeasure
description: Measure a change and clean up after it — decide how much to measure, sort the tests a change breaks (re-pin, isolate, re-probe; never loosen), run the measurement in parallel and keep it for the record, retire the measurements it makes stale, and check every claim against the events before Mario reads it. Use after a rule, content or power-curve change (the Grid Nexus, supply, credits, a tier, a unit's numbers); when many pinned tests fail at once; and before telling Mario how a change played or where to watch it.
---

# Remeasure: a change, measured, and the record left clean

What a measurement holds and what its numbers can say is
[`docs/system-design/measurement.md`](../../../docs/system-design/measurement.md); the kept results and their
status are [`docs/history/measurements/`](../../../docs/history/measurements/README.md). This is the procedure.

## 1. Write the question, then decide how much to play

Write down the one question the measurement must answer before running it ("does a round-1 march still end a
duel?"), and pass it as `--question`. A run without a question produces numbers nobody reads. Then play only what
the change can move:

| The change | Run |
| --- | --- |
| Presentation only: a screen, an effect, a colour, a key | Nothing. The tests and the `playtest` skill. |
| A number on one unit or building: health, damage, cost, a timer | `measure who <content id>` on the levels it stands in; the quick spec's duels if a Commander's army fields it |
| A new unit kind or ability | A scenario that shows it (the `grid` skill), then `measure who <content id>`; the quick spec's duels if an army fields it |
| A kernel rule on movement, routes or targeting | The quick spec, the full spec's maps (`--spec full --parts scenarios`), and `measure formations` if it touches how units leave their buildings; the full spec's duels too when it changes how a common unit chooses or moves (the quick spec plays the balanced player alone, and only a rush showed the runner as a backliner emptying Dob's front) |
| A power-curve change: the Grid Nexus, supply, credits, income, a tier, the Nexus Pulse's hand | The full spec, then retire what it supersedes (section 4) |

The quick spec takes about a minute with `--jobs 4` (two alone); the full spec's 162 duels are the long part. Do not
play the full spec for a change the quick one can answer.

## 2. Sort the failing tests before fixing any

A rule change can fail dozens of tests at once. Read every failure and put it in one of these kinds; each has its
own fix, and **no test is loosened, skipped or deleted to make it pass**.

| Kind | How it looks | Fix |
| --- | --- | --- |
| **A pin moved** | A hash, a tick count or a winner held "so a change is a change on purpose" (measurement.md lists them) | Check it passed on the commit before, then re-pin and append to the pin's comment a clause saying why it moved: "…and when the Grid Nexus came to fight back". |
| **A premise broke** | The test is about something else, and the change got in its way: route scenarios sent a lone trooper at a Nexus that now shoots it | Isolate the rule under test with a fixture that lacks the new behaviour (the passive `structure.bench.nexus` in `src/content/proving-grounds.ts`), swap it in, and say why in a note. Never bend the rule to suit the test. |
| **The inputs no longer reach the meaning** | The claim still holds, but its setup no longer shows it: "a force wiped out with its Nexus standing plays on" needs a raid the Nexus cannot stop | Find new inputs with a short probe script in `.playtest/` (four raiders, not one), and say in the comment why the number is what it is. |
| **A false pass, revealed** | The test was passing for the wrong reason: an impact drawn in the same letter as the unit | Make it assert what it means (compare the style too). |

A frame-time test that fails while a measurement runs in the background is the machine's load: run it alone after
the measurement ends before believing it (DEVELOPMENT.md, "Testing").

## 3. Run it and keep it

1. **Commit first.** A run on uncommitted code, armies, campaigns or maps is written down with its build as
   `<sha>+uncommitted`; never keep one for the record. One rule change per kept measurement: if a second change lands before the result is kept, play
   it again, or say in the report which change it lacks.
2. **Play it in parallel**, in the background, with the machine otherwise quiet:

   ```bash
   node bin/measure.ts run --spec full --jobs "$(nproc)" \
     --routing "<the rules it measured, in a few words>" --question "<the question>" \
     --out docs/history/measurements/<date>-<what>.json 2> .playtest/measure.log
   ```

   `--jobs` plays the duels a few at a time, the levels and the maps as processes of their own, and merges them in
   the order one process plays them. Parts run by hand (`--parts`, `--players`, `--west`, `--seeds`) are made one with
   `measure merge <file>... --out <file>`, which refuses parts of two builds. A tick's time under `--jobs` is the
   loaded machine's: compare it only with another run played the same way. Measure on Node; Bun in a cloud session
   runs `--smol` and is slower (lessons-learned, "A cloud session's Bun saves memory").
3. **Do not run the test suite while it plays, and commit nothing**: its parts read the build as each starts, and a
   commit in between gives them two builds that `merge` refuses at the end. Draft the report in the scratchpad.
   Run the suite, timing tests included, after.
4. **Compare**: `node bin/measure.ts compare <the current one> <the new one>`. The summary already says how many duels
   were over by the end of rounds 1, 2 and 3, who beat whom, the catch-up measure and every level's verdict; reach for
   a script only for what it does not say, and add that to `src/measure/` when you reach for it twice.
5. **Write the report** in `docs/history/reports/<date>-<subject>.md`: the question first, a before-and-after table,
   what moved and what did not, and what scripted players cannot say. Link the JSON and the compare command.

## 4. Retire what it supersedes

A kept measurement on a new power curve makes the ones before it history. In the same commit:

- In [`docs/history/measurements/README.md`](../../../docs/history/measurements/README.md), add the new row as
  **current** and change each row it replaces to **superseded by** the new file, with what changed in a few words. A
  change that moves only part of what a result measured (a movement rule after a full run) marks it **current, short
  of** that change until the parts it touches are played again.
- Put one italic line at the top of each superseded report: superseded on what date, by which change, and a link to
  the report that replaces it.
- Never delete a measurement or edit its numbers. History keeps what was true when it was written.
- `grep -rn "<the old report's file name>" docs/game-design docs/system-design`: a current document that quotes a
  superseded number says the new one, or that it waits to be measured again.

The validator refuses a measurement file with no row in the index.

## 5. Check every claim against the events

Before a sentence tells Mario where to look or what changed, find the moment it describes:

- **A unit doing something in a level**: `node bin/measure.ts who <content id> --plan nothing --levels <level id>`
  says, round by round, its hits, damage, kills and the second of its first hit. Quote the round it shows. ("Watch
  the Nexus shoot in PERIMETER's round 1" was written from memory; it first fires in round 3.)
- **A duel or level number**: copy it from `measure show` or `compare`, never from recall.
- **A map or a level**: name it by the id the command printed. A commit message once named the wrong map.
- **A verdict a measure gives**: take out the cases where the measure and the outcome are the same thing before
  reading it (lessons-learned, "A measure can agree with itself").

What a measurement found goes to Mario as plain words in the pull request, linked to the report; anything an army or a
rule needs changed becomes a question with a recommendation, not a quiet retune.
