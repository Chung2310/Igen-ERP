import { Document, Types } from "mongoose";

export interface IAIMedia extends Document {
  userId: Types.ObjectId;
  mediaType: "image" | "video" | "voice";
  url: string;
  prompt: string;
  metadata?: {
    voiceName?: string;
    duration?: number | string;
    aspectRatio?: string;
    resolution?: string;
    originalVeoUrl?: string;
    heygenVideoId?: string;
    heygenAvatarId?: string;
    heygenVoiceId?: string;
    provider?: string;
    status?: string;
    title?: string;
    description?: string;
  };
  createdAt: Date;
}
