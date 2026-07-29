import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { ensureGitignoreBlock, GITIGNORE_BEGIN, GITIGNORE_END } from './gitignore.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'buddycheck-gitignore-'));
});

const read = () => readFileSync(path.join(dir, '.gitignore'), 'utf8');

describe('ensureGitignoreBlock', () => {
  it('creates .gitignore with the managed block when missing', () => {
    expect(ensureGitignoreBlock(dir)).toBe('created');
    const content = read();
    expect(content).toContain(GITIGNORE_BEGIN);
    expect(content).toContain('.coder-done');
    expect(content).toContain('.oracle-run.log');
    expect(content).toContain('task.md');
    expect(content).toContain('progress.txt');
    expect(content.endsWith(`${GITIGNORE_END}\n`)).toBe(true);
  });

  it('appends to an existing .gitignore preserving its content', () => {
    writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\ndist/\n');
    expect(ensureGitignoreBlock(dir)).toBe('appended');
    expect(read()).toBe(`node_modules/\ndist/\n\n${GITIGNORE_BEGIN}\n.coder-done\n.oracle-run.log\ntask.md\nprogress.txt\n${GITIGNORE_END}\n`);
  });

  it('adds a newline when the existing file lacks a trailing one', () => {
    writeFileSync(path.join(dir, '.gitignore'), 'dist/');
    ensureGitignoreBlock(dir);
    expect(read().startsWith('dist/\n\n')).toBe(true);
  });

  it('is idempotent', () => {
    ensureGitignoreBlock(dir);
    const first = read();
    expect(ensureGitignoreBlock(dir)).toBe('skipped');
    expect(ensureGitignoreBlock(dir)).toBe('skipped');
    expect(read()).toBe(first);
  });

  it('writes nothing in dry-run mode', () => {
    expect(ensureGitignoreBlock(dir, true)).toBe('created');
    expect(() => read()).toThrow();
  });
});
