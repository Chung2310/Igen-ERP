import mongoose, { type ClientSession } from "mongoose";
import { ObjectId } from "mongodb";
import type { GymActor } from "./access";
import { tenantFilter } from "./access";
import { gymCollections, type GymRecord } from "../../../shared/gym/types";

const DIMENSIONS = 128;
type Chunk = { _id: string; companyCode: string; branchId: string; documentId: string; documentVersion: number; topic: string; position: number; content: string; embedding: number[] };
const collection = () => {
  if (!mongoose.connection.db) throw new Error("Database chưa sẵn sàng.");
  return mongoose.connection.db.collection<Chunk>("gym_knowledge_chunks");
};
const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const hash = (value: string) => { let result = 2166136261; for (let index = 0; index < value.length; index++) result = Math.imul(result ^ value.charCodeAt(index), 16777619); return result >>> 0; };
export function embedKnowledge(value: string): number[] {
  const vector = Array<number>(DIMENSIONS).fill(0);
  const words = normalized(value).split(" ").filter(Boolean);
  const features = [...words, ...words.flatMap(word => word.length < 3 ? [word] : Array.from({ length: word.length - 2 }, (_, index) => word.slice(index, index + 3)))];
  for (const feature of features) vector[hash(feature) % DIMENSIONS]++;
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return magnitude ? vector.map(value => value / magnitude) : vector;
}
export function chunkKnowledge(content: string, chunkSize = 800, overlap = 150): string[] {
  const trimmed = content.trim();
  if (!trimmed) return [];
  if (trimmed.length <= chunkSize) return [trimmed];
  const chunks: string[] = [];
  let current = "";
  for (const para of trimmed.split(/\n\s*\n/).map(value => value.trim()).filter(Boolean)) {
    if (para.length > chunkSize) {
      if (current) { chunks.push(current.trim()); current = ""; }
      for (const sentence of para.split(/(?<=[.?!;])\s+/).filter(Boolean)) {
        if (`${current} ${sentence}`.trim().length > chunkSize && current) { chunks.push(current.trim()); current = `${current.slice(-overlap).trim()} ${sentence}`.trim(); }
        else current = `${current} ${sentence}`.trim();
      }
      if (current) { chunks.push(current.trim()); current = ""; }
      continue;
    }
    if (`${current}\n\n${para}`.trim().length <= chunkSize) current = current ? `${current}\n\n${para}` : para;
    else { if (current) chunks.push(current.trim()); current = `${current.slice(-overlap).trim()}\n\n${para}`.trim(); }
  }
  if (current) chunks.push(current.trim());
  return chunks.filter(value => value.length >= 20);
}
export async function indexKnowledge(actor: GymActor, documentId: string, version: number, topic: string, content: string, session?: ClientSession) {
  const scope = tenantFilter(actor);
  await collection().deleteMany({ ...scope, documentId }, { session });
  const chunks = chunkKnowledge(content);
  if (chunks.length) await collection().insertMany(chunks.map((text, position) => ({
    _id: new ObjectId().toHexString(), ...scope, documentId, documentVersion: version, topic, position, content: text, embedding: embedKnowledge(text),
  })), { session });
  return chunks.length;
}
export async function removeKnowledgeIndex(actor: GymActor, documentId: string, session?: ClientSession) {
  await collection().deleteMany({ ...tenantFilter(actor), documentId }, { session });
}
export async function searchKnowledge(actor: GymActor, query: string, limit = 5) {
  const scope = tenantFilter(actor);
  const queryVector = embedKnowledge(query);
  const chunks = await collection().find(scope).limit(5000).toArray();
  const documentIds = [...new Set(chunks.map(chunk => chunk.documentId))];
  const documents = await mongoose.connection.db!.collection<GymRecord>(gymCollections.knowledge).find({ ...scope, _id: { $in: documentIds }, status: "PUBLISHED" }).project({ _id: 1, title: 1 }).toArray();
  const titles = new Map(documents.map(doc => [String(doc._id), String(doc.title || "")]));
  const words = normalized(query).split(" ").filter(word => word.length > 2);
  return chunks.filter(chunk => titles.has(chunk.documentId)).map(chunk => ({
    documentId: chunk.documentId, title: titles.get(chunk.documentId), topic: chunk.topic, content: chunk.content,
    score: chunk.embedding.reduce((score, value, index) => score + value * queryVector[index], 0)
      + words.filter(word => normalized(chunk.content).includes(word)).length * 0.1,
  })).filter(hit => hit.score > 0.05).sort((a, b) => b.score - a.score).slice(0, Math.max(1, Math.min(20, limit)));
}
