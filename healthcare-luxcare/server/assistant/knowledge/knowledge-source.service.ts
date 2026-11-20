import mongoose from "mongoose";
export function knowledgeSourceBucket() {
  if (!mongoose.connection.db) throw new Error("Cơ sở dữ liệu chưa sẵn sàng.");
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "knowledgeSources" });
}
export async function saveKnowledgeSource(companyCode: string, filename: string, data: Buffer, mimeType: string) {
  const stream = knowledgeSourceBucket().openUploadStream(filename, { metadata: { companyCode, mimeType } });
  await new Promise<void>((resolve, reject) => {
    stream.once("finish", resolve);
    stream.once("error", reject);
    stream.end(data);
  });
  return stream.id;
}
export async function readKnowledgeSource(companyCode: string, id: mongoose.Types.ObjectId) {
  const bucket = knowledgeSourceBucket();
  const file = await bucket.find({ _id: id, "metadata.companyCode": companyCode }).next();
  if (!file) throw new Error("Không tìm thấy tệp nguồn.");
  const parts: Buffer[] = [];
  let size = 0;
  for await (const part of bucket.openDownloadStream(id)) {
    size += part.length;
    if (size > 10 * 1024 * 1024) throw new Error("Tệp nguồn vượt giới hạn.");
    parts.push(part);
  }
  return {
    buffer: Buffer.concat(parts),
    filename: file.filename,
    mimeType: String(file.metadata?.mimeType || "application/octet-stream"),
  };
}
