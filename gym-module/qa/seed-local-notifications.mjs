import { MongoClient } from 'mongodb';

if (process.env.GYM_QA_LOCAL_NOTIFICATION_SEED !== '1') {
  throw new Error('Set GYM_QA_LOCAL_NOTIFICATION_SEED=1 to seed local QA notifications.');
}

const client = new MongoClient('mongodb://127.0.0.1:27017/igen-erp');
await client.connect();
try {
  const db = client.db('igen-erp');
  const user = await db.collection('gym_users').findOne({ email: 'qa-gym-pt-20261121@example.com', role: 'PT' });
  if (!user?.centerId) throw new Error('QA PT or center not found.');
  const now = new Date();
  for (const index of [1, 2]) {
    await db.collection('gym_notifications').updateOne(
      { userId: user._id, type: 'QA_LOCAL_NOTICE', resourceType: 'qaNotice', resourceId: `qa-gym-20261121-${index}` },
      { $setOnInsert: { centerId: user.centerId, title: `QA Gym - Thông báo mẫu ${index}`, message: 'Dữ liệu kiểm thử thông báo trên local.', readAt: null, createdAt: now, updatedAt: now } },
      { upsert: true },
    );
  }
  console.log(JSON.stringify({ result: 'seeded', count: 2 }));
} finally {
  await client.close();
}
