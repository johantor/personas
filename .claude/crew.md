---
frontendMode: headless
backendStack: node
backendSkill: unset
frontendStack: none
frontendSkill: none
frontendE2eTool: none
frontendUnitTestTool: unset
backendLanePaths: plugin/
frontendLanePaths: none
backendTestCommand: for t in tests/*.test.sh; do bash "$t" || exit 1; done
frontendTestCommand: none
backendBuildCommand: none
frontendBuildCommand: none
backendLintCommand: shellcheck tests/*.sh scripts/*.sh
frontendLintCommand: none
formatMatrix: none
baseBranch: main
branchNaming: <type>/<issue>-<slug>
runUrl: none
planDirectory: unset
---

The crew configuration for developing personas with the `crew` plugin; `/crew:init` reconciles it.
The plugin is `plugin/`: a Node and Playwright CLI, agent and skill prompts, and Bash hooks, so
`backendStack` is `node` and there is no build. personas has no view of its own (reports are
Markdown on disk), so `frontendStack` is `none`; the `docs/` site is static. The test command
runs every `tests/*.test.sh`, as CI does; the lint command is CI's shellcheck step. A milestone
that adds Node tests or a hook updates both here and in `validate.yml`.

`planDirectory` is `unset`, so plans land in the `.claude/` fallback, which this repo does not
track.
