import { mkdirSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scaffold, type ScaffoldUnit } from '../lib/scaffold.js';
import type { TemplateVars } from '../lib/template.js';
import { COMMON_TARGETS } from './common.js';
import { copilotProvider } from './copilot.js';

const templatesRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../templates');

describe('copilotProvider targets', () => {
  it('no longer sources buddy-once.sh from the shared common template set', () => {
    expect(COMMON_TARGETS.some((t) => t.from === 'buddy-once.sh')).toBe(false);
  });

  it('ships its own buddy-once.sh scaffolded to .buddy/buddy-once.sh as executable', () => {
    expect(copilotProvider.targets).toContainEqual({
      from: 'buddy-once.sh',
      to: '.buddy/buddy-once.sh',
      executable: true,
    });
  });

  it('scaffolds a byte-for-byte identical .buddy/buddy-once.sh', async () => {
    const vars: TemplateVars = { OWNER: 'octocat', REPO: 'demo', REPO_SLUG: 'octocat/demo' };
    const root = mkdtempSync(path.join(tmpdir(), 'buddycheck-copilot-provider-'));
    const targetDir = path.join(root, 'repo');
    mkdirSync(targetDir, { recursive: true });

    const units: ScaffoldUnit[] = [{ templateDir: copilotProvider.templateDir, targets: copilotProvider.targets }];
    await scaffold(units, { templatesRoot, targetDir, vars, yes: true });

    const expected = readFileSync(path.join(templatesRoot, copilotProvider.templateDir, 'buddy-once.sh'));
    const actual = readFileSync(path.join(targetDir, '.buddy/buddy-once.sh'));
    expect(actual.equals(expected)).toBe(true);

    if (process.platform !== 'win32') {
      expect(statSync(path.join(targetDir, '.buddy/buddy-once.sh')).mode & 0o777).toBe(0o755);
    }
  });
});
