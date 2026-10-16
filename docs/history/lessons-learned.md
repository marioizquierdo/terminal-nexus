# Terminal Nexus — lessons learned

Four rounds of Mario's playtest feedback on the Build Phase, each one built, merged and put back in
front of him within hours. Nothing here is a rule; the procedure is the
[`feedback-round`](../../.claude/skills/feedback-round/SKILL.md) skill, and where a lesson became a rule
it says where.

## What worked, and why it is worth keeping

1. **His words, logged verbatim, item by item, with a status.** `docs/history/feedback/` turned four long
   messages into 40 numbered items, none dropped, each ending in "Built" and a plain paragraph. He
   can check his own words against what was built, and the next agent starts from what he said rather
   than from what a summary remembers.
2. **A choice he can feel beats a paragraph he must judge.** Experiments plus the settings export turned
   "which speed feels right?" into one paste: seven numbers and four open questions were settled by
   a single export (round 4). It also gave agents a way to *reproduce what he saw* (`--settings`).
3. **Pure functions of time paid for themselves.** The reducer has no clock; interpolation, the
   animation tracks and the key ramp are pure, so a test asks "what is drawn 80 ms after this?"
   without waiting. Every one of this session's timing features was tested in milliseconds.
4. **Playing it without a terminal.** The scripted playtest (`scripts/playtest.mjs`) and `--keys`
   meant every claim was checked by pressing the keys. It found real things tests had not: the undo
   message read "barracks undone", `--keys` was silently dropped by the argument parser, and the pull
   request's own Demo step ("Esc, then `s`") did not work from the map.
5. **Parallel agents in their own worktrees, from a pinned commit.** Two to three agents at a time,
   each owning files, returning *proposed* canon text that one person (the orchestrator) applied. The
   canon stayed in one voice and the version bumped once per round.
6. **The Demo sized to the change.** A code block for a doc change, a screenshot for a look, a GIF for
   motion, a playable page only when it has to be played — his own rule, and it kept rounds cheap.
7. **Re-reading his quote against what an agent built.** Round 3 asked to "keep clicking … to keep
   scrolling, and double click will place". The agent built "a click activates" and correctly left
   armed clicks still (the canon said so); only re-reading the quote found the missing half.
8. **Small pure primitives named after what game engines already call them.** Tweens, animation
   tracks, particles and shading (`ascii-effects.md` 1.2) are four small modules. "Formalise it like a
   game engine" was the right instinct: each is a page of code and a page of tests.

## What bit us

1. **Parallel agents collide in shared files.** `debug.ts`, `state.ts`, `view/build.ts` and the
   screenshot script were touched by three agents at once. Asking each to append its flags as a block of
   its own kept `debug.ts` clean; the Settings work still conflicted in eight files, and the right fix
   was to send it back to the agent that wrote it, not to resolve it blind.
2. **Scripts that count rows break with every Experiment.** "`d Down*6`" and "v 18 more" were recounted
   three times. Fix: set an Experiment by name (`--settings`) wherever a flow only needs the value
   (pending: `docs/milestones/next-steps.md`).
3. **One fact, five homes.** The armed-click rule lived in AGENTS.md, `engine.md`, `ui-patterns.md`, a
   test name and a feedback log; after Mario reversed it, one copy stayed stale for a whole round. On a
   reversal, grep the old sentence.
4. **A bulk edit almost ate the register.** A script meant to move one open question found "the next
   `### `" — which, for the last entry, was in the Answered section — and would have cut about 900
   lines. Its own size assertion stopped it before writing. Assert what you cut.
5. **Time-based tests flake under load.** With four agents building, the frame-budget tests failed once
   and passed alone and in every later run (machine load about 10). We measured before and after
   instead of loosening them.
6. **Silent parsers.** An unknown command-line option is treated as a flag, so `--keys "…"` did
   nothing and said nothing. A test that the option *arrives* would have caught it on day one.
7. **A number tuned on one keyboard.** His 150 ms "hold window" is right for a fast key repeat and turns
   a slow one's first repeat into a tap. The game guesses "held" from gaps because a terminal sends no
   key-up; that guess is the reason for Q66.
8. **Naming debt.** Debug Mode became Settings with Experiments, but `debug.ts`, `DebugFlags` and
   `BuildState.debug` kept the old name, and dozens of comments said "Debug Mode" until this cleanup.
   A rename is mechanical but touches ~200 lines; do it in a pull request of its own. (Paid on
   2026-09-30, below: `experiments.ts`, and `popup` for what the code called an overlay.)
