/**
 * GC-Helper — Deep Multi-Turn Model Health & Responsiveness Test Suite
 * Evaluates all models from GhostCLI API with a multi-question progression
 * to distinguish genuine responsive models from canned mocks or degraded endpoints.
 */

import { ipFetch, ipFamilyFromMode, normalizeIpMode, resolveIpTargets, formatIpLabel } from './net.mjs';
import { detectExistingKey, detectConfiguredEndpoint } from './detect.mjs';
import { normalizeUrls } from './audit.mjs';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m'
};

const DEFAULT_QUESTIONS = [
  {
    prompt: 'What is 7 multiplied by 8? Reply with just the number.',
    validate: (ans) => /\b56\b/.test(ans),
    expectedHint: '56'
  },
  {
    prompt: 'Add 14 to that previous result. What is the total? Reply with just the number.',
    validate: (ans) => /\b70\b/.test(ans),
    expectedHint: '70 (56 + 14)'
  },
  {
    prompt: 'What is the capital of France? Reply with only the city name.',
    validate: (ans) => /paris/i.test(ans),
    expectedHint: 'Paris'
  }
];

// Upstream error or degradation phrases that proxy services might return with HTTP 200
const DEGRADED_PATTERNS = [
  /omitted.*conversation history/i,
  /upstream.*attachment service issue/i,
  /characters from the middle of this conversation were omitted/i,
  /cannot provide an accurate answer at this time/i,
  /rate limit exceeded/i,
  /capacity exceeded/i,
  /service unavailable/i
];

function extractTextResponse(data) {
  if (!data) return '';
  if (typeof data.content === 'string') return data.content;
  if (Array.isArray(data.content)) {
    // Anthropic response can contain { type: 'thinking' } and { type: 'text' }
    const textBlock = data.content.find(c => c && c.type === 'text');
    if (textBlock && typeof textBlock.text === 'string') {
      return textBlock.text;
    }
    // Fallback: any block with text
    for (const block of data.content) {
      if (block && typeof block.text === 'string') return block.text;
    }
  }
  // OpenAI format fallback
  if (data.choices && data.choices[0]?.message?.content) {
    return data.choices[0].message.content;
  }
  return '';
}

