# GC-Helper (`gc-helper` / `gc`)

> **Interactive Auto-Configurator & Connection Auditor for AI Coding Harnesses** (Claude Code, OpenAI Codex CLI, Hermes Agent, OpenClaw, OpenCode, Oh My Pi `omp`, Visual Studio Code, Claude Desktop, and Open Design) connecting to [GhostCLI](https://ghostcli.cloud).

[![Node.js Version](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![Dependencies](https://img.shields.io/badge/dependencies-0%20(zero)-brightgreen.svg)](package.json)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue.svg)](README.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Language](https://img.shields.io/badge/Language-Portugu%C3%AAs%20(Brasil)-green.svg)](README.pt-BR.md)

---

🌐 **Language / Idioma:** [🇺🇸 English](README.md) | [🇧🇷 Versão em Português](README.pt-BR.md)

---

> [!NOTE]
> **Independent Community Tool**: `GC-Helper` (`gc-helper`) is an independent, community-driven open-source utility designed to simplify local environment configuration. It is **not** affiliated with, maintained, sponsored, or endorsed by the official GhostCLI website (`ghostcli.cloud`), GH DIGITAL LTDA, or its developers. This project is solely an independent configuration helper.

---

## What is GC-Helper?

[GhostCLI](https://ghostcli.cloud) provides unified, high-usage access to frontier coding models (such as `claude-opus-5-5`, `claude-sonnet-5`, `gpt-6-astra`, `z-ai/glm-5.3`) without per-token billing.

However, manually configuring each AI coding assistant requires editing fragmented JSON, TOML, and YAML files across different hidden directories, in addition to exporting shell environment variables.

**GC-Helper** is a lightweight, zero-dependency CLI utility that automates this entire setup in seconds with interactive guidance, safety backups, and live connection auditing. It provides both `gc-helper` and shorthand `gc` executable binaries.

---

## Key Features

* 🚀 **Zero Dependencies**: Pure modern Node.js (ESM). No bloated `node_modules` required.
* ⚡ **Dual CLI Binaries**: Provides both full `gc-helper` and convenient `gc` commands.
* 🔍 **Pre-Flight Network Audit**: Tests your API key (`gcli_...`) and Base URL against `https://ghostcli.cloud/v1/models` live before touching any files. Reports HTTP status, response latency, and available model counts.
* 🔄 **Interactive Retry Loop**: If a token or URL fails validation, cleanly prompts to re-enter credentials or adjust the endpoint.
* 🖥️ **Cross-Platform Auto-Detection**: Automatically detects installed AI coding harnesses across Windows, macOS, and Linux:
  * **Claude Code CLI** (`~/.claude/settings.json`)
  * **OpenAI Codex CLI** (`~/.codex/config.toml`)
  * **Hermes Agent (Nous Research)** (`%LOCALAPPDATA%\hermes\config.yaml` or `~/.hermes/config.yaml`)
  * **OpenClaw** (`~/.openclaw/openclaw.json`)
  * **OpenCode Interpreter / CLI** (`config.json`)
  * **Oh My Pi (`omp`)** (`~/.omp/config.json`)
  * **Visual Studio Code** (`Code/User/settings.json`)
  * **Claude Desktop App** (`Claude/claude_desktop_config.json` & `Claude-3p/`)
  * **Open Design** (`Open Design/namespaces/*/data/app-config.json` & `~/.config/mms/model-routes.json`)
* 🛡️ **Non-Destructive Backups**: Automatically creates `.bak` safety backups before updating any configuration file.
* 💾 **Dual Persistence (Config + Environment)**: By default, updates both tool-specific configuration files AND system-wide user environment variables (Windows User Registry `HKCU\Environment` or macOS/Linux `~/.zshrc` / `~/.bashrc`).
* 🎛️ **Intelligent Management Hub**: Once configured, running `gc-helper` or `gc` never re-prompts for URL/API key—it presents an instant status check by default on Enter, with 1-second harness re-sync.
* 🩺 **Standalone Status & Audit Commands**: Run `gc status` or `gc audit` at any time for instant connection verification and active harness diagnosis.

---

## Quickstart

### 1. Run Directly via Git
```bash
git clone https://github.com/bepaldes/gc-helper.git
cd gc-helper
node bin/gc-helper.mjs
```

### 2. Optional: Install Globally
```bash
npm link
# Now you can run it from any terminal via either command:
gc-helper
# or shorthand alias:
gc
```

---

## Interactive Walkthrough

When you launch `GC-Helper`, you are guided through an interactive wizard:

```text
  ██████╗  ██████╗      ██╗  ██╗███████╗██╗     ██████╗ ███████╗██████╗ 
 ██╔════╝ ██╔════╝      ██║  ██║██╔════╝██║     ██╔══██╗██╔════╝██╔══██╗
 ██║  ███╗██║     █████╗███████║█████╗  ██║     ██████╔╝█████╗  ██████╔╝
 ██║   ██║██║     ╚════╝██╔══██║██╔══╝  ██║     ██╔═══╝ ██╔══╝  ██╔══██╗
 ╚██████╔╝╚██████╗      ██║  ██║███████╗███████╗██║     ███████╗██║  ██║
  ╚═════╝  ╚═════╝      ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝     ╚══════╝╚═╝  ╚═╝
 GC-Helper — Multi-Harness Auto-Configurator & Connection Auditor
 (Independent community helper — not affiliated with GhostCLI official)

Step 1: Confirm GhostCLI Base URL
Enter Base URL [default: https://ghostcli.cloud]: 

Step 2: Confirm GhostCLI API Key
Found existing API key (gcli_TBU...PMbE). Use this key? [Y/n]: y

Step 3: Pre-Flight Connection Validation
Validating token against https://ghostcli.cloud/v1/models...
✔ Connection verified! HTTP 200 OK (270ms) — 8 models available.

Step 4: AI Harness Detection
  [✔] Claude Code CLI              (Installed)
  [✔] OpenAI Codex CLI             (Installed)
  [✔] Hermes Agent (Nous Research) (Installed)
  [ ] OpenClaw                     (Not detected)
  [ ] OpenCode Interpreter / CLI   (Not detected)
  [ ] Oh My Pi (omp)               (Not detected)

Select deployment target:
  1. All Detected Tools (claude, codex, hermes) [Recommended]
  2. All Supported Harnesses (including uninstalled)
  3. Custom Selection

Step 5: Persistence Mode
  1. Both Tool Config Files & Persistent Environment Variables [Recommended]
  2. Tool Configuration Files Only
  3. Persistent Environment Variables Only

=== Applying Configurations ===
✔ Environment applied: ANTHROPIC_BASE_URL, OPENAI_BASE_URL, GHOSTCLI_API_KEY
✔ Claude Code: Updated C:\Users\...\.claude\settings.json
✔ OpenAI Codex CLI: Updated C:\Users\...\.codex\config.toml
✔ Hermes Agent: Updated C:\Users\...\AppData\Local\hermes\config.yaml

✔ GC-Helper Setup Completed Successfully!
```

---

## Subcommands & CLI Reference

### Subcommands

| Subcommand | Alias | Description | Example |
| :--- | :--- | :--- | :--- |
| **`setup`** | *(default)* | Runs the interactive wizard or management hub. | `gc-helper` or `gc` |
| **`status`** | `audit`, `check` | Quick connection verification and active harness audit. | `gc-helper status` or `gc status` |
| **`sync`** | `--sync` | Fast zero-prompt re-sync of existing credentials to all detected harnesses. | `gc-helper sync` or `gc sync` |
| **`audit`** | `--audit`, `check` | Deep connection health, latency, model catalogs, and harness inspection. | `gc-helper audit` or `gc audit` |
| **`help`** | `--help`, `-h` | Displays the terminal parameter reference. | `gc-helper help` or `gc help` |

### CLI Options (Headless / Automation)

| Flag | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| **`--url <url>`** | String | `https://ghostcli.cloud` | Custom Base URL. |
| **`--key <key>`** | String | Auto-detected | GhostCLI API key (`gcli_...`). |
| **`--mode <mode>`** | String | `both` | Persistence target: `both`, `config` (files only), or `env` (environment only). |
| **`--tools <list>`** | String | Auto | Comma-separated list: `claude`, `codex`, `hermes`, `openclaw`, `opencode`, `omp`, `vscode`, `desktop`, `opendesign`, or `all`. |
| **`--reconfigure`, `--force`** | Flag | `false` | Force re-prompting for Base URL and API key even when already configured. |
| **`-y, --yes`** | Flag | `false` | Non-interactive mode (uses defaults without prompting). |
| **`--dry-run`** | Flag | `false` | Simulates actions and prints planned changes without writing to disk. |

---

## Supported Tools & Configuration Mapping

| Tool | Config File Location | Settings Applied |
| :--- | :--- | :--- |
| **Claude Code CLI** | `~/.claude/settings.json` | `ANTHROPIC_BASE_URL = "https://ghostcli.cloud"`<br>`ANTHROPIC_API_KEY = "gcli_..."`<br>`CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY = "1"` |
| **OpenAI Codex CLI** | `~/.codex/config.toml` | `base_url = "https://ghostcli.cloud/v1"`<br>`model = "gpt-6-astra"` |
| **Hermes Agent** | `%LOCALAPPDATA%\hermes\config.yaml`<br>or `~/.hermes/config.yaml` | `default: "ghostcli/claude-opus-5-5"`<br>`providers.ghostcli.base_url = "https://ghostcli.cloud/v1"` |
| **OpenClaw** | `~/.openclaw/openclaw.json` | `base_url = "https://ghostcli.cloud/v1"`<br>`api_key = "gcli_..."` |
| **OpenCode** | `~/.config/opencode/config.json` | `providers.ghostcli.type = "openai"`<br>`providers.ghostcli.base_url = "https://ghostcli.cloud/v1"` |
| **Oh My Pi (`omp`)** | `~/.omp/config.json` | `models.provider = "openai-compatible"`<br>`models.base_url = "https://ghostcli.cloud/v1"` |
| **Visual Studio Code** | `Code/User/settings.json` | `terminal.integrated.env.<os>.ANTHROPIC_BASE_URL = "https://ghostcli.cloud"`<br>`terminal.integrated.env.<os>.OPENAI_BASE_URL = "https://ghostcli.cloud/v1"`<br>`terminal.integrated.env.<os>.GHOSTCLI_API_KEY = "gcli_..."` |
| **Claude Desktop App** | `Claude/claude_desktop_config.json`<br>& `Claude-3p/` | `deploymentMode = "3p"`<br>`inferenceGatewayBaseUrl = "https://ghostcli.cloud"`<br>`inferenceGatewayAuthScheme = "bearer"`<br>*(Preserves existing `mcpServers`)* |
| **Open Design** | `%APPDATA%\Open Design\namespaces\*\data\app-config.json`<br>& `~/.config/mms/model-routes.json` | `agentId = "claude"`<br>`agentModels.claude.model = "claude-opus-5-5"`<br>`agentModels.codex.model = "gpt-6-astra"`<br>`agentCliEnv.claude.MMD_MODEL_ROUTES_FILE`<br>`agentCliEnv.codex.OPENAI_BASE_URL`<br>*(Simultaneous Claude + Astra routing)* |
| **System Environment** | Windows Registry (HKCU) / `~/.zshrc` / `~/.bashrc` | `ANTHROPIC_BASE_URL`<br>`OPENAI_BASE_URL`<br>`GHOSTCLI_API_KEY`<br>`ANTHROPIC_API_KEY` |

---

## Security & Privacy Guarantee

* **100% Local**: GC-Helper runs strictly on your local machine.
* **Zero Telemetry**: No user data, tokens, system specs, or usage metrics are collected.
* **Direct Communication**: Network traffic only connects directly to your specified endpoint to validate your API key.

---

## Disclaimer

`GC-Helper` (`gc-helper`) is an independent open-source configuration helper created for the developer community. It is not affiliated with, maintained, sponsored, or endorsed by GhostCLI, GH DIGITAL LTDA, Anthropic, OpenAI, or Nous Research. All product names, logos, trademarks, and registered trademarks are property of their respective owners.

---

## License

MIT © [bepaldes](https://github.com/bepaldes)
