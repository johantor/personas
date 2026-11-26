---
description: Show the summary of a personas run — the latest by default — and re-render it from the persona reports when it is missing
argument-hint: "[run-id]"
---

Show a personas run summary. Arguments: `$ARGUMENTS`

1. The run is `.personas/runs/<run-id>/` for the given run id, or the newest folder in
   `.personas/runs/` when there is none. With no runs, say that `/personas:run` makes one.
2. If `summary.md` exists, show it and the path of `findings.json`. Stop.
3. If it does not, but persona `report.md` files do, re-render: launch `personas:reporter` and
   save, check and report as steps 5 to 7 of the `personas-runner` skill say.
4. With neither, say that the run has no reports.
