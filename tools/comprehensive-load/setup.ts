import { createManifest, recordResource, type RunManifest } from "./manifest.js";
import { MAX_VUS } from "./profile.js";

export interface SetupClient {
  login(email: string, password: string): Promise<{ userId: string }>;
  createUser(input: { displayName: string; email: string; password: string }): Promise<{ id: string }>;
}

export interface SetupOptions {
  runId: string;
  count: number;
  adminEmail: string;
  adminPassword: string;
  userPassword: string;
}

export async function setupSyntheticUsers(client: SetupClient, options: SetupOptions): Promise<RunManifest> {
  const count = Math.min(MAX_VUS, Math.max(1, Math.trunc(options.count)));
  const manifest = createManifest(options.runId);
  await client.login(options.adminEmail, options.adminPassword);
  for (let index = 1; index <= count; index += 1) {
    const suffix = String(index).padStart(4, "0");
    const marker = `${manifest.marker}-user-${suffix}`;
    const email = `${marker}@example.invalid`;
    const created = await client.createUser({ displayName: marker, email, password: options.userPassword });
    recordResource(manifest, "users", created.id, email);
  }
  manifest.state = "ready";
  return manifest;
}
