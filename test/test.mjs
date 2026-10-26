/**
 * GC-Helper — Automated Test Suite
 * Zero-dependency unit and integration assertions.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { normalizeUrls, probeEndpoint } from '../src/audit.mjs';
import { parseArgs } from '../src/cli.mjs';
import { isConfigured, detectConfiguredEndpoint } from '../src/detect.mjs';
import { configureClaude } from '../src/configurators/claude.mjs';
import { configureCodex } from '../src/configurators/codex.mjs';
import { configureHermes } from '../src/configurators/hermes.mjs';
import { configureOpenClaw } from '../src/configurators/openclaw.mjs';
import { configureOpenCode } from '../src/configurators/opencode.mjs';
import { configureOmp } from '../src/configurators/omp.mjs';
import { configureVsCode } from '../src/configurators/vscode.mjs';
import { configureClaudeDesktop } from '../src/configurators/desktop.mjs';

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
  assert(hermesContent.includes(`base_url: "https://ghostcli.cloud/v1"`), 'Hermes base_url set');

  // OpenClaw
  const clawFile = path.join(tmpDir, 'openclaw.json');
  configureOpenClaw(clawFile, testUrls, testKey);
  const clawData = JSON.parse(fs.readFileSync(clawFile, 'utf8'));
  assert(clawData.base_url === 'https://ghostcli.cloud/v1', 'OpenClaw base_url updated');
  assert(clawData.api_key === testKey, 'OpenClaw api_key set');

  // OpenCode
  const opencodeFile = path.join(tmpDir, 'opencode.json');
  configureOpenCode(opencodeFile, testUrls, testKey);
  const ocData = JSON.parse(fs.readFileSync(opencodeFile, 'utf8'));
  assert(ocData.providers.ghostcli.base_url === 'https://ghostcli.cloud/v1', 'OpenCode provider configured');

  // Oh My Pi (omp)
  const ompFile = path.join(tmpDir, 'omp.json');
  configureOmp(ompFile, testUrls, testKey);
  const ompData = JSON.parse(fs.readFileSync(ompFile, 'utf8'));
  assert(ompData.models.base_url === 'https://ghostcli.cloud/v1', 'Oh My Pi (omp) models.base_url updated');

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

console.log(`\n---------------------------------------`);
console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log(`✔ All tests passed successfully!`);
}