9. **The gate history in `AGENTS.md` grows a paragraph per gate.** Section 2 is now ~120 lines every
   session reads first. Compact it after Mario accepts a milestone (`docs/milestones/next-steps.md`).
10. **Tooling wrinkles, none serious.** The GitHub connector adds a second footer to a pull request body
    (read it back). The Artifact tool refuses a republish until you have read the live version. The
    connector and the check-in trigger disconnected or failed a few times: retry, and keep no state
    only in a trigger.

11. **A red assertion in the live-loop test looks like a hang** (gate 6A round 2).
    `tests/build-lifecycle.test.ts` leaves the terminal loop running when an assertion throws, so Node
    never exits and a fifteen-minute "run" is really a one-line failure. Run it alone with
    `node --test --test-timeout=30000`, and run the whole suite the same way when editing it.
12. **"Only this flashes" needs a scope.** Reversed video is also the cursor and a spark out on the map,
    so a test that says "nothing else is reversed" over the whole frame is false on the first fight.
    Assert inside the panel, and assert the light's cells on the border.
13. **A colour cue is tuned by looking at it in four places.** The light read well in the dark theme and
    needed checking in the light theme (where "toward white" is dark ink), in monochrome (bold) and at
    16 colours (a step, not a blend) before the pull request could call it done.

## The menu spike's second round and the general review (2026-09-30)

1. **Renames first, by one hand, then parallel agents.** The review wanted about a dozen renames that
   touch every layer (popup, see-through, experiments, the game menu, the Battle Round). Doing them
   sequentially, by hand, before starting the three fix agents meant the agents all built on the new
   names, and their merges met one conflict (an import line in a test). The reverse order would have
   put the same rename into three branches.
2. **Let the compiler find a renamed string literal.** Changing a union member (`"menu"` to
   `"game-menu"`) and reading the type errors found every comparison, `case` and assignment in the
   source; only runtime assertions in tests (`assert.equal(x, "menu")`) escaped it, and one failing test
   named each of those.
3. **A worktree agent may start from `main`, not from the branch.** All three fix agents found their
   worktree at `main`'s commit and fast-forwarded to the branch tip because the prompt named the commit
   to start from. Always name it, and say what to do if the worktree is elsewhere.
4. **Two agents' changes can meet only when merged.** The renderers agent's capture script read
   `SETTINGS_ORDER`; the reducer agent deleted it in the same hour. Both passed their own tests; the
   capture script (plain JavaScript, not typechecked) failed only when run after the merge. Run the
   evidence script after merging, not only each agent's checks.
5. **A review agent that only reads is cheap and finds real bugs.** Four read-only reviewers (by
   area) returned about seventy-five findings, three of them bugs confirmed by running the code. Asking
   each to say which findings it had verified, and to mark mechanical versus behavioural, made triage
   quick.
6. **Keep the tests for last when the code under them moves.** Reorganising the tests while three
   agents changed the code they test would have conflicted everywhere; one test agent afterwards, on the
   merged code, had a stable target.
7. **Timing tests flake while agents build.** The frame-budget test failed once in three runs with two
   agents testing at the same time (load 8 on 4 cores) and passed alone. Re-run before believing it.
8. **Settle the export and add the round's Experiment slots before splitting** (third round). Doing the
   export's retirements and adding both new Experiments' fields by hand first meant neither agent had to
   touch the Experiments list, the one file every round's agents had collided in; the two merges met no
   conflict at all.

## The documentation reorganisation (2026-10-01)

Six pull requests in one day turned five folders and 25,000 lines of mixed documents into three shelves,
with no versioning ceremony left. What it taught:

1. **Plan the structure first, in a file Mario can edit, with the open choices listed and a
   recommendation each.** He answered six choices in one message; nothing was moved before that.
2. **Move text and change what it says in different pull requests.** The move pass was reviewed as "did
   anything get lost"; the rewrite passes as "is this true now". Mixing them would have hidden both.
3. **Snapshot every link before a move, recompute after.** A script recorded each Markdown link's
   absolute target, then rewrote 694 references in 113 files; the link checker proved it. Hand-fixing
   would have missed the relative links inside moved folders.
