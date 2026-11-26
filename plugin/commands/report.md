---
description: Show the summary of a personas run — the latest by default — and re-render it from the persona reports when it is missing
argument-hint: "[run-id]"
---

Show a personas run summary. Arguments: `$ARGUMENTS`

1. The run is `.personas/runs/<run-id>/` for the given run id, or the newest folder in
   `.personas/runs/` when there is none. With no runs, say that `/personas:run` makes one.
2. If `summary.md` exists, show it and the path of `findings.json`. Stop.
3. If it does not, but persona `report.md` files do, re-render. The personas are the folders
   with a `steps.jsonl`, and the URL is the `- Site:` line of a saved report, not the current
   brief, which may name another site. Launch `personas:reporter` with `run`, `url` and
   `personas`, then save, check and report as steps 5 to 7 of the `personas-runner` skill say.
   A diff run has `old/` and `new/` folders and a `sweep.json`: take the personas from both
   folders and the two URLs from the `old` and `new` fields of `sweep.json`, and launch the
   reporter with `mode: diff`, `run`, `old`, `new` and `personas`.
4. With neither, say that the run has no reports.
