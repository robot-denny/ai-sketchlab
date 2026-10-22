# Plan: Umbraco 18 Upgrade

**Spec**: [_work/umbraco-18-upgrade/spec.md](spec.md)
**Branch**: `claude/feature/umbraco-18-upgrade` (Phase A); Phase B gets a new branch, see Key Decisions
**Work type**: fix-infra
**Feature doc**: none

## Context

This plan moves the site from Umbraco 17 (17.6.2 when planned; **17.7.1** since Cloud's
auto-upgrade synced in on 2026-10-22) to **18.2.1**, the current stable release. It covers
the three projects, the add-on suites, and the Cloud promotion local → Dev → Live. Several things
are already in place: CS0618 is a build gate, and every obsolete call site is fenced with a scoped
pragma (9 Razor files). The 404 finder already uses the navigation query service. No data type uses
Block List single mode. The image-generator API is a plain `[ApiController]`. The work is therefore
mostly a package bump plus a short list of changes that v18 forces.

This is `fix-infra`, so there are no feature-doc slices. The unit of work is the solution build,
plus the Playwright suite that proves pages and editor flows still behave as they did on v17.

---

## Key Decisions

### Splitting the work into two PRs

The user asked for advice here. **Recommendation: split it.**

- **Phase A (Steps 1–4) ships on v17.6.2 as its own PR.** It merges to master and is promoted to
  Live before any package moves.
- **Phase B (Steps 5–10) is the version bump**, on a fresh branch
  `claude/feature/umbraco-18-upgrade-bump` cut from master after Phase A merges.

The reasons:

1. **The dictionary fallback bug is already live on v17.** It is not a v18 problem.
   - In 17.6.2, `DefaultCultureDictionary[key]` returns `string.Empty` for a missing key or
     translation, not `null`.
   - So every `GetDictionaryValue("…") ?? "fallback"` in the views is already dead code.
   - v18 only changes the declared type from `string?` to `string`.
   - That makes it a v17 fix, and it should ship on its own.
2. **Removing the pragmas can be proven on v17.**
   - The replacements are the friendly extension methods `Parent()`, `Parent<T>()`, `Children()`,
     `Children<T>()` and `AncestorOrSelf<T>()` in `FriendlyPublishedContentExtensions`.
   - They exist with identical signatures and no `[Obsolete]` in both 17.6.2 and 18.2.1.
   - The CS0618 gate proves each file is clean before v18 is involved.
3. **A smoke baseline that is green on v17 makes v18 regressions attributable.** If a template
   fails after the bump, the bump caused it.
4. **The v18 PR shrinks to packages, migrations, and the fallout v18 forces.** That makes it
   easier to review, and the point-in-time rollback covers less.

### Target versions

Verified on NuGet and npm on 2026-10-22. Every package below is stable, targets `net10.0` only,
and declares an `[18.0.0, 19.0.0)` range or a compatible one.

| Package(s) | From | To |
|---|---|---|
| `Umbraco.Cms`, `.DevelopmentMode.Backoffice`, `.Web.Website`, `.Web.Common`, `.Api.Common`, `.Api.Management` | 17.7.1 | **18.2.1** |
| `Umbraco.Deploy.Cloud` | 17.3.1 | 18.1.1 |
| `Umbraco.Forms` / `Umbraco.Forms.Deploy` | 17.6.1 / 17.0.1 | 18.2.1 / 18.0.1 |
| `Umbraco.Cloud.Cms` | 17.2.3 | 18.0.3 |
| `Umbraco.Cloud.StorageProviders.AzureBlob` | 17.1.0 | 18.0.0 |
| `Umbraco.AI` | 17.3.1 | 18.6.0 |
| `Umbraco.AI.Agent` / `.AGUI` | 17.1.4 | 18.4.0 |
| `Umbraco.AI.Agent.Copilot` | 17.0.4 | 18.2.0 |
| `Umbraco.AI.Agent.Deploy` | 17.0.1 | 18.1.0 |
| `Umbraco.AI.Agent.UI` | 17.0.2 | 18.3.0 |
| `Umbraco.AI.Anthropic` | 17.1.0 | 18.1.3 |
| `Umbraco.AI.Deploy` | 17.1.0 | 18.3.0 |
| `Umbraco.AI.Google` | 17.0.3 | 18.0.4 |
| `Umbraco.AI.OpenAI` | 17.2.0 | 18.3.1 |
| `Umbraco.AI.Prompt` | 17.2.3 | 18.4.0 |
| `Umbraco.AI.Prompt.Deploy` | 17.0.3 | 18.0.4 |
| `Umbraco.AI.Search` (host + Features) | 17.0.0 | 18.0.4 |
| `Umbraco.Cms.Search.Core` / `.BackOffice` / `.DeliveryApi` (host + Features) | 1.0.0 | 18.2.0 |
| `Umbraco.Cms.Search.Provider.Examine` | **1.0.0-beta.9** | **18.2.0** (stable; retires the beta pin) |
| `Clean.Core` | 7.0.8 | 8.0.1 (depends on `Umbraco.Cms.Web.Website ≥ 18.0.1`) |
| `jcdcdev.Umbraco.ExtendedMarkdownEditor` (host + Features) | 17.0.5 | 18.0.0 |
| npm `@umbraco-cms/backoffice` (HelloWorld Client) | ^17.6.2 | 18.2.1 |
| npm `@umbraco/playwright-testhelpers` (root) | 17.1.0-beta.7 | 18.0.5 |
| npm `@umbraco/json-models-builders` (root) | ^2.0.42 | 18.0.2 |

