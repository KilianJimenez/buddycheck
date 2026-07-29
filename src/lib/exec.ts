import { spawnSync } from 'node:child_process';

export interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

export interface RunOptions {
  cwd?: string;
  input?: string;
}

/**
 * Run a command synchronously and capture its output. Never throws: a missing
 * binary is reported as a non-zero status with the spawn error in `stderr`.
 */
export function run(cmd: string, args: string[] = [], options: RunOptions = {}): RunResult {
  const result = spawnSync(cmd, args, {
    cwd: options.cwd,
    input: options.input,
    encoding: 'utf8',
    shell: false,
  });

  if (result.error) {
    return { status: 127, stdout: '', stderr: result.error.message };
  }

  return {
    status: result.status ?? 1,
    stdout: (result.stdout ?? '').toString(),
    stderr: (result.stderr ?? '').toString(),
  };
}

/** Run a command and return trimmed stdout, or `null` if it failed. */
export function tryRun(cmd: string, args: string[] = [], options: RunOptions = {}): string | null {
  const result = run(cmd, args, options);
  if (result.status !== 0) return null;
  return result.stdout.trim();
}

/** Whether a command exists on PATH. */
export function hasCommand(cmd: string): boolean {
  return run(process.platform === 'win32' ? 'where' : 'which', [cmd]).status === 0;
}
