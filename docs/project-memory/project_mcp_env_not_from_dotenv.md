---
name: project_mcp_env_not_from_dotenv
description: "umbraco-mcp fails to connect (-32000) because Claude expands .mcp.json ${VAR} from the launching shell, not from .env."
metadata: 
  node_type: memory
  type: project
  originSessionId: 6b2c6fcc-3683-479d-90e4-29b8fd857c66
---

`umbraco-mcp` failing with `Failed to connect` / `-32000` and `/mcp` warning "Missing environment variables: UMBRACO_CLIENT_ID, UMBRACO_CLIENT_SECRET, UMBRACO_BASE_URL" means the credentials are NOT exported in the shell that launched Claude. `.mcp.json` references them as `${UMBRACO_CLIENT_ID}` etc., and **Claude Code expands `${...}` from its own process environment — it does NOT read the project `.env`**. The vars living in `.env` (where they "always have been") is a red herring; `.env` is loaded by the app/Playwright, never by Claude's MCP config substitution.

**Why:** Starting the site and relaunching Claude don't export anything into Claude's process. The MCP server then launches with empty creds/URL and the handshake dies.

**How to apply:** Launch Claude from a shell that has `.env` loaded. An alias `claude-umb` was added to `~/.zshrc`: `set -a; source ~/Sites/umbraco-17-demo-site/.env; set +a; claude`. Must be a fresh `claude` launch via that alias — sourcing `.zshrc` inside a running session can't fix the current process. Don't hardcode the secret into `.mcp.json` (it's committed to git). `NODE_TLS_REJECT_UNAUTHORIZED=0` is set literally in `.mcp.json` for the self-signed localhost cert and is unaffected.

**Two more conditions confirmed 2026-07-01:**

1. **Site must be up FIRST.** `@umbraco-cms/mcp-dev` authenticates against the Management API (`UMBRACO_BASE_URL=https://localhost:44367`) *at MCP startup*. If `dotnet run` isn't fully serving yet, the handshake dies and the server shows connect/timeout (distinct from the "Missing environment variables" env failure). If the env vars WERE present at launch and only the site raced, use the `/mcp` panel's **reconnect** — no relaunch needed. Correct order every session: (1) `dotnet run` in its own persistent terminal, wait for `Now listening on… :44367`; (2) launch Claude with the vars; (3) `/mcp` to verify.

2. **VSCode extension inherits VSCode's launch environment, not `.env`.** The extension host + its spawned `claude` inherit the env VSCode captured at startup. Nothing exports `UMBRACO_*` at shell startup (they're only in `.env`; `.zshrc` merely *defines* the alias, and there's no `.vscode/settings.json` env injection, nothing in `.zshenv`/`.zprofile`). So the extension has working MCP **only when VSCode itself was launched from an env-loaded shell** (e.g. `set -a; source .env; set +a; code .`); launched cold from the Dock it gets empty creds → MCP fails. This is why the extension's MCP "works some sessions, not others." User chose to operate by the rule (Option C) rather than add a global `.zshrc` source or `direnv` — do NOT assume the extension has MCP; check which way that VSCode window was started.
