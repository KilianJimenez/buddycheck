import { describe, expect, it } from 'vitest';
import { parseArgs } from './args.js';

describe('parseArgs', () => {
  it('defaults to no command with labels enabled', () => {
    const args = parseArgs([]);
    expect(args.command).toBeUndefined();
    expect(args.labels).toBe(true);
    expect(args.yes).toBe(false);
  });

  it('parses the init flags', () => {
    const args = parseArgs([
      'init',
      '--yes',
      '--force',
      '--dry-run',
      '--no-labels',
      '--owner',
      'octocat',
      '--repo',
      'octocat/demo',
    ]);
    expect(args).toMatchObject({
      command: 'init',
      yes: true,
      force: true,
      dryRun: true,
      labels: false,
      owner: 'octocat',
      repo: 'octocat/demo',
      unknown: [],
    });
  });

  it('supports the --flag=value form', () => {
    expect(parseArgs(['init', '--owner=octocat', '--repo=octocat/demo'])).toMatchObject({
      owner: 'octocat',
      repo: 'octocat/demo',
    });
  });

  it('parses help and version', () => {
    expect(parseArgs(['--help']).help).toBe(true);
    expect(parseArgs(['-h']).help).toBe(true);
    expect(parseArgs(['--version']).showVersion).toBe(true);
    expect(parseArgs(['-v']).showVersion).toBe(true);
  });

  it('collects unknown arguments', () => {
    expect(parseArgs(['init', '--nope', 'extra']).unknown).toEqual(['--nope', 'extra']);
  });
});
