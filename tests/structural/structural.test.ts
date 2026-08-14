import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scaffold, type ScaffoldUnit } from '../../src/lib/scaffold.js';
import type { TemplateVars } from '../../src/lib/template.js';
import { COMMON_TARGETS, COMMON_TEMPLATE_DIR } from '../../src/providers/common.js';
import { copilotProvider } from '../../src/providers/copilot.js';
import { opencodeProvider } from '../../src/providers/opencode.js';
import type { Provider } from '../../src/providers/types.js';

const templatesRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../templates');
const runAgainst = path.join(path.dirname(fileURLToPath(import.meta.url)), 'run-against.sh');

async function scaffoldProvider(provider: Provider): Promise<string> {
  const vars: TemplateVars = { OWNER: 'testowner', REPO: 'testrepo', REPO_SLUG: 'testowner/testrepo' };
  const root = mkdtempSync(path.join(tmpdir(), `buddycheck-structural-${provider.id}-`));
  const targetDir = path.join(root, 'repo');
  mkdirSync(targetDir, { recursive: true });

  const units: ScaffoldUnit[] = [
    { templateDir: COMMON_TEMPLATE_DIR, targets: COMMON_TARGETS },
    { templateDir: provider.templateDir, targets: provider.targets },
  ];
  await scaffold(units, { templatesRoot, targetDir, vars, yes: true });
  return targetDir;
}

describe('structural suite is provider-aware', () => {
  it.each([copilotProvider, opencodeProvider])(
    'passes tests/structural/run-against.sh for a $id-scaffolded repo',
    async (provider) => {
      const targetDir = await scaffoldProvider(provider);

      let output = '';
      let exitCode = 0;
      try {
        output = execFileSync('bash', [runAgainst, targetDir], {
          encoding: 'utf8',
          env: { ...process.env, EXPECTED_OWNER: 'testowner' },
        });
      } catch (error) {
        const err = error as { status?: number; stdout?: string };
        exitCode = err.status ?? 1;
        output = err.stdout ?? '';
      }

      expect(output, output).not.toMatch(/^FAIL:/m);
      expect(exitCode, output).toBe(0);
    },
  );
});
