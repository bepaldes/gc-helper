/**
 * GC-Helper — Network & IP Family Transport Helpers
 * Zero-dependency HTTP/HTTPS fetch wrapper supporting explicit IPv4, IPv6,
 * dual-stack (both), and auto (IPv4-first) resolution.
 */

import http from 'node:http';
import https from 'node:https';
import { setDefaultResultOrder } from 'node:dns';

setDefaultResultOrder('ipv4first');

/**
 * Normalizes CLI/option IP mode strings into 'auto' | 'ipv4' | 'ipv6' | 'both'.
 */
export function normalizeIpMode(raw) {
  if (raw === 4 || raw === '4') return 'ipv4';
  if (raw === 6 || raw === '6') return 'ipv6';
  const val = String(raw || 'auto').trim().toLowerCase();
  if (val === 'ipv4' || val === 'v4' || val === '4') return 'ipv4';
  if (val === 'ipv6' || val === 'v6' || val === '6') return 'ipv6';
  if (val === 'both' || val === 'dual' || val === 'all') return 'both';
  return 'auto';
}

/**
 * Resolves an IP mode into an ordered list of concrete test targets.
 */
export function resolveIpTargets(ipMode) {
  const mode = normalizeIpMode(ipMode);
  if (mode === 'both') return ['ipv4', 'ipv6'];
  return [mode];
}

/**
 * Maps an IP mode to a Node.js net/dns family number (4, 6, or null for auto).
 */
export function ipFamilyFromMode(ipMode) {
  const mode = normalizeIpMode(ipMode);
  if (mode === 'ipv4') return 4;
  if (mode === 'ipv6') return 6;
  return null;
}

/**
 * Formats an IP mode for human-readable CLI output.
 */
export function formatIpLabel(ipMode) {
  const mode = normalizeIpMode(ipMode);
  if (mode === 'ipv4') return 'IPv4';
  if (mode === 'ipv6') return 'IPv6';
  if (mode === 'both') return 'IPv4 + IPv6';
  return 'Auto (IPv4-first)';
}

function extractNetworkError(err, signal) {
  if (signal?.aborted) {
    const reason = signal.reason;
    if (reason instanceof Error) return reason;
    const abortErr = new Error(typeof reason === 'string' ? reason : 'The operation was aborted');
    abortErr.name = 'AbortError';
    return abortErr;
  }
  if (!err) return new Error('Unknown network error');
  if (err.message) return err;
  // Node.js AggregateError from dual-stack / Happy Eyeballs often has an empty .message
  const nested = Array.isArray(err.errors) && err.errors.length > 0 ? err.errors[0] : null;
  const detail = nested?.message || nested?.code || err.code || 'Connection failed';
  const wrapped = new Error(detail);
  wrapped.name = err.name || 'Error';
  wrapped.code = err.code || nested?.code;
  return wrapped;
}

function requestWithFamily(url, options, ipFamily, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (err) {
      reject(err);
      return;
    }

    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;
    const method = (options.method || 'GET').toUpperCase();
    const headers = { ...(options.headers || {}) };
    const hostname = parsed.hostname.startsWith('[') && parsed.hostname.endsWith(']')
      ? parsed.hostname.slice(1, -1)
      : parsed.hostname;

    const req = transport.request(
      {
        protocol: parsed.protocol,
        hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method,
        headers,
        family: ipFamily,
        signal: options.signal
      },
      (res) => {
        const status = res.statusCode || 0;
        const remoteAddress = res.socket?.remoteAddress || null;
        const remoteFamily = res.socket?.remoteFamily || null;

        if (
          redirectsLeft > 0 &&
          [301, 302, 303, 307, 308].includes(status) &&
          res.headers.location
        ) {
          res.resume();
          const nextUrl = new URL(res.headers.location, parsed).toString();
          const switchToGet = status === 301 || status === 302 || status === 303;
          const nextOptions = switchToGet
            ? { ...options, method: 'GET', body: undefined }
            : options;
          requestWithFamily(nextUrl, nextOptions, ipFamily, redirectsLeft - 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const bodyText = Buffer.concat(chunks).toString('utf8');
          resolve({
            ok: status >= 200 && status < 300,
            status,
            statusText: res.statusMessage || '',
            headers: res.headers,
            remoteAddress,
            remoteFamily,
            text: async () => bodyText,
            json: async () => JSON.parse(bodyText)
          });
        });
        res.on('error', (err) => reject(extractNetworkError(err, options.signal)));
      }
    );

    req.on('error', (err) => reject(extractNetworkError(err, options.signal)));

    if (options.body !== undefined && options.body !== null) {
      req.write(options.body);
    }
    req.end();
  });
}

/**
 * Fetches a URL using either standard global fetch (when ipFamily is null)
 * or node:http/node:https pinned to IPv4 (4) or IPv6 (6).
 */
export async function ipFetch(url, options = {}) {
  const { ipFamily: explicitFamily, ipMode, ...fetchOptions } = options;
  const ipFamily = explicitFamily ?? (ipMode ? ipFamilyFromMode(ipMode) : null);

  if (ipFamily !== 4 && ipFamily !== 6) {
    return globalThis.fetch(url, fetchOptions);
  }

  return requestWithFamily(url, fetchOptions, ipFamily);
}
