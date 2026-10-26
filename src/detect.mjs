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
    }
  };
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

