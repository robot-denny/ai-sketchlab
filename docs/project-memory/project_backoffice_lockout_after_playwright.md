---
name: Backoffice login loop after Playwright e2e runs = user lockout
description: Recurring symptom — after a full Playwright e2e suite the user can't log into /umbraco. Root cause is umbracoUser.userNoConsole=1 from hitting the 5-failed-attempt lockout threshold on user id=1. Two confirmed occurrences (the second during Phase 9 of package-c).
type: project
originSessionId: dd100d6a-2fc6-4237-ab69-b636f3a03ef5
---
# Symptom

User clicks Sign in with Umbraco ID, succeeds at id.umbraco.com, gets bounced back to `localhost:44367/umbraco/login?ReturnUrl=...` instead of landing in the backoffice. URL bar shows the full `/authorize?...identity_provider=Umbraco.UmbracoId` URL re-encoded as ReturnUrl. Loop repeats indefinitely. Incognito + cleared cookies do not help. No errors in `umbraco/Logs/UmbracoTraceLog.*.json`.

# Root cause

`umbracoUser` row id=1 (`dkardys@wearediagram.com`) has:
- `userNoConsole = 1`
- `failedLoginAttempts = 5`
- `lastLockoutDate` is set

The `/umbidlocallogin` callback completes the OAuth handshake but ASP.NET Identity then refuses to sign in the locked user. The loop is silent because Microsoft.* logging is filtered to Warning in this project's Serilog config.

`MaxFailedAccessAttemptsBeforeLockout` is at its Umbraco default of 5; nothing in `appsettings*.json` overrides it, and `UserDefaultLockoutTimeInMinutes` defaults to a very large value, so the lockout is effectively permanent until manually reset.

# Diagnostic recipe (~30 seconds)

```bash
DB=src/UmbracoProject/umbraco/Data/Umbraco.sqlite.db
sqlite3 -header "$DB" "SELECT id, userName, userDisabled, userNoConsole, failedLoginAttempts, lastLockoutDate, lastLoginDate FROM umbracoUser WHERE id=1;"
```

If `userNoConsole=1` AND `failedLoginAttempts>=5`, this is the case. Skip every other forensic step.

# Fix

```sql
UPDATE umbracoUser
SET userNoConsole=0, failedLoginAttempts=0, lastLockoutDate=NULL
WHERE id=1;
```

After running, fully close incognito windows, then sign in again. The dotnet process does not need restarting — Umbraco re-reads the user row on each sign-in.

# What does NOT need to happen

- Don't delete `umbraco/Data/TEMP/` (didn't help here).
- Don't rotate `~/.aspnet/DataProtection-Keys/`.
- Don't restart the dotnet process unless option (1) above fails.
- Don't clear Chrome cookies for id.umbraco.com (the cookies aren't the problem).

# Open question — preventing recurrence

The 5 failed attempts attributed to user id=1 were not caused by client_credentials calls (those are mapped to users id=2 and id=3 via `umbracoUser2ClientId`). They came from real browser-side `/umbidlocallogin` callbacks rejecting the sign-in 5 times in ~2.5 minutes.

Theory ruled out: securityStampToken drift from Playwright. Confirmed by `umbracoUser.updateDate` for id=1 only changing at the lockout instant (no Playwright-time write).

Mitigation applied 2026-04-29 — `appsettings.Development.json` now has:
```json
"Umbraco": { "CMS": { "Security": {
  "MaxFailedAccessAttemptsBeforeLockout": 99,
  "UserDefaultLockoutTimeInMinutes": 1
}}}
```
Prod policy untouched (file is gitignored). Dev should auto-recover within a minute even if the failure cascade still happens. **Not yet verified** — needs to survive a full e2e suite run + manual login attempt.

Diagnostic codified as `npm run check:lockout` (added to root `package.json`). Run it after the next suspect e2e run BEFORE attempting any manual login — that snapshot is the data point we need to root-cause this.

# Cross-reference

- Confirmed twice (Phase 9 of `_plans/package-c.md` was the second time, 2026-04-28).
- Diagnostic and fix run live in conversation 2026-04-28; user reported "logged right in" after the SQL reset + browser cache clear.
