import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m'
};

const userHome = os.homedir();
const isWin = process.platform === 'win32';

export function getClaudeDesktop3pDir() {
  if (isWin) {
    const localAppData = process.env.LOCALAPPDATA || path.join(userHome, 'AppData', 'Local');
    return path.join(localAppData, 'Claude-3p');
  }
  if (process.platform === 'darwin') {
    return path.join(userHome, 'Library', 'Application Support', 'Claude-3p');
  }
  const configHome = process.env.XDG_CONFIG_HOME || path.join(userHome, '.config');
  return path.join(configHome, 'Claude-3p');
}

export function printDesktopWarning() {
  console.log(`\n${colors.yellow}${colors.bold}Notice regarding Claude Desktop in Third-Party Inference Mode:${colors.reset}`);
  console.log(`  ${colors.yellow}• Claude Desktop will operate in Developer / 3P Inference mode pointing to GhostCLI.${colors.reset}`);
  console.log(`  ${colors.yellow}• Access to claude.ai cloud features (cloud Projects, Web Connectors, cloud Skills,${colors.reset}`);
  console.log(`  ${colors.yellow}  and cloud Chat History) will not be accessible while in 3P mode.${colors.reset}`);
  console.log(`  ${colors.green}• Local MCP servers (e.g., Context7, filesystem tools) ARE preserved and active.${colors.reset}`);
  console.log(`  ${colors.dim}• Reversible at any time via generated safety backup (.bak) or by disabling Developer Mode.${colors.reset}`);
}

export function configureClaudeDesktop(configPath, urls, apiKey, dryRun = false, custom3pDir = null) {
  printDesktopWarning();

  const dir1p = path.dirname(configPath);
  if (!fs.existsSync(dir1p) && !dryRun) {
    fs.mkdirSync(dir1p, { recursive: true });
  }

  let existingConfig = {};
  let backupPath = `${configPath}.bak`;

  if (fs.existsSync(configPath)) {
    try {
      existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (!dryRun) {
        fs.writeFileSync(backupPath, JSON.stringify(existingConfig, null, 2));
      }
    } catch {
      existingConfig = {};
    }
  }

  // Preserve pre-existing MCP servers
  const mcpServers = existingConfig.mcpServers || {};

  // 1. Update Primary config with deploymentMode: 3p
  const updated1p = {
    ...existingConfig,
    deploymentMode: '3p',
    mcpServers: mcpServers
  };

  if (!dryRun) {
    fs.writeFileSync(configPath, JSON.stringify(updated1p, null, 2));
  }

  // 2. Configure Claude-3p directory & configLibrary
  const dir3p = custom3pDir || getClaudeDesktop3pDir();
  const configLibDir = path.join(dir3p, 'configLibrary');

  if (!dryRun) {
    fs.mkdirSync(configLibDir, { recursive: true });
  }

  // Claude-3p/claude_desktop_config.json
  const config3pFile = path.join(dir3p, 'claude_desktop_config.json');
  if (fs.existsSync(config3pFile) && !dryRun) {
    try {
      fs.writeFileSync(`${config3pFile}.bak`, fs.readFileSync(config3pFile, 'utf8'));
    } catch {}
  }

  const updated3p = {
    deploymentMode: '3p',
    mcpServers: mcpServers
  };

  if (!dryRun) {
    fs.writeFileSync(config3pFile, JSON.stringify(updated3p, null, 2));
  }

  // Config library profile
  const profileId = '00000000-0000-4000-8000-000000000001';
  const metaFile = path.join(configLibDir, '_meta.json');
  const metaContent = {
    appliedId: profileId
  };

  const profileFile = path.join(configLibDir, `${profileId}.json`);
  const profileContent = {
    id: profileId,
    name: 'GhostCLI',
    inferenceProvider: 'gateway',
    inferenceGatewayBaseUrl: urls.baseUrl,
    inferenceGatewayApiKey: apiKey,
    inferenceGatewayAuthScheme: 'bearer',
    modelDiscoveryEnabled: true,
    inferenceModels: [
      'claude-opus-5-5',
      'claude-sonnet-5',
      'claude-fable-5.1',
      'gpt-6-astra',
      'z-ai/glm-5.3'
    ]
  };

  if (!dryRun) {
    fs.writeFileSync(metaFile, JSON.stringify(metaContent, null, 2));
    fs.writeFileSync(profileFile, JSON.stringify(profileContent, null, 2));
  }

  console.log(`  ${colors.cyan}Tip: In Claude Desktop, verify 3P status via Help → Troubleshooting → Enable Developer Mode.${colors.reset}`);

  return {
    tool: 'Claude Desktop (3P Inference Mode)',
    path: configPath,
    dir3p: dir3p,
    backup: backupPath
  };
}
