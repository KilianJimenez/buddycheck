import { beforeEach, describe, expect, it, vi } from 'vitest';

const run = vi.fn();
const tryRun = vi.fn();

vi.mock('../lib/exec.js', () => ({
  run: (...args: unknown[]) => run(...args),
  tryRun: (...args: unknown[]) => tryRun(...args),
  hasCommand: () => true,
}));

const { githubTracker, parseRemoteUrl, GITHUB_LABELS } = await import('./github.js');

const ctx = { cwd: '/tmp/repo', yes: true, dryRun: false };

beforeEach(() => {
  run.mockReset();
  tryRun.mockReset();
});

describe('parseRemoteUrl', () => {
  it('parses the ssh form', () => {
    expect(parseRemoteUrl('git@github.com:octocat/buddycheck.git')).toEqual({
      ok: true,
      slug: 'octocat/buddycheck',
    });
  });

  it('parses the ssh form without the .git suffix', () => {
    expect(parseRemoteUrl('git@github.com:octocat/buddycheck')).toEqual({
      ok: true,
      slug: 'octocat/buddycheck',
    });
  });

  it('parses the ssh:// form', () => {
    expect(parseRemoteUrl('ssh://git@github.com/octocat/buddycheck.git')).toEqual({
      ok: true,
      slug: 'octocat/buddycheck',
    });
  });

  it('parses the https form', () => {
    expect(parseRemoteUrl('https://github.com/octocat/buddycheck.git')).toEqual({
      ok: true,
      slug: 'octocat/buddycheck',
    });
    expect(parseRemoteUrl('https://token@github.com/octocat/buddycheck')).toEqual({
      ok: true,
      slug: 'octocat/buddycheck',
    });
  });

  it('trims surrounding whitespace', () => {
    expect(parseRemoteUrl('  git@github.com:octocat/buddycheck.git\n')).toEqual({
      ok: true,
      slug: 'octocat/buddycheck',
    });
  });

  it('rejects non-GitHub remotes with a typed error', () => {
    const result = parseRemoteUrl('git@gitlab.com:octocat/buddycheck.git');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.reason).toBe('not-github');
    expect(result.message).toMatch(/only supports GitHub/);
  });

  it('reports an empty remote', () => {
    const result = parseRemoteUrl('');
    expect(result).toMatchObject({ ok: false, reason: 'no-remote' });
  });

  it('reports an unparseable github URL', () => {
    const result = parseRemoteUrl('github.com-weird:something');
    expect(result).toMatchObject({ ok: false, reason: 'unparseable' });
  });
});

describe('detectRepoSlug', () => {
  it('prefers `gh repo view`', () => {
    tryRun.mockReturnValueOnce('octocat/buddycheck');
    expect(githubTracker.detectRepoSlug(ctx)).toEqual({ ok: true, slug: 'octocat/buddycheck' });
    expect(tryRun).toHaveBeenCalledTimes(1);
  });

  it('falls back to the git remote when gh is unavailable', () => {
    tryRun.mockReturnValueOnce(null).mockReturnValueOnce('git@github.com:octocat/buddycheck.git');
    expect(githubTracker.detectRepoSlug(ctx)).toEqual({ ok: true, slug: 'octocat/buddycheck' });
  });

  it('reports no-remote when both fail', () => {
    tryRun.mockReturnValue(null);
    expect(githubTracker.detectRepoSlug(ctx)).toMatchObject({ ok: false, reason: 'no-remote' });
  });

  it('reports not-github for a foreign remote', () => {
    tryRun.mockReturnValueOnce(null).mockReturnValueOnce('https://bitbucket.org/octocat/x.git');
    expect(githubTracker.detectRepoSlug(ctx)).toMatchObject({ ok: false, reason: 'not-github' });
  });
});

describe('detectUser', () => {
  it('returns the gh login', () => {
    tryRun.mockReturnValueOnce('octocat');
    expect(githubTracker.detectUser(ctx)).toBe('octocat');
    expect(tryRun).toHaveBeenCalledWith('gh', ['api', 'user', '--jq', '.login'], { cwd: ctx.cwd });
  });

  it('returns null when gh fails', () => {
    tryRun.mockReturnValueOnce(null);
    expect(githubTracker.detectUser(ctx)).toBeNull();
  });
});

describe('createLabels', () => {
  it('skips when gh is not authenticated', () => {
    run.mockReturnValue({ status: 1, stdout: '', stderr: 'not logged in' });
    const result = githubTracker.createLabels(ctx, 'octocat/demo', GITHUB_LABELS);
    expect(result.skippedReason).toMatch(/not authenticated/);
    expect(result.created).toEqual([]);
  });

  it('creates only the missing labels', () => {
    run.mockImplementation((_cmd: string, args: string[]) => {
      if (args[0] === 'auth') return { status: 0, stdout: '', stderr: '' };
      return { status: 0, stdout: '', stderr: '' };
    });
    tryRun.mockReturnValueOnce('needs-triage\nsdd:planned\n');

    const result = githubTracker.createLabels(ctx, 'octocat/demo', GITHUB_LABELS);
    expect(result.existing).toEqual(['needs-triage', 'sdd:planned']);
    expect(result.created).toEqual([
      'needs-info',
      'ready-for-agent',
      'ready-for-human',
      'wontfix',
      'sdd:grilling',
      'sdd:issues-created',
    ]);
    expect(result.failed).toEqual([]);
  });

  it('records label creation failures', () => {
    run.mockImplementation((_cmd: string, args: string[]) => {
      if (args[0] === 'auth') return { status: 0, stdout: '', stderr: '' };
      return { status: 1, stdout: '', stderr: 'boom' };
    });
    tryRun.mockReturnValueOnce('');
    const result = githubTracker.createLabels(ctx, 'octocat/demo', [GITHUB_LABELS[0]!]);
    expect(result.failed).toEqual([{ name: 'needs-triage', error: 'boom' }]);
  });

  it('defines the eight documented labels', () => {
    expect(GITHUB_LABELS.map((l) => l.name)).toEqual([
      'needs-triage',
      'needs-info',
      'ready-for-agent',
      'ready-for-human',
      'wontfix',
      'sdd:grilling',
      'sdd:planned',
      'sdd:issues-created',
    ]);
    expect(GITHUB_LABELS.every((l) => /^[0-9a-f]{6}$/.test(l.color))).toBe(true);
    expect(GITHUB_LABELS.every((l) => l.description.length > 0)).toBe(true);
  });
});
