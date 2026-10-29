import fs from 'node:fs';
import path from 'node:path';

export function configureClaude(configPath, urls, apiKey, dryRun = false, models = null) {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir) && !dryRun) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let settings = {};
  if (fs.existsSync(configPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (!dryRun) {
        fs.writeFileSync(`${configPath}.bak`, JSON.stringify(settings, null, 2));
      }
    } catch {
      settings = {};
    }
  }

  if (!settings.env) settings.env = {};
  settings.env.ANTHROPIC_BASE_URL = urls.claudeUrl;
  settings.env.ANTHROPIC_API_KEY = apiKey;
  settings.env.CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY = '1';
  settings.env.CLAUDE_CODE_DISABLE_1M_CONTEXT = '0';

  if (!settings.modelSettings || typeof settings.modelSettings !== 'object') {
    settings.modelSettings = {};
  }

  if (settings.modelSettings['claude-sonnet-5-5']) {
    settings.modelSettings['claude-sonnet-5'] = {
      ...settings.modelSettings['claude-sonnet-5'],
      ...settings.modelSettings['claude-sonnet-5-5']
    };
    delete settings.modelSettings['claude-sonnet-5-5'];
  }

  if (settings.modelSettings['claude-fable-5-1']) {
    settings.modelSettings['claude-fable-5.1'] = {
      ...settings.modelSettings['claude-fable-5.1'],
      ...settings.modelSettings['claude-fable-5-1']
    };
    delete settings.modelSettings['claude-fable-5-1'];
  }

  if (Array.isArray(models) && models.length > 0) {
    for (const m of models) {
      const id = m.id || m.slug || m;
      if (!settings.modelSettings[id]) {
        settings.modelSettings[id] = { effortLevel: 'medium' };
      }
    }
  } else {
    delete settings.modelSettings['z-ai/glm-5.3'];
    delete settings.modelSettings['glm-5.3'];
  }

  if (!settings.modelSettings['claude-sonnet-5']) {
    settings.modelSettings['claude-sonnet-5'] = { effortLevel: 'medium' };
  } else if (!settings.modelSettings['claude-sonnet-5'].effortLevel) {
    settings.modelSettings['claude-sonnet-5'].effortLevel = 'medium';
  }

  if (!settings.modelSettings['claude-opus-5-5']) {
    settings.modelSettings['claude-opus-5-5'] = { effortLevel: 'medium' };
  } else if (!settings.modelSettings['claude-opus-5-5'].effortLevel) {
    settings.modelSettings['claude-opus-5-5'].effortLevel = 'medium';
  }

  if (!settings.model || settings.model === 'claude-sonnet-5-5' || settings.model === 'sonnet') {
    settings.model = 'opus';
  }

  if (!dryRun) {
    fs.writeFileSync(configPath, JSON.stringify(settings, null, 2));
  }

  return {
    tool: 'Claude Code',
    path: configPath,
    backup: fs.existsSync(`${configPath}.bak`) ? `${configPath}.bak` : null,
    settings: {
      ANTHROPIC_BASE_URL: urls.claudeUrl,
      ANTHROPIC_API_KEY: apiKey.slice(0, 8) + '...' + apiKey.slice(-4)
    }
  };
}
