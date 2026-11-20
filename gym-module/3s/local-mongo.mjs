import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dataPath = path.join(workspace, 'tmp', 'gym-mongo');
await mkdir(dataPath, { recursive: true });

const mongo = await MongoMemoryReplSet.create({
  instanceOpts: [{ ip: '127.0.0.1', port: 27018, dbPath: dataPath }],
  replSet: { count: 1, name: 'gym-local', storageEngine: 'wiredTiger' },
});

const baseUri = mongo.getUri().replace(/\/$/, '');
console.log('MongoDB local đang chạy. Dữ liệu lưu tại:', dataPath);
console.log('ERP MONGODB_URI=' + baseUri.replace('/?', '/igen_erp_dev?'));
console.log('GYM_MONGODB_URI=' + baseUri.replace('/?', '/igen_gym_dev?'));
console.log('Nhấn Ctrl+C để dừng; dữ liệu vẫn được giữ lại.');

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await mongo.stop({ doCleanup: false });
  process.exit(0);
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
