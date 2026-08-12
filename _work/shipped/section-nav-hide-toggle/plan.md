# Plan: Section Navigation Hide Toggle

**Spec**: `_specs/section-nav-hide-toggle.md`
**Branch**: `claude/feature/section-nav-hide-toggle`
**Work type**: change-to section-navigation — carried from the spec; the final step folds behavior into `_features/section-navigation.md` (no new feature doc).

## Context

Section navigation renders a contextual sidebar of sibling + child pages. Two separate compositions cooperate: **`sectionNavigationControls`** carries the `showSectionNavigation` enable-toggle (the view templates [content.cshtml](src/UmbracoProject/Views/content.cshtml) / [documentation.cshtml](src/UmbracoProject/Views/documentation.cshtml) gate whether the partial renders at all), and **`visibilityControls`** carries the family of "Hide From …" toggles. The partial itself, [sectionNavigation.cshtml](src/UmbracoProject/Views/Partials/sectionNavigation.cshtml), builds the sibling/child lists and currently filters them **only** by `IsVisible()` (i.e. `umbracoNaviHide` / "Hide From Search").

This change adds a new independent boolean, `hideFromSectionNavigation` ("Hide From Section Navigation"), to the `visibilityControls` composition's "Visibility" group, and extends the partial's filter so a page can be removed from the section-nav sidebar without also being hidden from search. Default is unticked — existing content is unaffected.

---

## Key Decisions

