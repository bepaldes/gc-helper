import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

const userHome = os.homedir();
const isWin = process.platform === 'win32';

export function configureEnvironmentVariables(urls, apiKey, dryRun = false) {
  const vars = {
    ANTHROPIC_BASE_URL: urls.claudeUrl,
    ANTHROPIC_API_KEY: apiKey,
    OPENAI_BASE_URL: urls.openaiUrl,
    OPENAI_API_KEY: apiKey,
    GHOSTCLI_API_KEY: apiKey,
    CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY: '1'
  };

  const results = {
    platform: process.platform,
    applied: {},
    persistedTo: []
  };

  // Set in current Node process
  for (const [k, v] of Object.entries(vars)) {
    process.env[k] = v;
    results.applied[k] = k.includes('KEY') ? (v.slice(0, 8) + '...' + v.slice(-4)) : v;
  }

  if (dryRun) {
    results.persistedTo.push('Dry run: skipped writing persistent environment');
    return results;
  }

  if (isWin) {
    // Windows User Registry Scope (persists across all terminals, shells, and IDEs)
    for (const [k, v] of Object.entries(vars)) {
      try {
        const psCmd = `[System.Environment]::SetEnvironmentVariable('${k}', '${v}', 'User')`;
        execSync(`powershell -NoProfile -Command "${psCmd}"`, { stdio: 'ignore' });
      } catch {}
    }
    results.persistedTo.push('Windows User Environment Variables (Registry: HKCU\\Environment)');
  } else {
    // macOS / Linux: Update ~/.zshrc and ~/.bashrc
    const rcFiles = [
      path.join(userHome, '.zshrc'),
      path.join(userHome, '.bashrc')
    ];

    for (const rc of rcFiles) {
      if (fs.existsSync(rc) || rc.endsWith('.zshrc')) {
        try {
          let content = fs.existsSync(rc) ? fs.readFileSync(rc, 'utf8') : '';
          let modified = false;

          for (const [k, v] of Object.entries(vars)) {
            const regex = new RegExp(`^export\\s+${k}=.*$`, 'm');
            if (regex.test(content)) {
              content = content.replace(regex, `export ${k}="${v}"`);
              modified = true;
            } else {
              content += `\nexport ${k}="${v}"`;
              modified = true;
            }
          }

          if (modified) {
            fs.writeFileSync(rc, content.trim() + '\n');
            results.persistedTo.push(rc);
          }
        } catch {}
      }
    }
  }

  return results;
}
