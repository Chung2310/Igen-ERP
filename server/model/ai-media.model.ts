import { Schema, model } from "mongoose";
import { IAIMedia } from "../interface/ai-media.interface";

const AIMediaSchema = new Schema<IAIMedia>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  mediaType: { type: String, enum: ["image", "video", "voice"], required: true, index: true },
  url: { type: String, default: "" },
  prompt: { type: String, required: true },
  metadata: {
    voiceName: { type: String },
    duration: { type: Schema.Types.Mixed },
    aspectRatio: { type: String },
    resolution: { type: String },
    originalVeoUrl: { type: String },
    heygenVideoId: { type: String, index: true },
    heygenAvatarId: { type: String },
    heygenVoiceId: { type: String },
    provider: { type: String },
    status: { type: String },
    title: { type: String },
    description: { type: String },
  },
  createdAt: { type: Date, default: Date.now, index: true },
});

export const AIMediaModel = model<IAIMedia>("AIMedia", AIMediaSchema);
