# Open Design Integration & Simultaneous Claude + Astra Model Routing

## 1. Overview
[`gc-helper`](../../bin/gc-helper.mjs) automatically discovers **Open Design** across Windows, macOS, and Linux, configures its daemon `app-config.json`, and generates `~/.config/mms/model-routes.json` so that both **Claude** (`claude-opus-5-5`, `claude-sonnet-5`, `claude-fable-5.1`) and **Astra** (`gpt-6-astra`) models are available simultaneously inside Open Design.

## 2. Open Design Daemon Schema (`chunk-TYPDA7AG.mjs`)
Open Design validates `namespaces/<namespace>/data/app-config.json` on startup using a strict schema parser:
- **Allowed Top-Level Keys**: `agentId`, `agentModels`, `agentCliEnv`, `agentCliEnvIntent`, `analyticsEnabled`, `notificationSound`, `Followed`, etc.
- **Allowed `agentModels.<agentId>` Keys (`AGENT_MODEL_KEYS`)**:
  - `model` (string)
  - `reasoning` (string)
  - `serviceTier` (string)
- **Allowed `agentCliEnv` Keys (`AGENT_CLI_ENV_KEYS`)**:
  - `claude`: `CLAUDE_CONFIG_DIR`, `CLAUDE_BIN`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `MMD_MODEL_ROUTES_FILE`
  - `codex`: `CODEX_HOME`, `CODEX_BIN`, `OPENAI_BASE_URL`, `CODEX_API_KEY`, `OPENAI_API_KEY`

Any unapproved key inside `agentModels` or `agentCliEnv` causes Open Design to reject the config file. [`src/configurators/opendesign.mjs`](../../src/configurators/opendesign.mjs) sanitizes all written objects against these exact key sets.

## 3. Simultaneous Claude + Astra Routing (`chunk-53H6ASZW.mjs`)
Open Design's `claude` agent adapter calls `loadMmdRouteModels(env, CLAUDE_FALLBACK_MODELS)`:
1. It reads `~/.config/mms/model-routes.json` (or the path specified in `agentCliEnv.claude.MMD_MODEL_ROUTES_FILE`).
2. Every model key under `"routes"` is prepended to the **Claude Code** model picker dropdown in the Open Design UI.
3. When a user selects any routed model (`claude-opus-5-5`, `claude-sonnet-5`, `claude-fable-5.1`, or `gpt-6-astra`), `loadMmdRouteLaunchEnv` injects `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN` for that run.
4. Simultaneously, Open Design's **Codex CLI** (`codex`) agent reads `~/.codex/ghostcli-models.json` (configured by `gc-helper` at 1M context window) and uses `agentCliEnv.codex` (`OPENAI_BASE_URL`, `OPENAI_API_KEY`, `CODEX_API_KEY`).
