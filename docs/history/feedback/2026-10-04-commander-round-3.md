# The Commander, round 3 — navigation, bundles, intent, and Commanders who die (2026-10-04)

Mario read the second round of the Commander pull request (60), said it was great, and, asked what I would
like to see built, sent four notes. They continue
[`2026-10-03-commander-round-2.md`](2026-10-03-commander-round-2.md)'s numbering. Two are architecture to build
now (navigation by route, and content bundles with a campaign at the top); one sets the direction of the next
iteration on intent; one settles that Commanders die as part of the game. Built on the same pull request as a
third round of the Commander step. Status values: **Built**, **Scheduled**, **Open**, **Contested**.

### F110 — Navigation by route: `--at` and `--settings`, the same for direct links

> command flag to go straight into the build-phase should refactor into a more generic auto-navigration
> feature. The general idea is that the bare command (no flags) should start the game normally, which should
> load state from a saved game file at a default expected location. We didn't imement that yet, but that would
> be the idea. The flag that we want to enable for quick navigation is basically a url/path location "--at" that
> for a test campaign level like this could be "--at 'campaign?level=vasse-test-1&wave=0", and possibly also
> "--serttings 'foo=6&var=true' to allow setting overrides. We should develop the routing schema for the menu
> that also works for dirext links. This model will allow us to target any area of the game by defining the
> routing later as well, so this should be well documented when we can verify it works.

**Built.** `--at <route>` opens the game anywhere a route names: `menu`, `campaign`, `challenge`,
`settings`, `about`, and `campaign?level=<id>` with `&round=N` (counted from 1, as the screen counts) or
`&wave=N` (counted from 0, as he wrote it: `wave=0` is round 1). A later round is reached as a player who
builds nothing reaches it, so a route to round 3 opens the same round 3 every time. A broken route is refused
whole, every problem at once, each naming what exists instead. Each title menu row names its route and
choosing it follows that route, so a row and its route draw the same frame. `--settings` reads
`foo=6&var=true`, and every on/off setting takes true and false. The browser page opens `#at=<route>` in a
local copy, and a demo may carry an `at`. The scripted playtest takes `--at` too. The bare command still opens
the title menu; the saved-game start is written down as the intended one, not built. `--build-phase` stays one
more release as an alias. The schema is in the new routing page, and a test opens every route it names. The
Activity Logs say which route a session opened at.

### F111 — The campaign's deck is not the run mode's: bundles, with the campaign at the top

> Commander decks: we should differentiate between the commander deck for the campaign and for the run mode or
> later multiplayer modes. For the player, they are similar, but from the development side they don't have to
> be the same. The campaign will change what is available on each level, and will show the unlocked buildings,
> and powers in between levels. The only thing we have to worry about now is the structure, that we can change
> later of course, but it should be a good ground start to define a commander campaign. We are defining the
> Vasse campaign (commander, buildings, army, powers, campagin levels, progression, etc), those definitions
> benefit from having as much configuration and as little code as possible (so it is easier to define new ones
> as community mods), and then, the run mode can have it's own definition that builds on the same units and
> powers, but a different type of progression. There are common buildings and powers that other commander
> decks can refer to. I hope this gives u an idea of how to organize the code to be modular, as a tree where
> the campaign progression is a the top, depending on levels, that depend on buildings amd units (that may be on
> the same bundle or another dependent bundle like the common). We will only know how to organize it after we
> have 3-4 different commanders, but we should have a general good idea of where to start.

**Built.** This reverses the single deck of the second round (one Commander deck, overridden by a mission).
Content is now organized as bundles, data rather than code: a folder under `bundles/` whose `bundle.json` names
the bundles it builds on and sees only what they bring. `common` holds the three bench buildings and the two
placeholder Nexus powers any Commander may use, and the bench units the first levels put on the Grid. `vasse`
requires it and holds her Commander and her campaign, its levels in order: PERIMETER, then the Commander's
cadence as a second level, so her return can be played by route. Each level names its map, its credits, what
it unlocks and its mission; both missions moved into the data unchanged, and a hash of each holds that. What a
level offers is everything its campaign has unlocked by then, and it records what is new, for the screen
between levels (not built). The loader refuses a broken bundle with every problem at once, each named. A mode
now offers cards its own way: the run mode's definition is written down as a section of a bundle beside the
campaign, not built. Still code, named by id from the bundles: the units' and buildings' definitions, what a
power's effect does, the map and the mission vocabulary.

### F112 — Intent: not a tower defence; your own units' targets too

> Enemy intent: is looking very good. We will iterate more about how to show intent without lookong like a tower
> defense game; your units should also have a clear target to property be an auto-battler.

**Scheduled** (a later iteration). The raid's intent stays as built. The next iteration on intent shows what
the player's own units go for, from the same prediction, and looks for a way to show intent that reads as an
auto-battler's plan rather than a tower defence's lanes. Recorded in the backlog with what the prediction can
already give.

### F113 — Commanders die; the lore and the intro levels say so

> Vasse survivavility is fine; commanders die on this game, is part of the gameplay so we better integrate that
> into the lore and the campaign intro levels

**Built.** The known issue that Vasse falls in PERIMETER's last round is closed: it is the game working. The
lore now says a Commander's death is the Nexus's ordinary business: it restores her a round later and files
what it kept. The campaign design stops saving a Commander's death for its third mission: PERIMETER teaches
the cadence, and the third mission keeps restoration as its subject, what the Nexus restores and what it
files about her. The round she is out opens on a line saying so, the camera on the Nexus, as the round she
returns already did.