4. **Make the validator warn before it fails.** Retiring the old words everywhere took four passes;
   the check reported hits as warnings while the plan file existed and became a failure the day the
   plan was deleted. Nobody had to remember the rule, and no pass was red.
5. **Do the cross-cutting rename alone, then fan out.** The `--spike` rename touched every area; done
   first by one hand, six agents then cleaned comments on disjoint files with no conflicts.
6. **Give each agent a file list, a grep that must come back empty, and the tests for its area only.**
   Running the whole suite from six agents at once would have flaked the timing tests; the
   orchestrator ran it once at the end.
7. **An agent's "left on purpose" list is the review.** Each report named what it did not change and
   why (a hashed version string, player-visible strings, a game concept that shares a retired word);
   those became the pull request's known issues, not surprises.

## The feedback loop itself (2026-10-01)

The end of the menu spike was the smoothest stretch yet: Mario played on a laptop and a phone, sent notes,
and each round was built, shown and back in front of him within hours. What made the loop work, rather
than any one feature:

1. **The settings became the channel, so they got a structure.** Experiments began as a debug popup. Now
   every setting is declared once with its tier (the player's own, an Experiment for Mario, or a tuned
   constant), so an agent asking a question, Mario answering it, and the answer becoming a constant are
   each a one-word edit (`src/build/all-settings.ts`). When a way of talking to the owner works, give it
   a real place in the code.
2. **An export is a message, and old messages must still read.** A renamed setting maps to its new name
   and a settled one is skipped quietly, so a paste from last week still shows what he saw.
3. **Recorded timing made feel reproducible.** The playtest notation learned timing (`Right~250`), so
   "the third quick tap should speed up" became a script, a test and a GIF.
4. **Rounds grow opportunistic fixes; name them.** A round always turns up small refactors and bugs
   beside what was asked. The pull request's **Additional changes** section says so openly instead of
   burying them.
5. **Check "merged" against the remote before acting on it.** Mario said a pull request was merged;
   `main` did not contain it. Checking before resetting the branch kept the follow-up on the right pull
   request.
6. **A log answers what a setting cannot.** "Which feels right?" is an Experiment; "what happened when it
   felt wrong?" needs a record. The Activity Logs declare each event in a schema and export through the
   game menu, so a playtester pastes the evidence instead of describing it.
7. **A proposal is cheap; write it before building it.** The deep dive on a feedback pipeline took an hour
   and Mario cut it to something far simpler the next morning; nothing built was thrown away
   (`docs/history/reports/2026-10-01-feedback-pipeline-parked.md`).
8. **The numbers that index his words are for agents.** "I don't understand references like F87, they are
   not very useful to me": replies, pull requests and documents he reads name the request in words.
9. **Review the branch with an agent that only reads, before opening the pull request.** It found the
   Activity logs list was a cut-off rather than a copy (a full log dropped rows from under the reader),
   held keys filling the log, and a demo with broken keys failing silently, all fixed before anyone saw
   them.
10. **A documentation reorganisation can land while a pull request is open.** Merge it, take the new
    documents wholesale, then re-apply your additions in their new homes and new words; and grep your own
    new code comments for the old citation style (feedback numbers, section numbers, dates), which the
    reorganisation had just removed everywhere else.

## The Barracks that trains (2026-10-01)

1. **Opt a rule in, and absent means absent.** A recipe on the shared Barracks would have moved the hash
   of every map with a barracks on it. Giving the recipe through the mission, and keeping a producer's
   timers off every state that has no producer (the canonical form skips an absent key), left every
   existing hash and the state's schema version where they were. A field that is `0` on everything is
   not the same as a field that is not there.
