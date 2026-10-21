/**
 * GhostCLI Helper — Main Interactive CLI Wizard & Command Router
 */

import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { normalizeUrls, probeEndpoint } from './audit.mjs';
import { detectHarnesses, detectExistingKey } from './detect.mjs';
import { configureClaude } from './configurators/claude.mjs';
import { configureCodex } from './configurators/codex.mjs';
import { configureHermes } from './configurators/hermes.mjs';
import { configureOpenClaw } from './configurators/openclaw.mjs';
import { configureOpenCode } from './configurators/opencode.mjs';
import { configureOmp } from './configurators/omp.mjs';
import { configureEnvironmentVariables } from './env.mjs';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m'
};

function printBanner() {
  console.log(`
${colors.cyan}${colors.bold}  ██████╗ ██╗  ██╗ ██████╗ ███████╗████████╗ ██████╗██╗     ██╗
 ██╔════╝ ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝██╔════╝██║     ██║
 ██║  ███╗███████║██║   ██║███████╗   ██║   ██║     ██║     ██║
 ██║   ██║██╔══██║██║   ██║╚════██║   ██║   ██║     ██║     ██║
 ╚██████╔╝██║  ██║╚██████╔╝███████║   ██║   ╚██████╗███████╗██║
  ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝    ╚═════╝╚══════╝╚═╝${colors.reset}
${colors.dim} GhostCLI Multi-Harness Auto-Configurator & Connection Auditor${colors.reset}
`);
}

