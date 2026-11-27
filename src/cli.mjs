/**
 * GC-Helper — Main Interactive CLI Wizard & Command Router
 */

import { normalizeUrls, probeEndpoint } from './audit.mjs';
import { formatIpLabel, normalizeIpMode, resolveIpTargets } from './net.mjs';
import { detectHarnesses, detectExistingKey, isConfigured, detectConfiguredEndpoint } from './detect.mjs';
import { configureClaude } from './configurators/claude.mjs';
import { configureCodex } from './configurators/codex.mjs';
import { configureHermes } from './configurators/hermes.mjs';
import { configureOpenClaw } from './configurators/openclaw.mjs';
import { configureOpenCode } from './configurators/opencode.mjs';
import { configureOmp } from './configurators/omp.mjs';
import { configureVsCode } from './configurators/vscode.mjs';
import { configureClaudeDesktop } from './configurators/desktop.mjs';
import { configureOpenDesign } from './configurators/opendesign.mjs';
import { configureEnvironmentVariables } from './env.mjs';
import { VERSION } from './version.mjs';
import { runSyncModels, readModelsCache } from './models.mjs';
import { runTestAllModels } from './test-models.mjs';
import { tuiSelect, tuiMultiSelect, tuiConfirm, tuiInput } from './tui.mjs';

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
${colors.cyan}${colors.bold}  ██████╗  ██████╗      ██╗  ██╗███████╗██╗     ██████╗ ███████╗██████╗ 
 ██╔════╝ ██╔════╝      ██║  ██║██╔════╝██║     ██╔══██╗██╔════╝██╔══██╗
 ██║  ███╗██║     █████╗███████║█████╗  ██║     ██████╔╝█████╗  ██████╔╝
 ██║   ██║██║     ╚════╝██╔══██║██╔══╝  ██║     ██╔═══╝ ██╔══╝  ██╔══██╗
 ╚██████╔╝╚██████╗      ██║  ██║███████╗███████╗██║     ███████╗██║  ██║
  ╚═════╝  ╚═════╝      ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝     ╚══════╝╚═╝  ╚═╝${colors.reset}
${colors.dim} GC-Helper v${VERSION} — Multi-Harness Auto-Configurator & Connection Auditor${colors.reset}
${colors.dim} (Independent community helper — not affiliated with GhostCLI official)${colors.reset}
`);
}

export function printVersion() {
  console.log(`gc-helper v${VERSION}`);
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
    help: false,
    version: false,
    reconfigure: false,
    heimdall: true,
    ipMode: 'auto',
    hasArgs: args.length > 0
  };

  let sawIpv4 = false;
  let sawIpv6 = false;

  for (let i = 0; i < args.length; i++) {
    const rawArg = args[i];
    const arg = rawArg.toLowerCase();
    if (arg === 'audit' || arg === '--audit' || arg === 'check' || arg === '--check' || arg === 'status' || arg === '--status') {
      options.command = 'audit';
    } else if (arg === 'sync' || arg === '--sync') {
      options.command = 'sync';
    } else if (arg === 'sync-models' || arg === '--sync-models' || arg === 'syncmodels') {
      options.command = 'sync-models';
    } else if (arg === 'test-models' || arg === '--test-models' || arg === 'testmodels' || arg === 'probe') {
      options.command = 'test-models';
    } else if (arg === 'setup' || arg === '--setup') {
      options.command = 'setup';
    } else if (arg === '--reconfigure' || arg === 'reconfigure' || arg === '--force' || arg === '-f') {
      options.reconfigure = true;
    } else if (arg === '--no-heimdall') {
      options.heimdall = false;
    } else if (arg === 'help' || arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === 'version' || arg === '--version' || arg === '-v') {
      options.version = true;
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
    } else if (arg === '--timeout' && args[i + 1]) {
      options.timeoutMs = parseInt(args[++i], 10) || 25000;
    } else if ((arg === '--turns' || arg === '-t') && args[i + 1]) {
      options.turns = parseInt(args[++i], 10) || 3;
    } else if ((arg === '--model' || arg === '-m') && args[i + 1]) {
      options.model = args[++i];
    } else if (arg === '-4' || arg === '--ipv4') {
      sawIpv4 = true;
      options.ipMode = sawIpv6 ? 'both' : 'ipv4';
    } else if (arg === '-6' || arg === '--ipv6') {
      sawIpv6 = true;
      options.ipMode = sawIpv4 ? 'both' : 'ipv6';
    } else if ((arg === '--ip' || arg === '--ip-version') && args[i + 1]) {
      options.ipMode = normalizeIpMode(args[++i]);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
${colors.bold}USAGE:${colors.reset}
  gc-helper [command] [options]
  gc [command] [options]
  node bin/gc-helper.mjs [command] [options]

${colors.dim}Note: Independent community helper — not affiliated with GhostCLI official website or developers.${colors.reset}

${colors.bold}COMMANDS:${colors.reset}
  ${colors.green}setup${colors.reset}       Interactive configuration wizard (default)
  ${colors.green}status${colors.reset}      Verify connection and inspect harness configs (alias: audit)
  ${colors.green}sync${colors.reset}        Fast re-sync detected harnesses using existing credentials
  ${colors.green}sync-models${colors.reset} Discover, test, and sync live models across AI harnesses & Heimdall
  ${colors.green}test-models${colors.reset} Deep multi-turn response & reasoning test across all models
  ${colors.green}audit${colors.reset}       Deep ecosystem connection & model inspection
  ${colors.green}help${colors.reset}        Show this manual

${colors.bold}OPTIONS:${colors.reset}
  ${colors.yellow}-v, --version${colors.reset}          Show version number
  ${colors.yellow}--url <url>${colors.reset}          GhostCLI Base URL [default: https://ghostcli.cloud]
  ${colors.yellow}--key <key>${colors.reset}          GhostCLI API Key (gcli_...)
  ${colors.yellow}--mode <mode>${colors.reset}        Persistence mode: ${colors.bold}both${colors.reset} (default), ${colors.bold}config${colors.reset}, or ${colors.bold}env${colors.reset}
  ${colors.yellow}--tools <list>${colors.reset}       Comma-separated tools to configure: claude, codex, hermes, openclaw, opencode, omp, vscode, desktop, opendesign, all
  ${colors.yellow}--reconfigure, --force${colors.reset} Force re-prompting for Base URL and API Key
  ${colors.yellow}-4, --ipv4${colors.reset}           Force IPv4 for API & model validation
  ${colors.yellow}-6, --ipv6${colors.reset}           Force IPv6 for API & model validation
  ${colors.yellow}--ip <mode>${colors.reset}          IP transport mode: ${colors.bold}auto${colors.reset} (default), ${colors.bold}ipv4${colors.reset}, ${colors.bold}ipv6${colors.reset}, or ${colors.bold}both${colors.reset}
  ${colors.yellow}-y, --yes${colors.reset}            Non-interactive mode (use defaults without prompting)
  ${colors.yellow}--dry-run${colors.reset}            Simulate changes without writing files or environment
`);
}

