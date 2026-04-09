# Feature: {Feature Name}

{2-3 sentence summary from the user's perspective. No implementation details. Use ubiquitous language — business terms ("CMS editor", "visitor", "page"), not technical terms ("document type", "controller", "API endpoint").}

**Source spec**: `_specs/{slug}.md`
**Last verified**: {date}

---

## Behaviors

Scenarios are grouped by Rule — the business rule or acceptance criterion that the scenarios prove. Use concrete values (Specification by Example) and business language (Ubiquitous Language). See `.claude/skills/BDD.md` for guidance.

### Rule: {Business rule in plain language}

```scenario
Scenario: {Descriptive name using concrete examples}
  Given {specific precondition with concrete values}
  When {user action}
  Then {observable outcome}
```

```scenario
Scenario: {Another scenario proving the same rule}
  Given {different precondition}
  When {action}
  Then {outcome}
```

### Rule: {Another business rule}

```scenario
Scenario: {name}
  Given {precondition}
  When {action}
  Then {outcome}
```

---

## Edge Cases

### Rule: {Boundary condition or unusual situation}

```scenario
Scenario: {Edge case name}
  Given {unusual precondition}
  When {action}
  Then {graceful outcome}
```

---

## Test Coverage

| Scenario | Test File | Status |
|----------|-----------|--------|
| {scenario name} | `tests/e2e/feature.spec.ts:L42` | Covered |
| {scenario name} | — | Not covered |

---

## Revision Notes

- {date}: Initial feature doc from spec + implementation
- {date}: Updated after {change description}
