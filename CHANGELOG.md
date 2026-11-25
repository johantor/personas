# Changelog

All notable changes to the `personas` plugin are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
