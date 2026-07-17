# Public Repository Hygiene Design

## Goal

Prevent runtime artifacts, local credentials, private keys, database dumps, and scratch automation files from being committed to the public repository, while removing currently tracked artifacts from the repository's next commit without rewriting Git history.

## Scope

This change cleans the current branch forward only. It does not rewrite existing commits, force-push, rotate credentials, delete local working files, or change application behavior.

## Findings

- `.env*` is already ignored and `.env.example` is explicitly allowed.
- `logs/`, build output, dependencies, `scratch/`, and common temporary directories are already ignored.
- Two n8n workflow JSON files under `scratch/` remain tracked because they were committed before the ignore rule existed.
- Seventeen MP4 files under `server/cache/videos/` remain tracked and add runtime-generated content and substantial binary weight to the public repository.
- The scanned tracked tree contains no recognized private-key blocks or common provider-token formats.
- MongoDB defaults point to the internal Docker service `mongodb` and local host `127.0.0.1`; they contain no embedded credentials and remain source-controlled.

## Ignore policy

Keep existing rules and add narrowly scoped patterns for:

- `server/cache/`, upload directories, and common runtime temporary directories.
- SQLite/database files and dump/backup extensions.
- PEM, private-key, PKCS#12, and PFX files.
- common service-account and credential JSON filenames.

Continue allowing `.env.example`. Do not broadly ignore all JSON, certificates used as public fixtures, source modules containing the word `token`, or application media stored intentionally under public assets.

## Removing already tracked artifacts

Remove `server/cache/` and `scratch/` from the Git index with `git rm --cached -r`. Because matching ignore rules remain active, the files stay on the local filesystem but appear as deletions in the next commit and cannot be accidentally re-added through a normal `git add`.

No unrelated uncommitted file is staged or changed. In particular, preserve the existing `RoleModal.tsx`, `.claude/`, and unrelated design/plan documents.

## Verification

- `git check-ignore` must identify representative cache, upload, key, credential, database, and scratch paths while `.env.example` remains unignored.
- `git ls-files server/cache scratch` must be empty after the index cleanup.
- Representative cache and scratch files must still exist locally.
- Scan the tracked tree by filename and common secret patterns without printing secret values.
- Run `git diff --check`, TypeScript typecheck, and the production build.

## Operational limits

This change does not remove data from existing public commit history. Anyone with an old commit can still retrieve previously committed artifacts. A separate approved history-rewrite operation would be required for permanent Git-history removal.
