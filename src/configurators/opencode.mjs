import fs from 'node:fs';
import path from 'node:path';

export function configureOpenCode(configPath, urls, apiKey, dryRun = false) {
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

  if (!config.providers) config.providers = {};
  config.providers.ghostcli = {
    type: 'openai',
    base_url: urls.openaiUrl,
    api_key: apiKey
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
