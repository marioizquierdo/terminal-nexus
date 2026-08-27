# Milestone 2 — the two-audiences audit

**Document role:** Every recommendation in this pass checked against two experiences — the player's and the developer's — with the tensions named rather than smoothed
**Status:** Analysis supporting the Milestone 2 design pass
**Updated:** 2026-08-27
**License:** Apache-2.0

A campaign design can be excellent for a player and miserable to build, or delightful to build and
inert to play. This project has an unusual amount of leverage on the second half — `grid` resolves a
real Pulse headless in milliseconds, `--verify` proves determinism, and every rule already has a
checked-in map that exercises it — so "cheap to iterate on" is a real, measurable property here rather
than a wish.

The rule used below: **a recommendation that helps one audience at the other's expense is fine, but it
has to be said out loud.** Rows 3, 4, 8, 9 and 10 are the ones where that happens.

| # | Recommendation | For the player | For the developer | Verdict |
| --- | --- | --- | --- | --- |
| 1 | **At most one unlock per mission** ([`progression-system.md`](progression-system.md) 2.2) | One new thing to learn, one line to read, memorable — "I got the fabricator" | Forces one hard choice per mission and makes each mission's content work smaller and more bounded | **Both win.** The rare case where the disciplined answer is also the cheap one |
| 2 | **An unlock must change the construct menu or the draft** (2.2 rule 4) | Every unlock is *felt* in play, not read on a screen | **Costs.** It forbids the cheap flavour grant, so every mission owes a real content change — this is the rule that makes the campaign expensive | **Player wins, developer pays.** Accepted deliberately: an unlock that changes nothing is the failure mode the whole system exists to prevent. Mitigated by naming unlocks as *roles* and reusing bench content where it already fits |
| 3 | **The Build Phase telegraphs the Pulse** ([`progression-system.md`](progression-system.md) 5) | The single highest-value item in the pass. It is what makes a resolution you cannot steer feel like your own doing rather than something that happened to you | **Costs, and it widens a gated milestone.** Milestone 5's scope is deliberately small (Q30, Q37), and this is new Build Phase UI: an arrival marker, an arrival tick, effect text on options. Architecturally clean — the schedule is authored data, so presentation reads content, not simulation state — but it is not free | **Player wins, developer pays, and this one needs raising rather than assuming.** It should go to Milestone 5 as an explicit scope question, not arrive as an inherited requirement. If it has to be cut, cut the arrival *marker* and keep the arrival *tick* in text — most of the value, a fraction of the UI |
| 4 | **A 60×20 map, sized to scroll at the terminal floor** ([`perimeter-sketch.md`](perimeter-sketch.md) 2.1) | Mild cost. A first mission that scrolls is slightly harder to read than one that fits whole | Clear win: Milestone 5's scrolling gets its evidence from the actual campaign mission instead of a fixture invented to exercise it | **Developer wins, player pays a little.** Mitigated by the layout: the Nexus, the build zone, and the lane's exit are all visible together at 48×16, so scrolling is for inspecting the flanks, not for finding the fight |
| 5 | **Two draft options in missions 1–3, three from mission 4** (6) | Gentle, and it makes the widening at mission 4 legible as a moment | Win: fewer options is less balance surface and fewer authored consequence lines | **Both win** |
| 6 | **No difficulty selector** (2.5) | Costs: no accessibility valve if a mission lands too hard | Large win: no second balance axis for a game with no balance evidence | **Developer wins.** Honest mitigation: per-mission tuning is authored data, so "too hard" is fixed by editing the mission, which is the same amount of work and produces a better mission instead of a workaround |
| 7 | **The lose-everything set-piece is designed now and built last** ([`story-and-cast.md`](story-and-cast.md) 5) | They never know it was deferred | Win: it is the mission most dependent on mature tooling (scripted terrain destruction, a second interface skin, a defeat that is not a failure state) | **Both win** |
| 8 | **The second Commander sits at arc 2, not inside the ramp** ([`story-and-cast.md`](story-and-cast.md) 4) | Costs: Teag is a good character who waits six missions | Win: no second starting package, no second draft, no roster pressure inside the ramp | **Developer wins, player pays.** Mitigated by placement (a) — Teag appears as a *voice and a Build Phase constraint* at mission 4, so the player gets the character at zero content cost, six missions before they play her |
| 9 | **The One Lesson Rule enforced by the repository validator** (4.2) | Invisible | Win, with a real risk: a rule that fights a designer gets deleted | **Developer wins if built carefully.** Mitigated by making `teaches` uniqueness a *warning* with a documented escape rather than a build failure. Presence checks (`teaches` exists, `unlocks.length <= 1`, ids resolve) stay hard failures — those never need an exception |
| 10 | **The cold open on a pre-Nexus interface** ([`story-and-cast.md`](story-and-cast.md) 2, Option 3) | Strong win, and probably the best single creative idea in the pass — mission 6's payload planted in the first minute, as a mechanic, wordlessly | **Costs a lot.** A cutscene needing a second interface skin that appears exactly once is the most expensive kind of cutscene, and Milestone 9's scope is "play PERIMETER's already-written material," not "build a second chrome" | **Player wins, developer pays heavily.** Which is why the recommendation is tiered: Option 1 is free and already written, Option 2 is one tableau, and Option 3 is named as an ambition costed against a later milestone rather than smuggled into Milestone 9 |

## Three developer-experience notes that are not tied to one row

**The `.map.json` schedule is the right shape because of how this project debugs.** Q32's Option A
keeps the raid as data in the same file as the map, which means `grid <map> --headless` reproduces a
mission's whole opponent behaviour with no game running, `--verify` covers it, and a schedule change
shows up as a hash change. A policy module would have put the opponent behind a runtime interface that
`grid` cannot exercise the same way. That is a developer-experience argument for a decision that was
made on other grounds, and it is worth recording because it is the kind of alignment that usually goes
unnoticed until it is lost.

**The riskiest thing for iteration speed is `pulseTicks`.** Every timing number in
[`perimeter-sketch.md`](perimeter-sketch.md) Section 2.4 and 3.4 is arithmetic, not measurement, and
mission timing is the parameter most likely to need a dozen passes. The mitigation is already in the
toolchain: `grid <map> --headless --json` gives an outcome and a tick count per run, so a schedule
sweep is a shell loop, not a playtest. Milestone 6 should do that sweep before anyone watches the
mission once.

**One place the player and the developer want the same unusual thing.** The telegraph (row 3) makes
the mission fair for the player *and* makes it debuggable for the developer — an arrival edge and a
tick drawn on screen is also the fastest way to see that a schedule is wrong. Most accessibility and
legibility work has this property in this project and it is under-claimed: the compositor's corruption
law, monochrome mode, and reduced motion are all also debugging tools.
