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

**Scheduled**: posts wait (the backlog, as an Experiment or a building); a level's target is built this
round. Each campaign level names the target the player's troops head for; they engage what comes within
reach on the way and stand at the target when nothing does, so where they go can be read before the Pulse.
This answers the open question about an order primitive in part: heading for a place, built; holding a
post, later.

### F116 — Commanders are heroes: Vasse boosts the units near her

> Make Commanders matter: yes, they should be like heroes on warcraft3. Even in an autoblattler they should
> have skills that trigger automatically or are passive. Vasse should provide boost to nearby units.

**Scheduled** (this round). A Commander has skills that work on their own. Vasse's first is a passive aura in
her protector's doctrine: the player's units near her take less damage.

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

**Scheduled** (this round, as design). A pool of Nexus powers for Vasse is designed, each a name and one
plain line in the Citizen Nexus's voice, over the effect kinds the design allows. The Nexus draft step
builds the first of them.

### F119 — Battle Rounds, not waves

> Rounds  or Waves: ok ok, let's settle in Battle Rounds. Please remove the term "waves". We can refer to it
> as Nexus Pulse in lore and design, but Battle Round is better for the player and UI.

**Scheduled** (this round). "Wave" leaves the game, the routes and the documents: a route counts Battle
Rounds (`round=`), the interface says Battle Round, and lore and design say Nexus Pulse. A group the raid
sends is a group, not a wave.

### F120 — Armies: `armies/all` and `armies/vasse`

> Bundle format: I would prefer to call the folder armies/vasse and armies/all

**Scheduled** (this round). Content bundles become armies: `armies/all` holds what every army may use, and
`armies/vasse` is Vasse's army, her Commander and her campaign.

### F121 — Simpler code before the next milestone

> Thanks for the new navigation flag --at and the new menu router. Take this last round to reflect on code
> simplicity on this term and look for opportunities to cleanu before we move on to the next milestone

**Scheduled** (this round). A cleanup pass over what this milestone added: fewer special cases, one module
where two do the same job, dead code gone, behaviour unchanged.
