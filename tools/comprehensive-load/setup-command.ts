import { LoadTestApiClient, requireRuntimeCredentials } from "./api-client.js";
import { saveManifest } from "./manifest-store.js";
import { setupSyntheticUsers } from "./setup.js";

if (process.env.LOAD_TEST_CONFIRM !== "STAGING_ONLY") throw new Error("LOAD_TEST_CONFIRM=STAGING_ONLY is required");
const credentials = requireRuntimeCredentials(process.env);
const usersFlag = process.argv.indexOf("--users");
const requestedUsers = usersFlag >= 0 ? Number(process.argv[usersFlag + 1]) : 5;
if (!Number.isInteger(requestedUsers) || requestedUsers < 1 || requestedUsers > 1_000) throw new Error("--users must be 1..1000");
const runId = process.env.LOAD_TEST_RUN_ID ?? new Date().toISOString().replace(/\D/g, "").slice(0, 14);
const client = new LoadTestApiClient(fetch, credentials.bypassSecret);
const manifest = await setupSyntheticUsers(client, { runId, count: requestedUsers, ...credentials });
const path = await saveManifest(manifest);
console.log(JSON.stringify({ runId, usersCreated: manifest.resources.users.length, manifestPath: path }, null, 2));
