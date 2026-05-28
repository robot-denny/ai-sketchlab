# Feature: Image Generator Service Extraction

> **Draft** — These scenarios have not yet been verified against an implementation. They will be refined during planning and verified after implementation.

A CMS editor generates featured images for articles from the backoffice image-generator dashboard, exactly as before. Nothing the editor sees changes. Behind the scenes, the way images are produced now sits behind a defined service boundary instead of being wired directly into the request handler — so the behavior can be tested in isolation and, later, swapped for an implementation that needs no external tooling.

**Source spec**: `_specs/arch-image-generator-extraction.md`
**Last verified**: _(not yet implemented)_

---

## Increments

The per-feature mini-roadmap: shipped increments + planned increments + parking-lot ideas. Newest planned items first.

- [ ] Introduce `IImageGenerator` + `CliImageGenerator`, register via composer, slim the controller (spec: `_specs/arch-image-generator-extraction.md`, no plan yet)
- [ ] Parking lot — `InProcessImageGenerator`: render flow-field PNGs in C# with no Node dependency (no spec yet)
- [ ] Parking lot — de-duplicate palette/metadata logic shared between `PaletteService.cs` and `palette.ts` (no spec yet)

---

## Behaviors

Scenarios are grouped by Rule. Use concrete values (Specification by Example) and business language (Ubiquitous Language). See `.claude/skills/BDD.md` for guidance.

### Rule: The backoffice generate endpoints behave identically after the refactor

```scenario
Scenario: CMS editor generates one article's image from the dashboard
  Given the image-generator dashboard lists an article "The Future of Sustainable Tech"
  When the editor clicks Generate for that article
  Then the dashboard shows the same success output it showed before the refactor
  And a new featured image is produced for that article
```

```scenario
Scenario: CMS editor runs a batch generate with force on
  Given the dashboard's "Force regenerate" toggle is on
  When the editor clicks "Generate Missing / Regenerate All"
  Then every article is regenerated
  And the dashboard shows the same batch output it showed before the refactor
```

```scenario
Scenario: Generation fails and the editor still sees the error text
  Given the CLI will exit non-zero for the chosen article
  When the editor clicks Generate
  Then the dashboard shows the failure output
  And the request still returns successfully with success marked false
```

### Rule: The controller holds no subprocess mechanism

```scenario
Scenario: Code review of ImageGeneratorController after the refactor
  Given the refactor is complete
  When a reviewer reads ImageGeneratorController.cs
  Then they see no Process or ProcessStartInfo usage
  And they see no npx or tsx argument strings
  And they see no temp-file handling for the palette config
  And the Generate and GenerateBatch actions call IImageGenerator and return its result
```

### Rule: CliImageGenerator reproduces the current mechanism exactly

```scenario
Scenario: The CLI is invoked with the same arguments as before
  Given an editor generates the article with document id "1a2b3c" with force on
  When CliImageGenerator runs
  Then it invokes the same cli.ts script under the repo root
  And it passes "--id 1a2b3c --force" plus a "--palette-json-file" pointing at a temp file
  And the temp file contains the CMS palette config JSON
```

```scenario
Scenario: The palette temp file is always cleaned up
  Given any generate request completes, fails to launch, or returns no process
  When CliImageGenerator finishes
  Then the palette temp file it created no longer exists on disk
```

### Rule: The generator is registered via a composer and the dashboard works

```scenario
Scenario: Site boots cleanly and the dashboard generates end-to-end
  Given the refactor is complete and IImageGenerator is registered via a composer
  When the site is built and started locally
  Then the image-generator dashboard loads its article list
  And clicking Generate for an article produces an image as before
```

### Rule: The controller is unit-testable with a fake generator

```scenario
Scenario: Unit test drives the controller with a fake IImageGenerator
  Given a test provides a fake IImageGenerator that records its calls
  When the test calls Generate with document id "xyz" and force true
  Then the fake records a single-article generation for "xyz" with force true
  And the controller returns the fake's result as success and output
  And no subprocess is spawned
```

---

## Edge Cases

### Rule: Launch failure produces the same diagnostic as today

```scenario
Scenario: Node binary is missing on the host
  Given no npx binary can be found on PATH and ImageGenerator:NodeBinPath is unset
  When an editor triggers a generate
  Then the result is marked failed
  And the output names ImageGenerator:NodeBinPath and reports it was unset
```

---

## Test Coverage

| Scenario | Test File | Status |
|----------|-----------|--------|
| CMS editor generates one article's image from the dashboard | — | Not covered |
| CMS editor runs a batch generate with force on | — | Not covered |
| Generation fails and the editor still sees the error text | — | Not covered |
| Code review of ImageGeneratorController after the refactor | — | Not covered |
| The CLI is invoked with the same arguments as before | — | Not covered |
| The palette temp file is always cleaned up | — | Not covered |
| Site boots cleanly and the dashboard generates end-to-end | — | Not covered |
| Unit test drives the controller with a fake IImageGenerator | — | Not covered |
| Node binary is missing on the host | — | Not covered |

---

## Revision Notes

- 2026-05-27: Draft scenarios from initial spec
