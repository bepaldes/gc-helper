import fs from 'node:fs';
import path from 'node:path';

export function configureHermes(configPath, urls, apiKey, dryRun = false, models = null) {
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
  const uniqueModelEntries = [];
  const seenIds = new Set();
  const rawList = (Array.isArray(models) && models.length > 0)
    ? models
    : [
        { id: 'claude-opus-5-5', contextWindow: 1000000 },
        { id: 'claude-sonnet-5', contextWindow: 1000000 },
        { id: 'claude-fable-5.1', contextWindow: 1000000 },
        { id: 'gpt-6-astra', contextWindow: 1000000 }
      ];

  for (const m of rawList) {
    const baseId = (m.id || m.slug || m).replace(/\[1m\]$/i, '');
    const ctx = m.contextWindow || m.context_window_tokens || 1000000;
    if (!seenIds.has(baseId)) {
      seenIds.add(baseId);
      uniqueModelEntries.push(`      ${baseId}:\n        context_length: ${ctx}`);
    }
    const suffixedId = `${baseId}[1m]`;
    if (!seenIds.has(suffixedId)) {
      seenIds.add(suffixedId);
      uniqueModelEntries.push(`      ${suffixedId}:\n        context_length: ${ctx}`);
    }
  }

  const modelsBlock = `    models:\n${uniqueModelEntries.join('\n')}`;

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
      // Ensure base_url under ghostcli uses openaiUrl (https://ghostcli.cloud/v1)
      content = content.replace(/(ghostcli:\s*\r?\n(?:[ \t]+[^\r\n]+\r?\n)*?[ \t]*base_url:\s*)[^\r\n]+/m, `$1"${urls.openaiUrl}"`);

      // Upgrade any lower context_length values to 1000000
      content = content.replace(/^([ \t]*context_length:\s*)(\d+)/gm, (match, prefix, val) => {
        const num = Number(val);
        return num < 1000000 ? `${prefix}1000000` : match;
      });
      if (Array.isArray(models) && models.length > 0) {
        if (/^[ \t]*models:\s*$/m.test(content)) {
          content = content.replace(/^([ \t]*models:\s*\r?\n)(?:[ \t]+[^\r\n]+\r?\n)*/m, `${modelsBlock}\n`);
        } else {
          content = content.replace(/^([ \t]*ghostcli:.*)$/m, `$1\n${modelsBlock}`);
        }
      } else if (!/^[ \t]*context_length:/m.test(content)) {
        content = content.replace(/^([ \t]*ghostcli:.*)$/m, `$1\n${modelsBlock}`);
      }
    }
    // Update default model preserving leading spaces/tabs only
    if (/^[ \t]*default:/m.test(content)) {
      content = content.replace(/^([ \t]*)default:.*$/m, '$1default: "ghostcli/claude-opus-5-5"');
    }
    // Update root model section base_url if present and pointing to ghostcli
    content = content.replace(/(^[ \t]*model:\s*\r?\n(?:[ \t]+[^\r\n]+\r?\n)*?[ \t]*base_url:\s*)[^\r\n]+/m, `$1"${urls.openaiUrl}"`);

    // Ensure model aliases include glm and glm-flash if model_aliases section exists
    if (content.includes('model_aliases:')) {
      if (!content.includes('glm:')) {
        content = content.replace('model_aliases:', 'model_aliases:\n  glm:\n    model: "z-ai/glm-5.3[1m]"\n    provider: "ghostcli"');
      }
      if (!content.includes('glm-flash:')) {
        content = content.replace('model_aliases:', 'model_aliases:\n  glm-flash:\n    model: "z-ai/glm-5.3-flash[1m]"\n    provider: "ghostcli"');
      }
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
