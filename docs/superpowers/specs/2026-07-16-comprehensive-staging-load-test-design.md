# Comprehensive Staging Load Test Design

## Goal

Build a repeatable TypeScript load-testing system that models up to 1,000 authenticated staging users across representative ERP read/write workflows, measures application capacity beyond rate limiting, and removes all generated data.

## Safety and authorization boundaries

- Target is compiled exactly to `https://staging-erp.igentechsolutions.com`; no target override.
- Administrative credentials are supplied only at runtime through environment variables and are never printed, persisted, or committed.
- Setup may create at most 1,000 temporary users and test-domain records after an explicit run confirmation.
- Every generated identity and record carries a unique `LOADTEST-<runId>` marker.
- Cleanup deletes only IDs recorded in the run manifest and can be rerun after interruption.
- Email, SMS, payments, webhooks, AI, Cloudinary uploads, Google Drive, and other external integrations are excluded.
- One local Node.js process; no distributed workers, proxies, raw sockets, or arbitrary targets.

## Components

### Profile and manifest

A pure profile module owns immutable stage definitions, endpoint allowlists, scenario weights, thresholds, maximum users, and the staging origin. A manifest module writes only generated resource IDs, synthetic usernames, run ID, creation state, and cleanup state. It never stores passwords, access tokens, refresh tokens, cookies, or response bodies.

### Setup and cleanup

The setup command authenticates once as the provided staging admin and creates synthetic users in bounded batches. It then authenticates those users, records only non-secret identifiers needed by the runner, and creates the minimum shared test fixtures required for course, batch, student, partner, resource, schedule, and chat workflows.

The cleanup command loads one manifest, deletes child records before parents, deletes temporary users last, verifies that recorded IDs no longer resolve, and marks the manifest cleaned. It refuses IDs not present in the manifest or records without the exact run marker.

### Virtual-user runner

The runner creates asynchronous virtual-user loops rather than OS threads. Each VU owns an in-memory authenticated session, selects workflows by fixed weights, pauses for a deterministic-random 1–5 second think time, and stops receiving new work when its stage ends or a circuit opens.

Stages are fixed at 5 users for 2 minutes, 25 users for 5 minutes, then 50, 100, 250, 500, and 1,000 users for 5 minutes each. After ramping, 1,000 users remain active for 10 minutes, ramp down over 5 minutes, and recovery health is observed for 5 minutes. A separate soak profile is out of scope until this profile passes.

## Workload model

- 5%: login, refresh, and current-user profile.
- 35%: dashboard and student list/detail reads.
- 20%: course and batch list/detail reads.
- 10%: schedule reads.
- 10%: partner and resource reads without file access.
- 10%: create, update, and delete records owned by the current run.
- 10%: internal chat or WebSocket activity without attachments.

Before implementation, each route in the allowlist must be validated against the current server router and exercised once in a smoke test. Destructive actions may reference only IDs created by the current run.

## Metrics and circuits

Metrics are aggregated by stage, scenario, method, and normalized endpoint. Reports contain request count, throughput, status counts, network errors, P50/P95/P99 latency, successful workflow count, circuit reason, cleanup result, and recovery result. Bodies, headers, tokens, cookies, passwords, and raw URLs containing IDs are never reported.

The runner stops issuing work when any condition occurs:

- health is not HTTP 200;
- `5xx` exceeds 1% over a 30-second window with at least 100 samples;
- valid login failures exceed 1% over a 30-second window with at least 100 samples;
- P95 exceeds 1,000 ms over a 30-second window with at least 100 samples;
- ten consecutive network errors occur;
- the global deadline expires;
- the operator interrupts because CPU exceeds 80%, memory/swap grows unsafely, Redis/database saturates, or users are affected.

Target pass criteria are overall `5xx < 0.1%`, read P95 below 500 ms, P99 below 1,000 ms, no OOM/restart/swap/Redis eviction/database-pool exhaustion, successful cleanup, and healthy recovery.

## Testing and execution gates

Pure unit tests inject fake fetch, clock, randomness, manifest storage, and abort signals. They verify stage transitions, maximum 1,000 VUs, weighted selection, think time, concurrency, metrics, every circuit, manifest secrecy, cleanup scoping, interruption, and recovery without contacting staging.

Execution proceeds through separate confirmations: local tests and static checks; setup of five users; five-user smoke plus cleanup verification; setup of the remaining users; then the full profile. A failure at any gate prevents later stages.
