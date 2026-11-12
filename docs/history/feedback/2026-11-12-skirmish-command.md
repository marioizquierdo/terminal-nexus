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

## The second round: the whole Skirmish design

After pull request 97 was opened, the owner asked for the rest of the Skirmish design in the same pull request.

### F260 — more combinations on the command line

> note that, while the UI only allows one player at this moment, the CLI skirmish command can easily allow for multiple "build" actions. So you could, for example, test playing against yourself by just saying `skirmish --p1 build:build-actions-1.json --p2 build:build-actions-2.json --battle`. Also, if both player slots are scripts, there should be a way to just let them play multiple rounds until there is a winner (or round 100 to put a limit): `skirmish --p1 script:foo1 --p2 script:foo2 --play-until-win`.
>
> Think of any other combination that allows this command to test many situations. Along with a proper definition of build actions, scripts and save files for skirmish, that would create a very robust and solid platform for testing. Think of other combinations and edge cases, and of course, make sure to write in a way that is testable, implement tests, and run some exploratory rounds and games. Make sure you can still see the battle details through the log system.

**Built.** Two `build:` slots play against each other; `--play-until-win` plays scripts to the battle's end (the limit
raised to 100 rounds unless `--rounds` says otherwise); `--battles <n>` plays n rounds; `--seeds 1-20` plays a new battle
once a seed with a tally; `--out <dir>` keeps every round's save and report; `--log <file>` writes the battle's log, at
`--log-level`, as `grid` writes one; `--modifiers`, `--rounds` on a loaded battle, and `--p1-credits`/`--p2-credits`.
Script profiles are `players/scripts/*.json` (agro, defensive, steady, agro-rich); agent profiles are reserved in
`players/agents/`.

### F261 — testing scenarios become testing saves, and the word "scenario" goes

> And when moving the previous scenarios into the equivalent skirmish save files, keep the ones that offer valid testing scenarios and feel free to remove those that don't add much value anymore or are too complicated to port. Even though they are save files, make sure to keep them at a separate folder called something like "skirmish-testing". Then cleanup, remove the term "scenario" from the files, docs and code (but feel free to name some save files scenario-1, etc. that is fine, we just need to cleanup the concept).

**Built.** 62 of the 63 rule, unit, movement, engage and showcase maps are testing saves in `skirmish-testing/`, every
kernel hash unchanged; `colossus-two-tile-gap` was dropped as a repeat of `hauler-two-tile-gap`, with its test. The
duel maps are files in `maps/`. "Scenario" is gone from the code and the documents but for the history and the two
places that still read an older build's files for `--against`.

### F262 — the game opens a save now; Save game in the Esc menu

> Why is that the game can't open a save until Save game is on the Build Phase menu? We could start with the skirmish command right? Then we add save on the UI, but it should be on the main menu settings "[esc]" instead of in the side menu.

**Built.** `terminal-nexus --load <file>` (and the route `skirmish?load=<file>`) opens a save at its Build Phase, and
Save game is in the Esc game menu (`v`), at a Build Phase only.

### F263 — the whole design, and notes from testing

> Keep going until the whole Skirmish design is implemented. Testing with existing maps is great! and since you are testing, please feel free to take notes from each test case for anything that goes beyond the focus of building skirmish mode, but at the end of this, take an extra pass at those notes and see if 1) the test is not valid anymore => delete the test, 2) the issues could be addressed right away => go ahead! I don't mind a larger PR if it is fixing and improving things, 3) save new ideas on the PROJECT or appropriate milestone to revisit later

