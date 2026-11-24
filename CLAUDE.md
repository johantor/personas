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
  `lib/persona-browser.cjs`: the CLI and its daemon, one Playwright context per session id on a
  socket in a `0700` temp directory. It enforces the allowlist, the block list and `allowWrites`
  in one `context.route()`, and appends every action to `steps.jsonl`. A GET form is allowed
  without `allowWrites`, so personas can search (operator decision, #9).
- `hooks/hooks.json` — empty until `url-guard.sh` lands (M2, #4). It exists now because
  `tests/lib.sh` needs `plugin/hooks/`.

Planned, per #1, and added to this map by the PR that adds each: `agents/`,
`skills/persona-contract/`, `skills/report-schema/`, `schema/findings.schema.json` and
`hooks/url-guard.sh` (M2), `commands/run.md`, `commands/report.md`, `agents/reporter.md` and
`skills/personas-runner/` (M3), `commands/init.md` and `schema/personas.schema.json` (M4),
`commands/diff.md`, `scripts/sweep.mjs` and `skills/migration-diff/` (M5).

## Gotchas

- Parallel subagents in one session share its MCP servers, so visitors must not drive a shared
  browser MCP: their tabs and cookies would collide. That is why `persona-browser` keeps one
  browser context per session id (#1, *browser isolation*).
- `persona-browser` blocks service workers, because their requests bypass `context.route()` and
  so would bypass the allowlist and the write refusal.
