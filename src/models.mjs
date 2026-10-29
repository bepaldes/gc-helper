/**
 * GC-Helper — Model Synchronization & Health Check Engine
 * Discovers live models from GhostCLI /v1/models, probes model health,
 * enforces 1M max context limits, and synchronizes catalogs across
 * AI coding harnesses and Heimdall.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { normalizeUrls } from './audit.mjs';
import { detectExistingKey, detectHarnesses, detectHeimdall } from './detect.mjs';
import { configureCodex } from './configurators/codex.mjs';
import { configureHermes } from './configurators/hermes.mjs';
import { configureOpenCode } from './configurators/opencode.mjs';
import { configureOpenDesign } from './configurators/opendesign.mjs';
import { configureClaude } from './configurators/claude.mjs';
import { configureClaudeDesktop } from './configurators/desktop.mjs';

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

export function getDefaultModelsCachePath() {
  return path.join(os.homedir(), '.gc-helper', 'models.json');
}

export function readModelsCache(cachePath = getDefaultModelsCachePath()) {
  try {
    if (!fs.existsSync(cachePath)) return null;
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch {
    return null;
  }
}

export function writeModelsCache(cachePath = getDefaultModelsCachePath(), data = {}) {
  try {
    const dir = path.dirname(cachePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks live health of discovered models by sending a minimal test probe
 * to /v1/messages (mimicking Heimdall's model health check).
 */
export async function checkModelsHealth(baseUrl, apiKey, modelsList, timeoutMs = 8000) {
  if (!Array.isArray(modelsList) || modelsList.length === 0) {
    return { liveModels: [], deadModels: [], testedCount: 0 };
  }

  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
    return { liveModels: modelsList, deadModels: [], testedCount: 0 };
  }

  const cleanBase = (baseUrl || 'https://ghostcli.cloud').trim().replace(/\/+$/, '').replace(/\/v1$/, '');
  const messagesUrl = `${cleanBase}/v1/messages`;
  const cleanKey = apiKey.trim();

  const tested = await Promise.all(modelsList.map(async m => {
    const modelId = typeof m === 'string' ? m : (m.id || m.slug || m.name);
    let isAlive = true;

    try {
      const res = await fetch(messagesUrl, {
        method: 'POST',
        headers: {
          'x-api-key': cleanKey,
          'Authorization': `Bearer ${cleanKey}`,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: modelId,
          max_tokens: 5,
          messages: [{ role: 'user', content: 'hi' }]
        }),
        signal: AbortSignal.timeout(timeoutMs)
      });
      isAlive = res.ok;
    } catch {
      isAlive = false;
    }

    return { raw: m, modelId, isAlive };
  }));

  return {
    liveModels: tested.filter(t => t.isAlive).map(t => t.raw),
    deadModels: tested.filter(t => !t.isAlive).map(t => t.modelId),
    testedCount: tested.length
  };
}

/**
 * Normalizes raw remote model objects into uniform model specifications
 * with guaranteed 1M context window minimums.
 */
export function resolveModelSpecs(modelsList = []) {
  if (!Array.isArray(modelsList)) return [];

  const byId = new Map();

  for (const m of modelsList) {
    if (!m || typeof m !== 'object') continue;
    const rawId = m.id || m.slug || m.model || m.name;
    if (!rawId || typeof rawId !== 'string') continue;
    const id = rawId.replace(/\[1m\]$/i, '');

    const candidateContext = Math.max(
      Number(m.context_window) || 0,
      Number(m.max_context_window) || 0,
      Number(m.max_input_tokens) || 0,
      Number(m.context_window_tokens) || 0,
      Number(m.model_messages?.context_window) || 0,
      Number(m.model_messages?.max_context_window) || 0,
      1000000
    );

    const candidateOutput = Math.max(
      Number(m.max_output_tokens) || 0,
      Number(m.max_tokens) || 0,
      128000
    );

    const rawDisplayName = m.display_name || m.displayName || id;
    const displayName = rawDisplayName.replace(/\s*\(1M\)$/i, '');
    const description = m.description || '';

    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, {
        id,
        displayName,
        context: candidateContext >= 1000000 ? '1M' : `${Math.round(candidateContext / 1024)}K`,
        contextWindow: candidateContext,
        context_window_tokens: candidateContext,
        maxOutputTokens: candidateOutput,
        description
      });
    } else {
      existing.contextWindow = Math.max(existing.contextWindow, candidateContext);
      existing.context_window_tokens = existing.contextWindow;
      existing.maxOutputTokens = Math.max(existing.maxOutputTokens, candidateOutput);
      if (!existing.description && description) {
        existing.description = description;
      }
    }
  }

  return Array.from(byId.values());
}

/**
 * Synchronizes models catalog to Heimdall agent config/models.json if present.
 */
