# Design: Configured State Detection & Status Management Hub for GC-Helper

## Objective
Prevent `gc-helper` from re-prompting for the Base URL and API Key on subsequent executions once GhostCLI is already configured on the system. When already configured, running `gc-helper` (no args) defaults directly to a status readout and provides a lightweight management hub.

## Architecture & Lifecycle

```mermaid
flowchart TD
    Start["gc-helper invoked"] --> CheckArgs{"Explicit arguments or subcommands passed?"}
    CheckArgs -->|"Yes (e.g. audit, sync, --key, --yes)"| DirectExec["Direct Command Execution"]
    CheckArgs -->|"No (bare invocation)"| CheckConfig{"isConfigured() == true?"}
    CheckConfig -->|"No (unconfigured)"| SetupWizard["Run Full Interactive Setup Wizard"]
    CheckConfig -->|"Yes (already configured)"| HubMenu["Run Post-Install Hub"]
    HubMenu -->|"Option 1 [default / Enter]"| RunStatus["Execute Audit Status & Exit"]
    HubMenu -->|"Option 2"| RunSync["Re-Sync Configs Across Detected Harnesses"]
    HubMenu -->|"Option 3"| Reconfigure["Fall through to Setup Wizard"]
    HubMenu -->|"Option 4"| Exit["Exit Cleanly"]
```

## Configured Detection Logic
A system is classified as **configured** if:
1. `detectExistingKey()` resolves a GhostCLI API key (`gcli_...`) from environment or tool settings, OR
2. At least one installed harness has an existing GhostCLI or custom endpoint configured in its config file (`settings.json`, `config.toml`, `config.yaml`, `openclaw.json`).