function checkForDegradation(text) {
  for (const pattern of DEGRADED_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

/**
 * Tests an individual model through a multi-turn conversation.
 */
export async function testSingleModel(endpoint, apiKey, modelId, options = {}) {
  const timeoutMs = options.timeoutMs || 25000;
  const questions = options.questions || DEFAULT_QUESTIONS.slice(0, options.turns || 3);
  const ipMode = normalizeIpMode(options.ipMode);
  const ipFamily = options.ipFamily ?? ipFamilyFromMode(ipMode);
  const cleanBase = endpoint.replace(/\/+$/, '').replace(/\/v1$/, '');
  const messagesUrl = `${cleanBase}/v1/messages`;

  const conversationHistory = [];
  const turnResults = [];
  let isAlive = true;
  let overallError = null;
  let remoteAddress = null;
  let remoteFamily = null;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    conversationHistory.push({ role: 'user', content: q.prompt });

    const turnStart = performance.now();
    let replyText = '';
    let httpStatus = 0;
    let turnOk = false;
    let turnReason = '';

    try {
      const res = await ipFetch(messagesUrl, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Authorization': `Bearer ${apiKey}`,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: modelId,
          max_tokens: 150,
          messages: conversationHistory
        }),
        ipFamily,
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (res.remoteAddress) remoteAddress = res.remoteAddress;
      if (res.remoteFamily) remoteFamily = res.remoteFamily;

      httpStatus = res.status;
      const turnDuration = Math.round(performance.now() - turnStart);

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        turnReason = `HTTP ${res.status}: ${errorText.slice(0, 100)}`;
        isAlive = false;
        turnResults.push({
          turn: i + 1,
          ok: false,
          status: httpStatus,
          durationMs: turnDuration,
          reply: errorText,
          reason: turnReason
        });
        break;
      }

      const data = await res.json();
      replyText = extractTextResponse(data).trim();

      const isDegraded = checkForDegradation(replyText);
      const passedValidation = q.validate ? q.validate(replyText) : replyText.length > 0;

      if (isDegraded) {
        turnOk = false;
        turnReason = 'Proxy degraded response (boilerplate context warning)';
      } else if (!passedValidation) {
        turnOk = false;
        turnReason = `Unexpected answer (expected ~${q.expectedHint}, got: "${replyText.slice(0, 60)}")`;
      } else {
        turnOk = true;
        turnReason = 'Correct response';
      }

      turnResults.push({
        turn: i + 1,
        ok: turnOk,
        status: httpStatus,
        durationMs: turnDuration,
        reply: replyText,
        reason: turnReason,
        isDegraded
      });

      // Keep assistant response in history for genuine multi-turn continuity
      conversationHistory.push({ role: 'assistant', content: replyText });

      if (isDegraded) {
        // Do not abort immediately, but continue to see if subsequent turns recover
      }

    } catch (err) {
      const turnDuration = Math.round(performance.now() - turnStart);
      const isTimeout = err.name === 'TimeoutError' || err.message?.includes('timeout') || err.message?.includes('aborted');
      turnReason = isTimeout ? `Timeout after ${timeoutMs}ms` : err.message;
      isAlive = false;
      overallError = turnReason;

      turnResults.push({
        turn: i + 1,
        ok: false,
        status: 0,
        durationMs: turnDuration,
        reply: '',
        reason: turnReason
      });
      break;
    }
  }

  const passedTurns = turnResults.filter(t => t.ok).length;
  const avgDuration = turnResults.length > 0
    ? Math.round(turnResults.reduce((acc, t) => acc + t.durationMs, 0) / turnResults.length)
    : 0;

  let statusCategory = 'DEAD';
  if (passedTurns === questions.length) {
    statusCategory = 'HEALTHY';
  } else if (passedTurns > 0 || turnResults.some(t => t.status === 200)) {
    statusCategory = 'DEGRADED';
  }

  return {
    modelId,
    statusCategory,
    passedTurns,
    totalTurns: questions.length,
    avgDurationMs: avgDuration,
    ipMode,
    ipFamily,
    remoteAddress,
    remoteFamily,
    turnResults,
    error: overallError
  };
}

/**
 * Deduplicates model catalog entries that share a base ID (e.g. `model` and `model[1m]`),
 * keeping only the entry with the highest context window (preferring `[1m]` on ties).
 */
export function deduplicateModelsByHighestContext(list = []) {
  if (!Array.isArray(list)) return [];
  const byBase = new Map();

  for (const m of list) {
    const rawId = typeof m === 'string' ? m : (m?.id || m?.slug || m?.model || m?.name);
    if (!rawId || typeof rawId !== 'string') continue;

    const baseId = rawId.replace(/\[1m\]$/i, '');
    const is1m = /\[1m\]$/i.test(rawId);
    let contextScore = 0;

    if (m && typeof m === 'object') {
      contextScore = Math.max(
        Number(m.context_window) || 0,
        Number(m.max_context_window) || 0,
        Number(m.max_input_tokens) || 0,
        Number(m.context_window_tokens) || 0,
        Number(m.model_messages?.context_window) || 0,
        Number(m.model_messages?.max_context_window) || 0
      );
    }
    if (is1m && contextScore < 1000000) {
      contextScore = 1000000;
    }

    const existing = byBase.get(baseId);
    if (!existing) {
      byBase.set(baseId, { rawId, contextScore, is1m });
    } else if (
      contextScore > existing.contextScore ||
      (contextScore === existing.contextScore && is1m && !existing.is1m)
    ) {
      byBase.set(baseId, { rawId, contextScore, is1m });
    }
  }

  return Array.from(byBase.values()).map(entry => entry.rawId);
}

