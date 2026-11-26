---
description: Compare an old and a new site after a migration or upgrade — a scripted page sweep with no model calls, then each persona's tasks on both sites, merged into one diff report
argument-hint: "--old <url> --new <url> [--sitemap <url> | --urls <file>] [--only id,id] [--batch N]"
---

Compare an old and a new site. Arguments: `$ARGUMENTS`

Load the `personas-runner` skill with the Skill tool and follow it, with its *Diff runs* section.
`--old` and `--new` are required; without one, stop and ask for it. Without `--sitemap` or
`--urls`, the sweep reads the old site's `/sitemap.xml`.

If `.personas/personas.json` does not exist, run the sweep only, and say that `/personas:init`
writes the personas for the second phase.
