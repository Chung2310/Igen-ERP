# CGNAT-Aware DDoS Protection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent false-positive DDoS blocks for large offices and CGNAT users while preserving strict per-user, per-account, and unauthenticated flood controls.

**Architecture:** Nginx becomes a wide IP backstop with separate auth and socket zones. Express stores all HTTP limiter counters in Redis and keys authenticated traffic by verified user identity. Socket protection keeps wide IP counters, enforces tight per-user connection limits, and shares per-user event windows through Redis.

**Tech Stack:** TypeScript, Express, express-rate-limit, Redis Lua scripts, Socket.IO, nginx, Node test runner.

## Global Constraints

- IP limits are wide backstops, never the primary quota for authenticated users.
- Authenticated identity comes only from a verified JWT.
- Login account keys are normalized lowercase emails.
- Redis limiter failures remain fail-open and log throttled warnings.
- Existing Cloudflare real-IP trust boundaries must remain unchanged.

---

### Task 1: Redis-backed HTTP auth limiters

**Files:**
- Modify: `server/config/ddos.ts`
- Modify: `server/config/ddos.test.ts`
- Modify: `server/middleware/rate-limit.ts`
- Modify: `server/middleware/rate-limit-key.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: configurable `authIpLimit = 300`, `refreshIpLimit = 1000`, and Redis stores with unique prefixes for auth IP, login account, and refresh IP.

- [ ] **Step 1: Write failing configuration and limiter-structure tests** asserting new defaults and unique Redis prefixes.
- [ ] **Step 2: Run focused tests** and verify failures reference the old limits or absent Redis stores.
- [ ] **Step 3: Extend DDoS config** with refresh window/limit and raise the auth backstop.
- [ ] **Step 4: Convert auth, login-account, and refresh limiters** to `RedisRateLimitStore` while retaining current key generators and fail-open logging.
- [ ] **Step 5: Document variables in `.env.example` and rerun focused tests to PASS.**

### Task 2: CGNAT-safe socket connection and event limits

**Files:**
- Modify: `server/config/ddos.ts`
- Modify: `server/socket-protection.ts`
- Modify: `server/socket-protection.test.ts`
- Modify: `server/socket.ts`

**Interfaces:**
- Produces: `consumeEvent(userId, socketId)` backed by a shared counter and defaults `handshake=300`, `maxPerUser=5`, `maxPerIp=500`.

- [ ] **Step 1: Write failing tests** proving 100 distinct users share one IP, user connection six is rejected, and multiple socket IDs for one user share an event quota.
- [ ] **Step 2: Run socket tests and verify the shared-IP and shared-user-event cases fail.**
- [ ] **Step 3: Raise IP defaults and lower the per-user connection default.**
- [ ] **Step 4: Add a Redis-backed user event window** and keep violation counts per socket for disconnect behavior.
- [ ] **Step 5: Pass authenticated `userId` into event consumption and rerun socket tests to PASS.**

### Task 3: Separate and widen nginx backstops

**Files:**
- Modify: `nginx/igenerp.conf`
- Modify: `nginx/igenerp.conf.test.ts`

**Interfaces:**
- Produces: independent `igen_auth` and `igen_socket` request zones with the exact rates and connection thresholds from the design.

- [ ] **Step 1: Add failing static tests** for separate zones, `100r/s` general API, `10r/s` auth, `50r/s` socket, and widened connection limits.
- [ ] **Step 2: Run the nginx test and confirm old configuration fails.**
- [ ] **Step 3: Update nginx zones and locations** without changing Cloudflare IP normalization or upstream headers.
- [ ] **Step 4: Rerun nginx tests to PASS.**

### Task 4: Regression and build verification

**Files:**
- All files modified in Tasks 1-3.

- [ ] **Step 1: Run focused DDoS, Redis, socket, and nginx tests; expect zero failures.**
- [ ] **Step 2: Run project typecheck and production build; distinguish unrelated baseline failures from feature failures.**
- [ ] **Step 3: Run `git diff --check` and inspect the complete diff for secrets, proxy regressions, and unrelated files.**
- [ ] **Step 4: Commit implementation without staging pre-existing untracked Super Admin plan files.**
