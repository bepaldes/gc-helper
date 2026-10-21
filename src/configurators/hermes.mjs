import fs from 'node:fs';
import path from 'node:path';

export function configureHermes(configPath, urls, apiKey, dryRun = false) {
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

  // Update or append Hermes provider config
  const ghostBlock = `
# GhostCLI Provider configuration added by gc-helper
default: "ghostcli/claude-opus-5-5"
model: "claude-opus-5-5"

providers:
  ghostcli:
    base_url: "${urls.openaiUrl}"
    api_key: "${apiKey}"
    models:
      - "claude-opus-5-5"
      - "claude-sonnet-5"
      - "claude-fable-5.1"
      - "gpt-6-astra"
      - "z-ai/glm-5.3"
`;

  if (content.includes('providers:')) {
    // If providers already exists, check if ghostcli is defined
    if (!content.includes('ghostcli:')) {
      content = content.replace('providers:', `providers:\n  ghostcli:\n    base_url: "${urls.openaiUrl}"\n    api_key: "${apiKey}"`);
    }
    // Update default model
    if (content.match(/^\s*default:/m)) {
      content = content.replace(/^\s*default:.*$/m, 'default: "ghostcli/claude-opus-5-5"');
    }
  } else {
    content = content.trim() + '\n' + ghostBlock.trim() + '\n';
  }

  if (!dryRun) {
    fs.writeFileSync(configPath, content);
  }

  return {
    tool: 'Hermes Agent',
    path: configPath,
    backup: fs.existsSync(`${configPath}.bak`) ? `${configPath}.bak` : null,
    settings: {
      provider: 'ghostcli',
      endpoint: urls.openaiUrl
    }
  };
}
