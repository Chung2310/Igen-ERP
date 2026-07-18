# ERP Login Super Admin TOTP Popup Design

## Goal

Allow a Super Admin who starts authentication from the normal ERP login page to complete Google Authenticator verification in a dedicated popup and enter the normal ERP interface. The `/super-admin` login remains an independent entry point for the control-plane interface.

## Current Problem

The normal ERP login currently treats `challenge_required` as a navigation instruction. It stores the privileged challenge and redirects to `/super-admin`. This couples the authentication destination to the account role instead of the entry point. It also causes the first verification attempt to lose page state or reload before the challenge is completed.

## Selected Approach

`AuthPage` owns the interactive challenge popup. `AuthContext.loginWithEmail` returns a typed login outcome instead of redirecting. The page opens the appropriate verification step, while focused authentication helpers complete enrollment or TOTP verification. After successful verification, `AuthContext` hydrates the authenticated profile and leaves the browser on the normal ERP route.

This keeps presentation state in the page, authenticated user state in the context, and HTTP calls in services.

## Components and Responsibilities

### Auth service

- Continue posting email and password to `/api/v1/auth/login` with the Super Admin device ID.
- Expose enrollment-start, enrollment-confirm, TOTP-verify, and recovery-verify operations without navigation side effects.
- Persist the access token returned by successful challenge completion.

### Auth context

- Return either an authenticated outcome or a challenge outcome from `loginWithEmail`.
- On ordinary login success, hydrate `user` and `userProfile` as today.
- Provide a completion method that accepts the challenge response, loads `/api/v1/auth/me`, and hydrates the ERP session.
- Never decide whether the caller should navigate to `/super-admin`.

### ERP authentication page

- Keep email/password form state intact when a challenge is returned.
- Open a modal dialog over the normal login page.
- For an enrolled account, show a six-digit Google Authenticator input and an optional recovery-code mode.
- For a first-time account, start enrollment, show the QR code, accept the first six-digit code, and show recovery codes once enrollment succeeds.
- Prevent every popup action from submitting the underlying email/password form or reloading the document.
- On success, close the popup and let the authenticated ERP application render without changing the route to `/super-admin`.

### Super Admin shell

- Keep its direct `/super-admin` password, enrollment, TOTP, recovery, and authenticated control-plane flow.
- Do not consume challenges created by the normal ERP login page.

## Data Flow

1. The user submits email and password on the normal ERP login page.
2. A normal user response immediately hydrates the ERP session.
3. A Super Admin response returns `challengeId`, `enrollmentRequired`, and `expiresAt` to `AuthPage`.
4. `AuthPage` opens the modal. If enrollment is required, it requests and displays the QR code.
5. The user submits a TOTP or recovery code from the modal.
6. The challenge endpoint returns tokens. The client stores the access token and requests `/api/v1/auth/me`.
7. `AuthContext` sets the authenticated profile. `AppContent` replaces `AuthPage` with the normal ERP interface at the current ERP URL.

## Error Handling

- Invalid codes remain in the modal and display the server message without a page reload.
- An expired or missing challenge closes the modal and asks the user to submit email and password again.
- Enrollment-start failure is shown in the modal and does not redirect.
- Profile hydration failure clears the incomplete token and reports that the ERP session could not be initialized.
- Buttons are disabled while their request is pending to prevent duplicate submissions.

## Testing

- A source-level contract test proves `AuthContext` no longer redirects or stores a handoff challenge for ERP login.
- Login outcome tests prove `challenge_required` reaches the page and ordinary login still hydrates the profile.
- Popup behavior tests prove the first TOTP submission is prevented from reloading the page and calls verification exactly once.
- Success tests prove challenge completion hydrates the user profile while the pathname remains the normal ERP route.
- Enrollment tests cover QR startup, confirmation, and recovery-code acknowledgement.
- Error tests cover invalid code and expired challenge without losing the login page state.

## Out of Scope

- Changing the direct `/super-admin` control-plane UI.
- Changing server-side TOTP policy or challenge lifetime.
- Allowing ordinary tenant users to use privileged authentication endpoints.
