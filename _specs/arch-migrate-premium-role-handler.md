# Spec for arch-migrate-premium-role-handler

> This spec captures initial requirements and design rationale. For **current system behavior**, see the doc named on the **Work type** line below. This is a `fix-infra` relocation — its durable record is the CLAUDE.md *Solution architecture* section, not a `_features/` doc.

branch: claude/feature/arch-migrate-premium-role-handler
**Work type**: fix-infra — architectural relocation, no standing behavior change; see CLAUDE.md → Workflow layers → "Work types"

## Summary

Migrate `AssignMembersToPremiumRoleHandler` and its registering composer `AssignMembersToPremiumRoleComposer` out of the thin host (`src/UmbracoProject/`, namespace `UmbracoProject`) and into the `UmbracoProject.Features` RCL, landing the notification handler under `Infrastructure/` and the composer under `Composer/`, with namespaces updated to mirror the new folder paths.

This is **step (2)** of `arch-feature-folder-migration` — the per-slice refactor that follows the `arch-feature-folder-architecture` pilot. The pilot proved cross-assembly composer auto-discovery by migrating the **Search** slice; this slice is the next-smallest model-decoupled candidate and exercises the same auto-discovery mechanism for a **notification handler** (rather than a service).

The handler is a `MemberSavedNotification` `INotificationHandler` that auto-assigns every saved member to the `H5YR` member role if they don't already have it. It touches only core Umbraco types (`IMember`, `IMemberService`) and is **not model-coupled** — so, like Search, it needs no further dependency on the (already-shipped) ModelsBuilder source-mode gate. The point of this slice is purely the architectural relocation: behavior is preserved byte-for-byte.

## Functional Requirements

- The notification handler relocates to the RCL under `Infrastructure/` (CLAUDE.md designates `Infrastructure/` for "cross-cutting plumbing — content finders, middleware, message handlers").
- The composer relocates to the RCL under `Composer/`, alongside the existing `SearchServiceComposer`.
- Namespaces are updated to mirror project + folder per the project convention: handler → `UmbracoProject.Features.Infrastructure`, composer → `UmbracoProject.Features.Composer`.
- The handler's behavior is preserved exactly: on `MemberSavedNotification`, for each saved member, if the member is not already in the `H5YR` role, assign it and log the assignment at information level; if already in the role, skip silently.
- Cross-assembly composer auto-discovery must continue to register the handler with no `Program.cs` edit and no central manifest — Umbraco's `TypeLoader` discovers the RCL composer because the RCL references `Umbraco.Cms` (the mechanism runtime-verified by the Search pilot).
- The two source files are **removed** from `src/UmbracoProject/` (a move, not a copy) — no duplicate `IComposer` left in the host that would double-register the handler.
- The solution builds clean under `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` and the full test suite stays green.

## Possible Edge Cases

- **Double registration**: if the host copy isn't deleted, both composers register the same `MemberSavedNotification` handler and members could be processed twice. The move (not copy) requirement guards against this.
- **Member role name constant**: the `H5YR` role name is a private constant on the handler; it moves with the handler and must not change.
- **`ILogger` resolution**: the handler depends on `ILogger<AssignMembersToPremiumRoleHandler>`; the type's fully-qualified name changes with the namespace, but DI resolution is by open generic so logging continues to work — verify no log-category assertion depends on the old namespace.
- **Auto-discovery silently not firing**: the highest-risk failure mode — the composer compiles and moves but `TypeLoader` doesn't pick it up, so members silently stop being assigned the role. Must be positively verified, not assumed.
- **`.uda` / schema artifacts**: this slice touches only C#; no document types, data types, or member types change, so no `.uda` churn is expected. Any `.uda` diff that appears is incidental local-startup regeneration and should be discarded.

## Acceptance Criteria

