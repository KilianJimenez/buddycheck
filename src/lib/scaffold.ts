import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isCancel, select } from '@clack/prompts';
import type { TemplateTarget } from '../providers/types.js';
import { isRenderable, renderTemplate, type TemplateVars } from './template.js';

export type ScaffoldAction = 'created' | 'overwritten' | 'skipped' | 'identical';

export interface ScaffoldEntry {
  /** Target path relative to the target repo root. */
  path: string;
  action: ScaffoldAction;
}

export interface ScaffoldSummary {
  entries: ScaffoldEntry[];
  counts: Record<ScaffoldAction, number>;
}

/** A template directory plus the targets to render out of it. */
export interface ScaffoldUnit {
  /** Path relative to `templatesRoot`. */
  templateDir: string;
  targets: TemplateTarget[];
}

export interface ScaffoldOptions {
  /** Absolute path of the packaged `templates/` directory. */
  templatesRoot: string;
  /** Absolute path of the repo being bootstrapped. */
  targetDir: string;
  vars: TemplateVars;
  /** Overwrite everything without asking. */
  force?: boolean;
  /** Non-interactive: keep existing files instead of prompting. */
  yes?: boolean;
  /** Report planned writes without touching the filesystem. */
  dryRun?: boolean;
}

export class ScaffoldCancelled extends Error {
  constructor() {
    super('Cancelled');
    this.name = 'ScaffoldCancelled';
  }
}

interface PlannedFile {
  source: string;
  /** Relative to the target repo root, POSIX-ish separators from the mapping. */
  target: string;
  executable: boolean;
  skipIfExists: boolean;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out.sort();
}

function planFiles(units: ScaffoldUnit[], templatesRoot: string): PlannedFile[] {
  const files: PlannedFile[] = [];

  for (const unit of units) {
    const base = path.join(templatesRoot, unit.templateDir);
    for (const target of unit.targets) {
      const source = path.join(base, target.from);
      if (!existsSync(source)) continue;

      const executable = target.executable === true;
      const skipIfExists = target.skipIfExists === true;

      if (statSync(source).isDirectory()) {
        for (const file of walk(source)) {
          const rel = path.relative(source, file);
          files.push({
            source: file,
            target: path.join(target.to, rel),
            executable,
            skipIfExists,
          });
        }
      } else {
        files.push({ source, target: target.to, executable, skipIfExists });
      }
    }
  }

  return files;
}

/** Renders template trees into the target repo, honouring the overwrite policy. */
export async function scaffold(units: ScaffoldUnit[], options: ScaffoldOptions): Promise<ScaffoldSummary> {
  const files = planFiles(units, options.templatesRoot);
  const entries: ScaffoldEntry[] = [];
  let bulk: 'overwrite-all' | 'skip-all' | null = options.force ? 'overwrite-all' : null;

  for (const file of files) {
    const absTarget = path.join(options.targetDir, file.target);
    const raw = readFileSync(file.source);
    const rendered = isRenderable(file.source)
      ? Buffer.from(renderTemplate(raw.toString('utf8'), options.vars), 'utf8')
      : raw;

    let action: ScaffoldAction;

    if (!existsSync(absTarget)) {
      action = 'created';
    } else if (readFileSync(absTarget).equals(rendered)) {
      action = 'identical';
    } else if (bulk === 'overwrite-all') {
      action = 'overwritten';
    } else if (bulk === 'skip-all' || file.skipIfExists || options.yes) {
      action = 'skipped';
    } else {
      const choice = await select({
        message: `${file.target} already exists and differs. Overwrite?`,
        options: [
          { value: 'overwrite', label: 'Overwrite' },
          { value: 'skip', label: 'Keep existing' },
          { value: 'overwrite-all', label: 'Overwrite all remaining' },
          { value: 'skip-all', label: 'Keep all remaining' },
        ],
      });
      if (isCancel(choice)) throw new ScaffoldCancelled();
      if (choice === 'overwrite-all' || choice === 'skip-all') bulk = choice;
      action = choice === 'overwrite' || choice === 'overwrite-all' ? 'overwritten' : 'skipped';
    }

    if (!options.dryRun && (action === 'created' || action === 'overwritten')) {
      mkdirSync(path.dirname(absTarget), { recursive: true });
      writeFileSync(absTarget, rendered);
    }
    if (!options.dryRun && file.executable && action !== 'skipped' && existsSync(absTarget)) {
      chmodSync(absTarget, 0o755);
    }

    entries.push({ path: file.target, action });
  }

  const counts: Record<ScaffoldAction, number> = {
    created: 0,
    overwritten: 0,
    skipped: 0,
    identical: 0,
  };
  for (const entry of entries) counts[entry.action] += 1;

  return { entries, counts };
}
