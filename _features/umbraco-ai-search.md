# Feature: Site Search

Visitors can search the site's content from the `/search` page by typing a query and pressing the search button. Results show the page title, optional subtitle, and — for articles — the author and publish date, linking directly to each matching page. Search combines keyword matching with semantic understanding so that paraphrased queries ("how do I get started with this site") surface relevant pages even when none of the query's words appear on the page.

**Source spec**: _(none — plan drafted directly from conversation 2026-04-21; see `_plans/shipped/umbraco-ai-search.md`)_
**Last verified**: 2026-04-22

---

## Behaviors

### Rule: Visitors can run a search from the /search page

```scenario
Scenario: The search page renders the form when no query is supplied
  Given a visitor navigates to /search with no query string
  When the page loads
  Then a search form is visible
  And a text input for the query is visible
  And a search button is visible
  And no result listings appear
```

```scenario
Scenario: Submitting a query returns matching pages
  Given a visitor is on /search
  When the visitor submits the query "article"
  Then at least one result appears on the page
  And each result links to the matching page
```

### Rule: Results exclude internal and system pages

```scenario
Scenario: System doc-type pages are filtered out of results
  Given a visitor submits a broad query that matches many pages
  When the results are rendered
  Then no result links to the Search page itself
  And no result links to the Error page
  And no result links to the XML sitemap
  And no result links to a Category or Category List page
```

### Rule: Article results display author attribution and publish date

```scenario
Scenario: Article result shows "Posted by {author} on {date}"
  Given a visitor submits a query that matches at least one article
  When the results are rendered
  Then each article result shows a post-meta line
  And the post-meta line contains the word "Posted"
  And the post-meta line contains the article's publish year
  And the post-meta line contains the author's name
```

```scenario
Scenario: Non-article results do not render a post-meta line
  Given a result is a page type that is not an article (e.g. Content page)
  When the result is rendered
  Then no post-meta line appears beneath it
```

### Rule: The result link shows the page's title, falling back to the page name

```scenario
Scenario: Title property is used when present
  Given a matching page has a "title" field set to "Getting Started"
  When the result is rendered
  Then the result heading shows "Getting Started"
```

```scenario
Scenario: Page name is used when title is blank
  Given a matching page has no "title" field (or it is blank)
  When the result is rendered
  Then the result heading shows the page's backoffice Name
```

```scenario
Scenario: Subtitle is shown when present
  Given a matching page has a non-empty "subtitle" field
  When the result is rendered
  Then the subtitle appears beneath the title
```

### Rule: Paraphrased queries return semantically relevant pages

```scenario
Scenario: A paraphrased onboarding query surfaces the welcome page
  Given the site has an introductory page whose title contains "Welcome", "Getting Started", "Introduction", or "Introducing"
  And that page's body never uses the phrase "how do I get started with this site"
  When a visitor submits the query "how do I get started with this site"
  Then at least one result is returned
  And at least one result's title matches one of: welcome, getting started, introduction, introducing
```

### Rule: Short exact-match queries fall back to keyword search when semantic search returns nothing

```scenario
Scenario: Keyword fallback fills in for short exact-match queries
  Given a visitor submits a short, exact-match query (e.g. an author name or "contact")
  And the AI/semantic searcher returns zero results for it
  When the page renders
  Then the Examine keyword searcher is queried as a fallback
  And results from the keyword searcher are shown in place of an empty result list
```

### Rule: The query is shown back to the visitor safely (no script execution)

```scenario
Scenario: A query containing a <script> tag is HTML-encoded in the results line
  Given a visitor submits the query "<script>alert(1)</script>"
  When the page renders
  Then no alert dialog appears
  And no <script> element is injected inside the search form
  And the "Results for..." line displays the query as plain text
```

### Rule: The result count and echoed query appear above the result list

```scenario
Scenario: The results line shows the total count and the submitted query
  Given a visitor submits the query "article"
  And three matching pages are returned
  When the page renders
  Then a localized "Results for..." line appears above the result list
  And the line shows the number 3
  And the line shows the query "article"
```

---

## Edge Cases

### Rule: No results is a valid outcome

