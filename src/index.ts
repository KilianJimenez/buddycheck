import { runInit } from './commands/init.js';
import { HELP, parseArgs, readVersion } from './lib/args.js';

async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv);

  if (args.showVersion) {
    process.stdout.write(`${readVersion(import.meta.url)}\n`);
    return 0;
  }
  if (args.help || args.command === undefined) {
    process.stdout.write(HELP);
    return args.help ? 0 : 1;
  }
  if (args.unknown.length > 0) {
    process.stderr.write(`Unknown argument(s): ${args.unknown.join(', ')}\n\n${HELP}`);
    return 1;
  }
  if (args.command !== 'init') {
    process.stderr.write(`Unknown command: ${args.command}\n\n${HELP}`);
    return 1;
  }

  return runInit({
    cwd: process.cwd(),
    yes: args.yes,
    force: args.force,
    dryRun: args.dryRun,
    labels: args.labels,
    ...(args.owner === undefined ? {} : { owner: args.owner }),
    ...(args.repo === undefined ? {} : { repo: args.repo }),
  });
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
