/**
 * GC-Helper — Environment & Harness Discovery Engine
 * Scans PATH and user directories across Windows, macOS, and Linux
 * to locate installed AI coding assistants and extract existing configurations.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

const userHome = os.homedir();
const isWin = process.platform === 'win32';
const localAppData = process.env.LOCALAPPDATA || path.join(userHome, 'AppData', 'Local');
const appData = process.env.APPDATA || path.join(userHome, 'AppData', 'Roaming');
const configHome = process.env.XDG_CONFIG_HOME || path.join(userHome, '.config');

export function checkBinary(cmd) {
  try {
    const checkCmd = isWin ? `where.exe ${cmd}` : `which ${cmd}`;
    const out = execSync(checkCmd, { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim();
    if (out) {
      return out.split(/\r?\n/)[0].trim();
    }
  } catch {}
  return null;
}

export function getToolPaths() {
  const localAppData = process.env.LOCALAPPDATA || path.join(userHome, 'AppData', 'Local');
  const appData = process.env.APPDATA || path.join(userHome, 'AppData', 'Roaming');
  const configHome = process.env.XDG_CONFIG_HOME || path.join(userHome, '.config');

  return {
    claude: {
      config: path.join(userHome, '.claude', 'settings.json'),
      dir: path.join(userHome, '.claude')
    },
    codex: {
      config: path.join(userHome, '.codex', 'config.toml'),
      dir: path.join(userHome, '.codex'),
      candidateBins: [
        path.join(localAppData, 'Programs', 'OpenAI', 'Codex', 'bin', 'codex.exe'),
        path.join(userHome, '.codex', 'packages', 'standalone', 'current', 'bin', 'codex.exe')
      ]
    },
    hermes: {
      config: isWin
        ? path.join(localAppData, 'hermes', 'config.yaml')
        : path.join(userHome, '.hermes', 'config.yaml'),
      dir: isWin
        ? path.join(localAppData, 'hermes')
        : path.join(userHome, '.hermes'),
      candidateBins: [
        path.join(localAppData, 'hermes', 'bin', 'hermes.cmd'),
        path.join(userHome, '.hermes', 'bin', 'hermes')
      ]
    },
    openclaw: {
      config: path.join(userHome, '.openclaw', 'openclaw.json'),
      dir: path.join(userHome, '.openclaw')
    },
    opencode: {
      config: isWin
        ? path.join(appData, 'opencode', 'config.json')
        : path.join(configHome, 'opencode', 'config.json'),
      dir: isWin
        ? path.join(appData, 'opencode')
        : path.join(configHome, 'opencode')
    },
    omp: {
      config: path.join(userHome, '.omp', 'config.json'),
      dir: path.join(userHome, '.omp')
    },
    vscode: {
      config: isWin
        ? path.join(appData, 'Code', 'User', 'settings.json')
        : (process.platform === 'darwin'
            ? path.join(userHome, 'Library', 'Application Support', 'Code', 'User', 'settings.json')
            : path.join(configHome, 'Code', 'User', 'settings.json')),
      dir: isWin
        ? path.join(appData, 'Code', 'User')
        : (process.platform === 'darwin'
            ? path.join(userHome, 'Library', 'Application Support', 'Code', 'User')
            : path.join(configHome, 'Code', 'User')),
      candidateBins: isWin
        ? [
            path.join(localAppData, 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd'),
            path.join(localAppData, 'Programs', 'Microsoft VS Code', 'bin', 'code'),
            path.join(localAppData, 'Programs', 'Microsoft VS Code', 'Code.exe')
          ]
        : []
    },
    desktop: {
      config: isWin
        ? path.join(appData, 'Claude', 'claude_desktop_config.json')
        : (process.platform === 'darwin'
            ? path.join(userHome, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
            : path.join(configHome, 'Claude', 'claude_desktop_config.json')),
      dir: isWin
        ? path.join(appData, 'Claude')
        : (process.platform === 'darwin'
            ? path.join(userHome, 'Library', 'Application Support', 'Claude')
            : path.join(configHome, 'Claude')),
      dir3p: isWin
        ? path.join(localAppData, 'Claude-3p')
        : (process.platform === 'darwin'
            ? path.join(userHome, 'Library', 'Application Support', 'Claude-3p')
            : path.join(configHome, 'Claude-3p')),
      candidateBins: isWin
        ? [
            path.join(localAppData, 'Programs', 'Claude', 'Claude.exe'),
            path.join(localAppData, 'Claude', 'Claude.exe'),
            path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Claude', 'Claude.exe')
          ]
        : (process.platform === 'darwin'
            ? ['/Applications/Claude.app']
            : ['/usr/bin/claude-desktop', '/opt/Claude/claude-desktop'])
    },
    opendesign: (() => {
      const baseDir = isWin
        ? path.join(appData, 'Open Design')
        : (process.platform === 'darwin'
            ? path.join(userHome, 'Library', 'Application Support', 'Open Design')
            : path.join(configHome, 'Open Design'));
      const defaultNs = isWin
        ? 'release-stable-win'
        : (process.platform === 'darwin' ? 'release-stable-mac' : 'release-stable-linux');
      let resolvedConfig = path.join(baseDir, 'namespaces', defaultNs, 'data', 'app-config.json');
      const nsRoot = path.join(baseDir, 'namespaces');
      if (!fs.existsSync(resolvedConfig) && fs.existsSync(nsRoot)) {
        try {
          for (const entry of fs.readdirSync(nsRoot)) {
            const candidate = path.join(nsRoot, entry, 'data', 'app-config.json');
            if (fs.existsSync(candidate)) {
              resolvedConfig = candidate;
              break;
            }
          }
        } catch {}
      }
      return {
        config: resolvedConfig,
        dir: baseDir,
        candidateBins: isWin
          ? [
              path.join(localAppData, 'Programs', 'Open Design', 'Open Design.exe'),
              path.join(localAppData, 'Open Design', 'Open Design.exe'),
              path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Open Design', 'Open Design.exe')
            ]
          : (process.platform === 'darwin'
              ? ['/Applications/Open Design.app/Contents/MacOS/Open Design', '/Applications/Open Design.app']
              : ['/usr/bin/open-design', '/opt/Open Design/open-design'])
      };
    })()
  };
}

export function inspectHarnessContext(id, configPath) {
  if (!configPath || !fs.existsSync(configPath)) {
    return { ok: false, detail: 'Config file not present' };
  }

  try {
    if (id === 'claude') {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const flag = cfg.env?.CLAUDE_CODE_DISABLE_1M_CONTEXT;
      if (flag === '0' || flag === 0 || flag === false) {
        return { ok: true, detail: '1M extended context enabled (CLAUDE_CODE_DISABLE_1M_CONTEXT=0)' };
      }
      if (flag === '1' || flag === 1 || flag === true) {
        return { ok: false, detail: '1M context disabled (CLAUDE_CODE_DISABLE_1M_CONTEXT=1)' };
      }
      return { ok: false, detail: 'CLAUDE_CODE_DISABLE_1M_CONTEXT not explicitly set to 0' };
    }

    if (id === 'codex') {
      const content = fs.readFileSync(configPath, 'utf8');
      const catMatch = content.match(/model_catalog_json\s*=\s*["']([^"']+)["']/);
      const catalogPath = catMatch ? catMatch[1] : path.join(path.dirname(configPath), 'ghostcli-models.json');
      if (!fs.existsSync(catalogPath)) {
        return { ok: false, detail: 'ghostcli-models.json catalog missing' };
      }
      const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
      const models = Array.isArray(catalog.models) ? catalog.models : [];
      if (models.length === 0) {
        return { ok: false, detail: 'No models in catalog' };
      }
      const capped = models.filter(m => {
        const topCtx = Number(m.context_window) || 0;
        const maxCtx = Number(m.max_context_window) || topCtx;
        const msgCtx = m.model_messages ? (Number(m.model_messages.context_window) || 0) : topCtx;
        return topCtx < 1000000 || maxCtx < 1000000 || msgCtx < 1000000;
      });
      if (capped.length > 0) {
        return {
          ok: false,
          detail: `${capped.length}/${models.length} model(s) capped below 1M (${capped.map(m => `${m.slug}:${m.context_window}`).join(', ')})`
        };
      }
      return { ok: true, detail: `All ${models.length} catalog models configured at 1M context` };
    }

    if (id === 'hermes') {
      const content = fs.readFileSync(configPath, 'utf8');
      const matches = [...content.matchAll(/^[ \t]*context_length:\s*(\d+)/gm)];
      if (matches.length === 0) {
        return { ok: false, detail: 'No explicit context_length found in config.yaml' };
      }
      const capped = matches.filter(m => Number(m[1]) < 1000000);
      if (capped.length > 0) {
        return { ok: false, detail: `Found context_length below 1M (${capped.map(m => m[1]).join(', ')})` };
      }
      return { ok: true, detail: `All ${matches.length} model entries configured at 1M context_length` };
    }

    if (id === 'vscode') {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const envKey = isWin
        ? 'terminal.integrated.env.windows'
        : (process.platform === 'darwin' ? 'terminal.integrated.env.osx' : 'terminal.integrated.env.linux');
      const flag = cfg[envKey]?.CLAUDE_CODE_DISABLE_1M_CONTEXT;
      if (flag === '0') {
        return { ok: true, detail: '1M context enabled in integrated terminal' };
      }
      return { ok: false, detail: 'CLAUDE_CODE_DISABLE_1M_CONTEXT=0 not set in terminal env' };
    }

    if (id === 'openclaw') {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const ctx = Number(cfg.context_window) || 0;
      return ctx >= 1000000
        ? { ok: true, detail: `1M context_window (${ctx})` }
        : { ok: false, detail: `context_window is ${ctx || 'unset'}` };
    }

    if (id === 'opencode') {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const ctx = Number(cfg.providers?.ghostcli?.context_window) || 0;
      return ctx >= 1000000
        ? { ok: true, detail: `1M context_window (${ctx})` }
        : { ok: false, detail: `context_window is ${ctx || 'unset'}` };
    }

    if (id === 'omp') {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const ctx = Number(cfg.models?.context_window) || 0;
      return ctx >= 1000000
        ? { ok: true, detail: `1M context_window (${ctx})` }
        : { ok: false, detail: `context_window is ${ctx || 'unset'}` };
    }

    if (id === 'desktop') {
      const toolPaths = getToolPaths();
      const metaPath = path.join(toolPaths.desktop.dir3p, 'configLibrary', '_meta.json');
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        const profPath = path.join(toolPaths.desktop.dir3p, 'configLibrary', `${meta.appliedId}.json`);
        if (fs.existsSync(profPath)) {
          const prof = JSON.parse(fs.readFileSync(profPath, 'utf8'));
          const ctx = Number(prof.maxContextWindow || prof.contextWindow) || 0;
          if (ctx >= 1000000) {
            return { ok: true, detail: `1M maxContextWindow (${ctx})` };
          }
        }
      }
      return { ok: false, detail: '1M maxContextWindow not set in 3P profile' };
    }

    if (id === 'opendesign') {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const claudeUrl = cfg.agentCliEnv?.claude?.ANTHROPIC_BASE_URL;
      const codexUrl = cfg.agentCliEnv?.codex?.OPENAI_BASE_URL;
      const routesPath = cfg.agentCliEnv?.claude?.MMD_MODEL_ROUTES_FILE || path.join(userHome, '.config', 'mms', 'model-routes.json');
      if (!claudeUrl || !codexUrl) {
        return { ok: false, detail: 'Dual-harness claude/codex endpoints not configured in app-config.json' };
      }
      if (!fs.existsSync(routesPath)) {
        return { ok: false, detail: 'MMD model-routes.json file missing' };
      }
      const routesDoc = JSON.parse(fs.readFileSync(routesPath, 'utf8'));
      const routes = routesDoc.routes || {};
      const hasClaude = Boolean(routes['claude-opus-5-5'] && routes['claude-sonnet-5']);
      const hasAstra = Boolean(routes['gpt-6-astra']);
      if (!hasClaude || !hasAstra) {
        return { ok: false, detail: 'Simultaneous Claude + Astra routes missing from model-routes.json' };
      }
      return {
        ok: true,
        detail: '1M context via Claude Code & Codex CLI (Claude + Astra simultaneous routes active)'
      };
    }
  } catch (err) {
    return { ok: false, detail: `Failed to inspect context (${err.message})` };
  }

  return { ok: false, detail: 'Unknown harness' };
}

export function detectHarnesses() {
  const toolPaths = getToolPaths();
  const results = {};

  // 1. Claude Code
  const claudeBin = checkBinary('claude');
  const claudeConfigExists = fs.existsSync(toolPaths.claude.config);
  let claudeEndpoint = null;
  if (claudeConfigExists) {
    try {
      const cfg = JSON.parse(fs.readFileSync(toolPaths.claude.config, 'utf8'));
      claudeEndpoint = cfg.env?.ANTHROPIC_BASE_URL || null;
    } catch {}
  }
  results.claude = {
    id: 'claude',
    name: 'Claude Code CLI',
    installed: Boolean(claudeBin || claudeConfigExists || fs.existsSync(toolPaths.claude.dir)),
    bin: claudeBin,
    configPath: toolPaths.claude.config,
    configExists: claudeConfigExists,
    currentEndpoint: claudeEndpoint || process.env.ANTHROPIC_BASE_URL || null
  };

  // 2. OpenAI Codex CLI
  let codexBin = checkBinary('codex');
  if (!codexBin) {
    for (const b of toolPaths.codex.candidateBins) {
      if (fs.existsSync(b)) { codexBin = b; break; }
    }
  }
  const codexConfigExists = fs.existsSync(toolPaths.codex.config);
  let codexEndpoint = null;
  if (codexConfigExists) {
    try {
      const content = fs.readFileSync(toolPaths.codex.config, 'utf8');
      const ghostcliBlock = content.match(/\[model_providers\.ghostcli\](?:\r?\n(?!\s*\[).*)*\r?\n?/m);
      if (ghostcliBlock) {
        const match = ghostcliBlock[0].match(/base_url\s*=\s*["']([^"']+)["']/);
        if (match) codexEndpoint = match[1];
      }
      if (!codexEndpoint) {
        const match = content.match(/base_url\s*=\s*["']([^"']+)["']/);
        if (match) codexEndpoint = match[1];
      }
    } catch {}
  }
  results.codex = {
    id: 'codex',
    name: 'OpenAI Codex CLI',
    installed: Boolean(codexBin || codexConfigExists || fs.existsSync(toolPaths.codex.dir)),
    bin: codexBin,
    configPath: toolPaths.codex.config,
    configExists: codexConfigExists,
    currentEndpoint: codexEndpoint || process.env.OPENAI_BASE_URL || null
  };

  // 3. Hermes Agent
  let hermesBin = checkBinary('hermes');
  if (!hermesBin) {
    for (const b of toolPaths.hermes.candidateBins) {
      if (fs.existsSync(b)) { hermesBin = b; break; }
    }
  }
  const hermesConfigExists = fs.existsSync(toolPaths.hermes.config);
  let hermesEndpoint = null;
  if (hermesConfigExists) {
    try {
      const content = fs.readFileSync(toolPaths.hermes.config, 'utf8');
      if (content.includes('ghostcli') || content.includes('anthropic')) {
        hermesEndpoint = 'Configured in config.yaml';
      }
    } catch {}
  }
  results.hermes = {
    id: 'hermes',
    name: 'Hermes Agent (Nous Research)',
    installed: Boolean(hermesBin || hermesConfigExists || fs.existsSync(toolPaths.hermes.dir)),
    bin: hermesBin,
    configPath: toolPaths.hermes.config,
    configExists: hermesConfigExists,
    currentEndpoint: hermesEndpoint
  };

  // 4. OpenClaw
  const openclawBin = checkBinary('openclaw');
  const openclawConfigExists = fs.existsSync(toolPaths.openclaw.config);
  let openclawEndpoint = null;
  if (openclawConfigExists) {
    try {
      const cfg = JSON.parse(fs.readFileSync(toolPaths.openclaw.config, 'utf8'));
      openclawEndpoint = cfg.base_url || cfg.endpoint || null;
    } catch {}
  }
  results.openclaw = {
    id: 'openclaw',
    name: 'OpenClaw',
    installed: Boolean(openclawBin || openclawConfigExists || fs.existsSync(toolPaths.openclaw.dir)),
    bin: openclawBin,
    configPath: toolPaths.openclaw.config,
    configExists: openclawConfigExists,
    currentEndpoint: openclawEndpoint
  };

  // 5. OpenCode
  const opencodeBin = checkBinary('opencode');
  const opencodeConfigExists = fs.existsSync(toolPaths.opencode.config);
  let opencodeEndpoint = null;
  if (opencodeConfigExists) {
    try {
      const cfg = JSON.parse(fs.readFileSync(toolPaths.opencode.config, 'utf8'));
      openclawEndpoint = cfg.base_url || cfg.endpoint || null;
    } catch {}
  }
  results.opencode = {
    id: 'opencode',
    name: 'OpenCode Interpreter / CLI',
    installed: Boolean(opencodeBin || opencodeConfigExists || fs.existsSync(toolPaths.opencode.dir)),
    bin: opencodeBin,
    configPath: toolPaths.opencode.config,
    configExists: opencodeConfigExists,
    currentEndpoint: opencodeEndpoint
  };

  // 6. Oh My Pi (omp)
  const ompBin = checkBinary('omp');
  const ompConfigExists = fs.existsSync(toolPaths.omp.config);
  let ompEndpoint = null;
  if (ompConfigExists) {
    try {
      const cfg = JSON.parse(fs.readFileSync(toolPaths.omp.config, 'utf8'));
      ompEndpoint = cfg.base_url || cfg.api_url || null;
    } catch {}
  }
  results.omp = {
    id: 'omp',
    name: 'Oh My Pi (omp)',
    installed: Boolean(ompBin || ompConfigExists || fs.existsSync(toolPaths.omp.dir)),
    bin: ompBin,
    configPath: toolPaths.omp.config,
    configExists: ompConfigExists,
    currentEndpoint: ompEndpoint
  };

  // 7. Visual Studio Code
  let vscodeBin = checkBinary('code');
  if (!vscodeBin) {
    for (const b of toolPaths.vscode.candidateBins) {
      if (fs.existsSync(b)) { vscodeBin = b; break; }
    }
  }
  const vscodeConfigExists = fs.existsSync(toolPaths.vscode.config);
  let vscodeEndpoint = null;
  if (vscodeConfigExists) {
    try {
      const cfg = JSON.parse(fs.readFileSync(toolPaths.vscode.config, 'utf8'));
      const envKey = isWin
        ? 'terminal.integrated.env.windows'
        : (process.platform === 'darwin' ? 'terminal.integrated.env.osx' : 'terminal.integrated.env.linux');
      vscodeEndpoint = cfg[envKey]?.ANTHROPIC_BASE_URL || cfg[envKey]?.OPENAI_BASE_URL || null;
    } catch {}
  }
  results.vscode = {
    id: 'vscode',
    name: 'Visual Studio Code',
    installed: Boolean(vscodeBin || vscodeConfigExists || fs.existsSync(toolPaths.vscode.dir)),
    bin: vscodeBin,
    configPath: toolPaths.vscode.config,
    configExists: vscodeConfigExists,
    currentEndpoint: vscodeEndpoint
  };

  // 8. Claude Desktop (Official)
  let desktopBin = checkBinary('claude-desktop');
  if (!desktopBin) {
    for (const b of toolPaths.desktop.candidateBins) {
      if (fs.existsSync(b)) { desktopBin = b; break; }
    }
  }
  if (!desktopBin && isWin) {
    const packagesDir = path.join(localAppData, 'Packages');
    if (fs.existsSync(packagesDir)) {
      try {
        const pkgs = fs.readdirSync(packagesDir);
        for (const p of pkgs) {
          if (p.toLowerCase().startsWith('claude_')) {
            desktopBin = p;
            break;
          }
        }
      } catch {}
    }
  }

  const desktop1pExists = fs.existsSync(toolPaths.desktop.config);
  const desktop3pExists = fs.existsSync(toolPaths.desktop.dir3p);
  let desktopEndpoint = null;

  if (desktop3pExists) {
    try {
      const metaPath = path.join(toolPaths.desktop.dir3p, 'configLibrary', '_meta.json');
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        const profPath = path.join(toolPaths.desktop.dir3p, 'configLibrary', `${meta.appliedId}.json`);
        if (fs.existsSync(profPath)) {
          const prof = JSON.parse(fs.readFileSync(profPath, 'utf8'));
          desktopEndpoint = prof.inferenceGatewayBaseUrl || null;
        }
      }
    } catch {}
  }
  if (!desktopEndpoint && desktop1pExists) {
    try {
      const cfg = JSON.parse(fs.readFileSync(toolPaths.desktop.config, 'utf8'));
      if (cfg.deploymentMode === '3p') {
        desktopEndpoint = 'Third-Party Inference (3P Mode)';
      }
    } catch {}
  }

  results.desktop = {
    id: 'desktop',
    name: 'Claude Desktop App',
    installed: Boolean(desktopBin),
    bin: desktopBin,
    configPath: toolPaths.desktop.config,
    configExists: desktop1pExists,
    currentEndpoint: desktopEndpoint
  };

  // 9. Open Design
  let openDesignBin = checkBinary('open-design');
  if (!openDesignBin) {
    for (const b of toolPaths.opendesign.candidateBins) {
      if (fs.existsSync(b)) { openDesignBin = b; break; }
    }
  }
  const openDesignConfigExists = fs.existsSync(toolPaths.opendesign.config);
  let openDesignEndpoint = null;
  if (openDesignConfigExists) {
    try {
      const cfg = JSON.parse(fs.readFileSync(toolPaths.opendesign.config, 'utf8'));
      openDesignEndpoint =
        cfg.agentCliEnv?.claude?.ANTHROPIC_BASE_URL ||
        cfg.agentCliEnv?.codex?.OPENAI_BASE_URL ||
        null;
    } catch {}
  }
  results.opendesign = {
    id: 'opendesign',
    name: 'Open Design',
    installed: Boolean(openDesignBin || openDesignConfigExists || fs.existsSync(toolPaths.opendesign.dir)),
    bin: openDesignBin,
    configPath: toolPaths.opendesign.config,
    configExists: openDesignConfigExists,
    currentEndpoint: openDesignEndpoint
  };

  for (const [id, h] of Object.entries(results)) {
    h.contextStatus = h.configExists ? inspectHarnessContext(id, h.configPath) : null;
  }

  return results;
}

export function detectExistingKey(env = process.env) {
  if (env.GHOSTCLI_API_KEY && env.GHOSTCLI_API_KEY.trim() !== '') {
    return env.GHOSTCLI_API_KEY.trim();
  }
  if (env.ANTHROPIC_API_KEY && env.ANTHROPIC_API_KEY.startsWith('gcli_')) {
    return env.ANTHROPIC_API_KEY.trim();
  }
  if (env.OPENAI_API_KEY && env.OPENAI_API_KEY.startsWith('gcli_')) {
    return env.OPENAI_API_KEY.trim();
  }

  // Check Claude Code settings.json
  const toolPaths = getToolPaths();
  if (fs.existsSync(toolPaths.claude.config)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(toolPaths.claude.config, 'utf8'));
      if (cfg.env?.ANTHROPIC_API_KEY && cfg.env.ANTHROPIC_API_KEY.startsWith('gcli_')) {
        return cfg.env.ANTHROPIC_API_KEY.trim();
      }
    } catch {}
  }

  // Windows User Registry lookup
  if (isWin) {
    try {
      const psCmd = `[System.Environment]::GetEnvironmentVariable('GHOSTCLI_API_KEY', 'User')`;
      const out = execSync(`powershell -NoProfile -Command "${psCmd}"`, { encoding: 'utf8' }).trim();
      if (out && out.startsWith('gcli_')) return out;
    } catch {}
  }

  return null;
}

/**
 * Resolves the active GhostCLI Base URL from environment or existing harness configs.
 */
