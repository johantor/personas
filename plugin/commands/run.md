---
description: Run the personas in .personas/personas.json against a site, in parallel batches, and write a merged summary.md and findings.json
argument-hint: "[url] [--only id,id] [--batch N]"
---

Run personas against a site. Arguments: `$ARGUMENTS`

Load the `personas-runner` skill with the Skill tool and follow it. The arguments are an optional
site URL, `--only` with comma-separated persona ids, and `--batch` with the number of visitors
that run at the same time (default 6).

If `.personas/personas.json` does not exist, stop and say that `/personas:init` writes it.
