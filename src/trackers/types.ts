export interface TrackerLabel {
  name: string;
  color: string;
  description: string;
}

export type DetectSlugResult =
  | { ok: true; slug: string }
  | { ok: false; reason: 'no-remote' | 'not-github' | 'unparseable'; message: string };

export interface EnsureRepoResult {
  /** False when the target cannot be bootstrapped (user declined, etc.). */
  ok: boolean;
  /** Human-readable steps init decided to skip, for SETUP.md. */
  skipped: string[];
  message?: string;
}

export interface CreateLabelsResult {
  created: string[];
  existing: string[];
  failed: Array<{ name: string; error: string }>;
  /** Set when label creation could not run at all (no gh, not authed, --no-labels). */
  skippedReason?: string;
}

export interface TrackerContext {
  cwd: string;
  /** Non-interactive mode (--yes): never prompt, choose the safe default. */
  yes: boolean;
  dryRun: boolean;
}

export interface Tracker {
  id: string;
  label: string;
  /** Detected account login, or null when it cannot be determined. */
  detectUser(ctx: TrackerContext): string | null;
  detectRepoSlug(ctx: TrackerContext): DetectSlugResult;
  /** Make sure `ctx.cwd` is a repo the workflow can live in. */
  ensureRepo(ctx: TrackerContext): Promise<EnsureRepoResult>;
  createLabels(ctx: TrackerContext, slug: string, labels: TrackerLabel[]): CreateLabelsResult;
  /** Labels this tracker's workflows expect to exist. */
  labels: TrackerLabel[];
}
