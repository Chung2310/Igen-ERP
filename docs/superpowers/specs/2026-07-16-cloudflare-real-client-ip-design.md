# Cloudflare Real Client IP Design

## Goal

Make every DDoS-protection layer identify a visitor by the same real client IP when traffic flows through Cloudflare and Nginx, without trusting spoofable headers from direct clients.

## Architecture

Nginx is the only component that interprets `CF-Connecting-IP`. The Nginx real-IP module accepts that header only when the TCP peer belongs to an official Cloudflare IPv4 or IPv6 range. It then rewrites `$remote_addr`, so the existing `$binary_remote_addr` request and connection zones automatically key limits by visitor IP.

Nginx overwrites `X-Real-IP` and `X-Forwarded-For` with the normalized `$remote_addr` before proxying to Node.js. Express retains `trust proxy = 1`, matching the single Nginx hop. Socket.IO derives its protection key from the sanitized `X-Real-IP` header supplied by Nginx and falls back to the transport address when the header is absent.

## Components

### Cloudflare trust configuration

Create a dedicated Nginx include containing `set_real_ip_from` entries for every range published on Cloudflare's official IP list. Configure:

```nginx
real_ip_header CF-Connecting-IP;
real_ip_recursive on;
```

The include is loaded in Nginx's `http` context before rate-limit zones are evaluated. Cloudflare range updates are deliberate deployment changes: update the include from the official source, review the diff, run `nginx -t`, and reload only after validation.

### Sanitized proxy headers

Every HTTP and Socket.IO proxy location sets:

```nginx
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $remote_addr;
```

Overwriting rather than appending prevents a client-controlled forwarding chain from reaching Express. Existing host, scheme, upgrade, timeout, and rate-limit behavior remains unchanged.

### Socket.IO client identity

Expose a focused helper that normalizes a trusted `X-Real-IP` value into one client identity. It accepts a single string header, handles Node's optional string-array header representation, trims whitespace, and falls back to `socket.handshake.address`. It does not parse arbitrary comma-separated forwarding chains and does not trust `CF-Connecting-IP` directly.

The same normalized IP is used for handshake counters, active-connection counters, and disconnect cleanup.

### Origin restriction

At deployment time, restrict public ports 80 and 443 at the host or provider firewall to current Cloudflare address ranges. Preserve explicit administrative or monitoring access only where operationally required. This restriction is mandatory before treating `CF-Connecting-IP` as authoritative; otherwise direct-origin requests could spoof it or bypass Cloudflare.

Because this repository contains no firewall infrastructure definition, the code change supplies a deployment checklist rather than mutating the VPS firewall automatically.

## Logging and failure behavior

Nginx access logs record the normalized visitor address, the original proxy peer address through `$realip_remote_addr`, and `$http_cf_ray` for staging diagnosis. Logs must not expose authentication tokens or request bodies.

If a request does not arrive from a trusted Cloudflare range, Nginx ignores `CF-Connecting-IP` and keeps the TCP peer as `$remote_addr`. Node continues to receive only Nginx-sanitized headers. Missing Socket.IO IP headers fall back safely to the transport address.

## Testing

- Add unit tests proving Socket.IO prefers the sanitized `X-Real-IP`, handles array/whitespace input, rejects comma-separated chains, and falls back to the transport address.
- Add a static Nginx configuration test verifying official Cloudflare CIDRs, real-IP directives, sanitized proxy headers, and diagnostic log fields.
- Run targeted Node tests, TypeScript typecheck, the existing lint command, production build, and `git diff --check`.
- Validate the deployed configuration with `nginx -t` before reload.
- On staging, send sequential and concurrent login requests from one client. Rate-limit remaining values must share one monotonically decreasing counter and excess requests must return 429.
- Confirm a second external IP receives an independent counter and Socket.IO handshake abuse is rejected with `RATE_LIMITED`.

## Rollout

1. Back up the active Nginx configuration.
2. Install the Cloudflare real-IP include and updated site configuration.
3. Run `nginx -t`; do not reload on any syntax error.
4. Restrict the origin firewall to Cloudflare ranges plus explicitly approved operational sources.
5. Reload Nginx and verify health, login, API, and Socket.IO paths.
6. Run controlled staging rate-limit tests and inspect normalized/original-IP log fields.
7. Roll back the Nginx files and firewall rule set if legitimate traffic loses access.

## Non-goals

- No sustained volumetric DDoS test against staging.
- No blind automatic firewall or Cloudflare CIDR updates.
- No change to rate-limit thresholds, successful response bodies, authentication logic, or business rules.
- No direct trust of public forwarding headers inside Express or Socket.IO.
