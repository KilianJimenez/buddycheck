import type { Provider } from './types.js';

export const opencodeProvider: Provider = {
  id: 'opencode',
  label: 'Opencode',
  templateDir: 'providers/opencode',
  targets: [
    { from: 'buddy-once.sh', to: '.buddy/buddy-once.sh', executable: true },
    { from: 'agents', to: '.opencode/agent' },
    { from: 'workflows', to: '.github/workflows' },
    { from: 'pull_request_template.md', to: '.github/pull_request_template.md' },
  ],
  setupDoc: {
    secrets: [
      {
        name: 'ANTHROPIC_API_KEY',
        description:
          'Anthropic API key used to authenticate the Opencode CLI as its credential — the workflows pass it to `opencode` non-interactively.',
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
      'Install the Opencode CLI: `npm i -g opencode-ai`.',
      'Authenticate once locally: set `ANTHROPIC_API_KEY` (or run `opencode auth login`) and follow the sign-in prompt.',
      'Verify with `opencode --version` before running `bash .buddy/buddy-once.sh`.',
    ],
  },
};