- The handler lives at `src/UmbracoProject.Features/Infrastructure/AssignMembersToPremiumRoleHandler.cs` with namespace `UmbracoProject.Features.Infrastructure`, and no longer exists under `src/UmbracoProject/`.
- The composer lives at `src/UmbracoProject.Features/Composer/AssignMembersToPremiumRoleComposer.cs` with namespace `UmbracoProject.Features.Composer`, and no longer exists under `src/UmbracoProject/`.
- Saving a member who lacks the `H5YR` role assigns it; saving a member who already has it makes no change and assigns it only once.
- The handler is registered via cross-assembly auto-discovery — no edit to `Program.cs` and no central registration manifest.
- `dotnet build -c Release` and `dotnet test --no-build` both pass (Gate 1 / pre-push parity), clean under warnings-as-errors.
- No `.uda` schema files change as part of this slice.

## Scenarios (Draft)

Draft BDD scenarios derived from the acceptance criteria using Example Mapping. These will be verified and refined after implementation. As a `fix-infra` slice there is no `_features/` doc; the durable record is CLAUDE.md → Solution architecture.

### Rule: A saved member is auto-assigned the premium role exactly once

```scenario
Scenario: New member without the premium role gets it on save
  Given a member "ada@example.com" who is not in the "H5YR" role
  When the member is saved in the backoffice
  Then the member is assigned to the "H5YR" role
  And an information-level log records the assignment

Scenario: Existing premium member is not re-assigned on save
  Given a member "grace@example.com" who is already in the "H5YR" role
  When the member is saved in the backoffice
  Then the member's roles are unchanged
  And no assignment is logged
```

### Rule: The handler and composer live in the RCL under the by-kind taxonomy

```scenario
Scenario: Handler is in the RCL Infrastructure folder
  Given the solution has been built
  When the codebase is inspected
  Then AssignMembersToPremiumRoleHandler resides under src/UmbracoProject.Features/Infrastructure/
  And its namespace is UmbracoProject.Features.Infrastructure
  And no copy of it remains under src/UmbracoProject/

Scenario: Composer is in the RCL Composer folder beside SearchServiceComposer
  Given the solution has been built
  When the codebase is inspected
  Then AssignMembersToPremiumRoleComposer resides under src/UmbracoProject.Features/Composer/
  And its namespace is UmbracoProject.Features.Composer
  And no copy of it remains under src/UmbracoProject/
```

### Rule: Cross-assembly auto-discovery still registers the handler

```scenario
Scenario: The relocated composer is discovered with no host wiring
  Given the composer lives in the UmbracoProject.Features RCL
  And Program.cs contains no registration for the premium-role handler
  When the application starts
  Then Umbraco's TypeLoader discovers and runs the composer
  And saving a member assigns the "H5YR" role as before
```

### Rule: The relocation is behavior- and schema-neutral

```scenario
Scenario: Build and tests stay green after the move
  Given the handler and composer have been relocated to the RCL
  When dotnet build -c Release and dotnet test --no-build run
  Then both succeed with no warnings-as-errors failures

Scenario: No schema artifacts change
  Given the slice touches only C# files
  When git status is inspected after a clean local startup
  Then no .uda files under umbraco/Deploy/Revision/ are modified by this slice
```

## Open Questions

- Is there a Playwright E2E path that exercises member save → role assignment today, or is member-role behavior only covered (if at all) by unit tests? (Determines whether the verification leans on a browser test or an xUnit test of the handler.)
- Should this slice add the missing unit coverage for the handler's assign/skip logic while it's being touched, or stay a pure move and leave test-adding to a follow-up? (Recommendation: add a small focused unit test, mirroring the precedent set by `SearchComposerTests.cs` / `SearchServiceTests.cs`, so the relocated handler has a regression net.)

## Testing Guidelines

Keep tests focused on the two things that can actually break in a relocation — behavior preservation and auto-discovery — without over-testing Umbraco's framework:

- A unit test for the handler's role logic with a mocked `IMemberService`: (a) member lacking `H5YR` → `AssignRole` called once with `H5YR`; (b) member already in `H5YR` → `AssignRole` not called.
- A registration/auto-discovery assertion mirroring `tests/UmbracoProject.Tests/SearchComposerTests.cs`: confirm the `MemberSavedNotification` handler is wired up after the RCL composer runs, proving cross-assembly discovery from the host's perspective.
- Reuse the existing xUnit project (`tests/UmbracoProject.Tests/`); no new test project.
