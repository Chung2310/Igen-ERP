# Production Stepped Load Test Design

## Goal

Measure production behavior under a small, controlled increase from 2 to 20 login requests per second while preserving service availability and producing per-stage evidence.

## Immutable safety boundaries

- Target is compiled exactly to `https://erp.igentechsolutions.com`; no CLI or environment target override.
- Traffic is limited to `GET /api/v1/health` and `POST /api/v1/auth/login`.
- Login uses one fixed `.invalid` account and never real credentials.
- One local process, maximum concurrency 10, no workers, proxies, raw sockets, or distributed execution.
- Stages are fixed at 2, 5, 10, and 20 login requests per second for 2 minutes each.
- The test performs a 60-second recovery observation after traffic stops.

## Runner architecture

A production-specific TypeScript executable reuses pure statistics and circuit helpers but owns a separate compiled production origin and immutable stage profile. A monotonic scheduler starts each stage with no accumulated request credit, caps in-flight work at 10, and never compensates for slow responses with a later burst.

Health checks run before the first stage, every 30 seconds, between stages, and after the 60-second recovery interval. Health traffic is excluded from stage request-rate calculations.

## Automatic and operator stop conditions

The runner stops scheduling new login traffic when any condition occurs:

- a health check does not return HTTP 200;
- any login attempt returns `5xx`;
- five consecutive login attempts fail at the network layer;
- nearest-rank P95 latency in the current 30-second window exceeds 1,000 ms after at least 20 completed attempts;
- the global deadline expires;
- the operator interrupts because CPU exceeds 80% or another monitored production metric becomes unsafe.

An interrupt must abort in-flight fetches, skip later stages, and still print the accumulated summary. The production operator remains responsible for watching VPS, Nginx, Node.js, Redis, and database metrics during execution because the load generator cannot read those systems directly.

## Reporting

The report contains one section per completed or interrupted stage: scheduled and completed login attempts, status counts, network errors, average latency, P95 latency, server errors, duration, and stop reason. A final recovery health result is included. Request bodies, response bodies, cookies, tokens, and credentials are never printed.

## Verification and execution

Unit tests inject fake fetch, clock, and interruption signals, and never contact production. They verify immutable origin and stages, rate windows, concurrency, health cadence, each automatic circuit, recovery, interruption, and sanitized reporting.

Before live execution, focused tests, TypeScript typecheck, production build, `git diff --check`, and a prohibited-capability scan must pass. Live execution requires explicit confirmation immediately before the command is run.
