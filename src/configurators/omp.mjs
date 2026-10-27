import fs from 'node:fs';
import path from 'node:path';

export function configureOmp(configPath, urls, apiKey, dryRun = false) {
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

  if (!config.models) config.models = {};
  config.models.provider = 'openai-compatible';
  config.models.base_url = urls.openaiUrl;
  config.models.api_key = apiKey;
  config.models.context_window = Math.max(Number(config.models.context_window) || 0, 1048576);
  config.models.max_tokens = Math.max(Number(config.models.max_tokens) || 0, 131072);

  if (!dryRun) {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  return {
    tool: 'Oh My Pi (omp)',
    path: configPath,
    backup: fs.existsSync(`${configPath}.bak`) ? `${configPath}.bak` : null,
    settings: {
      provider: 'openai-compatible',
      base_url: urls.openaiUrl
    }
  };
}
