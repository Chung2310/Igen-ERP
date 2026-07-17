import { validateCleanupTarget, type RunManifest } from "./manifest.js";

export interface CleanupClient { deleteUser(id: string): Promise<void> }

export async function cleanupManifest(client: CleanupClient, manifest: RunManifest): Promise<void> {
  manifest.state = "cleaning";
  for (const resource of [...manifest.resources.users].reverse()) {
    if (!validateCleanupTarget(manifest, "users", resource.id)) throw new Error("cleanup target is outside manifest");
    await client.deleteUser(resource.id);
  }
  manifest.state = "cleaned";
}
