# Spec for <feature-name>

> This spec captures initial requirements and design rationale. For **current system behavior**, see the doc named on the **Work type** line below (a new `_features/<feature-name>.md` for a new capability; an existing `_features/*.md` for a change; a `docs/` runbook or CLAUDE.md section for a fix).

branch: claude/feature/<feature-name>
**Work type**: <new-capability | change-to <existing-feature-slug> | fix-infra>  — see CLAUDE.md → Workflow layers → "Work types"; drives whether this work earns a feature doc
figma_component (if used): <figma-component>

## Summary
...

## Functional Requirements
- ...

## Figma Design Reference (only if referenced)
- File: ...
- Component name: ...
- Key visual constraints ...

## Possible Edge Cases
- ...

## Acceptance Criteria
- ...

## Scenarios (Draft)

Draft BDD scenarios derived from acceptance criteria using Example Mapping. Each Rule maps to an acceptance criterion; scenarios use concrete examples. These will be verified and refined after implementation. See `_features/<feature-name>.md` for the verified version.

### Rule: {acceptance criterion as a business rule}

```scenario
Scenario: {name with concrete example}
  Given {specific precondition}
  When {user action}
  Then {observable outcome}
```

## Open Questions
- ...

## Testing Guidelines
Create a test file(s) in the ./tests folder for the new feature, and create meaningful tests for the following cases, without going too heavy: 
- ...
