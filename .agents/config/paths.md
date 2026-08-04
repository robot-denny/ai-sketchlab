# Paths

Where things live in this repo. Filled during the cantrip trial (2026-08-03).

## Workspace

Increment bundles → `_work/<slug>/` (`spec.md`, `plan.md`, `notes/`, `assets/`), archived to
`_work/shipped/<slug>/`. Capability docs → `_features/<area>.md`. This is the cantrip default,
adopted for new work as of the trial.

> Migration in progress: `_work/` is the target layout but does not exist on `master` yet — it is
> created on first use (`mkdir -p _work/<slug>/`). For cantrip-driven work this **supersedes**
> CLAUDE.md's Workflow Layers guidance (which still routes `/spec`→`_specs/`), pending the CLAUDE.md
> split. New increments use `_work/`; the legacy `_specs/`/`_plans/`/`_audits/` are migrated to
> `_work/shipped/` in a later adoption step.

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
