/** Select bounded excerpts while retaining the original wording and source. */
export function projectEvidenceExcerpt(text: string, question: string, limit: number): string {
  if (!question.trim() || text.length <= limit) return text.slice(0, limit);
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase();
  const terms = [...new Set(normalize(question).split(/[^a-z0-9]+/).filter(word => word.length >= 3))];
  const chunks = text.match(/[\s\S]{1,1200}/g) || [];
  const ranked = chunks.map((content, index) => ({ content, index, score: terms.reduce((score, term) => score + Number(normalize(content).includes(term)), 0) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const selected: typeof ranked = [];
  let available = limit;
  for (const chunk of ranked) {
    if (available <= 0) break;
    const content = chunk.content.slice(0, available);
    selected.push({ ...chunk, content });
    available -= content.length + 5;
  }
  return selected.sort((a, b) => a.index - b.index).map(chunk => chunk.content).join("\n[…]\n").slice(0, limit);
}
