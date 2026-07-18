import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { RunManifest } from "./manifest.js";

const ROOT = resolve("tmp", "load-tests");

function manifestPath(runId: string): string {
  if (!/^[a-zA-Z0-9-]+$/.test(runId)) throw new Error("invalid run id");
  return resolve(ROOT, `${runId}.json`);
}

export async function saveManifest(manifest: RunManifest): Promise<string> {
  await mkdir(ROOT, { recursive: true });
  const destination = manifestPath(manifest.runId);
  const temporary = `${destination}.tmp`;
  await writeFile(temporary, JSON.stringify(manifest, null, 2), { encoding: "utf8", mode: 0o600 });
  await rename(temporary, destination);
  return destination;
}

export async function loadManifest(runId: string): Promise<RunManifest> {
  const parsed = JSON.parse(await readFile(manifestPath(runId), "utf8")) as RunManifest;
  if (parsed.version !== 1 || parsed.runId !== runId || parsed.marker !== `LOADTEST-${runId}`) {
    throw new Error("invalid manifest");
  }
  return parsed;
}
