# Terminal Nexus — the Campaign's opponent: waves, intentions, and what the player can see coming

**Document role:** Working design notes, started at gate 6B at the owner's request — how a mission defines what each round brings, how an incoming group shows what it means to do, and where the Campaign's opponent AI grows from
**Status:** WORKING — thinking, not a decision; nothing here is canon until a gate builds it and the owner accepts it. Decisions that are genuinely his are registered as questions (Q69, Q70)
**Updated:** 2026-09-30
**License:** Apache-2.0

## 1. What the owner asked for

At gate 6A's acceptance (2026-09-30), Mario wrote: *"right now, the pulse is not well developed, it will
spawn some units out of nowhere, and it has some settings to test different ideas. But this is temporal
only. Eventually we want the Campaign to fully define the initial state of the pulse, so the user can
Explore map and see what is coming. the incoming units should have optional text that show their
intention, perhaps we need to start thinking about how to implement the Campaign NPC AI, an intention
design will be very useful so people can properly plan for the upcoming wave (Pulse, Battle step, etc,
we have multiple names for the same thing heh). No need to go into detail about how the wave is
configured on the campaign files, but please start thinking about it."*

Three ideas are in there, and they are one design:

1. **The mission defines the round** — nothing arrives "out of nowhere"; what the Pulse starts with is
   the mission's data, readable before it starts.
2. **The player can see it coming** — the Build Phase is planning against a known threat, the way a
   tower-defence game shows the next wave, and the way PERIMETER's own briefing already says the Nexus
   "has already assigned the contact a name, a heraldry, and an estimated time of arrival".
3. **Incoming groups say what they mean to do** — an *intention*, in words, which is also the seed of an
   opponent AI the player can read.

## 2. What gate 6B built of it

- **A mission is data** (`src/mission/`): named regions of the map, and triggers — a moment in a round
  (`{ pulse: 2, tick: 0 }`), a round's end, a Nexus destroyed — each with actions: `spawn` (units at a
  region, with a group name, an order and a line of intention), `order`, `commitPlan` (the raid's own
  buildings for a round), `win`, `lose`. It is checked when it is loaded; a mission with a broken
  reference never runs. PERIMETER is three rounds, the raid in three waves
  (`src/mission/perimeter.ts`).
- **The Build Phase shows the next round's arrivals** where they will stand, see-through, and Explore
  Map's card over one says "Incoming", when it arrives, and its group's intention ("Break through at the
  ridge."). An Experiment hides it, so the owner can feel both.
- **Nothing is hidden or random about it.** The same function that starts the round's Pulse computes the
  forecast, so what is shown is what will come — except where the player builds on an arrival's tile,
  which moves it aside when the round starts.

What it does **not** do yet is the part that needs the kernel: every unit, scripted or not, still does
the one thing the kernel knows — engage the nearest enemy. An intention today is a sentence the mission
writes, and it comes true because the nearest enemy happens to be where the sentence says.

## 3. The shape I would grow it into

### 3.1 A wave is a group with a plan, not a list of units

Today a `spawn` is units at a region with an optional order and intention. The natural next shape keeps
that and names the group's **plan** as a short sequence of steps the kernel can carry out:

```ts
{ spawn: {
    side: "B", at: "ridge", group: "second-wave",
    units: [{ unit: "unit.ravel.runner", count: 4 }, { unit: "unit.ravel.raider", count: 3 }],
    plan: [
      { hold: "ridge", untilTick: 60 },          // wait at the ridge for five seconds
      { advance: "east-gate" },                  // then head for the east gate, engaging on the way
      { target: "structure", prefer: "turret" }, // and go for turrets first
    ],
    intent: "Wait for the flank, then hit the east gate's turrets.",
} }
```

Each step is a verb the kernel would have to learn (Q69): *hold* (stay, still fire), *advance to a
region* (move there, engaging what comes into range), *withdraw*, and a *target preference*. That is a
small vocabulary, and it is enough for most of what a tower-defence or RTS campaign wave does. It grows
the way the rest of the vocabulary grows — a typed kind, a named scenario, the determinism tests — never
a function in a mission (Q39).

### 3.2 The intention can be written, or read off the plan

Two ways to get the sentence the player reads, and both are worth having:

- **Written** — the mission author's own line, in the mission's voice ("Knock knock, bureaucrats!" is a
  bark; "Wait for the flank, then hit the east gate" is an intention). Today's `intent`.
- **Derived** — a plain sentence built from the plan itself ("Holds at the ridge for 5 s, then advances
  on the east gate; prefers turrets."), so an intention can never lie about what the group will do, and
  a mission author who writes nothing still gets one. This is the one I would lean on for the Campaign's
  AI (below), because a generated plan has no author to write its sentence.

On the map the plan could be drawn too, not only said: a faint path from the group to its next region,
or an arrow at its destination, in the raid's colour, see-through like the group itself. That is a look
for the owner to feel (an Experiment), and it degrades well: the sentence carries it in monochrome.

### 3.3 Where the Campaign's opponent AI comes from

The Campaign's opponent should be **a planner that writes plans in this same vocabulary** — never code
that moves units itself. Each round, before the Build Phase, it looks at the public state (what the
player has standing, where the survivors are) and chooses the next wave's groups and their plans from
the mission's budget and rules; the mission can fix some groups by hand and leave others to it. Then:

- the plan is **data**, so the Build Phase can show it and its intention, exactly as it shows a
  hand-written wave;
- the kernel executes it, deterministic and replayable — the planner runs between rounds, never inside a
  tick;
- a harder difficulty is a better planner (or a bigger budget), not a different rule, and "the AI
  cheated" can be checked by reading its plan;
- it is the tier campaigns.md Section 6 calls "weighted faction heuristics": a Ravel planner likes fast
  flanks, a Feudal one siege lines.

**Should the planner see the player's plan?** No — it plans before the player does, from what is
public, which is also what makes showing its plan fair. The player sees the raid's intention; the raid
never sees the player's buildings until they reveal at the round's start. That asymmetry is the
Campaign's whole deal with the player: "the Nexus is ahead of you" (the PERIMETER lore hint) is true
mechanically — the player's own Nexus is telling them what is coming.

### 3.4 How a mission file might say it, later

Not detailed on purpose (the owner's "no need to go into detail"). The direction: a mission's waves live
beside its map as a list per round — hand-written groups, or a planner with a budget and a style —
validated at load time like today's triggers, and previewable in a tool that shows each round's forecast
without playing it (campaigns.md Section 7 already asks for one). The trigger list stays for everything
that is not a wave: the intro, the objectives, the barks.

## 4. The names

The owner's aside — "Pulse, Battle step, etc, we have multiple names for the same thing" — is Q68. As of
gate 6B the player reads **round** for a mission's cycle ("round 2 of 3", "Next round", "Battle Round 2")
and **Nexus Pulse** for the running screen's title; the code says Pulse. Q68 recommends Battle Round
everywhere the player reads, and nothing here depends on which way it goes.

## 5. Order of work, as I see it

1. **Q69, `hold` and "advance to a region"** — the smallest kernel change that makes an intention
   something the kernel keeps rather than a coincidence. Its own gate, with its own named scenarios.
2. **Derived intentions** from the plan, and an Experiment for drawing the plan on the map.
3. **Q70** (a defender's wiped-out units ending a round early) — decided on the owner's play of 6B.
4. **The planner** — only once two missions exist to plan for (Milestone 10's RIGHT OF SALVAGE), so the
   vocabulary is judged on two real uses before anything generates plans in it.