```scenario
Scenario: A query that matches nothing in either searcher shows an empty result list
  Given a visitor submits a query that matches no published content semantically or by keyword
  When the page renders
  Then the "Results for..." line shows a count of 0
  And no .post-preview entries appear
  And the search form remains visible so the visitor can refine the query
```

### Rule: Only published documents are returned

```scenario
Scenario: Unpublished or non-document entries are excluded
  Given the search index also contains non-document object types (e.g. media, members)
  When a query matches entries of mixed object types
  Then only entries whose object type is "Document" are rendered
  And unpublished documents are not rendered (publishedContentQuery returns null for them and they are filtered out)
```

### Rule: Index state is environment-local on Umbraco Cloud

```scenario
Scenario: A freshly deployed environment has an empty index until rebuilt
  Given the site has just been deployed to an Umbraco Cloud environment
  And the AI search index has not yet been rebuilt in that environment
  When a visitor submits any query
  Then the AI searcher returns zero results
  And the Examine keyword fallback determines what the visitor sees
  And an operator must rebuild the index from Settings → Search to restore semantic matches
```

---

## Test Coverage

| Scenario | Test File | Status |
|----------|-----------|--------|
| Search page renders the form when no query is supplied | [tests/e2e/search.spec.ts:13](tests/e2e/search.spec.ts#L13) | Covered |
| Submitting a query returns matching pages | [tests/e2e/search.spec.ts:25](tests/e2e/search.spec.ts#L25) | Covered |
| System doc-type pages are filtered out | [tests/e2e/search.spec.ts:33](tests/e2e/search.spec.ts#L33) | Covered |
| Article result shows Posted + author + date | [tests/e2e/search.spec.ts:59](tests/e2e/search.spec.ts#L59) | Covered |
| Non-article results skip post-meta | — | Not covered (verified manually via view source at [search.cshtml:75-91](src/UmbracoProject/Views/search.cshtml#L75-L91)) |
| Title property used when present | — | Not covered (verified manually; logic at [search.cshtml:68](src/UmbracoProject/Views/search.cshtml#L68)) |
| Page name used when title is blank | — | Not covered (verified manually; logic at [search.cshtml:68](src/UmbracoProject/Views/search.cshtml#L68)) |
| Subtitle rendered when present | — | Not covered (verified manually; logic at [search.cshtml:70-73](src/UmbracoProject/Views/search.cshtml#L70-L73)) |
| Paraphrased query returns semantic match | [tests/e2e/search.spec.ts:102](tests/e2e/search.spec.ts#L102) | Covered |
| Keyword fallback when AI searcher returns zero | — | Not covered by an E2E test — the fallback path is exercised by [search.cshtml:54-57](src/UmbracoProject/Views/search.cshtml#L54-L57) but no test currently forces the AI searcher to return empty |
| XSS: script payload is HTML-encoded | [tests/e2e/search.spec.ts:77](tests/e2e/search.spec.ts#L77) | Covered |
| Results line shows count + echoed query | — | Not covered (localized "Results for..." line driven by `Search.Results` dictionary entry at [search.cshtml:60](src/UmbracoProject/Views/search.cshtml#L60)) |
| No results is a valid outcome | — | Not covered (empty-result path is implicitly exercised by the XSS test which returns 0 results but asserts XSS, not count 0) |
| Only published documents are returned | — | Not covered — filter at [search.cshtml:45-47](src/UmbracoProject/Views/search.cshtml#L45-L47) (`ObjectType == Document` + `publishedContentQuery.Content` null-check) |
| Environment-local index state on Cloud | — | Not covered by an E2E test (operational behavior — documented in [CLAUDE.md](CLAUDE.md) "Search → Umbraco Cloud deploys") |

---

## Revision Notes

- 2026-04-22: Initial feature doc, created retroactively after Step 7 of `_plans/shipped/umbraco-ai-search.md` shipped the AI-backed search. Scenarios reflect current behavior of [src/UmbracoProject/Views/search.cshtml](src/UmbracoProject/Views/search.cshtml) and test assertions in [tests/e2e/search.spec.ts](tests/e2e/search.spec.ts).
