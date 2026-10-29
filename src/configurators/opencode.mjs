import fs from 'node:fs';
import path from 'node:path';

export function configureOpenCode(configPath, urls, apiKey, dryRun = false, models = null) {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir) && !dryRun) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (!dryRun) {
        fs.writeFileSync(`${configPath}.bak`, JSON.stringify(config, null, 2));
      }
    } catch {
      config = {};
    }
  }

  const modelsMap = {};
  if (Array.isArray(models) && models.length > 0) {
    for (const m of models) {
      const id = m.id || m.slug || m;
      const ctx = Math.max(Number(m.contextWindow) || Number(m.context_window_tokens) || 0, 1048576);
      const maxOut = Math.max(Number(m.maxOutputTokens) || 0, 131072);
      modelsMap[id] = { context_window: ctx, max_tokens: maxOut };
    }
  } else {
    modelsMap['claude-opus-5-5'] = { context_window: 1048576, max_tokens: 131072 };
    modelsMap['claude-sonnet-5'] = { context_window: 1048576, max_tokens: 131072 };
    modelsMap['claude-fable-5.1'] = { context_window: 1048576, max_tokens: 131072 };
    modelsMap['gpt-6-astra'] = { context_window: 1048576, max_tokens: 131072 };
  }

  if (!config.providers) config.providers = {};
  config.providers.ghostcli = {
    type: 'openai',
    base_url: urls.openaiUrl,
    api_key: apiKey,
    context_window: 1048576,
    max_tokens: 131072,
    models: modelsMap
  };
  config.default_provider = 'ghostcli';

  if (!dryRun) {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  return {
    tool: 'OpenCode',
    path: configPath,
    backup: fs.existsSync(`${configPath}.bak`) ? `${configPath}.bak` : null,
    settings: {
      provider: 'ghostcli',
      base_url: urls.openaiUrl
    }
  };
}
