#!/usr/bin/env node

/**
 * GhostCLI Helper — CLI Executable Entrypoint
 */

import { parseArgs, runSetup, runAudit } from '../src/cli.mjs';

const options = parseArgs(process.argv.slice(2));

if (options.command === 'audit') {
  await runAudit(options);
} else {
  await runSetup(options);
}
