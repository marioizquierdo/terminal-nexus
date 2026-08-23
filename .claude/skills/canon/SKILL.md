---
name: canon
description: Work the specification/governance ceremony this project runs on — register an open question, copy and fill a gate report, update canon after an accepted gate, or decide what a session may change unilaterally versus what needs the owner (Mario). Use whenever a task hits a fork the canon does not answer, a gate is closing, an accepted gate needs its documents updated, or you need to know whether a statement in specs/ is a RULE or GUIDANCE. Read this before re-deriving the workflow from AGENTS.md prose.
---

# Working the canon

Terminal Nexus is specification-driven: `specs/` is product truth, and the active milestone gate is
the only implementation authority. This skill is the mechanics of the ceremony around that —
registering a question, closing a gate, updating canon afterward. It is a companion to
[`../../../AGENTS.md`](../../../AGENTS.md), not a replacement for reading it; this fills in the real
examples and the exact commands.

## Terms, in plain language

This vocabulary is project-specific, not industry standard — read this before the sections below
start using it as familiar.

- **Canon** — the entire versioned `specs/` document set: the current single source of truth for
  this project, engineering rules and lore alike. **Canon is not "the decided stuff."** A settled
  RULE and an unsettled GUIDANCE recommendation both live inside canon, version-stamped together;
  even `open-questions.md`, the queue of things genuinely still open, is itself a canonical document.
  What's decided is a property of an individual passage (its RULE/GUIDANCE marker, or its row in
  `project-governance.md`'s locked-vs-open decisions), not of being in canon at all.
