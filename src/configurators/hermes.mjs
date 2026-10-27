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
  const modelsBlock = `    models:
      claude-opus-5-5:
        context_length: 1000000
      claude-sonnet-5:
        context_length: 1000000
      claude-fable-5.1:
        context_length: 1000000
      gpt-6-astra:
        context_length: 1000000`;

  const ghostBlock = `
# GhostCLI Provider configuration added by gc-helper
default: "ghostcli/claude-opus-5-5"
model: "claude-opus-5-5"

providers:
  ghostcli:
    base_url: "${urls.openaiUrl}"
    api_key: "${apiKey}"
${modelsBlock}
`;

  // Repair any broken "\rdefault:" line lacking a newline
  content = content.replace(/([^\n])\r([ \t]*default:)/g, '$1\r\n  default:');

  if (content.includes('providers:')) {
    // If providers already exists, check if ghostcli is defined
    if (!content.includes('ghostcli:')) {
      content = content.replace('providers:', `providers:\n  ghostcli:\n    base_url: "${urls.openaiUrl}"\n    api_key: "${apiKey}"\n${modelsBlock}`);
    } else {
      // Upgrade any lower context_length values to 1000000
      content = content.replace(/^([ \t]*context_length:\s*)(\d+)/gm, (match, prefix, val) => {
        const num = Number(val);
        return num < 1000000 ? `${prefix}1000000` : match;
      });
      if (!/^[ \t]*context_length:/m.test(content)) {
        content = content.replace(/^([ \t]*ghostcli:.*)$/m, `$1\n${modelsBlock}`);
      }
    }
    // Update default model preserving leading spaces/tabs only
    if (/^[ \t]*default:/m.test(content)) {
      content = content.replace(/^([ \t]*)default:.*$/m, '$1default: "ghostcli/claude-opus-5-5"');
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
