import path from 'node:path';
import { confirm, isCancel, log, text } from '@clack/prompts';
import { run, tryRun } from '../lib/exec.js';
import type {
  CreateLabelsResult,
  DetectSlugResult,
  EnsureRepoResult,
  Tracker,
  TrackerContext,
  TrackerLabel,
} from './types.js';

export const GITHUB_LABELS: TrackerLabel[] = [
  { name: 'needs-triage', color: 'ededed', description: 'Triage: maintainer needs to evaluate this issue' },
  { name: 'needs-info', color: 'd876e3', description: 'Triage: waiting on the reporter for more information' },
  { name: 'ready-for-agent', color: '0e8a16', description: 'Triage: fully specified, ready for an AFK agent' },
  { name: 'ready-for-human', color: 'fbca04', description: 'Triage: requires human implementation' },
  { name: 'wontfix', color: 'ffffff', description: 'Triage: will not be actioned' },
  { name: 'sdd:grilling', color: 'f9d0c4', description: 'SDD status: idea is being grilled/shaped' },
  { name: 'sdd:planned', color: 'c5def5', description: 'SDD status: plan + suggested issues drafted' },
  { name: 'sdd:issues-created', color: 'bfd4f2', description: 'SDD status: slice issues created from the plan' },
  { name: 'tech-debt:architectural', color: '5319e7', description: 'Tech debt: architecture/design shortcuts or drift' },
  { name: 'tech-debt:code', color: 'e99695', description: 'Tech debt: code-level quality, duplication, or complexity' },
  { name: 'tech-debt:documentation', color: '1d76db', description: 'Tech debt: missing or outdated documentation' },
  { name: 'tech-debt:devops', color: 'fef2c0', description: 'Tech debt: CI/CD, infra, or tooling shortcuts' },
  { name: 'tech-debt:process', color: 'c2e0c6', description: 'Tech debt: workflow or process gaps' },
  { name: 'tech-debt:security', color: 'b60205', description: 'Tech debt: security hardening or risk to address' },
];

/** Extract `owner/repo` from a GitHub remote URL (ssh or https forms). */
export function parseRemoteUrl(url: string): DetectSlugResult {
  const trimmed = url.trim();
  if (trimmed === '') {
    return { ok: false, reason: 'no-remote', message: 'No `origin` remote is configured.' };
  }

  const patterns = [
    /^git@github\.com:(?<owner>[^/]+)\/(?<repo>.+?)(?:\.git)?$/,
    /^ssh:\/\/git@github\.com\/(?<owner>[^/]+)\/(?<repo>.+?)(?:\.git)?$/,
    /^https?:\/\/(?:[^@/]+@)?github\.com\/(?<owner>[^/]+)\/(?<repo>.+?)(?:\.git)?$/,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(trimmed);
    if (match?.groups) {
      return { ok: true, slug: `${match.groups.owner}/${match.groups.repo}` };
    }
  }

  if (!/github\.com/.test(trimmed)) {
    return {
      ok: false,
      reason: 'not-github',
      message: `The \`origin\` remote (${trimmed}) is not a GitHub repository. BuddyCheck only supports GitHub for now.`,
    };
  }

  return {
    ok: false,
    reason: 'unparseable',
    message: `Could not parse the \`origin\` remote URL: ${trimmed}`,
  };
}

function ghAuthed(cwd: string): boolean {
  return run('gh', ['auth', 'status'], { cwd }).status === 0;
}

export const githubTracker: Tracker = {
  id: 'github',
  label: 'GitHub Issues',
  labels: GITHUB_LABELS,

  detectUser(ctx: TrackerContext): string | null {
    return tryRun('gh', ['api', 'user', '--jq', '.login'], { cwd: ctx.cwd }) || null;
  },

  detectRepoSlug(ctx: TrackerContext): DetectSlugResult {
    const viaGh = tryRun('gh', ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'], {
      cwd: ctx.cwd,
    });
    if (viaGh) return { ok: true, slug: viaGh };

    const remote = tryRun('git', ['remote', 'get-url', 'origin'], { cwd: ctx.cwd });
    if (remote === null) {
      return { ok: false, reason: 'no-remote', message: 'No `origin` remote is configured.' };
    }
    return parseRemoteUrl(remote);
  },

  async ensureRepo(ctx: TrackerContext): Promise<EnsureRepoResult> {
    const skipped: string[] = [];
    const insideRepo = tryRun('git', ['rev-parse', '--is-inside-work-tree'], { cwd: ctx.cwd }) === 'true';
    if (insideRepo) return { ok: true, skipped };

    if (ctx.yes) {
      return {
        ok: false,
        skipped,
        message: 'Not a git repository. Run `git init` first, or drop --yes to be guided through it.',
      };
    }

    const doInit = await confirm({ message: 'This directory is not a git repository. Run `git init` now?' });
    if (isCancel(doInit) || !doInit) {
      return { ok: false, skipped, message: 'A git repository is required.' };
    }
    if (!ctx.dryRun) {
      const result = run('git', ['init'], { cwd: ctx.cwd });
      if (result.status !== 0) {
        return { ok: false, skipped, message: `git init failed: ${result.stderr.trim()}` };
      }
    }

    const nameAnswer = await text({
      message: 'Repository name?',
      initialValue: path.basename(ctx.cwd),
    });
    if (isCancel(nameAnswer)) return { ok: false, skipped, message: 'Cancelled.' };
    const repoName = nameAnswer.trim();

    if (!ghAuthed(ctx.cwd)) {
      skipped.push('Create the GitHub repository and add it as the `origin` remote.');
      return { ok: true, skipped };
    }

    const createRemote = await confirm({
      message: `Create the GitHub repository \`${repoName}\` with gh now?`,
      initialValue: false,
    });
    if (isCancel(createRemote) || !createRemote) {
      skipped.push('Create the GitHub repository and add it as the `origin` remote.');
      return { ok: true, skipped };
    }

    if (!ctx.dryRun) {
      const result = run('gh', ['repo', 'create', repoName, '--private', '--source', '.', '--remote', 'origin'], {
        cwd: ctx.cwd,
      });
      if (result.status !== 0) {
        log.warn(`gh repo create failed: ${result.stderr.trim()}`);
        skipped.push('Create the GitHub repository and add it as the `origin` remote.');
      }
    }

    return { ok: true, skipped };
  },

  createLabels(ctx: TrackerContext, slug: string, labels: TrackerLabel[]): CreateLabelsResult {
    const result: CreateLabelsResult = { created: [], existing: [], failed: [] };

    if (!ghAuthed(ctx.cwd)) {
      result.skippedReason = 'The GitHub CLI is unavailable or not authenticated.';
      return result;
    }

    const listed = tryRun('gh', ['label', 'list', '--repo', slug, '--limit', '200', '--json', 'name', '--jq', '.[].name'], {
      cwd: ctx.cwd,
    });
    if (listed === null) {
      result.skippedReason = `Could not list labels for ${slug}.`;
      return result;
    }
    const present = new Set(
      listed
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line !== ''),
    );

    for (const label of labels) {
      if (present.has(label.name)) {
        result.existing.push(label.name);
        continue;
      }
      if (ctx.dryRun) {
        result.created.push(label.name);
        continue;
      }
      const created = run(
        'gh',
        ['label', 'create', label.name, '--repo', slug, '--color', label.color, '--description', label.description],
        { cwd: ctx.cwd },
      );
      if (created.status === 0) result.created.push(label.name);
      else result.failed.push({ name: label.name, error: created.stderr.trim() || 'unknown error' });
    }

    return result;
  },
};