export function detectConfiguredEndpoint(harnesses = null, fallback = 'https://ghostcli.cloud', env = process.env) {
  if (env.ANTHROPIC_BASE_URL && env.ANTHROPIC_BASE_URL.trim() !== '') {
    return env.ANTHROPIC_BASE_URL.trim();
  }
  if (env.OPENAI_BASE_URL && env.OPENAI_BASE_URL.trim() !== '') {
    return env.OPENAI_BASE_URL.trim();
  }

  const h = harnesses || detectHarnesses();
  for (const info of Object.values(h)) {
    if (info && info.currentEndpoint && typeof info.currentEndpoint === 'string' && info.currentEndpoint.startsWith('http')) {
      return info.currentEndpoint;
    }
  }

  return fallback;
}

/**
 * Checks if GhostCLI is already configured on the system:
 * - A valid GhostCLI API key is detected, OR
 * - At least one harness has an existing active endpoint configured.
 */
export function isConfigured(harnesses = null, existingKey = undefined, env = process.env) {
  const key = existingKey !== undefined ? existingKey : detectExistingKey(env);
  if (key && typeof key === 'string' && key.trim() !== '') {
    return true;
  }

  const h = harnesses || detectHarnesses();
  for (const info of Object.values(h)) {
    if (info && info.configExists && info.currentEndpoint) {
      return true;
    }
  }

  return false;
}

