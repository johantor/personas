# Privacy Policy

**Effective date:** 2026-11-23

This policy covers the `personas` plugin published from this repository and distributed through
the `johantor` marketplace.

## The short version

The plugin collects nothing. It runs on your machine, there is no server behind it, no account and
no telemetry, and no data of yours reaches the maintainers.

The plugin has no commands yet. The sections below describe what v1 does (#1), and change with
it.

## Data processed on your machine

A run writes under `.personas/` in your project: the personas and brief you define, and for each
run the per-persona reports, a log of every browser action (`steps.jsonl`), screenshots, and the
merged summary. Optional login state for test accounts lives in `.personas/auth/`. The plugin adds
`.personas/runs/` and `.personas/auth/` to your `.gitignore`, so screenshots and logins are not
committed by accident.

## Data that leaves your machine

From the plugin, only the browser traffic to the sites under test, which a run reaches the way a
visitor's browser would. Navigation outside the run's allowlist is refused, and requests to common
analytics and tag hosts are blocked; a host missing from that list still receives the traffic.
Claude Code itself sends your prompts, and the screenshots and page text the agents read, to
Anthropic, under [Anthropic's Privacy Policy](https://www.anthropic.com/legal/privacy).

## Third parties

The maintainers share no data with anyone, because they receive none.

## Changes to this policy

Changes are made in this file, and its history is public in this repository's git log.

## Contact

Questions about this policy: open an issue at <https://github.com/johantor/personas/issues>. To
report a security vulnerability, follow [SECURITY.md](SECURITY.md) instead.
