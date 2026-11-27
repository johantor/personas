# personas — Claude Code notes

This repository is the `personas` Claude Code plugin: the plugin lives in `plugin/`. The
`johantor` marketplace lives in [johantor/plugins](https://github.com/johantor/plugins). The
design, scope and milestones are in [#1](https://github.com/johantor/personas/issues/1).

**Start with [AGENTS.md](AGENTS.md)**: the contributor guide (layout, validating, releasing,
conventions). It is the single source of truth for working in this repo. This file holds how
Claude works here, then the code map. **Keep it accurate: a PR that changes anything stated here
updates this file in the same commit.**

## Communication style

Use ASD-STE-100 (Simplified Technical English) when you speak to the operator: short sentences,
the active voice, one instruction per sentence, and the same word for the same thing each time.
This applies to what you say to the operator, not to what you write into the repository.

## Engineering rules

Every change follows
[`engineering-principles`](.github/skills/engineering-principles/SKILL.md). Read it before you
write code, and re-read your diff against it before you finish. Before you open a PR or push to
one, run the `personas-review` skill on the diff and fix its Blocking and Warning findings first.

## Brevity

- **Replies**: the result first, then what the operator must decide. Under 150 words unless the
  operator asks for more.
- **Code comments**: explain *why*, in one or two lines. A longer rationale lives once, here or in
  `AGENTS.md`, and the comment points there.
- **Docs and PR bodies**: facts, not history. Before you add a paragraph, cut one.
- **Fixes**: prefer removing code to adding a parser. If a second review round finds new edge
  cases of the mechanism you already patched, stop and ask the operator: redesign, or accept the
  gap and list it in the README's *Known gaps*.

## Developing with crew

The repo carries a crew configuration in [.claude/crew.md](.claude/crew.md), so `/crew:feature`
and `claude --agent crew:lead` work here: `lead` plans and delegates each step to a worker
subagent that edits files in this working tree. With the crew hooks loaded, reads and writes go
through `Read`, `Edit` and `Write`, not the shell, and nothing is pushed until the operator runs
`/crew:pr`.

## Map

Paths in *Map* and *Gotchas* are relative to `plugin/`, the directory users install.

- `.claude-plugin/plugin.json` — the manifest. Its `description` is copied word for word into
  the marketplace entry in `johantor/plugins`, so a change here is a change there.
- `bin/persona-browser` — a `sh` wrapper that checks for Node, then runs
  `lib/persona-browser.cjs`: the CLI (`check` needs no session; `look` adds measured
  `checks:`) and its daemon, one Playwright context per session id on a socket in a `0700` temp
  directory. It enforces the allowlist, the
  block list and `allowWrites` in one `context.route()`, and appends every action to
  `steps.jsonl`. A GET form is allowed without `allowWrites`, so personas can search (operator
  decision, #9).
- `agents/visitor.md` — one persona on one site. Tools `Bash`, `Read`, `Skill`; it preloads
  `persona-contract` (how to play and stay in bounds) and `report-schema` (the report layout).
  It hands its `report.md` back as text, and the caller saves it (*Gotchas*).
- `schema/findings.schema.json` — the finding format; `report-schema` explains it.
- `hooks/url-guard.sh` — PreToolUse on Bash: refuses `persona-browser goto` to a host off the
  session's allowlist, read from the `<session>.hosts` file the daemon writes beside its socket.
- `hooks/visitor-guard.sh` — PreToolUse on Bash: the `personas:visitor` agent runs one plain
  `persona-browser` command (`look`, `act`, `type`, `key` or `goto`), with no chaining,
  substitution or redirection. The runner starts and stops each session, because `start --url`
  sets the allowlist.
- `commands/run.md` — `/personas:run [url] [--only id,id] [--batch N]`; it loads
  `skills/personas-runner/`, the fan-out that any runner follows (crew's `lead` too).
- `agents/reporter.md` — merges a run's reports. Tools `Read`, `Skill`; it hands back
  `findings.json` and `summary.md` as text, and the runner saves them.
- `commands/report.md` — `/personas:report [run-id]`: shows a run's summary, or re-renders it.
- `bin/personas-check` — `personas-check <findings|personas> <file>` runs
  `lib/check-schema.cjs` against `schema/<name>.schema.json`. It supports only the keywords our
  schemas use (local `$ref` included) and refuses any other, so a schema change that needs more
  fails loudly.
- `commands/init.md` — `/personas:init [url]`: runs `persona-browser check` (Node, Playwright,
  chromium and webkit), interviews the operator, and writes `personas.json` from the starter set
  inline in the command and `brief.md`. `tests/plugin.test.sh` validates that starter set.
- `schema/personas.schema.json` — `personas.json`; `defaults` and each persona share their field
  definitions through `$defs`.
- `commands/diff.md` — `/personas:diff --old <url> --new <url>`: the runner skill's *Diff runs*.
  It sweeps first, then runs each persona on both sites into `<run>/old/` and `<run>/new/`, and
  the reporter merges both with the sweep in diff mode.
- `bin/personas-sweep` — runs `scripts/sweep.mjs`, the diff phase with no model calls. It writes
  `sweep.json`, plus `sweep-changes.json` with only the rows that differ, which is what the
  reporter reads. The browser computes the pixel diff on a canvas, so no image library is needed.
  It fetches sitemaps only from the two sites' hosts, and refuses a page that redirects off its
  own site, as `persona-browser` refuses an off-allowlist host.
- `skills/migration-diff/` — what a meaningful difference is, what to ignore, and the Optimizely
  specifics. The reporter preloads it.
- `lib/browser-common.cjs` — the analytics block list, host matching and the Playwright loader,
  shared by `persona-browser` and the sweep so both refuse the same hosts.

## Gotchas

- Parallel subagents in one session share its MCP servers, so visitors must not drive a shared
  browser MCP: their tabs and cookies would collide. That is why `persona-browser` keeps one
  browser context per session id (#1, *browser isolation*).
- `persona-browser` blocks service workers, because their requests bypass `context.route()` and
  so would bypass the allowlist and the write refusal.
- Claude Code refuses a subagent's Write of a report file ("Subagents should return findings as
  text"); the guard also matches source files with `report` in the name. So the visitor and the
  reporter have no `Write` tool and hand their output back; the runner saves it.
- `persona-browser` counts steps and refuses past `maxSteps`, so the limit does not depend on the
  model. The visitor's `maxTurns: 100` is only a backstop.