- **Canon version** — one number stamped across every document under `specs/` and `concept/`, plus
  `AGENTS.md`. It exists because canon is ~10 independently-edited files, not one — the shared
  version is a cheap mechanical tripwire (`check-repository.sh` fails the build the moment any one
  document's declared version disagrees with the rest), not a claim that everything changed.
- **RULE vs. GUIDANCE** — the actual decided/not-decided axis, applied per passage. RULE means
  something already depends on it; changing it needs Mario and a version bump. GUIDANCE means a
  recommendation written before the thing existed, followed by default but departed from when the
  work shows better — the one authority level a session may act against on its own judgment, as long
  as it says why.
- **Milestone** — a large chunk of scope ("Milestone 1: prove the deterministic battle spike").
- **Gate** — the real unit of work inside a milestone: build something small, evidence it, then
  decide, rather than building the whole milestone at once. Milestone 1 was cut into Gate 1A and
  Gate 1B. Borrowed from "stage-gate"/"phase-gate," a real (if not universal) engineering term.
- **Gate report** — the document that closes a gate: a filled-in copy of
  [`../../../specs/templates/gate-report.md`](../../../specs/templates/gate-report.md) recording the
  question, exact commands, automated results, human observations kept separate from those, and one
  of four terminal decisions (PASS/REVISE/STOP/BLOCKED — see below).
- **Governance** (in this context) — not open-source contribution governance, but specifically what
  [`../../../specs/project-governance.md`](../../../specs/project-governance.md) is: a decision-rights
  framework for a project that runs on semi-autonomous sessions between owner check-ins. It answers
  "what can a session just decide" and "what has to wait for Mario" in writing, so work doesn't
  either grind to a halt asking permission for everything or silently lock in a decision that was
  never a session's to make.

## Deciding alone versus asking

[`project-governance.md`](../../../specs/project-governance.md) Section 2 draws the line. Within the
active gate, decide alone and move on:

- reversible module boundaries, names, local data shapes, test organization;
- diagnostics, fixtures, comparison modes, small evidence tools;
- comparing alternatives when experimenting is cheaper than debating;
- simplifying or discarding code built only to answer the gate's question;
- reporting that the favored hypothesis failed.

Never do these without authority:

- promote a hypothesis into canon without accepted evidence;
- absorb a later milestone because the architecture makes it convenient;
- build a generic framework before two concrete uses reveal its contract;
- treat an automated test as proof of an experiential claim;
- hide a blocker by changing a pinned runtime, fixture, target, or requirement;
- add secrets, services, public endpoints, or external writes without authority.

Before asking, try to make the fork **observable** instead — a parameter, toggle, or side-by-side
fixture Mario can look at beats a paragraph arguing for one answer, and it's usually cheaper than it
looks. Ask only when alternatives materially change the product promise, an experiment, or
irreversible architecture — and ask in the register below, never in a PR comment, which gets lost.

## Registering an open question

[`open-questions.md`](../../../specs/open-questions.md) Section 4 is the queue. A row needs: the
question, why it blocks (or doesn't — most rows block nothing before some future milestone), options
with their costs, and **a mandatory recommendation** — `check-repository.sh` fails the build if an
`OPEN` row has no `**Recommendation`. Shape:

```markdown
### Q<n> — <question, as a question>?

**Status:** OPEN — <what it blocks, or "blocks nothing before Milestone N">.

<what the canon says, where it's silent or contradictory, why a real fork exists>

| Option | Cost |
| --- | --- |
| A. ... | ... |
| B. ... | ... |

**Recommendation: A/B/…**, and why. A recommendation of "decide none of this yet" is still a
recommendation, as long as it says what would force the decision later.
```

State the assumption you're proceeding under in the row itself if you're building against one, then
**keep working on everything the answer does not touch**. Only stop the whole session if proceeding
under any assumption would waste the work.

**IDs are permanent** — never renumbered, never reused, even for a row that turns out `DROPPED`.
Status is one of `OPEN` (waiting on Mario), `OBSERVABLE` (deferred on purpose; a gate will produce
the evidence), `ANSWERED` (decided, moved to Section 5), `DROPPED` (no longer relevant — keep the row
and say why, as Q10 does).

### Three real shapes, from this project's own register

**A question resolved as a side effect, then verified rather than chosen among its own options** —
Q17. It asked how to break a targeting tie when every enemy in a rank-deployed formation measured the
same distance away. Nobody picked among its three options: Q15's unrelated four-way-movement fix
changed the distance metric from Chebyshev (`max(|dx|,|dy|)`, which discards the axis a horizontal
rank shares) to Manhattan (`|dx|+|dy|`, which never discards either axis), and that alone dissolved
the tie. The close, in [`open-questions.md`](../../../specs/open-questions.md) Section 5: "**Resolved
by an unrelated fix, not decided among its options**... Verified, not assumed:
`citizen-mirror-skirmish.ts` (rank-deployed) now pairs each attacker with a distinct nearest opponent
from tick 1, no stampede." The lesson: check whether a later change already answered an open row
before spending a session deciding among its options — and verify it against the original fixture
rather than assuming.

**A question registered explicitly to defer scope the owner said was fine to defer** — Q19. Mario, in
his own words after playing `grid`, described sandbox placement, rewind/fast-forward, and a full
replay engine, then closed with "just keep this in mind... but not needed for now." The row exists
so that paragraph survives past the session that heard it, not because anything blocks: "**Status:**
OPEN — not needed for Gate 1B or Milestone 2; the owner asked for it to be kept in mind and
registered, explicitly not built now." It still splits the ask into three differently-sized pieces
(a replay format Milestone 2 already owns, rewind as arithmetic once that format lands, and a
lightweight sandbox mode) and recommends **C now, B before Milestone 3** — so a future session
reads one paragraph instead of reconstructing three separate scopes from a quote.

**A question registered with a recommendation but deliberately not decided** — Q20. A scalability
review found perception scanning is O(N²) per tick with no cap, and that bounding it by radius needs
a fallback rule for a unit with nothing in range — a real, hash-affecting decision once it lands,
expensive to reconsider after a fixture is pinned to it (explicitly compared to Q17 in its own text:
"registered now because the tradeoffs are cheap to write down before any fixture or hash depends on
the answer, exactly the situation Q17 was found in after the fact"). The recommendation is still
mandatory and still present — **"none of these until R is actually needed"** — but it names which
option to reach for when that day comes (B, hold/idle) and why the other two are worse, rather than
picking now on no evidence. A recommendation to wait is a real recommendation as long as it says what
would end the waiting.

### Open → Answered

When Mario answers, move the row: add one line to the Section 5 table (`ID`, `Answered` date,
`Decision`, `Now owned by`), promote the decision into the narrowest authoritative document, and cite
the question ID in the commit. A longer write-up under a `### Q<n> — answered` heading is common when
the mechanism matters (Q17, Q11) but not required for a short bookkeeping close (Q4, Q1, Q2). If a
question turns out mis-scoped rather than answered, close it `DROPPED` with the reason, as Q10 was —
"the question conflated two separate things," each routed to where it actually belongs.

## Filling a gate report

Every gate follows one loop
([`project-governance.md`](../../../specs/project-governance.md) Section 3):

> **Question → smallest artifact → automated evidence → human observation → decision → canon
> update**

Copy [`../../../specs/templates/gate-report.md`](../../../specs/templates/gate-report.md) — do not
edit the template in place — to `evidence/report.md` or `evidence/gate-<gate>-report.md` (Milestone 1
used both: `evidence/report.md` for Gate 1A, `evidence/gate-1b-report.md` for Gate 1B). Fill Sections
1–2 **before writing code**: question, smallest artifact, planned automated and human evidence,
explicit exclusions, and stop conditions that would make you halt rather than push through — a report
reconstructed from memory at the end quietly turns into a summary of whatever got built instead of an
answer to the question you started with. Section 4 is facts only, reproducible by a command from
Section 2; save the reading of them for Section 6. Section 7, failures and discarded approaches, is
named in both `AGENTS.md` and the template itself as the highest-value section and the one most often
skipped — an empty one usually means it wasn't filled in honestly, not that nothing went wrong.

### The four decisions, and what actually happened with them here

- **PASS** — automated evidence and (when planned) human observation both hold. PASS does **not**
  mean the gate is accepted: Gate 1A's report concludes PASS while stating plainly that "the two
  human checks in its Section 3.10 remain unobserved, and nothing in canon claims them"
  ([`project-governance.md`](../../../specs/project-governance.md) Section 5, ledger row for
  Milestone 1A). Automated PASS and owner acceptance are tracked separately on purpose.
- **REVISE** — name the single comparator or change required and the criterion it must satisfy, then
  go around the loop narrowly rather than restart it. Gate 1B's report shows this happening for real,
  in place: it originally closed **PASS**, Mario then watched it and gave feedback, and the report's
  own Section 10/11 record the response and end with "**REVISE, acted on — PASS still pending the
  owner's next look**" — the same file, revised rather than replaced, with its `Status` metadata
  updated to say so ("In progress — revised after the owner's first viewing, awaiting the next one").
- **STOP** — proceeding under any assumption would waste the work; stop entirely rather than finish
  under a guess. The Gate 1A frame names its own stop conditions in advance, e.g. "the ASCII view
  cannot show a mirror skirmish legibly at 80x24 in monochrome, and the cause is not fixable inside
  this gate."
- **BLOCKED** — name exactly who or what unblocks it. Typically an owner decision still sitting in
  `open-questions.md`, or a prerequisite gate not yet accepted.

Do not open the next gate merely because time remains — finishing early with a clean, evidenced
answer is the intended outcome (`AGENTS.md` Section 2), not a shortfall.

## Canon maintenance after an accepted gate

Ordered checklist (`AGENTS.md` Section 9, `project-governance.md` Section 4) — **nothing in a gate
report's Section 9 "Canon impact" table applies until Mario accepts the gate**:

1. update the [`project-governance.md`](../../../specs/project-governance.md) execution ledger (the
   workstream row's `State`, `Basis`, `Next action`);
2. add one concise progress-history entry (Section 6's dated table);
3. promote only evidence-backed conclusions into the narrowest owning document — not the gate report
   itself, and not a hypothesis nobody tested;
4. move answered questions from `open-questions.md` Section 4 into Section 5, citing the ID in the
   commit;
5. update locked and open decisions in `project-governance.md` Section 7/8;
6. revise the *next* milestone only after owner acceptance — never preemptively;
7. increment the shared canon version for semantic changes (every doc under `specs/` and `concept/`,
   plus `AGENTS.md`, must then agree — see below);
8. update cross-document links and run `./scripts/check-repository.sh`.

### What `check-repository.sh` actually checks

Read the script (`scripts/check-repository.sh`) rather than assume; here is its current shape,
section by section:

1. **Required files exist** — every canonical `specs/*.md`, `concept/README.md`, the five milestone
   docs, `templates/gate-report.md`, plus `README.md`, `DEVELOPMENT.md`, `AGENTS.md`, `CLAUDE.md`,
   `CONTRIBUTING.md`, `LICENSE`, `LICENSE-CREATIVE`, `NOTICE`, the devcontainer config, and the CI
   workflow file.
2. **Canon version agreement** — every document under `specs/` and `concept/` declares the same
   `**Canon version:**` as `specs/README.md`; `AGENTS.md` must declare that same version too, because
   it restates canon invariants as a summary and would otherwise drift silently (this is the exact
   check `AGENTS.md`'s own header warns about).
3. **Required metadata header** — every canon document (except `specs/README.md` itself) carries
   `Document role`, `Status`, `Canon version`, `Updated`, and `License`.
4. **Exactly one CURRENT milestone** — exactly one `specs/milestone-*.md` declares `**Status:**
   CURRENT`; it must declare an `**Active gate:**`; `project-governance.md`'s ledger must mark that
   same milestone number `CURRENT`; and the ledger must have exactly one `CURRENT` row total.
5. **Open-question references resolve** — every `Q<n>` mentioned anywhere under `specs/` or
   `concept/` must be defined as a `### Q<n>` heading in `open-questions.md`; every row whose
   `**Status:**` is `OPEN` must contain `**Recommendation` somewhere in its body.
6. **Authority markers** — only `RULE` and `GUIDANCE` may appear as authority markers; the retired
   markers `LAW` and `UNPROVEN` fail the build unless the line is marked `<!-- stale-ok -->`.
7. **Agent entry point** — `CLAUDE.md` must contain the literal text `@AGENTS.md`.
8. **Retired terminology and stale links** — a fixed regex list currently bans (case-insensitively,
   across every `.md` and `.sh` file, `<!-- stale-ok -->` exempted): `\bveils?\b`, `\bplanning
   phase\b`, `\bbattlefields?\b` (the word `Grid` retired it — see `AGENTS.md`'s "the retired word
   for it is rejected by the validator"), and two pre-split spec filenames named literally in the
   script <!-- stale-ok -->, kept out of this sentence so quoting them here doesn't itself trip the
   check. This list is intentionally narrow and literal — it does **not** currently catch every
   retired name (e.g. `playground` as the CLI's old name is not regex-checked; see the
   historical-record convention below for how that one is actually handled).
9. **Structural checks** — `.devcontainer/devcontainer.json` parses as JSON; every local Markdown
   link — square-bracket text immediately followed by a parenthesised target — resolves to a file
   that exists relative to the linking file, via `scripts/check-markdown-links.mjs`; every Markdown
   file has an even count of ` ``` ` fences; and neither the working tree nor the index has
   whitespace errors (`git diff --check`).

Passing prints the canon version and the current gate; that's the fast confirmation a session is
oriented correctly, not just that nothing is broken.

## RULE versus GUIDANCE

Every section of [`engine.md`](../../../specs/engine.md) — and, where it matters, other canon
documents — declares one of two authority markers (`specs/README.md`'s table):

| Marker | Means | Licenses you to |
| --- | --- | --- |
| **RULE** | Committed; something already depends on it | Follow it. Changing it needs Mario and a canon version bump — not a unilateral edit, however clearly the work seems to show a better answer |
| **GUIDANCE** | A recommendation, not yet earned by working code | Follow it by default. Depart when the work shows better, and **say why in the gate report** — this is the one authority level an agent may act against on its own judgment |

Most of the design canon is GUIDANCE — it was written before the thing existed, to give a session
something better than a coin flip at a fork, not to pre-authorize a build. **Descriptive completeness
is not authorization**: finding a shape fully described in a document is not the same as the active
gate having asked for it. If you catch yourself building something because it's *described* rather
than because the active gate's Section 3 requires it, stop and check the marker.

## Which document owns what

| Document | Owns |
| --- | --- |
| [`terminal-nexus-concept.md`](../../../specs/terminal-nexus-concept.md) | The one-page game definition: audience, match, promise, differentiators, current scope |
| [`terminal-nexus-lore.md`](../../../specs/terminal-nexus-lore.md) | Universe, Prime Nexuses, Nexus Symbols, Ancients, Originals, faction identity, ASCII semiotics, voice |
| [`engine.md`](../../../specs/engine.md) | The three worlds (state/Pulse/presentation), the Grid and its layers, logical time, determinism, events, content sketches, rendering, runtime direction — this is where RULE/GUIDANCE markers live |
| [`ascii-effects.md`](../../../specs/ascii-effects.md) | The particle/effect system: the pure-function contract, starter vocabulary, craft rules |
| [`replay-format.md`](../../../specs/replay-format.md) | The `.replay.json` design — schema, log levels, soundness. GUIDANCE, unbuilt; Milestone 2's locked contract to implement |
| [`commander-armies.md`](../../../specs/commander-armies.md) | Playable Commander Army packages — Commander, units, structures, upgrades, Nexus powers. Rosters intentionally undefined until Milestone 4 |
| [`campaigns.md`](../../../specs/campaigns.md) | Mission and campaign structure, teaching, the Citizen opening, cutscenes, opponent policies, authoring tools |
| `milestone-<n>-*.md` | The one narrow implementation contract — only the milestone marked **CURRENT** is authority, and only through its **Active gate** |
| [`project-governance.md`](../../../specs/project-governance.md) | Canon maintenance protocol, bounded autonomy, the evidence loop, the execution ledger, locked product decisions, test/playtest strategy, deferred systems |
| [`open-questions.md`](../../../specs/open-questions.md) | The durable queue of decisions genuinely waiting on Mario, each with a recommendation |
| [`templates/gate-report.md`](../../../specs/templates/gate-report.md) | The fill-in template that closes a gate — copy it, never edit it in place |
| [`specs/README.md`](../../../specs/README.md) | The canon index and reading order; the source of truth `check-repository.sh` diffs every other document's version against |
| [`AGENTS.md`](../../../AGENTS.md) | The operating contract every session reads first — Section 4 is a summary of `engine.md`'s RULEs, not a second authority |

When in doubt: lore facts go in the lore document, implementation contracts in the engine, playable
options in Commander Armies, mission content in campaigns, undecided things in the open-questions
register — never duplicated as a hedge inside some other spec.

## The historical-record convention

Not written down in canon itself, but real practice: dated entries — `DEVELOPMENT.md`'s
`### 2026-08-21 — ...` sections, `project-governance.md` Section 6's progress-history table, a gate
report's evidence — describe what was true **at the time**. They are not rewritten later just because
something they mention gets renamed or superseded. Only living, currently-active prose and
currently-reproducible commands get updated when something changes.

The one deliberate exception: a bare **navigational pointer** inside a historical entry gets a light
touch if the name it points to would otherwise dead-link — without rewriting the historical claim
itself. `DEVELOPMENT.md`'s "2026-08-21 — Milestone 1 built" entry is the worked example, and both
halves are visible in the same paragraph:

- The command list in that entry still reads `./bin/playground.ts run|watch|verify <scenario>` —
  the tool's name at the time the entry was written. It is **not** updated to `grid.ts`, even though
  that's what the tool is called today, because the entry is a historical record of what that session
  ran.
- The very next line reads: "See the `grid-screenshots` skill (renamed from `playground-screenshots`
  since this entry was written)." — a bare pointer to a skill directory, given the light touch:
  renamed to the name that resolves *today*, with a parenthetical noting it changed, rather than left
  pointing at a directory that no longer exists.

Contrast both with **currently-active prose** elsewhere — `DEVELOPMENT.md`'s own "Current commands"
section, `AGENTS.md`, this skill, the `grid` skill — which carries no historical qualifier at all and
just says `grid` / `./bin/grid.ts` / `grid-screenshots` outright, because it is describing what is
true now, not recording what was true once.

## Related

- [`../../../AGENTS.md`](../../../AGENTS.md) — the full operating contract this skill is a companion
  to; Sections 2, 6, and 9 are what this skill expands.
- [`../../../specs/project-governance.md`](../../../specs/project-governance.md) — canon authority,
  the evidence loop, bounded autonomy, the execution ledger, locked decisions.
- [`../../../specs/open-questions.md`](../../../specs/open-questions.md) — the live register; read
  Section 4 before registering a new row, so you don't duplicate one.
- [`../../../specs/templates/gate-report.md`](../../../specs/templates/gate-report.md) — copy this to
  close a gate.
- [`../grid/SKILL.md`](../grid/SKILL.md) — running `grid` itself: scenarios, the report, determinism
  verification. What the gate-report evidence in this skill is usually evidence *of*.
- [`../grid-screenshots/SKILL.md`](../grid-screenshots/SKILL.md) — capturing the human-observation
  half of a gate report's Section 5.