2. **Measure the mission before choosing a default.** A first guess of a trooper every eight seconds let
   a plan that builds nothing win PERIMETER, through a timing edge in the annihilation rule rather than
   through defence. A table of every pace the Experiments offer (in the step's report) took a minute and
   picked a default that keeps the waves' tuning.
3. **"Add your filter at the top" is a convention the tests do not share.** Eleven Activity logs tests walk
   the filters by position; a new first filter broke them all. The question's filter went last instead,
   one Left from where the window opens.

## The Commander (2026-10-01)

1. **A new unit on a fixture side moves every outcome, so measure the mission before and after.** Adding
   Vasse to PERIMETER's squads let a plan that built nothing win (through the old annihilation rule), ended
   round 1 before the Barracks's first trooper, and, listed last rather than first, moved every squad
   member's starting tile and had her fall behind every Turret plan. Each was found by playing the mission
   round by round across a few plans and her numbers, not by the tests that failed.
2. **A decided rule a new feature leans on goes first, in its own commit.** Mario had just answered that only
   the Nexus falling loses a round, and asked for it later. The Commander made the old rule decide the
   mission, so the rule was built first, alone, green on its own, and the Commander built on top of it: the
   history says which change moved which outcome.
3. **A test that samples a Pulse in steps can step over a short phase.** One-second steps happened to land in
   the half-second cease fire until round 1's length moved. Sample at a fraction of the shortest phase you
   assert on.
4. **Measure again before the pull request repeats a claim.** The report's outcome table shortened two rows to
   "held", and a fixture's comment carried the milestone's hope (PERIMETER does not force her death) as a
   fact. Measured again for the description, she falls in the last round of every plan at every health. A
   hope from the plan is not a result until a run says so.

## The Commander's second round (2026-10-03)

1. **A trail must be the way the kernel walks, not a straight line.** The first trail ran straight from the
   ridge to the Barracks, across rock the raid walks round; units step greedily toward their target and can
   stand pressed against a ridge face. The trail is now the kernel's own steps, from the unit whose walk
   arrives, and shows the raid pressing on the ridge when none gets through.
2. **A screen that opens something by itself changes every test that starts there.** PERIMETER's intro would
   have taken the first keys of every round-1 test and key script. The session decides whether scenes play
   (on in the game, the browser page and the playtest; off for a session a test builds, unless asked), so the
   tests kept their meaning and only the documented key scripts gained an `Esc`.
3. **Parallel workers collide in the files they share, not the ones they own.** The session's options, the
   composition's input and the round loop each took additions from both sides; naming in each prompt which
   hunks the other worker would add kept every conflict a keep-both, resolved in minutes.

## The Commander's third round (2026-10-04)

1. **Write the seam before splitting the work.** Routes and bundles both needed "a level by id, opened at a
   round". Building that one small module first (`src/cli/levels.ts`, with its tests) and naming it in both
   prompts let the two workers build on it at once without touching each other's files.
2. **An address part can hold `&` and `=` of its own.** The browser page once read `#settings=` up to the
   next `&`, which a route's query or a settings text in `a=1&b=2` form would cut in half. A part now runs
   to the next part the page knows (`&at=`, `&settings=`, `&keys=`), so links are written as plainly as a
   command line (`src/web/address.ts`).
3. **The browser page's sandbox has only the language's own builtins.** The bundle loader first froze a
   `structuredClone` of what it read; the page's sandbox test, which runs the bundled code with no host
   features, failed on it. It now copies by hand. A pure module that may reach the page uses the language,
   not the host.
4. **Data that names code can force code to move.** The bundles name the starter map, and the catalog now
   reads the bundles, so the map could no longer live in the catalog without a circular import; it moved to
   `src/build/maps.ts`, re-exported where it was, and no importer changed.

## The Commander's fourth round (2026-10-04)

1. **A new placement rule moves every test that places a building.** Construction territory refused dozens of
   placements chosen years of rounds ago for the camera's convenience. Pin a placement to what it means (inside
   the range, beside the Barracks), not to a coordinate, and the next rule moves fewer of them.
2. **Two checks for one invariant leave a loophole between them.** Removal was first checked with "still
   linked", placement with "inside the range": a stepping-stone building could be placed, built past, then
   removed. Check the invariant you mean (the plan could still be placed, a building at a time).
3. **A faint wash is invisible at 16 colours, the player's default, and in monochrome.** An area needs a glyph
   at every depth: the build range is the ground's own dots, the wash only adds light where colours blend.
4. **Do the renames before the split.** Renaming bundles to armies and removing a word from the game touched
   forty files; done first, on its own commit, it cost four agents nothing.
5. **A label that follows a moving unit tile by tile cannot be read.** When presentation knows the future (a
   resolved Pulse), choose a label's place once from everything it will be shown over, and hold it still.
6. **A see-through wash over a glyph changes its hue at 256 colours.** An area's wash belongs on the ground's
   band, under what stands.
7. **A planner that knows the future plans every line around a cut-in**, so nothing is ever cut in on; let a
   line being read give way, once it has been on screen long enough to read.
