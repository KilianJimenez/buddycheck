import { describe, expect, it } from 'vitest';
import { copilotProvider } from '../providers/copilot.js';
import { githubTracker, GITHUB_LABELS } from '../trackers/github.js';
import { renderSetupDoc } from './setup-doc.js';

const base = {
  provider: copilotProvider,
  tracker: githubTracker,
  owner: 'octocat',
  repoSlug: 'octocat/demo',
  labels: GITHUB_LABELS,
};

describe('renderSetupDoc', () => {
  it('documents secrets, settings and triggers', () => {
    const doc = renderSetupDoc({ ...base, labelsHandled: true, skippedSteps: [] });
    expect(doc).toContain('COPILOT_CLI_TOKEN');
    expect(doc).toContain('GH_PAT');
    expect(doc).toContain('Read and write permissions');
    expect(doc).toContain('create and approve pull requests');
    expect(doc).toContain('!grill');
    expect(doc).toContain('!to-plan');
    expect(doc).toContain('!to-issues');
    expect(doc).toContain('Buddy - Once');
    expect(doc).toContain('bash .buddy/buddy-once.sh');
    expect(doc).toContain('`octocat`');
    expect(doc).toContain('octocat/demo');
    expect(doc).toContain('Nothing — init completed every automated step.');
    expect(doc).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('lists skipped steps as a checklist and flags manual labels', () => {
    const doc = renderSetupDoc({
      ...base,
      labelsHandled: false,
      skippedSteps: ['Create the GitHub repository and add it as the `origin` remote.'],
    });
    expect(doc).toContain('- [ ] Create the GitHub repository');
    expect(doc).toContain('Label creation was **not** performed');
    for (const label of GITHUB_LABELS) {
      expect(doc).toContain(`\`${label.name}\``);
    }
  });
});
