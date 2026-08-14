import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { providers } from './index.js';
import { opencodeProvider } from './opencode.js';
import { copilotProvider } from './copilot.js';

const templatesRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../templates');

describe('opencodeProvider registration', () => {
  it('registers Opencode in the provider list, after Copilot', () => {
    expect(providers.map((p) => p.id)).toEqual(['copilot', 'opencode']);
  });

  it('keeps Copilot as the first/default provider', () => {
    expect(providers[0]).toBe(copilotProvider);
  });

  it('is selectable via its id and label', () => {
    expect(opencodeProvider.id).toBe('opencode');
    expect(opencodeProvider.label).toBe('Opencode');
  });

  it('maps its agents subtree to .opencode/agent/', () => {
    expect(opencodeProvider.targets).toContainEqual({ from: 'agents', to: '.opencode/agent' });
  });

  it('still scaffolds the workflows and PR template targets', () => {
    expect(opencodeProvider.targets).toContainEqual({ from: 'workflows', to: '.github/workflows' });
    expect(opencodeProvider.targets).toContainEqual({
      from: 'pull_request_template.md',
      to: '.github/pull_request_template.md',
    });
  });

  it('every target resolves to a real packaged template file', () => {
    for (const target of opencodeProvider.targets) {
      const from = path.join(templatesRoot, opencodeProvider.templateDir, target.from);
      expect(existsSync(from), `expected ${from} to exist`).toBe(true);
    }
  });
});
