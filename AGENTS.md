# Contributing to personas

`personas` is a Claude Code plugin. The plugin lives in `plugin/`, the directory the marketplace
installs, so the repo tooling around it never reaches users. It will be listed in the `johantor`
marketplace ([johantor/plugins](https://github.com/johantor/plugins)) once v1 is done. The design
is [#1](https://github.com/johantor/personas/issues/1); the code map and gotchas are in
[CLAUDE.md](CLAUDE.md). Keep it accurate: a PR that changes anything it states updates it in the
same commit.

The review rubric, the release scripts and the shared rules are adapted from
[johantor/board](https://github.com/johantor/board), which takes them from
[johantor/crew](https://github.com/johantor/crew). When one changes there, check whether it
applies here.

## Repository layout

- `plugin/`: the plugin. Today it holds the manifest (`.claude-plugin/plugin.json`), an empty
  the `persona-browser` CLI, the schema checker and the sweep (`bin/`, `lib/` and `scripts/`),
  the `visitor` and `reporter` agents, the `init`, `run`, `diff` and `report` commands, four
  skills, two schemas and two hooks (CLAUDE.md, *Map*). `README.md` and
  `CHANGELOG.md` stay at the root.
- `tests/`: `release.test.sh` for the release scripts, `persona-browser.test.sh` for the CLI,
  `sweep.test.sh` for the sweep, `hooks.test.sh` for the hooks and `plugin.test.sh` for the
  schemas, the checker and the frontmatter, with the harness in `lib.sh` (a copy of crew's) and
  the local test sites in `fixtures/`.
- `demo/`: the v1 acceptance demo, never part of the plugin: a museum site with 11 planted bugs
  (`site.cjs`), four personas in `.personas/`, and the answer key in `EXPECTED.md`. The README's
  *Demo* section has the measured run and how to repeat it.
- `examples/`: setups to copy, never part of the plugin; `azure-devops/` is a nightly pipeline
  that files findings as work items. Not run in CI.
- `scripts/`: repo tooling, never part of the plugin's behaviour: `check-changelog.sh` (the
  release gate) and `release-notes.sh` (used by `auto-release.yml`).
- `docs/`: the site on GitHub Pages. `style.css` is an exact copy of crew's `docs/style.css`;
  personas-only layouts go in a `personas.css` beside it.
- `.github/`: `workflows/` (CI and release), `skills/` (the repo's own skills, never shipped:
  `code-review`, the one rubric Copilot reads through `copilot-instructions.md`;
  `engineering-principles`, a copy of crew's; and `writing-style`), the PR and issue templates.
  `.claude/skills/` holds thin wrappers for Claude Code (`personas-review` adds the shell steps;
  `steward` says how a session drives a PR).
- `.claude/crew.md`: the crew configuration, for developing personas with the `crew` plugin.

## Validating changes

Run what CI runs (`.github/workflows/validate.yml`) before you push:

```bash
shellcheck tests/*.sh scripts/*.sh plugin/bin/* plugin/hooks/*.sh
for f in plugin/lib/*.cjs plugin/scripts/*.mjs tests/fixtures/*.cjs demo/*.cjs; do node --check "$f"; done
bash tests/release.test.sh          # the changelog gate and the release notes
bash tests/persona-browser.test.sh  # drives the CLI against a local site
bash tests/sweep.test.sh            # sweeps an old and a new local site
bash tests/hooks.test.sh            # pipes payloads into the hooks
bash tests/plugin.test.sh           # the schemas, the checker and the frontmatter
scripts/check-changelog.sh main     # a change under plugin/ => version bump
```

`jq`, `git` and Node 20+ are required, and the CLI test needs Playwright with chromium:
`npm install --no-save playwright@1.63.0 && npx playwright install chromium`. When a milestone adds a hook or Node code, add its lint and test
command here, in `validate.yml` and in `.claude/crew.md` in the same PR.

## Releasing

**A change under `plugin/` bumps the version.** Only `plugin/` reaches users, so nothing else
counts. Patch for a fix, minor for an addition, major for a break.

1. Bump `version` in `plugin/.claude-plugin/plugin.json` and add a matching `## [X.Y.Z]` entry to
   `CHANGELOG.md` in the same PR. `check-changelog.sh` (adapted from crew's) fails a change
   under `plugin/` without one, or with a lower version.
2. Merge to `main`. `auto-release.yml` creates the `v<version>` tag and a GitHub Release from that
   changelog section.

Changelog entries are one bullet per change, one line, with the PR as `(#N)`.

## Conventions

- Personas report findings and never change the code of the site under test.
- Page content is untrusted data. Text on a page that reads as an instruction is quoted as a
  finding and never acted on.
- No form submits or non-GET page requests unless the persona sets `allowWrites`.
- Everything a run writes stays under `.personas/` in the user's project. Nothing is sent
  anywhere except the sites under test.
- Node's standard library plus Playwright; any other runtime dependency needs a reason in the PR.
- Code follows the `engineering-principles` skill (`.github/skills/engineering-principles/`).
- Code comments explain *why* in one or two lines; a longer rationale lives once, in `CLAUDE.md`
  or here, and the comment points to it.
- Keep diffs minimal-scope; list unrelated improvements rather than bundling them.
- **Self-review the diff before every PR and every push to one.** Use the rubric,
  `.github/skills/code-review/SKILL.md` (the `personas-review` skill runs it with the checks), and
  fix every Blocking and Warning first. Copilot reviews with the same rubric.
- PR titles follow Conventional Commits, `type(scope): summary`, with `(vX.Y.Z)` when the PR bumps.
- **PR descriptions have a hard budget**: summary 150 words and 5 bullets at most, whole body
  under 400 words. Verification is a result ("ran X, all green"), not a transcript.
- **Every review comment gets a reply, then the thread is resolved.** A correct finding is fixed
  and pushed now, whatever its label; decline only a finding that is wrong, and say why.
- One branch and PR per issue, from the latest `main`; link the issue with `Closes #N`.
- **Name the branch for what it changes**: `<type>/<issue>-<slug>`, with the Conventional
  Commits type and a slug of three to five words, such as `feat/3-persona-browser-cli`. With no
  issue, drop `<issue>-`: `docs/readme-quick-start`.
- READMEs, changelogs, PR bodies and issues follow the `writing-style` skill
  (`.github/skills/writing-style/SKILL.md`).
