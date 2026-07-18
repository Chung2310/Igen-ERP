import { LoadTestApiClient, requireRuntimeCredentials } from "./api-client.js";
import { loadManifest } from "./manifest-store.js";
import { STAGES } from "./profile.js";
import { runLoadProfile } from "./runner.js";

if (process.env.LOAD_TEST_CONFIRM !== "STAGING_ONLY") throw new Error("LOAD_TEST_CONFIRM=STAGING_ONLY is required");
const runId = process.env.LOAD_TEST_RUN_ID;
if (!runId) throw new Error("LOAD_TEST_RUN_ID is required");
const credentials = requireRuntimeCredentials(process.env);
const manifest = await loadManifest(runId);
if (manifest.state !== "ready") throw new Error("manifest must be ready");

const clients: LoadTestApiClient[] = [];
for (let offset = 0; offset < manifest.resources.users.length; offset += 10) {
  const batch = manifest.resources.users.slice(offset, offset + 10);
  clients.push(...await Promise.all(batch.map(async (resource) => {
    const client = new LoadTestApiClient(fetch, credentials.bypassSecret);
    await client.login(resource.marker, credentials.userPassword);
    return client;
  })));
}
if (clients.length === 0) throw new Error("manifest contains no users");

const controller = new AbortController();
process.once("SIGINT", () => controller.abort());
const healthClient = new LoadTestApiClient(fetch, credentials.bypassSecret);
const routes: Record<string, [string, string, unknown?]> = {
  auth: ["GET", "/auth/me"],
  "dashboard-students": ["GET", "/students?limit=20"],
  "courses-batches": ["GET", "/courses?limit=20"],
  schedule: ["GET", "/schedule"],
  "partners-resources": ["GET", "/partners?limit=20"],
  "owned-write": ["PATCH", "/auth/profile", { displayName: manifest.marker }],
  chat: ["GET", "/chat/rooms"],
};

const effectiveStages = clients.length <= 5 ? [STAGES[0]] : STAGES;
const report = await runLoadProfile({
  clock: { now: () => performance.now(), sleep: (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms)) },
  random: Math.random,
  health: async () => (await healthClient.measure("GET", "/health")).status === 200,
  executeScenario: async (name, vuId) => {
    const [method, path, body] = routes[name];
    const measured = await clients[vuId % clients.length].measure(method, path, body);
    return { ...measured, validLogin: false };
  },
  signal: controller.signal,
}, effectiveStages);
console.log(JSON.stringify({ runId, ...report }, null, 2));
process.exitCode = report.stopReason === "completed" ? 0 : 1;
