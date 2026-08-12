# Deployment

Deploys are wired through **GitHub Actions → Umbraco Cloud CI/CD Flow** — see [CI/CD & Build hygiene](ci-cd.md) for the full pipeline (two gates, master-only deploy to Dev, manual promotion to Live in the Cloud Portal). The `.umbraco` file at the repo root still tells Cloud which `.csproj` to build; it just isn't triggered by a direct git push to a Cloud remote anymore — GitHub Actions calls the Cloud CI/CD Flow API instead. Environment-specific config is in `appsettings.{Development,Staging,Production}.json`.

## Git remotes — always push to `github`, never `origin`

This clone has **three** remotes, and `origin` is a trap:

| Remote | URL | What it is | Push here? |
|---|---|---|---|
| `github` | `github.com/robot-denny/ai-sketchlab` | **The dev repo** — code, PRs, GitHub Actions CI/CD. `master` tracks this. | **Yes — all normal git work.** |
| `origin` | `scm.umbraco.io/.../umbraco-17-demo-site` | Umbraco Cloud **Live** SCM | No |
| `dev-cloud` | `scm.umbraco.io/.../dev-umbraco-17-demo-site` | Umbraco Cloud **Dev** SCM | No |

**All pushes, branches, and PRs go to `github`.** The Cloud remotes (`origin`, `dev-cloud`) are *not* the deploy trigger — GitHub Actions calls the Cloud CI/CD Flow API (above), so you never `git push` to Cloud in the normal workflow.

The trap: `git config remote.pushDefault` is **unset**, so git falls back to `origin` (= Cloud Live) for any branch without an upstream. `master` already tracks `github` so a bare `git push` on master is fine, but **`git push -u origin <new-branch>` pushes a feature branch to Cloud, not GitHub** — the wrong place, and it won't open a PR or run CI. When creating a branch, push explicitly: `git push -u github <branch>`. (A durable per-clone fix is `git config remote.pushDefault github`, which makes a bare `git push` target GitHub for every branch.)
