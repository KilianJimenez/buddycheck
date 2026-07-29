import { readFileSync } from 'node:fs';

export const HELP = `buddycheck — bootstrap an AI guardrails + spec-driven development (SDD) workflow

Usage
  buddycheck init [options]

Options
  --yes, -y            Non-interactive: accept defaults, keep existing files
  --force              Overwrite existing files instead of prompting
  --dry-run            Report what would be written without writing anything
  --owner <login>      GitHub login allowed to trigger the workflows (skips detection)
  --repo <owner/name>  Target repository slug (skips detection)
  --no-labels          Do not create the triage / SDD labels
  -h, --help           Show this help
  -v, --version        Show the version
`;

/** Package version, read from the package.json shipped next to `dist/`. */
export function readVersion(baseUrl: string): string {
  try {
    const pkg: unknown = JSON.parse(readFileSync(new URL('../package.json', baseUrl), 'utf8'));
    if (typeof pkg === 'object' && pkg !== null && 'version' in pkg && typeof pkg.version === 'string') {
      return pkg.version;
    }
  } catch {
    /* fall through */
  }
  return 'unknown';
}

export interface ParsedArgs {
  command?: string;
  yes: boolean;
  force: boolean;
  dryRun: boolean;
  labels: boolean;
  help: boolean;
  showVersion: boolean;
  owner?: string;
  repo?: string;
  unknown: string[];
}

export function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    yes: false,
    force: false,
    dryRun: false,
    labels: true,
    help: false,
    showVersion: false,
    unknown: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] as string;
    switch (arg) {
      case '--yes':
      case '-y':
        parsed.yes = true;
        break;
      case '--force':
        parsed.force = true;
        break;
      case '--dry-run':
        parsed.dryRun = true;
        break;
      case '--no-labels':
        parsed.labels = false;
        break;
      case '--help':
      case '-h':
        parsed.help = true;
        break;
      case '--version':
      case '-v':
        parsed.showVersion = true;
        break;
      case '--owner':
        parsed.owner = argv[++i];
        break;
      case '--repo':
        parsed.repo = argv[++i];
        break;
      default:
        if (arg.startsWith('--owner=')) parsed.owner = arg.slice('--owner='.length);
        else if (arg.startsWith('--repo=')) parsed.repo = arg.slice('--repo='.length);
        else if (arg.startsWith('-')) parsed.unknown.push(arg);
        else if (parsed.command === undefined) parsed.command = arg;
        else parsed.unknown.push(arg);
    }
  }

  return parsed;
}
