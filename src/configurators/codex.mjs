import fs from 'node:fs';
import path from 'node:path';

const BASE_INSTRUCTIONS = 'You are a coding assistant. Follow the client and user instructions. Inspect the relevant files, complete every requested requirement, use apply_patch for manual file changes, preserve unrelated work, and verify the result using available tools. Respect the client permissions and sandbox. Match tool and agent results by call ID. Report only actual verified outcomes. In patches, the first + or - is the diff prefix; every character after it is literal file content, including spaces.';

function buildCodexModelEntry(slug, displayName, priority, contextWindow = 1048576, maxOutputTokens = 131072) {
  return {
    slug,
    model: slug,
    display_name: displayName,
    description: `${displayName} through the GhostCLI API`,
    provider: 'ghostcli',
    context_window: contextWindow,
    max_context_window: contextWindow,
    max_output_tokens: maxOutputTokens,
    default_reasoning_level: 'high',
    supported_reasoning_levels: [
      { effort: 'low', description: 'Fast tool execution' },
      { effort: 'medium', description: 'Routine tasks' },
      { effort: 'high', description: 'Additional reasoning for complex tasks' },
      { effort: 'xhigh', description: 'Additional reasoning for difficult tasks' }
    ],
    supported_reasoning_efforts: [
      { level: 'low', description: 'Fast reasoning' },
      { level: 'medium', description: 'Balanced reasoning' },
      { level: 'high', description: 'Deep reasoning' },
      { level: 'xhigh', description: 'Maximum reasoning' }
    ],
    shell_type: 'unified_exec',
    visibility: 'list',
    supported_in_api: true,
    priority,
    minimal_client_version: [0, 0, 0],
    upgrade: null,
    availability_nux: null,
    base_instructions: BASE_INSTRUCTIONS,
    model_messages: {
      instructions_template: BASE_INSTRUCTIONS,
      instructions_variables: {},
      supports_reasoning_summaries: false,
      default_reasoning_summary: 'none',
      support_verbosity: false,
      default_verbosity: null,
      apply_patch_tool_type: 'freeform',
      truncation_policy: { mode: 'tokens', limit: 16000 },
      supports_parallel_tool_calls: true,
      supports_image_detail_original: false,
      context_window: contextWindow,
      max_context_window: contextWindow,
      experimental_supported_tools: [],
      input_modalities: ['text', 'image'],
      supports_search_tool: true,
      use_responses_lite: false
    },
    support_verbosity: false,
    default_verbosity: null,
    supports_reasoning_summary_parameter: false,
    default_reasoning_summary: 'none',
    apply_patch_tool_type: 'freeform',
    truncation_policy: { mode: 'tokens', limit: 16000 },
    supports_parallel_tool_calls: true,
    supports_image_detail_original: false,
    experimental_supported_tools: [],
    input_modalities: ['text', 'image'],
    supports_search_tool: true,
    prefer_websockets: false,
    use_responses_lite: false
  };
}

export const DEFAULT_GHOSTCLI_MODELS = {
  models: [
    buildCodexModelEntry('gpt-6-astra', 'GPT-6 Astra', 1),
    buildCodexModelEntry('claude-sonnet-5', 'Claude Sonnet 5', 2),
    buildCodexModelEntry('claude-opus-5-5', 'Claude Opus 5.5', 3),
    buildCodexModelEntry('claude-fable-5.1', 'Claude Fable 5.1', 4)
  ]
};

export function buildCatalogFromModelSpecs(modelSpecs = []) {
  if (!Array.isArray(modelSpecs) || modelSpecs.length === 0) {
    return DEFAULT_GHOSTCLI_MODELS;
  }
  const models = modelSpecs.map((spec, idx) => {
    const slug = spec.id || spec.slug;
    const name = spec.displayName || spec.display_name || slug;
    const ctx = Math.max(Number(spec.contextWindow) || Number(spec.context_window) || 0, 1048576);
    const maxOut = Math.max(Number(spec.maxOutputTokens) || Number(spec.max_output_tokens) || 0, 131072);
    return buildCodexModelEntry(slug, name, idx + 1, ctx, maxOut);
  });
  return { models };
}

export function maximizeCatalogContext(catalogData = DEFAULT_GHOSTCLI_MODELS) {
  const models = Array.isArray(catalogData?.models) ? catalogData.models : DEFAULT_GHOSTCLI_MODELS.models;
  const maximized = models
    .filter(m => m && typeof m.slug === 'string' && !/\[1m\]$/i.test(m.slug))
    .map((m, idx) => {
      const base = buildCodexModelEntry(m.slug, m.display_name || m.slug, m.priority ?? (idx + 1));
      const maxCtx = Math.max(
        Number(m.context_window) || 0,
        Number(m.max_context_window) || 0,
        Number(m.model_messages?.context_window) || 0,
        Number(m.model_messages?.max_context_window) || 0,
        1048576
      );
      const maxOut = Math.max(Number(m.max_output_tokens) || 0, 131072);
      return {
        ...base,
        ...m,
        context_window: maxCtx,
        max_context_window: maxCtx,
        max_output_tokens: maxOut,
        model_messages: {
          ...base.model_messages,
          ...(m.model_messages || {}),
          context_window: maxCtx,
          max_context_window: maxCtx
        }
      };
    });

  for (const def of DEFAULT_GHOSTCLI_MODELS.models) {
    if (!maximized.some(m => m.slug === def.slug)) {
      maximized.push(def);
    }
  }

  return { models: maximized };
}

export function writeModelCatalog(catalogPath, catalogData = DEFAULT_GHOSTCLI_MODELS, dryRun = false) {
  if (dryRun) return catalogPath;
  const dir = path.dirname(catalogPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  let sourceData = catalogData;
  if (fs.existsSync(catalogPath) && catalogData === DEFAULT_GHOSTCLI_MODELS) {
    try {
      const existing = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
      if (Array.isArray(existing?.models) && existing.models.length > 0) {
        sourceData = existing;
      }
    } catch {}
  }
  const normalized = maximizeCatalogContext(sourceData);
  fs.writeFileSync(catalogPath, JSON.stringify(normalized, null, 2) + '\n');
  return catalogPath;
}

export function configureCodex(configPath, urls, apiKey, dryRun = false, catalogPath = null, models = null) {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir) && !dryRun) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const resolvedCatalogPath = catalogPath || path.join(dir, 'ghostcli-models.json');
  if (!dryRun) {
    const catalogSource = models ? buildCatalogFromModelSpecs(models) : DEFAULT_GHOSTCLI_MODELS;
    writeModelCatalog(resolvedCatalogPath, catalogSource, dryRun);
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

  if (/^\s*model_context_window\s*=/m.test(rootPart)) {
    rootPart = rootPart.replace(/^\s*model_context_window\s*=.*$/m, `model_context_window = 1048576`);
  } else {
    if (/^\s*model_catalog_json\s*=.*$/m.test(rootPart)) {
      rootPart = rootPart.replace(/^(\s*model_catalog_json\s*=.*)$/m, `$1\nmodel_context_window = 1048576`);
    } else {
      rootPart = `model_context_window = 1048576\n` + rootPart;
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
