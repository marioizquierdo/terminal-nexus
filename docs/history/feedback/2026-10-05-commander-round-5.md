# The Commander, round 5 — placement by standing range, waves of troops, and polish (2026-10-05)

Mario merged the Commander's pull request (60) and sent notes for the next one: the voice Experiment settled,
three changes to where a building may go, units spawned together in waves on a building's own schedule, the
Nexus power pick made optional while he tests, a unit's range shown when it is explored, and the raid's intent
trail made to move. They continue [`2026-10-04-commander-round-4.md`](2026-10-04-commander-round-4.md)'s
numbering. Built on a new pull request as a fifth round of the Commander step. Status values: **Built**,
**Scheduled**, **Open**, **Contested**.

### F122 — Vasse's voice: beside her

> commander quotes, definitely behind her, it looks cool when they "speak" during battle

**Built.** Read as the Vasse's voice Experiment's "beside her" (its only choice on the map; "behind" taken for
"beside"). Her lines show beside her `@` on the map, and in the panel under the feed whenever she or her line is
out of view. The Experiment is gone, with its "in the feed" and "off" choices and its Activity Logs filter; every
line she says is still recorded, with where it showed.

### F123 — A building may stand where any of its tiles is in range

> build range: should allow to build if at least 1 building tile is within range (not the whole building). This
> is important for large buildings otherwise they have no space to build

**Built.** A building may be placed when one of its tiles is inside the build range, so a Barracks can hang over
the dotted ground's edge. Rock, another building and the map's edge are still refused tile by tile. This reverses
round 4's rule that all of a building must be inside.

### F124 — Only buildings standing from an earlier round give build range

> building range should only count for buildings already placed from previous round. For exaple placing a new
> tower should not grant new range on the same build phase. Expansing territory is only done at next round.

**Built.** Only the buildings standing when the Build Phase opens give build range, so the range stays the same
all phase; a building planned now gives its range from the next round, and its card says "3, next round". Taking
a planned building away is never refused now, since no planned building needs another. This reverses round 4's
chaining within one Build Phase.

### F125 — Barracks keep room around them

> building minimum range: barraks and other spawning buildings should require minimum distance from other
> buildings so they leave space for units spawning

**Built.** A Barracks or Hatchery keeps a tile of room round it: no other building may stand there, whether it is
placed near one or one is placed near it, the Nexus and the raid's buildings included. While a building is armed
the room shows as a ring of dim ticks (`'`), and a refusal says "too close to the Barracks - its troops need
room". How much room is an Experiment, Barracks room (1 or 2 tiles; 1 to begin with, the ring its troops appear
on).

### F126 — Units spawn together, in waves, on the building's own schedule

> spawning units: should happen simultaneously at the beginning of the round, creating a more predictable
> squad formation. The first wave is at 5 seconds. Building spawn configration should say how many units on a
> build wave,  how many waves, and how long between waves. Barraks could spawn 4 troops per round and that's is
> for now. But Nexus Powers could upgrade the Barraks to spawn a second and third wave, etc.

**Built.** A building's units come out together, in waves, on its own numbers in its army: how many a wave, how
many waves and the seconds between them. Every first wave comes five seconds into the round. The Barracks sends
four troopers in one wave, in a row beside it, and the Hatchery, by the same rule, three swarmers (before, it
bred one every few seconds, three alive at most). Its card says "WAVE 4 troopers at 5s", and the panel's count of
your troops includes them. "Wave" returns with this one meaning: a round stays a Battle Round, and a mission's
arrivals stay a group. The Barracks Experiments and their Activity Logs filter are gone, and Drill Schedule, in
the shared Nexus power pool, became "Barracks send a second wave". With the wave, PERIMETER's last round holds
even with nothing built; the raid waits for the tall-tiles question before it is retuned.

### F127 — The Nexus power pick is optional for now

> Nexus Powers should be optional for now, it's easier for testing if I can just start a round.

**Built.** Start Battle Round works with the Nexus power unpicked: the round starts without it and nothing is
taken. The "(1)" still shows on the menu, and the Battle Round screen says in one quiet line that a power is
waiting. This reverses, for now, the rule that a dealt power may not be skipped; the Nexus draft step settles it
with him.

### F128 — Exploring a unit shows its range

> exploring a unit should also show thier range, it's a noce visual aid to clearly show that they are ranged
> units

**Built.** In Explore Map, the cursor on a unit that shoots past the tiles touching it (a marksman, Vasse, a raid
slinger) draws its range the way a building's reach is drawn, in the hotkey's colour; a unit that fights hand to
hand shows none, and that absence is what says "ranged".

### F129 — The raid's intent trail moves

> targeting intent looks promising. Let's polish the effect, instead of a static arror, it should be a
> slow-moving line of arrows with enough distance betwwen them to be less obstrussive. For example 1 arrow every
> 3 tiles, leaving a transparent arrow behind then moving that fades.

**Built.** The trail's arrows stand every three tiles and move a tile on every 0.4 seconds, each leaving a
fainter copy that fades out within a fifth of a second (dim, then gone, at 16 colours and in black and white). A
popup, reduced motion or a committed plan holds the trail still. The pace is a tuned value, not an Experiment.

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

**Built** (as a spike; [the report](../reports/2026-10-05-tall-tiles-spike.md)). A throwaway build showed the
same moments with tiles as now, with square tiles (two columns a tile at every size) and with rows counting
double in the rules, his idea, at two scales. Rows counting double, at his scale, is the only one that makes
ranges and movement look right at 80 × 24 with the whole map in view; it needs melee as "touching", a build range
of 6 instead of 3, and a step of its own, and it means one column a tile everywhere. Square tiles show half the
map at 80 × 24 and have no two-column art. Drawing vertical steps slower fixes nothing. The recommendation, in
the open question about the cell's aspect ratio, is to build rows counting double as an Experiment first, with
square tiles beside it, so he can feel both; nothing changes in the game until he chooses.
