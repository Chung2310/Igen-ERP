import { MongoClient } from 'mongodb';

const uri = 'mongodb://127.0.0.1:27017/igen-erp';
const email = 'qa-gym-pt-20261121@example.com';
const batch = process.env.GYM_QA_CREDIT_BATCH || '1';
if (!/^\d{1,2}$/.test(batch)) throw new Error('Invalid QA credit batch.');
const idempotencyKey = `qa:gym:2026-11-21:pt-ai-credit:${batch}`;
const amount = 100;

if (process.env.GYM_QA_LOCAL_CREDIT_SEED !== '1') throw new Error('Set GYM_QA_LOCAL_CREDIT_SEED=1 to seed local QA credit.');
const client = new MongoClient(uri);
await client.connect();
try {
  const db = client.db('igen-erp');
  const user = await db.collection('users').findOne({ email, role: 'gym_pt' }, { projection: { _id: 1 } });
  if (!user) throw new Error('Dedicated QA Gym PT account was not found.');
  const userId = String(user._id);
  const existing = await db.collection('transactions').findOne({ $or: [{ idempotencyKey }, ...(batch === '1' ? [{ idempotencyKey: 'qa:gym:2026-11-21:pt-ai-credit' }] : [])] });
  if (existing) {
    console.log(JSON.stringify({ result: 'already-seeded', amount, user: email }));
  } else {
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        const wallet = db.collection('wallets');
        await wallet.updateOne({ userId }, { $setOnInsert: { userId, balance: 0, currency: 'USD' }, $set: { updatedAt: new Date() } }, { upsert: true, session });
        await wallet.updateOne({ userId }, { $inc: { balance: amount } }, { session });
        await db.collection('transactions').insertOne({
          userId, orderCode: Date.now() * 1000 + Math.floor(Math.random() * 1000), amount,
          type: 'deposit', status: 'success', description: 'QA local: Credit thử nghiệm AI Gym',
          idempotencyKey, createdAt: new Date(), completedAt: new Date(),
        }, { session });
      });
      console.log(JSON.stringify({ result: 'seeded', amount, user: email }));
    } finally {
      await session.endSession();
    }
  }
} finally {
  await client.close();
}