8. **Two rules that change a fight are measured together.** The aura alone let a plan that builds nothing
   hold PERIMETER; the troops' target alone made a lone Hatchery or Barracks lose. Measured together, the level
   kept its shape. One agent built both and re-measured once, which also kept the hash pins moving once.
9. **To compare a page before and after a refactor, freeze its clock.** A breathing dialog or a playing Pulse
   draws a different frame every time it is looked at; with `Date.now` and `performance.now` pinned before the
   page loads, every opening is the same frame run to run.
10. **A negative zero in a coordinate slows every frame.** `-across` at a diamond's tip, or `-1 * 0` for a
    spark that has not moved, is `-0`, which V8 cannot keep as a small integer. One stored in an `{ x, y }`
    makes V8 store that field as a double in every object of that shape from then on, and every cell drawn
    after it pays to convert: the build range's diamond made the Build Phase frame a third dearer, and CI's
    busier machine ran it past the 16 ms frame (the sparks had cost main a little all along). Count tiles in
    their own coordinates (`centre.x - across` to `centre.x + across`), never as offsets that can be `-0`, and
    `| 0` a product that can be. `node --no-sparkplug --trace-generalization` names the store that did it;
    `--trace-migration` counts what it costs.

## The Commander's fifth round (2026-10-05)

1. **Changing what a building makes can flip a level.** Four troopers at five seconds, instead of one every ten,
   made PERIMETER's last round hold with nothing built. Measure the level's plans whenever a building's numbers
   change, and say what moved in the pull request rather than retuning quietly.
2. **A battle's content comes from the level's offer.** A hand-written mission played on a campaign level's
   context inherits that level's spawning buildings; the test mission plays on `placeholderContext()` so its
   pins hold.
3. **A rule that takes something away moves every flow that leaned on it.** Without chaining, every fixture
   that placed a building beyond another planned one moved into the standing range, and the screenshot script's
   flows had been failing unnoticed since round 4. A script whose flows nobody runs rots: check every flow's
   expected text with the renderer stubbed, which takes a minute.
4. **Check a new mark against every mark in its colour, not only its glyph.** A unit's reach in the raid's
   colour read as more of the raid's trail, whose diagonal steps use the same strokes.
5. **An animation that never settles changes what "idle" means.** The moving trail made "an idle screen draws
   nothing" hang a test: give such a test a round with nothing ambient, and test the ambient pace on its own.
   Start a motion's clock from the first frame that draws it moving, or "a route opens the screen you reach by
   playing there" breaks.
6. **A merge can break a test both sides passed.** The explored-unit reach test assumed the trail's old marks;
   the merged trail keeps its whole way clear. Run the whole suite after every merge.
7. **The capture scripts delete `.capture-tmp/` when they finish.** Tell an agent to keep the scratch it needs
   elsewhere in its worktree, and ask for the key scripts rather than the files.

## Tall tiles, felt (2026-10-05)

1. **Time a race by where the runners are, not by their first blows.** The Ground test's first blows measured who
   the player's troops stepped out to first, so under rows x2 the northern raid still struck first though both
   walked the screen at one pace. Time each runner's front coming a set distance in, before anyone meets it.
2. **A test map's edge can hide the shape it is for.** The Ground test's Nexus stood two rows from the bottom, so a
   Turret's reach lost its lower half off the map under every choice but one. Leave a reach's room on every side
   of where it is placed, and look at the picture before trusting the test.
3. **A look-ahead shorter than a stair makes a direction flip.** Under rows x2 a diagonal way is two steps across
   and one down; trail arrows that looked two steps on turned from `<` to `/` and back as they moved. Look a whole
   stair on, and read the slope as the battle measures it.
4. **Check a slope rule against screen angles before changing it.** The trail's `across >= 2 * down` reads like a
   row weighted twice, but its two thresholds were mirror images in tiles; the spike's report had it wrong.
5. **A design sentence about what the eye sees is worth a picture.** The presentation design said one column a
   tile squashes the Grid "horizontally" into a wide rectangle; a tile is tall, so a square reach is drawn tall.
6. **Read strictly what the build writes, leniently what a person pastes.** The page build read a demo's settings
   text as a pasted export is read, skipping what it did not know, so a misspelt value opened the demo with the
   default and said nothing.
