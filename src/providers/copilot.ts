import type { Provider } from './types.js';

export const copilotProvider: Provider = {
  id: 'copilot',
  label: 'GitHub Copilot CLI',
  templateDir: 'providers/copilot',
  targets: [
    { from: 'buddy-once.sh', to: '.buddy/buddy-once.sh', executable: true },
    { from: 'agents', to: '.github/agents' },
    { from: 'workflows', to: '.github/workflows' },
    { from: 'pull_request_template.md', to: '.github/pull_request_template.md' },
  ],
  setupDoc: {
    secrets: [
      {
        name: 'COPILOT_CLI_TOKEN',
        description:
          'Copilot CLI authentication token. Run `copilot` locally, sign in, and copy the token it stores (or mint a token with Copilot access) — the workflows pass it to the Copilot CLI as its credential.',
      },
      {
        name: 'GH_PAT',
        description:
          'Classic personal access token with the `repo` and `workflow` scopes. Required because the default `GITHUB_TOKEN` is not allowed to push changes to workflow files, which the agents may need to do.',
      },
    ],
    repoSettings: [
      'Settings → Actions → General → Workflow permissions: select **Read and write permissions**.',
      'Settings → Actions → General → Workflow permissions: enable **Allow GitHub Actions to create and approve pull requests**.',
    ],
    cliInstall: [
      'Install the Copilot CLI: `npm i -g @github/copilot`.',
      'Authenticate once locally: run `copilot` and follow the sign-in prompt.',
      'Verify with `copilot --version` before running `bash .buddy/buddy-once.sh`.',
    ],
  },
};
