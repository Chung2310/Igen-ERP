import { LoadTestApiClient, requireRuntimeCredentials } from "./api-client.js";
import { cleanupManifest } from "./cleanup.js";
import { loadManifest, saveManifest } from "./manifest-store.js";

if (process.env.LOAD_TEST_CONFIRM !== "STAGING_ONLY") throw new Error("LOAD_TEST_CONFIRM=STAGING_ONLY is required");
const runId = process.env.LOAD_TEST_RUN_ID;
if (!runId) throw new Error("LOAD_TEST_RUN_ID is required");
const credentials = requireRuntimeCredentials(process.env);
const manifest = await loadManifest(runId);
const client = new LoadTestApiClient(fetch, credentials.bypassSecret);
await client.login(credentials.adminEmail, credentials.adminPassword);
await cleanupManifest(client, manifest);
await saveManifest(manifest);
console.log(JSON.stringify({ runId, state: manifest.state, usersDeleted: manifest.resources.users.length }, null, 2));