**Built**: the title menu's Skirmish with New game (the setup screen) and Load game, spectating, the note key, and
testing from saves; every step of the Skirmish milestone but the banner (its own session) and his playtest. The notes
pass: one testing map dropped as a repeat with its test; fixed at once, the Pocket's top bar running into its Esc label,
Quit pointing to Save game, Save game offering to write over a shipped example save, the battle's words while watching
two scripts, Left and Right on the setup rows, a battle's route naming its whole setup, the playtest script's own saves
folder and its `type:` step, and the picture script finding the browser; one note found wrong (the "missing" map border
is the map's edge drawn solid); the balance findings on Milestone 20, the content pruning on Milestone 12, and the rest
in the backlog.

### F264 — fold `duel` into `skirmish`

> fold duel into skirmish, there's no need to have two commands for the same thing.

**Built.** `duel` is gone. What it did that `skirmish` did not, `skirmish` now does: `--commanders vasse,dob` (or
`all`) plays every pairing from both ends over `--seeds` and says who won by Commander; two sessions play one save a
slot each, `--wait <slot>` blocking until that slot's turn and printing its brief, `--ready` handing in its plan, the
last plan in playing the round; loading a finished battle prints every round's report. The `cmd:` player is gone: a
model plays through the save file.

### F265 — a cleanup pass: the command self-documenting, each document at its level

> Then, take an extra pass to cleanup and refactor. Start from reviewing the documentation around the skirmish command. Make sure it is well organized. To simplify, it helps cleaning up the command code itself so it is self-documenting. Offload imementation details to their modules so the main skirmish file acta more as a "main" module, desicated to declare amd parse the parameters and handling error codes. This file top comment could be the cannonical intronfor the command itself. Then, the documentation mentions the existence of the command, a quick description, and a link to the code. The testing specs can add more examples and focus on explaining how the command is particularly used for the different testing scenarios. The UI code can also make references to keeping "parity with the command". Then, the relevant design spec explains the concept of a skirmish from the gameplay point of view. So all the pieces stay focused at the right level of abstraction, creating a simpler and more modular structure that allows future agents to understand the whole picture, but focus on a specific area when needed, which will make future code changes easier to maintain. It also helps looking for duplication and opportunities to refactor common functionality from UI and command into the proper modules.

**Built.** `src/cli/skirmish.ts` is the command's manual (its opening comment, what `--help` prints), its options, the
request they make, and its exit codes (0 done, 1 could not run, 2 a plan refused, 3 still waiting); one battle, many
battles, two sessions and a testing save are each a module beside it. Opening a battle (a new setup or a save, then the
slots seated with a plan file read) was written twice, once for the screen and once for the command: it is one module
now, `src/skirmish/request.ts`, and the round's report lines another, `src/skirmish/lines.ts`; the screen's files say
they keep parity with the command. The save page says the command exists and links its manual; the testing ground has
how each kind of test uses it, the model-against-model recipe included; the duel page keeps the rules, the brief and
the plan; the game modes say what a Skirmish is to a player.

### F266 — no turns; "plan" becomes build actions

> --wait p1 - what does it mean to wait? note that in Terminal Nexus there are no turns: all players move simultaneously during the build phase. We allow to save with partial build actions (are still calling it "plan" in code, and do you think we can do a naming cleanup here to formalize it as "build actions"), that is particularly useful to save game from the UI in the middle of a build phase, but for testing purposes this is almost never needed. The scripts (and future ai players) can play anytime before or after the current player or players, they should get the exact same view of the battle right before the build phase begins.

**Built.** `--wait` and `--ready` are gone: either slot hands its build actions in alone (kept as the save's draft), in
any order, and the round plays both; a test shows the other slot's brief unchanged by it. "Plan" is **build actions**
in the code (`BuildActions`, `readBuildActions`, `checkBuildActions`, `src/duel/build-actions.ts`), the command
(`build:<build file>`), the brief a model reads ("## Your build actions", saying there are no turns) and the documents.

### F267 — clashes settle gracefully; powers and upgrades apply together

> The game has to resolve any building conflicts gracefully, and we should take advantage of those to make the gameplay more interesting. This also applies to uogrades and powers, they need to be designed with the idea that they get enabled at the start of the battle round, and apply simulataneously if they would conflict on a single frame (e.g damage is reaolved like unit attacks). For example, if two commanders activate a nexus power that "battle round start -deal 100 dmg to enemy nexus", and that would kill both nexus in the same frame, then that would be a rare tie.

**Built** as a rule in the concept ("No turns, and everything at once"), with a test that two Nexuses falling on one
tick is a draw (the kernel already scored it so). No power deals damage as the round starts yet; the rule is there for
the first that does.

### F268 — build files by round

> I have an idea to simplify sxripting with the skirmish command: the build player type loads a file, that file could define the round and action to do at that round, and the round could be a number, a range or an asterisk. This way it's possible to define a single round or multiple rounds ahead of time (in which case they play "blindly").

**Built.** A build file is one object (the first round played) or a list of entries with `"round": 3`, `"2-4"` or
`"*"`, the first that fits winning, played blind; a round it has no entry for stops the battle at that Build Phase
with the slot's brief.

### F269 — conditional build actions from one library of facts

> Expanding even more on this idea, it would be interesting to spin a desicated subagent to explore simple scripting ideas under this format; build actions could be conditional to the resources or game state. The conditionals could read from a centralized library of game state checks, and that would be the same library that scripts use and the ai llm player would use, and scripted missions too, those functions map into a declarative schema that can be encoded in the build json scripts. This would allow for powerful scripting and testing capabilities that works for for in-game intelligence and coding agent alike. Please explore this idea, that could turn into the next PR.

**Scheduled.** Explored by a dedicated agent: [`build-files-with-conditions.md`](../../milestones/build-files-with-conditions.md),
the format (`"when"`), the library of facts over the brief, how scripts, missions and a model player meet it, a first
pull request and six questions with recommendations.

### F270 — one parameter for how far to play

> The skirmish command could then declare a simpler general parameter that says how many rounds to play from there, then pauses and gives brief, for example "--play-until-round=next" or "--play-until-round=4" or "--play-until-round=end" (see what parameter name and format would work better).

**Built** as `--play-to next|<round>|end`: it stops at that round's Build Phase (or at the end), sooner when a player
slot has nothing for the round, and prints the briefs. It replaces `--battle`, `--battles` and `--play-until-win`.

### F271 — capture the structure

> After this iteration, pause for a moment and capture the patterns and essence of the structure that I am trying to describe here. The various levels of abstraction that allow composing the skirmish in a way that reused a lot pf the same structures for the in-game-ui and the command line that is used for testing and verification. [...] It also becomes a tool for communication where the coding agent can prepare playable scenarios for the human tester that would launch the ui at a specific point and play against a specific script or ai.

**Built.** The save page opens on "How the pieces compose": the battle, the record, the seat, the round and the doors,
and what follows (a moment is a file; a player is anything that answers a brief; one rule, one place; shared words).
Every save the command writes at a Build Phase prints the line that opens it on the game's screen.
