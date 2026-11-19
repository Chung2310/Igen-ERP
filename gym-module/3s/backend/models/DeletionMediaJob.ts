import mongoose from 'mongoose';

// Outside tenant collections: cleanup must survive deletion of its center.
const schema = new mongoose.Schema({
  assets: { type: [String], required: true },
  nextAttemptAt: { type: Date, default: Date.now, index: true },
  attempts: { type: Number, default: 0 },
}, { timestamps: true });
export default mongoose.model('DeletionMediaJob', schema);
