import mongoose from 'mongoose';

const uri = 'mongodb://127.0.0.1:27018/igen_mongo_probe?replicaSet=gym-local';
const mode = process.argv[2] || 'verify';
await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
try {
  const collection = mongoose.connection.collection('checks');
  if (mode === 'write') {
    await collection.updateOne({ marker: 'persistent-local-db' }, { $set: { marker: 'persistent-local-db' } }, { upsert: true });
    console.log('Đã ghi dữ liệu kiểm tra vào MongoDB local.');
  } else {
    const record = await collection.findOne({ marker: 'persistent-local-db' });
    if (!record) throw new Error('Không tìm thấy dữ liệu sau khi khởi động lại MongoDB.');
    await collection.deleteOne({ marker: 'persistent-local-db' });
    console.log('Dữ liệu vẫn còn sau khi khởi động lại; đã dọn bản ghi kiểm tra.');
  }
} finally {
  await mongoose.disconnect();
}
