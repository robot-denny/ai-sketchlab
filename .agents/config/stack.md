# Stack

How to build, test, and run this repo. Filled during the cantrip trial (2026-08-03). This slot is
project-scoped — absolute paths are fine here (that is exactly what it exists for).

## Build

- Local: `cd src/UmbracoProject && dotnet build`
- CI parity (Gate 1 + the pre-push hook): `dotnet build -c Release`
- RCL-split verification: `dotnet publish src/UmbracoProject -c Release` — required to catch the
  host/RCL schema-file collision (NETSDK1152) that `dotnet build` does not surface.

## Tests

- xUnit: `dotnet test umbraco-17-demo-site.sln --no-build -c Release` — run from the **repo root**
  against the solution (matches Gate 1 in `.github/workflows/main.yml` and the pre-push hook). Test
  project: `tests/UmbracoProject.Tests/`. **Do NOT** `cd src/UmbracoProject` first — that project is
  the web host, not a test project, so it runs **zero** tests and still exits 0 (silent false pass).
- Playwright E2E (Node is managed via nvm — prefix PATH):
  `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test`
  First-time setup: `npm install` then `npx playwright install chromium`.
- The pre-push hook runs `dotnet build -c Release` + `dotnet test --no-build`; it must pass
  before a push.
