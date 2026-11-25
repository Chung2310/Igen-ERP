# Goal orchestration evaluation

This opt-in harness runs the production `processTurn` and semantic interpreter with the full enabled catalog, in-memory sessions, synthetic business fixtures and no business writes. Ordinary Vitest discovery does not include `.live.ts` files.

Offline check in PowerShell:

```powershell
$env:ASSISTANT_WORKER_LIVE_APPROVED='1'
$env:ERP_GOAL_LIVE_MODE='dry'
npx vitest run --config server/assistant/testing/goal-orchestration-live/live.config.mjs
```

Real inference requires the user's approval for provider access, synthetic payloads and the USD 0.25 evaluation cap. Set `ERP_GOAL_LIVE_MODE=live` only after approval. The live mode loads the backend provider key locally without printing it. Dry mode uses a dummy key and scripted provider responses; it never calls a provider.

The ledger is `tmp/goal-orchestration-live/ledger.json`, capped at USD 0.25, and is never reset by this harness. Each request reserves an upper bound using actual wire bytes, output token limits and remotely enforced unit-price ceilings. Actual reported cost releases the reservation. Unknown outcomes retain their full reservation and stop subsequent calls. Do not delete the ledger or remove a billing stop merely to retry. A previous stopped run may be resumed only after investigating its cause and preserving any unresolved reservation.

Only the configured primary GPT-6 Luna inference is evaluated. Production Haiku fallback policy remains unchanged; this harness does not claim to evaluate fallback availability. Only OpenRouter chat completions can leave the process, and the business fixture rejects all mutation requests. Mongoose and unmocked HTTP are blocked by the shared live safety setup.

Four conversations cover sequential read/write, missing fields and form submission, duplicate-name selections, and a contextual follow-up referring to the person just viewed. Every write stops at confirmation. Results and source hashes are written under `tmp/goal-orchestration-live/`; they are generated artifacts rather than runtime state.