export function parseArgs(args) {
  const options = {
    command: 'setup',
    url: 'https://ghostcli.cloud',
    key: null,
    mode: 'both', // 'both', 'config', 'env'
    tools: null,  // array of tool ids or 'all'
    yes: false,
    dryRun: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === 'audit' || arg === '--audit' || arg === 'check' || arg === '--check') {
      options.command = 'audit';
    } else if (arg === 'help' || arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--url' && args[i + 1]) {
      options.url = args[++i];
    } else if (arg === '--key' && args[i + 1]) {
      options.key = args[++i];
    } else if (arg === '--mode' && args[i + 1]) {
      options.mode = args[++i].toLowerCase();
    } else if (arg === '--tools' && args[i + 1]) {
      options.tools = args[++i].split(',').map(s => s.trim().toLowerCase());
    } else if (arg === '-y' || arg === '--yes') {
      options.yes = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
${colors.bold}USAGE:${colors.reset}
  ghostcli-helper [command] [options]
  node bin/ghostcli-helper.mjs [command] [options]

${colors.bold}COMMANDS:${colors.reset}
  ${colors.green}setup${colors.reset}    Interactive configuration wizard (default)
  ${colors.green}audit${colors.reset}    Verify active GhostCLI connection and inspect all harness configs
  ${colors.green}help${colors.reset}     Show this manual

${colors.bold}OPTIONS:${colors.reset}
  ${colors.yellow}--url <url>${colors.reset}       GhostCLI Base URL [default: https://ghostcli.cloud]
  ${colors.yellow}--key <key>${colors.reset}       GhostCLI API Key (gcli_...)
  ${colors.yellow}--mode <mode>${colors.reset}     Persistence mode: ${colors.bold}both${colors.reset} (default), ${colors.bold}config${colors.reset}, or ${colors.bold}env${colors.reset}
  ${colors.yellow}--tools <list>${colors.reset}    Comma-separated tools to configure: claude, codex, hermes, openclaw, opencode, omp, all
  ${colors.yellow}-y, --yes${colors.reset}         Non-interactive mode (use defaults without prompting)
  ${colors.yellow}--dry-run${colors.reset}         Simulate changes without writing files or environment
`);
}

export async function runAudit(options) {
  printBanner();
  console.log(`${colors.bold}${colors.cyan}=== GhostCLI Ecosystem & Connection Audit ===${colors.reset}\n`);

  const detectedKey = options.key || detectExistingKey();
  const detectedUrl = options.url || process.env.ANTHROPIC_BASE_URL || 'https://ghostcli.cloud';
  const urls = normalizeUrls(detectedUrl);

  console.log(`${colors.bold}Active Configuration Targets:${colors.reset}`);
  console.log(`  Base URL:  ${colors.cyan}${urls.baseUrl}${colors.reset}`);
  console.log(`  Claude:    ${colors.cyan}${urls.claudeUrl}${colors.reset}`);
  console.log(`  OpenAI v1: ${colors.cyan}${urls.openaiUrl}${colors.reset}`);
  console.log(`  API Key:   ${detectedKey ? colors.green + (detectedKey.slice(0, 8) + '...' + detectedKey.slice(-4)) + colors.reset : colors.red + 'Not Found' + colors.reset}\n`);

  if (detectedKey) {
    console.log(`Testing live connection to ${colors.yellow}${urls.modelsUrl}${colors.reset}...`);
    const probe = await probeEndpoint(urls.baseUrl, detectedKey);
    if (probe.ok) {
      console.log(`${colors.green}✔ Connection verified!${colors.reset} Status: 200 OK | Latency: ${probe.latencyMs}ms`);
      console.log(`${colors.green}✔ Discovered ${probe.totalModels} models:${colors.reset}`);
      probe.models.forEach(m => console.log(`   • ${m}`));
    } else {
      console.log(`${colors.red}✖ Connection failed: ${probe.error}${colors.reset}`);
    }
  } else {
    console.log(`${colors.yellow}Notice: No GhostCLI API key found in environment or tool configs. Run 'ghostcli-helper setup' to configure.${colors.reset}`);
  }

  console.log(`\n${colors.bold}Detected AI Coding Harnesses:${colors.reset}`);
  const harnesses = detectHarnesses();
  for (const [id, h] of Object.entries(harnesses)) {
    const icon = h.installed ? `${colors.green}[✔]${colors.reset}` : `${colors.dim}[ ]${colors.reset}`;
    const statusText = h.installed ? `${colors.green}Detected${colors.reset}` : `${colors.dim}Not Found${colors.reset}`;
    console.log(`  ${icon} ${colors.bold}${h.name.padEnd(28)}${colors.reset} -> ${statusText}`);
    if (h.bin) console.log(`      Binary: ${colors.dim}${h.bin}${colors.reset}`);
    if (h.configExists) console.log(`      Config: ${colors.dim}${h.configPath}${colors.reset}`);
    if (h.currentEndpoint) console.log(`      Endpoint: ${colors.yellow}${h.currentEndpoint}${colors.reset}`);
  }
  console.log('');
}

export async function runSetup(options) {
  printBanner();

  if (options.help) {
    printHelp();
    return;
  }

  const rl = readline.createInterface({ input, output });

  try {
    let baseUrl = options.url || 'https://ghostcli.cloud';
    let apiKey = options.key;

    if (!options.yes) {
      // Step 1: Confirm Base URL
      console.log(`${colors.bold}Step 1: Confirm GhostCLI Base URL${colors.reset}`);
      const promptUrl = await rl.question(`Enter Base URL [default: ${baseUrl}]: `);
      if (promptUrl.trim()) baseUrl = promptUrl.trim();

      // Step 2: Confirm API Key
      console.log(`\n${colors.bold}Step 2: Confirm GhostCLI API Key${colors.reset}`);
      const existingKey = detectExistingKey();
      if (!apiKey && existingKey) {
        const masked = existingKey.slice(0, 8) + '...' + existingKey.slice(-4);
        const confirm = await rl.question(`Found existing API key (${colors.green}${masked}${colors.reset}). Use this key? [Y/n]: `);
        if (confirm.trim().toLowerCase() !== 'n') {
          apiKey = existingKey;
        }
      }

      while (!apiKey) {
        const inputKey = await rl.question(`Enter your GhostCLI API Key (starts with gcli_...): `);
        if (inputKey.trim()) {
          apiKey = inputKey.trim();
        } else {
          console.log(`${colors.red}API Key cannot be empty.${colors.reset}`);
        }
      }
    } else {
      if (!apiKey) apiKey = detectExistingKey();
      if (!apiKey) {
        console.error(`${colors.red}Error: Non-interactive mode requires --key <gcli_...> or existing environment variable.${colors.reset}`);
        process.exit(1);
      }
    }

    // Step 3: Interactive Validation / Audit Loop
    let urls = normalizeUrls(baseUrl);
    let validated = false;

    console.log(`\n${colors.bold}Step 3: Pre-Flight Connection Validation${colors.reset}`);
    while (!validated) {
      console.log(`Validating token against ${colors.yellow}${urls.modelsUrl}${colors.reset}...`);
      const probe = await probeEndpoint(urls.baseUrl, apiKey);

      if (probe.ok) {
        console.log(`${colors.green}✔ Connection verified!${colors.reset} HTTP 200 OK (${probe.latencyMs}ms) — ${probe.totalModels} models available.`);
        validated = true;
      } else {
        console.log(`${colors.red}✖ Validation Failed:${colors.reset} ${probe.error}`);
        if (options.yes) {
          console.log(`${colors.yellow}Warning: Proceeding anyway (--yes flag).${colors.reset}`);
          validated = true;
          break;
        }

        console.log(`\n${colors.yellow}How would you like to proceed?${colors.reset}`);
        console.log(`  1. Re-enter API Key`);
        console.log(`  2. Change Base URL`);
        console.log(`  3. Skip validation & proceed anyway`);
        console.log(`  4. Abort setup`);

        const choice = await rl.question(`Select option [1-4, default: 1]: `);
        if (choice === '2') {
          const newUrl = await rl.question(`Enter new Base URL: `);
          if (newUrl.trim()) {
            baseUrl = newUrl.trim();
            urls = normalizeUrls(baseUrl);
          }
        } else if (choice === '3') {
          console.log(`${colors.yellow}Skipping validation...${colors.reset}`);
          validated = true;
        } else if (choice === '4') {
          console.log(`Setup aborted.`);
          process.exit(0);
        } else {
          const newKey = await rl.question(`Enter new GhostCLI API Key: `);
          if (newKey.trim()) apiKey = newKey.trim();
        }
      }
    }

    // Step 4: Detect Installed Harnesses & Select Targets
    console.log(`\n${colors.bold}Step 4: AI Harness Detection${colors.reset}`);
    const harnesses = detectHarnesses();
    const detectedList = [];

    for (const [id, h] of Object.entries(harnesses)) {
      const icon = h.installed ? `${colors.green}[✔]${colors.reset}` : `${colors.dim}[ ]${colors.reset}`;
      console.log(`  ${icon} ${colors.bold}${h.name.padEnd(28)}${colors.reset} ${h.installed ? colors.green + '(Installed)' : colors.dim + '(Not detected)'}${colors.reset}`);
      if (h.installed) detectedList.push(id);
    }

    let selectedTools = detectedList;
    if (options.tools) {
      if (options.tools.includes('all')) {
        selectedTools = Object.keys(harnesses);
      } else {
        selectedTools = options.tools;
      }
    } else if (!options.yes && detectedList.length > 0) {
      console.log(`\n${colors.yellow}Select deployment target:${colors.reset}`);
      console.log(`  1. All Detected Tools (${detectedList.join(', ')}) [Recommended]`);
      console.log(`  2. All Supported Harnesses (including uninstalled)`);
      console.log(`  3. Custom Selection`);

      const tChoice = await rl.question(`Choose option [1-3, default: 1]: `);
      if (tChoice === '2') {
        selectedTools = Object.keys(harnesses);
      } else if (tChoice === '3') {
        const custom = await rl.question(`Enter tool ids separated by comma (claude, codex, hermes, openclaw, opencode, omp): `);
        selectedTools = custom.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      }
    }

    // Step 5: Persistence Mode Selection
    let mode = options.mode || 'both';
    if (!options.yes) {
      console.log(`\n${colors.bold}Step 5: Persistence Mode${colors.reset}`);
      console.log(`  1. Both Tool Config Files & Persistent Environment Variables [Recommended]`);
      console.log(`  2. Tool Configuration Files Only`);
      console.log(`  3. Persistent Environment Variables Only`);
      const mChoice = await rl.question(`Choose mode [1-3, default: 1]: `);
      if (mChoice === '2') mode = 'config';
      else if (mChoice === '3') mode = 'env';
      else mode = 'both';
    }

    // Step 6: Execute Configuration
    console.log(`\n${colors.bold}${colors.cyan}=== Applying Configurations ${options.dryRun ? '(DRY RUN)' : ''} ===${colors.reset}\n`);

    if (mode === 'both' || mode === 'env') {
      console.log(`Injecting persistent environment variables...`);
      const envRes = configureEnvironmentVariables(urls, apiKey, options.dryRun);
      console.log(`  ${colors.green}✔ Environment applied:${colors.reset} ANTHROPIC_BASE_URL, OPENAI_BASE_URL, GHOSTCLI_API_KEY`);
      envRes.persistedTo.forEach(p => console.log(`    ${colors.dim}Saved to: ${p}${colors.reset}`));
    }

    if (mode === 'both' || mode === 'config') {
      const toolMap = {
        claude: { name: 'Claude Code', fn: configureClaude },
        codex: { name: 'OpenAI Codex CLI', fn: configureCodex },
        hermes: { name: 'Hermes Agent', fn: configureHermes },
        openclaw: { name: 'OpenClaw', fn: configureOpenClaw },
        opencode: { name: 'OpenCode', fn: configureOpenCode },
        omp: { name: 'Oh My Pi (omp)', fn: configureOmp }
      };

      for (const tId of selectedTools) {
        const toolInfo = toolMap[tId];
        const h = harnesses[tId];
        if (toolInfo && h) {
          try {
            const res = toolInfo.fn(h.configPath, urls, apiKey, options.dryRun);
            console.log(`  ${colors.green}✔ ${res.tool}:${colors.reset} Updated ${colors.dim}${res.path}${colors.reset}`);
            if (res.backup) {
              console.log(`    ${colors.dim}Backup created: ${res.backup}${colors.reset}`);
            }
          } catch (err) {
            console.log(`  ${colors.red}✖ ${toolInfo.name}:${colors.reset} Failed to update (${err.message})`);
          }
        }
      }
    }

    console.log(`\n${colors.green}${colors.bold}✔ GhostCLI Setup Completed Successfully!${colors.reset}`);
    console.log(`${colors.dim}Restart active terminal sessions or reload your IDE to activate updated environment variables.${colors.reset}\n`);

  } finally {
    rl.close();
  }
}
