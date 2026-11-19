import { withAiBilling } from './aiBillingService.js';
import type { AiBillingContext } from './creditTypes.js';

const DIMENSIONS = 128;

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  return result >>> 0;
}

export function embedText(value: string) {
  const vector = Array<number>(DIMENSIONS).fill(0);
  const normalized = normalize(value);
  const tokens = normalized.split(' ').filter(Boolean);
  const features = [...tokens, ...tokens.flatMap((token) => token.length < 3 ? [token] : Array.from({ length: token.length - 2 }, (_, index) => token.slice(index, index + 3)))];
  for (const feature of features) vector[hash(feature) % DIMENSIONS] += 1;
  const magnitude = Math.sqrt(vector.reduce((sum, item) => sum + item * item, 0));
  return magnitude ? vector.map((item) => item / magnitude) : vector;
}

export function cosineSimilarity(left: number[], right: number[]) {
  const length = Math.min(left.length, right.length);
  let score = 0;
  for (let index = 0; index < length; index += 1) score += left[index] * right[index];
  return score;
}

export function embedTextBillable(context: AiBillingContext, value: string) {
  return withAiBilling(context, async () => ({
    value: embedText(value), usage: {}, provider: 'local', model: `hash-embedding-${DIMENSIONS}`,
  }));
}
