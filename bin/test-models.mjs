#!/usr/bin/env node

/**
 * GC-Helper — Model Responsiveness Tester CLI
 */

import { runTestAllModels } from '../src/test-models.mjs';

const args = process.argv.slice(2);
const options = {
  url: null,
  key: null,
  timeoutMs: 25000,
  turns: 3,
  model: null
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--url' && args[i + 1]) {
    options.url = args[++i];
  } else if (arg === '--key' && args[i + 1]) {
    options.key = args[++i];
  } else if (arg === '--timeout' && args[i + 1]) {
    options.timeoutMs = parseInt(args[++i], 10) || 25000;
  } else if ((arg === '--turns' || arg === '-t') && args[i + 1]) {
    options.turns = parseInt(args[++i], 10) || 3;
  } else if ((arg === '--model' || arg === '-m') && args[i + 1]) {
    options.model = args[++i];
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Usage: node bin/test-models.mjs [options]

Options:
  --model, -m <id>    Test a single specific model
  --turns, -t <num>   Number of questions/turns per model (default: 3)
  --timeout <ms>      Timeout per turn in milliseconds (default: 25000)
  --url <url>         GhostCLI Base URL (default: auto-detected or https://ghostcli.cloud)
  --key <key>         GhostCLI API Key (default: auto-detected from environment/config)
  --help, -h          Show this help message
`);
    process.exit(0);
  }
}

runTestAllModels(options).catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
