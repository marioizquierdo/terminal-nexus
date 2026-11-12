# The `skirmish` command, 2026-11-12

_After pull request 96 merged. Logged before building; each point's status says what was done._

The owner asked to start building the save files and then convert the testing scenarios into saves, and changed the
command-line design: numbered slots, one command instead of `brief`, `round` and `play`, and a player's plan handed in
at the slot it plans.

### F254 — numbered slots

> Skirmish slot identifiers could be numerical 1-index: "p1", "p2", etc. for "player 1" , "player 2", etc. They are finite, we only have two for now.

**Built.** Saves, the command line and the brief's labels say `p1` (west) and `p2` (east). The battle's state inside a
save keeps the engine's own words, side A and side B, and the design page says which is which.

### F255 — one command

> `skirmish brief` and `skirmish round` could be combined on a single command: just "skirmish". Assuming a few defaults, we can re-use the same command space to start a new game, load a previous game at the build phase, and run the next battle round. A new skirmish needs to assign players to each slot. A loaded skirmish game already has them assigned, so if there's no slot info it will assume that the brief information is visible to the current player (or players if there are more than one assigned). When loading a game, you can specify a different slot combination to change the script, or change who is the current player. Running with no build actions prints the brief, passing `--build-actions` validates the actions (returns errors like when trying to build with not enough resources or at an invalid location), and running again with `--build-actions` and `--battle` will build, on both sides and then play the battle.

**Built.** `skirmish` is one command: `--map` starts a battle, `--load` (or `-f`, which also saves over the file)
carries one on; with no plan it prints the brief of every slot a player plans, with a plan file it checks the plan
(what it would build, and each refusal with its reason; exit code 1 when anything is refused), and with `--battle` it
builds both sides and plays the Battle Round. The plan file is named at the slot (`--p1 build:plan.json`, next point)
rather than by a `--build-actions` option.

### F256 — a plan is named at its slot

> Specifying the player actions can be directly specified at the slot where the current player is assigned, that is the only way that makes sense to specify new actions (see examples below).

**Built** as his examples write it: `--p1 build:<file>` (a folder or `.` means the `build.json` in it; `build:` alone
means the save's draft, or nothing), `--p2 script:<name>` (`script:` alone plans nothing). A slot that builds by hand is
saved as a `player` slot; a load with no slots named keeps each slot's controller.

### F257 — the units left after the regroup

> Note that a saved file may have the units leftover from the previous battles, that should be recorded on the save file. They should be at the final location after doing the retreat. Since movement is deterministic, the grid can calculate where they will be exactly at the time that the battle round is finalized. Even if, for some reason, we optimize the UI to allow starting the build phase before the units are fully retreated (we could allow some extra movement during the build phase, maybe the units would also move around for better animation effects, but once the battle starts, they will get back to their proper position so it stays deterministic). The same applies to units moving when building on top of them.

**Built**, and it was already the duel's rule: the state a save keeps is the one the regroup leaves, every unit where it
ends its walk. Written down as a rule on the design page: anything the screen moves during a Build Phase is
presentation, and the battle opens from the saved places.

### F258 — his examples

> ```
> skirmish --map perimeter-rocks.json --p1 build: --p2 script:
> skirmish --map perimeter-rocks.json --p1 build:build.json -slot2 script:
> skirmish --map perimeter-rocks.json --p1 build:. --p2 script:aggro --battle --save playtest-11.json
> skirmish --load playtest-11.json
> skirmish --load playtest-11.json --p1 script: --p2 build:
> skirmish --load playtest-11.json --p1=build:foobar.json
> skirmish --load playtest-11.json --p1=build:foobar.json --battle --save playtest-11.json
> skirmish --load playtest-11.json --p1 build:foobar.json --save playtest-11.json
> skirmish --map swamps.json --p1 script:aggro --p2 script:defensive --battle --save playtest-12.json
> skirmish -f playtest-12.json --p1 script:aggro --p2 script:defensive --battle
> ```

**Built**, each of them works as written apart from three things that do not exist yet: the maps `perimeter-rocks` and
`swamps` (a map file is read; the built-in maps are `crossing` and `pocket`), the profiles `aggro` and `defensive`
(today's scripts are `balanced`, `rush` and `turtle` and their variants; profiles are the next step), and `-slot2`, a slip
for `--p2`. A new battle's Commanders are `--p1-commander` and `--p2-commander` (Vasse against Dob Hunter unless
named): his examples left them out.

### F259 — then the scenarios

> We can start working on implementing the skirmish save files, and then convert the current testing scenarios into save files that can be used to test from the UI or the CLI.

**Scheduled.** The save files are this pull request (step 17D). Converting the scenarios is step 17J, now next: it needs
a save's `start` section (units and buildings placed by hand before round 1) and a battle that is one Battle Round
with no plans, which the scenarios are.
