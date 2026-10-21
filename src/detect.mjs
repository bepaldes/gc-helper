/**
 * GhostCLI Helper — Environment & Harness Discovery Engine
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
      const match = content.match(/base_url\s*=\s*"([^"]+)"/);
      if (match) codexEndpoint = match[1];
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

  return results;
}

export function detectExistingKey() {
  if (process.env.GHOSTCLI_API_KEY && process.env.GHOSTCLI_API_KEY.trim() !== '') {
    return process.env.GHOSTCLI_API_KEY.trim();
  }
  if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.startsWith('gcli_')) {
    return process.env.ANTHROPIC_API_KEY.trim();
  }
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('gcli_')) {
    return process.env.OPENAI_API_KEY.trim();
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