- **Which composition**: add the property to `visibilityControls` (id `7cebdc47-a965-49ec-ab42-bc887d6b1119`, udi `umb://document-type/7cebdc47a96549ecab42bc887d6b1119`), group "Visibility". This is composed by Content, Documentation, Article, and ~all page types, so the toggle appears everywhere the other three do — no per-type edits. It is **not** the `sectionNavigationControls` composition (that one only holds the enable-toggle).
- **Data type**: reuse the shared true/false data type already backing the three sibling toggles — `umb://data-type/92897bc6a5f34ffeae27f2e7e33dda49`. No new data type.
- **Sort order**: `20` — places it after the existing `hideFromTopNavigation` (5) / `umbracoNaviHide` (10) / `hideFromXMLSitemap` (15) without renumbering them. (Resolves spec Open Question #1.)
- **Description text**: "Tick this box if you want to hide this page from the section navigation sidebar" — matches the sibling toggles' phrasing.
- **Filter semantics**: additive/independent. In the partial a page shows only if `IsVisible()` **AND** not `hideFromSectionNavigation`. Applies to **both** the sibling list and the child list. The existing early-return suppression is recomputed against the filtered lists so it still fires when nothing meaningful remains.
- **Current page hidden from itself**: the toggle governs how a page appears in *other* pages' navigation; the current page continues to render as the highlighted active item in its own sidebar. Do **not** filter the current page out of its own list. (Resolves spec Open Question #2.)
- **`guideVisibilityControls` parity**: the only page types that render the partial (Content, Documentation) both compose `visibilityControls` directly, so `guideVisibilityControls` needs no change. (Resolves spec Open Question #3.) Confirm during Step 1 that Documentation still composes `visibilityControls`.
- **Model regeneration is mandatory**: ModelsBuilder runs `SourceCodeManual` (see CLAUDE.md → ModelsBuilder). After the schema edit, regenerate and commit `src/UmbracoProject.Features/Models/Generated/VisibilityControls.generated.cs` alongside the `.uda`. The partial reads the value via `.Value<bool>("hideFromSectionNavigation")` on `IPublishedContent`, so it works regardless, but the committed model must not drift.

---

## Steps

Each step is designed to be completed independently in its own context window.

---

### Step 1 — Add the `hideFromSectionNavigation` property to the Visibility Controls composition

> **Prompt**: Implement Step 1 of `_plans/section-nav-hide-toggle.md`. Add a new boolean property to the `visibilityControls` document-type composition (MCP id `7cebdc47-a965-49ec-ab42-bc887d6b1119`) in its existing "Visibility" property group: alias `hideFromSectionNavigation`, name "Hide From Section Navigation", data type `umb://data-type/92897bc6a5f34ffeae27f2e7e33dda49` (the shared true/false type), sort order 20, description "Tick this box if you want to hide this page from the section navigation sidebar". Use the Umbraco MCP tools against the running local site (start `cd src/UmbracoProject && dotnet run` first, and ensure the MCP server is available via the `claude-umb` alias / env-loaded shell — see the MEMORY note on MCP env vars). Fetch the composition with `mcp__umbraco-mcp__get-document-type-by-id`, append the property to the Visibility group, and save with `mcp__umbraco-mcp__update-document-type`. Then regenerate ModelsBuilder models (Settings → ModelsBuilder → Generate models, or `POST /umbraco/management/api/v1/models-builder/build`), and confirm `git diff` shows the new property in both the `.uda` and the generated model. Discard any unrelated `.uda` churn per CLAUDE.md's Schema Management rule.

**What to build**:
- Modified composition `visibilityControls` — new property `hideFromSectionNavigation` (bool, true/false data type, group "Visibility", sort 20, description as above).
- Regenerated `src/UmbracoProject.Features/Models/Generated/VisibilityControls.generated.cs` — should gain a `HideFromSectionNavigation` bool member (interface + class + static getter), mirroring the existing three toggles.
- Updated `.uda`: `src/UmbracoProject/umbraco/Deploy/Revision/document-type__7cebdc47a96549ecab42bc887d6b1119.uda` — new PropertyType entry under the Visibility PropertyGroup.

**Validation**:
- [Automated]: `cd src/UmbracoProject && dotnet build` — succeeds; the regenerated model compiles.
- [Automated]: `git diff -- src/UmbracoProject/umbraco/Deploy/Revision/document-type__7cebdc47a96549ecab42bc887d6b1119.uda` shows exactly one added PropertyType (`hideFromSectionNavigation`), no unintended changes. Run `/check-uda` before staging.
- [Manual]: In the backoffice, edit a Content page and a Documentation page → the "Visibility" group shows "Hide From Section Navigation" alongside the other three toggles, unticked by default.

---

### Step 2 — Filter the section-nav partial by the new toggle (TDD)

> **Prompt**: Implement Step 2 of `_plans/section-nav-hide-toggle.md`. First extend the Playwright suite `tests/e2e/sectionNavigation.spec.ts` with tests for the new `hideFromSectionNavigation` toggle (write them first and confirm RED), then update `src/UmbracoProject/Views/Partials/sectionNavigation.cshtml` so the sibling and child lists additionally exclude pages where `hideFromSectionNavigation` is true (keeping the existing `IsVisible()` filter), and confirm GREEN. Step 1 (the schema property) must be complete first. Prereqs to run the suite: local site serving on :44367, `.env` creds loaded — see CLAUDE.md → Testing.

**What to build**:
- Modified [sectionNavigation.cshtml](src/UmbracoProject/Views/Partials/sectionNavigation.cshtml): change both list builders (inside the existing `#pragma warning disable CS0618` block) so `siblings` and `children` also require `!x.Value<bool>("hideFromSectionNavigation")` in addition to `x.IsVisible()`. The `otherSiblings` suppression check then naturally recomputes against the filtered lists. Do not filter out the current page itself.
- Extended `tests/e2e/sectionNavigation.spec.ts`:
  - **Schema/API test** (in the existing composition describe block): the `visibilityControls` composition exposes a `hideFromSectionNavigation` boolean property. (Follow the `findCompositionByName` / property-alias pattern, but note the target composition here is **Visibility Controls**, not "Section Navigation Controls".)
  - **Browser tests** (in the fixture describe block, following the existing `beforeAll` create-and-publish pattern with `values: [{ alias: 'hideFromSectionNavigation', ... value: true }]`):
    - A sibling with `hideFromSectionNavigation: true` is absent from a sibling page's `.section-nav` list; an unticked sibling is present.
    - A child with `hideFromSectionNavigation: true` is absent from the indented `.section-nav .child` list under its parent.
    - Independence: a page with `hideFromSectionNavigation: true` but `umbracoNaviHide` unticked is absent from section nav (assert via the rendered list; searchability is out of E2E scope — just assert it's not filtered by the search toggle).
    - Suppression: a fixture where ticking the toggle removes the last meaningful sibling/child → `.section-nav` count is 0.
  - **Partial-content test**: extend the "partial contains required structural elements" test (~line 310) to also assert the partial filters on `hideFromSectionNavigation` (e.g. `.toMatch(/hideFromSectionNavigation/)`).

**Test first**:
- Add the new tests to `tests/e2e/sectionNavigation.spec.ts` and run `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/sectionNavigation.spec.ts` — the new filter/browser tests should be **RED** before the partial edit (the hidden pages still appear); the partial-content regex test is RED until the view is edited.
- Follow the E2E Resilience Rules (CLAUDE.md): no hardcoded UUIDs/slugs, clean stale `SN`-prefixed test data in `beforeAll`, re-acquire tokens per phase, fetch actual published URLs after publish.

**Validation**:
- [Automated]: `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/sectionNavigation.spec.ts` — all section-nav tests GREEN after the partial edit.
- [Automated]: `cd src/UmbracoProject && dotnet build -c Release && dotnet test --no-build` — Gate-1 parity passes (Razor compiles; no CS0618 regression — keep edits inside the existing pragma block).
- [Manual]: In the browser, tick "Hide From Section Navigation" on a page that appears in a sibling's sidebar, publish, reload the sibling → the hidden page is gone; untick and it returns. Confirm a page hidden this way is still reachable at its URL.

---

### Step 3 — Record the durable behavior in the section-navigation feature doc

> **Prompt (change-to `section-navigation`)**: Run `/feature update _features/section-navigation.md` to fold this change's evergreen behavior into the existing capability doc. Add a new Increment line dated today referencing `_specs/section-nav-hide-toggle.md`; extend the existing "Pages hidden from navigation are excluded" Rule (or add a sibling Rule) with scenarios for the `hideFromSectionNavigation` toggle covering: hidden sibling excluded, hidden child excluded, independence from Hide-From-Search, and suppression when the toggle removes the last item; refresh the Test Coverage table with the new `sectionNavigation.spec.ts` test names; add a revision note. Do **not** create `_features/section-nav-hide-toggle.md` — this is a change to an existing capability; its point-in-time acceptance criteria stay in the shipped spec. Then archive `_specs/section-nav-hide-toggle.md` → `_specs/shipped/` and `_plans/section-nav-hide-toggle.md` → `_plans/shipped/`.

**Validation**:
- [Manual]: Every affected scenario in `_features/section-navigation.md` matches observable behavior; the coverage table lists the new tests with no unexpected "Not covered" gaps; a new Increment + revision note are present.
- [Manual]: No `_features/section-nav-hide-toggle.md` was created; spec/plan archived under their `shipped/` folders.

---

## File Summary

| Action | File |
|--------|------|
| Modify (via MCP) | `src/UmbracoProject/umbraco/Deploy/Revision/document-type__7cebdc47a96549ecab42bc887d6b1119.uda` (visibilityControls) |
| Modify (regenerate) | `src/UmbracoProject.Features/Models/Generated/VisibilityControls.generated.cs` |
| Modify | `src/UmbracoProject/Views/Partials/sectionNavigation.cshtml` |
| Modify | `tests/e2e/sectionNavigation.spec.ts` |
| Update *(change-to)* | `_features/section-navigation.md` (fold in evergreen behavior — no new file) |
| Move | `_specs/section-nav-hide-toggle.md` → `_specs/shipped/`; `_plans/section-nav-hide-toggle.md` → `_plans/shipped/` |
