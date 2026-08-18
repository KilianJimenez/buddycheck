import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { copilotProvider } from './copilot.js';
import { opencodeProvider } from './opencode.js';

const templatesRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../templates');

/** Agent/workflow basenames without their provider-specific extension. */
function baseNames(dir: string, stripSuffix: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(stripSuffix))
    .map((name) => name.slice(0, -stripSuffix.length))
    .sort();
}

describe('provider parity', () => {
  it('exposes the same six agents for both Copilot and Opencode', () => {
    const copilotAgents = baseNames(path.join(templatesRoot, copilotProvider.templateDir, 'agents'), '.agent.md');
    const opencodeAgents = baseNames(path.join(templatesRoot, opencodeProvider.templateDir, 'agents'), '.md');

    expect(copilotAgents).toHaveLength(6);
    expect(opencodeAgents).toHaveLength(6);
    expect(opencodeAgents).toEqual(copilotAgents);
  });

  it('exposes the same five workflows for both Copilot and Opencode', () => {
    const copilotWorkflows = baseNames(
      path.join(templatesRoot, copilotProvider.templateDir, 'workflows'),
      '.yml',
    );
    const opencodeWorkflows = baseNames(
      path.join(templatesRoot, opencodeProvider.templateDir, 'workflows'),
      '.yml',
    );

    expect(copilotWorkflows).toHaveLength(5);
    expect(opencodeWorkflows).toHaveLength(5);
    expect(opencodeWorkflows).toEqual(copilotWorkflows);
  });
});
