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

**Key NuGet packages**: Umbraco.Cms 17.1.0, Umbraco.Forms 17.0.3, Umbraco.Deploy.Cloud 17.0.1, Umbraco.AI.Anthropic 1.1.0, Clean.Core 7.0.5 (view models for contact form/page headers).

## Deployment

Git push to Umbraco Cloud triggers the build pipeline — the `.umbraco` file at the repo root tells Cloud which `.csproj` to build. No separate CI/CD is configured. Environment-specific config is in `appsettings.{Development,Staging,Production}.json`.

## Conventions

- Views inherit from `UmbracoViewPage<ContentType>` where `ContentType` is an auto-generated model
- `_ViewImports.cshtml` imports `Umbraco.Cms.Web.Common.PublishedModels`, `Umbraco.Extensions`, and ASP.NET tag helpers
- The `.env` file contains Umbraco MCP server connection settings for local development
- `umbraco-cloud.json` is managed by Umbraco Cloud — do not manually edit
