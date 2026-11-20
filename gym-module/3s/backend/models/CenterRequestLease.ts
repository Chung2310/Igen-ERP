import mongoose, { Schema } from 'mongoose';

// Admission records for requests in a personal workspace. Joining a gym waits
// for existing requests to finish before changing tenant ownership.
const schema = new Schema({
  centerId: { type: Schema.Types.ObjectId, ref: 'Center', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true },
});
schema.index({ centerId: 1, expiresAt: 1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model('CenterRequestLease', schema);
