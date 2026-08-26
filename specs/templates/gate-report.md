# Gate report template

**Document role:** Fill-in template for closing a milestone gate
**Status:** Template — copy it, do not edit it in place
**Canon version:** 2.8
**Updated:** 2026-08-26
**License:** Apache-2.0

Copy this file to the spike's `evidence/report.md` and fill it in **as you work**, not afterwards.
Sections 1 and 2 are written before the first line of code. A report reconstructed from memory at the
end is how a gate quietly turns into a summary of whatever got built.

Delete nothing. A heading with "not applicable" underneath it is information; a missing heading is
not.

---

## 1. Frame — written before coding

- **Canon version:**
- **Milestone and gate:**
- **Question this gate answers:** (one sentence, in the form of a question)
- **Smallest artifact that can answer it:**
- **Automated evidence planned:**
- **Human observation planned:** (who looks at it, and what they are asked)
- **Explicit exclusions:** (what this gate is deliberately not doing)
- **Stop conditions:** (what would make you stop early rather than push through)

## 2. Environment — pinned, not remembered

| | |
| --- | --- |
| OS and architecture | |
| Runtime and exact version | |
| Dependencies and exact versions | |
| Hardware, if it affects measurements | |
| Date measured | |

Commands, copy-pasteable, in the order a stranger would run them:

```bash
# install
# build
# test
# run
```

## 3. What was built

What exists now that did not before. Keep it to what a reviewer needs to find their way around the
diff; the diff is the detail.

## 4. Automated results

Every claim here is reproducible by a command in Section 2. Facts only — save the reading of them
for Section 6.

| Check | Result | Evidence |
| --- | --- | --- |
| | | |

Measurements:

| Metric | Value | Method | Samples |
| --- | --- | --- | --- |
| | | | |

## 5. Human observations

Only what a person actually saw, in their words where possible. Say who, when, and what they were
asked. If nobody has looked at it yet, write that — an experiential claim with no human behind it is
the one failure mode this whole process exists to prevent.

## 6. Interpretation

Now you may argue. What the numbers mean, what surprised you, what you expected and did not get.
Keep it separate from Section 4 so a later reader can disagree with your reading without losing the
data.

## 7. Failures, surprises, and discarded approaches

What did not work, and what a future session should not waste an afternoon rediscovering. This
section is often the most valuable one in the file. An empty one usually means it was not filled in
honestly.

## 8. Decision

> **PASS** / **REVISE** / **STOP** / **BLOCKED**

One paragraph on why. If REVISE, name the single comparator or change required and the criterion it
must satisfy. If BLOCKED, name exactly who or what unblocks it.

## 9. Canon impact

Proposed changes, each with the document that would own it. **Nothing here is applied until Mario
accepts the gate.**

| Proposed rule | Would live in | Earned by |
| --- | --- | --- |
| | | |

Questions raised, each already added to [`../open-questions.md`](../open-questions.md) with a
recommendation:

| ID | Question | Recommendation |
| --- | --- | --- |
| | | |

## 10. Next authorized action

One sentence. What the next session should do, and nothing beyond it.
