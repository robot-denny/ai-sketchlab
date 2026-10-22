# Spec for umbraco-18-upgrade

> This spec captures initial requirements and design rationale. For **current system
> behavior**, see the doc named on the **Work type** line below — a new feature doc for a new
> capability, an existing feature doc for a change, or a `docs/` runbook for a fix.

branch: claude/feature/umbraco-18-upgrade
design reference (if any): none

**Work type**: fix-infra
**Feature doc**: none
<!--
  Classified fix-infra: a platform upgrade whose acceptance criteria are transitions ("builds on
  v18", "nothing the visitor sees changes", "the grandfathering pragmas are gone"). No capability is
  added or changed on purpose. The one operator-observable side effect — trashed media is no longer
  publicly reachable — is a platform default, recorded in docs/media.md rather than a feature doc.
  Durable record: a new upgrade runbook under docs/, plus updates to docs/pinned-betas.md,
  docs/search.md, AGENTS.md, and the project-memory entries that say "revisit on v18".
-->

## Summary

Move the site from **Umbraco 17.6.2 (LTS)** to **Umbraco 18** across all three projects (host,
`UmbracoProject.Features` RCL, `HelloWorld` backoffice extension), the add-on suites (Deploy, Forms,
Cloud, AI, Cms.Search, Cloud storage), and the third-party packages (`Clean.Core`,
`jcdcdev.Umbraco.ExtendedMarkdownEditor`). Then promote it local → Dev → Live without any visible
regression for visitors or content editors.

The site is already prepared for this in several ways:

- It is on 17.x, which is above the v18 floor: "Umbraco 18 can only upgrade from 16.4 or later".
- `CS0618` is a build gate, and every remaining obsolete call site is fenced with a scoped `#pragma`
  (9 Razor files).
- The 404 content finder already uses `IDocumentNavigationQueryService`.
- No data type uses Block List single mode. All 5 Block List data types have
  `useSingleBlockMode: false`.
- The custom image-generator API is already a plain `[ApiController]`, not an `UmbracoApiController`.

The upgrade still has work to do in five areas:

- **Removed APIs.** v18 removes `IPublishedContent.Parent`/`.Children`, `GetAtRoot()`, and the
  obsolete sync service methods. This absorbs ROADMAP `arch-obsolete-api-migration`.
- **OpenAPI.** Swashbuckle is replaced by Microsoft.AspNetCore.OpenApi. `/umbraco/swagger/...`
  moves to `/umbraco/openapi/{doc}.json`, and the output is OpenAPI 3.1.
- **Changed defaults.** `GetDictionaryValue` now returns a non-null `string`. Markdig 1.x is the
  default Markdown converter. Media recycle-bin protection is on by default.
- **Search stack realignment.** Today it runs `Cms.Search.* 1.0.0` and `Provider.Examine
  1.0.0-beta.9`. It moves to the unified 18.x line, which absorbs `deps-ai-search-version-realignment`.
- **Cloud promotion.** `UpgradeUnattended: true` means each environment runs the v18 migrations,
  including the now-enabled single-block migration, on first boot after deploy.

Reference: [Version-specific upgrades → 17 to 18](https://docs.umbraco.com/umbraco-cms/get-started/upgrading-and-migrating/version-specific),
[Single block migration](https://docs.umbraco.com/umbraco-cms/get-started/upgrading-and-migrating/find-your-upgrade-path/single-block-migration),
and the [labelled 18.0.0 breaking-change PRs](https://github.com/umbraco/Umbraco-CMS/pulls?q=is:pr+label:category/breaking+is:closed+label:release/18.0.0).

## Functional Requirements

### Package and toolchain alignment
- Every `Umbraco.Cms.*` reference across the three projects sits on one explicit 18.x version. No
  wildcards: Cloud's deploy validator rejects `Version="*"`.
- Every add-on suite moves to its v18-compatible line:
  - Deploy, Forms, Forms.Deploy
  - Cloud.Cms, Cloud.StorageProviders.AzureBlob
  - the whole `Umbraco.AI.*` family
  - `Umbraco.Cms.Search.*`, including retiring the `Provider.Examine` beta pin
  - `Umbraco.AI.Search`

  Each suite moves as a unit, never mixed across majors.
- `jcdcdev.Umbraco.ExtendedMarkdownEditor` moves to its 18.x line, which requires
  `Umbraco.Cms [18.0.0,19.0.0)`. `Clean.Core` moves to a v18-compatible version, or it is removed
  if nothing still depends on it.
- The backoffice extension's `@umbraco-cms/backoffice` dependency and the E2E suite's
  `@umbraco/playwright-testhelpers` move to their v18 lines.
- The target framework and the CI SDK (`setup-dotnet`) match what Umbraco 18 requires.

### Removed and changed APIs
- **Published content.** Every view and helper that uses the removed `.Parent` / `.Children`
  properties or `GetAtRoot()` moves to the supported replacement: the `Parent()`/`Children()`
  extensions in requests, the navigation query services outside them. That covers the 9 files with
  `CS0618` pragmas, and `PaletteService` once its extension-method calls have been re-checked.
  Every grandfathering `#pragma warning disable CS0618` is removed, so the build proves each file
  is clean.
- **Dictionary labels.** Labels that relied on `GetDictionaryValue(...) ?? "fallback"` still show a
  sensible label after the return type becomes non-null. Footer "Publication"/"Elsewhere", the home
  "The latest" heading, the archive link, and the hero eyebrow must not go blank when a dictionary
  item is missing.
- **Markdown rendering.** Markdown-rendered content still renders correctly now that Markdig is the
  default converter. This covers Extended Markdown Editor pages and the AI markdown serialization
  converter (`AiMarkdownSerializationComposer`, marked "REVISIT on any Umbraco.AI upgrade"). Each
  is either re-verified or removed if v18 / AI 18.x fixes the object-cycle at source.
- **OpenAPI client.** The HelloWorld OpenAPI client-generation script points at the new
  `/umbraco/openapi/...` URL, or it is removed if the generated client is unused. Any OpenAPI
  document registration builds under the new Microsoft.AspNetCore.OpenApi model; if the RCL
  registers documents, that includes the `InterceptorsNamespaces` csproj addition.
- **Configuration.** No configuration key that v18 removed stays in `appsettings*.json`, for
  example `HideBackOfficeLogo`. Any explicit registration v18 no longer needs is removed, for
  example `ConfigureSecurityStampOptions`.

### Data and schema
- The single-block migration runs cleanly on every environment and leaves all 5 Block List data
  types and their content unchanged, because none use single mode.
- Any Deploy schema (`.uda`) changes the v18 migrations produce are regenerated and committed, so
  local, Dev, and Live hold no unexplained drift after the upgrade.
- The committed ModelsBuilder output (`SourceCodeManual`) is regenerated on v18. The diff is
  reviewed and committed.
- Media in the recycle bin is no longer publicly reachable. The media recycle bin is emptied, or
  its contents reviewed, before each environment upgrades.

### Promotion
- The upgrade goes local → Dev (through the GitHub Actions pipeline, Gate 1 + Gate 2) → Live. It
  never goes direct to Live.
- `dotnet publish` succeeds locally before any push. The RCL/host duplicate-schema collision
  (NETSDK1152) only shows up on publish.

### Documentation
- A runbook records the upgrade: order of operations, Cloud specifics, rollback, and the
  verification checklist.
- `docs/pinned-betas.md` "v18 upgrade path", `docs/search.md`, `docs/ci-failure-recipes.md`,
  AGENTS.md, and the project-memory entries that say "revisit on v18" are updated to reflect the
  new state.
- The ROADMAP items this work absorbs or answers are moved, closed, or re-scoped:
  - `arch-obsolete-api-migration`
  - `deps-ai-search-version-realignment`
  - `search-cold-serving-health`, questions (a)–(c)

## Possible Edge Cases

- **Runtime-only Razor failures on Cloud.**
  - Cloud's first-request Razor compile honors TWAE but ignores `NoWarn`. A view that builds
    locally can still 500 on Dev.
  - Nullable annotations (`string?`) in `.cshtml` trigger CS8669 at runtime compile.
  - Every page template has to be hit on Dev, not just built.
- **Silent fallback change.** `?? "Publication"` against a non-null `string` doesn't fail the
  build. It just stops ever applying, and if the dictionary key is missing on an environment, the
  label renders empty, or as the key itself.
- **Unattended migrations on boot.** With `UpgradeUnattended: true`, a failed migration on Dev
  leaves the environment in an upgrade-required state. Rolling back means a database restore, not
  just a code revert.
- **Add-on version skew.** An add-on (Forms, Deploy, AI, Search, Clean.Core, ExtendedMarkdownEditor)
  may have no v18-compatible release yet, or only a prerelease. That would block the upgrade or
  force a pinned beta, which is recorded in `docs/pinned-betas.md`.
- **Search cold-serving.**
  - After the Dev deploy, AI.Search may come up cold. The known remedy is a Portal restart, not an
    index rebuild.
  - The realigned 18.x search stack may change this behavior, the readiness-gate marker, or the
    `SearchComposer` / `SearchService` API surface.
  - The beta.9 multi-word `NullReferenceException` guard may become unnecessary.
- **Deploy schema churn.** The v18 migrations may rewrite data-type `.uda` files, for example new
  config keys or the Single Block editor alias. The `umbraco-ai-context` `.uda` Resource IDs are
  Cloud-managed and must not be hand-edited during reconciliation.
- **Silent project drop.** C# Dev Kit can strip a project from the `.sln` during a fast git rewrite.
  Check `dotnet sln list` shows 4 projects before trusting a green build.
- **Backoffice extension drift.** The TipTap `styleMenu` override of
  `Umb.Tiptap.Toolbar.StyleSelect` uses an `overwrites` cast the manifest type doesn't declare. A
  v18 alias or overwrite-semantics change would silently restore the default style menu.
- **Copilot on markdown pages.** If AI 18.x changes its static serializer options, the
  `MarkdownValue` converter either becomes redundant or stops being consulted. In the second case
  the depth-64 crash returns.
- **Playwright helper drift.** The E2E suite pins `@umbraco/playwright-testhelpers 17.1.0-beta.7`.
  Moving to v18 helpers may change login and API helpers, and the backoffice DOM may move enough
  to diff screenshot baselines. Regenerate baselines only via `update-snapshots.yml`, after the
  change is confirmed intentional.

## Acceptance Criteria

1. The solution (4 projects) builds and `dotnet publish`es with zero warnings on Umbraco 18. It
   has no `CS0618` grandfathering pragmas left, and no wildcard package versions.
2. Every page template on the site renders for a visitor on local and on Dev with the same content
   as before the upgrade: home, article list, article, author, author list, content,
   documentation, spellbook, spell-card redirect, search, sitemap, and 404.
3. Section navigation, the site header nav, the footer, and the XML sitemap list the same pages as
   before the upgrade.
4. Labels sourced from the dictionary display the same text as before the upgrade, including where
   a fallback label applies.
5. A visitor can search from `/search` and get relevant results on Dev after deploy.
6. A content editor can edit and publish pages that use block lists, the block grid, rich text
   (with the custom style menu), and the Extended Markdown Editor, and the result renders
   unchanged.
7. The editor-facing extensions still work: the image-generator dashboard and property action, the
   HelloWorld dashboard, and the AI copilot (including on a markdown page).
8. A media item moved to the recycle bin is no longer reachable by an anonymous visitor at its URL.
   Restoring it makes it reachable again.
9. The upgrade runs on Dev and then Live through the pipeline. Gate 1 and Gate 2 are green, and
   there is no new Deploy schema drift between environments.
10. The upgrade runbook exists, and the docs, memories, and ROADMAP items listed above reflect the
    post-upgrade state.

## Scenarios (Draft)

Draft BDD scenarios derived from the acceptance criteria using Example Mapping. Each Rule maps
to an acceptance criterion; scenarios use concrete examples. These get verified and refined
after implementation — the feature doc holds the verified version.

### Rule: Every page renders as it did before the upgrade (AC 2)

```scenario
Scenario: A visitor reads an article on the upgraded site
  Given the site is running Umbraco 18 on Dev
  And the article "Building a Spell Card Deck" was published before the upgrade
  When a visitor opens that article
  Then the page loads without error
  And it shows the same title, author byline, and body as before the upgrade
```

```scenario
Scenario: A spell card's redirect still lands on its spellbook
  Given the spellbook "Cantrips" contains the spell card "Mage Hand"
  When a visitor opens the "Mage Hand" spell card URL
  Then they are taken to the "Cantrips" spellbook page with "Mage Hand" in view
```

```scenario
Scenario: A missing page still shows the site's 404 page
  Given no page exists at "/this-page-does-not-exist"
  When a visitor opens "/this-page-does-not-exist"
  Then they see the site's custom "not found" page with a 404 status
```

### Rule: Navigation and the sitemap list the same pages (AC 3)

```scenario
Scenario: Section navigation lists an article's siblings
  Given the "Articles" section contains 12 published articles
  When a visitor opens any one of those articles
  Then the section navigation lists the same 12 articles in the same order as before the upgrade
```

```scenario
Scenario: A hidden page stays out of the sitemap
  Given the "Style Guide" page is ticked "Hide in navigation"
  When a search engine requests "/sitemap.xml"
  Then the sitemap lists every page it listed before the upgrade
  And it does not list "Style Guide" or any page beneath it
```

### Rule: Dictionary labels show the same text, including fallbacks (AC 4)

```scenario
Scenario: A footer heading with a dictionary entry
  Given the dictionary item "Footer.PublicationHeading" is "The Sketchlab"
  When a visitor views any page footer
  Then the publication column heading reads "The Sketchlab"
```

```scenario
Scenario: A footer heading with no dictionary entry falls back
  Given the dictionary item "Footer.ElsewhereHeading" does not exist on the environment
  When a visitor views any page footer
  Then the second column heading reads "Elsewhere"
  And it is not blank and does not show "Footer.ElsewhereHeading"
```

### Rule: Site search returns relevant results after deploy (AC 5)

```scenario
Scenario: A visitor searches for a known topic
  Given the upgrade has just deployed to Dev
  And at least 10 published articles mention "article"
  When a visitor searches for "article" from /search
  Then at least 10 matching pages are listed
```

```scenario
Scenario: A multi-word search does not error
  When a visitor searches for "spell card deck" from /search
  Then the results page loads without error
```

### Rule: Content editors can author and publish as before (AC 6)

```scenario
Scenario: An editor adds a block to a page
  Given a content editor is editing the "About" page
  When they add an "Alert Banner" block with the text "Maintenance tonight" and publish
  Then the "About" page shows an alert banner reading "Maintenance tonight"
```

```scenario
Scenario: An editor applies a custom rich text style
  Given a content editor is editing rich text on a content page
  When they open the style menu
  Then they see the site's custom styles, not the default style list
```

```scenario
Scenario: An editor updates a markdown-authored page
  Given a documentation page authored in the markdown editor
  When a content editor changes a heading to "Getting Started" and publishes
  Then visitors see "Getting Started" rendered as a heading with the rest of the page unchanged
```

### Rule: Editor-facing extensions keep working (AC 7)

```scenario
Scenario: An editor generates a featured image
  Given a content editor is editing an article with no featured image
  When they use the "Generate image" action on the image field
  Then a generated image is attached to the article
```

```scenario
Scenario: The copilot works on a markdown page
  Given a content editor has a markdown-authored documentation page open
  When they ask the AI copilot to "summarise this page"
  Then the copilot replies with a summary instead of an error
```

### Rule: Trashed media is not publicly reachable (AC 8)

```scenario
Scenario: A visitor cannot open trashed media
  Given the image "old-hero.jpg" was publicly reachable at its media URL
  When a content editor moves "old-hero.jpg" to the recycle bin
  Then an anonymous visitor requesting that URL does not receive the image
```

```scenario
Scenario: Restored media becomes reachable again
  Given "old-hero.jpg" is in the media recycle bin
  When a content editor restores it
  Then an anonymous visitor can open "old-hero.jpg" at its original URL again
```

### Rule: The upgrade reaches Live through the pipeline without drift (AC 9)

```scenario
Scenario: Dev upgrades on deploy
  Given the upgrade is merged to master
  When the pipeline deploys to Dev
  Then Dev completes its upgrade on first boot without an "upgrade required" screen
  And Gate 2's end-to-end checks pass
  And the Deploy dashboard shows no schema items out of sync with the repository
```

## Open Questions

- **Exact target version.** Which Umbraco 18.x minor (and matching Deploy, Forms, Cloud, AI,
  Search lines) is current and supported on Umbraco Cloud at the time `/plan` runs? Does Cloud
  require a portal-side opt-in or "major upgrade" step before a v18 deploy will be accepted?
- **.NET target.** The upgrade page doesn't state the required .NET version. Confirm whether
  Umbraco 18 stays on `net10.0` or needs a newer SDK, since that decides whether TFM and CI change.
- **Add-on readiness.**
  - Do `Clean.Core` and `jcdcdev.Umbraco.ExtendedMarkdownEditor` have stable v18 releases?
  - Does anything still use `Clean.Core`, or can it simply be removed?
  - Is the `Cms.Search` Examine provider GA on 18.x, retiring the beta pin?
- **Delivery and timing.** Should this be one increment, or split into a pre-upgrade increment on
  v17 and the version bump itself? The pre-upgrade work would remove the CS0618 pragmas through
  the extension methods, fix the dictionary fallbacks, and empty the recycle bin. Splitting
  shrinks the v18 PR and lets the prep ship to Live early.
- **Generated OpenAPI client.** Is the HelloWorld generated OpenAPI client (`src/api/*.gen.ts`)
  used at all? The image-generator UI calls `/umbraco/api/image-generator` directly, so the
  client and its generation script may be removable rather than migrated.
- **Markdown output.** Does Markdig 1.x change rendered HTML for any existing markdown or rich
  text content, for example heading IDs or table markup? If so, is that acceptable, or do we
  register the deprecated HeyRed converter until v19?
- **Recycle-bin protection.** Is the new default acceptable for this site, or does any page or
  test deliberately link to trashed media? Should the media recycle bin be emptied on Live before
  the upgrade, and who signs off on that?
- **Rollback.** What is the rollback plan on Dev and Live if the unattended migration fails? Does
  Umbraco Cloud's environment backup/restore cover a major-version rollback?
- **Elements.** Is the "Umbraco 18 Elements" migration for spell cards (`_features/spell-card-deck.md`)
  explicitly out of scope here? Assumed yes: it is a follow-on `change-to spell-card-deck`.
- **Search warmup.** Are `search-cold-serving-health` questions (a)–(c) answered as part of
  verifying this upgrade, or spun into their own increment once the stack is realigned?

## Testing Guidelines

Meaningful tests for the cases below, without going too heavy:

- **Build gate.** Gate 1 already enforces a zero-warning build (TWAE, CS0618). Rely on it, and add
  a `dotnet publish` check to the local verification steps in the runbook.
- **Rendering smoke.** Add or extend a Playwright smoke test that visits one published page of
  every template (the AC 2 list) and asserts a 200 plus its key heading. It runs on Dev in Gate 2,
  which catches Cloud's runtime-only Razor failures.
- **Navigation and sitemap.** Assert section-nav sibling counts and that a hidden page is absent
  from `/sitemap.xml`. Extend existing section-navigation and SEO/routing specs where they exist.
- **Dictionary fallback.** Add an xUnit or view-level test that a missing dictionary key renders
  the fallback label. This is the one behavior that can regress silently with a green build.
- **Search.** Reuse the existing Gate 2 search warmup/readiness checks, plus one multi-word query.
- **Recycle-bin protection.** One E2E test using the Management API: upload media, read its URL
  anonymously, trash it, then assert it is no longer served.
- **Editor extensions.** Keep the existing image-generator and backoffice E2E coverage, updated for
  the v18 test helpers. Verify the copilot-on-markdown and style-menu checks manually and record
  them in the runbook checklist, rather than automating them.
- **Visual baselines.** Expect screenshot diffs only where v18 changes backoffice chrome. Regenerate
  them via `update-snapshots.yml` after review, never to make a red run green.
