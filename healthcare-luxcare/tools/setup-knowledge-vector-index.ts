import "dotenv/config";
import mongoose from "mongoose";
import { KnowledgeRevisionChunkModel } from "../server/model/assistant-knowledge.model";
const dimensions = Number(process.argv.find((arg) => arg.startsWith("--dimensions="))?.split("=")[1]);
const name = process.env.KNOWLEDGE_VECTOR_INDEX || "knowledge_semantic";
if (!Number.isInteger(dimensions) || dimensions < 1 || dimensions > 8192)
  throw new Error("Cần --dimensions=N khớp với đầu ra mô hình embedding.");
const definition = {
  name,
  type: "vectorSearch",
  definition: {
    fields: [
      { type: "vector", path: "embedding", numDimensions: dimensions, similarity: "cosine" },
      ...["companyCode", "documentId", "revision", "embeddingModel"].map((path) => ({ type: "filter", path })),
    ],
  },
};
if (!process.argv.includes("--apply")) console.log(JSON.stringify(definition, null, 2));
else {
  if (!process.env.MONGODB_URI) throw new Error("Cần MONGODB_URI.");
  await mongoose.connect(process.env.MONGODB_URI, {
    user: process.env.MONGODB_USER,
    pass: process.env.MONGODB_PASSWORD,
    authSource: process.env.MONGODB_AUTH_SOURCE || "admin",
  });
  try {
    await KnowledgeRevisionChunkModel.collection.createSearchIndex(definition);
    console.log(`Đã yêu cầu tạo chỉ mục ${name}. Kiểm tra trạng thái READY trước khi bật.`);
  } finally {
    await mongoose.disconnect();
  }
}