Notes on the table:

- Several minimums are interlocked. `AI.Search.Core 18.0.4` requires `Cms.Search.Core [18.0.0,
  18.999.999)`. The AI provider packages require `Umbraco.AI.Core ≥ 18.6.0`. `AI.Agent.Deploy
  18.1.0` requires `AI.Agent.Startup ≥ 18.4.0` and `AI.Deploy ≥ 18.3.0`. Bump the AI family as one
  unit at exactly these versions.
- Leave `MessagePack`, `Microsoft.ICU.ICU4C.Runtime` and `System.Security.Cryptography.Xml` alone
  unless restore reports NU1605/NU1608 against a higher transitive minimum.
- Every version is explicit. Cloud rejects `*`.

### .NET

- **Stay on `net10.0`.** `Umbraco.Cms 18.2.1` and every add-on above ship only a `net10.0` target.
- CI `setup-dotnet '10.0.x'` stays as it is.
- No Cloud portal **Runtime Settings** change is needed. That is the only portal step Cloud's
  major-upgrade guide makes conditional, and it applies only when .NET changes.

### Cloud portal: no step needed before deploying

This confirms what the user expected. Cloud's major-upgrade guide asks for three things. Two are
done and one is deliberately skipped:

- **Upgrade locally first, then deploy.** Done: Steps 5–9.
- **Have at least two environments.** Done: Dev and Live.
- **Be on "the latest 17"**, which is 17.7.1. Planned as a deliberate skip, but **now satisfied**:
  Cloud auto-upgraded Dev to 17.7.1 (with Deploy 17.3.1, Forms 17.6.1, Cloud.Cms 17.2.3) and the
  master pipeline synced it into the repo on 2026-10-22 (#74). Phase B starts from 17.7.1.

### Version policy

**v18 is a short-term-support release; 17 is LTS.** Moving to 18 commits the site to following
19 and 20, then the next LTS (21), on the STS cadence. That fits an R&D/model site.

### Rollback: point-in-time recovery, as the user directed

Cloud's guide doesn't document a rollback procedure, so this plan defines one.

- **Code and database must roll back together.** v18-migrated data won't boot on v17 code, and v17
  data on v18 code just re-runs the migration. So the steps are: restore the environment's database
  to a point in time before the upgrade **and** revert the merge on master, then redeploy.
- **Before each environment's first v18 boot**, record the UTC timestamp. Confirm in the portal
  (**Database Backup and Restore**) that the point-in-time window covers it. Also take a manual
  backup as a second safety net.
- **The database restore does not cover blob storage.** Recycle-bin protection renames trashed
  media files to `*.deleted` in Azure Blob storage, and restoring the database doesn't undo that.
  So the media recycle bin is **emptied on each environment before it upgrades** (Step 10), which
  leaves nothing for the protection migration to rename.
- **If an environment boots to 503 or 500.30**, the migration probably didn't finish. Before
  reaching for point-in-time recovery, use Cloud's **Local Upgrade Option**: point local at that
  environment's database and run the migration from local.

### Live promotion and content freeze

**Freeze content on Live** from the moment its point-in-time timestamp is recorded until the
post-promotion checks pass. Any Live edit made in that window is lost if the upgrade is rolled
back. Live is promoted by hand in the portal (CI deploys only master → Dev).

### HelloWorld OpenAPI client

- The generated client in `src/HelloWorld/Client/src/api/` targets `/umbraco/helloworld/api/v1/*`.
  **No such server controller exists**: the only C# controller is `ImageGeneratorController`, and
  it isn't registered as an OpenAPI document.
- So the "HelloWorld dashboard" API calls are already dead on v17, and v18's Swashbuckle removal
  changes nothing at runtime.
- The plan only retargets the `generate-client` script URL to the v18 shape,
  `/umbraco/openapi/helloworld.json`, and records the dead template code as a ROADMAP follow-up.
- Removing the dashboard or client is out of scope. **This corrects spec AC 7**, which assumed that
  dashboard works.

### Spec corrections

Two spec claims were wrong:

- **Dictionary fallbacks are a latent v17 bug, not a v18 regression.** They are fixed with the
  built-in `UmbracoHelper.GetDictionaryValueOrDefault(key, default)`, which is identical in 17.6.2
  and 18.2.1 and treats empty or whitespace as missing. No new helper is needed.
- **`PaletteService.cs:107/110` already calls the friendly `Children()` extension**, not the
  removed property. No change is needed there.

### Tests

- **Smoke test location.** A new template-level smoke spec goes in `tests/e2e/pages/`, beside the
  `*.screenshot.spec.ts` files. It is a plain behavioral spec, so it has no snapshot folder.
- **Test helpers.** Use the existing helpers in `tests/e2e/_helpers.ts` and `_umbracoApi.ts` for
  Management API calls. Don't add a parallel helper.
- **Characterization tests.** Steps 1 and 3 add tests that are green on v17 on purpose. They are
  the baseline that Phase B must keep green. Their RED signal is the deliberate break described in
  each step.

### Commands

From `.agents/config/stack.md`. Run from the repo root unless noted.

- **Build:** `dotnet build -c Release`
- **Unit tests:** `dotnet test umbraco-17-demo-site.sln --no-build -c Release`
- **Publish:** `dotnet publish src/UmbracoProject -c Release`. This is mandatory, because it is the
  only check that catches NETSDK1152.
- **Solution check:** `dotnet sln list` should show 4 projects before you trust a green build.
- **E2E:** `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test`,
  with the site serving on `:44367`.
- **HelloWorld client:** `cd src/HelloWorld/Client && npm i && npm run build`. Commit the build
  output, because Cloud's build container has no npm.

---

## Steps

Each step is designed to be completed independently in its own context window.
The step heading contains a ready-to-use prompt you can paste into a new session.

## Phase A — v17-safe prep (ships on 17.6.2, own PR)

---

### Step 1 — Template smoke baseline (characterization, green on v17)

> **Prompt**: Implement Step 1 of `_work/umbraco-18-upgrade/plan.md`. Create
> `tests/e2e/pages/templateSmoke.spec.ts`, a Playwright spec that visits one real, published page
> per site template and asserts a 200 response, the page's main heading (or a stable landmark), and
> no Umbraco error page.
>
> The templates are: `home`, `articleList`, `article`, `Author`, `AuthorList`, `content`,
> `documentation`, `contact`, `search`, `spellbook`, `spellCardRedirect` (assert the redirect lands
> on its spellbook), `guides`, `guidePage`, `howToGuidePage`, `experimentsLandingPage`,
> `/sitemap.xml` (valid XML containing the home URL), and a guaranteed-missing URL (custom 404 page
> with status 404).
>
> Discover real URLs from the local site or the existing specs (`tests/e2e/*.spec.ts`), not by
> guessing. Use existing helpers in `tests/e2e/_helpers.ts`, and follow the `tdd-principles` skill:
> assert what a visitor sees, not markup internals.
>
> The site runs on 17.6.2, so this is a characterization test and should pass. Prove it can fail:
> temporarily break one template locally, see it go RED, then revert. Run with
> `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/pages/templateSmoke.spec.ts`
> against `:44367`. Commit the spec.

**What to build**:
- `tests/e2e/pages/templateSmoke.spec.ts`: one `test()` per template, data-driven from a small
  `{ template, url, expectHeading }` table.
- The 404 case uses `page.goto` with response status capture.
- The `spellCardRedirect` case asserts the final URL is under the spellbook.

**Test first**:
- This step is the test. It passes against v17 by design.
- RED proof: temporarily throw in `Views/content.cshtml`, confirm the `content` case fails, then
  revert.

**Validation**:
- [Automated] The spec is green locally on 17.6.2. On the Phase A PR it also runs green in Gate 2
  against Dev.
- [Manual] Spot-check that each URL in the table is a real published page, not a 404 that
  happens to have a heading.

---

### Step 2 — Fix dead dictionary fallbacks

> **Prompt**: Implement Step 2 of `_work/umbraco-18-upgrade/plan.md`. In Umbraco 17.6.2,
> `UmbracoHelper.GetDictionaryValue` already returns `string.Empty` (never `null`) for a missing
> key or translation, so every `Umbraco.GetDictionaryValue("…") ?? "fallback"` in the views never
> applies its fallback.
>
> First, add a Playwright assertion to `tests/e2e/footer/updatedFooter.spec.ts` that every footer
> column heading has non-empty visible text. Add a similar assertion for the home page's "latest"
> section heading and archive link, in the spec that covers the home page. Run them. If they are
> RED, a dictionary key is missing locally. If they are GREEN, prove RED by temporarily renaming
> `Footer.ElsewhereHeading` in the local backoffice.
>
> Then replace every `GetDictionaryValue(key) ?? x` with
> `Umbraco.GetDictionaryValueOrDefault(key, x)`, which is built in, identical in 17 and 18, and
> treats empty or whitespace as missing. Known sites:
> - `Views/Partials/v2/_Footer.cshtml:38-41` (check whether `colophonR` continues onto the next line)
> - `Views/Partials/v2/_LatestSection.cshtml:57` and `:141`
> - `Views/Partials/v2/_HeroHome.cshtml:29` (fallback is another dictionary value)
>
> Also grep for any multi-line `GetDictionaryValue(...)\n ?? ...` variant. Leave
> `_DcPull.cshtml:36` alone: its left-hand side is a model property.
>
> Do not use `string?` in `.cshtml`, because Cloud's runtime compile fails with CS8669. Restore the
> renamed key, then re-run the specs, `dotnet build -c Release` and `dotnet publish src/UmbracoProject -c Release`.

**Status (2026-10-22)**: done in `3bb1af9`. Follow-up not in this step's list:
`_DcPull.cshtml:35-37` chains `?? "From the lab"` after `GetDictionaryValue("Home.DcPullEyebrow")`,
so that last fallback is dead too. It only matters if the key goes missing.

**What to build**:
- Assertions in `tests/e2e/footer/updatedFooter.spec.ts` and the home spec (`tests/e2e/pages/home.screenshot.spec.ts`, or a new non-screenshot test beside it).
- View edits in `_Footer.cshtml`, `_LatestSection.cshtml` and `_HeroHome.cshtml`.

**Test first**:
- Write the non-empty-heading assertions.
- Rename `Footer.ElsewhereHeading` locally, and confirm the footer heading assertion is RED with
  the heading blank.

**Validation**:
- [Automated] The footer and home specs are green with the key renamed, and green with it
  restored. The build is warning-free.
- [Manual] With the key renamed, the footer reads "Elsewhere". Restore the key afterwards.

---

### Step 3 — Remove the CS0618 grandfathering pragmas

> **Prompt**: Implement Step 3 of `_work/umbraco-18-upgrade/plan.md`. Umbraco 18 removes
> `IPublishedContent.Parent` and `.Children`. The friendly extension methods `Parent()`,
> `Parent<T>()`, `Children()`, `Children<T>()` and `AncestorOrSelf<T>()` in
> `Umbraco.Extensions.FriendlyPublishedContentExtensions` exist unchanged and non-obsolete in both
> 17.6.2 and 18.2.1. They are the replacement inside a request.
>
> Before editing, save a characterization snapshot from the running local site:
> `curl -sk https://localhost:44367/sitemap.xml > _scratch/sitemap-before.xml`, plus the
> section-nav HTML of one article and the header nav. Then work **one file at a time**:
> 1. Delete the `#pragma warning disable/restore CS0618` pair and its TODO comment.
> 2. Run `dotnet build -c Release`. It should fail with CS0618 (RED).
> 3. Switch `.Parent` → `.Parent()` (or `Parent<T>()` where the code casts), and
>    `.Children` → `.Children()`. Replace string-alias `AncestorOrSelf("x")` with the typed
>    `AncestorOrSelf<T>()` model where it is the obsolete overload.
> 4. Build GREEN.
>
> Files:
> - `Views/spellCardRedirect.cshtml:30`
> - `Views/spellbook.cshtml:13`
> - `Views/Author.cshtml:12`
> - `Views/article.cshtml:17`
> - `Views/documentation.cshtml:15`
> - `Views/content.cshtml:13`
> - `Views/Partials/sectionNavigation.cshtml:7`
> - `Views/Partials/xmlSitemap.cshtml:6` and `:35`
> - `Views/Partials/v2/_SiteHead.cshtml:37`
>
> Finally, re-fetch the sitemap and nav HTML and `diff` them against the before files, which must
> be identical. Then run the Step 1 smoke spec plus `tests/e2e/sectionNavigation.spec.ts`,
> `seoRouting.spec.ts` and `pages/spellbook.screenshot.spec.ts`, and
> `dotnet publish src/UmbracoProject -c Release`. Afterwards,
> `grep -rn "pragma warning disable CS0618" src/UmbracoProject/Views` must return nothing. (A bare
> `CS0618` grep also matches an explanatory comment in `_StyleGuideSectionRows.cshtml`.)

**Status (2026-10-22)**: done in `210d7d4`. `AncestorOrSelf("alias")` was kept: the string overload
is not obsolete in 17.6.2 and exists unchanged, without `[Obsolete]`, in 18.2.1.

**What to build**: The 9 view files listed above, with no pragmas left. The before and after
snapshots go in `_scratch/` (gitignored).

**Test first**:
- For each file, removing the pragma makes the build fail with CS0618 (RED).
- The before snapshots of sitemap and nav are the behavioral baseline.

**Validation**:
- [Automated] `dotnet build -c Release` has zero warnings. `grep CS0618` over the views is empty.
  The listed Playwright specs are green. The sitemap and nav HTML diffs are empty.
- [Manual] Open a spell card URL and an author page, and confirm the redirect and the author-list
  breadcrumb behave as before.

---

### Step 4 — Ship Phase A *(operator checkpoint: you run this, not an implement-step worker)*

> **Prompt**: Phase A checkpoint for `_work/umbraco-18-upgrade/plan.md`.
> 1. Confirm `dotnet sln list` shows 4 projects, and that `dotnet build -c Release`,
>    `dotnet test umbraco-17-demo-site.sln --no-build -c Release` and
>    `dotnet publish src/UmbracoProject -c Release` all pass.
> 2. Run `/code-review`.
> 3. Push `claude/feature/umbraco-18-upgrade` to `github` (never `origin`) and open a PR against
>    `robot-denny/ai-sketchlab` titled "Umbraco 18 upgrade, Phase A: v17-safe prep".
> 4. After Gate 1 and Gate 2 go green and it merges, promote Dev → Live in the portal, and spot-check
>    the footer and one article on Live.
> 5. Remove the ROADMAP item `arch-obsolete-api-migration`; it is done.
> 6. Cut `claude/feature/umbraco-18-upgrade-bump` from the updated master for Phase B.

**Validation**: The Phase A PR is merged and live, the smoke spec is green on Dev, and the Phase B
branch exists.

**Status (2026-10-22)**: merged as #72 (`d6713d6`); master pipeline green including the Dev deploy
and Gate 2 (the smoke spec's first run against Dev). Two side PRs landed first: #73 cleared the
October NuGet advisories (pins + named ImageSharp suppressions) and #74 restored CRLF in the host
and HelloWorld csproj so Cloud Sync could apply its 17.7.1 auto-upgrade. ROADMAP
`arch-obsolete-api-migration` removed and the Phase B branch cut. **Remaining operator item:**
promote Dev → Live in the portal and spot-check the footer and one article.

## Phase B — the v18 bump (branch `claude/feature/umbraco-18-upgrade-bump`)

---

### Step 5 — Media recycle-bin protection test (RED on v17)

> **Prompt**: Implement Step 5 of `_work/umbraco-18-upgrade/plan.md` on branch
> `claude/feature/umbraco-18-upgrade-bump`, with the site still on v17 (17.7.1).
>
> Create `tests/e2e/mediaRecycleBin.spec.ts`. Using the Management API helpers in
> `tests/e2e/_umbracoApi.ts`, the test should:
> 1. Upload a small PNG as a new media item and read its public URL.
> 2. Assert an anonymous request (a fresh `request` context with no auth) gets 200.
> 3. Move it to the recycle bin, then assert the anonymous request no longer gets 200 with image
>    content.
> 4. Restore it, and assert 200 again.
> 5. Clean up: delete it permanently in `afterAll`.
>
> On v17, protection is off by default, so step 3 must fail (RED). That is expected: Umbraco 18
> turns `EnableMediaRecycleBinProtection` on by default. Commit the spec with its RED status noted
> in the commit body. Do **not** set the config key; the v18 default is the behavior we're
> adopting. Run it with
> `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/mediaRecycleBin.spec.ts`.

**What to build**: `tests/e2e/mediaRecycleBin.spec.ts`. Add a media-upload, trash and restore
helper to `_umbracoApi.ts` only if those calls don't already exist there.

**Test first**: This step is the test. It is RED on v17 at the "trashed → not served" assertion.

**Validation**:
- [Automated] RED at exactly that assertion, and every other assertion passes.
- The test cleans up after itself, so no orphaned media is left behind.

---

### Step 6 — Bump every package to the v18 line and get the solution compiling

> **Prompt**: Implement Step 6 of `_work/umbraco-18-upgrade/plan.md` on branch
> `claude/feature/umbraco-18-upgrade-bump`.
>
> Back up the local database first: copy the SQLite file under `src/UmbracoProject/umbraco/Data/`,
> or take a SQL backup if local runs on SQL Server. Then update every `PackageReference` in
> `src/UmbracoProject/UmbracoProject.csproj`, `src/UmbracoProject.Features/UmbracoProject.Features.csproj`
> and `src/HelloWorld/HelloWorld.csproj` to the exact versions in the plan's **Target versions**
> table. Use explicit versions, no wildcards. Move the AI family as one unit.
>
> Then run `dotnet build -c Release` and fix every error. TreatWarningsAsErrors is on, so obsolete
> calls count. Expected areas:
> - Clean.Core 8 namespace or API changes in `article.cshtml`, `search.cshtml`, `articleList.cshtml`
>   and `Components/Pagination/Default.cshtml`
> - `Cms.Search` 1.x → 18.x API in `src/UmbracoProject/SearchComposer.cs` and
>   `src/UmbracoProject.Features/Services/Search/SearchService.cs`
> - the beta.9 multi-word NRE guard in SearchService, which can be dropped only if 18.2.0 fixes the
>   bug (keep it if unsure)
> - `Umbraco.AI.Core.Constants.DefaultJsonSerializerOptions` in `AiMarkdownSerializationComposer.cs`
>   (if it no longer compiles, note it for Step 8; don't delete the converter yet)
> - any removed sync service methods (`IDataTypeService`, `IContentTypeService` and others) in
>   `src/HelloWorld/ImageGeneratorController.cs` and `PaletteService.cs`
> - **Advisory pins from #73.** Re-check each against the 18.x graph after restore: `MessagePack`
>   3.1.9 and `System.Security.Cryptography.Pkcs`/`.Xml` 10.0.13 (host, Features, HelloWorld) and
>   `Microsoft.AspNetCore.SignalR.Common` 10.0.13 (Tests). Drop a pin only if
>   `dotnet list umbraco-17-demo-site.sln package --vulnerable --include-transitive` stays clean without
>   it, and never downgrade one (NU1605). Keep the five named ImageSharp `NuGetAuditSuppress` entries:
>   Umbraco 18.2.1 still pins ImageSharp 3.1.12 (ROADMAP `deps-imagesharp-advisories`). Edit
>   csproj files with the Edit tool only. The host and HelloWorld csproj are CRLF, and an LF
>   rewrite breaks master's Cloud Sync step (#74). Verify restore with `--no-http-cache`.
> - **`IPublishedContent.UrlSegment` becomes obsolete in 18.2.1** ("use `GetUrlSegment()` on
>   `IDocumentUrlService`"; removal scheduled for Umbraco 20). With TWAE it fails as CS0618 at
>   `Views/spellCardRedirect.cshtml` (3 uses), `Views/Partials/blocks/Components/spellCardDeck.cshtml`
>   (3) and `Views/Partials/blocklist/default.cshtml` (2). Migrate them to `IDocumentUrlService`
>   (inject it in the view); do not reintroduce a pragma. Confirm the spell-card redirect and deck
>   anchors are unchanged with the Step 1 smoke spec and `pages/spellbook.screenshot.spec.ts`.
>
> Precompiled Razor errors in views surface here too. Remove `HideBackOfficeLogo` and
> `ConfigureSecurityStampOptions` if they appear anywhere (a grep at plan time found neither).
>
> Don't touch npm packages in this step. Finish with `dotnet sln list` (expect 4),
> `dotnet test umbraco-17-demo-site.sln --no-build -c Release` (`SearchComposerTests` must pass), and
> `dotnet publish src/UmbracoProject -c Release`. Update `docs/pinned-betas.md` to say the
> Provider.Examine beta pin is retired.

**What to build**: version edits in the three csproj files, whatever compile fixes they force, and
the `docs/pinned-betas.md` update.

**Test first**: The bump itself is the RED: `dotnet build -c Release` fails until the forced
changes are made. The existing xUnit suite, including `SearchComposerTests`, is the regression
guard.

**Validation**:
- [Automated] Release build with zero warnings, all xUnit tests green, publish succeeds,
  `dotnet sln list` shows 4 projects.
- [Manual] `git diff --stat` touches only the csproj files, the forced code fixes, and
  `pinned-betas.md`.

---

### Step 7 — First local boot: migrations, models, schema

> **Prompt**: Implement Step 7 of `_work/umbraco-18-upgrade/plan.md` on branch
> `claude/feature/umbraco-18-upgrade-bump`, with Step 6 compiled.
>
> Start the site locally (`cd src/UmbracoProject && dotnet run`, serving on `:44367`).
> `UpgradeUnattended: true` runs the v18 migrations on boot, including the now-enabled single-block
> migration. Watch the log for migration errors. Confirm there is no `/umbraco/authorizeupgrade`
> or install screen, log in, and check that the backoffice reports 18.2.1.
>
> Then:
> 1. Regenerate ModelsBuilder output. Use **Settings → ModelsBuilder → Generate models**, or
>    `POST /umbraco/management/api/v1/models-builder/build` via the Management API (see
>    `docs/umbraco-edit.md` for auth). Review the `git diff` under
>    `src/UmbracoProject.Features/Models/Generated/`; expect the version header to change and
>    nothing else.
> 2. Run `git status` on `src/UmbracoProject/umbraco/Deploy/Revision/`. If Deploy rewrote any
>    `.uda`, run `/check-uda` and confirm each change is a v18 serialization change, not drift. The
>    5 Block List data types must still be `Umbraco.BlockList`, since none use single mode. **Never
>    hand-edit the `umbraco-ai-context` `.uda` Resource IDs.**
> 3. Rebuild with `dotnet build -c Release` so the regenerated models compile.
> 4. Run the Step 1 smoke spec, the Step 5 recycle-bin spec, and the full
>    `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test --project=e2e`.
>    Expect the recycle-bin spec to be GREEN now. Screenshot diffs from front-end pages are
>    regressions to investigate. Backoffice-chrome diffs are expected and are handled in Step 9.
>
> Commit the regenerated models and any `.uda` changes, with an explanation in the commit body.

**What to build**: regenerated `*.generated.cs` files, any v18-rewritten `.uda` files, and fixes
for any page the smoke spec flags.

**Test first**: The Step 1 smoke spec and the Step 5 recycle-bin spec were written earlier. This is
the step that turns the recycle-bin spec GREEN.

**Validation**:
- [Automated] The smoke spec is green, the recycle-bin spec is green, and the rest of the
  e2e project is green apart from known backoffice baselines.
- [Manual] The backoffice shows 18.2.1. Open a page in each block editor and confirm the
  blocks load. `/search?q=article` returns results locally.

---

### Step 8 — Markdown and AI copilot under v18

> **Prompt**: Implement Step 8 of `_work/umbraco-18-upgrade/plan.md` on branch
> `claude/feature/umbraco-18-upgrade-bump`, with the site booted on 18.2.1.
>
> v18 makes Markdig 1.x the default `IMarkdownToHtmlConverter` and moves the AI suite to 18.6.0.
>
> **(a) Markdown rendering.**
> - Dev still runs v17 (Phase A) at this point, so use it as the before-state. Fetch the rendered
>   HTML of 2–3 Extended Markdown Editor pages (the `documentation` / `guidePage` /
>   `howToGuidePage` templates) from Dev and from local v18, then diff them after normalizing
>   whitespace.
> - Differences in heading `id`s or tables that break in-page anchors or the guide TOC
>   (`src/UmbracoProject.Features/Services/Guides/GuideToc.cs`, `tests/e2e/guides.spec.ts`) must be
>   fixed in our code. If they can't be fixed cleanly, register `HeyRedMarkdownToHtmlConverter` in a
>   composer as a stopgap, and add a ROADMAP item to remove it before v19.
>
> **(b) AI copilot serialization workaround.**
> - `src/UmbracoProject/AiMarkdownSerializationComposer.cs` appends a `JsonConverter<MarkdownValue>`
>   to the static `Umbraco.AI.Core.Constants.DefaultJsonSerializerOptions`, to stop a Markdig AST
>   `.Parent` cycle crashing at depth 64.
> - Temporarily disable the composer, open a markdown-authored documentation page in the
>   backoffice, and ask the copilot to "summarise this page".
>   - If it answers, the cycle is fixed upstream. Delete the composer and update
>     `docs/project-memory/project_ai_markdown_serialization_cycle.md` and `docs/ai-copilot.md`.
>   - If it crashes, re-enable the composer. Adapt it if the static options moved, confirm the
>     copilot answers, and update the memory note's version line.
>
> Run `dotnet build -c Release`, `dotnet publish src/UmbracoProject -c Release` and
> `npx playwright test tests/e2e/guides.spec.ts`.

**What to build**: any changes to the markdown/TOC code, plus either the deleted or the adapted
`AiMarkdownSerializationComposer.cs`, and the matching doc and memory edits.

**Test first**:
- `tests/e2e/guides.spec.ts` (TOC and anchors) is the existing regression guard. Run it first on
  v18 to see whether it is RED.
- For the copilot, the manual check with the composer disabled is the RED or GREEN signal.

**Validation**:
- [Automated] `guides.spec.ts` and the smoke spec are green.
- [Manual] The copilot summarises a markdown page without an error, and the guide TOC links jump
  to the right headings.

---

### Step 9 — Backoffice extension and E2E tooling on v18

> **Prompt**: Implement Step 9 of `_work/umbraco-18-upgrade/plan.md` on branch
> `claude/feature/umbraco-18-upgrade-bump`.
>
> **(a) HelloWorld client.**
> - In `src/HelloWorld/Client/package.json`, set `@umbraco-cms/backoffice` to `18.2.1`, and
>   retarget the `generate-client` script URL to
>   `https://localhost:44367/umbraco/openapi/helloworld.json` (the v18 route shape). Don't
>   regenerate the client: its `/umbraco/helloworld/api/v1/*` backend doesn't exist.
> - Run `npm i && npm run build`, fix type errors, and commit the built `wwwroot/App_Plugins`
>   output, since Cloud has no npm.
> - Check `src/HelloWorld/Client/src/richtext/manifest.ts`. The `styleMenu` extension uses
>   `overwrites: "Umb.Tiptap.Toolbar.StyleSelect"` through a type cast. Confirm the alias still
>   exists in v18 (grep `node_modules/@umbraco-cms/backoffice` for `Umb.Tiptap.Toolbar.StyleSelect`).
> - In the backoffice, open rich text on a content page and confirm the style menu shows the
>   site's custom styles. Confirm the image-generator dashboard loads and the "Generate image"
>   property action works.
>
> **(b) E2E tooling.**
> - In the root `package.json`, set `@umbraco/playwright-testhelpers` to `18.0.5` and
>   `@umbraco/json-models-builders` to `18.0.2`, then `npm i`.
> - Fix `tests/e2e/auth.setup.ts` or the helpers if the helper APIs changed.
> - Run the full suite:
>   `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test`.
> - Backoffice screenshot diffs that come only from v18 chrome changes are expected. **Don't
>   regenerate baselines locally**: baselines are Linux-only, and you must never commit
>   `*-darwin.png`. List them in the PR for regeneration via `update-snapshots.yml` after review.
>
> Also add a ROADMAP item for the dead HelloWorld template dashboard and generated client.

**What to build**:
- `src/HelloWorld/Client/package.json` and lockfile, any TS fixes, and the rebuilt `App_Plugins`
  output.
- Root `package.json` and lockfile, plus any test-helper fixes.
- The ROADMAP entry.

**Test first**:
- The existing image-generator specs in `tests/e2e/imageGenerator/` are the regression guard. Run
  them after the client rebuild.
- The style-menu check is manual.

**Validation**:
- [Automated] The full Playwright suite is green, apart from listed v18-chrome screenshot
  diffs. `dotnet build -c Release` is green, and the npm build succeeds.
- [Manual] The custom style menu is present, and the image generator produces an image.

---

### Step 10 — Ship Phase B: Dev, then Live *(operator checkpoint: you run this)*

> **Prompt**: Phase B rollout for `_work/umbraco-18-upgrade/plan.md`. Follow these in order.
>
> 1. **Gate locally.** `dotnet sln list` shows 4; `dotnet build -c Release`,
>    `dotnet test umbraco-17-demo-site.sln --no-build -c Release` and
>    `dotnet publish src/UmbracoProject -c Release` pass. Run `/code-review`.
> 2. **Prepare Dev.**
>    - Empty Dev's **media recycle bin**, after reviewing its contents.
>    - In the portal, record the UTC timestamp and confirm Dev's point-in-time window covers it.
>    - Take a manual Dev database backup.
> 3. **Push and open the PR.** Push to `github` (never `origin`). Open the PR "Umbraco 18 upgrade,
>    Phase B: 18.2.1". Gate 1 should be green.
> 4. **Merge, then watch the Dev deploy and Gate 2.**
>    - On 503 or 500.30, the migration didn't finish. Use Cloud's Local Upgrade Option against Dev's
>      database before considering point-in-time recovery.
>    - If `/search` returns "No matches" or a `POST /document` 500 cascade appears, **restart Dev
>      from the portal**; don't rebuild the index. Then `gh run rerun <id> --failed`.
>    - If a terminal verify-timeout appears, run a full `gh run rerun <id>`.
> 5. **Verify Dev.**
>    - The smoke and recycle-bin specs are green in Gate 2.
>    - The backoffice shows 18.2.1.
>    - The Deploy dashboard ("hide up to date" on) shows no out-of-sync schema.
>    - The copilot works on a markdown page.
>    - Regenerate any listed backoffice baselines via `update-snapshots.yml`.
>    - Record whether AI.Search came up cold. That answers `search-cold-serving-health` (a).
> 6. **Prepare Live.**
>    - Announce the content freeze.
>    - Empty Live's media recycle bin, after reviewing its contents.
>    - Record the Live UTC timestamp and confirm the point-in-time window covers it.
>    - Take a manual Live database backup.
> 7. **Promote Dev → Live in the portal.** Verify Live: home, an article, `/search?q=article`, the
>    footer, `/sitemap.xml`, and the backoffice version. Lift the freeze.
> 8. **Rollback, on either environment if it is unrecoverable.** Restore the database to the
>    recorded point in time **and** revert the Phase B merge on master, then redeploy (and
>    re-promote, for Live). Never restore one without the other.

**Validation**: Dev and Live both serve 18.2.1. Gate 1 and Gate 2 are green, there is no Deploy
drift, and the Live spot checks pass.

---

### Final — Record the durable behavior *(a spell you cast, not an implement-step)*

> **Prompt**: Do **not** create or touch any feature doc. Capture the durable record as a runbook
> under `docs/`, and/or a section in the project's guidance file if it is operational guidance.
> Document what the change does and how to operate or reproduce it. Commit the runbook.
>
> Concretely:
>
> 1. **Create `docs/major-upgrades.md`.** It is the reusable runbook for the next major (19, then
>    21 LTS), written from this upgrade. It covers:
>    - the two-phase split, and why
>    - how to verify package versions (NuGet flat-container and nuspec ranges)
>    - local first boot, models regeneration, and `.uda` review
>    - the point-in-time rollback rule: code and database together, empty the recycle bin first
>      because blob renames aren't covered
>    - the Live content freeze
>    - the Dev failure recipes
> 2. **Update `docs/pinned-betas.md`.** Drop the "v18 upgrade path" section and the beta.9 row.
> 3. **Update `docs/search.md`, `docs/ci-failure-recipes.md` and AGENTS.md** to the 18.x search
>    stack and version references.
> 4. **Update the `docs/project-memory/` mirrors and the matching `~/.claude` memories.** That means
>    `project_ai_suite_17_version_alignment` (supersede it with an 18.x alignment note),
>    `project_ai_markdown_serialization_cycle` (per the Step 8 outcome), and
>    `project_ai_1_14_allowed_config_key_prefixes` (re-verify that the allow-list key is still
>    required on AI 18.6).
> 5. **Update ROADMAP.**
>    - Close `deps-ai-search-version-realignment`.
>    - Annotate `search-cold-serving-health` with the Step 10 answer.
>    - Move this increment to "Recently shipped".
>    - Note in `block-editor-parity-and-reuse-readiness` that the v18 exposure item is resolved.
>
> **Validation**: `docs/major-upgrades.md` exists, and no file under `_features/` was touched.

---

## File Summary

| Action | File |
|--------|------|
| Create | `tests/e2e/pages/templateSmoke.spec.ts` |
| Modify | `tests/e2e/footer/updatedFooter.spec.ts` |
| Modify | home page spec under `tests/e2e/pages/` (heading/archive-link assertion) |
| Modify | `src/UmbracoProject/Views/Partials/v2/_Footer.cshtml`, `_LatestSection.cshtml`, `_HeroHome.cshtml` |
| Modify | `src/UmbracoProject/Views/spellCardRedirect.cshtml`, `spellbook.cshtml`, `Author.cshtml`, `article.cshtml`, `documentation.cshtml`, `content.cshtml` |
| Modify | `src/UmbracoProject/Views/Partials/sectionNavigation.cshtml`, `xmlSitemap.cshtml`, `v2/_SiteHead.cshtml` |
| Create | `tests/e2e/mediaRecycleBin.spec.ts` (+ `tests/e2e/_umbracoApi.ts` helpers if missing) |
| Modify | `src/UmbracoProject/UmbracoProject.csproj`, `src/UmbracoProject.Features/UmbracoProject.Features.csproj`, `src/HelloWorld/HelloWorld.csproj` |
| Modify | `src/UmbracoProject/Views/Partials/blocks/Components/spellCardDeck.cshtml`, `Views/Partials/blocklist/default.cshtml` (+ `spellCardRedirect.cshtml` again) — `UrlSegment` → `IDocumentUrlService` |
| Modify (as forced) | `src/UmbracoProject/SearchComposer.cs`, `src/UmbracoProject.Features/Services/Search/SearchService.cs`, Clean.Core-using views, `src/HelloWorld/ImageGeneratorController.cs`, `src/HelloWorld/PaletteService.cs` |
| Modify or Delete | `src/UmbracoProject/AiMarkdownSerializationComposer.cs` |
| Regenerate | `src/UmbracoProject.Features/Models/Generated/*.generated.cs` |
| Modify (if v18 rewrites) | `src/UmbracoProject/umbraco/Deploy/Revision/*.uda` |
| Modify | `src/HelloWorld/Client/package.json` + lockfile, built `App_Plugins` output |
| Modify | root `package.json` + lockfile, `tests/e2e/auth.setup.ts` / helpers if needed |
| Create (scratch, not committed) | `_scratch/sitemap-before.xml`, nav HTML snapshots |
| Modify | `ROADMAP.md`, `AGENTS.md`, `docs/pinned-betas.md`, `docs/search.md`, `docs/ci-failure-recipes.md`, `docs/ai-copilot.md`, `docs/project-memory/*` |
| _(work type: `fix-infra`)_ Create | `docs/major-upgrades.md` runbook (**no feature doc**) |
