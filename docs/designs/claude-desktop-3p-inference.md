# Design: Claude Desktop Third-Party Inference Integration & MCP Preservation

## Objective
Enable `gc-helper` to detect the official Claude Desktop application and configure it to route inference through the GhostCLI API gateway using its native Third-Party (3P) inference mode, while strictly preserving any existing Model Context Protocol (MCP) servers (e.g. `context7`).

## Technical Context
The official Claude Desktop application does not read environment variables like `ANTHROPIC_BASE_URL`. Instead, it uses an internal 3P gateway architecture:
- Primary configuration: `%APPDATA%\Claude\claude_desktop_config.json`
- 3P configuration directory: `%LOCALAPPDATA%\Claude-3p\`
- Profile Library: `%LOCALAPPDATA%\Claude-3p\configLibrary\`

## User Notice & Cloud Scope Trade-offs
When Claude Desktop switches to 3P inference mode, it directs API traffic to GhostCLI instead of standard `claude.ai` web sessions:
- **Cloud Features Unavailable in 3P Mode**: Access to cloud Projects, Web Connectors, cloud Skills, and cloud Chat History will not be accessible while the app is in third-party inference mode.
- **Local Features Preserved**: Local MCP servers (e.g. `context7`) configured in `claude_desktop_config.json` are preserved and continue functioning.
- **Reversibility**: Safety `.bak` copies are created so the user can easily revert back to standard first-party account mode.

## Configuration Files Scaffolded
1. **`claude_desktop_config.json`**:
   - Sets `"deploymentMode": "3p"`
   - Preserves all pre-existing `"mcpServers"` entries.
2. **`configLibrary/_meta.json`**:
   - Designates active profile: `{"appliedId": "00000000-0000-4000-8000-000000000001"}`
3. **`configLibrary/00000000-0000-4000-8000-000000000001.json`**:
   - `inferenceProvider`: `"gateway"`
   - `inferenceGatewayBaseUrl`: Base URL (e.g. `https://ghostcli.cloud`)
   - `inferenceGatewayApiKey`: API key (`gcli_...`)
   - `inferenceGatewayAuthScheme`: `"bearer"`
   - `modelDiscoveryEnabled`: `true`
   - `inferenceModels`: List of available canonical models.