async function runTestModelsPass(urls, apiKey, options, targetIpMode) {
  const timeoutMs = options.timeoutMs || 25000;
  const turnsCount = options.turns || 3;
  const ipFamily = ipFamilyFromMode(targetIpMode);
  const ipLabel = formatIpLabel(targetIpMode);

  console.log(`${colors.bold}Transport:${colors.reset}  ${colors.cyan}${ipLabel}${colors.reset}`);
  console.log(`Fetching model catalog from ${colors.yellow}${urls.modelsUrl}${colors.reset}...`);
  let modelIds = [];

  if (options.model) {
    modelIds = [options.model];
    console.log(`Targeting single specified model: ${colors.cyan}${options.model}${colors.reset}\n`);
  } else {
    try {
      const res = await ipFetch(urls.modelsUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'x-api-key': apiKey.trim(),
          'Accept': 'application/json'
        },
        ipFamily,
        signal: AbortSignal.timeout(10000)
      });

      if (!res.ok) {
        console.error(`${colors.red}Failed to fetch models from endpoint over ${ipLabel} (HTTP ${res.status})${colors.reset}\n`);
        return { ok: false, ipMode: targetIpMode, ipFamily, error: `HTTP ${res.status}`, total: 0, healthy: [], degraded: [], dead: [], results: [] };
      }

      const data = await res.json();
      const list = [
        ...(Array.isArray(data.data) ? data.data : []),
        ...(Array.isArray(data.models) ? data.models : [])
      ];

      modelIds = deduplicateModelsByHighestContext(list);
      const remoteHint = res.remoteAddress ? ` (${res.remoteAddress})` : '';
      console.log(`${colors.green}✔ Discovered ${modelIds.length} unique candidate models over ${ipLabel}${remoteHint}.${colors.reset}\n`);
    } catch (err) {
      console.error(`${colors.red}Error querying models catalog over ${ipLabel}: ${err.message}${colors.reset}\n`);
      return { ok: false, ipMode: targetIpMode, ipFamily, error: err.message, total: 0, healthy: [], degraded: [], dead: [], results: [] };
    }
  }

  if (modelIds.length === 0) {
    console.log(`${colors.yellow}No models found to test.${colors.reset}\n`);
    return { ok: false, ipMode: targetIpMode, ipFamily, error: 'Empty catalog', total: 0, healthy: [], degraded: [], dead: [], results: [] };
  }

  console.log(`${colors.bold}Executing Multi-Turn Verification Loop (${ipLabel}):${colors.reset}\n`);
  const results = [];

  for (let idx = 0; idx < modelIds.length; idx++) {
    const modelId = modelIds[idx];
    process.stdout.write(`[${idx + 1}/${modelIds.length}] Testing ${colors.cyan}${colors.bold}${modelId.padEnd(24)}${colors.reset} `);

    const testResult = await testSingleModel(urls.baseUrl, apiKey, modelId, {
      timeoutMs,
      turns: turnsCount,
      ipMode: targetIpMode,
      ipFamily
    });

    results.push(testResult);

    if (testResult.statusCategory === 'HEALTHY') {
      console.log(`${colors.green}${colors.bold}✔ HEALTHY${colors.reset} (${testResult.passedTurns}/${testResult.totalTurns} passed, avg ${testResult.avgDurationMs}ms)`);
    } else if (testResult.statusCategory === 'DEGRADED') {
      console.log(`${colors.yellow}${colors.bold}⚠ DEGRADED${colors.reset} (${testResult.passedTurns}/${testResult.totalTurns} passed, avg ${testResult.avgDurationMs}ms)`);
    } else {
      console.log(`${colors.red}${colors.bold}✖ UNRESPONSIVE${colors.reset} (${testResult.turnResults[0]?.reason || 'Failed'})`);
    }

    for (const turn of testResult.turnResults) {
      const icon = turn.ok ? `${colors.green}✔${colors.reset}` : `${colors.red}✖${colors.reset}`;
      const preview = turn.reply ? `"${turn.reply.replace(/\s+/g, ' ').slice(0, 50)}"` : '';
      console.log(`    ${icon} Turn ${turn.turn}: ${turn.durationMs}ms — ${turn.reason} ${colors.dim}${preview}${colors.reset}`);
    }
    console.log('');
  }

  console.log(`${colors.bold}${colors.cyan}==================== SUMMARY REPORT (${ipLabel}) ====================${colors.reset}\n`);
  const healthy = results.filter(r => r.statusCategory === 'HEALTHY');
  const degraded = results.filter(r => r.statusCategory === 'DEGRADED');
  const dead = results.filter(r => r.statusCategory === 'DEAD');

  console.log(`Total Tested:  ${results.length}`);
  console.log(`  ${colors.green}● Healthy:${colors.reset}    ${healthy.length} model(s) fully answered all ${turnsCount} questions`);
  console.log(`  ${colors.yellow}● Degraded:${colors.reset}   ${degraded.length} model(s) connected but had errors / proxy issues`);
  console.log(`  ${colors.red}● Dead/Timeout:${colors.reset} ${dead.length} model(s) failed or timed out`);
  console.log('');

  if (healthy.length > 0) {
    console.log(`${colors.green}${colors.bold}Recommended Active Models (${ipLabel}):${colors.reset}`);
    healthy.forEach(h => {
      console.log(`  • ${colors.bold}${h.modelId.padEnd(26)}${colors.reset} [Avg latency: ${h.avgDurationMs}ms]`);
    });
    console.log('');
  }

  return {
    ok: true,
    ipMode: targetIpMode,
    ipFamily,
    total: results.length,
    healthy: healthy.map(h => h.modelId),
    degraded: degraded.map(d => d.modelId),
    dead: dead.map(d => d.modelId),
    results
  };
}

