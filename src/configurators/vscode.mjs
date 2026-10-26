import fs from 'node:fs';
import path from 'node:path';

export function configureVsCode(configPath, urls, apiKey, dryRun = false) {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir) && !dryRun) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let settings = {};
  let backupCreated = null;

  if (fs.existsSync(configPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (!dryRun) {
        backupCreated = `${configPath}.bak`;
        fs.writeFileSync(backupCreated, JSON.stringify(settings, null, 2));
      }
    } catch {
      settings = {};
    }
  }

  const envKey = process.platform === 'win32'
    ? 'terminal.integrated.env.windows'
    : (process.platform === 'darwin' ? 'terminal.integrated.env.osx' : 'terminal.integrated.env.linux');

  if (!settings[envKey] || typeof settings[envKey] !== 'object') {
    settings[envKey] = {};
  }

  settings[envKey].ANTHROPIC_BASE_URL = urls.baseUrl;
  settings[envKey].OPENAI_BASE_URL = urls.openaiUrl;
  settings[envKey].GHOSTCLI_API_KEY = apiKey;
  settings[envKey].ANTHROPIC_API_KEY = apiKey;

  if (!dryRun) {
    fs.writeFileSync(configPath, JSON.stringify(settings, null, 2));
  }

  return {
    tool: 'Visual Studio Code',
    path: configPath,
    backup: backupCreated || `${configPath}.bak`
  };
}