7. **A scratch copy of the repository inside a worktree is read as the repository**: the validator and Bun's
   runner both walk `tmp/`. Keep such copies outside the worktree.

## Rows x2, the rule (2026-10-06)

1. **Pin the kept path's hash before removing the others.** Taking out the Ground's four choices reproduced, event
   for event, the hash the rows x2 choice had pinned: the proof that one rule replaced four without changing the
   one that was kept.
2. **A promise like "walking time is distance" needs a test over every rate, not the table's.** Credit capped at a
   step's cost threw away a different remainder across than down, so eight of the twenty-eight rates walked down
   faster than across; the cadence test only held rates that divide evenly. A step now takes whole beats, and a test
   walks every unit both ways.
3. **Cap where the step is taken, not only where it is chosen.** A unit that lost its claim on a step down took two
   quick steps across: the "no banked sprint" promise held on the intents path and not in arbitration.
4. **A reach the rules work out can break a rule the content keeps.** A worker's flight, its attacker's range and two
   more, was 3 against melee: the one odd reach left, and it missed a threat straight above. Test derived reaches
   beside declared ones.
5. **Mutation-test what a design document claims.** Deleting the placement preference, the touching clause for
   contact triggers, or the forecast's stop condition passed the whole suite; each now has a test that states it.
6. **Say the length of a walk, not of a line.** The distance map first read as the distance on screen "whichever way
   it lies"; off the axes a walk is longer than the straight line. A sentence about geometry needs the same check as
   a number.
7. **A lazy pattern over an empty block reaches into the next one.** The pictures' first redraw matched from an
   empty code block to the next fence and swallowed the text between; read a block line by line up to its own fence.
8. **Draw a design document's pictures with the game's own code.** The grid design's six pictures are drawn by the
   rules' functions, the kernel's walks and the opening's own search, and a test fails if one drifts, so the
   explanation cannot quietly stop being the game.
9. **Setting a group down round changes when its blow lands.** Round groups spread along their way in, so a raid's
   first blow came later and a test's "the Nexus falls with no defenders" needed a heavier raid of its own.

## Genre words (2026-10-07)

1. **A name a player reads comes from one place: the card.** The battle feed built names from content ids and the
   bottom line from the content's short name, so a Turret fired as "beam" and a Swarmer was trained as
   "spawnling"; no test read a feed line naming a bench building. A view that names a thing asks the card for it.
2. **Read the game's words the way a player of the genre would.** "Touching", "arms", "stop and go back", "40
   back" and "goes for" each read plainly to the person who wrote them and as invented to a player who knows
   "melee", "select", "cancel", "refunded" and "targets". A review of every string, by someone who did not write
   them, found about thirty to weigh.
3. **Bun stops a test at five seconds; Node never does.** One dialog test plays PERIMETER twice and takes 5.4 to 6.5
   seconds under Bun in a cloud container, on `main` as well, while CI's runners pass it. Measure a slow test on
   `main` before blaming the change, and never loosen it to make a slow machine pass.

## The Nexus draft (2026-10-07)

1. **A walk to a later round makes no choice a player would see.** The route that opens round 2 or 3 kept the first
   power dealt so the round could start; while every power was credits that changed nothing, and once powers were
   real "the first" was Drill Schedule, so the route reached a battle no player who builds nothing sees. A walk now
   keeps nothing, which the optional pick allows.
2. **Give a new kind of randomness a stream of its own.** The dealer draws from its own seeded stream, so adding it
   moved no battle and no pinned hash; the test that holds it plays two different hands with nothing kept and
   compares the battles.
3. **"Active" means still in force.** A Reserve Callup kept in round 1 stayed on the active list in rounds 2 and 3,
   as if two more troopers came every round; a power spent when it is used (credits, units called up) is active
   only in the round it is kept. Playing three rounds found it, not the tests.

## The draft's design (2026-10-07)

1. **Quote voice notes as they arrived, and bracket the meaning.** His notes come through voice transcription: "sub
   counters" was soft counters, "a texture" the tech tree. A first draft of the design quoted him with the words
   fixed, which put words in his mouth; the documents now keep his words and say in brackets what a misheard one
   meant.
2. **Draw examples before writing rules.** Drafting four Commanders' hands round by round, kept out of the
   repository at his request, showed that what the Commanders needed was a short list of things they may bend
   (hand size, the schedule, redraws, a second pool, what shows), not a feature each. The rules came out shorter for
   it.