export function syncModelsToHeimdall(modelSpecs, dryRun = false, customHeimdallDir = null) {
  const heimdall = customHeimdallDir
    ? { installed: true, dir: customHeimdallDir, modelsPath: path.join(customHeimdallDir, 'config', 'models.json') }
    : detectHeimdall();

  if (!heimdall.installed || !heimdall.modelsPath || !fs.existsSync(heimdall.modelsPath)) {
    return { synced: false, reason: 'Heimdall not detected' };
  }

  try {
    let currentModels = {};
    if (fs.existsSync(heimdall.modelsPath)) {
      currentModels = JSON.parse(fs.readFileSync(heimdall.modelsPath, 'utf8'));
    }

    const mapped = modelSpecs.map(m => ({
      id: m.id,
      displayName: m.displayName || m.id,
      context: m.context || '1M',
      context_window_tokens: m.contextWindow || 1000000,
      description: m.description || ''
    }));

    currentModels.custom_proxies = mapped;
    currentModels.ghostcli = mapped;

    if (!dryRun) {
      fs.writeFileSync(heimdall.modelsPath, JSON.stringify(currentModels, null, 2), 'utf8');
    }

    return {
      synced: true,
      path: heimdall.modelsPath,
      totalModels: mapped.length
    };
  } catch (err) {
    return { synced: false, error: err.message };
  }
}

/**
 * Synchronizes models across detected AI coding harnesses.
 */
export function syncModelsToHarnesses(modelSpecs, harnesses, urls, apiKey, dryRun = false) {
  const results = [];

  // 1. Codex CLI
  if (harnesses.codex && harnesses.codex.configPath) {
    try {
      const res = configureCodex(harnesses.codex.configPath, urls, apiKey, dryRun, null, modelSpecs);
      results.push({ tool: 'OpenAI Codex CLI', ok: true, path: res.catalog || res.path });
    } catch (err) {
      results.push({ tool: 'OpenAI Codex CLI', ok: false, error: err.message });
    }
  }

  // 2. Hermes Agent
  if (harnesses.hermes && harnesses.hermes.configPath) {
    try {
      const res = configureHermes(harnesses.hermes.configPath, urls, apiKey, dryRun, modelSpecs);
      results.push({ tool: 'Hermes Agent', ok: true, path: res.path });
    } catch (err) {
      results.push({ tool: 'Hermes Agent', ok: false, error: err.message });
    }
  }

  // 3. OpenCode
  if (harnesses.opencode && harnesses.opencode.configPath) {
    try {
      const res = configureOpenCode(harnesses.opencode.configPath, urls, apiKey, dryRun, modelSpecs);
      results.push({ tool: 'OpenCode', ok: true, path: res.path });
    } catch (err) {
      results.push({ tool: 'OpenCode', ok: false, error: err.message });
    }
  }

  // 4. Open Design
  if (harnesses.opendesign && harnesses.opendesign.configPath) {
    try {
      const res = configureOpenDesign(harnesses.opendesign.configPath, urls, apiKey, dryRun, {}, modelSpecs);
      results.push({ tool: 'Open Design', ok: true, path: res.path });
    } catch (err) {
      results.push({ tool: 'Open Design', ok: false, error: err.message });
    }
  }

  // 5. Claude Code
  if (harnesses.claude && harnesses.claude.configPath) {
    try {
      const res = configureClaude(harnesses.claude.configPath, urls, apiKey, dryRun, modelSpecs);
      results.push({ tool: 'Claude Code', ok: true, path: res.path });
    } catch (err) {
      results.push({ tool: 'Claude Code', ok: false, error: err.message });
    }
  }

  // 6. Claude Desktop
  if (harnesses.desktop && harnesses.desktop.configPath) {
    try {
      const res = configureClaudeDesktop(harnesses.desktop.configPath, urls, apiKey, dryRun, null, modelSpecs);
      results.push({ tool: 'Claude Desktop', ok: true, path: res.path });
    } catch (err) {
      results.push({ tool: 'Claude Desktop', ok: false, error: err.message });
    }
  }

  return results;
}

/**
 * Main Live Model Synchronization Runner
 */
