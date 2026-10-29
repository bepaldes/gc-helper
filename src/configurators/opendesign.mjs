import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const OPEN_DESIGN_ROUTE_MODELS = [
  'claude-opus-5-5',
  'claude-sonnet-5',
  'claude-fable-5.1',
  'gpt-6-astra',
  'claude-opus-4-6',
  'claude-sonnet-4-6'
];

const ALLOWED_MODEL_KEYS = new Set(['model', 'reasoning', 'serviceTier']);
const ALLOWED_CLAUDE_ENV_KEYS = new Set([
  'CLAUDE_CONFIG_DIR',
  'CLAUDE_BIN',
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'MMD_MODEL_ROUTES_FILE'
]);
const ALLOWED_CODEX_ENV_KEYS = new Set([
  'CODEX_HOME',
  'CODEX_BIN',
  'OPENAI_BASE_URL',
  'CODEX_API_KEY',
  'OPENAI_API_KEY'
]);

function sanitizeObjectKeys(obj, allowedSet) {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj)) {
    if (allowedSet.has(k) && typeof v === 'string' && v.trim() !== '') {
      out[k] = v;
    }
  }
  return out;
}

export function getDefaultMmdRoutesPath(homeDir = os.homedir()) {
  return path.join(homeDir, '.config', 'mms', 'model-routes.json');
}

export function configureOpenDesign(configPath, urls, apiKey, dryRun = false, options = {}, models = null) {
  const routesPath = options.routesPath || getDefaultMmdRoutesPath(options.homeDir || os.homedir());
  const routesDir = path.dirname(routesPath);

  if (!fs.existsSync(routesDir) && !dryRun) {
    fs.mkdirSync(routesDir, { recursive: true });
  }

  let existingRoutesDoc = {};
  if (fs.existsSync(routesPath)) {
    try {
      existingRoutesDoc = JSON.parse(fs.readFileSync(routesPath, 'utf8'));
      if (!dryRun) {
        fs.writeFileSync(`${routesPath}.bak`, JSON.stringify(existingRoutesDoc, null, 2));
      }
    } catch {
      existingRoutesDoc = {};
    }
  }

  const routes = (existingRoutesDoc.routes && typeof existingRoutesDoc.routes === 'object')
    ? { ...existingRoutesDoc.routes }
    : {};

  if (!models) {
    delete routes['z-ai/glm-5.3'];
    delete routes['glm-5.3'];
  }

  const targetModelList = (Array.isArray(models) && models.length > 0)
    ? models.map(m => m.id || m.slug || m)
    : OPEN_DESIGN_ROUTE_MODELS;

  const orderedRoutes = {};
  for (const modelId of targetModelList) {
    orderedRoutes[modelId] = {
      ...(routes[modelId] && typeof routes[modelId] === 'object' ? routes[modelId] : {}),
      primary: {
        anthropic_base_url: urls.claudeUrl,
        api_key: apiKey
      }
    };
  }
  for (const [k, v] of Object.entries(routes)) {
    if (!orderedRoutes[k]) {
      orderedRoutes[k] = v;
    }
  }

  const updatedRoutesDoc = {
    ...existingRoutesDoc,
    routes: orderedRoutes
  };

  if (!dryRun) {
    fs.writeFileSync(routesPath, JSON.stringify(updatedRoutesDoc, null, 2));
  }

  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir) && !dryRun) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let appConfig = {};
  const backupPath = `${configPath}.bak`;
  if (fs.existsSync(configPath)) {
    try {
      appConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (!dryRun) {
        fs.writeFileSync(backupPath, JSON.stringify(appConfig, null, 2));
      }
    } catch {
      appConfig = {};
    }
  }

  if (!appConfig.agentId || appConfig.agentId === 'amr') {
    appConfig.agentId = 'claude';
  }

  const existingModels = (appConfig.agentModels && typeof appConfig.agentModels === 'object')
    ? appConfig.agentModels
    : {};
  const claudeModelCfg = sanitizeObjectKeys(existingModels.claude, ALLOWED_MODEL_KEYS);
  if (!claudeModelCfg.model || claudeModelCfg.model === 'glm-5.3' || claudeModelCfg.model === 'z-ai/glm-5.3') {
    claudeModelCfg.model = 'claude-opus-5-5';
  }

  const codexModelCfg = sanitizeObjectKeys(existingModels.codex, ALLOWED_MODEL_KEYS);
  if (!codexModelCfg.model || codexModelCfg.model === 'glm-5.3' || codexModelCfg.model === 'z-ai/glm-5.3') {
    codexModelCfg.model = 'gpt-6-astra';
  }
  if (!codexModelCfg.reasoning) {
    codexModelCfg.reasoning = 'high';
  }

  appConfig.agentModels = {
    ...existingModels,
    claude: claudeModelCfg,
    codex: codexModelCfg
  };

  const existingCliEnv = (appConfig.agentCliEnv && typeof appConfig.agentCliEnv === 'object')
    ? appConfig.agentCliEnv
    : {};
  const claudeEnv = sanitizeObjectKeys(existingCliEnv.claude, ALLOWED_CLAUDE_ENV_KEYS);
  claudeEnv.ANTHROPIC_BASE_URL = urls.claudeUrl;
  claudeEnv.ANTHROPIC_AUTH_TOKEN = apiKey;
  claudeEnv.ANTHROPIC_API_KEY = apiKey;
  claudeEnv.MMD_MODEL_ROUTES_FILE = routesPath;

  const codexEnv = sanitizeObjectKeys(existingCliEnv.codex, ALLOWED_CODEX_ENV_KEYS);
  codexEnv.OPENAI_BASE_URL = urls.openaiUrl;
  codexEnv.OPENAI_API_KEY = apiKey;
  codexEnv.CODEX_API_KEY = apiKey;

  appConfig.agentCliEnv = {
    ...existingCliEnv,
    claude: claudeEnv,
    codex: codexEnv
  };

  const existingIntent = (appConfig.agentCliEnvIntent && typeof appConfig.agentCliEnvIntent === 'object')
    ? appConfig.agentCliEnvIntent
    : {};
  appConfig.agentCliEnvIntent = {
    ...existingIntent,
    claude: { apiKeyOverride: true },
    codex: { apiKeyOverride: true }
  };

  if (!dryRun) {
    fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2));
  }

  return {
    tool: 'Open Design (Claude + Astra Dual-Harness)',
    path: configPath,
    routesPath,
    backup: fs.existsSync(backupPath) ? backupPath : null
  };
}
