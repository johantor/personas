# personas in an Azure DevOps pipeline

[`azure-pipelines.yml`](azure-pipelines.yml) runs the personas each night against a staging
server and files each new blocker or major finding as a Bug. It is an example to copy and adapt;
it has not been run in Azure DevOps.

## Set up

1. Run `/personas:init` once in the site's repository, on your own machine, and commit
   `.personas/personas.json` and `.personas/brief.md`. The pipeline runs these personas.
2. Copy `azure-pipelines.yml` to the repository and create a pipeline from it.
3. Add `ANTHROPIC_API_KEY` as a secret pipeline variable.
4. Set `STAGING_URL`, and pin `PERSONAS_VERSION` to a release tag such as `v0.7.0`.
5. Let the pipeline create work items: in *Project settings*, give the project's build service
   *Edit work items in this node* on the area path, or use a PAT with *Work Items (Read & write)*
   in place of `System.AccessToken`.

## How it works

- **Run**: `claude -p` runs `/personas:run` headless. `--allowedTools` limits it to what a run
  needs; `Edit(.personas/runs/**)` is the only write it allows, and that rule covers `Write`
  too. Bare `Write` would allow writes anywhere in the checkout.
- **Evidence**: `.personas/runs/` is published as the `personas-run` artifact, so each work item
  names screenshot paths inside it.
- **Work items**: a script step with no model calls reads `findings.json`, checks it against the
  schema, and creates a Bug for each blocker and major finding. Each carries a fingerprint tag
  (`personas-<hash of url, category and expected>`); a later run finds the open work item by
  that tag and files nothing new.
- **The token**: only the work-item step gets `System.AccessToken`. The visitors read untrusted
  pages, so the step that runs them holds no Azure DevOps token.

## Limits

- A Microsoft-hosted agent reaches only public URLs. A staging server on an internal network
  needs a self-hosted agent.
- A run of four personas costs about $1.60 and takes about 3 minutes (README, *Demo*), so a
  nightly run suits better than one on each commit.
- A persona with `auth` needs its storage-state file on the agent, such as from a secure file;
  keep it out of the repository.
