import { createHash } from "crypto";

export const EMBEDDING_DIMENSIONS = 512;

export function tokenize(text: string): string[] {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) || [];
}

function bucketFor(token: string): [number, number] {
  const hash = createHash("md5").update(token).digest();
  return [hash.readUInt32BE(0) % EMBEDDING_DIMENSIONS, (hash[4] & 1) === 0 ? 1 : -1];
}

export function embedText(text: string): number[] {
  const vector = Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  for (const token of tokenize(text)) {
    const [bucket, sign] = bucketFor(token);
    vector[bucket] += sign;
  }
  const magnitude = Math.hypot(...vector);
  return magnitude === 0 ? vector : vector.map((value) => value / magnitude);
}

export function cosineSimilarity(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  let score = 0;
  for (let index = 0; index < length; index += 1) score += left[index] * right[index];
  return score;
}

export const embeddingProvider = { embed: embedText };
