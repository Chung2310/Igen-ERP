import { mkdir, open, readFile, readdir, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export interface AiSettlementIntent { usageId: string; success: boolean; companyCode: string; recordedAt: string }
// No prompts, provider responses or credentials are stored here.
const directory = path.resolve("server/cache/ai-settlements");
const validId = (id: string) => /^[a-f0-9]{24}$/i.test(id);
const filename = (id: string) => {
  if (!validId(id)) throw new Error("Invalid AI usage ID");
  return path.join(directory, `${id}.json`);
};

export async function writeAiSettlementIntent(intent: AiSettlementIntent): Promise<void> {
  const target = filename(intent.usageId);
  await mkdir(directory, { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    const file = await open(temporary, "wx", 0o600);
    try { await file.writeFile(JSON.stringify(intent), "utf8"); await file.sync(); }
    finally { await file.close(); }
    await rename(temporary, target);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}
export async function removeAiSettlementIntent(usageId: string): Promise<void> {
  await unlink(filename(usageId)).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
}
export async function readAiSettlementIntents(limit = 100): Promise<AiSettlementIntent[]> {
  let names: string[];
  try { names = await readdir(directory); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  const intents: AiSettlementIntent[] = [];
  for (const name of names.filter((entry) => /^[a-f0-9]{24}\.json$/i.test(entry)).slice(0, limit)) {
    try {
      const data = JSON.parse(await readFile(path.join(directory, name), "utf8")) as AiSettlementIntent;
      if (!validId(data.usageId) || name !== `${data.usageId}.json` || typeof data.success !== "boolean" || typeof data.companyCode !== "string") {
        throw new Error("Invalid AI settlement journal entry");
      }
      intents.push(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      // Preserve unreadable entries for inspection without blocking valid settlements behind them.
      await rename(path.join(directory, name), path.join(directory, `${name}.invalid`)).catch(() => undefined);
      console.warn(`[AI quota] Settlement entry ${name} requires inspection.`);
    }
  }
  return intents;
}