export async function runSyncModels(options = {}) {
  console.log(`${colors.bold}${colors.cyan}=== GhostCLI Live Model Synchronization ===${colors.reset}\n`);

  const detectedKey = options.key || detectExistingKey();
  if (!detectedKey) {
    console.error(`${colors.red}Error: No GhostCLI API Key found on system. Run 'gc-helper setup' or provide --key <gcli_...>.${colors.reset}\n`);
    return { ok: false, error: 'No API key' };
  }

  const harnesses = detectHarnesses();
  const detectedUrl = options.url || 'https://ghostcli.cloud';
  const urls = normalizeUrls(detectedUrl);

  console.log(`Probing GhostCLI Models API: ${colors.yellow}${urls.modelsUrl}${colors.reset}...`);

  let rawModelsList = [];
  try {
    const res = await fetch(urls.modelsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${detectedKey.trim()}`,
        'x-api-key': detectedKey.trim(),
        'Accept': 'application/json',
        'User-Agent': 'gc-helper/1.0.0'
      },
      signal: AbortSignal.timeout(options.timeoutMs || 10000)
    });

    if (!res.ok) {
      console.log(`${colors.yellow}Notice: Endpoint returned HTTP ${res.status}. Checking local cached catalog...${colors.reset}\n`);
      const cached = readModelsCache();
      if (cached && Array.isArray(cached.models) && cached.models.length > 0) {
        console.log(`${colors.green}Using local cached models from ~/.gc-helper/models.json (${cached.models.length} models).${colors.reset}\n`);
        rawModelsList = cached.models;
      } else {
        console.error(`${colors.red}Error: Could not retrieve models from endpoint and no local cache exists.${colors.reset}\n`);
        return { ok: false, error: `HTTP ${res.status}` };
      }
    } else {
      const data = await res.json();
      rawModelsList = [
        ...(Array.isArray(data.data) ? data.data : []),
        ...(Array.isArray(data.models) ? data.models : [])
      ];
      console.log(`${colors.green}✔ Discovered ${rawModelsList.length} candidate model entries from endpoint.${colors.reset}\n`);
    }
  } catch (err) {
    console.log(`${colors.yellow}Notice: Could not reach remote models API (${err.message}). Checking local cached catalog...${colors.reset}\n`);
    const cached = readModelsCache();
    if (cached && Array.isArray(cached.models) && cached.models.length > 0) {
      console.log(`${colors.green}Using local cached models from ~/.gc-helper/models.json (${cached.models.length} models).${colors.reset}\n`);
      rawModelsList = cached.models;
    } else {
      console.error(`${colors.red}Error: Remote probe failed and no local models cache exists.${colors.reset}\n`);
      return { ok: false, error: err.message };
    }
  }

  // Live health check
  console.log(`Checking live health of discovered models...`);
  const health = await checkModelsHealth(urls.baseUrl, detectedKey, rawModelsList, options.timeoutMs || 8000);

  if (health.deadModels.length > 0) {
    console.log(`${colors.yellow}⚠ Filtered out ${health.deadModels.length} unresponsive model(s): ${health.deadModels.join(', ')}${colors.reset}\n`);
  } else if (health.testedCount > 0) {
    console.log(`${colors.green}✔ All ${health.liveModels.length} tested models are active and responsive!${colors.reset}\n`);
  }

  const modelSpecs = resolveModelSpecs(health.liveModels);

  if (modelSpecs.length === 0) {
    console.log(`${colors.yellow}Warning: No active models discovered.${colors.reset}\n`);
    return { ok: false, error: 'No active models' };
  }

  // 1. Cache to ~/.gc-helper/models.json
  const cacheSaved = writeModelsCache(getDefaultModelsCachePath(), {
    updatedAt: new Date().toISOString(),
    endpoint: urls.baseUrl,
    total: modelSpecs.length,
    models: modelSpecs
  });
  if (cacheSaved) {
    console.log(`${colors.green}✔ Synchronized models catalog to ~/.gc-helper/models.json${colors.reset}`);
  }

  // 2. Sync to Heimdall if present (and not opted out)
  let heimdallRes = { synced: false };
  if (options.heimdall !== false) {
    heimdallRes = syncModelsToHeimdall(modelSpecs, options.dryRun);
    if (heimdallRes.synced) {
      console.log(`${colors.green}✔ Synchronized models catalog to Heimdall (${heimdallRes.path})${colors.reset}`);
    }
  }

  // 3. Sync to all detected AI Coding Harnesses
  console.log(`\nSynchronizing models across installed AI coding harnesses...`);
  const harnessRes = syncModelsToHarnesses(modelSpecs, harnesses, urls, detectedKey, options.dryRun);
  for (const hr of harnessRes) {
    if (hr.ok) {
      console.log(`  ${colors.green}✔ ${hr.tool}:${colors.reset} Catalog synchronized (${colors.dim}${hr.path}${colors.reset})`);
    } else {
      console.log(`  ${colors.red}✖ ${hr.tool}:${colors.reset} Failed to sync (${hr.error})`);
    }
  }

  // 4. Display available catalog
  console.log(`\n${colors.bold}Available Models Catalog (${modelSpecs.length} models):${colors.reset}`);
  for (const m of modelSpecs) {
    const idStr = `${colors.cyan}${m.id.padEnd(24)}${colors.reset}`;
    const ctxStr = `${colors.yellow}[${m.context}]${colors.reset}`;
    const descStr = m.description ? `${colors.dim}— ${m.description}${colors.reset}` : '';
    console.log(`  • ${idStr} ${ctxStr} ${descStr}`);
  }

  console.log(`\n${colors.green}${colors.bold}✔ Live Model Synchronization Completed Successfully!${colors.reset}\n`);
  return {
    ok: true,
    total: modelSpecs.length,
    models: modelSpecs,
    heimdallSynced: heimdallRes.synced,
    harnessesUpdated: harnessRes.filter(h => h.ok).length
  };
}
