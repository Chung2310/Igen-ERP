# Cloudflare Real Client IP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Nginx, Express, Redis rate limits, and Socket.IO consistently key clients by the real visitor IP behind Cloudflare.

**Architecture:** Nginx trusts `CF-Connecting-IP` only from official Cloudflare CIDRs, rewrites `$remote_addr`, and sends a single sanitized IP to Node. A focused Socket.IO helper consumes only Nginx's sanitized `X-Real-IP` and otherwise falls back to the transport address.

**Tech Stack:** Nginx realip module, TypeScript, Socket.IO, Node.js test runner, tsx.

## Global Constraints

- Preserve the uncommitted staging hostname and certificate paths in `nginx/igenerp.conf`.
- Preserve unrelated changes in `src/components/user-admin/RoleModal.tsx`, `.claude/`, and existing untracked docs.
- Do not trust `CF-Connecting-IP` directly in Node.js.
- Do not change current rate thresholds or business behavior.
- Firewall changes remain a documented VPS deployment step because the repository has no firewall IaC.

---

### Task 1: Nginx trusted Cloudflare identity

**Files:**
- Create: `nginx/cloudflare-realip.conf`
- Create: `nginx/igenerp.conf.test.ts`
- Modify: `nginx/igenerp.conf`

**Interfaces:**
- Consumes: Cloudflare's published IPv4/IPv6 CIDRs and Nginx realip variables.
- Produces: normalized `$remote_addr`, sanitized upstream headers, and diagnostic access logs.

- [ ] **Step 1: Write the failing static configuration test**

Create a Node test that reads both Nginx files and asserts all official CIDRs exist, `real_ip_header CF-Connecting-IP` and `real_ip_recursive on` are configured, no location uses `$proxy_add_x_forwarded_for`, all six upstream locations overwrite both client-IP headers, and the access log contains `$realip_remote_addr` plus `$http_cf_ray`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test nginx/igenerp.conf.test.ts`

Expected: FAIL because `nginx/cloudflare-realip.conf` and the real-IP directives do not exist.

- [ ] **Step 3: Implement the minimal Nginx configuration**

Add the official Cloudflare CIDRs as `set_real_ip_from` entries, configure the real-IP header and recursion in the include, load it before rate-limit zones, replace every `$proxy_add_x_forwarded_for` with `$remote_addr`, and use a log format containing `$remote_addr`, `$realip_remote_addr`, and `$http_cf_ray`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test nginx/igenerp.conf.test.ts`

Expected: PASS with zero failures.

### Task 2: Socket.IO trusted client identity

**Files:**
- Create: `server/socket-client-ip.ts`
- Create: `server/socket-client-ip.test.ts`
- Modify: `server/socket.ts`

**Interfaces:**
- Produces: `getTrustedSocketClientIp(headers: IncomingHttpHeaders, transportAddress?: string): string`.
- Consumes: sanitized `x-real-ip` supplied only by Nginx and the Socket.IO transport address fallback.

- [ ] **Step 1: Write failing helper tests**

Test that a trimmed single `x-real-ip` wins, a one-item array is accepted, comma-separated values are rejected in favor of transport address, blank/multiple arrays fall back, and missing addresses yield `unknown`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test server/socket-client-ip.test.ts`

Expected: FAIL because `server/socket-client-ip.ts` does not exist.

- [ ] **Step 3: Implement the minimal helper and integrate it**

Export the typed helper, reject any value containing a comma, and replace `getSocketIp` in `server/socket.ts` with calls using `socket.handshake.headers` and `socket.handshake.address`.

- [ ] **Step 4: Run focused tests to verify they pass**

Run: `npx tsx --test server/socket-client-ip.test.ts server/socket-protection.test.ts`

Expected: PASS with zero failures.

### Task 3: Operational documentation and full verification

**Files:**
- Create: `docs/deployment/cloudflare-origin-protection.md`

**Interfaces:**
- Produces: a deploy/rollback checklist for Nginx syntax validation, Cloudflare-only origin rules, and controlled staging verification.

- [ ] **Step 1: Document deployment safety gates**

Document configuration backup, `nginx -t`, firewall allow-list ordering, health/login/Socket.IO smoke checks, diagnostic log inspection, CIDR update procedure, and rollback. Explicitly prohibit sustained flood testing.

- [ ] **Step 2: Run the complete verification suite**

Run targeted DDoS tests with `npx tsx --test`, then `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

Expected: every command exits 0 with zero test failures, TypeScript errors, lint errors, build errors, or whitespace errors.

- [ ] **Step 3: Review scoped diff**

Run `git status --short` and `git diff -- nginx server/socket.ts server/socket-client-ip.ts server/socket-client-ip.test.ts docs/deployment/cloudflare-origin-protection.md` and confirm unrelated workspace changes remain untouched.
