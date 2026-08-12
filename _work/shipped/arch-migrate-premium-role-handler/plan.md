# Plan: Migrate Premium Role Handler to RCL

**Spec**: `_specs/arch-migrate-premium-role-handler.md`
**Branch**: `claude/feature/arch-migrate-premium-role-handler`
**Work type**: fix-infra — architectural relocation, no standing behavior change; drives the final step (durable record → CLAUDE.md, no `_features/` doc)

## Context

Step (2) of `arch-feature-folder-migration`: relocate `AssignMembersToPremiumRoleHandler` (a `MemberSavedNotification` handler that auto-assigns saved members to the `H5YR` role) and its registering composer `AssignMembersToPremiumRoleComposer` out of the thin host (`src/UmbracoProject/`, namespace `UmbracoProject`) into the `UmbracoProject.Features` RCL — handler under `Infrastructure/`, composer under `Composer/` (beside the already-migrated `SearchServiceComposer`). The handler touches only core types (`IMember`, `IMemberService`), so it is not model-coupled and needs nothing beyond the already-shipped ModelsBuilder source-mode work. This is a **behavior-preserving move**; the only real risks are (a) a leftover host copy double-registering the handler, and (b) cross-assembly composer auto-discovery silently not firing. Both are explicitly guarded below.

The RCL already has the target folders (`Composer/` populated, `Infrastructure/` present). SDK-style globbing means moving a `.cs` file between projects needs no csproj edit. The handler's dependencies all resolve from `Umbraco.Cms.Core` (referenced by the RCL) + `Microsoft.Extensions.Logging`.

---

## Key Decisions

- **Characterization-test-first, not new-behavior TDD**: this is a refactor of existing untested code. The TDD framing is to pin current behavior with a unit test against the handler's *current* host location (Step 1, RED→GREEN), then move the code and re-point the test's reference (Step 2) and watch it stay GREEN — proving the move preserved behavior. This is more honest than writing a test against a namespace that doesn't exist yet.
- **Handler gets a unit test; composer auto-discovery is verified at runtime**: mirrors the Search pilot precedent. `SearchComposerTests.cs` deliberately does *not* call `IComposer.Compose()` (it needs a full Umbraco host harness). So we unit-test the handler's assign/skip logic with a substituted `IMemberService` (NSubstitute, already referenced), and verify the composer is discovered via a **manual runtime check** (start app → save a member → confirm `H5YR` assigned), exactly how the Search slice's auto-discovery was runtime-verified.
- **Move, never copy**: delete both files from `src/UmbracoProject/` in the same step they land in the RCL. A surviving host `IComposer` would double-register the `MemberSavedNotification` handler.
- **Test framework**: xUnit + **NSubstitute 5.3.0** (already in `tests/UmbracoProject.Tests/UmbracoProject.Tests.csproj`). No Moq, no new packages.
- **Namespaces mirror folders**: handler → `UmbracoProject.Features.Infrastructure`; composer → `UmbracoProject.Features.Composer`. The composer gains a `using UmbracoProject.Features.Infrastructure;` (handler was a bare same-namespace reference before).
- **No schema churn**: C#-only slice. No member type / document type changes. Discard any incidental `.uda` regeneration from local startup (`git checkout -- src/UmbracoProject/umbraco/Deploy/Revision/`).

---

## Steps

Each step is designed to be completed independently in its own context window.

---

### Step 1 — Characterize the handler with a unit test (against its current location)

> **Prompt**: Implement Step 1 of `_plans/arch-migrate-premium-role-handler.md`. Create `tests/UmbracoProject.Tests/Infrastructure/AssignMembersToPremiumRoleHandlerTests.cs` (new `Infrastructure/` folder under the test project) with xUnit + NSubstitute, testing the *current* `UmbracoProject.AssignMembersToPremiumRoleHandler`. Two facts: (1) when `IMemberService.GetAllRoles(memberId)` returns roles WITHOUT `"H5YR"`, `Handle(MemberSavedNotification)` calls `IMemberService.AssignRole(memberId, "H5YR")` exactly once; (2) when `GetAllRoles` returns roles that INCLUDE `"H5YR"`, `AssignRole` is never called. Substitute `IMember` (give it an `Id`), substitute `IMemberService`, and pass a substituted/`NullLogger` `ILogger<AssignMembersToPremiumRoleHandler>`. Construct the notification via the `SavedNotification` base constructor (it accepts a single entity or an `IEnumerable`, plus an `EventMessages`). Run `cd src/UmbracoProject && dotnet test --no-build 2>/dev/null || dotnet test` and confirm the two tests pass GREEN (behavior characterized in place before the move).

