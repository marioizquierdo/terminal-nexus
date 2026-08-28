# Checked twice: good for the player, cheap to build?

**Document role:** Every recommendation in this folder checked against both experiences
**Status:** Analysis
**Updated:** 2026-08-28
**License:** Apache-2.0

A campaign design can be great to play and miserable to build, or a joy to build and inert to play.
You have unusual leverage on the second half — a fight resolves without a display in milliseconds, the
tooling can prove two runs are identical, and every rule already has a small saved fight that exercises
it — so "cheap to iterate on" is a measurable property here rather than a hope.

The rule below: a recommendation that helps one side at the other's expense is fine, but it has to be
said out loud. Rows 3, 4, 6, 8 and 10 are where that happens.

| # | Recommendation | For the player | For you, building it | Verdict |
| --- | --- | --- | --- | --- |
| 1 | At most one unlock per mission | One new thing to learn, one line to read, memorable | Forces one hard choice per mission and keeps each mission's content work small | **Both win.** The rare case where the disciplined answer is also the cheap one |
| 2 | An unlock has to change the build menu | Every unlock is *felt* in play instead of read on a screen | **Costs.** It forbids the cheap flavour grant, so every mission owes a real content change. This is the rule that makes the campaign expensive | **Player wins, you pay.** Taken deliberately — an unlock that changes nothing is exactly the rot the system exists to prevent. Softened by describing unlocks as jobs rather than inventing them, and by reusing what already exists |
| 3 | The build phase telegraphs the fight | The highest-value item here. It is what makes a fight you cannot steer feel like your own doing rather than something that happened to you | **Costs, and it grows a screen you wanted to keep minimal.** A marker on the map, an arrival time, effect text in the menu | **Player wins, you pay — and this one needs deciding rather than assuming.** If it has to shrink: keep the arrival timing in text, drop the marker on the map. Most of the value, a fraction of the work |
| 4 | A 60×20 map, big enough to scroll on a small terminal | Mild cost — a first mission that scrolls is slightly harder to read than one that fits | Clear win: the scrolling code gets tested against the real campaign mission instead of a fake map built for it | **You win, player pays a little.** Softened by the layout — base, build zone and the gap in the ridge are all visible together even at the smallest size |
| 5 | Two upgrade options early, three from mission four | Gentle, and it makes the widening feel like a moment | Fewer options means less to balance and fewer authored consequence lines | **Both win** |
| 6 | No difficulty selector | Costs: no valve if a mission lands too hard | Large win — no second balance axis for a game with no balance data | **You win.** Honest mitigation: a mission that is too hard gets edited, which is the same work and produces a better mission rather than a workaround |
| 7 | The lose-everything mission is designed now and built last | They never know it was deferred | Win: it is the mission most dependent on tools that do not exist yet | **Both win** |
| 8 | The second commander waits until after the opening arc | Costs: a good character sits unused for six missions | Win: no second starting package or second upgrade set inside the arc | **You win, player pays.** Softened by having her appear as a voice at mission four, at no content cost |
| 9 | The one-idea-per-mission rule enforced by the repository checker | Invisible | Win, with a real risk: a rule that fights the designer gets deleted | **You win if it is built carefully.** Make the "no two missions teach the same thing" part a warning with an escape hatch; keep the simple presence checks as hard failures |
| 10 | The opening scene running on a different, pre-pyramid interface | Strong win, and probably the best single creative idea in the folder — the campaign's biggest question planted in the first minute, wordlessly | **Costs a lot.** A second look for the game that appears exactly once | **Player wins, you pay heavily.** Which is why it is offered in three sizes: the free version (a line of dialogue you have already written), the cheap version (two lines and a picture), and this one, named as an ambition rather than a plan |

## Three notes that are not tied to one row

**Writing the enemy's schedule into the map file is right partly because of how you debug.** Keeping
the raid as data in the same file as the map means one command resolves the whole thing without a
display, the determinism check covers it, and changing a schedule changes a hash. Putting the opponent
behind a code interface instead would have hidden it from the tool you actually use. That is a
build-experience argument for a decision made on other grounds, and worth noticing because this kind of
alignment usually goes unremarked until it is lost.

**The riskiest thing for your iteration speed is the round length.** Every timing number in this folder
is arithmetic, not measurement, and round length is the parameter most likely to need a dozen passes.
The tooling already prints an outcome and a length as machine-readable data, so sweeping a dozen values
is a shell loop rather than an afternoon of playing. Do that before anybody watches the mission.

**One place you and the player want the same unusual thing.** The telegraph makes the mission fair to
play *and* makes it faster to debug — an arrival edge and a time drawn on screen is also the quickest
way to see that a schedule is wrong. Most of the legibility work in this project has that property and
it is under-claimed: the rule that effects never hide what they are drawn over, the monochrome mode,
and the reduced-motion mode are all debugging tools too.
