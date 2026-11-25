/**
 * GC-Helper — Deep Multi-Turn Model Health & Responsiveness Test Suite
 * Evaluates all models from GhostCLI API with a multi-question progression
 * to distinguish genuine responsive models from canned mocks or degraded endpoints.
 */

import { setDefaultResultOrder } from 'node:dns';
import { detectExistingKey, detectConfiguredEndpoint } from './detect.mjs';
import { normalizeUrls } from './audit.mjs';

setDefaultResultOrder('ipv4first');

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
  const cleanBase = endpoint.replace(/\/+$/, '').replace(/\/v1$/, '');
  const messagesUrl = `${cleanBase}/v1/messages`;

  const conversationHistory = [];
  const turnResults = [];
  let isAlive = true;
  let overallError = null;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    conversationHistory.push({ role: 'user', content: q.prompt });

    const turnStart = performance.now();
    let replyText = '';
    let httpStatus = 0;
    let turnOk = false;
    let turnReason = '';

    try {
      const res = await fetch(messagesUrl, {
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
        signal: AbortSignal.timeout(timeoutMs)
      });

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
    turnResults,
    error: overallError
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

  console.log(`Configuration:`);
  console.log(`  Endpoint:   ${colors.yellow}${urls.baseUrl}${colors.reset}`);
  console.log(`  API Key:    ${colors.green}${apiKey.slice(0, 8)}...${apiKey.slice(-4)}${colors.reset}`);
  console.log(`  Questions:  ${colors.bold}${turnsCount} progressive turns per model${colors.reset}`);
  console.log(`  Timeout:    ${timeoutMs}ms per turn\n`);

  // 1. Fetch live models catalog
  console.log(`Fetching model catalog from ${colors.yellow}${urls.modelsUrl}${colors.reset}...`);
  let modelIds = [];

  if (options.model) {
    modelIds = [options.model];
    console.log(`Targeting single specified model: ${colors.cyan}${options.model}${colors.reset}\n`);
  } else {
    try {
      const res = await fetch(urls.modelsUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'x-api-key': apiKey.trim(),
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!res.ok) {
        console.error(`${colors.red}Failed to fetch models from endpoint (HTTP ${res.status})${colors.reset}\n`);
        return { ok: false, error: `HTTP ${res.status}` };
      }

      const data = await res.json();
      const list = [
        ...(Array.isArray(data.data) ? data.data : []),
        ...(Array.isArray(data.models) ? data.models : [])
      ];

      modelIds = [...new Set(list.map(m => typeof m === 'string' ? m : (m.id || m.slug || m.name)).filter(Boolean))];
      console.log(`${colors.green}✔ Discovered ${modelIds.length} unique candidate models.${colors.reset}\n`);
    } catch (err) {
      console.error(`${colors.red}Error querying models catalog: ${err.message}${colors.reset}\n`);
      return { ok: false, error: err.message };
    }
  }

  if (modelIds.length === 0) {
    console.log(`${colors.yellow}No models found to test.${colors.reset}\n`);
    return { ok: false, error: 'Empty catalog' };
  }

  // 2. Iterate through each model
  console.log(`${colors.bold}Executing Multi-Turn Verification Loop:${colors.reset}\n`);
  const results = [];

  for (let idx = 0; idx < modelIds.length; idx++) {
    const modelId = modelIds[idx];
    process.stdout.write(`[${idx + 1}/${modelIds.length}] Testing ${colors.cyan}${colors.bold}${modelId.padEnd(24)}${colors.reset} `);

    const testResult = await testSingleModel(urls.baseUrl, apiKey, modelId, {
      timeoutMs,
      turns: turnsCount
    });

    results.push(testResult);

    // Render single-line status indicator
    if (testResult.statusCategory === 'HEALTHY') {
      console.log(`${colors.green}${colors.bold}✔ HEALTHY${colors.reset} (${testResult.passedTurns}/${testResult.totalTurns} passed, avg ${testResult.avgDurationMs}ms)`);
    } else if (testResult.statusCategory === 'DEGRADED') {
      console.log(`${colors.yellow}${colors.bold}⚠ DEGRADED${colors.reset} (${testResult.passedTurns}/${testResult.totalTurns} passed, avg ${testResult.avgDurationMs}ms)`);
    } else {
      console.log(`${colors.red}${colors.bold}✖ UNRESPONSIVE${colors.reset} (${testResult.turnResults[0]?.reason || 'Failed'})`);
    }

    // Detail turns if not 100% healthy
    for (const turn of testResult.turnResults) {
      const icon = turn.ok ? `${colors.green}✔${colors.reset}` : `${colors.red}✖${colors.reset}`;
      const preview = turn.reply ? `"${turn.reply.replace(/\s+/g, ' ').slice(0, 50)}"` : '';
      console.log(`    ${icon} Turn ${turn.turn}: ${turn.durationMs}ms — ${turn.reason} ${colors.dim}${preview}${colors.reset}`);
    }
    console.log('');
  }

  // 3. Final Executive Summary
  console.log(`${colors.bold}${colors.cyan}==================== SUMMARY REPORT ====================${colors.reset}\n`);
  const healthy = results.filter(r => r.statusCategory === 'HEALTHY');
  const degraded = results.filter(r => r.statusCategory === 'DEGRADED');
  const dead = results.filter(r => r.statusCategory === 'DEAD');

  console.log(`Total Tested:  ${results.length}`);
  console.log(`  ${colors.green}● Healthy:${colors.reset}    ${healthy.length} model(s) fully answered all ${turnsCount} questions`);
  console.log(`  ${colors.yellow}● Degraded:${colors.reset}   ${degraded.length} model(s) connected but had errors / proxy issues`);
  console.log(`  ${colors.red}● Dead/Timeout:${colors.reset} ${dead.length} model(s) failed or timed out`);
  console.log('');

  if (healthy.length > 0) {
    console.log(`${colors.green}${colors.bold}Recommended Active Models:${colors.reset}`);
    healthy.forEach(h => {
      console.log(`  • ${colors.bold}${h.modelId.padEnd(26)}${colors.reset} [Avg latency: ${h.avgDurationMs}ms]`);
    });
    console.log('');
  }

  return {
    ok: true,
    total: results.length,
    healthy: healthy.map(h => h.modelId),
    degraded: degraded.map(d => d.modelId),
    dead: dead.map(d => d.modelId),
    results
  };
}
