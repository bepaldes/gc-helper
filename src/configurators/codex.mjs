import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_GHOSTCLI_MODELS = {
  models: [
    {
      slug: 'gpt-6-astra',
      display_name: 'GPT-6 Astra',
      provider: 'ghostcli',
      context_window: 1048576,
      max_output_tokens: 131072,
      supported_reasoning_efforts: [
        { level: 'low', description: 'Fast reasoning' },
        { level: 'medium', description: 'Balanced reasoning' },
        { level: 'high', description: 'Deep reasoning' },
        { level: 'xhigh', description: 'Maximum reasoning' }
      ],
      supported_in_api: true,
      apply_patch_tool_type: 'freeform',
      priority: 1
    },
    {
      slug: 'claude-sonnet-5',
      display_name: 'Claude Sonnet 5',
      provider: 'ghostcli',
      context_window: 262144,
      max_output_tokens: 131072,
      supported_reasoning_efforts: [
        { level: 'low', description: 'Fast reasoning' },
        { level: 'medium', description: 'Balanced reasoning' },
        { level: 'high', description: 'Deep reasoning' },
        { level: 'xhigh', description: 'Maximum reasoning' }
      ],
      supported_in_api: true,
      apply_patch_tool_type: 'freeform',
      priority: 2
    },
    {
      slug: 'claude-opus-5-5',
      display_name: 'Claude Opus 5.5',
      provider: 'ghostcli',
      context_window: 262144,
      max_output_tokens: 131072,
      supported_reasoning_efforts: [
        { level: 'low', description: 'Fast reasoning' },
        { level: 'medium', description: 'Balanced reasoning' },
        { level: 'high', description: 'Deep reasoning' },
        { level: 'xhigh', description: 'Maximum reasoning' }
      ],
      supported_in_api: true,
      apply_patch_tool_type: 'freeform',
      priority: 3
    },
    {
      slug: 'claude-fable-5.1',
      display_name: 'Claude Fable 5.1',
      provider: 'ghostcli',
      context_window: 262144,
      max_output_tokens: 131072,
      supported_reasoning_efforts: [
        { level: 'low', description: 'Fast reasoning' },
        { level: 'medium', description: 'Balanced reasoning' },
        { level: 'high', description: 'Deep reasoning' },
        { level: 'xhigh', description: 'Maximum reasoning' }
      ],
      supported_in_api: true,
      apply_patch_tool_type: 'freeform',
      priority: 4
    }
  ]
};

export function writeModelCatalog(catalogPath, catalogData = DEFAULT_GHOSTCLI_MODELS, dryRun = false) {
  if (dryRun) return catalogPath;
  const dir = path.dirname(catalogPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(catalogPath, JSON.stringify(catalogData, null, 2) + '\n');
  return catalogPath;
}

export function configureCodex(configPath, urls, apiKey, dryRun = false, catalogPath = null) {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir) && !dryRun) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const resolvedCatalogPath = catalogPath || path.join(dir, 'ghostcli-models.json');
  if (!dryRun) {
    writeModelCatalog(resolvedCatalogPath, DEFAULT_GHOSTCLI_MODELS, dryRun);
  }

  let content = '';
  if (fs.existsSync(configPath)) {
    content = fs.readFileSync(configPath, 'utf8');
    if (!dryRun) {
      fs.writeFileSync(`${configPath}.bak`, content);
    }
  }

  const formattedCatalog = resolvedCatalogPath.replaceAll('\\', '/');

  const tableIndex = content.search(/^\s*\[/m);
  let rootPart = tableIndex === -1 ? content : content.slice(0, tableIndex);
  let tablesPart = tableIndex === -1 ? '' : content.slice(tableIndex);

  rootPart = rootPart.replace(/^\s*base_url\s*=.*(\r?\n)?/gm, '');

  if (!/^\s*model\s*=/m.test(rootPart)) {
    rootPart = `model = "gpt-6-astra"\n` + rootPart;
  }

  if (/^\s*model_provider\s*=/m.test(rootPart)) {
    rootPart = rootPart.replace(/^\s*model_provider\s*=.*$/m, `model_provider = "ghostcli"`);
  } else {
    if (/^\s*model\s*=.*$/m.test(rootPart)) {
      rootPart = rootPart.replace(/^(\s*model\s*=.*)$/m, `$1\nmodel_provider = "ghostcli"`);
    } else {
      rootPart = `model_provider = "ghostcli"\n` + rootPart;
    }
  }

  if (/^\s*model_catalog_json\s*=/m.test(rootPart)) {
    rootPart = rootPart.replace(/^\s*model_catalog_json\s*=.*$/m, `model_catalog_json = "${formattedCatalog}"`);
  } else {
    if (/^\s*model_provider\s*=.*$/m.test(rootPart)) {
      rootPart = rootPart.replace(/^(\s*model_provider\s*=.*)$/m, `$1\nmodel_catalog_json = "${formattedCatalog}"`);
    } else {
      rootPart = `model_catalog_json = "${formattedCatalog}"\n` + rootPart;
    }
  }

  tablesPart = tablesPart.replace(/^\s*\[model_providers\.ghostcli\](?:\r?\n(?!\s*\[).*)*\r?\n?/m, '').trim();

  const ghostcliTable = `[model_providers.ghostcli]\nname = "GhostCLI"\nbase_url = "${urls.openaiUrl}"\nenv_key = "GHOSTCLI_API_KEY"\nwire_api = "responses"`;

  const cleanRoot = rootPart.trim();
  const cleanTables = tablesPart.trim();

  let finalContent = cleanRoot;
  if (cleanTables) {
    finalContent += `\n\n` + cleanTables;
  }
  finalContent += `\n\n` + ghostcliTable + `\n`;

  if (!dryRun) {
    fs.writeFileSync(configPath, finalContent);
  }

  return {
    tool: 'OpenAI Codex CLI',
    path: configPath,
    backup: fs.existsSync(`${configPath}.bak`) ? `${configPath}.bak` : null,
    catalog: resolvedCatalogPath,
    settings: {
      model_provider: 'ghostcli',
      base_url: urls.openaiUrl
    }
  };
}
