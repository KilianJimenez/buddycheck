import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cancel, confirm, intro, isCancel, log, note, outro, select, text } from '@clack/prompts';
import { ensureGitignoreBlock } from '../lib/gitignore.js';
import { scaffold, ScaffoldCancelled, type ScaffoldSummary, type ScaffoldUnit } from '../lib/scaffold.js';
import { renderSetupDoc } from '../lib/setup-doc.js';
import type { TemplateVars } from '../lib/template.js';
import { COMMON_TARGETS, COMMON_TEMPLATE_DIR } from '../providers/common.js';
import { providers } from '../providers/index.js';
import type { Provider } from '../providers/types.js';
import { trackers } from '../trackers/index.js';
import type { Tracker } from '../trackers/types.js';

export interface InitOptions {
  cwd: string;
  yes: boolean;
  force: boolean;
  dryRun: boolean;
  labels: boolean;
  owner?: string;
  repo?: string;
}

/** Location of the packaged `templates/` dir: sibling of `dist/` at the package root. */
export function templatesRoot(): string {
  return fileURLToPath(new URL('../templates', import.meta.url));
}

class Aborted extends Error {}

function abort(message: string): never {
  throw new Aborted(message);
}

async function pick<T extends { id: string; label: string }>(
  message: string,
  items: T[],
  yes: boolean,
): Promise<T> {
  const first = items[0];
  if (first === undefined) abort(`No ${message} available.`);
  if (yes || items.length === 1) return first;

  const choice = await select({
    message,
    options: items.map((item) => ({ value: item.id, label: item.label })),
  });
  if (isCancel(choice)) abort('Cancelled.');
  return items.find((item) => item.id === choice) ?? first;
}

async function askValue(message: string, initialValue: string): Promise<string> {
  const answer = await text({ message, initialValue });
  if (isCancel(answer)) abort('Cancelled.');
  const value = answer.trim();
  if (value === '') abort(`${message} is required.`);
  return value;
}

function formatSummary(summary: ScaffoldSummary): string {
  const width = Math.max(...summary.entries.map((e) => e.path.length), 4);
  const labels: Record<string, string> = {
    created: 'created',
    overwritten: 'overwritten',
    skipped: 'skipped (kept existing)',
    identical: 'skipped (identical)',
  };
  return summary.entries.map((e) => `${e.path.padEnd(width)}  ${labels[e.action]}`).join('\n');
}

export async function runInit(options: InitOptions): Promise<number> {
  intro('buddycheck init');

  try {
    const provider: Provider = await pick('Which agent provider?', providers, options.yes);
    const tracker: Tracker = await pick('Which issue tracker?', trackers, options.yes);
    const ctx = { cwd: options.cwd, yes: options.yes, dryRun: options.dryRun };
    const skippedSteps: string[] = [];

    const repoState = await tracker.ensureRepo(ctx);
    if (!repoState.ok) abort(repoState.message ?? 'Could not prepare the repository.');
    skippedSteps.push(...repoState.skipped);

    // --- detection -------------------------------------------------------
    let owner = options.owner ?? '';
    let slug = options.repo ?? '';

    if (slug === '') {
      const detected = tracker.detectRepoSlug(ctx);
      if (detected.ok) {
        slug = detected.slug;
      } else if (detected.reason === 'not-github') {
        abort(detected.message);
      } else {
        log.warn(`${detected.message} Falling back to manual entry.`);
        if (options.yes) abort('Could not detect the repository. Pass --repo <owner/name>.');
        slug = await askValue('Repository (owner/name)?', '');
      }
    }
    if (!/^[^/\s]+\/[^/\s]+$/.test(slug)) {
      abort(`Invalid repository slug \`${slug}\` — expected \`owner/name\`.`);
    }

    if (owner === '') {
      const detectedUser = tracker.detectUser(ctx);
      if (detectedUser) {
        owner = detectedUser;
      } else {
        log.warn('Could not detect your GitHub login (is `gh` installed and authenticated?).');
        if (options.yes) {
          owner = slug.split('/')[0] as string;
          log.warn(`Using \`${owner}\` from the repository slug as the trigger author.`);
        } else {
          owner = await askValue('GitHub login allowed to trigger the workflows?', slug.split('/')[0] as string);
        }
      }
    }

    const [, repoName = ''] = slug.split('/');
    const vars: TemplateVars = { OWNER: owner, REPO: repoName, REPO_SLUG: slug };

    note(`repository: ${slug}\ntrigger author: ${owner}\nprovider: ${provider.label}`, 'Detected');
    if (!options.yes) {
      const ok = await confirm({ message: 'Continue with these values?' });
      if (isCancel(ok) || !ok) abort('Cancelled.');
    }

    // --- scaffold --------------------------------------------------------
    const root = templatesRoot();
    if (!existsSync(root)) abort(`Templates directory not found at ${root}.`);

    const units: ScaffoldUnit[] = [
      { templateDir: COMMON_TEMPLATE_DIR, targets: COMMON_TARGETS },
      { templateDir: provider.templateDir, targets: provider.targets },
    ];

    const summary = await scaffold(units, {
      templatesRoot: root,
      targetDir: options.cwd,
      vars,
      force: options.force,
      yes: options.yes,
      dryRun: options.dryRun,
    });
    note(formatSummary(summary), options.dryRun ? 'Planned files (dry run)' : 'Files');

    // --- gitignore -------------------------------------------------------
    const gitignore = ensureGitignoreBlock(options.cwd, options.dryRun);
    log.info(`.gitignore: ${gitignore === 'skipped' ? 'managed block already present' : gitignore}`);

    // --- labels ----------------------------------------------------------
    let labelsHandled = false;
    if (!options.labels) {
      skippedSteps.push(`Create the ${tracker.labels.length} BuddyCheck labels (skipped via --no-labels).`);
    } else {
      const result = tracker.createLabels(ctx, slug, tracker.labels);
      if (result.skippedReason) {
        log.warn(`Skipping label creation: ${result.skippedReason}`);
        skippedSteps.push(`Create the ${tracker.labels.length} BuddyCheck labels (see the table in this file).`);
      } else {
        labelsHandled = true;
        log.info(
          `labels: ${result.created.length} created, ${result.existing.length} already present` +
            (result.failed.length > 0 ? `, ${result.failed.length} failed` : ''),
        );
        for (const failure of result.failed) {
          log.warn(`label ${failure.name}: ${failure.error}`);
          skippedSteps.push(`Create the \`${failure.name}\` label by hand.`);
        }
      }
    }

    // --- SETUP.md --------------------------------------------------------
    const setupDoc = renderSetupDoc({
      provider,
      tracker,
      owner,
      repoSlug: slug,
      labels: tracker.labels,
      labelsHandled,
      skippedSteps,
    });
    const setupPath = path.join(options.cwd, '.buddy', 'SETUP.md');
    if (!options.dryRun) {
      mkdirSync(path.dirname(setupPath), { recursive: true });
      writeFileSync(setupPath, setupDoc, 'utf8');
    }

    outro(
      options.dryRun
        ? 'Dry run complete — nothing was written.'
        : 'Done. Next: follow the checklist in .buddy/SETUP.md',
    );
    return 0;
  } catch (error) {
    if (error instanceof ScaffoldCancelled) {
      cancel('Cancelled.');
      return 1;
    }
    if (error instanceof Aborted) {
      cancel(error.message);
      return 1;
    }
    throw error;
  }
}
