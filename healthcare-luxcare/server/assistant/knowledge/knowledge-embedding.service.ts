import { consentedProviderRouting } from "../../service/ai-sharing-context";
import { beforeAiProviderCall, recordAiProviderUsage } from "../../service/ai-usage.service";

export interface KnowledgeEmbeddingProvider {
  model: string;
  embed(
    texts: string[],
    inputType: "search_query" | "search_document",
    onProgress?: (completed: number, total: number) => Promise<void>,
  ): Promise<number[][]>;
}
async function requestEmbedding(request: () => Promise<Response>): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await request();
      if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
        await response.body?.cancel();
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }
      return response;
    } catch (error) {
      if (attempt > 0 || !(error instanceof Error) || !["TimeoutError", "AbortError", "TypeError"].includes(error.name))
        throw error;
    }
  }
}
export function getKnowledgeEmbeddingProvider(): KnowledgeEmbeddingProvider | null {
  const model = process.env.KNOWLEDGE_EMBEDDING_MODEL?.trim();
  if (!model) return null;
  return {
    model,
    async embed(texts, inputType, onProgress) {
      const key = process.env.OPENROUTER_API_KEY;
      if (!key) throw new Error("Chưa cấu hình khóa dịch vụ embedding.");
      const vectors: number[][] = [];
      for (let offset = 0; offset < texts.length; offset += 32) {
        const batch = texts.slice(offset, offset + 32);
        const response = await requestEmbedding(async () => {
          await beforeAiProviderCall();
          return fetch("https://openrouter.ai/api/v1/embeddings", {
            method: "POST",
            signal: AbortSignal.timeout(20_000),
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model, input: batch, input_type: inputType, encoding_format: "float", provider: consentedProviderRouting(model) }),
          });
        });
        if (!response.ok) throw new Error(`Dịch vụ embedding trả lỗi ${response.status}.`);
        const data = await response.json();
        await recordAiProviderUsage(data, model);
        const items = data.data?.sort((a: any, b: any) => a.index - b.index);
        if (
          !Array.isArray(items) ||
          items.length !== batch.length ||
          items.some(
            (item: any, index: number) =>
              item.index !== index ||
              !Array.isArray(item.embedding) ||
              !item.embedding.length ||
              item.embedding.some((v: unknown) => typeof v !== "number" || !Number.isFinite(v)),
          )
        )
          throw new Error("Dịch vụ embedding trả dữ liệu không hợp lệ.");
        vectors.push(...items.map((item: any) => item.embedding));
        await onProgress?.(vectors.length, texts.length);
      }
      if (vectors.some((vector) => vector.length !== vectors[0]?.length))
        throw new Error("Kích thước embedding không đồng nhất.");
      return vectors;
    },
  };
}
