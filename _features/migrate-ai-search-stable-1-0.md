# Feature: Migrate AI + Search Stack to Stable 1.0.0

Editors keep working AI Copilot assistance and the public site keeps a working search page, but the underlying AI and search components moved off pre-release builds onto their first stable releases — removing most of the version-pinning workarounds the team had been carrying.

**Source spec**: `_specs/migrate-ai-search-stable-1-0.md`
**Last verified**: 2026-06-16

---

## Increments

- [x] 2026-06-16 — Migrate AI family + search stack to stable 1.0.0; keep Provider.Examine on beta.9; allow-list AI config keys for `Umbraco.AI 1.14.0`; guard the keyword-fallback path; collapse the Pinned-betas guidance to one row (spec: `_specs/migrate-ai-search-stable-1-0.md`)

---

## Behaviors

### Rule: The site builds and its tests pass on the stable AI + search stack

```scenario
Scenario: Project compiles on the stable stack with zero warnings
  Given the project references the stable 1.0.0 AI and search packages (Umbraco.AI 1.14.0, Cms.Search.* / AI.Search 1.0.0, Provider.Examine 1.0.0-beta.9)
  When a developer runs a Release build
  Then the build succeeds with zero warnings under treat-warnings-as-errors
  And all unit tests pass
```

### Rule: AI features resolve their API keys from the configured secret references

```scenario
Scenario: Semantic search embeds the query successfully
  Given the AI connection references its key as $OpenAI:ApiKey
  And the OpenAI prefix is on the AI config-key allow-list
  When a visitor runs a natural-language search on /search
  Then the query is embedded and AI-semantic results are returned
```

```scenario
Scenario: A missing allow-list entry would break embeddings
  Given an AI connection references $OpenAI:ApiKey
  And the OpenAI prefix is NOT on the allow-list
  When the embedding service tries to resolve the key
  Then resolution is rejected and semantic search silently returns nothing
  And the site must add OpenAI/Anthropic to the allow-list to restore it
```

### Rule: The public search page returns relevant results in both modes

```scenario
Scenario: A short query runs keyword search
  Given the search index has published content
  When a visitor searches for a single term like "contact"
  Then keyword results are shown with the mode labelled "Keyword"
```

```scenario
Scenario: A natural-language query runs AI semantic search
  Given the AI vector index has been rebuilt with published content
  When a visitor searches a multi-word phrase like "stories about resilience"
  Then semantically related results are shown with the mode labelled "AI semantic"
```

### Rule: A search that finds nothing degrades gracefully instead of erroring

```scenario
Scenario: A nonsense query shows the empty state, not a server error
  Given a long query with no semantic or keyword matches
  When a visitor submits it on /search
  Then the page shows the "no matches" empty state
  And the request does not return a server error
```

### Rule: The backoffice search surfaces work on the stable stack

```scenario
Scenario: Settings → Search opens
  Given the search stack is on stable 1.0.0
  When an administrator opens Settings → Search
  Then the page lists the search index without throwing
```

```scenario
Scenario: Media list-view search returns results
  Given the search stack is on stable 1.0.0
  When an editor searches the Media section list view
  Then matching media items are listed without an Examine field-name error
```

### Rule: The vector index rebuilds with content

```scenario
Scenario: Rebuilt index has documents
  Given a default embedding profile is configured
  When an administrator rebuilds the UmbAI_Search index
  Then the index finishes with a document count greater than zero
```

### Rule: Project guidance reflects the post-migration reality

```scenario
Scenario: Pinned-betas guidance is reduced to the one remaining pin
  Given the migration to stable is complete
  When a developer reads CLAUDE.md
  Then the "Pinned betas" table lists only Provider.Examine 1.0.0-beta.9
  And the AI config-key allow-list requirement is documented
  And the package version lists match the project file
```

---

## Edge Cases

### Rule: The keyword fallback tolerates an upstream provider defect

```scenario
Scenario: Provider.Examine NRE on a multi-word fallback query is contained
  Given AI semantic search returns no hits for a long query
  And the keyword fallback hits the Provider.Examine beta.9 multi-word-query defect
  When the searcher throws
  Then the search service treats it as zero hits and the page shows the empty state
  And the page does not return a 500
```

---

## Test Coverage

| Scenario | Test File | Status |
|----------|-----------|--------|
| Project compiles with zero warnings / tests pass | Gate 1 (`dotnet build -c Release` + xUnit) | Covered (CI) |
| Config section binds to the search options | `tests/UmbracoProject.Tests/SearchComposerTests.cs:17` | Covered |
| A short query runs keyword search | `tests/e2e/search.spec.ts:122` | Covered |
| A natural-language query runs AI semantic search | `tests/e2e/search.spec.ts:139` | Covered (skips without embedding key/index) |
| Semantic match on a paraphrased query | `tests/e2e/search.spec.ts:195` | Covered (skips without index) |
| Nonsense query shows the empty state, not a 500 | `tests/e2e/search.spec.ts:28` | Covered |
| Provider.Examine NRE on fallback is contained | `tests/e2e/search.spec.ts:28` | Covered |
| Semantic search embeds the query successfully | `tests/e2e/search.spec.ts:139` | Covered (manual-verified locally; E2E skips without key) |
| Settings → Search opens | — | Manual (verified 2026-06-16) |
| Media list-view search returns results | — | Manual (verified 2026-06-16) |
| Rebuilt index has documents | — | Manual (verified 2026-06-16, 178 docs) |
| Pinned-betas guidance reduced / allow-list documented | — | Doc change (not test-covered) |

---

## Revision Notes

- 2026-06-16: Draft scenarios from initial spec
- 2026-06-16: Verified against implementation. Removed Draft banner. Added the AI config-key allow-list behavior (`Umbraco.AI 1.14.0` requires `$OpenAI:ApiKey` prefixes to be allow-listed — discovered during the runtime gate) and the keyword-fallback graceful-degradation rule (guards a Provider.Examine beta.9 multi-word-query NRE). Confirmed `AddBackOfficeSearch()` stays enabled (the beta.3 crash is fixed in 1.0.0). Backoffice scenarios (Settings → Search, list-view search, index rebuild) verified manually; public-search scenarios covered by `tests/e2e/search.spec.ts`.
