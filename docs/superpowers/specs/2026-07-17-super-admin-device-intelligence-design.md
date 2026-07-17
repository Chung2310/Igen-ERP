# Super Admin Device Intelligence Design

## Goal

Capture trustworthy request IP and a privacy-preserving browser device identifier for Super Admin authentication, sessions, and audit events. Surface the metadata in the Super Admin UI and flag basic anomalies without treating the identifier as an authentication factor.

## Scope

The feature covers Super Admin API traffic only. It adds device metadata to login challenges, privileged sessions, and every Super Admin audit event. It also exposes that metadata in the session and audit views and derives a small, explainable set of risk signals.

It does not collect hardware serial numbers, use invasive browser fingerprinting, geolocate IP addresses, or block access solely because a device identifier or IP changed.

## Device Identity

The browser generates a UUID v4 on first use and persists it under the versioned key `igen_device_id_v1`. The shared Super Admin API client sends it in the `X-Device-ID` header for every request.

The server accepts only a canonical UUID string. Missing or invalid identifiers become `undefined`; they do not fail otherwise valid requests. The raw identifier is stored because administrators need an exact value for correlation, but list views show a shortened value by default.

The device ID is a correlation signal, not proof of machine identity. Clearing browser storage, changing profiles, or using private browsing can create a new identifier. Copying browser storage can duplicate one.

## Request Metadata

A single request-context helper derives:

- `deviceId` from the validated `X-Device-ID` header;
- `sourceIp` from Express `req.ip` after environment-appropriate `trust proxy` configuration;
- `userAgent` from the request header with a bounded maximum length.

Controllers and services receive this normalized context rather than parsing headers independently. The application never accepts a source IP from a request body. Proxy trust must be explicit and constrained to the deployment topology so an arbitrary client cannot spoof `X-Forwarded-For`.

## Persistence and Data Flow

The password-login endpoint captures request metadata when creating the challenge. Successful TOTP verification carries the metadata into the replacement privileged session. Each privileged request refreshes `lastSeenAt` and compares the current metadata with the session metadata.

Privileged sessions store `deviceId`, `sourceIp`, `userAgent`, and `lastSeenAt`. Audit events store the existing `sourceIp` and `userAgent` fields plus `deviceId` and derived `riskSignals`. Audit creation receives request context through a common adapter so all Super Admin actions are covered consistently, including failures.

Device metadata remains immutable on audit events. Session origin metadata remains the login-time value; observations such as a later IP change are represented through activity timestamps and audit risk signals rather than silently overwriting the origin.

## Risk Signals

The initial implementation emits explainable signals:

- `new_device`: the account has no previous successful privileged session with this device ID;
- `device_changed_in_session`: the request device ID differs from the session origin;
- `ip_changed_in_session`: the normalized request IP differs from the session origin;
- `shared_privileged_device`: the same device ID has successful sessions for more than one Super Admin account.

Signals are informational and visible in audit/session views. They do not independently deny access. Missing device IDs are displayed as unavailable and do not generate `new_device`.

## API and UI

Session and audit responses include `deviceId`, `sourceIp`, `userAgent`, `lastSeenAt` where applicable, and `riskSignals`. List views show IP, a shortened device ID, parsed browser/platform text, last activity, and signal badges. Detail views expose the full values and a copy action.

The UI must avoid presenting the device ID as a hardware identifier. Labels use “Browser device ID” and explain that clearing browser data can change it.

## Error Handling and Privacy

Metadata collection is best effort. Missing headers, malformed UUIDs, and unknown proxy data do not interrupt authentication or administrative operations. Header values are bounded before persistence. Audit redaction continues to protect secrets in payloads.

Device and IP data follow the same access controls and retention policy as privileged audit/session records. They are never exposed to tenant users or public endpoints.

## Testing

Automated coverage includes:

- stable UUID creation and automatic header injection in the Super Admin client;
- rejection of malformed or oversized device identifiers;
- source IP extraction under direct and trusted-proxy requests;
- challenge-to-session metadata propagation;
- metadata attachment to successful and failed audit events;
- each risk signal, including non-signaling cases for absent metadata;
- session and audit response serialization;
- UI rendering of shortened identifiers, details, and warning badges;
- regression coverage for password plus TOTP login and atomic session replacement.

Full type checking, Node tests, Vitest tests, and the production build must pass before the branch is pushed.
