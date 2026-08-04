# Reviewer shared context

Filled during the cantrip trial (2026-08-03). Per-reviewer rule files are deferred: this repo's
existing tailored reviewers (`umbraco-code-reviewer` / `accessibility-reviewer` / `perf-reviewer`
under `.claude/agents/`) carry their own project rules and remain in use for the trial; cantrip's
generic reviewers are installed but unregistered (per `check-install.sh` guidance — no force-link).

Repo orientation: an Umbraco 17 CMS site on ASP.NET Core .NET 10, hosted on Umbraco Cloud. A
two-project RCL split — a thin runnable host (`src/UmbracoProject/`) plus a business-logic RCL
(`src/UmbracoProject.Features/`) — with a separate backoffice-extension project
(`src/HelloWorld/`). Reviews commonly cover Razor views/partials, editor-agnostic block
components, C# services in the RCL, CSS in `wwwroot/assets/css/`, Playwright + xUnit tests, and
`.uda` schema artifacts.
