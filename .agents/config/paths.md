# Paths

Where things live in this repo. Filled during the cantrip trial (2026-08-03).

## Workspace

Increment bundles → `_work/<slug>/` (`spec.md`, `plan.md`, and optional `notes/`, `assets/`),
archived to `_work/shipped/<slug>/` once the work ships. Capability docs → `_features/<area>.md`.
This is the live layout — `/spec` and `/plan` write here.

The legacy `_specs/`/`_plans/` folders were migrated wholesale into `_work/shipped/<slug>/` during
the cantrip toolkit adoption. `_audits/` stays gitignored; going forward durable audits go to
`docs/audits/` (committed) and scratch working files to `_scratch/` (gitignored).

## Code layout

- Host (thin, runnable): `src/UmbracoProject/` — `Program.cs`, `appsettings*.json`, `wwwroot/`,
  `Views/`, and `.uda` schema under `umbraco/Deploy/Revision/`.
- Business-logic RCL: `src/UmbracoProject.Features/` — `Services/<Domain>/`, `Composer/`,
  `Infrastructure/`, `Models/Generated/` (committed ModelsBuilder output). Namespaces mirror
  folders (`UmbracoProject.Features.Services.Search`).
- Backoffice extension: `src/HelloWorld/` (TS/Vite `Client/` + generated OpenAPI client).
- Views: page templates `Views/*.cshtml`; shared block views
  `Views/Partials/blocks/Components/{alias}.cshtml`; grid-only `Views/Partials/blockgrid/Components/`.
  The article card is `Views/Partials/v2/_ArticleCard.cshtml`.
- CSS: `src/UmbracoProject/wwwroot/assets/css/` — article cards in `listings.css`, block base in
  `blocks.css`, tokens in `typography.css` / `tokens-extras.css`.
- Tests: Playwright E2E `tests/e2e/`; xUnit `tests/UmbracoProject.Tests/`.

## Generated output

Skip in review/retrofit: `bin/`, `obj/`, `umbraco/Data/TEMP/`, `wwwroot/media/` (Cloud is the
source of truth; gitignored), `playwright-report/`, `test-results/`, `skills/output/`.

> `src/UmbracoProject.Features/Models/Generated/*.generated.cs` are **committed source**
> (ModelsBuilder `SourceCodeManual` mode), NOT generated output — regenerate deliberately when
> schema changes and commit the diff.