/**
 * Probes all models discovered from the GhostCLI /v1/models catalog.
 */
export async function runTestAllModels(options = {}) {
  console.log(`\n${colors.bold}${colors.cyan}=== GhostCLI Deep Model Verification Suite ===${colors.reset}`);
  console.log(`${colors.dim}Testing live responsiveness, multi-turn reasoning, and proxy integrity${colors.reset}\n`);

  const apiKey = options.key || detectExistingKey();
  if (!apiKey) {
    console.error(`${colors.red}Error: No GhostCLI API Key detected. Pass --key or configure via gc-helper.${colors.reset}\n`);
    return { ok: false, error: 'Missing API key' };
  }

  const endpoint = options.url || detectConfiguredEndpoint(null, 'https://ghostcli.cloud');
  const urls = normalizeUrls(endpoint);
  const timeoutMs = options.timeoutMs || 25000;
  const turnsCount = options.turns || 3;
  const ipMode = normalizeIpMode(options.ipMode);
  const ipTargets = resolveIpTargets(ipMode);

  console.log(`Configuration:`);
  console.log(`  Endpoint:   ${colors.yellow}${urls.baseUrl}${colors.reset}`);
  console.log(`  API Key:    ${colors.green}${apiKey.slice(0, 8)}...${apiKey.slice(-4)}${colors.reset}`);
  console.log(`  IP Mode:    ${colors.cyan}${formatIpLabel(ipMode)}${colors.reset}`);
  console.log(`  Questions:  ${colors.bold}${turnsCount} progressive turns per model${colors.reset}`);
  console.log(`  Timeout:    ${timeoutMs}ms per turn\n`);

  if (ipTargets.length === 1) {
    return runTestModelsPass(urls, apiKey, options, ipTargets[0]);
  }

  const runs = {};
  for (const target of ipTargets) {
    console.log(`${colors.bold}${colors.magenta}--- Pass: ${formatIpLabel(target)} ---${colors.reset}`);
    runs[target] = await runTestModelsPass(urls, apiKey, options, target);
  }

  console.log(`${colors.bold}${colors.cyan}================ IPv4 vs IPv6 COMPARISON ================${colors.reset}\n`);
  for (const target of ipTargets) {
    const r = runs[target];
    const label = formatIpLabel(target).padEnd(6);
    if (r.ok) {
      console.log(`  ${colors.bold}${label}${colors.reset}: ${colors.green}${r.healthy.length} healthy${colors.reset}, ${colors.yellow}${r.degraded.length} degraded${colors.reset}, ${colors.red}${r.dead.length} dead${colors.reset} (total ${r.total})`);
    } else {
      console.log(`  ${colors.bold}${label}${colors.reset}: ${colors.red}✖ Failed (${r.error})${colors.reset}`);
    }
  }
  console.log('');

  const anyOk = ipTargets.some(t => runs[t]?.ok);
  const healthy = [...new Set(ipTargets.flatMap(t => runs[t]?.healthy || []))];
  const degraded = [...new Set(ipTargets.flatMap(t => runs[t]?.degraded || []))];
  const dead = [...new Set(ipTargets.flatMap(t => runs[t]?.dead || []))];

  return {
    ok: anyOk,
    ipMode: 'both',
    runs,
    total: Math.max(...ipTargets.map(t => runs[t]?.total || 0), 0),
    healthy,
    degraded,
    dead
  };
}
