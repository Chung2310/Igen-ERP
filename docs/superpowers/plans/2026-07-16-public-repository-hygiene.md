# Public Repository Hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop runtime artifacts and common credential files from entering the public repository and untrack existing cache/scratch artifacts without deleting local files or rewriting history.

**Architecture:** `.gitignore` is the preventive boundary for future files, while a current-index cleanup removes already tracked runtime artifacts. Git-native assertions verify both ignore behavior and index state without adding application runtime code.

**Tech Stack:** Git, `.gitignore`, PowerShell, TypeScript/Vite build verification.

## Global Constraints

- Clean the current branch forward only; do not rewrite Git history or force-push.
- Keep cache and scratch files on the local filesystem.
- Keep `.env.example` tracked and do not change MongoDB defaults.
- Preserve all unrelated workspace changes and untracked documents.

---

### Task 1: Prevent future runtime and credential artifacts

**Files:**
- Modify: `.gitignore`

**Interfaces:**
- Consumes: Git ignore pattern matching.
- Produces: narrow ignore rules for runtime/cache data, database dumps, private keys, certificates, and credential JSON files.

- [ ] **Step 1: Verify representative paths are not yet ignored**

Run `git check-ignore server/cache/new-video.mp4 uploads/example.bin local.sqlite database.dump private.key service-account.json`.

Expected: at least `server/cache/new-video.mp4`, `uploads/example.bin`, `local.sqlite`, `database.dump`, `private.key`, and `service-account.json` are absent from output, proving the preventive rules are missing.

- [ ] **Step 2: Add minimal ignore rules**

Add rules for `server/cache/`, `uploads/`, `tmp/`, `temp/`, `*.sqlite`, `*.sqlite3`, `*.db`, `*.dump`, `*.bak`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `credentials*.json`, `service-account*.json`, and `service_account*.json`. Retain `!.env.example`.

- [ ] **Step 3: Verify representative paths are ignored**

Run the Step 1 command and `git check-ignore .env.example`.

Expected: every sensitive representative path is listed, while `.env.example` is absent because it remains allowed.

### Task 2: Remove current artifacts from the Git index

**Files:**
- Remove from Git index only: `server/cache/`
- Remove from Git index only: `scratch/`

**Interfaces:**
- Consumes: existing `.gitignore` rules and tracked index entries.
- Produces: no tracked entries below `server/cache` or `scratch`, with local files preserved.

- [ ] **Step 1: Verify the tracked-artifact assertion currently fails**

Run `git ls-files server/cache scratch`.

Expected: seventeen MP4 cache paths and two scratch workflow paths are printed.

- [ ] **Step 2: Remove artifacts from the index without deleting local files**

Run `git rm -r --cached -- server/cache scratch`.

- [ ] **Step 3: Verify index cleanup and local preservation**

Run `git ls-files server/cache scratch`, then test representative existing cache and scratch files with PowerShell `Test-Path`.

Expected: Git prints no tracked artifact paths and both representative local-file checks return `True`.

### Task 3: Security and regression verification

**Files:**
- Review: `.gitignore`
- Review: staged index deletions under `server/cache/` and `scratch/`

**Interfaces:**
- Produces: evidence that the repository is cleaner without affecting application compilation.

- [ ] **Step 1: Scan tracked paths and common secret signatures**

List suspicious tracked names and scan for private-key blocks and common provider-token formats while outputting filenames only.

Expected: no cache/scratch paths, private keys, or recognized provider tokens are reported; `.env.example` may appear only as the intentional template.

- [ ] **Step 2: Run repository verification**

Run `git diff --check`, `npm run typecheck`, and `npm run build`.

Expected: every command exits 0.

- [ ] **Step 3: Review scope**

Run `git status --short` and inspect the `.gitignore` diff plus staged deletion names.

Expected: only `.gitignore`, this plan, and cache/scratch index deletions belong to this implementation; unrelated existing changes remain unstaged and untouched.
