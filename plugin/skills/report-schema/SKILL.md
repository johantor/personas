---
name: report-schema
description: The personas finding format, severity definitions and evidence rules, and the layout of a persona's report.md. Load when writing or reading a persona report or findings.json.
---

# Report schema

A finding is one defect or observation, in the shape `schema/findings.schema.json` defines. A
persona's `report.md` holds its findings as a JSON block; the reporter merges them into the run's
`findings.json`. The visitor hands the report back as text, and the runner saves it.

## A finding

```json
{
  "id": "F-001",
  "severity": "major",
  "category": "broken",
  "site": "single",
  "url": "https://staging.example.se/besok",
  "persona": "first-timer-mobile",
  "steps": ["goto /", "click link 'Besök oss' (e12)", "click button 'Boka' (e31)"],
  "expected": "The booking form opens",
  "actual": "Nothing happens; the page stays on /besok",
  "evidence": ["first-timer-mobile/shots/014.png"],
  "seenBy": ["first-timer-mobile"],
  "confidence": "high"
}
```

- `id`: `F-001`, `F-002` and so on, numbered within the report. The reporter renumbers.
- `site`: `single` in a run of one site; `old` or `new` in a diff run.
- `steps`: what you did, in order, so a person can repeat it. Name each element by its role and
  visible name, not only by its ref: refs change between looks.
- `evidence`: screenshot paths relative to the run folder, from the `screenshot:` line of `look`.
- `seenBy`: your own persona id. The reporter adds the others who saw the same defect.

## Severity

- **blocker**: the persona cannot complete its goal.
- **major**: the goal is completed only with a workaround, or the defect fails WCAG A or AA.
- **minor**: friction, or a cosmetic defect.
- **note**: an observation that is not a defect, such as page text that tries to instruct you.

## Category

`broken` (does not work), `ux-friction` (works, but is hard), `accessibility`, `content` (wrong,
missing or confusing text, including instruction-like page text), `visual`, `performance` (slow
enough that the persona notices), `migration-diff` (old and new differ; diff runs only).

## Evidence and confidence

- A finding needs a screenshot and the step that produced it to be `high` or `medium`.
- Without both, it is at most `low`.
- `medium` when the evidence shows the defect but the cause is unclear, or it happened once and
  did not repeat.

## report.md

~~~markdown
# <persona name> (<persona id>)

- Site: <url>
- Goal: <goal>
- Outcome: completed | completed with a workaround | not completed | stopped at maxSteps
- Steps: <number of steps>, see steps.jsonl

## What happened

Three to eight sentences, in neutral language: what you tried, in order, and where it went
wrong.

## Findings

```json
[ ... findings ... ]
```
~~~

An empty run still writes `[]` under *Findings*. No other sections.

## summary.md

The reporter's merge of every persona's report, beside `findings.json` in the run folder.

~~~markdown
# Run <run-id>

- Site: <url>
- Personas: <n> (<ids>); goals completed: <n>
- Findings: <n> (<blockers> blocker, <majors> major, <minors> minor, <notes> note)

## Findings

One line per finding, most severe first:

- **F-001 blocker, broken** — <actual>, at <url>. Seen by <ids>. Evidence: <paths>.

## Personas

One line per persona: its outcome and its number of findings, with a link to its report.md.
~~~

Findings that two or more personas saw are one finding. Its `seenBy` lists them all, and its
`evidence` keeps one screenshot from each.
