/** Rank the full permitted corpus with bounded application memory. */
export async function rankKnowledgeStream<T, R extends { score: number }>(
  chunks: AsyncIterable<T>,
  rankBatch: (batch: T[]) => R[],
  topK: number,
): Promise<R[]> {
  let best: R[] = [];
  let batch: T[] = [];
  const rank = () => {
    best = [...best, ...rankBatch(batch).filter(item => Number.isFinite(item.score))]
      .sort((a, b) => b.score - a.score).slice(0, topK);
    batch = [];
  };
  for await (const chunk of chunks) {
    batch.push(chunk);
    if (batch.length >= 200) rank();
  }
  if (batch.length) rank();
  return best;
}
