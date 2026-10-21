/**
 * GC-Helper — Automated Test Suite
 * Zero-dependency unit and integration assertions.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { normalizeUrls, probeEndpoint } from '../src/audit.mjs';
import { parseArgs } from '../src/cli.mjs';
import { configureClaude } from '../src/configurators/claude.mjs';
import { configureCodex } from '../src/configurators/codex.mjs';
import { configureHermes } from '../src/configurators/hermes.mjs';
import { configureOpenClaw } from '../src/configurators/openclaw.mjs';
import { configureOpenCode } from '../src/configurators/opencode.mjs';
import { configureOmp } from '../src/configurators/omp.mjs';

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
  assert(fs.existsSync(`${claudeFile}.bak`), 'Claude safety backup created');

  // Codex CLI
  const codexFile = path.join(tmpDir, 'codex-config.toml');
  fs.writeFileSync(codexFile, '# old config\nbase_url = "https://old.url"\n');
  configureCodex(codexFile, testUrls, testKey);
  const codexContent = fs.readFileSync(codexFile, 'utf8');
  assert(codexContent.includes('base_url = "https://ghostcli.cloud/v1"'), 'Codex base_url replaced');
  assert(codexContent.includes('model = "gpt-6-astra"'), 'Codex default model added');
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

} finally {
  // Cleanup tmpDir
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

console.log(`\n---------------------------------------`);
console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log(`✔ All tests passed successfully!`);
}
