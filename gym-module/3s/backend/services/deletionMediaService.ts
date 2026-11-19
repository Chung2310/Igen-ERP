import path from 'node:path';
import fs from 'node:fs/promises';
import { v2 as cloudinary } from 'cloudinary';
import type { ClientSession } from 'mongoose';
import DeletionMediaJob from '../models/DeletionMediaJob.js';
import { centerDataModels } from '../tenancy/centerDataModels.js';
import { logger } from '../config/logger.js';

export function collectDeletionAssets(value: unknown, assets = new Set<string>(), referencesOnly = false): Set<string> {
  if (typeof value === 'string') {
    const local = value.match(/^\/uploads\/food-images\/([a-zA-Z0-9_.-]+)$/);
    if (local && local[1] !== '.' && local[1] !== '..') assets.add(`local:${local[1]}`);
    try {
      const url = new URL(value);
      const localUrl = url.pathname.match(/^\/uploads\/food-images\/([a-zA-Z0-9_.-]+)$/);
      let isOurOrigin = false;
      try { isOurOrigin = Boolean(process.env.APP_URL && url.origin === new URL(process.env.APP_URL).origin); } catch { /* No public origin configured. */ }
      if (localUrl && (referencesOnly || isOurOrigin)) assets.add(`local:${localUrl[1]}`);
      const cloud = process.env.CLOUDINARY_CLOUD_NAME;
      if (cloud && url.hostname === 'res.cloudinary.com') {
        const match = url.pathname.match(/^\/([^/]+)\/(image|video)\/upload\/(?:[^/]+\/)*(3s-gym\/[a-zA-Z0-9_/-]+)\.[a-zA-Z0-9]+$/);
        if (match && match[1] === cloud) assets.add(`cloud:${cloud}:${match[2]}:${match[3]}`);
      }
    } catch { /* Not a managed remote asset. */ }
  } else if (Array.isArray(value)) {
    for (const item of value) collectDeletionAssets(item, assets, referencesOnly);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectDeletionAssets(item, assets, referencesOnly);
  }
  return assets;
}

export async function enqueueDeletionAssets(assets: Set<string>, session: ClientSession) {
  const values = [...assets];
  for (let start = 0; start < values.length; start += 500) {
    await DeletionMediaJob.create([{ assets: values.slice(start, start + 500) }], { session });
  }
}

let timer: ReturnType<typeof setInterval> | undefined;
let running = false;
export async function processDeletionMedia() {
  if (running) return;
  running = true;
  try {
    const job = await DeletionMediaJob.findOneAndUpdate(
      { nextAttemptAt: { $lte: new Date() } },
      { $set: { nextAttemptAt: new Date(Date.now() + 30 * 60_000) }, $inc: { attempts: 1 } },
      { sort: { nextAttemptAt: 1 }, returnDocument: 'after' },
    );
    if (!job) return;
    // Query raw collections explicitly: references in OTHER centers must be checked too.
    const referenced = new Set<string>();
    for (const model of centerDataModels) {
      for await (const document of model.collection.find({})) collectDeletionAssets(document, referenced, true);
    }
    const failed: string[] = [];
    for (const asset of job.assets) {
      if (referenced.has(asset)) continue;
      try {
        if (asset.startsWith('local:')) {
          const filename = asset.slice(6);
          if (!/^[a-zA-Z0-9_.-]+$/.test(filename) || filename === '.' || filename === '..') throw new Error('Invalid deletion filename');
          const root = await fs.realpath(path.resolve('uploads/food-images'));
          const target = path.resolve(root, filename);
          if (path.dirname(target) !== root) throw new Error('Invalid deletion path');
          const real = await fs.realpath(target);
          if (path.dirname(real) !== root || (await fs.lstat(target)).isSymbolicLink()) throw new Error('Invalid deletion target');
          await fs.unlink(target);
        } else {
          const match = asset.match(/^cloud:([^:]+):(image|video):(3s-gym\/[a-zA-Z0-9_/-]+)$/);
          if (!match) throw new Error('Invalid cloud asset');
          if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) throw new Error('Cloudinary is not configured');
          if (match[1] !== process.env.CLOUDINARY_CLOUD_NAME) throw new Error('The configured Cloudinary account has changed');
          cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
          const result = await cloudinary.uploader.destroy(match[3], { resource_type: match[2], invalidate: true });
          if (!['ok', 'not found'].includes(result.result)) throw new Error('Media deletion failed');
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') failed.push(asset);
      }
    }
    if (failed.length) {
      await DeletionMediaJob.updateOne({ _id: job._id }, { $set: { assets: failed, nextAttemptAt: new Date(Date.now() + 5 * 60_000) } });
      logger.warn({ jobId: String(job._id), count: failed.length }, 'Account media deletion will be retried');
    } else await DeletionMediaJob.deleteOne({ _id: job._id });
  } finally { running = false; }
}

export function startDeletionMediaWorker() {
  if (timer) return;
  const tick = () => { void processDeletionMedia().catch(error => logger.error({ err: error }, 'Account media cleanup failed')); };
  timer = setInterval(tick, 60_000);
  timer.unref(); tick();
}
export function stopDeletionMediaWorker() { if (timer) clearInterval(timer); timer = undefined; }
