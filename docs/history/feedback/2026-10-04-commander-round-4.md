# The Commander, round 4 — placement with range, Vasse as a hero, Battle Rounds, armies (2026-10-04)

Mario read the third round of the Commander pull request (60) and answered the ideas I had offered (a
building showing what it will cover, a post for the squads, Commanders that matter, her voice in battle,
more Nexus powers) and the two decisions it asked (rounds or waves in a route; the bundle format). He asked
for the work to be done by subagents, and for this last round to also look at code simplicity before the
next milestone. They continue [`2026-10-04-commander-round-3.md`](2026-10-04-commander-round-3.md)'s
numbering. Built on the same pull request as a fourth round of the Commander step. Status values:
**Built**, **Scheduled**, **Open**, **Contested**.

### F114 — Placing a building shows its range, and where it may be built

> Placing a building shows what it will cover: yes. If a building has range, we should show that on the
> ghost cursor while placing it. I'm not convinced about the pulse troops intent, because this game is an
> autobattler like Clash Royale, not a tower defense. Don't over-promise on the enemy route, but the
> building range yes, we should have a cool and unobstrussive way to show where the turrets will reach, and
> other buildings later will also have a range to show. They also can only be built within the build-range
> of the other buildings, so we should also reflect that. Hopefully there's a way to represent that in ascii
> without too much noise.

**Built.** A Turret's ghost shows where it will reach: a thin outline round it, in its colour, moving with
it, and round a placed Turret the cursor rests on. Any building with a range will show it the same way.
Construction territory is built: a building may only be placed inside the build range, the ground near the
Grid Nexus and every building linked to it, buildings linking where their ranges meet. While one is armed,
that ground is drawn densely dotted and faintly lit, so it reads in monochrome too. A plan can chain outward,
a building another one needs cannot be removed from under it, and a refusal says "outside your build range"
and where. How far the range reaches is an Experiment, Build range (2, 3 or 4 tiles; 3 to begin with, the
smallest at which the starting base is linked). Nothing claims what a range will catch on the raid's way: the
raid's trail stays as built.

### F115 — No posts yet; a level names where your troops go

> Give your squads a post: maybe this can be an experiment, perhaps that is a type of building. But before
> we start playing with posts, I would like to go deep on the simple building placement first. The campaign
> levels should have a target well defined so it is presictable where your troops are moving.

**Built** (the target); posts **Scheduled** (the backlog, as an Experiment or a building, after placement). A
campaign level names the target the player's troops head for: PERIMETER sends them to "the line", five tiles by
two just ahead of the base, between the Nexus and where the raid comes round the ridge. Every fighting unit of
the player's side — the squads, Vasse, the Barracks's trainees, the survivors carried over — heads there, turns
on an enemy that comes within reach on the way (6 tiles, or a longer attack's range), and stands at the line
when nothing does. The Build Phase says it under the raid ("YOUR TROOPS / 6 head for the line") and marks the
line's four corners quietly on the map: where, never the way. The raid keeps its own behaviour, nearest enemy
first. The mission's old `order`, which nothing ever read, is gone. This answers the open question about an
order primitive in part: heading for a place is built; holding a post waits with posts.

### F116 — Commanders are heroes: Vasse boosts the units near her

> Make Commanders matter: yes, they should be like heroes on warcraft3. Even in an autoblattler they should
> have skills that trigger automatically or are passive. Vasse should provide boost to nearby units.

**Built.** A Commander has skills that work on their own. Vasse's first is By the Book, a passive aura in her
protector's doctrine: she and the player's units within 3 tiles of her take a quarter less damage from every hit.
Her card says so in one line, her reach glows around her during a battle where colours allow, and its strength
is an Experiment, By the Book (off, 10%, 25% or 40% less; 25% to begin with). On PERIMETER the target and the
aura only work together: the aura alone let a plan that builds nothing hold, and the line alone made a lone
Hatchery or Barracks lose; together, nothing built still loses the last round, and most plans that build hold.

### F117 — Her voice during the Nexus Pulse, as an Experiment

> Her voice during battle waves: yes that is fantastic! let's experiment with this to see if it gets into the
> battle or enhances the experience even more. A little strategic usage of our effect library should go a
> long way here too

**Built.** Vasse now speaks during the Nexus Pulse: a few short lines a round in her own dry voice, written as
data in her army — as a round starts, at the first shot, when the raid sends more, when one of hers falls near
her or a building falls, when she is badly hurt, when the Grid Nexus is hit, her last words when she falls,
and a remark when the round is won — never more than a few, with quiet between them. The Vasse's voice
Experiment shows them beside her on the map (the first guess), under the panel's recent events, or not at all;
a moment's light on her marks her as she begins. Her aura's reach shows as a faint glow of her colour on the
ground around her while the fight is on.

### F118 — Many more Nexus powers for Vasse

> Nexus powers for Vasse: Aid Station, Standing Order, all good. Please think more, they are good and we need
> a bunch.

**Built** (as design). Vasse's design entry now holds her skill, By the Book, and a pool of fifteen Nexus
powers: nine of hers (Aid Station Permit, Mutual Support Standard, Field Triage, Plating Revision, Standing
Order, Countersigned, Emergency Procedure, Expedited Restoration, Early Warning) and six shared Citizen ones
(Reserve Callup, Drill Schedule, Plate Revision, Zoning Variance, Outpost Permit, Roadworks). Each is a name and
one plain line that fits the Nexus popup at 80 × 24, all act on her own side, and several build on her skill:
Standing Order makes it reach twice as far. The Nexus draft step builds the first two or three; Reserve Callup,
Standing Order and Aid Station Permit are recommended.

### F119 — Battle Rounds, not waves

> Rounds  or Waves: ok ok, let's settle in Battle Rounds. Please remove the term "waves". We can refer to it
> as Nexus Pulse in lore and design, but Battle Round is better for the player and UI.

**Built.** "Wave" has left the game, the routes, the mission data and the documents: a route counts Battle
Rounds with `round=` only, the raid sends groups, and the interface says Battle Round wherever it names the
battle — `[s] Start Battle Round`, the battle's title and panel, its bottom line — while Nexus Pulse stays the
lore's and the design's word. This also answers the open question of what the player calls a Nexus Pulse.

### F120 — Armies: `armies/all` and `armies/vasse`

> Bundle format: I would prefer to call the folder armies/vasse and armies/all

**Built.** Content bundles are armies: `armies/all/army.json` holds what every army may use, and
`armies/vasse/army.json` is Vasse's army, her Commander, her lines in battle and her campaign; the loader is
`src/armies`.

### F121 — Simpler code before the next milestone

> Thanks for the new navigation flag --at and the new menu router. Take this last round to reflect on code
> simplicity on this term and look for opportunities to cleanu before we move on to the next milestone

**Built.** The application shell is simpler, with nothing on screen changed: `--build-phase` and `--spike` are
gone (an old command is refused, naming the `--at` route that replaced it, rather than opening the title menu
where nothing reaches the Build Phase); one module reads where a run opens, its settings text and its keys for
the game, the scripted playtest, the browser page and its demos; every level opens the same way, with no special
case for PERIMETER; the title menu's places are one table; dead code is gone. The validator now checks that every
test a document cites exists.
