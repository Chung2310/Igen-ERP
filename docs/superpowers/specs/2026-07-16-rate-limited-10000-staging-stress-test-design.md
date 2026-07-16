# Rate-Limited 10,000-Request Staging Stress Test Design

## Goal

Extend the existing staging-only stress tool to send exactly 10,000 login attempts at a controlled maximum rate of 20 requests per second, with concurrency capped at 10 and automatic safety shutdowns.

## Scope and immutable safety limits

- Target remains compiled to `https://staging-erp.igentechsolutions.com`; no CLI or environment target override is allowed.
- The only traffic endpoints are `GET /api/v1/health` and `POST /api/v1/auth/login`.
- Login traffic uses the existing fixed `.invalid` account and never real credentials.
- Maximum requested login attempts: 10,000.
- Maximum concurrency: 10.
- Maximum issue rate: 20 login requests per second.
- Maximum wall-clock duration: 10 minutes.
- One local process only; no workers, proxies, sockets, or distributed execution.

## Architecture

The existing TypeScript runner remains the sole executable. Its parser accepts only request count and concurrency, clamps them to the immutable limits, and exposes no target or rate override. A monotonic scheduler issues work in groups of at most 20 during each one-second window while also respecting the concurrency ceiling. Slow responses never create accumulated credit, so the runner does not compensate with later bursts.

Health checks run before login traffic, after each 100 completed login attempts, and once after the final group. Health requests do not count toward the 10,000-login total or the 20-login-per-second budget.

## Stop conditions and reporting

The runner stops without scheduling more login traffic when any of these conditions occurs:

- the global 10-minute deadline expires;
- a health check does not return HTTP 200;
- more than 5% of at least 20 completed login attempts return `5xx`;
- 10 consecutive login attempts fail at the network layer.

The report contains only completed attempt count, status counts, network-error count, average latency, p95 latency, server-error count, stop reason, and duration. It never prints request or response bodies, cookies, tokens, or credentials.

## Testing

Unit tests inject a fake fetch and fake clock/sleep implementation. They verify parser clamping, the 10,000/10/20/10-minute limits, concurrency, issue-rate windows, health-check cadence, no catch-up bursts, and each circuit breaker without accessing staging.

Before any live run, the focused test suite, TypeScript typecheck, production build, `git diff --check`, and a prohibited-capability scan must pass. The authorized live command uses exactly 10,000 requests and concurrency 10.
