# Low-rating assistant patch review

Ratings of 1–2 stars are queued as improvement work. The separate patch worker asks Codex CLI for a focused regression test and code diff, applies the diff in a temporary Git worktree, runs TypeScript typechecking and the full Vitest suite, and creates a **draft** pull request only if both checks pass. It never merges or deploys. A reviewer must inspect and merge the PR.

## VPS setup

Keep the feature disabled until the isolated source checkout, Codex account, and review token are ready. Use a dedicated Unix account for Codex; do not run the patch worker as that account. The worker reads the app's Mongo and GitHub settings, but launches Codex with a filtered environment through `sudo`.

1. Create a clean, separate Git checkout for the worker at a path readable by the Codex account. It must not contain `.env`, credentials, production data, Git credential helpers, or uncommitted changes. Keep `node_modules` installed in that checkout for tests.
2. Install and authenticate Codex CLI as the dedicated account. Grant that account read access to the checkout. Configure `sudo -n` so the app worker can invoke only the Codex executable as that account.
3. Configure these worker environment variables:

   - `ASSISTANT_FEEDBACK_AUTOPATCH_ENABLED=true`
   - `ASSISTANT_FEEDBACK_AUTOPATCH_CWD=/opt/igen/feedback-source`
   - `ASSISTANT_FEEDBACK_CODEX_OS_USER=igen-codex`
   - `ASSISTANT_FEEDBACK_CODEX_HOME=/home/igen-codex/.codex`
   - `ASSISTANT_CODEX_CLI_BIN=/usr/local/bin/codex` (if `codex` is not on the service PATH)
   - `ASSISTANT_FEEDBACK_GITHUB_REPOSITORY=owner/repository`
   - `ASSISTANT_FEEDBACK_GITHUB_BASE_BRANCH=main` (optional; defaults to `main`)
   - `ASSISTANT_FEEDBACK_GITHUB_TOKEN=...` with repository contents-write and pull-request-write access

4. Build and run the worker alongside the ERP API:

   ```sh
   npm run build:assistant-feedback-patch-worker
   npm run start:assistant-feedback-patch-worker
   ```

Without the enable flag, the worker stays off and low ratings remain queued. Missing source or GitHub configuration causes a job to fail with a short error code; it does not affect saving the rating. If no GitHub token is configured, a successful patch remains as a local branch and is not deployed.

## Review boundary

Codex receives only the low-rating question, answer, and comment as untrusted evidence; its environment contains no application or GitHub tokens. The server accepts only a bounded diff targeting TypeScript/TSX/Markdown under `server/` or `src/`, runs checks in a disposable worktree, and pushes a draft PR after checks pass. Review and merge remain manual.