**What to build**:
- `tests/UmbracoProject.Tests/Infrastructure/AssignMembersToPremiumRoleHandlerTests.cs`, namespace `UmbracoProject.Tests.Infrastructure`.
- References `UmbracoProject.AssignMembersToPremiumRoleHandler` (current host namespace).
- Use `NSubstitute` for `IMemberService` and `IMember`; `Microsoft.Extensions.Logging.Abstractions.NullLogger<T>.Instance` (or a substitute) for the logger.
- Assert with `_memberService.Received(1).AssignRole(memberId, "H5YR")` / `.DidNotReceive().AssignRole(...)`.

**Test first**:
- This step *is* the test. Expect GREEN immediately — it pins existing behavior. (If it's RED, the characterization is wrong; fix the test understanding before proceeding, do not change the handler.)

**Validation**:
- [Automated]: `cd src/UmbracoProject && dotnet build -c Release && dotnet test --no-build` — the two new tests pass; existing suite still green.

---

### Step 2 — Move handler + composer into the RCL and re-point the test

> **Prompt**: Implement Step 2 of `_plans/arch-migrate-premium-role-handler.md`. Move two files from the host into the `UmbracoProject.Features` RCL: (1) `src/UmbracoProject/AssignMembersToPremiumRoleHandler.cs` → `src/UmbracoProject.Features/Infrastructure/AssignMembersToPremiumRoleHandler.cs`, change its namespace from `UmbracoProject` to `UmbracoProject.Features.Infrastructure`; (2) `src/UmbracoProject/AssignMembersToPremiumRoleComposer.cs` → `src/UmbracoProject.Features/Composer/AssignMembersToPremiumRoleComposer.cs`, change its namespace from `UmbracoProject` to `UmbracoProject.Features.Composer` and add `using UmbracoProject.Features.Infrastructure;` so it can still reference the handler. **Delete both originals from `src/UmbracoProject/`** (use `git mv` so the move is tracked). Update the Step-1 test's reference to the handler's new namespace (`using UmbracoProject.Features.Infrastructure;` or fully-qualified). Confirm nothing else in `src/UmbracoProject/` references these types (grep `AssignMembersToPremiumRole` across `src/UmbracoProject/` — only the moved files should have matched). Run `cd src/UmbracoProject && dotnet build -c Release && dotnet test --no-build` — build clean under warnings-as-errors, all tests GREEN. Then `git status` and discard any incidental `.uda` changes with `git checkout -- src/UmbracoProject/umbraco/Deploy/Revision/`.

**What to build**:
- `git mv src/UmbracoProject/AssignMembersToPremiumRoleHandler.cs src/UmbracoProject.Features/Infrastructure/` + namespace edit → `UmbracoProject.Features.Infrastructure`.
- `git mv src/UmbracoProject/AssignMembersToPremiumRoleComposer.cs src/UmbracoProject.Features/Composer/` + namespace edit → `UmbracoProject.Features.Composer`, add `using UmbracoProject.Features.Infrastructure;`.
- Update `tests/UmbracoProject.Tests/Infrastructure/AssignMembersToPremiumRoleHandlerTests.cs` handler reference to the new namespace.
- Confirm zero remaining host references; confirm no `.uda` churn staged.

**Test first**:
- No new test — the Step-1 characterization test is the safety net. It must stay GREEN after the move (proves behavior preserved). Only its `using` changes.

**Validation**:
- [Automated]: `cd src/UmbracoProject && dotnet build -c Release && dotnet test --no-build` — clean build (warnings-as-errors), all tests pass including the moved characterization test.
- [Automated]: `grep -rn "AssignMembersToPremiumRole" src/UmbracoProject/ --include=*.cs` returns nothing (both files gone from host).
- [Manual]: `git status` shows only the two moves, the test edit, and no `.uda` modifications.

---

### Step 3 — Runtime-verify cross-assembly auto-discovery

> **Prompt**: Implement Step 3 of `_plans/arch-migrate-premium-role-handler.md`. Verify the relocated `AssignMembersToPremiumRoleComposer` (now in the RCL) is still discovered by Umbraco's `TypeLoader` with no `Program.cs` wiring — the same auto-discovery the Search pilot relied on. First confirm by inspection that `src/UmbracoProject/Program.cs` contains no manual registration of the premium-role handler/composer. Then run the app (`cd src/UmbracoProject && dotnet run`), log into the local backoffice, create or save a Member who is not already in the `H5YR` member group, and confirm the member is auto-assigned to the `H5YR` role (check the member's Member Groups in the backoffice, or the app log line "Automatically assigning member {MemberId} to role H5YR"). If the role is assigned, auto-discovery works across the assembly boundary. Record the outcome.

