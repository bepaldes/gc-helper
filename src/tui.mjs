/**
 * GC-Helper — Zero-Dependency Interactive TUI Prompts
 * Provides arrow-key single-select, checkbox multi-select, confirm, and text input
 * with graceful readline fallback when running in non-TTY environments.
 */

import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

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

function isInteractiveTTY() {
  return Boolean(input.isTTY && output.isTTY && typeof input.setRawMode === 'function');
}

function clearRenderedLines(lineCount) {
  if (lineCount > 0) {
    output.write(`\x1b[${lineCount}A\x1b[J`);
  }
}

/**
 * Interactive single-select menu using arrow keys (or j/k, 1-9, Enter).
 */
export async function tuiSelect({ title, subtitle = '', options = [], defaultIndex = 0, cancelValue = null }) {
  if (!Array.isArray(options) || options.length === 0) {
    return cancelValue;
  }

  const safeDefault = Math.max(0, Math.min(defaultIndex, options.length - 1));

  if (!isInteractiveTTY()) {
    const rl = readline.createInterface({ input, output });
    try {
      if (title) console.log(`${colors.bold}${colors.cyan}${title}${colors.reset}`);
      if (subtitle) console.log(`${colors.dim}${subtitle}${colors.reset}`);
      options.forEach((opt, i) => {
        const hint = opt.hint ? ` ${colors.dim}[${opt.hint}]${colors.reset}` : '';
        console.log(`  ${i + 1}. ${opt.label}${hint}`);
      });
      const ans = await rl.question(`Choose an option [1-${options.length}, default: ${safeDefault + 1}]: `);
      const idx = parseInt(ans.trim(), 10) - 1;
      if (!Number.isNaN(idx) && idx >= 0 && idx < options.length) {
        return options[idx].value;
      }
      return options[safeDefault].value;
    } finally {
      rl.close();
    }
  }

  let cursor = safeDefault;
  let renderedLines = 0;

  const render = (finalized = false) => {
    clearRenderedLines(renderedLines);
    const lines = [];
    if (title) lines.push(`${colors.bold}${colors.cyan}${title}${colors.reset}`);
    if (subtitle) lines.push(`${colors.dim}${subtitle}${colors.reset}`);

    if (finalized) {
      const chosen = options[cursor];
      lines.push(`  ${colors.green}✔${colors.reset} ${colors.bold}${chosen.label}${colors.reset}`);
    } else {
      options.forEach((opt, i) => {
        const active = i === cursor;
        const pointer = active ? `${colors.cyan}${colors.bold}❯${colors.reset}` : ' ';
        const label = active ? `${colors.cyan}${colors.bold}${opt.label}${colors.reset}` : opt.label;
        const hint = opt.hint ? ` ${colors.dim}[${opt.hint}]${colors.reset}` : '';
        lines.push(`  ${pointer} ${label}${hint}`);
      });
      lines.push(`${colors.dim}  ↑/↓ move • Enter select • 1-${Math.min(9, options.length)} quick pick${colors.reset}`);
    }

    output.write(lines.join('\n') + '\n');
    renderedLines = lines.length;
  };

  return await new Promise((resolve) => {
    const wasRaw = input.isRaw;
    output.write('\x1b[?25l');
    input.setRawMode(true);
    input.resume();
    render(false);

    const cleanup = () => {
      input.removeListener('data', onData);
      if (typeof input.setRawMode === 'function') {
        input.setRawMode(Boolean(wasRaw));
      }
      input.pause();
      output.write('\x1b[?25h');
    };

    const onData = (buf) => {
      const key = buf.toString('utf8');

      // Ctrl+C
      if (key === '\x03') {
        cleanup();
        output.write('\n');
        process.exit(0);
      }

      // Enter
      if (key === '\r' || key === '\n') {
        render(true);
        cleanup();
        resolve(options[cursor].value);
        return;
      }

      // Esc or q
      if (key === '\x1b' || key === 'q') {
        if (cancelValue !== null) {
          clearRenderedLines(renderedLines);
          cleanup();
          resolve(cancelValue);
        }
        return;
      }

      // Up / k
      if (key === '\x1b[A' || key === '\x1bOA' || key === 'k') {
        cursor = (cursor - 1 + options.length) % options.length;
        render(false);
        return;
      }

      // Down / j
      if (key === '\x1b[B' || key === '\x1bOB' || key === 'j') {
        cursor = (cursor + 1) % options.length;
        render(false);
        return;
      }

      // Number shortcut 1-9
      if (/^[1-9]$/.test(key)) {
        const idx = parseInt(key, 10) - 1;
        if (idx < options.length) {
          cursor = idx;
          render(true);
          cleanup();
          resolve(options[cursor].value);
        }
      }
    };

    input.on('data', onData);
  });
}

/**
 * Interactive checkbox multi-select menu (Space to toggle, a all, d detected, n none, Enter confirm).
 */
