import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';

// Real, isolated DB evidence. This is not an assistant/HTTP/authentication test.
export function databaseBusinessAudit(module: string, models: any[]) {
  const directory = process.env.ASSISTANT_DATABASE_AUDIT_DIR;
  let before: unknown;
  let checkpoints: Array<{ label: string; input: unknown; state: unknown }> = [];
  const snapshot = async () => {
    if (!directory) return null;
    if (!['127.0.0.1', 'localhost', '::1'].includes(mongoose.connection.host)) throw new Error('Audit requires isolated local MongoDB');
    return Object.fromEntries(await Promise.all(models.map(async model => [model.modelName, {
      count: await model.countDocuments({}), documents: await model.find({}).sort({ _id: 1 }).limit(50).lean(), documentLimit: 50,
    }])));
  };
  return {
    before: async () => { checkpoints = []; before = await snapshot(); },
    checkpoint: async (label: string, input: unknown = null) => {
      if (directory) checkpoints.push({ label, input, state: await snapshot() });
    },
    after: async (name: string) => {
      if (!directory) return;
      const after = await snapshot();
      fs.mkdirSync(directory, { recursive: true });
      fs.appendFileSync(path.join(directory, `${module}.jsonl`), JSON.stringify({ module, name,
        layer: 'real local MongoDB and business services; no assistant conversation or HTTP authentication', before, checkpoints, after }) + '\n');
    },
  };
}
