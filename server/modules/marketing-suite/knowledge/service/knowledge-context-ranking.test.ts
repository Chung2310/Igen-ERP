import { expect, it } from "vitest";
import { rankKnowledgeStream } from "./knowledge-context-ranking";

it("includes relevant older chunks beyond the old 1000-row cap, in bounded batches", async () => {
  async function* chunks() { for (let index = 0; index < 1250; index++) yield { index }; }
  let largestBatch = 0;
  const best = await rankKnowledgeStream(chunks(), batch => {
    largestBatch = Math.max(largestBatch, batch.length);
    return batch.map(chunk => ({ ...chunk, score: chunk.index }));
  }, 3);
  expect(best.map(item => item.index)).toEqual([1249, 1248, 1247]);
  expect(largestBatch).toBe(200);
});
