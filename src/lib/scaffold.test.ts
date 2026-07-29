import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { scaffold, type ScaffoldUnit } from './scaffold.js';
import type { TemplateVars } from './template.js';

const vars: TemplateVars = { OWNER: 'octocat', REPO: 'demo', REPO_SLUG: 'octocat/demo' };

let root: string;
let templatesRoot: string;
let targetDir: string;

const units: ScaffoldUnit[] = [
  {
    templateDir: 'common',
    targets: [
      { from: 'buddy-once.sh', to: '.buddy/buddy-once.sh', executable: true },
      { from: 'docs', to: '.buddy/docs' },
      { from: 'AGENTS.md', to: 'AGENTS.md', skipIfExists: true },
      { from: 'logo.bin', to: '.buddy/logo.bin' },
    ],
  },
];

const write = (file: string, content: string | Buffer) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
};

const binary = Buffer.from([0x00, 0x7b, 0x7b, 0x4f, 0x57, 0x4e, 0x45, 0x52, 0x7d, 0x7d, 0xff]);

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'buddycheck-scaffold-'));
  templatesRoot = path.join(root, 'templates');
  targetDir = path.join(root, 'repo');
  mkdirSync(targetDir, { recursive: true });

  write(path.join(templatesRoot, 'common/buddy-once.sh'), '#!/usr/bin/env bash\nowner={{OWNER}}\n');
  write(path.join(templatesRoot, 'common/docs/domain.md'), '# {{REPO_SLUG}}\n');
  write(path.join(templatesRoot, 'common/docs/nested/sdd.md'), 'triggered by {{OWNER}}\n');
  write(path.join(templatesRoot, 'common/AGENTS.md'), 'agents for {{REPO}}\n');
  write(path.join(templatesRoot, 'common/logo.bin'), binary);
});

const read = (rel: string) => readFileSync(path.join(targetDir, rel), 'utf8');

describe('scaffold', () => {
  it('renders the tree, substitutes vars and chmods executables', async () => {
    const summary = await scaffold(units, { templatesRoot, targetDir, vars, yes: true });

    expect(summary.counts).toEqual({ created: 5, overwritten: 0, skipped: 0, identical: 0 });
    expect(summary.entries.map((e) => e.path).sort()).toEqual(
      [
        'AGENTS.md',
        path.join('.buddy', 'buddy-once.sh'),
        path.join('.buddy', 'docs', 'domain.md'),
        path.join('.buddy', 'docs', 'nested', 'sdd.md'),
        path.join('.buddy', 'logo.bin'),
      ].sort(),
    );

    expect(read('.buddy/buddy-once.sh')).toContain('owner=octocat');
    expect(read('.buddy/docs/domain.md')).toBe('# octocat/demo\n');
    expect(read('.buddy/docs/nested/sdd.md')).toBe('triggered by octocat\n');
    expect(read('AGENTS.md')).toBe('agents for demo\n');

    if (process.platform !== 'win32') {
      expect(statSync(path.join(targetDir, '.buddy/buddy-once.sh')).mode & 0o777).toBe(0o755);
    }
  });

  it('copies non-renderable files byte-for-byte', async () => {
    await scaffold(units, { templatesRoot, targetDir, vars, yes: true });
    expect(readFileSync(path.join(targetDir, '.buddy/logo.bin')).equals(binary)).toBe(true);
  });

  it('skips identical targets silently on a re-run', async () => {
    await scaffold(units, { templatesRoot, targetDir, vars, yes: true });
    const second = await scaffold(units, { templatesRoot, targetDir, vars, yes: true });
    expect(second.counts).toEqual({ created: 0, overwritten: 0, skipped: 0, identical: 5 });
  });

  it('keeps differing files in non-interactive mode', async () => {
    write(path.join(targetDir, '.buddy/docs/domain.md'), 'local edits\n');
    const summary = await scaffold(units, { templatesRoot, targetDir, vars, yes: true });
    expect(summary.counts.skipped).toBe(1);
    expect(read('.buddy/docs/domain.md')).toBe('local edits\n');
  });

  it('overwrites differing files with force', async () => {
    write(path.join(targetDir, '.buddy/docs/domain.md'), 'local edits\n');
    write(path.join(targetDir, 'AGENTS.md'), 'my own agents doc\n');
    const summary = await scaffold(units, { templatesRoot, targetDir, vars, force: true });
    expect(summary.counts.overwritten).toBe(2);
    expect(read('.buddy/docs/domain.md')).toBe('# octocat/demo\n');
    expect(read('AGENTS.md')).toBe('agents for demo\n');
  });

  it('never prompts for skipIfExists targets', async () => {
    write(path.join(targetDir, 'AGENTS.md'), 'my own agents doc\n');
    const summary = await scaffold(units, { templatesRoot, targetDir, vars });
    expect(summary.entries.find((e) => e.path === 'AGENTS.md')?.action).toBe('skipped');
    expect(read('AGENTS.md')).toBe('my own agents doc\n');
  });

  it('writes nothing in dry-run mode', async () => {
    const summary = await scaffold(units, { templatesRoot, targetDir, vars, yes: true, dryRun: true });
    expect(summary.counts.created).toBe(5);
    expect(() => read('.buddy/docs/domain.md')).toThrow();
  });

  it('propagates unresolved-placeholder failures', async () => {
    write(path.join(templatesRoot, 'common/docs/bad.md'), 'oops {{UNKNOWN}}\n');
    await expect(scaffold(units, { templatesRoot, targetDir, vars, yes: true })).rejects.toThrow(
      /\{\{UNKNOWN\}\}/,
    );
  });

  it('ignores mappings whose source does not exist', async () => {
    const summary = await scaffold(
      [{ templateDir: 'common', targets: [{ from: 'nope.md', to: 'nope.md' }] }],
      { templatesRoot, targetDir, vars, yes: true },
    );
    expect(summary.entries).toEqual([]);
  });
});
