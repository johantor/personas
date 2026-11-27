# personas

[![Validate](https://github.com/johantor/personas/actions/workflows/validate.yml/badge.svg)](https://github.com/johantor/personas/actions/workflows/validate.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

**Your site, browsed by the visitors you define.** personas is a
[Claude Code](https://code.claude.com/docs/en/overview) plugin. You describe a few visitors in
`personas.json`: a first-timer on a slow phone, a keyboard-only user, a new CMS editor. Each one
browses the site in its own isolated browser as a Claude Code agent and reports what broke, with
the steps and screenshots. A reporter merges the reports into one summary.

> **Status: in development.** All four commands work; `/personas:diff` still needs validation
> on a real Optimizely migration. The design and milestones are in
> [#1](https://github.com/johantor/personas/issues/1). It is not in the `johantor` marketplace
> until v1 is done.

## Why personas

- **Migration and upgrade checks.** Run the same personas against the old and the new site, and
  get a report of what changed. Built for Optimizely CMS upgrades.
- **Local, so it reaches what CI cannot.** It runs on your machine, against localhost, staging,
  or a site behind a VPN. No emulators, no CI runners.
- **Reports, never fixes.** A persona reads pages and writes findings. It does not change code,
  and it submits no form unless the persona allows writes.

## Commands

| Command | What it does |
|---|---|
| `/personas:init [url]` | Checks Node and the Playwright browsers, interviews you about the site, then writes `.personas/personas.json` and `.personas/brief.md`. |
| `/personas:run [url] [--only id,id] [--batch N]` | Runs the personas against one site, 6 at a time by default, and writes `summary.md` and `findings.json` in `.personas/runs/<run-id>/`. Without a URL, it takes the `URL:` line under `## Site` in `brief.md`. |
| `/personas:diff --old <url> --new <url> [--sitemap <url> \| --urls <file>]` | A scripted page sweep of both sites with no model calls, then each persona's tasks on both. |
| `/personas:report [run-id]` | Shows the summary of a run, the latest by default, and re-renders it from the reports when it is missing. |

## The browser CLI

`plugin/bin/persona-browser` is the browser each visitor drives, and you can drive it by hand. It
needs Node 20+ and Playwright: `npm install -D playwright && npx playwright install chromium webkit`.

```bash
persona-browser start --session a --persona .personas/personas.json --persona-id anna \
  --run .personas/runs/r1 --url http://localhost:3000
persona-browser look --session a                    # screenshot, accessibility tree with refs, checks
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

## Demo

`demo/` is a small museum site with 11 planted bugs and four starter personas; the answer key is
`demo/EXPECTED.md`. To run it, start the site, then run the personas from the `demo/` folder:

```bash
node demo/site.cjs &            # http://localhost:4400/
cd demo && claude --plugin-dir ../plugin
> /personas:run
```

The v1 acceptance run (v0.6.0, 2026-11-27, one run, all four personas in one batch, at most 20
steps each):

| Measure | Result |
|---|---|
| Planted bugs found | 6 of 11: the dead "Next" button, the unlabelled date field, the missing weekend hours, the 404 menu link, the keyboard-unreachable menu, the English text on the Swedish page |
| Missed | the empty search results, the low-contrast prices, the image without alt text, the phone overflow, the 4-second page |
| Other real defects found | 3: the booking link hidden from the "book from the menu" text, Swedish navigation that leads to English pages, no skip link |
| Wall time | 3 min 4 s |
| Tokens | 30,151 output, 1,584,470 cache reads, 172,756 cache writes, 112 uncached input |
| Cost | $1.38: $0.83 for the runner session (Opus), $0.56 for the four visitors and the reporter (Sonnet) |

No persona's goal needed search, so its bug went unseen. The other misses are visual or timing
defects (contrast, overflow, load time) that the accessibility tree does not show, and the
missing alt text, which the tree shows but no visitor reported. A persona whose goal needs
search, or one told to check images and contrast, would catch more.

## Known gaps

- A redirect from an allowed host to another host sends that one GET before `persona-browser`
  notices and leaves the page, because Playwright does not route a redirect's follow-up request.
- The allowlist covers the top-level page. Iframes from other hosts load and can be clicked.
- WebSocket messages are not checked by the write refusal.
- A visitor can drive another visitor's session if it names that session id. The sessions still
  share no cookies, and both stay on their allowlists.
- The sweep loads pages without a login, so it compares only what an anonymous visitor sees.
- The visitor cannot type `& | ; $ < > ( ) \` or a backtick: `visitor-guard` refuses them in its
  commands, so it types a close variant.

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