**What to build**: nothing — this is a verification gate.

**Validation**:
- [Manual]: `Program.cs` has no premium-role registration (auto-discovery is the only path).
- [Manual]: Saving a non-premium member in the local backoffice assigns the `H5YR` role (and/or the info log line appears). This is the load-bearing proof that the move didn't silently break registration.

---

### Step 4 — Record the durable behavior (fix-infra) and archive

> **Prompt**: Implement Step 4 of `_plans/arch-migrate-premium-role-handler.md`. This is a `fix-infra` slice — no `_features/` doc. Update the durable records: (1) In `CLAUDE.md` → *Solution architecture* → `Infrastructure/` bullet, change the language that says `NotFoundContentFinder`, the `/sitemap.xml` rewrite, and `AssignMembersToPremiumRoleHandler` "land when their slices migrate (they are not moved yet)" — `AssignMembersToPremiumRoleHandler` HAS now migrated (to `Infrastructure/`, composer to `Composer/`); leave the 404-finder and sitemap-rewrite as still-pending. (2) In `ROADMAP.md`, mark `arch-feature-folder-migration` ordering step (2) as done (strike/✅ it like step (1)), so step (3) — the 404 finder + sitemap middleware — is the next slice. (3) Confirm the shipped spec carries the acceptance criteria (it does). Then archive: `git mv _specs/arch-migrate-premium-role-handler.md _specs/shipped/` and `git mv _plans/arch-migrate-premium-role-handler.md _plans/shipped/`. Do NOT create any `_features/*.md`.

**Validation**:
- [Manual]: CLAUDE.md `Infrastructure/` bullet reflects the handler has migrated; 404-finder + sitemap rewrite still listed as pending.
- [Manual]: ROADMAP `arch-feature-folder-migration` step (2) marked done; step (3) is clearly next.
- [Manual]: Nothing was filed under `_features/`; spec + plan now under their `shipped/` folders.

---

## File Summary

| Action | File |
|--------|------|
| Create | `tests/UmbracoProject.Tests/Infrastructure/AssignMembersToPremiumRoleHandlerTests.cs` |
| Move (host → RCL) + namespace | `src/UmbracoProject/AssignMembersToPremiumRoleHandler.cs` → `src/UmbracoProject.Features/Infrastructure/AssignMembersToPremiumRoleHandler.cs` |
| Move (host → RCL) + namespace | `src/UmbracoProject/AssignMembersToPremiumRoleComposer.cs` → `src/UmbracoProject.Features/Composer/AssignMembersToPremiumRoleComposer.cs` |
| Modify | `CLAUDE.md` (Solution architecture → `Infrastructure/` bullet) |
| Modify | `ROADMAP.md` (mark `arch-feature-folder-migration` step (2) done) |
| Move | `_specs/arch-migrate-premium-role-handler.md` → `_specs/shipped/` |
| Move | `_plans/arch-migrate-premium-role-handler.md` → `_plans/shipped/` |
| Update *(fix-infra)* | CLAUDE.md / ROADMAP only — **no `_features/` file** |