## The Nexus Pulse (2026-10-07)

1. **A word that changes meaning cannot be renamed by a script.** "Pulse" meant the battle and now names the round's
   opening, the Nexus Pulse. A bulk replace of the battle's "Pulse" with "Battle Round" in comments also rewrote six
   new lines that meant the Nexus Pulse. Exclude the new compound from the pattern, then read every hit by hand.
2. **Two seeds often deal the same hand from a small pool.** A test that the dealer draws from a stream of its own
   assumed a nearby seed would deal another hand, but PERIMETER's first round has two commons for its two common
   cards, so only the uncommon can change, and that seed dealt the same one. The test now looks for the first nearby
   seed that deals a different hand, and says why.

## The Commander on screen (2026-10-13)

1. **A playtest that fails leaves the last run's screens behind.** With its output thrown away, a broken run of
   `scripts/playtest.mjs` looked like a working one: `.playtest/<name>.txt` still held the run before the change. The
   change had made an import cycle (a new view module importing the map's module, which imports the menu's, which
   imported the new one), and a constant was read before it was set. Read the command's own last line before the
   file, or give each run a new `--name`.
2. **A new block in a full panel takes its rows from something.** The Commander panel's three rows cost the raid's
   words their kinds, then a group, at 80 × 24. Say which comes first, and fall back to a smaller form (her one line)
   instead of cutting what is more important.

3. **An animation at a round's opening is real time the live screen spends.** Her appearance asks for frames for its
   first few seconds, and two tests that wait for an idle screen in real time failed, and ran long, until it was
   tied to the switch that turns a round's opening scene off. A new moving thing needs a way to be off, and every
   test that waits for stillness needs to know it exists.
4. **Remove a feature the owner reverses whole, by restoring its files.** The Commander panel touched the raid's
   words, the menu and the battle panel; restoring those files to the commit before it took one command and left no
   half-removed branches. Keep a feature's changes in its own files where you can, so it can leave as cleanly.

## Dropping the 16-colour depth (2026-10-15)

1. **A depth whose colours the terminal defines cannot be derived, mixed or checked.** The sixteen ANSI colours are
   the player's terminal theme's, so there was nothing to match against and nothing to blend toward. Matching them
   against xterm's defaults had already been measured and rejected (it sent muted text to bright black and gave both
   sides the same grey), so the table stayed hand-authored: twenty-six roles on eleven codes in the dark theme and
   eight in the light one, where the player's colour, the danger colour and the blast were one red. A depth that
   needs its own table needs its own playtest, and the owner had the bandwidth for one look, truecolor.
2. **Pin the rule, not the incident.** The 16-colour tests were "never ANSI 90 for the frame", "never cyan for
   orange": each a past bug, none the reason it was a bug, and nothing that said two roles must differ. The 256
   tier's reason to be safe is one sentence, held for every role in both themes, tinted and faded: it never draws
   index 0 to 15, because those are the terminal's (`tests/roles.test.ts`).
3. **Fail toward the floor.** A terminal that advertises nothing gets monochrome, which sends no colour code and so
   cannot print garbage or fight the terminal's theme; the other error, colour codes sent to a terminal that cannot
   read them, can. A saved setting that names a depth that is gone reads as the default (also monochrome), field by
   field, and keeps the file's other settings.
4. **A tier that "degrades" still has a floor to author.** Truecolor to 256 is free, and monochrome is free as a
   depth, but every blend (fade, tint, see-through) still needs its monochrome form (a glyph, a weight, inverse video)
   wherever it carries information. Dropping the middle tier removed the third form to write, not the second.
5. **The terminal's background is not the game's.** The ANSI writer sets no background on a plain cell, so the
   terminal's own shows through while fades and mixes blend toward the game's assumed ground. It does not show on a
   near-black terminal, which is what the screenshot tool simulates (`#0c0c0c`), and it is the real answer to "what
   about Solarized" (Q79), not the sixteen colours.

## The game owns its colours (2026-10-15)

A second round on colour, the day the 16-colour depth went. What it taught:

1. **A name that is three names is a bug.** The setting was `--capability` on the command line, "Colour depth" on the
   screen and `CapabilityMode` in the code, and "capability" suggested a fact to detect when it is a choice to make.
   Name a thing once, for what it does, and let one table (`DEVELOPMENT.md`, "The display options") list the flag, the
   label, the saved field and the values. Keep the old name readable in saved files and refused, with the new name, on the
   command line, so a note or a settings file from last week still works.
