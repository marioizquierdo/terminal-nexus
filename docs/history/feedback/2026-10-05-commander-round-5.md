# The Commander, round 5 — placement by standing range, waves of troops, and polish (2026-10-05)

Mario merged the Commander's pull request (60) and sent notes for the next one: the voice Experiment settled,
three changes to where a building may go, units spawned together in waves on a building's own schedule, the
Nexus power pick made optional while he tests, a unit's range shown when it is explored, and the raid's intent
trail made to move. They continue [`2026-10-04-commander-round-4.md`](2026-10-04-commander-round-4.md)'s
numbering. Built on a new pull request as a fifth round of the Commander step. Status values: **Built**,
**Scheduled**, **Open**, **Contested**.

### F122 — Vasse's voice: beside her

> commander quotes, definitely behind her, it looks cool when they "speak" during battle

**Scheduled.** Read as the Vasse's voice Experiment's "beside her" (the first guess, and its only choice on the
map; "behind" taken for "beside"): settle it there and delete the Experiment.

### F123 — A building may stand where any of its tiles is in range

> build range: should allow to build if at least 1 building tile is within range (not the whole building). This
> is important for large buildings otherwise they have no space to build

**Scheduled.** Reverses round 4's rule that all of a building's footprint must be inside the build range.

### F124 — Only buildings standing from an earlier round give build range

> building range should only count for buildings already placed from previous round. For exaple placing a new
> tower should not grant new range on the same build phase. Expansing territory is only done at next round.

**Scheduled.** Reverses round 4's rule that a planned building projects at once, so a plan could chain outward
within one Build Phase.

### F125 — Barracks keep room around them

> building minimum range: barraks and other spawning buildings should require minimum distance from other
> buildings so they leave space for units spawning

**Scheduled.**

### F126 — Units spawn together, in waves, on the building's own schedule

> spawning units: should happen simultaneously at the beginning of the round, creating a more predictable
> squad formation. The first wave is at 5 seconds. Building spawn configration should say how many units on a
> build wave,  how many waves, and how long between waves. Barraks could spawn 4 troops per round and that's is
> for now. But Nexus Powers could upgrade the Barraks to spawn a second and third wave, etc.

**Scheduled.** "Wave" returns with one meaning only, the units a building spawns at once: round 4 took the word
out of the game as a name for a round, and a round stays a Battle Round and a mission's arrivals stay a group.
The Barracks Experiments (how often it trains, and how many a round) give way to the building's own numbers.
A Nexus power that adds a wave goes into Vasse's pool as design.

### F127 — The Nexus power pick is optional for now

> Nexus Powers should be optional for now, it's easier for testing if I can just start a round.

**Scheduled.** Reverses, for now, the rule that a dealt Nexus power may not be skipped; the Nexus draft step
decides with him whether it stays so once the powers are real.

### F128 — Exploring a unit shows its range

> exploring a unit should also show thier range, it's a noce visual aid to clearly show that they are ranged
> units

**Scheduled.**

### F129 — The raid's intent trail moves

> targeting intent looks promising. Let's polish the effect, instead of a static arror, it should be a
> slow-moving line of arrows with enough distance betwwen them to be less obstrussive. For example 1 arrow every
> 3 tiles, leaving a transparent arrow behind then moving that fades.

**Scheduled.**

### F130 — Tall tiles skew range and movement: explore fixes

> The next thing I want to explore before keep moving with next milestone is the horizontal vs vertical
> distance: as you can see on any screenshot that shows range, the range is severely skewed vertically. That is
> because a termial tiles are made of tall rectangles instead of a rectangular grid, and I think this is standard
> for every terminal because they are optimized to print text. For a battle simulator, this creates an odd
> perspective. A terrain perspective should be wide horizontally (isometric angled camera) or rectangular (top
> camera from above), but there' no perspective case where the vertical space would go taller.
>
> Let's explore ways to address this and see if they are worth implementing. For example, one idea would be
> counting distance and speed by half vertically, so ranges and movement would make more sense visually

**Scheduled** (a spike). Sent separately, after the notes above; it reopens the question he parked in August about
the terminal cell's aspect ratio. A throwaway build shows the same moments with tiles as now, with square tiles
(two columns a tile at every size), and with rows counting double in the rules (his idea), then measures what each
costs; the findings and a recommendation come back before anything is built for real.
