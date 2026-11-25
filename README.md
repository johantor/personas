# personas

[![Validate](https://github.com/johantor/personas/actions/workflows/validate.yml/badge.svg)](https://github.com/johantor/personas/actions/workflows/validate.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

**Your site, browsed by the visitors you define.** personas is a
[Claude Code](https://code.claude.com/docs/en/overview) plugin. You describe a few visitors in
`personas.json`: a first-timer on a slow phone, a keyboard-only user, a new CMS editor. Each one
browses the site in its own isolated browser as a Claude Code agent and reports what broke, with
the steps and screenshots. A reporter merges the reports into one summary.

> **Status: not usable yet.** The plugin is being built; the design and milestones are in
> [#1](https://github.com/johantor/personas/issues/1). It is not in the `johantor` marketplace
> until v1 is done.

## Why personas

- **Migration and upgrade checks.** Run the same personas against the old and the new site, and
  get a report of what changed. Built for Optimizely CMS upgrades.
- **Local, so it reaches what CI cannot.** It runs on your machine, against localhost, staging,
  or a site behind a VPN. No emulators, no CI runners.
- **Reports, never fixes.** A persona reads pages and writes findings. It does not change code,
  and it submits no form unless the persona allows writes.

## Planned commands

| Command | What it does |
|---|---|
| `/personas:init` | Interviews you about the site, then writes `.personas/personas.json` and `.personas/brief.md`. |
| `/personas:run [url]` | Runs the personas against one site, in parallel batches. |
| `/personas:diff --old <url> --new <url>` | A scripted page sweep of both sites with no model calls, then each persona's tasks on both. |
| `/personas:report [run-id]` | Re-opens the merged summary of a run. |

## The browser CLI

`plugin/bin/persona-browser` is the browser each visitor drives, and you can drive it by hand. It
needs Node 20+ and Playwright: `npm install -D playwright && npx playwright install chromium webkit`.

```bash
persona-browser start --session a --persona .personas/personas.json --persona-id anna \
  --run .personas/runs/r1 --url http://localhost:3000
persona-browser look --session a                    # screenshot path + accessibility tree with refs
persona-browser act  --session a --ref e12 --do click
persona-browser type --session a --ref e7 --text "opening hours" --submit
persona-browser stop --session a                    # also lists the blocked hosts
```

Each session has its own browser context, so sessions share no cookies, storage or auth. Every
action goes to `<run>/<persona-id>/steps.jsonl`. The CLI refuses:

- Navigation to a host that is not the `--url` host or listed under `## Allowed hosts` in
  `brief.md`.
- Requests to analytics and tag hosts, plus any listed under `## Blocked hosts`.
- Every request except GET and HEAD, unless the persona sets `allowWrites`. A GET form, such as a
  search, is sent.

A host in either list also matches its subdomains.

## Known gaps

- A redirect from an allowed host to another host sends that one GET before `persona-browser`
  notices and leaves the page, because Playwright does not route a redirect's follow-up request.
- The allowlist covers the top-level page. Iframes from other hosts load and can be clicked.
- WebSocket messages are not checked by the write refusal.

## Privacy

Everything a run writes stays on disk under `.personas/` in your project. The plugin contacts only
the sites under test, and blocks common analytics and tag hosts so runs don't skew the site's
statistics; a host missing from that list still receives the run's traffic. Claude Code itself
sends your prompts and the pages the agents read to Anthropic. See [PRIVACY.md](PRIVACY.md).

## Documentation

- [#1](https://github.com/johantor/personas/issues/1): the design, scope and milestones.
- [AGENTS.md](AGENTS.md): contributing, validating and releasing.
- [SECURITY.md](SECURITY.md): reporting a vulnerability.
- [crew](https://github.com/johantor/crew): a lead agent and specialists for Optimizely work. It
  can run personas as a step in a larger flow, once v1 is out.

## License

[Apache-2.0](LICENSE). The plugin collects no data and sends nothing to the maintainers; see
[PRIVACY.md](PRIVACY.md). An independent project, not affiliated with or endorsed by Anthropic.
