# Changelog

All notable changes to the `personas` plugin are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] - 2026-11-27

### Added

- `persona-browser look` ends with `checks:`: the load time, content wider than the screen, images without alt text, and text below the WCAG contrast ratio. The visitors report them as findings (#14).

## [0.6.0] - 2026-11-26

### Added

- `/personas:diff`, which sweeps an old and a new site with `personas-sweep` (no model calls), then runs each persona on both, and merges both with the sweep in a diff report (#13).
- The `migration-diff` skill, with the Optimizely specifics, and a diff mode in the reporter (#13).

## [0.5.0] - 2026-11-26

### Added

- `/personas:init`, which checks the dependencies, interviews you and writes `personas.json` from a starter set of five personas, plus `brief.md` and the `.gitignore` entries (#12).
- The `personas.json` schema, and `persona-browser check` for Node, Playwright and its browsers (#12).

### Changed

- `personas-check-findings` is now `personas-check findings <file>`, and `personas-check personas <file>` checks `personas.json` (#12).

## [0.4.0] - 2026-11-26

### Added

- `/personas:run`, which runs the personas in batches and merges their reports, and `/personas:report`, which shows a run's summary (#11).
- The `reporter` agent, the `personas-runner` skill, and `personas-check-findings`, which checks `findings.json` against the schema (#11).

## [0.3.0] - 2026-11-25

### Added

- The `visitor` agent, the `persona-contract` and `report-schema` skills, the findings schema, and the `url-guard` and `visitor-guard` hooks (#10).
- `persona-browser` refuses steps past the persona's `maxSteps`, and rejects a `maxSteps` that is not a positive whole number (#10).

## [0.2.0] - 2026-11-23

### Added

- `persona-browser`, a CLI that keeps one isolated browser per session, with the allowlist, the analytics block list, write refusal and `steps.jsonl` (#9).

## [0.1.0] - 2026-11-23

### Added

- The plugin manifest. There are no commands yet; the milestones are in #1.
