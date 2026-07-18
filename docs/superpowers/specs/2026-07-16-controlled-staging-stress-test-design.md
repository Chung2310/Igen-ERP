# Controlled Staging Stress Test Design

## Goal

Provide a repeatable, bounded load test that verifies the staging HTTP rate-limit layers without becoming a general-purpose flooding tool or risking prolonged service disruption.

## Target and safety boundary

The test target is compiled into the script as exactly `https://staging-erp.igentechsolutions.com`. The script accepts no URL, hostname, proxy list, credential, access token, or distributed-worker option.

Hard limits cannot be raised through CLI flags or environment variables:

- At most 100 requests per run.
- At most 10 in-flight requests.
- At most 15 seconds wall-clock time.
- One local process only.
- Only `GET /api/v1/health` and `POST /api/v1/auth/login` are requested.

The login payload uses a fixed nonexistent `.invalid` email and password. It never uses a real account and never prints response bodies, cookies, or tokens.

## Structure

Create a focused TypeScript module under `tools/controlled-staging-stress-test.ts`. Pure helpers validate/clamp numeric CLI options, calculate latency percentiles, aggregate status counts, and decide whether the safety circuit must stop. The executable entry point coordinates health probes and fixed-size request batches using the built-in `fetch` API.

Add `npm run stress:staging` as the only normal invocation. Supported optional flags are `--requests <1-100>` and `--concurrency <1-10>`; invalid, missing, zero, negative, or excessive values resolve to safe bounded values. No target flag exists.

## Traffic flow

1. Confirm the configured URL exactly matches the compiled staging allowlist.
2. Run a health probe and stop unless it returns HTTP 200.
3. Dispatch login requests in batches no larger than the selected concurrency.
4. After every batch, update status/latency statistics and run another health probe.
5. Stop immediately when health is not 200, elapsed time reaches 15 seconds, or cumulative HTTP `5xx` responses exceed 5% after at least 20 completed requests.
6. Print a final summary containing attempted/completed request counts, status counts, average latency, p95 latency, elapsed time, stop reason, and final health status.

Expected `401` and `429` responses are counted, not treated as script failures. Network errors are counted separately and participate in the stop report.

## Error handling

Every fetch has a short per-request timeout bounded by the global deadline. The global `AbortController` cancels remaining work at 15 seconds. The script exits nonzero only when the initial/final health check fails, the `5xx` circuit trips, or network errors prevent a meaningful result. It exits zero when staging remains healthy and the result contains `401` and/or `429` responses.

## Testing

- Unit-test that target selection cannot be overridden.
- Unit-test defaults and hard clamping for request/concurrency inputs.
- Unit-test average/p95 and status aggregation.
- Unit-test the `5xx > 5% after 20 completions` circuit condition.
- Unit-test that `401` and `429` do not trip the failure circuit.
- Run the test module, TypeScript typecheck, production build, and `git diff --check`.
- Live execution requires explicit user authorization each time; implementation tests must not automatically contact staging.

## Non-goals

- No unbounded, distributed, volumetric, UDP, TCP SYN, slowloris, proxy-rotation, CAPTCHA-bypass, credential-stuffing, or WebSocket flood capability.
- No production target support.
- No real user credentials.
- No attempt to saturate Cloudflare, the VPS network link, Redis, or the database.
