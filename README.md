# Umbraco 17 AI Demo Site

This is a demo site built on Umbraco 17 with the [Paul Seal starter site](https://codeshare.co.uk/umbraco-starter-site/) as a base. It includes the full Umbraco AI suite, AI Copilot, and MCP server integration — set up for experimenting with AI-assisted content editing in the backoffice.

## Getting Started (Collaborators)

### Prerequisites

- [.NET 10.0 SDK](https://dotnet.microsoft.com/download)
- Access to this Umbraco Cloud project (request an invite if you don't have one)

### 1. Clone the repository

Clone the GitHub dev repo (all development work — code, PRs, CI — lives here):

```bash
git clone https://github.com/robot-denny/ai-sketchlab.git
cd ai-sketchlab
```

> Umbraco Cloud SCM remotes (Live and Dev) also exist, but they are **not** used for day-to-day development — GitHub Actions drives the Cloud deploy pipeline. See [docs/deployment.md → "Git remotes"](docs/deployment.md#git-remotes--always-push-to-github-never-origin) for the full remote map and why `origin` is a trap.

### 2. Add the required config files

Three files are not in the repository and need to be obtained from a team member (shared via Slack or a secure channel):

| File | Where to place it |
|------|------------------|
| `Umbraco.sqlite.db` | `src/UmbracoProject/umbraco/Data/` |
| `appsettings.Development.json` | `src/UmbracoProject/` |
| `.env` | repo root |

The SQLite database contains all site content. `appsettings.Development.json` holds the Anthropic API key for AI features. `.env` holds credentials for the MCP server.

### 3. Trust the HTTPS dev certificate (first time only)

```bash
dotnet dev-certs https --trust
```

### 4. Activate git hooks (one time per clone)

This repo ships shared git hooks in `.githooks/`. Run this once to activate them:

```bash
git config core.hooksPath .githooks
```

Three hooks are included:

- **`pre-commit` — UDA Guard**: checks whether any `.uda` schema files you're committing conflict with changes on the remote. Warns and blocks if direct conflicts are detected. To bypass in an emergency: `git commit --no-verify`.
- **`pre-push` — Build + Tests Gate**: runs `dotnet build -c Release` and `dotnet test --no-build -c Release` before each push and prints per-step timings (e.g. `build: 6.0s, test: 1.0s, total: 7.0s`). Catches Gate 1 failures locally before they reach the Umbraco Cloud build pipeline. Enabled by default; runtime budget is ~30s on a primed build. To skip: set `SKIP_PREPUSH=1` in your shell profile, set `ENABLE_PREPUSH=false` in `.githooks.conf`, or use `git push --no-verify` for one-offs.
- **`post-merge`**: triggers Umbraco Deploy to sync schema after a `git pull` or merge.

#### Configuring hooks per-developer

Each hook can be toggled without modifying tracked files. Two methods:

**Option 1 — Environment variables** (in `~/.zshrc` or `~/.bashrc`):

```bash
export SKIP_UDA_CHECK=1     # Disable UDA Guard on pre-commit
export SKIP_PREPUSH=1       # Disable build + tests gate on pre-push
```

**Option 2 — Local config file**:

```bash
cp .githooks.conf.example .githooks.conf
# Edit .githooks.conf to your preferences (gitignored, stays local)
```

See [.githooks.conf.example](.githooks.conf.example) for all available flags.

### 5. Install Node dependencies (for E2E tests)

```bash
npm install
npx playwright install chromium
```

### 6. Run the site

```bash
cd src/UmbracoProject
dotnet run
```

The terminal output will show the local URLs — typically `https://localhost:44367`. The backoffice is at `/umbraco`.

---

## Umbraco Schema Files (.uda)

Umbraco stores CMS schema (document types, data types, templates) as `.uda` files in `src/UmbracoProject/umbraco/Deploy/Revision/`. These are version-controlled and deployed to Umbraco Cloud automatically when pushed.

**Watch out for accidental changes**: Umbraco rewrites `.uda` files on startup to reflect the local database. This means `git status` may show modifications even if you haven't touched any document types in the backoffice. Review before staging — if you didn't intentionally change schema, discard:

```bash
git checkout -- src/UmbracoProject/umbraco/Deploy/Revision/
```

When committing intentional schema changes, the pre-commit hook checks for remote conflicts automatically. For a detailed analysis before committing, use `/check-uda` in Claude Code.

---

## Project Structure

The solution is a two-project Razor Class Library (RCL) split — a thin runnable host plus an RCL holding business logic — alongside a backoffice-extension project. See [AGENTS.md → "Solution architecture"](AGENTS.md#solution-architecture) for the full rationale.

```
.
├── src
│   ├── UmbracoProject                  (Thin host — runnable entry point: Program.cs, appsettings*, wwwroot/, Views/, umbraco/ + .uda schema)
│   ├── UmbracoProject.Features         (Razor Class Library — migrated business logic: Services/, Composer/, Infrastructure/, Models/Generated/)
│   └── HelloWorld                      (Backoffice extension — TypeScript + Vite Client/, dashboard, image generator, OpenAPI client)
├── tests
│   ├── UmbracoProject.Tests            (xUnit tests, incl. block render-coverage gate)
│   └── e2e                             (Playwright E2E + visual-regression specs)
├── docs                                (Runbooks, capabilities, brand, CI recipes)
├── _specs / _plans / _features         (Spec → plan → living BDD behavior per capability)
├── .github                             (GitHub Actions — Umbraco Cloud CI/CD Flow)
├── .umbraco                            (Tells Cloud which .csproj to build)
└── README.md                           (This file)
```

## Deployment & CI/CD

Deploys run through **GitHub Actions → Umbraco Cloud CI/CD Flow** (two gates, master-only deploy to Dev, manual promotion to Live in the Cloud Portal). See [docs/ci-cd.md](docs/ci-cd.md) for the pipeline and [docs/deployment.md](docs/deployment.md) for the remote map.

# Documentation

- Architecture, conventions, and agent instructions → [AGENTS.md](AGENTS.md) (Claude-Code notes → [CLAUDE.md](CLAUDE.md))
- Umbraco Cloud platform docs → [Umbraco Docs](https://docs.umbraco.com/umbraco-cloud)
