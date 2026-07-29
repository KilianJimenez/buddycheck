import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const GITIGNORE_BEGIN = '# --- buddycheck runtime files (managed block) ---';
export const GITIGNORE_END = '# --- end buddycheck ---';

export const GITIGNORE_BLOCK = [
  GITIGNORE_BEGIN,
  '.coder-done',
  '.oracle-run.log',
  'task.md',
  'progress.txt',
  GITIGNORE_END,
].join('\n');

export type GitignoreResult = 'created' | 'appended' | 'skipped';

/**
 * Append the managed runtime-files block to `<targetDir>/.gitignore`, creating
 * the file if missing. Idempotent: a present begin-marker line is left alone.
 */
export function ensureGitignoreBlock(targetDir: string, dryRun = false): GitignoreResult {
  const file = path.join(targetDir, '.gitignore');

  if (!existsSync(file)) {
    if (!dryRun) writeFileSync(file, `${GITIGNORE_BLOCK}\n`, 'utf8');
    return 'created';
  }

  const current = readFileSync(file, 'utf8');
  if (current.split(/\r?\n/).some((line) => line.trim() === GITIGNORE_BEGIN)) {
    return 'skipped';
  }

  const separator = current.length === 0 || current.endsWith('\n') ? '' : '\n';
  if (!dryRun) {
    writeFileSync(file, `${current}${separator}\n${GITIGNORE_BLOCK}\n`, 'utf8');
  }
  return 'appended';
}
