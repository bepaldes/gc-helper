import fs from 'node:fs';
import path from 'node:path';

export function configureOpenClaw(configPath, urls, apiKey, dryRun = false) {
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

  config.base_url = urls.openaiUrl;
  config.api_key = apiKey;
  if (!config.model) config.model = 'claude-sonnet-5';
  config.context_window = Math.max(Number(config.context_window) || 0, 1048576);
  config.max_output_tokens = Math.max(Number(config.max_output_tokens) || 0, 131072);

  if (!dryRun) {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  return {
    tool: 'OpenClaw',
    path: configPath,
    backup: fs.existsSync(`${configPath}.bak`) ? `${configPath}.bak` : null,
    settings: {
      base_url: urls.openaiUrl,
      model: config.model
    }
  };
}