export async function tuiMultiSelect({ title, subtitle = '', options = [] }) {
  if (!Array.isArray(options) || options.length === 0) {
    return [];
  }

  const state = options.map(opt => ({
    ...opt,
    checked: Boolean(opt.checked)
  }));

  if (!isInteractiveTTY()) {
    const rl = readline.createInterface({ input, output });
    try {
      if (title) console.log(`${colors.bold}${colors.cyan}${title}${colors.reset}`);
      if (subtitle) console.log(`${colors.dim}${subtitle}${colors.reset}`);
      state.forEach((opt, i) => {
        const mark = opt.checked ? `${colors.green}[✔]${colors.reset}` : `${colors.dim}[ ]${colors.reset}`;
        const hint = opt.hint ? ` ${colors.dim}${opt.hint}${colors.reset}` : '';
        console.log(`  ${i + 1}. ${mark} ${opt.label}${hint}`);
      });
      const ans = await rl.question(`Enter numbers/ids separated by comma, or press Enter to keep defaults: `);
      const trimmed = ans.trim();
      if (!trimmed) {
        return state.filter(o => o.checked).map(o => o.value);
      }
      const tokens = trimmed.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      const selected = new Set();
      for (const t of tokens) {
        const num = parseInt(t, 10);
        if (!Number.isNaN(num) && num >= 1 && num <= state.length) {
          selected.add(state[num - 1].value);
        } else {
          const match = state.find(o => o.value.toLowerCase() === t);
          if (match) selected.add(match.value);
        }
      }
      return Array.from(selected);
    } finally {
      rl.close();
    }
  }

  let cursor = 0;
  let renderedLines = 0;

  const render = (finalized = false) => {
    clearRenderedLines(renderedLines);
    const lines = [];
    if (title) lines.push(`${colors.bold}${colors.cyan}${title}${colors.reset}`);
    if (subtitle) lines.push(`${colors.dim}${subtitle}${colors.reset}`);

    if (finalized) {
      const chosen = state.filter(o => o.checked);
      const summary = chosen.length > 0 ? chosen.map(o => o.label).join(', ') : 'None';
      lines.push(`  ${colors.green}✔${colors.reset} Selected (${chosen.length}): ${colors.bold}${summary}${colors.reset}`);
    } else {
      state.forEach((opt, i) => {
        const active = i === cursor;
        const pointer = active ? `${colors.cyan}${colors.bold}❯${colors.reset}` : ' ';
        const box = opt.checked
          ? `${colors.green}[✔]${colors.reset}`
          : `${colors.dim}[ ]${colors.reset}`;
        const label = active
          ? `${colors.cyan}${colors.bold}${opt.label}${colors.reset}`
          : (opt.checked ? opt.label : `${colors.dim}${opt.label}${colors.reset}`);
        const hint = opt.hint ? ` ${opt.hint}` : '';
        lines.push(`  ${pointer} ${box} ${label}${hint}`);
      });
      lines.push(`${colors.dim}  ↑/↓ move • Space toggle • d detected • a all • n none • Enter confirm${colors.reset}`);
    }

    output.write(lines.join('\n') + '\n');
    renderedLines = lines.length;
  };

  return await new Promise((resolve) => {
    const wasRaw = input.isRaw;
    output.write('\x1b[?25l');
    input.setRawMode(true);
    input.resume();
    render(false);

    const cleanup = () => {
      input.removeListener('data', onData);
      if (typeof input.setRawMode === 'function') {
        input.setRawMode(Boolean(wasRaw));
      }
      input.pause();
      output.write('\x1b[?25h');
    };

    const onData = (buf) => {
      const key = buf.toString('utf8');

      if (key === '\x03') {
        cleanup();
        output.write('\n');
        process.exit(0);
      }

      if (key === '\r' || key === '\n') {
        render(true);
        cleanup();
        resolve(state.filter(o => o.checked).map(o => o.value));
        return;
      }

      if (key === '\x1b[A' || key === '\x1bOA' || key === 'k') {
        cursor = (cursor - 1 + state.length) % state.length;
        render(false);
        return;
      }

      if (key === '\x1b[B' || key === '\x1bOB' || key === 'j') {
        cursor = (cursor + 1) % state.length;
        render(false);
        return;
      }

      if (key === ' ') {
        state[cursor].checked = !state[cursor].checked;
        render(false);
        return;
      }

      if (key === 'a' || key === 'A') {
        const allChecked = state.every(o => o.checked);
        state.forEach(o => { o.checked = !allChecked; });
        render(false);
        return;
      }

      if (key === 'd' || key === 'D') {
        state.forEach(o => { o.checked = Boolean(o.detected); });
        render(false);
        return;
      }

      if (key === 'n' || key === 'N') {
        state.forEach(o => { o.checked = false; });
        render(false);
        return;
      }
    };

    input.on('data', onData);
  });
}

/**
 * Interactive yes/no confirmation prompt.
 */
export async function tuiConfirm({ title, defaultYes = true }) {
  const options = defaultYes
    ? [
        { value: true, label: 'Yes', hint: 'default' },
        { value: false, label: 'No' }
      ]
    : [
        { value: false, label: 'No', hint: 'default' },
        { value: true, label: 'Yes' }
      ];

  return await tuiSelect({ title, options, defaultIndex: 0 });
}

/**
 * Styled text input prompt with optional default value and validation.
 */
export async function tuiInput({ title, promptLabel, defaultValue = '', required = false, emptyError = 'Value cannot be empty.' }) {
  if (title) {
    console.log(`${colors.bold}${colors.cyan}${title}${colors.reset}`);
  }

  const rl = readline.createInterface({ input, output });
  try {
    while (true) {
      const suffix = defaultValue ? ` ${colors.dim}[default: ${defaultValue}]${colors.reset}` : '';
      const ans = await rl.question(`  ${colors.cyan}❯${colors.reset} ${promptLabel}${suffix}: `);
      const trimmed = ans.trim();
      if (trimmed) return trimmed;
      if (defaultValue && !required) return defaultValue;
      if (!required) return '';
      console.log(`  ${colors.red}✖ ${emptyError}${colors.reset}`);
    }
  } finally {
    rl.close();
  }
}
