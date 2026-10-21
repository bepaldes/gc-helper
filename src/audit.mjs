/**
 * GC-Helper — Audit & Network Verification Engine
 * Validates GhostCLI API Keys, normalizes endpoint URLs, measures latency,
 * and parses remote model catalogs.
 */

export function normalizeUrls(rawUrl = 'https://ghostcli.cloud') {
  let trimmed = (rawUrl || 'https://ghostcli.cloud').trim().replace(/\/+$/, '');
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    trimmed = 'https://' + trimmed;
  }

  // Base domain / root URL
  let baseUrl = trimmed;
  if (baseUrl.endsWith('/v1')) {
    baseUrl = baseUrl.slice(0, -3);
  }

  return {
    raw: rawUrl,
    baseUrl: baseUrl,
    claudeUrl: baseUrl,              // Claude Code expects base URL without /v1
    openaiUrl: `${baseUrl}/v1`,       // Codex, OpenCode, OMP expect /v1
    modelsUrl: `${baseUrl}/v1/models` // Discovery catalog endpoint
  };
}

export async function probeEndpoint(rawUrl, apiKey, timeoutMs = 10000) {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
    return {
      ok: false,
      status: 0,
      latencyMs: 0,
      models: [],
      error: 'API key is empty. Please provide a valid GhostCLI key (e.g. gcli_...).'
    };
  }

  const cleanKey = apiKey.trim();
  const urls = normalizeUrls(rawUrl);
  const start = performance.now();

  try {
    const res = await fetch(urls.modelsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cleanKey}`,
        'x-api-key': cleanKey,
        'Accept': 'application/json',
        'User-Agent': 'gc-helper/1.0.0'
      },
      signal: AbortSignal.timeout(timeoutMs)
    });

    const latencyMs = Math.round(performance.now() - start);

    if (res.ok) {
      let data = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      const modelsList = data.data || data.models || [];
      const modelIds = modelsList.map(m => m.id || m.slug || m.name).filter(Boolean);

      return {
        ok: true,
        status: res.status,
        latencyMs,
        urls,
        models: modelIds,
        totalModels: modelIds.length,
        message: 'Endpoint reachable and authenticated.'
      };
    }

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        status: res.status,
        latencyMs,
        urls,
        models: [],
        error: `Authentication failed (HTTP ${res.status}): Invalid or expired API key. Verify your token at https://ghostcli.cloud/dashboard`
      };
    }

    if (res.status === 404) {
      return {
        ok: false,
        status: 404,
        latencyMs,
        urls,
        models: [],
        error: `Endpoint not found (HTTP 404): "${urls.modelsUrl}" does not exist. Check your Base URL.`
      };
    }

    return {
      ok: false,
      status: res.status,
      latencyMs,
      urls,
      models: [],
      error: `Server returned unexpected HTTP ${res.status} (${res.statusText || 'Error'}).`
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    let errMsg = err.message || 'Unknown network error';
    if (err.name === 'TimeoutError') {
      errMsg = `Request timed out after ${timeoutMs}ms. Check your network or firewall.`;
    }

    return {
      ok: false,
      status: 0,
      latencyMs,
      urls,
      models: [],
      error: `Connection failed: ${errMsg}`
    };
  }
}
