# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ASP.NET Core 10 web application powered by **Umbraco 17 CMS**, hosted on **Umbraco Cloud**. The site is a demo/content site with articles, authors, contact form, and block-based content rendering.

## Build & Run Commands

```bash
# Build
cd src/UmbracoProject && dotnet build

# Run (serves at https://localhost:44367 / http://localhost:64853)
cd src/UmbracoProject && dotnet run

# Trust HTTPS dev certificate (first-time setup)
dotnet dev-certs https --trust

# Publish for production
dotnet publish src/UmbracoProject -c Release
```

There are no test projects or linting tools configured.

## Architecture

**Entry point**: `src/UmbracoProject/Program.cs` — bootstraps Umbraco with `CreateUmbracoBuilder()`, adds BackOffice + Website middleware and endpoints.

**Key directories under `src/UmbracoProject/`:**

- `Views/` — Razor templates using `UmbracoViewPage<T>` base class with auto-generated published content models (`Umbraco.Cms.Web.Common.PublishedModels`)
- `Views/Partials/` — Reusable partials; navigation and footer use `Html.CachedPartialAsync()` with 60-minute cache
- `Views/Partials/blocklist/Components/` — Block List content components (richText, image, video, codeSnippet, etc.)
- `Views/Partials/blockgrid/` — Block Grid layout rendering (default, area, areas, items)
- `Views/Components/` — MVC View Components (Contact form, Pagination)
- `wwwroot/` — Static assets (Bootstrap 5 via CDN, custom CSS/JS, Highlight.js, Swiffy Slider)
- `umbraco/Deploy/Revision/` — Umbraco Deploy `.uda` metadata files (document types, data types, templates). These are auto-managed by Umbraco Deploy and pushed to Cloud for schema sync.
- `umbraco/Data/` — Local SQLite database and generated temp files (not committed)

**Content model**: Document types are defined in the Umbraco backoffice and stored as `.uda` files in `umbraco/Deploy/Revision/`. C# models are auto-generated at runtime in `umbraco/Data/TEMP/InMemoryAuto/`.

**Backoffice extension**: `src/HelloWorld/` — a sample dashboard extension created via Umbraco Skills plugin, referenced from the main `.csproj`. Uses TypeScript + Vite with a `Client/` subfolder for the frontend build.

**Key NuGet packages**: Umbraco.Cms 17.1.0, Umbraco.Forms 17.1.2, Umbraco.Deploy.Cloud 17.0.1, Clean.Core 7.0.5 (view models for contact form/page headers).

**AI packages**: Umbraco.AI 1.1.0, Umbraco.AI.Agent 1.1.0, Umbraco.AI.Agent.Copilot 1.0.0-alpha2, Umbraco.AI.Agent.UI 1.0.0-alpha1, Umbraco.AI.Anthropic 1.1.0, Umbraco.AI.Google 1.1.0, Umbraco.AI.OpenAI 1.1.0, Umbraco.AI.Prompt 1.1.0.

## AI & Copilot

The backoffice includes an **AI Copilot** that can generate and edit content directly in blocks/fields. Configuration is done in the Umbraco backoffice under **Settings > AI**:

- **AI Connection**: Provider + API credentials (Anthropic key stored in `appsettings.Development.json` under `Anthropic:ApiKey`)
- **Chat Profile**: Links an AI connection to a specific model
- **Agent**: Links a chat profile and defines the agent's role. **Permissions must be set on the agent** to allow content editing (scope controls which document types/properties it can modify).
- **Contexts**: Define data access boundaries (e.g., brand voice guidelines)

The **Umbraco MCP server** enables Claude Code to interact with backoffice content. Connection settings are in `.env` with tool collections for `document`, `media`, `document-type`, and `data-type`.

## Deployment

Git push to Umbraco Cloud triggers the build pipeline — the `.umbraco` file at the repo root tells Cloud which `.csproj` to build. No separate CI/CD is configured. Environment-specific config is in `appsettings.{Development,Staging,Production}.json`.

## Conventions

- Views inherit from `UmbracoViewPage<ContentType>` where `ContentType` is an auto-generated model
- `_ViewImports.cshtml` imports `Umbraco.Cms.Web.Common.PublishedModels`, `Umbraco.Extensions`, and ASP.NET tag helpers
- The `.env` file contains Umbraco MCP server connection settings for local development
- `appsettings.Development.json` is **gitignored** — it contains the Anthropic API key. Each developer must create their own with their credentials.
- `umbraco-cloud.json` is managed by Umbraco Cloud — do not manually edit

## Claude Code Plugins

The **Umbraco CMS Backoffice Skills** plugin is installed via the Claude Code CLI (not the VS Code extension). It provides 60+ skills for building backoffice extensions:

```
/plugin marketplace add umbraco/Umbraco-CMS-Backoffice-Skills
/plugin install umbraco-cms-backoffice-skills@umbraco-backoffice-marketplace
/plugin install umbraco-cms-backoffice-testing-skills@umbraco-backoffice-marketplace
```
