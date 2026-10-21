import fs from 'node:fs';
import path from 'node:path';

export function configureCodex(configPath, urls, apiKey, dryRun = false) {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir) && !dryRun) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let content = '';
  if (fs.existsSync(configPath)) {
    content = fs.readFileSync(configPath, 'utf8');
    if (!dryRun) {
      fs.writeFileSync(`${configPath}.bak`, content);
    }
  }

  // Update base_url
  if (/base_url\s*=\s*"[^"]*"/.test(content)) {
    content = content.replace(/base_url\s*=\s*"[^"]*"/, `base_url = "${urls.openaiUrl}"`);
  } else if (/base_url\s*=\s*'[^']*'/.test(content)) {
    content = content.replace(/base_url\s*=\s*'[^']*'/, `base_url = "${urls.openaiUrl}"`);
  } else {
    content = `base_url = "${urls.openaiUrl}"\n` + content;
  }

  // Set default model if not set
  if (!/model\s*=/.test(content)) {
    content += `\nmodel = "gpt-6-astra"\n`;
  }

  if (!dryRun) {
    fs.writeFileSync(configPath, content.trim() + '\n');
  }

  return {
    tool: 'OpenAI Codex CLI',
    path: configPath,
    backup: fs.existsSync(`${configPath}.bak`) ? `${configPath}.bak` : null,
    settings: {
      base_url: urls.openaiUrl
    }
  };
}
