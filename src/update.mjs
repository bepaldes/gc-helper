/**
 * GC-Helper — Zero-Dependency Update Checker & Notifier
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { VERSION, PACKAGE_NAME } from './version.mjs';

/**
 * Compare two semver strings (e.g. "1.0.0" vs "1.0.1").
 * Returns true if `latest` is strictly newer than `current`.
 */
export function isNewerVersion(current, latest) {
  if (!current || !latest || typeof current !== 'string' || typeof latest !== 'string') {
    return false;
  }

  const clean = (v) => v.trim().replace(/^v/, '');
  const [cBase, cPre] = clean(current).split('-');
  const [lBase, lPre] = clean(latest).split('-');

  const cNums = cBase.split('.').map(n => parseInt(n, 10) || 0);
  const lNums = lBase.split('.').map(n => parseInt(n, 10) || 0);

  const maxLen = Math.max(cNums.length, lNums.length, 3);
  for (let i = 0; i < maxLen; i++) {
    const c = cNums[i] || 0;
    const l = lNums[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }

  // Base versions are equal; handle prerelease tags (e.g. 1.0.0-rc.1 is older than 1.0.0)
  if (cPre && !lPre) return true;
  if (!cPre && lPre) return false;
  if (cPre && lPre) return lPre.localeCompare(cPre) > 0;

  return false;
}

/**
 * Fetch latest version from npm registry.
 */
export async function fetchLatestVersion(packageName = PACKAGE_NAME, timeoutMs = 2000) {
  try {
    const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(timeoutMs)
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data && typeof data.version === 'string' ? data.version : null;
  } catch {
    return null;
  }
}

export function getDefaultCachePath() {
  return path.join(os.homedir(), '.gc-helper', 'update-check.json');
}

export function readCache(cacheFile) {
  try {
    if (!fs.existsSync(cacheFile)) return null;
    const raw = fs.readFileSync(cacheFile, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeCache(cacheFile, data) {
  try {
    const dir = path.dirname(cacheFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // Ignore cache write errors (e.g., read-only filesystem)
  }
}

/**
 * Check if update is available, using 24h cache to avoid network overhead.
 */
export async function checkUpdate(options = {}) {
  const packageName = options.packageName || PACKAGE_NAME;
  const currentVersion = options.currentVersion || VERSION;
  const cacheIntervalMs = options.cacheIntervalMs ?? (24 * 60 * 60 * 1000); // 24 hours
  const timeoutMs = options.timeoutMs ?? 2000;
  const cachePath = options.cachePath || getDefaultCachePath();
  const force = options.force ?? false;

  // Respect user opt-out & CI environments
  if (
    process.env.NO_UPDATE_NOTIFIER === '1' ||
    process.env.GC_NO_UPDATE_CHECK === '1' ||
    process.env.CI === 'true' ||
    process.env.CONTINUOUS_INTEGRATION === 'true'
  ) {
    return { hasUpdate: false, currentVersion, latestVersion: null };
  }

  const cache = readCache(cachePath);
  const now = Date.now();

  // If cache is fresh and not forced, use cached version
  if (!force && cache && typeof cache.lastChecked === 'number' && (now - cache.lastChecked) < cacheIntervalMs) {
    const latestVersion = cache.latestVersion;
    return {
      hasUpdate: isNewerVersion(currentVersion, latestVersion),
      currentVersion,
      latestVersion
    };
  }

  // Fetch latest from npm registry
  const fetchedVersion = await fetchLatestVersion(packageName, timeoutMs);

  if (fetchedVersion) {
    writeCache(cachePath, {
      lastChecked: now,
      latestVersion: fetchedVersion
    });
    return {
      hasUpdate: isNewerVersion(currentVersion, fetchedVersion),
      currentVersion,
      latestVersion: fetchedVersion
    };
  }

  // If fetch failed (offline, timeout, etc.), fallback to stale cache if present
  if (cache && cache.latestVersion) {
    return {
      hasUpdate: isNewerVersion(currentVersion, cache.latestVersion),
      currentVersion,
      latestVersion: cache.latestVersion
    };
  }

  return { hasUpdate: false, currentVersion, latestVersion: null };
}

/**
 * Formats a clean, prominent CLI update notification box.
 */
export function formatUpdateBox({ currentVersion, latestVersion, packageName = PACKAGE_NAME }) {
  const line1 = `Update available ${currentVersion} → ${latestVersion}`;
  const line2 = `Run npm install -g ${packageName} to update`;
  
  const innerWidth = Math.max(line1.length, line2.length) + 6;
  const borderTop = `┌${'─'.repeat(innerWidth)}┐`;
  const borderBottom = `└${'─'.repeat(innerWidth)}┘`;
  const emptyLine = `│${' '.repeat(innerWidth)}│`;

  const pad1 = ' '.repeat(innerWidth - 3 - line1.length);
  const pad2 = ' '.repeat(innerWidth - 3 - line2.length);

  return [
    `\x1b[33m${borderTop}\x1b[0m`,
    `\x1b[33m${emptyLine}\x1b[0m`,
    `\x1b[33m│\x1b[0m   Update available \x1b[90m${currentVersion}\x1b[0m → \x1b[32m\x1b[1m${latestVersion}\x1b[0m${pad1}\x1b[33m│\x1b[0m`,
    `\x1b[33m│\x1b[0m   Run \x1b[36m\x1b[1mnpm install -g ${packageName}\x1b[0m to update${pad2}\x1b[33m│\x1b[0m`,
    `\x1b[33m${emptyLine}\x1b[0m`,
    `\x1b[33m${borderBottom}\x1b[0m`
  ].join('\n');
}

/**
 * Starts background update check and returns a notify handle.
 */
export function startUpdateNotifier(options = {}) {
  // Fire check asynchronously in background
  const checkPromise = checkUpdate(options).catch(() => null);

  return {
    checkPromise,
    notify: async () => {
      try {
        const result = await checkPromise;
        if (result && result.hasUpdate && result.latestVersion) {
          console.log('\n' + formatUpdateBox({
            currentVersion: result.currentVersion,
            latestVersion: result.latestVersion,
            packageName: options.packageName || PACKAGE_NAME
          }) + '\n');
        }
      } catch {
        // Silently ignore notification errors
      }
    }
  };
}