export async function runAudit(options = {}) {
  if (!options.skipBanner) printBanner();
  console.log(`${colors.bold}${colors.cyan}=== GhostCLI Ecosystem & Connection Audit ===${colors.reset}\n`);

  const detectedKey = options.key || detectExistingKey();
  const harnesses = detectHarnesses();
  const detectedUrl = options.url || detectConfiguredEndpoint(harnesses, 'https://ghostcli.cloud');
  const urls = normalizeUrls(detectedUrl);

  const ipMode = normalizeIpMode(options.ipMode);
  const ipTargets = resolveIpTargets(ipMode);

  console.log(`${colors.bold}Active Configuration Targets:${colors.reset}`);
  console.log(`  GC-Helper: v${VERSION}`);
  console.log(`  Base URL:  ${colors.cyan}${urls.baseUrl}${colors.reset}`);
  console.log(`  Claude:    ${colors.cyan}${urls.claudeUrl}${colors.reset}`);
  console.log(`  OpenAI v1: ${colors.cyan}${urls.openaiUrl}${colors.reset}`);
  console.log(`  IP Mode:   ${colors.cyan}${formatIpLabel(ipMode)}${colors.reset}`);
  console.log(`  API Key:   ${detectedKey ? colors.green + (detectedKey.slice(0, 8) + '...' + detectedKey.slice(-4)) + colors.reset : colors.red + 'Not Found' + colors.reset}\n`);

  if (detectedKey) {
    let firstSuccessProbe = null;
    for (const target of ipTargets) {
      const targetLabel = formatIpLabel(target);
      console.log(`Testing live connection to ${colors.yellow}${urls.modelsUrl}${colors.reset} (${targetLabel})...`);
      const probe = await probeEndpoint(urls.baseUrl, detectedKey, options.timeoutMs || 10000, { ipMode: target });
      if (probe.ok) {
        const remoteHint = probe.remoteAddress ? ` | Remote: ${probe.remoteAddress}` : '';
        console.log(`${colors.green}✔ Connection verified (${targetLabel})!${colors.reset} Status: 200 OK | Latency: ${probe.latencyMs}ms${remoteHint}`);
        if (!firstSuccessProbe) firstSuccessProbe = probe;
      } else {
        console.log(`${colors.red}✖ Connection failed (${targetLabel}): ${probe.error}${colors.reset}`);
      }
    }

    if (firstSuccessProbe) {
      console.log(`${colors.green}✔ Discovered ${firstSuccessProbe.totalModels} models:${colors.reset}`);
      if (Array.isArray(firstSuccessProbe.modelSpecs) && firstSuccessProbe.modelSpecs.length > 0) {
        firstSuccessProbe.modelSpecs.forEach(s => {
          const ctxLabel = s.contextWindow >= 1000000 ? `${s.contextWindow.toLocaleString()} tokens (1M Max)` : `${s.contextWindow.toLocaleString()} tokens`;
          const outLabel = `${s.maxOutputTokens.toLocaleString()} max output`;
          console.log(`   • ${colors.bold}${s.id.padEnd(20)}${colors.reset} ${colors.dim}[Context: ${colors.green}${ctxLabel}${colors.dim} | ${outLabel}]${colors.reset}`);
        });
      } else {
        firstSuccessProbe.models.forEach(m => console.log(`   • ${m}`));
      }
    }
  } else {
    console.log(`${colors.yellow}Notice: No GhostCLI API key found in environment or tool configs. Run 'gc-helper setup' to configure.${colors.reset}`);
  }

  console.log(`\n${colors.bold}Detected AI Coding Harnesses:${colors.reset}`);
  for (const [id, h] of Object.entries(harnesses)) {
    const icon = h.installed ? `${colors.green}[✔]${colors.reset}` : `${colors.dim}[ ]${colors.reset}`;
    const statusText = h.installed ? `${colors.green}Detected${colors.reset}` : `${colors.dim}Not Found${colors.reset}`;
    console.log(`  ${icon} ${colors.bold}${h.name.padEnd(28)}${colors.reset} -> ${statusText}`);
    if (h.bin) console.log(`      Binary: ${colors.dim}${h.bin}${colors.reset}`);
    if (h.configExists) console.log(`      Config: ${colors.dim}${h.configPath}${colors.reset}`);
    if (h.currentEndpoint) console.log(`      Endpoint: ${colors.yellow}${h.currentEndpoint}${colors.reset}`);
    if (h.contextStatus) {
      const ctxColor = h.contextStatus.ok ? colors.green : colors.red;
      const ctxIcon = h.contextStatus.ok ? '✔' : '✖';
      console.log(`      Context:  ${ctxColor}${ctxIcon} ${h.contextStatus.detail}${colors.reset}`);
    }
  }
  console.log('');
}

