#!/usr/bin/env node

/**
 * GC-Helper — CLI Executable Entrypoint
 */

import { parseArgs, runSetup, runAudit, runSync, runSyncModels, printVersion } from '../src/cli.mjs';
import { startUpdateNotifier } from '../src/update.mjs';

const options = parseArgs(process.argv.slice(2));

if (options.version) {
  printVersion();
  process.exit(0);
}

const notifier = startUpdateNotifier();

try {
  if (options.command === 'audit') {
    await runAudit(options);
  } else if (options.command === 'sync') {
    await runSync(options);
  } else if (options.command === 'sync-models') {
    await runSyncModels(options);
  } else {
    await runSetup(options);
  }
} finally {
  await notifier.notify();
}
