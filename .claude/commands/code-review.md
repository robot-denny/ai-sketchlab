---
description: Reviews uncommitted code changes made on the current branch.
allowed-tools: Bash(git diff), Bash(git diff --staged)
---

Your job is to coordinate three reviewer subagents in parallel:

- **accessibility-reviewer**
- **umbraco-code-reviewer**
- **perf-reviewer**

Goal:
1. Gather the current branch diff including BOTH staged and unstaged changes.
2. Run all three reviewer subagents in parallel on the same diff.
3. Combine their feedback into one unified report, de-duplicating overlap.
4. Produce a proposed edit plan (ordered checklist) to address the feedback.
5. Ask the user for explicit approval BEFORE making any code changes.

Process:
- First, collect the diff:
  - Use `git diff` for unstaged
  - Use `git diff --staged` for staged
  - If both are empty, say so and stop (DO NOT PROCEED).

- Then invoke all three subagents in parallel.
  - Provide each agent:
    - the combined diff output
    - brief repo context if needed (tech stack, lint/test commands if available)
  - Tell them to be evidence-based: file paths, line/snippet references, no guessing.
  - Tell them NOT to review any code outside the diff.

- Merge results into:
  1. Summary (max 10 bullets total)
  2. Accessibility findings (Blocker/Major/Minor/Nit) — include ALL findings from the subagent, not just top ones
  3. Code quality findings (Blocker/Major/Minor/Nit) — include ALL findings from the subagent, not just top ones
  4. Performance findings (Critical/High/Medium/Low/Info) — include ALL findings from the subagent, not just top ones
  5. Combined action plan (ordered checklist)
  6. Questions/uncertainties (anything that needs human intent)
  - De-duplicate where multiple agents flag the same issue, but never silently drop a unique finding.

Rules:
- Do NOT edit any files yet.
- Do NOT run formatting-only changes unless they fix a cited issue.

Finish by asking:
"Do you want me to implement the action plan now?"

Wait for user confirmation before making any changes.

After the action plan is applied (or explicitly skipped), end with a "Next:" line:
`Next: /commit-message, then push`