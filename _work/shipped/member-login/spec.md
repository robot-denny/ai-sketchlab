# Spec for Member Login

branch: N/A (documenting existing implementation)

## Summary

Member login page with tabbed login/register panels, login status display, and automatic member role assignment. The page uses Umbraco's built-in member authentication system (`UmbLoginController`, `UmbRegisterController`, `UmbLoginStatusController`) with Bootstrap 5 styling. A custom composer automatically assigns all new members to the "H5YR" member group. The page supports two-factor authentication and external login providers when configured.

## Functional Requirements

### Login Form
- Username and password fields with a "Remember Me" checkbox
- Form submits to `UmbLoginController.HandleLogin()`
- Client-side validation via jQuery Validate (unobtrusive)
- Server-side validation summary for model errors
- Optional redirect URL after login (defaults to current page)

### Registration Form
- Name, email, password, and confirm password fields
- Form submits to `UmbRegisterController.HandleRegisterMember()`
- Uses the default Umbraco member type
- Auto-login after successful registration
- Displays success message via `TempData["FormSuccess"]`
- Optionally renders member-editable custom properties (currently disabled)

### Panel Toggle
- Login panel is shown by default; register panel is hidden
- "Create an account" button switches to the register panel
- "Log in" button switches back to the login panel
- URL updates to `?view=register` when register panel is shown (via `history.replaceState`)
- Navigating to `?view=register` directly opens the register panel on page load
- Focus moves to the first input in the newly visible panel

### Login Status
- When authenticated, displays "Welcome back **{name}**!" with a logout button
- Logout form submits to `UmbLoginStatusController.HandleLogout()`
- When authenticated, the login and register panels are hidden

### Auto Role Assignment
- `AssignMembersToPremiumRoleComposer` registers a `MemberSavedNotification` handler
- `AssignMembersToPremiumRoleHandler` assigns every saved member to the "H5YR" member group
- Skips assignment if the member already has the role (idempotent)
- Logs the assignment via `ILogger`

### Conditional Features
- Two-factor authentication: renders 2FA code input when `ViewData.TryGetTwoFactorProviderNames()` returns providers
- External login providers: renders provider buttons when `IMemberExternalLoginProviders` returns configured providers

### Document Type
- "Login" document type with alias `login`
- Inherits from compositions: SEO Controls, Visibility Controls
- Uses the "Login" template (`Login.cshtml`) with `master.cshtml` layout
- No custom properties (relies entirely on compositions)

## Possible Edge Cases

- Empty credentials submitted — server-side validation returns model errors
- Mismatched passwords on registration — client-side and server-side validation
- Duplicate email registration — Umbraco returns a validation error (member already exists)
- Expired session — member identity check returns `IsAuthenticated = false`, login form shown
- 2FA flow interruption — user closes browser mid-2FA; next visit shows login form (not stuck in 2FA)
- JavaScript disabled — panel toggle won't work; both panels could be shown with a `<noscript>` fallback (not currently implemented)
- Very long member names — may overflow the welcome message (Bootstrap handles wrapping)
- Concurrent login disabled (`AllowConcurrentLogins: false`) — second login on another device invalidates the first session

## Acceptance Criteria

- [ ] Login page loads with HTTP 200
- [ ] Page header is rendered
- [ ] Login panel is visible by default with username, password, and remember-me fields
- [ ] Register panel is hidden by default
- [ ] Clicking "create an account" shows the register panel and hides the login panel
- [ ] Clicking "Log in" shows the login panel and hides the register panel
- [ ] URL updates to `?view=register` when register panel is shown
- [ ] Navigating to `?view=register` directly opens the register panel
- [ ] Toggle buttons have correct `aria-expanded` and `aria-controls` attributes
- [ ] `aria-expanded` updates correctly when panels switch
- [ ] Register form fields have `aria-required` attributes
- [ ] Submitting an empty login form shows validation errors
- [ ] Submitting an empty registration form shows validation errors
- [ ] Password mismatch in register form shows a validation error
- [ ] Registering a new member auto-logs in and shows login status with member name
- [ ] Login status displays logout button when authenticated
- [ ] Login and register panels are hidden when authenticated
- [ ] Clicking logout returns to the unauthenticated login page

## Open Questions

- Should a `<noscript>` fallback show both panels when JavaScript is disabled? (Currently no)
- Should there be a "forgot password" flow? (Not currently implemented)
- Should the "H5YR" role name be configurable via appsettings? (Currently hardcoded)

## Testing Guidelines

Create a test file at `tests/e2e/memberLogin.spec.ts`.

- Login page loads with 200 status and page header is rendered
- Login panel visible by default, register panel hidden
- Login form contains username, password, remember-me fields
- Register form contains name, email, password, confirm-password fields
- Panel toggle: clicking "create an account" switches panels
- Panel toggle: clicking "Log in" switches back
- URL reflects `?view=register` when register panel shown
- Direct navigation to `?view=register` opens register panel
- Accessibility: aria-expanded and aria-controls attributes correct and update on toggle
- Accessibility: register form fields have aria-required
- Validation: empty login form submission shows errors
- Validation: empty register form submission shows errors
- Validation: password mismatch shows error
- Registration flow: register test member → auto-login → login status shows name
- Authenticated state: login/register panels hidden, logout button visible
- Logout: clicking logout returns to unauthenticated state
