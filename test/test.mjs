/**
 * GC-Helper — Automated Test Suite
 * Zero-dependency unit and integration assertions.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { normalizeUrls, probeEndpoint, extractModelSpecs } from '../src/audit.mjs';
import { parseArgs } from '../src/cli.mjs';
import { isConfigured, detectConfiguredEndpoint, inspectHarnessContext, detectHeimdall } from '../src/detect.mjs';
import { resolveModelSpecs, writeModelsCache, readModelsCache, syncModelsToHeimdall, syncModelsToHarnesses, checkModelsHealth } from '../src/models.mjs';
import { configureClaude } from '../src/configurators/claude.mjs';
import { configureCodex } from '../src/configurators/codex.mjs';
import { configureHermes } from '../src/configurators/hermes.mjs';
import { configureOpenClaw } from '../src/configurators/openclaw.mjs';
import { configureOpenCode } from '../src/configurators/opencode.mjs';
import { configureOmp } from '../src/configurators/omp.mjs';
import { configureVsCode } from '../src/configurators/vscode.mjs';
import { configureClaudeDesktop } from '../src/configurators/desktop.mjs';
import { configureOpenDesign } from '../src/configurators/opendesign.mjs';
import { VERSION, PACKAGE_NAME } from '../src/version.mjs';
import { isNewerVersion, formatUpdateBox, readCache, writeCache, checkUpdate } from '../src/update.mjs';

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✔ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✖ FAIL: ${testName}`);
    failed++;
  }
}

console.log('--- Running GC-Helper Test Suite ---\n');

// 1. URL Normalization Tests
console.log('[Test Suite 1: URL Normalization]');
{
  const u1 = normalizeUrls('https://ghostcli.cloud');
  assert(u1.baseUrl === 'https://ghostcli.cloud', 'Root URL preserved');
  assert(u1.claudeUrl === 'https://ghostcli.cloud', 'Claude URL is root');
  assert(u1.openaiUrl === 'https://ghostcli.cloud/v1', 'OpenAI URL ends in /v1');
  assert(u1.modelsUrl === 'https://ghostcli.cloud/v1/models', 'Models URL ends in /v1/models');

  const u2 = normalizeUrls('https://ghostcli.cloud/');
  assert(u2.baseUrl === 'https://ghostcli.cloud', 'Trailing slash stripped');

  const u3 = normalizeUrls('https://ghostcli.cloud/v1');
  assert(u3.baseUrl === 'https://ghostcli.cloud', '/v1 suffix normalized to base');
  assert(u3.claudeUrl === 'https://ghostcli.cloud', 'Claude URL does not contain duplicate /v1');
  assert(u3.openaiUrl === 'https://ghostcli.cloud/v1', 'OpenAI URL stays /v1');

  const u4 = normalizeUrls('ghostcli.cloud');
  assert(u4.baseUrl === 'https://ghostcli.cloud', 'Missing protocol defaulted to https://');
}

// 2. Argument Parser Tests
console.log('\n[Test Suite 2: Argument Parsing]');
{
  const a1 = parseArgs([]);
  assert(a1.command === 'setup', 'Default command is setup');
  assert(a1.mode === 'both', 'Default mode is both');
  assert(a1.url === 'https://ghostcli.cloud', 'Default URL is https://ghostcli.cloud');
  assert(a1.yes === false, 'Default yes is false');

  const a2 = parseArgs(['audit', '--key', 'gcli_123', '--url', 'https://custom.api/v1', '--dry-run']);
  assert(a2.command === 'audit', 'Audit subcommand recognized');
  assert(a2.key === 'gcli_123', 'Key parsed');
  assert(a2.url === 'https://custom.api/v1', 'Custom URL parsed');
  assert(a2.dryRun === true, 'Dry run flag parsed');

  const a3 = parseArgs(['--tools', 'claude,codex', '--mode', 'env', '-y']);
  assert(a3.tools.length === 2 && a3.tools[0] === 'claude', 'Tools list parsed');
  assert(a3.mode === 'env', 'Mode parsed');
  assert(a3.yes === true, '-y short flag parsed');
}

// 3. Pre-Flight Validation Logic
console.log('\n[Test Suite 3: Pre-Flight Validation]');
{
  const p1 = await probeEndpoint('https://ghostcli.cloud', '');
  assert(p1.ok === false && p1.error.includes('empty'), 'Empty API key rejected without network request');

  const p2 = await probeEndpoint('https://ghostcli.cloud', '   ');
  assert(p2.ok === false, 'Whitespace API key rejected');
}

// 4. Configurator Adapters in Isolated Temp Directory
console.log('\n[Test Suite 4: Configurator Adapters & Backups]');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gc-helper-test-'));
const testUrls = normalizeUrls('https://ghostcli.cloud');
const testKey = 'gcli_test_secret_token_12345';

try {
  // Claude Code
  const claudeFile = path.join(tmpDir, 'claude-settings.json');
  fs.writeFileSync(claudeFile, JSON.stringify({ existingProp: true }));
  configureClaude(claudeFile, testUrls, testKey);
  const cData = JSON.parse(fs.readFileSync(claudeFile, 'utf8'));
  assert(cData.existingProp === true, 'Claude preserves existing config properties');
  assert(cData.env.ANTHROPIC_BASE_URL === 'https://ghostcli.cloud', 'Claude ANTHROPIC_BASE_URL updated');
  assert(cData.env.ANTHROPIC_API_KEY === testKey, 'Claude ANTHROPIC_API_KEY updated');
  assert(cData.env.CLAUDE_CODE_DISABLE_1M_CONTEXT === '0', 'Claude enables 1M context window (CLAUDE_CODE_DISABLE_1M_CONTEXT=0)');
  assert(cData.model === 'opus', 'Claude model defaults to opus');
  assert(cData.modelSettings['claude-sonnet-5']?.effortLevel === 'medium', 'Default claude-sonnet-5 configured');
  assert(cData.modelSettings['claude-opus-5-5']?.effortLevel === 'medium', 'Default claude-opus-5-5 configured');
  assert(fs.existsSync(`${claudeFile}.bak`), 'Claude safety backup created');

  // Claude Code modelSettings sanitization
  const claudeSanitizeFile = path.join(tmpDir, 'claude-sanitize.json');
  fs.writeFileSync(claudeSanitizeFile, JSON.stringify({
    model: 'claude-sonnet-5-5',
    modelSettings: {
      'claude-opus-5-5': { effortLevel: 'medium' },
      'claude-sonnet-5-5': { effortLevel: 'high' },
      'claude-fable-5-1': { effortLevel: 'xhigh' },
      'z-ai/glm-5.3': { effortLevel: 'low' },
      'glm-5.3': { effortLevel: 'low' }
    }
  }));
  configureClaude(claudeSanitizeFile, testUrls, testKey);
  const cSanitized = JSON.parse(fs.readFileSync(claudeSanitizeFile, 'utf8'));
  assert(cSanitized.model === 'opus', 'Claude model claude-sonnet-5-5 normalized to opus');
  assert(cSanitized.modelSettings['claude-sonnet-5']?.effortLevel === 'high', 'Claude migrates claude-sonnet-5-5 to claude-sonnet-5');
  assert(!cSanitized.modelSettings['claude-sonnet-5-5'], 'Claude deletes claude-sonnet-5-5 key');
  assert(cSanitized.modelSettings['claude-fable-5.1']?.effortLevel === 'xhigh', 'Claude normalizes claude-fable-5-1 to claude-fable-5.1');
  assert(!cSanitized.modelSettings['claude-fable-5-1'], 'Claude deletes claude-fable-5-1 key');
  assert(!cSanitized.modelSettings['z-ai/glm-5.3'] && !cSanitized.modelSettings['glm-5.3'], 'Claude removes GLM 5.3 keys');

  // Claude Code sonnet alias normalization
  const claudeSonnetFile = path.join(tmpDir, 'claude-sonnet.json');
  fs.writeFileSync(claudeSonnetFile, JSON.stringify({ model: 'sonnet' }));
  configureClaude(claudeSonnetFile, testUrls, testKey);
  const cSonnet = JSON.parse(fs.readFileSync(claudeSonnetFile, 'utf8'));
  assert(cSonnet.model === 'opus', 'Claude model sonnet normalized to opus');

  // Codex CLI
  const codexFile = path.join(tmpDir, 'codex-config.toml');
  const initialCodexConfig = `# old config
base_url = "https://old.url"

[features]
multi_agent = true

[projects.'c:\\apps\\demo']
trust_level = "trusted"
`;
  fs.writeFileSync(codexFile, initialCodexConfig);
  configureCodex(codexFile, testUrls, testKey);
  const codexContent = fs.readFileSync(codexFile, 'utf8');

  // Verify model and model_provider appear BEFORE [model_providers.ghostcli]
  const providerIdx = codexContent.indexOf('[model_providers.ghostcli]');
  const modelIdx = codexContent.indexOf('model = "gpt-6-astra"');
  const providerKeyIdx = codexContent.indexOf('model_provider = "ghostcli"');
  const catalogKeyIdx = codexContent.indexOf('model_catalog_json = ');

  assert(providerIdx !== -1, 'Codex [model_providers.ghostcli] table created');
  assert(modelIdx !== -1 && modelIdx < providerIdx, 'Codex model appears before [model_providers.ghostcli]');
  assert(providerKeyIdx !== -1 && providerKeyIdx < providerIdx, 'Codex model_provider appears before [model_providers.ghostcli]');
  assert(catalogKeyIdx !== -1 && catalogKeyIdx < providerIdx, 'Codex model_catalog_json appears before [model_providers.ghostcli]');

  // Verify [model_providers.ghostcli] table entries
  assert(codexContent.includes('name = "GhostCLI"'), 'Codex provider table has name = "GhostCLI"');
  assert(codexContent.includes('base_url = "https://ghostcli.cloud/v1"'), 'Codex provider table has base_url');
  assert(codexContent.includes('env_key = "GHOSTCLI_API_KEY"'), 'Codex provider table has env_key = "GHOSTCLI_API_KEY"');
  assert(codexContent.includes('wire_api = "responses"'), 'Codex provider table has wire_api = "responses"');

  // Verify existing custom tables are preserved
  assert(codexContent.includes('[features]') && codexContent.includes('multi_agent = true'), 'Codex preserves [features] table');
  assert(codexContent.includes("[projects.'c:\\apps\\demo']") && codexContent.includes('trust_level = "trusted"'), 'Codex preserves [projects] table');

  // Verify catalog file creation
  const expectedCatalog = path.join(tmpDir, 'ghostcli-models.json');
  assert(fs.existsSync(expectedCatalog), 'Codex ghostcli-models.json created');
  const catalogData = JSON.parse(fs.readFileSync(expectedCatalog, 'utf8'));
  assert(Array.isArray(catalogData.models) && catalogData.models.some(m => m.slug === 'gpt-6-astra'), 'Codex catalog contains gpt-6-astra');
  assert(!catalogData.models.some(m => m.slug === 'z-ai/glm-5.3'), 'Codex catalog excludes z-ai/glm-5.3');
  assert(catalogData.models.every(m => m.context_window >= 1000000 && m.max_context_window >= 1000000), 'Codex catalog sets all models to >= 1M context_window and max_context_window');
  assert(catalogData.models.every(m => m.model_messages?.context_window >= 1000000 && m.model_messages?.max_context_window >= 1000000), 'Codex catalog sets all model_messages to >= 1M context_window and max_context_window');
  assert(codexContent.includes('model_context_window = 1048576'), 'Codex config.toml sets model_context_window = 1048576');

  // Verify existing capped catalog models are upgraded to 1M
  const cappedCatalogPath = path.join(tmpDir, 'capped-models.json');
  fs.writeFileSync(cappedCatalogPath, JSON.stringify({
    models: [
      {
        slug: 'claude-opus-5-5',
        context_window: 256000,
        max_context_window: 256000,
        model_messages: { context_window: 256000, max_context_window: 256000 }
      }
    ]
  }));
  const codexUpgradeFile = path.join(tmpDir, 'codex-upgrade.toml');
  configureCodex(codexUpgradeFile, testUrls, testKey, false, cappedCatalogPath);
  const upgradedCatalog = JSON.parse(fs.readFileSync(cappedCatalogPath, 'utf8'));
  assert(upgradedCatalog.models.every(m => m.context_window >= 1000000 && m.max_context_window >= 1000000 && m.model_messages?.context_window >= 1000000), 'Codex upgrades existing 256K models in catalog to >= 1M');

  // Verify preservation of existing custom model
  const customModelFile = path.join(tmpDir, 'codex-custom.toml');
  fs.writeFileSync(customModelFile, 'model = "custom-override"\n');
  configureCodex(customModelFile, testUrls, testKey);
  const customContent = fs.readFileSync(customModelFile, 'utf8');
  assert(customContent.includes('model = "custom-override"'), 'Codex preserves existing custom model');
  assert(!customContent.includes('model = "gpt-6-astra"'), 'Codex does not override existing model');

  assert(fs.existsSync(`${codexFile}.bak`), 'Codex safety backup created');

  // Hermes Agent
  const hermesFile = path.join(tmpDir, 'hermes-config.yaml');
  configureHermes(hermesFile, testUrls, testKey);
  const hermesContent = fs.readFileSync(hermesFile, 'utf8');
  assert(hermesContent.includes('default: "ghostcli/claude-opus-5-5"'), 'Hermes default model set');
  assert(hermesContent.includes('ghostcli:'), 'Hermes provider block created');
  assert(hermesContent.includes(`base_url: "https://ghostcli.cloud/v1"`) || hermesContent.includes(`base_url: "https://ghostcli.cloud"`), 'Hermes base_url set');
  assert(hermesContent.includes('context_length: 1000000'), 'Hermes sets 1M context_length for models');

  // OpenClaw
  const clawFile = path.join(tmpDir, 'openclaw.json');
  configureOpenClaw(clawFile, testUrls, testKey);
  const clawData = JSON.parse(fs.readFileSync(clawFile, 'utf8'));
  assert(clawData.base_url === 'https://ghostcli.cloud/v1', 'OpenClaw base_url updated');
  assert(clawData.api_key === testKey, 'OpenClaw api_key set');
  assert(clawData.context_window >= 1000000, 'OpenClaw context_window set to >= 1M');

  // OpenCode
  const opencodeFile = path.join(tmpDir, 'opencode.json');
  configureOpenCode(opencodeFile, testUrls, testKey);
  const ocData = JSON.parse(fs.readFileSync(opencodeFile, 'utf8'));
  assert(ocData.providers.ghostcli.base_url === 'https://ghostcli.cloud/v1', 'OpenCode provider configured');
  assert(ocData.providers.ghostcli.context_window >= 1000000, 'OpenCode provider context_window set to >= 1M');

  // Oh My Pi (omp)
  const ompFile = path.join(tmpDir, 'omp.json');
  configureOmp(ompFile, testUrls, testKey);
  const ompData = JSON.parse(fs.readFileSync(ompFile, 'utf8'));
  assert(ompData.models.base_url === 'https://ghostcli.cloud/v1', 'Oh My Pi (omp) models.base_url updated');
  assert(ompData.models.context_window >= 1000000, 'Oh My Pi (omp) models.context_window set to >= 1M');

  // Visual Studio Code
  const vscodeFile = path.join(tmpDir, 'vscode-settings.json');
  fs.writeFileSync(vscodeFile, JSON.stringify({ "editor.tabSize": 2, "terminal.integrated.env.windows": { "EXISTING_VAR": "keep_me" } }));
  const vsRes = configureVsCode(vscodeFile, testUrls, testKey);
  const vsData = JSON.parse(fs.readFileSync(vscodeFile, 'utf8'));
  const envKey = process.platform === 'win32'
    ? 'terminal.integrated.env.windows'
    : (process.platform === 'darwin' ? 'terminal.integrated.env.osx' : 'terminal.integrated.env.linux');

  assert(vsData["editor.tabSize"] === 2, 'VS Code preserves existing editor settings');
  if (process.platform === 'win32') {
    assert(vsData[envKey].EXISTING_VAR === 'keep_me', 'VS Code preserves existing terminal env variables');
  }
  assert(vsData[envKey].ANTHROPIC_BASE_URL === 'https://ghostcli.cloud', 'VS Code terminal ANTHROPIC_BASE_URL configured');
  assert(vsData[envKey].OPENAI_BASE_URL === 'https://ghostcli.cloud/v1', 'VS Code terminal OPENAI_BASE_URL configured');
  assert(vsData[envKey].GHOSTCLI_API_KEY === testKey, 'VS Code terminal GHOSTCLI_API_KEY configured');
  assert(vsData[envKey].CLAUDE_CODE_DISABLE_1M_CONTEXT === '0', 'VS Code terminal enables 1M context window');
  assert(fs.existsSync(vsRes.backup), 'VS Code backup created');

  // Fresh file creation when settings.json does not exist
  const freshVsFile = path.join(tmpDir, 'new-user', 'settings.json');
  configureVsCode(freshVsFile, testUrls, testKey);
  assert(fs.existsSync(freshVsFile), 'VS Code creates fresh settings.json if non-existent');
  const freshData = JSON.parse(fs.readFileSync(freshVsFile, 'utf8'));
  assert(freshData[envKey].ANTHROPIC_BASE_URL === 'https://ghostcli.cloud', 'Fresh VS Code settings contains ANTHROPIC_BASE_URL');

  // Claude Desktop (3P Inference Mode & MCP Preservation)
  const desktop1pFile = path.join(tmpDir, 'claude_desktop_config.json');
  const desktop3pDir = path.join(tmpDir, 'Claude-3p');
  fs.writeFileSync(desktop1pFile, JSON.stringify({
    mcpServers: {
      context7: { command: "npx", args: ["-y", "@upstash/context7-mcp"] }
    }
  }, null, 2));

  const deskRes = configureClaudeDesktop(desktop1pFile, testUrls, testKey, false, desktop3pDir);
  assert(fs.existsSync(deskRes.backup), 'Claude Desktop 1P backup created');

  const desk1pData = JSON.parse(fs.readFileSync(desktop1pFile, 'utf8'));
  assert(desk1pData.deploymentMode === '3p', 'Claude Desktop 1P deploymentMode set to 3p');
  assert(desk1pData.mcpServers?.context7 !== undefined, 'Claude Desktop 1P mcpServers preserved');

  const desk3pFile = path.join(desktop3pDir, 'claude_desktop_config.json');
  assert(fs.existsSync(desk3pFile), 'Claude Desktop 3P config file created');
  const desk3pData = JSON.parse(fs.readFileSync(desk3pFile, 'utf8'));
  assert(desk3pData.deploymentMode === '3p', 'Claude Desktop 3P deploymentMode set to 3p');
  assert(desk3pData.mcpServers?.context7 !== undefined, 'Claude Desktop 3P mcpServers preserved');

  const metaFile = path.join(desktop3pDir, 'configLibrary', '_meta.json');
  assert(fs.existsSync(metaFile), 'Claude Desktop 3P _meta.json created');
  const metaData = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  assert(metaData.appliedId === '00000000-0000-4000-8000-000000000001', 'Claude Desktop 3P appliedId matches profile UUID');

  const profileFile = path.join(desktop3pDir, 'configLibrary', `${metaData.appliedId}.json`);
  assert(fs.existsSync(profileFile), 'Claude Desktop 3P UUID profile created');
  const profileData = JSON.parse(fs.readFileSync(profileFile, 'utf8'));
  assert(profileData.inferenceProvider === 'gateway', 'Claude Desktop 3P provider is gateway');
  assert(profileData.inferenceGatewayBaseUrl === 'https://ghostcli.cloud', 'Claude Desktop 3P Base URL set');
  assert(profileData.inferenceGatewayApiKey === testKey, 'Claude Desktop 3P API Key set');
  assert(profileData.inferenceGatewayAuthScheme === 'bearer', 'Claude Desktop 3P auth scheme is bearer');
  assert(profileData.modelDiscoveryEnabled === true, 'Claude Desktop 3P modelDiscoveryEnabled is true');
  assert(profileData.maxContextWindow >= 1000000, 'Claude Desktop 3P maxContextWindow set to >= 1M');

  // Context window inspection checks
  const claudeCtxCheck = inspectHarnessContext('claude', claudeFile);
  assert(claudeCtxCheck.ok === true, 'inspectHarnessContext confirms Claude Code 1M context is enabled');

  const codexCtxCheck = inspectHarnessContext('codex', codexFile);
  assert(codexCtxCheck.ok === true, 'inspectHarnessContext confirms Codex CLI all models are at 1M context');

  const cappedCodexToml = path.join(tmpDir, 'capped-check.toml');
  const cappedJson = path.join(tmpDir, 'capped-check-models.json');
  fs.writeFileSync(cappedJson, JSON.stringify({
    models: [{ slug: 'claude-opus-5-5', context_window: 256000, max_context_window: 256000 }]
  }));
  fs.writeFileSync(cappedCodexToml, `model_catalog_json = "${cappedJson.replaceAll('\\', '/')}"\n`);
  const cappedCheck = inspectHarnessContext('codex', cappedCodexToml);
  assert(cappedCheck.ok === false, 'inspectHarnessContext detects capped 256K models in Codex catalog');

  // extractModelSpecs resolution across data[] and models[] and filtering offline models
  const specs = extractModelSpecs({
    models: [
      { slug: 'claude-opus-5-5', display_name: 'Claude Opus 5.5', context_window: 256000, max_context_window: 256000 },
      { slug: 'z-ai/glm-5.3', display_name: 'GLM 5.3', context_window: 1000000, max_context_window: 1000000 }
    ],
    data: [
      { id: 'claude-opus-5-5', display_name: 'Claude Opus 5.5', context_window: 1000000, max_input_tokens: 1000000, max_output_tokens: 128000 },
      { id: 'z-ai/glm-5.3', display_name: 'GLM 5.3', context_window: 1000000, max_input_tokens: 1000000, max_output_tokens: 128000 }
    ]
  }, ['z-ai/glm-5.3']);
  assert(specs.length === 1 && specs[0].contextWindow === 1000000 && specs[0].maxOutputTokens === 128000, 'extractModelSpecs resolves highest context window and filters out offline z-ai/glm-5.3');

  const allLiveSpecs = extractModelSpecs({
    models: [
      { slug: 'claude-opus-5-5', display_name: 'Claude Opus 5.5', context_window: 256000, max_context_window: 256000 },
      { slug: 'z-ai/glm-5.3', display_name: 'GLM 5.3', context_window: 1000000, max_context_window: 1000000 }
    ]
  });
  assert(allLiveSpecs.length === 2 && allLiveSpecs.some(s => s.id === 'z-ai/glm-5.3'), 'extractModelSpecs preserves active models when live');
  assert(!hermesContent.includes('glm-5.3'), 'Hermes excludes offline z-ai/glm-5.3');
  assert(!ocData.providers.ghostcli.models['z-ai/glm-5.3'], 'OpenCode excludes offline z-ai/glm-5.3');
  assert(!profileData.inferenceModels.includes('z-ai/glm-5.3'), 'Claude Desktop 3P excludes offline z-ai/glm-5.3');

  // Open Design (Dual-Harness app-config.json + Simultaneous Claude & Astra model-routes.json)
  const openDesignFile = path.join(tmpDir, 'Open Design', 'namespaces', 'release-stable-win', 'data', 'app-config.json');
  const mmdRoutesFile = path.join(tmpDir, '.config', 'mms', 'model-routes.json');
  fs.mkdirSync(path.dirname(openDesignFile), { recursive: true });
  fs.writeFileSync(openDesignFile, JSON.stringify({
    agentId: 'amr',
    analyticsEnabled: false,
    notificationSound: 'staplebops-01',
    Followed: 'system'
  }, null, 2));

  const odRes = configureOpenDesign(openDesignFile, testUrls, testKey, false, { routesPath: mmdRoutesFile });
  assert(fs.existsSync(odRes.backup), 'Open Design app-config.json backup created');
  assert(fs.existsSync(mmdRoutesFile), 'Open Design MMD model-routes.json created');

  const odCfg = JSON.parse(fs.readFileSync(openDesignFile, 'utf8'));
  assert(odCfg.agentId === 'claude', 'Open Design promotes default amr agentId to claude');
  assert(odCfg.analyticsEnabled === false && odCfg.Followed === 'system', 'Open Design preserves existing user preferences');
  assert(odCfg.agentModels?.claude?.model === 'claude-opus-5-5', 'Open Design sets default claude model to claude-opus-5-5');
  assert(odCfg.agentModels?.codex?.model === 'gpt-6-astra' && odCfg.agentModels?.codex?.reasoning === 'high', 'Open Design sets default codex model to gpt-6-astra (high reasoning)');
  assert(odCfg.agentCliEnv?.claude?.ANTHROPIC_BASE_URL === 'https://ghostcli.cloud', 'Open Design sets claude ANTHROPIC_BASE_URL');
  assert(odCfg.agentCliEnv?.claude?.ANTHROPIC_AUTH_TOKEN === testKey, 'Open Design sets claude ANTHROPIC_AUTH_TOKEN');
  assert(odCfg.agentCliEnv?.claude?.ANTHROPIC_API_KEY === testKey, 'Open Design sets claude ANTHROPIC_API_KEY');
  assert(odCfg.agentCliEnv?.claude?.MMD_MODEL_ROUTES_FILE === mmdRoutesFile, 'Open Design links MMD_MODEL_ROUTES_FILE in claude env');
  assert(odCfg.agentCliEnv?.codex?.OPENAI_BASE_URL === 'https://ghostcli.cloud/v1', 'Open Design sets codex OPENAI_BASE_URL');
  assert(odCfg.agentCliEnv?.codex?.OPENAI_API_KEY === testKey && odCfg.agentCliEnv?.codex?.CODEX_API_KEY === testKey, 'Open Design sets codex API keys');
  assert(odCfg.agentCliEnvIntent?.claude?.apiKeyOverride === true && odCfg.agentCliEnvIntent?.codex?.apiKeyOverride === true, 'Open Design sets agentCliEnvIntent apiKeyOverride for claude and codex');

  // Strict schema compliance check against Open Design chunk-TYPDA7AG.mjs validator rules
  const allowedClaudeEnvKeys = new Set(['CLAUDE_CONFIG_DIR', 'CLAUDE_BIN', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'MMD_MODEL_ROUTES_FILE']);
  const allowedCodexEnvKeys = new Set(['CODEX_HOME', 'CODEX_BIN', 'OPENAI_BASE_URL', 'CODEX_API_KEY', 'OPENAI_API_KEY']);
  const allowedModelKeys = new Set(['model', 'reasoning', 'serviceTier']);
  assert(Object.keys(odCfg.agentCliEnv.claude).every(k => allowedClaudeEnvKeys.has(k)), 'Open Design claude env contains only schema-allowed keys');
  assert(Object.keys(odCfg.agentCliEnv.codex).every(k => allowedCodexEnvKeys.has(k)), 'Open Design codex env contains only schema-allowed keys');
  assert(Object.keys(odCfg.agentModels.claude).every(k => allowedModelKeys.has(k)), 'Open Design claude agentModels contains only schema-allowed keys');
  assert(Object.keys(odCfg.agentModels.codex).every(k => allowedModelKeys.has(k)), 'Open Design codex agentModels contains only schema-allowed keys');

  const routesCfg = JSON.parse(fs.readFileSync(mmdRoutesFile, 'utf8'));
  assert(routesCfg.routes?.['claude-opus-5-5']?.primary?.anthropic_base_url === 'https://ghostcli.cloud', 'MMD routes includes claude-opus-5-5');
  assert(routesCfg.routes?.['claude-sonnet-5']?.primary?.anthropic_base_url === 'https://ghostcli.cloud', 'MMD routes includes claude-sonnet-5');
  assert(routesCfg.routes?.['claude-fable-5.1']?.primary?.anthropic_base_url === 'https://ghostcli.cloud', 'MMD routes includes claude-fable-5.1');
  assert(routesCfg.routes?.['gpt-6-astra']?.primary?.anthropic_base_url === 'https://ghostcli.cloud', 'MMD routes includes gpt-6-astra simultaneously with Claude models');
  assert(!routesCfg.routes?.['z-ai/glm-5.3'], 'MMD routes excludes offline z-ai/glm-5.3');

  const odCtxCheck = inspectHarnessContext('opendesign', openDesignFile);
  assert(odCtxCheck.ok === true && odCtxCheck.detail.includes('Claude + Astra'), 'inspectHarnessContext confirms Open Design simultaneous Claude + Astra routing');

} finally {
  // Cleanup tmpDir
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// 5. Configured State & Management Hub Parsing Tests
console.log('\n[Test Suite 5: Configured Detection & Management Hub]');
{
  // parseArgs enhancements
  const pEmpty = parseArgs([]);
  assert(pEmpty.hasArgs === false, 'Empty args sets hasArgs to false');
  assert(pEmpty.reconfigure === false, 'Default reconfigure is false');

  const pStatus = parseArgs(['status']);
  assert(pStatus.command === 'audit', 'Subcommand status maps to audit');
  assert(pStatus.hasArgs === true, 'status sets hasArgs to true');

  const pSync = parseArgs(['sync']);
  assert(pSync.command === 'sync', 'Subcommand sync parsed');

  const pReconf = parseArgs(['setup', '--reconfigure']);
  assert(pReconf.reconfigure === true, '--reconfigure flag sets reconfigure true');

  const pForce = parseArgs(['--force']);
  assert(pForce.reconfigure === true, '--force flag sets reconfigure true');

  // isConfigured detection logic
  const mockHarnessesEmpty = {
    claude: { installed: false, configExists: false, currentEndpoint: null },
    codex: { installed: false, configExists: false, currentEndpoint: null }
  };
  assert(isConfigured(mockHarnessesEmpty, null) === false, 'isConfigured is false when key is null and no endpoints exist');
  assert(isConfigured(mockHarnessesEmpty, 'gcli_test123') === true, 'isConfigured is true when valid key exists');

  const mockHarnessesWithClaude = {
    claude: { installed: true, configExists: true, currentEndpoint: 'https://ghostcli.cloud' },
    codex: { installed: false, configExists: false, currentEndpoint: null }
  };
  assert(isConfigured(mockHarnessesWithClaude, null) === true, 'isConfigured is true when harness has configured endpoint even without explicit key');

  // detectConfiguredEndpoint
  const resolvedUrl = detectConfiguredEndpoint(mockHarnessesWithClaude, 'https://default.url', {});
  assert(resolvedUrl === 'https://ghostcli.cloud', 'detectConfiguredEndpoint extracts endpoint from harness config');

  const fallbackUrl = detectConfiguredEndpoint(mockHarnessesEmpty, 'https://default.url', {});
  assert(fallbackUrl === 'https://default.url', 'detectConfiguredEndpoint falls back when none configured');
}

// 6. Version & Update Notifier Tests
console.log('\n[Test Suite 6: Version & Update Notifier]');
{
  assert(VERSION === '1.1.0', 'Package version is 1.1.0');
  assert(PACKAGE_NAME === 'gc-helper', 'Package name is gc-helper');

  const pVShort = parseArgs(['-v']);
  assert(pVShort.version === true, '-v flag sets version true');

  const pVLong = parseArgs(['--version']);
  assert(pVLong.version === true, '--version flag sets version true');

  // Semver comparison
  assert(isNewerVersion('1.0.0', '1.0.1') === true, '1.0.1 is newer than 1.0.0');
  assert(isNewerVersion('1.0.0', '1.1.0') === true, '1.1.0 is newer than 1.0.0');
  assert(isNewerVersion('1.0.0', '2.0.0') === true, '2.0.0 is newer than 1.0.0');
  assert(isNewerVersion('1.0.0', '1.0.0') === false, '1.0.0 is not newer than 1.0.0');
  assert(isNewerVersion('1.1.0', '1.0.0') === false, '1.0.0 is not newer than 1.1.0');
  assert(isNewerVersion('2.0.0', '1.9.9') === false, '1.9.9 is not newer than 2.0.0');
  assert(isNewerVersion('v1.0.0', 'v1.0.1') === true, 'v-prefixed semver compares accurately');
  assert(isNewerVersion('1.0.0-rc.1', '1.0.0') === true, 'Release version is newer than prerelease');
  assert(isNewerVersion('1.0.0', '1.0.0-rc.1') === false, 'Prerelease is not newer than release');
  assert(isNewerVersion(null, '1.0.0') === false, 'Null current version returns false');
  assert(isNewerVersion('1.0.0', null) === false, 'Null latest version returns false');

  // Cache read/write
  const tempCacheDir = path.join(os.tmpdir(), `gc-helper-test-${Date.now()}`);
  const tempCacheFile = path.join(tempCacheDir, 'cache.json');
  try {
    writeCache(tempCacheFile, { lastChecked: 1000000, latestVersion: '1.2.0' });
    const cached = readCache(tempCacheFile);
    assert(cached !== null, 'Cache file written and read successfully');
    assert(cached.latestVersion === '1.2.0', 'Cache preserves latestVersion property');
    assert(cached.lastChecked === 1000000, 'Cache preserves lastChecked timestamp');
  } finally {
    if (fs.existsSync(tempCacheFile)) fs.unlinkSync(tempCacheFile);
    if (fs.existsSync(tempCacheDir)) fs.rmdirSync(tempCacheDir);
  }

  // Update box formatting
  const box = formatUpdateBox({ currentVersion: '1.0.0', latestVersion: '1.2.0', packageName: 'gc-helper' });
  assert(box.includes('Update available'), 'Update box contains header text');
  assert(box.includes('1.0.0') && box.includes('1.2.0'), 'Update box contains version transition');
  assert(box.includes('npm install -g gc-helper'), 'Update box contains update command');

  // checkUpdate with fresh cache
  const mockCacheDir = path.join(os.tmpdir(), `gc-mock-cache-${Date.now()}`);
  const mockCacheFile = path.join(mockCacheDir, 'cache.json');
  try {
    writeCache(mockCacheFile, { lastChecked: Date.now(), latestVersion: '1.5.0' });
    const res = await checkUpdate({
      cachePath: mockCacheFile,
      currentVersion: '1.0.0',
      cacheIntervalMs: 60000
    });
    assert(res.hasUpdate === true, 'checkUpdate detects update from fresh cache');
    assert(res.latestVersion === '1.5.0', 'checkUpdate returns cached latest version');

    // Opt-out test
    process.env.NO_UPDATE_NOTIFIER = '1';
    const optOutRes = await checkUpdate({ cachePath: mockCacheFile, currentVersion: '1.0.0' });
    assert(optOutRes.hasUpdate === false, 'NO_UPDATE_NOTIFIER environment variable disables update check');
    delete process.env.NO_UPDATE_NOTIFIER;
  } finally {
    if (fs.existsSync(mockCacheFile)) fs.unlinkSync(mockCacheFile);
    if (fs.existsSync(mockCacheDir)) fs.rmdirSync(mockCacheDir);
  }
}

// 7. Dynamic Model Synchronization & Heimdall Integration
console.log('\n[Test Suite 7: Dynamic Model Synchronization & Heimdall Integration]');
{
  // 1. Argument parsing for sync-models
  const sm1 = parseArgs(['sync-models']);
  assert(sm1.command === 'sync-models', 'Subcommand sync-models parsed');
  const sm2 = parseArgs(['--sync-models']);
  assert(sm2.command === 'sync-models', 'Flag --sync-models parsed as command');
  const sm3 = parseArgs(['syncmodels']);
  assert(sm3.command === 'sync-models', 'Alias syncmodels parsed');
  const sm4 = parseArgs(['sync-models', '--no-heimdall']);
  assert(sm4.heimdall === false, '--no-heimdall flag disables Heimdall sync');

  // 2. resolveModelSpecs
  const mockRemoteModels = [
    { slug: 'claude-opus-5-5', display_name: 'Claude Opus 5.5', context_window: 256000, max_context_window: 256000, description: 'Opus model' },
    { slug: 'claude-opus-5-5[1m]', display_name: 'Claude Opus 5.5 (1M)', context_window: 1000000, max_context_window: 1000000 },
    { slug: 'claude-sonnet-5', display_name: 'Claude Sonnet 5', context_window: 256000 },
    { slug: 'claude-sonnet-5[1m]', display_name: 'Claude Sonnet 5 (1M)', context_window: 1000000 },
    { slug: 'z-ai/glm-5.3', display_name: 'GLM 5.3', context_window: 1000000, description: 'Zhipu reasoning' },
    { slug: 'z-ai/glm-5.3-flash', display_name: 'GLM 5.3 Flash', context_window: 1000000, description: 'Fast code' },
    { slug: 'gpt-6-astra[1m]', display_name: 'GPT-6 Astra', context_window: 1000000, description: 'Long agentic' }
  ];

  const resolved = resolveModelSpecs(mockRemoteModels);
  assert(resolved.length === 5, 'resolveModelSpecs deduplicates [1m] suffixes');
  assert(resolved.every(m => m.contextWindow >= 1000000), 'All resolved models have >= 1M context');
  assert(resolved.some(m => m.id === 'z-ai/glm-5.3'), 'resolveModelSpecs includes z-ai/glm-5.3');
  assert(resolved.some(m => m.id === 'z-ai/glm-5.3-flash'), 'resolveModelSpecs includes z-ai/glm-5.3-flash');
  assert(resolved.some(m => m.id === 'gpt-6-astra'), 'resolveModelSpecs includes gpt-6-astra');

  // 3. Models cache read/write
  const testCachePath = path.join(tmpDir, 'test-models.json');
  const saved = writeModelsCache(testCachePath, { total: resolved.length, models: resolved });
  assert(saved === true, 'writeModelsCache writes successfully');
  const readBack = readModelsCache(testCachePath);
  assert(readBack && readBack.total === 5 && readBack.models.length === 5, 'readModelsCache retrieves catalog');

  // 4. Heimdall detection & sync
  const mockHeimdallDir = path.join(tmpDir, 'mock-heimdall');
  const mockHeimdallConfigDir = path.join(mockHeimdallDir, 'config');
  fs.mkdirSync(mockHeimdallConfigDir, { recursive: true });
  const mockHeimdallModelsFile = path.join(mockHeimdallConfigDir, 'models.json');
  fs.writeFileSync(mockHeimdallModelsFile, JSON.stringify({
    google: [{ id: 'gemini-4', displayName: 'Gemini 4' }],
    custom_proxies: [],
    ghostcli: []
  }, null, 2));

  const hSync = syncModelsToHeimdall(resolved, false, mockHeimdallDir);
  assert(hSync.synced === true, 'syncModelsToHeimdall synchronizes catalog');
  const updatedHModels = JSON.parse(fs.readFileSync(mockHeimdallModelsFile, 'utf8'));
  assert(updatedHModels.google.length === 1, 'syncModelsToHeimdall preserves existing google models');
  assert(updatedHModels.ghostcli.length === 5, 'syncModelsToHeimdall populates ghostcli models');
  assert(updatedHModels.custom_proxies.some(m => m.id === 'z-ai/glm-5.3'), 'syncModelsToHeimdall includes z-ai/glm-5.3 in custom_proxies');
  assert(updatedHModels.ghostcli.some(m => m.id === 'z-ai/glm-5.3-flash'), 'syncModelsToHeimdall includes z-ai/glm-5.3-flash in ghostcli');

  // Verify non-existent Heimdall does not fail or throw
  const missingHSync = syncModelsToHeimdall(resolved, false, path.join(tmpDir, 'non-existent-heimdall-dir'));
  assert(missingHSync.synced === false && missingHSync.reason === 'Heimdall not detected', 'syncModelsToHeimdall is purely optional and skips gracefully when Heimdall not present');

  // 5. Harness dynamic model synchronization
  const harnessSyncDir = path.join(tmpDir, 'harness-sync');
  fs.mkdirSync(harnessSyncDir, { recursive: true });

  const codexSyncFile = path.join(harnessSyncDir, 'codex-config.toml');
  const hermesSyncFile = path.join(harnessSyncDir, 'hermes-config.yaml');
  const openCodeSyncFile = path.join(harnessSyncDir, 'opencode-config.json');
  const claudeSyncFile = path.join(harnessSyncDir, 'claude-settings.json');

  const mockHarnesses = {
    codex: { configPath: codexSyncFile },
    hermes: { configPath: hermesSyncFile },
    opencode: { configPath: openCodeSyncFile },
    claude: { configPath: claudeSyncFile }
  };

  const syncResults = syncModelsToHarnesses(resolved, mockHarnesses, testUrls, testKey, false);
  assert(syncResults.every(r => r.ok), 'syncModelsToHarnesses updates all harnesses successfully');

  // Verify Codex synced models
  const codexCatalogFile = path.join(harnessSyncDir, 'ghostcli-models.json');
  assert(fs.existsSync(codexCatalogFile), 'Codex ghostcli-models.json created during sync');
  const codexCatalog = JSON.parse(fs.readFileSync(codexCatalogFile, 'utf8'));
  assert(codexCatalog.models.some(m => m.slug === 'z-ai/glm-5.3'), 'Codex synced catalog contains z-ai/glm-5.3');
  assert(codexCatalog.models.some(m => m.slug === 'z-ai/glm-5.3-flash'), 'Codex synced catalog contains z-ai/glm-5.3-flash');

  // Verify Hermes synced models
  const hermesYaml = fs.readFileSync(hermesSyncFile, 'utf8');
  assert(hermesYaml.includes('z-ai/glm-5.3:'), 'Hermes synced config includes z-ai/glm-5.3');
  assert(hermesYaml.includes('z-ai/glm-5.3-flash:'), 'Hermes synced config includes z-ai/glm-5.3-flash');

  // Verify OpenCode synced models
  const opencodeJson = JSON.parse(fs.readFileSync(openCodeSyncFile, 'utf8'));
  assert(opencodeJson.providers?.ghostcli?.models?.['z-ai/glm-5.3'], 'OpenCode synced config includes z-ai/glm-5.3');
  assert(opencodeJson.providers?.ghostcli?.models?.['z-ai/glm-5.3-flash'], 'OpenCode synced config includes z-ai/glm-5.3-flash');

  // Verify Claude Code synced models
  const claudeJson = JSON.parse(fs.readFileSync(claudeSyncFile, 'utf8'));
  assert(claudeJson.modelSettings?.['z-ai/glm-5.3'], 'Claude Code synced config includes z-ai/glm-5.3');
  assert(claudeJson.modelSettings?.['z-ai/glm-5.3-flash'], 'Claude Code synced config includes z-ai/glm-5.3-flash');
}

console.log(`\n---------------------------------------`);
console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log(`✔ All tests passed successfully!`);
}