export function applyDeployment(selectedTools, harnesses, urls, apiKey, mode = 'both', dryRun = false, models = null) {
  console.log(`\n${colors.bold}${colors.cyan}=== Applying Configurations ${dryRun ? '(DRY RUN)' : ''} ===${colors.reset}\n`);

  if (mode === 'both' || mode === 'env') {
    console.log(`Injecting persistent environment variables...`);
    const envRes = configureEnvironmentVariables(urls, apiKey, dryRun);
    console.log(`  ${colors.green}✔ Environment applied:${colors.reset} ANTHROPIC_BASE_URL, OPENAI_BASE_URL, GHOSTCLI_API_KEY`);
    envRes.persistedTo.forEach(p => console.log(`    ${colors.dim}Saved to: ${p}${colors.reset}`));
  }

  if (mode === 'both' || mode === 'config') {
    const toolMap = {
      claude: { name: 'Claude Code', fn: (cp, u, k, d) => configureClaude(cp, u, k, d, models) },
      codex: { name: 'OpenAI Codex CLI', fn: (cp, u, k, d) => configureCodex(cp, u, k, d, null, models) },
      hermes: { name: 'Hermes Agent', fn: (cp, u, k, d) => configureHermes(cp, u, k, d, models) },
      openclaw: { name: 'OpenClaw', fn: configureOpenClaw },
      opencode: { name: 'OpenCode', fn: (cp, u, k, d) => configureOpenCode(cp, u, k, d, models) },
      omp: { name: 'Oh My Pi (omp)', fn: configureOmp },
      vscode: { name: 'Visual Studio Code', fn: configureVsCode },
      desktop: { name: 'Claude Desktop App', fn: (cp, u, k, d) => configureClaudeDesktop(cp, u, k, d, null, models) },
      opendesign: { name: 'Open Design', fn: (cp, u, k, d) => configureOpenDesign(cp, u, k, d, {}, models) }
    };

    for (const tId of selectedTools) {
      const toolInfo = toolMap[tId];
      const h = harnesses[tId];
      if (toolInfo && h) {
        try {
          const res = toolInfo.fn(h.configPath, urls, apiKey, dryRun);
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

  console.log(`\n${colors.green}${colors.bold}✔ GC-Helper Operation Completed Successfully!${colors.reset}`);
  console.log(`${colors.dim}Restart active terminal sessions or reload your IDE to activate updated environment variables.${colors.reset}\n`);
}

export async function runSync(options = {}) {
  if (!options.skipBanner) printBanner();
  console.log(`${colors.bold}${colors.cyan}=== Fast Sync Detected AI Harnesses ===${colors.reset}\n`);

  const detectedKey = options.key || detectExistingKey();
  if (!detectedKey) {
    console.error(`${colors.red}Error: No GhostCLI API Key found on system. Run 'gc-helper setup' first.${colors.reset}`);
    return;
  }

  const harnesses = detectHarnesses();
  const detectedUrl = options.url || detectConfiguredEndpoint(harnesses, 'https://ghostcli.cloud');
  const urls = normalizeUrls(detectedUrl);

  const detectedTools = Object.keys(harnesses).filter(id => harnesses[id].installed);
  const selectedTools = options.tools
    ? (options.tools.includes('all') ? Object.keys(harnesses) : options.tools)
    : detectedTools;

  console.log(`Target URL:       ${colors.cyan}${urls.baseUrl}${colors.reset}`);
  const maskedKey = detectedKey.slice(0, 8) + '...' + detectedKey.slice(-4);
  console.log(`API Key:          ${colors.green}${maskedKey}${colors.reset}`);
  console.log(`Target Harnesses: ${colors.yellow}${selectedTools.join(', ') || 'None detected'}${colors.reset}`);

  if (selectedTools.length === 0) {
    console.log(`\n${colors.yellow}Notice: No supported AI coding harnesses detected to sync.${colors.reset}`);
    return;
  }

  const cached = readModelsCache();
  const models = (cached && Array.isArray(cached.models)) ? cached.models : null;

  applyDeployment(selectedTools, harnesses, urls, detectedKey, options.mode || 'both', options.dryRun, models);
}

export async function runPostInstallMenu(options = {}) {
  printBanner();

  while (true) {
    const choice = await tuiSelect({
      title: '=== GhostCLI Management Hub ===',
      subtitle: 'GhostCLI is already configured and active across your environment.',
      options: [
        { value: 'status', label: 'Connection & Harness Status', hint: 'Recommended' },
        { value: 'sync', label: 'Re-sync All Detected Harnesses' },
        { value: 'sync-models', label: 'Synchronize Models from GhostCLI API' },
        { value: 'test-models', label: 'Deep Multi-Turn Test All Models' },
        { value: 'reconfigure', label: 'Reconfigure URL / API Key' },
        { value: 'exit', label: 'Exit' }
      ],
      defaultIndex: 0,
      cancelValue: 'exit'
    });

    console.log('');
    if (choice === 'status') {
      await runAudit({ ...options, skipBanner: true });
    } else if (choice === 'sync') {
      await runSync({ ...options, skipBanner: true });
    } else if (choice === 'sync-models') {
      await runSyncModels({ ...options, skipBanner: true });
    } else if (choice === 'test-models') {
      await runTestAllModels({ ...options, skipBanner: true });
    } else if (choice === 'reconfigure') {
      return 'reconfigure';
    } else if (choice === 'exit') {
      console.log('Goodbye!');
      return 'exit';
    }

    const nextAction = await tuiSelect({
      title: 'What would you like to do next?',
      options: [
        { value: 'menu', label: 'Return to main menu', hint: 'default' },
        { value: 'exit', label: 'Exit' }
      ],
      defaultIndex: 0,
      cancelValue: 'exit'
    });

    if (nextAction === 'exit') {
      console.log('Goodbye!');
      return 'exit';
    }
    console.log('');
  }
}

export { runSyncModels, runTestAllModels };

export async function runSetup(options = {}) {
  if (options.help) {
    printBanner();
    printHelp();
    return;
  }

  const harnesses = detectHarnesses();
  const existingKey = options.key || detectExistingKey();
  const configured = isConfigured(harnesses, existingKey);

  // If already configured and user did not pass explicit subcommands or reconfigure flag:
  if (!options.yes && !options.hasArgs && !options.reconfigure && configured) {
    const action = await runPostInstallMenu(options);
    if (action !== 'reconfigure') {
      return;
    }
  }

  printBanner();

  let baseUrl = options.url || 'https://ghostcli.cloud';
  let apiKey = options.key;

  if (!options.yes) {
    // Step 1: Confirm Base URL
    baseUrl = await tuiInput({
      title: 'Step 1: Confirm GhostCLI Base URL',
      promptLabel: 'Base URL',
      defaultValue: baseUrl
    });

    // Step 2: Confirm API Key
    console.log(`\n${colors.bold}${colors.cyan}Step 2: Confirm GhostCLI API Key${colors.reset}`);
    const detectedKey = detectExistingKey();
    if (!apiKey && detectedKey) {
      const masked = detectedKey.slice(0, 8) + '...' + detectedKey.slice(-4);
      const useExisting = await tuiConfirm({
        title: `Found existing API key (${colors.green}${masked}${colors.reset}). Use this key?`,
        defaultYes: true
      });
      if (useExisting) {
        apiKey = detectedKey;
      }
    }

    if (!apiKey) {
      apiKey = await tuiInput({
        promptLabel: 'GhostCLI API Key (starts with gcli_...)',
        required: true,
        emptyError: 'API Key cannot be empty.'
      });
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

  console.log(`\n${colors.bold}${colors.cyan}Step 3: Pre-Flight Connection Validation${colors.reset}`);
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

      const choice = await tuiSelect({
        title: '\nHow would you like to proceed?',
        options: [
          { value: 'key', label: 'Re-enter API Key', hint: 'default' },
          { value: 'url', label: 'Change Base URL' },
          { value: 'skip', label: 'Skip validation & proceed anyway' },
          { value: 'abort', label: 'Abort setup' }
        ],
        defaultIndex: 0,
        cancelValue: 'abort'
      });

      if (choice === 'url') {
        baseUrl = await tuiInput({
          promptLabel: 'New Base URL',
          defaultValue: baseUrl
        });
        urls = normalizeUrls(baseUrl);
      } else if (choice === 'skip') {
        console.log(`${colors.yellow}Skipping validation...${colors.reset}`);
        validated = true;
      } else if (choice === 'abort') {
        console.log(`Setup aborted.`);
        process.exit(0);
      } else {
        apiKey = await tuiInput({
          promptLabel: 'New GhostCLI API Key',
          required: true,
          emptyError: 'API Key cannot be empty.'
        });
      }
    }
  }

  // Step 4: Detect Installed Harnesses & Select Targets
  const latestHarnesses = detectHarnesses();
  const detectedList = Object.keys(latestHarnesses).filter(id => latestHarnesses[id].installed);

  let selectedTools = detectedList;
  if (options.tools) {
    selectedTools = options.tools.includes('all')
      ? Object.keys(latestHarnesses)
      : options.tools;
  } else if (!options.yes) {
    console.log('');
    const harnessOptions = Object.entries(latestHarnesses).map(([id, h]) => {
      const detail = h.bin || (h.configExists ? h.configPath : '');
      const hint = h.installed
        ? `${colors.green}(Detected${detail ? `: ${detail}` : ''})${colors.reset}`
        : `${colors.dim}(Not detected)${colors.reset}`;
      return {
        value: id,
        label: h.name.padEnd(28),
        hint,
        checked: h.installed,
        detected: h.installed
      };
    });

    selectedTools = await tuiMultiSelect({
      title: 'Step 4: Select Target AI Harnesses',
      subtitle: `${detectedList.length} harness(es) detected on this device and pre-selected.`,
      options: harnessOptions
    });
  } else {
    console.log(`\n${colors.bold}${colors.cyan}Step 4: AI Harness Detection${colors.reset}`);
    for (const h of Object.values(latestHarnesses)) {
      const icon = h.installed ? `${colors.green}[✔]${colors.reset}` : `${colors.dim}[ ]${colors.reset}`;
      console.log(`  ${icon} ${colors.bold}${h.name.padEnd(28)}${colors.reset} ${h.installed ? colors.green + '(Installed)' : colors.dim + '(Not detected)'}${colors.reset}`);
    }
  }

  // Step 5: Persistence Mode Selection
  let mode = options.mode || 'both';
  if (!options.yes) {
    console.log('');
    mode = await tuiSelect({
      title: 'Step 5: Persistence Mode',
      options: [
        { value: 'both', label: 'Both Tool Config Files & Persistent Environment Variables', hint: 'Recommended' },
        { value: 'config', label: 'Tool Configuration Files Only' },
        { value: 'env', label: 'Persistent Environment Variables Only' }
      ],
      defaultIndex: 0
    });
  }

  // Step 6: Execute Configuration
  applyDeployment(selectedTools, latestHarnesses, urls, apiKey, mode, options.dryRun);
}
