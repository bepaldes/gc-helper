#!/usr/bin/env node

/**
 * GC-Helper — CLI Executable Entrypoint
 */

import { parseArgs, runSetup, runAudit, runSync } from '../src/cli.mjs';

const options = parseArgs(process.argv.slice(2));

if (options.command === 'audit') {
  await runAudit(options);
} else if (options.command === 'sync') {
  await runSync(options);
} else {
  await runSetup(options);
}
