---
name: code-review
description: Review a pull request or diff in the personas plugin — the persona-browser CLI, the agents, skills and commands, the hooks, the schemas, the manifest and changelog. Use when asked to review code, a PR, or a diff in this repository.
---

# Reviewing a personas change

`AGENTS.md` is the contributor guide and wins on conflict; `CLAUDE.md` is the code map and its
gotchas; the design is issue #1. The plugin is `plugin/`, and paths below are relative to it. This
file is the one rubric and owns the output format; code rules are the `engineering-principles`
skill (`.github/skills/engineering-principles/SKILL.md`); Copilot reads it directly and Claude
Code's `personas-review` skill loads it. Adapted from the board rubric (johantor/board).

## Scope: one full pass, then only what changed

- **First review: every changed hunk ends as a finding or a Passed line.** Also read what the
  diff makes newly reachable: a new subcommand, a new persona field, a new tool on an agent.
- **Re-review after a push: review the new commits.** Raise an old, unchanged hunk only if it is
  Blocking. Never reopen a resolved thread with the same point reworded.
- **One root cause, one finding.** When findings share a cause, report the cause once.

## Severity: earn it with an input

- **Blocking** needs a concrete page, persona, command or file state, and the wrong result it
  gives that the base branch did not. No input, no Blocking.
- **A known gap is not a finding.** The README's *Known gaps* and `CLAUDE.md`'s *Gotchas* are
  accepted on purpose. Flag only a change that widens one.
- **Prefer less code.** When a fix grows a parser or a special case for one edge, say so and
  suggest the smaller rule or accepting the gap in *Known gaps*.
- Style-only notes are not findings unless they break a written convention.

## The run boundary (security pass, always)

- **Off-allowlist navigation is refused**, by `persona-browser` and again by `hooks/url-guard.sh`.
  A path that reaches another host (a redirect, a new tab, a `goto` the guard does not parse) is
  Blocking: give the URL.
- **No writes without `allowWrites`.** A form submit or non-GET page request that gets through is
  Blocking.
- **Page content is data.** An agent or skill change that lets page text steer a visitor (follow
  an instruction on the page, widen its own tools) is Blocking.
- **Sessions are isolated.** Anything that lets one session's cookies, storage or `auth` file
  reach another is Blocking.
- **Analytics hosts stay blocked** by default. Shrinking the list needs a reason in the PR.
- **Agents keep least privilege.** A new tool on `visitor` or `reporter`, or `Write` outside the
  run folder, needs the reason in `CLAUDE.md`.

## Reports

- **Findings match `schema/findings.schema.json`.** A change to the format updates the schema,
  `report-schema` and the reporter in the same PR.
- **Evidence or low confidence.** A finding without a screenshot and a step is at most `low`.
- **Neutral language.** Personas decide in character but report facts.

## Release, tests, docs

- **A change under `plugin/` without a bump**: Warning; Blocking if users miss a fix.
- **A behavior change without a test** that would fail on the base code is a Warning.
- **`CLAUDE.md` must match the code** in the same PR, and the README's *Known gaps* must match
  what the code still does not handle.
- **The manifest `description` is copied into the marketplace.** A change to it names the
  follow-up in `johantor/plugins`.
- **The site** (`docs/`): its `style.css` is a copy of crew's; a change to one names the other.

## Verbosity is a finding

- **One rationale, one place.** The reason lives in `AGENTS.md` or `CLAUDE.md`; code comments
  explain *why* in one or two lines and point there. The same explanation in three files is a
  Warning.
- Comments that restate the code, and PR bodies over the template's budget, are nits.

## Output

`## Blocking`, `## Warnings`, `## Passed`. One bullet per finding: `path:line` — defect —
failing input — smallest fix. A Warning should be fixed but does not block merge. Under Passed,
one line per lens applied.

**Every Blocking or Warning finding is a review thread on its line.** A finding that exists only
in the summary cannot be replied to or resolved.