2. **Leaving the terminal's background to show through was the cause of the light theme "not working".** Dark text on
   a theme the player had picked, over whatever their terminal's background was, is dark on dark on any dark terminal.
   The earlier fix (brighter and darker palettes, then a note that the theme should match the terminal) treated the
   symptom; painting the background made the theme a choice of look and the symptom disappeared. When a colour looks wrong
   on one terminal and right on another, look for a colour the game never set.
3. **Every terminal attribute that means "whatever this terminal does" is a colour the game does not control.** Default
   colour, faint and reverse video each differ from one terminal to the next (faint is a blend toward a background, a
   darkening, or nothing). With colours the game now resolves each into the two colours a cell has, and sends colour
   alone; only monochrome, which has no colours to resolve them into, sends the attributes. One function works the
   colours out exactly, then one last pass turns them into the depth, so a new effect has nothing to write per depth.
4. **Match colours by how they look, not by how far apart their channels are.** A nearest match in RGB sent a dark
   green to a grey and a faded red to a brown; the same search in Lab keeps the hue. Both stay limited by the xterm
   cube, which is coarse at its dark and pale ends, so the real fix for a role that lands badly is a few points of
   nudge toward the cube, held by a test, not a cleverer search.
5. **A number bought at the cost of the colour is not a win.** The light theme's `player.b` was made near-black to
   reach a mutual contrast of 3:1 for red-green colour blindness, and became plain text (and a grey at 256 colours).
   Measured instead by simulating protanopia and deuteranopia, the readable green is as far from the rust as the
   near-black one was; the 3:1 floor guarded something the simulation says was never at risk. Test the thing you mean
   (apart for a colour-blind player, a faction that reads as its colour) rather than a proxy for it.
6. **A picture is the only check that finds a palette fault.** Both the near-black green and the hairline between rows
   at 256 colours (the screenshot's own page, a different colour from the background) were found by looking at the light and
   the 256-colour frames, not by any assertion; the assertions were written afterwards to keep them found.

## The curve on the Grid (2026-10-15)

1. **A trigger id names one trigger in one mission, not in the file.** A script that tuned the new level's raids
   found `raid-1` by searching the army file and edited PERIMETER's, which comes first; fifteen tests failed at once,
   none of them about the new level. Scope a data edit to the level it is for (find the level, then the trigger
   inside it), and diff the file against the last commit before measuring anything with it.
2. **A level's later rounds must be reachable by a player who builds nothing.** Routes open a round by playing the
   ones before it with nothing built, so a level whose Nexus falls in round 4 to an empty plan has no round 5 to
   open. The curve level keeps it with a rule a player can read (the Nexus sends two troopers each round), not by
   tuning raids until an empty plan scrapes through.
3. **Measure what was bought, not what walked out.** Counting a unit for the round it first stood made the opening
   look small; counting it for the round its building was bought (the spawn event's `trainedBy`) showed the opening
   paying for the whole match. The question a design asks decides the attribution.
4. **A multi-tile unit can jam its own building.** Survivors come home round their buildings, so a wave of 2x2
   sentinels found room for one or two of three. A building's unit should fit the ring it comes out on.

## Supply and building actions (2026-10-16)

1. **A cap frees places only as units fall.** The supply cap held the army's size, and the opening's share barely
   moved, because on an easy level the early units live. Before expecting a rule to change a measure, ask what has to
   happen on the Grid for it to bite; here, attrition.
2. **A free-looking letter may be an arrow.** `h` was the obvious key for Hold, and `h j k l` move the cursor
   everywhere; the keyboard tests caught it. Grep the keyboard adapter for the letter before naming a key.
3. **Arithmetic two layers share belongs below both.** Supply was first written in the kernel, and the Build Phase
   could not import it (the reducer never reaches the kernel). Content's own arithmetic lives with the content, where
   every layer may read it.

## Habits to keep

- Say what you did not verify: "no human has played this build", "the probe has not run in iTerm2".
- Put the reason a number is what it is beside the number (`DEFAULT_MOVEMENT`), and the device it was
  tuned on.
- Leave the branch clean for the next session: merged worktrees removed, the branch reset to `main`,
  the trigger deleted.
