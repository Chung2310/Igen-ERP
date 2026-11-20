import { Schema, model } from "mongoose";
export const BlogFileModel = model("BlogFile", new Schema({
  ownerId: { type: String, required: true, index: true },
  publicId: { type: String, required: true },
  name: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
}, { timestamps: true }));
