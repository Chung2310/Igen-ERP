export type ResourceKind = "users" | "students" | "courses" | "batches" | "partners" | "resources" | "schedules" | "chats";
export interface ManifestResource { id: string; marker: string }
export interface RunManifest {
  version: 1;
  runId: string;
  marker: string;
  state: "creating" | "ready" | "cleaning" | "cleaned";
  resources: Record<ResourceKind, ManifestResource[]>;
}

export function createManifest(runId: string): RunManifest {
  if (!/^[a-zA-Z0-9-]+$/.test(runId)) throw new Error("invalid run id");
  return {
    version: 1,
    runId,
    marker: `LOADTEST-${runId}`,
    state: "creating",
    resources: { users: [], students: [], courses: [], batches: [], partners: [], resources: [], schedules: [], chats: [] },
  };
}

export function recordResource(manifest: RunManifest, kind: ResourceKind, id: string, marker: string): void {
  if (!marker.includes(manifest.marker)) throw new Error("resource marker mismatch");
  manifest.resources[kind].push({ id, marker });
}

export function validateCleanupTarget(manifest: RunManifest, kind: ResourceKind, id: string): boolean {
  return manifest.resources[kind].some((resource) => resource.id === id && resource.marker.includes(manifest.marker));
}

export function serializeManifest(manifest: RunManifest): string {
  return JSON.stringify(manifest, null, 2);
}
